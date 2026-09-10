// Artikel CMS Automation API Edge Function
// Purpose: Public API endpoint for automated article creation/updates
// Authentication: API Key based (x-artikel-key header)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Type definitions
interface ArticleUpsertPayload {
  action: "article.upsert";
  data: {
    external_id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    category: string;
    status?: "draft" | "published" | "archived";
    featured_image?: string;
    meta_description?: string;
    meta_keywords?: string[];
    published_at?: string;
  };
}

interface ApiKeyRecord {
  id: string;
  site_id: string;
  user_id: string;
  key_hash: string;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

interface RateLimitRecord {
  key: string;
  count: number;
  window_start: number;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitStore = new Map<string, RateLimitRecord>();

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-artikel-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Error response helper
function errorResponse(message: string, status = 400, code?: string) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        code: code || "VALIDATION_ERROR",
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Success response helper
function successResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Rate limiting check
function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(apiKey);

  if (!record || now - record.window_start > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(apiKey, {
      key: apiKey,
      count: 1,
      window_start: now,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Validate API key and get site context
async function validateApiKey(
  supabaseClient: any,
  apiKey: string
): Promise<ApiKeyRecord | null> {
  try {
    // Hash the API key (in production, use proper crypto hashing)
    const keyHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(apiKey)
    );
    const keyHashHex = Array.from(new Uint8Array(keyHash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const { data, error } = await supabaseClient
      .from("api_keys")
      .select("id, site_id, user_id, key_hash, name, last_used_at, expires_at, is_active")
      .eq("key_hash", keyHashHex)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    // Update last_used_at
    await supabaseClient
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    return data;
  } catch (err) {
    console.error("API key validation error:", err);
    return null;
  }
}

// Validate article upsert payload
function validateArticleUpsertPayload(payload: any): string | null {
  if (!payload.data) {
    return "Missing 'data' field";
  }

  const { data } = payload;

  if (!data.external_id || typeof data.external_id !== "string") {
    return "Missing or invalid 'data.external_id'";
  }

  if (!data.title || typeof data.title !== "string" || data.title.length < 1) {
    return "Missing or invalid 'data.title'";
  }

  if (!data.slug || typeof data.slug !== "string" || !/^[a-z0-9-]+$/.test(data.slug)) {
    return "Missing or invalid 'data.slug' (must be lowercase alphanumeric with hyphens)";
  }

  if (!data.content || typeof data.content !== "string" || data.content.length < 1) {
    return "Missing or invalid 'data.content'";
  }

  if (!data.category || typeof data.category !== "string") {
    return "Missing or invalid 'data.category'";
  }

  if (data.status && !["draft", "published", "archived"].includes(data.status)) {
    return "Invalid 'data.status' (must be draft, published, or archived)";
  }

  if (data.meta_keywords && !Array.isArray(data.meta_keywords)) {
    return "Invalid 'data.meta_keywords' (must be array)";
  }

  if (data.published_at && isNaN(Date.parse(data.published_at))) {
    return "Invalid 'data.published_at' (must be valid ISO 8601 timestamp)";
  }

  return null;
}

// Handle article upsert
async function handleArticleUpsert(
  supabaseClient: any,
  payload: ArticleUpsertPayload,
  apiKeyRecord: ApiKeyRecord
) {
  const { data } = payload;

  try {
    // Call the database function
    const { data: result, error } = await supabaseClient.rpc(
      "upsert_automation_article",
      {
        p_site_id: apiKeyRecord.site_id,
        p_external_id: data.external_id,
        p_title: data.title,
        p_slug: data.slug,
        p_content: data.content,
        p_excerpt: data.excerpt || null,
        p_category_name: data.category,
        p_author_id: apiKeyRecord.user_id,
        p_status: data.status || "draft",
        p_featured_image: data.featured_image || null,
        p_meta_description: data.meta_description || null,
        p_meta_keywords: data.meta_keywords || null,
        p_published_at: data.published_at || null,
      }
    );

    if (error) {
      console.error("Database error:", error);
      
      // Handle specific errors
      if (error.message.includes("Slug") && error.message.includes("already exists")) {
        return errorResponse("Slug already exists for another article", 409, "SLUG_CONFLICT");
      }
      
      if (error.message.includes("does not exist")) {
        return errorResponse(error.message, 404, "NOT_FOUND");
      }

      return errorResponse("Database operation failed: " + error.message, 500, "DATABASE_ERROR");
    }

    // Log audit trail (redact sensitive data)
    console.log("Article upsert success:", {
      article_id: result[0].article_id,
      created_new: result[0].created_new,
      site_id: apiKeyRecord.site_id,
      external_id: data.external_id,
      timestamp: new Date().toISOString(),
    });

    return successResponse({
      article_id: result[0].article_id,
      revision_id: result[0].revision_id,
      created: result[0].created_new,
      category_id: result[0].category_id,
      message: result[0].created_new ? "Article created successfully" : "Article updated successfully",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse("Internal server error", 500, "INTERNAL_ERROR");
  }
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Extract API key from header
    const apiKey = req.headers.get("x-artikel-key");
    if (!apiKey) {
      return errorResponse("Missing x-artikel-key header", 401, "MISSING_API_KEY");
    }

    // Rate limiting check
    if (!checkRateLimit(apiKey)) {
      return errorResponse(
        "Rate limit exceeded. Maximum 120 requests per minute.",
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate API key
    const apiKeyRecord = await validateApiKey(supabaseClient, apiKey);
    if (!apiKeyRecord) {
      return errorResponse("Invalid or expired API key", 401, "INVALID_API_KEY");
    }

    // Parse request body
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400, "INVALID_JSON");
    }

    // Validate action field
    if (!payload.action) {
      return errorResponse("Missing 'action' field", 400, "MISSING_ACTION");
    }

    // Route to appropriate handler
    switch (payload.action) {
      case "article.upsert":
        const validationError = validateArticleUpsertPayload(payload);
        if (validationError) {
          return errorResponse(validationError, 400, "VALIDATION_ERROR");
        }
        return await handleArticleUpsert(supabaseClient, payload, apiKeyRecord);

      default:
        return errorResponse(`Unknown action: ${payload.action}`, 400, "UNKNOWN_ACTION");
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return errorResponse("Internal server error", 500, "INTERNAL_ERROR");
  }
});
