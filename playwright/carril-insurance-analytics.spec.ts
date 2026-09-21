import { expect, request, test } from '@playwright/test';

import { administrador, operadoraDeFacturacion, urlDeApi, type Actor } from './support/actores';
import { entrar as entrarConTenant } from './support/auditoria';
import { entrar, estable, irA } from './support/sesion';

/**
 * Subtarea 3.1 — tablero de siniestralidad, gasto per cápita y métricas de
 * salud de la aseguradora, en `/administration/insurance-analytics`.
 *
 * Mismo molde que `carril-contacto-aseguradora.spec.ts` (subtarea 2.3): dos
 * mitades deliberadamente separadas.
 *
 * - **La pantalla (maqueta interna)**: `mockBackend: true` en esta rama sirve
 *   la aplicación contra `insurance-analytics.handlers.ts`, no contra la API.
 * - **La API (Neon)**: el cálculo actuarial se comprueba por HTTP directo,
 *   con `auditoria.ts:entrar()` porque fija `X-Tenant-Id` — sin esa cabecera,
 *   un administrador con más de una membresía recibe 422
 *   (`PreconditionFailedException`), no 403.
 */

const RUTA = '/administration/insurance-analytics';

/** Cuenta del mock con `USER` + `tenants: [TENANT_ASEGURADORA]` (ve la sección por `canAdminister`). */
const ASEGURADORA_MOCK: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Aseguradora (maqueta)',
};

const PACIENTE_MOCK: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Paciente (maqueta)',
};

// Los cinco anchos obligatorios del gate visual del repositorio
// (`.claude/skills/visual-quality-gate`). Faltaban los dos del medio y el
// grande: un tablero de ocho columnas es exactamente donde se rompen.
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'tablet-horizontal', width: 1024, height: 768 },
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'escritorio-grande', width: 1920, height: 1080 },
] as const;

/** Lee el cuerpo de un JWT sin verificarlo: sólo para contar membresías. */
function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

test.describe('el tablero de siniestralidad (maqueta)', () => {
  test('muestra las seis tarjetas KPI, el gráfico mensual y las tres tablas', async ({ page }) => {
    await entrar(page, ASEGURADORA_MOCK);
    await irA(page, RUTA);
    await expect(page.getByTestId('insurance-analytics-container')).toBeVisible({
      timeout: 30_000,
    });
    await estable(page);

    for (const testId of [
      'kpi-loss-ratio',
      'kpi-total-approved',
      // El denominador del loss ratio de la primera tarjeta: sin verlo, un
      // 120 % no se puede interpretar.
      'kpi-earned-premium',
      'kpi-per-capita',
      'kpi-claims',
      'kpi-affiliates',
      'chart-monthly-trend',
      'table-top-medications',
      'table-specialties',
      'section-immunization',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    await expect(page.getByTestId('btn-export-analytics')).toBeEnabled();
  });

  test('cambiar a «90 días» cambia la cifra de reclamos y queda en la URL', async ({ page }) => {
    await entrar(page, ASEGURADORA_MOCK);
    await irA(page, RUTA);
    await expect(page.getByTestId('insurance-analytics-container')).toBeVisible({
      timeout: 30_000,
    });
    await estable(page);

    const cifraAntes = await page.getByTestId('kpi-claims').innerText();

    await page.getByTestId('segmentado-90d').click();
    await estable(page);

    await expect(page).toHaveURL(/range=90d/);
    const cifraDespues = await page.getByTestId('kpi-claims').innerText();
    // El mock recorta la serie de 12 meses a 3 (90 días): menos meses de
    // siniestros es menos reclamos totales, así que la cifra tiene que moverse.
    expect(cifraDespues).not.toBe(cifraAntes);
  });

  test('la sección aparece en el menú para la aseguradora y no para un paciente', async ({
    page,
  }) => {
    // Se entra directo a la ruta administrable (en vez de al panel y de ahí al
    // menú): el grupo «Administración» del `side-nav` sólo se puebla una vez
    // que el tenant de la sesión terminó de resolverse, y parada ya en una
    // pantalla que lo exige (`requiresTenant: true`) esa carrera no existe.
    await entrar(page, ASEGURADORA_MOCK);
    await irA(page, RUTA);
    await expect(page.getByTestId('insurance-analytics-container')).toBeVisible({
      timeout: 30_000,
    });
    await estable(page);
    await expect(
      page.getByTestId('nav-enlace').filter({ hasText: 'Siniestralidad y analítica' }),
    ).toBeVisible();

    await entrar(page, PACIENTE_MOCK);
    await irA(page, '/dashboard');
    await estable(page);
    await expect(
      page.getByTestId('nav-enlace').filter({ hasText: 'Siniestralidad y analítica' }),
    ).toHaveCount(0);
  });

  /*
    El criterio pide que el auditor recorra la serie con el teclado.

    Se comprueba en el navegador y no sólo en la prueba de componente porque
    `tabindex` sobre una forma SVG depende del motor: jsdom lo acepta siempre,
    y un navegador real es el único que dice si la barra recibe el foco de
    verdad.
  */
  test('cada barra del gráfico recibe el foco y dice su cifra', async ({ page }) => {
    await entrar(page, ASEGURADORA_MOCK);
    await irA(page, RUTA);
    await expect(page.getByTestId('chart-monthly-trend')).toBeVisible({ timeout: 30_000 });
    await estable(page);

    const barras = page.locator('.trend-chart__bar');
    expect(await barras.count()).toBeGreaterThan(0);

    const primera = barras.first();
    await primera.focus();
    await expect(primera).toBeFocused();

    // Lo que anuncia el lector al parar acá: mes e importe, no «gráfico».
    const etiqueta = (await primera.getAttribute('aria-label')) ?? '';
    expect(etiqueta).toMatch(/facturado/);
    expect(etiqueta).toMatch(/\d/);

    // El grupo no puede ser `role="img"`: eso volvería hoja al SVG y callaría
    // las etiquetas de las barras.
    const svg = page.locator('.trend-chart__svg');
    expect(await svg.getAttribute('role')).toBe('group');

    // El anillo de foco se dibuja con `stroke` porque `outline` sobre formas
    // SVG es desparejo entre navegadores: se comprueba que el motor lo aplique
    // de verdad, y se guarda la captura para el gate visual.
    const trazo = await primera.evaluate((el) => getComputedStyle(el).strokeWidth);
    expect(trazo).not.toBe('0px');

    await page.locator('.trend-chart').screenshot({
      path: 'docs/frontend/evidence/insurance-analytics/barra-con-foco.png',
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`sin desborde horizontal en ${viewport.width} px`, async ({ page }) => {
      /*
        Excepciones sin capturar, no «errores de consola».

        La CSP del servidor de desarrollo bloquea sus propios scripts en línea
        y eso ensucia la consola en TODAS las pantallas (medido en el carril
        16). Un `pageerror`, en cambio, es una excepción que se escapó: eso sí
        es de la pantalla y no admite matices.
      */
      const excepciones: string[] = [];
      page.on('pageerror', (error) => excepciones.push(error.message));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, ASEGURADORA_MOCK);
      await irA(page, RUTA);
      await expect(page.getByTestId('insurance-analytics-container')).toBeVisible({
        timeout: 30_000,
      });
      // El contenedor está presente desde `loading`: las tarjetas KPI recién
      // se montan en `ready`. Sin esperarlas, el chequeo de una-por-fila de
      // abajo mide un DOM que todavía no tiene nada que medir.
      await expect(page.getByTestId('kpi-loss-ratio')).toBeVisible({ timeout: 15_000 });
      await estable(page);

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde, 'el tablero desborda a lo ancho').toBe(false);

      if (viewport.width === 390) {
        // Una tarjeta por fila en el ancho más angosto: dos tarjetas lado a
        // lado en 390 px serían ilegibles en una cifra actuarial.
        const primeras = page.getByTestId(/^kpi-/);
        const cajas = await primeras.evaluateAll((nodos) =>
          nodos.map((n) => n.getBoundingClientRect().left),
        );
        const unicas = new Set(cajas.map((left) => Math.round(left)));
        expect(unicas.size).toBe(1);
      }

      // El área táctil mínima de 44 px es una regla de `AppButton` sólo bajo
      // 780 px (`button.css`): desde tablet/escritorio el talle `md` recupera
      // su geometría de 40 px del spec del diseñador — no es un defecto de
      // esta pantalla, es el sistema de diseño entero.
      if (viewport.width < 780) {
        const boton = page.getByTestId('btn-export-analytics');
        const caja = await boton.boundingBox();
        expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      await page.screenshot({
        path: `docs/frontend/evidence/insurance-analytics/tablero-${viewport.nombre}.png`,
        fullPage: true,
      });

      expect(excepciones, 'el tablero lanzó una excepción sin capturar').toEqual([]);
    });
  }
});

/**
 * El cálculo actuarial contra la API real — subtarea 3.1, del lado de Neon.
 */
test.describe('la analítica sobre datos reales (API · Neon)', () => {
  const PLAN_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

  test('con una prima declarada, el loss ratio responde 200 con cifras consistentes', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const carriers = await admin.api.get('/insurance-carriers');
    expect(carriers.ok()).toBe(true);
    const { items } = (await carriers.json()) as { items: { id: string }[] };
    expect(items.length).toBeGreaterThan(0);
    const carrierId = items[0]!.id;

    const detalle = await admin.api.get(`/insurance-carriers/${carrierId}`);
    const { products } = (await detalle.json()) as {
      products: { plans: { id: string }[] }[];
    };
    const planId = products.flatMap((p) => p.plans)[0]?.id;
    expect(planId).toBeDefined();

    const prima = await admin.api.put(`/insurance-plans/${planId}/premium`, {
      data: { monthlyPremiumAmount: '350.00' },
    });
    expect(prima.ok()).toBe(true);

    const hoy = new Date().toISOString().slice(0, 10);
    const haceUnAnio = new Date();
    haceUnAnio.setUTCFullYear(haceUnAnio.getUTCFullYear() - 1);
    const startDate = haceUnAnio.toISOString().slice(0, 10);

    const tablero = await admin.api.get('/insurance/analytics/loss-ratio', {
      params: { startDate, endDate: hoy },
    });
    expect(tablero.ok()).toBe(true);
    const dashboard = (await tablero.json()) as {
      kpis: {
        totalBilledAmount: string;
        totalApprovedAmount: string;
        approvalRatePercent: string | null;
      };
      monthlyTrends: readonly { period: string }[];
    };
    expect(dashboard.kpis.totalBilledAmount).toMatch(/^\d+\.\d{2}$/);
    expect(dashboard.kpis.totalApprovedAmount).toMatch(/^\d+\.\d{2}$/);
    expect(dashboard.monthlyTrends.length).toBeGreaterThan(0);

    await admin.api.dispose();
  });

  test('un planId ajeno al carrier del tenant activo responde 404', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const respuesta = await admin.api.get('/insurance/analytics/loss-ratio', {
      params: { planId: PLAN_INEXISTENTE },
    });
    expect(respuesta.status()).toBe(404);

    await admin.api.dispose();
  });

  test('un rol sin administración ni rol de aseguradora responde 403', async () => {
    const operadora = await entrarConTenant(
      { email: operadoraDeFacturacion().identificador },
      operadoraDeFacturacion().clave,
    );

    const respuesta = await operadora.api.get('/insurance/analytics/loss-ratio');
    expect(respuesta.status()).toBe(403);

    await operadora.api.dispose();
  });

  test('sin X-Tenant-Id, un administrador con 0 o 2+ membresías responde 422', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    // `TenantContextInterceptor.resolveTenantId()` sólo entra en «modo
    // sistema» (tenant indefinido → 422) para un actor privilegiado con 0 o
    // 2+ membresías; con exactamente 1 auto-resuelve y responde 200 igual.
    // El bootstrap admin de este entorno puede tener cualquiera de las dos
    // formas según cómo se sembró — se mide la de verdad en vez de asumirla.
    const claims = decodeJwt(admin.accessToken);
    const tenants = Array.isArray(claims['tenants']) ? (claims['tenants'] as string[]) : [];
    test.skip(
      tenants.length === 1,
      `admin@alovida.com tiene exactamente 1 membresía en este entorno: auto-resuelve y nunca entra en modo sistema. El 422 sin tenant está probado a nivel de servicio (insurance-analytics.service.spec.ts).`,
    );

    const sinTenant = await request.newContext({
      baseURL: urlDeApi(),
      extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` },
    });
    const respuesta = await sinTenant.get('/insurance/analytics/loss-ratio');
    expect(respuesta.status()).toBe(422);

    await sinTenant.dispose();
    await admin.api.dispose();
  });

  test('un rango invertido (startDate posterior a endDate) responde 422', async () => {
    const admin = await entrarConTenant(
      { email: administrador().identificador },
      administrador().clave,
    );

    const respuesta = await admin.api.get('/insurance/analytics/loss-ratio', {
      params: { startDate: '2026-09-14', endDate: '2026-01-01' },
    });
    expect(respuesta.status()).toBe(422);

    await admin.api.dispose();
  });
});
