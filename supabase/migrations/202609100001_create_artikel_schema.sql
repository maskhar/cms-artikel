create extension if not exists pgcrypto;
create schema if not exists artikel;

create type artikel.user_role as enum ('admin', 'editor', 'writer');
create type artikel.article_status as enum ('draft', 'in_review', 'revision_requested', 'approved', 'published', 'archived');

create table artikel.sites (id uuid primary key default gen_random_uuid(), name text not null, domain text not null unique, slug text not null unique, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table artikel.user_roles (user_id uuid not null references auth.users(id) on delete cascade, site_id uuid references artikel.sites(id) on delete cascade, role artikel.user_role not null, primary key (user_id, site_id, role));
create table artikel.categories (id uuid primary key default gen_random_uuid(), site_id uuid not null references artikel.sites(id) on delete restrict, name text not null, slug text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id, slug));
create table artikel.articles (id uuid primary key default gen_random_uuid(), site_id uuid not null references artikel.sites(id) on delete restrict, category_id uuid not null references artikel.categories(id) on delete restrict, author_id uuid not null references auth.users(id), reviewer_id uuid references auth.users(id), title text not null check (length(trim(title)) > 0), slug text not null, excerpt text, content text not null default '', featured_image_path text, status artikel.article_status not null default 'draft', seo_title text, meta_description text, canonical_url text, robots text not null default 'index,follow', og_image_path text, submitted_at timestamptz, approved_at timestamptz, published_at timestamptz, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id, slug), check ((status = 'published' and published_at is not null) or status <> 'published'));
create table artikel.tags (id uuid primary key default gen_random_uuid(), site_id uuid not null references artikel.sites(id) on delete restrict, name text not null, slug text not null, created_at timestamptz not null default now(), unique(site_id, slug));
create table artikel.article_tags (article_id uuid not null references artikel.articles(id) on delete cascade, tag_id uuid not null references artikel.tags(id) on delete cascade, primary key(article_id, tag_id));
create table artikel.article_revisions (id uuid primary key default gen_random_uuid(), article_id uuid not null references artikel.articles(id) on delete cascade, version integer not null, snapshot jsonb not null, change_note text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(article_id, version));
create table artikel.review_comments (id uuid primary key default gen_random_uuid(), article_id uuid not null references artikel.articles(id) on delete cascade, author_id uuid not null references auth.users(id), body text not null, status_from artikel.article_status, status_to artikel.article_status, created_at timestamptz not null default now());
create table artikel.api_keys (id uuid primary key default gen_random_uuid(), site_id uuid not null references artikel.sites(id) on delete cascade, label text not null, key_prefix text not null, secret_hash text not null unique, last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create table artikel.audit_logs (id uuid primary key default gen_random_uuid(), site_id uuid references artikel.sites(id) on delete set null, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

create index articles_public_idx on artikel.articles(site_id, status, published_at desc);
create index articles_slug_idx on artikel.articles(site_id, slug);
create index api_keys_active_idx on artikel.api_keys(secret_hash) where revoked_at is null;

create or replace function artikel.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger sites_updated_at before update on artikel.sites for each row execute function artikel.set_updated_at();
create trigger categories_updated_at before update on artikel.categories for each row execute function artikel.set_updated_at();
create trigger articles_updated_at before update on artikel.articles for each row execute function artikel.set_updated_at();

alter table artikel.sites enable row level security;
alter table artikel.user_roles enable row level security;
alter table artikel.categories enable row level security;
alter table artikel.articles enable row level security;
alter table artikel.tags enable row level security;
alter table artikel.article_tags enable row level security;
alter table artikel.article_revisions enable row level security;
alter table artikel.review_comments enable row level security;
alter table artikel.api_keys enable row level security;
alter table artikel.audit_logs enable row level security;

grant usage on schema artikel to authenticated, service_role;
grant select, insert, update, delete on all tables in schema artikel to authenticated, service_role;
alter default privileges in schema artikel grant select, insert, update, delete on tables to authenticated, service_role;
