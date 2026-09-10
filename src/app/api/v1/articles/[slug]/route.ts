import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticatePublicApiKey } from "@/lib/public-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const authentication = await authenticatePublicApiKey(request.headers.get("x-artikel-key"));
  if (authentication instanceof NextResponse) return authentication;
  const { slug } = await params;
  const supabase = createAdminClient().schema("artikel");
  const { data, error } = await supabase.from("articles").select("title, slug, excerpt, content, featured_image_path, seo_title, meta_description, canonical_url, robots, og_image_path, published_at, categories!inner(name, slug), article_tags(tags(name, slug))").eq("site_id", authentication.apiKey.site_id).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Artikel tidak dapat dimuat." } }, { status: 500, headers: authentication.headers });
  if (!data) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Artikel tidak ditemukan." } }, { status: 404, headers: authentication.headers });
  return NextResponse.json({ data }, { headers: authentication.headers });
}
