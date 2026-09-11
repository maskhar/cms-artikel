import { NextResponse } from "next/server";
import { apiKeyHash, createAdminClient } from "@/lib/supabase/admin";

const maxRequests = Number.parseInt(process.env.ARTIKEL_RATE_LIMIT_REQUESTS ?? "120", 10);
const windowSeconds = Number.parseInt(process.env.ARTIKEL_RATE_LIMIT_WINDOW_SECONDS ?? "60", 10);
const rateLimitRequests = Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 120;
const rateLimitWindowSeconds = Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : 60;

export type PublicApiKey = { id: string; site_id: string };
type RateLimitResult = { allowed: boolean; remaining: number; reset_at: string };

export async function authenticatePublicApiKey(key: string | null): Promise<{ apiKey: PublicApiKey; headers: Headers } | NextResponse> {
  if (!key) return NextResponse.json({ error: { code: "INVALID_API_KEY", message: "API key wajib diisi." } }, { status: 401 });
  const supabase = createAdminClient().schema("artikel");
  const { data: apiKey } = await supabase.from("api_keys").select("id, site_id, sites!inner(is_active)").eq("secret_hash", apiKeyHash(key)).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).maybeSingle();
  if (!apiKey) return NextResponse.json({ error: { code: "INVALID_API_KEY", message: "API key tidak valid atau telah kedaluwarsa." } }, { status: 401 });
  const site = Array.isArray(apiKey.sites)
    ? (apiKey.sites[0] as unknown as { is_active: boolean } | undefined)
    : (apiKey.sites as unknown as { is_active: boolean } | null);
  if (!site?.is_active) return NextResponse.json({ error: { code: "SITE_INACTIVE", message: "Website tidak aktif." } }, { status: 403 });

  const { data: rawLimit, error: limitError } = await supabase.rpc("consume_api_key_rate_limit", { api_key_id: apiKey.id, max_requests: rateLimitRequests, window_seconds: rateLimitWindowSeconds });
  const limit = (Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) as RateLimitResult | null;
  if (limitError || !limit) {
    console.error("Public API rate limit error", limitError);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Rate limit tidak dapat diproses." } }, { status: 500 });
  }
  const headers = new Headers({ "X-RateLimit-Limit": String(rateLimitRequests), "X-RateLimit-Remaining": String(limit.remaining), "X-RateLimit-Reset": String(Math.ceil(new Date(limit.reset_at).getTime() / 1000)) });
  if (!limit.allowed) {
    headers.set("Retry-After", String(Math.max(1, Math.ceil((new Date(limit.reset_at).getTime() - Date.now()) / 1000))));
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Terlalu banyak request. Coba lagi setelah window rate limit berakhir." } }, { status: 429, headers });
  }
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
  return { apiKey, headers };
}

