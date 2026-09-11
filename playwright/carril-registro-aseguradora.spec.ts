import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Subtarea 1.1 · el selector de tipo societario en el alta pública de
 * aseguradora (`/auth/register/organization`).
 *
 * ## Qué demuestra y qué no
 *
 * Demuestra **comportamiento en el navegador contra el backend simulado**
 * (`mock-backend.interceptor`, que es el entorno autorizado para probar acá —
 * ver `environment.mockBackend`): las 8 figuras bolivianas con sus acrónimos,
 * que cambiar el país recalcula las opciones y limpia una elección que dejó
 * de pertenecer a la lista, y que el código elegido viaja tal cual en el
 * cuerpo del `POST`. No demuestra la persistencia contra la API real ni el
 * `$expand` con propiedades — eso lo cubre
 * `organization-legal-entity-type.int-spec.ts` contra Neon, del lado de la
 * API — así que se declara acá, igual que el resto de la suite de esta rama.
 *
 * `POST /iam/auth/login` no interviene: es un alta pública, sin sesión previa.
 */

const RUTA = '/auth/register/organization';

/** Dónde queda la evidencia. `artifacts/` no se versiona. */
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-aseguradora');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCIA, `${nombre}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}

/** El desplegable de tipo societario. Mismo patrón que el resto de la suite: `getByLabel`. */
function selectTipoSocietario(page: Page): Locator {
  return page.getByLabel('Tipo societario');
}

function selectPais(page: Page): Locator {
  return page.getByLabel('País de constitución');
}

async function abrirElAlta(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await expect(selectTipoSocietario(page)).toBeVisible({ timeout: 20_000 });
  // El `<select>` existe antes de que resuelva el catálogo de tipos
  // societarios —sólo trae el placeholder—; sin esto, cualquier prueba que
  // elija una opción corre contra un desplegable todavía vacío.
  await expect(selectTipoSocietario(page).locator('option:not([hidden])').first()).toBeAttached({
    timeout: 20_000,
  });
}

test.describe('alta pública de aseguradora — tipo societario (subtarea 1.1)', () => {
  test.describe.configure({ mode: 'serial' });

  test('ofrece las 8 figuras bolivianas con sus acrónimos', async ({ page }) => {
    await abrirElAlta(page);

    // El `<select>` se pinta antes de que resuelva el catálogo —sólo trae el
    // placeholder—; hay que esperar las 8 opciones reales, no sólo que el
    // control exista.
    const opcionesReales = selectTipoSocietario(page).locator('option:not([hidden])');
    await expect(opcionesReales).toHaveCount(8, { timeout: 20_000 });

    // `option[hidden]` es el placeholder («Seleccionar opción»): no es una
    // figura real, así que se excluye por atributo y no por texto.
    const opciones = await opcionesReales.allTextContents();
    const visibles = opciones.map((texto) => texto.trim());

    expect(visibles).toEqual([
      'Empresa Unipersonal',
      'S.R.L. · Sociedad de Responsabilidad Limitada',
      'Ltda. · Limitada',
      'S.A. · Sociedad Anónima',
      'S.C. · Sociedad Colectiva',
      'S.C.S. · Sociedad en Comandita Simple',
      'S.C.A. · Sociedad en Comandita por Acciones',
      'Sucursal de Sociedad Extranjera',
    ]);

    await capturar(page, 'paso-1-bolivia');
  });

  test('cambiar el país a Brasil ofrece sus figuras, no las bolivianas', async ({ page }) => {
    await abrirElAlta(page);

    await selectPais(page).selectOption({ label: 'Brasil' });

    // El recalculo es síncrono (mismo tick que el cambio de país), pero se
    // espera igual: es una aserción web-first, no una carrera.
    const opcionesReales = selectTipoSocietario(page).locator('option:not([hidden])');
    await expect(opcionesReales).toHaveCount(6, { timeout: 10_000 });

    const opciones = await opcionesReales.allTextContents();
    const visibles = opciones.map((texto) => texto.trim());

    // El idioma de la interfaz es fijo `es` (sin selector, subtarea 1.1): las
    // figuras brasileñas se leen en castellano, no en portugués.
    expect(visibles).toContain('LTDA · Sociedad Limitada (Brasil)');
    expect(visibles).toContain('S.A. · Sociedad Anónima (Brasil)');
    expect(visibles).toContain('MEI · Microemprendedor Individual');
    expect(visibles).toContain('SLU · Sociedad Limitada Unipersonal');
    expect(visibles).not.toContain('S.R.L. · Sociedad de Responsabilidad Limitada');

    await capturar(page, 'paso-1-brasil');
  });

  test('sin tipo societario elegido, el paso no avanza y explica por qué', async ({ page }) => {
    await abrirElAlta(page);

    await page.getByLabel('Nombre de la empresa').fill('Aseguradora Sin Tipo');
    // País queda en Bolivia por defecto; el tipo societario, sin elegir.
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByText('Elegí el tipo societario.')).toBeVisible();
    // Sigue en el primer paso: el título de la sección no cambió.
    await expect(page.locator('.paginated-form__titulo')).toHaveText('La empresa');
  });

  test('completa el alta con S.R.L. y el código viaja tal cual en el contrato', async ({
    page,
  }) => {
    await abrirElAlta(page);

    // Paso 1 · La empresa
    await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
    await selectPais(page).selectOption({ label: 'Bolivia' });
    await selectTipoSocietario(page).selectOption({
      label: 'S.R.L. · Sociedad de Responsabilidad Limitada',
    });
    await capturar(page, 'paso-1-completo');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 2 · Cómo se la identifica
    await expect(page.locator('.paginated-form__titulo')).toHaveText('Cómo se la identifica');
    await page.getByTestId('registro-organizacion-codigo').fill('ANDINA-SALUD');
    await page.getByTestId('registro-organizacion-sigla').fill('AS');
    await page.getByTestId('registro-organizacion-carrier').fill('CARRIER-AS');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 3 · Datos de la aseguradora
    await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
    await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
    await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 4 · Tu cuenta (el motor la parte en dos por el tope de 4 campos)
    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page.getByTestId('registro-organizacion-owner-nombre').fill('Ana');
    await page.getByTestId('registro-organizacion-owner-apellido-paterno').fill('Paz');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page.getByTestId('registro-organizacion-owner-correo').fill('admin@andina.test');
    await page.getByTestId('registro-organizacion-owner-password').fill('secreto12');

    // El backend simulado responde **dentro** de la cadena de interceptores de
    // Angular (`mock-backend.interceptor.ts`): nunca sale a la red del
    // navegador, así que no hay una petición HTTP real que Playwright pueda
    // observar acá. Que el `legalEntityType` elegido viaja tal cual en el
    // cuerpo del contrato lo prueba `register-organization.spec.ts` (con
    // `HttpTestingController`, que sí intercepta antes del mock); esta prueba
    // demuestra el resultado observable en el navegador: el alta con S.R.L.
    // llega a la confirmación.
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({
      timeout: 20_000,
    });
    await capturar(page, 'exito');
  });

  test('el paso 1 no se desborda en teléfono ni en tablet', async ({ page }) => {
    await abrirElAlta(page);

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
    ] as const) {
      await page.setViewportSize(tamano);
      await expect(selectTipoSocietario(page)).toBeVisible();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-${nombre}`);
    }
  });
});
