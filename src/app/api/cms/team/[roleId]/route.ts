import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorized() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data } = await createAdminClient().schema("artikel").from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
  return Boolean(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  if (!await authorized()) return NextResponse.json({ error: "Admin global diperlukan." }, { status: 403 });
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
  if (!await authorized()) return NextResponse.json({ error: "Admin global diperlukan." }, { status: 403 });
  const roleId = (await params).roleId;
  if (!z.string().uuid().safeParse(roleId).success) return NextResponse.json({ error: "Role ID tidak valid." }, { status: 400 });
  const { data, error } = await createAdminClient().schema("artikel").from("user_roles").delete().eq("id", roleId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ success: true });
}
