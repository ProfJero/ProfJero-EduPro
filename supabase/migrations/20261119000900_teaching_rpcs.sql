-- =============================================================================
-- 0009 Teaching RPCs: atomic question save, results/submission overviews,
--      my students. Learner names are only exposed to authorised graders.
-- =============================================================================

-- Save a question with its options and answer key in ONE transaction.
-- p: {type, prompt, explanation, category, difficulty, marks, tags[], data{},
--     options:[{id?, label}], key:{...}}  For choice types the key uses option
-- indexes: {"correct_index":[0,2]} which are mapped to real option ids here.
create or replace function public.save_question(p_bank uuid, p_question uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid := p_question;
  v_type public.question_type := (p ->> 'type')::public.question_type;
  v_opt jsonb;
  v_pos integer := 0;
  v_ids uuid[] := '{}';
  v_key jsonb := coalesce(p -> 'key', '{}'::jsonb);
  v_new uuid;
begin
  if not private.can_access_bank(p_bank) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_id is not null and not exists (select 1 from public.questions q where q.id = v_id and q.bank_id = p_bank) then
    raise exception 'Question not in this bank' using errcode = '42501';
  end if;
  if coalesce(btrim(p ->> 'prompt'), '') = '' then raise exception 'Question text is required' using errcode = '22023'; end if;

  if v_id is null then
    insert into public.questions (bank_id, type, prompt, explanation, category, difficulty, marks, tags, data, created_by)
    values (p_bank, v_type, p ->> 'prompt', nullif(p ->> 'explanation', ''), nullif(p ->> 'category', ''), coalesce(p ->> 'difficulty', 'medium'),
      coalesce((p ->> 'marks')::numeric, 1), coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'), coalesce(p -> 'data', '{}'::jsonb), v_uid)
    returning id into v_id;
  else
    if exists (select 1 from public.attempt_answers a where a.question_id = v_id) and
       (select type from public.questions where id = v_id) <> v_type then
      raise exception 'This question has been answered already; its type cannot change. Create a new question instead.' using errcode = 'P0001';
    end if;
    update public.questions set type = v_type, prompt = p ->> 'prompt', explanation = nullif(p ->> 'explanation', ''),
      category = nullif(p ->> 'category', ''), difficulty = coalesce(p ->> 'difficulty', 'medium'), marks = coalesce((p ->> 'marks')::numeric, 1),
      tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'), data = coalesce(p -> 'data', '{}'::jsonb)
    where id = v_id;
  end if;

  if v_type in ('multiple_choice', 'multiple_select', 'true_false') then
    -- keep option ids stable when provided (so past responses still resolve)
    delete from public.question_options o where o.question_id = v_id
      and o.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(p -> 'options', '[]')) x where x ? 'id' and x ->> 'id' <> '');
    for v_opt in select * from jsonb_array_elements(coalesce(p -> 'options', '[]')) loop
      if coalesce(v_opt ->> 'id', '') <> '' and exists (select 1 from public.question_options o where o.id = (v_opt ->> 'id')::uuid and o.question_id = v_id) then
        update public.question_options set label = v_opt ->> 'label', position = v_pos where id = (v_opt ->> 'id')::uuid returning id into v_new;
      else
        insert into public.question_options (question_id, label, position) values (v_id, v_opt ->> 'label', v_pos) returning id into v_new;
      end if;
      v_ids := v_ids || v_new;
      v_pos := v_pos + 1;
    end loop;
    if cardinality(v_ids) < 2 then raise exception 'Add at least two options' using errcode = '22023'; end if;
    v_key := jsonb_build_object('correct', (select coalesce(jsonb_agg(v_ids[(i)::int + 1]), '[]'::jsonb) from jsonb_array_elements_text(coalesce(v_key -> 'correct_index', '[]')) i));
    if jsonb_array_length(v_key -> 'correct') = 0 then raise exception 'Mark at least one correct option' using errcode = '22023'; end if;
    if v_type <> 'multiple_select' and jsonb_array_length(v_key -> 'correct') > 1 then raise exception 'Only one option can be correct' using errcode = '22023'; end if;
  else
    delete from public.question_options where question_id = v_id;
  end if;

  insert into public.question_answer_keys (question_id, answer) values (v_id, v_key)
  on conflict (question_id) do update set answer = excluded.answer;
  return v_id;
end $$;

-- Full question (with key) for authors.
create or replace function public.get_question(p_question uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_bank uuid;
begin
  select bank_id into v_bank from public.questions where id = p_question;
  if v_bank is null or not private.can_access_bank(v_bank) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return (select to_jsonb(q) || jsonb_build_object(
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.position) from public.question_options o where o.question_id = q.id), '[]'::jsonb),
      'key', coalesce((select k.answer from public.question_answer_keys k where k.question_id = q.id), '{}'::jsonb))
    from public.questions q where q.id = p_question);
end $$;

create or replace function public.assessment_results_overview(p_assessment uuid)
returns table (attempt_id uuid, user_id uuid, learner_name text, attempt_no integer, status text, started_at timestamptz, submitted_at timestamptz,
               score numeric, max_score numeric, percentage numeric, passed boolean, pending_manual boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.can_manage_assessment(p_assessment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select t.id, t.user_id, private.display_name(t.user_id), t.attempt_no, t.status, t.started_at, t.submitted_at,
      r.score, r.max_score, r.percentage, r.passed, r.pending_manual
    from public.assessment_attempts t left join public.assessment_results r on r.attempt_id = t.id
    where t.assessment_id = p_assessment
    order by t.submitted_at desc nulls first;
end $$;

create or replace function public.assignment_submissions_overview(p_assignment uuid)
returns table (user_id uuid, learner_name text, submission_id uuid, status text, submitted_at timestamptz, is_late boolean,
               score numeric, graded_at timestamptz, file_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_a public.assignments;
begin
  perform private.require_user();
  if not private.can_manage_assignment(p_assignment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v_a from public.assignments where id = p_assignment;
  return query
    with audience as (
      select a.user_id from private.audience(v_a.course_id, v_a.class_id) a
      union select s.user_id from public.assignment_submissions s where s.assignment_id = p_assignment
    )
    select au.user_id, private.display_name(au.user_id), s.id, coalesce(s.status, 'missing'), s.submitted_at, coalesce(s.is_late, false),
      g.score, g.graded_at, (select count(*) from public.submission_files f where f.submission_id = s.id)
    from audience au
    left join public.assignment_submissions s on s.assignment_id = p_assignment and s.user_id = au.user_id
    left join public.submission_grades g on g.submission_id = s.id
    where au.user_id <> v_a.created_by
    order by (s.status = 'submitted') desc nulls last, private.display_name(au.user_id);
end $$;

-- Distinct learners I am responsible for (courses I manage + classes I teach).
create or replace function public.my_students()
returns table (user_id uuid, name text, avatar_url text, contexts text[], avg_progress numeric, last_activity_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  return query
    with mine as (
      select e.user_id, c.title as ctx, e.progress_pct, e.last_activity_at
      from public.course_enrolments e join public.courses c on c.id = e.course_id
      where e.status <> 'dropped' and private.can_manage_course(c.id) and e.user_id <> v_uid
      union all
      select ce.user_id, sc.name || coalesce(' ' || sc.stream, ''), null::numeric, null::timestamptz
      from public.class_enrolments ce join public.class_teachers ct on ct.class_id = ce.class_id and ct.user_id = v_uid
      join public.school_classes sc on sc.id = ce.class_id
      where ce.status = 'active'
    )
    select m.user_id, private.display_name(m.user_id), (select p.avatar_url from public.profiles p where p.id = m.user_id),
      array_agg(distinct m.ctx), round(avg(m.progress_pct), 1), max(m.last_activity_at)
    from mine m group by m.user_id
    order by 2 limit 2000;
end $$;

revoke execute on function public.save_question(uuid, uuid, jsonb), public.get_question(uuid), public.assessment_results_overview(uuid),
  public.assignment_submissions_overview(uuid), public.my_students() from public, anon;
grant execute on function public.save_question(uuid, uuid, jsonb), public.get_question(uuid), public.assessment_results_overview(uuid),
  public.assignment_submissions_overview(uuid), public.my_students() to authenticated;
