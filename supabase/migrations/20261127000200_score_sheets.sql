-- Round 4 · Score sheets: teachers record titled scores (e.g. "Mid-Sem Exams") and release
-- them privately — each learner sees only their own score.

create table public.score_sheets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes (id) on delete cascade,
  section_id uuid references public.class_sections (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 1000),
  category text not null default 'exam' check (category in ('exam', 'test', 'quiz', 'assignment', 'project', 'practical', 'other')),
  max_score numeric(7, 2) not null default 100 check (max_score > 0 and max_score <= 10000),
  status text not null default 'draft' check (status in ('draft', 'released')),
  show_class_stats boolean not null default false,
  released_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index score_sheets_class_idx on public.score_sheets (class_id, created_at desc);
create trigger score_sheets_touch before update on public.score_sheets for each row execute function private.touch_updated_at();

create table public.score_entries (
  sheet_id uuid not null references public.score_sheets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric(7, 2) check (score is null or score >= 0),
  absent boolean not null default false,
  remark text check (char_length(remark) <= 300),
  updated_at timestamptz not null default now(),
  primary key (sheet_id, user_id)
);
create index score_entries_user_idx on public.score_entries (user_id);

create or replace function private.can_see_sheet(p_sheet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.score_sheets s where s.id = p_sheet and (
    private.can_manage_class(s.class_id)
    or (s.status = 'released' and exists (select 1 from public.class_enrolments e where e.class_id = s.class_id and e.user_id = (select auth.uid())
          and e.status = 'active' and (s.section_id is null or e.section_id = s.section_id)))));
$$;

alter table public.score_sheets enable row level security;
alter table public.score_entries enable row level security;
-- Direct column checks (not a lookup by id) so INSERT … RETURNING works.
create or replace function private.sheet_audience_ok(p_class uuid, p_section uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_enrolments e where e.class_id = p_class and e.user_id = (select auth.uid())
    and e.status = 'active' and (p_section is null or e.section_id = p_section));
$$;
grant execute on function private.sheet_audience_ok(uuid, uuid) to authenticated;
create policy score_sheets_select on public.score_sheets for select to authenticated
  using (private.can_manage_class(class_id) or (status = 'released' and private.sheet_audience_ok(class_id, section_id)));
create policy score_sheets_insert on public.score_sheets for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_manage_class(class_id));
create policy score_sheets_update on public.score_sheets for update to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));
create policy score_sheets_delete on public.score_sheets for delete to authenticated using (private.can_manage_class(class_id));
create policy score_entries_select on public.score_entries for select to authenticated
  using (exists (select 1 from public.score_sheets s where s.id = sheet_id and (private.can_manage_class(s.class_id) or (s.status = 'released' and user_id = (select auth.uid())))));
create policy score_entries_write on public.score_entries for all to authenticated
  using (exists (select 1 from public.score_sheets s where s.id = sheet_id and private.can_manage_class(s.class_id)))
  with check (exists (select 1 from public.score_sheets s where s.id = sheet_id and private.can_manage_class(s.class_id)));
grant select, insert, update, delete on public.score_sheets, public.score_entries to authenticated;

create or replace function private.guard_score_sheet()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.section_id is not null and not exists (select 1 from public.class_sections s where s.id = new.section_id and s.class_id = new.class_id) then
    raise exception 'That section is not part of this class' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.class_id <> old.class_id then raise exception 'A score sheet cannot move to another class' using errcode = '42501'; end if;
  if new.status = 'released' and (tg_op = 'INSERT' or old.status <> 'released') then new.released_at := now(); end if;
  if new.status = 'draft' then new.released_at := null; end if;
  return new;
end $$;
create trigger score_sheets_guard before insert or update on public.score_sheets for each row execute function private.guard_score_sheet();

create or replace function private.guard_score_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_s public.score_sheets;
begin
  select * into v_s from public.score_sheets where id = new.sheet_id;
  if new.score is not null and new.score > v_s.max_score then
    raise exception 'Score % is above the maximum of %', new.score, v_s.max_score using errcode = '22023';
  end if;
  if not exists (select 1 from public.class_enrolments e where e.class_id = v_s.class_id and e.user_id = new.user_id and e.status = 'active') then
    raise exception 'That learner is not in this class' using errcode = 'P0001';
  end if;
  if new.absent then new.score := null; end if;
  new.remark := nullif(btrim(new.remark), '');
  new.updated_at := now();
  return new;
end $$;
create trigger score_entries_guard before insert or update on public.score_entries for each row execute function private.guard_score_entry();

-- Notify learners privately (no score in the push text — it may show on a lock screen).
create or replace function private.trg_score_released()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'released' and (tg_op = 'INSERT' or old.status <> 'released') then
    insert into public.notifications (user_id, type, title, body, link, data)
    select e.user_id, 'score', 'Your score is ready: ' || left(new.title, 90),
      'Only you can see it. ' || (select c.name from public.school_classes c where c.id = new.class_id), '/learn/scores',
      jsonb_build_object('sheet_id', new.id)
    from public.score_entries e where e.sheet_id = new.id and (e.score is not null or e.absent);
  end if;
  return new;
end $$;
create trigger score_sheets_released after insert or update of status on public.score_sheets for each row execute function private.trg_score_released();

create or replace function private.trg_score_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_s public.score_sheets;
begin
  select * into v_s from public.score_sheets where id = new.sheet_id;
  if v_s.status <> 'released' then return new; end if;
  if tg_op = 'UPDATE' and new.score is not distinct from old.score and new.absent = old.absent and new.remark is not distinct from old.remark then return new; end if;
  if new.score is null and not new.absent then return new; end if;
  if exists (select 1 from public.notifications n where n.user_id = new.user_id and n.type = 'score' and n.data ->> 'sheet_id' = v_s.id::text
             and n.created_at > now() - interval '15 minutes') then return new; end if;
  perform private.notify(new.user_id, 'score', case when tg_op = 'INSERT' then 'Your score is ready: ' else 'Score updated: ' end || left(v_s.title, 90),
    'Only you can see it.', '/learn/scores', jsonb_build_object('sheet_id', v_s.id));
  return new;
end $$;
create trigger score_entries_changed after insert or update on public.score_entries for each row execute function private.trg_score_changed();

-- A learner's released scores, with optional class statistics.
create or replace function public.my_scores()
returns table (sheet_id uuid, title text, category text, description text, class_id uuid, class_name text, max_score numeric,
               score numeric, absent boolean, remark text, released_at timestamptz, class_average numeric, class_highest numeric, entries bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.title, s.category, s.description, s.class_id, c.name, s.max_score, e.score, e.absent, e.remark, s.released_at,
    case when s.show_class_stats then (select round(avg(x.score), 1) from public.score_entries x where x.sheet_id = s.id and x.score is not null) end,
    case when s.show_class_stats then (select max(x.score) from public.score_entries x where x.sheet_id = s.id) end,
    case when s.show_class_stats then (select count(*) from public.score_entries x where x.sheet_id = s.id and x.score is not null) end
  from public.score_entries e
  join public.score_sheets s on s.id = e.sheet_id and s.status = 'released'
  join public.school_classes c on c.id = s.class_id
  where e.user_id = (select auth.uid()) and (e.score is not null or e.absent)
    and exists (select 1 from public.class_enrolments ce where ce.class_id = s.class_id and ce.user_id = e.user_id and ce.status = 'active')
  order by s.released_at desc;
$$;

revoke execute on function private.can_see_sheet(uuid) from public, anon;
grant execute on function private.can_see_sheet(uuid) to authenticated; -- used by RLS policies
revoke execute on function public.my_scores() from public, anon;
grant execute on function public.my_scores() to authenticated;
