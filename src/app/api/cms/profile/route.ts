import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(255)
});

async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await createAdminClient().schema("artikel").from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).is("site_id", null).maybeSingle();
  return role ? user : null;
}

export async function PATCH(request: Request) {
  const currentUser = await requireGlobalAdmin();
  if (!currentUser) return NextResponse.json({ error: "Admin global diperlukan." }, { status: 403 });

  const parsed = updateProfileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });

  const { userId, fullName } = parsed.data;
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fullName }
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: { id: data.user.id, name: fullName } });
  } catch (err) {
    return NextResponse.json({ error: "Gagal memperbarui profil." }, { status: 500 });
  }
}
