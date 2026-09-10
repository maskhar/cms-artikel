import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ hostnameId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = (await params).hostnameId;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Hostname ID tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").delete().eq("id", id).eq("is_canonical", false).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Hostname tidak ditemukan atau merupakan domain canonical." }, { status: 404 });
  return NextResponse.json({ success: true });
}
