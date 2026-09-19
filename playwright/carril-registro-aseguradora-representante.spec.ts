import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { subirLosCincoDocumentos } from './helpers/documentos-legales';
import { completarGerencias, completarRepresentanteLegal } from './helpers/representante-legal';

/**
 * Subtarea 1.4 · representante legal (con poder notariado en PDF) y
 * directorio de tres gerencias en el autorregistro de aseguradora
 * (`/auth/register/organization`).
 *
 * ## Qué demuestra y qué no
 *
 * Comportamiento en el navegador contra el backend simulado
 * (`mock-backend.interceptor`): las dos páginas del representante legal, el
 * poder como zona de arrastre obligatoria, el acordeón de las tres
 * gerencias con la General ya abierta, la auto-apertura de un panel cuando
 * el motor bloquea «Siguiente» (salida `rechazada`, ver `paginated-form.ts`),
 * y el alta completa hasta la confirmación. El mock corre dentro de
 * Angular, sin red observable, así que no prueba que la API real acepte
 * `legalRepresentative`/`executives`; eso lo cubre
 * `organization-legal-representative.int-spec.ts` contra Neon. La forma
 * exacta del cuerpo la fija `register-organization.spec.ts`
 * (`HttpTestingController`).
 */

const RUTA = '/auth/register/organization';
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-aseguradora-representante');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled' });
}

async function abrirElAlta(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByLabel('Tipo societario')).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel('Tipo societario').locator('option:not([hidden])').first(),
  ).toBeAttached({ timeout: 20_000 });
}

/** Completa los tres primeros pasos, sube los 5 documentos y llega a «Representante legal (1 de 2)». */
async function llegarARepresentanteLegal(page: Page): Promise<void> {
  await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
  await page
    .getByLabel('Tipo societario')
    .selectOption({ label: 'S.R.L. · Sociedad de Responsabilidad Limitada' });
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Cómo se la identifica');
  await page.getByTestId('registro-organizacion-codigo').fill('ANDINA-SALUD');
  await page.getByTestId('registro-organizacion-sigla').fill('AS');
  await page.getByTestId('registro-organizacion-carrier').fill('CARRIER-AS');
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
  await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
  await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toContainText(
    'Documentación legal obligatoria (PDF)',
  );
  await subirLosCincoDocumentos(page);

  await expect(page.locator('.paginated-form__titulo')).toContainText(
    'Representante legal (1 de 2)',
  );
}

test.describe('alta pública de aseguradora — representante legal y gerencias (subtarea 1.4)', () => {
  test.describe.configure({ mode: 'serial' });

  test('«Representante legal (1 de 2)» trae los cinco nombres y los tres datos de contacto', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);

    for (const testId of [
      'registro-organizacion-representante-nombre',
      'registro-organizacion-representante-segundo-nombre',
      'registro-organizacion-representante-tercer-nombre',
      'registro-organizacion-representante-apellido-paterno',
      'registro-organizacion-representante-apellido-materno',
      'registro-organizacion-representante-ci',
      'registro-organizacion-representante-correo',
      'registro-organizacion-representante-telefono',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    await capturar(page, 'representante-datos');
  });

  test('«(2 de 2)» trae la zona del poder, rotulada con la ayuda de Bolivia', async ({ page }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await page.getByTestId('registro-organizacion-representante-nombre').fill('Mariana');
    await page
      .getByTestId('registro-organizacion-representante-apellido-paterno')
      .fill('Siles');
    await page.getByTestId('registro-organizacion-representante-ci').fill('4872190 SC');
    await page
      .getByTestId('registro-organizacion-representante-correo')
      .fill('legal@andina.test');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Representante legal (2 de 2)',
    );
    // `.first()`: el rótulo aparece dos veces —el `<label>` del `app-form-field`
    // y el texto del botón de subida de `app-dropzone-pdf`— con el mismo texto.
    await expect(page.getByText('Poder del representante legal').first()).toBeVisible();
    await expect(page.getByText('Otorgado ante notaría e inscrito en SEPREC.')).toBeVisible();

    await capturar(page, 'representante-poder');
  });

  test('sin el poder, «Continuar» no avanza y el campo marca el error', async ({ page }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await page.getByTestId('registro-organizacion-representante-nombre').fill('Mariana');
    await page
      .getByTestId('registro-organizacion-representante-apellido-paterno')
      .fill('Siles');
    await page.getByTestId('registro-organizacion-representante-ci').fill('4872190 SC');
    await page
      .getByTestId('registro-organizacion-representante-correo')
      .fill('legal@andina.test');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Representante legal (2 de 2)',
    );
    await page.getByTestId('paginated-form-continuar').click();

    // Sigue en la misma página: `-error` (dropzone-pdf.ts) es sólo para un
    // fallo real de subida (formato, tamaño); «obligatorio y vacío» lo marca
    // el `app-form-field` externo con el mensaje declarado en el campo —
    // mismo patrón que la subtarea 1.2.
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Representante legal (2 de 2)',
    );
    await expect(page.getByText('Este documento es obligatorio para continuar')).toBeVisible();
  });

  test('«Directorio ejecutivo» muestra los tres paneles, sólo el primero desplegado', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);

    await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
    const general = page.getByRole('button', { name: /Gerente General/ });
    const comercial = page.getByRole('button', { name: /Gerente Comercial/ });
    const marketing = page.getByRole('button', { name: /Gerente de Marketing/ });
    await expect(general).toHaveAttribute('aria-expanded', 'true');
    await expect(comercial).toHaveAttribute('aria-expanded', 'false');
    await expect(marketing).toHaveAttribute('aria-expanded', 'false');
    // Plegado = ausente del DOM, no escondido con CSS.
    await expect(
      page.getByTestId('registro-organizacion-executives-commercial-manager-name'),
    ).toHaveCount(0);

    await capturar(page, 'directorio-tres-paneles');
  });

  /**
   * Ejercita B0 de punta a punta: el motor bloquea «Siguiente» sobre el
   * `FormGroup` de `executives` (no sobre sus hijos), emite `rechazada`, y
   * `alRechazarPagina` abre el panel de marketing y marca sus campos.
   */
  test('con la gerencia de marketing incompleta, «Continuar» no avanza y su panel se despliega solo', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);

    await page
      .getByTestId('registro-organizacion-executives-general-manager-name')
      .fill('Carlos');
    await page
      .getByTestId('registro-organizacion-executives-general-manager-lastName')
      .fill('Mendoza');
    await page
      .getByTestId('registro-organizacion-executives-general-manager-phone')
      .fill('70000001');
    await page
      .getByTestId('registro-organizacion-executives-general-manager-email')
      .fill('gm@andina.test');
    await page.getByRole('button', { name: /Gerente Comercial/ }).click();
    await page
      .getByTestId('registro-organizacion-executives-commercial-manager-name')
      .fill('Ana');
    await page
      .getByTestId('registro-organizacion-executives-commercial-manager-lastName')
      .fill('Paz');
    await page
      .getByTestId('registro-organizacion-executives-commercial-manager-phone')
      .fill('70000002');
    await page
      .getByTestId('registro-organizacion-executives-commercial-manager-email')
      .fill('cm@andina.test');
    // Marketing queda sin completar.
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
    await expect(page.getByRole('button', { name: /Gerente de Marketing/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByText('Este dato es obligatorio.').first()).toBeVisible();

    await capturar(page, 'marketing-auto-abierto');
  });

  /**
   * AC-02: nombre y apellido paterno son los dos únicos obligatorios de una
   * gerencia — mismo criterio que `alRechazarPagina` para `executives`.
   */
  test('AC-02: sin apellido paterno el panel de una gerencia no deja avanzar', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);

    await page
      .getByTestId('registro-organizacion-executives-general-manager-name')
      .fill('Carlos');
    // Apellido paterno queda vacío a propósito: es el otro obligatorio.
    await page
      .getByTestId('registro-organizacion-executives-general-manager-phone')
      .fill('70000001');
    await page
      .getByTestId('registro-organizacion-executives-general-manager-email')
      .fill('gm@andina.test');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
    await expect(page.getByRole('button', { name: /Gerente General/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByText('Este dato es obligatorio.').first()).toBeVisible();
  });

  /** AC-01: la gerencia general lleva las cinco partes del nombre y avanza igual. */
  test('AC-01: la gerencia general con las cinco partes del nombre permite avanzar', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);
    await completarGerencias(page);

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
  });

  test('un correo de gerencia mal escrito se marca al salir del campo', async ({ page }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);

    const correo = page.getByTestId('registro-organizacion-executives-general-manager-email');
    await correo.fill('gerente.general@');
    await correo.blur();

    await expect(page.getByText('Revisá el correo: falta el arroba o el dominio.')).toBeVisible();
  });

  test('el alta se completa hasta la confirmación', async ({ page }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);
    await completarGerencias(page);

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page.getByTestId('registro-organizacion-owner-nombre').fill('Ana');
    await page.getByTestId('registro-organizacion-owner-apellido-paterno').fill('Paz');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page
      .getByTestId('registro-organizacion-owner-correo')
      .fill('con-representante@andina.test');
    await page.getByTestId('registro-organizacion-owner-password').fill('secreto12');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'exito-con-representante');
  });

  test('el directorio ejecutivo no se desborda en teléfono ni en tablet', async ({ page }) => {
    await abrirElAlta(page);
    await llegarARepresentanteLegal(page);
    await completarRepresentanteLegal(page);
    await page.getByRole('button', { name: /Gerente Comercial/ }).click();
    await page.getByRole('button', { name: /Gerente de Marketing/ }).click();

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['tablet-horizontal-1024x768', { width: 1024, height: 768 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
      ['escritorio-grande-1920x1080', { width: 1920, height: 1080 }],
    ] as const) {
      await page.setViewportSize(tamano);
      await expect(page.getByRole('button', { name: /Gerente de Marketing/ })).toBeVisible();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-${nombre}`);
    }
  });
});
