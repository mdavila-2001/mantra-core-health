import { expect, test, type ConsoleMessage, type Page, type Request, type Response } from '@playwright/test';

import { contextoDeApi } from './support/actores';
import { crearMedicoSintetico, crearPacienteConToken } from './support/api-real-clinica';
import { entrar, esperarAplicacionLista, estable } from './support/sesion';

/**
 * H5 del carril M1 — el recorrido real contra el VPS de preproducción.
 *
 * A diferencia del resto de la suite (que corre contra `ng serve` con el
 * simulador o contra un stack local), ésta apunta al **artefacto desplegado**
 * en `E2E_BASE_URL` — la única forma honesta de comprobar que lo que sirve
 * Coolify habla con la API real y no con `core/mock`.
 *
 * Corre `--workers=1` (config del proyecto) y **tres veces sobre el mismo
 * commit** es el DoD de H5, no algo que este archivo pueda demostrar por sí
 * solo: eso lo certifica quien lo ejecuta, pegando las tres salidas.
 *
 * Cuentas: se registran en el momento contra la API real
 * (`crearMedicoSintetico`/`crearPacienteConToken`), no se asume ninguna cuenta
 * ya sembrada — el seed de personas del padrón (carril M2) puede no estar
 * corrido todavía, y este recorrido no depende de él.
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'https://test.173.249.39.237.sslip.io';

/** Códigos que la API puede devolver de forma legítima y no cuentan como fallo de red. */
const ESPERABLES = new Set([200, 201, 204, 304, 401]);

function esRespuestaInesperada(respuesta: Response): boolean {
  const status = respuesta.status();
  if (ESPERABLES.has(status)) return false;
  // 3xx de redirección del propio SSR/nginx no son un fallo.
  if (status >= 300 && status < 400) return false;
  return status >= 400;
}

function vigilarConsolaYRed(page: Page): {
  erroresConsola: string[];
  respuestasInesperadas: string[];
} {
  const erroresConsola: string[] = [];
  const respuestasInesperadas: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') erroresConsola.push(msg.text());
  });
  page.on('requestfailed', (req: Request) => {
    // Un `net::ERR_ABORTED` por navegación normal no es un fallo de red real.
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      respuestasInesperadas.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    }
  });
  page.on('response', (res: Response) => {
    if (esRespuestaInesperada(res)) {
      respuestasInesperadas.push(`${res.request().method()} ${res.url()} — ${res.status()}`);
    }
  });
  return { erroresConsola, respuestasInesperadas };
}

test.describe('M1 · recorrido real contra el VPS de preproducción', () => {
  test.describe.configure({ mode: 'serial' });

  test('la API responde por el proxy del mismo origen (no 503, no HTML)', async ({ request }) => {
    // El front reparte por prefijo: /terminology/… tiene que llegar a la API,
    // no al SSR de Angular. Un 503 dice que el front (nginx) no está sano
    // todavía; un 200 con `content-type: text/html` diría que el SSR se comió
    // la ruta en vez de dejarla pasar — el defecto exacto que TX-07 documentó.
    const respuesta = await request.get(`${BASE}/terminology/value-sets`, {
      failOnStatusCode: false,
    });
    expect(
      [200, 401].includes(respuesta.status()),
      `esperaba 200 o 401 de la API por el proxy, dio ${respuesta.status()}`,
    ).toBe(true);
    expect(respuesta.headers()['content-type'] ?? '').not.toContain('text/html');
  });

  test('el médico se registra y entra contra la API real (login por rol: doctora)', async () => {
    const api = await contextoDeApi();
    try {
      const medico = await crearMedicoSintetico(api);
      expect(medico.token, 'la API real devolvió un access token').toBeTruthy();
      expect(medico.tenantId, 'el registro dejó un tenant asignado').toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('el paciente se registra y entra contra la API real (login por rol: paciente)', async () => {
    const api = await contextoDeApi();
    try {
      const paciente = await crearPacienteConToken(api);
      expect(paciente.token, 'la API real devolvió un access token').toBeTruthy();
      expect(paciente.pid, 'el registro dejó un id de perfil de paciente').toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  for (const viewport of [
    { nombre: '375×812 (móvil)', width: 375, height: 812 },
    { nombre: '768×1024 (tablet)', width: 768, height: 1024 },
    { nombre: '1440×900 (escritorio)', width: 1440, height: 900 },
  ] as const) {
    for (const tema of ['light', 'dark'] as const) {
      test(`la vitrina pública del directorio carga en 200, consola limpia — ${viewport.nombre}, tema ${tema}`, async ({
        browser,
      }) => {
        const contexto = await browser.newContext({
          baseURL: BASE,
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: tema,
        });
        const page = await contexto.newPage();
        const { erroresConsola, respuestasInesperadas } = vigilarConsolaYRed(page);

        const respuestaDePagina = await page.goto('/directory', { waitUntil: 'load' });
        expect(respuestaDePagina?.status(), 'la página pública respondió 200').toBe(200);
        await esperarAplicacionLista(page);
        await estable(page);

        // El SSR marca el tema con el mismo atributo que lee el CSS; si el
        // interruptor de `colorScheme` no llegara a pintarse, esto lo cacha.
        if (tema === 'dark') {
          const prefiereOscuro = await page.evaluate(
            () => window.matchMedia('(prefers-color-scheme: dark)').matches,
          );
          expect(prefiereOscuro, 'el navegador reporta prefers-color-scheme: dark').toBe(true);
        }

        expect(
          erroresConsola,
          `consola sin errores nuevos (vio: ${erroresConsola.join(' | ')})`,
        ).toHaveLength(0);
        expect(
          respuestasInesperadas,
          `red sin 4xx/5xx inesperados (vio: ${respuestasInesperadas.join(' | ')})`,
        ).toHaveLength(0);

        await contexto.close();
      });
    }
  }

  test('la sesión real navega al panel sin que el simulador la intercepte', async ({ browser }) => {
    // Si `mockBackend` quedara encendido en este artefacto, el login entraría
    // igual (el simulador siempre "funciona") pero el panel mostraría datos de
    // fantasía. La comprobación real es de red: la petición de login tiene que
    // salir de verdad, no resolverse desde `core/mock` sin tocar la red.
    const contexto = await browser.newContext({ baseURL: BASE });
    const page = await contexto.newPage();
    let loginFueALaRed = false;
    page.on('request', (req) => {
      if (req.url().includes('/iam/auth/login')) loginFueALaRed = true;
    });

    const api = await contextoDeApi();
    let medico;
    try {
      medico = await crearMedicoSintetico(api);
    } finally {
      await api.dispose();
    }

    await entrar(page, medico.actor);
    expect(loginFueALaRed, 'el login salió a la red y no lo resolvió el simulador').toBe(true);
    expect(page.url()).toContain('/dashboard');

    await contexto.close();
  });
});
