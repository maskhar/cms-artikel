import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidCmsHostname, normalizeCmsHostname } from "@/lib/cms-hostname";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ hostnameId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = (await params).hostnameId;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Hostname ID tidak valid." }, { status: 400 });
  const parsed = z.object({ hostname: z.string().trim().optional(), displayName: z.string().trim().min(2).max(120).optional(), siteId: z.string().uuid().nullable().optional(), isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(await request.json());
  if (!parsed.success || (parsed.data.hostname && !isValidCmsHostname(parsed.data.hostname))) return NextResponse.json({ error: "Data hostname tidak valid." }, { status: 400 });
  const values = { ...(parsed.data.hostname ? { hostname: normalizeCmsHostname(parsed.data.hostname) } : {}), ...(parsed.data.displayName ? { display_name: parsed.data.displayName } : {}), ...(parsed.data.siteId !== undefined ? { site_id: parsed.data.siteId } : {}), ...(parsed.data.isActive !== undefined ? { is_active: parsed.data.isActive } : {}) };
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").update(values).eq("id", id).eq("is_canonical", false).select("id, hostname, display_name, site_id, is_active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Hostname tidak ditemukan atau merupakan domain canonical." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ hostnameId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = (await params).hostnameId;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Hostname ID tidak valid." }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").delete().eq("id", id).eq("is_canonical", false).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Hostname tidak ditemukan atau merupakan domain canonical." }, { status: 404 });
  return NextResponse.json({ success: true });
}
