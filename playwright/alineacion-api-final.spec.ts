import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Lo que la **API final** cambió para el personal de apoyo y la sesión, recorrido contra el **backend simulado**
 * (que contesta con las formas y los códigos exactos de la API):
 *
 * 1. Registro en mostrador de un **menor**: queda con la identidad y el representante «pendientes de verificación»
 *    (la respuesta no trae `guardianLink`).
 * 2. Un mensaje **clínico** sale oculto en la bandeja de apoyo, y desde ahí se pide el acceso clínico temporal.
 * 3. La agenda de apoyo: **bloques sin `schedule.view`** (sin reserva ni servicio) y **lista vacía** (200, no 403).
 * 4. Un **QR multiuso de doctores** no afilia solo: queda pendiente y aparece en «Médicos del centro».
 * 5. Un **login con una organización que no deja entrar ahora** (`deniedTenants`): entra a la otra, con un aviso.
 * 6. El alta de un segundo factor pide **confirmar la contraseña**, y un factor se **quita** con «Quitar este método».
 * 7. «Fui yo» pide el **código de 8 dígitos** del correo.
 * 8. Un **horario de menos de 4 horas** no se guarda.
 * 9. Las **invitaciones de organizaciones**: aceptar una y rechazar otra.
 *
 * Son **seriales** y comparten pestaña: el simulador guarda su estado en `sessionStorage`, así que lo que una persona
 * deja lo ve la siguiente. Se levanta con `yarn start:demo` (modo desarrollo: usa `window.ng`) y se apunta con
 * `E2E_BASE_URL`.
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

async function irAlLogin(clave: string): Promise<void> {
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
}

async function entrar(clave: string): Promise<void> {
  await irAlLogin(clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 30_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(ruta.replace(/[/?]/g, '\\$&')));
}

interface Peticion {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly response?: unknown;
}

async function peticiones(): Promise<Peticion[]> {
  return page.evaluate(() => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? []);
}

const hubo = async (metodo: string, fragmento: string, estado = 200): Promise<boolean> =>
  (await peticiones()).some((p) => p.method === metodo && p.url.includes(fragmento) && p.status === estado);

async function elegir(selector: Locator, opcion: string | RegExp): Promise<void> {
  await selector.getByRole('combobox').click();
  await page.getByRole('option', typeof opcion === 'string' ? { name: opcion, exact: true } : { name: opcion }).click();
}

const confirmar = (nombre: string | RegExp = 'Confirmar'): Promise<void> => page.getByRole('dialog').getByRole('button', { name: nombre }).click();
const tocar = (id: string): Promise<void> => page.getByTestId(id).locator('label').first().click();
const pestana = (nombre: string): Promise<void> => page.getByRole('tab', { name: nombre }).click();
/** El campo de un `app-input`: el `data-testid` va al host o al `<input>` según el componente. */
const campo = (id: string): Locator => page.getByTestId(id).locator('input, textarea').or(page.locator(`input[data-testid="${id}"]`)).first();

const ZONA = 'America/La_Paz';

/** `YYYY-MM-DD` del lunes de la semana que viene: todo en ella es futuro, sea cual sea la hora de la corrida. */
function lunesQueViene(): string {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: ZONA }).split('-').map(Number);
  const dia = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return new Date(Date.UTC(y!, m! - 1, d! - ((dia + 6) % 7) + 7)).toISOString().slice(0, 10);
}

/** El día de la semana de hoy en La Paz, como lo numera el editor de horarios (0 = domingo). */
function hoyComoDiaDeSemana(): number {
  const corto = new Date().toLocaleDateString('en-US', { timeZone: ZONA, weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(corto);
}

/** Cambia los permisos de Mariela Soliz en el hospital, desde la pantalla de «Mi equipo de apoyo» de la organización. */
async function dejarAMarielaCon(acciones: readonly string[]): Promise<void> {
  await entrar('hospital_piloto');
  await irA('/administration/support-team');
  await expect(page.locator('app-support-team')).toBeVisible();
  const resultado = await page.evaluate(async (nuevas) => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element) => { client: Record<string, (...a: unknown[]) => { subscribe: (o: { next: (v: unknown) => void; error: (e: unknown) => void }) => void }> } } }).ng;
    const client = ng.getComponent(document.querySelector('app-support-team')!).client;
    const llamar = <T>(obs: { subscribe: (o: { next: (v: unknown) => void; error: (e: unknown) => void }) => void }): Promise<T> =>
      new Promise<T>((resolver, rechazar) => obs.subscribe({ next: (v) => resolver(v as T), error: rechazar }));
    const vinculos = await llamar<{ items: { id: string; personName: string }[] }>(client['listEngagements']!());
    const mariela = vinculos.items.find((v) => v.personName === 'Mariela Soliz')!;
    const permisos = await llamar<{ id: string; status: string }[]>(client['listGrants']!(mariela.id));
    for (const permiso of permisos.filter((p) => p.status === 'ACTIVE')) {
      await llamar(client['changeGrant']!(mariela.id, { grantId: permiso.id, actions: nuevas }));
    }
    return permisos.length;
  }, acciones);
  expect(resultado).toBeGreaterThan(0);
}

/* ------------------------------------------------------------------------------------------------ 1 */

test('1 · Ana registra a un menor en el mostrador: la identidad y el representante quedan pendientes de verificación', async () => {
  await entrar('ana');
  await irA(`/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
  await expect(page.getByTestId('agenda-grilla')).toBeVisible({ timeout: 30_000 });

  await page.locator('[data-testid^="item-"][data-estado="FREE"][aria-label*="Pérez"]:not(.celda--atenuada)').first().click();
  await page.getByTestId('agenda-crear-cita').click();
  await page.getByTestId('buscador-texto').locator('input').fill('8888888');
  await page.getByTestId('buscador-buscar').click();
  await page.getByTestId('registrar-paciente-nuevo').click();
  await expect(page.getByTestId('registro-paciente')).toBeVisible();

  const anioDeNacimiento = new Date().getFullYear() - 8;
  await page.getByTestId('registro-nombre').locator('input').fill('Mateo');
  await page.getByTestId('registro-apellido').locator('input').fill('Quispe Rojas');
  await page.getByTestId('registro-nacimiento').locator('input').fill(`${anioDeNacimiento}-03-10`);
  await page.getByTestId('registro-telefono').locator('input').fill('71234567');
  // Es menor: pide a su representante, y lo dice como «contacto pendiente de verificación».
  await expect(page.getByTestId('registro-representante')).toContainText('contacto pendiente de verificación');
  await page.getByTestId('registro-rep-nombre').locator('input').fill('Rosa Rojas');
  await page.getByTestId('registro-rep-documento').locator('input').fill('4567890');
  await page.getByTestId('registro-rep-telefono').locator('input').fill('71234500');
  await page.getByTestId('registro-rep-parentesco').locator('input').fill('Madre');
  await page.getByTestId('registro-guardar').click();

  await expect.poll(() => hubo('POST', '/me/support-patients', 201)).toBe(true);
  const alta = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/me/support-patients'))!;
  expect(alta.response).toMatchObject({ outcome: 'CREATED', identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' } });
  expect(alta.response as object).not.toHaveProperty('guardianLink');

  // En el panel se ve lo que la API dijo: nada se da por verificado.
  await expect(page.getByTestId('agenda-paciente-encontrado')).toContainText('Mateo');
  await expect(page.getByTestId('agenda-identidad-pendiente')).toHaveText('Identidad pendiente de verificación');
  await expect(page.getByTestId('agenda-representante-pendiente')).toContainText('contacto pendiente de verificación');
});

/* ------------------------------------------------------------------------------------------------ 2 */

test('2 · el mensaje clínico sale oculto en la bandeja y desde ahí se pide el acceso clínico temporal', async () => {
  const MARCADOR = 'Contenido clínico oculto';
  await entrar('ana');
  await irA('/support-inbox');
  await expect(page.getByTestId('bandeja')).toBeVisible();

  const clinica = page.locator('[data-testid^="conv-"]', { hasText: MARCADOR }).first();
  await expect(clinica).toBeVisible();
  await expect(clinica).not.toContainText('dolor fuerte');
  await clinica.getByTestId(/^abrir-/).click();

  const oculto = page.locator('[data-testid^="oculto-"]').first();
  await expect(oculto).toContainText('Contenido clínico oculto');
  await expect(page.locator('body')).not.toContainText('dolor fuerte en el pecho');
  // Se puede responder (la API siempre lo permite) pero lo clínico no se lee: lo que sigue es pedir el acceso.
  await page.locator('[data-testid^="oculto-pedir-"]').first().click();
  await campo('acceso-motivo').fill('Necesito leer el mensaje para derivarlo bien al doctor.');
  await page.getByTestId('acceso-enviar').click();
  await expect.poll(() => hubo('POST', '/me/support-access-requests', 201)).toBe(true);
  await expect(page.locator('[data-testid^="oculto-pendiente-"]').first()).toContainText('todavía no lo decidió');
  await expect(page.locator('body')).not.toContainText('dolor fuerte en el pecho');
});

/* ------------------------------------------------------------------------------------------------ 3 */

test('3 · la agenda de apoyo: con «Registrar la llegada» sin «Ver agenda» salen bloques, y sin permisos de agenda llega vacía', async () => {
  await dejarAMarielaCon(['schedule.check_in']);
  await entrar('mariela');
  await irA(`/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
  await expect(page.getByTestId('agenda-titulo')).toBeVisible({ timeout: 30_000 });
  // Bloques: ocupado, sin paciente, sin servicio y con una clave local (no una reserva).
  const bloques = page.locator('[data-testid^="item-bloque:"]');
  await expect(bloques.first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="item-"][aria-label*="Ana Lucía"]')).toHaveCount(0);
  const agenda = (await peticiones()).filter((p) => p.method === 'GET' && /\/me\/support-agenda\?/.test(p.url)).at(-1)!;
  const respuesta = agenda.response as { items: Record<string, unknown>[] };
  // La respuesta de la API es solo de citas (los cupos libres del simulador vienen en otra ruta).
  const ocupados = respuesta.items;
  expect(ocupados.length).toBeGreaterThan(0);
  for (const bloque of ocupados) {
    expect(bloque).not.toHaveProperty('bookingId');
    expect(bloque).not.toHaveProperty('healthcareServiceId');
  }

  // Sin ninguna acción de agenda: la lista llega vacía (200) y la pantalla lo explica, no es un error.
  await dejarAMarielaCon(['patient.register']);
  await entrar('mariela');
  await irA(`/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
  await expect(page.getByTestId('agenda-sin-horarios')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('agenda-sin-permiso-de-agenda')).toContainText('no incluye permisos de agenda');
  const vacia = (await peticiones()).filter((p) => p.method === 'GET' && /\/me\/support-agenda\?/.test(p.url)).at(-1)!;
  expect(vacia.status).toBe(200);
  expect((vacia.response as { items: unknown[] }).items).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------ 4 */

test('4 · un QR multiuso de doctores no afilia solo: queda pendiente y aparece en «Médicos del centro»', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-invitations');
  await page.getByTestId('segmentado-PRACTITIONER').click();
  await page.getByTestId('segmentado-MULTI').click();
  await campo('invitacion-usos').fill('5');
  await page.getByTestId('invitacion-emitir').click();
  const codigo = (await page.getByTestId('invitacion-codigo').innerText()).trim();
  expect(codigo.length).toBeGreaterThanOrEqual(8);

  // El doctor lo canjea: «pendiente de aprobación», nunca «afiliado».
  await entrar('suarez');
  await page.goto(`/my-support#code=${codigo}`);
  await page.getByTestId('canje-enviar').click();
  await expect(page.getByTestId('canje-resultado')).toContainText('quedó pendiente de aprobación de la organización');
  await expect(page.getByTestId('canje-resultado')).not.toContainText('Quedó afiliado');
  const canje = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/affiliation-invitations/redeem'))!;
  expect(canje.response).toMatchObject({ kind: 'PRACTITIONER', pendingApproval: true });
  expect((canje.response as { roleAssignmentId?: string }).roleAssignmentId).toBeTruthy();
  expect(canje.response as object).not.toHaveProperty('membershipId');

  // La organización lo ve en «Médicos del centro», pedido por el médico, sin sede ni servicio.
  await entrar('hospital_piloto');
  await irA('/administration/my-organization/affiliations');
  // La solicitud quedó en la práctica de la organización (Centro Médico Norte), no en la primera de la lista.
  await page.getByRole('combobox', { name: 'Práctica' }).click();
  await page.getByRole('option', { name: /Centro Médico Norte/ }).click();
  const fila = page.locator('[data-testid^="affiliation-initiator-"]', { hasText: 'Pedido por el médico' }).first();
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toContainText('Sin sede asignada');
  await expect(page.locator('body')).toContainText('sin servicio asignado');
  await expect(page.locator('[data-testid^="affiliation-approve-"]').first()).toHaveAttribute('aria-label', /para sin servicio asignado/);
});

/* ------------------------------------------------------------------------------------------------ 5 */

test('5 · una organización que no deja entrar ahora no impide entrar a la otra: aviso con el motivo y sin cerrar la sesión', async () => {
  // El hospital limita al personal a unos días y hoy no es uno de ellos (hora de La Paz, la de la página).
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  await tocar('horario-limitar');
  const hoy = page.getByTestId(`horario-dia-${hoyComoDiaDeSemana()}`);
  if ((await hoy.getAttribute('aria-pressed')) === 'true') await hoy.click();
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);

  // Elena trabaja en el hospital y en el consultorio: entra al consultorio, y el hospital se dice sin bloquearla.
  await entrar('elena');
  const aviso = page.getByTestId('aviso-organizaciones-negadas');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Hospital Piloto Mantra');
  await expect(aviso).toContainText('no le permite entrar ahora');
  await expect(aviso).toContainText('fuera del horario');
  const login = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/iam/auth/login') && p.status === 200).at(-1)!;
  const token = (login.response as { accessToken: string }).accessToken;
  const reclamos = await page.evaluate((t) => JSON.parse(atob(t.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>, token);
  expect(Object.values(reclamos['deniedTenants'] as Record<string, string>)).toEqual(['OUTSIDE_ALLOWED_HOURS']);

  // Entró, y usa la aplicación con la organización que sí la deja: sin cerrar la sesión ni pedir otro login.
  await irA('/my-support');
  await expect(page.getByTestId('canje-card')).toBeVisible();
  await expect(page.getByTestId('header-cuenta')).toBeVisible();

  // «Entendido» lo oculta, y la sesión sigue abierta.
  await page.getByTestId('aviso-negada-entendido').click();
  await expect(aviso).toHaveCount(0);

  // Se deja como estaba.
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  await tocar('horario-limitar');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);
  await expect(page.getByTestId('controles-guardar')).toBeDisabled();
});

/* ------------------------------------------------------------------------------------------------ 6 */

test('6 · el segundo factor se activa confirmando la contraseña y se quita con «Quitar este método»', async () => {
  await entrar('marcos');
  await irA('/my-account/security/mfa');
  await expect(page.getByTestId('mfa-inactiva')).toBeVisible();

  // Activar pide confirmar la contraseña; una incorrecta se dice y no avanza.
  await page.getByTestId('mfa-empezar').click();
  await expect(page.getByTestId('reauth-form')).toBeVisible();
  await campo('reauth-contrasena').fill('incorrecta');
  await page.getByTestId('reauth-enviar').click();
  await expect(page.getByTestId('reauth-error')).toBeVisible();
  await expect(page.getByTestId('mfa-secreto')).toHaveCount(0);
  await campo('reauth-contrasena').fill('cualquiera');
  await page.getByTestId('reauth-enviar').click();
  await expect(page.getByTestId('mfa-qr')).toBeVisible();
  const alta = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/iam/me/mfa/totp') && p.status === 201)!;
  expect(alta.body).toMatchObject({ currentPassword: 'cualquiera' });

  await campo('mfa-codigo').fill('123456');
  await page.getByTestId('mfa-confirmar').click();
  await expect(page.getByTestId('mfa-listo')).toBeVisible();
  await page.getByTestId('mfa-continuar').click();

  // Quitarlo también pide quién es: contraseña, y el método sale de la lista.
  await irA('/my-account/security/mfa');
  await expect(page.getByTestId('mfa-activada')).toBeVisible();
  await page.getByTestId('mfa-quitar').click();
  await expect(page.getByTestId('mfa-quitar-aviso')).toBeVisible();
  await campo('quitar-contrasena').fill('cualquiera');
  await page.getByTestId('quitar-enviar').click();
  await expect.poll(() => hubo('POST', '/revoke')).toBe(true);
  const quitado = (await peticiones()).find((p) => p.method === 'POST' && /\/iam\/me\/mfa\/.+\/revoke$/.test(p.url))!;
  expect(quitado.body).toMatchObject({ currentPassword: 'cualquiera' });
  await expect(page.getByTestId('mfa-inactiva')).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------ 7 */

test('7 · «Fui yo» pide el código de 8 dígitos que llega al correo, y uno equivocado se dice', async () => {
  await entrar('lucia');
  await expect(page.getByTestId('aviso-dispositivo')).toBeVisible();
  await page.getByTestId('aviso-dispositivo-fui-yo').click();
  // Desde el propio dispositivo no basta: la API pide el código (422), y el aviso lo pide.
  await expect(page.getByTestId('aviso-dispositivo-codigo-paso')).toBeVisible();
  expect((await peticiones()).some((p) => p.method === 'POST' && /\/iam\/me\/devices\/.+\/confirm$/.test(p.url) && p.status === 422)).toBe(true);
  await page.getByTestId('aviso-dispositivo-pedir-codigo').click();
  await expect(page.getByTestId('aviso-dispositivo-enviado')).toContainText('@alovida.mock');
  await campo('aviso-dispositivo-codigo').fill('00000000');
  await page.getByTestId('aviso-dispositivo-confirmar-codigo').click();
  await expect(page.getByTestId('aviso-dispositivo-fallo')).toBeVisible();
  await campo('aviso-dispositivo-codigo').fill('12345678');
  await page.getByTestId('aviso-dispositivo-confirmar-codigo').click();
  await expect(page.getByTestId('aviso-dispositivo')).toHaveCount(0);
  const confirmado = (await peticiones()).filter((p) => p.method === 'POST' && /\/iam\/me\/devices\/.+\/confirm$/.test(p.url)).at(-1)!;
  expect(confirmado.body).toMatchObject({ code: '12345678' });
  expect(confirmado.response).toMatchObject({ confirmed: true });

  // Quien no tiene un correo verificado no puede pedir el código y lo lee claro.
  await entrar('marcos');
  await page.getByTestId('aviso-dispositivo-fui-yo').click();
  await page.getByTestId('aviso-dispositivo-pedir-codigo').click();
  await expect(page.getByTestId('aviso-dispositivo-fallo')).toContainText('correo verificado');
});

/* ------------------------------------------------------------------------------------------------ 8 */

test('8 · un horario de menos de 4 horas no se guarda: se dice por qué y no sale la petición', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  await tocar('horario-limitar');
  await elegir(page.getByTestId('horario-desde'), '08:00');
  await elegir(page.getByTestId('horario-hasta'), '10:00');
  await expect(page.getByTestId('horario-problema')).toContainText('4 horas');
  await expect(page.getByTestId('controles-guardar')).toBeDisabled();
  const antes = (await peticiones()).filter((p) => p.method === 'PUT' && p.url.includes('/org/session-policies')).length;
  await page.getByTestId('controles-guardar').click({ force: true }).catch(() => undefined);
  expect((await peticiones()).filter((p) => p.method === 'PUT' && p.url.includes('/org/session-policies')).length).toBe(antes);
  // Con cuatro horas o más, sí se puede.
  await elegir(page.getByTestId('horario-hasta'), '12:00');
  await expect(page.getByTestId('horario-problema')).toHaveCount(0);
  await expect(page.getByTestId('controles-guardar')).toBeEnabled();
});

/* ------------------------------------------------------------------------------------------------ 9 */

test('9 · las invitaciones de organizaciones: Marcos acepta una y rechaza otra', async () => {
  await entrar('marcos');
  await irA('/my-account/security/organization-invitations');
  const filas = page.locator('[data-testid="invitaciones-lista"] > li');
  await expect(filas).toHaveCount(2);
  const aceptada = (await filas.first().getByTestId('invitacion-organizacion').innerText()).trim();
  const rechazada = (await filas.nth(1).getByTestId('invitacion-organizacion').innerText()).trim();

  await filas.first().getByTestId('invitacion-aceptar').click();
  await expect(page.getByTestId('invitaciones-resultado')).toContainText(`Aceptó la invitación de ${aceptada}`);
  await expect(filas).toHaveCount(1);
  expect(await hubo('POST', '/accept')).toBe(true);

  await filas.first().getByTestId('invitacion-rechazar').click();
  await confirmar(/Rechazar/);
  await expect(page.getByTestId('invitaciones-resultado')).toContainText(`Rechazó la invitación de ${rechazada}`);
  await expect(page.getByTestId('invitaciones-vacio')).toBeVisible();
  expect(await hubo('POST', '/decline')).toBe(true);
});
