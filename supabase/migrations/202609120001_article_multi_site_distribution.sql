alter table artikel.articles
  add column if not exists publish_scope text not null default 'selected_sites'
  check (publish_scope in ('selected_sites', 'all_active_sites'));

create table if not exists artikel.article_sites (
  article_id uuid not null references artikel.articles(id) on delete cascade,
  site_id uuid not null references artikel.sites(id) on delete cascade,
  category_id uuid references artikel.categories(id) on delete set null,
  slug text not null,
  status artikel.article_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, site_id),
  unique (site_id, slug),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create index if not exists article_sites_public_idx
  on artikel.article_sites(site_id, status, published_at desc);

create trigger article_sites_updated_at
before update on artikel.article_sites
for each row execute function artikel.set_updated_at();

insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
select id, site_id, category_id, slug, status, published_at
from artikel.articles
on conflict (article_id, site_id) do nothing;

create or replace function artikel.sync_article_distributions()
returns trigger
language plpgsql
security definer
set search_path = artikel, public
as $$
begin
  if new.publish_scope = 'all_active_sites' then
    insert into artikel.categories (site_id, name, slug, description)
    select target.id, source_category.name, source_category.slug, source_category.description
    from artikel.sites target
    join artikel.categories source_category on source_category.id = new.category_id
    where target.is_active
    on conflict (site_id, slug) do nothing;

    insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
    select
      new.id,
      target.id,
      coalesce(
        (select c.id
         from artikel.categories c
         join artikel.categories source_category on source_category.id = new.category_id
         where c.site_id = target.id
           and c.slug = source_category.slug
           and c.is_active
         limit 1),
        case when target.id = new.site_id then new.category_id else null end
      ),
      new.slug,
      new.status,
      case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    from artikel.sites target
    where target.is_active
    on conflict do nothing;

    update artikel.article_sites distribution
    set category_id = coalesce(
          (select c.id from artikel.categories c
           join artikel.categories source_category on source_category.id = new.category_id
           where c.site_id = distribution.site_id and c.slug = source_category.slug and c.is_active limit 1),
          case when distribution.site_id = new.site_id then new.category_id else null end),
        slug = new.slug,
        status = new.status,
        published_at = case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    where distribution.article_id = new.id;
  else
    insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
    values (
      new.id,
      new.site_id,
      new.category_id,
      new.slug,
      new.status,
      case when new.status = 'published' then coalesce(new.published_at, now()) else null end
    )
    on conflict (article_id, site_id) do update set
      category_id = excluded.category_id,
      slug = excluded.slug,
      status = excluded.status,
      published_at = excluded.published_at;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_article_distributions on artikel.articles;
create trigger sync_article_distributions
after insert or update of site_id, category_id, slug, status, published_at, publish_scope
on artikel.articles
for each row execute function artikel.sync_article_distributions();

create or replace function artikel.attach_global_articles_to_new_site()
returns trigger
language plpgsql
security definer
set search_path = artikel, public
as $$
begin
  if new.is_active then
    insert into artikel.categories (site_id, name, slug, description)
    select distinct new.id, source_category.name, source_category.slug, source_category.description
    from artikel.articles a
    join artikel.categories source_category on source_category.id = a.category_id
    where a.publish_scope = 'all_active_sites'
    on conflict (site_id, slug) do nothing;

    insert into artikel.article_sites (article_id, site_id, category_id, slug, status, published_at)
    select
      a.id,
      new.id,
      target_category.id,
      a.slug,
      a.status,
      case when a.status = 'published' then a.published_at else null end
    from artikel.articles a
    left join artikel.categories source_category on source_category.id = a.category_id
    left join artikel.categories target_category
      on target_category.site_id = new.id
     and target_category.slug = source_category.slug
     and target_category.is_active
    where a.publish_scope = 'all_active_sites'
    on conflict (article_id, site_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists attach_global_articles_to_new_site on artikel.sites;
create trigger attach_global_articles_to_new_site
after insert or update of is_active on artikel.sites
for each row
when (new.is_active)
execute function artikel.attach_global_articles_to_new_site();

alter table artikel.article_sites enable row level security;

create policy "members read article distributions"
on artikel.article_sites for select to authenticated
using (
  exists (
    select 1 from artikel.articles a
    where a.id = article_id
      and (a.author_id = auth.uid() or artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]))
  )
);

create policy "admins manage article distributions"
on artikel.article_sites for all to authenticated
using (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]))
with check (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
