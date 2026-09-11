import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  addonIds: z.array(z.string())
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid addon IDs" }, { status: 400 });
  }

  const articleId = (await params).articleId;
  const { addonIds } = parsed.data;

  const db = supabase.schema("artikel");
  const updates = addonIds.map((id, index) =>
    db.from("article_addons")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("article_id", articleId)
  );

  await Promise.all(updates);

  return NextResponse.json({ success: true });
}