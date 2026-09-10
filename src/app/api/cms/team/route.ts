import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), siteId: z.string().uuid().nullable(), role: z.enum(["admin", "editor", "writer"]) });

async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await createAdminClient().schema("artikel").from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
  return role ? user : null;
}

export async function GET() {
  const currentUser = await requireGlobalAdmin(); if (!currentUser) return NextResponse.json({ error: "Admin global diperlukan. Pastikan login menggunakan dev@gmail.com atau akun admin lain." }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: roles, error }, { data: users }] = await Promise.all([
    admin.schema("artikel").from("user_roles").select("id, user_id, site_id, role, is_active, sites(name, domain)").order("role"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const emailById = new Map((users?.users ?? []).map((user) => [user.id, user.email ?? "-"]));
  return NextResponse.json({ data: (roles ?? []).map((role) => ({ ...role, email: emailById.get(role.user_id) ?? "Akun tidak ditemukan" })) });
}

export async function POST(request: Request) {
  const currentUser = await requireGlobalAdmin(); if (!currentUser) return NextResponse.json({ error: "Admin global diperlukan. Pastikan login menggunakan dev@gmail.com atau akun admin lain." }, { status: 403 });
  const parsed = assignmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Email, website, atau role tidak valid." }, { status: 400 });
  const input = parsed.data;
  if (input.role === "admin" && input.siteId) return NextResponse.json({ error: "Admin harus memakai scope global." }, { status: 400 });
  if (input.role !== "admin" && !input.siteId) return NextResponse.json({ error: "Editor/writer wajib ditugaskan ke website." }, { status: 400 });
  const admin = createAdminClient();
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = users.users.find((user) => user.email?.toLowerCase() === input.email);
  if (!target) return NextResponse.json({ error: "Akun Auth dengan email tersebut tidak ditemukan. Buat akun melalui Supabase Auth sebelum memberi role." }, { status: 422 });
  const { data, error } = await admin.schema("artikel").from("user_roles").insert({ user_id: target.id, site_id: input.siteId, role: input.role, is_active: true }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Role tersebut sudah ada." : error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}


