const { chromium } = require('playwright');
const BASE='http://localhost:4311', OUT=process.argv[2];
const congelar = () => {
  // Solo con la bandera: los plazos de la maqueta (40–600 ms) no vencen nunca.
  const orig = window.setTimeout;
  window.setTimeout = function (fn, ms, ...a) {
    let f = false; try { f = sessionStorage.getItem('__congelar') === '1'; } catch {}
    if (f && typeof ms === 'number' && [40, 90, 120, 600].includes(ms)) return orig(fn, 3_600_000, ...a);
    return orig(fn, ms, ...a);
  };
  const origI = window.setInterval;
  window.setInterval = function (fn, ms, ...a) {
    let f = false; try { f = sessionStorage.getItem('__congelar') === '1'; } catch {}
    if (f && typeof ms === 'number' && [40, 90, 120, 600].includes(ms)) return origI(fn, 3_600_000, ...a);
    return origI(fn, ms, ...a);
  };
};
async function entrar(page, doc) {
  await page.goto(BASE + '/auth');
  await page.getByTestId('login-identifier').fill(doc);
  await page.getByTestId('login-password').fill('demo');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('header-cuenta').waitFor({ timeout: 60000 });
}
(async () => {
  const b = await chromium.launch();
  const rutas = [['/dashboard', 'inicio'], ['/my-account/privacy', 'privacidad'], ['/messaging', 'mensajeria']];
  for (const [w, h] of [[1440, 900], [390, 844]]) for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(congelar);
    const page = await ctx.newPage();
    await entrar(page, '7654321');
    await page.evaluate((t) => localStorage.setItem('mantra-core-health.theme', t), tema);
    for (const [ruta, nombre] of rutas) {
      await page.evaluate(() => sessionStorage.removeItem('__congelar'));
      await page.goto(BASE + '/my-account', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('header-cuenta').waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.evaluate((r) => { sessionStorage.setItem('__congelar', '1'); history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, ruta);
      const esperas = page.locator('app-loading-state');
      try { await esperas.first().waitFor({ timeout: 30000 }); } catch { console.log(w, tema, ruta, 'SIN ESPERA', page.url()); continue; }
      await page.waitForTimeout(700);
      const info = await esperas.evaluateAll(ns => ns.map(n => {
        const r = n.getBoundingClientRect();
        return { txt: n.textContent.trim().replace(/\s+/g, ' '), role: n.getAttribute('role'),
          internos: n.querySelectorAll('[role=status]').length, ancho: Math.round(r.width),
          desborda: n.scrollWidth > n.clientWidth + 1, aro: getComputedStyle(n.querySelector('app-spinner')).color };
      }));
      const docDesborda = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      console.log(w, tema, ruta, 'scrollX:', docDesborda, JSON.stringify(info));
      await esperas.first().evaluate((n) => n.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      console.log('  tema aplicado:', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
      await page.screenshot({ path: `${OUT}/${nombre}-${w}-${tema}.png` });
      await page.evaluate(() => sessionStorage.removeItem('__congelar'));
    }
    await ctx.close();
  }
  await b.close();
})();
