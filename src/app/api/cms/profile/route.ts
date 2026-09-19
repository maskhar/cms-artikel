import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/auth";

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(255)
});

export async function PATCH(request: Request) {
  const session = await requireGlobalAdmin();
  if (session.response) return session.response;

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
