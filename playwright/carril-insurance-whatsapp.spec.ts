import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

import { administrador, operadoraDeFacturacion, type Actor } from './support/actores';
import { entrar as entrarConTenant } from './support/auditoria';
import { entrar, irA } from './support/sesion';
import { entrarAlSimulador } from './support/simulador';

/**
 * Tarea 2 — Botón directo y enlace a WhatsApp / Call Center de aseguradora.
 *
 * Certifica y endurece lo que la subtarea 2.3 ya dejó en `dev`: el registro
 * de procesos del stakeholder (MÓDULO ASEGURADORA · 6.2 · ítem 5) pide "una
 * opción para poder llamar mediante Whatsapp directo a la compañía de
 * seguro… y el usuario llamara desde su mismo numero de whatsapp". Tres
 * superficies, deliberadamente separadas:
 *
 * - **El detalle de reclamo (maqueta interna)**: `mockBackend: true` en esta
 *   rama sirve la aplicación contra `insurance.handlers.ts`, no contra la
 *   API. Lo ve un operador (`BILLING_OPERATOR`/`SECURITY_ADMIN`).
 * - **La tarjeta de cobertura de `/my-account`**: lo ve el propio paciente
 *   — la superficie que describe literalmente el pedido del stakeholder.
 * - **La API (Neon)**: la configuración y lectura de los canales se comprueba
 *   por HTTP directo, con `auditoria.ts:entrar()` porque fija `X-Tenant-Id` —
 *   sin esa cabecera, un administrador con más de una membresía recibe 412,
 *   no 403 (`requireTenantId()`).
 *
 * Lo que cambió respecto de la 2.3 (Tarea 2): el testid del call center pasó
 * de `btn-callcenter-claim` a `btn-call-center-phone`; el botón de WhatsApp
 * y el de call center subieron de `size="sm"` a `size="md"` para llegar a
 * 44 px en móvil; el enlace de WhatsApp se activa también con la tecla
 * Espacio (antes sólo Enter, nativo del `<a>`); se agregó el reclamo
 * `CLM-2026-0185` (Caja Petrolera) para ejercitar el estado "sin ningún
 * canal"; y la maqueta de `/my-account` dejó de usar el call center real de
 * BISA (`800-10-6060`) para cualquier aseguradora.
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

/**
 * El sistema de diseño baja el mínimo táctil a 40 px recién desde 780 px
 * (`atoms/button/button.css:128-146`, la misma regla que documenta
 * `carril-insurance-portability.spec.ts`): a 768 px —tablet vertical—
 * todavía rige el mínimo móvil de 44.
 */
function altoMinimoTactil(width: number): number {
  return width >= 780 ? 40 : 44;
}

async function screenshotWithoutOverflow(page: Page, info: TestInfo, name: string): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

/** El ruido de CSP que `ng serve` inyecta en cualquier ruta (recarga en vivo). */
function esRuidoDelServidorDeDesarrollo(texto: string): boolean {
  return texto.includes('Content Security Policy') && texto.includes('inline script');
}

/**
 * Intercepta `wa.me` para no salir a Internet durante el E2E: la aserción es
 * sobre la URL con la que Chromium abrió el popup, no sobre lo que WhatsApp
 * respondería.
 */
async function interceptarWaMe(context: BrowserContext): Promise<void> {
  await context.route('**/wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '' }),
  );
}

/**
 * Dispara `accion` y devuelve el popup que abre —`waitForEvent('page')` se
 * registra ANTES de la acción, porque si no la carrera puede perderse el
 * evento cuando el popup abre demasiado rápido.
 */
async function abrirPopup(context: BrowserContext, accion: () => Promise<void>): Promise<Page> {
  const popupPromise = context.waitForEvent('page');
  await accion();
  return popupPromise;
}

test.describe('el detalle de reclamo en la pantalla (maqueta)', () => {
  test('CA-2.1: WhatsApp abre en pestaña nueva con clic, Enter y Espacio, sin datos clínicos', async ({
    page,
    context,
  }) => {
    await interceptarWaMe(context);
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });

    await page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0177' })
      .getByTestId('claim-link')
      .click();
    const whatsapp = page.getByTestId('btn-whatsapp-claim');
    await expect(whatsapp).toBeVisible();

    const href = await whatsapp.getAttribute('href');
    expect(href).toContain('https://wa.me/59170000103?text=');
    const mensaje = decodeURIComponent(href ?? '');
    expect(mensaje).toContain('CLM-2026-0177');
    expect(mensaje).toContain('Alianza Seguros');
    // PHI-guard (CA-2.4): las líneas clínicas de este reclamo (una DENIED
    // con cita de cláusula) no pueden aparecer en un texto que viaja a un
    // tercero (Meta).
    expect(mensaje).not.toContain('ECG');
    expect(mensaje).not.toContain('Cláusula');
    expect(mensaje).not.toContain('Control cardiológico');
    await expect(whatsapp).toHaveAttribute('target', '_blank');
    await expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    const popupClic = await abrirPopup(context, () => whatsapp.click());
    await expect(popupClic).toHaveURL(/wa\.me\/59170000103\?text=/);
    await popupClic.close();

    await whatsapp.focus();
    const popupEnter = await abrirPopup(context, () => page.keyboard.press('Enter'));
    await expect(popupEnter).toHaveURL(/wa\.me\/59170000103\?text=/);
    await popupEnter.close();

    await whatsapp.focus();
    const popupEspacio = await abrirPopup(context, () => page.keyboard.press('Space'));
    await expect(popupEspacio).toHaveURL(/wa\.me\/59170000103\?text=/);
    await popupEspacio.close();
  });

  test('CA-2.2: sin WhatsApp registrado, sólo call center con el testid del CA', async ({ page }) => {
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });

    await page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0163' })
      .getByTestId('claim-link')
      .click();

    await expect(page.getByTestId('btn-whatsapp-claim')).toHaveCount(0);
    const callCenter = page.getByTestId('btn-call-center-phone');
    await expect(callCenter).toBeVisible();
    await expect(callCenter).toHaveAttribute('href', 'tel:800100102');
  });

  test('CA-2.3: sin ningún canal registrado, la nota de ausencia y ningún enlace', async ({ page }) => {
    await entrar(page, OPERADOR_MOCK);
    await irA(page, LISTADO);
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });

    await page
      .getByTestId('tabla-fila')
      .filter({ hasText: 'CLM-2026-0185' })
      .getByTestId('claim-link')
      .click();

    await expect(page.getByTestId('insurance-contact-absent')).toBeVisible();
    await expect(page.getByTestId('insurance-contact-absent')).toContainText(
      'no registró canales de contacto',
    );
    await expect(page.getByTestId('insurance-contact-channels').locator('a')).toHaveCount(0);
  });

  for (const viewport of VIEWPORTS) {
    test(`CA-2.5: objetivos táctiles y sin desborde en ${viewport.width} px`, async ({ page }, info) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, OPERADOR_MOCK);
      await irA(page, LISTADO);
      await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });

      await page
        .getByTestId('tabla-fila')
        .filter({ hasText: 'CLM-2026-0177' })
        .getByTestId('claim-link')
        .click();
      const whatsapp = page.getByTestId('btn-whatsapp-claim');
      await expect(whatsapp).toBeVisible();
      const callCenter = page.getByTestId('btn-call-center-phone');
      await expect(callCenter).toBeVisible();

      const minimo = altoMinimoTactil(viewport.width);
      for (const [nombre, objetivo] of [
        ['btn-whatsapp-claim', whatsapp],
        ['btn-call-center-phone', callCenter],
      ] as const) {
        const caja = await objetivo.boundingBox();
        expect(caja!.height, `alto de ${nombre} en ${viewport.width}px`).toBeGreaterThanOrEqual(
          minimo,
        );
        expect(caja!.width, `ancho de ${nombre} en ${viewport.width}px`).toBeGreaterThanOrEqual(
          minimo,
        );
      }

      await screenshotWithoutOverflow(page, info, `contacto-detalle-${viewport.width}`);
    });
  }
});

test.describe('la tarjeta de cobertura en /my-account (maqueta)', () => {
  for (const width of [390, 1440] as const) {
    test(`CA-2.1/2.5: la tarjeta ofrece los mismos canales, medibles, en ${width} px`, async ({
      page,
      context,
    }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await interceptarWaMe(context);
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account');
      await page.getByRole('tab', { name: 'Seguros y tutores' }).click();

      const whatsapp = page.getByTestId('btn-whatsapp-coverage').first();
      await expect(whatsapp).toBeVisible();
      const href = await whatsapp.getAttribute('href');
      expect(href).toContain('https://wa.me/59170000101?text=');
      await expect(whatsapp).toHaveAttribute('target', '_blank');
      await expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

      const caja = await whatsapp.boundingBox();
      const minimo = altoMinimoTactil(width);
      expect(caja!.height, `alto de btn-whatsapp-coverage en ${width}px`).toBeGreaterThanOrEqual(
        minimo,
      );
      expect(caja!.width, `ancho de btn-whatsapp-coverage en ${width}px`).toBeGreaterThanOrEqual(
        minimo,
      );

      const popupClic = await abrirPopup(context, () => whatsapp.click());
      await expect(popupClic).toHaveURL(/wa\.me\/59170000101\?text=/);
      await popupClic.close();

      await whatsapp.focus();
      const popupEspacio = await abrirPopup(context, () => page.keyboard.press('Space'));
      await expect(popupEspacio).toHaveURL(/wa\.me\/59170000101\?text=/);
      await popupEspacio.close();

      const callCenter = page.getByTestId('btn-call-center-coverage').first();
      await expect(callCenter).toBeVisible();
      await expect(callCenter).toHaveAttribute('href', 'tel:800100101');

      await screenshotWithoutOverflow(page, info, `contacto-tarjeta-${width}`);
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

  test('rechaza un WhatsApp de menos de 8 dígitos (Tarea 2, CA-2.4)', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const carriers = await admin.api.get('/insurance-carriers');
    const { items } = (await carriers.json()) as { items: { id: string }[] };
    const carrierId = items[0]!.id;

    const rechazado = await admin.api.put(`/insurance-carriers/${carrierId}/contact-channels`, {
      data: { whatsappNumber: '+5917154', callCenterPhone: null, supportEmail: null },
    });
    expect(rechazado.status()).toBe(400);

    const aceptado = await admin.api.put(`/insurance-carriers/${carrierId}/contact-channels`, {
      data: { whatsappNumber: '+59171548', callCenterPhone: null, supportEmail: null },
    });
    expect(aceptado.ok()).toBe(true);

    await admin.api.dispose();
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
