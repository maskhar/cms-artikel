import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyHash } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isFutureExpiration } from "@/lib/api-key";

const createSchema = z.object({ siteId: z.string().uuid(), label: z.string().trim().min(2).max(80), expiresAt: z.string().datetime().nullable().optional() });
export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { data, error } = await supabase.schema("artikel").from("api_keys").select("id, site_id, label, key_prefix, last_used_at, expires_at, revoked_at, created_at, sites(name, domain)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Website, label, atau expiry tidak valid." }, { status: 400 });
  if (!isFutureExpiration(parsed.data.expiresAt)) return NextResponse.json({ error: "Expiry harus berada di masa depan." }, { status: 400 });
  const rawKey = `ak_live_${randomBytes(24).toString("base64url")}`;
  const { data, error } = await supabase.schema("artikel").from("api_keys").insert({ site_id: parsed.data.siteId, label: parsed.data.label, key_prefix: rawKey.slice(0, 15), secret_hash: apiKeyHash(rawKey), expires_at: parsed.data.expiresAt ?? null, created_by: user.id }).select("id, label, key_prefix, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: { ...data, key: rawKey } }, { status: 201 });
}

