import { expect, request, test, type Page } from '@playwright/test';
import {
  avanzarHasta,
  elegirLocalidadDeResidencia,
  empezarElAlta,
} from './support/registro-paciente';
import { urlDeApi } from './support/actores';

async function avanzarUnPaso(page: Page, tituloSiguiente: string): Promise<void> {
  const continuar = page.getByTestId('paginated-form-continuar');
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await expect(page.locator('.paginated-form__titulo')).toHaveText(tituloSiguiente, {
    timeout: 20_000,
  });
}

/**
 * AG-49 forensic-only script (NOT part of the FT-03 suite, never committed):
 * runs the exact same real user flow as
 * `registro-persistencia.spec.ts` → 'el GPS del domicilio... persiste contra
 * la API', but with explicit console/pageerror/network capture, to
 * independently confirm 'consola sin errores nuevos' per protocol
 * 01_PLAYWRIGHT_FORENSIC_QA.md — something the candidate's own test and
 * manifest do not measure (they declare console:[] without listening).
 */
test('AG-49 forensic: consola/red durante alta real + GPS + persistencia', async ({
  page,
  context,
}) => {
  const consoleMsgs: { type: string; text: string }[] = [];
  const pageErrors: string[] = [];
  const failedResponses: { url: string; status: number }[] = [];

  page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) failedResponses.push({ url: res.url(), status: res.status() });
  });

  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -17.7833, longitude: -63.1821 });

  const sufijo = `${Date.now()}`;
  const documento = `CI-AG49F-${sufijo}`;
  const email = `ag49-forense-${sufijo}@example.test`;
  const password = 'Ag49-Forense-Pw0rd!';

  await empezarElAlta(page, documento);
  await avanzarHasta(page, '¿Dónde vivís?');
  await elegirLocalidadDeResidencia(page);

  await page.getByTestId('registro-usar-ubicacion').click();
  const mapa = page.getByTestId('registro-mapa-domicilio');
  await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('registro-confirmar-direccion').click();
  await expect(page.getByTestId('registro-direccion-confirmada')).toBeVisible();

  await avanzarUnPaso(page, '¿Dónde trabajás?');
  await avanzarUnPaso(page, 'El lugar donde trabajás');
  await avanzarUnPaso(page, 'Tu acceso');

  await page.getByTestId('registro-correo').fill(email);
  await page.getByTestId('registro-password').fill(password);
  await avanzarUnPaso(page, 'Tu seguro de salud');
  await avanzarUnPaso(page, 'Datos de facturación');

  const enviar = page.getByTestId('paginated-form-continuar');
  await expect(enviar).toHaveText(/Crear cuenta/);
  await expect(enviar).toBeEnabled({ timeout: 20_000 });
  await enviar.click();
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });

  await page.screenshot({ path: 'artifacts/playwright/ag49-forensic-exito.png', fullPage: true });

  const api = await request.newContext({ baseURL: urlDeApi() });
  const login = await api.post('/iam/auth/login', { data: { nationalId: documento, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { accessToken } = (await login.json()) as { accessToken: string };
  const perfil = await api.get('/profiles/patients/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(perfil.ok(), await perfil.text()).toBeTruthy();
  const cuerpo = (await perfil.json()) as { homeAddress?: { latitude?: number; longitude?: number } };
  expect(cuerpo.homeAddress?.latitude).toBeCloseTo(-17.7833, 4);
  expect(cuerpo.homeAddress?.longitude).toBeCloseTo(-63.1821, 4);
  await api.dispose();

  console.log('AG49_CONSOLE_MSGS:', JSON.stringify(consoleMsgs));
  console.log('AG49_PAGE_ERRORS:', JSON.stringify(pageErrors));
  console.log('AG49_FAILED_RESPONSES:', JSON.stringify(failedResponses));
});
