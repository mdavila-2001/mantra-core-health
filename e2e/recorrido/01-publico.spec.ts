import { test } from '@playwright/test';

import { simularApiTotal } from './support/api-total';
import { EVITAR_POR_DEFECTO, recorrer } from './support/explorador';

/**
 * Las pantallas a las que se llega **sin sesión**.
 *
 * Van primero porque son las que ve alguien que todavía no entró, y porque
 * ninguna necesita preparar estado: se entra por la URL y ya están.
 *
 * Cada prueba es una pantalla. Podrían ser una sola con un bucle, y sería peor:
 * cuando una falla, el reporte de Playwright nombra la que falló en vez de decir
 * «recorrido» y obligar a leer el registro para saber dónde se cortó.
 */

test.describe('Recorrido · pantallas públicas', () => {
  test('login', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/auth',
      carpeta: '01-login',
      titulo: 'Iniciar sesión',
    });
  });

  test('login con credenciales rechazadas', async ({ page }) => {
    await simularApiTotal(page, { loginValido: false });
    await recorrer(
      page,
      { ruta: '/auth', carpeta: '02-login-error', titulo: 'Login · credenciales inválidas' },
      {
        // El estado que interesa capturar es el de después del rechazo, así que
        // se llega a él antes de empezar a explorar.
        preparar: async (p) => {
          await p.getByLabel(/correo o documento/i).fill('ana@mantra.test');
          await p.locator('input[type="password"]').fill('clave-incorrecta');
          await p.getByRole('button', { name: /^entrar$/i }).click();
          await p.getByRole('alert').first().waitFor({ timeout: 10_000 });
        },
        maxAcciones: 12,
      },
    );
  });

  test('crear cuenta', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(
      page,
      { ruta: '/auth/registro', carpeta: '03-registro', titulo: 'Crear cuenta' },
      // Es el formulario más largo de la aplicación —tiene dos ramas, paciente y
      // profesional— y cada rama muestra sus propios campos.
      { maxAcciones: 60, evitar: EVITAR_POR_DEFECTO },
    );
  });

  test('recuperar contraseña', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/auth/recuperar',
      carpeta: '04-recuperar',
      titulo: 'Recuperar contraseña',
    });
  });

  test('nueva contraseña', async ({ page }) => {
    await simularApiTotal(page);
    // El enlace del correo trae el token por query string; sin él la pantalla
    // muestra el estado de enlace inválido, que también vale la pena capturar.
    await recorrer(page, {
      ruta: '/auth/nueva-clave?token=token-de-prueba',
      carpeta: '05-nueva-clave',
      titulo: 'Nueva contraseña',
    });
  });

  test('nueva contraseña sin token', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/auth/nueva-clave',
      carpeta: '06-nueva-clave-sin-token',
      titulo: 'Nueva contraseña · enlace inválido',
    });
  });

  test('verificar correo', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/auth/verificar?token=token-de-prueba',
      carpeta: '07-verificar-correo',
      titulo: 'Verificar correo',
    });
  });

  test('verificar correo sin token', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/auth/verificar',
      carpeta: '08-verificar-sin-token',
      titulo: 'Verificar correo · enlace inválido',
    });
  });

  test('elegir organización', async ({ page }) => {
    await simularApiTotal(page, {
      claims: {
        tenants: ['t-1', 't-2'],
        tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Centro Sur' },
      },
    });

    await recorrer(
      page,
      { ruta: '/auth', carpeta: '09-elegir-organizacion', titulo: 'Elegir organización' },
      {
        // A esta pantalla no se entra por la URL: la sesión tiene que existir y
        // tener más de una organización, o el guard manda al login.
        preparar: async (p) => {
          await p.getByLabel(/correo o documento/i).fill('ana@mantra.test');
          await p.locator('input[type="password"]').fill('secreto-de-prueba');
          await p.getByRole('button', { name: /^entrar$/i }).click();
          await p.waitForURL(/\/auth\/organizacion$/, { timeout: 15_000 });
        },
      },
    );
  });

  test('página no encontrada', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/esta-ruta-no-existe',
      carpeta: '10-no-encontrada',
      titulo: 'Página no encontrada',
    });
  });

  test('recuperación de error', async ({ page }) => {
    await simularApiTotal(page);
    await recorrer(page, {
      ruta: '/error',
      carpeta: '11-error',
      titulo: 'Recuperación de error',
    });
  });
});
