"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ArticleMediaPickerProps = { articleId: string; siteId: string; label: string; value: string | null; onChange: (path: string | null) => void };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function ArticleMediaPicker({ articleId, siteId, label, value, onChange }: ArticleMediaPickerProps) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState({ path: "", url: "" });

  useEffect(() => {
    let active = true;
    if (!value) return;
    void createClient().storage.from("artikel-media").createSignedUrl(value, 3600).then(({ data }) => { if (active) setPreview({ path: value, url: data?.signedUrl ?? "" }); });
    return () => { active = false; };
  }, [value]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!imageTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Pakai JPG, PNG, WebP, atau GIF maksimum 5 MB.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${siteId}/${articleId}/${crypto.randomUUID()}.${extension}`;
    setUploading(true);
    const { error } = await createClient().storage.from("artikel-media").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("");
    onChange(path);
  }

  return <section className="rounded-xl border border-slate-200 p-4">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, GIF. Maksimum 5 MB.</p></div>{value && <button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Hapus ${label}`}><X size={16}/></button>}</div>
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} className="sr-only" disabled={uploading}/>{uploading ? <LoaderCircle className="animate-spin" size={16}/> : <ImagePlus size={16}/>}{uploading ? "Mengunggah" : value ? "Ganti gambar" : "Upload gambar"}</label>
    {value && preview.path === value && preview.url && <div role="img" aria-label={`Preview ${label}`} className="mt-3 aspect-video w-full rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${preview.url})` }}/>} {value && <p className="mt-3 break-all text-xs text-slate-500">{value}</p>}{message && <p className="mt-3 text-xs text-red-600">{message}</p>}
  </section>;
}
