import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { elegirOpcion } from './support/desplegable';
import {
  abrirConsultaDelPaciente,
  abrirOrdenDeEstudios,
  cerrarCasilla,
  elegirTipoDeOrden,
  MEDICA_MOCK,
  responderFormularioMedico,
} from './support/consulta-estudios';
import { entrar } from './support/sesion';

/**
 * Pedir un estudio con su muestra (laboratorio) o su parte del cuerpo (imagen).
 *
 * **Contra la maqueta** (`yarn start:demo`): la API real todavía no expone
 * `bodyStructureUberon`, `bodyMeshId` ni `boneTypeConceptId` (PRs de API y
 * modelo en curso). Lo que se prueba es la pantalla, el cuerpo que viaja y que
 * lo guardado vuelve tras recargar la página — contra el DOBLE, que no es la
 * API. La pierna contra la API real queda BLOCKED hasta que esos PRs lleguen
 * a `dev`.
 *
 * WebGL en Chromium sin pantalla corre por SwiftShader; sin él el visor avisa
 * y la lista accesible sigue sirviendo, que también se prueba.
 *
 * Nunca se espera a que la red quede quieta: con HMR no llega (CLAUDE.md §5).
 */

/**
 * Dónde van las capturas. Por omisión a `artifacts/` (ignorado por git: la puerta de subida corre esta prueba y no
 * debe ensuciar el árbol); la evidencia del trabajo se genera con
 * `E2E_CAPTURAS_DIR=docs/trabajo/2026-10-31-estudios-muestra-y-region-corporal/evidencia/capturas`.
 */
const CAPTURAS =
  process.env['E2E_CAPTURAS_DIR'] ??
  join(process.cwd(), 'artifacts', 'playwright', 'capturas-estudios');

test.use({
  launchOptions: {
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    ...(process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {}),
  },
});

/** Los tres anchos del repo; el alto es el necesario para ver la sección entera dentro del modal (no hay captura de elemento: parte el modal). */
const VISTAS = [
  { nombre: '390', ancho: 390, alto: 2000 },
  { nombre: '768', ancho: 768, alto: 1500 },
  { nombre: '1440', ancho: 1440, alto: 1300 },
] as const;

async function fijarTema(page: Page, tema: 'claro' | 'oscuro'): Promise<void> {
  await page.emulateMedia({
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
    reducedMotion: 'reduce',
  });
  await page.evaluate(
    (t) => document.documentElement.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light'),
    tema,
  );
}

/** Una captura de la ventana o, con `zona`, sólo de ese elemento entero (la sección de imagen es más alta que la ventana). */
async function foto(page: Page, nombre: string, zona?: Locator): Promise<void> {
  mkdirSync(CAPTURAS, { recursive: true });
  await page.evaluate(
    () =>
      new Promise<void>((listo) =>
        requestAnimationFrame(() => requestAnimationFrame(() => listo())),
      ),
  );
  const ruta = join(CAPTURAS, `${nombre}.png`);
  if (zona === undefined)
    await page.screenshot({ path: ruta, animations: 'disabled', caret: 'hide' });
  else await zona.screenshot({ path: ruta, animations: 'disabled', caret: 'hide' });
}

/** Lo que el doble de la API guardó del detalle de las órdenes (sessionStorage de la maqueta). */
async function detalleGuardado(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => {
    const crudo = sessionStorage.getItem('mock.studyDetail');
    return crudo === null ? [] : (JSON.parse(crudo) as { filas: Record<string, unknown>[] }).filas;
  });
}

/** Laboratorio: el tipo de análisis arma el árbol; busca por nombre y elige el primer estudio que aparezca. */
async function elegirEstudioDeLaboratorio(
  modal: Locator,
  tipo: string,
  busquedas: readonly string[],
): Promise<string> {
  await elegirTipoDeOrden(modal, 'Laboratorio');
  await elegirOpcion(modal.getByRole('combobox', { name: /^Tipo de análisis\b/ }), tipo);
  await modal.locator('app-tree-select button').first().click();
  const dialogo = modal.page().locator('dialog[open]').last();
  const caja = dialogo.locator('input[placeholder*="Buscar"]').first();
  for (const busqueda of busquedas) {
    await caja.fill(busqueda);
    const fila = dialogo.getByRole('treeitem', { name: new RegExp(busqueda, 'i') }).last();
    if (await fila.isVisible().catch(() => false)) {
      const nombre = ((await fila.innerText()) ?? '').trim();
      await fila.click();
      return nombre;
    }
  }
  throw new Error(`ningún estudio del árbol coincide con: ${busquedas.join(', ')}`);
}

/** Imagenología: el tipo de imagen filtra los estudios; elige el primero de la lista. */
async function elegirEstudioDeImagen(modal: Locator, tipoDeImagen: string): Promise<void> {
  await elegirTipoDeOrden(modal, 'Imagenología');
  await elegirOpcion(modal.getByRole('combobox', { name: /^Tipo de imagen\b/ }), tipoDeImagen);
  const combo = modal.getByRole('combobox', { name: /^Estudio\b/ });
  await combo.click();
  const lista = modal.page().locator('dialog.select-dialog[open]');
  await expect(lista).toBeVisible();
  await lista.getByRole('option').first().click();
  await expect(lista).toHaveCount(0);
}

async function abrirOrdenes(page: Page): Promise<Locator> {
  await entrar(page, MEDICA_MOCK);
  await abrirConsultaDelPaciente(page);
  await responderFormularioMedico(page);
  return abrirOrdenDeEstudios(page);
}

test.describe('la orden de estudios lleva muestra o parte del cuerpo (maqueta)', () => {
  test('el tipo de orden se elige primero: sin él no hay estudio, y cambiar de tipo no arrastra lo anterior', async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const contexto = await browser.newContext({
      viewport: { width: 1440, height: 1300 },
      reducedMotion: 'reduce',
    });
    const page = await contexto.newPage();
    const modal = await abrirOrdenes(page);

    await expect(modal.getByRole('combobox', { name: /^Tipo de orden\b/ })).toBeVisible();
    await expect(modal.getByRole('combobox', { name: /^Estudio\b/ })).toHaveCount(0);
    await expect(modal.getByTestId('lab-type')).toHaveCount(0);
    await expect(modal.getByTestId('imaging-modality')).toHaveCount(0);

    await elegirEstudioDeImagen(modal, 'Radiografía simple');
    await expect(modal.getByTestId('imaging-guidance')).toContainText(
      'pendiente de revisión clínica',
    );

    // Pasar a laboratorio no deja el estudio de imagen, su ficha ni la parte del cuerpo.
    await elegirTipoDeOrden(modal, 'Laboratorio');
    await expect(modal.getByTestId('imaging-guidance')).toHaveCount(0);
    await expect(modal.getByTestId('order-imaging-detail')).toHaveCount(0);
    await expect(modal.getByTestId('lab-type')).toBeVisible();

    // «Otro estudio» conserva el selector de siempre, con todo el catálogo.
    await elegirTipoDeOrden(modal, 'Otro estudio');
    await expect(modal.getByRole('combobox', { name: /^Estudio\b/ })).toBeVisible();
    await contexto.close();
  });

  test('laboratorio: exige la muestra, la manda y la conserva tras recargar', async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const contexto = await browser.newContext({
      viewport: { width: 1440, height: 1300 },
      reducedMotion: 'reduce',
    });
    const page = await contexto.newPage();
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    let modal = await abrirOrdenes(page);
    const estudio = await elegirEstudioDeLaboratorio(modal, 'Sangre', [
      'Glucosa',
      'Creatinina',
      'TSH',
      'lip',
    ]);
    const pedir = modal.getByRole('button', { name: 'Pedir estudio' });

    // Sin muestra no se puede pedir, y el campo lo dice.
    const muestra = modal.getByRole('combobox', { name: /^Muestra\b/ });
    await expect(muestra).toBeVisible();
    await expect(pedir).toBeDisabled();
    await expect(modal.getByTestId('order-detail-missing')).toContainText('Elija la muestra');
    await foto(page, 'lab-1440-claro-vacio');

    // El tipo de análisis limita la muestra: en «Sangre» no se ofrece orina.
    await muestra.click();
    const muestras = page.locator('dialog.select-dialog[open]');
    await expect(muestras.getByRole('option').first()).toBeVisible();
    expect(await muestras.getByRole('option', { name: /^Orina/ }).count()).toBe(0);
    await page.keyboard.press('Escape');
    await elegirOpcion(muestra, /Sangre/);
    await expect(pedir).toBeEnabled();
    await foto(page, 'lab-1440-claro-con-muestra');
    await pedir.click();

    await expect(page.getByTestId('consulta-modal')).toHaveCount(0, { timeout: 30_000 });
    // La maqueta contesta dentro de la página (no hay red que mirar): lo que guardó es lo que recibió.
    const guardadas = await detalleGuardado(page);
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]!['specimenTypeConceptId']).toBeTruthy();
    expect(
      Object.keys(guardadas[0]!).filter((k) => k !== 'id' && k !== 'specimenTypeConceptId'),
    ).toEqual([]);

    // Recargar la página y releer: la orden conserva la muestra.
    await page.reload({ waitUntil: 'domcontentloaded' });
    modal = await (async () => {
      await abrirConsultaDelPaciente(page);
      return abrirOrdenDeEstudios(page);
    })();
    await expect(
      modal
        .getByTestId('study-detail')
        .filter({ hasText: /Muestra: .*Sangre/i })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await modal.getByTestId('study-detail').first().scrollIntoViewIfNeeded();
    await foto(page, 'lab-1440-claro-historico');
    await cerrarCasilla(page, modal);
    expect(errores, estudio).toEqual([]);
    await contexto.close();
  });

  test('imagen: parte del cuerpo por lista y por 3D, lado, modalidad y tipo de hueso; todo vuelve tras recargar', async ({
    browser,
  }) => {
    test.setTimeout(420_000);
    const contexto = await browser.newContext({
      viewport: { width: 1440, height: 1300 },
      reducedMotion: 'reduce',
    });
    const page = await contexto.newPage();
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    let modal = await abrirOrdenes(page);
    await elegirEstudioDeImagen(modal, 'Radiografía simple');
    const pedir = modal.getByRole('button', { name: 'Pedir estudio' });
    const detalle = modal.getByTestId('order-imaging-detail');
    // El tipo de imagen ya se eligió arriba: la sección no lo vuelve a preguntar.
    await expect(modal.getByRole('combobox', { name: /^Modalidad\b/ })).toHaveCount(0);
    await expect(detalle).toBeVisible();
    await expect(modal.getByRole('combobox', { name: /^Muestra\b/ })).toHaveCount(0);
    await expect(pedir).toBeDisabled();
    await expect(detalle.getByTestId('order-detail-missing')).toContainText('Elija la región');

    // El visor 3D dibuja (o avisa que no puede); la lista accesible sirve en los dos casos.
    const visor = detalle.locator('app-anatomy-viewer .anatomy-viewer');
    await expect(visor).toHaveAttribute('data-status', /ready|unsupported|error/, {
      timeout: 120_000,
    });
    const estadoDelVisor = await visor.getAttribute('data-status');
    test.info().annotations.push({ type: 'visor-3d', description: String(estadoDelVisor) });

    // Elegir por la lista con teclado: buscar, tabular hasta la opción y activarla.
    const buscar = detalle.getByRole('textbox', { name: /Buscar la parte del cuerpo/ });
    await buscar.fill('femur');
    const resultados = detalle.getByTestId('bsp-results');
    await expect(resultados.getByRole('button').first()).toBeVisible({ timeout: 30_000 });
    await resultados.getByRole('button').first().focus();
    await page.keyboard.press('Enter');
    const elegida = detalle.getByTestId('bsp-selected');
    await expect(elegida).toContainText(/fémur|femur/i);

    // Es un hueso: aparece el tipo de hueso, que se elige a mano.
    const hueso = modal.getByRole('combobox', { name: /^Tipo de hueso\b/ });
    await expect(hueso).toBeVisible();
    await elegirOpcion(hueso, 'Hueso largo');

    // La región del catálogo la propone la parte marcada (cruce de la API: fémur → «Fémur»).
    await expect(modal.getByRole('combobox', { name: /^Región del estudio\b/ })).toContainText(
      'Fémur',
    );
    await elegirOpcion(modal.getByRole('combobox', { name: /^Lado\b/ }), 'Izquierda');
    await elegirOpcion(modal.getByRole('combobox', { name: /^Contraste\b/ }), 'Sin contraste');
    await expect(pedir).toBeEnabled();
    await foto(page, 'img-1440-claro-completo');

    await pedir.click();
    await expect(page.getByTestId('consulta-modal')).toHaveCount(0, { timeout: 30_000 });
    const guardadas = await detalleGuardado(page);
    expect(guardadas).toHaveLength(1);
    const imaging = guardadas[0]!;
    expect(
      Object.keys(imaging)
        .filter((k) => k !== 'id')
        .sort(),
    ).toEqual(
      [
        'bodyMeshId',
        'bodySiteConceptId',
        'bodyStructureUberon',
        'boneTypeConceptId',
        'contrastConceptId',
        'lateralityConceptId',
        'modalityConceptId',
      ].sort(),
    );
    expect(imaging['bodyStructureUberon']).toMatch(/^(UBERON|FMA):\d+$/);
    expect(imaging).not.toHaveProperty('specimenTypeConceptId');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await abrirConsultaDelPaciente(page);
    modal = await abrirOrdenDeEstudios(page);
    const linea = modal.getByTestId('study-detail').filter({
      hasText:
        'Región: Fémur · Izquierda · Radiografía simple · Hueso largo · Sin contraste · marcada en el cuerpo 3D',
    });
    await expect(linea.first()).toBeVisible({ timeout: 30_000 });
    expect(errores).toEqual([]);
    await contexto.close();
  });

  for (const vista of VISTAS) {
    for (const tema of ['claro', 'oscuro'] as const) {
      test(`capturas de la sección de imagen en ${vista.nombre} ${tema}`, async ({ browser }) => {
        test.setTimeout(300_000);
        const contexto = await browser.newContext({
          viewport: { width: vista.ancho, height: vista.alto },
          reducedMotion: 'reduce',
          colorScheme: tema === 'oscuro' ? 'dark' : 'light',
        });
        const page = await contexto.newPage();
        const modal = await abrirOrdenes(page);
        await fijarTema(page, tema);
        await elegirEstudioDeImagen(modal, 'Radiografía simple');
        const detalle = modal.getByTestId('order-imaging-detail');
        await expect(detalle).toBeVisible();
        await expect(detalle.locator('app-anatomy-viewer .anatomy-viewer')).toHaveAttribute(
          'data-status',
          /ready|unsupported|error/,
          { timeout: 120_000 },
        );
        await foto(page, `img-${vista.nombre}-${tema}-vacio`);
        await detalle.getByRole('textbox', { name: /Buscar la parte del cuerpo/ }).fill('femur');
        await detalle.getByTestId('bsp-results').getByRole('button').first().click();
        await expect(detalle.getByTestId('bsp-selected')).toContainText(/fémur|femur/i);
        await foto(page, `img-${vista.nombre}-${tema}-elegido`);
        await contexto.close();
      });
    }
  }
});
