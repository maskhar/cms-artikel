import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticatePublicApiKey } from "@/lib/public-api";

type Addon = { id: string; addon_type: string; title: string; placement: string; sort_order: number; config: Record<string, unknown> };
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const authentication = await authenticatePublicApiKey(request.headers.get("x-artikel-key")); if (authentication instanceof NextResponse) return authentication;
  const { slug } = await params; const admin = createAdminClient(); const db = admin.schema("artikel");
  const { data, error } = await db.from("articles").select("id, title, slug, excerpt, content, featured_image_path, seo_title, meta_description, canonical_url, robots, og_image_path, published_at, categories!inner(name, slug), article_tags(tags(name, slug))").eq("site_id", authentication.apiKey.site_id).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Artikel tidak dapat dimuat." } }, { status: 500, headers: authentication.headers });
  if (!data) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Artikel tidak ditemukan." } }, { status: 404, headers: authentication.headers });
  const { data: rawAddons } = await db.from("article_addons").select("id, addon_type, title, placement, sort_order, config").eq("article_id", data.id).eq("site_id", authentication.apiKey.site_id).eq("is_active", true).order("sort_order");
  const addons = await Promise.all(((rawAddons ?? []) as Addon[]).map(async (addon) => {
    const config = { ...addon.config };
    if (["gallery", "image_slider"].includes(addon.addon_type) && typeof config.gallery_id === "string") {
      const { data: gallery } = await db.from("galleries").select("id, name, slug, description, gallery_items(id, sort_order, caption_override, link_url, media_assets(id, file_name, mime_type, alt_text, caption, storage_path))").eq("id", config.gallery_id).eq("site_id", authentication.apiKey.site_id).order("sort_order", { referencedTable: "gallery_items" }).maybeSingle();
      if (gallery) {
        const items = await Promise.all((gallery.gallery_items ?? []).map(async (item) => { const asset = Array.isArray(item.media_assets) ? item.media_assets[0] : item.media_assets; if (!asset) return item; const { data: signed } = await admin.storage.from("artikel-media").createSignedUrl(asset.storage_path, 3600); const { storage_path: _storagePath, ...publicAsset } = asset; void _storagePath; return { ...item, media_assets: { ...publicAsset, url: signed?.signedUrl ?? null } }; }));
        config.gallery = { ...gallery, gallery_items: items };
      }
    }
    if (["pdf_viewer", "file_download"].includes(addon.addon_type) && typeof config.storage_path === "string") { const { data: signed } = await admin.storage.from("artikel-media").createSignedUrl(config.storage_path, 3600); config.url = signed?.signedUrl ?? null; delete config.storage_path; }
    return { ...addon, config };
  }));
  const { id: _id, ...article } = data; void _id;
  return NextResponse.json({ data: { ...article, addons } }, { headers: authentication.headers });
}
