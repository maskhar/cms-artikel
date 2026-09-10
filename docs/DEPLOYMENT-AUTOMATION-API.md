# Deployment Guide: Automation API
# File: docs/DEPLOYMENT-AUTOMATION-API.md

## Prerequisites

- SSH access to `maskhar@supabase-server` (20.20.20.173)
- Git repository access
- PostgreSQL credentials for `artikel` schema
- Supabase CLI installed locally

## Deployment Phases

### Phase 1: Local Development (1 hour)

**Step 1: Apply migrations locally**

```bash
# Connect to local Supabase
cd supabase/migrations

# Apply migration 1: Add external_id column
psql -h localhost -U postgres -d postgres -f 202609100013_add_external_id_to_articles.sql

# Apply migration 2: Create upsert function
psql -h localhost -U postgres -d postgres -f 202609100014_create_upsert_automation_article_function.sql

# Apply migration 3: Add RLS policies
psql -h localhost -U postgres -d postgres -f 202609100015_add_automation_api_rls_policies.sql
```

**Step 2: Run integration tests**

```bash
# Test database function
psql -h localhost -U postgres -d postgres -f tests/integration/test_upsert_automation_article.sql
```

**Expected output:**
```
Test 1: PASSED
Test 2: PASSED
Test 3: PASSED - Slug conflict detected correctly
Test 4: PASSED
Test 5: PASSED
```

**Step 3: Deploy Edge Function locally**

```bash
# Start local Supabase
supabase start

# Deploy function
supabase functions deploy artikel-cms --no-verify-jwt

# Get local function URL
supabase status
```

**Step 4: Create test API key**

```sql
-- Connect to local database
INSERT INTO artikel.api_keys (site_id, user_id, name, key_hash, is_active)
VALUES (
  '<your-test-site-id>',
  '<your-test-user-id>',
  'Local Test Key',
  encode(digest('test-key-local-123', 'sha256'), 'hex'),
  true
);
```

**Step 5: Run E2E tests**

```bash
# Set environment variables
export SUPABASE_URL="http://localhost:54321"
export TEST_API_KEY="test-key-local-123"

# Run PowerShell tests
pwsh tests/e2e/test_automation_api.ps1

# Or bash tests (in WSL/Git Bash)
bash tests/e2e/test_automation_api.sh
```

**Success criteria:**
- All 5 integration tests pass
- All 6 E2E tests pass
- No errors in function logs

---

### Phase 2: Staging Deployment (30 minutes)

**Step 1: SSH to Supabase server**

```bash
ssh maskhar@supabase-server
cd ~/docker/supabase/supabase-1.26.05/docker
```

**Step 2: Apply migrations to staging database**

```bash
# Copy migration files to server (from local machine)
scp supabase/migrations/202609100013_add_external_id_to_articles.sql \
    maskhar@supabase-server:/tmp/

scp supabase/migrations/202609100014_create_upsert_automation_article_function.sql \
    maskhar@supabase-server:/tmp/

scp supabase/migrations/202609100015_add_automation_api_rls_policies.sql \
    maskhar@supabase-server:/tmp/

# On server: Apply migrations
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100013_add_external_id_to_articles.sql
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100014_create_upsert_automation_article_function.sql
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100015_add_automation_api_rls_policies.sql
```

**Step 3: Verify migrations**

```bash
# Check column exists
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema = 'artikel' AND table_name = 'articles' AND column_name = 'external_id';"

# Check function exists
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'artikel' AND routine_name = 'upsert_automation_article';"

# Check policies exist
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT policyname FROM pg_policies WHERE schemaname = 'artikel' AND tablename = 'articles';"
```

**Step 4: Deploy Edge Function**

```bash
# From local machine
supabase functions deploy artikel-cms \
  --project-ref <staging-project-ref> \
  --no-verify-jwt
```

**Step 5: Create staging API key**

```sql
-- Connect to staging database
INSERT INTO artikel.api_keys (site_id, user_id, name, key_hash, is_active, expires_at)
VALUES (
  '<staging-site-id>',
  '<staging-user-id>',
  'Staging Test Key',
  encode(digest('staging-key-' || gen_random_uuid()::text, 'sha256'), 'hex'),
  true,
  NOW() + INTERVAL '7 days'
);
```

**Step 6: Run smoke tests**

```bash
# Set staging environment
export SUPABASE_URL="https://<staging-project-ref>.supabase.co"
export TEST_API_KEY="<staging-api-key>"

# Run basic smoke test
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "smoke-test-001",
      "title": "Smoke Test Article",
      "slug": "smoke-test-article",
      "content": "<p>Smoke test</p>",
      "category": "Testing"
    }
  }'
```

**Expected response:**
```json
{
  "data": {
    "article_id": "...",
    "revision_id": "...",
    "created": true,
    "category_id": "...",
    "message": "Article created successfully"
  },
  "timestamp": "..."
}
```

**Success criteria:**
- Migrations applied without errors
- Edge function deployed successfully
- Smoke test returns 200 with article_id

---

### Phase 3: User Acceptance Testing (1 hour)

**UAT Scenario 1: Create new article via API**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-001",
      "title": "UAT Test Article 1",
      "slug": "uat-test-article-1",
      "content": "<h1>UAT Test</h1><p>This is a UAT test article.</p>",
      "excerpt": "UAT test excerpt",
      "category": "UAT Testing",
      "status": "draft",
      "featured_image": "https://example.com/image.jpg",
      "meta_description": "UAT test meta description",
      "meta_keywords": ["uat", "testing", "automation"]
    }
  }'
```

**Manual verification:**
1. Open CMS admin panel
2. Navigate to Articles list
3. Verify "UAT Test Article 1" appears with:
   - Title: "UAT Test Article 1"
   - Status: Draft
   - Category: "UAT Testing" (auto-created)
   - Featured image displayed
4. Open article detail
5. Verify content renders correctly
6. Verify revision #1 exists in revision history

**UAT Scenario 2: Update existing article (idempotency)**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-001",
      "title": "UAT Test Article 1 (Updated)",
      "slug": "uat-test-article-1-updated",
      "content": "<h1>UAT Test Updated</h1><p>This article has been updated.</p>",
      "excerpt": "Updated excerpt",
      "category": "UAT Testing",
      "status": "published",
      "published_at": "2026-09-10T12:00:00Z"
    }
  }'
```

**Manual verification:**
1. Refresh article list
2. Verify only ONE article with external_id "uat-001"
3. Verify updated title: "UAT Test Article 1 (Updated)"
4. Verify status changed to: Published
5. Verify slug updated
6. Verify revision #2 exists in revision history
7. Verify published timestamp set correctly

**UAT Scenario 3: Slug conflict handling**

```bash
# First create article with slug
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-002",
      "title": "Slug Test A",
      "slug": "slug-conflict-test",
      "content": "<p>Article A</p>",
      "category": "Testing"
    }
  }'

# Try to create different article with same slug (should fail)
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-003",
      "title": "Slug Test B",
      "slug": "slug-conflict-test",
      "content": "<p>Article B</p>",
      "category": "Testing"
    }
  }'
```

**Expected error response:**
```json
{
  "error": {
    "message": "Slug already exists for another article",
    "code": "SLUG_CONFLICT",
    "timestamp": "..."
  }
}
```

**Manual verification:**
1. Verify only ONE article with slug "slug-conflict-test"
2. Verify second article was NOT created

**UAT Scenario 4: Category reuse**

```bash
# Create first article
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-004",
      "title": "Category Test 1",
      "slug": "category-test-1",
      "content": "<p>Test 1</p>",
      "category": "Shared Category"
    }
  }'

# Create second article with same category
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $TEST_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "uat-005",
      "title": "Category Test 2",
      "slug": "category-test-2",
      "content": "<p>Test 2</p>",
      "category": "Shared Category"
    }
  }'
```

**Manual verification:**
1. Open Categories list
2. Verify only ONE category named "Shared Category"
3. Verify both articles belong to same category
4. Click category to see both articles listed

**UAT Sign-off:**

- [ ] Scenario 1: Article creation verified
- [ ] Scenario 2: Article update verified
- [ ] Scenario 3: Slug conflict handling verified
- [ ] Scenario 4: Category reuse verified
- [ ] No errors in Supabase logs
- [ ] Response times < 500ms (p95)

---

### Phase 4: Production Deployment (30 minutes)

**Step 1: Tag release**

```bash
git tag -a v1.1.0-automation-api -m "Release: Automation API for article management"
git push origin v1.1.0-automation-api
```

**Step 2: Apply migrations to production**

```bash
# SSH to server
ssh maskhar@supabase-server
cd ~/docker/supabase/supabase-1.26.05/docker

# Backup database first
docker exec supabase-db pg_dump -U postgres -d postgres -n artikel > \
  ~/backups/artikel_schema_$(date +%Y%m%d_%H%M%S).sql

# Apply migrations
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100013_add_external_id_to_articles.sql
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100014_create_upsert_automation_article_function.sql
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/202609100015_add_automation_api_rls_policies.sql
```

**Step 3: Deploy Edge Function**

```bash
# From local machine
supabase functions deploy artikel-cms \
  --project-ref <production-project-ref> \
  --no-verify-jwt
```

**Step 4: Create production API keys**

```sql
-- For each client site, create dedicated API key
INSERT INTO artikel.api_keys (site_id, user_id, name, key_hash, is_active)
VALUES (
  '<client-site-id>',
  '<automation-user-id>',
  'Production API Key - Site XYZ',
  encode(digest('<generate-secure-random-key>', 'sha256'), 'hex'),
  true
);
```

**Step 5: Monitor initial traffic**

```bash
# Watch function logs
supabase functions logs artikel-cms --follow

# Watch database logs
docker logs -f supabase-db | grep artikel
```

**Step 6: Verify metrics**

```sql
-- Check API usage
SELECT 
  ak.name,
  COUNT(*) as request_count,
  MAX(ak.last_used_at) as last_request
FROM artikel.api_keys ak
WHERE ak.last_used_at > NOW() - INTERVAL '1 hour'
GROUP BY ak.name;

-- Check article creation stats
SELECT 
  COUNT(*) as total_articles,
  COUNT(DISTINCT external_id) as unique_external_ids,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as created_last_hour
FROM artikel.articles
WHERE external_id IS NOT NULL;
```

**Success criteria:**
- Migrations applied successfully
- Edge function deployed without errors
- API keys created and distributed
- First production API call succeeds
- Response times < 500ms (p95)
- No error spikes in logs

---

## Rollback Plan

**If critical issues occur in production:**

**Step 1: Disable Edge Function**

```bash
# Unpublish function (prevent new requests)
supabase functions delete artikel-cms --project-ref <production-project-ref>
```

**Step 2: Revert database changes**

```sql
-- Drop RLS policies
DROP POLICY IF EXISTS automation_api_insert_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_update_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_select_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_insert_revisions ON artikel.article_revisions;
DROP POLICY IF EXISTS automation_api_insert_categories ON artikel.categories;
DROP POLICY IF EXISTS automation_api_select_categories ON artikel.categories;

-- Drop function
DROP FUNCTION IF EXISTS artikel.upsert_automation_article;

-- Drop column (if no data written yet)
ALTER TABLE artikel.articles DROP COLUMN IF EXISTS external_id;

-- Drop index
DROP INDEX IF EXISTS artikel.idx_articles_external_id_site;
```

**Step 3: Restore from backup (if needed)**

```bash
ssh maskhar@supabase-server

# Restore schema backup
docker exec -i supabase-db psql -U postgres -d postgres < \
  ~/backups/artikel_schema_<timestamp>.sql
```

**Step 4: Git revert**

```bash
git revert <commit-hash>
git push origin main
```

**Step 5: Postmortem**

Document in `docs/POSTMORTEM-<date>.md`:
- What went wrong
- Root cause analysis
- Impact assessment
- Preventive measures
- Lessons learned

---

## Monitoring & Alerts

**Key metrics to watch:**

1. **Response time** (p50, p95, p99)
2. **Error rate** (4xx, 5xx)
3. **Request rate** (per minute, per hour)
4. **Database function execution time**
5. **API key usage patterns**

**Set up alerts for:**

- Response time p95 > 1000ms
- Error rate > 5%
- Rate limit hits > 100/hour
- Database function errors

---

## Documentation Updates

After successful production deployment:

1. Update `README.md` with API endpoint
2. Update `PANDUAN-PENGGUNAAN.md` with automation examples
3. Create API client examples (curl, JavaScript, Python)
4. Update changelog
5. Notify stakeholders via email/Slack

---

## Success Metrics (First Week)

- [ ] Zero critical errors
- [ ] Response time p95 < 500ms
- [ ] Error rate < 1%
- [ ] 100% test coverage maintained
- [ ] At least 5 client sites onboarded
- [ ] Positive feedback from UAT users

---

**Deployment Lead:** maskhar  
**Approved By:** _______________  
**Date:** 2026-09-10
