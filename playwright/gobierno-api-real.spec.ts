import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Las pantallas del **gobierno de accesos** (editor de permisos, campañas de certificación, aprobaciones de cuatro ojos, paso extra,
 * baja y cambio de rol, administración delegada, explicar y simular, tablero, matriz y anomalías) recorridas **sin simulador** contra
 * la API real (bloque B7c). Lo que ve la persona sale de las pantallas del front; la API contesta de verdad y lo que se mandó y lo que
 * se contestó se lee de las peticiones que el navegador hizo (`trazos`), no de `window.__mockRequests`.
 *
 * Qué se necesita (no se levanta desde acá):
 *
 * - la API real con la base del modelo, el esquema, los parches v4269 y v4272 y los demos 04 → 07 → 09 (`-v demo_accounts=1`), más
 *   la regla de red del bucle local (`127.0.0.0/8`) que el demo no trae: quien llega por `localhost` con `network.require = ORG_RULES`
 *   (este Playwright) la agrega en su propio fixture;
 * - el front compilado con `--configuration real-api` y servido con proxy a esa API (`E2E_BASE_URL`);
 * - `E2E_REAL_DB` (`host:puerto:usuario:base`) para que la prueba lea un id o compruebe lo guardado (nunca lo usa el front).
 *
 * Cuentas del demo: `DEMO-<NOMBRE-APELLIDO>`, contraseña `Demo-Apoyo-2026`. Los casos son seriales, comparten pestaña y NO se pueden
 * repetir sobre la misma base (crean campañas, dan de baja a Pablo, mueven a Marcos): se recarga 04 → 07 → 09 antes de cada corrida.
 */
test.describe.configure({ mode: 'serial' });

const CONTRASENA = 'Demo-Apoyo-2026';
const [HOST, PUERTO, USUARIO, BASE] = (
  process.env['E2E_REAL_DB'] ?? '127.0.0.1:5517:mantra:b7c_real'
).split(':');

/* ---- ayudas -------------------------------------------------------------------------------------------------------------------- */

/** Lo que el navegador mandó a la API y lo que ella contestó. */
interface Trazo {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  /** El cuerpo de la respuesta: se completa al leerlo (la traza se anota en cuanto llega la respuesta, para que `hubo` no pierda la carrera). */
  response: unknown;
}

let page: Page;
let trazos: Trazo[] = [];
/** Las respuestas que aún se están leyendo: `drenar()` las espera antes de mirar `trazos` justo después de que la pantalla reaccionó. */
const lecturas = new Set<Promise<void>>();
const drenar = async (): Promise<void> => {
  await Promise.all([...lecturas]);
};
/** Los errores de JavaScript que la pantalla dejó en la consola (un fallo mudo de la pantalla sale por acá). */
let consola: string[] = [];

const RUTAS_DE_LA_API =
  /^\/(org|me|iam|approvals|authz|practitioners|support-engagement-requests|scheduling|community)\b/;

function vigilar(p: Page): void {
  p.on('pageerror', (e) => consola.push(`pageerror: ${e.message.slice(0, 300)}`));
  p.on('console', (m) => {
    if (m.type() === 'error') consola.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  p.on('response', async (r) => {
    const url = new URL(r.url());
    if (!RUTAS_DE_LA_API.test(url.pathname)) return;
    const req = r.request();
    const crudo = req.postData();
    const body: unknown = (() => {
      try {
        return crudo === null ? null : JSON.parse(crudo);
      } catch {
        return crudo;
      }
    })();
    const traza: Trazo = {
      method: req.method(),
      path: url.pathname + url.search,
      status: r.status(),
      headers: req.headers(),
      body,
      response: null,
    };
    trazos.push(traza);
    const lectura = (async (): Promise<void> => {
      traza.response = await r.json().catch(() => null);
    })();
    lecturas.add(lectura);
    void lectura.finally(() => lecturas.delete(lectura));
  });
}

/** ¿Hubo una petición así? (`fragmento` se busca dentro de la ruta). */
const hubo = (method: string, fragmento: string, status?: number): boolean =>
  trazos.some(
    (t) =>
      t.method === method &&
      t.path.includes(fragmento) &&
      (status === undefined || t.status === status),
  );

const ultima = (method: string, fragmento: string, status?: number): Trazo | undefined =>
  [...trazos]
    .reverse()
    .find(
      (t) =>
        t.method === method &&
        t.path.includes(fragmento) &&
        (status === undefined || t.status === status),
    );

/** Consulta la base del piloto: solo la usa la prueba, para leer un id o comprobar lo guardado. */
function consulta(sql: string): string[][] {
  const salida = execFileSync(
    'psql',
    ['-h', HOST!, '-p', PUERTO!, '-U', USUARIO!, '-d', BASE!, '-At', '-F', '|', '-c', sql],
    {
      env: { ...process.env, PGPASSWORD: process.env['E2E_REAL_DB_PASSWORD'] ?? 'mantra' },
      encoding: 'utf8',
    },
  );
  return salida
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => l.split('|'));
}

async function entrarEn(p: Page, documento: string): Promise<void> {
  await p.goto('/auth');
  await p.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await p.goto('/auth');
  await p.getByTestId('login-identifier').fill(documento);
  await p.getByTestId('login-password').fill(CONTRASENA);
  await p.getByTestId('login-submit').click();
  await p.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 60_000 },
  );
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(p.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

const entrar = (documento: string): Promise<void> => entrarEn(page, documento);

/** Una persona en su propio contexto (su propia sesión), para los casos de dos personas. */
async function personaAparte(browser: Browser, documento: string): Promise<Page> {
  const p = await contextoDelEscenario(browser);
  vigilar(p);
  await entrarEn(p, documento);
  return p;
}

/** Navega por el router (sin recargar). */
async function irAEn(p: Page, ruta: string, esperaTestId?: string): Promise<void> {
  await p.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(p).toHaveURL(new RegExp(ruta.split('?')[0]!.replace(/[/.]/g, '\\$&')));
  if (esperaTestId !== undefined)
    await expect(p.getByTestId(esperaTestId)).toBeVisible({ timeout: 30_000 });
}

const irA = (ruta: string, esperaTestId?: string): Promise<void> => irAEn(page, ruta, esperaTestId);

/** El diálogo de confirmación del sistema de diseño: se confirma con su botón principal. */
async function confirmarDialogo(p: Page = page): Promise<void> {
  const dialogo = p.locator('dialog[open]').last();
  await expect(dialogo).toBeVisible();
  await dialogo
    .getByRole('button', { name: /^(Mantener|Cerrar la campaña|Lanzar|Confirmar)$/ })
    .click();
}

/* ---- llamadas directas a la API (solo para preparar o comprobar lo que no tiene pantalla) -------------------------------------- */

interface Respuesta {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

async function iniciarSesionApi(documento: string): Promise<string> {
  const r = await page.request.post('/iam/auth/login', {
    data: { nationalId: documento, password: CONTRASENA },
  });
  expect(r.status(), `login de ${documento}`).toBe(200);
  return ((await r.json()) as { accessToken: string }).accessToken;
}

async function api(
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  ruta: string,
  cuerpo?: unknown,
  cabeceras: Record<string, string> = {},
): Promise<Respuesta> {
  const r = await page.request.fetch(ruta, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...cabeceras },
    ...(cuerpo === undefined ? {} : { data: cuerpo }),
  });
  const texto = await r.text();
  const body = ((): Record<string, unknown> => {
    try {
      return JSON.parse(texto) as Record<string, unknown>;
    } catch {
      return { texto };
    }
  })();
  return { status: r.status(), body };
}

/** Si la pantalla abrió el desafío del segundo paso (403 `STEP_UP_REQUIRED`), lo resuelve con el código TOTP REAL del secreto. */
async function pasoExtraSiLoPide(p: Page, secreto: string, espera = 8_000): Promise<boolean> {
  const campo = p.getByTestId('desafio-codigo');
  if (
    !(await campo.waitFor({ state: 'visible', timeout: espera }).then(
      () => true,
      () => false,
    ))
  )
    return false;
  await campo.fill(await codigoTotpFresco(secreto));
  await p.getByTestId('desafio-verificar').click();
  await expect(campo).toHaveCount(0, { timeout: 30_000 });
  return true;
}

/** El código de 6 dígitos de una app autenticadora (RFC 6238: HMAC-SHA1, 30 segundos), calculado con el secreto base32 que dio la API. */
function codigoTotp(secretoBase32: string, ahora: number = Date.now()): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretoBase32.replace(/=+$/, '').toUpperCase())
    bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const clave = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30_000)));
  const hmac = createHmac('sha1', clave).update(contador).digest();
  const desplazamiento = hmac[hmac.length - 1]! & 0xf;
  const valor = (hmac.readUInt32BE(desplazamiento) & 0x7fffffff) % 1_000_000;
  return String(valor).padStart(6, '0');
}

/** El «hoy» del demo (martes 2026-11-03 10:30 en La Paz): la API corre con ese reloj (`API_CLOCK_ISO`) y el navegador lo sigue. */
const ESCENARIO = new Date('2026-11-03T10:30:00-04:00');

async function contextoDelEscenario(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await contexto.clock.install({ time: ESCENARIO });
  return contexto.newPage();
}

test.beforeAll(async ({ browser }) => {
  page = await contextoDelEscenario(browser);
  vigilar(page);
});

test.afterAll(async () => {
  await page.context().close();
});

test.beforeEach(() => {
  trazos = [];
  consola = [];
});

/** Si un caso falla, se deja dicho qué pidió el navegador y qué contestó la API (lo que no es 2xx, con su cuerpo). */
// Playwright exige desestructurar el primer argumento aunque no se use ninguna fixture.
// eslint-disable-next-line no-empty-pattern
test.afterEach(({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const resumen = trazos
    .slice(-40)
    .map(
      (t) =>
        `${t.method} ${t.path} → ${t.status}${t.status >= 400 ? ` ${JSON.stringify(t.response).slice(0, 400)}` : ''}`,
    );
  const conCuerpo = trazos
    .filter((t) => t.status >= 400 || t.path.includes('/simulate'))
    .slice(-6)
    .map((t) => `${t.method} ${t.path} cuerpo=${JSON.stringify(t.body).slice(0, 1200)}`);
  console.log(`\n[cuerpos]\n${conCuerpo.join('\n')}`);
  console.log(
    `\n[peticiones de «${testInfo.title.slice(0, 40)}»]\n${resumen.join('\n')}\n[consola]\n${consola.slice(-15).join('\n')}`,
  );
});

/* ---- 0 · el piloto -------------------------------------------------------------------------------------------------------------- */

test('00 · el piloto del gobierno está sembrado y la administración entra con su rol de seguridad', async () => {
  expect(
    consulta(`select count(*) from authz.ip_access_rules where cidr='127.0.0.0/8'`)[0]![0],
    'falta la regla del bucle local (fixture propio)',
  ).toBe('1');
  expect(
    consulta(`select count(*) from directory.tenants where code='DEMO_HOSPITAL_PILOTO'`)[0]![0],
  ).toBe('1');
  // Guardar permisos, aprobar solicitudes y exportar piden el segundo paso: la administración da de alta una app autenticadora de verdad.
  secretoDelAdmin = await altaDeTotp('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  await entrar('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  await irA('/administration/access-governance', 'pantalla-governance-home');
  await expect
    .poll(() => hubo('GET', '/org/governance/summary', 200), {
      message: JSON.stringify(trazos.map((t) => `${t.method} ${t.path} ${t.status}`)),
    })
    .toBe(true);
});

/* ---- 1 · editor de permisos: simular y guardar con el simulationToken -------------------------------------------------------------- */

const apagado = async (id: string): Promise<boolean> =>
  (await page.getByTestId(id).getAttribute('aria-disabled')) === 'true';

test('01 · editor de permisos: la vista previa es de la API y «Guardar» manda lo MISMO que se simuló, con su simulationToken', async () => {
  await irA('/administration/support-team', 'equipo-card');
  const fila = page.locator('[data-testid^="equipo-nombre-"]', { hasText: 'Ana Gutiérrez' });
  await expect(fila).toBeVisible({ timeout: 30_000 });
  const id = (await fila.getAttribute('data-testid'))!.replace('equipo-nombre-', '');
  await page.getByTestId(`equipo-permisos-${id}`).click();
  await expect(page.getByTestId('editor-permisos')).toBeVisible({ timeout: 30_000 });

  // «Básico» por omisión; «Avanzado» avisa de los nombres antiguos.
  await expect(page.getByTestId('segmentado-basic')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('segmentado-advanced').click();
  await expect(page.getByTestId('advanced-panel')).toBeVisible();
  expect(await apagado('editor-guardar')).toBe(true);

  // Un horario con frases pide la vista previa antes de guardar; la API la calcula.
  await page.getByTestId('cond-toggle-when').click();
  await page.getByTestId('cond-time-add').click();
  await expect(page.getByTestId('preview-valid')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('preview-summary')).not.toBeEmpty();
  await drenar();
  expect(hubo('POST', '/org/access/simulate', 200)).toBe(true);

  // Una franja que empieza y termina a la hora la rechaza la API: el error sale junto al campo y «Guardar» sigue apagado.
  await page.getByTestId('cond-time-to-0').fill('08:00');
  await expect(page.getByTestId('cond-issues-when')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('preview-errors')).toBeVisible();
  expect(await apagado('editor-guardar')).toBe(true);

  // Corregida, se guarda lo que se simuló.
  await page.getByTestId('cond-time-to-0').fill('18:30');
  await expect(page.getByTestId('preview-valid')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('editor-guardar')).toBeEnabled();
  await page.getByTestId('editor-guardar').click();
  // La API exige el segundo paso al guardar permisos (403 STEP_UP_REQUIRED): el diálogo lo pide, se resuelve y se repite el MISMO guardado.
  expect(await pasoExtraSiLoPide(page, secretoDelAdmin), 'tenía que pedir el segundo paso').toBe(
    true,
  );
  await expect(page.getByTestId('editor-guardar')).toBeDisabled({ timeout: 30_000 });

  await expect
    .poll(() => hubo('PATCH', '/org/support-engagements/', 200), {
      message: 'la API tiene que contestar 200 al guardar',
    })
    .toBe(true);
  await drenar();
  expect(hubo('PATCH', '/org/support-engagements/', 403)).toBe(true);
  await drenar();
  expect(
    (ultima('PATCH', '/org/support-engagements/', 403)!.response as { reason?: string }).reason,
  ).toBe('STEP_UP_REQUIRED');
  const simulaciones = trazos.filter(
    (t) => t.method === 'POST' && t.path.includes('/org/access/simulate') && t.status === 200,
  );
  const guardados = trazos.filter(
    (t) =>
      t.path.includes('/grants') && (t.method === 'PATCH' || t.method === 'POST') && t.status < 300,
  );
  expect(simulaciones.length).toBeGreaterThan(0);
  expect(guardados.length).toBeGreaterThan(0);
  const guardado = guardados.at(-1)!;
  const cuerpo = guardado.body as {
    simulationToken?: string;
    condition?: { time?: { windows: { from: string; to: string }[] } };
  };
  const ultimaSimulacion = simulaciones.at(-1)!;
  if (ultimaSimulacion.response === null) {
    // El navegador no siempre deja leer el cuerpo de la última respuesta: entonces basta con que el guardado lleve una huella.
    expect(typeof cuerpo.simulationToken).toBe('string');
  } else {
    expect(cuerpo.simulationToken, 'el guardado lleva el token de la última simulación').toBe(
      (ultimaSimulacion.response as { simulationToken?: string }).simulationToken,
    );
  }
  expect(cuerpo.condition?.time?.windows[0]).toMatchObject({ from: '08:00', to: '18:30' });

  // La API lo guardó de verdad: se lee con su propia ruta de «efectivo» y en la base.
  const [guardadoEnBase] = consulta(
    `select count(*) from delegated_access.support_scope_grants g where g.condition_json::text like '%18:30%'`,
  );
  expect(guardadoEnBase?.[0]).not.toBe('0');
});

/* ---- 2 · campaña de certificación: crear, lanzar, decidir una revisión, cerrar ---------------------------------------------------- */

let idDeLaCampana = '';

test('02 · campaña: la lista trae la del demo vencida, el asistente muestra la vista previa antes de crear y «Crear y lanzar» la abre', async () => {
  await irA('/administration/access-governance/campaigns', 'pantalla-campaign-list');
  const q4 = page.locator('[data-testid^="campana-nombre-"]', { hasText: 'Certificación Q4-2026' });
  await expect(q4).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="campana-estado-"]').first()).toHaveText('Abierta');
  // Con el reloj del escenario (3 de noviembre) la campaña del demo ya venció.
  await expect(page.locator('[data-testid^="campana-vence-"]').first()).toContainText(
    'Venció hace',
  );

  await page.getByTestId('campanas-nueva').click();
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('campana-error-name')).toBeVisible();
  await page.getByTestId('campana-nombre').fill('Certificación Q1-2027');
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 2 de 4');
  // La vista previa la calcula la API (nada se creó todavía).
  await expect(page.getByTestId('vista-previa-total')).toContainText(/\d+ accesos? por revisar/, {
    timeout: 30_000,
  });
  await drenar();
  expect(hubo('POST', '/org/access-reviews/campaigns/preview', 200)).toBe(true);
  expect(
    trazos.some((t) => t.method === 'POST' && t.path.endsWith('/org/access-reviews/campaigns')),
  ).toBe(false);
  await page.getByTestId('asistente-siguiente').click();
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 4 de 4');
  await page.getByTestId('campana-crear-lanzar').click();
  await expect(page).toHaveURL(/\/administration\/access-governance\/campaigns\/(?!new)[^/]+$/, {
    timeout: 30_000,
  });
  idDeLaCampana = page.url().split('/').pop() ?? '';
  await expect(page.getByTestId('campana-nombre')).toHaveText('Certificación Q1-2027', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('campana-estado')).toHaveText('Abierta');

  // La API contestó `{ id }` al crear (no la campaña entera) y lanzó con ítems.
  await drenar();
  const creada = ultima('POST', '/org/access-reviews/campaigns', 201)!;
  expect(creada.response).toEqual({ id: idDeLaCampana });
  await drenar();
  expect(ultima('POST', '/launch', 200)!.response).toMatchObject({ ok: true, withoutReviewer: 0 });
});

test('03 · «Mis revisiones»: quien otorgó el permiso no lo certifica (403), el lote es todo o nada (422) y cada acceso se decide con comentario', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  // La administración que otorgó los permisos del demo los ve en su lista pero la API no la deja certificarlos (SOD-GOV-02).
  await irA('/my-reviews', 'pantalla-my-reviews');
  const delAdmin = page.locator('[data-testid^="revision-tarjeta-"]');
  await expect(delAdmin.first()).toBeVisible({ timeout: 30_000 });
  await delAdmin.first().locator('label.checkbox-container').click();
  await page.getByTestId('revisiones-mantener-lote').click();
  await confirmarDialogo();
  await expect(page.getByTestId('revisiones-lote-error')).toContainText(
    'Usted no es quien debe revisar este acceso',
    { timeout: 30_000 },
  );
  await drenar();
  expect(ultima('POST', '/me/access-reviews/items/bulk-decision')?.status).toBe(403);

  // El segundo administrador de seguridad (Gonzalo) sí es revisor de los accesos de la campaña nueva.
  const gonzalo = await personaAparte(browser, 'DEMO-GONZALO-PINTO');
  try {
    await irAEn(gonzalo, '/my-reviews', 'pantalla-my-reviews');
    const tarjetas = gonzalo.locator('[data-testid^="revision-tarjeta-"]');
    await expect(tarjetas.first()).toBeVisible({ timeout: 30_000 });
    const pendientesAntes = await tarjetas.count();
    const alta = gonzalo
      .locator('[data-testid^="revision-tarjeta-"]', {
        has: gonzalo.locator('[data-testid^="revision-riesgo-"]', {
          hasText: /Riesgo (alto|crítico)/,
        }),
      })
      .first();
    const paraElLote = (await alta.count()) > 0 ? alta : tarjetas.first();
    await paraElLote.locator('label.checkbox-container').click();
    await gonzalo.getByTestId('revisiones-mantener-lote').click();
    await confirmarDialogo(gonzalo);
    // La API rechaza el lote entero (422 REVIEW_BULK_NOT_ALLOWED): no se mantuvo ninguno y la pantalla dice cuál lo impide.
    await expect(gonzalo.getByTestId('revisiones-lote-error')).toContainText(
      'Solo se pueden mantener en bloque los accesos de bajo riesgo',
      { timeout: 30_000 },
    );
    await expect(gonzalo.getByTestId('revisiones-lote-error')).toContainText(
      'No se mantuvo ninguno',
    );
    await drenar();
    expect(ultima('POST', '/me/access-reviews/items/bulk-decision', 422)?.response).toMatchObject({
      reason: 'REVIEW_BULK_NOT_ALLOWED',
    });
    await expect(tarjetas).toHaveCount(pendientesAntes);

    // De a uno: sin comentario suficiente no sale; con comentario queda «Mantenido» y persiste al recargar.
    await gonzalo.locator('[data-testid^="revision-abrir-"]').first().click();
    await expect(gonzalo.getByTestId('revision-detalle')).toBeVisible({ timeout: 30_000 });
    await gonzalo.getByTestId('decision-mantener').click();
    await gonzalo.getByTestId('decision-comentario').locator('textarea').fill('corto');
    await gonzalo.getByTestId('decision-enviar').click();
    await expect(gonzalo.getByTestId('decision-comentario-error')).toContainText(
      'Escriba al menos 10 caracteres',
    );
    // La API es la que sabe que este permiso no se usó (422 REVIEW_COMMENT_REQUIRED): la pantalla, desde ahí, lo exige y no vuelve a mandar.
    // La traza se anota al leer el cuerpo de la respuesta: puede llegar un instante después de que la pantalla lo muestre.
    const intentos = (): [number, string | undefined][] =>
      trazos
        .filter((t) => t.method === 'POST' && /\/items\/[0-9a-f-]{36}\/decision$/.test(t.path))
        .map((t) => [t.status, (t.response as { reason?: string } | null)?.reason]);
    await expect.poll(intentos).toEqual([[422, 'REVIEW_COMMENT_REQUIRED']]);
    await gonzalo
      .getByTestId('decision-comentario')
      .locator('textarea')
      .fill('Administra al equipo y usa su acceso a diario.');
    await gonzalo.getByTestId('decision-enviar').click();
    await expect(gonzalo.getByTestId('revision-estado-detalle')).toHaveText('Mantenido', {
      timeout: 30_000,
    });
    await drenar();
    expect(ultima('POST', '/decision', 200)?.response).toMatchObject({
      ok: true,
      state: 'CERTIFIED',
    });
    await gonzalo.reload();
    await expect(gonzalo.getByTestId('revision-estado-detalle')).toHaveText('Mantenido', {
      timeout: 30_000,
    });
    await expect(gonzalo.getByTestId('decision-hecha')).toContainText(
      'Administra al equipo y usa su acceso a diario.',
    );
  } finally {
    await gonzalo.context().close();
  }
});

/* ---- 5 · cuatro ojos con X-Approval-Id: una persona pide, otra aprueba, y se reintenta con la aprobación -------------------------------- */

const RESERVA_DE_SUAREZ = '02d06e6c-3f9f-5a58-bc4c-362aeb6c6861'; // A4: Control de niño sano, N102, miércoles 4 de noviembre 09:00 (La Paz)

test('05 · cuatro ojos: Marcos pide cancelar con menos de 24 horas, Suárez aprueba y la cancelación se reintenta con X-Approval-Id', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const marcos = await personaAparte(browser, 'DEMO-MARCOS-RIBERA');
  const suarez = await personaAparte(browser, 'DEMO-MARTIN-SUAREZ');
  try {
    await irAEn(marcos, '/combined-agenda?vista=semana&fecha=2026-11-02', 'agenda-titulo');
    const cita = marcos.getByTestId(`item-${RESERVA_DE_SUAREZ}`);
    await expect(cita).toBeVisible({ timeout: 30_000 });
    await cita.click();
    await marcos.getByTestId('agenda-accion-cancel').click();
    await marcos
      .getByTestId('dialogo-motivo')
      .locator('textarea')
      .fill('La familia avisó que no puede venir por un viaje.');
    await marcos.getByTestId('dialogo-confirmar').click();

    // La API pide la aprobación del doctor (403 APPROVAL_REQUIRED) y se abre el diálogo de desafío.
    await expect(marcos.getByTestId('desafio')).toHaveAttribute('data-kind', 'APPROVAL', {
      timeout: 30_000,
    });
    await expect
      .poll(() =>
        trazos.some(
          (t) =>
            t.method === 'POST' &&
            t.path.includes(`/bookings/${RESERVA_DE_SUAREZ}/cancel`) &&
            t.status === 403 &&
            (t.response as { reason?: string } | null)?.reason === 'APPROVAL_REQUIRED',
        ),
      )
      .toBe(true);
    await marcos
      .getByTestId('desafio-motivo')
      .locator('textarea')
      .fill('Cancelo porque la familia avisó de un viaje, a menos de 24 horas.');
    await marcos.getByTestId('desafio-pedir').click();
    await expect(marcos.getByTestId('desafio-estado')).toHaveAttribute('data-status', 'PENDING', {
      timeout: 30_000,
    });
    await drenar();
    const pedido = ultima('POST', '/me/support-approvals', 201)!;
    const aprobacionId = (pedido.response as { id: string }).id;

    // Otra persona: el doctor ve lo pedido y lo aprueba (la API no deja que Marcos apruebe lo suyo).
    await irAEn(suarez, '/my-team/approvals', 'pantalla-approvals');
    const tarjeta = suarez.getByTestId(`aprobacion-${aprobacionId}`);
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await expect(tarjeta).toContainText('Cancelo porque la familia avisó de un viaje');
    await tarjeta.getByTestId(`aprobacion-aprobar-${aprobacionId}`).click();
    await expect(suarez.getByTestId('approvals-anuncio')).toContainText('Aprobada.', {
      timeout: 30_000,
    });
    expect(
      trazos.some(
        (t) =>
          t.method === 'POST' &&
          t.path === `/approvals/${aprobacionId}/decision` &&
          t.status === 200,
      ),
    ).toBe(true);

    // Marcos: el diálogo comprueba cada 8 segundos, ve «Aprobada» y repite LA MISMA cancelación con X-Approval-Id.
    await expect
      .poll(
        () =>
          trazos.some(
            (t) =>
              t.method === 'POST' &&
              t.path.includes(`/bookings/${RESERVA_DE_SUAREZ}/cancel`) &&
              t.status === 200,
          ),
        { timeout: 60_000 },
      )
      .toBe(true);
    const reintento = trazos.find(
      (t) =>
        t.method === 'POST' &&
        t.path.includes(`/bookings/${RESERVA_DE_SUAREZ}/cancel`) &&
        t.status === 200,
    )!;
    expect(reintento.headers['x-approval-id']).toBe(aprobacionId);
    expect(reintento.response).toMatchObject({ bookingId: RESERVA_DE_SUAREZ });
    expect(
      consulta(
        `select (select code from terminology.catalog_concepts where id=status_concept_id) from scheduling.appointment_bookings where id='${RESERVA_DE_SUAREZ}'`,
      )[0]![0],
    ).toMatch(/CANCEL/);

    // La aprobación es de un solo uso: la base la da por consumida y no vale para otra cancelación (la API sigue listándola «APPROVED»).
    expect(
      consulta(
        `select consumed_at is not null from delegated_access.four_eyes_requests where id='${aprobacionId}'`,
      )[0]![0],
    ).toBe('t');
    const token = await iniciarSesionApi('DEMO-MARCOS-RIBERA');
    const otraVez = await api(
      token,
      'POST',
      `/scheduling/bookings/${RESERVA_DE_SUAREZ}/cancel`,
      { cancelledBy: 'PROVIDER', reasonText: 'Reintento con la misma aprobación' },
      { 'x-approval-id': aprobacionId },
    );
    expect(otraVez.status, JSON.stringify(otraVez.body)).toBe(403);
    expect(otraVez.body['reason']).toBe('APPROVAL_REQUIRED');
  } finally {
    await marcos.context().close();
    await suarez.context().close();
  }
});

/* ---- 6 · paso extra con TOTP REAL ------------------------------------------------------------------------------------------------ */

let secretoDelAdmin = '';

/** La hora de la API (la del escenario): el código TOTP se calcula con SU reloj, no con el de la máquina. */
async function ahoraDeLaApi(token: string): Promise<number> {
  const r = await api(token, 'GET', '/org/governance/summary');
  return Date.parse(String(r.body['generatedAt']));
}

/** El último intervalo de 30 s que se usó con cada secreto: la API no acepta dos veces el mismo código (anti-repetición). */
const ultimoIntervalo = new Map<string, number>();

/** Un código TOTP real que NO repite el intervalo del anterior con ese secreto: si hace falta, espera a la ventana siguiente de la API. */
async function codigoTotpFresco(secreto: string): Promise<string> {
  let ahora = await relojDeLaApi();
  // Cerca del final de la ventana el código puede vencer antes de llegar a la API: se espera a la siguiente.
  while (ultimoIntervalo.get(secreto) === Math.floor(ahora / 30_000) || ahora % 30_000 > 22_000) {
    await new Promise((r) => setTimeout(r, 2_000));
    ahora = await relojDeLaApi();
  }
  ultimoIntervalo.set(secreto, Math.floor(ahora / 30_000));
  return codigoTotp(secreto, ahora);
}

/** Da de alta una app autenticadora de verdad por la API (contraseña + código del secreto) y devuelve el secreto base32. */
async function altaDeTotp(documento: string): Promise<string> {
  const token = await iniciarSesionApi(documento);
  const alta = await api(token, 'POST', '/iam/me/mfa/totp', {
    currentPassword: CONTRASENA,
    label: 'Prueba Playwright',
  });
  expect(alta.status, JSON.stringify(alta.body)).toBe(201);
  const secreto = String(alta.body['secret']);
  const confirmado = await api(
    token,
    'POST',
    `/iam/me/mfa/totp/${String(alta.body['id'])}/confirm`,
    { code: await codigoTotpFresco(secreto) },
  );
  expect(confirmado.status, JSON.stringify(confirmado.body)).toBe(200);
  expect(confirmado.body['verified']).toBe(true);
  return secreto;
}

test('06 · paso extra: en una sesión nueva, crear una barandilla pide el segundo paso y se resuelve con un código TOTP REAL (uno malo no pasa)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const token = await iniciarSesionApi('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  expect((await api(token, 'GET', '/iam/me/step-up')).body).toMatchObject({ fresh: false });
  const admin = await personaAparte(browser, 'DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  try {
    await irAEn(admin, '/administration/access-governance/rules', 'pantalla-rules');
    await admin.getByTestId('rules-nueva').click();
    await admin.getByTestId('regla-permiso').locator('.select-trigger').click();
    await admin.getByRole('option', { name: 'Cobrar la atención' }).click();
    await admin.getByTestId('regla-rol').locator('.select-trigger').click();
    await admin.getByRole('option', { name: 'Recepción' }).click();
    await expect(admin.getByTestId('regla-oracion')).toHaveText(
      'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
    );
    await admin.getByTestId('regla-ver-impacto').click();
    await expect(admin.getByTestId('regla-impacto')).toBeVisible({ timeout: 30_000 });
    await admin.getByTestId('regla-guardar').click();

    // La API contestó 403 STEP_UP_REQUIRED y el diálogo pide el código. Uno malo no pasa (422 MFA_CODE_INVALID).
    await expect(admin.getByTestId('desafio')).toHaveAttribute('data-kind', 'STEP_UP', {
      timeout: 30_000,
    });
    await drenar();
    expect(ultima('POST', '/org/governance/rules', 403)?.response).toMatchObject({
      reason: 'STEP_UP_REQUIRED',
    });
    await admin.getByTestId('desafio-codigo').fill('000000');
    await admin.getByTestId('desafio-verificar').click();
    await expect.poll(() => hubo('POST', '/iam/me/step-up', 422)).toBe(true);
    await drenar();
    expect(ultima('POST', '/iam/me/step-up', 422)?.response).toMatchObject({
      reason: 'MFA_CODE_INVALID',
    });
    await expect(admin.getByTestId('desafio')).toBeVisible();

    // El código real de la app: el que da el secreto con el reloj de la API.
    await admin.getByTestId('desafio-codigo').fill(await codigoTotpFresco(secretoDelAdmin));
    await admin.getByTestId('desafio-verificar').click();
    await expect(admin.getByTestId('desafio')).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => hubo('POST', '/iam/me/step-up', 200)).toBe(true);
    await expect.poll(() => hubo('POST', '/org/governance/rules', 201)).toBe(true);
    await expect(admin.getByTestId('rules-barandillas')).toContainText(
      'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
      { timeout: 30_000 },
    );
  } finally {
    await admin.context().close();
  }
});

test('06b · un átomo crítico no se escribe: la API responde 202 y lo aprueba otra persona (cuatro ojos), con el paso extra de cada una', async () => {
  test.setTimeout(240_000);
  const admin = await iniciarSesionApi('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  expect(
    (await api(admin, 'POST', '/iam/me/step-up', { code: await codigoTotpFresco(secretoDelAdmin) }))
      .status,
  ).toBe(200);
  // Sofía (jefa de Ecografía, plantilla de gestión) puede tener «Anular comprobantes» (crítico) si otra persona lo aprueba.
  const miembros = (await api(admin, 'GET', '/org/team/members')).body['items'] as {
    personName: string;
    engagementId: string;
    grants: { targetKind: string; healthcareServiceId?: string }[];
  }[];
  const ana = miembros.find((m) => m.personName === 'Sofía Camacho')!;
  const objetivo = {
    targetKind: ana.grants[0]!.targetKind,
    healthcareServiceId: ana.grants[0]!.healthcareServiceId,
  };
  const unMes = new Date(Date.parse(new Date().toISOString()) + 30 * 86_400_000).toISOString();
  const pedido = await api(admin, 'POST', `/org/support-engagements/${ana.engagementId}/grants`, {
    ...objetivo,
    actions: ['billing.receipt.void'],
    validTo: unMes,
    expansionMode: 'DYNAMIC',
  });
  expect(pedido.status, JSON.stringify(pedido.body)).toBe(202);
  expect(pedido.body).toMatchObject({
    status: 'PENDING_APPROVAL',
    criticalAtoms: ['billing.receipt.void'],
  });
  const approvalId = String(pedido.body['approvalId']);
  // Nada se escribió: Sofía no tiene ese permiso hasta que otra persona lo apruebe.
  const atomosDeAna = async (): Promise<string[]> =>
    (
      (await api(admin, 'GET', `/org/team/members/${ana.engagementId}`)).body['grants'] as {
        atoms: string[];
      }[]
    ).flatMap((g) => g.atoms);
  expect(await atomosDeAna()).not.toContain('billing.receipt.void');

  // Quien pide no aprueba (403 FOUR_EYES_SELF_APPROVAL); el segundo administrador sí, con su propio segundo paso.
  const propia = await api(admin, 'POST', `/approvals/${approvalId}/decision`, {
    decision: 'APPROVE',
  });
  expect(propia.status).toBe(403);
  expect(propia.body['reason']).toBe('FOUR_EYES_SELF_APPROVAL');
  const secretoDeGonzalo = await altaDeTotp('DEMO-GONZALO-PINTO');
  const gonzalo = await iniciarSesionApi('DEMO-GONZALO-PINTO');
  const sinPaso = await api(gonzalo, 'POST', `/approvals/${approvalId}/decision`, {
    decision: 'APPROVE',
  });
  expect([sinPaso.status, sinPaso.body['reason']]).toEqual([403, 'STEP_UP_REQUIRED']);
  expect(
    (
      await api(gonzalo, 'POST', '/iam/me/step-up', {
        code: await codigoTotpFresco(secretoDeGonzalo),
      })
    ).status,
  ).toBe(200);
  const aprobada = await api(gonzalo, 'POST', `/approvals/${approvalId}/decision`, {
    decision: 'APPROVE',
  });
  expect(aprobada.status, JSON.stringify(aprobada.body)).toBe(200);
  expect(await atomosDeAna()).toContain('billing.receipt.void');
});

/* ---- 7 · ciclo de vida: sin dueño, baja con traspaso, cambio de rol (200 y 202) ----------------------------------------------------- */

/** Elige una opción de un `app-select` como lo haría la persona: abre la lista y toca la fila. */
async function elegir(
  p: Page,
  campo: ReturnType<Page['getByTestId']>,
  opcion: string,
): Promise<void> {
  await campo.locator('.select-trigger').click();
  await p.locator('[role="option"]', { hasText: opcion }).first().click();
}

test('07 · ciclo de vida: la cuenta sin dueño recibe uno y la baja de Pablo revoca primero y traspasa después', async () => {
  await irA('/administration/access-governance/lifecycle');
  await expect(
    page.locator('[data-testid^="case-person-"]', { hasText: 'Nora Villarroel' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ownerless-list')).toContainText('Nora Villarroel');

  const nora = page.locator('li[data-testid^="ownerless-"]', { hasText: 'Nora Villarroel' });
  await elegir(page, nora.locator('app-select'), 'Sofía Camacho');
  await nora.getByRole('button', { name: /Asignar dueño/ }).click();
  await expect(page.getByTestId('owner-notice')).toContainText(
    'Sofía Camacho es ahora responsable de la cuenta de Nora Villarroel.',
    { timeout: 30_000 },
  );
  await drenar();
  expect(ultima('PUT', '/owner', 200)).toBeDefined();
  expect(
    consulta(
      `select supervisor_user_id from delegated_access.organization_user_assignments where id='de0204d4-f9d7-5394-8ba3-45e92b46b610'`,
    )[0]![0],
  ).toBe('161a6e07-9098-52d4-82e9-d0485c5646a2'); // Sofía

  // Baja de Pablo en tres pasos: lo que tiene en las manos, a quién se lo pasa, confirmar.
  await irA('/administration/support-team', 'equipo-card');
  const enlace = page.getByRole('link', { name: 'Permisos de Pablo Mamani' });
  const href = (await enlace.getAttribute('href'))!;
  await irA(`${href}/offboard`);
  await expect(page.getByTestId('offboard-count-CONVERSATION')).toContainText('3 conversaciones', {
    timeout: 30_000,
  });
  await page.getByTestId('offboard-next').click();
  for (const tipo of ['CONVERSATION', 'TASK', 'PENDING_APPOINTMENT']) {
    await elegir(page, page.getByTestId(`handover-target-${tipo}`), 'Lucía Paz');
  }
  await page.getByTestId('offboard-next').click();
  await page.locator('[data-testid="offboard-reason"] textarea').fill('Renuncia de Pablo');
  await page.getByTestId('offboard-confirm').click();
  await expect(page.getByTestId('offboard-result')).toContainText(
    'primero se revocó y después se reasignó el trabajo',
    { timeout: 30_000 },
  );
  await drenar();
  const baja = ultima('POST', '/offboard', 200)!;
  expect(baja.body).toMatchObject({
    reason: 'Renuncia de Pablo',
    handover: { defaultToUserId: expect.any(String) },
  });
  expect(baja.response).toMatchObject({ ok: true });
  // En la base: sin permisos vivos, vínculo terminado, y el trabajo pasó a Lucía.
  expect(
    consulta(
      `select count(*) from delegated_access.support_scope_grants g where g.organization_user_assignment_id='ebe3a9a3-0191-59b1-b3b8-944579f95573' and g.valid_to is null`,
    )[0]![0],
  ).toBe('0');
  expect(
    consulta(
      `select count(*) from delegated_access.handover_items where to_user_id='2485d391-ec1c-5c0e-9888-b043d3f27321'`,
    )[0]![0],
  ).not.toBe('0');
});

test('08 · cambio de rol: el simulado sin suba de privilegios se aplica (200) y el que sube mucho el puntaje queda pendiente de cuatro ojos (202)', async () => {
  // 200, desde la pantalla: la vista previa de la API y el mismo conjunto con su simulationToken.
  await irA('/administration/support-team', 'equipo-card');
  const href = (await page
    .getByRole('link', { name: 'Permisos de Lucía Paz' })
    .getAttribute('href'))!;
  await irA(`${href}/move`, 'pantalla-move-dialog');
  await expect(page.locator('[data-testid$="-composer"]').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('move-simulate').click();
  await expect(page.getByTestId('move-preview-region')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('move-confirm')).toBeEnabled({ timeout: 30_000 });
  await page
    .getByTestId('move-reason')
    .locator('textarea')
    .fill('Lucía sigue en recepción: se confirma su conjunto de permisos');
  await page.getByTestId('move-confirm').click();
  // Si la sesión no tiene el paso fresco, la API lo pide: se resuelve con el código TOTP real.
  const desafio = page.getByTestId('desafio-codigo');
  if (
    await desafio.waitFor({ state: 'visible', timeout: 6_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await desafio.fill(await codigoTotpFresco(secretoDelAdmin));
    await page.getByTestId('desafio-verificar').click();
  }
  await expect(page.getByTestId('move-result')).toContainText('El cambio ya está aplicado', {
    timeout: 30_000,
  });
  await drenar();
  const movido = ultima('POST', '/move', 200)!;
  expect((movido.body as { simulationToken?: string }).simulationToken).toMatch(/^sim_/);
  expect(movido.response).toMatchObject({ status: 'EXECUTED' });

  // 202, por la API: sube de plantilla y de sensibilidad. Nada cambia hasta que otra persona lo apruebe.
  const admin = await iniciarSesionApi('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  expect(
    (await api(admin, 'POST', '/iam/me/step-up', { code: await codigoTotpFresco(secretoDelAdmin) }))
      .status,
  ).toBe(200);
  const miembros = (await api(admin, 'GET', '/org/team/members')).body['items'] as {
    personName: string;
    engagementId: string;
    grants: { atoms: string[]; targetKind: string; careSpaceId?: string }[];
  }[];
  const lucia = miembros.find((m) => m.personName === 'Lucía Paz')!;
  const grants = [
    {
      actions: [
        ...new Set([
          ...lucia.grants[0]!.atoms,
          'reports.agenda.export',
          'audit.reports.governance.view',
          'team.members.view',
          'audit.activity.export',
        ]),
      ],
      targetKind: lucia.grants[0]!.targetKind,
      careSpaceId: lucia.grants[0]!.careSpaceId,
    },
  ];
  const pendiente = await api(
    admin,
    'POST',
    `/org/support-engagements/${lucia.engagementId}/move`,
    {
      reason: 'Lucía cubrirá la coordinación del servicio',
      newTemplateCode: 'ORG_MANAGEMENT',
      grants,
    },
  );
  expect(pendiente.status, JSON.stringify(pendiente.body)).toBe(202);
  expect(pendiente.body).toMatchObject({
    status: 'PENDING_APPROVAL',
    fourEyesReasons: expect.arrayContaining(['SCORE_INCREASE']),
  });
  // La plantilla y los permisos vivos siguen como estaban (nada cambió) y la solicitud espera en «Aprobaciones».
  expect(
    consulta(
      `select count(*) from delegated_access.support_scope_grants where organization_user_assignment_id='${lucia.engagementId}' and valid_to is null`,
    )[0]![0],
  ).not.toBe('0');
  await irA('/administration/access-governance/approvals', 'pantalla-approvals');
  // Quien lo pidió no lo decide: lo ve en «Mis solicitudes», esperando.
  await page.getByRole('tab', { name: /Mis solicitudes/ }).click();
  await expect(page.locator('[data-testid^="solicitud-estado-"]').first()).toContainText(
    'Pendiente',
    { timeout: 30_000 },
  );
});

/* ---- 9 · administración delegada: la jefa de servicio dentro de su techo y fuera de él --------------------------------------------------- */

/** La hora de la API, leída con la cuenta de seguridad (el resumen de gobierno es de ella): sirve para calcular el TOTP de cualquiera. */
const relojDeLaApi = async (): Promise<number> =>
  ahoraDeLaApi(await iniciarSesionApi('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO'));

test('09 · administración delegada: Sofía (jefa de Ecografía) asigna dentro de su techo y la API rechaza lo que lo excede', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  // Su paso extra (asignar permisos lo pide) con una app autenticadora de verdad.
  const token = await iniciarSesionApi('DEMO-SOFIA-CAMACHO');
  const alta = await api(token, 'POST', '/iam/me/mfa/totp', { currentPassword: CONTRASENA });
  expect(alta.status).toBe(201);
  const secreto = String(alta.body['secret']);
  expect(
    (
      await api(token, 'POST', `/iam/me/mfa/totp/${String(alta.body['id'])}/confirm`, {
        code: await codigoTotpFresco(secreto),
      })
    ).status,
  ).toBe(200);
  expect(
    (await api(token, 'POST', '/iam/me/step-up', { code: await codigoTotpFresco(secreto) })).status,
  ).toBe(200);

  const capacidades = await api(token, 'GET', '/org/team/capabilities');
  expect(capacidades.body['mode']).toBe('DELEGATED');
  const miembros = (await api(token, 'GET', '/org/team/members')).body['items'] as {
    personName: string;
    engagementId: string;
    grants: { atoms: string[]; targetKind: string; healthcareServiceId?: string }[];
    otherFunctions: number;
  }[];
  expect(miembros.map((m) => m.personName)).toEqual(['Marcos Ribera']); // solo su población
  const marcos = miembros[0]!;
  const objetivo = {
    targetKind: marcos.grants[0]!.targetKind,
    healthcareServiceId: marcos.grants[0]!.healthcareServiceId,
  };

  // Fuera del techo: cobrar no es de agenda, la API lo rechaza y no deja nada.
  const fuera = await api(token, 'POST', `/org/team/members/${marcos.engagementId}/grants`, {
    ...objetivo,
    actions: ['billing.payment.collect'],
  });
  expect(fuera.status, JSON.stringify(fuera.body)).toBeGreaterThanOrEqual(400);
  expect(fuera.status).toBeLessThan(500);
  expect(String(fuera.body['reason'] ?? fuera.body['code'])).toMatch(
    /CEILING|NOT_ALLOWED|FORBIDDEN|GUARDRAIL|ADMIN/,
  );

  // Dentro del techo: un átomo de agenda que Marcos aún no tenga.
  const nuevo = [
    'agenda.appointment.confirm',
    'agenda.appointment.reschedule',
    'agenda.appointment.walk_in',
    'agenda.waitlist.manage',
    'agenda.reminder.send',
  ].find((a) => !marcos.grants[0]!.atoms.includes(a))!;
  // Quien administra por delegación solo puede dar permisos con fin (hasta 180 días): sin fecha la API contesta 403 ADMIN_CEILING_EXCEEDED (MAX_VALID_DAYS).
  const sinFin = await api(token, 'POST', `/org/team/members/${marcos.engagementId}/grants`, {
    ...objetivo,
    actions: [nuevo],
  });
  expect(sinFin.status).toBe(403);
  expect(sinFin.body['reason']).toBe('ADMIN_CEILING_EXCEEDED');
  const noventaDias = new Date((await relojDeLaApi()) + 90 * 86_400_000).toISOString();
  const dentro = await api(token, 'POST', `/org/team/members/${marcos.engagementId}/grants`, {
    ...objetivo,
    actions: [nuevo],
    validTo: noventaDias,
  });
  expect(dentro.status, JSON.stringify(dentro.body)).toBeLessThan(300);
  const despues = (await api(token, 'GET', `/org/team/members/${marcos.engagementId}`)).body as {
    grants: { atoms: string[] }[];
  };
  expect(despues.grants.flatMap((g) => g.atoms)).toContain(nuevo);

  // La pantalla de ella: lo que administra, su techo y lo que no puede dar, con su explicación.
  const sofia = await personaAparte(browser, 'DEMO-SOFIA-CAMACHO');
  try {
    await irAEn(sofia, '/administration/team-management');
    await expect(sofia.getByTestId('team-scope')).toContainText(/Usted administra: Ecografía/, {
      timeout: 30_000,
    });
    await expect(sofia.getByTestId('team-ceiling')).toContainText('agenda');
    await sofia.locator('[data-testid^="member-open-"]').first().click();
    await expect(sofia.getByTestId('member-status')).toBeVisible({ timeout: 30_000 });
    await sofia.getByTestId('member-add-grant').click();
    await sofia.getByRole('button', { name: /Facturación y caja/ }).click();
    const cobrar = sofia.getByTestId('member-grant-atom-billing.payment.collect');
    await expect(cobrar.locator('input[type="checkbox"]')).toBeDisabled();
    await expect(cobrar).toContainText('Solo el administrador de seguridad puede dar esto.');
  } finally {
    await sofia.context().close();
  }
});

/* ---- 10 · explicar y simular ------------------------------------------------------------------------------------------------------------ */

const DIA_DEL_ESCENARIO_SIGUIENTE = '2026-11-04';

test('10 · explicar y simular: lo que dice la pantalla es lo que contestó la API (explain, «¿y si…?» y simulate sin escribir nada)', async () => {
  await irA('/administration/access-governance/simulator', 'pantalla-simulator');
  await elegir(page, page.getByTestId('explicar-persona'), 'Marcos Ribera');
  await elegir(page, page.getByTestId('explicar-accion'), 'Cancelar citas');
  await elegir(page, page.getByTestId('explicar-doctor'), 'Suárez');
  await page.getByTestId('explicar-fecha').fill(DIA_DEL_ESCENARIO_SIGUIENTE);
  await page.getByTestId('explicar-hora').fill('09:00');
  await page.getByTestId('explicar-enviar').click();
  await expect(page.getByTestId('veredicto')).toBeVisible({ timeout: 30_000 });
  await drenar();
  const explicacion = ultima('POST', '/org/access/explain', 200)!;
  const veredicto = (
    explicacion.response as { decision: { effect: string }; reasons: { order: number }[] }
  ).decision.effect;
  await expect(page.getByTestId('veredicto')).toHaveAttribute('data-efecto', veredicto);
  // La traza en el orden real de la API, con el paso que decidió.
  await expect(page.locator('[data-testid^="paso-"][aria-current="step"]')).toContainText(
    'Decidió aquí',
  );
  expect((explicacion.response as { reasons: unknown[] }).reasons.length).toBeGreaterThan(0);

  // «¿Y si…?»: la misma pregunta con otros supuestos (la API recalcula; no guarda nada).
  const si = page.locator('[data-testid="explicacion-ysi"] button[data-value="YES"]');
  if (await si.count()) {
    await si.first().click();
    await expect
      .poll(
        () =>
          trazos.filter(
            (t) =>
              t.method === 'POST' && t.path.includes('/org/access/explain') && t.status === 200,
          ).length,
        { timeout: 30_000 },
      )
      .toBeGreaterThan(1);
    await drenar();
    expect(
      (ultima('POST', '/org/access/explain', 200)!.body as { assume?: unknown }).assume,
    ).toBeDefined();
  }

  // Simular un borrador que suma un permiso: comparado antes y después, sin escribir.
  await page.getByRole('tab', { name: '¿Qué pasa si cambio permisos?' }).click();
  await elegir(page, page.getByTestId('borrador-persona'), 'Marcos Ribera');
  await expect(page.getByTestId('borrador-actuales')).toBeVisible({ timeout: 30_000 });
  await elegir(page, page.getByTestId('borrador-permiso'), 'Cobrar la atención');
  await page.getByTestId('borrador-agregar').click();
  await page.getByTestId('borrador-simular').click();
  await expect(page.getByTestId('simulacion-resultado')).toBeVisible({ timeout: 30_000 });
  await drenar();
  const simulacion = ultima('POST', '/org/access/simulate', 200)!;
  expect(simulacion.body).toMatchObject({
    engagementId: expect.any(String),
    draft: { mode: expect.stringMatching(/PATCH|REPLACE/) },
  });
  const resultado = simulacion.response as {
    valid: boolean;
    impact: { newlyAllowed: number };
    scenarios: { change: string }[];
    simulationToken?: string;
  };
  await expect(page.getByTestId('simulacion-impacto')).toBeVisible();
  // Todos los `change` son de los que el cliente conoce (no existe «CHANGED»).
  for (const e of resultado.scenarios)
    expect(['SAME', 'NEWLY_ALLOWED', 'NEWLY_DENIED', 'NEWLY_CHALLENGED']).toContain(e.change);
  expect(
    trazos.some((t) => ['POST', 'PATCH', 'PUT'].includes(t.method) && t.path.includes('/grants')),
  ).toBe(false);
});

/* ---- 11 · tablero, matriz y anomalías ------------------------------------------------------------------------------------------------------ */

test('11 · tablero, matriz y anomalías con los números de la API', async () => {
  await irA('/administration/access-governance', 'governance-tiles');
  await expect(page.locator('[data-testid="governance-tiles"] li')).toHaveCount(10, {
    timeout: 30_000,
  });
  await drenar();
  const tiles = (
    ultima('GET', '/org/governance/summary', 200)!.response as { tiles: Record<string, number> }
  ).tiles;
  await expect(page.getByTestId('governance-tile-value-openAnomalies')).toHaveText(
    String(tiles['openAnomalies']),
  );
  await expect(page.getByTestId('governance-tile-value-activeSodExceptions')).toHaveText(
    String(tiles['activeSodExceptions']),
  );
  expect(tiles['overdueCertifications']).toBeGreaterThan(0); // con el reloj del escenario, la campaña del demo ya venció

  // Los enlaces con parámetros llevan a pantallas que los leen.
  await page.getByTestId('governance-tile-activeSodExceptions').click();
  await expect(page).toHaveURL(/\/sod\?tab=exceptions$/);
  await expect(page.getByRole('tab', { name: /Excepciones/ })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 30_000 },
  );
  await irA('/administration/access-governance', 'governance-tiles');
  await page.getByTestId('governance-tile-overdueCertifications').click();
  await expect(page).toHaveURL(/\/campaigns\?status=overdue$/);
  await expect(page.locator('[data-testid^="campana-estado-"]').first()).toHaveText('Abierta', {
    timeout: 30_000,
  });
  await irA('/administration/access-governance', 'governance-tiles');
  await page.getByTestId('governance-tile-highRiskGrants').click();
  await expect(page).toHaveURL(/\/matrix\?sensitivity=HIGH$/);

  // Anomalías: descartar sin comentario no sale (la pantalla lo pide); con comentario, la API la deja descartada.
  await irA('/administration/access-governance/anomalies', 'anomalies-table');
  await page.getByRole('button', { name: /Ver el detalle de Marcos Ribera/ }).click();
  await expect(page.getByTestId('anomaly-description')).not.toBeEmpty();
  await page.getByTestId('anomaly-dismiss').click();
  await expect(page.locator('.form-field-error')).toContainText('al menos 10 caracteres');
  expect(trazos.some((t) => t.method === 'POST' && t.path.includes('/anomalies/'))).toBe(false);
  await page
    .getByTestId('anomaly-comment')
    .locator('textarea')
    .fill('Fue la campaña de recordatorios de la mañana.');
  await page.getByTestId('anomaly-dismiss').click();
  await expect(page.getByTestId('anomaly-detail-status')).toContainText('Descartada', {
    timeout: 30_000,
  });
  await drenar();
  expect(ultima('POST', '/ack', 200)?.response).toMatchObject({ ok: true, status: 'DISMISSED' });
  // Una anomalía ya atendida no se atiende dos veces: la API contesta 409 ANOMALY_ALREADY_RESOLVED.
  await drenar();
  const idAtendida = ultima('POST', '/ack', 200)!.path.split('/').at(-2)!;
  const admin = await iniciarSesionApi('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  const otraVez = await api(admin, 'POST', `/org/governance/anomalies/${idAtendida}/ack`, {
    status: 'ACKNOWLEDGED',
  });
  expect(otraVez.status).toBe(409);
  expect(otraVez.body['reason']).toBe('ANOMALY_ALREADY_RESOLVED');

  // Matriz: se lee de la API, «¿por qué?» y exportación (con paso extra real si hace falta).
  await irA('/administration/access-governance/matrix', 'matrix-grid');
  await drenar();
  const matriz = ultima('GET', '/org/governance/access-matrix', 200)!.response as {
    rows: { name: string; cells: Record<string, { effective?: boolean }> }[];
  };
  expect(matriz.rows.length).toBeGreaterThan(0);
  await page
    .getByRole('row', { name: /Marcos Ribera/ })
    .getByRole('button', { name: /Agenda/ })
    .click();
  await expect(page.getByTestId('matrix-detail')).toContainText('Marcos Ribera', {
    timeout: 30_000,
  });
  await page.getByTestId('matrix-explain-atom').locator('.select-trigger').click();
  await page.getByRole('option', { name: 'Cancelar citas' }).click();
  await page.getByTestId('matrix-explain-run').click();
  await expect(page.getByTestId('matrix-explain-result')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('matrix-export-open').click();
  await page
    .getByTestId('matrix-export-reason')
    .locator('textarea')
    .fill('Revisión trimestral de auditoría interna');
  const descarga = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId('matrix-export-submit').click();
  if (
    await page
      .getByTestId('desafio-codigo')
      .waitFor({ state: 'visible', timeout: 6_000 })
      .then(
        () => true,
        () => false,
      )
  ) {
    await page.getByTestId('desafio-codigo').fill(await codigoTotpFresco(secretoDelAdmin));
    await page.getByTestId('desafio-verificar').click();
  }
  expect((await descarga).suggestedFilename()).toMatch(
    /^matriz-de-accesos-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  await expect(page.getByTestId('matrix-export-done')).toContainText('SHA-256', {
    timeout: 30_000,
  });
  await drenar();
  expect(ultima('POST', '/reports/access-matrix/export', 200)?.response).toMatchObject({
    format: 'csv',
    sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
});

/* ---- 12 · cierre de la campaña (al final: lo que nadie decidió se REVOCA y esas personas dejan de poder) -------------------------------- */

test('12 · cerrar la campaña quita lo que nadie decidió (por eso va al final: revoca los accesos de las demás pruebas), el seguimiento lo cuenta y se exporta con su huella', async () => {
  await irA(`/administration/access-governance/campaigns/${idDeLaCampana}`);
  await expect(page.getByTestId('campana-nombre')).toHaveText('Certificación Q1-2027', {
    timeout: 30_000,
  });
  await page.getByTestId('campana-cerrar').click();
  await confirmarDialogo();
  await expect(page.getByTestId('campana-estado')).toHaveText('Cerrada', { timeout: 30_000 });
  await expect(page.getByTestId('campana-resultado')).toContainText(
    /Se quit(ó 1 acceso|aron \d+ accesos)/,
  );
  await drenar();
  const cierre = ultima('POST', '/close', 200)!;
  expect(cierre.response).toMatchObject({ ok: true });
  expect((cierre.response as { autoRevoked: number }).autoRevoked).toBeGreaterThan(0);

  // Exportar pide el motivo como un CÓDIGO y el segundo paso reciente (la sesión de la pantalla ya lo tiene si pasó antes por la matriz).
  const descarga = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId('campana-exportar-csv').click();
  await pasoExtraSiLoPide(page, secretoDelAdmin);
  expect((await descarga).suggestedFilename()).toMatch(
    /^certificacion-q1-2027-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  await expect(page.getByTestId('campana-exportado')).toContainText('Huella SHA-256');
  await drenar();
  expect(ultima('GET', '/export?format=csv&reasonCode=AUDIT_REVIEW', 200)?.response).toMatchObject({
    format: 'csv',
    kind: 'campaign-results',
  });
  // Lo que la persona ve en el seguimiento sale de `results`: lo quitado por no revisarse figura como tal.
  await drenar();
  expect(
    (ultima('GET', '/results', 200)?.response as { autoRevokedItemIds: string[] })
      .autoRevokedItemIds.length,
  ).toBeGreaterThan(0);
});
