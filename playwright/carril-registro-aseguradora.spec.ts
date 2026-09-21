import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { subirLosCincoDocumentos } from './helpers/documentos-legales';
import { completarCuentaDelOwner } from './helpers/owner';
import { completarGerencias, completarRepresentanteLegal } from './helpers/representante-legal';

/**
 * Subtarea 1.1 · el selector de tipo societario, y simplificación de
 * códigos + zona horaria por país en el alta pública de aseguradora
 * (`/auth/register/organization`).
 *
 * ## Qué demuestra y qué no
 *
 * Demuestra **comportamiento en el navegador contra el backend simulado**
 * (`mock-backend.interceptor`, que es el entorno autorizado para probar acá —
 * ver `environment.mockBackend`): las 8 figuras bolivianas con sus acrónimos,
 * que cambiar el país recalcula las opciones y limpia una elección que dejó
 * de pertenecer a la lista, que el paso «Cómo se la identifica» ya no existe
 * (AC-04) y la sigla se completa en «La empresa», que un país de zona única
 * (Bolivia) no pregunta ninguna zona horaria (AC-02), y que uno multizona
 * (Estados Unidos) ofrece el selector preseleccionado y permite cambiarlo
 * (AC-03). No demuestra la persistencia contra la API real ni el `$expand`
 * con propiedades — eso lo cubre `organization-legal-entity-type.int-spec.ts`
 * contra Neon, del lado de la API — así que se declara acá, igual que el
 * resto de la suite de esta rama. El cuerpo exacto que recibe la API
 * (`code`/`carrierCode` derivados de la sigla, AC-01) lo fija
 * `register-organization.spec.ts` con `HttpTestingController`: el alta
 * corre contra el backend simulado in-process y Playwright no puede
 * observar el `POST` — convención ya documentada en el resto de esta suite.
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

/**
 * El texto de la opción elegida en un `<select>` nativo.
 *
 * `app-select` dibuja `<option [value]="$index">` —el `value` del DOM es el
 * ÍNDICE, no el dato real (`select.html`, para no perder valores no-string)—,
 * así que `toHaveValue` no sirve para leer la zona horaria elegida: hay que
 * leer el texto de la opción seleccionada.
 */
async function textoDeLaOpcionElegida(select: Locator): Promise<string> {
  return select.evaluate(
    (el: HTMLSelectElement) => el.options[el.selectedIndex]?.textContent?.trim() ?? '',
  );
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

  test('AC-04: tras «La empresa» (con sigla) se avanza directo a «Datos de la aseguradora», sin paso de códigos', async ({
    page,
  }) => {
    await abrirElAlta(page);

    // Paso 1 · La empresa (la sigla vive acá desde ahora; ya no hay `code`
    // ni `carrierCode` que escribir a mano).
    await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
    await page.getByTestId('registro-organizacion-sigla').fill('ANDINA');
    await selectPais(page).selectOption({ label: 'Bolivia' });
    await selectTipoSocietario(page).selectOption({
      label: 'S.R.L. · Sociedad de Responsabilidad Limitada',
    });
    await capturar(page, 'paso-1-completo');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 2 · Datos de la aseguradora, directo — «Cómo se la identifica»
    // ya no existe, y ninguno de sus campos sigue en el DOM.
    await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
    await expect(page.getByTestId('registro-organizacion-codigo')).toHaveCount(0);
    await expect(page.getByTestId('registro-organizacion-carrier')).toHaveCount(0);
    // AC-02: Bolivia es zona única — no hay nada que preguntar acá.
    await expect(page.getByTestId('registro-organizacion-zona')).toHaveCount(0);
    await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
    await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 3 · Documentación legal obligatoria en PDF (subtarea 1.2); cubierta
    // a fondo por `carril-registro-aseguradora-documentos.spec.ts` — acá sólo
    // se completa para que el flujo llegue a la confirmación.
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Documentación legal obligatoria (PDF)',
    );
    await subirLosCincoDocumentos(page);

    // Paso 4 · Representante legal y Paso 5 · Directorio ejecutivo (subtarea
    // 1.4); cubiertos a fondo por
    // `carril-registro-aseguradora-representante.spec.ts` — acá sólo se
    // completan para que el flujo llegue a la confirmación.
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Representante legal (1 de 2)',
    );
    await completarRepresentanteLegal(page);
    await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
    await completarGerencias(page);

    // Paso 6 · Tu cuenta: una sola página, con los cinco nombres del owner
    // juntos. `completarCuentaDelOwner` la completa y pulsa el envío.
    //
    // El backend simulado responde **dentro** de la cadena de interceptores de
    // Angular (`mock-backend.interceptor.ts`): nunca sale a la red del
    // navegador, así que no hay una petición HTTP real que Playwright pueda
    // observar acá. Que el `legalEntityType` elegido viaja tal cual en el
    // cuerpo del contrato lo prueba `register-organization.spec.ts` (con
    // `HttpTestingController`, que sí intercepta antes del mock); esta prueba
    // demuestra el resultado observable en el navegador: el alta con S.R.L.
    // llega a la confirmación.
    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await completarCuentaDelOwner(page, { email: 'admin@andina.test' });

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({
      timeout: 20_000,
    });
    await capturar(page, 'exito');
  });

  test('una sigla que no llega a un código válido bloquea el paso 1 con su mensaje', async ({
    page,
  }) => {
    await abrirElAlta(page);

    await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
    // Dos caracteres: por debajo del mínimo (3) que exige la sigla.
    await page.getByTestId('registro-organizacion-sigla').fill('AS');
    await selectTipoSocietario(page).selectOption({
      label: 'S.R.L. · Sociedad de Responsabilidad Limitada',
    });
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByText('Escribí la sigla: de 3 a 20 letras o números.')).toBeVisible();
    await expect(page.locator('.paginated-form__titulo')).toHaveText('La empresa');
  });

  test('AC-03: Estados Unidos ofrece el selector de zona horaria y permite elegir el Pacífico', async ({
    page,
  }) => {
    await abrirElAlta(page);

    await page.getByLabel('Nombre de la empresa').fill('Andina US Corp.');
    await page.getByTestId('registro-organizacion-sigla').fill('ANDINA-US');
    await selectPais(page).selectOption({ label: 'Estados Unidos' });
    await selectTipoSocietario(page).selectOption({
      label: 'LLC · Compañía de Responsabilidad Limitada',
    });
    await page.getByTestId('paginated-form-continuar').click();

    // «Datos de la aseguradora (1 de 2)»: el motor la parte porque el
    // selector de zona suma un quinto campo (AC-03/DoD: 10 pasos acá).
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Datos de la aseguradora',
    );
    // El `data-testid` va en el host `<app-select>`; el `<select>` nativo
    // —donde viven `value` y las `<option>`— es su descendiente (mismo
    // matiz verificado en `register-organization.spec.ts`).
    const zonaHost = page.getByTestId('registro-organizacion-zona');
    const zona = zonaHost.locator('select');
    await expect(zonaHost).toBeVisible();
    await expect(zona.locator('option:not([hidden])')).toHaveCount(7);
    expect(await textoDeLaOpcionElegida(zona)).toContain('Hora del Este');
    await capturar(page, 'paso-2-zona-horaria-multizona');

    const pacifico = 'Hora del Pacífico / Pacific (California, Los Ángeles, Seattle)';
    await zona.selectOption({ label: pacifico });
    expect(await textoDeLaOpcionElegida(zona)).toBe(pacifico);

    // Va y vuelve: el valor elegido sobrevive a la navegación.
    await page.getByTestId('paginated-form-atras').click();
    await expect(page.locator('.paginated-form__titulo')).toHaveText('La empresa');
    await page.getByTestId('paginated-form-continuar').click();
    expect(await textoDeLaOpcionElegida(zona)).toBe(pacifico);
  });

  test('el paso 1 no se desborda en teléfono ni en tablet', async ({ page }) => {
    await abrirElAlta(page);

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['tablet-horizontal-1024x768', { width: 1024, height: 768 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
      ['escritorio-grande-1920x1080', { width: 1920, height: 1080 }],
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

  test('el selector de zona horaria multizona no se desborda en teléfono ni en tablet', async ({
    page,
  }) => {
    await abrirElAlta(page);

    await page.getByLabel('Nombre de la empresa').fill('Andina US Corp.');
    await page.getByTestId('registro-organizacion-sigla').fill('ANDINA-US');
    await selectPais(page).selectOption({ label: 'Estados Unidos' });
    await selectTipoSocietario(page).selectOption({
      label: 'LLC · Compañía de Responsabilidad Limitada',
    });
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.getByTestId('registro-organizacion-zona')).toBeVisible();

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['tablet-horizontal-1024x768', { width: 1024, height: 768 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
      ['escritorio-grande-1920x1080', { width: 1920, height: 1080 }],
    ] as const) {
      await page.setViewportSize(tamano);
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-zona-multizona-${nombre}`);
    }
  });
});
