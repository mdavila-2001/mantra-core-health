const { chromium } = require('playwright');
const fs = require('fs');
const [,, label, route, theme] = process.argv;
const OUT = '/home/user/mantra-core-health/docs/frontend/evidence/contraste-error-oscuro';
const lum = ([r,g,b]) => { const c=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const ratio = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(t => localStorage.setItem('mantra-core-health.theme', t), theme);
  const p = await ctx.newPage();
  const pageErrors = []; p.on('pageerror', e => pageErrors.push(String(e)));
  await p.goto('http://localhost:4200' + route, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.required-asterisk', { timeout: 90000 });
  console.log('data-theme =', await p.getAttribute('html', 'data-theme'));
  await p.locator('button[type=submit]').first().click();
  await p.waitForSelector('.form-field-error', { timeout: 15000 });
  await p.waitForTimeout(800); // la animación de entrada del error (spring) termina
  const shot = `${OUT}/${label}-${route.split('/').pop()}-${theme}.png`;
  await p.screenshot({ path: shot });
  const results = [];
  for (const sel of ['.form-field-error', '.required-asterisk']) {
    const el = p.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const info = await el.evaluate(e => {
      const parse = s => s.match(/[\d.]+/g).map(Number);
      let n = e, bg = null;
      while (n && !bg) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length < 4 || c[3] > 0.99) { if (c[3] === undefined || c[3] > .99) bg = c.slice(0,3); } n = n.parentElement; }
      return { text: e.textContent.trim().slice(0, 60), color: parse(getComputedStyle(e).color).slice(0,3), bg };
    });
    // muestreo de píxeles: captura del elemento, se busca el píxel más lejano al fondo
    const png = await el.screenshot();
    const px = await p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); return [...g.getImageData(0,0,c.width,c.height).data];
    }, png.toString('base64'));
    const bg = info.bg; let best = null, bestR = 0;
    for (let i = 0; i < px.length; i += 4) { const col = [px[i],px[i+1],px[i+2]]; const r = ratio(col, bg); if (r > bestR) { bestR = r; best = col; } }
    results.push({ sel, text: info.text, computedColor: `rgb(${info.color})`, bg: `rgb(${bg})`, computedRatio: +ratio(info.color, bg).toFixed(2), pixelColor: `rgb(${best})`, pixelRatio: +bestR.toFixed(2) });
  }
  console.table(results);
  fs.writeFileSync(shot.replace('.png', '.json'), JSON.stringify({ label, route, theme, viewport: '1440x900', results, pageErrors }, null, 2));
  console.log('screenshot', shot, 'pageErrors', pageErrors.length);
  await b.close();
})();
