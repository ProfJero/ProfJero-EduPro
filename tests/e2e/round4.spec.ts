import { test, expect } from '@playwright/test';
import { asUser } from './helpers';

const stamp = Date.now().toString(36);

test('teacher: school classes, register search, private scores → learner sees only their own', async ({ browser }) => {
  const { page: t, ctx: tc } = await asUser(browser, 'teacher@profjero.test');
  await t.goto('/teach/classes?new=1');
  const dialog = t.getByRole('dialog');
  await dialog.getByLabel('Class name').fill(`Ctrl + Alt + Learn ${stamp}`);
  await dialog.getByRole('button', { name: 'Create class' }).click();
  await expect(t).toHaveURL(/\/teach\/classes\/[0-9a-f-]+\?tab=join/);
  const classUrl = t.url().split('?')[0];
  const code = (await t.locator('p.font-mono').first().innerText()).trim();

  const { page: s, ctx: sc } = await asUser(browser, 'student@profjero.test');
  await s.goto(`/join/${code}`);
  await s.getByRole('button', { name: /Join class/ }).click();
  await expect(s).toHaveURL(/\/learn\/classes\/[0-9a-f-]+/);
  const learnUrl = s.url();

  // Teacher lists the real school classes.
  await t.goto(`${classUrl}?tab=students`);
  await t.getByLabel('School class names').fill('General Arts A2, Science B2, Science B3');
  await t.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(t.getByRole('button', { name: /Rename Science B3/ })).toBeVisible();
  await expect(t.getByTestId('student-total')).toHaveText('1');

  // Learner picks theirs.
  await s.goto(learnUrl);
  await expect(s.getByText('Which class are you in at school?')).toBeVisible();
  await s.getByRole('button', { name: 'Science B2' }).click();
  await expect(s.getByText('Your school class:')).toBeVisible();

  // Teacher filters and searches the register (official names).
  await t.reload();
  await t.getByLabel('Filter by school class').selectOption({ label: 'Science B2' });
  await t.getByLabel('Search students').fill('kofi');
  await expect(t.getByText('Kofi Appiah')).toBeVisible();
  await t.getByLabel('Search students').fill('zzz');
  await expect(t.getByText('No students match')).toBeVisible();

  // Score sheet: create, type a score, release.
  await t.goto(`${classUrl}?tab=scores`);
  await t.getByRole('button', { name: 'New score sheet' }).click();
  await t.getByRole('dialog').getByRole('button', { name: 'Mid-Sem Exams' }).click();
  await t.getByRole('dialog').getByLabel('Marked out of').fill('50');
  await t.getByRole('dialog').getByRole('button', { name: 'Create & enter scores' }).click();
  await t.getByLabel('Find a student').fill('Kofi');
  const box = t.getByLabel('Score for Kofi Appiah');
  await box.fill('42');
  await box.press('Enter');
  await expect(t.getByLabel('Saved')).toBeVisible();
  await t.getByRole('button', { name: 'Release to students' }).click();
  await t.getByRole('dialog').getByRole('button', { name: 'Release scores' }).click();
  await expect(t.getByRole('button', { name: 'Hide from students' })).toBeVisible();

  // Learner sees their private score and a notification.
  await s.goto('/learn/scores');
  await expect(s.getByText('Mid-Sem Exams')).toBeVisible();
  await expect(s.getByText('84%')).toBeVisible();
  await s.goto('/notifications');
  await expect(s.getByText(/Your score is ready: Mid-Sem Exams/).first()).toBeVisible();
  await tc.close(); await sc.close();
});

test('owner asks for feedback; a learner answers from the notification', async ({ browser }) => {
  const { page: o, ctx: oc } = await asUser(browser, 'owner@profjero.test');
  await o.goto('/admin/feedback');
  await o.getByRole('button', { name: /Platform experience/ }).click();
  await expect(o).toHaveURL(/\/admin\/feedback\/[0-9a-f-]+/);
  await o.getByRole('button', { name: 'Open & notify' }).click();
  await o.getByRole('dialog').getByRole('button', { name: 'Open & notify' }).click();
  await expect(o.getByRole('button', { name: 'Close form' })).toBeVisible();
  const formUrl = o.url();

  const { page: l, ctx: lc } = await asUser(browser, 'learner2@profjero.test');
  await l.goto('/feedback');
  await l.getByRole('link', { name: /How is ProfJero Edu working for you/ }).click();
  await l.getByRole('radio', { name: '5 of 5' }).click();
  await l.getByRole('radio', { name: '9' }).click();
  await l.getByRole('button', { name: 'Classes' }).click();
  await l.getByRole('button', { name: 'Send feedback' }).click();
  await expect(l.getByText('Thank you!')).toBeVisible();

  await o.goto(formUrl);
  await o.getByRole('tab', { name: /Results \(1\)/ }).click();
  await expect(o.getByText('5.0')).toBeVisible();
  await oc.close(); await lc.close();
});

test('festive designs, install help and SEO endpoints', async ({ browser, request }) => {
  const { page: o, ctx: oc } = await asUser(browser, 'owner@profjero.test');
  await o.goto('/admin/occasions');
  await o.locator('li').filter({ hasText: 'Christmas season' }).getByRole('button', { name: 'Preview' }).click();
  await expect(o.getByTestId('occasion-garland')).toBeVisible();
  await expect(o.locator('html')).toHaveAttribute('data-occasion', 'christmas');
  await o.getByRole('button', { name: 'Stop preview' }).click();
  await expect(o.getByTestId('occasion-garland')).toHaveCount(0);
  await oc.close();

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap:');
  const map = await request.get('/sitemap.xml');
  expect(map.headers()['content-type']).toContain('xml');
  expect(await map.text()).toContain('/courses</loc>');
  const home = await (await request.get('/')).text();
  expect(home).toContain('og:image');
  expect(home).toContain('application/ld+json');
  const priv = await (await request.get('/learn')).text();
  expect(priv).toContain('noindex');
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('home page shows Log in without opening the menu; install help is available', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('header-login')).toBeVisible();
    await page.getByTestId('header-login').click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await page.getByRole('button', { name: 'Install the ProfJero Edu app' }).click();
    await expect(page.getByRole('dialog', { name: 'Install ProfJero Edu' })).toBeVisible();
  });
});
