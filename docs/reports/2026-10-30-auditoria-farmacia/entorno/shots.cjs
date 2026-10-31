const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = process.env.HOME + '/auditoria/evidencia';
  for (const [w, h] of [[1440, 900], [390, 844]]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    if (scheme === 'dark') await ctx.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'dark'));
    const p = await ctx.newPage();
    const r = await p.goto('http://localhost:4000/auth', { waitUntil: 'load' });
    await p.locator('input[type=email], input[type=password]').first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(800);
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const theme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const f = `${out}/login-${w}x${h}-${scheme}.png`;
    await p.screenshot({ path: f });
    console.log(w + 'x' + h, scheme, 'HTTP', r.status(), 'title=', await p.title(), 'body-bg=', bg, 'data-theme=', theme);
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
