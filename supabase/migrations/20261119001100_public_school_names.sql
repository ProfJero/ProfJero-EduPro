-- =============================================================================
-- 0011 Public school names: anonymous visitors may read ONLY id + name + slug
-- of APPROVED schools (column-level grant), e.g. "offered by <school>" on
-- public course pages. Contact details remain private.
-- =============================================================================
grant select (id, name, slug, logo_url) on public.schools to anon;
create policy schools_public_names on public.schools for select to anon using (status = 'approved');
