type SeoPreviewProps = { siteName?: string; title: string; slug: string; seoTitle: string; metaDescription: string; ogImagePath: string | null };

export function SeoPreview({ siteName, title, slug, seoTitle, metaDescription, ogImagePath }: SeoPreviewProps) {
  const displayTitle = seoTitle || title || "Judul artikel";
  const description = metaDescription || "Tambahkan meta description untuk hasil pencarian yang lebih jelas.";
  return <section className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold">SEO preview</h2><div className="mt-4 rounded-lg border border-slate-200 p-4"><p className="truncate text-sm text-emerald-700">{siteName || "website"}/{slug || "slug-artikel"}</p><p className="mt-1 truncate text-lg text-blue-700">{displayTitle}</p><p className="mt-1 line-clamp-2 text-sm text-slate-600">{description}</p></div><p className="mt-3 text-xs text-slate-500">SEO title: {seoTitle.length}/60 · Meta description: {metaDescription.length}/160</p>{ogImagePath && <p className="mt-2 break-all text-xs text-slate-500">OG image: {ogImagePath}</p>}</section>;
}
