# QUICK START — Session Berikutnya

## Langsung Implementasi Edge Function

### 1. Migration Database (5 menit)
\\\sql
-- File: supabase/migrations/202609100013_automation_external_id.sql
ALTER TABLE artikel.articles ADD COLUMN external_id TEXT;
CREATE UNIQUE INDEX articles_external_id_site_idx 
  ON artikel.articles (site_id, external_id) 
  WHERE external_id IS NOT NULL;
\\\

### 2. PostgreSQL Function (10 menit)
\\\sql
-- File: supabase/migrations/202609100014_upsert_automation_article.sql
CREATE OR REPLACE FUNCTION artikel.upsert_automation_article(
  p_site_id UUID,
  p_external_id TEXT,
  p_title TEXT,
  p_content TEXT,
  p_slug TEXT,
  p_excerpt TEXT,
  p_category_slug TEXT,
  p_status artikel.article_status,
  p_seo_title TEXT,
  p_meta_description TEXT
) RETURNS TABLE(
  article_id UUID,
  created BOOLEAN
) AS \$\$
-- Logic: resolve category, upsert artikel, insert revision, return id
\$\$ LANGUAGE plpgsql SECURITY DEFINER;
\\\

### 3. Edge Function Skeleton (15 menit)
\\\	ypescript
// File: supabase/functions/artikel-cms/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // 1. CORS preflight
  // 2. Validate x-artikel-key
  // 3. Rate limit check
  // 4. Parse { action, request_id, data }
  // 5. Switch action → article.upsert
  // 6. Call artikel.upsert_automation_article
  // 7. Audit log
  // 8. Return { success, request_id, data }
})
\\\

### 4. Deploy & Test (10 menit)
\\\ash
# Local
cd supabase/migrations
psql ... -f 202609100013_automation_external_id.sql
psql ... -f 202609100014_upsert_automation_article.sql

# Deploy function
cd supabase/functions/artikel-cms
supabase functions deploy artikel-cms

# Test
curl -X POST 'https://supabase.carubra.com/functions/v1/artikel-cms' \
  -H 'x-artikel-key: ak_test_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"action":"article.upsert","data":{"external_id":"test-1","title":"Test"}}'
\\\

## Referensi Cepat

| Item | Path |
|------|------|
| Kontrak API | docs/UNIFIED-CMS-API-DESIGN.md |
| Keputusan | docs/API-DECISIONS.md |
| TODO checklist | docs/TODO.md fase 3 |
| Existing auth | src/lib/public-api.ts:12 authenticatePublicApiKey |
| Rate limit RPC | artikel.consume_api_key_rate_limit |
| Blog auto-post | supabase/volumes/functions/blog-auto-post/index.ts |

## Critical Notes

- **Jangan** expose service_role ke caller
- **Wajib** validate site_id dari x-artikel-key
- **Wajib** unique check external_id per tenant
- **Wajib** audit redaction (no key, no base64)
- **Test** retry idempotency sebelum UAT

## Estimated Timeline

- Migration + function: 1 jam
- Edge Function core: 2 jam
- Testing + fixes: 1 jam
- UAT one tenant: 30 menit
- **Total:** ~4.5 jam untuk MVP article.upsert

Generated: 2026-09-10 23:42:30
