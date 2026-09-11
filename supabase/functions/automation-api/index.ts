import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};
const statuses = new Set(["draft", "in_review", "revision_requested", "approved", "published", "archived"]);

type ArticlePayload = {
  external_id?: string;
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  category_name?: string;
  status?: string;
  featured_image?: string;
  meta_description?: string;
  meta_keywords?: string[];
  published_at?: string;
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function keyHash(key: string, pepper: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${key}:${pepper}`));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return json({ error: "Missing x-api-key header" }, 401);

  const pepper = Deno.env.get("ARTIKEL_API_KEY_PEPPER");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!pepper || !supabaseUrl || !serviceRoleKey) return json({ error: "Automation API is not configured" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey).schema("artikel");
  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("id, site_id, created_by, sites!inner(id, name, domain, slug, is_active)")
    .eq("secret_hash", await keyHash(apiKey, pepper))
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  const site = (keyRecord?.sites as unknown as { id: string; name: string; domain: string; slug: string; is_active: boolean }[] | undefined)?.[0];
  const siteActive = site?.is_active;
  if (!keyRecord || !siteActive || !keyRecord.created_by) return json({ error: "Invalid or inactive API key" }, 401);

  if (request.method === "GET") {
    return json({
      success: true,
      site: { id: site.id, name: site.name, domain: site.domain, slug: site.slug },
    }, 200);
  }

  const payload = await request.json().catch(() => null) as ArticlePayload | null;
  if (!payload || !payload.external_id || !payload.title || !payload.slug || !payload.content || !payload.category_name) {
    return json({ error: "Missing required fields", required: ["external_id", "title", "slug", "content", "category_name"] }, 400);
  }
  if (payload.status && !statuses.has(payload.status)) return json({ error: "Invalid status", allowed: [...statuses] }, 400);
  if (payload.meta_keywords && !Array.isArray(payload.meta_keywords)) return json({ error: "meta_keywords must be an array" }, 400);
  if (payload.published_at && Number.isNaN(Date.parse(payload.published_at))) return json({ error: "published_at must be ISO 8601" }, 400);

  const { data, error } = await supabase.rpc("upsert_automation_article", {
    p_site_id: keyRecord.site_id,
    p_external_id: payload.external_id,
    p_title: payload.title,
    p_slug: payload.slug,
    p_content: payload.content,
    p_excerpt: payload.excerpt ?? null,
    p_category_name: payload.category_name,
    p_author_id: keyRecord.created_by,
    p_status: payload.status ?? "draft",
    p_featured_image: payload.featured_image ?? null,
    p_meta_description: payload.meta_description ?? null,
    p_meta_keywords: payload.meta_keywords ?? null,
    p_published_at: payload.published_at ?? null,
  });
  if (error) return json({ error: "Database operation failed", details: error.message }, 500);

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id);
  return json({
    success: true,
    site: site && { id: site.id, name: site.name, domain: site.domain, slug: site.slug },
    data,
  }, 200);
});

