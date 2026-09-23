import { expect, test } from '@playwright/test';

import { administrador, operadoraDeFacturacion, type Actor } from './support/actores';
import { entrar as entrarConTenant } from './support/auditoria';
import { entrar, estable, irA } from './support/sesion';

/**
 * Subtarea 2.3 — canales de contacto directo de la aseguradora (WhatsApp,
 * call center, correo de siniestros) en el detalle de la solicitud de
 * seguro.
 *
 * El registro de procesos del stakeholder (MÓDULO ASEGURADORA · 6.2 · ítem 5)
 * pide "una opción para poder llamar mediante Whatsapp directo a la compañía
 * de seguro… y el usuario llamara desde su mismo numero de whatsapp". Dos
 * partes, deliberadamente separadas — mismo molde que
 * `carril-adjudicacion-clausulas.spec.ts` (subtarea 2.2):
 *
 * - **La pantalla (maqueta interna)**: `mockBackend: true` en esta rama sirve
 *   la aplicación contra `insurance.handlers.ts`, no contra la API.
 * - **La API (Neon)**: la configuración y lectura de los canales se comprueba
 *   por HTTP directo, con `auditoria.ts:entrar()` porque fija `X-Tenant-Id` —
 *   sin esa cabecera, un administrador con más de una membresía recibe 412,
 *   no 403 (`requireTenantId()`).
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

test.describe('los canales de contacto en la pantalla (maqueta)', () => {
  test('la solicitud de ALIANZA muestra WhatsApp con mensaje y call center', async ({ page }) => {
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
    await estable(page);

    await page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0177' })
      .getByTestId('claim-link')
      .click();
    await expect(page.getByTestId('insurance-contact-channels')).toBeVisible();
    await estable(page);

    const whatsapp = page.getByTestId('btn-whatsapp-claim');
    await expect(whatsapp).toBeVisible();
    const href = await whatsapp.getAttribute('href');
    expect(href).toContain('https://wa.me/59170000103?text=');
    expect(decodeURIComponent(href ?? '')).toContain('CLM-2026-0177');
    await expect(whatsapp).toHaveAttribute('target', '_blank');
    await expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    const callCenter = page.getByTestId('btn-callcenter-claim');
    await expect(callCenter).toBeVisible();
    await expect(callCenter).toHaveAttribute('href', 'tel:800100103');
  });

  test('la solicitud de La Vitalicia no tiene WhatsApp, sólo call center', async ({ page }) => {
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
    await estable(page);

    await page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0163' })
      .getByTestId('claim-link')
      .click();
    await expect(page.getByTestId('insurance-contact-channels')).toBeVisible();
    await estable(page);

    await expect(page.getByTestId('btn-whatsapp-claim')).toHaveCount(0);
    await expect(page.getByTestId('btn-callcenter-claim')).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`los botones de contacto no desbordan el detalle en ${viewport.width} px`, async ({
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
      await expect(page.getByTestId('insurance-contact-channels')).toBeVisible();
      await estable(page);

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde, 'el detalle desborda a lo ancho').toBe(false);

      await page.screenshot({
        path: `artifacts/playwright/subtarea-2.3/contacto-${viewport.nombre}.png`,
        fullPage: true,
      });
    });
  }
});

/**
 * Configurar y leer los canales — subtarea 2.3, del lado de la API. Se mide
 * contra Neon directamente, como AC-16-14 del carril 16.
 */
test.describe('la configuración y la lectura de canales (API · Neon)', () => {
  const RECLAMO_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

  test('DENIED sin + responde 400 nombrando el campo y E.164', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const carriers = await admin.api.get('/insurance-carriers');
    expect(carriers.ok()).toBe(true);
    const { items } = (await carriers.json()) as { items: { id: string }[] };
    expect(items.length).toBeGreaterThan(0);
    const carrierId = items[0]!.id;

    const invalido = await admin.api.put(`/insurance-carriers/${carrierId}/contact-channels`, {
      data: { whatsappNumber: '71548278', callCenterPhone: null, supportEmail: null },
    });
    expect(invalido.status()).toBe(400);
    const cuerpo = JSON.stringify(await invalido.json());
    // El mensaje de la ValidationPipe es prosa, no el nombre técnico del
    // campo: nombra el canal ("WhatsApp") y el formato exigido ("E.164").
    expect(cuerpo).toContain('WhatsApp');
    expect(cuerpo).toContain('E.164');

    await admin.api.dispose();
  });

  test('valores válidos persisten normalizados y se leen en la ficha y en el listado', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const carriers = await admin.api.get('/insurance-carriers');
    const { items } = (await carriers.json()) as { items: { id: string }[] };
    const carrierId = items[0]!.id;

    const puesto = await admin.api.put(`/insurance-carriers/${carrierId}/contact-channels`, {
      data: {
        whatsappNumber: '+591 70000199',
        callCenterPhone: '800-10-0199',
        supportEmail: 'siniestros.demo@alovida.test',
      },
    });
    expect(puesto.ok()).toBe(true);
    const cuerpoPuesto = (await puesto.json()) as { whatsappNumber: string };
    expect(cuerpoPuesto.whatsappNumber).toBe('+59170000199');

    const ficha = await admin.api.get(`/insurance-carriers/${carrierId}`);
    const datosFicha = (await ficha.json()) as { whatsappNumber: string };
    expect(datosFicha.whatsappNumber).toBe('+59170000199');

    await admin.api.dispose();

    // Un rol distinto — operadora de facturación, sin el comodín de plataforma
    // — ve el mismo canal en la cabecera del listado (Escenario 1 del lado API).
    const operadora = await entrarConTenant(
      { email: operadoraDeFacturacion().identificador },
      operadoraDeFacturacion().clave,
    );
    const solicitudes = await operadora.api.get('/insurance-claims?limit=5');
    expect(solicitudes.ok()).toBe(true);
    const pagina = (await solicitudes.json()) as {
      items: { carrierWhatsappNumber: string | null; insuranceCarrierId: string }[];
    };
    const propia = pagina.items.find((item) => item.insuranceCarrierId === carrierId);
    if (propia) {
      expect(propia.carrierWhatsappNumber).toBe('+59170000199');
    }
    await operadora.api.dispose();
  });

  test(':id ajeno al carrier del tenant activo responde 404', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const respuesta = await admin.api.put(
      `/insurance-carriers/${RECLAMO_INEXISTENTE}/contact-channels`,
      { data: { whatsappNumber: null, callCenterPhone: null, supportEmail: null } },
    );
    expect(respuesta.status()).toBe(404);

    await admin.api.dispose();
  });
});
