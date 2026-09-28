import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Wajib dibersihkan: kalau tertinggal, login berikutnya mewarisi waktu mulai
  // sesi lama dan bisa langsung dianggap kedaluwarsa oleh proxy.ts.
  (await cookies()).delete(SESSION_TIMESTAMP_KEY);
  return NextResponse.json({ success: true });
}
