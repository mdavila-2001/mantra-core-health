const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const res = {};
  const errs = [];
  for (const [nombre, vp] of [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp });
    const p = await ctx.newPage();
    p.on('console', (m) => m.type() === 'error' && errs.push(`${nombre}: ${m.text()}`));
    p.on('pageerror', (e) => errs.push(`${nombre} pageerror: ${e.message}`));
    await p.goto('http://localhost:4311/auth');
    await p.getByTestId('login-identifier').fill('medica@alovida.mock');
    await p.getByTestId('login-password').fill('alovida');
    await p.getByTestId('login-submit').click();
    await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
    if (p.url().includes('/auth/organization')) {
      await p.getByTestId('tenant-opcion').first().click();
      await p.waitForURL(/\/dashboard/, { timeout: 60000 });
    }
    await p.goto('http://localhost:4311/messaging');
    await p.getByTestId('conversacion').first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(600);
    const r = {};
    r.filas = await p.getByTestId('conversacion').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    r.itemH = await p.locator('.conversaciones__item').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().height)))]);
    r.panel = await p.evaluate(() => {
      const el = document.querySelector('.mensajeria__panel');
      const rect = el.getBoundingClientRect();
      const filas = [...document.querySelectorAll('.conversaciones__item')].map((e) => e.getBoundingClientRect().right);
      return { panelRight: Math.round(rect.right), maxFilaRight: Math.round(Math.max(...filas)), scrollW: el.scrollWidth, clientW: el.clientWidth, docOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    r.carril = await p.evaluate(() => {
      const c = document.querySelector('.mensajeria__chips');
      const a = document.querySelector('[data-testid="mensajeria-filtros-anterior"]');
      const s = document.querySelector('[data-testid="mensajeria-filtros-siguiente"]');
      return { scrollW: c.scrollWidth, clientW: c.clientWidth, scrollLeft: c.scrollLeft, anteriorOff: a.disabled, siguienteOff: s.disabled, chips: [...c.children].map((x) => x.textContent.trim().replace(/\s+/g, ' ')) };
    });
    await p.screenshot({ path: `${OUT}/${nombre}-01-bandeja.png` });
    const sig = p.getByTestId('mensajeria-filtros-siguiente');
    if (!(await sig.isDisabled())) {
      await sig.click();
      await p.waitForTimeout(700);
      r.carilloTrasSiguiente = await p.evaluate(() => {
        const c = document.querySelector('.mensajeria__chips');
        return { scrollLeft: Math.round(c.scrollLeft), anteriorOff: document.querySelector('[data-testid="mensajeria-filtros-anterior"]').disabled, siguienteOff: document.querySelector('[data-testid="mensajeria-filtros-siguiente"]').disabled };
      });
      await p.screenshot({ path: `${OUT}/${nombre}-02-carril-desplazado.png` });
    }
    // contador de no leídos con Pulse
    r.pulse = await p.evaluate(() => {
      const e = document.querySelector('.conversaciones__sin-leer');
      return e ? getComputedStyle(e).animationName : 'sin contador visible';
    });
    // Archivados es un chip que se prende y apaga
    const arch = p.getByTestId('mensajeria-archivados');
    await arch.scrollIntoViewIfNeeded();
    await arch.click();
    await p.waitForTimeout(300);
    r.archivadosPressed = await arch.getAttribute('aria-pressed');
    await p.screenshot({ path: `${OUT}/${nombre}-03-archivados.png` });
    await arch.click();
    await p.waitForTimeout(300);
    r.archivadosPressedDespues = await arch.getAttribute('aria-pressed');
    // hilo + composer :active
    await p.getByTestId('conversacion').first().click();
    await p.getByTestId('hilo-texto').waitFor();
    const icono = p.locator('.composer__icono:visible').first();
    r.iconos = await p.locator('.composer__icono:visible').count();
    const box = await icono.boundingBox();
    r.enPunto = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.className + ' <' + e.tagName + '>' : null; }, [box.x + box.width / 2, box.y + box.height / 2]);
    await icono.hover();
    await p.mouse.down();
    await p.waitForTimeout(250);
    r.composerActive = await icono.evaluate((e) => ({ activo: e.matches(':active'), transform: getComputedStyle(e).transform, disabled: e.disabled }));
    await p.screenshot({ path: `${OUT}/${nombre}-04-hilo-composer.png` });
    await p.mouse.up();
    res[nombre] = r;
    await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORES DE CONSOLA:', JSON.stringify(errs.filter((e) => !/CSP|Content Security/i.test(e))));
  await b.close();
})();
