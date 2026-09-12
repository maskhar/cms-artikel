"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { useSidebar } from "@/components/sidebar-context";
import { mediaStoragePath } from "@/lib/media-storage-path";
import { registerMedia } from "@/lib/register-media";
import { createClient } from "@/lib/supabase/client";
import { Check, FileText, Grid2X2, Images, List, LoaderCircle, Music, Search, Trash2, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { DragEvent, PointerEvent, useEffect, useMemo, useState } from "react";

type MediaAsset = { id: string; storage_path: string; file_name: string; mime_type: string; file_size: number; alt_text: string; created_at: string };
type CardSize = "small" | "medium" | "large";

const gridClasses: Record<CardSize, string> = {
  small: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
  medium: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function GalleryPage() {
  const { collapsed } = useSidebar();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [size, setSize] = useState<CardSize>("medium");
  const [listView, setListView] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragSelection, setDragSelection] = useState<{ active: boolean; select: boolean }>({ active: false, select: false });
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  async function loadMedia() {
    const response = await fetch("/api/cms/media");
    const body = await response.json().catch(() => null);
    if (!response.ok) return setMessage(body?.error ?? "Media tidak dapat dimuat.");
    const nextAssets = body?.data ?? [];
    setAssets(nextAssets);
    const storage = createClient().storage.from("artikel-media");
    const entries = await Promise.all(nextAssets.map(async (asset: MediaAsset) => {
      const { data } = await storage.createSignedUrl(asset.storage_path, 3600);
      return [asset.id, data?.signedUrl ?? ""] as const;
    }));
    setUrls(Object.fromEntries(entries));
  }

  useEffect(() => { const timer = setTimeout(() => void loadMedia(), 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { const endSelection = () => setDragSelection((current) => current.active ? { ...current, active: false } : current); window.addEventListener("pointerup", endSelection); return () => window.removeEventListener("pointerup", endSelection); }, []);
  useEffect(() => { const closePreview = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewAsset(null); }; window.addEventListener("keydown", closePreview); return () => window.removeEventListener("keydown", closePreview); }, []);

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const matchesSearch = `${asset.file_name} ${asset.alt_text}`.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || (typeFilter === "image" && asset.mime_type.startsWith("image/")) || (typeFilter === "video" && asset.mime_type.startsWith("video/")) || (typeFilter === "audio" && asset.mime_type.startsWith("audio/")) || (typeFilter === "document" && !asset.mime_type.startsWith("image/") && !asset.mime_type.startsWith("video/") && !asset.mime_type.startsWith("audio/"));
    return matchesSearch && matchesType;
  }), [assets, search, typeFilter]);

  async function uploadFiles(files: FileList | File[]) {
    const input = Array.from(files);
    if (!input.length) return;
    setUploading(true);
    setMessage("");
    let uploaded = 0;
    const storage = createClient().storage.from("artikel-media");
    for (const file of input) {
      if (file.size > 20 * 1024 * 1024) { setMessage(`${file.name} maksimal 20 MB.`); continue; }
      const storagePath = mediaStoragePath("global/media", file.name);
      const { error: uploadError } = await storage.upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) { setMessage(uploadError.message); continue; }
      const metadataError = await registerMedia(storagePath, file);
      if (metadataError) { await storage.remove([storagePath]); setMessage(metadataError); continue; }
      uploaded += 1;
    }
    setUploading(false);
    if (uploaded) { setMessage(`${uploaded} media berhasil diunggah.`); await loadMedia(); }
  }

  async function removeAssets(targetAssets: MediaAsset[]) {
    if (!targetAssets.length || !confirm(`Hapus ${targetAssets.length} media secara permanen?`)) return;
    const storage = createClient().storage.from("artikel-media");
    let failed = 0;
    for (const asset of targetAssets) {
      const response = await fetch(`/api/cms/media/${asset.id}`, { method: "DELETE" });
      if (!response.ok) { failed += 1; continue; }
      const { error } = await storage.remove([asset.storage_path]);
      if (error) failed += 1;
    }
    setSelected(new Set());
    setSelecting(false);
    setMessage(failed ? `${targetAssets.length - failed} media dihapus; ${failed} gagal dihapus.` : `${targetAssets.length} media dihapus.`);
    await loadMedia();
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setAssetSelected(id: string, shouldSelect: boolean) {
    setSelected((current) => {
      if (current.has(id) === shouldSelect) return current;
      const next = new Set(current);
      if (shouldSelect) next.add(id); else next.delete(id);
      return next;
    });
  }

  function startSelection(event: PointerEvent<HTMLElement>, id: string) {
    if (!selecting || event.button !== 0) return;
    event.preventDefault();
    const shouldSelect = !selected.has(id);
    setAssetSelected(id, shouldSelect);
    setDragSelection({ active: true, select: shouldSelect });
  }

  function continueSelection(id: string) {
    if (selecting && dragSelection.active) setAssetSelected(id, dragSelection.select);
  }

  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }
  const selectedAssets = assets.filter((asset) => selected.has(asset.id));

  return <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-5 lg:p-7"><div className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}><AppSidebar/><section className="min-w-0"><header className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-[#CE181E]">Media</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Pustaka Media</h1><p className="mt-2 text-sm text-slate-500">Semua file tersimpan global dan dapat dipakai kembali di setiap artikel.</p></header><section className="mt-5 rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div onDragOver={(event) => event.preventDefault()} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDrop={drop} className={`rounded-2xl border-2 border-dashed p-8 text-center ${dragging ? "border-[#CE181E] bg-red-50" : "border-slate-200 bg-slate-50"}`}>{uploading ? <LoaderCircle className="mx-auto animate-spin text-[#CE181E]" size={34}/> : <UploadCloud className="mx-auto text-[#CE181E]" size={34}/>}<p className="mt-3 font-semibold text-slate-900">Tarik file ke sini</p><p className="mt-1 text-sm text-slate-500">Gambar, video, audio, PDF, dan file lain. Maksimum 20 MB per file.</p><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#CE181E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B01519]"><input className="sr-only" type="file" multiple accept="*/*" onChange={(event) => { void uploadFiles(event.target.files ?? []); event.target.value = ""; }} disabled={uploading}/>{uploading ? "Mengunggah" : "Pilih file"}</label></div><div className="mt-6 flex flex-col gap-3 border-y border-slate-100 py-4 lg:flex-row lg:items-center"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setListView(false)} aria-label="Tampilan grid" title="Tampilan grid" className={`inline-flex size-10 items-center justify-center rounded-lg border ${!listView ? "border-[#CE181E] bg-red-50 text-[#CE181E]" : "border-slate-200 text-slate-500"}`}><Grid2X2 size={18}/></button><button type="button" onClick={() => setListView(true)} aria-label="Tampilan daftar" title="Tampilan daftar" className={`inline-flex size-10 items-center justify-center rounded-lg border ${listView ? "border-[#CE181E] bg-red-50 text-[#CE181E]" : "border-slate-200 text-slate-500"}`}><List size={18}/></button><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Semua media</option><option value="image">Gambar</option><option value="video">Video</option><option value="audio">Audio</option><option value="document">Dokumen & file</option></select><button type="button" onClick={() => { setSelecting((value) => !value); setSelected(new Set()); }} className="min-h-10 rounded-lg border border-[#CE181E] px-3 text-sm font-semibold text-[#CE181E] hover:bg-red-50">{selecting ? "Batal pilih" : "Pilih massal"}</button>{selecting && <button type="button" onClick={() => { const ids = filteredAssets.map((asset) => asset.id); setSelected(new Set(selected.size === ids.length ? [] : ids)); }} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{selected.size === filteredAssets.length ? "Batal semua" : "Pilih semua"}</button>}</div><div className="flex min-w-0 flex-1 items-center gap-2 lg:justify-end"><div className="hidden items-center gap-1 sm:flex"><span className="mr-1 text-xs font-medium text-slate-500">Ukuran</span>{(["small", "medium", "large"] as CardSize[]).map((item) => <button key={item} type="button" onClick={() => { setSize(item); setListView(false); }} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${size === item && !listView ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{item === "small" ? "Kecil" : item === "medium" ? "Sedang" : "Besar"}</button>)}</div><label className="relative min-w-0 flex-1 lg:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari media" className="min-h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#CE181E]"/></label></div></div>{selecting && selected.size > 0 && <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"><p className="text-sm font-semibold text-red-800">{selected.size} media dipilih</p><button type="button" onClick={() => void removeAssets(selectedAssets)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#CE181E] px-3 text-sm font-semibold text-white hover:bg-[#B01519]"><Trash2 size={16}/> Hapus terpilih</button></div>}<div className="mt-6 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Semua Media</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{filteredAssets.length} file</span></div>{filteredAssets.length ? <div className={`mt-4 grid gap-3 ${listView ? "grid-cols-1" : gridClasses[size]}`}>{filteredAssets.map((asset) => <article key={asset.id} onClick={() => { if (!selecting && asset.mime_type.startsWith("image/") && urls[asset.id]) setPreviewAsset(asset); }} onPointerDown={(event) => startSelection(event, asset.id)} onPointerEnter={() => continueSelection(asset.id)} onPointerUp={() => setDragSelection((current) => ({ ...current, active: false }))} className={`group relative overflow-hidden rounded-xl border ${selected.has(asset.id) ? "border-[#CE181E] ring-2 ring-red-100" : "border-slate-200"} bg-white ${listView ? "flex items-center gap-4 p-3" : ""} ${selecting || asset.mime_type.startsWith("image/") ? "cursor-pointer" : ""} ${selecting ? "select-none" : ""}`}><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (selecting) toggleSelected(asset.id); else void removeAssets([asset]); }} aria-label={selecting ? `Pilih ${asset.file_name}` : `Hapus ${asset.file_name}`} className={`absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full border shadow-sm ${selecting ? (selected.has(asset.id) ? "border-[#CE181E] bg-[#CE181E] text-white" : "border-slate-200 bg-white text-slate-500") : "border-red-100 bg-white text-red-600 opacity-0 transition group-hover:opacity-100"}`}>{selecting && selected.has(asset.id) ? <Check size={16}/> : <Trash2 size={15}/>}</button><div className={`relative shrink-0 overflow-hidden bg-slate-100 ${listView ? "size-20 rounded-lg" : "aspect-[4/3]"}`}>{urls[asset.id] ? asset.mime_type.startsWith("image/") ? <Image fill unoptimized draggable={false} sizes="(min-width: 1536px) 12vw, (min-width: 1024px) 20vw, 45vw" src={urls[asset.id]} alt={asset.alt_text || asset.file_name} className="object-cover"/> : <div className="grid h-full place-items-center text-slate-400">{asset.mime_type.startsWith("audio/") ? <Music size={32}/> : <FileText size={32}/>}</div> : <div className="grid h-full place-items-center"><LoaderCircle className="animate-spin text-slate-400" size={24}/></div>}</div><div className={`min-w-0 ${listView ? "flex-1" : "p-3"}`}><p title={asset.file_name} className="line-clamp-2 break-words text-sm font-semibold text-slate-800">{asset.file_name}</p><p className="mt-1 truncate text-xs text-slate-500">{asset.mime_type} · {formatBytes(asset.file_size)}</p>{listView && <p className="mt-1 text-xs text-slate-400">{new Date(asset.created_at).toLocaleDateString("id-ID")}</p>}</div></article>)}</div> : !uploading ? <div className="grid min-h-60 place-items-center text-center text-slate-400"><div><Images className="mx-auto" size={44}/><p className="mt-3 text-sm">Media tidak ditemukan.</p></div></div> : null}</section></section></div>{previewAsset && urls[previewAsset.id] && <div role="dialog" aria-modal="true" aria-label={`Preview ${previewAsset.file_name}`} onClick={() => setPreviewAsset(null)} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/85 p-4 backdrop-blur-sm"><div onClick={(event) => event.stopPropagation()} className="relative flex h-[85vh] max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl"><button type="button" onClick={() => setPreviewAsset(null)} aria-label="Tutup preview" className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={22}/></button><div className="relative min-h-0 flex-1"><Image fill unoptimized priority sizes="95vw" src={urls[previewAsset.id]} alt={previewAsset.alt_text || previewAsset.file_name} className="object-contain"/></div><div className="shrink-0 border-t border-white/10 bg-slate-950 px-5 py-4 text-white"><p className="pr-12 font-semibold">{previewAsset.file_name}</p><p className="mt-1 text-sm text-slate-400">{previewAsset.mime_type} · {formatBytes(previewAsset.file_size)}</p></div></div></div>}{message && <div className="fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"><p role="status" className="flex-1 text-sm text-slate-800">{message}</p><button type="button" onClick={() => setMessage("")} className="text-slate-400 hover:text-slate-600" aria-label="Tutup pesan"><X size={18}/></button></div>}</main>;
}
