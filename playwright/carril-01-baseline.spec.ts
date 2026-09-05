import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import {
  administrador,
  apiViva,
  contextoDeApi,
  crearPaciente,
  doctora,
  type Actor,
} from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 01 — evidencia visual de las rutas P0, por rol.
 *
 * No afirma cómo tiene que verse una pantalla: afirma que **se puede entrar y
 * que pinta algo**, y deja la captura. El inventario
 * (`docs/reports/generated/design-view-inventory.md`) dice qué componente y qué
 * API hay detrás; esto dice qué se ve, que es lo que el carril pide como
 * baseline antes de tocar UI.
 *
 * Las capturas van a `artifacts/playwright/baseline/<rol>/`, que ya está en
 * `.gitignore` con el resto de la evidencia de corridas.
 */

const RAIZ_EVIDENCIA = join('artifacts', 'playwright', 'baseline');

/** Las rutas P0 de cada rol, con el rótulo con que se archiva la captura. */
const RECORRIDO: Readonly<Record<string, readonly { ruta: string; nombre: string }[]>> = {
  paciente: [
    { ruta: '/dashboard', nombre: '01-panel' },
    { ruta: '/directory', nombre: '02-guia-de-profesionales' },
    { ruta: '/my-account/appointments', nombre: '03-mis-turnos' },
    { ruta: '/my-account', nombre: '04-mi-perfil' },
    // Sin `/glossary`: desde el 18/08/2026 (feedback de la analista, F-03) el
    // glosario es de quien atiende y al paciente lo rebota el guard de sección.
    { ruta: '/tutorials', nombre: '05-tutoriales' },
  ],
  doctora: [
    { ruta: '/dashboard', nombre: '01-panel' },
    { ruta: '/schedule', nombre: '02-agenda' },
    { ruta: '/medical-records', nombre: '03-archivo-clinico' },
    { ruta: '/diagnostics', nombre: '04-laboratorio-e-imagen' },
    { ruta: '/glossary', nombre: '05-glosario' },
    { ruta: '/my-account', nombre: '06-mi-perfil' },
  ],
  administrador: [
    { ruta: '/dashboard', nombre: '01-panel' },
    { ruta: '/administration/patients', nombre: '02-pacientes' },
    { ruta: '/administration/organizations', nombre: '03-organizaciones' },
    { ruta: '/administration/users', nombre: '04-usuarios' },
  ],
};

/**
 * Las maquetas portadas que evidencian el marcador del carril 01.
 *
 * Van sin sesión a propósito: son públicas —no pasan por `authGuard`— y eso es
 * justamente parte del hallazgo.
 */
const MAQUETAS: readonly { ruta: string; nombre: string }[] = [
  { ruta: '/buscar/profesionales-listado', nombre: '01-buscador-publico' },
  { ruta: '/directorio/organizaciones-listado', nombre: '02-organizaciones-maqueta' },
  { ruta: '/personas/profesionales-listado', nombre: '03-personas-maqueta' },
];

async function capturar(page: Page, carpeta: string, nombre: string): Promise<void> {
  const destino = join(RAIZ_EVIDENCIA, carpeta);
  mkdirSync(destino, { recursive: true });
  await page.screenshot({ path: join(destino, `${nombre}.png`), fullPage: true });
}

/**
 * Recorre las rutas del rol capturando cada una.
 *
 * La afirmación es deliberadamente floja —que la ruta quedó donde se pidió y
 * que hay contenido— porque el objetivo es **evidencia**, no regresión visual.
 * Lo que sí sería un fallo real lo mide el carril 19, que clasifica cada ruta.
 */
async function recorrer(page: Page, actor: Actor): Promise<void> {
  await entrar(page, actor);

  for (const { ruta, nombre } of RECORRIDO[actor.rol] ?? []) {
    await irA(page, ruta);
    await estable(page);

    expect(new URL(page.url()).pathname, `${actor.rol} pudo abrir ${ruta}`).toBe(ruta);
    await expect(page.locator('app-root')).not.toBeEmpty();

    await capturar(page, actor.rol, nombre);
  }
}

test.describe('Carril 01 · baseline de las rutas P0', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva para este barrido').toBe(true);
    await api.dispose();
  });

  test('paciente', async ({ page }) => {
    const api = await contextoDeApi();
    const paciente = await crearPaciente(api);
    await api.dispose();

    await recorrer(page, paciente);
  });

  test('doctora', async ({ page }) => {
    await recorrer(page, doctora());
  });

  test('administrador', async ({ page }) => {
    await recorrer(page, administrador());
  });

  test('las maquetas portadas se declaran como referencia de diseño', async ({ page }) => {
    for (const { ruta, nombre } of MAQUETAS) {
      await page.goto(ruta);
      await estable(page);

      // El carril 01 pide **marcar** las pantallas que sólo muestran datos de
      // ejemplo. Si este aviso desaparece, la maqueta vuelve a ser
      // indistinguible del producto.
      const aviso = page.locator('app-alovida-design-notice');
      await expect(aviso, `${ruta} declara que es una maqueta`).toContainText(
        'Referencia de diseño',
      );

      await capturar(page, 'maquetas', nombre);
    }
  });
});
