import Link from "next/link";
import { BookOpen, FilePenLine, History, KeyRound, LayoutDashboard, Settings, Tags, Users } from "lucide-react";
import { CmsHostContext } from "@/components/cms-host-context";

const items = [[LayoutDashboard, "Dashboard", "/"], [FilePenLine, "Artikel", "/articles"], [BookOpen, "Website & Kategori", "/sites"], [Tags, "Tag", "/tags"], [KeyRound, "API Keys", "/api-keys"], [History, "Audit Log", "/audit"], [Users, "Tim", "/team"], [Settings, "CMS Domains", "/cms-domains"]] as const;

export function AppSidebar() {
  return <aside className="rounded-2xl bg-slate-950 p-5 text-slate-300 lg:min-h-[760px]"><div className="mb-8 flex items-center gap-3 text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 font-bold">A</span><span className="font-semibold">Artikel CMS</span></div><nav className="space-y-1 text-sm" aria-label="Navigasi utama">{items.map(([Icon, label, href]) => <Link key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10 hover:text-white" href={href}><Icon size={18}/>{label}</Link>)}</nav><CmsHostContext/></aside>;
}

