"use client";

import { ArticleAddonsPanel } from "@/components/article-addons-panel";
import { ArticleMediaPicker } from "@/components/article-media-picker";
import { useSidebar } from "@/components/sidebar-context";
import { AppSidebar } from "@/components/app-sidebar";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SeoPreview } from "@/components/seo-preview";
import {
  Archive,
  CheckCircle2,
  Rocket,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tag = { id: string; name: string; slug: string };
type ArticleTag = { tag_id: string; tags: Tag | Tag[] | null };
type Article = {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_path: string | null;
  og_image_path: string | null;
  seo_title: string;
  meta_description: string;
  status: string;
  sites: { name: string; slug: string } | { name: string; slug: string }[] | null;
  article_tags: ArticleTag[];
};
type History = {
  revisions: {
    id: string;
    version: number;
    change_note: string;
    created_at: string;
  }[];
  comments: {
    id: string;
    body: string;
    status_from: string | null;
    status_to: string | null;
    created_at: string;
  }[];
};
const actions = [
  { key: "submit", label: "Kirim review", Icon: Send },
  { key: "request_revision", label: "Minta revisi", Icon: RotateCcw },
  { key: "approve", label: "Approve", Icon: CheckCircle2 },
  { key: "publish", label: "Publish", Icon: Rocket },
  { key: "archive", label: "Archive", Icon: Archive },
];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

export default function ArticleDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { collapsed } = useSidebar();
  const [article, setArticle] = useState<Article | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [history, setHistory] = useState<History>({
    revisions: [],
    comments: [],
  });
  const [allowedActions, setAllowedActions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [featuredImagePath, setFeaturedImagePath] = useState<string | null>(
    null,
  );
  const [ogImagePath, setOgImagePath] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [generatingSeo, setGeneratingSeo] = useState(false);
  useEffect(() => {
    void params.then(({ articleId }) =>
      fetch(`/api/cms/articles/${articleId}`)
        .then((response) => response.json())
        .then((body) => {
          const loaded = body.data as Article;
          if (!loaded) return;
          setArticle(loaded);
          setTags(body.tags ?? []);
          setHistory(body.history ?? { revisions: [], comments: [] });
          setAllowedActions(body.permissions?.actions ?? []);
          setTitle(loaded.title);
          setSlug(loaded.slug);
          setExcerpt(loaded.excerpt ?? "");
          setContent(loaded.content ?? "");
          setSeoTitle(loaded.seo_title ?? "");
          setMetaDescription(loaded.meta_description ?? "");
          setFeaturedImagePath(loaded.featured_image_path);
          setOgImagePath(loaded.og_image_path);
          setTagIds((loaded.article_tags ?? []).map((item) => item.tag_id));
        }),
    );
  }, [params]);
  function toggleTag(tagId: string) {
    setTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }
  function changeTitle(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  }
  async function generateSeo() {
    setGeneratingSeo(true);
    setMessage("Membuat metadata SEO...");
    const response = await fetch("/api/cms/ai/seo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, excerpt, content }),
    });
    const body = await response.json().catch(() => null);
    setGeneratingSeo(false);
    if (!response.ok) {
      setMessage(body?.error ?? "AI gagal membuat SEO.");
      return;
    }
    setSeoTitle(body.data.seoTitle);
    setMetaDescription(body.data.metaDescription);
    setMessage("SEO title dan meta description dibuat oleh AI.");
  }
  async function save() {
    if (!article) return;
    setMessage("Menyimpan...");
    const response = await fetch(`/api/cms/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        excerpt,
        content,
        seoTitle,
        metaDescription,
        featuredImagePath,
        ogImagePath,
        tagIds,
      }),
    });
    const body = await response.json().catch(() => null);
    setMessage(
      response.ok ? "Perubahan disimpan." : (body?.error ?? "Gagal menyimpan."),
    );
  }
  async function workflow(action: string) {
    if (!article) return;
    const response = await fetch(`/api/cms/articles/${article.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.error ?? "Aksi ditolak.");
      return;
    }
    setArticle({ ...article, status: body.status });
    setComment("");
    setMessage("Status artikel diperbarui. Memuat status terbaru...");
    window.location.reload();
  }
  if (!article)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Memuat artikel...
      </main>
    );
  const site = Array.isArray(article.sites) ? article.sites[0] : article.sites;
  return (
    <main className="min-h-screen bg-[#f8fafc] p-2 sm:p-5 lg:p-7">
      <div className={`mx-auto grid max-w-[1800px] gap-3 sm:gap-6 transition-[grid-template-columns] duration-200 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}>
        <AppSidebar />
        <section className="min-w-0">
          <div className="flex items-start justify-between gap-3 px-1 sm:items-center sm:px-0">
            <div>
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"
              >
                <ArrowLeft size={16} /> Kembali ke artikel
              </Link>
              <p className="mt-3 text-xs font-medium text-[#CE181E] sm:mt-5 sm:text-sm">
                Artikel
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Edit artikel</h1>
            </div>
            <span className="mt-7 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold sm:mt-0 sm:px-3 sm:text-sm">
              {article.status.replace("_", " ")}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:mt-7 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-5 md:p-7">
              <label className="block text-sm font-medium">
                Judul
                <input
                  required
                  value={title}
                  onChange={(event) => changeTitle(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Slug
                <input
                  required
                  value={slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(slugify(event.target.value));
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Ringkasan
                <textarea
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </label>
              <div>
                <p className="text-sm font-medium">Konten</p>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  siteId={article.site_id}
                  mediaFolder={article.id}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Metadata SEO</h2>
                <button
                  type="button"
                  disabled={!title || generatingSeo}
                  onClick={generateSeo}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#CE181E] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  {generatingSeo ? "Membuat..." : "Generate dengan AI"}
                </button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-medium">
                  SEO title
                  <input
                    value={seoTitle}
                    maxLength={180}
                    onChange={(event) => setSeoTitle(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </label>
                <label className="text-sm font-medium">
                  Meta description
                  <textarea
                    value={metaDescription}
                    maxLength={320}
                    onChange={(event) => setMetaDescription(event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </label>
              </div>
              <button
                onClick={() => void save()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#CE181E] px-4 py-3 text-sm font-semibold text-white sm:ml-auto sm:w-auto"
              >
                <Save size={17} /> Simpan perubahan
              </button>
            </section>
            <aside className="space-y-5 xl:sticky xl:top-7 xl:max-h-[calc(100vh-3.5rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-semibold">Workflow dan review</h2>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Komentar review (wajib saat minta revisi)"
              rows={3}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {actions
                .filter(({ key }) => allowedActions.includes(key))
                .map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => workflow(key)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
            </div>
            </section>
              <ArticleMediaPicker
                articleId={article.id}
                siteId={article.site_id}
                siteSlug={Array.isArray(article.sites) ? article.sites[0]?.slug ?? "" : article.sites?.slug ?? ""}
                articleSlug={article.slug}
                label="Featured image"
                value={featuredImagePath}
                onChange={setFeaturedImagePath}
              />
              <ArticleMediaPicker
                articleId={article.id}
                siteId={article.site_id}
                siteSlug={Array.isArray(article.sites) ? article.sites[0]?.slug ?? "" : article.sites?.slug ?? ""}
                articleSlug={article.slug}
                label="Open Graph image"
                value={ogImagePath}
                onChange={setOgImagePath}
              />
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="font-semibold">Tag artikel</h2>
                <div className="mt-3 space-y-2">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={tagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                  {!tags.length && (
                    <p className="text-sm text-slate-500">Belum ada tag.</p>
                  )}
                </div>
              </section>
              <ArticleAddonsPanel
                articleId={article.id}
                siteId={article.site_id}
                siteSlug={Array.isArray(article.sites) ? article.sites[0]?.slug ?? "" : article.sites?.slug ?? ""}
                articleSlug={article.slug}
              />
              <SeoPreview
                siteName={site?.name}
                title={title}
                slug={slug}
                seoTitle={seoTitle}
                metaDescription={metaDescription}
                ogImagePath={ogImagePath}
              />
              {message && (
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  {message}
                </p>
              )}
            </aside>
          </div>
          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Revision history</h2>
              <div className="mt-4 space-y-3">
                {history.revisions.map((revision) => (
                  <div
                    key={revision.id}
                    className="rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <strong>Versi {revision.version}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {revision.change_note} ·{" "}
                      {new Date(revision.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))}
                {!history.revisions.length && (
                  <p className="text-sm text-slate-500">Belum ada revisi.</p>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Komentar review</h2>
              <div className="mt-4 space-y-3">
                {history.comments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <p>{item.body}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.status_from ?? "-"} → {item.status_to ?? "-"} ·{" "}
                      {new Date(item.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))}
                {!history.comments.length && (
                  <p className="text-sm text-slate-500">
                    Belum ada komentar review.
                  </p>
                )}
              </div>
            </section>
            </div>
        </section>
      </div>
    </main>
  );
}




