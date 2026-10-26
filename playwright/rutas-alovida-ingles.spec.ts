/* ============================================================================
    Las direcciones de las pantallas portadas desde la bóveda, en un navegador
    de verdad (TAREA-29).

    Las 126 direcciones en castellano de `features/alovida/` pasaron a inglés y
    las viejas se redirigen (`legacyRedirects()` en `design-mockup-gate.ts`).
    Los specs de Vitest fijan la tabla y el árbol de rutas; esto fija lo que
    sólo un navegador ve: que la URL vieja **termina** en la nueva con su query y
    su `#ancla`, que la pantalla monta SU marco (el de sesión con el módulo
    desplegado, el público, o el lienzo de la portada) y que la medición del
    área de contenido no cambia por entrar por la dirección vieja.

    Corre contra el build de maquetas (`ng serve --configuration
    development,demo`): con la API real (`designMockups: false`) estas
    pantallas no existen y las viejas redirigen a la pantalla real, que se
    comprueba en `src/app/app.routes.design-mockups.spec.ts`. No necesita sesión
    ni API: las rutas portadas no pasan por `authGuard`.
    ========================================================================== */

import { test, expect, type Page } from '@playwright/test';

import { ALOVIDA_LEGACY_PATHS } from '../src/app/features/alovida/alovida-legacy-paths';

type Marco = 'sesion' | 'publico' | 'lienzo';

interface Entrada {
  readonly vieja: string;
  readonly marco: Marco;
  /** Sólo con marco de sesión: el segmento del módulo que el nav marca activo. */
  readonly modulo?: string;
}

/**
 * Una pantalla de cada módulo, más las raíces y la portada. La dirección nueva
 * sale de la tabla generada (`ALOVIDA_LEGACY_PATHS`), no se repite acá: lo que
 * se prueba es que cada vieja llegue a donde la tabla dice y que ahí monte.
 */
const ENTRADAS: readonly Entrada[] = [
  { vieja: '/inicio', marco: 'lienzo' },
  { vieja: '/datos-compartidos/archivos-listado', marco: 'sesion', modulo: 'Datos compartidos' },
  { vieja: '/terminologia/sistemas-de-codigos-listado', marco: 'sesion', modulo: 'Terminología' },
  {
    vieja: '/directorio/organizaciones-hijas-formulario',
    marco: 'sesion',
    modulo: 'Organizaciones',
  },
  { vieja: '/personas/profesionales-listado', marco: 'sesion', modulo: 'Personas' },
  {
    vieja: '/accesos/relaciones-de-cuidado-listado',
    marco: 'sesion',
    modulo: 'Identidad y accesos',
  },
  { vieja: '/buscar/seguidos-y-guardados-listado', marco: 'publico' },
  { vieja: '/buscar/calificar-la-atencion-formulario', marco: 'publico' },
  // Las raíces de módulo viejas caen en la raíz nueva, que redirige a la primera pantalla.
  { vieja: '/accesos', marco: 'sesion', modulo: 'Identidad y accesos' },
  { vieja: '/terminologia', marco: 'sesion', modulo: 'Terminología' },
];

const PARES: readonly (Entrada & { nueva: string })[] = ENTRADAS.map((e) => ({
  ...e,
  nueva: `/${ALOVIDA_LEGACY_PATHS[e.vieja.slice(1)]}`,
}));

const SELECTOR_MARCO: Readonly<Record<Marco, string>> = {
  sesion: '.app-shell .app-side-nav',
  publico: '.app-public-shell',
  lienzo: '.landing, .landing-lienzo, .landing-hero',
};

/**
 * `networkidle` no llega nunca contra `ng serve` —el canal de recarga en
 * caliente queda abierto—. Se espera al marco, que es lo que indica que la
 * pantalla se pintó.
 */
async function abrir(page: Page, url: string, marco: Marco): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator(SELECTOR_MARCO[marco]).first().waitFor({ state: 'attached', timeout: 30_000 });
}

/** La medición del área de contenido: ancho del documento y holguras del bloque. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const inner = document.querySelector('.app-main__inner');
    const bloque = inner?.firstElementChild ?? null;
    const caja = inner?.getBoundingClientRect();
    const hijo = bloque?.getBoundingClientRect();
    return {
      desborde: doc.scrollWidth - window.innerWidth,
      area: caja ? Math.round(caja.width) : null,
      bloque: hijo ? Math.round(hijo.width) : null,
      holguraIzq: caja && hijo ? Math.round(hijo.left - caja.left) : null,
      holguraDer: caja && hijo ? Math.round(caja.right - hijo.right) : null,
    };
  });
}

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /NG0\d+|Cannot match any routes/.test(m.text())) {
      errores.push(m.text());
    }
  });
  return errores;
}

test.describe('direcciones en inglés de las pantallas portadas', () => {
  for (const par of PARES) {
    test(`${par.vieja} redirige a ${par.nueva} y monta su marco`, async ({ page }) => {
      const errores = vigilarErrores(page);

      await abrir(page, par.vieja, par.marco);

      await expect(page).toHaveURL(new RegExp(`${par.nueva}(/[a-z-]+)?$`));
      await expect(page.locator(SELECTOR_MARCO[par.marco]).first()).toBeVisible();
      if (par.marco === 'sesion') {
        // El nav compara el primer segmento de la URL con el módulo: si el
        // marco siguiera esperando el segmento en castellano, ningún módulo
        // quedaría marcado.
        await expect(page.locator('.app-side-nav__item[aria-current="true"]')).toContainText(
          par.modulo ?? '',
        );
        await expect(page.locator('.app-side-nav__sub .app-side-nav__item').first()).toBeVisible();
      }
      expect(errores).toEqual([]);
    });

    test(`${par.nueva} abre directo, igual que su dirección vieja`, async ({ page }) => {
      await abrir(page, par.nueva, par.marco);
      await expect(page).toHaveURL(new RegExp(`${par.nueva}(/[a-z-]+)?$`));
      const directo = await medir(page);
      const destino = new URL(page.url()).pathname;

      await abrir(page, par.vieja, par.marco);
      expect(new URL(page.url()).pathname).toBe(destino);
      const porLaVieja = await medir(page);

      // Es la misma pantalla: la dirección con la que se entra no cambia la medida.
      expect(porLaVieja).toEqual(directo);
    });
  }

  test('la redirección conserva el query y el #ancla', async ({ page }) => {
    await page.goto('/directorio/organizaciones-hijas-formulario?estado=paso2&q=clinica#cierre', {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('.app-view-state-host [data-estado="paso2"]').waitFor({ state: 'visible' });

    const url = new URL(page.url());
    expect(url.pathname).toBe(
      `/${ALOVIDA_LEGACY_PATHS['directorio/organizaciones-hijas-formulario']}`,
    );
    expect(url.searchParams.get('estado')).toBe('paso2');
    expect(url.searchParams.get('q')).toBe('clinica');
    expect(url.hash).toBe('#cierre');
  });

  test('una dirección que nunca existió sigue dando 404', async ({ page }) => {
    await page.goto('/accesos/no-existe', { waitUntil: 'domcontentloaded' });
    await page.locator('app-not-found, h1').first().waitFor({ state: 'visible', timeout: 30_000 });

    expect(new URL(page.url()).pathname).toBe('/accesos/no-existe');
    await expect(page.locator('.app-side-nav')).toHaveCount(0);
  });

  for (const ancho of [1440, 375]) {
    test(`a ${ancho} px las pantallas portadas no desbordan el documento`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      const pantallas = PARES.filter((p) => p.marco === 'sesion' && p.vieja.split('/').length > 2);
      for (const par of pantallas.slice(0, 3)) {
        await abrir(page, par.nueva, par.marco);
        const { desborde } = await medir(page);
        expect(desborde, `${par.nueva} a ${ancho} px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
