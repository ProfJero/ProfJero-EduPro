import { test, expect } from '@playwright/test';
import { asUser, localDateTime, login, toast, PASSWORD } from './helpers';

const stamp = Date.now().toString(36);

test('learner journey: register (no email step) → log in → browse → enrol → study → assessment → progress', async ({ page }) => {
  const email = `learner.${stamp}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Abena Test Learner');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByText('I agree to the').click();
  await page.getByRole('button', { name: 'Create account' }).click();
  // Email confirmation is off: sign-up signs the learner straight in.
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Start learning/ }).click();
  await expect(page).toHaveURL(/learn\/explore/);

  // Sign out and back in to prove the credentials work.
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Account & security' }).click();
  await page.getByRole('button', { name: 'Sign out on this device' }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, email);

  await page.goto('/learn/explore');
  await page.getByRole('link', { name: 'Python Foundations' }).first().click();
  await expect(page.getByRole('heading', { name: 'Python Foundations', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Enrol for free' }).click();
  await expect(page).toHaveURL(/\/learn\/courses\/[0-9a-f-]+$/);

  await page.getByRole('link', { name: 'Start learning' }).click();
  await expect(page.getByRole('heading', { name: 'Your first program' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await toast(page, 'Lesson complete');
  await expect(page.getByText('You completed this lesson')).toBeVisible();

  await page.goto('/learn/assessments');
  await page.getByRole('link', { name: 'Python Foundations check-in' }).click();
  await page.getByRole('button', { name: 'Start assessment' }).click();
  await expect(page).toHaveURL(/assessments\/attempt\//);
  for (let i = 0; i < 3; i++) {
    const prompt = await page.locator('h2[id^="q-"]').innerText();
    if (/displays text/.test(prompt)) await page.getByRole('radio', { name: 'print()' }).check();
    else if (/Indentation/.test(prompt)) await page.getByRole('radio', { name: 'False' }).check();
    else await page.locator('input[aria-labelledby^="q-"]').fill('def');
    await page.waitForTimeout(900); // autosave debounce
    if (i < 2) await page.getByRole('button', { name: /^Next/ }).click();
  }
  await page.getByRole('button', { name: 'Review & submit' }).click();
  await page.getByRole('button', { name: 'Submit now' }).click();
  await expect(page.getByText('Passed 🎉')).toBeVisible();
  await expect(page.getByText('Score 3 / 3')).toBeVisible();

  await page.goto('/learn/progress');
  await expect(page.getByText('100%').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Python Foundations check-in' }).or(page.getByText('Python Foundations check-in')).first()).toBeVisible();
});

test('teacher journey: create course → module → lesson → publish → review → assessment', async ({ browser }) => {
  const { page, ctx } = await asUser(browser, 'teacher@profjero.test');
  const title = `E2E Data Skills ${stamp}`;
  await page.goto('/teach/courses/new');
  await page.getByLabel('Course title').fill(title);
  await page.getByLabel('Short description').fill('A course created by the automated teacher journey.');
  await page.getByRole('button', { name: 'Create course & add lessons' }).click();
  await expect(page).toHaveURL(/tab=curriculum/);
  await expect(page.getByText('Module 1').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add lesson' }).click();
  await expect(page).toHaveURL(/\/lessons\//);
  await page.getByLabel('Lesson title').fill('What is data?');
  await page.getByRole('button', { name: /^Text Explanation/ }).click();
  await page.getByLabel('Text', { exact: true }).fill('Data is information we can **measure** and analyse.');
  await expect(page.getByText(/Saved|All changes saved/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Publish lesson' }).click();
  await toast(page, 'Lesson published');

  await page.getByRole('link', { name: 'Curriculum', exact: true }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await toast(page, 'Submitted for review');

  // Owner reviews and publishes.
  const owner = await asUser(browser, 'owner@profjero.test');
  await owner.page.goto('/admin/courses');
  const row = owner.page.getByRole('row', { name: new RegExp(title) });
  await row.getByRole('button', { name: `Actions for ${title}` }).click();
  await owner.page.getByRole('menuitem', { name: 'Publish' }).click();
  await toast(owner.page, /Course publish/);
  await owner.ctx.close();

  await page.goto('/courses');
  await page.getByLabel('Search courses').fill('E2E Data Skills');
  await expect(page.getByRole('link', { name: title }).first()).toBeVisible();

  // Assessment from the question bank.
  await page.goto('/teach/assessments');
  await page.getByRole('button', { name: 'New assessment' }).click();
  await page.getByLabel('Title').fill(`Loops quiz ${stamp}`);
  await page.getByLabel('For').selectOption({ label: 'Course · Python Foundations' });
  await page.getByRole('button', { name: 'Create & add questions' }).click();
  await expect(page).toHaveURL(/teach\/assessments\/[0-9a-f-]+/);
  await page.getByLabel('Question bank').selectOption({ label: 'Python Foundations bank' });
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Add 1 question/ }).click();
  await expect(page.getByText('1 questions')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await toast(page, /Published/);
  await ctx.close();
});

test('assignment & grading: student submits, class teacher marks with feedback', async ({ browser }) => {
  const student = await asUser(browser, 'student@profjero.test');
  await student.page.goto('/learn/assignments');
  await student.page.getByRole('link', { name: 'Describe a computer system' }).click();
  await student.page.getByLabel('Written response').fill('Our ICT lab has 30 desktop computers connected to a local network and a projector.');
  await student.page.getByRole('button', { name: 'Submit work' }).click();
  await toast(student.page, 'Work submitted');

  const teacher = await asUser(browser, 'schoolteacher@profjero.test');
  await teacher.page.goto('/teach/assignments');
  await teacher.page.getByRole('link', { name: 'Describe a computer system' }).click();
  await teacher.page.getByRole('button', { name: 'Mark' }).first().click();
  await teacher.page.getByLabel(/Score \(out of 20\)/).fill('17');
  await teacher.page.getByLabel('Feedback').fill('Clear description — add the operating system next time.');
  await teacher.page.getByRole('button', { name: 'Save grade & feedback' }).click();
  await toast(teacher.page, 'Graded');

  await student.page.reload();
  await expect(student.page.getByText('Feedback from your teacher')).toBeVisible();
  await expect(student.page.getByText('17/20')).toBeVisible();
  await student.ctx.close();
  await teacher.ctx.close();
});

test('live class journey: teacher schedules → learner notified → timetable → join', async ({ browser }) => {
  const teacher = await asUser(browser, 'schoolteacher@profjero.test');
  const title = `Networking live ${stamp}`;
  await teacher.page.goto('/teach/live');
  await teacher.page.getByRole('button', { name: 'Schedule session' }).click();
  await teacher.page.getByLabel('Session title').fill(title);
  await teacher.page.getByLabel('For').selectOption({ label: 'Class · SHS 2 Science A — Dev Academy SHS' });
  await teacher.page.getByLabel(/Date & time/).fill(localDateTime(5));
  await teacher.page.getByLabel('Meeting provider').selectOption('jitsi');
  await teacher.page.getByRole('button', { name: 'Generate' }).click();
  await teacher.page.getByRole('button', { name: 'Schedule & notify learners' }).click();
  await toast(teacher.page, /Session scheduled/);
  await teacher.ctx.close();

  const student = await asUser(browser, 'student@profjero.test');
  await student.page.goto('/notifications');
  await expect(student.page.getByText(`Live class scheduled: ${title}`)).toBeVisible();
  await student.page.goto('/learn/classes');
  const card = student.page.locator('div.rounded-2xl').filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  // The meeting provider is external; stub it so the test does not depend on the internet.
  await student.ctx.route('https://meet.jit.si/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Jitsi (stub)</h1>' }));
  const popup = student.page.waitForEvent('popup');
  await card.getByRole('button', { name: 'Join class' }).click();
  const meeting = await popup;
  await expect.poll(() => meeting.url()).toContain('meet.jit.si/ProfJeroEdu-');
  await student.ctx.close();
});

test('school journey: register school → approval → structure → teachers → learners → courses → reports', async ({ browser }) => {
  const school = `E2E Hills Academy ${stamp}`;
  const applicant = await asUser(browser, 'learner2@profjero.test');
  await applicant.page.goto('/schools/apply');
  await applicant.page.getByLabel(/School \/ institution name/).fill(school);
  await applicant.page.getByLabel(/Official school email/).fill('office@hills.test');
  await applicant.page.getByLabel(/Your role at the school/).fill('Headmistress');
  await applicant.page.getByRole('button', { name: 'Submit for verification' }).click();
  await expect(applicant.page.getByText('Application received')).toBeVisible();

  const owner = await asUser(browser, 'owner@profjero.test');
  await owner.page.goto('/admin/schools');
  const card = owner.page.locator('.card').filter({ hasText: school });
  await card.getByRole('button', { name: 'Approve' }).click();
  await owner.page.getByRole('button', { name: 'Approve school' }).click();
  await toast(owner.page, 'School approved');
  await owner.ctx.close();

  // New workspace appears for the applicant (now school admin).
  await applicant.page.goto('/learn');
  await applicant.page.reload();
  await applicant.page.getByRole('button', { name: 'Switch workspace' }).first().click();
  await applicant.page.getByRole('menuitem', { name: school }).click();
  await expect(applicant.page.getByRole('heading', { name: school })).toBeVisible();
  const base = new URL(applicant.page.url()).pathname;

  await applicant.page.goto(`${base}/academic`);
  await applicant.page.getByLabel('Name').fill('2026/2027');
  await applicant.page.getByLabel('Starts').fill('2026-09-01');
  await applicant.page.getByLabel('Ends').fill('2027-07-31');
  await applicant.page.getByRole('button', { name: 'Add', exact: true }).click();
  await toast(applicant.page, 'Academic year added');

  await applicant.page.goto(`${base}/classes`);
  await applicant.page.getByRole('button', { name: 'New class' }).click();
  await applicant.page.getByLabel('Class name').fill('Form 2 Gold');
  await applicant.page.getByRole('button', { name: 'Create', exact: true }).click();
  await toast(applicant.page, 'Class created');

  await applicant.page.goto(`${base}/teachers`);
  await applicant.page.getByRole('button', { name: 'Invite teacher' }).click();
  await applicant.page.getByLabel('Email').fill('teacher@profjero.test');
  await applicant.page.getByLabel('Full name').fill('Ama Mensah');
  await applicant.page.getByRole('button', { name: 'Send invitation' }).click();
  await toast(applicant.page, 'Added to the school');

  await applicant.page.goto(`${base}/students`);
  await applicant.page.getByRole('button', { name: 'Add student' }).click();
  await applicant.page.getByLabel('Email').fill('learner@profjero.test');
  await applicant.page.getByLabel('Class').selectOption({ label: 'Form 2 Gold' });
  await applicant.page.getByRole('button', { name: 'Add student', exact: true }).last().click();
  await toast(applicant.page, 'Added to the school');
  await applicant.page.getByRole('button', { name: 'Add student' }).first().click();
  await applicant.page.getByLabel('Email').fill(`new.${stamp}@example.test`);
  await applicant.page.getByRole('button', { name: 'Add student', exact: true }).last().click();
  await toast(applicant.page, 'Invitation created');

  await applicant.page.goto(`${base}/classes`);
  await applicant.page.getByRole('link', { name: /Form 2 Gold/ }).click();
  await applicant.page.getByRole('tab', { name: 'Courses' }).click();
  await applicant.page.getByLabel('Course', { exact: true }).selectOption({ label: 'Python Foundations' });
  await applicant.page.getByRole('button', { name: 'Assign', exact: true }).click();
  await toast(applicant.page, /Course assigned/);

  await applicant.page.goto(`${base}/reports`);
  await expect(applicant.page.getByRole('cell', { name: 'Form 2 Gold' })).toBeVisible();
  await applicant.ctx.close();
});

test('platform owner journey: manage users → grant EduPro → review audit activity', async ({ browser }) => {
  const owner = await asUser(browser, 'owner@profjero.test');
  await owner.page.goto('/admin');
  await expect(owner.page.getByText('Registered users')).toBeVisible();
  await owner.page.goto('/admin/users');
  await owner.page.getByLabel('Search users').fill('otherstudent@profjero.test');
  await owner.page.getByRole('main').getByRole('button', { name: 'Search', exact: true }).click();
  await owner.page.getByRole('button', { name: 'Actions for otherstudent@profjero.test' }).click();
  await owner.page.getByRole('menuitem', { name: 'Grant EduPro' }).click();
  await owner.page.getByRole('button', { name: 'Grant access' }).click();
  await toast(owner.page, 'EduPro granted');
  await owner.page.goto('/admin/subscriptions');
  await expect(owner.page.getByText('ProfJero EduPro').first()).toBeVisible();
  await owner.page.goto('/admin/audit');
  await expect(owner.page.getByText('subscription.granted').first()).toBeVisible();
  await owner.ctx.close();

  const pro = await asUser(browser, 'otherstudent@profjero.test');
  await pro.page.goto('/settings');
  await pro.page.getByRole('tab', { name: 'Plan' }).click();
  await expect(pro.page.getByRole('tabpanel', { name: 'Plan' }).getByText('ProfJero EduPro')).toBeVisible();
  await pro.ctx.close();
});

test('security: a learner cannot open the platform console or another school', async ({ browser }) => {
  const { page, ctx } = await asUser(browser, 'otherstudent@profjero.test');
  await page.goto('/admin');
  await expect(page.getByText("You don't have access to this workspace")).toBeVisible();
  await page.goto('/school/00000000-0000-4000-b000-000000000001');
  await expect(page.getByText("You don't have access to this workspace")).toBeVisible();
  await ctx.close();
});
