import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = 'DevPassw0rd!';
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function asUser(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

/** Reads the newest confirmation link sent to an address via the local Mailpit inbox. */
export async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const j = (await r.json()) as { messages: { ID: string }[] };
    if (j.messages?.length) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${j.messages[0].ID}`)).json()) as { Text: string; HTML: string };
      const body = `${m.HTML ?? ''} ${m.Text ?? ''}`;
      const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`No confirmation email for ${email}`);
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
}

export function localDateTime(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
