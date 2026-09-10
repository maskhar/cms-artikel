import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidCmsHostname, normalizeCmsHostname } from "@/lib/cms-hostname";
import { createClient } from "@/lib/supabase/server";

const hostnameSchema = z.object({ hostname: z.string().trim().min(3).max(253), displayName: z.string().trim().min(2).max(120), siteId: z.string().uuid().nullable().optional() });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").select("id, hostname, display_name, site_id, is_canonical, is_active, sites(name)").order("is_canonical", { ascending: false }).order("hostname");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = hostnameSchema.safeParse(await request.json());
  if (!parsed.success || !isValidCmsHostname(parsed.data.hostname)) return NextResponse.json({ error: "Hostname, nama, atau website default tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").insert({ hostname: normalizeCmsHostname(parsed.data.hostname), display_name: parsed.data.displayName, site_id: parsed.data.siteId ?? null }).select("id, hostname, display_name, site_id, is_canonical, is_active").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Hostname sudah terdaftar." : error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
