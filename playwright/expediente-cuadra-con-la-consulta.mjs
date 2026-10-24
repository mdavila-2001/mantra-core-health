/**
 * Evidencia de «lo que se carga en la consulta es lo que muestra la historia»
 * (cliente, 02/10/2026):
 *
 * 1. La consulta ya no ofrece «Alergia» (ni como casilla ni dentro de
 *    «Formulario clínico»); el expediente no tiene pestaña ni alta de alergias.
 * 2. Un formulario clínico completado en la consulta aparece, tras recargar, en
 *    el detalle de su encuentro en el expediente.
 * 3. Una internación abierta en la consulta aparece, tras recargar, en la
 *    pestaña «Internaciones» del expediente.
 *
 * Uso: `yarn node playwright/expediente-cuadra-con-la-consulta.mjs` con el
 * front en el 4300 (datos de prueba). Sin `networkidle`: con HMR no llega.
 *
 * La maqueta responde dentro de la app (un interceptor), así que no hay
 * tráfico HTTP que citar: la persistencia se prueba recargando la página y
 * leyendo lo escrito.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const B = process.env.BASE ?? 'http://localhost:4300';
const ID = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
const SALIDA = process.env.SALIDA ?? 'artifacts/expediente-cuadra';
mkdirSync(SALIDA, { recursive: true });

const ANCHO = Number(process.env.ANCHO ?? 1440);
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext({ viewport: { width: ANCHO, height: 1100 }, reducedMotion: 'reduce' });
const pg = await ctx.newPage();

const log = (linea) => process.stdout.write(`${linea}\n`);
// La consola cuenta como evidencia: un error de ejecución corta la plantilla
// a la mitad y la captura sola no lo dice.
pg.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
pg.on('console', (m) => {
  if (m.type() === 'error') log(`[console.error] ${m.text().slice(0, 300)}`);
});
const foto = (nombre) => pg.screenshot({ path: `${SALIDA}/${ANCHO}-${nombre}.png`, fullPage: true });

await pg.goto(`${B}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
}

/* ---- 1. la consulta: sin casilla de alergia ------------------------------ */
await pg.goto(`${B}/medical-records/${ID}/consultation`, { waitUntil: 'domcontentloaded' });
await pg.getByTestId('consulta-rejilla').waitFor({ timeout: 60000 });
await pg.waitForTimeout(800);
const casillas = await pg.locator('[data-testid^="consulta-casilla-"]').evaluateAll((els) =>
  els.map((el) => el.getAttribute('data-testid')),
);
log(`casillas de la consulta (${casillas.length}): ${casillas.join(', ')}`);
log(`casilla de alergias: ${await pg.getByTestId('consulta-casilla-alergias').count()}`);
await foto('1-consulta');

/* ---- 2. abrir el encuentro ----------------------------------------------- */
const encuentro = pg.getByTestId('consulta-encuentro');
if ((await encuentro.getByText('Encuentro en curso').count()) === 0) {
  await encuentro.locator('textarea').fill('Control (evidencia expediente-cuadra)');
  await pg.getByTestId('consulta-abrir-encuentro').click();
  await encuentro.getByText('Encuentro en curso').first().waitFor({ timeout: 30000 });
}
log('encuentro en curso: sí');

/* ---- 3. formulario clínico, sin la opción «Alergia» ---------------------- */
const MARCA = `Dolor pieza 36 · evidencia ${Date.now()}`;
await pg.getByTestId('consulta-casilla-formulario').click();
const modal = pg.getByTestId('consulta-modal');
const selector = modal.locator('select').first();
await selector.waitFor({ timeout: 30000 });
const leerOpciones = () =>
  selector.locator('option').evaluateAll((os) =>
    os.map((o) => ({ value: o.value, label: o.textContent?.trim() ?? '' })),
  );
// Las cinco fijas llegan al toque; las plantillas, cuando responde el catálogo.
// Las entradas fijas (diagnóstico, hojas libres, cirugía, odontología,
// laboratorio) llegan al toque; las plantillas, cuando responde el catálogo.
const FIJA = /^(Seleccionar|Diagnóstico —|Hoja en blanco|Formulario libre|Cirugía|Odontología|Laboratorio e imagenología)/;
let opciones = await leerOpciones();
for (let intento = 0; intento < 60 && !opciones.some((o) => !FIJA.test(o.label)); intento++) {
  await pg.waitForTimeout(500);
  opciones = await leerOpciones();
}
log(`opciones del formulario: ${opciones.map((o) => o.label).join(' | ')}`);
log(`opción de alergia: ${opciones.some((o) => /alergia/i.test(o.label)) ? 'SÍ' : 'no'}`);

// La primera plantilla del catálogo cuyos obligatorios se puedan llenar con
// texto, números, listas o sí/no (las que piden fecha u odontograma se saltean).
const completar = modal.getByRole('button', { name: 'Completar formulario' });
let plantilla = null;
for (const candidata of opciones.filter((o) => !FIJA.test(o.label))) {
  await selector.selectOption({ label: candidata.label });
  await pg.waitForTimeout(500);
  const campos = modal.locator('[data-testid="campo-especialidad"]');
  if ((await campos.locator('textarea, input[type="text"]').count()) === 0) continue;
  const numeros = campos.locator('input[type="number"]');
  for (let i = 0; i < (await numeros.count()); i++) await numeros.nth(i).fill('1');
  const siNo = campos.locator('app-segmented-control');
  for (let i = 0; i < (await siNo.count()); i++) await siNo.nth(i).locator('button').last().click();
  const listas = campos.locator('select');
  for (let i = 0; i < (await listas.count()); i++) {
    await primeraOpcion(listas.nth(i)).catch(() => undefined);
  }
  const grupos = campos.locator('app-checkbox-group');
  for (let i = 0; i < (await grupos.count()); i++) {
    // El input nativo va escondido detrás de su caja: se marca por su rótulo.
    await grupos.nth(i).locator('label').first().click();
  }
  // El texto al final: las respuestas de arriba muestran u ocultan los
  // «¿cuál?», y lo escrito en un campo que después se oculta no se guarda.
  const textos = campos.locator('textarea:visible, input[type="text"]:visible');
  const cuantos = await textos.count();
  if (cuantos === 0) continue;
  await textos.first().fill(MARCA);
  for (let i = 1; i < cuantos; i++) await textos.nth(i).fill('Sin particularidades');
  if (await completar.isEnabled()) {
    plantilla = candidata;
    break;
  }
}
log(`plantilla elegida: ${plantilla?.label ?? 'NINGUNA'}`);

// Donde el alta manual de diagnóstico ya no existe, el diagnóstico nace del
// cierre del formulario («diagnóstico tentativo»): la alergia se carga ahí.
let rotuloPenicilina = '';
const cierre = modal.getByTestId('cierre-del-formulario');
if ((await cierre.count()) > 0) {
  const tentativo = cierre.locator('select', { has: pg.locator('option', { hasText: /penicilina/i }) });
  for (let intento = 0; intento < 60 && (await tentativo.count()) === 0; intento++) {
    await pg.waitForTimeout(500);
  }
  rotuloPenicilina = (
    await tentativo.locator('option').evaluateAll((os) =>
      os.map((o) => o.textContent?.trim() ?? '').filter((t) => /penicilina/i.test(t)),
    )
  )[0];
  await tentativo.selectOption({ label: rotuloPenicilina });
  log(`alergia elegida como diagnóstico tentativo del formulario: ${rotuloPenicilina}`);
}
await foto('2-formulario-lleno');
await completar.click();
try {
  await modal.getByTestId('formulario-respondido').waitFor({ timeout: 15000 });
} catch (e) {
  await foto('error-tras-completar');
  log(`modal tras completar:\n${(await modal.innerText()).slice(0, 1500)}`);
  throw e;
}
log('formulario completado en la consulta: sí');
await modal.getByRole('button', { name: 'Cerrar' }).first().click();

/* ---- 3a. odontología y laboratorio, desde «Formulario clínico» ----------- */
/**
 * Elige la primera opción real de un `<select>`. Los selectores de concepto
 * repiten su placeholder como opción elegible (es «ninguno») y mientras cargan
 * dicen «Cargando opciones…»: se espera a que haya una opción de verdad.
 */
async function primeraOpcion(select) {
  const elegible = (el) => {
    const marcador = el.options[0]?.textContent?.trim();
    return (
      [...el.options]
        .filter((o) => o.value !== '' && !o.hidden)
        .map((o) => o.textContent?.trim() ?? '')
        .find((t) => t !== marcador && !/^(Elegí|Sin especificar|Cargando)/.test(t)) ?? ''
    );
  };
  let etiqueta = '';
  for (let intento = 0; intento < 60 && etiqueta === ''; intento++) {
    etiqueta = await select.evaluate(elegible);
    if (etiqueta === '') await pg.waitForTimeout(500);
  }
  if (etiqueta === '') throw new Error('El selector no cargó ninguna opción elegible.');
  await select.selectOption({ label: etiqueta });
  return etiqueta;
}

await pg.getByTestId('consulta-casilla-formulario').click();
await selector.waitFor({ timeout: 30000 });
await selector.selectOption({ label: 'Odontología' });
const formDental = modal.locator('form.procedimientos__formulario');
await formDental.waitFor({ timeout: 30000 });
const tratamiento = await primeraOpcion(formDental.locator('select').nth(0));
await primeraOpcion(formDental.locator('select').nth(1));
await formDental.getByRole('button', { name: 'Registrar tratamiento' }).click();
await modal.getByTestId('odontologia').getByText(tratamiento).first().waitFor({ timeout: 30000 });
log(`odontología registrada en la consulta: ${tratamiento}`);

await selector.selectOption({ label: 'Laboratorio e imagenología' });
const formEstudio = modal.locator('form.estudios__formulario');
await formEstudio.waitFor({ timeout: 30000 });
// Uno que la persona no tenga ya: un estudio igual reciente dispara la
// antiduplicación, y entonces no se crea una orden nueva.
const previos = (await modal.getByTestId('estudios-lista').innerText().catch(() => '')) ?? '';
const selectEstudio = formEstudio.locator('select').first();
await primeraOpcion(selectEstudio);
const estudio = await selectEstudio.evaluate(
  (el, ya) =>
    [...el.options]
      .filter((o) => o.value !== '' && !o.hidden)
      .map((o) => o.textContent?.trim() ?? '')
      .filter((t) => !/^(Elegí|Cargando)/.test(t))
      .find((t) => !ya.includes(t)) ?? '',
  previos,
);
await selectEstudio.selectOption({ label: estudio });
const resto = formEstudio.locator('select');
// El tipo es obligatorio; la prioridad, no.
await primeraOpcion(resto.nth(1));
await formEstudio.getByRole('button', { name: 'Pedir estudio' }).click();
await modal.getByTestId('estudios-lista').getByText(estudio).first().waitFor({ timeout: 30000 });
log(`estudio pedido en la consulta: ${estudio}`);
await modal.getByRole('button', { name: 'Cerrar' }).first().click();

/* ---- 3b. una alergia, cargada como diagnóstico --------------------------- */
if (rotuloPenicilina === '') {
await pg.getByTestId('consulta-casilla-diagnosticos').click();
const dx = modal.locator('select', { has: pg.locator('option', { hasText: /penicilina/i }) });
await pg.waitForFunction(
  () =>
    [...document.querySelectorAll('[data-testid="consulta-modal"] select option')].some((o) =>
      /penicilina/i.test(o.textContent ?? ''),
    ),
  undefined,
  { timeout: 30000 },
);
rotuloPenicilina = (
  await dx.locator('option').evaluateAll((os) =>
    os.map((o) => o.textContent?.trim() ?? '').filter((t) => /penicilina/i.test(t)),
  )
)[0];
await dx.selectOption({ label: rotuloPenicilina });
await modal.getByRole('button', { name: 'Registrar diagnóstico' }).click();
await pg.waitForTimeout(1500);
log(`diagnóstico de alergia registrado en la consulta: ${rotuloPenicilina}`);
// Registrar cierra el modal solo; si quedó abierto (duplicado), se cierra.
if (await modal.isVisible()) {
  await modal.getByRole('button', { name: 'Cerrar' }).first().click();
}
}

/* ---- 4. internación ------------------------------------------------------ */
// Donde la consulta ya no ofrece la internación (se abre desde el
// expediente), este paso se saltea y se dice.
if ((await pg.getByTestId('consulta-casilla-internacion').count()) > 0) {
  await pg.getByTestId('consulta-casilla-internacion').click();
  const alta = modal.getByRole('button', { name: 'Dar de alta la internación' });
  const yaInternada = modal.getByText('Esta persona ya está internada.');
  await alta.or(yaInternada).first().waitFor({ timeout: 30000 });
  if ((await alta.count()) > 0) {
    await alta.click();
    // Pide confirmación: desde la consulta no se puede anular.
    await pg.getByRole('button', { name: 'Dar de alta', exact: true }).click();
    try {
      await modal.getByTestId('internacion-lista').waitFor({ timeout: 15000 });
    } catch (e) {
      await foto('error-internacion');
      log(`modal de internación:\n${(await modal.innerText()).slice(0, 1500)}`);
      throw e;
    }
    log('internación dada de alta en la consulta: sí');
  } else {
    log('internación: ya había una abierta');
  }
  await modal.getByRole('button', { name: 'Cerrar' }).first().click();
} else {
  log('internación: esta consulta no la ofrece');
}

/* ---- 5. el expediente, recargado ----------------------------------------- */
await pg.goto(`${B}/medical-records/${ID}`, { waitUntil: 'domcontentloaded' });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.getByRole('tab').first().waitFor({ timeout: 60000 });
const pestanas = await pg.getByRole('tab').allInnerTexts();
log(`pestañas del expediente: ${pestanas.map((p) => p.trim()).join(' | ')}`);
log(`pestaña de alergias: ${pestanas.some((p) => /alergia/i.test(p)) ? 'SÍ' : 'no'}`);
log(`botón «Nueva alergia»: ${await pg.getByTestId('expediente-nueva-alergia').count()}`);
// La banda fija o, donde se reemplazó, el aviso (toast) al abrir.
const banda = pg
  .locator('.expediente__alergias')
  .or(pg.locator('app-toast').filter({ hasText: /alergia/i }))
  .first();
await banda.waitFor({ timeout: 15000 }).catch(() => undefined);
log(`banda de alergias: ${(await banda.count()) > 0 ? (await banda.innerText()).replace(/\s+/g, ' ') : 'NO HAY'}`);
log(`la alergia cargada como diagnóstico está en la banda: ${(await banda.innerText().catch(() => '')).match(/penicilina/i) ? 'SÍ' : 'NO'}`);
await foto('3-expediente');

await pg.getByRole('tab', { name: /Internaciones/ }).click();
await pg.waitForTimeout(600);
const internaciones = await pg.locator('[role="tabpanel"]:visible table tbody tr, [role="tabpanel"]:visible [role="row"]').count();
log(`filas en «Internaciones»: ${internaciones}`);
await foto('4-internaciones');

await pg.getByRole('tab', { name: /Encuentros/ }).click();
await pg.waitForTimeout(600);
// El encuentro más reciente: el que se acaba de abrir.
const panel = pg.locator('[role="tabpanel"]:visible');
const filaDelEncuentro = panel
  .locator('tr, [role="row"]')
  .filter({ hasText: 'Control (evidencia expediente-cuadra)' })
  .first();
await filaDelEncuentro.getByTestId('expediente-ver-detalle').click();
const detalle = pg.getByTestId('expediente-formularios-del-encuentro');
try {
  await detalle.getByTestId('expediente-formulario').first().waitFor({ timeout: 15000 });
} catch (e) {
  await foto('error-detalle');
  log(`detalle:\n${await pg.getByTestId('expediente-detalle').innerText()}`);
  log(`formularios:\n${await detalle.innerText()}`);
  throw e;
}
const textoDelDetalle = await pg.getByTestId('expediente-detalle').innerText();
log(`detalle del encuentro:\n${textoDelDetalle}`);
const formularios = await detalle.innerText();
log(`formularios del encuentro:\n${formularios}`);
log(`la marca escrita en la consulta aparece en la historia: ${formularios.includes(MARCA) ? 'SÍ' : 'NO'}`);
log(`la odontología de la consulta aparece en la historia: ${formularios.includes(tratamiento) ? 'SÍ' : 'NO'}`);
log(`el estudio de la consulta aparece en la historia: ${formularios.includes(estudio) ? 'SÍ' : 'NO'}`);
await foto('5-detalle-del-encuentro');

if (process.env.SOLO_MIRAR !== undefined) {
  log(await pg.locator('main').innerText());
}

await nav.close();
