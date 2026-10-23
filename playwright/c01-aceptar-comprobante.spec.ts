import { expect, request as nuevoContexto, test, type Page, type Response } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista } from './support/sesion';

/**
 * C-01 (MD-06 / PA-04) de punta a punta contra la API REAL, sin mocks:
 * UI → request → response → persistencia → recarga → UI.
 *
 * Datos: `scripts/e2e-sembrar-api-real.mjs --etiqueta pablomut` (sintéticos,
 * propios de esta prueba: aceptar consume el comprobante pendiente, así que no
 * comparte etiqueta con las capturas).
 *
 * Variables: E2E_MODE=real, E2E_DOCTOR_EMAIL/PASSWORD, E2E_PATIENT_PROFILE_ID
 * (paciente A, con un comprobante QR pendiente) y E2E_PATIENT_2_PROFILE_ID
 * (paciente B, con una consulta en curso sin comprobante).
 */
test.skip(process.env['E2E_MODE'] !== 'real', 'Sólo contra la API real con datos sembrados');
test.use({ contextOptions: { reducedMotion: 'reduce' } });
test.describe.configure({ mode: 'serial' });

const medica = (): Actor => ({
  rol: 'medica' as unknown as Actor['rol'],
  identificador: process.env['E2E_DOCTOR_EMAIL'] ?? '',
  clave: process.env['E2E_DOCTOR_PASSWORD'] ?? '',
  nombre: 'medica',
});

/** Toda respuesta 4xx/5xx que no esté en `esperadas` hace fallar la prueba. */
function vigilarRed(page: Page, esperadas: RegExp[]): string[] {
  const inesperadas: string[] = [];
  // Lo que la propia navegación cancela (`reload`, `goto`) no es una falla del
  // servidor: el navegador lo marca `net::ERR_ABORTED` y la app lo loguea como
  // «sin respuesta». Se excluye SÓLO si el navegador lo abortó.
  const abortadas = new Set<string>();
  page.on('requestfailed', (r) => {
    if (/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) abortadas.add(new URL(r.url()).pathname);
  });
  page.on('response', (r: Response) => {
    if (r.status() < 400) return;
    const linea = `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`;
    if (!esperadas.some((e) => e.test(linea))) inesperadas.push(linea);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
    // Una view transition que la navegación siguiente interrumpe (DOMException benigna).
    if (/^AbortError: Transition was skipped$/.test(m.text())) return;
    const sinRespuesta = /\[API\] \w+ (\S+?)(?:\?\S*)? → sin respuesta/.exec(m.text());
    if (sinRespuesta && abortadas.has(sinRespuesta[1]!)) return;
    // El interceptor de la app escribe «[API] GET /ruta → 422 · …»: se le aplica
    // la misma lista de esperadas que a la red.
    const api = /\[API\] (\w+) (\S+?)(?:\?\S*)? → (\d{3})/.exec(m.text());
    if (api && esperadas.some((e) => e.test(`${api[3]} ${api[1]} ${api[2]}`))) return;
    inesperadas.push(`console: ${m.text().slice(0, 200)}`);
  });
  return inesperadas;
}

async function abrirPagos(page: Page, paciente: string): Promise<void> {
  await page.goto(`/medical-records/${paciente}/consultation`, { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('button', { name: /^pagos/i }).first().click();
  await expect(page.getByRole('dialog', { name: /pagos de la persona/i })).toBeVisible();
}

/**
 * BUG-C2-01 (registrado en el REPORTE del carril, NO de C-01): `GET /practices`
 * devuelve todas las prácticas del tenant, y los médicos independientes
 * comparten el tenant por defecto; el «Resumen» de Contabilidad elige la
 * primera —la de otro médico— y sus lecturas responden 422 «sin vinculación
 * activa» (y 404 el resumen simple). Se nombran acá, una por una, para que la
 * prueba de C-01 no las tape ni las ignore: cualquier otra falla sigue roja.
 */
const BUG_C2_01 = [
  /^422 GET \/accounting\/(income-statement|balance-sheet|open-items|assets)$/,
  /^404 GET \/accounting\/practitioner\/simple\/summary$/,
];

const API = process.env['E2E_API_BASE_URL'] ?? 'http://127.0.0.1:3005';

/** Lo que el paciente hace desde su app (carril de Richard), por la API: subir un comprobante en efectivo. */
async function pacienteSubeEfectivo(): Promise<void> {
  const api = await nuevoContexto.newContext({ baseURL: API });
  const token = async (email: string, password: string): Promise<string> =>
    (await (await api.post('/iam/auth/login', { data: { email, password } })).json()).accessToken as string;
  const medicaToken = await token(process.env['E2E_DOCTOR_EMAIL']!, process.env['E2E_DOCTOR_PASSWORD']!);
  const pacienteToken = await token(process.env['E2E_PATIENT_EMAIL']!, process.env['E2E_PATIENT_PASSWORD']!);
  const tabla = await (
    await api.get('/billing/me/provider-payment-table', {
      params: { patientProfileId: process.env['E2E_PATIENT_PROFILE_ID']! },
      headers: { Authorization: `Bearer ${medicaToken}` },
    })
  ).json();
  // El cargo pendiente cuyo último comprobante fue rechazado (escenario 3 del sembrado).
  const cargo = (tabla.items as { chargeId: string; status: string; proof: { status: string } | null }[]).find(
    (f) => f.status === 'PENDING' && f.proof?.status === 'REJECTED',
  );
  expect(cargo, 'El sembrado no dejó un cargo rechazado para reintentar').toBeDefined();
  const subida = await api.post(`/billing/me/charges/${cargo!.chargeId}/payment-proofs`, {
    data: { method: 'CASH', amountMinor: 15000 },
    headers: { Authorization: `Bearer ${pacienteToken}` },
  });
  expect(subida.status()).toBe(201);
  await api.dispose();
}

test('PA-04 · el médico rechaza con motivo y el motivo queda guardado tras recargar', async ({ page }) => {
  const paciente = process.env['E2E_PATIENT_PROFILE_ID'] ?? '';
  expect(paciente).toBeTruthy();
  await pacienteSubeEfectivo();
  const inesperadas = vigilarRed(page, BUG_C2_01);
  await entrar(page, medica());
  await abrirPagos(page, paciente);

  const efectivo = page
    .getByTestId('comprobantes-de-pago')
    .getByTestId('comprobante')
    .filter({ hasText: /efectivo/i })
    .filter({ hasText: /por revisar/i });
  await expect(efectivo).toHaveCount(1);
  await efectivo.getByTestId('comprobante-rechazar').click();

  const dialogo = page.getByRole('dialog', { name: /rechazar el comprobante/i });
  await expect(dialogo).toBeVisible();
  const motivo = 'No recibimos el efectivo en caja (prueba E2E)';
  await dialogo.getByTestId('dialogo-motivo').locator('textarea').fill(motivo);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => /\/billing\/payment-proofs\/[^/]+\/reject$/.test(r.url()) && r.request().method() === 'POST'),
    dialogo.getByRole('button', { name: /^rechazar$/i }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  expect(respuesta.request().postDataJSON()).toEqual({ reason: motivo });
  expect(await respuesta.json()).toMatchObject({ status: 'REJECTED', chargeStatus: 'PENDING' });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('button', { name: /^pagos/i }).first().click();
  const guardado = page.getByTestId('comprobantes-de-pago').getByTestId('comprobante').filter({ hasText: motivo });
  await expect(guardado).toHaveCount(1);
  await expect(guardado).toContainText(/rechazado/i);
  await expect(guardado.getByTestId('comprobante-aceptar')).toHaveCount(0);
  expect(inesperadas, 'respuestas o errores de consola inesperados').toEqual([]);
});

test('PA-04 · el médico acepta el comprobante y el cobro queda pagado tras recargar', async ({ page }) => {
  const paciente = process.env['E2E_PATIENT_PROFILE_ID'] ?? '';
  expect(paciente).toBeTruthy();
  const inesperadas = vigilarRed(page, BUG_C2_01);
  await entrar(page, medica());
  await abrirPagos(page, paciente);

  const caja = page.getByTestId('comprobantes-de-pago');
  const pendiente = caja.getByTestId('comprobante').filter({ hasText: /por revisar/i });
  await expect(pendiente).toHaveCount(1);
  await expect(pendiente.getByRole('img', { name: /captura del comprobante/i })).toBeVisible();

  // UI → request → response.
  await pendiente.getByTestId('comprobante-aceptar').click();
  const confirmar = page.getByRole('dialog', { name: /aceptar el comprobante/i });
  await expect(confirmar).toBeVisible();
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => /\/billing\/payment-proofs\/[^/]+\/accept$/.test(r.url()) && r.request().method() === 'POST'),
    confirmar.getByRole('button', { name: /aceptar el pago/i }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  expect(await respuesta.json()).toMatchObject({ status: 'ACCEPTED', chargeStatus: 'PAID' });

  // Persistencia → recarga → UI.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('button', { name: /^pagos/i }).first().click();
  const tras = page.getByTestId('comprobantes-de-pago');
  await expect(tras.getByTestId('comprobante').filter({ hasText: /transferencia por qr/i })).toContainText(/aceptado/i);
  await expect(tras.getByTestId('comprobante-aceptar')).toHaveCount(0);

  await page.goto('/administration/accounting', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('tab', { name: /pagos por sesión/i }).click();
  const fila = page
    .getByTestId('pagos-por-sesion')
    .getByRole('row')
    .filter({ hasText: /transferencia por qr/i });
  await expect(fila).toContainText(/pagado/i);
  await expect(fila).toContainText(/aceptado/i);

  expect(inesperadas, 'respuestas o errores de consola inesperados').toEqual([]);
});

test('MD-06 · cerrar sin pago confirmado avisa y ofrece la excepción con motivo; cancelar deja la consulta en curso', async ({ page }) => {
  const paciente = process.env['E2E_PATIENT_2_PROFILE_ID'] ?? '';
  expect(paciente).toBeTruthy();
  // El 422 PAYMENT_REQUIRED es la respuesta esperada de este flujo.
  const inesperadas = vigilarRed(page, [/^422 POST \/clinical\/encounters\/[^/]+\/close$/]);
  await entrar(page, medica());
  await page.goto(`/medical-records/${paciente}/consultation`, { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);

  const cerrar = page.getByTestId('consulta-cerrar-encuentro').first();
  await expect(cerrar).toBeVisible();
  await cerrar.click();
  await page.getByRole('dialog', { name: /cerrar el encuentro/i }).getByRole('button', { name: /cerrar encuentro/i }).click();

  const aviso = page.getByRole('dialog', { name: /no tiene el pago confirmado/i });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(/Bs 150,00/);
  await aviso.getByRole('button', { name: /cancelar/i }).click();

  // Sigue en curso: el botón de cerrar sigue ahí tras recargar.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('consulta-cerrar-encuentro').first()).toBeVisible();
  expect(inesperadas, 'respuestas o errores de consola inesperados').toEqual([]);
});
