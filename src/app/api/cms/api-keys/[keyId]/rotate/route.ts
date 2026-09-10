import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyHash } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isFutureExpiration } from "@/lib/api-key";

const rotateSchema = z.object({ expiresAt: z.string().datetime().nullable().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const keyId = (await params).keyId;
  if (!z.string().uuid().safeParse(keyId).success) return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
  const parsed = rotateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Expiry tidak valid." }, { status: 400 });
  if (!isFutureExpiration(parsed.data.expiresAt)) return NextResponse.json({ error: "Expiry harus berada di masa depan." }, { status: 400 });
  const { data: previous, error: readError } = await supabase.schema("artikel").from("api_keys").select("site_id, label, expires_at").eq("id", keyId).is("revoked_at", null).single();
  if (readError || !previous) return NextResponse.json({ error: "API key aktif tidak ditemukan." }, { status: 404 });
  if (!isFutureExpiration(previous.expires_at)) return NextResponse.json({ error: "API key lama telah kedaluwarsa." }, { status: 400 });
  const rawKey = `ak_live_${randomBytes(24).toString("base64url")}`;
  const { data: created, error: createError } = await supabase.schema("artikel").from("api_keys").insert({ site_id: previous.site_id, label: `${previous.label} (rotated)`, key_prefix: rawKey.slice(0, 15), secret_hash: apiKeyHash(rawKey), expires_at: parsed.data.expiresAt ?? previous.expires_at, created_by: user.id }).select("id, label, key_prefix, expires_at, created_at").single();
  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });
  const { error: revokeError } = await supabase.schema("artikel").from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).is("revoked_at", null);
  if (revokeError) return NextResponse.json({ error: "Key baru dibuat, tetapi key lama gagal direvoke. Revoke key lama manual segera." }, { status: 500 });
  return NextResponse.json({ data: { ...created, key: rawKey } }, { status: 201 });
}
