update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'artikel-media';

create table if not exists artikel.media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  width integer,
  height integer,
  alt_text text not null default '',
  caption text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, storage_path)
);

create table if not exists artikel.galleries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table if not exists artikel.gallery_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references artikel.galleries(id) on delete cascade,
  media_asset_id uuid not null references artikel.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  caption_override text,
  link_url text,
  created_at timestamptz not null default now(),
  unique (gallery_id, media_asset_id)
);

do $$ begin
  create type artikel.article_addon_type as enum ('gallery', 'pdf_viewer', 'image_slider', 'video_embed', 'call_to_action', 'faq', 'related_articles', 'table_of_contents', 'highlight_box', 'file_download');
exception when duplicate_object then null; end $$;

create table if not exists artikel.article_addons (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references artikel.sites(id) on delete cascade,
  article_id uuid not null references artikel.articles(id) on delete cascade,
  addon_type artikel.article_addon_type not null,
  placement text not null default 'after_content' check (placement in ('before_content', 'after_content')),
  sort_order integer not null default 0,
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_site_idx on artikel.media_assets(site_id, created_at desc);
create index if not exists galleries_site_idx on artikel.galleries(site_id, updated_at desc);
create index if not exists gallery_items_order_idx on artikel.gallery_items(gallery_id, sort_order);
create index if not exists article_addons_article_idx on artikel.article_addons(article_id, placement, sort_order);

alter table artikel.media_assets enable row level security;
alter table artikel.galleries enable row level security;
alter table artikel.gallery_items enable row level security;
alter table artikel.article_addons enable row level security;

create policy "members read media assets" on artikel.media_assets for select to authenticated using (artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "members create media assets" on artikel.media_assets for insert to authenticated with check (created_by = auth.uid() and artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "editors manage media assets" on artikel.media_assets for update to authenticated using (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])) with check (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "editors delete media assets" on artikel.media_assets for delete to authenticated using (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));

create policy "members read galleries" on artikel.galleries for select to authenticated using (artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "members create galleries" on artikel.galleries for insert to authenticated with check (created_by = auth.uid() and artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "members update galleries" on artikel.galleries for update to authenticated using (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])) with check (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "editors delete galleries" on artikel.galleries for delete to authenticated using (created_by = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));

create policy "members read gallery items" on artikel.gallery_items for select to authenticated using (exists (select 1 from artikel.galleries g where g.id = gallery_id and artikel.has_site_role(g.site_id, array['admin','editor','writer']::artikel.user_role[])));
create policy "members manage gallery items" on artikel.gallery_items for all to authenticated using (exists (select 1 from artikel.galleries g where g.id = gallery_id and (g.created_by = auth.uid() or artikel.has_site_role(g.site_id, array['admin','editor']::artikel.user_role[])))) with check (exists (select 1 from artikel.galleries g where g.id = gallery_id and (g.created_by = auth.uid() or artikel.has_site_role(g.site_id, array['admin','editor']::artikel.user_role[]))));

create policy "members read article addons" on artikel.article_addons for select to authenticated using (exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
create policy "members manage article addons" on artikel.article_addons for all to authenticated using (exists (select 1 from artikel.articles a where a.id = article_id and a.site_id = site_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[])))) with check (exists (select 1 from artikel.articles a where a.id = article_id and a.site_id = site_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
