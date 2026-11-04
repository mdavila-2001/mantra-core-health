/**
 * Buzón de solicitudes de acceso con los dos roles, en la maqueta.
 *
 * El recorrido que pidió Pablo, `UI → petición → respuesta → persistencia →
 * recarga → UI`:
 *
 * 1. la médica pide acceso a dos especialidades de Ana;
 * 2. lo ve en «Enviadas», pendiente;
 * 3. Ana lo recibe y autoriza una sola;
 * 4. queda en «Historial» como activa, con lo autorizado;
 * 5. Ana lo revoca, con confirmación;
 * 6. se recarga y la revocación sigue ahí.
 *
 * Además: un rechazo, que el paciente no tiene por dónde iniciar un pedido por
 * especialidad, y las capturas de las tres pantallas en los cinco viewports.
 *
 * Las dos cuentas comparten pestaña a propósito: el simulador guarda su estado
 * en `sessionStorage`, así que lo que pide la médica es lo que Ana recibe. Al
 * cambiar de cuenta se borra sólo la sesión (`localStorage`), no la memoria
 * del simulador.
 *
 * Corre contra `ng serve` en modo demo (simulador). Sin consola en rojo.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
/** Ana Lucía Pérez Quiroga, the simulator's patient (`uuid('pid-paciente')`). */
const ANA = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
const INBOX = '/my-account/access-requests';
const EVIDENCE = join('docs', 'frontend', 'evidence', 'access-requests-two-roles');
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

test.describe.configure({ mode: 'serial' });

/** Page errors; the full-glossary probe is expected (see carril 03). */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const glossaryProbe = msg.location().url.includes('/glossary-data/');
    if (msg.type() === 'error' && !/Content Security Policy/.test(msg.text()) && !glossaryProbe) {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** Switches account in the same tab: drops the session, keeps the simulator's memory. */
async function signIn(page: Page, account: 'medica' | 'paciente'): Promise<void> {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await entrarAlSimulador(page, account, BASE);
}

async function openInbox(page: Page, tab: 'Recibidas' | 'Enviadas' | 'Historial'): Promise<void> {
  await page.goto(`${BASE}${INBOX}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Buzón de solicitudes' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
  await esperarAQueSeAsiente(page);
}

/** The request card of the practitioner's granular request, in the open tab. */
function granularFromRojas(page: Page): Locator {
  return page
    .getByRole('tabpanel')
    .locator('app-access-request-card')
    .filter({ hasText: /Valeria Rojas/ })
    .filter({ hasText: 'Por especialidad' });
}

/** The practitioner asks Ana for the given specialties, from «Solicitar vinculación». */
async function requestGranular(page: Page, specialties: readonly string[], shot?: string): Promise<void> {
  await page.goto(`${BASE}/medical-records/${ANA}/request-access`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('segmentado-GRANULAR').click();
  const picker = page.getByTestId('request-access-specialties');
  for (const name of specialties) {
    // Click the label, like a person: the native input hides under the drawn box.
    await picker.getByText(name, { exact: true }).click();
    await expect(picker.getByRole('checkbox', { name, exact: true })).toBeChecked();
  }
  if (shot !== undefined) await page.screenshot({ path: join(EVIDENCE, shot) });
  await page.getByRole('button', { name: 'Pedir vinculación' }).click();
  await page.waitForURL((url) => url.pathname === '/medical-records', { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('granular: la médica pide dos especialidades, Ana autoriza una, la revoca y persiste tras recargar', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1 · the practitioner asks for two specialties.
  await signIn(page, 'medica');
  await requestGranular(page, ['Cardiología', 'Neurología'], 'practitioner-01-request-granular-1440.png');

  // 2 · she sees it in «Enviadas», pending.
  await openInbox(page, 'Enviadas');
  const sent = page.getByRole('tabpanel').locator('app-access-request-card').filter({ hasText: /Ana Lucía Pérez/ });
  await expect(sent.filter({ hasText: 'Por especialidad' }).first()).toContainText('Pendiente');
  await expect(sent.first()).toContainText('Especialidades pedidas: Cardiología, Neurología');
  await expect(page.getByText('Usted elige')).toHaveCount(0);
  await page.screenshot({ path: join(EVIDENCE, 'practitioner-02-sent-1440.png') });

  // 3 · Ana receives it and authorizes only one.
  await signIn(page, 'paciente');
  await openInbox(page, 'Recibidas');
  const received = granularFromRojas(page);
  await expect(received).toContainText('Especialidades pedidas: Cardiología, Neurología');
  await page.screenshot({ path: join(EVIDENCE, 'patient-01-received-1440.png') });
  await received.getByTestId('segmentado-ACCEPT').click();
  const picker = received.getByTestId('access-request-specialties');
  await expect(picker.getByRole('checkbox', { name: 'Cardiología', exact: true })).toBeChecked();
  await expect(picker.getByRole('checkbox', { name: 'Neurología', exact: true })).toBeChecked();
  await picker.getByText('Neurología', { exact: true }).click();
  await expect(picker.getByRole('checkbox', { name: 'Neurología', exact: true })).not.toBeChecked();
  await page.screenshot({ path: join(EVIDENCE, 'patient-02-accept-one-1440.png') });
  await received.getByTestId('access-request-confirm').click();
  await expect(granularFromRojas(page)).toHaveCount(0);

  // 4 · it is in «Historial», active, with what was authorized.
  await page.getByRole('tab', { name: /^Historial/ }).click();
  const active = granularFromRojas(page).filter({ hasText: 'Activa' });
  await expect(active).toContainText('Autorizadas: Cardiología');
  await expect(active).not.toContainText('Autorizadas: Cardiología, Neurología');
  await page.screenshot({ path: join(EVIDENCE, 'patient-03-history-active-1440.png') });

  // 5 · Ana revokes it, confirming a destructive dialog.
  await active.getByTestId('access-request-revoke').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Revocar el acceso');
  await dialog.getByRole('button', { name: 'Revocar' }).click();
  await expect(granularFromRojas(page).filter({ hasText: 'Revocada' })).toHaveCount(1);

  // 6 · after a reload the revocation is still there: it is the simulator's, not the screen's.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openInbox(page, 'Historial');
  const revoked = granularFromRojas(page).filter({ hasText: 'Revocada' });
  await expect(revoked).toHaveCount(1);
  await expect(revoked.getByTestId('access-request-revoke')).toHaveCount(0);
  await page.screenshot({ path: join(EVIDENCE, 'patient-04-revoked-after-reload-1440.png') });

  // And the practitioner reads the same truth from her side.
  await signIn(page, 'medica');
  await openInbox(page, 'Historial');
  await expect(
    page.getByRole('tabpanel').locator('app-access-request-card').filter({ hasText: /Ana Lucía Pérez/ }).filter({ hasText: 'Revocada' }),
  ).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('granular: Ana rechaza y queda rechazada, sin nada autorizado', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await signIn(page, 'medica');
  await requestGranular(page, ['Dermatología']);

  await signIn(page, 'paciente');
  await openInbox(page, 'Recibidas');
  const received = granularFromRojas(page);
  await received.getByTestId('segmentado-REJECT').click();
  await expect(received.getByTestId('access-request-specialties')).toHaveCount(0);
  await received.getByTestId('access-request-confirm').click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await openInbox(page, 'Historial');
  const rejected = granularFromRojas(page).filter({ hasText: 'Rechazada' });
  await expect(rejected).toHaveCount(1);
  await expect(rejected.getByTestId('access-request-authorized')).toHaveCount(0);
  await expect(rejected.getByTestId('access-request-revoke')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('el paciente no tiene por dónde iniciar un pedido por especialidad', async ({ page }) => {
  const errors = watchConsole(page);
  await signIn(page, 'paciente');

  // The request screen is the practitioner's: the patient does not reach its selector.
  await page.goto(`${BASE}/medical-records/${ANA}/request-access`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);
  await expect(page.getByTestId('request-access-scope')).toHaveCount(0);

  // And the inbox only answers: there is no control to open a request.
  await openInbox(page, 'Recibidas');
  await expect(page.locator('app-access-requests').getByRole('button', { name: /Pedir/ })).toHaveCount(0);

  expect(errors).toEqual([]);
});

for (const viewport of VIEWPORTS) {
  test(`capturas del buzón y del pedido en ${viewport.name}`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await signIn(page, 'paciente');
    await openInbox(page, 'Recibidas');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: join(EVIDENCE, `patient-inbox-received-${viewport.name}.png`) });

    await signIn(page, 'medica');
    await page.goto(`${BASE}/medical-records/${ANA}/request-access`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('segmentado-GRANULAR').click();
    await expect(page.getByTestId('request-access-specialties')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: join(EVIDENCE, `practitioner-request-granular-${viewport.name}.png`) });

    await openInbox(page, 'Recibidas');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: join(EVIDENCE, `practitioner-inbox-received-${viewport.name}.png`) });

    expect(errors).toEqual([]);
  });
}
