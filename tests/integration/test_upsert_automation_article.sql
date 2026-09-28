-- Integration Tests for upsert_automation_article function
-- File: tests/integration/test_upsert_automation_article.sql
-- Run with: psql -U postgres -d postgres -f tests/integration/test_upsert_automation_article.sql
--
-- Ditulis ulang 28 September 2026. Versi sebelumnya tidak bisa dijalankan sama
-- sekali: setup-nya memakai artikel.site_users (tabel yang tidak pernah ada),
-- menulis kolom artikel.sites.theme_config (tidak ada) sambil melewatkan kolom
-- slug yang NOT NULL, memeriksa artikel.article_revisions.revision_number (nama
-- kolom yang nyata: version), dan memakai `SELECT ... INTO TEMP` yang bukan
-- sintaks psql yang sah untuk maksud tersebut. Jadi suite ini tidak pernah
-- membuktikan apa pun.
--
-- Semua assertion sekarang memakai ASSERT di dalam blok DO sehingga kegagalan
-- benar-benar membuat psql keluar dengan status bukan nol. Versi lama hanya
-- menyeleksi boolean dan mencetak 'PASSED' tanpa melihat hasilnya.
--
-- Jalankan dengan -v ON_ERROR_STOP=1 supaya kegagalan menghentikan skrip:
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -f tests/integration/test_upsert_automation_article.sql
--
-- Seluruh suite dibungkus satu transaksi dan selalu ROLLBACK di akhir, jadi
-- aman dijalankan terhadap database yang berisi data. Tetap disarankan memakai
-- database sekali pakai.

\set ON_ERROR_STOP on
\echo '=== Test Suite: upsert_automation_article function ==='

BEGIN;

-- ---------------------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------------------

INSERT INTO artikel.sites (id, name, domain, slug)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Site 1', 'test1.example.test', 'test-site-1'),
  ('00000000-0000-0000-0000-000000000003', 'Test Site 2', 'test2.example.test', 'test-site-2');

-- auth.users punya banyak kolom NOT NULL tanpa default di sebagian versi GoTrue.
-- Hanya id dan email yang diisi; sisanya dibiarkan default.
INSERT INTO auth.users (id, email)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'editor@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'outsider@example.test');

-- Penulis otomasi: editor di site 1 dan site 2.
INSERT INTO artikel.user_roles (user_id, site_id, role, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'editor', true),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'editor', true);

-- User 4 sengaja tidak diberi peran di mana pun (dipakai Test 6).

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 1: Artikel baru + kategori baru + revisi pertama'
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record; v_count integer;
BEGIN
  SELECT * INTO r FROM artikel.upsert_automation_article(
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

  ASSERT r.created_new, 'created_new harus true untuk artikel baru';
  ASSERT r.article_id IS NOT NULL, 'article_id tidak boleh null';
  ASSERT r.revision_id IS NOT NULL, 'revision_id tidak boleh null';
  ASSERT r.category_id IS NOT NULL, 'category_id tidak boleh null';

  SELECT count(*) INTO v_count FROM artikel.articles
  WHERE id = r.article_id AND title = 'Test Article 1' AND external_id = 'ext-001';
  ASSERT v_count = 1, 'artikel harus tersimpan';

  SELECT count(*) INTO v_count FROM artikel.categories
  WHERE id = r.category_id AND site_id = '00000000-0000-0000-0000-000000000001'
    AND name = 'Technology' AND slug = 'technology';
  ASSERT v_count = 1, 'kategori harus dibuat dengan slug ter-normalisasi';

  -- Kolom yang dulu salah nama. Kalau regresi terjadi, assertion ini gagal.
  SELECT count(*) INTO v_count FROM artikel.article_revisions
  WHERE id = r.revision_id AND article_id = r.article_id AND version = 1
    AND created_by = '00000000-0000-0000-0000-000000000002'
    AND snapshot->>'title' = 'Test Article 1';
  ASSERT v_count = 1, 'revisi pertama harus version=1 dengan snapshot terisi';
END $$;
\echo 'Test 1: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 2: Upsert idempoten lewat external_id'
-- ---------------------------------------------------------------------------
DO $$
DECLARE r1 record; r2 record; v_count integer; v_title text; v_slug text;
BEGIN
  SELECT * INTO r1 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-002',
    p_title := 'Original Title',
    p_slug := 'original-slug',
    p_content := '<p>Original content</p>',
    p_excerpt := 'Original excerpt',
    p_category_name := 'News',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  SELECT * INTO r2 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-002',
    p_title := 'Updated Title',
    p_slug := 'updated-slug',
    p_content := '<p>Updated content</p>',
    p_excerpt := 'Updated excerpt',
    p_category_name := 'News',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  ASSERT r1.created_new, 'panggilan pertama harus membuat baru';
  ASSERT NOT r2.created_new, 'panggilan kedua harus memperbarui, bukan membuat baru';
  ASSERT r1.article_id = r2.article_id, 'external_id yang sama harus memetakan ke artikel yang sama';

  SELECT count(*) INTO v_count FROM artikel.articles
  WHERE site_id = '00000000-0000-0000-0000-000000000001' AND external_id = 'ext-002';
  ASSERT v_count = 1, 'hanya boleh ada satu artikel untuk external_id ini';

  SELECT title, slug INTO v_title, v_slug FROM artikel.articles WHERE id = r1.article_id;
  ASSERT v_title = 'Updated Title', 'judul harus terbarui';
  ASSERT v_slug = 'updated-slug', 'slug harus terbarui';

  SELECT count(*) INTO v_count FROM artikel.article_revisions WHERE article_id = r1.article_id;
  ASSERT v_count = 2, 'harus ada dua revisi';

  SELECT count(*) INTO v_count FROM artikel.article_revisions
  WHERE article_id = r1.article_id AND version = 2;
  ASSERT v_count = 1, 'revisi kedua harus version=2';
END $$;
\echo 'Test 2: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 3: Slug bentrok ditolak'
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_ok boolean := false;
BEGIN
  PERFORM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-003',
    p_title := 'Article A',
    p_slug := 'same-slug',
    p_content := '<p>Content A</p>',
    p_excerpt := 'Excerpt A',
    p_category_name := 'General',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

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
  EXCEPTION WHEN unique_violation THEN
    v_ok := true;
  END;

  ASSERT v_ok, 'slug duplikat di site yang sama harus ditolak';
END $$;
\echo 'Test 3: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 4: Isolasi tenant — external_id sama di dua site'
-- ---------------------------------------------------------------------------
DO $$
DECLARE r1 record; r2 record; v_count integer;
BEGIN
  SELECT * INTO r1 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-005',
    p_title := 'Site 1 Article',
    p_slug := 'site-1-article',
    p_content := '<p>Site 1 content</p>',
    p_excerpt := 'Site 1 excerpt',
    p_category_name := 'Shared Name',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  SELECT * INTO r2 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000003',
    p_external_id := 'ext-005',
    p_title := 'Site 2 Article',
    p_slug := 'site-2-article',
    p_content := '<p>Site 2 content</p>',
    p_excerpt := 'Site 2 excerpt',
    p_category_name := 'Shared Name',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  ASSERT r1.article_id <> r2.article_id, 'artikel harus terpisah per site';
  ASSERT r1.category_id <> r2.category_id, 'kategori bernama sama harus terpisah per site';

  SELECT count(DISTINCT site_id) INTO v_count FROM artikel.articles WHERE external_id = 'ext-005';
  ASSERT v_count = 2, 'kedua artikel harus milik site berbeda';
END $$;
\echo 'Test 4: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 5: Kategori dipakai ulang, bukan diduplikasi'
-- ---------------------------------------------------------------------------
DO $$
DECLARE r1 record; r2 record; v_count integer;
BEGIN
  SELECT * INTO r1 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-006',
    p_title := 'Sports 1',
    p_slug := 'article-sports-1',
    p_content := '<p>Sports 1</p>',
    p_excerpt := 'Sports 1',
    p_category_name := 'Sports',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  -- Beda kapitalisasi: pencocokan kategori tidak case-sensitive.
  SELECT * INTO r2 FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-007',
    p_title := 'Sports 2',
    p_slug := 'article-sports-2',
    p_content := '<p>Sports 2</p>',
    p_excerpt := 'Sports 2',
    p_category_name := 'sports',
    p_author_id := '00000000-0000-0000-0000-000000000002'
  );

  ASSERT r1.category_id = r2.category_id, 'kategori harus dipakai ulang tanpa memandang kapitalisasi';

  SELECT count(*) INTO v_count FROM artikel.categories
  WHERE site_id = '00000000-0000-0000-0000-000000000001' AND lower(name) = 'sports';
  ASSERT v_count = 1, 'tidak boleh ada kategori duplikat';
END $$;
\echo 'Test 5: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 6: Penulis tanpa peran aktif di site ditolak'
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM artikel.upsert_automation_article(
      p_site_id := '00000000-0000-0000-0000-000000000001',
      p_external_id := 'ext-008',
      p_title := 'Should Not Exist',
      p_slug := 'should-not-exist',
      p_content := '<p>nope</p>',
      p_excerpt := 'nope',
      p_category_name := 'General',
      p_author_id := '00000000-0000-0000-0000-000000000004'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_ok := true;
  END;

  ASSERT v_ok, 'penulis tanpa peran di site harus ditolak';
END $$;

DO $$
DECLARE v_ok boolean := false;
BEGIN
  -- Peran dinonaktifkan harus diperlakukan sama dengan tidak punya peran.
  UPDATE artikel.user_roles SET is_active = false
  WHERE user_id = '00000000-0000-0000-0000-000000000002'
    AND site_id = '00000000-0000-0000-0000-000000000001';

  BEGIN
    PERFORM artikel.upsert_automation_article(
      p_site_id := '00000000-0000-0000-0000-000000000001',
      p_external_id := 'ext-009',
      p_title := 'Should Not Exist Either',
      p_slug := 'should-not-exist-either',
      p_content := '<p>nope</p>',
      p_excerpt := 'nope',
      p_category_name := 'General',
      p_author_id := '00000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_ok := true;
  END;

  UPDATE artikel.user_roles SET is_active = true
  WHERE user_id = '00000000-0000-0000-0000-000000000002'
    AND site_id = '00000000-0000-0000-0000-000000000001';

  ASSERT v_ok, 'peran nonaktif harus ditolak';
END $$;
\echo 'Test 6: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 7: Status published langsung dari satu panggilan'
-- ---------------------------------------------------------------------------
-- Ini regression test untuk blocker yang ditemukan 28 September 2026: trigger
-- artikel.validate_article_write memakai auth.uid() yang selalu NULL di jalur
-- service_role, sehingga INSERT berstatus selain 'draft' selalu ditolak dengan
-- 'New articles must start as draft'. Lihat 202609280001_automation_article_actor.sql.
DO $$
DECLARE r record; v_status artikel.article_status; v_published timestamptz;
BEGIN
  SELECT * INTO r FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-010',
    p_title := 'Published Immediately',
    p_slug := 'published-immediately',
    p_content := '<p>live</p>',
    p_excerpt := 'live',
    p_category_name := 'General',
    p_author_id := '00000000-0000-0000-0000-000000000002',
    p_status := 'published'
  );

  SELECT status, published_at INTO v_status, v_published
  FROM artikel.articles WHERE id = r.article_id;

  ASSERT v_status = 'published', 'status harus published';
  -- artikel.articles punya CHECK: published wajib punya published_at.
  ASSERT v_published IS NOT NULL, 'published_at harus terisi otomatis';
END $$;
\echo 'Test 7: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 8: Kolom SEO dan gambar memakai nama kolom yang benar'
-- ---------------------------------------------------------------------------
-- Regression test untuk bug kolom: featured_image (tidak ada) vs
-- featured_image_path, dan meta_keywords yang tidak punya kolom tujuan.
DO $$
DECLARE r record; v_path text; v_meta text;
BEGIN
  SELECT * INTO r FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-011',
    p_title := 'With Image',
    p_slug := 'with-image',
    p_content := '<p>img</p>',
    p_excerpt := 'img',
    p_category_name := 'General',
    p_author_id := '00000000-0000-0000-0000-000000000002',
    p_featured_image := 'sites/test-site-1/articles/cover.jpg',
    p_meta_description := 'Deskripsi meta',
    p_meta_keywords := ARRAY['a', 'b']
  );

  SELECT featured_image_path, meta_description INTO v_path, v_meta
  FROM artikel.articles WHERE id = r.article_id;

  ASSERT v_path = 'sites/test-site-1/articles/cover.jpg', 'featured_image harus masuk ke featured_image_path';
  ASSERT v_meta = 'Deskripsi meta', 'meta_description harus tersimpan';
  -- p_meta_keywords sengaja tidak disimpan: tidak ada kolom tujuannya.
  -- Yang diuji di sini hanya bahwa melewatkannya tidak menyebabkan error.
END $$;
\echo 'Test 8: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 9: Site tidak dikenal atau nonaktif ditolak'
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_unknown boolean := false; v_inactive boolean := false;
BEGIN
  BEGIN
    PERFORM artikel.upsert_automation_article(
      p_site_id := '00000000-0000-0000-0000-0000000000ff',
      p_external_id := 'ext-012',
      p_title := 'Nowhere',
      p_slug := 'nowhere',
      p_content := '<p>x</p>',
      p_excerpt := 'x',
      p_category_name := 'General',
      p_author_id := '00000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_unknown := true;
  END;
  ASSERT v_unknown, 'site yang tidak ada harus ditolak';

  UPDATE artikel.sites SET is_active = false
  WHERE id = '00000000-0000-0000-0000-000000000003';

  BEGIN
    PERFORM artikel.upsert_automation_article(
      p_site_id := '00000000-0000-0000-0000-000000000003',
      p_external_id := 'ext-013',
      p_title := 'Inactive Site',
      p_slug := 'inactive-site',
      p_content := '<p>x</p>',
      p_excerpt := 'x',
      p_category_name := 'General',
      p_author_id := '00000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_inactive := true;
  END;

  UPDATE artikel.sites SET is_active = true
  WHERE id = '00000000-0000-0000-0000-000000000003';

  ASSERT v_inactive, 'site nonaktif harus ditolak';
END $$;
\echo 'Test 9: PASSED'

-- ---------------------------------------------------------------------------
\echo ''
\echo 'Test 10: Penegakan workflow tetap berlaku tanpa aktor berwenang'
-- ---------------------------------------------------------------------------
-- Memastikan perbaikan aktor otomasi tidak diam-diam melonggarkan aturan untuk
-- jalur non-otomasi. Tanpa auth.uid() dan tanpa setting aktor, perubahan status
-- harus tetap ditolak.
DO $$
DECLARE v_article_id uuid; v_ok boolean := false;
BEGIN
  SELECT article_id INTO v_article_id FROM artikel.upsert_automation_article(
    p_site_id := '00000000-0000-0000-0000-000000000001',
    p_external_id := 'ext-014',
    p_title := 'Workflow Guard',
    p_slug := 'workflow-guard',
    p_content := '<p>x</p>',
    p_excerpt := 'x',
    p_category_name := 'General',
    p_author_id := '00000000-0000-0000-0000-000000000002',
    p_status := 'draft'
  );

  -- Di luar RPC, setting aktor sudah tidak di-set ulang untuk pernyataan ini,
  -- tetapi masih hidup sampai akhir transaksi. Kosongkan eksplisit supaya yang
  -- diuji benar-benar kondisi "tanpa aktor".
  PERFORM set_config('artikel.automation_actor', '', true);

  BEGIN
    UPDATE artikel.articles SET status = 'published', published_at = now()
    WHERE id = v_article_id;
  EXCEPTION WHEN others THEN
    v_ok := true;
  END;

  ASSERT v_ok, 'perubahan status tanpa aktor berwenang harus ditolak trigger';
END $$;
\echo 'Test 10: PASSED'

-- Catatan untuk siapa pun yang menambah test di sini: setting aktor otomasi
-- di-set dengan set_config(..., true) sehingga lokal transaksi. Karena seluruh
-- suite ini satu transaksi, setting itu masih terlihat setelah panggilan RPC.
-- Kosongkan eksplisit seperti Test 10 kalau ingin menguji kondisi tanpa aktor.
-- Kalau parameter true itu suatu saat berubah jadi false, aktor akan bertahan
-- lintas transaksi di koneksi yang sama dan penegakan workflow bisa terlewati.

ROLLBACK;

\echo ''
\echo '=== All Integration Tests Completed (transaksi di-rollback) ==='
