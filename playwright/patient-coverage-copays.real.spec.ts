import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { entrar, irA } from './support/sesion';

interface RealPatient {
  nationalId: string;
  password: string;
  profileId: string;
}
interface OrderIds {
  approved: string;
  partial: string;
  denied: string;
  pending: string;
}
interface CopaysFixture {
  patient: RealPatient;
  otherPatient: RealPatient;
  diagnosticOrders: OrderIds;
  pharmacyOrders: OrderIds;
  pharmacyTenantId: string;
}

test.describe.configure({ mode: 'serial' });
let fixture: CopaysFixture;
const orderStates = ['approved', 'partial', 'denied', 'pending'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requirePatientCredentials(patient: RealPatient | undefined, label: string): void {
  for (const field of ['nationalId', 'password'] as const) {
    const value = patient?.[field];
    expect(
      typeof value === 'string' && value.trim().length > 0,
      `${label}.${field} must be configured in the real API fixture`,
    ).toBe(true);
  }
  expect(patient?.profileId, `${label}.profileId must be a valid UUID`).toMatch(uuidPattern);
}

function requireOrderIds(orders: OrderIds | undefined, label: string): void {
  expect(Object.keys(orders ?? {}).sort(), `${label} must include all four outcomes`).toEqual(
    [...orderStates].sort(),
  );
  for (const state of orderStates) {
    expect(orders?.[state], `${label}.${state} must be a valid UUID`).toMatch(uuidPattern);
  }
  expect(
    new Set(orderStates.map((state) => orders?.[state])).size,
    `${label} must contain four distinct orders`,
  ).toBe(4);
}

function requireSettlementOrders(): void {
  requireOrderIds(fixture.pharmacyOrders, 'pharmacyOrders');
  requireOrderIds(fixture.diagnosticOrders, 'diagnosticOrders');
}

test.beforeAll(() => {
  const path =
    process.env['E2E_COPAYS_FIXTURE'] ??
    resolve(process.cwd(), '../mantra-core-health-api/node_modules/.cache/copays-e2e-fixture.json');
  // Created by the isolated API journey through its real write endpoints.
  fixture = JSON.parse(readFileSync(path, 'utf8')) as CopaysFixture;
  requirePatientCredentials(fixture?.patient, 'patient');
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`patient coverage real ${viewport.width}`, () => {
    test.use({ viewport });

    test('real patient profile displays policy and benefits', async ({ page }, info) => {
      await entrar(page, {
        rol: 'paciente',
        identificador: fixture.patient.nationalId,
        clave: fixture.patient.password,
        nombre: 'Paciente copagos',
      });
      await irA(page, '/my-account');
      await page.getByRole('tab', { name: 'Seguros y tutores' }).click();
      const policy = page
        .getByTestId('patient-coverage-card')
        .filter({ hasText: 'Plan Copagos Real' });
      await expect(policy).toBeVisible();
      await expect(policy).toContainText('Hemograma completo');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`real-coverage-${viewport.width}.png`),
        fullPage: true,
      });
    });

    test('real order settlements survive reload through the real API', async ({ page }, info) => {
      requireSettlementOrders();
      await entrar(page, {
        rol: 'paciente',
        identificador: fixture.patient.nationalId,
        clave: fixture.patient.password,
        nombre: 'Paciente copagos',
      });
      const outcomes = {
        approved: 'Aprobado',
        partial: 'Aprobado parcialmente',
        denied: 'Rechazado por el seguro',
        pending: 'todavía no publicó',
      } as const;
      for (const state of orderStates) {
        const orderId = fixture.pharmacyOrders[state];
        const response = page.waitForResponse(
          (response) =>
            response.url().includes(`/pharmacy/orders/${orderId}`) &&
            response.request().method() === 'GET',
        );
        await irA(page, `/my-account/pharmacy-orders/${orderId}`);
        expect((await response).status()).toBe(200);
        const settlement = page.getByTestId('patient-insurance-settlement');
        await expect(
          settlement.getByText(outcomes[state], { exact: state !== 'pending' }),
        ).toBeVisible();
        if (state === 'partial') {
          await expect(settlement).toContainText('Excluido sin asignar');
          await expect(settlement.getByText('Cláusula:', { exact: false }).first()).toBeVisible();
          await page.reload();
          await expect(settlement).toContainText('Aprobado parcialmente');
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: info.outputPath(`real-pharmacy-${viewport.width}.png`),
            fullPage: true,
          });
        }
        if (state === 'denied') {
          await expect(
            settlement.locator('dl > div').filter({ hasText: 'A tu cargo' }),
          ).toContainText('0.00');
        }
        if (state === 'pending') await expect(settlement.locator('dl')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }

      const ordersResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/diagnostic-results/me/orders') &&
          response.request().method() === 'GET',
      );
      await irA(page, '/my-account/diagnostic-orders');
      const body = (await (await ordersResponse).json()) as { items: { id: string }[] };
      expect(body.items.map((order) => order.id)).toEqual(
        expect.arrayContaining(Object.values(fixture.diagnosticOrders)),
      );
      for (const state of orderStates) {
        const orderId = fixture.diagnosticOrders[state];
        const order = page.locator(`[data-order-id="${orderId}"]`);
        await expect(
          order
            .getByTestId('patient-insurance-settlement')
            .getByText(outcomes[state], { exact: state !== 'pending' }),
        ).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`real-diagnostics-${viewport.width}.png`),
        fullPage: true,
      });
    });
  });
}

test('another patient cannot obtain the policy or published settlement by order identifier', async ({
  page,
}) => {
  requireSettlementOrders();
  requirePatientCredentials(fixture.otherPatient, 'otherPatient');
  await entrar(page, {
    rol: 'paciente',
    identificador: fixture.otherPatient.nationalId,
    clave: fixture.otherPatient.password,
    nombre: 'Otro paciente copagos',
  });
  const response = page.waitForResponse(
    (response) =>
      response.url().includes(`/pharmacy/orders/${fixture.pharmacyOrders.partial}`) &&
      response.request().method() === 'GET',
  );
  await irA(page, `/my-account/pharmacy-orders/${fixture.pharmacyOrders.partial}`);
  expect((await response).status()).toBe(404);
  await expect(page.getByTestId('patient-insurance-settlement')).toHaveCount(0);
  await expect(page.getByText('Plan Copagos Real')).toHaveCount(0);
});
