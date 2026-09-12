import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticatePublicApiKey } from "@/lib/public-api";

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "10"), MAX_LIMIT);
  if (!category || !Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Parameter category, page, atau limit tidak valid." } }, { status: 400 });

  const authentication = await authenticatePublicApiKey(request.headers.get("x-artikel-key"));
  if (authentication instanceof NextResponse) return authentication;
  const supabase = createAdminClient().schema("artikel");
  const start = (page - 1) * limit;
  const { data: distributions, error, count } = await supabase.from("article_sites").select("slug, published_at, categories:category_id!inner(slug, name), articles!inner(title, excerpt, featured_image_path, seo_title, meta_description, article_tags(tags(name, slug)))", { count: "exact" }).eq("site_id", authentication.apiKey.site_id).eq("status", "published").eq("categories.slug", category).order("published_at", { ascending: false }).range(start, start + limit - 1);
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Artikel tidak dapat dimuat." } }, { status: 500, headers: authentication.headers });
  const publicData = await Promise.all((distributions ?? []).map(async (distribution) => {
    const article = Array.isArray(distribution.articles) ? distribution.articles[0] : distribution.articles;
    const { data: image } = article?.featured_image_path
      ? await createAdminClient().storage.from("artikel-media").createSignedUrl(article.featured_image_path, 3600)
      : { data: null };
    const category = Array.isArray(distribution.categories) ? distribution.categories[0] : distribution.categories;
    return { ...article, slug: distribution.slug, published_at: distribution.published_at, featured_image_url: image?.signedUrl ?? null, category };
  }));
  return NextResponse.json({ data: publicData, meta: { page, limit, total: count ?? 0 } }, { headers: authentication.headers });
}

