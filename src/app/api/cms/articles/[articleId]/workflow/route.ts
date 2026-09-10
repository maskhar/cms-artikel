import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedWorkflowTransition, workflowUpdate, type WorkflowAction } from "@/lib/article-workflow";

const requestSchema = z.object({ action: z.enum(["submit", "request_revision", "approve", "publish", "archive", "reopen"]), comment: z.string().trim().max(2000).optional().default("") });

export async function POST(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Aksi workflow atau komentar tidak valid." }, { status: 400 });
  const { action, comment } = parsed.data;
  if (action === "request_revision" && !comment) return NextResponse.json({ error: "Komentar wajib diisi saat meminta revisi." }, { status: 400 });
  const id = (await params).articleId;
  const { data: article, error: readError } = await supabase.schema("artikel").from("articles").select("status").eq("id", id).single();
  if (readError) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 });
  const values = workflowUpdate(action as WorkflowAction, user.id);
  if (!isAllowedWorkflowTransition(article.status as Parameters<typeof isAllowedWorkflowTransition>[0], values.status)) return NextResponse.json({ error: "Transisi status tidak valid." }, { status: 400 });
  const { error } = await supabase.schema("artikel").from("articles").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (comment) { const { error: commentError } = await supabase.schema("artikel").from("review_comments").insert({ article_id: id, author_id: user.id, body: comment, status_from: article.status, status_to: values.status }); if (commentError) return NextResponse.json({ error: commentError.message }, { status: 400 }); }
  return NextResponse.json({ success: true, status: values.status });
}
