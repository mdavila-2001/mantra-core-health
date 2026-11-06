// Evidencia de navegador de la Franja 1 (red clínica): UI → request → response → recarga → UI.
// Uso: node evidencia.cjs <carpeta-de-salida>
const { chromium } = require('playwright');
const fs = require('fs');
function uuid(seed){let h1=0x811c9dc5,h2=0x01000193;for(let i=0;i<seed.length;i++){const c=seed.charCodeAt(i);h1=Math.imul(h1^c,0x01000193)>>>0;h2=Math.imul(h2^c,0x811c9dc5)>>>0;}
const hex=n=>n.toString(16).padStart(8,'0');const a=hex(h1),b=hex(h2),c=hex((h1*31+h2)>>>0),d=hex((h2*17+h1)>>>0);const raw=`${a}${b}${c}${d}`;
return `${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-a${raw.slice(17,20)}-${raw.slice(20,32)}`;}
const OUT = process.argv[2];
const SC = process.argv[3] || 'todo';
const run = (name) => SC === 'todo' || SC === name;
const BASE = 'http://localhost:4300';
const PID = uuid('pid-paciente');
const ANXIETY = uuid('patient-network-condition-anxiety');
const log = [];
const step = (s) => { console.log('·', s); };

async function pickOption(page, trigger, name) {
  await trigger.click();
  const opt = page.getByRole('option', { name, exact: false }).first();
  await opt.waitFor({ timeout: 20000 });
  await opt.click();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (/\[mock\]|error/i.test(m.text())) log.push({ kind: 'console', type: m.type(), text: m.text().slice(0, 500) }); });
  async function grab(label) {
    const rows = await page.evaluate(() => (window.__mockRequests || []).filter((r) => r.method !== 'GET' && /service-requests$|\/verification$|\/respond$|\/clinical\/encounters$/.test(r.url.split('?')[0])));
    const fresh = rows.filter((r) => !log.some((e) => e.kind === 'mock' && JSON.stringify(e.row) === JSON.stringify(r)));
    for (const r of fresh) log.push({ kind: 'mock', label, row: r });
    const reads = await page.evaluate(() => (window.__mockRequests || []).filter((r) => r.method === 'GET').map((r) => r.url).slice(-200));
    return reads;
  }
  page.on('request', (r) => {
    const u = r.url();
    if (/\/(clinical\/service-requests|clinical\/conditions\/[^/]+\/verification|referrals\/[^/]+\/respond|clinical\/encounters)$/.test(new URL(u).pathname) && r.method() !== 'GET') {
      log.push({ kind: 'request', method: r.method(), path: new URL(u).pathname, body: r.postDataJSON?.() ?? r.postData() });
    }
  });
  page.on('response', async (r) => {
    const u = new URL(r.url());
    if (/\/(clinical\/service-requests|clinical\/conditions\/[^/]+\/verification|referrals\/[^/]+\/respond|clinical\/encounters)$/.test(u.pathname) && r.request().method() !== 'GET') {
      let body = null; try { body = await r.json(); } catch {}
      log.push({ kind: 'response', status: r.status(), path: u.pathname, body });
    }
  });

  step('login');
  await page.goto(BASE + '/auth'); await page.waitForLoadState('load'); await page.waitForTimeout(3000);
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 90000 });
  if (page.url().includes('organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL(/dashboard|portal-selector/, { timeout: 60000 }); }
  if (page.url().includes('portal-selector')) { await page.getByRole('link').first().click(); await page.waitForTimeout(3000); }

  if (run('unidades')) {
  step('expediente: unidades de los signos vitales');
  await page.goto(BASE + '/medical-records/' + PID);
  await page.getByTestId('expediente-vista').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByTestId('expediente-vista').getByText('Tabla', { exact: true }).click(); await page.waitForTimeout(1500);
  const obsTab = page.getByRole('tab', { name: /Observaciones|Signos|Mediciones/ }).first();
  if (await obsTab.count()) { await obsTab.click(); await page.waitForTimeout(1500); }
  const body = await page.locator('body').innerText();
  fs.writeFileSync(OUT + '/01-unidades.txt', (body.match(/.*(mmHg|°C|lpm|latidos por minuto| mg\b).*/g) || []).slice(0, 40).join('\n'));
  await page.screenshot({ path: OUT + '/01-expediente-unidades.png', fullPage: false });

  }
  step('consulta: abrir encuentro');
  await page.goto(BASE + '/medical-records/' + PID + '/consultation');
  await page.getByTestId('consulta-encuentro').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  if (await page.getByTestId('consulta-abrir-encuentro').count()) {
    await page.getByTestId('consulta-abrir-encuentro').click();
    await page.getByTestId('encuentros-en-curso').waitFor({ timeout: 30000 });
  }
  await grab('encuentro');
  await page.waitForTimeout(1500);

  if (run('rechazo')) {
  step('rechazar presuntivo con «Se confirmó en su lugar»');
  await page.getByTestId('consulta-casilla-diagnosticos').click();
  await page.getByTestId('diagnostico-rechazar-' + ANXIETY).waitFor({ timeout: 30000 });
  await page.getByTestId('diagnostico-rechazar-' + ANXIETY).click();
  await page.getByTestId('verificar-formulario').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.getByTestId('verificar-motivo').locator('textarea').fill('TSH 0,09 mUI/L con T4 libre alta: las palpitaciones son por exceso de levotiroxina, no por ansiedad.');
  await pickOption(page, page.getByTestId('verificar-reemplazo').getByRole('combobox'), /Hipotiroidismo/i);
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/04-rechazo-formulario.png' });
  await page.getByTestId('verificar-enviar').click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + '/04b-rechazo-enviado.png' });
  await grab('rechazo');
  await page.reload(); await page.getByTestId('consulta-encuentro').waitFor({ timeout: 90000 }); await page.waitForTimeout(2500);
  await page.getByTestId('consulta-casilla-diagnosticos').click();
  const filaDx = page.getByTestId('diagnostico-fila-' + ANXIETY).locator('xpath=ancestor::tr[1]');
  await filaDx.waitFor({ timeout: 30000 });
  await filaDx.scrollIntoViewIfNeeded();
  fs.writeFileSync(OUT + '/05-rechazo-fila.txt', await filaDx.innerText());
  await filaDx.screenshot({ path: OUT + '/05-rechazo-tras-recarga-fila.png' }).catch(() => {});
  await page.screenshot({ path: OUT + '/05-rechazo-tras-recarga.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);

  }
  if (run('orden')) {
  step('orden de estudio con «Para qué diagnóstico»');
  await page.getByTestId('consulta-casilla-ordenes').click();
  const modal = page.getByTestId('consulta-modal');
  await modal.getByText('Laboratorio e imagenología').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await pickOption(page, modal.locator('app-form-field', { hasText: 'Estudio' }).first().getByRole('combobox').first(), /Vitamina D/i);
  await page.waitForTimeout(500);
  await pickOption(page, modal.getByTestId('estudios-para-diagnostico').getByRole('combobox'), /Hipotiroidismo/i);
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/02-orden-formulario.png' });
  await modal.getByRole('button', { name: 'Pedir estudio' }).click();
  await page.waitForTimeout(3500);
  await grab('orden');
  await page.reload(); await page.getByTestId('consulta-encuentro').waitFor({ timeout: 90000 }); await page.waitForTimeout(2500);
  await page.getByTestId('consulta-casilla-ordenes').click();
  await modal.getByTestId('estudios-fila-diagnostico').first().waitFor({ timeout: 30000 });
  const fila = modal.locator('li.estudios__fila', { has: page.getByTestId('estudios-fila-diagnostico') }).filter({ hasText: /Vitamina D/i }).first();
  await fila.scrollIntoViewIfNeeded();
  await fila.screenshot({ path: OUT + '/03-orden-tras-recarga-fila.png' }).catch(() => {});
  await page.screenshot({ path: OUT + '/03-orden-tras-recarga.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);

  }
  if (run('derivacion')) {
  step('aceptar derivación entrante con la atención en curso');
  await page.getByTestId('consulta-casilla-derivacion').click();
  const entrante = page.locator('li', { hasText: 'Interconsulta con cardiología' }).first();
  await entrante.waitFor({ timeout: 30000 });
  await entrante.getByTestId('referral-open').click();
  await page.getByTestId('referral-detail').waitFor({ timeout: 30000 });
  await page.getByTestId('referral-accept').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/06-aceptar-confirmacion.png' });
  await page.getByRole('button', { name: 'Aceptar derivación' }).last().click();
  await page.waitForTimeout(3500);
  await grab('derivacion');
  await page.reload(); await page.getByTestId('consulta-encuentro').waitFor({ timeout: 90000 }); await page.waitForTimeout(2500);
  await page.getByTestId('consulta-casilla-derivacion').click();
  const entrante2 = page.locator('li', { hasText: 'Interconsulta con cardiología' }).first();
  await entrante2.waitFor({ timeout: 30000 });
  await entrante2.getByTestId('referral-open').click();
  await page.getByTestId('referral-detail-arrival-encounter').waitFor({ timeout: 30000 });
  fs.writeFileSync(OUT + '/07-llegada.txt', await page.getByTestId('referral-detail').innerText());
  await page.screenshot({ path: OUT + '/07-derivacion-tras-recarga.png' });

  }
  const gets = await page.evaluate(() => (window.__mockRequests || []).filter((r) => r.method === 'GET' && /\/referrals\/[^/?]+$/.test(r.url.split('?')[0])).map((r) => ({ url: r.url, status: r.status, targetEncounterId: r.respuesta && r.respuesta.targetEncounterId })));
  log.push({ kind: 'relectura-derivacion', gets });
  log.push({ kind: 'sessionStorage', sizes: await page.evaluate(() => Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k).length]).sort((x, y) => y[1] - x[1]).slice(0, 12)) });
  fs.writeFileSync(OUT + '/red-' + SC + '.json', JSON.stringify(log, null, 2));
  console.log('ok');
  await browser.close();
})().catch(async (e) => { console.error(e); fs.writeFileSync(OUT + '/red-' + SC + '.json', JSON.stringify(log, null, 2)); process.exit(1); });
