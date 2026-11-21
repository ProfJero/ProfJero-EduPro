-- =============================================================================
-- Class-private learning: a course with visibility 'class' is only reachable by
-- members of the classes it is assigned to (via class_courses) and its teachers.
-- Class owners may create and publish such courses without platform review;
-- making a course public still needs publishing rights / review.
-- =============================================================================

-- Class owners (even without the instructor role) can create class courses.
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (status in ('draft', 'in_review') or private.is_platform_admin())
    and (
      (school_id is null and (private.has_role('teacher') or private.is_platform_admin()))
      or (school_id is null and visibility = 'class' and not private.is_guest()
          and exists (select 1 from public.school_classes k where k.owner_id = (select auth.uid()) and not k.is_archived))
      or (school_id is not null and private.is_school_staff(school_id))
    )
  );

create or replace function private.guard_course_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_platform_admin();
  v_rights boolean;
begin
  if (select auth.uid()) is null then return new; end if; -- service role / migrations
  v_rights := v_admin or (new.school_id is not null and private.is_school_admin(new.school_id))
    or (new.school_id is not null and private.is_school_staff(new.school_id)
        and exists (select 1 from public.platform_settings s where s.key = 'courses.school_teachers_can_publish' and s.value = 'true'::jsonb));
  -- Publishing: class-only (and private) courses can be published by their managers.
  if new.status = 'published' and old.status is distinct from 'published' then
    if not (v_rights or (new.visibility in ('class', 'private') and private.can_manage_course(new.id))) then
      raise exception 'You need publishing rights for this course. Submit it for review instead.' using errcode = '42501';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  -- A published class/private course cannot be opened to the public without rights.
  if new.status = 'published' and new.visibility in ('public', 'unlisted', 'school') and old.visibility in ('class', 'private') and not v_rights then
    raise exception 'Making this course public needs a review. Unpublish it and submit it for review.' using errcode = '42501';
  end if;
  if new.visibility = 'class' and new.is_premium and not v_admin then
    raise exception 'Class courses cannot be premium' using errcode = '42501';
  end if;
  if new.is_premium is distinct from old.is_premium and not v_admin then
    raise exception 'Only platform administrators can change premium status' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id and not v_admin then
    raise exception 'Only platform administrators can transfer ownership' using errcode = '42501';
  end if;
  if new.school_id is distinct from old.school_id and not v_admin then
    raise exception 'Only platform administrators can move a course between schools' using errcode = '42501';
  end if;
  return new;
end $$;

-- Joining a class enrols you in its courses; leaving removes that access.
create or replace function private.on_class_enrolment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' then
    insert into public.course_enrolments (course_id, user_id, source, school_id, class_id, enrolled_by)
    select cc.course_id, new.user_id, 'school', c.school_id, new.class_id, (select auth.uid())
    from public.class_courses cc join public.school_classes c on c.id = cc.class_id
    where cc.class_id = new.class_id
    on conflict (course_id, user_id) do update set status = 'active', class_id = excluded.class_id
      where public.course_enrolments.status = 'dropped' and public.course_enrolments.source = 'school';
  elsif tg_op = 'UPDATE' and old.status = 'active' then
    update public.course_enrolments e set status = 'dropped'
    where e.user_id = new.user_id and e.class_id = new.class_id and e.source = 'school' and e.status = 'active'
      and not exists (select 1 from public.class_courses cc join public.class_enrolments ce on ce.class_id = cc.class_id
                      where cc.course_id = e.course_id and ce.user_id = e.user_id and ce.status = 'active' and ce.class_id <> new.class_id);
  end if;
  return new;
end $$;

create or replace function private.on_class_enrolment_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.course_enrolments e set status = 'dropped'
  where e.user_id = old.user_id and e.class_id = old.class_id and e.source = 'school' and e.status = 'active'
    and not exists (select 1 from public.class_courses cc join public.class_enrolments ce on ce.class_id = cc.class_id
                    where cc.course_id = e.course_id and ce.user_id = e.user_id and ce.status = 'active' and ce.class_id <> old.class_id);
  return old;
end $$;
drop trigger if exists class_enrolments_courses_delete on public.class_enrolments;
create trigger class_enrolments_courses_delete after delete on public.class_enrolments
  for each row execute function private.on_class_enrolment_delete();

-- Removing a course from a class removes the class's access to it.
create or replace function private.on_class_course_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.course_enrolments e set status = 'dropped'
  where e.course_id = old.course_id and e.class_id = old.class_id and e.source = 'school' and e.status = 'active'
    and not exists (select 1 from public.class_courses cc join public.class_enrolments ce on ce.class_id = cc.class_id
                    where cc.course_id = e.course_id and ce.user_id = e.user_id and ce.status = 'active' and cc.class_id <> old.class_id);
  return old;
end $$;
drop trigger if exists class_courses_removed on public.class_courses;
create trigger class_courses_removed after delete on public.class_courses
  for each row execute function private.on_class_course_removed();

-- Class course listing for members (name, progress) without exposing other classes.
create or replace function public.class_learning(p_class uuid)
returns table (course_id uuid, title text, short_description text, cover_url text, visibility text, status text, lessons bigint, my_progress numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.is_class_member(p_class) or private.can_manage_class(p_class)) then raise exception 'Join this class to see its lessons' using errcode = '42501'; end if;
  return query
    select c.id, c.title, c.short_description, c.cover_url, c.visibility::text, c.status::text,
      (select count(*) from public.lessons l where l.course_id = c.id and l.status = 'published'),
      (select e.progress_pct from public.course_enrolments e where e.course_id = c.id and e.user_id = (select auth.uid()))
    from public.class_courses cc join public.courses c on c.id = cc.course_id
    where cc.class_id = p_class and (c.status = 'published' or private.can_manage_class(p_class))
    order by cc.created_at;
end $$;
revoke execute on function public.class_learning(uuid) from public, anon;
grant execute on function public.class_learning(uuid) to authenticated;
grant execute on all functions in schema private to anon, authenticated;
