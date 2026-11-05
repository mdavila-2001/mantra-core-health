import { expect, test, type Page } from '@playwright/test';

/**
 * «Invitar a una secretaria» desde «Mi equipo», contra el **backend simulado**.
 *
 * Recorre `UI → request → response → persistencia → recarga → UI`, como el Dr. Andrés Pérez
 * (`perez@alovida.mock`, cualquier contraseña):
 *
 * 1. Web (1440): entra a `/my-team`, abre «Invitar a una secretaria», escribe el documento de Lucía Paz (`7005002`),
 *    envía, y ve el vínculo **pendiente** en «Invitaciones enviadas». La petición que viajó es
 *    `POST /me/practitioner/support-invitations` con solo `nationalId` y `practitionerRoleAssignmentId`, y respondió 201.
 *    Tras recargar, la invitación sigue ahí.
 * 2. Rechazos que se explican junto al campo: un documento que no es de nadie y la misma secretaria otra vez.
 * 3. Celular (390): una columna, objetivos táctiles de 44 px, sin scroll horizontal, y el mismo recorrido con Marcos
 *    Ribera (`7005003`).
 *
 * Las pruebas son **seriales** y comparten la pestaña: el simulador guarda su estado en `sessionStorage` y lo que una
 * deja lo ve la siguiente. Se levanta con `yarn start:demo` y se apunta con `E2E_BASE_URL`.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await contexto.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

/** Entra con una cuenta de la maqueta. Deja intacto `sessionStorage`, donde el simulador guarda lo que se fue haciendo. */
async function entrar(clave: string): Promise<void> {
  await page.goto('/auth');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(`${clave}@alovida.mock`);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

/** Va a una pantalla por el router, sin recargar: el simulador conserva su memoria. */
async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}$`));
}

/** Las peticiones que atendió el simulador, tal como las deja `window.__mockRequests`. */
async function peticiones(): Promise<{ method: string; url: string; status: number; body: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? []);
}

const esInvitacion = (p: { method: string; url: string }): boolean => p.method === 'POST' && p.url.includes('/me/practitioner/support-invitations');

/** Abre el formulario y, si el doctor tiene más de una vinculación, elige la primera. */
async function abrirFormulario(): Promise<void> {
  await page.getByTestId('invitar-abrir').click();
  await expect(page.getByTestId('invitar-form')).toBeVisible();
  const vinculacion = page.getByTestId('invitar-vinculacion');
  await expect(vinculacion).toBeVisible();
  if ((await vinculacion.textContent())?.includes('Elija la vinculación')) {
    await vinculacion.locator('button.select-trigger').click();
    await page.getByRole('option').first().click();
  }
}

async function escribirDocumento(documento: string): Promise<void> {
  await page.getByTestId('invitar-documento').fill(documento);
}

test('1 · web: Pérez invita a Lucía desde «Mi equipo», ve el vínculo pendiente y sigue ahí tras recargar', async () => {
  await entrar('perez');
  await irA('/my-team');

  // Centrado y a lo ancho del área de contenido (regla 6): holgura izquierda y derecha iguales (±2 px) y ≥ 85 % del área.
  const caja = await page.getByTestId('invitar-secretaria').boundingBox();
  const area = await page.locator('.app-main__inner').first().boundingBox();
  expect(caja).not.toBeNull();
  expect(area).not.toBeNull();
  const izquierda = caja!.x - area!.x;
  const derecha = area!.x + area!.width - (caja!.x + caja!.width);
  expect(Math.abs(izquierda - derecha)).toBeLessThanOrEqual(2);
  expect(caja!.width / area!.width).toBeGreaterThanOrEqual(0.85);

  await abrirFormulario();

  // Un documento inválido se marca junto al campo y no viaja nada.
  await escribirDocumento('12 3');
  await page.getByTestId('invitar-enviar').click();
  await expect(page.locator('.form-field-error').first()).toContainText('solo admite letras, dígitos, punto y guion');
  expect((await peticiones()).filter(esInvitacion)).toHaveLength(0);

  // En web los dos campos van uno al lado del otro.
  const campoDocumento = await page.getByTestId('invitar-documento').boundingBox();
  const campoVinculacion = await page.getByTestId('invitar-vinculacion').boundingBox();
  expect(Math.abs(campoDocumento!.y - campoVinculacion!.y)).toBeLessThan(20);
  expect(campoVinculacion!.x).toBeGreaterThan(campoDocumento!.x + campoDocumento!.width - 1);

  await escribirDocumento('7005002');
  await page.getByTestId('invitar-enviar').click();

  // UI → request → response: lo que viajó es lo que se pidió, y la API contestó 201.
  await expect.poll(async () => (await peticiones()).some((p) => esInvitacion(p) && p.status === 201)).toBe(true);
  const envio = (await peticiones()).find(esInvitacion)!;
  const cuerpo = envio.body as Record<string, unknown>;
  expect(Object.keys(cuerpo).sort()).toEqual(['nationalId', 'practitionerRoleAssignmentId']);
  expect(cuerpo['nationalId']).toBe('7005002');

  // Respuesta → UI: éxito que dice que queda pendiente, y «Mi equipo» muestra el vínculo pendiente.
  await expect(page.getByTestId('invitar-exito')).toContainText('pendiente');
  const enviada = page.locator('[data-testid^="invitacion-enviada-"]', { hasText: 'Lucía Paz' });
  await expect(enviada).toBeVisible();
  await expect(enviada).toContainText('Espera su respuesta');
  // Esperar a la secretaria no ofrece aceptar ni retirar: no lo decide el doctor.
  await expect(enviada.getByRole('button')).toHaveCount(0);

  // Persistencia → recarga → UI.
  await page.reload();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/my-team$/);
  const despues = page.locator('[data-testid^="invitacion-enviada-"]', { hasText: 'Lucía Paz' });
  await expect(despues).toBeVisible();
  await expect(despues).toContainText('Espera su respuesta');
});

test('2 · los rechazos de la API se explican junto al documento: sin secretaria registrada y vínculo repetido', async () => {
  await irA('/my-team');
  await abrirFormulario();

  await escribirDocumento('9999999');
  await page.getByTestId('invitar-enviar').click();
  await expect(page.locator('.form-field-error').first()).toContainText('No hay una secretaria registrada con ese documento');
  await expect(page.getByTestId('invitar-exito')).toHaveCount(0);
  await expect.poll(async () => (await peticiones()).some((p) => esInvitacion(p) && p.status === 404)).toBe(true);

  // Lucía ya fue invitada en la prueba anterior: la misma vinculación otra vez es un conflicto, no un segundo vínculo.
  await escribirDocumento('7005002');
  await page.getByTestId('invitar-enviar').click();
  await expect(page.locator('.form-field-error').first()).toContainText('Ya hay un vínculo con esta secretaria');
  await expect.poll(async () => (await peticiones()).some((p) => esInvitacion(p) && p.status === 409)).toBe(true);

  await page.getByTestId('invitar-cancelar').click();
  await expect(page.getByTestId('invitar-form')).toHaveCount(0);
  // Los dos rechazos no dejaron nada: sigue habiendo una sola invitación enviada.
  await expect(page.locator('[data-testid^="invitacion-enviada-"]')).toHaveCount(1);
});

test('3 · celular (390): una columna, objetivos de 44 px, sin scroll horizontal, y el mismo recorrido con Marcos', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await irA('/my-team');

  const abrir = page.getByTestId('invitar-abrir');
  await expect(abrir).toBeVisible();
  expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await abrirFormulario();

  // Una sola columna: el selector queda debajo del documento y ocupa el mismo ancho.
  const documento = (await page.getByTestId('invitar-documento').boundingBox())!;
  const vinculacion = (await page.getByTestId('invitar-vinculacion').boundingBox())!;
  // `invitar-documento` es el <input> y `invitar-vinculacion` el anfitrión de `app-select`, que suma el borde
  // exterior del campo: el ancho se compara contra el control interno del selector, que es el homólogo del <input>.
  const controlVinculacion = (await page.getByTestId('invitar-vinculacion').locator('button').first().boundingBox())!;
  expect(vinculacion.y).toBeGreaterThan(documento.y + documento.height - 1);
  expect(Math.abs(controlVinculacion.x - documento.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(controlVinculacion.width - documento.width)).toBeLessThanOrEqual(2);

  // Etiquetas visibles, teclado y autocompletado.
  await expect(page.getByText('Documento de identidad de la secretaria')).toBeVisible();
  await expect(page.getByText('Vinculación donde la va a necesitar')).toBeVisible();
  await expect(page.getByTestId('invitar-documento')).toHaveAttribute('inputmode', 'text');
  await expect(page.getByTestId('invitar-documento')).toHaveAttribute('autocomplete', 'off');

  // Objetivos táctiles de 44 px: los campos y los dos botones.
  for (const caja of [documento, vinculacion, (await page.getByTestId('invitar-enviar').boundingBox())!, (await page.getByTestId('invitar-cancelar').boundingBox())!]) {
    expect(caja.height).toBeGreaterThanOrEqual(44);
  }

  // Sin scroll horizontal.
  const ancho = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  expect(ancho.contenido).toBeLessThanOrEqual(ancho.ventana);

  await escribirDocumento('7005003');
  await page.getByTestId('invitar-enviar').click();
  await expect(page.getByTestId('invitar-exito')).toBeVisible();
  const marcos = page.locator('[data-testid^="invitacion-enviada-"]', { hasText: 'Marcos Ribera' });
  await expect(marcos).toBeVisible();
  await expect(marcos).toContainText('Espera su respuesta');

  const despuesDeEnviar = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  expect(despuesDeEnviar.contenido).toBeLessThanOrEqual(despuesDeEnviar.ventana);

  await page.reload();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="invitacion-enviada-"]', { hasText: 'Marcos Ribera' })).toBeVisible();
  await expect(page.locator('[data-testid^="invitacion-enviada-"]', { hasText: 'Lucía Paz' })).toBeVisible();
});
