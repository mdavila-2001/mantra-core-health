const fs = require('fs');
const H = require('./h.cjs');
const EV = '/home/user/mantra-core-health/docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/evidencia/medico';
const TEMA = process.env.TEMA || 'claro';
const lines = []; const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); lines.push(s); };
const active = (page) => page.evaluate(() => {
  const e = document.activeElement; if (!e) return null;
  const cs = getComputedStyle(e);
  const box = e.closest('label.checkbox-container')?.querySelector('.checkbox-box');
  const bs = box ? getComputedStyle(box) : null;
  const cs2 = e.closest('app-checkbox') ? bs : cs;
  return { tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), role: e.getAttribute('role'), aria: e.getAttribute('aria-label'), tid: e.closest('[data-testid]')?.getAttribute('data-testid') ?? null, txt: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    focusVisible: e.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 80),
    ringOnBox: bs ? { outline: `${bs.outlineStyle} ${bs.outlineWidth}`, boxShadow: bs.boxShadow === 'none' ? 'none' : bs.boxShadow.slice(0, 80) } : null };
});
(async () => {
  const b = await H.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1250 }, locale: 'es-BO' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, TEMA === 'oscuro' ? 'dark' : 'light');
  const page = await ctx.newPage(); const sink = []; H.watch(page, sink);
  await H.login(page); await H.goPatientConsultation(page); await H.openOrders(page);
  const shotFocus = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${EV}/${name}.png` }); };
  say('== Picker de laboratorio: orden de Tab desde la búsqueda');
  await page.locator('[data-testid=estudios-laboratorio] input').first().focus();
  say('foco inicial:', await active(page));
  const seq = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); seq.push(await active(page)); }
  for (const s of seq) say(` Tab -> ${s.tag}${s.role ? '[' + s.role + ']' : ''} ${s.aria ?? s.txt} | tid=${s.tid} | focus-visible=${s.focusVisible} | outline=${s.outline} | shadow=${s.boxShadow} | ringBox=${JSON.stringify(s.ringOnBox)}`);
  // Segmentado Tabla/Lista con flechas
  await page.locator('[data-testid=segmentado-grid]').focus();
  say('foco en «Tabla»:', await active(page));
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
  say('ArrowRight -> vista Lista activa =', (await page.getByTestId('lab-picker-list').count()) > 0, '| foco:', (await active(page)).tid);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(600);
  say('ArrowLeft -> vista Tabla activa =', (await page.getByTestId('lab-picker-grid').count()) > 0);
  // Checkbox con Espacio
  await page.locator('[data-testid=estudios-laboratorio] input').first().fill('hemograma'); await page.waitForTimeout(900);
  const cb = H.card(page, 'sin diferencial').getByTestId('lab-picker-parent').locator('input');
  await cb.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  say('foco en casilla del padre:', await active(page));
  await shotFocus(`teclado-1-foco-casilla-padre-1440-${TEMA}`);
  await page.keyboard.press('Space'); await page.waitForTimeout(800);
  say('Espacio -> padre', await H.cbState(H.card(page, 'sin diferencial').getByTestId('lab-picker-parent')), '|', await H.counter(page));
  // bajar a un componente con Tab y desmarcar con Espacio
  await page.keyboard.press('Tab'); say('Tab siguiente:', (await active(page)).tid);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  say('Espacio sobre el 1.er componente -> contador:', await H.counter(page));
  await shotFocus(`teclado-2-foco-componente-1440-${TEMA}`);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Space'); await page.waitForTimeout(600);
  say('Espacio sobre el padre (tri-estado) ->', await H.cbState(H.card(page, 'sin diferencial').getByTestId('lab-picker-parent')), '|', await H.counter(page));
  // Enter en «Ver más» no aplica con 2 resultados; Enter sobre botón Pedir deshabilitado
  say('== Imagenología: select de región por teclado');
  await page.getByTestId('segmentado-IMAGING').click(); await page.getByTestId('imaging-picker').waitFor(); await page.waitForTimeout(1200);
  await page.getByTestId('imaging-picker-study').locator('button').first().focus(); say('foco en el select de estudio:', await active(page)); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.keyboard.type('mano PA y'); await page.waitForTimeout(700);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  say('estudio elegido por teclado ->', (await page.getByTestId('imaging-picker-counter').innerText({ timeout: 5000 }).catch(() => 'sin contador')));
  await page.getByTestId('body-region-visor').scrollIntoViewIfNeeded(); await page.waitForTimeout(3000);
  const trig = page.locator('.tree-select-trigger'); await trig.focus();
  say('foco en el select de región:', await active(page));
  await shotFocus(`teclado-3-foco-select-region-1440-${TEMA}`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  say('Enter abre el diálogo =', (await page.locator('dialog.tree-select-dialog[open]').count()) > 0, '| foco:', await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('placeholder') ?? '')));
  await page.keyboard.type('dedos'); await page.waitForTimeout(600);
  say('opciones tras escribir «dedos»:', await page.evaluate(() => [...document.querySelectorAll('dialog[open] [role=option]')].map(e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40))));
  await shotFocus(`teclado-4-select-region-buscando-1440-${TEMA}`);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  say('(con el filtro «dedos» hay un encabezado de grupo y una fila: hacen falta dos ArrowDown) Enter elige ->', (await H.regionText(page)), '| viva:', await page.getByTestId('body-region-viva').innerText(), '| diálogo cerrado =', (await page.locator('dialog.tree-select-dialog[open]').count()) === 0, '| foco devuelto al disparador =', await page.evaluate(() => document.activeElement?.classList.contains('tree-select-trigger')));
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  say('Escape cierra el select sin cambiar =', (await page.locator('dialog.tree-select-dialog[open]').count()) === 0, '| el modal principal sigue abierto =', (await page.locator('[data-testid=consulta-modal] dialog[open]').count()) > 0, '| región =', await H.regionText(page));
  // Lado con flechas
  const lado = page.locator('.body-region-picker__lado [role=radio]');
  say('lado: opciones', await lado.evaluateAll(es => es.map(e => e.textContent.trim() + ':' + e.getAttribute('aria-checked'))));
  await lado.first().focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
  say('ArrowRight en «Lado del paciente» ->', await lado.evaluateAll(es => es.map(e => e.textContent.trim() + ':' + e.getAttribute('aria-checked'))), '| resumen:', await page.getByTestId('imaging-picker-counter').innerText());
  await shotFocus(`teclado-5-foco-lado-1440-${TEMA}`);
  // Tab dentro del visor 3D: ¿el canvas es alcanzable por teclado?
  const cv = await page.evaluate(() => { const c = document.querySelector('[data-testid=anatomy-viewer-canvas]'); return { tabindex: c?.getAttribute('tabindex'), role: c?.getAttribute('role'), label: c?.getAttribute('aria-label') ?? c?.closest('[aria-label]')?.getAttribute('aria-label') }; });
  say('canvas 3D: ', cv);
  fs.writeFileSync(`${EV}/teclado-${TEMA}.log`, lines.join('\n') + '\n');
  fs.writeFileSync(`${EV}/teclado-consola-red-${TEMA}.json`, JSON.stringify(sink.filter(s => !/NG0505|development mode/.test(s.t)), null, 2));
  await b.close();
})();
