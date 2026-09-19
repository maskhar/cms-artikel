import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SESSION_DURATION_MS, SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

export type CmsRole = "admin" | "editor" | "writer";
type ServerClient = Awaited<ReturnType<typeof createClient>>;
type Allowed = { user: User; supabase: ServerClient; response: null };
type Denied = { user: null; supabase: null; response: NextResponse };
export type AuthResult = Allowed | Denied;

const deny = (message: string, status: number): Denied => ({ user: null, supabase: null, response: NextResponse.json({ error: message }, { status }) });

/** Sesi wajib ada. Pakai `supabase` yang dikembalikan supaya RLS tetap berlaku. */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return deny("Unauthenticated", 401);

  // Rute API tidak dilewati proxy.ts (matcher-nya mengecualikan /api), jadi
  // kebijakan 6 jam ditegakkan lagi di sini pakai cookie httpOnly yang sama.
  const cookieStore = await cookies();
  const cookieStart = cookieStore.get(SESSION_TIMESTAMP_KEY)?.value;
  if (cookieStart && Date.now() - parseInt(cookieStart, 10) >= SESSION_DURATION_MS) {
    await supabase.auth.signOut();
    cookieStore.delete(SESSION_TIMESTAMP_KEY);
    return deny("Sesi Anda telah berakhir setelah 6 jam. Silakan masuk kembali.", 401);
  }

  return { user, supabase, response: null };
}

/** Admin tanpa scope site (`site_id is null`) — wewenang lintas tenant. */
export async function isGlobalAdmin(userId: string) {
  const { data } = await createAdminClient().schema("artikel").from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
  return Boolean(data);
}

export async function requireGlobalAdmin(message = "Admin global diperlukan."): Promise<AuthResult> {
  const session = await requireUser();
  if (!session.user) return session;
  return await isGlobalAdmin(session.user.id) ? session : deny(message, 403);
}

/**
 * Role pada satu site. Menumpang RPC `artikel.has_site_role` yang juga dipakai
 * seluruh policy RLS, jadi keputusan izin di aplikasi dan di database identik.
 */
export async function requireSiteRole(siteId: string, roles: CmsRole[], message = "Akses website ini tidak diizinkan."): Promise<AuthResult> {
  const session = await requireUser();
  if (!session.user) return session;
  const { data, error } = await (session.supabase as SupabaseClient).schema("artikel").rpc("has_site_role", { target_site_id: siteId, allowed_roles: roles });
  if (error) return deny("Izin tidak dapat diperiksa.", 500);
  return data === true ? session : deny(message, 403);
}
