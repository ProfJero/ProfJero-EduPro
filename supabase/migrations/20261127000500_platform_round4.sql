-- Round 4 · Owner console: festive occasions, certificate settings and full
-- teacher-application details.

insert into public.platform_settings (key, value, is_public, description) values
  ('occasions.config', '{"mode":"auto","manual":null,"disabled":[],"messages":{},"effects":true}'::jsonb, true,
   'Festive designs: mode auto (follows the calendar), manual (one occasion) or off'),
  ('certificates.enabled', 'true'::jsonb, true, 'Issue certificates automatically when learners complete a course'),
  ('certificates.issuer_name', '"ProfJero Edu · ProfJero Digital Studio"'::jsonb, true, 'Issuer shown on certificates from independent courses'),
  ('certificates.public_verification', 'true'::jsonb, true, 'Anyone with the reference can verify a certificate online')
on conflict (key) do nothing;

-- Certificate design.
alter table public.certificate_templates
  add column if not exists style text not null default 'classic' check (style in ('classic', 'modern', 'kente', 'minimal')),
  add column if not exists title_text text not null default 'Certificate of completion' check (char_length(title_text) between 3 and 80),
  add column if not exists intro_text text not null default 'This certifies that' check (char_length(intro_text) <= 120),
  add column if not exists body_text text not null default 'has successfully completed the course' check (char_length(body_text) <= 200),
  add column if not exists logo_url text check (logo_url is null or logo_url ~ '^https://'),
  add column if not exists signature_url text check (signature_url is null or signature_url ~ '^https://'),
  add column if not exists seal_text text check (char_length(seal_text) <= 40),
  add column if not exists updated_at timestamptz not null default now();
insert into public.certificate_templates (name, accent_color, signatory_name, signatory_title, footer_text, is_default)
select 'ProfJero Edu default', '#1554D6', null, 'Programme Director', null, true
where not exists (select 1 from public.certificate_templates where is_default);

create or replace function private.issue_certificate(p_user uuid, p_course uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_c public.courses; v_issuer text;
begin
  if exists (select 1 from public.platform_settings s where s.key = 'certificates.enabled' and s.value = 'false'::jsonb) then return null; end if;
  select * into v_c from public.courses where id = p_course;
  if not v_c.certificate_enabled then return null; end if;
  select id into v_id from public.certificates where user_id = p_user and course_id = p_course;
  if v_id is not null then return v_id; end if;
  v_issuer := coalesce((select s.name from public.schools s where s.id = v_c.school_id),
    nullif((select s.value #>> '{}' from public.platform_settings s where s.key = 'certificates.issuer_name'), ''),
    'ProfJero Edu · ProfJero Digital Studio');
  insert into public.certificates (serial, user_id, course_id, template_id, learner_name, course_title, issuer_name, completed_on)
  values ('PJE-' || to_char(now(), 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
    p_user, p_course, (select t.id from public.certificate_templates t where t.is_default limit 1),
    private.official_name(p_user), v_c.title, v_issuer, (now() at time zone 'Africa/Accra')::date)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.verify_certificate(p_serial text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.platform_settings s where s.key = 'certificates.public_verification' and s.value = 'false'::jsonb)
              and not (select private.is_platform_admin()) then jsonb_build_object('hidden', true)
         else (select jsonb_build_object('serial', c.serial, 'learner_name', c.learner_name, 'course_title', c.course_title,
                 'issuer_name', c.issuer_name, 'completed_on', c.completed_on, 'issued_at', c.issued_at, 'status', c.status, 'course_slug', co.slug)
               from public.certificates c join public.courses co on co.id = c.course_id where c.serial = upper(btrim(p_serial))) end;
$$;

-- Admin: issue (or re-issue with a corrected name) a certificate.
create or replace function public.admin_update_certificate_name(p_certificate uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then raise exception 'Enter the learner''s full name' using errcode = '22023'; end if;
  update public.certificates set learner_name = btrim(p_name) where id = p_certificate;
  perform private.audit('certificate.rename', 'certificate', p_certificate::text, jsonb_build_object('name', btrim(p_name)));
end $$;

-- Teacher applications: more details for the reviewer.
alter table public.instructor_applications
  add column if not exists phone text check (char_length(phone) <= 30),
  add column if not exists institution text check (char_length(institution) <= 160),
  add column if not exists subjects text check (char_length(subjects) <= 300),
  add column if not exists teaching_level text check (char_length(teaching_level) <= 80),
  add column if not exists years_experience integer check (years_experience between 0 and 60),
  add column if not exists location text check (char_length(location) <= 120);

create or replace function public.admin_instructor_applications()
returns table (id uuid, user_id uuid, full_name text, display_name text, email text, avatar_url text, headline text, bio text,
               country_code text, joined_at timestamptz, expertise text, motivation text, portfolio_url text, phone text, institution text,
               subjects text, teaching_level text, years_experience integer, location text, status text, review_notes text,
               reviewed_at timestamptz, reviewer text, created_at timestamptz, courses_owned bigint, classes_owned bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select a.id, a.user_id, private.official_name(a.user_id), nullif(p.display_name, ''), u.email::text, p.avatar_url, p.headline, p.bio,
      p.country_code, u.created_at, a.expertise, a.motivation, a.portfolio_url, a.phone, a.institution, a.subjects, a.teaching_level,
      a.years_experience, a.location, a.status, a.review_notes, a.reviewed_at,
      case when a.reviewed_by is not null then private.official_name(a.reviewed_by) end, a.created_at,
      (select count(*) from public.courses c where c.owner_id = a.user_id),
      (select count(*) from public.school_classes c where c.owner_id = a.user_id)
    from public.instructor_applications a
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = a.user_id
    order by (a.status = 'pending') desc, a.created_at desc;
end $$;

revoke execute on function public.admin_instructor_applications(), public.admin_update_certificate_name(uuid, text) from public, anon;
grant execute on function public.admin_instructor_applications(), public.admin_update_certificate_name(uuid, text) to authenticated;
