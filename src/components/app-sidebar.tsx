"use client";

import Link from "next/link";
import { BookOpen, FilePenLine, History, KeyRound, LayoutDashboard, Menu, Settings, Tags, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CmsHostContext } from "@/components/cms-host-context";

const items = [[LayoutDashboard, "Dashboard", "/"], [FilePenLine, "Artikel", "/articles"], [BookOpen, "Website & Kategori", "/sites"], [Tags, "Tag", "/tags"], [KeyRound, "API Keys", "/api-keys"], [History, "Audit Log", "/audit"], [Users, "Tim", "/team"], [Settings, "CMS Domains", "/cms-domains"]] as const;

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav className="space-y-1 text-sm" aria-label="Navigasi utama">{items.map(([Icon, label, href]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link key={label} onClick={onNavigate} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${active ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`} href={href}><Icon size={18}/>{label}</Link>; })}</nav>;
}

function Brand() { return <div className="flex items-center gap-3 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 font-extrabold shadow-lg shadow-violet-900/40">A</span><div><p className="font-bold">Artikel CMS</p><p className="text-xs text-slate-400">Editorial workspace</p></div></div>; }

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  return <><header className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg lg:hidden"><Brand/><button type="button" onClick={() => setOpen(true)} aria-label="Buka navigasi" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><Menu size={21}/></button></header><aside className="hidden rounded-3xl bg-slate-950 p-5 text-slate-300 shadow-xl shadow-slate-900/10 lg:block lg:min-h-[calc(100vh-3.5rem)]"><Brand/><div className="mt-8"><Navigation/></div><CmsHostContext/></aside>{open && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Tutup navigasi" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"/><aside className="relative flex h-full w-[min(86vw,340px)] flex-col bg-slate-950 p-5 text-slate-300 shadow-2xl"><div className="flex items-center justify-between"><Brand/><button type="button" onClick={() => setOpen(false)} aria-label="Tutup navigasi" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><X size={21}/></button></div><div className="mt-8"><Navigation onNavigate={() => setOpen(false)}/></div><CmsHostContext/></aside></div>}</>;
}
