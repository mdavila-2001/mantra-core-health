import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * **Separación de funciones, barandillas, aprobaciones de cuatro ojos y desafíos de acceso** contra el backend simulado
 * (bloque B6d del gobierno de accesos). Un solo escenario, con tres personas, cada una en su propio contexto (su propio
 * `sessionStorage`, o sea su propia memoria del simulador). Se levanta con `ng serve --configuration development,demo` (o un
 * build de demo servido) y se apunta con `E2E_BASE_URL`.
 *
 * 1. **Marcos** (call center) cancela una cita de Suárez que empieza en menos horas de las que fija su permiso: la API contesta
 *    «falta la aprobación del doctor» y se abre el diálogo de desafío. Marcos ya tiene una solicitud igual esperando a Suárez (la de la
 *    demostración): la API no deja duplicarla y lo dice. Cerrar el diálogo no cambia nada.
 * 2. El **administrador** crea una barandilla con el segundo paso (código de prueba), revoca la excepción de Ricardo, ve el conflicto
 *    reaparecer y pide otra excepción, que queda pendiente de un segundo administrador.
 * 3. **Suárez** ve en «Mi equipo → Aprobaciones» lo que Marcos pidió, con qué pasa si aprueba, lo aprueba y, tras recargar,
 *    ya no está pendiente.
 */

async function entrar(browser: Browser, correo: string, ahora?: Date): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();
  if (ahora !== undefined) await page.clock.setFixedTime(ahora);
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(correo);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** Va a una pantalla por el router, sin recargar: el simulador conserva su memoria. */
async function irA(page: Page, ruta: string, esperaTestId: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page.getByTestId(esperaTestId)).toBeVisible({ timeout: 30_000 });
}

/** Las peticiones que atendió el simulador. */
async function peticiones(
  page: Page,
): Promise<{ method: string; url: string; status: number; body: unknown }[]> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? [],
  );
}
const hubo = async (
  page: Page,
  method: string,
  fragmento: string,
  status: number,
): Promise<boolean> =>
  (await peticiones(page)).some(
    (p) => p.method === method && p.url.includes(fragmento) && p.status === status,
  );

const ZONA = 'America/La_Paz';
function hoyEnLaPaz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
}
/** Las 11:10 de hoy en La Paz: las citas de la tarde empiezan dentro de las próximas 24 horas, sea cual sea la hora de quien corre la prueba. */
function alasOnce(): Date {
  return new Date(`${hoyEnLaPaz()}T11:10:00-04:00`);
}

/** Resuelve el segundo paso con el código de prueba del simulador. */
async function pasoExtra(page: Page): Promise<void> {
  await expect(page.getByTestId('desafio')).toHaveAttribute('data-kind', 'STEP_UP');
  await page.getByTestId('desafio-codigo').fill('123456');
  await page.getByTestId('desafio-verificar').click();
  await expect(page.getByTestId('desafio')).toHaveCount(0);
}

test.describe('Gobierno de accesos: aprobaciones, barandillas y separación de funciones', () => {
  test('desafío de la agenda, barandilla y excepción del administrador, y aprobación del doctor', async ({
    browser,
  }) => {
    /* ---- 1. Marcos: cancelar con poca antelación pide la aprobación del doctor ---------------------------------------- */
    const marcos = await entrar(browser, 'marcos.ribera@alovida.mock', alasOnce());
    await irA(marcos, `/combined-agenda?vista=dia&fecha=${hoyEnLaPaz()}`, 'agenda-titulo');
    const libre = marcos
      .locator(
        '[data-testid^="item-"][data-estado="FREE"][aria-label*="Suárez"]:not(.celda--atenuada)',
      )
      .first();
    await expect(libre).toBeVisible({ timeout: 30_000 });
    const id = (await libre.getAttribute('data-event-id'))!;
    await libre.click();
    await marcos.getByTestId('agenda-crear-cita').click();
    await marcos.getByTestId('buscador-texto').locator('input').fill('5000000');
    await marcos.getByTestId('buscador-buscar').click();
    await marcos.locator('[data-testid^="elegir-"]').first().click();
    await marcos.getByTestId('agenda-confirmar-cita').click();
    await expect(marcos.getByTestId(`item-${id}`)).toHaveAttribute('data-estado', 'CONFIRMED', {
      timeout: 30_000,
    });

    await marcos.getByTestId(`item-${id}`).click();
    await marcos.getByTestId('agenda-accion-cancel').click();
    await marcos
      .getByTestId('dialogo-motivo')
      .locator('textarea')
      .fill('La mamá avisó que no puede venir.');
    await marcos.getByTestId('dialogo-confirmar').click();

    // UI → petición → respuesta: la API pide la aprobación del doctor y se abre el diálogo de desafío.
    await expect(marcos.getByTestId('desafio')).toHaveAttribute('data-kind', 'APPROVAL', {
      timeout: 30_000,
    });
    expect(await hubo(marcos, 'POST', '/cancel', 403)).toBe(true);
    await marcos
      .getByTestId('desafio-motivo')
      .locator('textarea')
      .fill('Cancelo porque la mamá avisó que no viene.');
    await marcos.getByTestId('desafio-pedir').click();
    // Marcos ya tiene una solicitud igual esperando al doctor (la de la demostración): la API no deja duplicarla y lo dice en palabras.
    await expect(marcos.getByTestId('desafio')).toContainText(
      'Ya hay una solicitud igual esperando decisión.',
    );
    expect(await hubo(marcos, 'POST', '/me/support-approvals', 409)).toBe(true);

    // Cerrar el diálogo no cambia nada: la cita sigue confirmada y se dice.
    await marcos.getByTestId('desafio-cancelar').click();
    await expect(marcos.getByTestId('agenda-anuncio')).toContainText('No se hizo ningún cambio');
    await expect(marcos.getByTestId(`item-${id}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    expect(await hubo(marcos, 'POST', '/cancel', 200)).toBe(false);

    /* ---- 2. El administrador: barandilla con segundo paso, y la excepción de Ricardo ----------------------------------- */
    const admin = await entrar(browser, 'hospital.piloto@alovida.mock');
    await irA(admin, '/administration/access-governance/rules', 'pantalla-rules');
    await expect(admin.getByTestId('rules-barandillas')).toContainText(
      'solo se puede usar desde la red del hospital',
    );
    await admin.getByTestId('rules-nueva').click();
    await admin.getByTestId('regla-permiso').locator('.select-trigger').click();
    await admin.getByRole('option', { name: 'Cobrar la atención' }).click();
    await admin.getByTestId('regla-rol').locator('.select-trigger').click();
    await admin.getByRole('option', { name: 'Recepción' }).click();
    await expect(admin.getByTestId('regla-oracion')).toHaveText(
      'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
    );
    await admin.getByTestId('regla-ver-impacto').click();
    await expect(admin.getByTestId('regla-impacto')).toBeVisible();
    await admin.getByTestId('regla-guardar').click();
    await pasoExtra(admin);
    await expect(admin.getByTestId('rules-barandillas')).toContainText(
      'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
    );
    expect(await hubo(admin, 'POST', '/org/governance/rules', 403)).toBe(true);
    expect(await hubo(admin, 'POST', '/org/governance/rules', 201)).toBe(true);

    await irA(admin, '/administration/access-governance/sod', 'pantalla-sod');
    await admin.getByRole('tab', { name: /Excepciones/ }).click();
    await expect(admin.locator('[data-testid^="sod-excepcion-estado-"]').first()).toContainText(
      'Vigente hasta el 31/12/2026',
    );
    await admin.locator('[data-testid^="sod-revocar-"]').first().click();
    await admin
      .getByTestId('dialogo-motivo')
      .locator('textarea')
      .fill('Ya no hay otra persona de caja que cubrir.');
    await admin.getByTestId('dialogo-confirmar').click();
    await expect(admin.locator('[data-testid^="sod-excepcion-estado-"]').first()).toContainText(
      'Revocada',
    );
    await admin.getByRole('tab', { name: /Conflictos/ }).click();
    await expect(admin.locator('[data-testid^="sod-conflicto-SOD-GOV-03"]')).toContainText(
      'Conflicto sin resolver',
    );
    await admin.getByTestId('sod-pedir-SOD-GOV-03').click();
    await admin
      .getByTestId('sod-pedido-justificacion')
      .locator('textarea')
      .fill('Cubre la caja los sábados porque no hay otra persona disponible en el piso 1.');
    await admin.getByTestId('sod-pedido-enviar').click();
    await expect(admin.getByTestId('sod-pedido-hecho')).toContainText(
      'queda pendiente de un segundo administrador',
    );
    expect(await hubo(admin, 'POST', '/org/governance/sod-exceptions', 202)).toBe(true);

    await irA(admin, '/administration/access-governance/approvals', 'pantalla-approvals');
    await admin.getByRole('tab', { name: /Mis solicitudes/ }).click();
    await expect(admin.locator('[data-testid^="solicitud-estado-"]').first()).toContainText(
      'Pendiente',
    );

    /* ---- 3. Suárez: lo que Marcos pidió, qué pasa si aprueba, y aprobar --------------------------------------------------------- */
    const suarez = await entrar(browser, 'martin.suarez@alovida.mock');
    await irA(suarez, '/my-team/approvals', 'pantalla-approvals');
    const tarjeta = suarez.getByTestId(/^aprobacion-[0-9a-f-]{36}$/).first();
    await expect(tarjeta).toContainText('Marcos Ribera pide cancelar la cita de Mateo Rivera');
    await expect(tarjeta).toContainText('Por qué lo pide');
    await expect(tarjeta).toContainText('Qué pasa si la aprueba');
    await suarez.locator('[data-testid^="aprobacion-aprobar-"]').first().click();
    await expect(suarez.getByTestId('approvals-anuncio')).toContainText('Aprobada.');
    expect(await hubo(suarez, 'POST', '/decision', 200)).toBe(true);

    // Persistencia: tras recargar, ya no espera su decisión.
    await suarez.reload();
    await expect(suarez.getByTestId('pantalla-approvals')).toBeVisible({ timeout: 30_000 });
    await expect(suarez.locator('[data-testid^="aprobacion-aprobar-"]')).toHaveCount(0);
  });
});
