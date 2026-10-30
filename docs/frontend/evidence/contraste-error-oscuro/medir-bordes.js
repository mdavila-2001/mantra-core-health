const { chromium } = require('playwright');
const fs = require('fs');
const [,, label, port, route, theme] = process.argv;
const OUT = '/home/user/mantra-core-health/docs/frontend/evidence/contraste-error-oscuro';
const lum = ([r,g,b]) => { const c=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const ratio = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(t => localStorage.setItem('mantra-core-health.theme', t), theme);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}${route}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.required-asterisk', { timeout: 120000 });
  await p.locator('button[type=submit]').first().click();
  await p.waitForSelector('.form-field-error', { timeout: 15000 });
  await p.waitForTimeout(800);
  const wrappers = await p.locator('.input-wrapper.status-error, .select-wrapper.status-error, .textarea-wrapper.status-error').count();
  const out = [];
  for (let i = 0; i < wrappers; i++) {
    const el = p.locator('.input-wrapper.status-error, .select-wrapper.status-error, .textarea-wrapper.status-error').nth(i);
    await el.scrollIntoViewIfNeeded();
    const info = await el.evaluate(e => {
      const parse = s => s.match(/[\d.]+/g).map(Number);
      const cs = getComputedStyle(e);
      let n = e.parentElement, bg = null;
      while (n && !bg) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > .99) bg = c.slice(0,3); n = n.parentElement; }
      return { cls: e.className.split(' ').filter(c => /wrapper|status-error|focused/.test(c)).join('.'), border: parse(cs.borderTopColor).slice(0,3), width: cs.borderTopWidth, bg, focused: e.classList.contains('is-focused') };
    });
    // pixel real del borde: columna izquierda, a media altura, en una captura del elemento
    const png = await el.screenshot();
    const px = await p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, Math.floor(img.height / 2), 6, 1).data; // primeras 6 columnas a media altura
      return [...d];
    }, png.toString('base64'));
    const cols = []; for (let k = 0; k < px.length; k += 4) cols.push([px[k], px[k+1], px[k+2]]);
    const mejor = cols.reduce((a, c) => ratio(c, info.bg) > ratio(a, info.bg) ? c : a, cols[0]);
    out.push({ n: i, cls: info.cls, borde: `rgb(${info.border})`, ancho: info.width, fondo: `rgb(${info.bg})`, ratioComputado: +ratio(info.border, info.bg).toFixed(2), pixelBorde: `rgb(${mejor})`, ratioPixel: +ratio(mejor, info.bg).toFixed(2), foco: info.focused });
  }
  console.log(label, route, theme, 'data-theme=' + await p.getAttribute('html', 'data-theme'));
  console.table(out);
  fs.writeFileSync(`${OUT}/bordes-${label}-${route.split('/').pop()}-${theme}.json`, JSON.stringify({ label, route, theme, viewport: '1440x900', controles: out }, null, 2));
  await p.screenshot({ path: `${OUT}/bordes-${label}-${route.split('/').pop()}-${theme}.png` });
  await b.close();
})();
