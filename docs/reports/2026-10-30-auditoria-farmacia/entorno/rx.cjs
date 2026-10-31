const { chromium } = require('playwright');
(async () => {
  const [token, tag, storage] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(storage ? { storageState: storage } : {}) });
  const p = await ctx.newPage();
  const calls = [];
  p.on('requestfailed', r => calls.push('FAILED ' + r.url() + ' ' + r.failure()?.errorText)); p.on('console', m => { if (m.type()==='error') calls.push('console: ' + m.text().slice(0,200)); }); p.on('response', r => { if (!r.url().startsWith('http://localhost:4000/') || r.url().includes('/api')) calls.push(r.request().method() + ' ' + r.url().replace('http://localhost:3000', '') + ' → ' + r.status()); });
  const r = await p.goto('http://localhost:4000/rx/' + token, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  const f = process.env.HOME + '/auditoria/evidencia/rx-' + tag + '.png';
  await p.screenshot({ path: f, fullPage: true });
  console.log('HTTP', r.status(), 'url=', p.url(), 'title=', await p.title());
  console.log('h1/h2:', (await p.locator('h1, h2').allInnerTexts()).slice(0, 4).join(' | '));
  console.log(calls.join('\n'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
