const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const vps = [[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]];
  const errs = [];
  for (const [w,h] of vps) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errs.push(`${w}: ${e.message}`));
    await p.goto('http://localhost:4300/search/medications', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-testid="vitrina-grilla"]', { timeout: 60000 });
    await p.getByRole('radio', { name: 'Árbol' }).click();
    await p.waitForSelector('[data-testid="vitrina-arbol"]');
    const first = p.locator('[data-testid="arbol-compuesto"]').first();
    await first.locator('summary').first().click();
    await p.waitForSelector('[data-testid="arbol-marcas"]', { timeout: 20000 });
    await first.locator('[data-testid="arbol-marcas"] details summary').first().click();
    await first.evaluate(el => el.scrollIntoView({block: 'start'}));
    await p.evaluate(() => window.scrollBy(0, -80));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.screenshot({ path: `${out}/arbol-${w}.png`, fullPage: false });
    const txt = await first.innerText();
    if (w === 1440) console.log('ARBOL:\n' + txt.slice(0, 900));
    await p.locator('[data-testid="arbol-ver-farmacias"]').first().click();
    await p.waitForSelector('[data-testid="ficha-dosis-maxima"]', { timeout: 20000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/modal-${w}.png` });
    const rx = await p.locator('[data-testid="ficha-receta-obligatoria"], [data-testid="ficha-venta-libre"]').first().innerText();
    console.log(`${w}x${h} overflowX=${sw} modal: ${rx.replace(/\n/g,' | ')}`);
    await p.close();
  }
  // venta libre: buscar uno sin receta en el mock (índices 5,6,11,12)
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:4300/search/medications', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-testid="vitrina-grilla"]', { timeout: 60000 });
  await p.getByRole('radio', { name: 'Árbol' }).click();
  const libre = p.locator('[data-testid="arbol-compuesto"]', { hasText: 'Venta libre' }).first();
  await libre.locator('[data-testid="arbol-ver-farmacias"]').evaluate(el => el.closest('details').open = true);
  await libre.locator('[data-testid="arbol-ver-farmacias"]').click();
  await p.waitForSelector('[data-testid="ficha-venta-libre"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/modal-venta-libre-1440.png` });
  // oscuro
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/modal-venta-libre-1440-oscuro.png` });
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
