/**
 * Evidencia visual del cierre del formulario clínico (D4): sugerencias de la
 * IA —o el aviso de que no hay servicio—, elección a mano de diagnóstico y
 * orden, y el encadenado al completar, visto desde la rejilla de la consulta
 * después de recargar. Suelto y no como spec porque el runner de Playwright
 * está caído en estos worktrees; `corepack yarn node playwright/evidencia-d4-cierre.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL ?? 'http://localhost:4221';
const SALIDA = process.env.SALIDA ?? 'docs/trabajo/2026-09-25-diagnostico-ia-glosario/evidencia/d4';
mkdirSync(SALIDA, { recursive: true });

const notas = [];
const problemas = [];
const respuestasIa = [];

async function asentarse(page) {
  let anterior = '';
  let iguales = 0;
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(300);
    const ahora = await page.evaluate(
      () =>
        `${document.querySelectorAll('app-card').length}:${document.body.scrollHeight}:${
          document.querySelectorAll('app-skeleton, app-spinner').length
        }`,
    );
    iguales = ahora === anterior ? iguales + 1 : 0;
    anterior = ahora;
    if (iguales >= 2 && ahora.endsWith(':0')) return;
  }
}

async function cuenta(page, testId) {
  const casilla = page.getByTestId(testId);
  if ((await casilla.count()) === 0) return '(sin casilla)';
  const cantidad = casilla.locator('.consulta__casilla-cantidad');
  if ((await cantidad.count()) === 0) return '(sin cantidad)';
  return ((await cantidad.first().innerText()) ?? '').replace(/\s+/g, ' ').trim();
}

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();
page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`console: ${m.text()}`);
});
page.on('response', (r) => {
  if (r.url().includes('/ai/'))
    respuestasIa.push(`${r.request().method()} ${r.url()} → ${r.status()}`);
});

try {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'),
    {
      timeout: 60_000,
    },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByRole('button').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
  notas.push(`Sesión: medica@alovida.mock → ${page.url()}`);

  // Desde la agenda del día a la primera cita que se puede atender (misma puerta que el recorrido de C8);
  // si la agenda sembrada no tiene citas hoy, por el archivo clínico: primer paciente → su consulta.
  await page.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded' });
  await asentarse(page);
  const puertas = page.getByTestId('dia-ir-a-atender');
  const cuantas = await puertas.count();
  let entro = false;
  for (let i = 0; i < cuantas && !entro; i += 1) {
    await puertas.nth(i).click();
    try {
      await page.waitForURL((url) => url.searchParams.has('cita'), { timeout: 4_000 });
      entro = true;
    } catch {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
  }
  if (!entro) {
    notas.push(
      `La agenda de hoy no tiene citas atendibles (${cuantas}); se entra por el archivo clínico.`,
    );
    await page.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded' });
    await asentarse(page);
    const enlaces = await page
      .locator('a[href*="/medical-records/"]')
      .evaluateAll((as) =>
        as
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => /\/medical-records\/[^/?#]+$/.test(h)),
      );
    if (enlaces.length === 0) throw new Error('el archivo clínico no lista ningún paciente');
    await page.goto(`${BASE}${enlaces[0]}/consultation`, { waitUntil: 'domcontentloaded' });
  }
  await asentarse(page);
  notas.push(`Consulta: ${page.url()}`);

  if ((await page.getByTestId('consulta-lo-registrado').count()) === 0) {
    const abrir = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrir.count()) > 0) {
      await abrir.click();
      await page
        .getByTestId('consulta-lo-registrado')
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => undefined);
      await asentarse(page);
    }
  }
  const dxAntes = await cuenta(page, 'consulta-casilla-diagnosticos');
  const ordAntes = await cuenta(page, 'consulta-casilla-ordenes');
  notas.push(`Antes — Diagnóstico: «${dxAntes}» · Orden de análisis: «${ordAntes}»`);

  await page.getByTestId('consulta-casilla-formulario').click();
  // El anfitrión del diálogo no tiene tamaño propio (Playwright lo ve «hidden»): se espera al bloque.
  const modal = page.locator('app-specialty-form-block').first();
  await modal.waitFor({ state: 'visible', timeout: 15_000 });
  await asentarse(page);

  const selector = modal.locator('select').first();
  const opciones = await selector.locator('option').allTextContents();
  const fijas = /Diagnóstico|Hoja en blanco|Alergia|Cirugía|Odontología|Laboratorio/;
  const plantilla =
    opciones.find((o) => /^s*anamnesis general/i.test(o)) ??
    opciones.find((o) => /anamnesis/i.test(o)) ??
    opciones.find((o) => o.trim() !== '' && !fijas.test(o));
  if (plantilla === undefined)
    throw new Error(`sin plantilla de forms en el selector: ${opciones.join(' | ')}`);
  await selector.selectOption({ label: plantilla });
  await asentarse(page);
  notas.push(`Plantilla elegida: «${plantilla.trim()}»`);
  await page.screenshot({ path: `${SALIDA}/01-cierre-sin-respuestas-1440.png`, fullPage: true });

  const campos = modal.getByTestId('campo-especialidad');
  const n = await campos.count();
  let respondido = null;
  for (let i = 0; i < n && respondido === null; i += 1) {
    const input = campos
      .nth(i)
      .locator('input:not([type="number"]):not([type="checkbox"]), textarea')
      .first();
    if ((await input.count()) > 0) {
      await input.fill('fiebre alta y tos con dolor al respirar desde hace tres días');
      respondido =
        (await campos
          .nth(i)
          .locator('label')
          .first()
          .innerText()
          .catch(() => `campo ${i}`)) ?? '';
    }
  }
  notas.push(`Campo respondido: «${(respondido ?? '(ninguno de texto)').trim()}» de ${n} campos`);
  const cierre = modal.getByTestId('cierre-del-formulario');
  // La IA tarda lo que tarde el modelo: se espera a que el bloque diga algo (sugerencias, vacío o sin servicio).
  await cierre
    .locator(
      '[data-testid="cierre-tentativos"], [data-testid="cierre-vacio"], [data-testid="cierre-sin-servicio"]',
    )
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() =>
      notas.push('La IA no respondió en 30 s: el bloque siguió en «Pidiendo sugerencias…».'),
    );
  await asentarse(page);
  await cierre.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SALIDA}/02-cierre-tras-responder-1440.png`, fullPage: true });
  notas.push(`Estado del cierre:\n${(await cierre.innerText()).replace(/\n{2,}/g, '\n')}`);

  // «Usar» sobre la primera sugerencia de cada lista: el catálogo filtra (un ICD que no está avisa; la
  // radiografía resuelve por etiqueta). Después, lo que el catálogo sí tiene, elegido a mano por nombre.
  const selects = cierre.locator('select');
  const total = await selects.count();
  notas.push(`Selectores del cierre: ${total}`);
  const textoDe = (i) => selects.nth(i).evaluate((s) => s.options[s.selectedIndex]?.text ?? '');
  const usarDx = cierre.getByTestId('cierre-usar-tentativo');
  if ((await usarDx.count()) > 0) {
    await usarDx.first().click();
    await page.waitForTimeout(400);
    notas.push(`«Usar» el primer tentativo → selector de diagnóstico: «${await textoDe(0)}»`);
    notas.push(
      `Avisos tras «Usar»: ${(await page.locator('app-toast').allInnerTexts()).join(' | ').replace(/s+/g, ' ')}`,
    );
  }
  const usarOrden = cierre.getByTestId('cierre-usar-orden');
  if ((await usarOrden.count()) > 0) {
    await usarOrden.first().click();
    await page.waitForTimeout(400);
    notas.push(
      `«Usar» la primera orden → categoría: «${await textoDe(1)}» · estudio: «${await textoDe(2)}»`,
    );
  }
  if (total >= 3 && (await textoDe(0)).startsWith('Sin')) {
    await selects
      .nth(0)
      .selectOption({ label: 'Infección respiratoria aguda' })
      .catch(() => selects.nth(0).selectOption({ index: 2 }));
  }
  if (total >= 3 && (await textoDe(2)).startsWith('Sin')) {
    await selects.nth(1).selectOption({ label: 'Laboratorio' });
    await selects
      .nth(2)
      .selectOption({ label: 'Hemograma completo' })
      .catch(() => selects.nth(2).selectOption({ index: 2 }));
  }
  // Un estudio que el paciente sembrado ya tiene reciente dispara la antiduplicación del simulador
  // (412, «Ya existe un estudio igual reciente»); ver RESULTADO-corrida-1. Para la corrida completa se
  // pide uno que no esté repetido.
  if (total >= 3 && /Radiograf|Hemograma/.test(await textoDe(2))) {
    await selects.nth(1).selectOption({ label: 'Laboratorio' });
    await selects
      .nth(2)
      .selectOption({ label: 'Densitometría ósea' })
      .catch(() => undefined);
    notas.push(
      'Estudio cambiado a «Densitometría ósea» para esquivar la antiduplicación del simulador.',
    );
  }
  await asentarse(page);
  notas.push(
    `Elegido — diagnóstico: «${await textoDe(0)}» · categoría: «${await textoDe(1)}» · estudio: «${await textoDe(2)}»`,
  );

  // Los obligatorios de la ficha, para que «Completar formulario» se habilite.
  const obligatorios = modal.getByTestId('campo-especialidad').filter({ hasText: /obligatorio/i });
  const cuantosObligatorios = await obligatorios.count();
  for (let i = 0; i < cuantosObligatorios; i += 1) {
    const campo = obligatorios.nth(i);
    const numero = campo.locator('input[type="number"]');
    const texto = campo.locator('input:not([type="number"]):not([type="checkbox"]), textarea');
    const siNo = campo.locator('app-segmented-control button');
    if ((await siNo.count()) > 0) await siNo.first().click();
    else if ((await numero.count()) > 0) await numero.first().fill('1');
    else if ((await texto.count()) > 0) {
      const actual = await texto
        .first()
        .inputValue()
        .catch(() => '');
      if (actual === '') await texto.first().fill('sin datos relevantes');
    }
  }
  notas.push(`Obligatorios de la ficha completados: ${cuantosObligatorios}`);
  await page.waitForTimeout(1_500);
  await asentarse(page);
  await page.screenshot({ path: `${SALIDA}/03-cierre-elegido-1440.png`, fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await asentarse(page);
  await cierre.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SALIDA}/03-cierre-elegido-375.png`, fullPage: true });
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  notas.push(`Desborde horizontal a 375: ${desborde ? 'SÍ' : 'no'}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await asentarse(page);

  await modal.getByRole('button', { name: /Completar formulario/i }).click();
  await page.waitForTimeout(2_500);
  await asentarse(page);
  await page.screenshot({ path: `${SALIDA}/04-completado-1440.png`, fullPage: true });
  notas.push(
    `Avisos tras completar:\n${(await page.locator('app-toast, [role="status"], [role="alert"]').allInnerTexts()).join('\n')}`,
  );

  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await asentarse(page);
  const dxDespues = await cuenta(page, 'consulta-casilla-diagnosticos');
  const ordDespues = await cuenta(page, 'consulta-casilla-ordenes');
  notas.push(
    `Después de recargar — Diagnóstico: «${dxDespues}» · Orden de análisis: «${ordDespues}»`,
  );
  await page.screenshot({ path: `${SALIDA}/05-rejilla-tras-recargar-1440.png`, fullPage: true });

  // La orden pedida, vista desde su propia casilla después de recargar: persistencia → recarga → UI.
  await page.getByTestId('consulta-casilla-ordenes').click();
  const ordenes = page.locator('app-analysis-order-block').first();
  await ordenes.waitFor({ state: 'visible', timeout: 15_000 });
  await asentarse(page);
  const aparecio = await ordenes
    .getByText(/Densitometr/i)
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  const textoOrdenes = (await ordenes.innerText()).replace(/s+/g, ' ');
  notas.push(
    `Casilla «Orden de análisis» tras recargar: ${aparecio ? 'lista la densitometría pedida ✓' : `NO lista la densitometría — texto: ${textoOrdenes.slice(0, 600)}`}`,
  );
  await page.screenshot({
    path: `${SALIDA}/06-orden-en-su-casilla-tras-recargar-1440.png`,
    fullPage: true,
  });
} catch (error) {
  problemas.push(`script: ${error instanceof Error ? error.message : String(error)}`);
  await page.screenshot({ path: `${SALIDA}/99-fallo.png`, fullPage: true }).catch(() => undefined);
} finally {
  writeFileSync(
    `${SALIDA}/RESULTADO.md`,
    [
      '# Evidencia D4 — cierre del formulario (Playwright suelto contra ng serve)',
      '',
      `Fecha: ${new Date().toISOString()} · Base: ${BASE}`,
      '',
      ...notas.map((n) => `- ${n}`),
      '',
      '## Peticiones al servicio de IA',
      ...(respuestasIa.length === 0 ? ['- (ninguna)'] : respuestasIa.map((r) => `- ${r}`)),
      '',
      '## Problemas (consola, pageerror, script)',
      ...(problemas.length === 0 ? ['- ninguno'] : problemas.map((p) => `- ${p}`)),
      '',
    ].join('\n'),
  );
  await navegador.close();
}
