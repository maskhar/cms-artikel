"use client";

import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, LineHeight, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading1, Heading2, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, LoaderCircle, Quote, Redo2, RemoveFormatting, Strikethrough, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RichTextEditorProps = { value: string; onChange: (value: string) => void; siteId?: string; mediaFolder?: string; placeholder?: string };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const buttonClass = "grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40";

export function RichTextEditor({ value, onChange, siteId, mediaFolder, placeholder = "Mulai tulis artikel…" }: RichTextEditorProps) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [resolvedMedia, setResolvedMedia] = useState({ siteId: siteId ?? "", folder: mediaFolder ?? "" });
  const pathname = usePathname();
  const effectiveMedia = { siteId: siteId ?? resolvedMedia.siteId, folder: mediaFolder ?? resolvedMedia.folder };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }), TextStyle, FontFamily, FontSize, LineHeight, Underline, Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }), TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: "editor-image" }, resize: { enabled: true, minWidth: 140, minHeight: 100, alwaysPreserveAspectRatio: true } }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap min-h-[420px] px-5 py-6 text-[17px] leading-8 outline-none md:px-9 md:py-8", "data-placeholder": placeholder } },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (siteId && mediaFolder) return;
    const articleId = pathname.match(/^\/articles\/([^/]+)$/)?.[1];
    if (!articleId) return;
    void fetch(`/api/cms/articles/${articleId}`).then((response) => response.json()).then((body) => { if (body.data?.site_id) setResolvedMedia({ siteId: body.data.site_id, folder: articleId }); });
  }, [mediaFolder, pathname, siteId]);

  function action(run: () => void) { if (editor) run(); }
  function setLink() { const href = window.prompt("Masukkan URL tautan"); if (href) action(() => editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()); }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !editor) return;
    if (!effectiveMedia.siteId || !effectiveMedia.folder) { setMessage("Pilih website terlebih dahulu sebelum menambah gambar."); return; }
    if (!imageTypes.has(file.type) || file.size > 5 * 1024 * 1024) { setMessage("Pakai JPG, PNG, WebP, atau GIF maksimum 5 MB."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
    const path = `${effectiveMedia.siteId}/${effectiveMedia.folder}/${crypto.randomUUID()}.${extension}`;
    setUploading(true); setMessage("");
    const storage = createClient().storage.from("artikel-media");
    const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setUploading(false); setMessage(error.message); return; }
    const { data, error: signedError } = await storage.createSignedUrl(path, 60 * 60 * 24 * 7);
    setUploading(false);
    if (signedError || !data) { setMessage(signedError?.message ?? "Gambar tidak dapat dipakai."); return; }
    editor.chain().focus().setImage({ src: data.signedUrl, alt: file.name.replace(/\.[^.]+$/, ""), title: path, width: 960 }).run();
  }

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1">
        <select aria-label="Gaya teks" defaultValue="paragraph" onChange={(event) => action(() => { const type = event.target.value; if (type === "h1") editor?.chain().focus().toggleHeading({ level: 1 }).run(); else if (type === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run(); else if (type === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run(); else editor?.chain().focus().setParagraph().run(); })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500"><option value="paragraph">Paragraf</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>
        <select aria-label="Jenis font" defaultValue="inherit" onChange={(event) => action(() => event.target.value === "inherit" ? editor?.chain().focus().unsetFontFamily().run() : editor?.chain().focus().setFontFamily(event.target.value).run())} className="h-9 max-w-28 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"><option value="inherit">Default</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Courier New">Mono</option></select>
        <select aria-label="Ukuran teks" defaultValue="17px" onChange={(event) => action(() => event.target.value === "default" ? editor?.chain().focus().unsetFontSize().run() : editor?.chain().focus().setFontSize(event.target.value).run())} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"><option value="default">Ukuran</option><option value="14px">14</option><option value="16px">16</option><option value="17px">17</option><option value="20px">20</option><option value="24px">24</option><option value="32px">32</option></select>
        <span className="mx-1 h-6 w-px bg-slate-200"/>
        <button type="button" aria-label="Bold" title="Bold" onClick={() => action(() => editor?.chain().focus().toggleBold().run())} className={buttonClass}><Bold size={17}/></button><button type="button" aria-label="Italic" title="Italic" onClick={() => action(() => editor?.chain().focus().toggleItalic().run())} className={buttonClass}><Italic size={17}/></button><button type="button" aria-label="Underline" title="Underline" onClick={() => action(() => editor?.chain().focus().toggleUnderline().run())} className={buttonClass}><UnderlineIcon size={17}/></button><button type="button" aria-label="Strikethrough" title="Strikethrough" onClick={() => action(() => editor?.chain().focus().toggleStrike().run())} className={buttonClass}><Strikethrough size={17}/></button><button type="button" aria-label="Highlight" title="Highlight" onClick={() => action(() => editor?.chain().focus().toggleHighlight({ color: "#fde68a" }).run())} className={buttonClass}><Highlighter size={17}/></button>
        <span className="mx-1 h-6 w-px bg-slate-200"/>
        <button type="button" aria-label="Heading 1" title="Heading 1" onClick={() => action(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())} className={buttonClass}><Heading1 size={17}/></button><button type="button" aria-label="Heading 2" title="Heading 2" onClick={() => action(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())} className={buttonClass}><Heading2 size={17}/></button><button type="button" aria-label="Bullet list" title="Bullet list" onClick={() => action(() => editor?.chain().focus().toggleBulletList().run())} className={buttonClass}><List size={17}/></button><button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => action(() => editor?.chain().focus().toggleOrderedList().run())} className={buttonClass}><ListOrdered size={17}/></button><button type="button" aria-label="Quote" title="Quote" onClick={() => action(() => editor?.chain().focus().toggleBlockquote().run())} className={buttonClass}><Quote size={17}/></button><button type="button" aria-label="Code block" title="Code block" onClick={() => action(() => editor?.chain().focus().toggleCodeBlock().run())} className={buttonClass}><Code2 size={17}/></button>
        <span className="mx-1 h-6 w-px bg-slate-200"/>
        <button type="button" aria-label="Rata kiri" title="Rata kiri" onClick={() => action(() => editor?.chain().focus().setTextAlign("left").run())} className={buttonClass}><AlignLeft size={17}/></button><button type="button" aria-label="Rata tengah" title="Rata tengah" onClick={() => action(() => editor?.chain().focus().setTextAlign("center").run())} className={buttonClass}><AlignCenter size={17}/></button><button type="button" aria-label="Rata kanan" title="Rata kanan" onClick={() => action(() => editor?.chain().focus().setTextAlign("right").run())} className={buttonClass}><AlignRight size={17}/></button>
        <span className="mx-1 h-6 w-px bg-slate-200"/>
        <button type="button" aria-label="Tambah tautan" title="Tambah tautan" onClick={setLink} className={buttonClass}><Link2 size={17}/></button><button type="button" aria-label="Tambah gambar" title="Tambah gambar" onClick={() => uploadInput.current?.click()} disabled={uploading} className={buttonClass}>{uploading ? <LoaderCircle className="animate-spin" size={17}/> : <ImagePlus size={17}/>}</button><input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} className="sr-only"/>
        <span className="mx-1 h-6 w-px bg-slate-200"/>
        <button type="button" aria-label="Undo" title="Undo" onClick={() => action(() => editor?.chain().focus().undo().run())} className={buttonClass}><Undo2 size={17}/></button><button type="button" aria-label="Redo" title="Redo" onClick={() => action(() => editor?.chain().focus().redo().run())} className={buttonClass}><Redo2 size={17}/></button><button type="button" aria-label="Hapus format" title="Hapus format" onClick={() => action(() => editor?.chain().focus().unsetAllMarks().clearNodes().run())} className={buttonClass}><RemoveFormatting size={17}/></button>
      </div>
    </div>
    <EditorContent editor={editor}/>{message && <p className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">{message}</p>}
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400"><span>{uploading ? "Mengunggah gambar…" : "Pilih gambar lalu tarik sudutnya untuk mengubah ukuran."}</span><span>{editor?.storage.characterCount?.characters?.() ?? value.replace(/<[^>]+>/g, "").length} karakter</span></div>
  </div>;
}
