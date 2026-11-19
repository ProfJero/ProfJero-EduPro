-- =============================================================================
-- 0010 Media upload permission check used by the server API before signing
-- Cloudinary uploads. Answers only about the calling user.
-- =============================================================================
create or replace function public.media_permissions(p_course uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'user_id', v_uid,
    'can_create_courses', private.has_role('teacher') or private.is_platform_admin()
       or exists (select 1 from public.school_memberships m join public.schools s on s.id = m.school_id and s.status = 'approved'
                  where m.user_id = v_uid and m.status = 'active' and m.role in ('teacher', 'school_admin')),
    'can_manage_course', case when p_course is null then null else private.can_manage_course(p_course) end
  );
end $$;
revoke execute on function public.media_permissions(uuid) from public, anon;
grant execute on function public.media_permissions(uuid) to authenticated;
