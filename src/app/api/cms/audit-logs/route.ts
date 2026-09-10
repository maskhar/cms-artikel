import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ siteId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(200).default(100) });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = querySchema.safeParse({ siteId: request.nextUrl.searchParams.get("siteId") || undefined, limit: request.nextUrl.searchParams.get("limit") || undefined });
  if (!parsed.success) return NextResponse.json({ error: "Filter audit tidak valid." }, { status: 400 });
  let query = supabase.schema("artikel").from("audit_logs").select("id, site_id, actor_id, action, entity_type, entity_id, metadata, created_at, sites(name)").order("created_at", { ascending: false }).limit(parsed.data.limit);
  if (parsed.data.siteId) query = query.eq("site_id", parsed.data.siteId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
