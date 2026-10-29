import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

/**
 * Los paneles que se abren desde un control: **confirmar una elección cierra en
 * el acto, descartar anima** (#1351, #1432).
 *
 * ## Qué fija
 *
 * `app-select`, `app-tree-select`, `app-date-picker`, `app-dialog` y
 * `app-content-dialog` cierran con `cerrarConSalida` (`shared/motion/panel-motion.ts`):
 * una salida de 140 ms hacia el control que los abrió. Esa salida es el gesto
 * correcto al **descartar**, y un defecto al **confirmar**: mientras el panel
 * sale, el `<dialog>` sigue siendo modal, la página de atrás está inerte, el
 * tecleo hacia el campo que sigue se pierde y, al acabar la salida, el foco
 * vuelve al control de origen y le roba el que ya tenía otro campo.
 *
 * Los tests unitarios de cada componente fijan la regla con `animate` mockeado.
 * Este spec la mide en un Chromium real, con la animación de verdad:
 *
 * - **Confirmar**: el clic que confirma se dispara **dentro de la página** y, en
 *   el mismo turno síncrono en que vuelve, ya no queda ningún `dialog:modal`.
 *   Es determinista: no depende de cuánto tarde Playwright en ir y volver, que
 *   en una máquina cargada pasa de los 140 ms de la salida y taparía el defecto.
 * - **Descartar** (`Escape`): la página sigue inerte lo que dura la salida, no
 *   menos de {@link PISO_DE_LA_SALIDA_MS}, y el modal acaba cerrándose. El piso
 *   es fiable bajo carga (una animación no dura menos de lo que dura).
 *
 * ## Cómo se mide la inercia al descartar
 *
 * Un `<dialog>` abierto con `showModal()` es `:modal`. La sonda arma, justo
 * antes del gesto final, un reloj que arranca en el primer `keydown` (en
 * captura) y se detiene en el primer cuadro de animación sin ningún
 * `dialog:modal`. Mide el cuadro, no un `waitForTimeout`.
 *
 * ## `app-tree-select` no está acá
 *
 * Ninguna pantalla lo instancia hoy (el alta pasó al `location-picker`), así que
 * no hay forma de abrirlo en un navegador sin montarlo a mano. Su regla sigue
 * cubierta por su test unitario.
 *
 * ## Cómo se corre
 *
 * Contra el simulador (la maqueta contesta todo en el navegador, no hace falta
 * API), nunca con `networkidle` —con HMR no llega y da verdes falsos—:
 *
 *   corepack yarn start:demo
 *   E2E_BASE_URL=http://localhost:4200 corepack yarn pw playwright/dialogos-eleccion-inmediata.spec.ts
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

/** Lo que dura la salida del panel (`SALIDA_DEL_PANEL_MS`). */
const SALIDA_MS = 140;
/** Descartar anima: la página no puede liberarse antes de que acabe la salida. */
const PISO_DE_LA_SALIDA_MS = SALIDA_MS - 40;

interface Sonda {
  armar(): void;
  medir(): { inerteMs: number | null; abierto: boolean };
}
declare global {
  interface Window {
    __sonda?: Sonda;
  }
}

/** Un panel y los dos gestos que lo cierran. */
interface Caso {
  readonly nombre: string;
  readonly usuario?: string;
  readonly ruta: string;
  /** Deja la pantalla lista para abrir el panel. */
  readonly preparar?: (page: Page) => Promise<void>;
  /** Abre el panel y deja todo listo menos el gesto que lo cierra. */
  readonly abrir: (page: Page) => Promise<void>;
  /** Selector CSS del último gesto de una elección: lo que confirma y debe cerrar en el acto. */
  readonly confirmar: string;
}

/**
 * Inyecta la sonda: un campo ajeno al modal, siempre visible, y el reloj de
 * inercia. `armar()` se llama justo antes del gesto que se quiere medir.
 */
async function sembrarSonda(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('sonda')?.remove();
    const campo = document.createElement('input');
    campo.id = 'sonda';
    campo.setAttribute('aria-label', 'sonda');
    campo.style.cssText =
      'position:fixed;left:8px;bottom:8px;width:220px;height:36px;z-index:2147483647;background:#fff;color:#000;border:2px solid red';
    document.body.appendChild(campo);

    let armado = false;
    let t0: number | null = null;
    let cerrado: number | null = null;
    const marcar = (): void => {
      if (armado && t0 === null && document.querySelector('dialog:modal') !== null) {
        t0 = performance.now();
      }
    };
    window.addEventListener('click', marcar, true);
    window.addEventListener('keydown', marcar, true);
    const vigilar = (): void => {
      if (t0 !== null && cerrado === null && document.querySelector('dialog:modal') === null) {
        cerrado = performance.now();
      }
      requestAnimationFrame(vigilar);
    };
    requestAnimationFrame(vigilar);

    window.__sonda = {
      armar: () => {
        armado = true;
        t0 = null;
        cerrado = null;
      },
      medir: () => ({
        inerteMs: t0 !== null && cerrado !== null ? Math.round(cerrado - t0) : null,
        abierto: document.querySelector('dialog:modal') !== null,
      }),
    };
  });
}

async function armar(page: Page): Promise<void> {
  await page.evaluate(() => window.__sonda?.armar());
}

async function medir(page: Page): Promise<{ inerteMs: number | null; abierto: boolean }> {
  return page.evaluate(() => window.__sonda?.medir() ?? { inerteMs: null, abierto: true });
}

const CASOS: readonly Caso[] = [
  {
    nombre: 'select',
    ruta: '/design-system',
    abrir: async (page) => {
      await page.locator('app-select').first().locator('button').first().click();
      await expect(page.locator('dialog[open]').first()).toBeVisible();
    },
    confirmar: '[data-testid="select-opcion-1"]',
  },
  {
    nombre: 'date-picker',
    ruta: '/design-system',
    preparar: async (page) => {
      await page.locator('app-date-picker').first().scrollIntoViewIfNeeded();
    },
    abrir: async (page) => {
      await page
        .locator('app-date-picker')
        .first()
        .getByRole('button', { name: /Abrir calendario/ })
        .click();
      const calendario = page.locator('dialog.date-picker-dialog[open]');
      await expect(calendario).toBeVisible();
      await calendario.locator('.calendar-day-btn:not(.other-month):not([disabled])').nth(9).click();
    },
    confirmar: '[data-testid="date-picker-confirm"]',
  },
  {
    nombre: 'dialog',
    ruta: '/design-system',
    abrir: async (page) => {
      await page
        .getByRole('button', { name: /Guardar evoluci|Confirmar guardado|guardado/i })
        .first()
        .click();
      await expect(page.getByTestId('dialogo')).toBeVisible();
    },
    confirmar: '[data-testid="dialogo-confirmar"]',
  },
  {
    nombre: 'content-dialog',
    usuario: 'paciente',
    ruta: '/messaging',
    abrir: async (page) => {
      // Se abre la primera conversación y se reenvía uno de sus mensajes.
      const primera = page.locator('a[href^="/messaging/"]').first();
      await primera.click({ timeout: 30_000 });
      const opciones = page.getByRole('button', { name: 'Opciones del mensaje' }).first();
      await expect(opciones).toBeVisible({ timeout: 30_000 });
      await opciones.click();
      await page.getByTestId('hilo-reenviar').first().click();
      await expect(page.locator('dialog[open]').first()).toBeVisible();
      await expect(page.getByTestId('hilo-reenviar-destino').first()).toBeVisible();
    },
    confirmar: '[data-testid="hilo-reenviar-destino"]',
  },
];

test.describe('paneles de elección: confirmar cierra en el acto, descartar anima', () => {
  // El movimiento reducido cierra siempre en el acto: sin esto el descarte no
  // tendría salida que medir.
  test.use({
    contextOptions: { reducedMotion: 'no-preference' },
    viewport: { width: 1280, height: 900 },
  });

  for (const caso of CASOS) {
    test.describe(caso.nombre, () => {
      test.beforeEach(async ({ page }) => {
        if (caso.usuario !== undefined) await entrarAlSimulador(page, caso.usuario, BASE);
        await page.goto(`${BASE}${caso.ruta}`, { waitUntil: 'domcontentloaded' });
        await caso.preparar?.(page);
        await sembrarSonda(page);
        await caso.abrir(page);
      });

      test('confirmar libera la página en el mismo turno: ya no queda ningún modal', async ({
        page,
      }) => {
        // El clic se da dentro de la página y se mira sin soltar el turno: si el
        // panel anima su salida, el `<dialog>` sigue siendo `:modal` al volver.
        const modalesAlVolver = await page.evaluate((selector) => {
          const gesto = document.querySelector<HTMLElement>(selector);
          if (gesto === null) throw new Error(`No hay nada que confirmar en ${selector}`);
          gesto.click();
          return document.querySelectorAll('dialog:modal').length;
        }, caso.confirmar);

        expect(modalesAlVolver, 'modales abiertos justo después de confirmar').toBe(0);
        // Y la sonda —un campo ajeno al modal— es del primero que llega.
        const sonda = page.locator('#sonda');
        await sonda.click();
        await page.keyboard.type('abc');
        await expect(sonda).toHaveValue('abc');
        await expect(sonda).toBeFocused();
      });

      test('descartar con Escape anima la salida y recién después libera la página', async ({
        page,
      }) => {
        await armar(page);
        await page.keyboard.press('Escape');

        await expect.poll(async () => (await medir(page)).abierto, { timeout: 5_000 }).toBe(false);
        const { inerteMs } = await medir(page);
        expect(inerteMs, 'se midió la salida').not.toBeNull();
        expect(inerteMs ?? 0).toBeGreaterThanOrEqual(PISO_DE_LA_SALIDA_MS);
      });
    });
  }
});
