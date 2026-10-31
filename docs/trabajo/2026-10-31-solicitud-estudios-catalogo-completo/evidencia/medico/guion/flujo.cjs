const fs = require('fs');
const H = require('./h.cjs');
const EV = '/home/user/mantra-core-health/docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/evidencia/medico';
const OUT = process.env.OUT_PREFIX || 'flujo';
const lines = []; const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); lines.push(s); };
const posts = []; // delta de escrituras por fase
let seen = 0;
async function delta(page, fase) {
  const all = await H.registro(page);
  const nuevos = all.slice(seen); seen = all.length;
  for (const n of nuevos) posts.push({ fase, ...n });
  return nuevos;
}
const short = (n) => `${n.method} ${n.path} -> ${n.status}`;
async function part(name, fn) { say(`\n=== ${name}`); try { await fn(); } catch (e) { say(`FALLO en ${name}: ${e.message.split('\n')[0]}`); } }
const pngs = (page, name, opts = {}) => page.screenshot({ path: `${EV}/${name}.png`, ...opts });
async function dlgScroll(page, y) { await page.locator('[data-testid=consulta-modal] dialog').evaluate((d, yy) => { d.scrollTo(0, yy); }, y); await page.waitForTimeout(300); }
async function ordenesStore(page) {
  return page.evaluate(() => { const f = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || '{}').filas ?? []; } catch { return []; } }; return { ordenes: f('mock.clinica.ordenes'), detalle: f('mock.clinica.ordenes.detalle') }; });
}
(async () => {
  const b = await H.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1400 }, locale: 'es-BO' });
  const page = await ctx.newPage(); const sink = []; H.watch(page, sink);
  await H.login(page);
  await page.evaluate(() => sessionStorage.setItem('mock:registrar', '1'));
  const pid = await H.goPatientConsultation(page); say('paciente (perfil)', pid);
  const T0 = new Date().toISOString(); const base = await ordenesStore(page); say('órdenes en el simulador antes:', base.ordenes.length, ' detalles:', base.detalle.length);
  await delta(page, 'preparación');

  await part('1. Laboratorio', async () => {
    await H.openOrders(page);
    const si = page.locator('[data-testid=estudios-laboratorio] input').first();
    await si.fill('hemoglobina'); await page.waitForTimeout(1500);
    say('buscar «hemoglobina»:', await page.getByTestId('lab-picker-results').innerText(), '|', (await page.getByTestId('lab-picker-card').allInnerTexts()).map(t => t.split('\n')[0]));
    await pngs(page, 'lab-1-buscar-hemoglobina-1440-claro');
    await si.fill('hemograma'); await page.waitForTimeout(900);
    say('buscar «hemograma»:', await page.getByTestId('lab-picker-results').innerText(), '|', (await page.getByTestId('lab-picker-card').allInnerTexts()).map(t => t.split('\n')[0]));
    let c = H.card(page, 'sin diferencial');
    say('padre antes de marcar', await H.cbState(c.getByTestId('lab-picker-parent')));
    await c.getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(800);
    say('padre tras marcar (esperado tri-estado: 11 de 13 por defecto)', await H.cbState(c.getByTestId('lab-picker-parent')), '|', await H.counter(page));
    await pngs(page, 'lab-2-hemograma-marcado-tabla-1440-claro');
    await page.getByTestId('segmentado-list').click(); await page.waitForTimeout(600);
    const r = H.row(page, 'sin diferencial');
    say('vista Lista: padre', await H.cbState(r.getByTestId('lab-picker-parent')), '| contador del renglón', (await r.getByTestId('lab-picker-expand').innerText()).trim());
    await r.getByTestId('lab-picker-expand').click(); await page.waitForTimeout(400);
    await r.getByTestId('lab-picker-component').nth(2).locator('label').click(); await page.waitForTimeout(500);
    say('Lista: desmarco «Hemoglobina» -> padre', await H.cbState(r.getByTestId('lab-picker-parent')), '|', await H.counter(page));
    await pngs(page, 'lab-3-lista-1440-claro');
    await page.getByTestId('segmentado-grid').click(); await page.waitForTimeout(600);
    c = H.card(page, 'sin diferencial');
    say('de vuelta en Tabla: Hemoglobina marcada =', await c.getByTestId('lab-picker-component').nth(2).evaluate(e => e.querySelector('input').checked), '|', await H.counter(page));
    const n = await c.getByTestId('lab-picker-component').count();
    for (let i = 0; i < n; i++) { const ck = await c.getByTestId('lab-picker-component').nth(i).evaluate(e => e.querySelector('input').checked); if (ck) await c.getByTestId('lab-picker-component').nth(i).locator('label').click(); }
    await page.waitForTimeout(700);
    say('todos desmarcados: padre', await H.cbState(c.getByTestId('lab-picker-parent')), '|', await H.counter(page));
    const vac = page.getByTestId('estudios-panel-vacio');
    say('estudios-panel-vacio visible =', await vac.isVisible(), (await vac.innerText()).replace(/\s+/g, ' '));
    const btn = H.pedirBtn(page);
    say('botón «Pedir estudios» deshabilitado =', await btn.isDisabled());
    await delta(page, 'lab-sin-componentes');
    await btn.scrollIntoViewIfNeeded(); await pngs(page, 'lab-4-panel-vacio-pedir-deshabilitado-1440-claro');
    await c.getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(800);
    say('volver a marcar: padre', await H.cbState(c.getByTestId('lab-picker-parent')), '|', await H.counter(page), '| pedir deshabilitado =', await btn.isDisabled());
    await btn.scrollIntoViewIfNeeded();
    await pngs(page, 'lab-5-listo-para-pedir-1440-claro');
    await btn.click(); await page.waitForTimeout(2500);
    const d = await delta(page, 'lab-pedir'); say('PETICIONES:', d.map(short));
    say('toast:', await page.getByTestId('toast-mensaje').allInnerTexts());
    const rq = d.find(x => x.path === '/clinical/requisitions');
    say('cuerpo requisición:', rq?.body);
    await pngs(page, 'lab-6-tras-pedir-modal-cerrado-1440-claro');
    const st = await ordenesStore(page);
    const nuevas = st.ordenes.filter(o => (o.createdAt ?? '') >= T0);
    say('persistencia (sessionStorage mock.clinica.ordenes): +', nuevas.length, 'renglón(es); detalle +', st.detalle.length - base.detalle.length);
    fs.writeFileSync(`${EV}/persistencia-lab.json`, JSON.stringify({ ordenes: nuevas, detalle: st.detalle.filter(x => nuevas.some(o => o.id === (x.id ?? x.serviceRequestId))) }, null, 2));
    await page.reload(); await page.waitForTimeout(3500);
    say('tras RECARGA url:', page.url());
    await page.getByTestId('consulta-rejilla').waitFor({ timeout: 30000 });
    const op = page.getByTestId('consulta-abrir-encuentro'); if (await op.isVisible()) await op.click();
    await H.openOrders(page);
    const hist = page.locator('app-analysis-order-history');
    const t = (await hist.innerText()).replace(/\n+/g, ' / ');
    say('histórico tras recarga (primeros 700):', t.slice(0, 700));
    say('histórico contiene detalle «Leucocitos» y «Muestra» =', /Leucocitos/.test(t), /Muestra/.test(t));
    await hist.scrollIntoViewIfNeeded();
    await pngs(page, 'historico-1-lab-detalle-tras-recarga-1440-claro');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    if (await page.locator('[data-testid=consulta-modal] dialog[open]').count()) { await page.getByTestId('content-dialog-close').click().catch(() => {}); await page.waitForTimeout(600); }
    seen = (await H.registro(page)).length;
  });

  await part('2. Imagenología', async () => {
    if (!(await page.locator('[data-testid=consulta-modal] dialog[open]').count())) await H.openOrders(page);
    await page.getByTestId('segmentado-IMAGING').click(); await page.getByTestId('imaging-picker').waitFor(); await page.waitForTimeout(1500);
    await page.getByTestId('imaging-picker-modality').click(); await page.waitForTimeout(500);
    say('modalidades (descripciones):', await page.evaluate(() => [...document.querySelectorAll('dialog[open] [role=option]')].map(e => e.textContent.trim().replace(/\s+/g, ' ')).slice(0, 4)));
    await pngs(page, 'img-0-modalidades-codigo-crudo-1440-claro');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await H.pickImaging(page, { q: 'mano', name: 'Radiografía de mano PA y oblicua' });
    await pngs(page, 'img-1-rx-mano-estudio-elegido-1440-claro');
    say('inicio: select de región =', await H.regionText(page), '| viva =', await page.getByTestId('body-region-viva').innerText());
    const cv = page.getByTestId('anatomy-viewer-canvas'); const box = await cv.boundingBox();
    say('canvas', box, 'data-status =', await cv.getAttribute('data-status'));
    const snap = () => cv.screenshot();
    const sA = await snap();
    // «mano izquierda» del paciente = lado derecho de la pantalla (vista anterior)
    const x = box.x + box.width * 0.845, y = box.y + box.height * 0.40;
    await page.mouse.click(x, y); await page.waitForTimeout(1500);
    const sB = await snap();
    say(`CLIC REAL en canvas (${Math.round(x)},${Math.round(y)}) = mano izquierda del paciente -> select =`, await H.regionText(page), '| viva =', await page.getByTestId('body-region-viva').innerText());
    say('lado (segmentado «Lado del paciente») marcado =', await page.locator('.body-region-picker__lado [aria-checked=true], .body-region-picker__lado .is-active, .body-region-picker__lado [aria-pressed=true]').allInnerTexts());
    fs.writeFileSync(`${EV}/img-canvas-A-antes-del-clic.png`, sA); fs.writeFileSync(`${EV}/img-canvas-B-tras-clic-mano-izq.png`, sB);
    await pngs(page, 'img-2-clic-3d-mano-izquierda-1440-claro');
    // cambiar el select a otra región permitida
    await page.locator('.tree-select-trigger').click(); await page.waitForTimeout(600);
    const opts = await page.evaluate(() => [...document.querySelectorAll('dialog[open] [role=option], dialog[open] [role=treeitem]')].map(e => e.textContent.trim().replace(/\s+/g, ' ')));
    say('regiones permitidas en el select:', opts);
    await pngs(page, 'img-3-select-region-abierto-1440-claro');
    const otra = 'Dedos de la mano';
    await page.locator('dialog[open] [role=option], dialog[open] [role=treeitem]').filter({ hasText: new RegExp('^' + otra) }).first().click(); await page.waitForTimeout(1800);
    const sC = await snap(); fs.writeFileSync(`${EV}/img-canvas-C-tras-cambiar-select.png`, sC);
    say('select cambiado a «' + otra + '» -> select =', await H.regionText(page), '| viva =', await page.getByTestId('body-region-viva').innerText());
    say('canvas B vs C: bytes iguales =', Buffer.compare(sB, sC) === 0, '| A vs B iguales =', Buffer.compare(sA, sB) === 0);
    await pngs(page, 'img-4-select-cambia-3d-encuadra-1440-claro');
    // lateralidad Izquierda
    const izq = page.locator('.body-region-picker__lado').getByText('Izquierda', { exact: true });
    if (await izq.count()) { await izq.click(); await page.waitForTimeout(500); }
    say('lado tras tocar «Izquierda»:', await page.locator('.body-region-picker__lado app-segmented-control').evaluate(e => e.innerHTML.match(/aria-(checked|selected|pressed)="true"[^>]*>[^<]*<?[^>]*>[^<]*/g)?.slice(0, 2)));
    // contraste
    const cs = await page.getByTestId('imaging-picker-contrast').locator('button').evaluateAll(bs => bs.map(x => ({ t: x.textContent.trim(), dis: x.disabled, on: x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed') })));
    say('contraste (RX):', cs, '|', (await page.getByTestId('imaging-picker-contrast-note').innerText()).replace(/\s+/g, ' '));
    say('resumen:', await page.getByTestId('imaging-picker-counter').innerText());
    await pngs(page, 'img-5-listo-para-pedir-1440-claro');
    const btn = H.pedirBtn(page); await btn.scrollIntoViewIfNeeded();
    say('pedir deshabilitado =', await btn.isDisabled());
    await btn.click(); await page.waitForTimeout(2500);
    const d = await delta(page, 'img-pedir'); say('PETICIONES:', d.map(short));
    say('cuerpo requisición imagen:', d.find(x => x.path === '/clinical/requisitions')?.body);
    say('toast:', await page.getByTestId('toast-mensaje').allInnerTexts());
    const st = await ordenesStore(page);
    fs.writeFileSync(`${EV}/persistencia-img.json`, JSON.stringify({ detalleUltimo: st.detalle.slice(-1), ordenUltima: st.ordenes.slice(-1) }, null, 2));
    await page.reload(); await page.waitForTimeout(3500);
    await page.getByTestId('consulta-rejilla').waitFor({ timeout: 30000 });
    const op = page.getByTestId('consulta-abrir-encuentro'); if (await op.isVisible()) await op.click();
    await H.openOrders(page);
    const hist = page.locator('app-analysis-order-history');
    const t = (await hist.innerText()).replace(/\n+/g, ' / ');
    say('histórico imagen tras recarga (entrada de la RX):', t.slice(t.indexOf('Radiografía de mano')).slice(0, 400));
    await hist.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await pngs(page, 'historico-2-img-detalle-tras-recarga-1440-claro');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    seen = (await H.registro(page)).length;
  });

  await part('3. Otros (ECG)', async () => {
    if (!(await page.locator('[data-testid=consulta-modal] dialog[open]').count())) await H.openOrders(page);
    await page.getByTestId('segmentado-OTHER').click(); await page.waitForTimeout(1200);
    const sel = page.locator('[data-testid=consulta-modal] app-select').filter({ has: page.locator('[aria-label="Estudio"], button') }).first();
    await page.locator('[data-testid=consulta-modal] app-form-field').filter({ hasText: 'Estudio' }).first().locator('button, [role=combobox]').first().click(); await page.waitForTimeout(500);
    await page.locator('dialog[open] input').first().fill('electro'); await page.waitForTimeout(600);
    say('opciones:', await page.evaluate(() => [...document.querySelectorAll('dialog[open] [role=option]')].map(e => e.textContent.trim().replace(/\s+/g, ' '))));
    await page.locator('dialog[open] [role=option]').first().click(); await page.waitForTimeout(1500);
    await pngs(page, 'otros-1-ecg-elegido-1440-claro');
    const btn = H.pedirBtn(page); await btn.scrollIntoViewIfNeeded();
    say('botón:', await btn.innerText(), 'deshabilitado =', await btn.isDisabled());
    await btn.click(); await page.waitForTimeout(2200);
    const dd0 = page.getByTestId('duplicate-study-warning-dialog');
    if (await page.getByTestId('btn-cancel-duplicate-dialog').isVisible()) {
      say('el ECG ya estaba pedido en el histórico -> aparece el aviso de duplicado:', (await dd0.innerText()).replace(/\s+/g, ' ').slice(0, 500));
      await pngs(page, 'otros-2-ecg-duplicado-1440-claro');
      await page.getByTestId('btn-cancel-duplicate-dialog').click(); await page.waitForTimeout(900);
      const dc = await delta(page, 'otros-cancelar-duplicado'); say('tras «Cancelar» en el aviso: escrituras =', dc.filter(x => x.method === 'POST' && !/duplicate-check/.test(x.path)).map(short), '| modal abierto =', (await page.locator('[data-testid=consulta-modal] dialog[open]').count()) > 0);
      await btn.click(); await page.waitForTimeout(2000);
      await page.getByTestId('checkbox-repeat-required').locator('label').click().catch(() => {});
      await page.getByTestId('textarea-duplicate-justification').locator('textarea').fill('Control evolutivo; el trazado previo no refleja el estado actual.').catch(() => {});
      await page.waitForTimeout(400);
      await page.getByTestId('btn-confirm-justified-duplicate').click(); await page.waitForTimeout(2500);
    }
    const d = await delta(page, 'otros-pedir'); say('PETICIONES:', d.map(short));
    say('cuerpo:', d.filter(x => x.method === 'POST').map(x => x.body));
    say('toast:', await page.getByTestId('toast-mensaje').allInnerTexts());
  });

  await part('4. Cerrar con selección pendiente', async () => {
    await H.openOrders(page);
    await page.locator('[data-testid=estudios-laboratorio] input').first().fill('perfil lip'); await page.waitForTimeout(900);
    await H.card(page, 'Perfil').getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(700);
    await page.getByTestId('content-dialog-close').click(); await page.waitForTimeout(800);
    const dlg = page.locator('dialog[open]').last();
    const txt = (await page.locator('dialog[open]').evaluateAll(ds => ds.map(d => d.innerText.replace(/\s+/g, ' ')))); say('diálogos abiertos:', txt);
    await pngs(page, 'cerrar-1-descartar-lo-escrito-1440-claro');
    await page.getByRole('button', { name: 'Seguir escribiendo' }).click(); await page.waitForTimeout(600);
    say('«Seguir escribiendo»: el modal sigue abierto =', (await page.locator('[data-testid=consulta-modal] dialog[open]').count()) > 0, '| marcados =', await H.counter(page));
    await page.getByTestId('content-dialog-close').click(); await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Descartar' }).click(); await page.waitForTimeout(900);
    say('«Descartar»: el modal sigue abierto =', (await page.locator('[data-testid=consulta-modal] dialog[open]').count()) > 0);
    await delta(page, 'cerrar-descartar'); say('peticiones de escritura al descartar:', (posts.filter(p => p.fase === 'cerrar-descartar')).length);
    await H.openOrders(page);
    say('al reabrir: contador =', await H.counter(page));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    if (await page.locator('dialog[open]').count()) { await page.getByRole('button', { name: 'Descartar' }).click().catch(() => {}); await page.waitForTimeout(500); }
  });

  await part('5a. Duplicado: reutilizar resultados', async () => {
    if (!(await page.locator('[data-testid=consulta-modal] dialog[open]').count())) await H.openOrders(page);
    await page.getByTestId('segmentado-OTHER').click(); await page.waitForTimeout(1000);
    await page.locator('[data-testid=consulta-modal] app-form-field').filter({ hasText: 'Estudio' }).first().locator('button, [role=combobox]').first().click(); await page.waitForTimeout(500);
    await page.locator('dialog[open] input').first().fill('electro'); await page.waitForTimeout(600);
    await page.locator('dialog[open] [role=option]').first().click(); await page.waitForTimeout(1200);
    await H.pedirBtn(page).click(); await page.waitForTimeout(2000);
    say('aviso de duplicado visible =', await page.getByTestId('btn-reuse-previous-results').isVisible());
    await page.getByTestId('btn-reuse-previous-results').click(); await page.waitForTimeout(2500);
    const d = await delta(page, 'duplicado-reutilizar'); say('PETICIONES:', d.map(short));
    say('cuerpo:', d.filter(x => x.method === 'POST' && !/duplicate-check/.test(x.path)).map(x => x.body));
    say('toast:', await page.getByTestId('toast-mensaje').allInnerTexts());
    await pngs(page, 'duplicado-3-reutilizar-resultado-1440-claro');
  });

  await part('5b. 422 del servidor simulado', async () => {
    if (!(await page.locator('[data-testid=consulta-modal] dialog[open]').count())) await H.openOrders(page);
    say('window.ng disponible =', await page.evaluate(() => typeof window.ng?.getComponent));
    const antes = (await ordenesStore(page)).ordenes.length;
    await page.getByTestId('segmentado-LAB').click(); await page.waitForTimeout(1000);
    const si2 = page.locator('[data-testid=estudios-laboratorio] input').first();
    await si2.fill('hemograma'); await page.waitForTimeout(900);
    await H.card(page, 'sin diferencial').getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(1200);
    await si2.fill('perfil lip'); await page.waitForTimeout(900);
    await H.card(page, 'Perfil').getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(1200);
    // La interfaz no deja armar un panel con un componente ajeno: se entrega a `flow.start` (el mismo camino de «Pedir estudios»)
    // un renglón con un componente de otro panel. No pasa por los controles; sí por duplicate-check, POST y el mapeo del 422.
    const r = await page.evaluate(() => {
      const cmp = window.ng.getComponent(document.querySelector('app-analysis-order-block'));
      const items = cmp.catalog.labItems(); const perfil = items.find(i => /Perfil lip/i.test(i.display)); const hemo = items.find(i => /sin diferencial/i.test(i.display));
      const det = cmp.catalog.details(); const dh = det.get(hemo.conceptId); if (!dh) return { ok: false, motivo: 'sin detalle del hemograma' };
      const ajeno = dh.components[0].children?.length ? dh.components[0].children[0].conceptId : dh.components[0].conceptId;
      const base = cmp.baseDeRequisicion();
      cmp.flow.start(base, [{ label: 'Perfil lipídico (componente ajeno)', item: { codeConceptId: perfil.conceptId, category: 'LAB', componentConceptIds: [ajeno] }, duplicateKey: {} }]);
      return { ok: true, ajeno };
    });
    say('manipulación del estado del componente:', r);
    if (r.ok) {
      await page.waitForTimeout(600);
      await page.waitForTimeout(2500);
      const d = await delta(page, '422'); say('PETICIONES:', d.map(short));
      say('cuerpo:', d.filter(x => x.path === '/clinical/requisitions').map(x => x.body));
      const err = page.getByTestId('estudios-error-renglon');
      say('alerta por renglón visible =', await err.count(), (await err.allInnerTexts()).map(s => s.replace(/\s+/g, ' ')), '| estudios-error:', await page.getByTestId('estudios-error').allInnerTexts());
      await err.first().scrollIntoViewIfNeeded().catch(() => {});
      await pngs(page, 'error-422-alerta-1440-claro');
      const despues = (await ordenesStore(page)).ordenes.length;
      say('órdenes en el simulador antes/después del 422:', antes, despues);
    }
  });

  const fin = await ordenesStore(page);
  say('\nórdenes en el simulador al final (nuevas respecto del inicio):', fin.ordenes.length - base.ordenes.length);
  fs.writeFileSync(`${EV}/${OUT}-peticiones-mock.json`, JSON.stringify(posts, null, 2));
  const rel = sink.filter(s => !/NG0505|development mode/.test(s.t));
  fs.writeFileSync(`${EV}/${OUT}-consola-red.json`, JSON.stringify({ total: sink.length, relevantes: rel }, null, 2));
  say('consola/red (sin NG0505/modo desarrollo):', rel.map(s => `${s.k}: ${s.t.slice(0, 160)}`));
  fs.writeFileSync(`${EV}/${OUT}.log`, lines.join('\n') + '\n');
  await b.close();
})();
