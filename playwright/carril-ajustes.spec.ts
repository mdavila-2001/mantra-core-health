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
const IDENTIFIER = process.env['E2E_ADMIN_EMAIL'];
const PASSWORD = process.env['E2E_ADMIN_PASSWORD'];

test.describe('Ajustes', () => {
  test.skip(
    !IDENTIFIER || !PASSWORD,
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
      identificador: IDENTIFIER as string,
      clave: PASSWORD as string,
      nombre: 'admin',
    });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('el encabezado ofrece Ajustes, y el tema dejó de estar suelto ahí', async () => {
    const settingsLink = page.getByTestId('header-ajustes');

    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveAttribute('aria-label', 'Ajustes');
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
    await expect(page.locator('[data-testid="nav-enlace"][data-route="/settings"]')).toHaveCount(0);
    // Pero la bandeja sigue en su lugar: no se movió nada de lo que se lee.
    await expect(
      page.locator('[data-testid="nav-enlace"][data-route="/notification-center"]'),
    ).toHaveCount(1);
  });

  test('el ícono lleva a Ajustes, con sus tres secciones', async () => {
    await page.getByTestId('header-ajustes').click();
    await page.waitForURL(/\/settings/, { timeout: 30_000 });
    await esperarAplicacionLista(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Avisos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Apariencia' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Permisos' })).toBeVisible();
  });

  test('el panel de avisos carga las preferencias de verdad, contra la API', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);

    // Las cuatro categorías en lenguaje llano, que es lo que la pantalla
    // promete: si la llamada fallara, acá diría «No pudimos cargar…».
    await expect(page.getByTestId('pref-CLINICAL')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pref-SCHEDULING')).toBeVisible();
    await expect(page.getByTestId('pref-MESSAGES')).toBeVisible();
    await expect(page.getByTestId('pref-SOCIAL')).toBeVisible();
    await expect(page.getByTestId('pref-save')).toBeVisible();
  });

  test('elegir un tema estampa el atributo que lee la hoja de estilos', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();

    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('los permisos del navegador se muestran con su estado real', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    // Los tres, cada uno con una lectura del navegador. No se afirma cuál:
    // depende del perfil de Chromium con que corra la suite.
    await expect(page.getByTestId('permission-avisos')).toBeVisible();
    await expect(page.getByTestId('permission-ubicacion')).toBeVisible();
    await expect(page.getByTestId('permission-camara')).toBeVisible();

    // Y la explicación de por qué no hay lista de quién ve tus datos.
    await expect(page.getByTestId('settings-access-note')).toBeVisible();
  });

  test('a quien administra la seguridad le ofrece dónde administrar los permisos', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    await expect(page.getByTestId('settings-roles')).toBeVisible();
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
    await page.waitForURL(/\/settings/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  });

  test('la dirección en castellano sigue llevando a Ajustes (TAREA-29)', async () => {
    // `/ajustes` fue la puerta desde el 28/08 y está en historiales: el
    // renombre a `/settings` deja el redirect, como exige AC-29-3.
    await irA(page, '/ajustes');
    await page.waitForURL(/\/settings/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TAREA-17 · S1/S2/S3 — los interruptores, y que guardar sea honesto.
  // ---------------------------------------------------------------------

  test('alternar un aviso y recargar lo muestra cambiado — es de la cuenta, no de la sesión', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);

    const social = page.getByTestId('pref-SOCIAL').locator('input[role="switch"]');
    await expect(social).toBeVisible({ timeout: 30_000 });
    const before = await social.isChecked();

    await social.click();
    await expect(social).toBeChecked({ checked: !before });
    await page.getByTestId('pref-save').click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });

    // `page.reload()` canjea el refresh token — el mismo cupo de 10/min que el
    // login (ver `sesion.ts`) — así que se recarga una sola vez acá.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('pref-SOCIAL').locator('input[role="switch"]')).toBeChecked({
      checked: !before,
      timeout: 30_000,
    });

    // Se deja como estaba: esta prueba no puede alterar el estado para las que
    // corren después de ella (mode: 'serial', misma sesión).
    await page.getByTestId('pref-SOCIAL').locator('input[role="switch"]').click();
    await page.getByTestId('pref-save').click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
  });

  test('un switch se alterna con Espacio desde el teclado, con foco visible', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);

    const messages = page.getByTestId('pref-MESSAGES').locator('input[role="switch"]');
    await expect(messages).toBeVisible({ timeout: 30_000 });
    const before = await messages.isChecked();

    await messages.focus();
    await expect(messages).toBeFocused();
    await page.keyboard.press('Space');
    await expect(messages).toBeChecked({ checked: !before });

    // Vuelve a como estaba, sin persistir: alcanza con probar el gesto de
    // teclado, no hace falta un guardado más.
    await page.keyboard.press('Space');
    await expect(messages).toBeChecked({ checked: before });
  });

  test('si el PUT de guardar falla, el switch vuelve atrás y la pantalla lo dice', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);

    const clinical = page.getByTestId('pref-CLINICAL').locator('input[role="switch"]');
    await expect(clinical).toBeVisible({ timeout: 30_000 });
    const before = await clinical.isChecked();

    await page.route('**/notifications/preferences/me', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 500, body: '{}' });
      }
      return route.continue();
    });

    await clinical.click();
    await expect(clinical).toBeChecked({ checked: !before });
    await page.getByTestId('pref-save').click();

    await expect(page.getByText('No pudimos guardar tus preferencias.')).toBeVisible({
      timeout: 30_000,
    });
    // Nada quedó guardado (el PUT es todo-o-nada): vuelve a lo último
    // confirmado, no se queda «encendido de mentira» (AC-17-7).
    await expect(clinical).toBeChecked({ checked: before });

    await page.unroute('**/notifications/preferences/me');
  });

  test('doble clic rápido en «Guardar» produce un solo PUT', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);

    const scheduling = page.getByTestId('pref-SCHEDULING').locator('input[role="switch"]');
    await expect(scheduling).toBeVisible({ timeout: 30_000 });
    await scheduling.click();

    let puts = 0;
    page.on('request', (request) => {
      if (request.url().includes('/notifications/preferences/me') && request.method() === 'PUT') {
        puts += 1;
      }
    });

    const saveButton = page.getByTestId('pref-save');
    await saveButton.click();
    // El segundo clic, mientras el primer `PUT` sigue en vuelo: `app-button`
    // con `isLoading` lo intercepta (AC-17-8), así que no debería sumar otro.
    await saveButton.click({ force: true });

    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
    expect(puts).toBe(1);

    // Se deja como estaba.
    await scheduling.click();
    await saveButton.click();
    await expect(page.getByText('Guardamos tus preferencias.')).toBeVisible({ timeout: 30_000 });
  });

  test('«el de mi dispositivo» recarga sin parpadeo, en claro y en oscuro', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();
    await page.getByTestId('theme-system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

    // `page.reload()` de nuevo: la tercera y última de esta suite (ver la nota
    // de cupo de arriba).
    await page.reload();
    await esperarAplicacionLista(page);
    // El anti-parpadeo es exactamente esto: bajo «el de mi dispositivo»
    // `data-theme` no se escribe nunca, ni antes ni después de hidratar — lo
    // resuelve `@media (prefers-color-scheme)` en la hoja de estilos.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();
    await page.getByTestId('theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('un permiso denegado no ofrece un switch que prometa revertirlo', async () => {
    await irA(page, '/settings');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    const permissionBadges = page.locator('[data-testid^="permission-"]');
    const total = await permissionBadges.count();
    for (let i = 0; i < total; i += 1) {
      const badge = permissionBadges.nth(i);
      const testid = await badge.getAttribute('data-testid');
      const key = testid?.replace('permission-', '') ?? '';
      if ((await badge.textContent())?.trim() === 'Bloqueado') {
        // Ningún renglón de Permisos ofrece `app-switch`: el control aquí es
        // «Permitir», y sólo cuando el navegador todavía puede preguntar.
        await expect(page.getByTestId(`request-${key}`)).toHaveCount(0);
      }
    }
    await expect(page.locator('[role="switch"]')).toHaveCount(0);
  });
});
