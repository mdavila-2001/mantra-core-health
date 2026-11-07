import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Red clínica del expediente — el «Recorrido» y su panel lateral
 * (ADR-0021, ADR-0022), contra el backend simulado (`yarn start:demo`).
 *
 * Lo que sólo un navegador puede afirmar:
 *
 * 1. El cambio de vista Tabla ↔ Recorrido: la red aparece y se va, y la tabla
 *    vuelve (no es una ruta: un error de plantilla se vería como pantalla vacía).
 * 2. Un episodio plegado con todo fuera de la vista lo dice («← N antes») y el
 *    aviso lleva a sus marcas.
 * 3. El panel se abre con clic y con teclado (Enter sobre el nodo), se cierra
 *    con el botón y con `Escape`, y el foco vuelve al nodo.
 * 4. Un vínculo deducido se marca con la palabra «inferido» en el lienzo y en
 *    el panel, no sólo con una línea punteada.
 * 5. Si la lectura del informe falla (fallo provocado con `mock:fallos`, ver
 *    `src/app/core/mock/simulated-failures.ts`), el panel dice qué pasó, da el
 *    código de soporte y «Reintentar» trae los valores.
 * 5b. If the server rejects the read (S4, `modo: 'validation'`), the notice has
 *    its own text (not the simulator's 422 message), no blind «Reintentar»,
 *    and «Volver a la red» closes the panel and returns the focus to the node.
 * 6. At 768 and 1440 px, with and without the side panel, every episode name
 *    reads whole (the text's own box fits its span: no ellipsis).
 */

const MEDICA: Actor = { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' };

/** The simulator's deterministic id (`core/mock/mock-store.ts` → `uuid`). */
function uuidDelSimulador(semilla: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < semilla.length; i++) {
    const c = semilla.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  const crudo = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${crudo.slice(0, 8)}-${crudo.slice(8, 12)}-4${crudo.slice(13, 16)}-a${crudo.slice(17, 20)}-${crudo.slice(20, 32)}`;
}

const EXPEDIENTE = `/medical-records/${uuidDelSimulador('pid-paciente')}`;

async function abrirRecorrido(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await irA(page, EXPEDIENTE);
  await estable(page);
  await page.getByTestId('expediente-vista').getByRole('radio', { name: 'Recorrido' }).click();
  await expect(page.getByTestId('expediente-recorrido')).toBeVisible({ timeout: 60_000 });
}

function episodio(page: Page, nombre: string) {
  return page.getByTestId('red-episodio').filter({ hasText: nombre }).first();
}

/** Expands the hypothyroidism episode and returns its TSH study node. */
async function nodoTsh(page: Page) {
  const hipotiroidismo = episodio(page, 'Hipotiroidismo');
  if ((await hipotiroidismo.getAttribute('aria-expanded')) !== 'true') await hipotiroidismo.click();
  const tsh = page.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await expect(tsh).toBeVisible();
  return tsh;
}

/**
 * Episode names whose text does not fit their span. The text's own laid-out
 * box (a `Range`) is compared with the span's: `scrollWidth` rounds to whole
 * pixels and let a sub-pixel cut (an ellipsis eating two letters) pass.
 */
function nombresCortados(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.red__episodio-nombre')]
      .filter((nombre) => {
        const caja = nombre.getBoundingClientRect();
        const rango = document.createRange();
        rango.selectNodeContents(nombre);
        const texto = rango.getBoundingClientRect();
        return texto.width > caja.width || texto.height > caja.height;
      })
      .map((nombre) => nombre.textContent?.trim() ?? ''),
  );
}

test.describe('Red clínica · recorrido y panel lateral', () => {
  test.beforeEach(() => test.setTimeout(5 * 60_000));

  test('Tabla ↔ Recorrido: la red aparece, la tabla vuelve', async ({ page }) => {
    await abrirRecorrido(page);
    const vista = page.getByTestId('expediente-vista');
    await expect(vista.getByRole('radio', { name: 'Recorrido' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('red-episodio').first()).toBeVisible();

    await vista.getByRole('radio', { name: 'Tabla' }).click();
    await expect(page.getByTestId('expediente-recorrido')).toHaveCount(0);
    await expect(page.getByTestId('expediente-tabla-unificada')).toBeVisible();

    await vista.getByRole('radio', { name: 'Recorrido' }).click();
    await expect(page.getByTestId('expediente-recorrido')).toBeVisible();
  });

  test('un episodio con todo fuera de la vista lo avisa y el aviso lleva a sus marcas', async ({ page }) => {
    await abrirRecorrido(page);
    const hilo = page.getByTestId('red-hilo').filter({ has: episodio(page, 'Hipotiroidismo') });
    const aviso = hilo.getByTestId('red-fuera').filter({ hasText: 'antes' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute('aria-label', /^Ver \d+ marcas de Hipotiroidismo anteriores a lo visible$/);
    await aviso.click();
    await expect(hilo.getByTestId('red-fuera').filter({ hasText: 'antes' })).toHaveCount(0);
    await expect(hilo.getByTestId('red-hito').first()).toBeInViewport();
  });

  test('el panel se abre con clic y con teclado, se cierra y devuelve el foco', async ({ page }) => {
    await abrirRecorrido(page);
    const tsh = await nodoTsh(page);

    await tsh.click();
    const panel = page.getByTestId('red-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('TSH por quimioluminiscencia');
    await expect(tsh).toHaveAttribute('aria-current', 'true');
    await panel.getByTestId('red-panel-cerrar').click();
    await expect(panel).toHaveCount(0);

    await tsh.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('red-panel-valor').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(tsh).toBeFocused();
  });

  test('un vínculo deducido dice «inferido» en el lienzo y en el panel', async ({ page }) => {
    await abrirRecorrido(page);
    await nodoTsh(page);
    await expect(page.getByTestId('red-inferido').first()).toHaveText('inferido');
    await expect(page.getByTestId('red-leyenda')).toContainText('Inferido');

    const consulta = page.locator('[data-testid="recorrido-nodo"]').filter({ hasText: 'Primera consulta' }).first();
    await consulta.click();
    const vinculos = page.getByTestId('red-panel').getByTestId('red-panel-vinculos');
    await expect(vinculos.getByText('inferido', { exact: true }).first()).toBeVisible();
  });

  test('si la lectura del informe falla, el panel lo dice con su código y «Reintentar» trae los valores', async ({ page }) => {
    await abrirRecorrido(page);
    const tsh = await nodoTsh(page);
    await page.evaluate(() =>
      sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/reports/', modo: 'error', metodos: ['GET'] }])),
    );

    await tsh.click();
    const panel = page.getByTestId('red-panel');
    const error = panel.getByTestId('red-panel-informe-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('No se pudieron leer los valores del informe');
    await expect(error).toContainText('Código de soporte');
    // «Resultado liberado» belongs to a successful read: under an error it would contradict it.
    await expect(panel.getByTestId('red-panel-liberado')).toHaveCount(0);

    await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
    await error.getByRole('button', { name: 'Reintentar' }).click();
    await expect(panel.getByTestId('red-panel-informe-error')).toHaveCount(0);
    await expect(panel.getByTestId('red-panel-valor')).toHaveCount(2);
    await expect(panel.getByTestId('red-panel-liberado')).toBeVisible();
  });

  test('si el servidor rechaza la lectura (S4), el panel lo dice con texto propio, sin «Reintentar» a ciegas', async ({ page }) => {
    await abrirRecorrido(page);
    const tsh = await nodoTsh(page);
    // The simulator's 422 speaks of a prescription field: that text must not reach the report's notice.
    await page.evaluate(() =>
      sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/reports/', modo: 'validation', metodos: ['GET'] }])),
    );

    await tsh.click();
    const panel = page.getByTestId('red-panel');
    const error = panel.getByTestId('red-panel-informe-error');
    await expect(error).toContainText('El servidor rechazó la lectura de este informe');
    await expect(error).not.toContainText('Elija un medicamento');
    await expect(error).toContainText('Código de soporte');
    await expect(error.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    await expect(panel.getByTestId('red-panel-liberado')).toHaveCount(0);

    await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
    await error.getByRole('button', { name: 'Volver a la red' }).click();
    await expect(panel).toHaveCount(0);
    await expect(tsh).toBeFocused();
  });

  for (const [ancho, alto] of [
    [768, 1024],
    [1440, 900],
  ] as const) {
    test(`a ${ancho} px, con el panel abierto, ningún nombre de episodio se corta`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await abrirRecorrido(page);
      await expect(page.getByTestId('red-episodio').first()).toBeVisible();
      expect(await nombresCortados(page)).toEqual([]);

      await (await nodoTsh(page)).click();
      await expect(page.getByTestId('red-panel')).toBeVisible();
      await expect(page.getByTestId('red-panel-valor').first()).toBeVisible();
      expect(await nombresCortados(page)).toEqual([]);
    });
  }
});
