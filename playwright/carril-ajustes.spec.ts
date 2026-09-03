import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista, entrar, irA } from './support/sesion';

/**
 * Ajustes — la vista que junta lo que estaba repartido.
 *
 * ## Qué comprueba, y por qué contra el producto de verdad
 *
 * Las pruebas unitarias ya fijan la lógica de la pantalla. Lo que no pueden ver
 * es lo que esta suite mira: que **el encabezado real** ofrece el ícono y ya no
 * el conmutador de tema, que **el menú real** dejó de ofrecer las preferencias
 * de aviso, que la dirección vieja **redirige** en el router de producción, y
 * que cambiar el tema estampa el atributo que la hoja de estilos lee. Todo eso
 * vive en el ensamblado, no en un componente aislado.
 *
 * ## Credenciales
 *
 * Del entorno, como el resto de la suite: el contrato de semillas exige
 * autenticación real y prohíbe fabricar tokens. Sin ellas la prueba se salta
 * diciendo qué falta, en vez de fallar por algo que no es del producto.
 */
const IDENTIFICADOR = process.env['E2E_ADMIN_EMAIL'];
const CLAVE = process.env['E2E_ADMIN_PASSWORD'];

test.describe('Ajustes', () => {
  test.skip(
    !IDENTIFICADOR || !CLAVE,
    'Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD: la suite no fabrica sesiones.',
  );

  // En serie y con una sola sesión: `POST /iam/auth/login` admite diez por
  // minuto y por IP, y entrar una vez por prueba gastaría el cupo.
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await entrar(page, {
      rol: 'administrador',
      identificador: IDENTIFICADOR as string,
      clave: CLAVE as string,
      nombre: 'admin',
    });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('el encabezado ofrece Ajustes, y el tema dejó de estar suelto ahí', async () => {
    const ajustes = page.getByTestId('header-ajustes');

    await expect(ajustes).toBeVisible();
    await expect(ajustes).toHaveAttribute('aria-label', 'Ajustes');
    // El conmutador se mudó adentro: suelto en el encabezado parecía la única
    // preferencia que el producto tiene.
    await expect(page.locator('[app-theme-toggle]')).toHaveCount(0);
    // La campana se queda: es lo único del encabezado que trae información
    // nueva, y no es una preferencia.
    await expect(page.getByTestId('campana')).toBeVisible();
  });

  test('el menú lateral ya no ofrece las preferencias de aviso, ni Ajustes', async () => {
    const menu = page.locator('[data-testid="nav-enlace"]');

    await expect(menu.filter({ hasText: 'Preferencias de avisos' })).toHaveCount(0);
    // Ajustes tampoco ocupa renglón: se entra por el ícono.
    await expect(page.locator('[data-testid="nav-enlace"][data-route="/ajustes"]')).toHaveCount(0);
    // Pero la bandeja sigue en su lugar: no se movió nada de lo que se lee.
    await expect(
      page.locator('[data-testid="nav-enlace"][data-route="/notification-center"]'),
    ).toHaveCount(1);
  });

  test('el ícono lleva a Ajustes, con sus tres secciones', async () => {
    await page.getByTestId('header-ajustes').click();
    await page.waitForURL(/\/ajustes/, { timeout: 30_000 });
    await esperarAplicacionLista(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Avisos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Apariencia' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Permisos' })).toBeVisible();
  });

  test('el panel de avisos carga las preferencias de verdad, contra la API', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    // Las cuatro categorías en lenguaje llano, que es lo que la pantalla
    // promete: si la llamada fallara, acá diría «No pudimos cargar…».
    await expect(page.getByTestId('pref-CLINICAL')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pref-SCHEDULING')).toBeVisible();
    await expect(page.getByTestId('pref-MESSAGES')).toBeVisible();
    await expect(page.getByTestId('pref-SOCIAL')).toBeVisible();
    await expect(page.getByTestId('pref-guardar')).toBeVisible();
  });

  test('elegir un tema estampa el atributo que lee la hoja de estilos', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();

    await page.getByTestId('tema-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('tema-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('los permisos del navegador se muestran con su estado real', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    // Los tres, cada uno con una lectura del navegador. No se afirma cuál:
    // depende del perfil de Chromium con que corra la suite.
    await expect(page.getByTestId('permiso-avisos')).toBeVisible();
    await expect(page.getByTestId('permiso-ubicacion')).toBeVisible();
    await expect(page.getByTestId('permiso-camara')).toBeVisible();

    // Y la explicación de por qué no hay lista de quién ve tus datos.
    await expect(page.getByTestId('ajustes-accesos-nota')).toBeVisible();
  });

  test('a quien administra la seguridad le ofrece dónde administrar los permisos', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    await expect(page.getByTestId('ajustes-roles')).toBeVisible();
    // Acotado al contenido: el menú lateral también ofrece «Acceso delegado» a
    // este rol, y sin acotar el localizador encuentra los dos.
    await expect(
      page.locator('main a[href="/administration/delegated-access"]'),
    ).toBeVisible();
  });

  test('la dirección vieja de las preferencias sigue llevando a algún lado', async () => {
    // Estuvo en el menú, así que está en los favoritos de alguien: redirige en
    // vez de devolver un 404.
    await irA(page, '/my-account/notification-preferences');
    await page.waitForURL(/\/ajustes/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TAREA-17 · S1/S2/S3 — los interruptores, y que guardar sea honesto.
  // ---------------------------------------------------------------------

  test('alternar un aviso y recargar lo muestra cambiado — es de la cuenta, no de la sesión', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    const social = page.getByTestId('pref-SOCIAL').locator('input[role="switch"]');
    await expect(social).toBeVisible({ timeout: 30_000 });
    const antes = await social.isChecked();

    await social.click();
    await expect(social).toBeChecked({ checked: !antes });
    await page.getByTestId('pref-guardar').click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });

    // `page.reload()` canjea el refresh token — el mismo cupo de 10/min que el
    // login (ver `sesion.ts`) — así que se recarga una sola vez acá.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('pref-SOCIAL').locator('input[role="switch"]')).toBeChecked({
      checked: !antes,
      timeout: 30_000,
    });

    // Se deja como estaba: esta prueba no puede alterar el estado para las que
    // corren después de ella (mode: 'serial', misma sesión).
    await page.getByTestId('pref-SOCIAL').locator('input[role="switch"]').click();
    await page.getByTestId('pref-guardar').click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
  });

  test('un switch se alterna con Espacio desde el teclado, con foco visible', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    const mensajes = page.getByTestId('pref-MESSAGES').locator('input[role="switch"]');
    await expect(mensajes).toBeVisible({ timeout: 30_000 });
    const antes = await mensajes.isChecked();

    await mensajes.focus();
    await expect(mensajes).toBeFocused();
    await page.keyboard.press('Space');
    await expect(mensajes).toBeChecked({ checked: !antes });

    // Vuelve a como estaba, sin persistir: alcanza con probar el gesto de
    // teclado, no hace falta un guardado más.
    await page.keyboard.press('Space');
    await expect(mensajes).toBeChecked({ checked: antes });
  });

  test('si el PUT de guardar falla, el switch vuelve atrás y la pantalla lo dice', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    const clinical = page.getByTestId('pref-CLINICAL').locator('input[role="switch"]');
    await expect(clinical).toBeVisible({ timeout: 30_000 });
    const antes = await clinical.isChecked();

    await page.route('**/notifications/preferences/me', (ruta) => {
      if (ruta.request().method() === 'PUT') {
        return ruta.fulfill({ status: 500, body: '{}' });
      }
      return ruta.continue();
    });

    await clinical.click();
    await expect(clinical).toBeChecked({ checked: !antes });
    await page.getByTestId('pref-guardar').click();

    await expect(page.getByText('No pudimos guardar tus preferencias.')).toBeVisible({
      timeout: 30_000,
    });
    // Nada quedó guardado (el PUT es todo-o-nada): vuelve a lo último
    // confirmado, no se queda «encendido de mentira» (AC-17-7).
    await expect(clinical).toBeChecked({ checked: antes });

    await page.unroute('**/notifications/preferences/me');
  });

  test('doble clic rápido en «Guardar» produce un solo PUT', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    const scheduling = page.getByTestId('pref-SCHEDULING').locator('input[role="switch"]');
    await expect(scheduling).toBeVisible({ timeout: 30_000 });
    await scheduling.click();

    let puts = 0;
    page.on('request', (pedido) => {
      if (pedido.url().includes('/notifications/preferences/me') && pedido.method() === 'PUT') {
        puts += 1;
      }
    });

    const guardar = page.getByTestId('pref-guardar');
    await guardar.click();
    // El segundo clic, mientras el primer `PUT` sigue en vuelo: `app-button`
    // con `isLoading` lo intercepta (AC-17-8), así que no debería sumar otro.
    await guardar.click({ force: true });

    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
    expect(puts).toBe(1);

    // Se deja como estaba.
    await scheduling.click();
    await guardar.click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
  });

  test('«el de mi dispositivo» recarga sin parpadeo, en claro y en oscuro', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();
    await page.getByTestId('tema-system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

    // `page.reload()` de nuevo: la tercera y última de esta suite (ver la nota
    // de cupo de arriba).
    await page.reload();
    await esperarAplicacionLista(page);
    // El anti-parpadeo es exactamente esto: bajo «el de mi dispositivo»
    // `data-theme` no se escribe nunca, ni antes ni después de hidratar — lo
    // resuelve `@media (prefers-color-scheme)` en la hoja de estilos.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();
    await page.getByTestId('tema-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('un permiso denegado no ofrece un switch que prometa revertirlo', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    const filaPermisos = page.locator('[data-testid^="permiso-"]');
    const total = await filaPermisos.count();
    for (let i = 0; i < total; i += 1) {
      const pastilla = filaPermisos.nth(i);
      const testid = await pastilla.getAttribute('data-testid');
      const clave = testid?.replace('permiso-', '') ?? '';
      if ((await pastilla.textContent())?.trim() === 'Bloqueado') {
        // Ningún renglón de Permisos ofrece `app-switch`: el control aquí es
        // «Permitir», y sólo cuando el navegador todavía puede preguntar.
        await expect(page.getByTestId(`pedir-${clave}`)).toHaveCount(0);
      }
    }
    await expect(page.locator('[role="switch"]')).toHaveCount(0);
  });
});
