import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ siteId: z.string().uuid() });
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = querySchema.safeParse({ siteId: request.nextUrl.searchParams.get("siteId") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
  const { data, error } = await supabase.schema("artikel").from("categories").select("id, name, slug").eq("site_id", parsed.data.siteId).eq("is_active", true).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

