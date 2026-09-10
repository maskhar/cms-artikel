"use client";

import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Undo2 } from "lucide-react";
import { useEffect } from "react";

type RichTextEditorProps = { value: string; onChange: (value: string) => void };

const controls = [
  { label: "Heading", Icon: Heading2, action: "heading" },
  { label: "Bold", Icon: Bold, action: "bold" },
  { label: "Italic", Icon: Italic, action: "italic" },
  { label: "Bullet list", Icon: List, action: "bullet" },
  { label: "Numbered list", Icon: ListOrdered, action: "ordered" },
  { label: "Quote", Icon: Quote, action: "quote" },
] as const;

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true })],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap min-h-72 px-4 py-3 outline-none" } },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  function run(action: (typeof controls)[number]["action"] | "link" | "undo") {
    if (!editor) return;
    if (action === "heading") editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (action === "bold") editor.chain().focus().toggleBold().run();
    if (action === "italic") editor.chain().focus().toggleItalic().run();
    if (action === "bullet") editor.chain().focus().toggleBulletList().run();
    if (action === "ordered") editor.chain().focus().toggleOrderedList().run();
    if (action === "quote") editor.chain().focus().toggleBlockquote().run();
    if (action === "undo") editor.chain().focus().undo().run();
    if (action === "link") {
      const href = window.prompt("URL tautan");
      if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  }

  return <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
      {controls.map(({ label, Icon, action }) => <button key={action} type="button" title={label} aria-label={label} onClick={() => run(action)} className="rounded-lg p-2 hover:bg-slate-200"><Icon size={16}/></button>)}
      <button type="button" title="Tambah tautan" aria-label="Tambah tautan" onClick={() => run("link")} className="rounded-lg p-2 hover:bg-slate-200"><Link2 size={16}/></button>
      <button type="button" title="Undo" aria-label="Undo" onClick={() => run("undo")} className="rounded-lg p-2 hover:bg-slate-200"><Undo2 size={16}/></button>
    </div>
    <EditorContent editor={editor}/>
  </div>;
}
