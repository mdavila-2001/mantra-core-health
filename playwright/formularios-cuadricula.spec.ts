import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * El `Sí / No` en botones y las dos cuadrículas, observados en el navegador.
 *
 * Los tests unitarios ya fijan el comportamiento —qué se guarda, qué se apaga,
 * qué se anuncia—. Lo que esto responde es la otra pregunta, la que ningún
 * `expect` sobre el DOM contesta: **cómo se ve y si se puede usar** en el
 * generador de formularios de verdad, con el simulador de la rama `mockup`
 * detrás y sin backend.
 *
 * Deja las fotos en `artifacts/formularios-cuadricula/`, que son la evidencia
 * del cambio.
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FOTOS = 'artifacts/formularios-cuadricula';

/** Los tres anchos de siempre. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

/** Abre el generador con un formulario ya abierto y una pregunta propia. */
async function abrirUnaPregunta(page: Page): Promise<void> {
  await entrarAlSimulador(page, 'medica', BASE);
  await page.goto(`${BASE}/form-builder`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);

  await page.getByTestId('plantilla').first().click();
  await expect(page.getByTestId('agregar-campo')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('agregar-campo').click();
  await expect(page.getByTestId('campo-propio').last()).toBeVisible({ timeout: 30_000 });
}

/** La tarjeta de la última pregunta agregada. */
function tarjeta(page: Page) {
  return page.getByTestId('campo-propio').last();
}

/**
 * Avanza la vista previa hasta la pagina donde esta la cuadricula.
 *
 * El motor sirve **cuatro campos por pagina** y el formulario estandar trae los
 * suyos primero, asi que la pregunta recien agregada cae en una pagina de mas
 * atras. Ningun campo del estandar es obligatorio en el simulador, de modo que
 * «Siguiente» avanza sin completar nada.
 */
async function avanzarHastaLaCuadricula(page: Page): Promise<void> {
  const cuadricula = page.locator('app-grid-group').first();
  for (let paso = 0; paso < 20; paso += 1) {
    if (await cuadricula.isVisible()) return;
    await responderLaPagina(page);
    const siguiente = page.getByTestId('paginated-form-continuar');
    if (!(await siguiente.isVisible())) break;
    await siguiente.click();
    await page.waitForTimeout(250);
  }
  await expect(cuadricula).toBeVisible();
}

/**
 * Contesta lo obligatorio de la página en la que está el motor.
 *
 * Los campos del formulario estándar son obligatorios —el motor no deja pasar
 * de página con uno vacío, y hace bien—, así que llegar hasta la pregunta nueva
 * pasa por completarlos, igual que le pasaría a una persona.
 */
async function responderLaPagina(page: Page): Promise<void> {
  const pagina = page.locator('.paginated-form__pagina');

  const textos = pagina.locator('input[type="text"]:not([disabled]), textarea:not([disabled])');
  for (let i = 0; i < (await textos.count()); i += 1) {
    const campo = textos.nth(i);
    if ((await campo.inputValue()) === '') await campo.fill('Sin datos');
  }

  const numeros = pagina.locator('input[type="number"]:not([disabled])');
  for (let i = 0; i < (await numeros.count()); i += 1) {
    const campo = numeros.nth(i);
    if ((await campo.inputValue()) === '') await campo.fill('1');
  }

  const listas = pagina.locator('select:not([disabled])');
  for (let i = 0; i < (await listas.count()); i += 1) {
    await listas.nth(i).selectOption({ index: 1 }).catch(() => undefined);
  }

  // Los de elección y los sí/no: la primera respuesta ofrecida.
  const grupos = pagina.locator('app-radio-group, app-segmented-control, app-checkbox-group');
  for (let i = 0; i < (await grupos.count()); i += 1) {
    await grupos
      .nth(i)
      .locator('label, [role="radio"]')
      .first()
      .click()
      .catch(() => undefined);
  }
}

/** Elige un tipo en el desplegable de la tarjeta. */
async function elegirTipo(page: Page, etiqueta: string): Promise<void> {
  // El `<select>` de dentro: el `data-testid` vive en el `app-select`, y
  // `selectOption` necesita el elemento nativo.
  await tarjeta(page)
    .getByTestId('editor-campo-tipo')
    .locator('select')
    .selectOption({ label: etiqueta });
  await page.waitForTimeout(400);
}

test.describe('FORMULARIOS-CUADRICULA', () => {
  test('el Sí / No se contesta con dos botones, no con una casilla', async ({ page }) => {
    await abrirUnaPregunta(page);
    await elegirTipo(page, 'Sí / No');

    const muestra = tarjeta(page).getByTestId('editor-campo-muestra-si-no');
    await expect(muestra).toBeVisible();
    // Por CSS y no con `getByRole`: la muestra de la tarjeta es `aria-hidden`
    // a propósito —es cómo se va a ver, no un lugar donde contestar— y los
    // selectores por rol no entran en un subárbol escondido.
    const opciones = muestra.locator('[role="radio"]');
    await expect(opciones).toHaveCount(2);
    await expect(opciones.first()).toHaveText('Sí');
    await expect(opciones.last()).toHaveText('No');
    // Lo que se reemplaza: la casilla suelta ya no está en la tarjeta.
    await expect(tarjeta(page).locator('app-checkbox')).toHaveCount(0);

    await tarjeta(page).screenshot({ path: `${FOTOS}/si-no-botones.png` });
  });

  test('la cuadrícula de opción única trae filas, columnas y sus dos restricciones', async ({
    page,
  }) => {
    await abrirUnaPregunta(page);
    await elegirTipo(page, 'Cuadrícula de opción única');

    const carta = tarjeta(page);
    // Nace con dos filas y dos columnas: con menos no hay nada que preguntar.
    await expect(carta.getByTestId('editor-campo-fila-0')).toBeVisible();
    await expect(carta.getByTestId('editor-campo-fila-1')).toBeVisible();
    await expect(carta.getByTestId('editor-campo-opcion-0')).toBeVisible();

    const restricciones = carta.getByTestId('editor-campo-restricciones');
    await expect(restricciones).toBeVisible();
    await expect(restricciones.getByText('Requerir una respuesta en cada fila')).toBeVisible();
    await expect(restricciones.getByText('Limitar a una respuesta por columna')).toBeVisible();

    // «Otro» no se ofrece en una cuadrícula: no hay dónde escribirlo.
    await expect(carta.getByTestId('editor-campo-agregar-otro')).toHaveCount(0);

    await carta.screenshot({ path: `${FOTOS}/cuadricula-opcion-unica.png` });
  });

  test('avisa cuando la cuadrícula no se puede terminar de responder', async ({ page }) => {
    await abrirUnaPregunta(page);
    await elegirTipo(page, 'Cuadrícula de opción única');

    const carta = tarjeta(page);
    // Tres filas y dos columnas, con una respuesta por columna: la tercera fila
    // se queda sin ninguna libre.
    await carta.getByTestId('editor-campo-agregar-fila').click();
    // Por el rótulo y no por el `<input>`: el nativo del interruptor está
    // escondido a la vista —lo dibuja el carril— y no se pulsa lo que no se ve.
    await carta.getByTestId('editor-campo-una-por-columna').locator('label').click();
    await carta.getByTestId('editor-campo-requerir-fila').locator('label').click();

    const aviso = carta.getByTestId('editor-campo-aviso-cuadricula');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('hace falta una columna más');

    await carta.screenshot({ path: `${FOTOS}/cuadricula-aviso.png` });
  });

  test('la vista previa sirve la cuadrícula como tabla y se puede contestar', async ({ page }) => {
    await abrirUnaPregunta(page);
    await elegirTipo(page, 'Cuadrícula de casillas');
    await page.waitForTimeout(900);

    await page.getByTestId('ver-previa').click();
    await expect(page.getByTestId('vista-previa')).toBeVisible({ timeout: 30_000 });

    await avanzarHastaLaCuadricula(page);
    const cuadricula = page.locator('app-grid-group').first();
    await expect(cuadricula.locator('th[scope="col"]')).toHaveCount(2);
    await expect(cuadricula.locator('th[scope="row"]')).toHaveCount(2);

    // Se puede contestar de verdad: la previa es el motor, no un dibujo. Se
    // pulsa el rótulo de la celda —el `<input>` está escondido a la vista,
    // como en el resto de los controles del sistema— y se comprueba en él.
    await cuadricula.locator('label.cuadricula__control').first().click();
    await expect(cuadricula.locator('input[type="checkbox"]').first()).toBeChecked();

    await page.getByTestId('vista-previa').screenshot({ path: `${FOTOS}/previa-cuadricula.png` });
  });

  test('la cuadrícula se lee en los tres anchos y sin desplazamiento lateral', async ({ page }) => {
    await abrirUnaPregunta(page);
    await elegirTipo(page, 'Cuadrícula de casillas');
    await page.waitForTimeout(900);
    await page.getByTestId('ver-previa').click();
    await expect(page.getByTestId('vista-previa')).toBeVisible({ timeout: 30_000 });
    await avanzarHastaLaCuadricula(page);

    for (const { nombre, width, height } of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await esperarAQueSeAsiente(page);

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde, `desplazamiento lateral en ${nombre}`).toBeLessThanOrEqual(1);

      await page.screenshot({ path: `${FOTOS}/previa-${nombre}.png`, fullPage: true });
    }
  });
});
