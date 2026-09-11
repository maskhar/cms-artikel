"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, BookOpenText, ChevronsLeft, ChevronsRight, FilePenLine, History, Images, KeyRound, LayoutDashboard, Menu, Settings, Tags, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CmsHostContext } from "@/components/cms-host-context";
import { LogoutButton } from "@/components/logout-button";
import { useSidebar } from "@/components/sidebar-context";

const items = [
  [LayoutDashboard, "Dashboard", "/"],
  [FilePenLine, "Artikel", "/articles"],
  [BookOpen, "Website & Kategori", "/sites"],
  [Tags, "Tag", "/tags"],
  [Images, "Media", "/gallery"],
  [KeyRound, "API Keys", "/api-keys"],
  [BookOpenText, "Dokumentasi API", "/api-docs"],
  [History, "Audit Log", "/audit"],
  [Users, "Tim", "/team"],
  [Settings, "CMS Domains", "/cms-domains"],
] as const;

function Navigation({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  return <nav className="space-y-1 text-sm" aria-label="Navigasi utama">{items.map(([Icon, label, href]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link key={label} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={`flex min-h-11 items-center rounded-xl py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`} href={href}><Icon size={18}/>{!collapsed && <span className="truncate">{label}</span>}</Link>; })}</nav>;
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return <div className={`flex items-center text-white ${collapsed ? "justify-center" : "gap-3"}`}><Image src="/image/png/logo-cms-artikel-only.png" alt="CMS Artikel" width={40} height={40} className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-red-950/30"/>{!collapsed && <div><p className="font-bold">Artikel CMS</p><p className="text-xs text-slate-400">Editorial workspace</p></div>}</div>;
}

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const { collapsed, setCollapsed } = useSidebar();
  return <><header className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg lg:hidden"><Brand/><button type="button" onClick={() => setOpen(true)} aria-label="Buka navigasi" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><Menu size={21}/></button></header><aside className={`hidden rounded-3xl bg-slate-950 p-3 text-slate-300 shadow-xl shadow-slate-900/10 transition-[width] duration-200 lg:block lg:min-h-[calc(100vh-3.5rem)] ${collapsed ? "lg:w-[76px]" : "lg:w-[240px]"}`}><Brand collapsed={collapsed}/><button type="button" onClick={() => setCollapsed(!collapsed)} className={`mt-4 grid size-10 place-items-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 ${collapsed ? "mx-auto" : "ml-auto"}`} aria-label={collapsed ? "Perbesar navigasi" : "Kecilkan navigasi"} title={collapsed ? "Perbesar navigasi" : "Kecilkan navigasi"}>{collapsed ? <ChevronsRight size={18}/> : <ChevronsLeft size={18}/>}</button><div className="mt-5"><Navigation collapsed={collapsed}/></div>{!collapsed && <><CmsHostContext/><div className="mt-6 border-t border-white/10 pt-6"><LogoutButton/></div></>}</aside>{open && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Tutup navigasi" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"/><aside className="relative flex h-full w-[min(86vw,340px)] flex-col bg-slate-950 p-5 text-slate-300 shadow-2xl"><div className="flex items-center justify-between"><Brand/><button type="button" onClick={() => setOpen(false)} aria-label="Tutup navigasi" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><X size={21}/></button></div><div className="mt-8 flex-1"><Navigation onNavigate={() => setOpen(false)}/></div><CmsHostContext/><div className="mt-6 border-t border-white/10 pt-6"><LogoutButton/></div></aside></div>}</>;
}
