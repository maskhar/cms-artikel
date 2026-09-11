-- Migration: Create upsert_automation_article function
-- File: 202609100014_create_upsert_automation_article_function.sql
-- Purpose: Atomic upsert operation for automation API with category resolution

CREATE OR REPLACE FUNCTION artikel.upsert_automation_article(
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
)
RETURNS TABLE (
  article_id UUID,
  revision_id UUID,
  created_new BOOLEAN,
  category_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = artikel, public
AS $$
DECLARE
  v_article_id UUID;
  v_revision_id UUID;
  v_category_id UUID;
  v_created_new BOOLEAN := FALSE;
  v_revision_number INTEGER;
  v_existing_slug_article_id UUID;
BEGIN
  -- Validate site_id exists
  IF NOT EXISTS (SELECT 1 FROM artikel.sites WHERE id = p_site_id) THEN
    RAISE EXCEPTION 'Site ID % does not exist', p_site_id;
  END IF;

  -- Validate author belongs to site
  IF NOT EXISTS (
    SELECT 1 FROM artikel.site_users 
    WHERE site_id = p_site_id AND user_id = p_author_id
  ) THEN
    RAISE EXCEPTION 'Author % does not belong to site %', p_author_id, p_site_id;
  END IF;

  -- Resolve or create category
  SELECT id INTO v_category_id
  FROM artikel.categories
  WHERE site_id = p_site_id 
    AND LOWER(name) = LOWER(p_category_name);

  IF v_category_id IS NULL THEN
    INSERT INTO artikel.categories (site_id, name, slug)
    VALUES (
      p_site_id,
      p_category_name,
      regexp_replace(lower(p_category_name), '[^a-z0-9]+', '-', 'g')
    )
    RETURNING id INTO v_category_id;
  END IF;

  -- Check for existing article by external_id
  SELECT id INTO v_article_id
  FROM artikel.articles
  WHERE site_id = p_site_id 
    AND external_id = p_external_id;

  -- If external_id not found, check slug conflict
  IF v_article_id IS NULL THEN
    SELECT id INTO v_existing_slug_article_id
    FROM artikel.articles
    WHERE site_id = p_site_id 
      AND slug = p_slug;

    IF v_existing_slug_article_id IS NOT NULL THEN
      RAISE EXCEPTION 'Slug % already exists for another article in site %', p_slug, p_site_id;
    END IF;
  END IF;

  -- Upsert article
  IF v_article_id IS NULL THEN
    -- Insert new article
    INSERT INTO artikel.articles (
      site_id,
      external_id,
      title,
      slug,
      content,
      excerpt,
      category_id,
      author_id,
      status,
      featured_image,
      meta_description,
      meta_keywords,
      published_at
    )
    VALUES (
      p_site_id,
      p_external_id,
      p_title,
      p_slug,
      p_content,
      p_excerpt,
      v_category_id,
      p_author_id,
      p_status,
      p_featured_image,
      p_meta_description,
      p_meta_keywords,
      p_published_at
    )
    RETURNING id INTO v_article_id;
    
    v_created_new := TRUE;
    v_revision_number := 1;
  ELSE
    -- Update existing article
    UPDATE artikel.articles
    SET
      title = p_title,
      slug = p_slug,
      content = p_content,
      excerpt = p_excerpt,
      category_id = v_category_id,
      status = p_status,
      featured_image = p_featured_image,
      meta_description = p_meta_description,
      meta_keywords = p_meta_keywords,
      published_at = p_published_at,
      updated_at = NOW()
    WHERE id = v_article_id;

    -- Get next revision number
    SELECT COALESCE(MAX(revision_number), 0) + 1 
    INTO v_revision_number
    FROM artikel.article_revisions
    WHERE article_id = v_article_id;
  END IF;

  -- Create revision record
  INSERT INTO artikel.article_revisions (
    article_id,
    revision_number,
    title,
    content,
    excerpt,
    author_id,
    change_summary
  )
  VALUES (
    v_article_id,
    v_revision_number,
    p_title,
    p_content,
    p_excerpt,
    p_author_id,
    CASE 
      WHEN v_created_new THEN 'Initial version created via automation API'
      ELSE 'Updated via automation API'
    END
  )
  RETURNING id INTO v_revision_id;

  -- Return results
  RETURN QUERY SELECT 
    v_article_id,
    v_revision_id,
    v_created_new,
    v_category_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION artikel.upsert_automation_article TO authenticated;

-- Add function comment
COMMENT ON FUNCTION artikel.upsert_automation_article IS 
'Atomic upsert operation for automation API. Creates or updates article by external_id, resolves category, and creates revision. Enforces tenant isolation and slug uniqueness.';
