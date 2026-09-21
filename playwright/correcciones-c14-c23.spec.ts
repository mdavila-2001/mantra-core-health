import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * **C-14 · la cuadrícula de notas** y **C-23 · la hoja de internación**.
 *
 * Lo que sólo un navegador puede afirmar, y que es el kill-test de cada una:
 *
 * 1. La fila cargada **sigue ahí después de recargar** — o sea que la guardó el
 *    servidor y no la pintamos nosotros.
 * 2. Con la fila de hoy ya registrada, **no se puede registrar otra**, y el
 *    sistema dice **por qué**.
 * 3. La hoja de internación **dejó de tener un solo campo**, y una fecha de
 *    inicio en el futuro no se puede dar de alta.
 *
 * Datos: cuenta sintética declarada (`medica@alovida.mock`) sobre la maqueta,
 * que no habla con ninguna base real. **Ninguna captura de acá lleva datos de
 * una persona real.**
 */

const SALIDA = join('docs', 'trabajo', '2026-09-20-notas-cuadricula-e-internacion', 'evidencia');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** Abre la consulta de la primera persona del archivo y deja el encuentro abierto. */
async function abrirConsultaConEncuentro(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await irA(page, '/medical-records');
  await estable(page);

  // El campo se llama «Nombre o código» y **filtra mientras se escribe**: no hay
  // Enter que mandar. (El spec viejo `consulta-rejilla.spec.ts` todavía busca
  // «Buscar por nombre o código», que es el rótulo anterior.)
  const buscador = page.getByRole('textbox', { name: 'Nombre o código' });
  await buscador.fill('Ana');
  const verExpediente = page.getByRole('link', { name: /Ver expediente|expediente/i }).first();
  await expect(verExpediente).toBeVisible({ timeout: 30_000 });
  await verExpediente.click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await estable(page);

  await page.goto(`${page.url()}/consultation`, { waitUntil: 'commit' });
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
  await estable(page);

  const abrir = page.getByTestId('consulta-abrir-encuentro');
  if ((await abrir.count()) > 0) {
    await abrir.click();
  }
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
}

async function abrirCasilla(page: Page, clave: string): Promise<void> {
  await page.getByTestId(`consulta-casilla-${clave}`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await estable(page);
}

/**
 * Abre la casilla de notas y cambia a la vista de cuadrícula.
 *
 * Son **dos vistas** y no una debajo de la otra: apiladas, el editor ocupaba el
 * alto del modal y la cuadrícula quedaba bajo el pliegue —existía en el DOM y
 * nadie la veía—. Lo destapó mirar la captura, no el test.
 */
async function abrirLaCuadricula(page: Page): Promise<void> {
  await abrirCasilla(page, 'notas');
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('tab', { name: 'Escribir' })).toBeVisible({ timeout: 30_000 });
  await modal.getByRole('tab', { name: 'Cuadrícula' }).click();
  await estable(page);
}

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

test.describe('C-14 · la cuadrícula de la consulta', () => {
  test('la fila se registra, sobrevive a recargar, y la segunda se rechaza con su motivo', async ({
    page,
  }) => {
    test.setTimeout(6 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await abrirConsultaConEncuentro(page);
    await abrirLaCuadricula(page);

    /* ---- 1 · la cuadrícula existe dentro del modal de notas -------------- */

    const modal = page.getByRole('dialog');
    await expect(modal.getByRole('heading', { name: 'Cuadrícula de la consulta' })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: join(SALIDA, 'c14-1-cuadricula-al-abrir.png') });

    /* ---- 2 · la cabecera se ELIGE, no se teclea -------------------------- */

    const selector = modal.getByTestId('cuadricula-columna').locator('select');
    await expect(selector).toBeVisible();
    // Un desplegable: no hay forma de teclear un nombre arbitrario.
    await expect(modal.getByTestId('cuadricula-columna').locator('input')).toHaveCount(0);

    const opciones = (await selector.locator('option').allTextContents()).map((t) => t.trim());
    console.log('OPCIONES DE CABECERA OFRECIDAS:', JSON.stringify(opciones));

    // El catálogo tiene que ser el de mediciones, no el de estados de registro.
    expect(opciones).toContain('Peso');
    expect(opciones).not.toContain('Pendiente');

    // `app-select` pone el **índice** en el `value` de cada `<option>` y traduce
    // índice → valor al cambiar. Elegir por `value` seleccionaría el marcador
    // vacío; se elige por su posición real.
    const indiceDePeso = opciones.indexOf('Peso');
    expect(indiceDePeso).toBeGreaterThan(0);
    await selector.selectOption({ index: indiceDePeso });
    await modal.getByTestId('cuadricula-agregar-columna').click();
    await expect(modal.getByTestId('cuadricula-tabla')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, 'c14-2-columna-agregada.png') });

    /* ---- 3 · se carga la fila y se guarda --------------------------------
         Se llena **la celda de la columna recién agregada**, no «la primera»:
         esta paciente ya tenía mediciones, así que la cuadrícula abre con
         columnas y la primera no es la que acabo de elegir. */

    const cabeceras = await modal.getByTestId('cuadricula-tabla').locator('thead th').allTextContents();
    const columnaDePeso = cabeceras.findIndex((t) => t.trim() === 'Peso');
    expect(columnaDePeso, 'la columna agregada tiene que estar en la cabecera').toBeGreaterThan(0);

    const celda = modal
      .getByTestId('cuadricula-fila-nueva')
      .locator('td')
      // La primera columna es el `<th scope="row">` de la sesión y no cuenta.
      .nth(columnaDePeso - 1)
      .locator('input');
    await celda.fill('72.5');
    await modal.getByTestId('cuadricula-guardar').click();

    // La fila de hoy pasa a existir: aparece el aviso de la restricción.
    await expect(modal.getByTestId('cuadricula-una-por-sesion')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(SALIDA, 'c14-3-fila-guardada-y-restriccion.png') });

    /* ---- 4 · KILL-TEST: recargar y volver a abrir ------------------------ */

    const url = page.url();
    await page.reload({ waitUntil: 'commit' });
    await page.waitForURL(url, { timeout: 60_000 });
    await estable(page);
    await abrirLaCuadricula(page);

    const recargado = page.getByRole('dialog');
    await expect(recargado.getByTestId('cuadricula-tabla')).toBeVisible({ timeout: 30_000 });
    // La fila de hoy está, y la trajo el servidor.
    await expect(recargado.getByTestId('cuadricula-fila-hoy')).toHaveCount(1);
    await expect(recargado.getByTestId('cuadricula-fila-hoy')).toContainText('72.5');
    await page.screenshot({ path: join(SALIDA, 'c14-4-tras-recargar.png') });

    /* ---- 5 · una sola fila por sesión, y explicada ----------------------- */

    const aviso = recargado.getByTestId('cuadricula-una-por-sesion');
    await expect(aviso).toBeVisible();
    // Dice la regla Y su motivo. Un «no se puede» pelado obliga a adivinar.
    await expect(aviso).toContainText('una sola fila por sesión');
    await expect(aviso).toContainText('qué registro corresponde a cada consulta');
    // Y el camino para cargar otra no existe: no está sólo deshabilitado.
    await expect(recargado.getByTestId('cuadricula-fila-nueva')).toHaveCount(0);
    await expect(recargado.getByTestId('cuadricula-guardar')).toHaveCount(0);

    // El aviso se anuncia: `app-alert` le pone rol de estado a lo que no es error.
    await expect(aviso).toHaveAttribute('role', /status|alert/);

    /* ---- 6 · angosto: la tabla se desplaza, la página no ----------------- */

    await page.setViewportSize({ width: 390, height: 844 });
    await estable(page);
    await expect(recargado.getByTestId('cuadricula-tabla')).toBeVisible();
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: join(SALIDA, 'c14-5-movil-390.png') });
  });
});

test.describe('C-23 · la hoja de internación', () => {
  /**
   * El nombre dice lo que la prueba demuestra, **y nada más**.
   *
   * El formulario **sigue teniendo un solo campo de entrada**, y eso no es un
   * descuido: `POST /clinical/care-episodes` no acepta ningún otro dato que se
   * pueda ofrecer hoy. Lo que sí cambió es lo que la pantalla **dice** y lo que
   * **muestra de vuelta**. El resto está en `matriz-internacion.md`.
   */
  test('sigue teniendo un campo porque el contrato da uno, y muestra lo que el servidor devuelve', async ({
    page,
  }) => {
    test.setTimeout(6 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await abrirConsultaConEncuentro(page);
    await abrirCasilla(page, 'internacion');

    const modal = page.getByRole('dialog');
    await page.screenshot({ path: join(SALIDA, 'c23-1-internacion-al-abrir.png') });

    const textoDelModal = (await modal.textContent()) ?? '';
    console.log('TEXTO DEL MODAL DE INTERNACIÓN:', textoDelModal.replace(/\s+/g, ' ').slice(0, 900));

    /* ---- 1 · el estado honesto: un solo campo de entrada ----------------- */

    const campos = modal.locator('form input:not([type="hidden"]), form select, form textarea');
    const cuantos = await campos.count();
    console.log('CAMPOS DE ENTRADA DEL FORMULARIO DE INTERNACIÓN:', cuantos);
    expect(cuantos, 'el contrato sólo permite ofrecer el inicio').toBe(1);

    // Y la ayuda ya no miente por omisión: dice que la fecha puede ser pasada y
    // que se registran las dos cosas.
    await expect(modal).toContainText('Puede ser pasada');

    /* ---- 2 · el calendario abre en el mes de hoy -------------------------
         Suena a detalle y no lo es: `app-date-picker` abre en **enero de 2000**
         cuando el campo declara `maxDate`, porque interpreta «cerrado al
         pasado» como «fecha de nacimiento». Por eso este campo no lo declara, y
         por eso esto se comprueba. El freno ante una fecha futura vive en el
         formulario y lo ejercita `admission-block.spec.ts`. */

    await modal.getByRole('button', { name: /Abrir calendario/ }).click();
    await estable(page);

    const hoy = new Date();
    const mesEnPalabras = hoy.toLocaleDateString('es-BO', { month: 'long' });
    const calendario = page.getByRole('dialog', { name: /Seleccionar fecha/ });
    await expect(calendario).toBeVisible({ timeout: 15_000 });
    await expect(
      calendario,
      'el calendario tiene que abrir cerca de hoy, no a veintiséis años',
    ).toContainText(new RegExp(`${mesEnPalabras}|${hoy.getFullYear()}`, 'i'));
    await page.screenshot({ path: join(SALIDA, 'c23-2-calendario-abre-en-hoy.png') });

    await page.keyboard.press('Escape');
    await estable(page);

    /* ---- 3 · el alta muestra lo que el servidor manda de vuelta ---------- */

    const alta = modal.getByRole('button', { name: 'Dar de alta la internación' });
    await expect(alta).not.toHaveAttribute('aria-disabled', 'true');
    await alta.click();

    // Dar de alta pide confirmación: desde la interfaz no se deshace.
    const confirmacion = page.getByRole('dialog').filter({ hasText: '¿Dar de alta la internación?' });
    await expect(confirmacion).toBeVisible({ timeout: 15_000 });
    await confirmacion.getByRole('button', { name: 'Dar de alta' }).click();

    /* ---- 4 · relectura: la internación trae responsable y estado --------- */

    await expect(page.getByTestId('internacion-lista')).toBeVisible({ timeout: 30_000 });
    const lista = page.getByTestId('internacion-lista');
    await expect(lista).toContainText(/A tu cargo|A cargo de otro profesional|Sin responsable/);
    console.log('LISTA DE INTERNACIONES:', ((await lista.textContent()) ?? '').replace(/\s+/g, ' '));
    await page.screenshot({ path: join(SALIDA, 'c23-3-lista-con-responsable.png') });
  });
});

test.describe('Capturas por ancho y por tema', () => {
  for (const tema of ['light', 'dark'] as const) {
    for (const ancho of [
      { nombre: 'movil', width: 390, height: 844 },
      { nombre: 'tablet', width: 820, height: 1180 },
      { nombre: 'escritorio', width: 1440, height: 900 },
    ]) {
      // Cada ancho en su propia ventana desde el arranque: redimensionar en
      // caliente deja la captura en mitad de la transición del menú lateral.
      test(`cuadrícula · ${tema} · ${ancho.nombre}`, async ({ browser }) => {
        test.setTimeout(5 * 60_000);
        mkdirSync(SALIDA, { recursive: true });

        const contexto = await browser.newContext({
          viewport: { width: ancho.width, height: ancho.height },
          colorScheme: tema,
          locale: 'es-BO',
          timezoneId: 'America/La_Paz',
        });
        const page = await contexto.newPage();

        await abrirConsultaConEncuentro(page);
        await abrirLaCuadricula(page);
        await expect(
          page.getByRole('dialog').getByRole('heading', { name: 'Cuadrícula de la consulta' }),
        ).toBeVisible({ timeout: 30_000 });
        // Esperar a que **termine de cargar**: sin esto la captura sale con el
        // «Buscando lo registrado…» y no muestra la cuadrícula, que es lo que
        // se quiere mirar. Lo destapó revisar las capturas, no el test.
        await expect(page.getByTestId('cuadricula-cargando')).toHaveCount(0, { timeout: 30_000 });
        await estable(page);

        expect(await desbordeHorizontal(page)).toBe(0);
        await page.screenshot({
          path: join(SALIDA, `c14-vista-${tema}-${ancho.nombre}.png`),
        });

        await contexto.close();
      });
    }
  }
});
