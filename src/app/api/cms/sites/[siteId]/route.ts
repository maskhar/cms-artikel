import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const siteId = (await params).siteId;
  if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: "Site ID tidak valid." }, { status: 400 });
  const parsed = z.object({ isActive: z.boolean() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Status tenant tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("sites").update({ is_active: parsed.data.isActive }).eq("id", siteId).select("id, is_active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const siteId = (await params).siteId;
  if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: "Site ID tidak valid." }, { status: 400 });
  const db = supabase.schema("artikel");
  const [articles, categories, tags] = await Promise.all([
    db.from("articles").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    db.from("categories").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    db.from("tags").select("id", { count: "exact", head: true }).eq("site_id", siteId),
  ]);
  const dependencyError = articles.error ?? categories.error ?? tags.error;
  if (dependencyError) return NextResponse.json({ error: dependencyError.message }, { status: 400 });
  const dependencies = { articles: articles.count ?? 0, categories: categories.count ?? 0, tags: tags.count ?? 0 };
  if (Object.values(dependencies).some((count) => count > 0)) {
    return NextResponse.json({
      error: `Website belum kosong: ${dependencies.articles} artikel, ${dependencies.categories} kategori, ${dependencies.tags} tag. Nonaktifkan website atau hapus data terkait lebih dulu.`,
      code: "SITE_NOT_EMPTY",
      dependencies,
    }, { status: 409 });
  }
  const { data, error } = await db.from("sites").delete().eq("id", siteId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.code === "23503" ? "Tenant masih memiliki artikel, kategori, atau data terkait." : error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
