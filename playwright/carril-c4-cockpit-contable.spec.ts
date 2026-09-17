import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, crearPaciente, doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril C.4 — cockpit contable conectado a la API real.
 *
 * ## Qué cubre
 *
 * El cockpit (`/administration/accounting`) lee 9 endpoints reales desde el
 * PR #403; esta suite lo verifica contra la API viva, no contra el
 * interceptor mock: (a) datos sembrados por API, (b) la tarjeta del ejercicio
 * sin ejercicio fiscal, (c) el 403 de un paciente por los GET
 * `/accounting/*`. Sigue la forma de `carril-20-contabilidad.spec.ts`:
 * `apiViva()` + `test.skip`, un `entrar()` por rol, capturas en
 * `artifacts/playwright/`. Las peticiones API van por `contextoDeApi()` —el
 * `baseURL` del fixture `request` de Playwright es el FRONT
 * (`playwright.config.ts:43`), no la API.
 */

const RUTA_COCKPIT = '/administration/accounting';
const ANCHOS = [
  { nombre: '390x844 (móvil)', width: 390, height: 844 },
  { nombre: '1440x900 (escritorio)', width: 1440, height: 900 },
] as const;

function decodificarJwt(token: string): Record<string, unknown> {
  const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as Record<string, unknown>;
}

async function capturar(page: Page, nombre: string): Promise<void> {
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho.width, height: ancho.height });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `artifacts/playwright/carril-c4/${nombre}-${ancho.width}.png`,
      fullPage: true,
    });
  }
}

/** Inicia sesión contra la API (no el front) y devuelve el JWT. */
async function iniciarSesionApi(
  api: APIRequestContext,
  identificador: string,
  clave: string,
): Promise<string> {
  // El paciente entra con documento (`nationalId`), no con correo: `LoginDto` acepta uno u otro.
  const campo = identificador.includes('@') ? 'email' : 'nationalId';
  const sesion = await api.post('/iam/auth/login', {
    data: { [campo]: identificador, password: clave },
  });
  expect(sesion.ok(), `login de ${identificador}`).toBeTruthy();
  const { accessToken } = (await sesion.json()) as { accessToken: string };
  return accessToken;
}

test.describe('Carril C.4 · cockpit contable — API real', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    await api.dispose();
    test.skip(!viva, 'La API no responde: no hay cockpit que auditar.');
  });

  test('siembra por API, pinta el cockpit con datos, y el paciente no ve nada', async ({ page }) => {
    test.setTimeout(180_000);
    const api = await contextoDeApi();
    const admin = administrador();

    try {
      const accessToken = await iniciarSesionApi(api, admin.identificador, admin.clave);
      const authAdmin = { Authorization: `Bearer ${accessToken}` };
      const { tenants } = decodificarJwt(accessToken) as { tenants?: string[] };
      const tenantId = tenants?.[0];
      expect(tenantId, 'El admin declara al menos un tenant').toBeTruthy();

      const practicas = await api.get('/practices', { headers: authAdmin });
      expect(practicas.ok(), 'GET /practices').toBeTruthy();
      const listaDePracticas = (await practicas.json()) as { id: string }[];
      const practiceId = listaDePracticas[0]?.id;
      expect(practiceId, 'Hay al menos una práctica para sembrar el ejercicio').toBeTruthy();

      /* ── (a) Sembrar por API: ejercicio, activo y devengo ────────────────
         Envuelto en try/catch, como el MODO CONTADOR de carril-20: un 409
         porque la práctica ya tiene ejercicio del año no debe tirar la
         suite entera — el cockpit igual tiene datos que mostrar. */
      let fiscalPeriodId: string | undefined;
      try {
        const ejercicio = await api.post('/accounting/fiscal-years', {
          headers: authAdmin,
          data: {
            practiceId,
            code: `EJ-C4-${Date.now()}`,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          },
        });
        if (ejercicio.ok()) {
          const cuerpo = (await ejercicio.json()) as {
            periods?: { id: string; status: string }[];
          };
          fiscalPeriodId = cuerpo.periods?.find((p) => p.status === 'OPEN')?.id;
        } else {
          console.log(
            '[carril-c4] no se abrió ejercicio (probablemente ya existe):',
            ejercicio.status(),
          );
        }
      } catch (fallo) {
        console.log('[carril-c4] siembra de ejercicio falló:', (fallo as Error).message);
      }

      try {
        const cuentas = await api.get('/accounting/accounts', {
          headers: authAdmin,
          params: { practiceId },
        });
        const { items: cuentasDisponibles } = (await cuentas.json()) as {
          items?: { id: string }[];
        };
        const [cuentaA, cuentaB] = cuentasDisponibles ?? [];
        if (cuentaA && cuentaB) {
          const activo = await api.post('/accounting/assets/capitalize', {
            headers: authAdmin,
            data: {
              practiceId,
              code: `ACT-C4-${Date.now()}`,
              name: 'Equipo de prueba C.4',
              acquisitionAccountId: cuentaA.id,
              offsetAccountId: cuentaB.id,
              acquisitionCost: '5000.00',
              acquisitionDate: '2026-01-15',
              usefulLifeMonths: 36,
            },
          });
          console.log('[carril-c4] capitalizar activo →', activo.status());

          if (fiscalPeriodId) {
            const devengo = await api.post('/accounting/accrual-objects', {
              headers: authAdmin,
              data: {
                tenantId,
                objectNumber: `DEV-C4-${Date.now()}`,
                expenseAccountId: cuentaA.id,
                accrualAccountId: cuentaB.id,
                totalAmount: '1200.00',
                schedule: [{ fiscalPeriodId, plannedAmount: '1200.00' }],
              },
            });
            console.log('[carril-c4] crear devengo →', devengo.status());
          }
        }
      } catch (fallo) {
        console.log('[carril-c4] siembra de activo/devengo falló:', (fallo as Error).message);
      }

      /* ── (b) El admin ve el cockpit con datos ──────────────────────────── */
      await entrar(page, admin);
      await irA(page, RUTA_COCKPIT);
      await estable(page);

      const pantalla = page.locator('app-accounting-cockpit');
      await expect(pantalla).toBeVisible();

      // `testId="cockpit-practica"` de `cockpit.html` es un atributo suelto
      // sobre `<app-select>` (el componente no lo declara como `input()` ni
      // lo reenvía como `data-testid`): cae como `testid`, no `data-testid`
      // El `<option>` además lleva el ÍNDICE
      // como valor, no el id del modelo (`select.html`), así que no hay value
      // por el que seleccionar — se toma el primer `app-select` de la barra
      // de contexto, mismo patrón que `carril-20-contabilidad.spec.ts`.
      const selectorDePractica = pantalla.locator('app-select').first().locator('select');
      if ((await selectorDePractica.count()) > 0) {
        await selectorDePractica.selectOption({ index: 1 });
        await estable(page);
      }

      await expect(pantalla.locator('[data-testid="tile-resultado"]')).toBeVisible();
      await capturar(page, 'cockpit-admin-con-datos');

      /* ── (c) La doctora ve el mismo cockpit (mismo trío de roles) ──────── */
      await entrar(page, doctora());
      await irA(page, RUTA_COCKPIT);
      await estable(page);
      await expect(page.locator('app-accounting-cockpit')).toBeVisible();
      await capturar(page, 'cockpit-doctora');

      /* ── (d) permisos — el paciente ni llega por URL, y por API los GET → 403 ── */
      const paciente = await crearPaciente(api);
      await entrar(page, paciente);
      await irA(page, RUTA_COCKPIT);
      await estable(page);
      // `seccionRolesGuard` rebota antes de renderizar el cockpit.
      await expect(page.locator('app-accounting-cockpit')).toHaveCount(0);

      const tokenPaciente = await iniciarSesionApi(api, paciente.identificador, paciente.clave);
      const authPaciente = { Authorization: `Bearer ${tokenPaciente}` };

      const rutasDeLosSeis = [
        '/accounting/fiscal-years',
        '/accounting/open-items',
        '/accounting/dimensions',
        '/accounting/assets',
        '/accounting/accrual-objects',
      ] as const;
      for (const ruta of rutasDeLosSeis) {
        const respuesta = await api.get(ruta, {
          headers: authPaciente,
          params: { practiceId },
        });
        expect(respuesta.status(), `${ruta} con sesión de paciente`).toBe(403);
      }
    } finally {
      await api.dispose();
    }
  });

  test('práctica sin ejercicio fiscal: la tarjeta muestra la acción y el resto sigue con datos', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const api = await contextoDeApi();
    const admin = administrador();

    try {
      const accessToken = await iniciarSesionApi(api, admin.identificador, admin.clave);
      const authAdmin = { Authorization: `Bearer ${accessToken}` };
      const { tenants } = decodificarJwt(accessToken) as { tenants?: string[] };
      const tenantId = tenants?.[0];

      // Una práctica nueva, dada de alta ahora, no tiene ejercicio fiscal
      // todavía: es el caso S3 que la tarjeta del ejercicio tiene que
      // degradar sola, sin arrastrar las otras ocho lecturas. `code`/`name`
      // se fijan ANTES del alta para poder construir el rótulo del
      // `<option>` (`${code} · ${name}`, ver `opcionesDePractica` de
      // `cockpit.ts`) sin depender de leerlo de vuelta.
      const codigoDeLaPractica = `PRAC-C4-${Date.now()}`;
      const nombreDeLaPractica = 'Práctica sin ejercicio C.4';
      const practicaNueva = await api.post('/practices', {
        headers: authAdmin,
        data: {
          tenantId,
          code: codigoDeLaPractica,
          name: nombreDeLaPractica,
        },
      });
      test.skip(
        !practicaNueva.ok(),
        'No se pudo crear una práctica nueva para el caso sin ejercicio.',
      );

      await entrar(page, admin);
      await irA(page, RUTA_COCKPIT);
      await estable(page);

      const pantalla = page.locator('app-accounting-cockpit');
      // Mismo motivo que en el otro test: `testId` no llega al DOM como
      // `data-testid`, y el `<option>` no lleva el id de la práctica como
      // `value` — se ubica el `<select>` por posición y se elige por el
      // rótulo visible, esperando primero a que la opción exista (la
      // práctica se creó recién por API, justo antes de este `entrar`).
      const selectorDePractica = pantalla.locator('app-select').first().locator('select');
      const rotulo = `${codigoDeLaPractica} · ${nombreDeLaPractica}`;
      await expect(selectorDePractica.locator('option', { hasText: rotulo })).toHaveCount(1, {
        timeout: 20_000,
      });
      await selectorDePractica.selectOption({ label: rotulo });

      await expect(pantalla.locator('[data-testid="fiscal-year-empty"]')).toBeVisible();
      await expect(pantalla.locator('[data-testid="fiscal-year-retry"]')).toBeVisible();
      await capturar(page, 'cockpit-sin-ejercicio');
    } finally {
      await api.dispose();
    }
  });
});
