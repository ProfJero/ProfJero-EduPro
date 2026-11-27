-- Round 4 · Platform feedback: the owner/admins publish short forms; learners and
-- teachers answer them in the app. Anonymous forms never reveal who answered.

create or replace function private.is_teacher_user(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = p_user and r.role in ('teacher', 'school_admin'))
      or exists (select 1 from public.class_teachers ct where ct.user_id = p_user)
      or exists (select 1 from public.school_classes c where c.owner_id = p_user)
      or exists (select 1 from public.school_memberships m where m.user_id = p_user and m.role in ('teacher', 'school_admin'));
$$;

create table public.feedback_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text check (char_length(description) <= 2000),
  audience text not null default 'all' check (audience in ('all', 'learners', 'teachers')),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 30),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  anonymous boolean not null default false,
  nudge boolean not null default true,
  closes_at timestamptz,
  opened_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_forms_status_idx on public.feedback_forms (status, created_at desc);
create trigger feedback_forms_touch before update on public.feedback_forms for each row execute function private.touch_updated_at();

create table public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.feedback_forms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  respondent_role text not null default 'learner' check (respondent_role in ('learner', 'teacher')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  unique (form_id, user_id)
);
create index feedback_responses_form_idx on public.feedback_responses (form_id, created_at);

create or replace function private.feedback_form_visible(p_form uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feedback_forms f where f.id = p_form and f.status = 'open'
    and (f.closes_at is null or f.closes_at > now())
    and (f.audience = 'all'
      or (f.audience = 'teachers' and private.is_teacher_user((select auth.uid())))
      or (f.audience = 'learners' and not private.is_teacher_user((select auth.uid())))));
$$;

alter table public.feedback_forms enable row level security;
alter table public.feedback_responses enable row level security;
create policy feedback_forms_select on public.feedback_forms for select to authenticated
  using ((select private.is_platform_admin()) or (not private.is_guest() and private.feedback_form_visible(id)));
create policy feedback_forms_admin on public.feedback_forms for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy feedback_responses_own on public.feedback_responses for select to authenticated using (user_id = (select auth.uid()));
create policy feedback_responses_insert on public.feedback_responses for insert to authenticated
  with check (user_id = (select auth.uid()) and not private.is_guest() and private.feedback_form_visible(form_id));
grant select, insert, update, delete on public.feedback_forms to authenticated;
grant select, insert on public.feedback_responses to authenticated;

-- Question shape: {id, type: rating|scale|choice|multi|yesno|text, label, required, options[]}
create or replace function private.guard_feedback_form()
returns trigger language plpgsql security definer set search_path = '' as $$
declare q jsonb; v_ids text[] := '{}';
begin
  for q in select * from jsonb_array_elements(new.questions) loop
    if jsonb_typeof(q) <> 'object' or coalesce(q ->> 'id', '') = '' or (q ->> 'id') = any (v_ids) then
      raise exception 'Every question needs a unique id' using errcode = '22023';
    end if;
    v_ids := v_ids || (q ->> 'id');
    if coalesce(q ->> 'type', '') not in ('rating', 'scale', 'choice', 'multi', 'yesno', 'text') then
      raise exception 'Unknown question type %', q ->> 'type' using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(q ->> 'label', ''))) not between 2 and 300 then
      raise exception 'Each question needs a label (2–300 characters)' using errcode = '22023';
    end if;
    if (q ->> 'type') in ('choice', 'multi') and (jsonb_typeof(q -> 'options') <> 'array' or jsonb_array_length(q -> 'options') < 2 or jsonb_array_length(q -> 'options') > 12) then
      raise exception 'Choice questions need 2–12 options' using errcode = '22023';
    end if;
  end loop;
  if new.status = 'open' and jsonb_array_length(new.questions) = 0 then
    raise exception 'Add at least one question before opening the form' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' and new.questions is distinct from old.questions
     and exists (select 1 from public.feedback_responses r where r.form_id = new.id) then
    raise exception 'Questions cannot change after people have answered. Duplicate the form instead.' using errcode = '42501';
  end if;
  if new.status = 'open' and (tg_op = 'INSERT' or old.status <> 'open') then new.opened_at := coalesce(new.opened_at, now()); end if;
  return new;
end $$;
create trigger feedback_forms_guard before insert or update on public.feedback_forms for each row execute function private.guard_feedback_form();

create or replace function private.guard_feedback_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_f public.feedback_forms; q jsonb; a jsonb; v_t text;
begin
  select * into v_f from public.feedback_forms where id = new.form_id;
  new.user_id := (select auth.uid());
  new.respondent_role := case when private.is_teacher_user(new.user_id) then 'teacher' else 'learner' end;
  for q in select * from jsonb_array_elements(v_f.questions) loop
    a := new.answers -> (q ->> 'id');
    v_t := q ->> 'type';
    if a is null or a = 'null'::jsonb or (jsonb_typeof(a) = 'string' and btrim(a #>> '{}') = '') or (jsonb_typeof(a) = 'array' and jsonb_array_length(a) = 0) then
      if coalesce((q ->> 'required')::boolean, false) then
        raise exception 'Please answer: %', q ->> 'label' using errcode = '22023';
      end if;
      continue;
    end if;
    if (v_t = 'rating' and not (jsonb_typeof(a) = 'number' and (a #>> '{}')::numeric between 1 and 5))
       or (v_t = 'scale' and not (jsonb_typeof(a) = 'number' and (a #>> '{}')::numeric between 0 and 10))
       or (v_t = 'yesno' and (a #>> '{}') not in ('yes', 'no'))
       or (v_t = 'text' and not (jsonb_typeof(a) = 'string' and char_length(a #>> '{}') <= 3000))
       or (v_t = 'choice' and not (jsonb_typeof(a) = 'string' and (q -> 'options') ? (a #>> '{}')))
       or (v_t = 'multi' and not (jsonb_typeof(a) = 'array' and not exists (select 1 from jsonb_array_elements_text(a) x where not ((q -> 'options') ? x))))
    then
      raise exception 'Invalid answer for: %', q ->> 'label' using errcode = '22023';
    end if;
  end loop;
  -- Keep only answers to real questions.
  new.answers := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(new.answers) e(k, v)
                  where exists (select 1 from jsonb_array_elements(v_f.questions) qq where qq ->> 'id' = k));
  return new;
end $$;
create trigger feedback_responses_guard before insert on public.feedback_responses for each row execute function private.guard_feedback_response();

-- Opening a form notifies its audience once.
create or replace function private.trg_feedback_opened()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status <> 'open') then
    insert into public.notifications (user_id, type, title, body, link, data)
    select p.id, 'feedback', 'We’d love your feedback: ' || left(new.title, 90), 'It takes about a minute. Tap to answer.', '/feedback/' || new.id,
      jsonb_build_object('form_id', new.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.status = 'active' and not coalesce(u.is_anonymous, false)
      and (new.audience = 'all' or (new.audience = 'teachers') = private.is_teacher_user(p.id))
      and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'feedback' and n.data ->> 'form_id' = new.id::text);
  end if;
  return new;
end $$;
create trigger feedback_forms_opened after insert or update of status on public.feedback_forms for each row execute function private.trg_feedback_opened();

-- Forms waiting for the current user.
create or replace function public.my_open_feedback()
returns table (id uuid, title text, description text, questions jsonb, anonymous boolean, nudge boolean, closes_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, f.title, f.description, f.questions, f.anonymous, f.nudge, f.closes_at from public.feedback_forms f
  where not private.is_guest() and private.feedback_form_visible(f.id)
    and not exists (select 1 from public.feedback_responses r where r.form_id = f.id and r.user_id = (select auth.uid()))
  order by f.opened_at desc nulls last;
$$;

-- Admin results. Names are withheld for anonymous forms.
create or replace function public.feedback_results(p_form uuid)
returns table (id uuid, respondent text, respondent_role text, answers jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select r.id, case when f.anonymous then null else private.official_name(r.user_id) end, r.respondent_role, r.answers, r.created_at
    from public.feedback_responses r join public.feedback_forms f on f.id = r.form_id
    where r.form_id = p_form order by r.created_at desc;
end $$;

create or replace function public.feedback_overview()
returns table (form_id uuid, responses bigint, learners bigint, teachers bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select r.form_id, count(*), count(*) filter (where r.respondent_role = 'learner'), count(*) filter (where r.respondent_role = 'teacher')
    from public.feedback_responses r group by r.form_id;
end $$;

revoke execute on function private.is_teacher_user(uuid), private.feedback_form_visible(uuid) from public, anon;
grant execute on function private.is_teacher_user(uuid), private.feedback_form_visible(uuid) to authenticated; -- used by RLS policies
revoke execute on function public.my_open_feedback(), public.feedback_results(uuid), public.feedback_overview() from public, anon;
grant execute on function public.my_open_feedback(), public.feedback_results(uuid), public.feedback_overview() to authenticated;
