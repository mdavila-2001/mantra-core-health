import { expect, test, type APIRequestContext } from '@playwright/test';

import { contextoDeApi, urlDeApi, type Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Subtarea 2.2 — cita textual de la cláusula contractual y justificación en
 * los rechazos de ítems de reclamo de seguro.
 *
 * El registro de procesos del stakeholder (MÓDULO ASEGURADORA · 2 · 3) exige
 * que la app explique **por qué** no se aprobó una prestación citando la
 * cláusula del contrato. Dos partes, deliberadamente separadas:
 *
 * - **La pantalla (maqueta interna)**: el interceptor de datos simulados está
 *   encendido en esta rama (llegó con el merge de `mockup`), así que este
 *   comando sirve la aplicación contra `insurance.handlers.ts`, no contra la
 *   API. Es el mismo régimen que usa `carril-16-solicitudes-de-seguro.spec.ts`
 *   para sus aserciones de contenido.
 * - **La API (Neon)**: la validación de `policyClauseReference` obligatoria
 *   al denegar se comprueba por HTTP directo, como ya hace AC-16-14 del
 *   carril 16 — sin pasar por el navegador.
 */

const LISTADO = '/administration/insurance-claims';

/** Cuenta con `BILLING_OPERATOR`/`SECURITY_ADMIN`: entra a la sección. */
const OPERADOR_MOCK: Actor = {
  rol: 'administrador',
  identificador: 'admin@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Operador (maqueta)',
};

const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

test.describe('la cláusula de exclusión en la pantalla (maqueta)', () => {
  test('un ítem denegado muestra la cita de la cláusula y la justificación', async ({ page }) => {
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
    await estable(page);

    const fila = page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0177' });
    await expect(fila).toBeVisible();
    await fila.getByTestId('claim-link').click();
    await expect(page.getByTestId('claim-lines-table')).toBeVisible();
    await estable(page);

    const filas = page.getByTestId('claim-line-reason');
    // Fila 0: «Control cardiológico» (aprobada) · fila 1: «ECG» (denegada).
    const celdaDenegada = filas.nth(1);

    await expect(celdaDenegada).toContainText('Cláusula 12.3');
    await expect(celdaDenegada).toContainText(
      'requiere autorización previa del área médica',
    );

    // El badge tiene su propio nombre accesible con el texto de la cita.
    const badge = celdaDenegada.getByRole('status', {
      name: /Cláusula de exclusión: Cláusula 12\.3/,
    });
    await expect(badge).toBeVisible();

    const celdaAprobada = filas.nth(0);
    await expect(celdaAprobada).toHaveText('—');
  });

  for (const viewport of VIEWPORTS) {
    test(`la celda de la cláusula no desborda el detalle en ${viewport.width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, OPERADOR_MOCK);
      await irA(page, LISTADO);
      await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
      await estable(page);

      await page
        .getByTestId('tabla-fila')
        .filter({ hasText: 'CLM-2026-0177' })
        .getByTestId('claim-link')
        .click();
      await expect(page.getByTestId('claim-lines-table')).toBeVisible();
      await estable(page);

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde, 'el detalle desborda a lo ancho').toBe(false);

      await page.screenshot({
        path: `artifacts/playwright/subtarea-2.2/detalle-${viewport.nombre}.png`,
        fullPage: true,
      });
    });
  }
});

/**
 * La validación de `policyClauseReference` — subtarea 2.2, Escenario 2. Se
 * mide contra la API directamente, como AC-16-14 del carril 16: lo que se
 * compara es el cuerpo de la respuesta, no cómo el navegador lo traduce.
 */
test.describe('la validación de la cláusula contractual (API)', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await contextoDeApi();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  /** Un uuid con forma válida que no corresponde a ningún reclamo. */
  const RECLAMO_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
  const LINEA_CUALQUIERA = '00000000-0000-4000-8000-000000000001';

  async function tokenDeAdministrador(): Promise<string> {
    const email = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@alovida.com';
    const password = process.env['E2E_ADMIN_PASSWORD'] ?? '12345678';
    const acceso = await api.post('/iam/auth/login', { data: { email, password } });
    expect(
      acceso.status(),
      `No se pudo entrar como ${email} contra ${urlDeApi()}. ` +
        'La API tiene que estar arriba y con el BOOTSTRAP_ADMIN sembrado.',
    ).toBe(200);
    const { accessToken } = (await acceso.json()) as { accessToken: string };
    return accessToken;
  }

  test('DENIED sin cláusula responde 400 nombrando el campo', async () => {
    const token = await tokenDeAdministrador();

    const respuesta = await api.post(
      `/insurance-claims/${RECLAMO_INEXISTENTE}/adjudications`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          outcome: 'DENIED',
          lineAdjudications: [
            { insuranceClaimLineId: LINEA_CUALQUIERA, decision: 'DENIED' },
          ],
        },
      },
    );

    expect(respuesta.status()).toBe(400);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    const detalles = JSON.stringify(cuerpo);
    expect(detalles).toContain('policyClauseReference');
    expect(detalles).toContain('obligatoria al denegar');
  });

  test('el mismo cuerpo CON cláusula ya no es un 400 de validación (pasa a 404: reclamo inexistente)', async () => {
    const token = await tokenDeAdministrador();

    const respuesta = await api.post(
      `/insurance-claims/${RECLAMO_INEXISTENTE}/adjudications`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          outcome: 'DENIED',
          lineAdjudications: [
            {
              insuranceClaimLineId: LINEA_CUALQUIERA,
              decision: 'DENIED',
              policyClauseReference: 'Cláusula de prueba 1.1',
            },
          ],
        },
      },
    );

    // El 400 anterior era la validación del DTO, no otra cosa: con la
    // cláusula presente, la petición llega al servicio y ahí el reclamo no
    // existe.
    expect(respuesta.status()).toBe(404);
  });
});
