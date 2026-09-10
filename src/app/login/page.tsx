"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: String(data.get("email")), password: String(data.get("password")),
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/"); router.refresh();
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white"><LogIn size={21}/></div><p className="mt-7 text-sm font-semibold text-blue-600">ARTIKEL CMS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Masuk ke dashboard</h1><p className="mt-2 text-sm leading-6 text-slate-500">Kelola konten semua website dari satu tempat.</p><form onSubmit={signIn} className="mt-7 space-y-4"><label className="block text-sm font-medium">Email<input required name="email" type="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-600"/></label><label className="block text-sm font-medium">Password<input required name="password" type="password" autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-600"/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Memproses..." : "Masuk"}</button></form></section></main>;
}


