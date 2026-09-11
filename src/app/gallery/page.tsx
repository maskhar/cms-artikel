"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { useSidebar } from "@/components/sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { FileText, Images, LoaderCircle, Music, Trash2, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { DragEvent, useEffect, useState } from "react";

type MediaAsset = { id: string; site_id: string | null; storage_path: string; file_name: string; mime_type: string; file_size: number; alt_text: string };

export default function GalleryPage() {
  const { collapsed } = useSidebar();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  async function uploadFiles(files: FileList | File[]) {
    const input = Array.from(files);
    if (!input.length) return;
    setUploading(true);
    setMessage("");
    let uploaded = 0;
    const storage = createClient().storage.from("artikel-media");
    for (const file of input) {
      if (file.size > 20 * 1024 * 1024) {
        setMessage(`${file.name} maksimal 20 MB.`);
        continue;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
      const storagePath = `global/media/${crypto.randomUUID()}-${safeName || `file.${extension}`}`;
      const mimeType = file.type || "application/octet-stream";
      const { error: uploadError } = await storage.upload(storagePath, file, { contentType: mimeType, upsert: false });
      if (uploadError) { setMessage(uploadError.message); continue; }
      const response = await fetch("/api/cms/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath, fileName: file.name, mimeType, fileSize: file.size, altText: file.name.replace(/\.[^.]+$/, "") }) });
      if (!response.ok) { const body = await response.json().catch(() => null); await storage.remove([storagePath]); setMessage(body?.error ?? "Metadata media gagal disimpan."); continue; }
      uploaded += 1;
    }
    setUploading(false);
    if (uploaded) { setMessage(`${uploaded} media berhasil diunggah.`); await loadMedia(); }
  }

  async function removeAsset(asset: MediaAsset) {
    if (!confirm(`Hapus ${asset.file_name}?`)) return;
    const response = await fetch(`/api/cms/media/${asset.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setMessage(body?.error ?? "Media gagal dihapus.");
    const { error } = await createClient().storage.from("artikel-media").remove([asset.storage_path]);
    setMessage(error ? "Metadata terhapus, tetapi file storage gagal dihapus." : "Media dihapus.");
    await loadMedia();
  }

  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }

  return <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-5 lg:p-7"><div className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}><AppSidebar/><section className="min-w-0"><header className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-violet-600">Media</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Pustaka Media</h1><p className="mt-2 text-sm text-slate-500">Semua media dan file tersedia di sini. Tidak perlu membuat gallery atau memilih website.</p></header><section className="mt-5 rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div onDragOver={(event) => event.preventDefault()} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDrop={drop} className={`rounded-2xl border-2 border-dashed p-8 text-center ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>{uploading ? <LoaderCircle className="mx-auto animate-spin text-violet-600" size={34}/> : <UploadCloud className="mx-auto text-violet-600" size={34}/>}<p className="mt-3 font-semibold text-slate-900">Tarik file ke sini</p><p className="mt-1 text-sm text-slate-500">Gambar, video, audio, PDF, dan file lain. Maksimum 20 MB per file.</p><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"><input className="sr-only" type="file" multiple accept="*/*" onChange={(event) => { void uploadFiles(event.target.files ?? []); event.target.value = ""; }} disabled={uploading}/>{uploading ? "Mengunggah" : "Pilih file"}</label></div><div className="mt-6 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Semua Media</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{assets.length} file</span></div>{assets.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{assets.map((asset) => <article key={asset.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="relative aspect-[4/3] bg-slate-100">{urls[asset.id] ? asset.mime_type.startsWith("image/") ? <Image fill unoptimized sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" src={urls[asset.id]} alt={asset.alt_text || asset.file_name} className="object-contain"/> : asset.mime_type.startsWith("video/") ? <video controls className="h-full w-full object-contain" src={urls[asset.id]}/> : asset.mime_type.startsWith("audio/") ? <div className="grid h-full place-items-center"><Music className="text-violet-400" size={44}/></div> : <div className="grid h-full place-items-center"><FileText className="text-violet-400" size={44}/></div> : <div className="grid h-full place-items-center"><Images className="text-slate-300" size={36}/></div>}<button type="button" onClick={() => void removeAsset(asset)} className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-red-600 opacity-0 shadow-sm transition group-hover:opacity-100" aria-label={`Hapus ${asset.file_name}`}><Trash2 size={16}/></button></div><div className="p-3"><p className="truncate text-sm font-semibold text-slate-900" title={asset.file_name}>{asset.file_name}</p><p className="mt-1 truncate text-xs text-slate-500">{asset.alt_text || asset.mime_type || "Tanpa keterangan"}</p><div className="mt-3 flex gap-2"><a href={urls[asset.id]} target="_blank" rel="noreferrer" className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">Buka tab baru</a><a href={urls[asset.id]} download={asset.file_name} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Download</a></div></div></article>)}</div> : !uploading ? <div className="grid min-h-60 place-items-center text-center text-slate-400"><div><Images className="mx-auto" size={44}/><p className="mt-3 text-sm">Belum ada media.</p></div></div> : null}</section></section></div>{message && <div className="fixed bottom-5 right-5 flex max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"><p className="flex-1 text-sm text-slate-800">{message}</p><button type="button" onClick={() => setMessage("")} className="text-slate-400 hover:text-slate-600" aria-label="Tutup pesan"><X size={18}/></button></div>}</main>;
}
