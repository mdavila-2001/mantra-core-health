// Throwaway evidence script: usage node capture-lab-home3.cjs <baseUrl> <outDir>
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const [base, out] = process.argv.slice(2);
const SIZES = { 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 };
const WIDTHS = [390, 768, 1024, 1440, 1920];
const report = [];

const HIDE_DEMO = `
  [aria-label="Modo de demostración"] { display: none !important; }
`;

async function hideDemo(page) {
  await page.addStyleTag({ content: HIDE_DEMO });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const t = el.children.length === 0 ? el.textContent.trim() : '';
      if (t === 'Datos de prueba' || t === 'Ver componentes') el.style.display = 'none';
    }
  });
}

async function login(page, email) {
  await page.goto(`${base}/auth`);
  await page.getByTestId('login-identifier').waitFor({ timeout: 180000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/administration\/laboratory$/, { timeout: 60000 });
  await page.getByTestId('lab-home').waitFor();
}

const settled = (page) =>
  page.waitForFunction(() => document.querySelectorAll('.view-state-host__loading').length === 0, null, { timeout: 30000 });

// Runs a function against the summary component (signals and client are runtime-visible in dev mode).
const withComp = (page, fn, arg) =>
  page.evaluate(
    ([src, a]) => {
      const el = document.querySelector('app-laboratory-summary');
      const comp = window.ng.getComponent(el);
      return new Function('comp', 'a', `return (${src})(comp, a)`)(comp, a);
    },
    [fn.toString(), arg],
  );

async function metrics(page) {
  return page.evaluate(() => {
    const inner = document.querySelector('.app-main__inner') ?? document.body;
    const home = document.querySelector('[data-testid="lab-home"]');
    const a = inner.getBoundingClientRect();
    const b = home.getBoundingClientRect();
    const footerBottoms = ['pending', 'bookings', 'catalog']
      .map((k) => document.querySelector(`[data-testid="lab-home-${k}"] .footer`))
      .map((el) => (el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : null));
    const figureHeights = [...document.querySelectorAll('.figure')].map((f) => Math.round(f.getBoundingClientRect().height));
    const home_ = home;
    const cardHeights = Object.fromEntries(
      ['orders', 'pending', 'bookings', 'catalog'].map((k) => {
        const el = document.querySelector(`[data-testid="lab-home-${k}"]`);
        return [k, el ? Math.round(el.getBoundingClientRect().height) : null];
      }),
    );
    const tapTargets = [...home_.querySelectorAll('a, button')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      });
    const small = tapTargets.filter((t) => t.h < 44);
    const name = document.querySelector('[data-testid="lab-home-pending"] .footer__name');
    const label = document.querySelector('[data-testid="lab-home-pending"] .footer__label');
    const footerName = name
      ? { labelVisible: !!label && label.getBoundingClientRect().width > 0, nameWidth: Math.round(name.getBoundingClientRect().width), nameClipped: name.scrollWidth > name.clientWidth, text: name.textContent.trim() }
      : null;
    const titles = [...home_.querySelectorAll('.alert__title')].map((t) => {
      const range = document.createRange();
      range.selectNodeContents(t);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      return { text: t.textContent.trim(), lines, width: Math.round(t.getBoundingClientRect().width), scrollWidth: Math.round(t.scrollWidth) };
    });
    return {
      cardHeights,
      centered: Math.round((b.width / a.width) * 100) >= 85 && Math.abs(Math.round(b.left - a.left) - Math.round(a.right - b.right)) <= 2,
      tapTargetsUnder44: small,
      tapTargetCount: tapTargets.length,
      footerName,
      alertTitles: titles,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      leftGap: Math.round(b.left - a.left),
      rightGap: Math.round(a.right - b.right),
      widthPct: Math.round((b.width / a.width) * 100),
      footerBottoms,
      figureHeights,
      requestIds: [...document.querySelectorAll('[data-testid="lab-home"] [data-testid="support-code"] code')].map((e) => e.textContent.trim()),
      pendingRows: document.querySelectorAll('[data-testid="lab-home-pending-list"] li').length,
      pendingMore: document.querySelector('[data-testid="lab-home-pending"] .note')?.textContent.trim() ?? null,
    };
  });
}

async function shot(page, name, extra = {}) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.width, height: SIZES[vp.width] });
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.max(SIZES[vp.width], full) });
  await page.waitForTimeout(900);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file) });
  report.push({ file, width: vp.width, ...(await metrics(page)), ...extra });
  await page.setViewportSize(vp);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  for (const theme of ['light', 'dark']) {
    const tn = theme === 'light' ? 'claro' : 'oscuro';
    // ---- standard captures, both accounts, three widths
    for (const account of ['laboratorio', 'imagen']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('mantra-core-health.theme', t), theme);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
      await login(page, `${account}@alovida.mock`);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: SIZES[w] });
        await settled(page);
        await hideDemo(page);
        await shot(page, `inicio-${account}-${w}-${tn}`, { account, theme });
      }
      report.push({ account, theme, httpErrors: errs });
      await ctx.close();
    }

    // ---- states, lab account, 390 and 1440
    for (const w of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: SIZES[w] }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('mantra-core-health.theme', t), theme);
      const page = await ctx.newPage();
      await login(page, 'laboratorio@alovida.mock');
      await settled(page);
      await hideDemo(page);
      const tag = (s) => `estado-${s}-${w}-${tn}`;

      // S2 loading in every block.
      await withComp(page, (c) => {
        c.summary.set({ status: 'loading' });
        c.orders.set({ status: 'loading' });
        c.bookings.set({ status: 'loading' });
      });
      await page.waitForTimeout(300);
      await shot(page, tag('cargando'), { state: 'loading', theme });

      // S9 error in orders only: the other blocks keep their data.
      await page.evaluate(() =>
        sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/diagnostics/lab/orders', modo: 'error' }])),
      );
      await withComp(page, (c) => {
        c.loadSummary();
        c.loadBookings();
        c.loadOrders();
      });
      await settled(page);
      await page.waitForTimeout(500);
      await shot(page, tag('error-ordenes'), { state: 'error-orders-only', theme });

      // Everything failing at once: S9 with request ID, plus S8 offline for bookings.
      await page.evaluate(() =>
        sessionStorage.setItem(
          'mock:fallos',
          JSON.stringify([
            { patron: '/diagnostics/lab/orders', modo: 'error' },
            { patron: '/diagnostics/lab/summary', modo: 'error' },
            { patron: '/diagnostic-units/me/bookings', modo: 'red' },
          ]),
        ),
      );
      await withComp(page, (c) => {
        c.loadSummary();
        c.loadBookings();
        c.loadOrders();
      });
      await settled(page);
      await page.waitForTimeout(500);
      await shot(page, tag('error-todo'), { state: 'error-all', theme });
      await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));

      // Pending results with data: withdraw seeded files so processed orders have none.
      const withdraw = (count) =>
        withComp(
          page,
          async (c, n) => {
            const files = await new Promise((res, rej) => c.lab.listResultFiles({}).subscribe({ next: res, error: rej }));
            const orderIds = [...new Set(files.items.filter((f) => f.orderId).map((f) => f.orderId))].slice(0, n);
            for (const f of files.items.filter((f) => orderIds.includes(f.orderId))) {
              await new Promise((res, rej) =>
                c.lab.withdrawResult(f.id, 'Evidencia: archivo retirado para mostrar pendientes').subscribe({ next: res, error: rej }),
              );
            }
            c.loadOrders();
            c.loadSummary();
            c.loadBookings();
            return orderIds.length;
          },
          count,
        );
      await withdraw(2);
      await settled(page);
      await page.waitForTimeout(600);
      await shot(page, tag('pendientes-2filas'), { state: 'pending-2-rows', theme });
      await withdraw(99);
      await settled(page);
      await page.waitForTimeout(600);
      await shot(page, tag('pendientes-con-mas'), { state: 'pending-more-than-limit', theme });

      // Keyboard focus on a count tile and on an upload link (focus-visible needs a keyboard origin).
      await page.keyboard.press('Tab');
      await page.getByTestId('lab-home-count-received').focus();
      await shot(page, tag('foco-tile'), { state: 'focus-count-tile', theme });
      await page.keyboard.press('Tab');
      await page.getByTestId('lab-home-upload').first().focus();
      await shot(page, tag('foco-subir'), { state: 'focus-upload-link', theme });
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'medidas.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map((r) => ({ f: r.file, ov: r.overflowX, wp: r.widthPct, c: r.centered, ch: r.cardHeights, small: (r.tapTargetsUnder44 || []).length, ids: r.requestIds, fn: r.footerName, e: r.httpErrors })), null, 0));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
