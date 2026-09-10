create or replace function artikel.validate_article_write()
returns trigger language plpgsql security invoker set search_path = artikel, auth as $$
declare category_site_id uuid;
begin
  select site_id into category_site_id from artikel.categories where id = new.category_id;
  if category_site_id is distinct from new.site_id then
    raise exception 'Category does not belong to selected site';
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New articles must start as draft';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if artikel.has_site_role(new.site_id, array['admin','editor']::artikel.user_role[]) then
      if not ((old.status = 'draft' and new.status = 'in_review') or
              (old.status = 'revision_requested' and new.status = 'in_review') or
              (old.status = 'in_review' and new.status in ('revision_requested','approved')) or
              (old.status = 'approved' and new.status in ('published','draft')) or
              (old.status = 'published' and new.status in ('archived','draft')) or
              (old.status = 'archived' and new.status = 'draft')) then
        raise exception 'Invalid article status transition';
      end if;
    elsif new.author_id = auth.uid() then
      if not ((old.status in ('draft','revision_requested')) and new.status = 'in_review') then
        raise exception 'Writer cannot perform this status transition';
      end if;
    else
      raise exception 'Not allowed to change article status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_article_write on artikel.articles;
create trigger validate_article_write before insert or update on artikel.articles for each row execute function artikel.validate_article_write();
