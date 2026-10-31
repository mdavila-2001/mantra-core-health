const fs = require('fs');
const H = require('./h.cjs');
const EV = '/home/user/mantra-core-health/docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/evidencia/medico';
const VPS = (process.env.VPS || '390,768,1440').split(',').map(Number);
const THEMES = (process.env.THEMES || 'claro,oscuro').split(',');
const H_OF = { 390: 844, 768: 1024, 1440: 1250 };
const results = [];
const settle = async (page) => { await page.mouse.move(0, 0); await page.waitForTimeout(1200); };

async function measure(page, label) {
  return page.evaluate((label) => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, t: b.top, b: b.bottom, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
    const out = { label, viewport: { w: innerWidth, h: innerHeight }, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    const dlg = document.querySelector('[data-testid=consulta-modal] dialog[open]');
    if (!dlg) return { ...out, dialog: null };
    const D = r(dlg); out.dialog = D;
    const card = dlg.querySelector('app-card.estudios') || dlg.querySelector('app-analysis-order-block');
    const C = r(card);
    // área útil del diálogo: la caja con scroll (body) si existe
    const body = [...dlg.querySelectorAll('*')].find((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight - 1 && e.clientHeight > 100; }) || dlg;
    const B = r(body);
    out.cardInDialog = { padL: Math.round((C.l - B.l) * 10) / 10, padR: Math.round((B.r - C.r) * 10) / 10, diff: Math.round(Math.abs((C.l - B.l) - (B.r - C.r)) * 10) / 10, ratio: Math.round((C.w / B.w) * 1000) / 1000, cardW: C.w, bodyW: B.w };
    const f = dlg.querySelector('.estudios__formulario');
    if (f) { const F = r(f); out.formInCard = { padL: Math.round((F.l - C.l) * 10) / 10, padR: Math.round((C.r - F.r) * 10) / 10, diff: Math.round(Math.abs((F.l - C.l) - (C.r - F.r)) * 10) / 10, ratio: Math.round((F.w / C.w) * 1000) / 1000 }; }
    const pick = dlg.querySelector('app-lab-analysis-picker, app-imaging-study-picker');
    if (pick && f) { const P = r(pick), F = r(f); out.pickerInForm = { padL: Math.round((P.l - F.l) * 10) / 10, padR: Math.round((F.r - P.r) * 10) / 10, ratio: Math.round((P.w / F.w) * 1000) / 1000 }; }
    // targets
    const sel = 'button, a[href], label.checkbox-container, input:not([type=checkbox]):not([type=hidden]), [role=radio], [role=tab], [role=option], select, textarea';
    const bad = []; let total = 0;
    for (const e of dlg.querySelectorAll(sel)) {
      const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (e.closest('.sr-only')) continue;
      total++;
      if (b.width < 44 || b.height < 44) bad.push({ tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), txt: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(b.width), h: Math.round(b.height), tid: e.getAttribute('data-testid') || e.closest('[data-testid]')?.getAttribute('data-testid') || '' });
    }
    out.targets = { total, menoresDe44: bad.length, lista: bad.slice(0, 40) };
    return out;
  }, label);
}

async function prepare(browser, vw, tema) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: H_OF[vw] }, locale: 'es-BO' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema === 'oscuro' ? 'dark' : 'light');
  const page = await ctx.newPage(); const sink = []; H.watch(page, sink);
  await H.login(page);
  await page.evaluate(() => sessionStorage.setItem('mock:registrar', '1'));
  await H.goPatientConsultation(page);
  return { ctx, page, sink };
}
const shot = async (page, name) => { global.STEP = 'tras ' + name; await settle(page); await page.screenshot({ path: `${EV}/${name}.png` }); };
async function findLeftHand(page) {
  const cv = page.getByTestId('anatomy-viewer-canvas');
  for (let k = 0; k < 3; k++) {
    await cv.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
    const box = await cv.boundingBox(); const buf = await cv.screenshot();
    const c = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cn = document.createElement('canvas'); cn.width = img.width; cn.height = img.height; const g = cn.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cn.width, cn.height).data; let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < cn.height; y++) for (let x = Math.floor(cn.width / 2); x < cn.width; x++) { const i = (y * cn.width + x) * 4; const r = d[i], gg = d[i + 1], bb = d[i + 2]; if (gg > r + 50 && gg > bb + 10) { sx += x; sy += y; n++; } }
      return n ? { x: sx / n, y: sy / n, n, w: cn.width, h: cn.height } : null;
    }, buf.toString('base64'));
    if (!c) return null;
    const vh = page.viewportSize().height; const px = box.x + c.x * (box.width / c.w), py = box.y + c.y * (box.height / c.h);
    if (py < vh - 110 && py > 130) return { x: px, y: py, verdes: c.n };
    await page.locator('[data-testid=consulta-modal] dialog').evaluate((d, dy) => d.scrollBy(0, dy), py > vh - 110 ? 160 : -160); await page.waitForTimeout(400);
  }
  return null;
}
const dlgScrollTo = async (page, sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500); };

(async () => {
  const browser = await H.launch();
  for (const vw of VPS) for (const tema of THEMES) {
    const tag = `${vw}-${tema === 'oscuro' ? 'oscuro' : 'claro'}`;
    console.log('== ', tag);
    let ctxo;
    try {
      ctxo = await prepare(browser, vw, tema); const { page, sink } = ctxo;
      const m = async (label) => { const x = await measure(page, `${label} ${tag}`); results.push(x); return x; };
      // --- laboratorio, vista Tabla
      await H.openOrders(page);
      await page.getByTestId('segmentado-grid').click().catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, `medico-lab-tabla-vacio-${tag}`); await m('lab tabla (sin selección)');
      await page.locator('[data-testid=estudios-laboratorio] input').first().fill('hemograma'); await page.waitForTimeout(1000);
      await H.card(page, 'sin diferencial').getByTestId('lab-picker-parent').locator('label').click(); await page.waitForTimeout(1200);
      await H.card(page, 'sin diferencial').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      await shot(page, `medico-lab-tabla-hemograma-marcado-${tag}`); await m('lab tabla (hemograma marcado)');
      // resumen y pedir
      await page.getByTestId('lab-picker-summary').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      await shot(page, `medico-lab-tabla-resumen-${tag}`);
      // --- Lista
      await page.getByTestId('segmentado-list').click(); await page.waitForTimeout(700);
      const r = H.row(page, 'sin diferencial'); await r.getByTestId('lab-picker-expand').click(); await page.waitForTimeout(500);
      await r.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await shot(page, `medico-lab-lista-expandida-${tag}`); await m('lab lista (hemograma expandido)');
      await page.getByTestId('segmentado-grid').click(); await page.waitForTimeout(500);
      // pedir el lab (para el histórico)
      await H.pedirBtn(page).scrollIntoViewIfNeeded(); await H.pedirBtn(page).click(); await page.waitForTimeout(2500);
      // --- imagenología
      await H.openOrders(page);
      await H.pickImaging(page, { q: 'mano', name: 'Radiografía de mano PA y oblicua' });
      await page.waitForTimeout(1500);
      await shot(page, `medico-img-3d-${tag}`); await m('imagenología con 3D');
      const hp = await findLeftHand(page); results.push({ label: 'clic 3D ' + tag, centroideManoIzq: hp });
      if (hp) await page.mouse.click(hp.x, hp.y); await page.waitForTimeout(1500);
      await shot(page, `medico-img-3d-clic-mano-izq-${tag}`);
      await page.getByTestId('imaging-picker-summary').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      await shot(page, `medico-img-resumen-${tag}`); await m('imagenología (resumen)');
      await H.pedirBtn(page).scrollIntoViewIfNeeded(); await H.pedirBtn(page).click(); await page.waitForTimeout(2500);
      // --- histórico con detalle (tras recargar)
      await page.reload(); await page.waitForTimeout(3500);
      await page.getByTestId('consulta-rejilla').waitFor({ timeout: 30000 });
      const op = page.getByTestId('consulta-abrir-encuentro'); if (await op.isVisible()) await op.click();
      await H.openOrders(page);
      const hist = page.locator('app-analysis-order-history'); await hist.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
      await shot(page, `medico-historico-detalle-${tag}`);
      const idx = await page.getByTestId('estudios-detalle').allInnerTexts();
      results.push({ label: `historico ${tag}`, detalles: idx.map((s) => s.replace(/\s+/g, ' ')), medida: await measure(page, 'historico ' + tag) });
      fs.writeFileSync(`${EV}/consola-red-${tag}.json`, JSON.stringify(sink.filter((s) => !/NG0505|development mode/.test(s.t)), null, 2));
      await ctxo.ctx.close();
    } catch (e) {
      console.log('FALLO', tag, global.STEP, e.message.split('\n').slice(0,4).join(' | ')); results.push({ label: tag, error: e.message.split('\n')[0] });
      try { await ctxo?.ctx.close(); } catch {}
    }
    fs.writeFileSync(`${EV}/mediciones${process.env.SUFFIX || ''}.json`, JSON.stringify(results, null, 2));
  }
  await browser.close();
})();
