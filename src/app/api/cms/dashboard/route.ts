import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const db = supabase.schema("artikel");
  const [articles, review, published, categories, recent] = await Promise.all([
    db.from("articles").select("*", { count: "exact", head: true }),
    db.from("articles").select("*", { count: "exact", head: true }).eq("status", "in_review"),
    db.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    db.from("categories").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("articles").select("id, title, status, updated_at, categories(name), sites(name)").order("updated_at", { ascending: false }).limit(8),
  ]);
  const error = articles.error ?? review.error ?? published.error ?? categories.error ?? recent.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: { stats: { articles: articles.count ?? 0, inReview: review.count ?? 0, published: published.count ?? 0, activeCategories: categories.count ?? 0 }, recent: recent.data ?? [] } });
}
