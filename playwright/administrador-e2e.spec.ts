import { test, expect } from '@playwright/test';
import { administrador, apiViva, contextoDeApi } from './support/actores';
import { entrar, estable, irA, esperarAplicacionLista } from './support/sesion';

test.describe('E2E · Flujo Completo de Administrador (Mantra Core Health)', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    expect(await apiViva(api), 'El backend NestJS debe responder en /health').toBe(true);
    await api.dispose();
  });

  test('Recorrido E2E completo del Administrador', async ({ page }) => {
    test.setTimeout(120_000);
    const admin = administrador();

    // 1. Ingreso / Autenticación
    console.log('[E2E Admin] 1. Ingresando con credenciales de administrador:', admin.identificador);
    await entrar(page, admin);
    await esperarAplicacionLista(page);

    // 2. Dashboard
    console.log('[E2E Admin] 2. Verificando /dashboard');
    await irA(page, '/dashboard');
    await estable(page);
    await expect(page.locator('app-root')).not.toBeEmpty();
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/01-dashboard.png', fullPage: true });

    // 3. Mi Perfil / Cuenta
    console.log('[E2E Admin] 3. Verificando /my-account');
    await irA(page, '/my-account');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/02-my-account.png', fullPage: true });

    // 4. Verificación de Identidad
    console.log('[E2E Admin] 4. Verificando /my-account/identity/verify');
    await irA(page, '/my-account/identity/verify');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/03-identity-verify.png', fullPage: true });

    // 5. Padrón de Pacientes
    console.log('[E2E Admin] 5. Verificando /administration/patients');
    await irA(page, '/administration/patients');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/04-patients.png', fullPage: true });

    // 6. Alta de Paciente
    console.log('[E2E Admin] 6. Verificando /administration/patients/new');
    await irA(page, '/administration/patients/new');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/05-patient-new.png', fullPage: true });

    // 7. Alta Asistida
    console.log('[E2E Admin] 7. Verificando /administration/patients/assisted-registration');
    await irA(page, '/administration/patients/assisted-registration');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/06-assisted-registration.png', fullPage: true });

    // 8. Catálogo y Búsqueda de Terminología
    console.log('[E2E Admin] 8. Verificando /administration/terminology');
    await irA(page, '/administration/terminology');
    await estable(page);
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/buscar/i)).or(page.locator('input[type="text"]').first());
    if (await searchInput.isVisible()) {
      await searchInput.fill('cholera');
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/07-terminology.png', fullPage: true });

    // 9. Consola de Usuarios
    console.log('[E2E Admin] 9. Verificando /administration/users');
    await irA(page, '/administration/users');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/08-users.png', fullPage: true });

    // 10. Agenda / Recursos
    console.log('[E2E Admin] 10. Verificando /schedule');
    await irA(page, '/schedule');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/09-schedule.png', fullPage: true });

    // 11. Archivo Clínico
    console.log('[E2E Admin] 11. Verificando /medical-records');
    await irA(page, '/medical-records');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/10-medical-records.png', fullPage: true });

    // 12. Organizaciones
    console.log('[E2E Admin] 12. Verificando /administration/organizations');
    await irA(page, '/administration/organizations');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/11-organizations.png', fullPage: true });

    // 13. Facturación
    console.log('[E2E Admin] 13. Verificando /billing');
    await irA(page, '/billing');
    await estable(page);
    await page.screenshot({ path: 'artifacts/playwright/admin-flow/12-billing.png', fullPage: true });

    console.log('[E2E Admin] ✓ Flujo completo de Administrador completado exitosamente.');
  });
});
