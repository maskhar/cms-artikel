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
  const { data: previous, error: readError } = await supabase.schema("artikel").from("api_keys").select("expires_at").eq("id", keyId).is("revoked_at", null).single();
  if (readError || !previous) return NextResponse.json({ error: "API key aktif tidak ditemukan." }, { status: 404 });
  if (!isFutureExpiration(previous.expires_at)) return NextResponse.json({ error: "API key lama telah kedaluwarsa." }, { status: 400 });
  const rawKey = `ak_live_${randomBytes(24).toString("base64url")}`;
  const { data: rotated, error: rotateError } = await supabase.schema("artikel").from("api_keys").update({ key_prefix: rawKey.slice(0, 15), secret_hash: apiKeyHash(rawKey), expires_at: parsed.data.expiresAt ?? previous.expires_at, last_used_at: null }).eq("id", keyId).is("revoked_at", null).select("id, label, key_prefix, expires_at, created_at").single();
  if (rotateError) return NextResponse.json({ error: rotateError.message }, { status: 400 });
  return NextResponse.json({ data: { ...rotated, key: rawKey } });
}
