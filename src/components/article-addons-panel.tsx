"use client";

import { createClient } from "@/lib/supabase/client";
import { registerMedia } from "@/lib/register-media";
import { mediaStoragePath } from "@/lib/media-storage-path";
import { GripVertical, ImagePlus, LoaderCircle, Plus, Puzzle, Trash2, X } from "lucide-react";
import { DragEvent, useEffect, useState } from "react";

export type ArticleAddonDraft = {
  id: string;
  addon_type: string;
  title: string;
  placement: "before_content" | "after_content";
  config: Record<string, unknown>;
};

type Gallery = { id: string; name: string };

type ArticleAddonsPanelProps = {
  articleId?: string;
  siteId: string;
  siteSlug: string;
  articleSlug: string;
  draftAddons?: ArticleAddonDraft[];
  onDraftAddonsChange?: (addons: ArticleAddonDraft[]) => void;
};

const addonTypes = ["gallery", "image_slider", "pdf_viewer", "video_embed", "call_to_action", "faq", "related_articles", "table_of_contents", "highlight_box", "file_download"] as const;
const galleryAddonTypes = new Set<string>(["gallery", "image_slider"]);
const fileAddonTypes = new Set<string>(["pdf_viewer", "file_download"]);

export function ArticleAddonsPanel({ articleId, siteId, siteSlug, articleSlug, draftAddons = [], onDraftAddonsChange }: ArticleAddonsPanelProps) {
  const isDraft = !articleId;
  const [savedAddons, setSavedAddons] = useState<ArticleAddonDraft[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [addonType, setAddonType] = useState<(typeof addonTypes)[number]>("image_slider");
  const [title, setTitle] = useState("");
  const placement: ArticleAddonDraft["placement"] = "after_content";
  const [galleryId, setGalleryId] = useState("");
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [mediaNames, setMediaNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number | null>(null);
  const addons = isDraft ? draftAddons : savedAddons;

  async function load() {
    if (!siteId) { setGalleries([]); if (!isDraft) setSavedAddons([]); return; }
    const galleryRequest = fetch("/api/cms/galleries?siteId=" + siteId).then((response) => response.json());
    if (!articleId) { const galleryBody = await galleryRequest; setGalleries(galleryBody.data ?? []); return; }
    const [addonBody, galleryBody] = await Promise.all([fetch("/api/cms/articles/" + articleId + "/addons").then((response) => response.json()), galleryRequest]);
    setSavedAddons(addonBody.data ?? []);
    setGalleries(galleryBody.data ?? []);
  }

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [articleId, siteId]);

  function updateAddons(nextAddons: ArticleAddonDraft[]) { if (isDraft) onDraftAddonsChange?.(nextAddons); else setSavedAddons(nextAddons); }
  function startAddonDrag(event: DragEvent<HTMLElement>, index: number, addon: ArticleAddonDraft) { setDraggedIndex(index); event.dataTransfer.effectAllowed = "copyMove"; event.dataTransfer.setData("application/x-artikel-addon", JSON.stringify({ id: addon.id, addonType: addon.addon_type, title: addon.title || addon.addon_type.replaceAll("_", " ") })); }
  function insertAddon(addon: ArticleAddonDraft) { window.dispatchEvent(new CustomEvent("artikel:insert-addon", { detail: { id: addon.id, addonType: addon.addon_type, title: addon.title || addon.addon_type.replaceAll("_", " ") } })); }
  function resetComposer() { setTitle(""); setGalleryId(""); setMediaPaths([]); setMediaNames({}); }

  async function uploadMedia(files: FileList | File[]) {
    if (!siteId || !siteSlug) { setMessage("Pilih website sebelum mengunggah media."); return; }
    const acceptedFiles = Array.from(files).filter((file) => galleryAddonTypes.has(addonType) ? file.type.startsWith("image/") : file.type === "application/pdf");
    if (!acceptedFiles.length) { setMessage(galleryAddonTypes.has(addonType) ? "Pilih file gambar." : "Pilih file PDF."); return; }
    if (acceptedFiles.some((file) => file.size > 20 * 1024 * 1024)) { setMessage("Ukuran file maksimum 20 MB."); return; }
    setUploading(true);
    const uploadedMedia: Array<{ path: string; name: string }> = [];
    for (const file of acceptedFiles) {
      const path = mediaStoragePath(siteSlug + "/articles/" + (articleSlug || "drafts") + "/addons", file.name);
      const { error } = await createClient().storage.from("artikel-media").upload(path, file, { contentType: file.type });
      if (error) { setMessage(error.message); continue; }
      const metadataError = await registerMedia(path, file);
      if (metadataError) { await createClient().storage.from("artikel-media").remove([path]); setMessage(metadataError); continue; }
      uploadedMedia.push({ path, name: file.name });
    }
    setUploading(false);
    if (!uploadedMedia.length) return;
    const selectedMedia = fileAddonTypes.has(addonType) ? [uploadedMedia[0]] : uploadedMedia;
    setMediaPaths((current) => fileAddonTypes.has(addonType) ? [selectedMedia[0].path] : [...current, ...selectedMedia.map((media) => media.path)]);
    setMediaNames((current) => ({ ...current, ...Object.fromEntries(selectedMedia.map((media) => [media.path, media.name])) }));
    setMessage(selectedMedia.length + " media berhasil diunggah.");
  }

  function handleMediaDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void uploadMedia(event.dataTransfer.files); }

  function handleMediaReorder(targetIndex: number) {
    if (draggedMediaIndex === null || draggedMediaIndex === targetIndex) return;
    setMediaPaths((current) => { const next = [...current]; const [moved] = next.splice(draggedMediaIndex, 1); next.splice(targetIndex, 0, moved); return next; });
    setDraggedMediaIndex(targetIndex);
  }

  function finishMediaReorder() { setDraggedMediaIndex(null); }

  async function add() {
    const parsedConfig: Record<string, unknown> = {};
    if (galleryAddonTypes.has(addonType)) {
      if (!galleryId && !mediaPaths.length) { setMessage("Pilih gallery atau unggah minimal satu gambar."); return; }
      if (galleryId) parsedConfig.gallery_id = galleryId;
      if (mediaPaths.length) parsedConfig.media_paths = mediaPaths;
    }
    if (fileAddonTypes.has(addonType)) {
      if (!mediaPaths[0]) { setMessage("Unggah file PDF terlebih dahulu."); return; }
      parsedConfig.storage_path = mediaPaths[0];
      parsedConfig.show_download = true;
    }
    const addon: ArticleAddonDraft = { id: crypto.randomUUID(), addon_type: addonType, title, placement, config: parsedConfig };
    if (isDraft) { updateAddons([...addons, addon]); resetComposer(); setMessage("Add-on ditambahkan ke draft."); return; }
    const response = await fetch("/api/cms/articles/" + articleId + "/addons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addonType, title, placement, config: parsedConfig }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setMessage(body?.error ?? "Add-on gagal ditambahkan."); return; }
    resetComposer(); setMessage("Add-on ditambahkan."); void load();
  }

  async function remove(addonId: string) {
    if (isDraft) { updateAddons(addons.filter((addon) => addon.id !== addonId)); return; }
    if (!confirm("Hapus add-on ini?")) return;
    const response = await fetch("/api/cms/articles/" + articleId + "/addons/" + addonId, { method: "DELETE" });
    setMessage(response.ok ? "Add-on dihapus." : "Add-on gagal dihapus.");
    if (response.ok) void load();
  }

  function handleDragOver(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const nextAddons = [...addons];
    const [movedAddon] = nextAddons.splice(draggedIndex, 1);
    nextAddons.splice(targetIndex, 0, movedAddon);
    updateAddons(nextAddons);
    setDraggedIndex(targetIndex);
  }

  async function handleDragEnd() {
    if (draggedIndex === null) return;
    setDraggedIndex(null);
    if (isDraft) return;
    const response = await fetch("/api/cms/articles/" + articleId + "/addons/reorder", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addonIds: addons.map((addon) => addon.id) }) });
    if (!response.ok) setMessage("Urutan add-on gagal disimpan.");
  }

  const accepts = galleryAddonTypes.has(addonType) ? "image/*" : "application/pdf";
  const uploadLabel = galleryAddonTypes.has(addonType) ? "gambar" : "PDF";
  const mediaInputId = "addon-media-" + addonType;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Puzzle size={18}/><h2 className="font-semibold">Add-ons</h2></div>{isDraft && <span className="text-xs text-slate-500">Opsional</span>}</div>
      {isDraft && <p className="mt-2 text-xs text-slate-500">Artikel tetap bisa disimpan tanpa add-on. Add-on baru diterapkan sesudah artikel dibuat.</p>}
      <div className="mt-4 space-y-2">
        {addons.map((addon, index) => <article key={addon.id} draggable onDragStart={(event) => startAddonDrag(event, index, addon)} onDragOver={(event) => handleDragOver(event, index)} onDragEnd={() => void handleDragEnd()} className="flex cursor-move items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="flex min-w-0 gap-2"><GripVertical className="mt-0.5 shrink-0 text-slate-400" size={16}/><div><p className="text-sm font-semibold">{addon.title || addon.addon_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{addon.addon_type} · {addon.placement}</p></div></div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => insertAddon(addon)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#CE181E] hover:bg-red-50">Sisipkan</button><button type="button" onClick={() => void remove(addon.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Hapus add-on"><Trash2 size={15}/></button></div></article>)}
        {!addons.length && <p className="text-sm text-slate-500">Belum ada add-on. Fitur ini opsional.</p>}
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <select value={addonType} onChange={(event) => { setAddonType(event.target.value as (typeof addonTypes)[number]); setMediaPaths([]); }} className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">{addonTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Judul add-on (opsional)" className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"/>
        {galleryAddonTypes.has(addonType) && <select value={galleryId} onChange={(event) => setGalleryId(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="">Pilih gallery yang ada (opsional)</option>{galleries.map((gallery) => <option key={gallery.id} value={gallery.id}>{gallery.name}</option>)}</select>}
        {(galleryAddonTypes.has(addonType) || fileAddonTypes.has(addonType)) && <div onDragOver={(event) => event.preventDefault()} onDrop={handleMediaDrop} className="mt-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-600"><input id={mediaInputId} type="file" multiple={galleryAddonTypes.has(addonType)} accept={accepts} className="sr-only" onChange={(event) => { void uploadMedia(event.target.files ?? []); event.target.value = ""; }}/><label htmlFor={mediaInputId} className="flex cursor-pointer flex-col items-center gap-1"><ImagePlus size={18}/><span>{uploading ? <LoaderCircle className="animate-spin" size={18}/> : "Tarik " + uploadLabel + " ke sini atau pilih file"}</span><span className="text-xs text-slate-400">Maksimum 20 MB per file</span></label></div>}
        {!!mediaPaths.length && <div className="mt-2 space-y-1"><p className="text-xs text-slate-500">Tarik item untuk mengatur urutan media.</p>{mediaPaths.map((path, index) => <div key={path} draggable onDragStart={() => setDraggedMediaIndex(index)} onDragOver={(event) => { event.preventDefault(); handleMediaReorder(index); }} onDragEnd={finishMediaReorder} className="flex cursor-move items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs"><span className="truncate">{index + 1}. {mediaNames[path] ?? path.split("/").at(-1)}</span><button type="button" onClick={() => { setMediaPaths((paths) => paths.filter((item) => item !== path)); setMediaNames((names) => { const { [path]: _removed, ...remaining } = names; return remaining; }); }} className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50" aria-label="Hapus media"><X size={14}/></button></div>)}</div>}
        <button type="button" onClick={() => void add()} disabled={!siteId || uploading} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#CE181E] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16}/> Tambah add-on</button>
      </div>
      {message && <p className="mt-3 text-xs text-[#B01519]">{message}</p>}
    </section>
  );
}
