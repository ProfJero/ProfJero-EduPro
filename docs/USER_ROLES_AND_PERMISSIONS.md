# User roles & permissions

One account per person, holding many roles. Workspaces are switched in the sidebar without logging out.

## Platform roles (`user_roles`)

| Role | How it's granted | Can |
|---|---|---|
| learner | automatically at sign-up | enrol, study, attempt assessments, submit work, join classes and discussions |
| teacher (independent instructor) | owner/admin approves an instructor application, or grants it in Users | create independent courses (plan limit), question banks, assessments, assignments, live sessions |
| school_admin | approval of a school application, or accepting an admin invitation | administer that school (the real authority is the school membership) |
| platform_admin | **owner only** | full platform console |
| owner | bootstrap email list (`profjero947@gmail.com`) | everything, including managing admins; cannot be suspended |
| guardian | reserved (future) | — |

Choosing "Educator" or "School" at registration only records intent. It grants nothing.

## School roles (`school_memberships`, per school)

| Role | Can |
|---|---|
| school_admin | manage school profile, academic years/terms, classes, teachers, students (add, invite, CSV import, suspend, remove), assign courses, registers, announcements, reports, and publish school courses |
| teacher | see and teach **only their assigned classes**, create school courses (published by a school admin), take registers, grade class work |
| student | join their classes, see class roster/board/discussion, auto-enrolled into class courses |

A teacher at two schools sees each school's classes only in that school's context. There is no cross-school visibility.

## Course roles

The owner (`courses.owner_id`) and `course_instructors` (lead/instructor/assistant) manage content, learners, grading and the course classroom. Teachers of a class the course is assigned to can read the course and its learners' progress.
