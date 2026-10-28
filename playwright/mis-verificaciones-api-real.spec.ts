import { test, expect, type Page } from '@playwright/test';
import type { Actor } from './support/actores';
import { capturar } from './support/captura';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * El recorrido entero **contra la API real** (no el simulador), con cada
 * mutación probada UI → petición → respuesta → persistencia → recarga → UI:
 *
 * 1. un médico nuevo se da de alta en el navegador eligiendo una institución y
 *    una aseguradora; el `POST` lleva lo elegido y la API devuelve lo creado;
 * 2. entra y ve las dos solicitudes en «Mis verificaciones»;
 * 3. la aseguradora entra por la franja de su panel, abre el rechazo, escribe
 *    el motivo y rechaza; la recarga lo muestra en «Ya decididas»;
 * 4. el médico lee el motivo en su conversación, vuelve a pedir, y tras la
 *    recarga el hilo conserva el rechazo y suma la solicitud nueva.
 *
 * Requiere la API con el modelo v4.2.64, el front en `ng serve` (proxy a la
 * API) y, como datos, una institución pública con sede activa y una cuenta
 * administradora de una aseguradora. Las credenciales llegan por entorno; sin
 * ellas la spec se saltea con su motivo, que no es un verde.
 *
 *   E2E_API_REAL=1 E2E_BASE_URL=http://localhost:4500
 *   E2E_ASEGURADORA_EMAIL=… E2E_ASEGURADORA_CLAVE=… E2E_ASEGURADORA_TENANT=Alianza
 *   E2E_ASEGURADORA_NOMBRE='Alianza Seguros S.A.' E2E_INSTITUCION='Clínica Prueba'
 */
const API_REAL = process.env['E2E_API_REAL'] === '1';
const ASEGURADORA: Actor | null = process.env['E2E_ASEGURADORA_EMAIL']
  ? {
      rol: 'administrador',
      identificador: process.env['E2E_ASEGURADORA_EMAIL'],
      clave: process.env['E2E_ASEGURADORA_CLAVE'] ?? '',
      nombre: 'Aseguradora',
    }
  : null;
const TENANT = process.env['E2E_ASEGURADORA_TENANT'] ?? '';
const NOMBRE_ASEGURADORA = process.env['E2E_ASEGURADORA_NOMBRE'] ?? '';
const INSTITUCION = process.env['E2E_INSTITUCION'] ?? '';

const RUN = Date.now().toString(36).toUpperCase();
const MEDICO: Actor = {
  rol: 'doctora',
  identificador: `medico.verif.${RUN}@alovida.test`.toLowerCase(),
  clave: 'Medico-2026!',
  nombre: 'Ana Paz',
};
const MOTIVO = 'Por ahora no sumamos su especialidad';
const EVIDENCIA = 'docs/refactor-profesional/trabajo/capturas/e2e/verificaciones/api-real';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || ASEGURADORA === null || NOMBRE_ASEGURADORA === '' || INSTITUCION === '',
  'Omitido: faltan E2E_API_REAL=1, E2E_ASEGURADORA_* o E2E_INSTITUCION. No es un verde.',
);
test.setTimeout(240_000);
// Sin transiciones de vista: la captura tiene que ser de la pantalla destino.
test.use({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });

/**
 * Los errores de consola desde que se llama a `desde()`. Se mide dentro de las
 * pantallas de este cambio: el armazón de una cuenta de prueba armada a mano
 * puede pedir cosas que su rol no tiene, y eso no es de acá.
 */
function erroresDeConsola(page: Page): { desde(): void; (): string[] } {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // H-14: la CSP con hash bloquea un script que inyecta `ng serve`.
    if (/Executing inline script violates the following Content Security Policy/.test(m.text()))
      return;
    // Las teselas del mapa son de un servidor externo: en un entorno sin salida
    // a internet no llegan. Ajeno a este cambio; se excluye ESE error y nada más.
    if (/net::ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) return;
    errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  let inicio = 0;
  const leer = (() => errores.slice(inicio)) as { desde(): void; (): string[] };
  leer.desde = () => {
    inicio = errores.length;
  };
  return leer;
}

/* ---- El alta, página por página -------------------------------------------- */

async function titulo(page: Page): Promise<string> {
  return ((await page.locator('.paginated-form__titulo').first().textContent()) ?? '').trim();
}

async function continuar(page: Page): Promise<void> {
  const antes = await titulo(page);
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
  await expect(page.locator('.paginated-form__titulo').first()).not.toHaveText(antes, {
    timeout: 20_000,
  });
}

async function elegir(page: Page, testId: string, indice: number): Promise<void> {
  await page.getByTestId(testId).getByRole('combobox').click();
  await page.getByRole('option').nth(indice).click();
}

/** El punto de la casa es obligatorio; la calle sale de él (o queda sin calle). */
async function marcarCasa(page: Page): Promise<void> {
  const mapa = page.getByTestId('registration-practitioner-home-map').locator('.leaflet-container');
  await expect(mapa).toBeVisible({ timeout: 20_000 });
  await mapa.click();
  await page.getByTestId('registration-practitioner-home-location-confirm').click();
}

/* ---- El recorrido ---------------------------------------------------------- */

let carrierId = '';
let solicitudId = '';

test('1 · el alta lleva la institución y la aseguradora elegidas, y la API las crea', async ({
  page,
}) => {
  const errores = erroresDeConsola(page);
  await page.goto('/auth/register/practitioner');
  await esperarAplicacionLista(page);

  await page.getByTestId('registro-pro-nombre').fill('Ana');
  const apellido = page.getByTestId('registro-pro-apellido-paterno');
  if (!(await apellido.isVisible())) {
    await page
      .locator('app-name-fields')
      .getByRole('button', { name: 'Siguiente', exact: true })
      .click();
  }
  await apellido.fill('Paz');
  await page.getByTestId('registro-pro-documento').fill(`MED${RUN}`);
  await elegir(page, 'registro-pro-departamento-ci', 6);
  await continuar(page);

  await elegir(page, 'registration-practitioner-sex', 1);
  await page.getByPlaceholder('DD/MM/AAAA').click();
  await page.keyboard.type('12051985', { delay: 40 });
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(MEDICO.identificador);
  await page.getByTestId('registro-pro-password').fill(MEDICO.clave);
  await continuar(page);

  await marcarCasa(page);
  // La calle sale del geocodificador inverso de la API, que llama a un servicio
  // externo: sin salida a internet responde 503 y la pantalla ofrece escribirla
  // a mano. Es de la página del domicilio, no de este cambio: se mide desde acá.
  await page.waitForTimeout(1500);
  errores.desde();
  await continuar(page); // → Su trabajo (opcional)
  await continuar(page); // → Su consultorio propio (opcional)
  await continuar(page); // → Dónde trabaja y con qué seguros
  expect(await titulo(page)).toBe('Dónde trabaja y con qué seguros');

  // Lo nuevo, con la UI: buscar la institución y marcar la aseguradora.
  await page.getByTestId('registro-pro-instituciones-buscar').locator('input').fill(INSTITUCION);
  await page
    .getByRole('option', { name: new RegExp(INSTITUCION) })
    .first()
    .click();
  const elegida = page.locator('[data-testid^="registro-pro-institucion-"]').first();
  await expect(elegida).toContainText(/Institución (verificada|sin verificar)/);
  await expect(elegida).toContainText('Su vínculo: sin confirmar todavía');
  const seguros = page.getByTestId('registro-pro-seguros');
  await seguros.getByText(NOMBRE_ASEGURADORA, { exact: true }).click();
  await expect(seguros.getByRole('checkbox', { name: NOMBRE_ASEGURADORA })).toBeChecked();
  await capturar(page, `${EVIDENCIA}/alta-lugares-1440.png`);
  await continuar(page);

  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option').first().click();
  await continuar(page);
  await page.getByTestId('registro-pro-matricula').fill(`MP-${RUN}`);
  await page.getByTestId('registro-pro-credencial').fill(`TI-${RUN}`);
  await page.getByTestId('registro-pro-colegio').fill(`CM-${RUN}`);
  await continuar(page); // → especialidades (opcional)
  await continuar(page); // → firma y sello (opcional, la última)

  const [peticion, respuesta] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().endsWith('/iam/auth/register-practitioner') && r.method() === 'POST',
    ),
    page.waitForResponse(
      (r) => r.url().endsWith('/iam/auth/register-practitioner') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByTestId('paginated-form-continuar').last().click(),
  ]);
  const enviado = peticion.postDataJSON() as {
    institutionSlugs?: string[];
    insurerCarrierIds?: string[];
  };
  expect(enviado.institutionSlugs).toHaveLength(1);
  expect(enviado.insurerCarrierIds).toHaveLength(1);
  carrierId = enviado.insurerCarrierIds![0]!;

  expect(respuesta.status(), await respuesta.text()).toBe(201);
  const creado = (await respuesta.json()) as {
    affiliationIds?: string[];
    insurerRequestIds?: string[];
  };
  expect(creado.affiliationIds).toHaveLength(1);
  expect(creado.insurerRequestIds).toHaveLength(1);
  solicitudId = creado.insurerRequestIds![0]!;

  await expect(page.getByTestId('registro-pedidos-enviados')).toContainText(
    'Registramos 2 vínculos',
  );
  await capturar(page, `${EVIDENCIA}/alta-exito-1440.png`);
  expect(errores()).toEqual([]);
});

test('2 · el médico entra y ve las dos solicitudes, leídas de la API', async ({ page }) => {
  const errores = erroresDeConsola(page);
  await entrar(page, MEDICO);
  errores.desde();
  await irA(page, '/my-account/verifications');
  await expect(page.getByTestId('verif-tramo-insurers')).toContainText('Pendiente', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('verif-tramo-institutions')).toContainText('Pendiente');
  await capturar(page, `${EVIDENCIA}/medico-hoja-de-ruta-1440.png`);

  await page.getByRole('tab', { name: 'Solicitudes enviadas' }).click();
  await expect(page.getByTestId('verif-bandeja').locator('li')).toHaveCount(2);
  await capturar(page, `${EVIDENCIA}/medico-bandeja-1440.png`);
  expect(errores()).toEqual([]);
});

test('3 · la aseguradora rechaza con motivo desde su bandeja', async ({ page }) => {
  const errores = erroresDeConsola(page);
  await entrar(page, ASEGURADORA!);
  if (TENANT !== '') {
    await page.getByRole('button', { name: /Organización activa/ }).click();
    await page.getByRole('menuitem', { name: new RegExp(TENANT) }).click();
    await expect(page.getByRole('button', { name: /Organización activa/ })).toContainText(TENANT);
  }
  // La puerta real: la franja del panel de la aseguradora.
  await irA(page, '/dashboard');
  await page.getByTestId('panel-profesionales-que-piden').getByRole('link').click();
  errores.desde();
  const fila = page.getByTestId(`aseguradora-pedido-${solicitudId}`);
  await expect(fila).toContainText('Ana Paz', { timeout: 30_000 });
  await expect(page.getByTestId('aseguradora-grupo-por-decidir')).toContainText('Ana Paz');
  await capturar(page, `${EVIDENCIA}/aseguradora-bandeja-1440.png`);

  await fila.getByTestId('aseguradora-rechazar').click();
  // El motivo va en un diálogo, no desplegado en la fila (composition-rules.md §6).
  await page.getByTestId('dialogo-motivo').locator('textarea').fill(MOTIVO);
  await capturar(page, `${EVIDENCIA}/aseguradora-motivo-1440.png`);

  const [rechazo, relectura] = await Promise.all([
    page.waitForResponse((r) =>
      r.url().endsWith(`/insurance/practitioner-requests/${solicitudId}/reject`),
    ),
    page.waitForResponse(
      (r) => r.url().endsWith('/insurance/practitioner-requests') && r.request().method() === 'GET',
    ),
    page.getByTestId('dialogo-confirmar').click(),
  ]);
  expect(rechazo.status()).toBe(200);
  expect(await rechazo.json()).toMatchObject({ status: 'REJECTED', decisionReasonText: MOTIVO });
  expect(relectura.status()).toBe(200);

  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('aseguradora-grupo-decididas')).toContainText(`«${MOTIVO}»`, {
    timeout: 30_000,
  });
  await capturar(page, `${EVIDENCIA}/aseguradora-decidida-1440.png`);
  // La cuenta de prueba de la aseguradora se armó a partir de un alta de
  // médico: conserva su perfil profesional sin el rol, y al recargar el
  // armazón pide las sedes de ese perfil (403). Es del fixture, no de este
  // cambio; se excluye ESA lectura (y su «Failed to load resource») y nada más.
  const SEDES_DEL_FIXTURE = /\/practitioners\/[0-9a-f-]+\/sites → 403/;
  let sinUrl = errores().filter((e) => SEDES_DEL_FIXTURE.test(e)).length;
  const restantes = errores().filter((e) => {
    if (SEDES_DEL_FIXTURE.test(e)) return false;
    // Cada 403 deja además un «Failed to load resource» sin URL: uno por cada uno.
    if (sinUrl > 0 && /status of 403/.test(e)) {
      sinUrl -= 1;
      return false;
    }
    return true;
  });
  expect(restantes).toEqual([]);
});

test('4 · el médico lee el motivo, vuelve a pedir y el hilo conserva la historia', async ({
  page,
}) => {
  const errores = erroresDeConsola(page);
  await entrar(page, MEDICO);
  errores.desde();
  await irA(page, '/my-account/verifications?tab=requests');
  await page.getByTestId(`verif-hilo-ins-${carrierId}`).click();
  const hilo = page.getByTestId('verif-hilo-abierto');
  await expect(hilo).toContainText(`«${MOTIVO}»`, { timeout: 30_000 });
  await expect(hilo).toContainText('no aceptó la solicitud');
  await capturar(page, `${EVIDENCIA}/medico-hilo-rechazado-1440.png`);

  const [repedido] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/practitioners/me/insurer-requests') && r.request().method() === 'POST',
    ),
    page.getByTestId('verif-volver-a-pedir').click(),
  ]);
  expect(repedido.status()).toBe(201);

  await page.reload();
  await esperarAplicacionLista(page);
  await page.getByTestId(`verif-hilo-ins-${carrierId}`).click();
  // Lo guardado, releído: el rechazo con su motivo y la solicitud nueva.
  await expect(hilo).toContainText(`«${MOTIVO}»`, { timeout: 30_000 });
  await expect(hilo).toContainText(`Esperando que ${NOMBRE_ASEGURADORA} responda`);
  await expect(hilo.locator('[data-testid="verif-mensaje-me"]')).toHaveCount(2);
  await capturar(page, `${EVIDENCIA}/medico-hilo-historia-1440.png`);
  expect(errores()).toEqual([]);
});
