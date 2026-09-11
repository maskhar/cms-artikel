-- Migration: Add RLS policies for automation API access
-- File: 202609100015_add_automation_api_rls_policies.sql
-- Purpose: Enable API key authenticated users to manage articles within their site scope

-- Add policy for automation API to insert articles
CREATE POLICY automation_api_insert_articles
ON artikel.articles
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = articles.site_id
      AND user_id = auth.uid()
  )
);

-- Add policy for automation API to update articles
CREATE POLICY automation_api_update_articles
ON artikel.articles
FOR UPDATE
TO authenticated
USING (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = articles.site_id
      AND user_id = auth.uid()
  )
)
WITH CHECK (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = articles.site_id
      AND user_id = auth.uid()
  )
);

-- Add policy for automation API to select articles (for verification)
CREATE POLICY automation_api_select_articles
ON artikel.articles
FOR SELECT
TO authenticated
USING (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = articles.site_id
      AND user_id = auth.uid()
  )
);

-- Add policy for automation API to insert article revisions
CREATE POLICY automation_api_insert_revisions
ON artikel.article_revisions
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must belong to the site that owns the article
  EXISTS (
    SELECT 1 FROM artikel.articles a
    INNER JOIN artikel.site_users su ON su.site_id = a.site_id
    WHERE a.id = article_revisions.article_id
      AND su.user_id = auth.uid()
  )
);

-- Add policy for automation API to insert/update categories
CREATE POLICY automation_api_insert_categories
ON artikel.categories
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = categories.site_id
      AND user_id = auth.uid()
  )
);

CREATE POLICY automation_api_select_categories
ON artikel.categories
FOR SELECT
TO authenticated
USING (
  -- User must belong to the site
  EXISTS (
    SELECT 1 FROM artikel.site_users
    WHERE site_id = categories.site_id
      AND user_id = auth.uid()
  )
);

-- Add comments for documentation
COMMENT ON POLICY automation_api_insert_articles ON artikel.articles IS 
'Allows authenticated automation API users to insert articles within their site scope';

COMMENT ON POLICY automation_api_update_articles ON artikel.articles IS 
'Allows authenticated automation API users to update articles within their site scope';

COMMENT ON POLICY automation_api_select_articles ON artikel.articles IS 
'Allows authenticated automation API users to read articles within their site scope';
