"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SeoPreview } from "@/components/seo-preview";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Option = { id: string; name: string; slug?: string };

export default function NewArticlePage() {
  const router = useRouter();
  const [sites, setSites] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/cms/sites").then((response) => response.json()).then((body) => setSites(body.data ?? [])); }, []);
  useEffect(() => {
    if (!siteId) return;
    void Promise.all([fetch(`/api/cms/categories?siteId=${siteId}`).then((response) => response.json()), fetch(`/api/cms/tags?siteId=${siteId}`).then((response) => response.json())]).then(([categoryBody, tagBody]) => { setCategories(categoryBody.data ?? []); setTags(tagBody.data ?? []); });
  }, [siteId]);

  function changeSite(nextSiteId: string) { setSiteId(nextSiteId); setCategories([]); setTags([]); setTagIds([]); }
  function toggleTag(tagId: string) { setTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("Menyimpan...");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/cms/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, categoryId: form.get("categoryId"), title, slug, excerpt: form.get("excerpt"), content, seoTitle, metaDescription, tagIds }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setMessage(body?.error ?? "Gagal menyimpan draft."); return; }
    router.push(`/articles/${body.data.id}`);
  }

  const siteName = sites.find((site) => site.id === siteId)?.name;
  return <main className="min-h-screen bg-[#f8fafc] p-5 md:p-8"><div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[240px_1fr]"><AppSidebar/><div className="min-w-0"><div className="mx-auto max-w-5xl"><Link href="/articles" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"><ArrowLeft size={16}/> Kembali ke artikel</Link><h1 className="mt-7 text-3xl font-bold">Artikel baru</h1><p className="mt-1 text-sm text-slate-500">Simpan draft, lalu upload gambar dari halaman edit.</p><form onSubmit={submit} className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">Website<select required value={siteId} onChange={(event) => changeSite(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="">Pilih website</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="text-sm font-medium">Kategori<select required name="categoryId" disabled={!siteId} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 disabled:bg-slate-50"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><label className="block text-sm font-medium">Judul<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"/></label><label className="block text-sm font-medium">Slug<input required value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="judul-artikel" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"/></label><label className="block text-sm font-medium">Ringkasan<textarea name="excerpt" rows={3} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"/></label><div><p className="text-sm font-medium">Konten</p><RichTextEditor value={content} onChange={setContent} siteId={siteId || undefined} mediaFolder="drafts"/></div><div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">SEO title<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"/></label><label className="text-sm font-medium">Meta description<textarea value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3"/></label></div><div className="border-t border-slate-100 pt-5"><span className="text-sm text-slate-500">{message}</span><button className="float-right inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"><Save size={17}/> Simpan draft</button></div></section><aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Tag artikel</h2><div className="mt-3 space-y-2">{tags.map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)}/>{tag.name}</label>)}{siteId && !tags.length && <p className="text-sm text-slate-500">Belum ada tag.</p>}</div></section><SeoPreview siteName={siteName} title={title} slug={slug} seoTitle={seoTitle} metaDescription={metaDescription} ogImagePath={null}/></aside></form></div></div></div></main>;
}
