import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  siteIds: z.array(z.string().uuid()).max(100).optional(),
  siteId: z.string().uuid().nullable().optional(),
  role: z.enum(["admin", "editor", "writer"]),
});

async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await createAdminClient().schema("artikel").from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
  return role ? user : null;
}

export async function GET() {
  const currentUser = await requireGlobalAdmin(); 
  if (!currentUser) return NextResponse.json({ error: "Admin global diperlukan. Pastikan login menggunakan dev@gmail.com atau akun admin lain." }, { status: 403 });
  
  const admin = createAdminClient();
  
  // Fetch roles from database
  const { data: roles, error } = await admin.schema("artikel").from("user_roles").select("id, user_id, site_id, role, is_active, sites(name, domain)").order("role");
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // Get all unique user_ids from roles
  const userIds = [...new Set((roles ?? []).map(role => role.user_id))];
  
  // Fetch user data for each user_id individually to avoid pagination issues
  const userDataById = new Map<string, { email: string; name: string | null }>();
  
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
        if (!userError && userData?.user) {
          userDataById.set(userId, {
            email: userData.user.email ?? "-",
            name: userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name ?? null
          });
        }
      } catch {
        // User doesn't exist, will be marked as not found
      }
    })
  );
  
  const enrichedRoles = (roles ?? []).map((role) => {
    const userData = userDataById.get(role.user_id);
    return {
      ...role,
      email: userData?.email ?? `User ID: ${role.user_id.substring(0, 8)}... (tidak ada di Auth)`,
      name: userData?.name ?? null,
      user_exists: !!userData
    };
  });
  
  return NextResponse.json({ data: enrichedRoles });
}

export async function POST(request: Request) {
  const currentUser = await requireGlobalAdmin(); if (!currentUser) return NextResponse.json({ error: "Admin global diperlukan. Pastikan login menggunakan dev@gmail.com atau akun admin lain." }, { status: 403 });
  const parsed = assignmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Email, website, atau role tidak valid." }, { status: 400 });
  const input = parsed.data;
  const siteIdsInput = input.siteIds ?? (input.siteId ? [input.siteId] : []);
  if (input.role === "admin" && siteIdsInput.length) return NextResponse.json({ error: "Admin harus memakai scope global." }, { status: 400 });
  if (input.role !== "admin" && !siteIdsInput.length) return NextResponse.json({ error: "Editor/writer wajib ditugaskan minimal ke satu website." }, { status: 400 });
  const admin = createAdminClient();
  let target = null;
  for (let page = 1; page <= 1000; page += 1) {
    const { data: users, error: userError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (userError) return NextResponse.json({ error: `Auth user tidak dapat dibaca: ${userError.message}` }, { status: 502 });
    target = users.users.find((user) => user.email?.trim().toLowerCase() === input.email) ?? null;
    if (target || users.users.length < 100) break;
  }
  if (!target) return NextResponse.json({ error: `Akun Auth dengan email "${input.email}" tidak ditemukan. Pastikan email sama persis dengan akun di Supabase Auth.` }, { status: 422 });
  const siteIds = [...new Set(siteIdsInput)];
  if (input.role !== "admin") {
    const { data: validSites, error: siteError } = await admin.schema("artikel").from("sites").select("id").in("id", siteIds).eq("is_active", true);
    if (siteError) return NextResponse.json({ error: siteError.message }, { status: 400 });
    if ((validSites ?? []).length !== siteIds.length) return NextResponse.json({ error: "Satu atau lebih website tidak valid atau nonaktif." }, { status: 400 });
  }
  const assignments: Array<{ user_id: string; site_id: string | null; role: "admin" | "editor" | "writer"; is_active: boolean }> = input.role === "admin"
    ? [{ user_id: target.id, site_id: null, role: input.role, is_active: true }]
    : siteIds.map((siteId) => ({ user_id: target.id, site_id: siteId, role: input.role, is_active: true }));
  const { data, error } = await admin.schema("artikel").from("user_roles").upsert(assignments as never, { onConflict: "user_id,site_id,role" }).select("id, site_id, role, is_active");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, created: data?.length ?? 0 }, { status: 201 });
}
