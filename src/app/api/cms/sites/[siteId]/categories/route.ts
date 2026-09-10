import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const categorySchema = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(300).optional().default("") });
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const siteId = (await params).siteId;
  if (!z.string().uuid().safeParse(siteId).success) return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Nama atau slug kategori tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("categories").insert({ site_id: siteId, ...parsed.data }).select("id, name, slug, description, is_active").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Slug kategori sudah digunakan." : error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

