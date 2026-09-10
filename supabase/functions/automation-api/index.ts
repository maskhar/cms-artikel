import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface ArticlePayload {
  external_id: string
  title: string
  slug?: string
  content: string
  excerpt?: string
  category_id?: string
  category_name?: string
  tags?: string[]
  featured_image_url?: string
  status?: 'draft' | 'pending' | 'approved' | 'published' | 'archived'
  seo_title?: string
  meta_description?: string
  canonical_url?: string
  robots?: string
  og_image_url?: string
  published_at?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract API key from header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify API key and get site_id
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('artikel.api_keys')
      .select('site_id, is_active')
      .eq('key_hash', apiKey)
      .eq('scope', 'automation')
      .single()

    if (apiKeyError || !apiKeyData || !apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const siteId = apiKeyData.site_id

    // Parse request body
    const payload: ArticlePayload = await req.json()

    // Validate required fields
    if (!payload.external_id || !payload.title || !payload.content) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['external_id', 'title', 'content']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call upsert function
    const { data, error } = await supabase.rpc('artikel.upsert_automation_article', {
      p_site_id: siteId,
      p_external_id: payload.external_id,
      p_title: payload.title,
      p_slug: payload.slug || null,
      p_content: payload.content,
      p_excerpt: payload.excerpt || null,
      p_category_id: payload.category_id || null,
      p_category_name: payload.category_name || null,
      p_tags: payload.tags || null,
      p_featured_image_url: payload.featured_image_url || null,
      p_status: payload.status || 'draft',
      p_seo_title: payload.seo_title || null,
      p_meta_description: payload.meta_description || null,
      p_canonical_url: payload.canonical_url || null,
      p_robots: payload.robots || 'index, follow',
      p_og_image_url: payload.og_image_url || null,
      p_published_at: payload.published_at || null
    })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: data 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
