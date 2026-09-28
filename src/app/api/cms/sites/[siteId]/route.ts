import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSiteRole } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const siteId = (await params).siteId;
  if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: "Site ID tidak valid." }, { status: 400 });
  const parsed = z.object({ isActive: z.boolean() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Status tenant tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("sites").update({ is_active: parsed.data.isActive }).eq("id", siteId).select("id, is_active").maybeSingle();
  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const siteId = (await params).siteId;
  if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: "Site ID tidak valid." }, { status: 400 });

  // Gerbang lapis aplikasi sebelum menyentuh service-role client.
  // delete_site di DB memverifikasi ulang lewat actor_id.
  const session = await requireSiteRole(siteId, ["admin"], "Hanya admin website ini yang boleh menghapus.");
  if (session.response) return session.response;
  const user = session.user;

  // Use admin client to bypass RLS
  const adminDb = createAdminClient().schema("artikel");

  // Penolakan "website belum kosong" dihapus di migrasi 202609280003: artikel
  // tidak lagi menghalangi penghapusan, ia jadi draf tak bertuan yang hanya
  // terlihat admin global dan bisa dipungut kembali. Jumlahnya tetap dihitung —
  // bukan untuk memblokir, tapi supaya pemanggil tahu apa yang baru saja terjadi
  // pada isinya, dan UI bisa mengatakannya alih-alih "Website dihapus." polos.
  const { count: orphanedCount, error: countError } = await adminDb
    .from("articles").select("id", { count: "exact", head: true }).eq("site_id", siteId);
  if (countError) return dbErrorResponse(countError, undefined, 500);

  const { error } = await adminDb.rpc("delete_site", { site_id: siteId, actor_id: user.id });

  if (error) return dbErrorResponse(error, undefined, 500);

  return NextResponse.json({ success: true, orphanedArticles: orphanedCount ?? 0 });
}
