"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { useSidebar } from "@/components/sidebar-context";
import type { ReactNode } from "react";

export function MainLayout({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return <main className="min-h-screen bg-[#f5f7fb] p-3 text-slate-900 sm:p-5 lg:p-7"><div className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}><AppSidebar/><section className="min-w-0">{children}</section></div></main>;
}
