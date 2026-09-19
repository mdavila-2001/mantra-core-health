import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El estado vacío, mirado (19/09/2026).
 *
 * El propietario bajó el vacío de «Cotizaciones» con una frase: «se ve como un
 * texto tirau». Era literal — un título, un párrafo y la indicación de la
 * próxima acción como texto pelado en medio de un rectángulo blanco, sin ancla
 * visual ni jerarquía.
 *
 * Lo que sólo un navegador puede afirmar, y por eso está acá y no en el
 * `empty-state.spec.ts`:
 *
 * 1. **El medallón se pinta y se ve**: que el `<svg>` esté en el DOM no dice
 *    nada; lo que importa es que tenga tamaño, color de tono y forma de disco.
 * 2. **La indicación es una cápsula punteada**, no prosa: es la diferencia
 *    entre «esto es una instrucción» y «esto es otro renglón del párrafo».
 * 3. **El dibujo propio del consumidor apaga el de la casa** — esa regla vive
 *    sólo en CSS (`:not(:empty) ~`), así que sólo se comprueba computando
 *    estilos reales.
 * 4. **Los dos temas y los cinco anchos** dejan el vacío centrado y sin
 *    desborde.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'vacio-molecula');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const ANCHOS: readonly { readonly nombre: string; readonly ancho: number; readonly alto: number }[] =
  [
    { nombre: '390', ancho: 390, alto: 844 },
    { nombre: '768', ancho: 768, alto: 1024 },
    { nombre: '1440', ancho: 1440, alto: 900 },
  ];

async function quieta(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-iteration-count:1 !important;animation-duration:1ms !important;transition-duration:1ms !important}',
  });
}

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

/** Lo que el navegador calculó, que es lo único que la persona ve. */
function estilo(elemento: Locator, propiedad: string): Promise<string> {
  return elemento.evaluate(
    (nodo, prop) => getComputedStyle(nodo).getPropertyValue(prop),
    propiedad,
  );
}

test.describe('Vacío · la molécula', () => {
  test('el vacío de cotizaciones entra con medallón y con la indicación en cápsula', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, MEDICA);
    await irA(page, '/my-quotations');
    await estable(page);

    const vacio = page.locator('app-empty-state').first();
    await expect(vacio).toBeVisible();
    await expect(vacio).toContainText('Todavía no hay nada acá');

    /* ---- 1 · el medallón se pinta ---------------------------------------- */
    const medallon = vacio.locator('.empty-state__medal');
    await expect(medallon).toBeVisible();

    const caja = await medallon.boundingBox();
    expect(caja, 'el medallón tiene que ocupar lugar').not.toBeNull();
    expect(caja!.width, 'el medallón no puede ser un punto').toBeGreaterThanOrEqual(44);
    // disco: alto = ancho y radio de círculo
    expect(Math.abs(caja!.width - caja!.height)).toBeLessThanOrEqual(1);
    expect(await estilo(medallon, 'border-radius')).not.toBe('0px');

    const dibujo = medallon.locator('svg');
    await expect(dibujo).toBeVisible();
    const cajaDibujo = await dibujo.boundingBox();
    expect(cajaDibujo!.width, 'el dibujo tiene que verse dentro del disco').toBeGreaterThanOrEqual(
      20,
    );

    /* ---- 2 · la indicación NO es prosa ----------------------------------- */
    const indicacion = page.locator('.view-state-host__next-action').first();
    await expect(indicacion).toBeVisible();
    await expect(indicacion).toContainText('Escribí para buscar');
    expect(await estilo(indicacion, 'border-top-style'), 'la cápsula va punteada').toBe('dashed');
    // `inline-flex` declarado; el navegador lo devuelve como `flex` porque es
    // hijo de un contenedor flex —la fila de acciones—, que bloquifica.
    expect(await estilo(indicacion, 'display')).toBe('flex');

    // Y se distingue de la bajada: distinto tamaño de letra.
    const bajada = vacio.locator('.empty-state__description');
    expect(await estilo(indicacion, 'font-size')).not.toBe(await estilo(bajada, 'font-size'));

    /* ---- 3 · el título manda por tamaño ---------------------------------- */
    const titulo = vacio.locator('.empty-state__title');
    const tamTitulo = Number.parseFloat(await estilo(titulo, 'font-size'));
    const tamBajada = Number.parseFloat(await estilo(bajada, 'font-size'));
    expect(tamTitulo).toBeGreaterThan(tamBajada);

    /* ---- 4 · los anchos y los dos temas ---------------------------------- */
    for (const { nombre, ancho, alto } of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: alto });
      await estable(page);
      await quieta(page);

      // Con `expect.poll` y no con una lectura suelta: al cambiar el ancho el
      // cajón lateral pasa de fijo a superpuesto y hay un cuadro en el que la
      // página mide 400 px. Medirlo en ese instante inventa un desborde que
      // nadie ve. (`estable()` no alcanza: contra `ng serve` la red no queda
      // quieta — CLAUDE.md §5.)
      await expect
        .poll(() => desbordeHorizontal(page), {
          timeout: 10_000,
          message: `desborde horizontal a ${ancho} px`,
        })
        .toBeLessThanOrEqual(1);

      await page.screenshot({ path: join(SALIDA, `vacio-${nombre}.png`), fullPage: true });
    }

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);
    await quieta(page);
    await page.screenshot({ path: join(SALIDA, 'vacio-1440-oscuro.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('donde el consumidor pone su propio dibujo, el de la casa se apaga', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, MEDICA);
    await irA(page, '/design-system');
    await estable(page);

    /* La regla vive sólo en CSS (`.empty-state__slot:not(:empty) ~ .empty-state__glyph`),
       así que se pregunta por el estilo calculado y no por la visibilidad: la
       muestra del sistema de diseño está al pie de una página larguísima y
       «no visible» ahí abajo no distingue «apagado» de «fuera de la pantalla». */
    const medido = await page.evaluate(() => {
      const anfitriones = Array.from(document.querySelectorAll('app-empty-state'));
      const propio = anfitriones.find((nodo) => nodo.querySelector('.empty-state__slot svg'));
      const deLaCasa = anfitriones.find((nodo) => !nodo.querySelector('.empty-state__slot svg'));
      if (!propio || !deLaCasa) return null;

      const glifoPropio = propio.querySelector('.empty-state__glyph');
      const glifoCasa = deLaCasa.querySelector('.empty-state__glyph');
      const huecoCasa = deLaCasa.querySelector('.empty-state__slot');
      const dibujoPropio = propio.querySelector('.empty-state__slot svg');
      if (!glifoPropio || !glifoCasa || !huecoCasa || !dibujoPropio) return null;

      const caja = dibujoPropio.getBoundingClientRect();
      return {
        conDibujoPropio: getComputedStyle(glifoPropio).display,
        sinDibujoPropio: getComputedStyle(glifoCasa).display,
        huecoVacio: getComputedStyle(huecoCasa).display,
        anchoDelDibujoPropio: caja.width,
        medallonPropio: propio.querySelector('.empty-state__medal')?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(medido, 'la muestra tiene que traer un vacío con dibujo propio y otro sin él').not.toBeNull();
    expect(medido!.conDibujoPropio, 'el dibujo de la casa sobra si hay uno propio').toBe('none');
    expect(medido!.sinDibujoPropio, 'sin dibujo propio, el de la casa manda').not.toBe('none');
    expect(medido!.huecoVacio, 'el hueco sin proyección no deja aire').toBe('none');

    // Y el dibujo propio se VE dentro del disco: es lo que se rompía cuando el
    // SVG proyectado se quedaba sin tamaño —el medallón salía hueco—.
    expect(medido!.anchoDelDibujoPropio, 'el dibujo propio tiene que ocupar el disco').toBeGreaterThanOrEqual(20);
    expect(medido!.anchoDelDibujoPropio).toBeLessThan(medido!.medallonPropio);

    await quieta(page);
    await page
      .locator('app-empty-state')
      .filter({ has: page.locator('.empty-state__slot svg') })
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SALIDA, 'vacio-muestra-sistema.png'), fullPage: false });
  });
});
