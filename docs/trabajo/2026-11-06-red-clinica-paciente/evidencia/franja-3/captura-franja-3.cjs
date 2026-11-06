// Capturas y aserciones de la franja 3 en el stock de componentes (/design-system/stock).
// El stock monta cada escenario dentro de un iframe del tamaño del dispositivo: 390 es su
// preset «Móvil»; 1440 se fija sobre el preset «Escritorio» ajustando el ancho del iframe.
// Uso: node f3-captura.cjs <dir-salida>   (ng serve en :4320, configuración development,demo)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://localhost:4320/design-system/stock/features/clinical-record/patient-chart/red-clinica/';
const resultados = [];
const ok = (cond, msg) => { resultados.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

// El panel decide lateral/hoja con `Breakpoints`, que mide la ventana **principal** (el iframe del
// stock usa los inyectores del padre). Por eso la tanda de teléfono abre la página entera a 390:
// así la ventana y el marco miden lo mismo que en un teléfono real.
async function abrirPagina(b, tema, telefono = false) {
  const viewport = telefono ? { width: 390, height: 844 } : { width: 1800, height: 1100 };
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, colorScheme: tema });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text().slice(0, 200)}`); });
  return { ctx, p, errores };
}

/** Navega al componente, elige dispositivo y devuelve el frame con el escenario montado. */
async function ir(p, clave, ancho) {
  await p.goto(BASE + clave);
  await p.locator('iframe.marco-zona__marco').waitFor({ timeout: 120000 });
  await p.getByRole('button', { name: ancho === 390 ? 'Móvil' : 'Escritorio', exact: true }).click();
  await p.waitForTimeout(500);
  // El ancho útil del marco (clientWidth) tiene que ser el del dispositivo: se compensa el borde.
  await p.locator('iframe.marco-zona__marco').evaluate((f, w) => {
    f.style.maxWidth = 'none';
    f.style.width = `${w}px`;
    const borde = f.offsetWidth - f.clientWidth;
    f.style.width = `${w + borde}px`;
    f.style.height = `${w === 390 ? 844 : 900}px`;
  }, ancho);
  if (ancho === 390) {
    // A 390 la columna del banco tapa parte del marco: para la captura, el marco ocupa la
    // pantalla entera (sólo cambia la página del banco; el componente y su iframe no se tocan).
    await p.addStyleTag({ content: 'iframe.marco-zona__marco{position:fixed!important;inset:0!important;z-index:2147483647!important;transform:none!important;border:0!important;width:100vw!important;height:100vh!important;max-width:none!important;}' });
  }
  const frame = p.frameLocator('iframe.marco-zona__marco');
  await frame.getByTestId('escenario-red-clinica').waitFor({ timeout: 120000 });
  await p.waitForTimeout(900);
  const util = await frame.locator('body').evaluate(() => window.innerWidth);
  ok(util === ancho, `marco a ${ancho} px de ancho útil (mide ${util})`);
  return frame;
}

async function sinScrollHorizontal(frame, etiqueta) {
  const r = await frame.locator('body').evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(r.sw <= r.cw, `${etiqueta}: sin scroll horizontal (${r.sw} <= ${r.cw})`);
}

const activo = (frame) => frame.locator('body').evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  for (const tema of ['light', 'dark']) {
    // ---- escritorio 1440 ----
    {
      const { ctx, p, errores } = await abrirPagina(b, tema);
      const marco = p.locator('iframe.marco-zona__marco');
      let f = await ir(p, 'panel/red-clinica-panel', 1440);
      const temaReal = await f.locator('html').getAttribute('data-theme');
      ok(temaReal === tema, `${tema}: el marco está en tema ${temaReal}`);
      const panel = f.getByTestId('red-panel');
      ok((await panel.evaluate((e) => e.tagName)) === 'ASIDE', `${tema} 1440: panel lateral es <aside>`);
      const valores = f.getByTestId('red-panel-valor');
      ok((await valores.count()) === 3, `${tema} 1440: tres valores en la tabla`);
      ok((await valores.first().innerText()).includes('Alto'), `${tema} 1440: fuera de rango dicho con texto («Alto»)`);
      const nodoBox = await f.getByTestId('escenario-nodo').first().boundingBox();
      const panelBox = await panel.boundingBox();
      ok(nodoBox && panelBox && nodoBox.x + nodoBox.width <= panelBox.x, `${tema} 1440: el mapa queda a la izquierda del panel, sin taparse`);
      await sinScrollHorizontal(f, `${tema} 1440 estudio`);
      await marco.screenshot({ path: `${OUT}/1440-${tema}-01-panel-estudio-viewport.png` });
      await panel.screenshot({ path: `${OUT}/1440-${tema}-02-panel-estudio.png` });

      await f.getByTestId('red-panel-vinculo').filter({ hasText: 'Se pidió para estudiar' }).click();
      await p.waitForTimeout(400);
      ok((await activo(f)).includes('Hipertensión arterial esencial'), `${tema} 1440: un vínculo navega y el foco va al título nuevo`);

      await f.getByTestId('escenario-nodo').filter({ hasText: 'Cefalea tensional' }).click();
      await p.waitForTimeout(400);
      ok((await f.getByTestId('red-panel-reemplazo').count()) === 1, `${tema} 1440: diagnóstico descartado muestra «se descartó en favor de»`);
      await f.getByTestId('red-panel').screenshot({ path: `${OUT}/1440-${tema}-03-panel-diagnostico.png` });

      await f.getByTestId('escenario-nodo').filter({ hasText: 'Derivación a Cardiología' }).click();
      await p.waitForTimeout(400);
      ok((await f.getByTestId('red-panel-derivacion').innerText()).includes('todavía no devolvió'), `${tema} 1440: derivación sin contrarreferencia lo dice`);
      await f.getByTestId('red-panel').screenshot({ path: `${OUT}/1440-${tema}-04-panel-derivacion.png` });

      const disparador = f.getByTestId('escenario-nodo').filter({ hasText: 'Reconsulta de medicina general' });
      await disparador.focus();
      await p.keyboard.press('Enter');
      await p.waitForTimeout(400);
      ok((await f.getByTestId('red-panel-continuidad').innerText()).includes('Reconsulta de'), `${tema} 1440: reconsulta muestra su origen`);
      await f.getByTestId('red-panel').screenshot({ path: `${OUT}/1440-${tema}-05-panel-reconsulta.png` });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(400);
      ok((await f.getByTestId('red-panel').count()) === 0, `${tema} 1440: Escape cierra el panel`);
      ok((await activo(f)).includes('Reconsulta de medicina general'), `${tema} 1440: el foco vuelve al nodo que lo abrió`);

      f = await ir(p, 'filtros/red-clinica-filtros', 1440);
      await f.getByTestId('red-filtro-tipo').filter({ hasText: 'Diagnósticos' }).click();
      await p.waitForTimeout(300);
      ok((await f.getByTestId('red-filtros-cuenta').innerText()).includes('3 de 14'), `${tema} 1440: chip de tipo filtra (3 de 14)`);
      ok((await f.getByTestId('escenario-nodo').count()) === 3, `${tema} 1440: la lista muestra 3 nodos`);
      await marco.screenshot({ path: `${OUT}/1440-${tema}-06-filtros-tipo.png` });
      await f.getByTestId('red-filtros-limpiar').click();
      await p.waitForTimeout(300);
      ok((await f.getByTestId('escenario-nodo').count()) === 14, `${tema} 1440: «Limpiar filtros» vuelve a 14`);

      f = await ir(p, 'alertas/red-clinica-alertas-lista', 1440);
      const alertas = f.getByTestId('red-alerta');
      ok((await alertas.count()) === 5, `${tema} 1440: cinco alertas a la vista de siete`);
      await alertas.first().hover();
      await p.waitForTimeout(200);
      ok((await f.locator('.red__nodo--resaltado').count()) >= 1, `${tema} 1440: el puntero sobre una alerta resalta sus nodos`);
      await f.getByTestId('red-alertas-todas').click();
      await p.waitForTimeout(200);
      ok((await alertas.count()) === 7, `${tema} 1440: «Ver las 7 alertas» las muestra todas`);
      await f.getByTestId('red-alertas').screenshot({ path: `${OUT}/1440-${tema}-07-alertas.png` });
      await alertas.first().click();
      await p.waitForTimeout(400);
      ok((await f.getByTestId('red-panel').innerText()).includes('Hipertrofia ventricular izquierda'), `${tema} 1440: clic en una alerta abre su nodo`);
      await marco.screenshot({ path: `${OUT}/1440-${tema}-08-alerta-abre-nodo.png` });

      ok(errores.length === 0, `${tema} 1440: sin errores de consola${errores.length ? ' — ' + errores.join(' | ') : ''}`);
      await ctx.close();
    }
    // ---- teléfono 390 ----
    {
      const { ctx, p, errores } = await abrirPagina(b, tema, true);
      const marco = p.locator('iframe.marco-zona__marco');
      let f = await ir(p, 'filtros/red-clinica-filtros', 390);
      await sinScrollHorizontal(f, `${tema} 390 filtros`);
      await f.getByTestId('red-filtros').screenshot({ path: `${OUT}/390-${tema}-01-filtros-plegados.png` });
      await f.getByRole('button', { name: 'Más filtros' }).click();
      await p.waitForTimeout(300);
      await f.getByTestId('red-filtros').screenshot({ path: `${OUT}/390-${tema}-02-filtros-desplegados.png` });
      await sinScrollHorizontal(f, `${tema} 390 filtros desplegados`);

      f = await ir(p, 'alertas/red-clinica-alertas-lista', 390);
      await f.getByTestId('red-alertas').screenshot({ path: `${OUT}/390-${tema}-03-alertas.png` });
      await sinScrollHorizontal(f, `${tema} 390 alertas`);

      await f.getByTestId('escenario-nodo').filter({ hasText: 'Monitoreo ambulatorio' }).click();
      await p.waitForTimeout(700);
      const hoja = f.getByTestId('red-panel');
      ok((await hoja.evaluate((e) => e.tagName)) === 'DIALOG', `${tema} 390: en el teléfono es una hoja <dialog>`);
      ok(await hoja.evaluate((e) => e.matches(':modal')), `${tema} 390: la hoja es modal (foco atrapado por el navegador)`);
      const caja = await hoja.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; });
      ok(caja.x >= 0 && caja.x + caja.w <= 390.5, `${tema} 390: la hoja entra en el ancho (${caja.x}+${caja.w})`);
      await p.screenshot({ path: `${OUT}/390-${tema}-04-hoja-estudio.png` });
      await f.getByTestId('red-panel').evaluate((e) => { const c = e.querySelector('.panel__cuerpo'); if (c) c.scrollTop = 520; });
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/390-${tema}-05-hoja-resultado.png` });
      await f.getByTestId('red-panel').evaluate((e) => { const c = e.querySelector('.panel__cuerpo'); if (c) c.scrollTop = 0; });
      // Dentro del iframe del stock, el Tab que pasa el último control de la hoja sale al
      // documento PADRE (el banco), que el `<dialog>` no puede volver inerte: es un artefacto
      // del marco. Se comprueba lo que sí es del componente: el foco empieza y sigue en la hoja
      // mientras se recorren sus controles, y el resto del documento del marco queda inerte.
      const inicial = await f.locator('body').evaluate(() => !!document.activeElement?.closest('dialog'));
      ok(inicial, `${tema} 390: al abrir, el foco está en la hoja`);
      for (let i = 0; i < 4; i++) await p.keyboard.press('Tab');
      const dentro = await f.locator('body').evaluate(() => !!document.activeElement?.closest('dialog'));
      ok(dentro, `${tema} 390: cuatro Tab siguen dentro de la hoja`);
      const fueraInerte = await f.locator('body').evaluate(() => {
        const nodo = document.querySelector('[data-testid="escenario-nodo"]');
        if (!nodo) return false;
        nodo.focus();
        return !nodo.matches(':focus');
      });
      ok(fueraInerte, `${tema} 390: con la hoja abierta, un nodo del mapa no puede recibir foco (inerte)`);
      await f.getByTestId('red-panel').locator('h2').focus();
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      ok((await f.getByTestId('red-panel').count()) === 0, `${tema} 390: Escape cierra la hoja`);
      ok((await activo(f)).includes('Monitoreo ambulatorio'), `${tema} 390: el foco vuelve al nodo`);
      ok(errores.length === 0, `${tema} 390: sin errores de consola${errores.length ? ' — ' + errores.join(' | ') : ''}`);
      await ctx.close();
    }
  }
  await b.close();
  fs.writeFileSync(`${OUT}/aserciones.txt`, resultados.join('\n') + '\n');
  console.log(resultados.join('\n'));
  if (resultados.some((r) => r.startsWith('FAIL'))) process.exit(2);
})().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/aserciones.txt`, resultados.join('\n') + `\nERROR ${String(e).slice(0, 500)}\n`);
  console.log(resultados.join('\n'));
  process.exit(1);
});
