import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import {
  empezarElAlta,
  avanzarHasta,
  elegirLocalidadDeResidencia,
} from './support/registro-paciente';

const EVIDENCE_DIR = path.resolve('artifacts/playwright/auditoria');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

test.describe('Auditoría Técnica y Suite de Pruebas: Flujo Mockup', () => {
  let consoleLogs: Array<{ type: string; text: string }> = [];
  let networkCalls: Array<{ url: string; status: number; method: string }> = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    networkCalls = [];

    page.on('console', (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/iam/') || u.includes('/profiles/') || u.includes('/scheduling/') || u.includes('/insurance/')) {
        networkCalls.push({ url: u, status: res.status(), method: res.request().method() });
      }
    });
  });

  test('TC-01 [Happy Path] Carga Inicial, Lienzo y Acceso Público', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    await expect(page.locator('app-root')).not.toBeEmpty();
    const titulo = await page.title();
    expect(titulo).toContain('AloVida');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc01-carga-base.png'), fullPage: true });
  });

  test('TC-02 [Edge Case] Validación de Campos Obligatorios Vacíos en Alta de Paciente', async ({ page }) => {
    await page.goto('/auth/register/patient');
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

    const btnContinuar = page.getByTestId('paginated-form-continuar');
    await btnContinuar.click();

    // El motor bloquea la transición de página: permanece en paso 1
    const tituloPaso = page.locator('.paginated-form__titulo');
    await expect(tituloPaso).toHaveText('¿Cómo te llamás?');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc02-edge-paciente-vacios.png') });
  });

  test('TC-03 [Happy Path] Registro Completo de Paciente Paso a Paso (10 pasos)', async ({ page }) => {
    const sufijo = Date.now();
    const docPrueba = `CI-QA-${sufijo}`;
    const emailPrueba = `paciente.audit.${sufijo}@example.test`;

    // Pasos 1 a 4 con helper oficial probado
    await empezarElAlta(page, docPrueba);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso4-contactos.png') });

    // Paso 5: Residencia y mapa
    await avanzarHasta(page, '¿Dónde vivís?');
    await elegirLocalidadDeResidencia(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso5-residencia-mapa.png') });

    // Paso 6: Trabajo (empresa)
    await avanzarHasta(page, '¿Dónde trabajás?');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso6-trabajo.png') });

    // Paso 7: Lugar de trabajo
    await avanzarHasta(page, 'El lugar donde trabajás');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso7-lugar-trabajo.png') });

    // Paso 8: Cuenta de acceso
    await avanzarHasta(page, 'Tu acceso');
    await page.getByTestId('registro-correo').fill(emailPrueba);
    await page.getByTestId('registro-password').fill('P@ssword1234!');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso8-cuenta.png') });

    // Paso 9: Seguro de salud
    await avanzarHasta(page, 'Tu seguro de salud');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso9-seguro.png') });

    // Paso 10: Datos de facturación
    await avanzarHasta(page, 'Datos de facturación');
    const nit = page.getByTestId('registro-nit');
    if (await nit.isVisible().catch(() => false)) {
      await nit.fill('9988776655');
      await page.getByTestId('registro-razon-social').fill('Audit Corp SRL');
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso10-facturacion.png') });

    // Enviar formulario final
    const btnCrear = page.getByTestId('paginated-form-continuar');
    await expect(btnCrear).toHaveText(/Crear cuenta/);
    await btnCrear.click();

    // Confirmación final
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc03-paso11-exito.png') });
  });

  test('TC-04 [Edge Case] Formato Inválido de Correo y Clave Corta en Registro', async ({ page }) => {
    await empezarElAlta(page, '1234567');
    await avanzarHasta(page, '¿Dónde vivís?');
    await elegirLocalidadDeResidencia(page);
    await avanzarHasta(page, '¿Dónde trabajás?');
    await avanzarHasta(page, 'El lugar donde trabajás');
    await avanzarHasta(page, 'Tu acceso');

    await page.getByTestId('registro-correo').fill('correo-sin-formato');
    await page.getByTestId('registro-password').fill('123');

    const btnContinuar = page.getByTestId('paginated-form-continuar');
    await btnContinuar.click();

    // No debe avanzar a la página de seguros
    const tituloPaso = page.locator('.paginated-form__titulo');
    await expect(tituloPaso).toHaveText('Tu acceso');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc04-edge-acceso-invalido.png') });
  });

  test('TC-05 [Happy Path] Registro de Profesional Médico (Practitioner) - Paso 1 y 2', async ({ page }) => {
    await page.goto('/auth/register/practitioner');
    await expect(page.getByTestId('registro-form-profesional')).toBeVisible();

    await expect(page.locator('.paginated-form__titulo')).toHaveText('¿Cómo te llamás?');
    await page.getByTestId('registro-pro-nombre').fill('Mariana');
    await page.getByTestId('registro-pro-apellido-paterno').fill('Justiniano');

    const btnContinuar = page.getByTestId('paginated-form-continuar');
    await btnContinuar.click();

    await expect(page.locator('.paginated-form__titulo')).toHaveText('Tu documento de identidad');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc05-alta-medico-paso2.png') });
  });

  test('TC-06 [Happy Path] Registro de Organización - Catálogo Societario Bolivia', async ({ page }) => {
    await page.goto('/auth/register/organization');
    await expect(page.locator('.paginated-form__titulo')).toHaveText('La empresa');

    const selectSocietario = page.getByLabel('Tipo societario');
    await expect(selectSocietario).toBeVisible();

    // Esperar que carguen las opciones del catálogo
    await expect(selectSocietario.locator('option')).not.toHaveCount(1, { timeout: 10000 });
    const opciones = await selectSocietario.evaluate((sel: HTMLSelectElement) =>
      Array.from(sel.options).map((o) => o.text).join(' | ')
    );
    expect(opciones).toMatch(/(S\.A\.|Sociedad Anónima|S\.R\.L\.)/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc06-alta-organizacion.png') });
  });

  test('TC-07 [Edge Case] Login con Credenciales Inválidas y Feedback UI', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByTestId('login-form')).toBeVisible();

    await page.getByTestId('login-identifier').fill('usuario_inexistente@alovida.mock');
    await page.getByTestId('login-password').fill('claveErronea123');
    await page.getByTestId('login-submit').click();

    const alertaError = page.getByTestId('login-error');
    await expect(alertaError).toBeVisible();
    await expect(alertaError).toContainText('Las credenciales no son válidas.');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc07-edge-login-error.png') });
  });

  test('TC-08 [Happy Path] Autenticación de Médico (Login) y Trazabilidad de Sesión', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('medica@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();

    await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 15000 });
    if (page.url().includes('/auth/organization')) {
      await page.getByTestId('tenant-opcion').first().click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    }

    expect(page.url()).toContain('/dashboard');
    const storageKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(storageKeys.length).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc08-dashboard-medico.png'), fullPage: true });
  });

  test('TC-09 [Flujo Operativo] Módulo de Consultas Médicas y Horarios (/schedule)', async ({ page }) => {
    // Entrar como médico
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('medica@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    if (page.url().includes('/auth/organization')) {
      await page.getByTestId('tenant-opcion').first().click();
    }
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/schedule/);

    const mainHeader = page.locator('app-page-header');
    await expect(mainHeader).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc09-agenda-schedule.png'), fullPage: true });
  });

  test('TC-10 [Flujo Operativo] Módulo de Farmacia y Pedidos (/my-account/pharmacy-orders)', async ({ page }) => {
    // Entrar como paciente
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/my-account/pharmacy-orders');
    await expect(page).toHaveURL(/\/my-account\/pharmacy-orders/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc10-farmacia-pedidos.png'), fullPage: true });
  });

  test('TC-11 [Flujo Operativo] Módulo de Solicitudes de Aseguradora (/administration/insurance-claims)', async ({ page }) => {
    // Entrar como admin
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('admin@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/administration/insurance-claims');
    await expect(page).toHaveURL(/\/administration\/insurance-claims/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc11-aseguradora-claims.png'), fullPage: true });
  });

  test('TC-12 [Flujo Operativo] Módulo de Puntos y Fidelización (/my-account/loyalty)', async ({ page }) => {
    // Entrar como paciente
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/my-account/loyalty');
    await expect(page).toHaveURL(/\/my-account\/loyalty/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'tc12-puntos-fidelizacion.png'), fullPage: true });
  });
});
