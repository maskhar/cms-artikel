"use client";

import { FormEvent, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      setError("Sesi Anda telah berakhir setelah 6 jam. Silakan masuk kembali.");
    }
  }, [searchParams]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: String(data.get("email")), password: String(data.get("password")),
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    
    // Set session start time
    localStorage.setItem("artikel_session_start", Date.now().toString());
    
    router.push("/"); router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex justify-center">
          <Image src="/image/png/logo-cms-artikel.png" alt="CMS Artikel" width={200} height={60} className="h-auto w-48" priority />
        </div>
        <h1 className="mt-7 text-center text-3xl font-bold tracking-tight">Masuk ke dashboard</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">Kelola konten semua website dari satu tempat.</p>
        <form onSubmit={signIn} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input required name="email" type="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-[#CE181E] focus:ring-2 focus:ring-[#CE181E]/20" />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input required name="password" type="password" autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-[#CE181E] focus:ring-2 focus:ring-[#CE181E]/20" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-[#CE181E] py-3 text-sm font-semibold text-white hover:bg-[#B01519] disabled:opacity-60 transition-colors">
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-950"><div className="text-white">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
