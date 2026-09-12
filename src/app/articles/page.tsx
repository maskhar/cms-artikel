"use client";

import { MainLayout } from "@/components/main-layout";
import {
  Archive,
  ArrowUpRight,
  CheckSquare,
  Edit3,
  Filter,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updated_at: string;
  categories: { name: string }[] | null;
};
const statusStyle: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  revision_requested: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  published: "bg-red-100 text-red-800",
  archived: "bg-slate-100 text-slate-500",
};
const statusLabel: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  revision_requested: "Revision requested",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [bulkStatus, setBulkStatus] = useState("published");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    const response = await fetch("/api/cms/articles");
    const body = await response.json().catch(() => null);
    if (response.ok) setArticles(body.data ?? []);
    else setMessage(body?.error ?? "Artikel gagal dimuat.");
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const filtered = useMemo(
    () =>
      articles.filter(
        (article) =>
          (!status || article.status === status) &&
          `${article.title} ${article.slug}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [articles, search, status],
  );
  const allSelected =
    filtered.length > 0 &&
    filtered.every((article) => selected.includes(article.id));
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function toggleAll() {
    setSelected(allSelected ? [] : filtered.map((article) => article.id));
  }
  async function bulk(
    action: "review" | "archive" | "status" | "delete",
    ids = selected,
  ) {
    if (!ids.length) return;
    if (
      action === "delete" &&
      !window.confirm(
        `Delete permanen ${ids.length} artikel? Data tidak dapat dipulihkan.`,
      )
    )
      return;
    setLoading(true);
    setMessage("Memproses...");
    const response = await fetch("/api/cms/articles/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids,
        action,
        status: action === "status" ? bulkStatus : undefined,
      }),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Bulk action gagal.");
      return;
    }
    setSelected([]);
    setMessage(`${body.data.affected} artikel berhasil diproses.`);
    void load();
  }
  return (
    <MainLayout>
      <header className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm sm:p-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-[#B01519]">Konten</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Artikel</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Kelola draft, review, status, arsip, dan penghapusan artikel.
          </p>
        </div>
        <Link
          href="/articles/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#CE181E] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#B01519]"
        >
          <Plus size={18} /> Artikel baru
        </Link>
      </header>
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500 focus-within:ring-2 focus-within:ring-[#CE181E]">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari artikel…"
              className="w-full bg-transparent py-2 outline-none"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm">
            <Filter size={16} />
            <select
              aria-label="Filter status artikel"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="">Semua status</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center">
            <span className="text-sm font-semibold text-red-900">
              {selected.length} dipilih
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={loading}
                onClick={() => bulk("review")}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CE181E] px-3 py-2 text-xs font-semibold text-white"
              >
                <Send size={15} /> Kirim review
              </button>
              <label className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold">
                <select
                  value={bulkStatus}
                  aria-label="Status tujuan artikel terpilih"
                  disabled={loading}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="bg-transparent outline-none"
                >
                  {Object.entries(statusLabel)
                    .filter(([value]) => value !== "archived")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
                <button
                  disabled={loading}
                  onClick={() => bulk("status")}
                  title="Terapkan status"
                  type="button"
                  className="inline-flex items-center gap-2 rounded bg-[#CE181E] px-3 py-2 text-white disabled:opacity-50"
                >
                  <CheckSquare size={15} /> Terapkan status
                </button>
              </label>
              <button
                disabled={loading}
                onClick={() => bulk("archive")}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold"
              >
                <Archive size={15} /> Archive
              </button>
              <button
                disabled={loading}
                onClick={() => bulk("delete")}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        )}
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map((article) => (
            <article key={article.id} className="p-4">
              <div className="flex gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(article.id)}
                  onChange={() => toggle(article.id)}
                  className="mt-1 size-4"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/articles/${article.id}`}
                        className="truncate font-bold hover:text-[#B01519]"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        /{article.slug}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        href={`/articles/${article.id}`}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        onClick={() => bulk("archive", [article.id])}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        title="Archive"
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        onClick={() => bulk("delete", [article.id])}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      {article.categories?.[0]?.name ?? "Tanpa kategori"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[article.status] ?? statusStyle.draft}`}
                    >
                      {statusLabel[article.status] ?? article.status}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <p className="p-10 text-center text-sm text-slate-500">
              Tidak ada artikel.
            </p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Pilih semua artikel"
                    className="size-4"
                  />
                </th>
                <th className="px-2 py-4">Judul</th>
                <th>Kategori</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th className="px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-6">
                    <input
                      type="checkbox"
                      checked={selected.includes(article.id)}
                      onChange={() => toggle(article.id)}
                      aria-label={`Pilih ${article.title}`}
                      className="size-4"
                    />
                  </td>
                  <td className="px-2 py-5">
                    <Link
                      href={`/articles/${article.id}`}
                      className="font-bold hover:text-[#B01519]"
                    >
                      {article.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-400">
                      /{article.slug}
                    </p>
                  </td>
                  <td className="text-slate-500">
                    {article.categories?.[0]?.name ?? "-"}
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[article.status] ?? statusStyle.draft}`}
                    >
                      {statusLabel[article.status] ?? article.status}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {new Date(article.updated_at).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-6">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/articles/${article.id}`}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        onClick={() => bulk("archive", [article.id])}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        title="Archive"
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        onClick={() => bulk("delete", [article.id])}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ArrowUpRight size={0} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="p-12 text-center text-sm text-slate-500">
              Tidak ada artikel.
            </div>
          )}
        </div>
        {message && (
          <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
            {message}
          </p>
        )}
      </div>
    </MainLayout>
  );
}


