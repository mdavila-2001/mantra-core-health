import { expect, test } from '@playwright/test';

import { iniciarSesion, simularApi } from './support/api';

/**
 * Los cuatro journeys que ninguna prueba cubría de punta a punta, y que jsdom
 * **no puede** cubrir: necesitan un router real, un `F5` de verdad y un
 * navegador que ejecute la hidratación.
 */
test.describe('Sesión', () => {
  test('sin sesión, el guard manda al login', async ({ page }) => {
    await simularApi(page);

    await page.goto('/panel');

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('login con una organización entra directo al panel', async ({ page }) => {
    await simularApi(page, { claims: { tenants: ['t-1'] } });

    await iniciarSesion(page);

    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
  });

  test('con varias organizaciones, hay que elegir antes de entrar', async ({ page }) => {
    await simularApi(page, {
      claims: { tenants: ['t-1', 't-2'], tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Centro Sur' } },
    });

    await iniciarSesion(page);

    // La elección es una pantalla propia porque **cambia qué datos se ven**:
    // mezclarla con las credenciales invita a pasarla por alto.
    await expect(page).toHaveURL(/\/auth\/organizacion$/);
    await expect(page.getByRole('button', { name: 'Clínica Norte' })).toBeVisible();

    await page.getByRole('button', { name: 'Centro Sur' }).click();
    await expect(page).toHaveURL(/\/panel$/);
  });

  /**
   * **El journey que más fácil se rompe.** Un cambio en el orden de los
   * `provideAppInitializer` lo rompería sin que ninguna prueba unitaria se
   * entere: `restoreSession` corre ANTES de que el router evalúe el guard, y si
   * dejara de hacerlo, quien tiene sesión válida vería un parpadeo al login.
   */
  test('la sesión sobrevive a una recarga', async ({ page }) => {
    const api = await simularApi(page);

    await iniciarSesion(page);
    await expect(page).toHaveURL(/\/panel$/);

    await page.reload();

    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
    // La recuperación canjea el refresh token guardado: si no lo hiciera,
    // habría acabado en el login.
    expect(api.refrescos()).toBeGreaterThan(0);
  });

  test('con el refresh token muerto, la recarga lleva al login sin mostrar un error', async ({
    page,
  }) => {
    await simularApi(page, { refrescoValido: false });

    await iniciarSesion(page);
    await expect(page).toHaveURL(/\/panel$/);

    await page.reload();

    // Un refresh token vencido no es un error que mostrar: es simplemente no
    // haber iniciado sesión.
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('cerrar sesión vuelve al login y no deja entrar atrás', async ({ page }) => {
    await simularApi(page);

    await iniciarSesion(page);
    await expect(page).toHaveURL(/\/panel$/);

    // El cierre de sesión vive dentro del menú de cuenta del encabezado, no
    // suelto en la barra: es una acción destructiva y no debe estar a un clic
    // de distancia de nada.
    await page.getByRole('button', { name: /cuenta de/i }).click();
    await page.getByRole('menuitem', { name: /cerrar sesión/i }).click();

    await expect(page).toHaveURL(/\/auth$/);

    await page.goto('/panel');
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('credenciales inválidas muestran un mensaje accionable, no un error genérico', async ({
    page,
  }) => {
    await simularApi(page, { loginValido: false });

    await iniciarSesion(page);

    // En cualquier otra pantalla `UNAUTHENTICATED` significa sesión vencida.
    // Acá significa que las credenciales recién escritas no sirven.
    await expect(page.getByRole('alert')).toContainText(/credenciales no son válidas/i);
    await expect(page).toHaveURL(/\/auth$/);
  });
});
