-- Migration: Create upsert_automation_article function
-- File: 202609100020_create_upsert_automation_article_function.sql
-- Purpose: Atomic upsert operation for automation API with category resolution
--
-- Versi pertama file ini tidak pernah bisa dieksekusi sampai selesai. Diperbaiki
-- 28 September 2026 setelah audit akurasi dokumentasi API. Empat kesalahan yang
-- membuat setiap POST Automation API mengembalikan 500:
--
--   1. Cek keanggotaan penulis membaca artikel.site_users. Tabel itu tidak pernah
--      dibuat migrasi mana pun. Tabel peran yang nyata adalah artikel.user_roles
--      (user_id, site_id, role, is_active), dengan site_id NULL berarti admin global.
--   2. Menulis kolom artikel.articles.featured_image. Nama kolom yang nyata
--      featured_image_path.
--   3. Menulis kolom artikel.articles.meta_keywords. Kolom itu tidak ada. Kolom SEO
--      yang nyata: seo_title, meta_description, canonical_url, robots, og_image_path.
--   4. Menyisipkan artikel.article_revisions dengan kolom revision_number, title,
--      content, excerpt, author_id, change_summary. Kolom yang nyata: version,
--      snapshot (jsonb, NOT NULL, tidak pernah diisi versi lama), change_note,
--      created_by.
--
-- Signature fungsi sengaja dipertahankan persis seperti semula supaya CREATE OR
-- REPLACE tidak membuat overload baru dan Edge Function automation-api yang sudah
-- ter-deploy tetap cocok tanpa perubahan. Konsekuensinya p_meta_keywords tetap
-- diterima tetapi tidak disimpan di mana pun, karena tidak ada kolom tujuannya.
-- Ini didokumentasikan di docs/API.md dan di halaman /api-docs, bukan dibuang diam-diam.

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
SET search_path = ''
AS $$
DECLARE
  v_article_id UUID;
  v_revision_id UUID;
  v_category_id UUID;
  v_created_new BOOLEAN := FALSE;
  v_version INTEGER;
  v_category_slug TEXT;
  v_published_at TIMESTAMPTZ;
  v_existing_slug_article_id UUID;
BEGIN
  IF p_author_id IS NULL THEN
    RAISE EXCEPTION 'Author is required' USING ERRCODE = '22023';
  END IF;

  -- Trigger artikel.validate_article_write menurunkan identitas aktor dari
  -- auth.uid(), yang selalu NULL di jalur service_role. Tanpa baris ini, setiap
  -- tulisan berstatus selain 'draft' ditolak trigger. Parameter true membuat
  -- setting ini lokal transaksi sehingga hilang sendiri saat commit/rollback.
  -- Lihat 202609280001_automation_article_actor.sql.
  PERFORM set_config('artikel.automation_actor', p_author_id::text, true);

  -- Site harus ada dan aktif. Site nonaktif tidak boleh menerima tulisan otomasi.
  IF NOT EXISTS (
    SELECT 1 FROM artikel.sites WHERE id = p_site_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Site % does not exist or is inactive', p_site_id
      USING ERRCODE = '42501';
  END IF;

  -- Penulis harus punya peran aktif di site tersebut, atau admin global
  -- (user_roles.site_id NULL + role admin). auth.uid() tidak dipakai di sini:
  -- fungsi ini selalu dipanggil lewat service_role sehingga auth.uid() NULL.
  IF NOT EXISTS (
    SELECT 1 FROM artikel.user_roles
    WHERE user_id = p_author_id
      AND is_active
      AND (site_id = p_site_id OR (site_id IS NULL AND role = 'admin'))
  ) THEN
    RAISE EXCEPTION 'Author % is not an active member of site %', p_author_id, p_site_id
      USING ERRCODE = '42501';
  END IF;

  -- artikel.articles punya CHECK: status published wajib punya published_at.
  IF p_status = 'published' THEN
    v_published_at := COALESCE(p_published_at, now());
  ELSE
    v_published_at := p_published_at;
  END IF;

  -- Resolve atau buat kategori.
  SELECT id INTO v_category_id
  FROM artikel.categories
  WHERE site_id = p_site_id
    AND lower(name) = lower(p_category_name);

  IF v_category_id IS NULL THEN
    v_category_slug := trim(both '-' from
      regexp_replace(lower(p_category_name), '[^a-z0-9]+', '-', 'g'));

    IF v_category_slug = '' THEN
      RAISE EXCEPTION 'Category name % does not produce a usable slug', p_category_name
        USING ERRCODE = '22023';
    END IF;

    -- Nama beda tapi slug sama (mis. "Tips & Trik" vs "Tips Trik") akan menabrak
    -- unique(site_id, slug). Pakai kategori yang sudah ada, jangan gagal.
    INSERT INTO artikel.categories (site_id, name, slug)
    VALUES (p_site_id, p_category_name, v_category_slug)
    ON CONFLICT (site_id, slug) DO UPDATE SET slug = artikel.categories.slug
    RETURNING id INTO v_category_id;
  END IF;

  -- Cari artikel lama berdasarkan external_id.
  SELECT id INTO v_article_id
  FROM artikel.articles
  WHERE site_id = p_site_id
    AND external_id = p_external_id;

  IF v_article_id IS NULL THEN
    SELECT id INTO v_existing_slug_article_id
    FROM artikel.articles
    WHERE site_id = p_site_id
      AND slug = p_slug;

    IF v_existing_slug_article_id IS NOT NULL THEN
      RAISE EXCEPTION 'Slug % already exists for another article in site %', p_slug, p_site_id
        USING ERRCODE = '23505';
    END IF;

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
      featured_image_path,
      meta_description,
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
      v_published_at
    )
    RETURNING id INTO v_article_id;

    v_created_new := TRUE;
  ELSE
    -- Slug boleh berubah, tapi tidak boleh menabrak artikel lain di site yang sama.
    SELECT id INTO v_existing_slug_article_id
    FROM artikel.articles
    WHERE site_id = p_site_id
      AND slug = p_slug
      AND id <> v_article_id;

    IF v_existing_slug_article_id IS NOT NULL THEN
      RAISE EXCEPTION 'Slug % already exists for another article in site %', p_slug, p_site_id
        USING ERRCODE = '23505';
    END IF;

    UPDATE artikel.articles
    SET
      title = p_title,
      slug = p_slug,
      content = p_content,
      excerpt = p_excerpt,
      category_id = v_category_id,
      status = p_status,
      featured_image_path = p_featured_image,
      meta_description = p_meta_description,
      published_at = v_published_at,
      updated_at = now()
    WHERE id = v_article_id;
  END IF;

  -- Revisi ditulis manual di sini karena trigger artikel.capture_article_revision
  -- berhenti lebih awal saat auth.uid() NULL, dan jalur otomasi selalu service_role.
  -- Bentuk snapshot disamakan dengan trigger tersebut supaya UI riwayat membaca
  -- kunci yang sama untuk revisi dari CMS maupun dari otomasi.
  -- Kolom dikualifikasi dengan alias: nama kolom OUT pada RETURNS TABLE
  -- (article_id) ada di scope yang sama, jadi WHERE article_id = ... ambigu dan
  -- ditolak PL/pgSQL saat runtime.
  SELECT COALESCE(max(ar.version), 0) + 1
  INTO v_version
  FROM artikel.article_revisions ar
  WHERE ar.article_id = v_article_id;

  INSERT INTO artikel.article_revisions (
    article_id,
    version,
    snapshot,
    change_note,
    created_by
  )
  VALUES (
    v_article_id,
    v_version,
    jsonb_build_object(
      'title', p_title,
      'slug', p_slug,
      'excerpt', p_excerpt,
      'content', p_content,
      'seo_title', NULL,
      'meta_description', p_meta_description,
      'status', p_status
    ),
    CASE
      WHEN v_created_new THEN 'Dibuat lewat Automation API'
      ELSE 'Diperbarui lewat Automation API'
    END,
    p_author_id
  )
  RETURNING id INTO v_revision_id;

  RETURN QUERY SELECT
    v_article_id,
    v_revision_id,
    v_created_new,
    v_category_id;
END;
$$;

-- Fungsi ini SECURITY DEFINER dan melewati RLS. Hanya jalur Edge Function yang
-- memegang service_role key yang boleh memanggilnya; user CMS biasa harus lewat
-- /api/cms/articles yang tunduk RLS.
REVOKE EXECUTE ON FUNCTION artikel.upsert_automation_article(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  artikel.article_status, TEXT, TEXT, TEXT[], TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION artikel.upsert_automation_article(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  artikel.article_status, TEXT, TEXT, TEXT[], TIMESTAMPTZ
) TO service_role;

COMMENT ON FUNCTION artikel.upsert_automation_article(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  artikel.article_status, TEXT, TEXT, TEXT[], TIMESTAMPTZ
) IS
'Upsert atomik untuk Automation API. Mencocokkan artikel lewat (site_id, external_id), me-resolve atau membuat kategori, dan menulis satu revisi. Penulis wajib punya peran aktif di site. Hanya service_role yang boleh memanggil. Parameter p_meta_keywords diterima demi kompatibilitas signature tetapi tidak disimpan: artikel.articles tidak punya kolom untuk itu.';
