import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function DELETE(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const keyId = (await params).keyId;
  if (!z.string().uuid().safeParse(keyId).success) return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("api_keys").delete().eq("id", keyId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "API key tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}

