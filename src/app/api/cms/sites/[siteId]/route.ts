import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  
  // Use admin client to bypass RLS
  const adminDb = createAdminClient().schema("artikel");
  
  // Check dependencies
  const [articles, categories, tags] = await Promise.all([
    adminDb.from("articles").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    adminDb.from("categories").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    adminDb.from("tags").select("id", { count: "exact", head: true }).eq("site_id", siteId),
  ]);
  const dependencyError = articles.error ?? categories.error ?? tags.error;
  if (dependencyError) return NextResponse.json({ error: dependencyError.message }, { status: 500 });
  
  const dependencies = { articles: articles.count ?? 0, categories: categories.count ?? 0, tags: tags.count ?? 0 };
  if (Object.values(dependencies).some((count) => count > 0)) {
    return NextResponse.json({
      error: `Website belum kosong: ${dependencies.articles} artikel, ${dependencies.categories} kategori, ${dependencies.tags} tag. Nonaktifkan website atau hapus data terkait lebih dulu.`,
      code: "SITE_NOT_EMPTY",
      dependencies,
    }, { status: 409 });
  }
  
  // Use raw SQL to delete site with session_replication_role = replica to disable triggers
  const { error } = await adminDb.rpc("delete_site", { site_id: siteId });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
