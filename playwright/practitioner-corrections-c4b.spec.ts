import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Comprobantes de pago — correcciones del médico, carril C4 (punto 11).
 *
 * Corre contra la maqueta (`mockBackend: true`), con las cuentas del propio
 * simulador. La maqueta trae hoy, a las 13:00, una cita confirmada de la
 * paciente principal con la médica y dos comprobantes pendientes: una foto de
 * la transferencia y el PDF del pago por QR. El recorrido entero ocurre en la
 * misma pestaña, porque los datos de la maqueta viven en ella:
 *
 * 1. La paciente abre su cita en «Mis citas» y sube un comprobante.
 * 2. La médica abre «Estado del pago» en su día: ve los tres, abre el visor,
 *    rechaza el que subió la paciente —con motivo— y confirma la
 *    transferencia. La insignia de la cita pasa a «Pagada» sin recargar, y el
 *    PDF que sigue pendiente ya sólo se puede rechazar.
 * 3. La paciente ve el motivo del rechazado y que ya no hace falta subir otro.
 *
 * Aparte, la médica abre «Estado del pago» de una cita sin comprobantes.
 *
 * Las fotos quedan en `docs/frontend/evidence/correcciones-medico-c4b/`, a 360
 * y 1280 px y en claro y oscuro, nunca de página entera: de la pantalla visible
 * o de la pieza que se mira.
 */

const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'correcciones-medico-c4b');

const APPOINTMENTS_CALENDAR = '/my-account/appointments?vista=calendario';
const SCHEDULE = '/schedule';

/** La paciente principal de la maqueta, como la nombra la agenda. */
const PATIENT_NAME = 'Ana Lucía Pérez Quiroga';
/** La hora de la cita con comprobantes que trae la maqueta. */
const BOOKING_TIME = '13:00';

const REJECTION_REASON = 'No se ve el número de la transferencia: suba la captura completa.';

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 800 },
] as const;

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** Un PNG de 1×1 de verdad: lo que se sube tiene que poder verse como imagen. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * Los dos scripts en línea del «event replay» de Angular bajo SSR, que la CSP
 * del servidor bloquea en todas las páginas: es el mismo defecto previo que
 * excluyen las demás pruebas del carril, por su hash exacto. Cualquier otra
 * violación de CSP sigue haciendo fallar la prueba.
 */
const EVENT_REPLAY_CSP_HASHES = [
  'sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg=',
  'sha256-kSSVmtxCwx5BcVxBHL/eBew1IVRG78eha+qAq9Y8B38=',
];

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/** Errores de consola y respuestas 5xx, para fallar si la pantalla los produce. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const isEventReplay =
      /Content Security Policy/.test(text) && EVENT_REPLAY_CSP_HASHES.some((h) => text.includes(h));
    // Una navegación que interrumpe una transición de vista del router la aborta;
    // el navegador lo anuncia así y no es un fallo de la pantalla.
    const isSkippedTransition = text.includes('AbortError: Transition was skipped');
    if (!isEventReplay && !isSkippedTransition) problems.push(`console: ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

/**
 * El tema, cambiado en el lugar y no recargando: el modal abierto tiene que
 * fotografiarse abierto. Son los dos atributos que escribe `ThemeService`.
 */
async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((value) => {
    document.documentElement.setAttribute('data-theme', value);
    document.documentElement.setAttribute('data-tema', value === 'dark' ? 'oscuro' : 'claro');
  }, theme);
}

/** Foto de la pantalla visible (nunca de página entera) o de una pieza. */
async function snapshot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

/**
 * La misma pieza a 360 y 1280, en claro y oscuro. Vuelve a 1280 en claro,
 * que es donde sigue el recorrido.
 */
async function snapshotMatrix(page: Page, piece: () => Locator, name: string): Promise<void> {
  for (const theme of THEMES) {
    await applyTheme(page, theme);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await esperarAQueSeAsiente(page);
      await piece().scrollIntoViewIfNeeded();
      await snapshot(page, `${name}-${viewport.name}-${theme}`);
    }
  }
  await applyTheme(page, 'light');
  await page.setViewportSize({ width: 1280, height: 800 });
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId('header-cuenta').first().click();
  await page.getByTestId('header-cerrar-sesion').first().click();
  await page.waitForURL(/\/auth(?:[/?]|$)/);
}

/* -- la paciente ------------------------------------------------------------ */

/** Abre, en el calendario de «Mis citas», la cita de hoy con la médica. */
async function openPatientBooking(page: Page): Promise<Locator> {
  await page.goto(APPOINTMENTS_CALENDAR, { waitUntil: 'domcontentloaded' });
  const today = page.locator('.calendario__dia--hoy');
  const booking = today.locator('.calendario__turno').filter({ hasText: BOOKING_TIME }).first();
  await expect(booking).toBeVisible({ timeout: 30_000 });
  await booking.click();
  const block = page.getByTestId('turnos-detalle').getByTestId('booking-receipts');
  await expect(block).toBeVisible();
  await expect(block.getByTestId('booking-receipts-list')).toBeVisible();
  return block;
}

/* -- la médica --------------------------------------------------------------- */

function paymentButton(page: Page): Locator {
  return page.getByRole('button', {
    name: `Revisar el pago y los comprobantes: ${PATIENT_NAME}, ${BOOKING_TIME}`,
  });
}

/** «Estado del pago» se abre con el teclado: también es lo que se mide. */
async function openReceiptsDialog(page: Page, button: Locator): Promise<Locator> {
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Comprobantes de pago' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('payment-receipts-loading')).toHaveCount(0);
  return dialog;
}

/**
 * Un día con consultas en la agenda de la médica, como lo lee `?day=`: hoy, o
 * el lunes si hoy es domingo —sus plantillas atienden de lunes a sábado—.
 */
function dayWithConsultations(): string {
  const day = new Date();
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

function receiptRow(dialog: Locator, text: string): Locator {
  return dialog.locator('app-payment-receipt-row').filter({ hasText: text });
}

test('paciente sube un comprobante, la médica rechaza uno y confirma otro, y la paciente ve el motivo', async ({
  page,
}) => {
  test.setTimeout(360_000);
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // 1 · La paciente sube su comprobante.
  await entrarAlSimulador(page, 'paciente', '');
  let block = await openPatientBooking(page);
  await expect(block.getByTestId('booking-receipt-item')).toHaveCount(2);
  await snapshotMatrix(page, () => block, 'patient-receipt-block');

  await block.getByTestId('booking-receipt-file').setInputFiles({
    name: 'captura-transferencia.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
  await block.getByTestId('booking-receipt-amount').fill('150,00');
  await block.getByTestId('booking-receipt-note').locator('textarea').fill('Pagué desde la cuenta de mi esposo.');
  await block.getByTestId('booking-receipt-submit').click();
  await expect(block.getByTestId('booking-receipts-notice')).toContainText('Comprobante enviado');
  await expect(block.getByTestId('booking-receipt-item')).toHaveCount(3);
  await expect(block.getByTestId('booking-receipt-item').first()).toContainText('Pendiente');
  await snapshotMatrix(page, () => block, 'patient-receipt-uploaded');
  await signOut(page);

  // 2 · La médica revisa desde su día.
  await entrarAlSimulador(page, 'medica', '');
  await page.goto(SCHEDULE, { waitUntil: 'domcontentloaded' });
  const dialog = await openReceiptsDialog(page, paymentButton(page));
  const rows = dialog.locator('app-payment-receipt-row');
  await expect(rows).toHaveCount(3);
  await expect(dialog.getByTestId('payment-receipt-status')).toHaveText(['Pendiente', 'Pendiente', 'Pendiente']);
  await expect(
    dialog.getByRole('button', { name: 'Confirmar comprobante de 150,00 Bs', exact: false }).first(),
  ).toBeVisible();
  await snapshotMatrix(page, () => dialog, 'practitioner-receipts-dialog-three');

  // El visor: la foto de la transferencia, a tamaño completo y con «Descargar».
  await receiptRow(dialog, 'Transferencia desde Banco Unión').getByTestId('payment-receipt-view').click();
  const viewer = dialog.getByTestId('payment-receipt-viewer');
  await expect(viewer.locator('img')).toBeVisible();
  await expect(viewer.getByTestId('payment-receipt-download')).toHaveAttribute(
    'download',
    'transferencia-banco-union.png',
  );
  await snapshotMatrix(page, () => viewer, 'practitioner-receipt-viewer-image');
  await viewer.getByTestId('payment-receipt-viewer-back').click();

  // Y el PDF del pago por QR, dentro del mismo modal.
  await receiptRow(dialog, 'PDF').getByTestId('payment-receipt-view').click();
  await expect(viewer.locator('iframe')).toBeVisible();
  await snapshot(page, 'practitioner-receipt-viewer-pdf-1280-light');
  await viewer.getByTestId('payment-receipt-viewer-back').click();

  // Rechaza el que subió la paciente: sin motivo no sale, y el campo dice por qué.
  const uploaded = receiptRow(dialog, 'Pagué desde la cuenta de mi esposo.');
  await uploaded.getByTestId('payment-receipt-reject').click();
  const rejection = dialog.getByTestId('payment-receipt-rejection-form');
  const reason = rejection.getByLabel('Motivo del rechazo');
  await expect(rejection.getByTestId('payment-receipt-rejection-submit')).toBeDisabled();
  await reason.focus();
  await reason.blur();
  await expect(rejection).toContainText('al menos 3 caracteres');
  await snapshotMatrix(page, () => rejection, 'practitioner-reject-reason-required');
  await reason.fill(REJECTION_REASON);
  await rejection.getByTestId('payment-receipt-rejection-submit').click();
  await expect(uploaded.getByTestId('payment-receipt-status')).toHaveText('Rechazado');
  await expect(uploaded.getByTestId('payment-receipt-rejection-reason')).toHaveText(REJECTION_REASON);

  // Confirma la transferencia: la cita queda pagada.
  const transfer = receiptRow(dialog, 'Transferencia desde Banco Unión');
  await transfer.getByTestId('payment-receipt-confirm').click();
  await expect(transfer.getByTestId('payment-receipt-status')).toHaveText('Confirmado');
  await expect(transfer.getByTestId('payment-receipt-confirm')).toHaveCount(0);
  await expect(dialog.getByTestId('payment-receipts-payment-state')).toContainText('Pagada');
  // Con la cita pagada, el PDF que sigue pendiente ya no se confirma: sólo se rechaza.
  const qr = receiptRow(dialog, 'PDF');
  await expect(qr.getByTestId('payment-receipt-status')).toHaveText('Pendiente');
  await expect(qr.getByTestId('payment-receipt-confirm')).toHaveCount(0);
  await expect(qr.getByTestId('payment-receipt-reject')).toBeVisible();
  await snapshotMatrix(page, () => dialog, 'practitioner-receipt-confirmed');

  // Al cerrar, la insignia de la cita en el día ya dice «Pagada»: sin recargar.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const dayActions = page.getByTestId('dia-acciones').filter({ has: paymentButton(page) });
  await expect(dayActions.getByTestId('payment-state-badge')).toHaveText('Pagada');
  await snapshotMatrix(page, () => dayActions, 'practitioner-schedule-paid-badge');
  await signOut(page);

  // 3 · La paciente ve el motivo del rechazado, y que ya no hace falta otro.
  await entrarAlSimulador(page, 'paciente', '');
  block = await openPatientBooking(page);
  await expect(block.getByTestId('booking-receipt-rejection-reason')).toContainText(REJECTION_REASON);
  await expect(block.getByTestId('booking-receipts-blocked')).toContainText('ya figura como pagada');
  await expect(block.getByTestId('booking-receipts-form')).toHaveCount(0);
  await snapshotMatrix(page, () => block, 'patient-receipt-rejection-reason');

  expect(problems).toEqual([]);
});

test('médica · una cita sin comprobantes lo dice y ofrece marcar el pago sin comprobante', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await page.goto(`${SCHEDULE}?day=${dayWithConsultations()}`, { waitUntil: 'domcontentloaded' });

  // Cualquier otra cita del día: la de las 13:00 es la que trae comprobantes.
  const another = page
    .getByRole('button', {
      name: new RegExp(`^Revisar el pago y los comprobantes: (?!${PATIENT_NAME}, ${BOOKING_TIME}$)`),
    })
    .first();
  const dialog = await openReceiptsDialog(page, another);
  await expect(dialog).toContainText('El paciente todavía no subió comprobantes');
  await snapshotMatrix(page, () => dialog, 'practitioner-receipts-dialog-empty');

  await dialog.getByTestId('payment-receipts-manual-toggle').click();
  await expect(dialog.getByTestId('payment-manual')).toBeVisible();
  await snapshot(dialog, 'practitioner-manual-payment-1280-light');

  expect(problems).toEqual([]);
});
