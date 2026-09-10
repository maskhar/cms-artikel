import { NextRequest, NextResponse } from "next/server";
import { normalizeCmsHostname } from "@/lib/cms-hostname";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const hostname = normalizeCmsHostname(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? process.env.CMS_CANONICAL_HOST ?? "");
  const { data, error } = await supabase.schema("artikel").from("cms_hostnames").select("hostname, display_name, site_id, is_canonical, sites(name)").eq("hostname", hostname).eq("is_active", true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? { hostname, display_name: process.env.CMS_CANONICAL_HOST ?? hostname, site_id: null, is_canonical: hostname === process.env.CMS_CANONICAL_HOST, sites: null } });
}
