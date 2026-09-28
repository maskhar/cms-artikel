import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const siteSchema = z.object({ name: z.string().trim().min(2).max(120), domain: z.string().trim().toLowerCase().regex(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}$/), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { data, error } = await supabase.schema("artikel").from("sites").select("id, name, domain, slug, is_active").order("name");
  if (error) return dbErrorResponse(error);
  return NextResponse.json({ data });
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = siteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Nama, domain, atau slug tidak valid." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await supabase.schema("artikel").from("sites").insert({ ...input, domain: input.domain.replace(/^https?:\/\//, "").replace(/\/$/, "") }).select("id, name, domain, slug, is_active").single();
  if (error) return error.code === "23505" ? NextResponse.json({ error: "Domain atau slug sudah digunakan." }, { status: 409 }) : dbErrorResponse(error);
  return NextResponse.json({ data }, { status: 201 });
}

