# Quick Reference: Automation API Development

## Repository Status

**Branch:** `feature/automation-api`  
**Commits:** 2 new commits (d05a71e, cd416bb)  
**Status:** Ready for testing

## File Structure

```
cms-artikel/
├── supabase/
│   ├── functions/
│   │   └── artikel-cms/
│   │       └── index.ts                 # Edge Function (450 lines)
│   └── migrations/
│       ├── 202609100013_*.sql           # Add external_id column
│       ├── 202609100014_*.sql           # Create upsert function
│       └── 202609100015_*.sql           # Add RLS policies
├── tests/
│   ├── README.md                        # Test documentation
│   ├── integration/
│   │   └── test_upsert_*.sql           # 5 SQL tests
│   └── e2e/
│       ├── test_automation_api.sh      # Bash E2E tests
│       └── test_automation_api.ps1     # PowerShell E2E tests
├── examples/
│   ├── README.md                        # Client documentation
│   ├── nodejs-client.js                # Node.js example
│   ├── python-client.py                # Python example
│   └── php-client.php                  # PHP example
├── docs/
│   ├── AUTOMATION-API-SUMMARY.md       # Feature summary
│   ├── DEPLOYMENT-AUTOMATION-API.md    # Deployment guide
│   └── UNIFIED-CMS-API-DESIGN.md       # API contract
└── CHANGELOG.md                        # Version history
```

## Quick Commands

### Local Development

```bash
# Start local Supabase
supabase start

# Apply migrations
cd supabase/migrations
psql -h localhost -U postgres -d postgres -f 202609100013_*.sql
psql -h localhost -U postgres -d postgres -f 202609100014_*.sql
psql -h localhost -U postgres -d postgres -f 202609100015_*.sql

# Deploy Edge Function
supabase functions deploy artikel-cms --no-verify-jwt

# Run integration tests
psql -h localhost -U postgres -d postgres -f tests/integration/test_upsert_automation_article.sql

# Run E2E tests
export SUPABASE_URL="http://localhost:54321"
export TEST_API_KEY="test-key-local-123"
pwsh tests/e2e/test_automation_api.ps1
```

### SSH to Server

```bash
# Connect
ssh maskhar@supabase-server
# or
ssh maskhar@20.20.20.173

# Docker directory
cd ~/docker/supabase/supabase-1.26.05/docker

# View containers
docker ps

# PostgreSQL shell
docker exec -it supabase-db psql -U postgres -d postgres

# View logs
docker logs -f supabase-db
```

### Testing API

```bash
# Set variables
export SUPABASE_URL="https://your-project.supabase.co"
export ARTIKEL_API_KEY="your-api-key"

# Create article
curl -X POST "$SUPABASE_URL/functions/v1/artikel-cms" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $ARTIKEL_API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-001",
      "title": "Test Article",
      "slug": "test-article",
      "content": "<p>Content</p>",
      "category": "Testing",
      "status": "draft"
    }
  }'

# Expected response
{
  "data": {
    "article_id": "uuid",
    "revision_id": "uuid",
    "created": true,
    "category_id": "uuid",
    "message": "Article created successfully"
  },
  "timestamp": "2026-09-10T..."
}
```

### Git Workflow

```bash
# Current branch
git branch
# * feature/automation-api

# View changes
git log --oneline -5

# Push to remote
git push origin feature/automation-api

# Create PR
gh pr create --title "feat: Automation API" \
  --body "Implementation of automation API for article management. See docs/AUTOMATION-API-SUMMARY.md for details."

# Merge to main (after review)
git checkout main
git merge feature/automation-api
git push origin main
```

## API Reference

### Endpoint

```
POST /functions/v1/artikel-cms
```

### Headers

```
Content-Type: application/json
x-artikel-key: <your-api-key>
```

### Request Body

```json
{
  "action": "article.upsert",
  "data": {
    "external_id": "string (required)",
    "title": "string (required)",
    "slug": "string (required, lowercase, alphanumeric + hyphens)",
    "content": "string (required, HTML)",
    "excerpt": "string (optional)",
    "category": "string (required)",
    "status": "draft|published|archived (default: draft)",
    "featured_image": "string (optional, URL)",
    "meta_description": "string (optional)",
    "meta_keywords": "array of strings (optional)",
    "published_at": "string (optional, ISO 8601)"
  }
}
```

### Response (Success)

```json
{
  "data": {
    "article_id": "uuid",
    "revision_id": "uuid",
    "created": true|false,
    "category_id": "uuid",
    "message": "string"
  },
  "timestamp": "ISO 8601"
}
```

### Response (Error)

```json
{
  "error": {
    "message": "string",
    "code": "ERROR_CODE",
    "timestamp": "ISO 8601"
  }
}
```

### Error Codes

- `VALIDATION_ERROR` (400) - Invalid request data
- `MISSING_API_KEY` (401) - API key header missing
- `INVALID_API_KEY` (401) - API key invalid/expired
- `NOT_FOUND` (404) - Resource not found
- `SLUG_CONFLICT` (409) - Slug already exists
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `DATABASE_ERROR` (500) - Database operation failed
- `INTERNAL_ERROR` (500) - Server error

## Database Schema

### external_id Column

```sql
-- Added to artikel.articles
external_id TEXT NULL

-- Unique constraint per site
CREATE UNIQUE INDEX idx_articles_external_id_site 
ON artikel.articles (site_id, external_id) 
WHERE external_id IS NOT NULL;
```

### Function Signature

```sql
artikel.upsert_automation_article(
  p_site_id UUID,
  p_external_id TEXT,
  p_title TEXT,
  p_slug TEXT,
  p_content TEXT,
  p_excerpt TEXT,
  p_category_name TEXT,
  p_author_id UUID,
  p_status artikel.article_status DEFAULT 'draft',
  p_featured_image TEXT DEFAULT NULL,
  p_meta_description TEXT DEFAULT NULL,
  p_meta_keywords TEXT[] DEFAULT NULL,
  p_published_at TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  article_id UUID,
  revision_id UUID,
  created_new BOOLEAN,
  category_id UUID
)
```

## Next Steps

### Before Testing
1. ✅ Code implementation complete
2. ⏳ Run local tests
3. ⏳ Deploy to staging
4. ⏳ Run UAT scenarios
5. ⏳ Deploy to production

### Testing Checklist
- [ ] Integration tests pass (5/5)
- [ ] E2E tests pass (7/7)
- [ ] Create article via API
- [ ] Update article via same external_id
- [ ] Slug conflict detected
- [ ] Category auto-created and reused
- [ ] Rate limiting works
- [ ] Invalid API key rejected
- [ ] Response time < 500ms

### Deployment Checklist
- [ ] Backup production database
- [ ] Apply migrations in order (13, 14, 15)
- [ ] Deploy Edge Function
- [ ] Create production API keys
- [ ] Test with production data
- [ ] Monitor error rates
- [ ] Update documentation with production URL

## Documentation Links

- **Feature Summary:** `docs/AUTOMATION-API-SUMMARY.md`
- **Deployment Guide:** `docs/DEPLOYMENT-AUTOMATION-API.md`
- **Test Guide:** `tests/README.md`
- **Client Examples:** `examples/README.md`
- **API Design:** `docs/UNIFIED-CMS-API-DESIGN.md`
- **Changelog:** `CHANGELOG.md`

## Support

**Issues:** Check error code and message  
**Logs:** `supabase functions logs artikel-cms`  
**Database:** `docker exec -it supabase-db psql -U postgres`

---

**Last Updated:** 2026-09-10  
**Version:** 1.1.0  
**Branch:** feature/automation-api
