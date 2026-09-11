import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugPattern } from "@/lib/slug";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(slugPattern),
  excerpt: z.string().max(500),
  content: z.string(),
  seoTitle: z.string().max(180),
  metaDescription: z.string().max(320),
  featuredImagePath: z.string().max(500).nullable(),
  ogImagePath: z.string().max(500).nullable(),
  tagIds: z.array(z.string().uuid()).max(30),
});

function allowedActions(status: string, roles: string[]) { const privileged = roles.includes("admin") || roles.includes("editor"); if (!privileged) return ["draft", "revision_requested"].includes(status) ? ["submit"] : []; if (["draft", "revision_requested"].includes(status)) return ["submit"]; if (status === "in_review") return ["request_revision", "approve"]; if (status === "approved") return ["publish", "reopen"]; if (status === "published") return ["archive", "reopen"]; if (status === "archived") return ["reopen"]; return []; }

async function replaceTags(supabase: Awaited<ReturnType<typeof createClient>>, articleId: string, siteId: string, tagIds: string[]) {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length) {
    const { data: tags, error } = await supabase.schema("artikel").from("tags").select("id").eq("site_id", siteId).in("id", uniqueTagIds);
    if (error || tags?.length !== uniqueTagIds.length) throw new Error("Tag tidak valid untuk website ini.");
  }
  const relation = supabase.schema("artikel").from("article_tags");
  const { error: removeError } = await relation.delete().eq("article_id", articleId);
  if (removeError) throw new Error(removeError.message);
  if (!uniqueTagIds.length) return;
  const { error: insertError } = await relation.insert(uniqueTagIds.map((tagId) => ({ article_id: articleId, tag_id: tagId })));
  if (insertError) throw new Error(insertError.message);
}

export async function GET(_request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = (await params).articleId;
  const articleResult = await supabase.schema("artikel").from("articles").select("id, site_id, category_id, title, slug, excerpt, content, featured_image_path, og_image_path, seo_title, meta_description, status, created_at, updated_at, categories(name), sites(name, slug), article_tags(tag_id, tags(id, name, slug))").eq("id", id).single();
  if (articleResult.error) return NextResponse.json({ error: articleResult.error.message }, { status: 404 });
  const article = articleResult.data;
  const [revisionsResult, commentsResult, rolesResult, tagsResult] = await Promise.all([
    supabase.schema("artikel").from("article_revisions").select("id, version, change_note, created_at").eq("article_id", id).order("version", { ascending: false }),
    supabase.schema("artikel").from("review_comments").select("id, body, status_from, status_to, created_at").eq("article_id", id).order("created_at", { ascending: false }),
    supabase.schema("artikel").from("user_roles").select("role").eq("user_id", user.id).or(`site_id.eq.${article.site_id},site_id.is.null`),
    supabase.schema("artikel").from("tags").select("id, name, slug").eq("site_id", article.site_id).order("name"),
  ]);
  const roles = (rolesResult.data ?? []).map((item) => item.role);
  return NextResponse.json({ data: article, tags: tagsResult.data ?? [], history: { revisions: revisionsResult.data ?? [], comments: commentsResult.data ?? [] }, permissions: { roles, actions: allowedActions(article.status, roles) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Payload artikel tidak valid." }, { status: 400 });
  const id = (await params).articleId;
  const { data: existing, error: existingError } = await supabase.schema("artikel").from("articles").select("site_id").eq("id", id).single();
  if (existingError) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
  const input = parsed.data;
  const { error } = await supabase.schema("artikel").from("articles").update({ title: input.title, slug: input.slug, excerpt: input.excerpt, content: input.content, seo_title: input.seoTitle, meta_description: input.metaDescription, featured_image_path: input.featuredImagePath, og_image_path: input.ogImagePath }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  try {
    await replaceTags(supabase, id, existing.site_id, input.tagIds);
  } catch (tagError) {
    return NextResponse.json({ error: tagError instanceof Error ? tagError.message : "Tag gagal disimpan." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

