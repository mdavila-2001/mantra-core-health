// Evidencia de la vitrina: node captura.cjs <carpeta-de-salida>
// Requiere `ng serve --port 4300` con el backend simulado.
const { chromium } = require('playwright');
const out = process.argv[2];
const URL = 'http://localhost:4300/search/medications';
const problemas = [];

function vigilar(p, w) {
  p.on('pageerror', (e) => problemas.push(`${w} pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && problemas.push(`${w} console.error: ${m.text()}`));
  p.on('requestfailed', (r) => {
    // Los tiles de OpenStreetMap no llegan desde la nube: se cuentan aparte.
    if (!r.url().includes('tile.openstreetmap')) problemas.push(`${w} requestfailed: ${r.url()}`);
  });
}

async function abrirArbol(p) {
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-testid="vitrina-grilla"]', { timeout: 60000 });
  await p.getByRole('radio', { name: 'Árbol' }).click();
  await p.waitForSelector('[data-testid="vitrina-arbol"]');
}

(async () => {
  // Con el Playwright del proyecto hace falta el Chromium de la imagen.
  const b = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  );
  const vps = [[390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
  for (const [w, h] of vps) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    vigilar(p, w);
    await abrirArbol(p);
    if (w === 1440) await p.screenshot({ path: `${out}/arbol-plegado-1440.png` });
    const first = p.locator('[data-testid="arbol-compuesto"]').first();
    await first.locator('summary').first().click();
    await p.waitForSelector('[data-testid="arbol-marcas"]', { timeout: 20000 });
    await first.locator('[data-testid="arbol-marcas"] details summary').first().click();
    await first.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(400); // que termine el giro del chevron
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.screenshot({ path: `${out}/arbol-${w}.png` });
    await p.locator('[data-testid="arbol-ver-farmacias"]').first().click();
    await p.waitForSelector('[data-testid="ficha-dosis-maxima"]', { timeout: 20000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/modal-${w}.png` });
    if (w === 1440) {
      await p.emulateMedia({ colorScheme: 'dark' });
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/modal-receta-1440-oscuro.png` });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      const cerrado = (await p.locator('[data-testid="ficha-dosis-maxima"]').count()) === 0;
      console.log(`Esc cierra el modal: ${cerrado}`);
      await first.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await p.screenshot({ path: `${out}/arbol-1440-oscuro.png` });
    }
    console.log(`${w}x${h} desborde=${sw}px`);
    await p.close();
  }

  // Venta libre dentro del árbol, y su modal.
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  vigilar(p, 'libre');
  await abrirArbol(p);
  const libre = p.locator('[data-testid="arbol-compuesto"]', { hasNotText: 'Con receta' }).first();
  await libre.locator('summary').first().click();
  await p.waitForSelector('[data-testid="arbol-marcas"]');
  await libre.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.screenshot({ path: `${out}/arbol-venta-libre-1440.png` });
  await libre.locator('[data-testid="arbol-ver-farmacias"]').click();
  await p.waitForSelector('[data-testid="ficha-venta-libre"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/modal-venta-libre-1440.png` });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/modal-venta-libre-1440-oscuro.png` });
  await p.close();

  // Teclado: foco en el primer compuesto, Enter lo abre y el anillo se ve.
  const k = await b.newPage({ viewport: { width: 1440, height: 900 } });
  vigilar(k, 'teclado');
  await abrirArbol(k);
  await k.locator('[data-testid="arbol-compuesto"] summary').first().focus();
  await k.keyboard.press('Enter');
  await k.waitForSelector('[data-testid="arbol-marcas"]');
  const abierto = await k
    .locator('[data-testid="arbol-compuesto"]')
    .first()
    .evaluate((d) => d.open);
  await k.keyboard.press('Tab');
  const siguiente = await k.evaluate(() => document.activeElement?.textContent?.trim());
  console.log(`Enter abre el compuesto: ${abierto}; Tab lleva a: ${siguiente}`);
  // Volver con Shift+Tab: foco por teclado, que es cuando corre :focus-visible.
  await k.keyboard.press('Shift+Tab');
  const foco = await k.evaluate(() => {
    const el = document.activeElement;
    const estilo = getComputedStyle(el);
    return `${el.tagName} :focus-visible=${el.matches(':focus-visible')} outline=${estilo.outlineStyle} ${estilo.outlineWidth}`;
  });
  console.log(`foco: ${foco}`);
  await k
    .locator('[data-testid="arbol-compuesto"]')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await k.screenshot({ path: `${out}/arbol-teclado-foco-1440.png` });
  await k.close();

  console.log('problemas:', problemas.length ? problemas : 'ninguno');
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
