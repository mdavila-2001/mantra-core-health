// Evidence: orders cancel/reject dialogs and the team roster with a pending invitee.
// usage: node capture-round2.cjs <baseUrl> <outDir>
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const [base, out, part = 'all'] = process.argv.slice(2);
const EXE = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const SIZES = { 390: 844, 1440: 900 };
const log = [];

function uuid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { const c = seed.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0; }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

async function login(page, email) {
  await page.goto(`${base}/auth`);
  await page.getByTestId('login-identifier').waitFor({ timeout: 180000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function hideDemo(page) {
  await page.addStyleTag({ content: '[aria-label="Modo de demostración"] { display: none !important; }' });
  await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const t = el.children.length === 0 ? el.textContent.trim() : ''; if (t === 'Datos de prueba' || t === 'Ver componentes') el.style.display = 'none'; } });
}

async function shot(page, name, full = false) {
  await page.waitForTimeout(700);
  const file = `${name}.png`;
  const vp = page.viewportSize();
  if (full) {
    // Grow the viewport to the page height (a fullPage shot would detach the sticky sidebar).
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(out, file) });
  if (full) await page.setViewportSize(vp);
  const m = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  log.push({ file, ...m });
}

async function openRowMenu(page, rowIndex = 0) {
  await page.locator('tbody tr, [role="row"], .data-table__card').nth(rowIndex).getByRole('button', { name: /^Acciones/ }).first().click();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  for (const theme of ['light', 'dark']) {
    const tn = theme === 'light' ? 'claro' : 'oscuro';
    for (const w of part === 'team' ? [] : [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: SIZES[w] }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('mantra-core-health.theme', t), theme);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
      await login(page, 'laboratorio@alovida.mock');

      // ---- Orders: «Rechazar» on a received order.
      await page.goto(`${base}/administration/laboratory-orders?estado=received`);
      await page.getByTestId('lab-orders-card').or(page.locator('app-data-table')).first().waitFor({ timeout: 60000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await hideDemo(page);
      await shot(page, `ordenes-recibidas-${w}-${tn}`);
      await openRowMenu(page);
      await page.getByRole('menuitem', { name: 'Rechazar', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await shot(page, `ordenes-rechazar-dialogo-${w}-${tn}`);
      await page.getByRole('dialog').locator('textarea').fill('Muestra insuficiente');
      await shot(page, `ordenes-rechazar-con-motivo-${w}-${tn}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Rechazar la orden' }).click();
      await page.waitForTimeout(800);

      // ---- «Cancelar» on a draft order.
      await page.goto(`${base}/administration/laboratory-orders?estado=draft`);
      await page.waitForTimeout(1800);
      await hideDemo(page);
      await openRowMenu(page);
      await page.getByRole('menuitem', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await shot(page, `ordenes-cancelar-dialogo-${w}-${tn}`);
      await page.getByRole('dialog').locator('textarea').fill('Pedida por error');
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar la orden' }).click();
      await page.waitForTimeout(1000);

      // ---- The closed tab shows both reasons.
      await page.goto(`${base}/administration/laboratory-orders?estado=closed`);
      await page.waitForTimeout(1800);
      await hideDemo(page);
      await shot(page, `ordenes-canceladas-y-rechazadas-${w}-${tn}`, true);
      log.push({ account: 'laboratorio', width: w, theme, httpErrors: errs });
      await ctx.close();
    }

    // ---- Team roster with a pending invitee (hospital account, as the organization).
    for (const w of part === 'orders' ? [] : [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: SIZES[w] }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('mantra-core-health.theme', t), theme);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await login(page, 'hospital.piloto@alovida.mock');
      const tenant = uuid('tenant-hospital-piloto-mantra');
      await page.goto(`${base}/administration/organizations/${tenant}/memberships/new`);
      await page.waitForSelector('app-membership-new', { timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.evaluate((anaId) => {
        const comp = window.ng.getComponent(document.querySelector('app-membership-new'));
        comp.persona.set({ value: anaId, label: 'Ana Gutiérrez' });
        comp.submit();
      }, uuid('user-ana-gutierrez'));
      await page.waitForTimeout(1500);
      await page.goto(`${base}/administration/organizations/${tenant}?tab=plantilla`);
      await page.waitForTimeout(3000);
      await hideDemo(page);
      await shot(page, `equipo-invitado-pendiente-${w}-${tn}`, true);
      // A second invite to the same person: the API's 409 shows on the form.
      await page.goto(`${base}/administration/organizations/${tenant}/memberships/new`);
      await page.waitForSelector('app-membership-new', { timeout: 60000 });
      await page.waitForTimeout(1200);
      await page.evaluate((anaId) => {
        const comp = window.ng.getComponent(document.querySelector('app-membership-new'));
        comp.persona.set({ value: anaId, label: 'Ana Gutiérrez' });
        comp.submit();
      }, uuid('user-ana-gutierrez'));
      await page.waitForTimeout(1500);
      await hideDemo(page);
      await shot(page, `equipo-invitar-repetido-409-${w}-${tn}`, true);
      log.push({ account: 'hospital', width: w, theme, httpErrors: errs });
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, part === 'all' ? 'medidas-ronda2.json' : `medidas-ronda2-${part}.json`), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log.map((r) => r.file ?? { a: r.account, w: r.width, e: r.httpErrors })));
})().catch((e) => { console.error(e); process.exit(1); });
