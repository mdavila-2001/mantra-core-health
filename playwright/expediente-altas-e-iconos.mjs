/**
 * Evidencia de las altas del expediente y de sus íconos (10/09/2026).
 *
 * Comprueba, en el navegador y contra el backend simulado:
 *
 * 1. Que las siete pestañas que admiten alta dibujan su botón **con el «más»**.
 * 2. Que «Ver», «Adjuntar» y «Descargar PDF» llevan su ícono.
 * 3. La mutación entera de una observación: UI → petición → respuesta →
 *    recarga → UI. El contador de la pestaña es la prueba: sube porque el
 *    servidor devolvió la fila, no porque la hayamos pintado.
 *
 * Uso: `yarn node playwright/expediente-altas-e-iconos.mjs` con el front en el 4300.
 */
import { chromium } from '@playwright/test';

const B = 'http://localhost:4300';
const ID = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';

/** Las siete pestañas con alta, con el `data-testid` de su botón. */
const ALTAS = [
  ['Diagnósticos', 'expediente-nuevo-diagnostico'],
  ['Alergias', 'expediente-nueva-alergia'],
  ['Medicación', 'expediente-nueva-receta'],
  ['Observaciones', 'expediente-nueva-observacion'],
  ['Notas', 'expediente-nueva-nota'],
  ['Planes de cuidados', 'expediente-nuevo-plan'],
  ['Documentos', 'expediente-nuevo-documento'],
];

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 } });
const pg = await ctx.newPage();

/** Las peticiones de escritura que la pantalla dispara, para poder citarlas. */
const escrituras = [];
pg.on('response', async (r) => {
  const m = r.request().method();
  if (m === 'POST' && /\/(clinical|charts)\//.test(r.url())) {
    escrituras.push(`${m} ${new URL(r.url()).pathname} → ${r.status()}`);
  }
});

await pg.goto(`${B}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
}

await pg.goto(`${B}/medical-records/${ID}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await pg.waitForTimeout(4000);

/* ---- 1. los siete botones de alta, con su «más» ------------------------- */
for (const [pestana, testId] of ALTAS) {
  await pg.getByRole('tab', { name: new RegExp(pestana, 'i') }).first().click();
  await pg.waitForTimeout(900);
  const boton = pg.getByTestId(testId).first();
  const hay = await boton.count();
  const conIcono = hay > 0 ? await boton.locator('svg').count() : 0;
  const rotulo = hay > 0 ? (await boton.innerText()).trim() : '—';
  process.stdout.write(`${pestana}: botón=${hay} svg=${conIcono} rótulo=«${rotulo}»\n`);
}

/* ---- 2. los íconos de las acciones de fila ------------------------------ */
await pg.getByRole('tab', { name: /Encuentros/i }).first().click();
await pg.waitForTimeout(1200);
const ver = pg.getByTestId('expediente-ver-detalle').first();
const bajar = pg.getByTestId('expediente-descargar-atencion').first();
process.stdout.write(`«Ver» con ícono: ${await ver.locator('svg').count()}\n`);
process.stdout.write(`«Descargar PDF» con ícono: ${await bajar.locator('svg').count()}\n`);

await pg.getByRole('tab', { name: /Medicación/i }).first().click();
await pg.waitForTimeout(1200);
const adjuntar = pg.getByTestId('expediente-adjuntar-archivo').first();
process.stdout.write(`«Adjuntar» con ícono: ${await adjuntar.locator('svg').count()}\n`);

/* ---- 3. la mutación entera: registrar una observación ------------------- */
const rotuloDe = async (nombre) =>
  (await pg.getByRole('tab', { name: new RegExp(nombre, 'i') }).first().innerText()).trim();

const antes = await rotuloDe('Observaciones');
await pg.getByRole('tab', { name: /Observaciones/i }).first().click();
await pg.waitForTimeout(900);
await pg.getByTestId('expediente-nueva-observacion').first().click();
await pg.waitForTimeout(2500);

process.stdout.write(`título del modal: ${await pg.getByTestId('content-dialog-title').innerText()}\n`);
await pg.screenshot({ path: 'artifacts/expediente-alta-observacion.png' });

const medicion = pg.getByTestId('observacion-medicion').locator('select');
const opciones = await medicion.locator('option').allTextContents();
process.stdout.write(`mediciones del catálogo (${opciones.length}): ${opciones.slice(1, 5).map((s) => s.trim()).join(' · ')}\n`);
await medicion.selectOption({ index: 1 });
await pg.getByTestId('observacion-valor').fill('128');
const unidad = pg.getByTestId('observacion-unidad').locator('select');
const unidades = await unidad.locator('option').allTextContents();
process.stdout.write(`unidades del catálogo (${unidades.length}): ${unidades.slice(1, 5).map((s) => s.trim()).join(' · ')}\n`);
await unidad.selectOption({ index: 1 });
await pg.waitForTimeout(400);
await pg.screenshot({ path: 'artifacts/expediente-alta-observacion-llena.png' });

await pg.getByRole('button', { name: /Registrar observación/i }).first().click();
await pg.waitForTimeout(4000);

process.stdout.write(`escrituras: ${escrituras.join(' | ') || 'ninguna'}\n`);
const despues = await rotuloDe('Observaciones');
process.stdout.write(`pestaña «Observaciones» antes=«${antes}» después=«${despues}»\n`);
await pg.screenshot({ path: 'artifacts/expediente-observacion-registrada.png' });

await nav.close();
