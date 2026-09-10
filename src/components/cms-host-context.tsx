"use client";

import { Globe2 } from "lucide-react";
import { useEffect, useState } from "react";

type CmsContext = { hostname: string; display_name: string; sites: { name: string } | { name: string }[] | null };

export function CmsHostContext() {
  const [context, setContext] = useState<CmsContext | null>(null);
  useEffect(() => { void fetch("/api/cms/context").then((response) => response.json()).then((body) => setContext(body.data ?? null)); }, []);
  if (!context) return null;
  const site = Array.isArray(context.sites) ? context.sites[0] : context.sites;
  return <div className="mt-10 rounded-xl border border-white/10 p-3 text-xs leading-5 text-slate-400"><div className="flex items-center gap-2 text-white"><Globe2 size={14}/><strong className="truncate">{context.display_name}</strong></div><p className="mt-1 truncate">{context.hostname}</p>{site && <p className="mt-1">Website default: {site.name}</p>}<p className="mt-2">Akses data tetap mengikuti role akun.</p></div>;
}
