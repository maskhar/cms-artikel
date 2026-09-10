create or replace function artikel.capture_article_revision()
returns trigger language plpgsql security invoker set search_path = artikel, auth as $$
declare next_version integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and row(new.title, new.slug, new.excerpt, new.content, new.seo_title, new.meta_description, new.status) is not distinct from row(old.title, old.slug, old.excerpt, old.content, old.seo_title, old.meta_description, old.status) then return new; end if;
  select coalesce(max(version), 0) + 1 into next_version from artikel.article_revisions where article_id = new.id;
  insert into artikel.article_revisions (article_id, version, snapshot, change_note, created_by)
  values (new.id, next_version, jsonb_build_object('title', new.title, 'slug', new.slug, 'excerpt', new.excerpt, 'content', new.content, 'seo_title', new.seo_title, 'meta_description', new.meta_description, 'status', new.status), case when tg_op = 'INSERT' then 'Draft dibuat' else 'Artikel diperbarui' end, auth.uid());
  return new;
end;
$$;
drop trigger if exists capture_article_revision on artikel.articles;
create trigger capture_article_revision after insert or update on artikel.articles for each row execute function artikel.capture_article_revision();
