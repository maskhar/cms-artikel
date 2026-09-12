import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugPattern } from "@/lib/slug";

const addonTypeSchema = z.enum(["gallery", "pdf_viewer", "image_slider", "video_embed", "call_to_action", "faq", "related_articles", "table_of_contents", "highlight_box", "file_download"]);
const articleAddonSchema = z.object({
  addon_type: addonTypeSchema,
  title: z.string().max(180).default(""),
  placement: z.enum(["before_content", "after_content"]).default("after_content"),
  config: z.record(z.string(), z.unknown()).default({}),
});

const articleSchema = z.object({
  siteId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).regex(slugPattern),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().default(""),
  seoTitle: z.string().max(180).optional().default(""),
  metaDescription: z.string().max(320).optional().default(""),
  featuredImagePath: z.string().max(500).nullable().optional(),
  ogImagePath: z.string().max(500).nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
  addons: z.array(articleAddonSchema).max(30).default([]),
  publishScope: z.enum(["selected_sites", "all_active_sites"]).default("selected_sites"),
});

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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { data, error } = await supabase.schema("artikel").from("articles").select("id, site_id, title, slug, status, updated_at, categories(name)").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = articleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid article payload", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  let categoryId = input.categoryId;
  if (input.publishScope === "all_active_sites") {
    const { data: globalAdmin } = await supabase.schema("artikel").from("user_roles").select("user_id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
    if (!globalAdmin) return NextResponse.json({ error: "Hanya admin global yang dapat menerbitkan ke semua website." }, { status: 403 });
    const admin = createAdminClient().schema("artikel");
    const { data: globalCategory, error: globalCategoryError } = await admin.from("categories").upsert({ site_id: input.siteId, name: "Global", slug: "global", description: "Kategori otomatis untuk artikel semua website." }, { onConflict: "site_id,slug" }).select("id").single();
    if (globalCategoryError || !globalCategory) return NextResponse.json({ error: globalCategoryError?.message ?? "Kategori Global tidak dapat disiapkan." }, { status: 400 });
    categoryId = globalCategory.id;
  }
  if (!categoryId) return NextResponse.json({ error: "Pilih kategori terlebih dahulu." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("articles").insert({ site_id: input.siteId, category_id: categoryId, author_id: user.id, title: input.title, slug: input.slug, excerpt: input.excerpt, content: input.content, seo_title: input.seoTitle, meta_description: input.metaDescription, featured_image_path: input.featuredImagePath ?? null, og_image_path: input.ogImagePath ?? null, publish_scope: input.publishScope }).select("id").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Slug artikel sudah digunakan pada website ini." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  try {
    await replaceTags(supabase, data.id, input.siteId, input.tagIds);
    if (input.addons.length) {
      const { error: addonError } = await supabase.schema("artikel").from("article_addons").insert(input.addons.map((addon, sortOrder) => ({
        article_id: data.id,
        site_id: input.siteId,
        addon_type: addon.addon_type,
        title: addon.title,
        placement: addon.placement,
        config: addon.config,
        sort_order: sortOrder,
        created_by: user.id,
      })));
      if (addonError) throw new Error(addonError.message);
    }
  } catch (writeError) {
    await supabase.schema("artikel").from("articles").delete().eq("id", data.id);
    return NextResponse.json({ error: writeError instanceof Error ? writeError.message : "Artikel gagal disimpan." }, { status: 400 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
