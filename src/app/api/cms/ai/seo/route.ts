import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function extractText(payload: unknown) {
  const result = payload as { choices?: { message?: { content?: string }; delta?: { content?: string }; text?: string }[] };
  return result.choices?.map((choice) => choice.message?.content ?? choice.delta?.content ?? choice.text ?? "").join("") ?? "";
}

function parseGatewayText(text: string) {
  try { return extractText(JSON.parse(text)); } catch {
    return text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => { try { return extractText(JSON.parse(line)); } catch { return ""; } }).join("");
  }
}

function parseSeoJson(raw: string) {
  const candidate = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as { seoTitle?: unknown; metaDescription?: unknown };
    const seoTitle = String(value.seoTitle ?? "").trim().slice(0, 60);
    const metaDescription = String(value.metaDescription ?? "").trim().slice(0, 160);
    return seoTitle && metaDescription ? { seoTitle, metaDescription } : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as { title?: string; excerpt?: string; content?: string } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "Judul wajib diisi sebelum generate SEO." }, { status: 400 });
  const baseUrl = process.env.AI_API_BASE_URL ?? "https://9router.maskhar.com/v1"; const apiKey = process.env.AI_API_KEY; const model = process.env.AI_MODEL ?? "auto";
  if (!apiKey) return NextResponse.json({ error: "AI_API_KEY belum dikonfigurasi." }, { status: 503 });
  const prompt = `Buat metadata SEO berbahasa Indonesia. Balas JSON valid saja: {"seoTitle":"...","metaDescription":"..."}. SEO title maksimal 60 karakter dan meta description maksimal 160 karakter.\nJudul: ${body.title}\nRingkasan: ${body.excerpt ?? ""}\nKonten: ${(body.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 5000)}`;
  let response: Response;
  try { response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, stream: false, temperature: 0.4, messages: [{ role: "system", content: "Kamu editor SEO. Ikuti batas karakter dan balas JSON valid tanpa markdown." }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(45000) }); } catch { return NextResponse.json({ error: "AI SEO timeout atau tidak dapat dihubungi." }, { status: 502 }); }
  const responseText = await response.text();
  if (!response.ok) return NextResponse.json({ error: `AI SEO gagal (${response.status}).` }, { status: 502 });
  const seo = parseSeoJson(parseGatewayText(responseText));
  if (!seo) return NextResponse.json({ error: "AI tidak mengembalikan SEO title dan meta description yang valid." }, { status: 502 });
  return NextResponse.json({ data: seo });
}
