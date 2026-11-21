-- =============================================================================
-- 0013 EduIntelligence (curriculum, AI Companion, Resource Studio),
--      EduLab (projects, activities) and Challenge Arena (games, XP, badges)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Curriculum frameworks (GES / NaCCA and others). Items are imported by
-- platform admins from official documents and must be APPROVED before the
-- AI Companion treats them as authoritative.
-- ---------------------------------------------------------------------------
create table public.curriculum_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  name text not null,
  authority text,
  country_code text not null default 'GH',
  level_band text,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  description text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  created_at timestamptz not null default now()
);

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.curriculum_frameworks (id) on delete cascade,
  parent_id uuid references public.curriculum_items (id) on delete cascade,
  kind text not null check (kind in ('subject', 'strand', 'sub_strand', 'content_standard', 'indicator', 'exemplar', 'core_competency')),
  code text,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  grade_level text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  search tsvector generated always as (to_tsvector('english', coalesce(code, '') || ' ' || title || ' ' || coalesce(description, ''))) stored,
  created_at timestamptz not null default now()
);
create index curriculum_items_framework_idx on public.curriculum_items (framework_id, kind);
create index curriculum_items_parent_idx on public.curriculum_items (parent_id);
create index curriculum_items_search_idx on public.curriculum_items using gin (search);
create unique index curriculum_items_code_uniq on public.curriculum_items (framework_id, code) where code is not null;

create table public.lesson_curriculum_links (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  item_id uuid not null references public.curriculum_items (id) on delete cascade,
  primary key (lesson_id, item_id)
);
create index lesson_curriculum_item_idx on public.lesson_curriculum_links (item_id);
create table public.course_curriculum_links (
  course_id uuid not null references public.courses (id) on delete cascade,
  item_id uuid not null references public.curriculum_items (id) on delete cascade,
  primary key (course_id, item_id)
);
create index course_curriculum_item_idx on public.course_curriculum_links (item_id);

alter table public.curriculum_frameworks enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.lesson_curriculum_links enable row level security;
alter table public.course_curriculum_links enable row level security;
create policy cf_read on public.curriculum_frameworks for select to anon, authenticated using (status <> 'archived' or (select private.is_platform_admin()));
create policy cf_admin on public.curriculum_frameworks for all to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy ci_read on public.curriculum_items for select to anon, authenticated using (status = 'approved' or (select private.is_platform_admin()));
create policy ci_admin on public.curriculum_items for all to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy lcl_read on public.lesson_curriculum_links for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and (private.can_manage_course(l.course_id) or private.is_enrolled(l.course_id))));
create policy lcl_write on public.lesson_curriculum_links for all to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and private.can_manage_course(l.course_id)))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and private.can_manage_course(l.course_id)));
create policy ccl_read on public.course_curriculum_links for select to anon, authenticated using (private.can_view_course(course_id));
create policy ccl_write on public.course_curriculum_links for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

-- Ranked search over APPROVED curriculum (used to ground the AI Companion).
create or replace function public.curriculum_search(p_query text, p_subject text default null, p_grade text default null, p_limit integer default 8)
returns table (id uuid, framework text, kind text, code text, title text, description text, grade_level text, path text, rank real)
language sql stable security definer set search_path = '' as $$
  with q as (select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq)
  select i.id, f.name, i.kind, i.code, i.title, i.description, i.grade_level,
    (select string_agg(a.title, ' › ' order by a.depth desc) from (
       with recursive anc(id, parent_id, title, depth) as (
         select p.id, p.parent_id, p.title, 1 from public.curriculum_items p where p.id = i.parent_id
         union all select p.id, p.parent_id, p.title, anc.depth + 1 from public.curriculum_items p join anc on p.id = anc.parent_id)
       select title, depth from anc) a),
    ts_rank(i.search, q.tsq)
  from public.curriculum_items i join public.curriculum_frameworks f on f.id = i.framework_id, q
  where i.status = 'approved' and f.status = 'approved' and i.search @@ q.tsq
    and (p_grade is null or i.grade_level is null or i.grade_level ilike p_grade)
    and (p_subject is null or exists (
      with recursive up(id, parent_id, kind, title) as (
        select x.id, x.parent_id, x.kind, x.title from public.curriculum_items x where x.id = i.id
        union all select x.id, x.parent_id, x.kind, x.title from public.curriculum_items x join up on x.id = up.parent_id)
      select 1 from up where up.kind = 'subject' and up.title ilike p_subject))
  order by 9 desc limit least(greatest(p_limit, 1), 20);
$$;

-- Admin bulk import: [{ref, parent_ref, kind, code, title, description, grade_level, position}]
create or replace function public.admin_import_curriculum(p_framework uuid, p_items jsonb, p_approve boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_map jsonb := '{}'::jsonb; v_id uuid; v_n integer := 0;
begin
  perform private.require_admin();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5000 then raise exception 'Provide up to 5000 items' using errcode = '22023'; end if;
  for v_row in select * from jsonb_array_elements(p_items) loop
    insert into public.curriculum_items (framework_id, parent_id, kind, code, title, description, grade_level, position, status)
    values (p_framework, (v_map ->> (v_row ->> 'parent_ref'))::uuid, v_row ->> 'kind', nullif(v_row ->> 'code', ''), v_row ->> 'title',
      nullif(v_row ->> 'description', ''), nullif(v_row ->> 'grade_level', ''), coalesce((v_row ->> 'position')::int, v_n),
      case when p_approve then 'approved' else 'draft' end)
    on conflict (framework_id, code) where code is not null do update set title = excluded.title, description = excluded.description,
      kind = excluded.kind, grade_level = excluded.grade_level, parent_id = excluded.parent_id
    returning id into v_id;
    if v_row ? 'ref' then v_map := v_map || jsonb_build_object(v_row ->> 'ref', v_id); end if;
    v_n := v_n + 1;
  end loop;
  perform private.audit('curriculum.imported', 'curriculum_framework', p_framework::text, jsonb_build_object('items', v_n, 'approved', p_approve));
  return v_n;
end $$;

-- Seed: framework records and the subject list (verified). Strands, sub-strands
-- and indicators must be imported from the official NaCCA documents.
insert into public.curriculum_frameworks (code, name, authority, country_code, level_band, source_url, description, status) values
  ('gh-ccp-b7-b10', 'Common Core Programme (B7–B10)', 'NaCCA / Ghana Education Service', 'GH', 'JHS (Basic 7–9) and Basic 10',
   'https://nacca.gov.gh', 'Standards-based Common Core Programme curriculum. Import strands, sub-strands, content standards and indicators from the official NaCCA documents.', 'approved'),
  ('gh-shs-2024', 'Senior High School Curriculum (2024)', 'NaCCA / Ghana Education Service', 'GH', 'SHS 1–3',
   'https://nacca.gov.gh', 'New SHS curriculum rolled out from 2024. Import subjects and standards from the official NaCCA documents.', 'draft')
on conflict (code) do nothing;
insert into public.curriculum_items (framework_id, kind, title, position, status)
select f.id, 'subject', s.title, s.pos, 'approved'
from public.curriculum_frameworks f, (values ('English Language', 1), ('Mathematics', 2), ('Science', 3), ('Computing', 4), ('Social Studies', 5),
  ('Religious and Moral Education', 6), ('Career Technology', 7), ('Creative Arts and Design', 8), ('Physical and Health Education', 9),
  ('Ghanaian Language', 10), ('French', 11)) as s(title, pos)
where f.code = 'gh-ccp-b7-b10'
  and not exists (select 1 from public.curriculum_items i where i.framework_id = f.id and i.kind = 'subject' and i.title = s.title);

-- ---------------------------------------------------------------------------
-- AI Companion (tutor) and Teacher Resource Studio
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'tutor' check (mode in ('tutor', 'studio')),
  title text not null default 'New conversation',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_touch before update on public.ai_conversations for each row execute function private.touch_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 40000),
  citations jsonb not null default '[]'::jsonb,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'Africa/Accra')::date,
  requests integer not null default 0,
  tokens integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_msg_own on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy ai_msg_insert on public.ai_messages for insert to authenticated
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy ai_usage_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Called by the API worker (as the user) before each AI request.
create or replace function public.ai_consume(p_tokens integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_limit integer := private.feature_limit('ai_requests_per_day');
  v_enabled boolean := private.has_feature('ai_requests_per_day');
  v_used integer;
  v_day date := (now() at time zone 'Africa/Accra')::date;
  v_busy boolean;
begin
  if not v_enabled then return jsonb_build_object('allowed', false, 'reason', 'AI Companion is not included in your plan.'); end if;
  -- Academic integrity: no AI help while a timed or graded attempt is open.
  v_busy := exists (select 1 from public.assessment_attempts t join public.assessments a on a.id = t.assessment_id
                    where t.user_id = v_uid and t.status = 'in_progress' and a.kind <> 'practice' and (t.deadline_at is null or t.deadline_at > now()));
  if v_busy then return jsonb_build_object('allowed', false, 'reason', 'The AI Companion is paused while you have an assessment in progress. Good luck!'); end if;
  insert into public.ai_usage (user_id, day, requests, tokens) values (v_uid, v_day, 0, 0) on conflict do nothing;
  select requests into v_used from public.ai_usage where user_id = v_uid and day = v_day for update;
  if v_limit is not null and v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', format('You have used all %s AI requests for today. Your allowance resets tomorrow.', v_limit), 'limit', v_limit, 'remaining', 0);
  end if;
  update public.ai_usage set requests = requests + 1, tokens = tokens + greatest(p_tokens, 0) where user_id = v_uid and day = v_day;
  return jsonb_build_object('allowed', true, 'limit', v_limit, 'remaining', case when v_limit is null then null else v_limit - v_used - 1 end,
    'is_teacher', private.has_role('teacher') or exists (select 1 from public.school_memberships m where m.user_id = v_uid and m.status = 'active' and m.role in ('teacher', 'school_admin'))
       or exists (select 1 from public.class_teachers ct where ct.user_id = v_uid));
end $$;

-- Lesson context for grounding (only if the caller can access the lesson).
create or replace function public.ai_lesson_context(p_lesson uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_l public.lessons;
begin
  perform private.require_user();
  select * into v_l from public.lessons where id = p_lesson;
  if not found or not private.can_access_lesson_content(p_lesson) then return null; end if;
  return jsonb_build_object(
    'lesson_title', v_l.title, 'summary', v_l.summary,
    'course_title', (select title from public.courses where id = v_l.course_id),
    'subject', (select subject from public.courses where id = v_l.course_id),
    'text', (select string_agg(coalesce(b.content ->> 'text', '') || ' ' || coalesce(b.content ->> 'instructions', '') || ' ' || coalesce(b.content ->> 'code', ''), E'\n' order by b.position)
             from public.lesson_blocks b where b.lesson_id = p_lesson),
    'curriculum', (select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'title', i.title)), '[]'::jsonb)
                   from public.lesson_curriculum_links lc join public.curriculum_items i on i.id = lc.item_id where lc.lesson_id = p_lesson and i.status = 'approved'));
end $$;

create table public.teacher_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('lesson_plan', 'lesson_note', 'question_set', 'scheme_of_work', 'rubric', 'worksheet', 'activity', 'other')),
  title text not null check (char_length(title) between 2 and 200),
  subject text,
  grade_level text,
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  curriculum_item_ids uuid[] not null default '{}',
  content jsonb not null default '{}'::jsonb check (pg_column_size(content) < 300000),
  body_md text check (char_length(body_md) <= 100000),
  status text not null default 'draft' check (status in ('draft', 'final')),
  school_id uuid references public.schools (id) on delete set null,
  is_shared boolean not null default false,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teacher_resources_owner_idx on public.teacher_resources (owner_id, updated_at desc);
create index teacher_resources_school_idx on public.teacher_resources (school_id) where is_shared;
create trigger teacher_resources_touch before update on public.teacher_resources for each row execute function private.touch_updated_at();
alter table public.teacher_resources enable row level security;
create policy tr_select on public.teacher_resources for select to authenticated
  using (owner_id = (select auth.uid()) or (is_shared and school_id is not null and private.is_school_staff(school_id)) or (select private.is_platform_admin()));
create policy tr_write on public.teacher_resources for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and not private.is_guest()
    and (school_id is null or private.is_school_staff(school_id)));

-- ---------------------------------------------------------------------------
-- EduLab
-- ---------------------------------------------------------------------------
create table public.lab_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled project' check (char_length(title) between 1 and 120),
  language text not null check (language in ('python', 'javascript', 'typescript', 'web', 'sql', 'c', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'ruby', 'kotlin')),
  files jsonb not null default '[]'::jsonb check (pg_column_size(files) < 500000),
  is_public boolean not null default false,
  share_slug text unique default encode(extensions.gen_random_bytes(6), 'hex'),
  activity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lab_projects_owner_idx on public.lab_projects (owner_id, updated_at desc);
create trigger lab_projects_touch before update on public.lab_projects for each row execute function private.touch_updated_at();
alter table public.lab_projects enable row level security;
create policy lab_proj_own on public.lab_projects for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy lab_proj_public on public.lab_projects for select to anon, authenticated using (is_public);

create table public.lab_activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  lab text not null check (lab in ('code', 'science', 'math', 'typing')),
  tool text not null,
  title text not null,
  summary text,
  instructions text not null default '',
  subject text,
  level text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lab_projects add constraint lab_projects_activity_fk foreign key (activity_id) references public.lab_activities (id) on delete set null;
create table public.lab_progress (
  activity_id uuid not null references public.lab_activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  best_score numeric(5, 2),
  updated_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table public.lab_activities enable row level security;
alter table public.lab_progress enable row level security;
create policy lab_act_read on public.lab_activities for select to anon, authenticated using (status = 'published' or created_by = (select auth.uid()) or (select private.is_platform_admin()));
create policy lab_act_write on public.lab_activities for all to authenticated
  using (created_by = (select auth.uid()) or (select private.is_platform_admin()))
  with check ((created_by = (select auth.uid()) and (private.has_role('teacher') or private.is_platform_admin())) or (select private.is_platform_admin()));
create policy lab_prog_own on public.lab_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Lessons can embed lab activities.
alter type public.lesson_block_type add value if not exists 'lab';

-- ---------------------------------------------------------------------------
-- Gamification: XP, levels, streaks, badges
-- ---------------------------------------------------------------------------
create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);
create table public.badges (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null default 'award',
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum'))
);
create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);
alter table public.user_progress enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy up_own on public.user_progress for select to authenticated using (user_id = (select auth.uid()) or private.is_staff_of_user(user_id) or private.teaches_user(user_id));
create policy badges_read on public.badges for select to anon, authenticated using (true);
create policy ub_read on public.user_badges for select to authenticated using (user_id = (select auth.uid()) or private.is_staff_of_user(user_id) or private.teaches_user(user_id));

insert into public.badges (code, name, description, icon, tier) values
  ('first_steps', 'First Steps', 'Completed your first lesson', 'footprints', 'bronze'),
  ('first_challenge', 'Arena Debut', 'Finished your first Arena challenge', 'swords', 'bronze'),
  ('streak_3', 'On a Roll', 'Learned 3 days in a row', 'flame', 'bronze'),
  ('streak_7', 'Week Warrior', 'Learned 7 days in a row', 'flame', 'silver'),
  ('streak_30', 'Unstoppable', 'Learned 30 days in a row', 'flame', 'gold'),
  ('perfect_score', 'Flawless', 'Scored 100% in an Arena challenge', 'target', 'silver'),
  ('math_sprinter', 'Math Sprinter', 'Cleared Math Sprint level 5', 'zap', 'silver'),
  ('typing_40', 'Swift Fingers', 'Typed 40+ words per minute with 95% accuracy', 'keyboard', 'silver'),
  ('code_quester', 'Code Quester', 'Completed 5 Code Quest challenges', 'code', 'silver'),
  ('word_wizard', 'Word Wizard', 'Cleared Word Builder level 5', 'spell-check', 'silver'),
  ('helper', 'Helping Hand', 'Received 10 “helpful” reactions from classmates', 'hand-heart', 'silver'),
  ('course_finisher', 'Finisher', 'Completed a course', 'graduation-cap', 'gold'),
  ('xp_1000', 'Rising Star', 'Earned 1,000 XP', 'star', 'gold')
on conflict (code) do nothing;

create or replace function private.award_badge(p_user uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_badges (user_id, badge_code) values (p_user, p_code) on conflict do nothing;
  if found then
    perform private.notify(p_user, 'badge', 'Badge earned: ' || (select name from public.badges where code = p_code),
      (select description from public.badges where code = p_code), '/arena', jsonb_build_object('badge', p_code));
  end if;
end $$;

-- Adds XP and updates daily streak (Africa/Accra calendar days).
create or replace function private.add_xp(p_user uuid, p_xp integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Africa/Accra')::date; v_p public.user_progress;
begin
  insert into public.user_progress (user_id) values (p_user) on conflict do nothing;
  select * into v_p from public.user_progress where user_id = p_user for update;
  update public.user_progress set
    xp = xp + greatest(p_xp, 0),
    current_streak = case when v_p.last_active_date = v_today then current_streak
                          when v_p.last_active_date = v_today - 1 then current_streak + 1 else 1 end,
    last_active_date = v_today, updated_at = now()
  where user_id = p_user returning * into v_p;
  update public.user_progress set level = floor(sqrt(xp / 50.0))::int + 1, longest_streak = greatest(longest_streak, current_streak) where user_id = p_user
  returning * into v_p;
  if v_p.current_streak >= 3 then perform private.award_badge(p_user, 'streak_3'); end if;
  if v_p.current_streak >= 7 then perform private.award_badge(p_user, 'streak_7'); end if;
  if v_p.current_streak >= 30 then perform private.award_badge(p_user, 'streak_30'); end if;
  if v_p.xp >= 1000 then perform private.award_badge(p_user, 'xp_1000'); end if;
end $$;

-- Learning activity earns XP: lessons 10, enrolment 5, course completion 100.
create or replace function private.trg_activity_xp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_xp(new.user_id, case new.kind when 'lesson_completed' then 10 when 'course_completed' then 100 when 'enrolled' then 5 else 0 end);
  if new.kind = 'lesson_completed' then perform private.award_badge(new.user_id, 'first_steps'); end if;
  if new.kind = 'course_completed' then perform private.award_badge(new.user_id, 'course_finisher'); end if;
  return new;
end $$;
create trigger learning_activity_xp after insert on public.learning_activity for each row execute function private.trg_activity_xp();

create or replace function private.trg_reaction_badge()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select user_id into v_author from public.classroom_messages where id = new.message_id;
  if new.kind = 'helpful' then
    perform private.add_xp(v_author, 5);
    if (select count(*) from public.message_reactions r join public.classroom_messages m on m.id = r.message_id where m.user_id = v_author and r.kind = 'helpful') >= 10 then
      perform private.award_badge(v_author, 'helper');
    end if;
  end if;
  return new;
end $$;
create trigger message_reactions_badge after insert on public.message_reactions for each row execute function private.trg_reaction_badge();

-- ---------------------------------------------------------------------------
-- Challenge Arena (optional, game-based practice with levels & leaderboards)
-- ---------------------------------------------------------------------------
create table public.arena_challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  game text not null check (game in ('quiz_rush', 'math_sprint', 'code_quest', 'typing_race', 'word_builder')),
  track text not null,
  title text not null,
  description text not null default '',
  subject text,
  level integer not null default 1 check (level between 1 and 50),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  time_limit_seconds integer not null default 120 check (time_limit_seconds between 15 and 3600),
  xp_reward integer not null default 50 check (xp_reward between 0 and 1000),
  config jsonb not null default '{}'::jsonb,
  school_id uuid references public.schools (id) on delete cascade,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (track, level, school_id)
);
create index arena_challenges_track_idx on public.arena_challenges (track, level);

-- Hidden answers for quiz/word games (never readable by clients).
create table public.arena_questions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.arena_challenges (id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer text not null,
  explanation text,
  position integer not null default 0
);
create index arena_questions_challenge_idx on public.arena_questions (challenge_id);

create table public.arena_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.arena_challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished', 'expired')),
  payload jsonb not null default '{}'::jsonb,
  secret jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  finished_at timestamptz,
  score numeric(7, 2),
  max_score numeric(7, 2),
  accuracy numeric(5, 2),
  time_ms integer,
  xp_awarded integer not null default 0,
  verified boolean not null default true,
  result jsonb not null default '{}'::jsonb
);
create index arena_attempts_user_idx on public.arena_attempts (user_id, challenge_id, finished_at desc);
create index arena_attempts_challenge_idx on public.arena_attempts (challenge_id, score desc);

alter table public.arena_challenges enable row level security;
alter table public.arena_questions enable row level security;
alter table public.arena_attempts enable row level security;
create policy arena_ch_read on public.arena_challenges for select to anon, authenticated
  using (status = 'published' and (school_id is null or private.is_school_member(school_id)) or (select private.is_platform_admin()));
create policy arena_ch_admin on public.arena_challenges for all to authenticated
  using ((select private.is_platform_admin()) or (school_id is not null and private.is_school_staff(school_id)))
  with check ((select private.is_platform_admin()) or (school_id is not null and private.is_school_staff(school_id)));
create policy arena_q_admin on public.arena_questions for all to authenticated
  using (exists (select 1 from public.arena_challenges c where c.id = challenge_id and ((select private.is_platform_admin()) or (c.school_id is not null and private.is_school_staff(c.school_id)))))
  with check (exists (select 1 from public.arena_challenges c where c.id = challenge_id and ((select private.is_platform_admin()) or (c.school_id is not null and private.is_school_staff(c.school_id)))));
create policy arena_att_own on public.arena_attempts for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.arena_unlocked(p_user uuid, p_ch public.arena_challenges)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_ch.level = 1 or exists (
    select 1 from public.arena_attempts t join public.arena_challenges c on c.id = t.challenge_id
    where t.user_id = p_user and t.status = 'finished' and c.track = p_ch.track and c.level = p_ch.level - 1
      and t.max_score > 0 and t.score >= 0.6 * t.max_score);
$$;

create or replace function private.scramble(p_word text)
returns text language plpgsql volatile set search_path = '' as $$
declare v text; i integer := 0;
begin
  loop
    v := (select string_agg(ch, '' order by random()) from regexp_split_to_table(upper(p_word), '') ch);
    i := i + 1;
    exit when v <> upper(p_word) or i > 5 or length(p_word) < 2;
  end loop;
  return v;
end $$;

create or replace function public.arena_start(p_challenge uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_c public.arena_challenges;
  v_payload jsonb; v_secret jsonb := '{}'::jsonb; v_id uuid;
  v_ops text[]; v_min int; v_max int; v_count int; v_op text; v_a int; v_b int; v_ans int;
  v_items jsonb := '[]'::jsonb; v_answers jsonb := '[]'::jsonb; i int;
begin
  select * into v_c from public.arena_challenges where id = p_challenge and status = 'published';
  if not found or (v_c.school_id is not null and not private.is_school_member(v_c.school_id)) then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if not private.arena_unlocked(v_uid, v_c) then raise exception 'Clear the previous level (60%%+) to unlock this one' using errcode = 'P0001'; end if;
  update public.arena_attempts set status = 'expired' where user_id = v_uid and status = 'in_progress' and deadline_at < now() - interval '1 minute';

  if v_c.game = 'math_sprint' then
    v_ops := array(select jsonb_array_elements_text(coalesce(v_c.config -> 'ops', '["+"]')));
    v_min := coalesce((v_c.config ->> 'min')::int, 1); v_max := coalesce((v_c.config ->> 'max')::int, 10); v_count := coalesce((v_c.config ->> 'count')::int, 15);
    for i in 1..v_count loop
      v_op := v_ops[1 + floor(random() * cardinality(v_ops))::int];
      v_a := v_min + floor(random() * (v_max - v_min + 1))::int; v_b := v_min + floor(random() * (v_max - v_min + 1))::int;
      if v_op = '-' and v_b > v_a then select v_b, v_a into v_a, v_b; end if;
      if v_op = '÷' then v_b := greatest(v_b, 1); v_a := v_b * (v_min + floor(random() * (least(v_max, 12) - v_min + 1))::int); end if;
      v_ans := case v_op when '+' then v_a + v_b when '-' then v_a - v_b when '×' then v_a * v_b when '÷' then v_a / v_b end;
      v_items := v_items || jsonb_build_object('i', i, 'text', v_a || ' ' || v_op || ' ' || v_b);
      v_answers := v_answers || to_jsonb(v_ans);
    end loop;
    v_payload := jsonb_build_object('problems', v_items); v_secret := jsonb_build_object('answers', v_answers);
  elsif v_c.game = 'quiz_rush' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt,
             'options', (select jsonb_agg(o order by random()) from jsonb_array_elements(q.options) o)) order by random()), '[]'::jsonb),
           coalesce(jsonb_object_agg(q.id, jsonb_build_object('answer', q.answer, 'explanation', q.explanation)), '{}'::jsonb)
      into v_items, v_answers
      from (select * from public.arena_questions where challenge_id = p_challenge order by random() limit coalesce((v_c.config ->> 'count')::int, 10)) q;
    v_payload := jsonb_build_object('questions', v_items); v_secret := jsonb_build_object('answers', v_answers);
  elsif v_c.game = 'word_builder' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'letters', private.scramble(q.answer), 'hint', q.prompt, 'length', length(q.answer)) order by random()), '[]'::jsonb),
           coalesce(jsonb_object_agg(q.id, jsonb_build_object('answer', upper(q.answer), 'explanation', q.explanation)), '{}'::jsonb)
      into v_items, v_answers
      from (select * from public.arena_questions where challenge_id = p_challenge order by random() limit coalesce((v_c.config ->> 'count')::int, 8)) q;
    v_payload := jsonb_build_object('words', v_items); v_secret := jsonb_build_object('answers', v_answers);
  elsif v_c.game = 'typing_race' then
    v_payload := jsonb_build_object('passage', v_c.config ->> 'passage');
    v_secret := jsonb_build_object('passage', v_c.config ->> 'passage');
  else -- code_quest: tests run in the learner's browser (self-checked)
    v_payload := jsonb_build_object('language', v_c.config ->> 'language', 'starter', v_c.config ->> 'starter', 'prompt', v_c.config ->> 'prompt',
      'function', v_c.config ->> 'function', 'tests', v_c.config -> 'tests');
  end if;

  insert into public.arena_attempts (challenge_id, user_id, payload, secret, deadline_at)
  values (p_challenge, v_uid, v_payload, v_secret, now() + make_interval(secs => v_c.time_limit_seconds + 5))
  returning id into v_id;
  return jsonb_build_object('attempt_id', v_id, 'payload', v_payload, 'time_limit_seconds', v_c.time_limit_seconds, 'server_now', now(), 'game', v_c.game, 'title', v_c.title);
end $$;

create or replace function private.levenshtein_ratio(a text, b text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare la int := length(a); lb int := length(b); n int; matches int := 0; i int;
begin
  -- position-wise match ratio (cheap, adequate for typing accuracy)
  n := greatest(la, lb);
  if n = 0 then return 1; end if;
  for i in 1..least(la, lb) loop if substr(a, i, 1) = substr(b, i, 1) then matches := matches + 1; end if; end loop;
  return round(matches::numeric / n, 4);
end $$;

create or replace function public.arena_submit(p_attempt uuid, p_answers jsonb, p_client jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_t public.arena_attempts; v_c public.arena_challenges;
  v_score numeric := 0; v_max numeric := 0; v_acc numeric; v_ms integer; v_xp integer := 0; v_detail jsonb := '[]'::jsonb;
  v_key text; v_val jsonb; v_given text; v_ok boolean; v_first boolean; v_wpm numeric; v_typed text; v_passage text; v_minutes numeric;
  v_passed int; v_total int;
begin
  select * into v_t from public.arena_attempts where id = p_attempt for update;
  if not found or v_t.user_id <> v_uid then raise exception 'Attempt not found' using errcode = 'P0002'; end if;
  if v_t.status <> 'in_progress' then raise exception 'This attempt is already finished' using errcode = 'P0001'; end if;
  select * into v_c from public.arena_challenges where id = v_t.challenge_id;
  v_ms := least(extract(epoch from (now() - v_t.started_at)) * 1000, v_c.time_limit_seconds * 1000 + 5000)::int;

  if v_c.game = 'math_sprint' then
    v_max := jsonb_array_length(v_t.secret -> 'answers');
    for i in 0..v_max - 1 loop
      v_given := p_answers ->> i;
      v_ok := v_given is not null and btrim(v_given) ~ '^-?\d+$' and btrim(v_given)::numeric = (v_t.secret -> 'answers' ->> i)::numeric;
      if v_ok then v_score := v_score + 1; end if;
      v_detail := v_detail || jsonb_build_object('i', i + 1, 'correct', v_ok, 'answer', v_t.secret -> 'answers' -> i);
    end loop;
  elsif v_c.game in ('quiz_rush', 'word_builder') then
    for v_key, v_val in select * from jsonb_each(v_t.secret -> 'answers') loop
      v_max := v_max + 1;
      v_given := upper(btrim(coalesce(p_answers ->> v_key, '')));
      v_ok := v_given <> '' and v_given = upper(v_val ->> 'answer');
      if v_ok then v_score := v_score + 1; end if;
      v_detail := v_detail || jsonb_build_object('id', v_key, 'correct', v_ok, 'answer', v_val ->> 'answer', 'explanation', v_val ->> 'explanation');
    end loop;
  elsif v_c.game = 'typing_race' then
    v_typed := coalesce(p_answers ->> 'typed', ''); v_passage := v_t.secret ->> 'passage';
    v_acc := private.levenshtein_ratio(v_typed, left(v_passage, greatest(length(v_typed), 1)));
    v_minutes := greatest(v_ms / 60000.0, 0.05);
    v_wpm := round((length(v_typed) / 5.0) * v_acc / v_minutes, 1);  -- server-timed
    v_max := 100; v_score := least(100, round(v_wpm * (length(v_typed)::numeric / greatest(length(v_passage), 1)) * 1.5, 2));
    v_detail := jsonb_build_object('wpm', v_wpm, 'accuracy', round(v_acc * 100, 1), 'completed_pct', round(100.0 * length(v_typed) / greatest(length(v_passage), 1), 1));
    if v_wpm >= 40 and v_acc >= 0.95 then perform private.award_badge(v_uid, 'typing_40'); end if;
  else -- code_quest (self-checked)
    v_passed := least(coalesce((p_answers ->> 'passed')::int, 0), coalesce(jsonb_array_length(v_c.config -> 'tests'), 0));
    v_total := coalesce(jsonb_array_length(v_c.config -> 'tests'), 0);
    v_max := greatest(v_total, 1); v_score := v_passed;
    update public.arena_attempts set verified = false where id = p_attempt;
  end if;

  v_acc := coalesce(v_acc * 100, case when v_max > 0 then round(100 * v_score / v_max, 2) end);
  v_first := not exists (select 1 from public.arena_attempts where user_id = v_uid and challenge_id = v_c.id and status = 'finished' and score >= 0.6 * max_score);
  v_xp := round(v_c.xp_reward * (case when v_max > 0 then v_score / v_max else 0 end) * case when v_first then 1 else 0.25 end)::int;
  update public.arena_attempts set status = 'finished', finished_at = now(), score = v_score, max_score = v_max, accuracy = v_acc, time_ms = v_ms,
    xp_awarded = v_xp, result = jsonb_build_object('detail', v_detail) where id = p_attempt;
  perform private.add_xp(v_uid, v_xp);
  perform private.award_badge(v_uid, 'first_challenge');
  if v_max > 0 and v_score = v_max and v_c.game <> 'code_quest' then perform private.award_badge(v_uid, 'perfect_score'); end if;
  if v_c.game = 'math_sprint' and v_c.level >= 5 and v_score >= 0.6 * v_max then perform private.award_badge(v_uid, 'math_sprinter'); end if;
  if v_c.game = 'word_builder' and v_c.level >= 5 and v_score >= 0.6 * v_max then perform private.award_badge(v_uid, 'word_wizard'); end if;
  if v_c.game = 'code_quest' and (select count(distinct challenge_id) from public.arena_attempts t where t.user_id = v_uid and t.status = 'finished'
       and t.score = t.max_score and exists (select 1 from public.arena_challenges c2 where c2.id = t.challenge_id and c2.game = 'code_quest')) >= 5 then
    perform private.award_badge(v_uid, 'code_quester');
  end if;
  return jsonb_build_object('score', v_score, 'max_score', v_max, 'accuracy', v_acc, 'time_ms', v_ms, 'xp', v_xp, 'first_clear', v_first and v_max > 0 and v_score >= 0.6 * v_max,
    'passed', v_max > 0 and v_score >= 0.6 * v_max, 'detail', v_detail, 'verified', v_c.game <> 'code_quest');
end $$;

-- Leaderboards: by best challenge score, or by XP earned in the period.
create or replace function public.arena_leaderboard(p_challenge uuid default null, p_scope text default 'global', p_scope_id uuid default null, p_period text default 'all', p_limit integer default 50)
returns table (rank bigint, user_id uuid, name text, avatar_url text, score numeric, time_ms integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_since timestamptz;
begin
  if p_scope = 'class' and not private.is_class_member(p_scope_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_scope = 'school' and not private.is_school_member(p_scope_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  v_since := case p_period when 'week' then now() - interval '7 days' when 'month' then now() - interval '30 days' else '-infinity'::timestamptz end;
  return query
  with eligible as (
    select t.user_id, t.score, t.time_ms, t.xp_awarded, t.challenge_id from public.arena_attempts t
    where t.status = 'finished' and t.finished_at >= v_since and t.verified
      and (p_challenge is null or t.challenge_id = p_challenge)
      and (p_scope = 'global'
        or (p_scope = 'class' and exists (select 1 from public.class_enrolments e where e.class_id = p_scope_id and e.user_id = t.user_id and e.status = 'active'))
        or (p_scope = 'school' and exists (select 1 from public.school_memberships m where m.school_id = p_scope_id and m.user_id = t.user_id and m.status = 'active')))
  ), agg as (
    select e.user_id,
      case when p_challenge is null then sum(e.xp_awarded)::numeric else max(e.score) end as s,
      case when p_challenge is null then null else min(e.time_ms) filter (where e.score = (select max(e2.score) from eligible e2 where e2.user_id = e.user_id)) end as t
    from eligible e group by e.user_id
  ), ranked as (
    select a.*, rank() over (order by a.s desc, a.t asc nulls last) as rk from agg a
  )
  select r.rk, case when r.user_id = v_uid then r.user_id end,
    case when p.leaderboard_opt_out and r.user_id <> v_uid then 'Anonymous learner' else coalesce(nullif(p.display_name, ''), split_part(p.full_name, ' ', 1), 'Learner') end,
    case when p.leaderboard_opt_out and r.user_id <> v_uid then null else p.avatar_url end,
    r.s, r.t::int, r.user_id = v_uid
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rk <= p_limit or r.user_id = v_uid
  order by r.rk;
end $$;

create or replace function public.my_arena_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'progress', (select to_jsonb(p) from public.user_progress p where p.user_id = v_uid),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'description', b.description, 'icon', b.icon, 'tier', b.tier, 'awarded_at', ub.awarded_at) order by ub.awarded_at desc)
      from public.user_badges ub join public.badges b on b.code = ub.badge_code where ub.user_id = v_uid), '[]'::jsonb),
    'best', coalesce((select jsonb_object_agg(challenge_id, jsonb_build_object('score', s, 'max', m, 'cleared', s >= 0.6 * m)) from (
       select challenge_id, max(score) s, max(max_score) m from public.arena_attempts where user_id = v_uid and status = 'finished' group by challenge_id) x), '{}'::jsonb),
    'global_rank', (select rk from (select user_id, rank() over (order by xp desc) rk from public.user_progress) r where r.user_id = v_uid)
  );
end $$;

-- Grants
grant select, insert, update, delete on public.curriculum_frameworks, public.curriculum_items, public.lesson_curriculum_links, public.course_curriculum_links,
  public.ai_conversations, public.teacher_resources, public.lab_projects, public.lab_activities, public.lab_progress, public.arena_challenges, public.arena_questions to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select on public.ai_usage, public.user_progress, public.badges, public.user_badges to authenticated;
grant select on public.curriculum_frameworks, public.curriculum_items, public.badges, public.arena_challenges, public.lab_activities, public.lab_projects, public.course_curriculum_links to anon;
-- Arena attempts: no access to the hidden `secret` column.
revoke all on public.arena_attempts from authenticated, anon;
grant select (id, challenge_id, user_id, status, payload, started_at, deadline_at, finished_at, score, max_score, accuracy, time_ms, xp_awarded, verified, result) on public.arena_attempts to authenticated;
revoke all on public.arena_questions from anon;

grant execute on function public.curriculum_search(text, text, text, integer) to anon, authenticated;
grant execute on function public.admin_import_curriculum(uuid, jsonb, boolean), public.ai_consume(integer), public.ai_lesson_context(uuid),
  public.arena_start(uuid), public.arena_submit(uuid, jsonb, jsonb), public.arena_leaderboard(uuid, text, uuid, text, integer), public.my_arena_summary() to authenticated;
revoke execute on function public.admin_import_curriculum(uuid, jsonb, boolean), public.ai_consume(integer), public.ai_lesson_context(uuid),
  public.arena_start(uuid), public.arena_submit(uuid, jsonb, jsonb), public.arena_leaderboard(uuid, text, uuid, text, integer), public.my_arena_summary() from anon;
grant execute on all functions in schema private to anon, authenticated;
revoke execute on function private.award_badge(uuid, text), private.add_xp(uuid, integer) from anon, authenticated;

-- AI allowance feature
insert into public.features (key, name, description, kind, sort_order) values
  ('ai_requests_per_day', 'AI Companion requests per day', 'Daily AI Companion / Resource Studio requests', 'limit', 11)
on conflict (key) do nothing;
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, 'ai_requests_per_day', true, case p.code when 'edu_free' then 15 when 'edu_teacher' then 40 when 'edu_school' then 20
  when 'edupro_individual' then 150 when 'edupro_teacher' then 300 when 'edupro_school' then 150 end
from public.plans p on conflict do nothing;
insert into public.platform_settings (key, value, is_public, description) values
  ('ai.enabled', 'true', true, 'Turn the AI Companion and Resource Studio on or off'),
  ('ai.curriculum_framework', '"gh-ccp-b7-b10"', true, 'Default curriculum framework the AI Companion prioritises')
on conflict (key) do nothing;
