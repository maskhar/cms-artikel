import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-error";

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { siteId, categoryId } = await params;
  if (!z.string().uuid().safeParse(siteId).success || !z.string().uuid().safeParse(categoryId).success) return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("categories").delete().eq("id", categoryId).eq("site_id", siteId).select("id").maybeSingle();
  if (error) return error.code === "23503" ? NextResponse.json({ error: "Kategori masih dipakai artikel." }, { status: 409 }) : dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
