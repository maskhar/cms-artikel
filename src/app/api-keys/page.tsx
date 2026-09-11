"use client";
import { useSidebar } from "@/components/sidebar-context";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
type Site = { id: string; name: string; domain: string };
type ApiKey = {
  id: string;
  label: string;
  key_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  sites: { name: string; domain: string }[] | null;
};
export default function ApiKeysPage() {
  const { collapsed } = useSidebar();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [newKey, setNewKey] = useState("");
  const [message, setMessage] = useState("");
  async function loadKeys() {
    const [keyResponse, siteResponse] = await Promise.all([
      fetch("/api/cms/api-keys"),
      fetch("/api/cms/sites"),
    ]);
    const keyBody = await keyResponse.json().catch(() => null);
    const siteBody = await siteResponse.json().catch(() => null);
    if (keyResponse.ok) setKeys(keyBody?.data ?? []);
    else setMessage(keyBody?.error ?? "API key gagal dimuat.");
    if (siteResponse.ok) setSites(siteBody?.data ?? []);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadKeys();
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expiresAt = String(form.get("expiresAt") ?? "");
    const response = await fetch("/api/cms/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: form.get("siteId"),
        label: form.get("label"),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.error ?? "API key gagal dibuat.");
      return;
    }
    setNewKey(body.data.key);
    setMessage(
      "API key dibuat. Salin sekarang; key tidak dapat ditampilkan lagi.",
    );
    event.currentTarget.reset();
    void loadKeys();
  }
  async function rotate(id: string) {
    if (
      !confirm(
        "Rotasi key ini? Key lama langsung direvoke; expiry lama dipertahankan.",
      )
    )
      return;
    const response = await fetch(`/api/cms/api-keys/${id}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.error ?? "Rotasi API key gagal.");
      return;
    }
    setNewKey(body.data.key);
    setMessage("API key dirotasi. Salin key baru sekarang.");
    void loadKeys();
  }
  async function revoke(id: string) {
    if (
      !confirm(
        "Revoke API key ini? Website yang memakainya akan kehilangan akses.",
      )
    )
      return;
    const response = await fetch(`/api/cms/api-keys/${id}`, {
      method: "DELETE",
    });
    setMessage(response.ok ? "API key direvoke." : "API key gagal direvoke.");
    if (response.ok) void loadKeys();
  }
  return (
    <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-5 lg:p-7">
      <div
        className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}
      >
        <AppSidebar />
        <section className="min-w-0">
          <header className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-7">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-red-100 p-3 text-[#B01519]">
                <ShieldCheck size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#CE181E]">
                  Integrasi aman
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  API keys
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Key terpisah per website dengan expiry, rotasi, dan pencatatan
                  pemakaian.
                </p>
              </div>
            </div>
          </header>
          {newKey && (
            <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <p className="font-semibold text-amber-950">
                Simpan key sekarang
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Nilai penuh hanya tampil sekali.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-800">
                  {newKey}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newKey)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"
                >
                  <Copy size={17} /> Salin
                </button>
              </div>
            </section>
          )}
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="font-semibold text-slate-900">Key terdaftar</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Rotasi berkala dan revoke key yang tidak dipakai.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {keys.map((key) => (
                  <article key={key.id} className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                      <span className="rounded-2xl bg-red-50 p-3 text-[#CE181E]">
                        <KeyRound size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {key.label}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${key.revoked_at ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                          >
                            {key.revoked_at ? "Revoked" : "Aktif"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {key.sites?.[0] ? `${key.sites[0].name} · ${key.sites[0].domain}` : "Website"} ·{" "}
                          <span className="font-mono">
                            {key.key_prefix}••••
                          </span>
                        </p>
                        <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <div>
                            <dt className="font-medium text-slate-700">
                              Kedaluwarsa
                            </dt>
                            <dd className="mt-0.5">
                              {key.expires_at
                                ? new Date(key.expires_at).toLocaleString(
                                    "id-ID",
                                  )
                                : "Tidak ada"}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">
                              Terakhir dipakai
                            </dt>
                            <dd className="mt-0.5">
                              {key.last_used_at
                                ? new Date(key.last_used_at).toLocaleString(
                                    "id-ID",
                                  )
                                : "Belum pernah"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {!key.revoked_at && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => rotate(key.id)}
                            className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-[#B01519]"
                            title="Rotasi"
                            aria-label={`Rotasi ${key.label}`}
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => revoke(key.id)}
                            className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            title="Revoke"
                            aria-label={`Revoke ${key.label}`}
                          >
                            <ShieldX size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {!keys.length && (
                  <div className="py-14 text-center">
                    <KeyRound className="mx-auto text-slate-300" size={30} />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      Belum ada API key
                    </p>
                  </div>
                )}
              </div>
            </section>
            <form
              onSubmit={createKey}
              className="h-fit rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
            >
              <h2 className="font-semibold text-slate-900">Generate API key</h2>
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Website
                <select
                  required
                  name="siteId"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#CE181E] focus:ring-4 focus:ring-red-100"
                >
                  <option value="">Pilih website</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} · {site.domain}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Label
                <input
                  required
                  name="label"
                  placeholder="Production website"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#CE181E] focus:ring-4 focus:ring-red-100"
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Expiry{" "}
                <span className="font-normal text-slate-400">(opsional)</span>
                <input
                  name="expiresAt"
                  type="datetime-local"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#CE181E] focus:ring-4 focus:ring-red-100"
                />
              </label>
              <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#CE181E] px-4 text-sm font-semibold text-white hover:bg-[#B01519]">
                <Plus size={18} /> Generate key
              </button>
            </form>
          </div>
          {message && (
            <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

