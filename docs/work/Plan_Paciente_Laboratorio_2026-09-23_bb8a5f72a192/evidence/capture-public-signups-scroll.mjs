import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4302';
const OUT = process.env.PUBLIC_SIGNUP_OUT || 'docs/work/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence/public-signups-scroll';
const ROUTES = [
  ['/auth/register', 'register-account-type'],
  ['/auth/register/patient', 'register-patient'],
  ['/auth/register/practitioner', 'register-practitioner'],
  ['/auth/register/organization', 'register-organization'],
  ['/auth/register/laboratory', 'register-laboratory'],
  ['/auth/register/imaging-center', 'register-imaging-center'],
];
const THEMES = ['light', 'dark'];

mkdirSync(join(OUT, 'fotos-scroll'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];

for (const colorScheme of THEMES) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  });
  for (const [route, slug] of ROUTES) {
    const page = await context.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 20_000 });
    const panel = page.locator('.auth-split__panel');
    const before = await panel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(150);
    const after = await panel.evaluate((element) => ({
      scrollTop: element.scrollTop,
      maxScrollTop: element.scrollHeight - element.clientHeight,
    }));
    const screenshot = join(OUT, 'fotos-scroll', `${slug}-1440-${colorScheme}-bottom.png`);
    await page.screenshot({ path: screenshot });
    captures.push({ route, colorScheme, before, after, screenshot });
    await page.close();
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, 'scroll-captures.json'), JSON.stringify({ base: BASE, captures }, null, 2) + '\n');
console.log(JSON.stringify({ captures: captures.length, maxScrollNotReached: captures.filter(({ after }) => after.maxScrollTop - after.scrollTop > 1).length }, null, 2));
