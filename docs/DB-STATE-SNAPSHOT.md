# DB State Snapshot — sebelum 202609190001_security_hardening

Diambil: 2026-09-19 dari produksi 20.20.20.173 (container supabase-db).
Backup penuh: `~/db-backups/pre-remediation-2026-09-19.dump` di host tsb (pg_dump -Fc).

## RLS aktif per tabel
```
 schemaname |         tablename          | rowsecurity 
------------+----------------------------+-------------
 artikel    | api_key_rate_limits        | t
 artikel    | api_keys                   | t
 artikel    | article_addons             | t
 artikel    | article_revisions          | t
 artikel    | article_sites              | t
 artikel    | article_tags               | t
 artikel    | articles                   | t
 artikel    | audit_logs                 | t
 artikel    | categories                 | t
 artikel    | cms_hostnames              | t
 artikel    | galleries                  | t
 artikel    | gallery_items              | t
 artikel    | media_assets               | t
 artikel    | review_comments            | t
 artikel    | sites                      | t
 artikel    | tags                       | t
 artikel    | user_roles                 | t
 storage    | buckets                    | t
 storage    | buckets_analytics          | t
 storage    | buckets_vectors            | t
 storage    | iceberg_namespaces         | t
 storage    | iceberg_tables             | t
 storage    | migrations                 | t
 storage    | objects                    | t
 storage    | s3_multipart_uploads       | t
 storage    | s3_multipart_uploads_parts | t
 storage    | vector_indexes             | t
(27 rows)

```

## Policy (artikel + storage)
```
-[ RECORD 1 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | api_keys
policyname | admins manage api keys
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
-[ RECORD 2 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_addons
policyname | members manage article addons
cmd        | ALL
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_addons.article_id) AND (a.site_id = a.site_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_addons.article_id) AND (a.site_id = a.site_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
-[ RECORD 3 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_addons
policyname | members read article addons
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_addons.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | 
-[ RECORD 4 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_revisions
policyname | authors add revisions
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((created_by = auth.uid()) AND (EXISTS ( SELECT 1                                                                                                                                                                              +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_revisions.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))))))
-[ RECORD 5 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_revisions
policyname | automation_api_insert_revisions
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM (artikel.articles a                                                                                                                                                                                                    +
           |      JOIN artikel.user_roles ur ON ((ur.site_id = a.site_id)))                                                                                                                                                                 +
           |   WHERE ((a.id = article_revisions.article_id) AND (ur.user_id = auth.uid()))))
-[ RECORD 6 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_revisions
policyname | members read revisions
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_revisions.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | 
-[ RECORD 7 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_sites
policyname | admins manage article distributions
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
-[ RECORD 8 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_sites
policyname | members read article distributions
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_sites.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role])))))
with_check | 
-[ RECORD 9 ]-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | article_tags
policyname | members manage article tags
cmd        | ALL
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_tags.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = article_tags.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
-[ RECORD 10 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | authors and editors update articles
cmd        | UPDATE
roles      | {authenticated}
qual       | ((author_id = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
with_check | ((author_id = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
-[ RECORD 11 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | automation_api_insert_articles
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = articles.site_id) AND (user_roles.user_id = auth.uid()))))
-[ RECORD 12 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | automation_api_select_articles
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = articles.site_id) AND (user_roles.user_id = auth.uid()))))
with_check | 
-[ RECORD 13 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | automation_api_update_articles
cmd        | UPDATE
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = articles.site_id) AND (user_roles.user_id = auth.uid()))))
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = articles.site_id) AND (user_roles.user_id = auth.uid()))))
-[ RECORD 14 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | editors delete articles
cmd        | DELETE
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
with_check | 
-[ RECORD 15 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | members read articles
cmd        | SELECT
roles      | {authenticated}
qual       | ((author_id = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
with_check | 
-[ RECORD 16 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | articles
policyname | writers create own articles
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((author_id = auth.uid()) AND artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
-[ RECORD 17 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | audit_logs
policyname | members read audit logs
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
with_check | 
-[ RECORD 18 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | categories
policyname | automation_api_insert_categories
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = categories.site_id) AND (user_roles.user_id = auth.uid()))))
-[ RECORD 19 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | categories
policyname | automation_api_select_categories
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.user_roles                                                                                                                                                                                                     +
           |   WHERE ((user_roles.site_id = categories.site_id) AND (user_roles.user_id = auth.uid()))))
with_check | 
-[ RECORD 20 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | categories
policyname | editors manage categories
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
-[ RECORD 21 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | categories
policyname | members read categories
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role])
with_check | 
-[ RECORD 22 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | cms_hostnames
policyname | admins manage cms hostnames
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
-[ RECORD 23 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | cms_hostnames
policyname | authenticated read cms hostnames
cmd        | SELECT
roles      | {authenticated}
qual       | true
with_check | 
-[ RECORD 24 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | galleries
policyname | editors delete galleries
cmd        | DELETE
roles      | {authenticated}
qual       | ((created_by = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
with_check | 
-[ RECORD 25 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | galleries
policyname | members create galleries
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((created_by = auth.uid()) AND artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
-[ RECORD 26 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | galleries
policyname | members read galleries
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role])
with_check | 
-[ RECORD 27 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | galleries
policyname | members update galleries
cmd        | UPDATE
roles      | {authenticated}
qual       | ((created_by = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
with_check | ((created_by = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
-[ RECORD 28 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | gallery_items
policyname | members manage gallery items
cmd        | ALL
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.galleries g                                                                                                                                                                                                    +
           |   WHERE ((g.id = gallery_items.gallery_id) AND ((g.created_by = auth.uid()) OR artikel.has_site_role(g.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.galleries g                                                                                                                                                                                                    +
           |   WHERE ((g.id = gallery_items.gallery_id) AND ((g.created_by = auth.uid()) OR artikel.has_site_role(g.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
-[ RECORD 29 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | gallery_items
policyname | members read gallery items
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.galleries g                                                                                                                                                                                                    +
           |   WHERE ((g.id = gallery_items.gallery_id) AND artikel.has_site_role(g.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))))
with_check | 
-[ RECORD 30 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | media_assets
policyname | authenticated users read global media assets
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.is_media_member()
with_check | 
-[ RECORD 31 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | media_assets
policyname | editors delete media assets
cmd        | DELETE
roles      | {authenticated}
qual       | ((created_by = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role]))
with_check | 
-[ RECORD 32 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | media_assets
policyname | editors manage media assets
cmd        | UPDATE
roles      | {authenticated}
qual       | (artikel.is_media_member() AND (created_by = auth.uid()))
with_check | (artikel.is_media_member() AND (created_by = auth.uid()) AND (EXISTS ( SELECT 1                                                                                                                                                +
           |    FROM storage.objects                                                                                                                                                                                                        +
           |   WHERE ((objects.bucket_id = 'artikel-media'::text) AND (objects.name = media_assets.storage_path) AND (objects.owner_id = (auth.uid())::text)))))
-[ RECORD 33 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | media_assets
policyname | members create media assets
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (artikel.is_media_member() AND (created_by = auth.uid()) AND (EXISTS ( SELECT 1                                                                                                                                                +
           |    FROM storage.objects                                                                                                                                                                                                        +
           |   WHERE ((objects.bucket_id = 'artikel-media'::text) AND (objects.name = media_assets.storage_path) AND (objects.owner_id = (auth.uid())::text)))))
-[ RECORD 34 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | review_comments
policyname | editors add comments
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((author_id = auth.uid()) AND (EXISTS ( SELECT 1                                                                                                                                                                               +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = review_comments.article_id) AND artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
-[ RECORD 35 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | review_comments
policyname | members read comments
cmd        | SELECT
roles      | {authenticated}
qual       | (EXISTS ( SELECT 1                                                                                                                                                                                                             +
           |    FROM artikel.articles a                                                                                                                                                                                                     +
           |   WHERE ((a.id = review_comments.article_id) AND ((a.author_id = auth.uid()) OR artikel.has_site_role(a.site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])))))
with_check | 
-[ RECORD 36 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | sites
policyname | admins manage sites
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(id, ARRAY['admin'::artikel.user_role])
with_check | artikel.has_site_role(id, ARRAY['admin'::artikel.user_role])
-[ RECORD 37 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | sites
policyname | site members read sites
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.has_site_role(id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role])
with_check | 
-[ RECORD 38 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | tags
policyname | editors manage tags
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role])
-[ RECORD 39 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | tags
policyname | members read tags
cmd        | SELECT
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role])
with_check | 
-[ RECORD 40 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | user_roles
policyname | admins manage roles
cmd        | ALL
roles      | {authenticated}
qual       | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
with_check | artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role])
-[ RECORD 41 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | artikel
tablename  | user_roles
policyname | users read assigned roles
cmd        | SELECT
roles      | {authenticated}
qual       | ((user_id = auth.uid()) OR artikel.has_site_role(site_id, ARRAY['admin'::artikel.user_role]))
with_check | 
-[ RECORD 42 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Admin read payout proofs
cmd        | SELECT
roles      | {authenticated}
qual       | ((bucket_id = 'payout-proofs'::text) AND soundpub.is_admin(auth.uid()))
with_check | 
-[ RECORD 43 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Admin upload payout proofs
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((bucket_id = 'payout-proofs'::text) AND soundpub.is_admin(auth.uid()))
-[ RECORD 44 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth select from avatars
cmd        | SELECT
roles      | {authenticated}
qual       | (bucket_id = 'avatars'::text)
with_check | 
-[ RECORD 45 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth select from daily-report
cmd        | SELECT
roles      | {authenticated}
qual       | (bucket_id = 'daily-report'::text)
with_check | 
-[ RECORD 46 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth select from task
cmd        | SELECT
roles      | {authenticated}
qual       | (bucket_id = 'task'::text)
with_check | 
-[ RECORD 47 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth upload to avatars
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (bucket_id = 'avatars'::text)
-[ RECORD 48 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth upload to daily-report
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (bucket_id = 'daily-report'::text)
-[ RECORD 49 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Allow auth upload to task
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (bucket_id = 'task'::text)
-[ RECORD 50 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated Delete
cmd        | DELETE
roles      | {authenticated}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'gallery'::text, 'article'::text, 'daily-report'::text, 'task'::text, 'learning'::text]))
with_check | 
-[ RECORD 51 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated Update
cmd        | UPDATE
roles      | {authenticated}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'gallery'::text, 'article'::text, 'daily-report'::text, 'task'::text, 'learning'::text]))
with_check | (bucket_id = ANY (ARRAY['avatars'::text, 'gallery'::text, 'article'::text, 'daily-report'::text, 'task'::text, 'learning'::text]))
-[ RECORD 52 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated Upload
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (bucket_id = ANY (ARRAY['avatars'::text, 'gallery'::text, 'article'::text, 'daily-report'::text, 'task'::text, 'learning'::text]))
-[ RECORD 53 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated users can delete 3D models
cmd        | DELETE
roles      | {public}
qual       | ((bucket_id = '3d-models'::text) AND (auth.role() = 'authenticated'::text))
with_check | 
-[ RECORD 54 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated users can update 3D models
cmd        | UPDATE
roles      | {public}
qual       | ((bucket_id = '3d-models'::text) AND (auth.role() = 'authenticated'::text))
with_check | ((bucket_id = '3d-models'::text) AND (auth.role() = 'authenticated'::text))
-[ RECORD 55 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Authenticated users can upload 3D models
cmd        | INSERT
roles      | {public}
qual       | 
with_check | ((bucket_id = '3d-models'::text) AND (auth.role() = 'authenticated'::text))
-[ RECORD 56 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Public Access
cmd        | SELECT
roles      | {public}
qual       | true
with_check | 
-[ RECORD 57 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Public Access for 3D Models
cmd        | SELECT
roles      | {public}
qual       | (bucket_id = '3d-models'::text)
with_check | 
-[ RECORD 58 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Public read
cmd        | SELECT
roles      | {public}
qual       | (bucket_id = '3d-models'::text)
with_check | 
-[ RECORD 59 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Public update for development
cmd        | UPDATE
roles      | {public}
qual       | (bucket_id = '3d-models'::text)
with_check | 
-[ RECORD 60 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Public upload for development
cmd        | INSERT
roles      | {public}
qual       | 
with_check | (bucket_id = '3d-models'::text)
-[ RECORD 61 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Read scoped takedown storage files
cmd        | SELECT
roles      | {authenticated}
qual       | ((bucket_id = 'takedown-documents'::text) AND (soundpub.is_admin(auth.uid()) OR (split_part(name, '/'::text, 1) = (auth.uid())::text) OR (EXISTS ( SELECT 1                                                                    +
           |    FROM (soundpub.takedown_request_documents document                                                                                                                                                                          +
           |      JOIN soundpub.takedown_requests request ON ((request.id = document.request_id)))                                                                                                                                          +
           |   WHERE ((document.storage_path = objects.name) AND (request.label_id = auth.uid()))))))
with_check | 
-[ RECORD 62 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub authenticated delete buckets
cmd        | DELETE
roles      | {authenticated}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
with_check | 
-[ RECORD 63 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub authenticated read private buckets
cmd        | SELECT
roles      | {authenticated}
qual       | (bucket_id = ANY (ARRAY['release-covers'::text, 'track-audio'::text, 'track-video'::text]))
with_check | 
-[ RECORD 64 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub authenticated update buckets
cmd        | UPDATE
roles      | {authenticated}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
with_check | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
-[ RECORD 65 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub authenticated upload buckets
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
-[ RECORD 66 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub public read public buckets
cmd        | SELECT
roles      | {anon,authenticated}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'audio-clips'::text]))
with_check | 
-[ RECORD 67 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | SoundPub service role manage buckets
cmd        | ALL
roles      | {service_role}
qual       | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
with_check | (bucket_id = ANY (ARRAY['avatars'::text, 'label-logos'::text, 'iccn-gallery'::text, 'release-covers'::text, 'track-audio'::text, 'track-video'::text, 'audio-clips'::text]))
-[ RECORD 68 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | Upload own takedown storage files
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((bucket_id = 'takedown-documents'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))
-[ RECORD 69 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | User read own payout proofs
cmd        | SELECT
roles      | {authenticated}
qual       | ((bucket_id = 'payout-proofs'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))
with_check | 
-[ RECORD 70 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | chatten cms manage
cmd        | ALL
roles      | {authenticated}
qual       | ((bucket_id = 'chatten-media'::text) AND chatten_cafe.has_role('editor'::text))
with_check | ((bucket_id = 'chatten-media'::text) AND chatten_cafe.has_role('editor'::text))
-[ RECORD 71 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | chatten public read
cmd        | SELECT
roles      | {public}
qual       | (bucket_id = 'chatten-media'::text)
with_check | 
-[ RECORD 72 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | cms members read global media storage
cmd        | SELECT
roles      | {authenticated}
qual       | ((bucket_id = 'artikel-media'::text) AND artikel.is_media_member())
with_check | 
-[ RECORD 73 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | cms members upload global media storage
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((bucket_id = 'artikel-media'::text) AND artikel.is_media_member())
-[ RECORD 74 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | cms owners delete global media storage
cmd        | DELETE
roles      | {authenticated}
qual       | ((bucket_id = 'artikel-media'::text) AND (owner_id = (auth.uid())::text) AND artikel.is_media_member())
with_check | 
-[ RECORD 75 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | members read article media
cmd        | SELECT
roles      | {authenticated}
qual       | ((bucket_id = 'artikel-media'::text) AND artikel.has_site_role(artikel.storage_site_id(name), ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
with_check | 
-[ RECORD 76 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | members upload article media
cmd        | INSERT
roles      | {authenticated}
qual       | 
with_check | ((bucket_id = 'artikel-media'::text) AND (owner_id = (auth.uid())::text) AND artikel.has_site_role(artikel.storage_site_id(name), ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
-[ RECORD 77 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | owners delete article media
cmd        | DELETE
roles      | {authenticated}
qual       | ((bucket_id = 'artikel-media'::text) AND (owner_id = (auth.uid())::text) AND artikel.has_site_role(artikel.storage_site_id(name), ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
with_check | 
-[ RECORD 78 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
schemaname | storage
tablename  | objects
policyname | owners update article media
cmd        | UPDATE
roles      | {authenticated}
qual       | ((bucket_id = 'artikel-media'::text) AND (owner_id = (auth.uid())::text) AND artikel.has_site_role(artikel.storage_site_id(name), ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))
with_check | ((bucket_id = 'artikel-media'::text) AND (owner_id = (auth.uid())::text) AND artikel.has_site_role(artikel.storage_site_id(name), ARRAY['admin'::artikel.user_role, 'editor'::artikel.user_role, 'writer'::artikel.user_role]))

```

## Function (prosecdef + search_path)
```
              proname               | prosecdef |               proconfig                
------------------------------------+-----------+----------------------------------------
 article_tag_site_matches           | f         | 
 attach_global_articles_to_new_site | t         | {"search_path=artikel, public"}
 audit_row_change                   | t         | {"search_path=artikel, auth, pg_temp"}
 capture_article_revision           | f         | {"search_path=artikel, auth"}
 consume_api_key_rate_limit         | t         | {"search_path=artikel, pg_temp"}
 delete_site                        | t         | {"search_path=artikel, pg_catalog"}
 has_site_role                      | t         | {"search_path=artikel, auth"}
 is_media_member                    | t         | {"search_path=\"\""}
 set_updated_at                     | f         | 
 storage_site_id                    | f         | 
 sync_article_distributions         | t         | {"search_path=artikel, public"}
 upsert_automation_article          | t         | {"search_path=artikel, public"}
 validate_article_write             | f         | {"search_path=artikel, auth"}
(13 rows)

```

## Grant function
```
            routine_name            |    grantee    | privilege_type 
------------------------------------+---------------+----------------
 article_tag_site_matches           | PUBLIC        | EXECUTE
 article_tag_site_matches           | postgres      | EXECUTE
 attach_global_articles_to_new_site | PUBLIC        | EXECUTE
 attach_global_articles_to_new_site | postgres      | EXECUTE
 audit_row_change                   | PUBLIC        | EXECUTE
 audit_row_change                   | postgres      | EXECUTE
 capture_article_revision           | PUBLIC        | EXECUTE
 capture_article_revision           | postgres      | EXECUTE
 consume_api_key_rate_limit         | postgres      | EXECUTE
 consume_api_key_rate_limit         | service_role  | EXECUTE
 delete_site                        | PUBLIC        | EXECUTE
 delete_site                        | authenticated | EXECUTE
 delete_site                        | postgres      | EXECUTE
 delete_site                        | service_role  | EXECUTE
 has_site_role                      | PUBLIC        | EXECUTE
 has_site_role                      | authenticated | EXECUTE
 has_site_role                      | postgres      | EXECUTE
 is_media_member                    | authenticated | EXECUTE
 is_media_member                    | postgres      | EXECUTE
 is_media_member                    | service_role  | EXECUTE
 set_updated_at                     | PUBLIC        | EXECUTE
 set_updated_at                     | postgres      | EXECUTE
 storage_site_id                    | PUBLIC        | EXECUTE
 storage_site_id                    | postgres      | EXECUTE
 sync_article_distributions         | PUBLIC        | EXECUTE
 sync_article_distributions         | postgres      | EXECUTE
 upsert_automation_article          | PUBLIC        | EXECUTE
 upsert_automation_article          | authenticated | EXECUTE
 upsert_automation_article          | postgres      | EXECUTE
 validate_article_write             | PUBLIC        | EXECUTE
 validate_article_write             | postgres      | EXECUTE
(31 rows)

```
