import { expect, test } from '@playwright/test';

import { capturar } from '../recorrido/support/evidencia';
import { apiViva, crearPaciente, type Actor } from './support/actores';
import { entrar, estable, irA, recorrer, resumen, Vigilante } from './support/sesion';

/**
 * **Paciente** — se da de alta solo, entra con su documento y choca con la
 * puerta de la verificación de identidad.
 *
 * Es el recorrido que ninguna otra prueba hace, y el que más dice del producto:
 *
 * - **Entra con documento, no con correo.** La pantalla de ingreso lo resuelve
 *   por la ausencia de `@`. Con el simulador ese camino nunca se prueba, porque
 *   el simulador responde igual a los dos.
 * - **`403 IDENTITY_VERIFICATION_REQUIRED` es lo correcto.** Un paciente recién
 *   registrado *tiene* que recibirlo al pedir su resumen; lo que se juzga es que
 *   la pantalla lo convierta en una salida y no en un muro.
 * - **El menú se le achica.** Sin roles de administración no debería ver
 *   Pacientes, Usuarios ni Terminología, y las rutas escritas a mano tienen que
 *   responder algo legible en vez de romperse.
 *
 * Va en una sola prueba por el límite de diez ingresos por minuto del backend;
 * ver el encabezado de `01-administrador.spec.ts`.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Recorrido real · paciente', () => {
  let paciente: Actor;

  test.beforeAll(async () => {
    expect(
      await apiViva(),
      'La API no responde en /health. Levantá el backend antes de correr esta suite.',
    ).toBe(true);
    paciente = await crearPaciente();
  });

  test('se registra, entra con su documento y encuentra la puerta de verificación', async ({
    page,
  }) => {
    const vigilante = new Vigilante(page, 'paciente');

    /* -- Las dos pantallas públicas --------------------------------------- */

    vigilante.en('Crear cuenta');
    await page.goto('/auth/registro');
    await estable(page);
    await capturar(page, { carpeta: 'pac-01-registro', titulo: 'Crear cuenta' }, 'formulario');
    await expect(page.locator('h1').first()).not.toBeEmpty();

    vigilante.en('Ingreso');
    await page.goto('/auth');
    await estable(page);
    await capturar(page, { carpeta: 'pac-02-ingreso', titulo: 'Ingreso' }, 'vacio');

    /* -- Su sesión --------------------------------------------------------- */

    await entrar(page, paciente);
    await estable(page);
    await capturar(page, { carpeta: 'pac-03-panel', titulo: 'Panel del paciente' }, 'al-entrar');
    expect(page.url()).toContain('/panel');

    /* -- La puerta: 403 por identidad, con salida -------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/mi-cuenta',
      carpeta: 'pac-04-mi-perfil',
      titulo: 'Mi perfil',
    });

    // La salida hacia la verificación: un enlace o un botón. Se busca por lo que
    // dice y no por una clase, que es lo que se rompe primero en un rediseño.
    const salida = page
      .getByRole('link', { name: /verific/i })
      .or(page.getByRole('button', { name: /verific/i }));
    await expect(
      salida.first(),
      'Un 403 por identidad sin verificar tiene que ofrecer el trámite, no ser un muro.',
    ).toBeVisible({ timeout: 15_000 });

    await salida.first().click();
    await estable(page);
    await capturar(
      page,
      { carpeta: 'pac-05-verificar-identidad', titulo: 'Verificar identidad' },
      'desde-mi-perfil',
    );

    await recorrer(page, vigilante, {
      ruta: '/identidad/verificar',
      carpeta: 'pac-06-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- Lo que su rol no alcanza ------------------------------------------ */

    vigilante.en('Menú del paciente');
    await irA(page, '/panel');
    await estable(page);
    await capturar(
      page,
      { carpeta: 'pac-07-menu', titulo: 'Menú del paciente' },
      'navegacion-completa',
    );

    // Filtrar el menú es **cortesía, no seguridad**: quien escriba la ruta llega
    // igual, y de eso se ocupa el backend. Lo que se comprueba es la cortesía.
    for (const seccion of ['Pacientes', 'Usuarios', 'Terminología']) {
      await expect(
        page.getByRole('navigation').getByRole('link', { name: seccion, exact: true }),
      ).toHaveCount(0);
    }

    // Y escribiéndolas a mano: la pantalla tiene que ser legible —el estado S5 de
    // la sección— y no una en blanco ni una excepción. Los `403` de esas lecturas
    // están en la lista de esperados: lo que se juzga es que se sepan contar.
    for (const [ruta, carpeta, titulo] of [
      ['/administracion/pacientes', 'pac-08-padron-denegado', 'Pacientes · sin permiso'],
      ['/clinico', 'pac-09-clinico-denegado', 'Archivo clínico · sin permiso'],
    ] as const) {
      vigilante.en(titulo);
      await irA(page, ruta);
      await estable(page);
      await capturar(page, { carpeta, titulo }, 'al-entrar');
      await expect(page.locator('h1').first()).not.toBeEmpty({ timeout: 15_000 });
      await expect(page.locator('main')).not.toBeEmpty();
    }

    expect(vigilante.hallazgos, resumen(vigilante)).toEqual([]);
  });
});
