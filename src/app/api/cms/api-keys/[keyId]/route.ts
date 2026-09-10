import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function DELETE(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const keyId = (await params).keyId;
  if (!z.string().uuid().safeParse(keyId).success) return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
  const { error } = await supabase.schema("artikel").from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

