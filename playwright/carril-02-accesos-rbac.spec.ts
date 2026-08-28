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
 * Carril 02 — «Tus accesos», la Guía de profesionales y el RBAC de rutas.
 *
 * Las pruebas unitarias ya fijan las reglas (`navigation.map.spec.ts`,
 * `section-roles.guard.spec.ts`, `dashboard.spec.ts`). Esto comprueba lo que
 * ninguna de ellas puede: que **en la aplicación de verdad**, con la sesión de
 * verdad y el router de verdad, el paciente entra y la doctora rebota.
 *
 * ## Una prueba por actor, no una por afirmación
 *
 * `POST /iam/auth/login` está limitado a **diez por minuto y por IP**. Con una
 * prueba por afirmación, los tres actores gastaban el cupo a mitad de la
 * corrida y la suite se caía contra una defensa que funciona bien — se midió:
 * pasaban dos de cinco, y las tres que fallaban lo hacían por `429`, no por el
 * producto. Es el mismo motivo por el que la suite de Cypress recorre cada
 * actor de un tirón.
 */

const RUTA_GUIA = '/directory';

/** Los identificadores de las zonas de la primera pantalla del árbol. */
async function idsDeZonas(page: Page): Promise<string[]> {
  return page
    .getByTestId('panel-zona')
    .evaluateAll((nodos) => nodos.map((n) => (n as HTMLElement).dataset['zona'] ?? ''));
}

/** Abre una zona y espera a que aparezca el camino de vuelta. */
async function abrirZona(page: Page, id: string): Promise<void> {
  await page.locator(`[data-zona="${id}"]`).click();
  await page.getByTestId('panel-zona-volver').waitFor();
}

/** Vuelve a la primera pantalla del árbol. */
async function volverAlArbol(page: Page): Promise<void> {
  await page.getByTestId('panel-zona-volver').click();
  await page.getByTestId('panel-zona').first().waitFor();
}

/**
 * Los accesos del panel, por la ruta a la que llevan.
 *
 * Desde el 28/08/2026 «Tus accesos» es un árbol de dos escalones: la primera
 * pantalla son cinco zonas y las secciones viven adentro. Así que esto ya no
 * lee una rejilla: **recorre el árbol entero**, que además es la única forma
 * de que la comprobación de «nada de lo ofrecido rebota» siga cubriendo todo.
 */
async function rutasDeAccesos(page: Page): Promise<string[]> {
  const rutas: string[] = [];

  for (const zona of await idsDeZonas(page)) {
    await abrirZona(page, zona);
    rutas.push(
      ...(await page
        .getByTestId('panel-acceso')
        .evaluateAll((nodos) => nodos.map((n) => (n as HTMLElement).dataset['ruta'] ?? ''))),
    );
    await volverAlArbol(page);
  }

  return rutas;
}

/** Los destinos del menú lateral. */
async function rutasDelMenu(page: Page): Promise<string[]> {
  return page
    .getByTestId('nav-enlace')
    .evaluateAll((nodos) => nodos.map((n) => (n as HTMLElement).dataset['route'] ?? ''));
}

async function abrirPanel(page: Page, actor: Actor): Promise<void> {
  await entrar(page, actor);
  await irA(page, '/dashboard');
  await estable(page);
}

test.describe('Carril 02 · accesos, Guía de profesionales y RBAC', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva').toBe(true);
    await api.dispose();
  });

  test('paciente: ve la Guía y la abre desde el panel', async ({ page }) => {
    const api = await contextoDeApi();
    const paciente = await crearPaciente(api);
    await api.dispose();

    await abrirPanel(page, paciente);

    expect(await rutasDelMenu(page)).toContain(RUTA_GUIA);
    expect(await rutasDeAccesos(page)).toContain(RUTA_GUIA);

    // Se entra por el acceso, no escribiendo la dirección: lo que hay que
    // comprobar es que el enlace del panel funciona. La Guía vive en la zona
    // «La red», que es donde el registro de zonas la declara.
    await abrirZona(page, 'red');
    await page.getByTestId('panel-acceso').filter({ hasText: 'Guía de profesionales' }).click();
    await page.waitForURL(/\/directory$/);
    await estable(page);
    await expect(page.locator('app-root')).not.toBeEmpty();
  });

  test('doctora: no la ve ofrecida, el enlace directo no entra, y sus accesos no rebotan', async ({
    page,
  }) => {
    await abrirPanel(page, doctora());

    /* -- 1 · no está ofrecida por ningún lado ------------------------------ */

    expect(await rutasDelMenu(page)).not.toContain(RUTA_GUIA);
    expect(await rutasDeAccesos(page)).not.toContain(RUTA_GUIA);

    /* -- 2 · esconder el enlace no era la protección ------------------------ */

    // El enlace guardado, el correo con la dirección y el historial del
    // navegador llegan igual: eso es lo que cierra `seccionRolesGuard`.
    await irA(page, RUTA_GUIA);
    await estable(page);
    expect(new URL(page.url()).pathname).toBe('/dashboard');

    // La ficha de un profesional es parte de la Guía y cae con ella.
    await irA(page, '/directory/00000000-0000-0000-0000-000000000000');
    await estable(page);
    expect(new URL(page.url()).pathname).toBe('/dashboard');

    /* -- 3 · corrección #1: íconos con ayuda al enfocar --------------------- */

    await irA(page, '/dashboard');
    await estable(page);

    // Un escalón adentro: la primera pantalla son zonas, y el globo es de los
    // accesos que hay dentro de una.
    await abrirZona(page, 'consulta');

    const primero = page.getByTestId('panel-acceso').first();
    await expect(primero.locator('app-nav-icon svg')).toBeVisible();

    // La ayuda tiene que llegar **también por teclado**, no sólo con el
    // puntero: es la mitad del pedido que un tooltip de sólo hover no cumple.
    // Se busca el globo **por el id que el enlace declara** y no por etiqueta:
    // recorrer la rejilla deja globos de otros accesos abiertos, y un locator
    // por etiqueta encuentra varios y no dice nada de cuál es el de éste.
    await primero.focus();
    await expect(primero).toHaveAttribute('aria-describedby', /tooltip/);
    const globoId = await primero.getAttribute('aria-describedby');
    await expect(page.locator(`#${globoId}`)).toBeVisible();

    /* -- 4 · nada de lo ofrecido rebota ------------------------------------ */

    // Se sale de la zona antes de recorrer el árbol: `rutasDeAccesos` arranca
    // desde la primera pantalla, y adentro de una zona no hay zonas que abrir.
    await volverAlArbol(page);

    // El panel y el guard salen del mismo registro. Si se desincronizaran, el
    // síntoma sería justamente éste: un acceso que se ofrece y devuelve al
    // panel.
    for (const ruta of await rutasDeAccesos(page)) {
      await irA(page, ruta);
      await estable(page);

      expect(new URL(page.url()).pathname, `${ruta} no debería rebotar`).toBe(ruta);
      await irA(page, '/dashboard');
      await estable(page);
    }
  });

  test('administrador: tampoco se le ofrece la Guía en el panel', async ({ page }) => {
    await abrirPanel(page, administrador());

    expect(await rutasDeAccesos(page)).not.toContain(RUTA_GUIA);
  });
});
