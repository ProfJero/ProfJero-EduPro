-- =============================================================================
-- Teacher-made Arena challenges: public (anyone) or for one class only.
-- =============================================================================
alter table public.arena_challenges
  add column if not exists class_id uuid references public.school_classes (id) on delete cascade;
create index if not exists arena_challenges_class_idx on public.arena_challenges (class_id) where class_id is not null;
alter table public.arena_challenges drop constraint if exists arena_challenges_track_level_school_id_key;
create unique index if not exists arena_challenges_track_level_uniq on public.arena_challenges (track, level, coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid));

drop policy if exists arena_ch_read on public.arena_challenges;
create policy arena_ch_read on public.arena_challenges for select to anon, authenticated
  using (
    created_by = (select auth.uid())
    or (select private.is_platform_admin())
    or (status = 'published'
        and (school_id is null or private.is_school_member(school_id))
        and (class_id is null or private.is_class_member(class_id) or private.can_manage_class(class_id)))
  );
create policy arena_ch_teacher_insert on public.arena_challenges for insert to authenticated
  with check (
    created_by = (select auth.uid()) and school_id is null and not private.is_guest()
    and ((class_id is not null and private.can_manage_class(class_id))
         or (class_id is null and (private.has_role('teacher') or exists (select 1 from public.class_teachers ct where ct.user_id = (select auth.uid())))))
  );
create policy arena_ch_teacher_write on public.arena_challenges for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()) and (class_id is null or private.can_manage_class(class_id)));
create policy arena_ch_teacher_delete on public.arena_challenges for delete to authenticated using (created_by = (select auth.uid()));
create policy arena_q_teacher on public.arena_questions for all to authenticated
  using (exists (select 1 from public.arena_challenges c where c.id = challenge_id and c.created_by = (select auth.uid())))
  with check (exists (select 1 from public.arena_challenges c where c.id = challenge_id and c.created_by = (select auth.uid())));
grant select, insert, update, delete on public.arena_challenges, public.arena_questions to authenticated;

-- Only class members (and its teachers) can attempt a class challenge.
create or replace function private.guard_arena_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_class uuid;
begin
  select class_id into v_class from public.arena_challenges where id = new.challenge_id;
  if v_class is not null and not (private.is_class_member(v_class) or private.can_manage_class(v_class)) then
    raise exception 'This challenge is for members of its class. Join the class to play.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists arena_attempts_guard on public.arena_attempts;
create trigger arena_attempts_guard before insert on public.arena_attempts for each row execute function private.guard_arena_attempt();

-- Tell the class when a class challenge goes live.
create or replace function private.trg_class_challenge_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.class_id is null or new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  for r in select e.user_id from public.class_enrolments e where e.class_id = new.class_id and e.status = 'active' and e.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) loop
    perform private.notify(r.user_id, 'challenge', 'New class challenge: ' || left(new.title, 90), 'Can you top the class leaderboard?', '/arena/play/' || new.slug, jsonb_build_object('challenge_id', new.id));
  end loop;
  return new;
end $$;
drop trigger if exists arena_challenges_notify on public.arena_challenges;
create trigger arena_challenges_notify after insert or update of status on public.arena_challenges for each row execute function private.trg_class_challenge_notify();

grant execute on all functions in schema private to anon, authenticated;
