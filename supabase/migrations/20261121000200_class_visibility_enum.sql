-- Courses can be private to the classes they are assigned to.
alter type public.course_visibility add value if not exists 'class';
