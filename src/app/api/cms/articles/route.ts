import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugPattern } from "@/lib/slug";

const articleSchema = z.object({
  siteId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).regex(slugPattern),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().default(""),
  seoTitle: z.string().max(180).optional().default(""),
  metaDescription: z.string().max(320).optional().default(""),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = articleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid article payload", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await supabase.schema("artikel").from("articles").insert({ site_id: input.siteId, category_id: input.categoryId, author_id: user.id, title: input.title, slug: input.slug, excerpt: input.excerpt, content: input.content, seo_title: input.seoTitle, meta_description: input.metaDescription }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  try {
    await replaceTags(supabase, data.id, input.siteId, input.tagIds);
  } catch (tagError) {
    await supabase.schema("artikel").from("articles").delete().eq("id", data.id);
    return NextResponse.json({ error: tagError instanceof Error ? tagError.message : "Tag gagal disimpan." }, { status: 400 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
