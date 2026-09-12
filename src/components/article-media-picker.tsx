"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerMedia } from "@/lib/register-media";
import { mediaStoragePath } from "@/lib/media-storage-path";

type ArticleMediaPickerProps = { articleId: string; siteId: string; siteSlug: string; articleSlug: string; label: string; value: string | null; onChange: (path: string | null) => void };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function ArticleMediaPicker({ articleId, siteId, siteSlug, articleSlug, label, value, onChange }: ArticleMediaPickerProps) {
  const [message, setMessage] = useState(""); const [uploading, setUploading] = useState(false); const [preview, setPreview] = useState({ path: "", url: "" });
  useEffect(() => { let active = true; if (!value) return; void createClient().storage.from("artikel-media").createSignedUrl(value, 3600).then(({ data }) => { if (active) setPreview({ path: value, url: data?.signedUrl ?? "" }); }); return () => { active = false; }; }, [value]);
  async function uploadFile(file: File | undefined) { if (!file) return; if (!siteId) { setMessage("Pilih website sebelum upload gambar."); return; } if (!imageTypes.has(file.type) || file.size > 5 * 1024 * 1024) { setMessage("Pakai JPG, PNG, WebP, atau GIF maksimum 5 MB."); return; } const path = mediaStoragePath(`${siteSlug}/articles/${articleSlug}`, file.name); setUploading(true); setMessage(""); const storage = createClient().storage.from("artikel-media"); const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false }); if (error) { setUploading(false); setMessage(error.message); return; } const metadataError = await registerMedia(path, file); setUploading(false); if (metadataError) { await storage.remove([path]); setMessage(metadataError); return; } onChange(path); }
  function upload(event: ChangeEvent<HTMLInputElement>) { void uploadFile(event.target.files?.[0]); event.target.value = ""; }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void uploadFile(event.dataTransfer.files?.[0]); }
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, GIF. Maksimum 5 MB.</p></div>{value && <button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Hapus ${label}`}><X size={16}/></button>}</div><div onDragOver={(event) => event.preventDefault()} onDrop={drop} className="mt-3 rounded-xl border-2 border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 transition hover:border-red-400 hover:bg-red-50"><p>Tarik dan lepas gambar ke sini</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} className="sr-only" disabled={uploading}/>{uploading ? <LoaderCircle className="animate-spin" size={16}/> : <ImagePlus size={16}/>} {uploading ? "Mengunggah" : value ? "Ganti gambar" : "Pilih gambar"}</label></div>{value && preview.path === value && preview.url && <div role="img" aria-label={`Preview ${label}`} className="mt-3 aspect-video w-full rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${preview.url})` }}/>} {value && <p className="mt-3 break-all text-xs text-slate-500">{value}</p>}{message && <p className="mt-3 text-xs text-red-600">{message}</p>}</section>;
}


