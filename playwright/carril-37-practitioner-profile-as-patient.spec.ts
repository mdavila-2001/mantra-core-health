import { expect, test } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, doctora, type Actor } from './support/actores';
import { irA } from './support/sesion';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  reloadApp,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Carril 37 · el perfil del médico visto como paciente, contra la API real.
 *
 * Criterios derivados de `practitioner-detail.ts` y su spec Vitest: la ficha de
 * la guía (`/directory/:profileId`) pide el perfil **de esa ruta**, no el
 * propio; se pinta con la misma vista que el médico ve de sí mismo
 * (`GET /profiles/practitioners/:id/summary` devuelve el mismo contrato que
 * `me/summary`); no ofrece ninguna acción de dueño; y «Sedes y horarios» tiene
 * dos pestañas.
 *
 * ## Dos ingresos, no uno
 *
 * El carril necesita dos actores por definición. El médico entra **sólo por
 * API**, una vez, para leer su propio perfil y su `profileId`; el paciente
 * —sintético, dado de alta en esta corrida— entra por la pantalla. Son dos
 * `POST /iam/auth/login` en todo el archivo, lejos del techo de diez por
 * minuto.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-37-practitioner-profile-as-patient --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

interface OwnProfile {
  readonly profileId: string;
  readonly displayName?: string | null;
  readonly professionalTitle?: string | null;
  readonly professionalBio?: string | null;
  readonly practitionerCode: string;
}

let session: RealSession;
let doctorProfile: OwnProfile;

test.beforeAll(async ({ browser }) => {
  const api = await contextoDeApi();
  try {
    test.skip(!(await apiViva(api)), 'Omitido: la API no responde. No es un verde.');
    const login = await api.post('/iam/auth/login', {
      data: { email: doctora().identificador, password: doctora().clave },
    });
    expect(login.status(), `login del médico por API: ${await login.text()}`).toBe(200);
    const { accessToken } = (await login.json()) as { accessToken: string };
    const own = await api.get('/profiles/practitioners/me/summary', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(own.status(), 'GET /profiles/practitioners/me/summary').toBe(200);
    doctorProfile = (await own.json()) as OwnProfile;
    expect(doctorProfile.profileId, 'el resumen propio trae profileId').toBeTruthy();

    const patient: Actor = await crearPaciente(api);
    session = await openRealSession(browser, patient);
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await session?.close();
});

test('el paciente abre la ficha del médico y ve lo mismo que el médico guardó', async () => {
  const { page } = session;
  const detailPath = `/directory/${doctorProfile.profileId}`;

  const summary = await responseOf(
    page,
    'GET',
    new RegExp(`/profiles/practitioners/${doctorProfile.profileId}/summary$`),
    () => irA(page, detailPath),
  );
  expect(summary.status()).toBe(200);
  // La ficha pide el perfil de la ruta, nunca el propio (el paciente no tiene).
  expect(new URL(summary.url()).pathname).not.toContain('/me/');

  const seen = (await summary.json()) as OwnProfile;
  expect(seen.profileId).toBe(doctorProfile.profileId);
  expect(seen.practitionerCode).toBe(doctorProfile.practitionerCode);

  if (doctorProfile.displayName) {
    await expect(
      page.getByRole('heading', { name: doctorProfile.displayName }).first(),
    ).toBeVisible();
  }
  if (doctorProfile.professionalBio) {
    await expect(page.getByText(doctorProfile.professionalBio)).toBeVisible();
  }
  if (doctorProfile.professionalTitle) {
    await expect(page.getByText(doctorProfile.professionalTitle).first()).toBeVisible();
  }
});

test('la ficha no ofrece ninguna acción de dueño al paciente', async () => {
  const { page } = session;
  await expect(page.getByTestId('mi-perfil-editar')).toHaveCount(0);
  await expect(page.getByTestId('perfil-foto')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Configurar mi perfil' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mis artículos' })).toHaveCount(0);
  await expect(page.locator('a[href*="/my-account/edit"]')).toHaveCount(0);
});

test('«Sedes y horarios» cambia entre consultas y otros servicios', async () => {
  const { page } = session;
  const consultations = page.getByRole('tab', { name: 'Consultas' });
  const otherServices = page.getByRole('tab', { name: 'Otros servicios' });
  await expect(consultations).toBeVisible();
  await expect(otherServices).toBeVisible();

  await otherServices.click();
  await expect(otherServices).toHaveAttribute('aria-selected', 'true');
  await consultations.click();
  await expect(consultations).toHaveAttribute('aria-selected', 'true');
});

test('la ficha se vuelve a servir igual después de recargar', async () => {
  const { page } = session;
  const [summary] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        new URL(res.url()).pathname.endsWith(`/practitioners/${doctorProfile.profileId}/summary`),
      { timeout: 30_000 },
    ),
    reloadApp(page),
  ]);
  expect(summary.status()).toBe(200);
  if (doctorProfile.displayName) {
    await expect(
      page.getByRole('heading', { name: doctorProfile.displayName }).first(),
    ).toBeVisible();
  }
});
