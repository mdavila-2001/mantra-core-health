import { test } from '@playwright/test';

import { CLAIMS_ADMIN, iniciarSesion, simularApiTotal } from './support/api-total';
import { capturar } from './support/evidencia';
import { EVITAR_POR_DEFECTO, esperarEstable, recorrer } from './support/explorador';

/**
 * El área con sesión: el armazón y las pantallas que cuelgan de él.
 *
 * Todas comparten la misma preparación —entrar— así que el `beforeEach` la hace
 * una vez. La sesión lleva rol `SECURITY_ADMIN` para que el menú aparezca
 * entero: con el rol de paciente, la mitad de las secciones no se dibujan y el
 * recorrido no las vería.
 */

test.describe('Recorrido · área con sesión', () => {
  test.beforeEach(async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);
  });

  test('panel', async ({ page }) => {
    await recorrer(
      page,
      { ruta: '/panel', carpeta: '12-panel', titulo: 'Panel' },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  test('mi perfil', async ({ page }) => {
    await recorrer(
      page,
      { ruta: '/mi-cuenta', carpeta: '13-mi-perfil', titulo: 'Mi perfil' },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  test('verificar identidad', async ({ page }) => {
    await recorrer(
      page,
      {
        ruta: '/identidad/verificar',
        carpeta: '14-verificar-identidad',
        titulo: 'Verificar identidad',
      },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  /**
   * Las secciones que el registro declara como `planificada`.
   *
   * Todas pintan el mismo placeholder, pero **no se ven iguales**: el rótulo, el
   * resumen y la ruta de navegación salen de la sección. Capturarlas una por una
   * es lo que permite revisar que cada una diga lo suyo.
   */
  for (const [ruta, nombre] of [
    ['/administracion/organizaciones', 'organizaciones'],
    // Salieron de esta lista tres secciones, y las tres por el mismo motivo:
    // dejaron de ser un cartel cuando su lectura existió.
    //
    // - **Terminología**, cuando el cliente empezó a usar la mitad de
    //   `GET /terminology/concepts` que le faltaba.
    // - **Agenda**, con `GET /scheduling/resources`, `/slots` y `/bookings`.
    // - **Archivo clínico**, con `GET /clinical/patients/:id/summary` y
    //   `GET /charts/patients/:id/chart`.
    //
    // Sus recorridos viven con el resto de administración y atención.
    ['/facturacion', 'facturacion'],
  ] as const) {
    test(`sección planificada · ${nombre}`, async ({ page }) => {
      await recorrer(
        page,
        { ruta, carpeta: `15-planificada-${nombre}`, titulo: `Sección · ${nombre}` },
        // Alcanza para el placeholder **y** para los enlaces del menú lateral,
        // que están en todas estas pantallas. Recorrerlos otra vez acá es
        // redundante —el Panel ya los recorre enteros— pero un tope que corta
        // deja una nota que se lee como «falta cobertura», y esa lectura es
        // peor que las capturas de más.
        { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
      );
    });
  }
});

/**
 * Los estados del armazón que no se alcanzan navegando: hay que abrir algo.
 *
 * El explorador los alcanzaría de a uno —abre el menú, captura, sigue— pero no
 * capturaría la secuencia: abrir el menú **y después** elegir. Estas pruebas la
 * arman a mano porque es un camino, no un control suelto.
 */
test.describe('Recorrido · armazón', () => {
  test('menú de cuenta y cierre de sesión', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '16-menu-cuenta', titulo: 'Menú de cuenta' };

    await esperarEstable(page);
    await capturar(page, pantalla, 'panel con el menú cerrado');

    await page.getByRole('button', { name: /cuenta de/i }).click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'menú de cuenta abierto');

    await page.getByRole('menuitem', { name: /cerrar sesión/i }).click();
    await page.waitForURL(/\/auth$/, { timeout: 15_000 });
    await esperarEstable(page);
    await capturar(page, pantalla, 'después de cerrar sesión');
  });

  test('selector de organización', async ({ page }) => {
    await simularApiTotal(page, { claims: CLAIMS_ADMIN });
    await page.goto('/auth');
    await page.getByLabel(/correo o documento/i).fill('ana@mantra.test');
    await page.locator('input[type="password"]').fill('secreto-de-prueba');
    await page.getByRole('button', { name: /^entrar$/i }).click();

    const pantalla = { carpeta: '17-organizaciones', titulo: 'Cambio de organización' };

    // Con dos organizaciones el login desemboca en la pantalla de elección.
    await page.waitForURL(/\/auth\/organizacion$/, { timeout: 15_000 });
    await esperarEstable(page);
    await capturar(page, pantalla, 'elección de organización');

    await page.getByRole('button', { name: 'Clínica Norte' }).click();
    await page.waitForURL(/\/panel$/, { timeout: 15_000 });
    await esperarEstable(page);
    await capturar(page, pantalla, 'panel con Clínica Norte activa');

    await page
      .getByRole('button', { name: /clínica norte/i })
      .first()
      .click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'selector de organización desplegado');
  });

  test('menú lateral en móvil', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '18-nav-movil', titulo: 'Navegación en móvil' };

    // El nav pasa a cajón por debajo del punto de corte: en escritorio es una
    // columna fija y el botón de menú ni siquiera se dibuja.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/panel');
    await esperarEstable(page);
    await capturar(page, pantalla, 'panel en móvil con el cajón cerrado');

    await page
      .getByRole('button', { name: /menú|navegación/i })
      .first()
      .click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'cajón de navegación abierto');
  });

  test('el guard manda al login sin sesión', async ({ page }) => {
    await simularApiTotal(page);

    const pantalla = { carpeta: '19-guard', titulo: 'Guard de sesión' };

    await page.goto('/panel');
    await page.waitForURL(/\/auth$/, { timeout: 15_000 });
    await esperarEstable(page);
    await capturar(page, pantalla, 'sin sesión, /panel redirige al login');
  });

  test('identidad sin verificar bloquea el perfil', async ({ page }) => {
    await simularApiTotal(page, {
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      identidadSinVerificar: true,
    });
    await iniciarSesion(page);

    const pantalla = { carpeta: '20-identidad-requerida', titulo: 'Identidad sin verificar' };

    await page.goto('/mi-cuenta');
    await esperarEstable(page);
    await capturar(page, pantalla, 'mi perfil con identidad sin verificar');
  });

  test('el panel con el directorio caído', async ({ page }) => {
    await simularApiTotal(page, {
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      directorioRoto: true,
    });
    await iniciarSesion(page);

    const pantalla = { carpeta: '21-panel-error', titulo: 'Panel · directorio caído' };

    await page.goto('/panel');
    await esperarEstable(page);
    await capturar(page, pantalla, 'panel con el directorio en error');
  });
});
