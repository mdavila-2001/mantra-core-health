import { expect, test, type Page } from '@playwright/test';

/**
 * Personal de apoyo (secretaria y otros roles) contra el **backend simulado**.
 *
 * ## Por qué contra el simulador
 *
 * La API de esta ronda se escribe en paralelo: las rutas ya están fijadas en
 * `CONTRATO.md`, pero la API todavía no las sirve. La maqueta las atiende con
 * estado que sobrevive a F5 (`Coleccion` sobre `sessionStorage`), y esta suite
 * la recorre **como cuatro personas distintas en la misma pestaña**: lo que una
 * deja guardado lo ve la siguiente. Por eso las pruebas son **seriales** y
 * comparten página; barajarlas rompe el recorrido.
 *
 * Se levanta con `yarn start:demo` (o `ng serve --configuration development,demo`)
 * y se apunta con `E2E_BASE_URL`.
 *
 * ## Qué recorre (en orden)
 *
 * 1. La organización aprueba **parcialmente** la solicitud de Ana: ajusta uno y
 *    rechaza otro con motivo.
 * 2. El doctor aprobado la **acepta** desde «Mi equipo» y lo guardado sobrevive a
 *    una recarga.
 * 3. Lucía **no puede crear una cita** (la acción no existe) pero **sí registrar
 *    una llegada**.
 * 4. Rosa **no ve el hospital**: ni en su lista de accesos, ni en el selector de
 *    la agenda, ni en el menú.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext();
  page = await contexto.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

/**
 * Entra con una cuenta de la maqueta. Borra antes el refresh token (que vive en
 * `localStorage`) y deja intacto `sessionStorage`, donde el simulador guarda lo
 * que cada persona fue dejando.
 */
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

test('1 · la organización aprueba parcialmente la solicitud de Ana: ajusta a Suárez y rechaza a Vaca', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-requests');

  const solicitud = page.locator('[data-testid^="solicitud-"]', { hasText: 'Ana Gutiérrez' }).first();
  await expect(solicitud).toBeVisible();
  await expect(solicitud).toContainText('Esperando decisión');

  const suarez = solicitud.locator('[data-testid^="item-"]', { hasText: 'Suárez' });
  const vaca = solicitud.locator('[data-testid^="item-"]', { hasText: 'Vaca' });

  // Sin decidir todo, no se guarda: la pantalla dice qué falta.
  await solicitud.locator('[data-testid^="guardar-decision-"]').click();
  await expect(solicitud.locator('[data-testid^="faltantes-"]')).toContainText('Falta decidir');

  // Suárez: aprobar con ajustes. Se le quita «Cancelar citas».
  await suarez.getByTestId('segmentado-ADJUSTED').click();
  await suarez.locator('app-checkbox[data-testid$="schedule.cancel"] label').click();
  await expect(suarez.locator('app-checkbox[data-testid$="schedule.cancel"] input')).not.toBeChecked();

  // Vaca: rechazar. Sin motivo no se puede.
  await vaca.getByTestId('segmentado-REJECTED').click();
  await solicitud.locator('[data-testid^="guardar-decision-"]').click();
  await expect(solicitud.locator('[data-testid^="faltantes-"]')).toContainText('Escriba el motivo del rechazo');
  await vaca.locator('[data-testid^="motivo-"] textarea').fill('Esa agenda la cubre otra persona.');

  await solicitud.locator('[data-testid^="guardar-decision-"]').click();

  // UI → request → response: lo que viajó es lo que se decidió.
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/decision') && p.status === 200)).toBe(true);
  const envio = (await peticiones()).find((p) => p.method === 'POST' && p.url.includes('/decision'))!;
  const items = (envio.body as { items: { decision: string; actions?: string[]; comment?: string }[] }).items;
  expect(items.map((i) => i.decision).sort()).toEqual(['ADJUSTED', 'REJECTED']);
  expect(items.find((i) => i.decision === 'ADJUSTED')!.actions).not.toContain('schedule.cancel');
  expect(items.find((i) => i.decision === 'REJECTED')!.comment).toBe('Esa agenda la cubre otra persona.');

  // Respuesta → persistencia → recarga → UI: ya no está pendiente y figura aprobada en parte.
  await page.reload();
  await expect(page.locator('[data-testid^="solicitud-"]', { hasText: 'Ana Gutiérrez' })).toHaveCount(0);
  await page.getByTestId('segmentado-RESOLVED').click();
  const resuelta = page.locator('[data-testid^="solicitud-"]', { hasText: 'Ana Gutiérrez' }).first();
  await expect(resuelta).toContainText('Aprobada en parte');
  await expect(resuelta).toContainText('Aprobado con ajustes');
  await expect(resuelta).toContainText('Rechazado');
});

test('2 · el doctor acepta a Ana desde «Mi equipo», y sigue aceptada tras recargar', async () => {
  await entrar('suarez');
  await irA('/my-team');

  const ana = page.locator('[data-testid^="miembro-"]', { hasText: 'Ana Gutiérrez' }).first();
  await expect(ana).toContainText('Espera su aceptación');

  await ana.locator('[data-testid^="aceptar-"]').filter({ hasText: 'Aceptar' }).click();
  await expect(ana).toContainText('Activa');

  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/accept') && p.status === 200)).toBe(true);

  await page.reload();
  const despues = page.locator('[data-testid^="miembro-"]', { hasText: 'Ana Gutiérrez' }).first();
  await expect(despues).toContainText('Activa');
  // Ahora el doctor decide si responde en su nombre.
  await expect(despues.locator('[data-testid^="responder-"] input')).not.toBeChecked();
  await despues.locator('[data-testid^="responder-"] label').click();
  await expect(despues.locator('[data-testid^="responder-"] input')).toBeChecked();
  await expect(despues.locator('[data-testid^="aviso-"] input')).toBeEnabled();
});

test('3 · Lucía no puede crear una cita (la acción no existe) pero sí registrar una llegada', async () => {
  await entrar('lucia');
  await irA('/combined-agenda');
  await expect(page.getByTestId('agenda-grilla')).toBeVisible();

  // Un horario libre donde SÍ tiene permiso de ver: abre el panel, sin «Crear cita».
  const libre = page.locator('[data-estado="FREE"]:not(.celda--atenuada)').first();
  await expect(libre).toBeVisible();
  await libre.click();
  await expect(page.getByTestId('agenda-panel')).toBeVisible();
  await expect(page.getByTestId('agenda-crear-cita')).toHaveCount(0);
  await expect(page.getByTestId('agenda-sin-crear')).toContainText('no incluye crear citas');
  await page.getByTestId('agenda-panel-cerrar').click();

  // Lo que está fuera de su piso no llega: la API solo devuelve las filas con alguna acción de agenda permitida.
  await expect(page.locator('.celda--atenuada')).toHaveCount(0);

  // Una cita confirmada en su piso: registra la llegada.
  const cita = page.locator('[data-estado="CONFIRMED"]:not(.celda--atenuada)').first();
  await expect(cita).toBeVisible();
  const identificador = await cita.getAttribute('data-testid');
  await cita.click();
  await page.getByTestId('agenda-registrar-llegada').click();

  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/check-in') && p.status === 200)).toBe(true);
  await expect(page.getByTestId(identificador!)).toHaveAttribute('data-estado', 'CHECKED_IN');

  // Persistencia: tras recargar sigue «Ya llegó».
  await page.reload();
  await expect(page.getByTestId(identificador!)).toHaveAttribute('data-estado', 'CHECKED_IN');
});

test('4 · Rosa no ve el hospital: ni sus accesos, ni el selector de la agenda, ni el menú de la organización', async () => {
  await entrar('rosa');

  await irA('/my-support');
  await expect(page.getByTestId('mis-vinculos')).toContainText('Consultorio Dra. Paola Céspedes');
  await expect(page.getByTestId('mis-vinculos')).not.toContainText('Hospital');

  await irA('/combined-agenda');
  await expect(page.getByTestId('agenda-organizacion')).toContainText('Consultorio Dra. Paola Céspedes');
  await expect(page.getByTestId('agenda-organizacion')).not.toContainText('Hospital');
  await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Paola Céspedes');
  await expect(page.locator('body')).not.toContainText('Hospital Piloto');

  // Y las pantallas de la organización no existen para ella: ni menú ni puerta.
  await expect(page.getByRole('link', { name: 'Equipo de apoyo' })).toHaveCount(0);
  await irA('/administration/support-team').catch(() => undefined);
  await expect(page.getByTestId('equipo-card')).toHaveCount(0);
});
