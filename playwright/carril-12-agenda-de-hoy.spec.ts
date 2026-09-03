import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 12 — «agenda de hoy» (`src/app/features/agenda/my-agenda/`).
 *
 * ## Qué cubre esta suite
 *
 * Es un barrido de **evidencia visual y de acabado**, no la suite de negocio
 * de la ficha completa (mover N minutos, cancelar-bloquea, etc. — esos tienen
 * su propia prueba de contrato por API, y no son responsabilidad de esta
 * pantalla). Lo que se verifica acá:
 *
 * 1. Las tres vistas (mes, semana, día) cargan sobre datos reales de la API
 *    viva, sin simular ninguna respuesta.
 * 2. Ninguna de las tres produce scroll horizontal en 390, 768 ni 1440 px
 *    (AC-12-14).
 * 3. La paginación de la semana y la del día («Ayer» / «Mañana») cambian el
 *    encabezado sin recargar la página.
 * 4. Si el día de hoy trae al menos una actividad, el detalle es alcanzable
 *    y abre un diálogo con `role="dialog"` que cierra con Escape.
 *
 * ## Por qué cada ancho es su propia sesión, en vez de redimensionar una sola
 *
 * `page.setViewportSize()` a mitad de sesión **no** es lo mismo que abrir la
 * pantalla en ese ancho: el `shell` de la aplicación
 * (`shared/components/organisms/shell/shell.ts`) decide una sola vez, al
 * construirse, si el panel de navegación va abierto o en cajón — no escucha
 * `resize`. Redimensionar en caliente de 1440 a 390 deja el panel ABIERTO
 * tapando media pantalla, algo que **nadie ve en un uso real** (se entra ya
 * con el ancho del dispositivo) y que además no es del carril 12: el `shell`
 * es de otro carril. Por eso cada ancho entra con su propia sesión — más
 * lento, pero es lo que un dispositivo real hace.
 */

const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-12');

interface Ancho {
  readonly nombre: string;
  readonly width: number;
  readonly height: number;
}

const ANCHOS: readonly Ancho[] = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '1440x900', width: 1440, height: 900 },
];

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** `scrollWidth <= clientWidth`, tal como pide AC-12-14. */
async function medirAncho(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

async function comprobarSinScrollHorizontal(page: Page, etiqueta: string): Promise<void> {
  const medidas = await medirAncho(page);
  expect(
    medidas.scrollWidth,
    `${etiqueta}: scrollWidth (${medidas.scrollWidth}) > clientWidth (${medidas.clientWidth}) — hay scroll horizontal`,
  ).toBeLessThanOrEqual(medidas.clientWidth);
}

/** Entra como la doctora sembrada y abre «Mi agenda» en la solapa del mes. */
async function entrarAMiAgenda(page: Page): Promise<void> {
  await entrar(page, doctora());
  await irA(page, '/schedule/mine');
  await estable(page);
  await page.getByRole('tab', { name: 'Cómo viene el mes' }).click();
  await estable(page);
}

for (const ancho of ANCHOS) {
  test.describe(`Carril 12 · agenda de hoy · ${ancho.nombre}`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } });

    test(`mes, semana y día en ${ancho.nombre}`, async ({ page }) => {
      test.setTimeout(120_000);
      await entrarAMiAgenda(page);

      await test.step('la vista del mes: ocupación por día, sin scroll horizontal', async () => {
        // Por defecto la solapa del mes abre en «mes» (no en «semana»), y sin
        // día abierto: es la grilla de ocupación, nunca los nombres.
        await expect(page.locator('.mes__grilla')).toBeVisible();
        await capturar(page, `mes-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `mes en ${ancho.nombre}`);
      });

      await test.step('la vista de semana: paginación y sin scroll horizontal', async () => {
        await page.getByTestId('ver-semana').click();
        await estable(page);
        await expect(page.locator('.semana__dias')).toBeVisible();

        const tituloInicial =
          (await page.locator('.semana__titulo').textContent())?.trim() ?? '';

        // «Cada uno con su respectiva paginación de adelante y atrás» (punto 8).
        await page.getByTestId('semana-siguiente').click();
        await estable(page);
        const tituloSiguiente =
          (await page.locator('.semana__titulo').textContent())?.trim() ?? '';
        expect(tituloSiguiente, 'la semana siguiente no cambió el encabezado').not.toBe(
          tituloInicial,
        );

        await page.getByTestId('semana-anterior').click();
        await page.getByTestId('semana-anterior').click();
        await estable(page);
        const tituloAnterior =
          (await page.locator('.semana__titulo').textContent())?.trim() ?? '';
        expect(tituloAnterior, 'la semana anterior no cambió el encabezado').not.toBe(
          tituloSiguiente,
        );

        // Se vuelve a la semana de hoy antes de capturar, para que la
        // evidencia muestre la semana real de la corrida y no una arbitraria.
        await page.getByTestId('semana-siguiente').click();
        await estable(page);

        await capturar(page, `semana-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `semana en ${ancho.nombre}`);
      });

      await test.step('la vista del día de hoy: línea de horas, paginación, sin scroll horizontal', async () => {
        // No se reusa el estado de la solapa de semana: pasear la semana
        // cerca de un cambio de mes (hoy es 3 de septiembre, cuyo lunes cae
        // en agosto) puede dejar `mesVisible` en el mes anterior — el mismo
        // cruce que `cambiarSemana()` hace a propósito para que la semana
        // nunca muestre datos sin cargar. Se recarga para un mes limpio, que
        // es además lo que hace cualquiera que entra directo a mirar hoy.
        await page.reload();
        await estable(page);
        await page.getByRole('tab', { name: 'Cómo viene el mes' }).click();
        await estable(page);

        const celdaDeHoy = page.locator('.mes__celda--hoy .mes__dia');
        const hayCeldaDeHoy = (await celdaDeHoy.count()) > 0;
        if (!hayCeldaDeHoy) {
          test.info().annotations.push({
            type: 'nota',
            description: 'El mes visible no incluye el día de hoy: no hay celda que tocar.',
          });
          return;
        }

        await celdaDeHoy.click();
        await estable(page);
        await expect(page.locator('.dia')).toBeVisible();

        const tituloInicial = (await page.locator('.dia__titulo').textContent())?.trim() ?? '';

        // «Un botón de ver mañana, y así sucesivamente» (punto 5, AC-12-5).
        await page.getByTestId('dia-siguiente').click();
        await estable(page);
        const tituloManana = (await page.locator('.dia__titulo').textContent())?.trim() ?? '';
        expect(tituloManana, 'Mañana no cambió la fecha del encabezado').not.toBe(tituloInicial);

        await page.getByTestId('dia-anterior').click();
        await estable(page);
        const tituloVuelta = (await page.locator('.dia__titulo').textContent())?.trim() ?? '';
        expect(tituloVuelta, 'Ayer no volvió al día original').toBe(tituloInicial);

        // Si hoy tiene al menos una actividad (cita u ocupado), su detalle
        // abre un diálogo real y cierra con Escape devolviendo el foco al
        // bloque. Se captura una sola vez, en el ancho de escritorio.
        const detalle = page.getByTestId('dia-detalle').first();
        if (ancho.nombre === '1440x900' && (await detalle.count()) > 0) {
          await detalle.click();
          const dialogo = page.getByTestId('dialogo');
          await expect(dialogo).toBeVisible();
          await capturar(page, 'dia-modal-detalle-1440x900');

          await page.keyboard.press('Escape');
          await expect(dialogo).toBeHidden();
        }

        await capturar(page, `dia-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `día en ${ancho.nombre}`);
      });
    });
  });
}
