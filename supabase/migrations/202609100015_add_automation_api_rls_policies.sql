-- Migration: Add RLS policies for automation API access
-- File: 202609100015_add_automation_api_rls_policies.sql
-- Purpose: DIBATALKAN. Migrasi ini sekarang sengaja tidak membuat policy apa pun.
--
-- Isi asli file ini membuat enam policy (automation_api_insert_articles,
-- automation_api_update_articles, automation_api_select_articles,
-- automation_api_insert_revisions, automation_api_insert_categories,
-- automation_api_select_categories) yang semuanya memeriksa artikel.site_users.
-- Tabel itu tidak pernah dibuat migrasi mana pun, jadi file ini selalu gagal saat
-- apply dan membuat `supabase db reset` berhenti di sini. Itulah sebabnya schema
-- proyek ini tidak pernah bisa direproduksi dari nol.
--
-- Perbaikannya bukan mengganti site_users menjadi user_roles. Keenam policy itu
-- memang tidak seharusnya ada:
--
--   1. Tidak memberi manfaat. Jalur otomasi memakai service_role key
--      (supabase/functions/automation-api/index.ts), yang melewati RLS sepenuhnya.
--      Policy untuk peran `authenticated` tidak pernah dievaluasi di jalur itu.
--   2. Justru berbahaya. Policy tersebut memberi setiap user CMS yang login hak
--      INSERT/UPDATE/SELECT artikel di seluruh site tempat ia punya baris peran,
--      tanpa memeriksa role maupun is_active, sehingga melumpuhkan cek authorship
--      dan workflow yang ditegakkan policy lain. Ini dicatat sebagai CRITICAL #3
--      pada audit keamanan.
--
-- Keenam policy tersebut sudah di-drop di produksi lewat
-- 202609190001_security_hardening.sql. Membiarkan migrasi ini membuatnya lagi
-- berarti schema hasil `db reset` tidak cocok dengan produksi, atau lebih buruk:
-- pada lini yang belum memuat migrasi pengerasan itu, policy longgar tersebut
-- hidup kembali. Karena itu file ini dikosongkan, bukan ditambal.
--
-- Drop di bawah bersifat idempoten dan ada demi database yang terlanjur menerima
-- versi lama file ini secara manual.

DROP POLICY IF EXISTS automation_api_insert_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_update_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_select_articles ON artikel.articles;
DROP POLICY IF EXISTS automation_api_insert_revisions ON artikel.article_revisions;
DROP POLICY IF EXISTS automation_api_insert_categories ON artikel.categories;
DROP POLICY IF EXISTS automation_api_select_categories ON artikel.categories;

-- Otorisasi tulis lewat Automation API ditegakkan di dua tempat lain:
--   - artikel.upsert_automation_article (202609100014) memverifikasi penulis punya
--     peran aktif di site, dan hanya bisa dipanggil service_role.
--   - Edge Function automation-api memverifikasi API key ber-scope satu site.
