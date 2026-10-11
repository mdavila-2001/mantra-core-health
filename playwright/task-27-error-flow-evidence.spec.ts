import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const EVIDENCE = 'docs/progress/evidence/flujo-errores-visual';

async function setFault(page: Page, fault: unknown): Promise<void> {
  await page.addInitScript(
    (value) => sessionStorage.setItem('mock:fallos', JSON.stringify([value])),
    fault,
  );
}

async function signIn(page: Page, user: string): Promise<void> {
  await entrarAlSimulador(page, user, BASE);
  await page.setViewportSize({ width: 768, height: 1024 });
}

async function openDoctorPrescription(page: Page): Promise<void> {
  await page.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Nombre o código').fill('Ana');
  await page.getByTestId('paciente-ver-expediente').first().click();
  await page.waitForURL(/\/medical-records\/[^/]+$/);
  await page.getByRole('tab', { name: /Medicación/ }).click();
  await page.getByTestId('expediente-nueva-receta').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function chooseMedicine(page: Page): Promise<void> {
  const dialog = page.getByTestId('content-dialog');
  const picker = dialog.locator('app-reference-combobox input').first();
  await picker.fill('Enalapril');
  const option = dialog.getByRole('option', { name: 'Enalapril 10 mg comprimidos' });
  await expect(option).toBeVisible();
  await option.click();
}

async function addPrescriptionReason(page: Page): Promise<void> {
  const dialog = page.getByTestId('content-dialog');
  await dialog.getByTestId('receta-diagnostico').locator('select').selectOption({
    label: 'Otro motivo — escribirlo',
  });
  await dialog.getByTestId('receta-motivo').locator('textarea').fill('Control de síntomas');
  await expect(dialog.getByRole('button', { name: 'Prescribir' })).toBeEnabled();
}

test.describe('Handoff 2.7 · errores visibles en 768 px', () => {
  test('interacciones fallidas y error 422 anclado al medicamento', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setFault(page, {
      patron: '/cds/check-interactions',
      modo: 'error',
      metodos: ['POST'],
    });
    await signIn(page, 'medica');
    await openDoctorPrescription(page);
    await page.evaluate(() => {
      sessionStorage.setItem(
        'mock:fallos',
        JSON.stringify([{ patron: '/cds/check-interactions', modo: 'error', metodos: ['POST'] }]),
      );
    });

    await chooseMedicine(page);
    await addPrescriptionReason(page);
    await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
    const interactionWarning = page.getByTestId('receta-interacciones-sin-revisar');
    await expect(interactionWarning).toBeVisible();
    await interactionWarning.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${EVIDENCE}/receta-interacciones-768.png` });

    await page.evaluate(() => {
      sessionStorage.setItem(
        'mock:fallos',
        JSON.stringify([
          { patron: '/clinical/medication-requests', modo: 'validation', metodos: ['POST'] },
          { patron: '/cds/check-interactions', modo: 'error', metodos: ['POST'] },
        ]),
      );
    });
    const medication = page.getByTestId('content-dialog').locator('app-reference-combobox input').first();
    await chooseMedicine(page);
    await addPrescriptionReason(page);
    await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
    const medicationField = page.locator('app-form-field').filter({ hasText: 'Medicamento' });
    const fieldError = medicationField.locator('.form-field-error');
    await expect(fieldError).toContainText('Elija un medicamento del catálogo.');
    await expect(medication).toHaveAttribute('aria-invalid', 'true');
    await fieldError.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${EVIDENCE}/receta-validacion-422-768.png` });
  });

  test('Mi salud muestra el fallo de la ruta real del resumen clínico', async ({ page }) => {
    await setFault(page, {
      patron: '/clinical/patients/',
      modo: 'error',
      metodos: ['GET'],
    });
    await signIn(page, 'paciente');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    const lastPrescription = page.getByTestId('mi-salud-receta');
    await expect(lastPrescription).toContainText('No se pudo consultar');
    await expect(lastPrescription).not.toContainText('Todavía no le recetaron nada');
    await page.screenshot({ path: `${EVIDENCE}/mi-salud-ultima-receta-768.png`, fullPage: true });
  });

  test('el cockpit contable muestra el error de ejercicios fiscales', async ({ page }) => {
    await setFault(page, {
      patron: '/accounting/fiscal-years',
      modo: 'error',
      metodos: ['GET'],
    });
    await signIn(page, 'administrador');
    await page.goto(`${BASE}/administration/accounting/cockpit`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Simulado: fallo del servidor')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/dinero-cockpit-error-768.png`, fullPage: true });
  });

  test('el muro social muestra el error de publicaciones', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setFault(page, {
      patron: '/public/posts',
      modo: 'error',
      metodos: ['GET'],
    });
    await page.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('red-social').getByRole('alert')).toContainText(
      'No pudimos cargar las publicaciones.',
    );
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/social-publicaciones-error-768.png`, fullPage: true });
  });
});
