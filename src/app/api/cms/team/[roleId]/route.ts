import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const session = await requireGlobalAdmin();
  if (session.response) return session.response;
  const roleId = (await params).roleId;
  if (!z.string().uuid().safeParse(roleId).success) return NextResponse.json({ error: "Role ID tidak valid." }, { status: 400 });
  const parsed = z.object({ role: z.enum(["admin", "editor", "writer"]), siteId: z.string().uuid().nullable(), isActive: z.boolean() }).safeParse(await request.json());
  if (!parsed.success || (parsed.data.role === "admin") !== (parsed.data.siteId === null)) return NextResponse.json({ error: "Role atau scope website tidak valid." }, { status: 400 });
  const { data, error } = await createAdminClient().schema("artikel").from("user_roles").update({ role: parsed.data.role, site_id: parsed.data.siteId, is_active: parsed.data.isActive }).eq("id", roleId).select("id, role, site_id, is_active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const session = await requireGlobalAdmin();
  if (session.response) return session.response;
  const roleId = (await params).roleId;
  if (!z.string().uuid().safeParse(roleId).success) return NextResponse.json({ error: "Role ID tidak valid." }, { status: 400 });
  const { data, error } = await createAdminClient().schema("artikel").from("user_roles").delete().eq("id", roleId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
