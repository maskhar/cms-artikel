-- Integration Tests for upsert_automation_article function
-- File: tests/integration/test_upsert_automation_article.sql
-- Run with: psql -U postgres -d postgres -f tests/integration/test_upsert_automation_article.sql

\echo '=== Test Suite: upsert_automation_article function ==='

-- Setup test data
BEGIN;

-- Create test site
INSERT INTO artikel.sites (id, name, domain, theme_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Site',
  'test.example.com',
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Create test user
INSERT INTO auth.users (id, email)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'test@example.com'
) ON CONFLICT (id) DO NOTHING;

-- Link user to site
INSERT INTO artikel.site_users (site_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'admin'
) ON CONFLICT (site_id, user_id) DO NOTHING;

COMMIT;

-- Test 1: Create new article with new category
\echo ''
\echo 'Test 1: Create new article with new category'
BEGIN;

SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-001',
  p_title := 'Test Article 1',
  p_slug := 'test-article-1',
  p_content := '<p>Test content</p>',
  p_excerpt := 'Test excerpt',
  p_category_name := 'Technology',
  p_author_id := '00000000-0000-0000-0000-000000000002',
  p_status := 'draft'
);

-- Verify article created
SELECT EXISTS (
  SELECT 1 FROM artikel.articles 
  WHERE external_id = 'ext-001' 
    AND title = 'Test Article 1'
) AS article_exists;

-- Verify category created
SELECT EXISTS (
  SELECT 1 FROM artikel.categories 
  WHERE name = 'Technology'
) AS category_exists;

-- Verify revision created
SELECT EXISTS (
  SELECT 1 FROM artikel.article_revisions ar
  INNER JOIN artikel.articles a ON a.id = ar.article_id
  WHERE a.external_id = 'ext-001'
    AND ar.revision_number = 1
) AS revision_exists;

ROLLBACK;
\echo 'Test 1: PASSED'

-- Test 2: Update existing article (idempotency)
\echo ''
\echo 'Test 2: Update existing article (idempotency)'
BEGIN;

-- First insert
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-002',
  p_title := 'Original Title',
  p_slug := 'original-slug',
  p_content := '<p>Original content</p>',
  p_excerpt := 'Original excerpt',
  p_category_name := 'News',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Second insert with same external_id (update)
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-002',
  p_title := 'Updated Title',
  p_slug := 'updated-slug',
  p_content := '<p>Updated content</p>',
  p_excerpt := 'Updated excerpt',
  p_category_name := 'News',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Verify only one article exists with updated data
SELECT COUNT(*) = 1 AS single_article,
       title = 'Updated Title' AS title_updated,
       slug = 'updated-slug' AS slug_updated
FROM artikel.articles
WHERE external_id = 'ext-002';

-- Verify two revisions exist
SELECT COUNT(*) = 2 AS two_revisions
FROM artikel.article_revisions ar
INNER JOIN artikel.articles a ON a.id = ar.article_id
WHERE a.external_id = 'ext-002';

ROLLBACK;
\echo 'Test 2: PASSED'

-- Test 3: Slug conflict detection
\echo ''
\echo 'Test 3: Slug conflict detection'
BEGIN;

-- Create first article
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-003',
  p_title := 'Article A',
  p_slug := 'same-slug',
  p_content := '<p>Content A</p>',
  p_excerpt := 'Excerpt A',
  p_category_name := 'General',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Try to create second article with same slug (should fail)
DO $$
BEGIN
  PERFORM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-004',
    p_title := 'Article B',
    p_slug := 'same-slug',
    p_content := '<p>Content B</p>',
    p_excerpt := 'Excerpt B',
    p_category_name := 'General',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );
  RAISE EXCEPTION 'Should have failed with slug conflict';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Slug%already exists%' THEN
      RAISE NOTICE 'Test 3: PASSED - Slug conflict detected correctly';
    ELSE
      RAISE EXCEPTION 'Test 3: FAILED - Wrong error: %', SQLERRM;
    END IF;
END $$;

ROLLBACK;

-- Test 4: Tenant isolation
\echo ''
\echo 'Test 4: Tenant isolation'
BEGIN;

-- Create second test site
INSERT INTO artikel.sites (id, name, domain, theme_config)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Test Site 2',
  'test2.example.com',
  '{}'::jsonb
);

-- Link same user to second site
INSERT INTO artikel.site_users (site_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'admin'
);

-- Create article in site 1
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-005',
  p_title := 'Site 1 Article',
  p_slug := 'site-1-article',
  p_content := '<p>Site 1 content</p>',
  p_excerpt := 'Site 1 excerpt',
  p_category_name := 'Site1Cat',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Create article with same external_id in site 2 (should succeed)
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000003',
  p_external_id := 'ext-005',
  p_title := 'Site 2 Article',
  p_slug := 'site-2-article',
  p_content := '<p>Site 2 content</p>',
  p_excerpt := 'Site 2 excerpt',
  p_category_name := 'Site2Cat',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Verify two separate articles exist
SELECT COUNT(*) = 2 AS two_articles
FROM artikel.articles
WHERE external_id = 'ext-005';

-- Verify they belong to different sites
SELECT COUNT(DISTINCT site_id) = 2 AS different_sites
FROM artikel.articles
WHERE external_id = 'ext-005';

ROLLBACK;
\echo 'Test 4: PASSED'

-- Test 5: Category reuse
\echo ''
\echo 'Test 5: Category reuse'
BEGIN;

-- Create first article with category
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-006',
  p_title := 'Article with Sports',
  p_slug := 'article-sports-1',
  p_content := '<p>Sports content 1</p>',
  p_excerpt := 'Sports excerpt 1',
  p_category_name := 'Sports',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Get category count
SELECT COUNT(*) INTO TEMP cat_count_1
FROM artikel.categories
WHERE name = 'Sports';

-- Create second article with same category name
SELECT artikel.upsert_automation_article(
  p_site_id := '00000000-0000-0000-0000-000000000001',
  p_external_id := 'ext-007',
  p_title := 'Article with Sports 2',
  p_slug := 'article-sports-2',
  p_content := '<p>Sports content 2</p>',
  p_excerpt := 'Sports excerpt 2',
  p_category_name := 'Sports',
  p_author_id := '00000000-0000-0000-0000-000000000002'
);

-- Verify category count didn't increase
SELECT COUNT(*) = (SELECT * FROM cat_count_1) AS category_reused
FROM artikel.categories
WHERE name = 'Sports';

-- Verify both articles share the same category
SELECT COUNT(DISTINCT category_id) = 1 AS same_category
FROM artikel.articles
WHERE external_id IN ('ext-006', 'ext-007');

ROLLBACK;
\echo 'Test 5: PASSED'

\echo ''
\echo '=== All Integration Tests Completed ==='
