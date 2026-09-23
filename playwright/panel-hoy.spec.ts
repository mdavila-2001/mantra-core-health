import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El panel abre con la jornada (19/09/2026).
 *
 * El propietario mandó sacar del inicio de sesión del médico los cuatro bloques
 * de sistema —«Tu cuenta», «Directorio público», «Secciones disponibles» y
 * «Organizaciones»— y poner en su lugar qué toca hoy, con salida a la agenda
 * completa.
 *
 * Lo que sólo un navegador puede afirmar:
 *
 * 1. **Los cuatro bloques ya no están** en ninguno de los dos paneles de
 *    trabajo. Que el componente no los importe no dice nada de lo que se pinta.
 * 2. **La jornada se dibuja con datos**: la cinta trae tramos, el resumen trae
 *    cifras y la lista trae filas — no una franja vacía con un título.
 * 3. **El botón lleva a la agenda**, que es la única salida que la franja
 *    ofrece.
 * 4. **A quien no atiende no se le dibuja jornada**, y su panel sigue entero.
 * 5. **No hay desborde horizontal** en ninguno de los cinco anchos del sistema,
 *    ni en claro ni en oscuro.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'panel-hoy');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const ADMINISTRADORA: Actor = {
  rol: 'administrador',
  identificador: 'admin@alovida.mock',
  clave: 'mock',
  nombre: 'Administradora',
};

/** Los cinco anchos obligatorios del sistema de diseño. */
const ANCHOS: readonly { readonly nombre: string; readonly ancho: number; readonly alto: number }[] =
  [
    { nombre: '390', ancho: 390, alto: 844 },
    { nombre: '768', ancho: 768, alto: 1024 },
    { nombre: '1024', ancho: 1024, alto: 768 },
    { nombre: '1440', ancho: 1440, alto: 900 },
    { nombre: '1920', ancho: 1920, alto: 1080 },
  ];

/** Lo que el propietario mandó sacar, por su texto visible. */
const RETIRADOS: readonly string[] = [
  'Tu cuenta',
  'Directorio público',
  'Secciones disponibles',
  'Organizaciones',
];

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

/**
 * Congela lo que late.
 *
 * El rail público y los esqueletos animan en bucle, y una captura contra una
 * animación infinita no es reproducible: la misma pantalla sale distinta en
 * cada corrida.
 */
async function quieta(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-iteration-count:1 !important;animation-duration:1ms !important;transition-duration:1ms !important}',
  });
}

test.describe('Panel · lo que toca hoy', () => {
  test('la jornada abre el panel del médico y los cuatro bloques de sistema ya no están', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    const erroresDeConsola: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() !== 'error') return;
      const texto = mensaje.text();
      // Ruido del servidor de desarrollo, no del producto: Vite inyecta sus
      // scripts en línea y la CSP de `index.html` —que es la de producción—
      // los rechaza. Contra la imagen construida no aparece.
      if (texto.includes('Content Security Policy')) return;
      erroresDeConsola.push(texto);
    });
    page.on('requestfailed', (peticion) => {
      erroresDeConsola.push(`petición fallida: ${peticion.url()}`);
    });
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400) {
        erroresDeConsola.push(`${respuesta.status()} en ${respuesta.url()}`);
      }
    });

    await entrar(page, MEDICA);
    await irA(page, '/dashboard');
    await estable(page);

    const jornada = page.getByTestId('panel-hoy');
    await expect(jornada).toBeVisible();

    /* ---- 1 · lo que se sacó ---------------------------------------------- */
    for (const texto of RETIRADOS) {
      await expect(
        page.getByRole('heading', { name: texto, exact: true }),
        `«${texto}» tendría que haber salido del panel`,
      ).toHaveCount(0);
    }
    await expect(page.getByTestId('panel-sesion')).toHaveCount(0);
    await expect(page.getByTestId('panel-directorio')).toHaveCount(0);

    /* ---- 2 · la jornada trae datos --------------------------------------- */
    // La cinta con tramos: si el simulador dejara de sembrar citas para hoy,
    // esto falla en vez de pasar contra una franja vacía.
    //
    // Con `expect.poll` y no con un `count()` suelto: la franja encadena dos
    // lecturas —las agendas y después las citas de cada una— y contarlas en el
    // primer instante mide el esqueleto. `estable()` no alcanza, porque contra
    // `ng serve` la red nunca queda del todo quieta.
    const tramos = page.locator('[data-testid="panel-hoy-cinta"] .cinta__tramo');
    await expect.poll(() => tramos.count(), { timeout: 30_000 }).toBeGreaterThan(0);

    const cifras = page.getByTestId('panel-hoy-cifras');
    await expect(cifras).toContainText(/\d+\s+consulta/);

    // Ahora o a continuación: una de las dos tiene que haber, salvo que la
    // jornada ya haya terminado — y entonces se dice con todas las letras.
    const destacada = page.getByTestId('panel-hoy-destacada');
    const terminada = page.getByTestId('panel-hoy-terminada');
    expect((await destacada.count()) + (await terminada.count())).toBeGreaterThan(0);

    /* ---- 3 · capturas, en los cinco anchos y en los dos temas ------------- */
    for (const { nombre, ancho, alto } of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: alto });
      await estable(page);
      await quieta(page);

      expect(await desbordeHorizontal(page), `desborde horizontal a ${ancho} px`).toBeLessThanOrEqual(1);

      await page.screenshot({ path: join(SALIDA, `panel-${nombre}.png`), fullPage: true });
    }

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);
    await quieta(page);
    expect(await desbordeHorizontal(page), 'desborde horizontal en oscuro').toBeLessThanOrEqual(1);
    await page.screenshot({ path: join(SALIDA, 'panel-1440-oscuro.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });

    /* ---- 4 · la salida a la agenda --------------------------------------- */
    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);
    await page.getByTestId('panel-hoy-ver-agenda').click();
    await page.waitForURL(/\/schedule$/, { timeout: 60_000 });

    expect(
      erroresDeConsola.filter((texto) => !texto.includes('[mock] sin manejador')),
      'la pantalla no puede dejar errores en consola',
    ).toEqual([]);
  });

  test('a quien no atiende no se le dibuja jornada, y su panel sigue entero', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, ADMINISTRADORA);
    await irA(page, '/dashboard');
    await estable(page);

    // Sin perfil profesional no hay jornada: no se le inventa una franja vacía.
    await expect(page.getByTestId('panel-hoy')).toHaveCount(0);

    // Y lo suyo sigue en pie: los accesos y el listado de pacientes.
    await expect(page.getByTestId('panel-accesos')).toBeVisible();
    await expect(page.getByTestId('panel-ultimos-pacientes')).toBeVisible();

    await quieta(page);
    await page.screenshot({ path: join(SALIDA, 'panel-admin-1440.png'), fullPage: true });
  });
});
