import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Antiduplicación de estudios de laboratorio e imagenología — v4.2.17,
 * T-26, subtarea 3.2.
 *
 * Sólo la maqueta (`mockBackend: true`, que es lo que sirve `yarn start` por
 * defecto): el paciente sembrado (`PACIENTE`, documento `3000000`) ya trae,
 * por construcción de los fixtures, un Hemograma liberado por otra
 * organización (`TENANT_LABORATORIO`) y un Perfil lipídico liberado por la
 * organización de `medica@alovida.mock` (`TENANT_CLINICA`) — el caso cruzado
 * y el caso intra-organización, sin sembrar nada nuevo.
 *
 * La pierna contra la API real (Neon) queda **declarada BLOCKED**: requiere
 * aplicar los patches v4.2.11/15/16/17 sobre la base compartida y correr el
 * seeder `tools/alovida/seed-estudios-duplicados.mjs` del repo de la API,
 * ninguno de los dos ejecutado en esta sesión (decisión explícita: no tocar
 * Neon sin confirmación en vivo).
 */

const MEDICA_MOCK: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Médica (maqueta)',
};

const ADMIN_MOCK: Actor = {
  rol: 'administrador',
  identificador: 'admin@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Administración (maqueta)',
};

// `PACIENTES_ESCRITOS` en `fixtures/personas.ts` numera con
// `String(5000000 + indice * 9871)`: PACIENTE es el índice 0, «5000000» —no
// «3000000», que es el rango de los profesionales (`indice * 12345`).
const DOCUMENTO_PACIENTE = '5000000';

/** Abre el expediente del paciente sembrado y registra un encuentro nuevo. */
async function abrirEncuentroDelPaciente(page: Page): Promise<void> {
  await irA(page, '/medical-records');
  await estable(page);

  await page.getByTestId('clinical-record-national-id').fill(DOCUMENTO_PACIENTE);
  await page.getByTestId('clinical-record-search-by-document').click();
  await estable(page);

  await page.getByRole('link', { name: 'Ver expediente' }).first().click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });

  const urlExpediente = page.url();
  await page.goto(`${urlExpediente}/encounter`, { waitUntil: 'commit' });
  await page.waitForURL(/\/medical-records\/[^/]+\/encounter$/, { timeout: 60_000 });
  await estable(page);

  await expect(page.getByRole('heading', { name: 'Encuentro', exact: true })).toBeVisible();
  const registrar = page.getByRole('button', { name: 'Registrar encuentro' });
  await expect(registrar).toBeEnabled({ timeout: 30_000 });
  await registrar.click();
  // El encuentro recién creado pasa a «en curso»: es la señal de que
  // `encounterId` ya llegó al bloque de laboratorio, que lo exige para
  // ofrecer el formulario.
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
}

/** Elige «Laboratorio e imagenología» en el selector de plantilla del formulario clínico. */
async function abrirLaboratorio(page: Page): Promise<void> {
  await page.getByLabel('Qué vas a completar').selectOption({ label: 'Laboratorio e imagenología' });
  await expect(page.getByRole('heading', { name: 'Laboratorio e imagenología' })).toBeVisible();
}

/**
 * Elige un estudio y su tipo, y pulsa «Pedir estudio».
 *
 * Sin `exact`: el asterisco de obligatoriedad agrega «(obligatorio)» al
 * nombre accesible del control (`FormField` lo suma como texto visualmente
 * oculto), así que el nombre real es «Tipo (obligatorio)», no «Tipo» a secas.
 */
async function pedirEstudio(page: Page, estudio: string, tipo: string): Promise<void> {
  await page.getByLabel('Estudio').selectOption({ label: estudio });
  await page.getByLabel('Tipo').selectOption({ label: tipo });
  await page.getByRole('button', { name: 'Pedir estudio' }).click();
}

/**
 * Espera el diálogo de antiduplicación y devuelve el locator de su host.
 *
 * `showModal()` promueve el `<dialog>` nativo a la capa superior del
 * navegador: la caja del `<app-content-dialog>` que lo envuelve deja de
 * corresponderse con dónde se ve el diálogo, y `toBeVisible()` sobre ese
 * host reporta `hidden` aunque el diálogo esté perfectamente pintado en
 * pantalla (comprobado con captura). Por eso la espera real es sobre el
 * título — un elemento de verdad dentro de la capa superior —, no sobre el
 * wrapper.
 */
async function esperarDialogoDuplicado(page: Page) {
  const dialogo = page.getByTestId('duplicate-study-warning-dialog');
  await expect(dialogo.getByTestId('content-dialog-title')).toBeVisible({ timeout: 15_000 });
  return dialogo;
}

/**
 * Abre el detalle de una solicitud desde el listado de administración.
 *
 * Se entra por la lista y no por la URL directa porque el id es un uuid
 * derivado del identificador y no se conoce desde el test; el enlace del
 * listado es además el camino que recorre el auditor.
 */
async function abrirSolicitud(page: Page, identificador: string): Promise<void> {
  await irA(page, '/administration/insurance-claims');
  await estable(page);

  await page.getByTestId('claim-link').filter({ hasText: identificador }).click();
  await page.waitForURL(/\/administration\/insurance-claims\/[^/]+$/, { timeout: 60_000 });
  await estable(page);
}

test.describe('la alerta de estudio duplicado (maqueta)', () => {
  test('un estudio cruzado ofrece reutilizar y avisa que el informe es de otra organización', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await entrar(page, MEDICA_MOCK);
    await abrirEncuentroDelPaciente(page);
    await abrirLaboratorio(page);

    // El Hemograma completo de PACIENTE lo liberó TENANT_LABORATORIO — otra
    // organización que la de `medica` (TENANT_CLINICA/TENANT_HOSPITAL).
    await pedirEstudio(page, 'Hemograma completo', 'Laboratorio');

    const dialogo = await esperarDialogoDuplicado(page);
    await expect(dialogo).toContainText('Hemograma completo');
    await expect(dialogo).toContainText('Resultados disponibles');
    await expect(dialogo).toContainText('otra organización');

    await page.screenshot({
      path: 'artifacts/playwright/subtarea-3.2/dialogo-1440.png',
      fullPage: false,
    });

    // Sin desborde horizontal con el diálogo abierto.
    const desborde = await page.evaluate(() => {
      const d = document.documentElement;
      return Math.max(0, d.scrollWidth - d.clientWidth);
    });
    expect(desborde).toBe(0);

    await page.getByTestId('btn-reuse-previous-results').click();
    await expect(dialogo).toHaveCount(0);
    await estable(page);
    await expect(page.getByTestId('estudios-duplicado').first()).toContainText(
      'Satisfecha por el informe del',
    );

    await context.close();
  });

  test('un estudio intra-organización trae la conclusión y admite repetirse con justificación', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await entrar(page, MEDICA_MOCK);
    await abrirEncuentroDelPaciente(page);
    await abrirLaboratorio(page);

    // El Perfil lipídico de PACIENTE lo liberó TENANT_CLINICA — la misma
    // organización que `medica`: acá sí llega la conclusión clínica.
    await pedirEstudio(page, 'Perfil lipídico', 'Laboratorio');

    const dialogo = await esperarDialogoDuplicado(page);
    await expect(dialogo).not.toContainText('otra organización');

    // El `<input>` nativo va oculto a propósito (`width/height: 0`, la caja
    // visible es el `<span>` de al lado): se clickea el texto de la etiqueta,
    // que es lo que un lector de pantalla también anuncia como el control.
    await page
      .getByTestId('checkbox-repeat-required')
      .getByText('Es clínicamente necesario repetir el estudio hoy')
      .click();
    const textarea = page.getByTestId('textarea-duplicate-justification').locator('textarea');
    await textarea.fill('Sospecha de anemia aguda, se repite por deterioro clínico reciente.');

    const confirmar = page.getByTestId('btn-confirm-justified-duplicate');
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    await expect(dialogo).toHaveCount(0);
    await estable(page);
    await expect(page.getByTestId('estudios-duplicado').first()).toContainText(
      'Repetida con justificación',
    );

    await context.close();
  });

  test('en 390×844 el diálogo no desborda y sus botones alcanzan el objetivo táctil', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await entrar(page, MEDICA_MOCK);
    await abrirEncuentroDelPaciente(page);
    await abrirLaboratorio(page);
    await pedirEstudio(page, 'Hemograma completo', 'Laboratorio');

    await esperarDialogoDuplicado(page);

    const desborde = await page.evaluate(() => {
      const d = document.documentElement;
      return Math.max(0, d.scrollWidth - d.clientWidth);
    });
    expect(desborde).toBe(0);

    for (const testId of [
      'btn-cancel-duplicate-dialog',
      'btn-reuse-previous-results',
      'btn-confirm-justified-duplicate',
    ]) {
      const boton = page.getByTestId(testId);
      const caja = await boton.boundingBox();
      // Redondeado: el motor de layout entrega 43.998px para una altura
      // declarada en 44px — subpíxel de renderizado, no un objetivo táctil
      // real por debajo del mínimo.
      expect(Math.round(caja?.height ?? 0)).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: 'artifacts/playwright/subtarea-3.2/dialogo-390.png',
      fullPage: false,
    });

    await context.close();
  });
});

test.describe('el badge de estudio duplicado en el detalle del reclamo (maqueta)', () => {
  test('CLM-2026-0142 muestra "Posible duplicado" con su justificación en el globo', async ({
    page,
  }) => {
    await entrar(page, ADMIN_MOCK);
    await irA(page, '/administration/insurance-claims');
    await estable(page);

    await page
      .getByTestId('claim-link')
      .filter({ hasText: 'CLM-2026-0142' })
      .click();
    await page.waitForURL(/\/administration\/insurance-claims\/[^/]+$/, { timeout: 60_000 });
    await estable(page);

    const badge = page.getByTestId('badge-duplicate-alert');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Posible duplicado');

    await badge.focus();
    await expect(page.locator('[role="tooltip"]').first()).toBeVisible({ timeout: 5_000 });
  });
});

/**
 * Endurecimiento del carril: los tres criterios de aceptación que el bloque
 * de arriba deja sin ejercitar.
 *
 * El test del badge comprueba el globo **por foco de teclado**; el criterio
 * pide además el **hover del ratón**, que es un camino distinto en el átomo
 * `Tooltip` (`mouseenter`, no `focus`). La cita de la cláusula y los canales
 * de contacto directo no tenían ninguna cobertura E2E.
 */
test.describe('auditoría del reclamo: globo, cláusula y canales (maqueta)', () => {
  test('el globo del duplicado también se abre con el ratón, no sólo con el teclado', async ({
    page,
  }) => {
    await entrar(page, ADMIN_MOCK);
    await abrirSolicitud(page, 'CLM-2026-0142');

    const badge = page.getByTestId('badge-duplicate-alert');
    await expect(badge).toBeVisible();

    // Es un botón y no un `<span>` con `title`: por eso lo alcanza el
    // tabulador y por eso el globo puede ser accesible en los dos caminos.
    expect(await badge.evaluate((el) => el.tagName)).toBe('BUTTON');

    await badge.hover();
    const globo = page.locator('[role="tooltip"]').first();
    await expect(globo).toBeVisible({ timeout: 5_000 });

    // El resumen dice fecha, prestador previo y justificación clínica: es lo
    // que el auditor necesita para decidir sin abrir el informe —que no le
    // corresponde leer—.
    await expect(globo).toContainText('Perfil lipídico');
    await expect(globo).toContainText('Justificación médica');

    // El globo se cuelga del `<body>`, así que el scroll horizontal de la
    // tabla de prestaciones no lo recorta.
    expect(await globo.evaluate((el) => el.parentElement?.tagName ?? '')).toBe('BODY');
  });

  test('una solicitud rechazada cita textualmente la cláusula de la póliza', async ({
    page,
  }) => {
    await entrar(page, ADMIN_MOCK);
    await abrirSolicitud(page, 'CLM-2026-0163');

    // La cita va completa, no un código suelto: «Cláusula 4.1» a secas
    // obligaría al auditor a ir a buscar el condicionado a otra parte.
    const motivo = page.getByTestId('claim-line-reason').first();
    await expect(motivo).toContainText(
      'Cláusula 4.1: Preexistencia declarada al momento de la afiliación',
    );
    await expect(motivo).toContainText('período de carencia');
  });

  test('los canales de contacto apuntan a WhatsApp y al call center de la aseguradora', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    page.on('pageerror', (error) => errores.push(error.message));

    await entrar(page, ADMIN_MOCK);
    await abrirSolicitud(page, 'CLM-2026-0142');

    const referencia = new Set(errores);

    const whatsapp = page.getByTestId('btn-whatsapp-claim');
    await expect(whatsapp).toBeVisible();

    /*
      Se comprueba el `href`, no el clic.

      `wa.me` y `tel:` salen de la aplicación: el primero a la red pública, el
      segundo a un manejador de protocolo del sistema operativo. Pulsarlos en
      Chromium no prueba nada del producto y mete una dependencia externa en
      una suite de maqueta. Lo que sí es del producto —y lo que el criterio
      pide— es que el destino sea el correcto y que el mensaje viaje cargado.
    */
    const url = await whatsapp.getAttribute('href');
    expect(url).not.toBeNull();
    expect(url!.startsWith('https://wa.me/59170000101?text=')).toBe(true);

    const mensaje = decodeURIComponent(url!.split('?text=')[1]!);
    expect(mensaje).toContain('CLM-2026-0142');
    expect(mensaje).toContain('Seguros Andina');

    // Abre en pestaña nueva, y con `rel` puesto: sin él la página de destino
    // recibe un `window.opener` vivo sobre una pantalla con datos de salud.
    expect(await whatsapp.getAttribute('target')).toBe('_blank');
    expect(await whatsapp.getAttribute('rel')).toContain('noopener');

    // El call center marca por `tel:` con el número ya limpio: los guiones de
    // «800-10-0101» dejan muerto el enlace en un navegador que respeta el RFC.
    const callCenter = page.getByTestId('btn-callcenter-claim');
    await expect(callCenter).toBeVisible();
    expect(await callCenter.getAttribute('href')).toBe('tel:800100101');
    await expect(callCenter).toContainText('800-10-0101');

    // Ninguno de los dos enlaces agrega un error sobre lo ya medido en esta
    // misma pantalla (la CSP del servidor de desarrollo aporta los suyos).
    expect([...new Set(errores)].filter((e) => !referencia.has(e))).toEqual([]);
  });
});
