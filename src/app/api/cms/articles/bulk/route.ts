import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), action: z.enum(["review", "archive", "status", "delete"]), status: z.enum(["draft", "in_review", "revision_requested", "approved", "published", "archived"]).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Payload bulk tidak valid." }, { status: 400 });
  const { ids, action, status } = parsed.data; const db = supabase.schema("artikel");
  const { data: articles, error: articleError } = await db.from("articles").select("id, site_id, status").in("id", ids);
  if (articleError) return NextResponse.json({ error: articleError.message }, { status: 400 });
  if (!articles?.length) return NextResponse.json({ error: "Artikel tidak ditemukan atau tidak dapat diakses." }, { status: 404 });
  const siteIds = [...new Set(articles.map((article) => article.site_id))];
  const { data: roles } = await db.from("user_roles").select("role, site_id").eq("user_id", user.id).eq("is_active", true).in("role", ["admin", "editor"]);
  const privileged = (siteId: string) => (roles ?? []).some((role) => role.role === "admin" && role.site_id === null || ["admin", "editor"].includes(role.role) && role.site_id === siteId);
  if (["status", "archive"].includes(action) && siteIds.some((siteId) => !privileged(siteId))) return NextResponse.json({ error: "Admin atau editor diperlukan." }, { status: 403 });
  if (action === "delete" && !(roles ?? []).some((role) => role.role === "admin" && (role.site_id === null || siteIds.includes(role.site_id)))) return NextResponse.json({ error: "Admin diperlukan untuk delete permanen." }, { status: 403 });
  let query;
  if (action === "review") query = db.from("articles").update({ status: "in_review", submitted_at: new Date().toISOString() }).in("id", ids).in("status", ["draft", "revision_requested"]);
  else if (action === "archive") query = db.from("articles").update({ status: "archived", archived_at: new Date().toISOString() }).in("id", ids).eq("status", "published");
  else if (action === "status" && status) query = db.from("articles").update({ status }).in("id", ids);
  else if (action === "delete") query = db.from("articles").delete().in("id", ids);
  else return NextResponse.json({ error: "Status tujuan wajib dipilih." }, { status: 400 });
  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.code === "23503" ? "Artikel masih memiliki data terkait yang mencegah delete." : error.message }, { status: 400 });
  return NextResponse.json({ data: { affected: data?.length ?? 0 } });
}
