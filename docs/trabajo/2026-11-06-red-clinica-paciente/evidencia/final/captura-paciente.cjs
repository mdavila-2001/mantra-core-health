// Final captures, items 4 and 5: the patient's home, «Mi recorrido» (thread with nested accordions,
// S5 403 and S9 500) and «Por fecha» with its partial failure, at 390/1024/1440, light and dark.
// Usage: BASE=http://localhost:PORT node captura-paciente.cjs <out-dir>   (static demo build). SOLO=1440-dark reruns one.
// Failures are forced with `sessionStorage['mock:fallos']` (core/mock/simulated-failures.ts). Never `networkidle`.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const { sesion, sinToasts, BASE, bitacora, nombreTema, ajenos } = require('./comun.cjs');
const OUT = process.argv[2];
const B = bitacora(`${OUT}/aserciones-paciente${process.env.SOLO ? '-' + process.env.SOLO : ''}.txt`);
const RUTA = '/my-account/medical-record';

const sinDesborde = (p) => p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
const fallar = (p, lista) => p.evaluate((l) => sessionStorage.setItem('mock:fallos', JSON.stringify(l)), lista);
/** Each chevron follows its own trigger's aria-expanded; `anidado` = inside an open parent's region. */
const flechas = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid="mi-recorrido"] .accordion-panel__trigger')].map((b) => ({
  abierto: b.getAttribute('aria-expanded') === 'true',
  girada: getComputedStyle(b.querySelector('.accordion-panel__chevron')).transform !== 'none',
  anidado: !!b.closest('.accordion-panel__region'),
})));

async function combinacion(b, ancho, tema) {
  const pref = `paciente-${ancho}-${nombreTema(tema)}`;
  const { ctx, p, errores } = await sesion(b, 'paciente@alovida.mock', ancho, tema);

  // 5 · Home.
  await p.getByTestId('mi-salud').waitFor({ timeout: 120000 });
  await p.getByTestId('mi-salud-sintomas').waitFor({ timeout: 60000 });
  await sinToasts(p);
  const cita = await p.getByTestId('mi-salud-proxima-cita').waitFor({ timeout: 30000 }).then(() => true, () => false);
  B.afirmar(cita, `${pref} portada (${new URL(p.url()).pathname}): síntomas y próxima cita visibles`);
  let d = await sinDesborde(p);
  B.afirmar(d[0] <= d[1], `${pref} portada: sin desplazamiento horizontal (${d.join(' ≤ ')})`);
  await p.screenshot({ path: `${OUT}/${pref}-0-portada.png` });

  // 4a · «Mi recorrido»: a thread open with two encounters open inside it.
  await p.goto(BASE + RUTA + '?vista=recorrido');
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
  await sinToasts(p);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  const atenciones = hilo.getByTestId('recorrido-atencion');
  await atenciones.first().waitFor();
  await atenciones.first().locator('.accordion-panel__trigger').first().click();
  await hilo.locator('.recorrido__hecho').first().waitFor({ timeout: 20000 }).catch(() => {});
  const f = await flechas(p);
  B.afirmar(f.some((x) => x.anidado && !x.abierto) && f.some((x) => x.anidado && x.abierto), `${pref} recorrido: acordeones anidados, un hijo abierto y otro plegado dentro del hilo abierto (${f.length} disparadores)`);
  B.afirmar(f.every((x) => x.abierto === x.girada), `${pref} recorrido: cada flecha sigue a su aria-expanded (${f.filter((x) => x.abierto !== x.girada).length} discrepancias)`);
  d = await sinDesborde(p);
  B.afirmar(d[0] <= d[1], `${pref} recorrido: sin desplazamiento horizontal (${d.join(' ≤ ')})`);
  await hilo.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-1-recorrido-hilo.png` });

  // 4b · S5: 403 on the patient's own orders — a warning wall, no support code, no retry.
  await fallar(p, [{ patron: '/diagnostic-results/me/orders', modo: 'forbidden' }]);
  await p.goto(BASE + RUTA + '?vista=recorrido');
  let falta = p.getByTestId('recorrido-fallo');
  await falta.waitFor({ timeout: 120000 });
  await sinToasts(p);
  const s5 = {
    aviso: await falta.locator('.alert--warning').count(), error: await falta.locator('.alert--error').count(),
    codigo: await falta.getByTestId('support-code').count(), reintentar: await falta.getByRole('button', { name: 'Reintentar' }).count(),
    hilos: await p.getByTestId('recorrido-hilo').count(),
  };
  B.afirmar(s5.aviso > 0 && s5.error === 0 && s5.codigo === 0 && s5.reintentar === 0 && s5.hilos > 0, `${pref} S5: tono de aviso, sin código de soporte ni «Reintentar», lo que llegó sigue dibujado ${JSON.stringify(s5)}`);
  await falta.scrollIntoViewIfNeeded();
  await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/${pref}-2-recorrido-s5-403.png` });

  // 4c · S9: 500 with the request id and a retry.
  await fallar(p, [{ patron: '/diagnostic-results/me/orders', modo: 'error' }]);
  await p.goto(BASE + RUTA + '?vista=recorrido');
  falta = p.getByTestId('recorrido-fallo');
  await falta.waitFor({ timeout: 120000 });
  await sinToasts(p);
  const id = (await falta.locator('[data-testid="support-code"] code').textContent().catch(() => null))?.trim();
  const reintentar = await falta.getByRole('button', { name: 'Reintentar' }).count();
  B.afirmar(id === 'mock-fallo' && reintentar === 1, `${pref} S9: muestra el ID de petición (${id}) y ofrece «Reintentar» (${reintentar})`);
  await falta.scrollIntoViewIfNeeded();
  await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/${pref}-3-recorrido-s9-500.png` });

  // 4d · «Por fecha», partial failures. The detail read is one forkJoin: when the orders fail it is cancelled
  // before the appointments answer, so each notice is provoked on its own read (a reload in between).
  for (const [nombre, testid, patron] of [['detalle-falta', 'historia-detalle-falta', '/diagnostic-results/me/orders'], ['citas-sin-cargar', 'historia-citas-sin-cargar', '/scheduling/bookings']]) {
    await fallar(p, []);
    await p.goto(BASE + RUTA + '?vista=fecha');
    const lista = p.getByTestId('historia-atenciones');
    await lista.waitFor({ timeout: 120000 });
    await sinToasts(p);
    await fallar(p, [{ patron, modo: 'error' }]);
    await lista.locator('.accordion-panel__trigger').first().click();
    const aviso = p.getByTestId(testid);
    const hay = await aviso.waitFor({ timeout: 30000 }).then(() => true, () => false);
    const r = {
      hay, codigo: hay ? ((await aviso.locator('[data-testid="support-code"] code').textContent().catch(() => '')) ?? '').trim() : null,
      reintentar: hay ? await aviso.getByRole('button', { name: 'Reintentar' }).count() : 0,
      atenciones: await lista.locator('.accordion-panel__trigger').count(),
    };
    B.afirmar(r.hay && r.atenciones > 0, `${pref} por fecha ${nombre}: el aviso «${testid}» está a la vista y las atenciones siguen dibujadas ${JSON.stringify(r)}`);
    B.afirmar(r.codigo === 'mock-fallo' && r.reintentar === 1, `${pref} por fecha ${nombre}: S9 con su ID de petición y «Reintentar» (${r.codigo}, ${r.reintentar})`);
    d = await sinDesborde(p);
    B.afirmar(d[0] <= d[1], `${pref} por fecha ${nombre}: sin desplazamiento horizontal (${d.join(' ≤ ')})`);
    if (hay) await aviso.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/${pref}-4-por-fecha-${nombre}.png` });
  }
  await fallar(p, []);

  const malos = ajenos(errores);
  B.afirmar(malos.length === 0, `${pref}: consola sin errores ajenos a los fallos provocados (${errores.length - malos.length} provocados) ${JSON.stringify(malos.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const tema of ['light', 'dark']) for (const ancho of [390, 1024, 1440]) {
    if (process.env.SOLO && process.env.SOLO !== `${ancho}-${tema}`) continue;
    const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
    try { await combinacion(b, ancho, tema); } catch (e) { B.afirmar(false, `${ancho} ${tema}: ${e.message.split('\n')[0]}`); }
    await b.close();
  }
  B.cerrar();
})();
