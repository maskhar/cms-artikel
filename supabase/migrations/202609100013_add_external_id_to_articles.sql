-- Migration: Add external_id column for automation API
-- File: 202609100013_add_external_id_to_articles.sql
-- Purpose: Enable idempotent article creation via external system IDs

-- Add external_id column to articles table
ALTER TABLE artikel.articles 
ADD COLUMN external_id TEXT;

-- Create unique index for external_id scoped by site_id
CREATE UNIQUE INDEX idx_articles_external_id_site 
ON artikel.articles (site_id, external_id) 
WHERE external_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN artikel.articles.external_id IS 
'External system identifier for automation API. Must be unique within site_id scope. Used for idempotent upsert operations.';
