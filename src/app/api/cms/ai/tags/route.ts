import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const stopWords = new Set(["yang", "dan", "atau", "untuk", "dengan", "dari", "pada", "dalam", "ini", "itu", "adalah", "akan", "bisa", "sebagai", "karena", "oleh", "ke", "di", "sebuah", "artikel"]);

function fallbackTags(title: string, excerpt = "", content = "") {
  const text = `${title} ${title} ${excerpt} ${content.replace(/<[^>]+>/g, " ")}`.toLowerCase();
  const counts = new Map<string, number>();
  for (const word of text.match(/[a-z0-9]{3,}/g) ?? []) {
    if (stopWords.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const tags = [...counts].sort((left, right) => right[1] - left[1]).map(([word]) => word[0].toUpperCase() + word.slice(1)).slice(0, 5);
  const defaults = ["Editorial", "Konten", "Informasi", "Panduan", "Wawasan"];
  return [...tags, ...defaults.filter((tag) => !tags.includes(tag))].slice(0, 5);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as { title?: string; excerpt?: string; content?: string } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "Judul wajib diisi sebelum generate tag." }, { status: 400 });
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI_API_KEY belum dikonfigurasi." }, { status: 503 });
  const baseUrl = process.env.AI_API_BASE_URL ?? "https://9router.maskhar.com/v1";
  const model = process.env.AI_MODEL ?? "auto";
  const fallback = fallbackTags(body.title, body.excerpt, body.content);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, stream: false, temperature: 0.4, messages: [{ role: "system", content: "Balas JSON array berisi tepat 5 tag singkat tanpa markdown." }, { role: "user", content: `Judul: ${body.title}\nRingkasan: ${body.excerpt ?? ""}\nKonten: ${(body.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000)}` }] }), signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ data: { tags: fallback, source: "fallback" } });
  const payload = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null;
  const raw = payload?.choices?.[0]?.message?.content?.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim() ?? "";
  try { const tags = (JSON.parse(raw) as unknown[]).map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 5); if (tags.length !== 5) throw new Error(); return NextResponse.json({ data: { tags, source: "ai" } }); } catch { return NextResponse.json({ data: { tags: fallback, source: "fallback" } }); }
}
