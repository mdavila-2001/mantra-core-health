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
 * Carril 02 — los accesos, la Guía de profesionales y el RBAC de rutas.
 *
 * Las pruebas unitarias ya fijan las reglas (`navigation.map.spec.ts`,
 * `section-roles.guard.spec.ts`, `dashboard.spec.ts`). Esto comprueba lo que
 * ninguna de ellas puede: que **en la aplicación de verdad**, con la sesión de
 * verdad y el router de verdad, el paciente y la doctora entran (esta última
 * desde el 24/09/2026) y quien administra no.
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
/** La portada que ocupa el renglón del menú desde el 08/09/2026. */
const RUTA_DIRECTORIOS = '/directories';

/**
 * Si la portada de directorios ofrece la Guía de profesionales.
 *
 * Hasta el 28/10/2026 esto se preguntaba al árbol «Sus herramientas» del
 * panel. El propietario lo mandó retirar, y la Guía —que no tiene renglón en
 * el menú— se ofrece desde la portada «Directorios», que sí lo tiene.
 */
async function laPortadaOfreceLaGuia(page: Page): Promise<boolean> {
  await irA(page, RUTA_DIRECTORIOS);
  await estable(page);
  return (await page.locator(`main a[href="${RUTA_GUIA}"]`).count()) > 0;
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

  test('paciente: ve la Guía y la abre desde la portada de directorios', async ({ page }) => {
    const api = await contextoDeApi();
    const paciente = await crearPaciente(api);
    await api.dispose();

    await abrirPanel(page, paciente);

    // En el menú lateral se entra por la portada «Directorios», no por la Guía:
    // desde el 08/09/2026 los cuatro directorios salen del menú con
    // `fueraDelMenuPara: [ANY_ROLE]` (motivo en `navigation.map.ts`, sección
    // `directories`). La puerta sigue cerrada por `roles` + `exclusiveRoles`;
    // esto sólo fija dónde se ofrece.
    const menu = await rutasDelMenu(page);
    expect(menu).toContain(RUTA_DIRECTORIOS);
    expect(menu).not.toContain(RUTA_GUIA);
    expect(await laPortadaOfreceLaGuia(page)).toBe(true);

    // Se entra por el enlace, no escribiendo la dirección: lo que hay que
    // comprobar es que el enlace de la portada funciona.
    await page.locator(`main a[href="${RUTA_GUIA}"]`).first().click();
    await page.waitForURL(/\/directory$/);
    await estable(page);
    await expect(page.locator('app-root')).not.toBeEmpty();
  });

  test('doctora: la Guía se le ofrece y entra, y su menú no rebota', async ({ page }) => {
    await abrirPanel(page, doctora());

    /* -- 1 · se le ofrece (24/09/2026) -------------------------------------- */

    // La corrección #2 se la había quitado; el cliente pidió devolvérsela:
    // «añadamos doctores al directorio en el perfil de doctores también».
    expect(await laPortadaOfreceLaGuia(page)).toBe(true);

    /* -- 2 · el enlace directo entra ---------------------------------------- */

    await irA(page, RUTA_GUIA);
    await estable(page);
    expect(new URL(page.url()).pathname).toBe(RUTA_GUIA);

    /* -- 3 · nada de lo ofrecido rebota ------------------------------------ */

    // El menú y el guard salen del mismo registro. Si se desincronizaran, el
    // síntoma sería justamente éste: un renglón que se ofrece y devuelve al
    // panel. (Hasta el 28/10/2026 se recorría el árbol del panel.)
    await irA(page, '/dashboard');
    await estable(page);
    for (const ruta of await rutasDelMenu(page)) {
      await irA(page, ruta);
      await estable(page);

      expect(new URL(page.url()).pathname, `${ruta} no debería rebotar`).toBe(ruta);
      await irA(page, '/dashboard');
      await estable(page);
    }
  });

  test('administrador: tampoco se le ofrece la Guía', async ({ page }) => {
    await abrirPanel(page, administrador());

    expect(await laPortadaOfreceLaGuia(page)).toBe(false);
  });
});
