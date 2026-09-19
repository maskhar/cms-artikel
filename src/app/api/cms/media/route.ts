import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const createSchema = z.object({ storagePath: z.string().trim().min(3).max(500).refine((value) => !value.startsWith("/") && !value.includes(".."), "Storage path tidak valid."), fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(255), fileSize: z.number().int().nonnegative().max(20 * 1024 * 1024), altText: z.string().trim().max(300).default("") });
async function authenticatedClient() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user }; }

// Cerminan artikel.storage_site_id() di SQL: segmen folder pertama menentukan
// pemilik media. site_id sengaja diturunkan dari path, bukan diterima dari
// klien, supaya cocok dengan WITH CHECK policy media_assets.
async function resolveSiteId(supabase: SupabaseClient, storagePath: string) {
  const prefix = storagePath.split("/")[0] ?? "";
  if (uuidPattern.test(prefix)) return prefix;
  const { data } = await supabase.schema("artikel").from("sites").select("id").eq("slug", prefix).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function GET() { const { supabase, user } = await authenticatedClient(); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 }); const { data, error } = await supabase.schema("artikel").from("media_assets").select("id, site_id, storage_path, file_name, mime_type, file_size, alt_text, created_at").order("created_at", { ascending: false }); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data }); }
export async function POST(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Metadata media tidak valid." }, { status: 400 });
  const input = parsed.data;
  const siteId = await resolveSiteId(supabase, input.storagePath);
  if (!siteId) return NextResponse.json({ error: "Website pemilik media tidak dikenali dari path upload." }, { status: 400 });

  // upsert onConflict: storage_path bisa menimpa baris milik user lain kalau
  // path-nya ditebak/diketahui. Verifikasi kepemilikan sebelum menulis.
  const { data: existing } = await supabase.schema("artikel").from("media_assets").select("id, created_by").eq("storage_path", input.storagePath).maybeSingle();
  if (existing && existing.created_by !== user.id) {
    return NextResponse.json({ error: "Media pada path ini milik pengguna lain." }, { status: 409 });
  }

  const { data, error } = await supabase.schema("artikel").from("media_assets").upsert({ site_id: siteId, storage_path: input.storagePath, file_name: input.fileName, mime_type: input.mimeType, file_size: input.fileSize, alt_text: input.altText, created_by: user.id }, { onConflict: "storage_path" }).select("id, site_id, storage_path, file_name, mime_type, file_size, alt_text, created_at").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data }, { status: 201 });
}
