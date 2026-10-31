import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Administración y seguridad del personal de apoyo contra el **backend simulado**.
 *
 * Seis recorridos, todos `UI → petición → respuesta → persistencia → recarga → UI`:
 *
 * 1. La organización configura una política de sesión y, al recargar, sigue ahí; la
 *    política llega al token (inactividad) y las personas no la ven.
 * 2. La verificación en dos pasos obligatoria se aplica al entrar (el alta del factor, en `seguridad-de-la-cuenta.spec.ts`).
 * 3. Ana declara que sigue trabajando aquí; Silvia, suspendida, ve «pida a su organización que lo renueve».
 * 4. La organización quita permisos en lote y reactiva un vínculo suspendido.
 * 5. La bandeja de solicitudes filtra, pagina y muestra la vencida aparte.
 * 6. El aviso de dispositivo nuevo («Fui yo» / «No fui yo»).
 * 7. El código de invitación: viaja en el fragmento, no se transforma y un código que no
 *    sirve se dice igual de todas las formas.
 *
 * Son **seriales** y comparten pestaña: el simulador guarda su estado en
 * `sessionStorage`, así que lo que una persona deja lo ve la siguiente. Se levanta con
 * `yarn start:demo` y se apunta con `E2E_BASE_URL`.
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

async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(`${ruta.replace(/[/?]/g, '\\$&')}`));
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

/** Elige una opción de un `app-select`: es un botón que abre una lista modal. */
async function elegir(selector: Locator, opcion: string | RegExp): Promise<void> {
  await selector.getByRole('combobox').click();
  await page.getByRole('option', typeof opcion === 'string' ? { name: opcion, exact: true } : { name: opcion }).click();
}

/** Elige una opción de un filtro de la barra, que se nombra por su rótulo. */
async function filtrar(rotulo: string, opcion: string): Promise<void> {
  await page.getByRole('combobox', { name: rotulo, exact: true }).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}

/** Aprieta el botón de un diálogo de confirmación. */
async function confirmar(nombre: string | RegExp = 'Confirmar'): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: nombre }).click();
}

const interruptor = (id: string): Locator => page.getByTestId(id).getByRole('switch');
/** Alterna un interruptor: el `<input>` real es invisible, se toca su rótulo. */
const tocar = (id: string): Promise<void> => page.getByTestId(id).locator('label').first().click();

async function pestana(nombre: string): Promise<void> {
  await page.getByRole('tab', { name: nombre }).click();
}

/** Lee el claim que el login metió al token de la última sesión abierta. */
async function reclamoDelUltimoLogin(claim: string): Promise<unknown> {
  const login = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/iam/auth/login') && p.status === 200).at(-1);
  const token = (login?.response as { accessToken?: string } | undefined)?.accessToken;
  if (token === undefined) return undefined;
  return page.evaluate(
    ([t, c]) => {
      const carga = t!.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
      return (JSON.parse(atob(carga.padEnd(Math.ceil(carga.length / 4) * 4, '='))) as Record<string, unknown>)[c!];
    },
    [token, claim],
  );
}

test('1 · la organización configura una política de sesión y se refleja al recargar, en el token y no en las personas', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await expect(page.getByTestId('controles-card')).toBeVisible();

  // Guardar arranca apagado; cada control trae su explicación en lenguaje simple.
  await expect(page.getByTestId('controles-guardar')).toBeDisabled();
  await expect(page.getByTestId('control-dos-pasos')).toContainText('Aunque alguien robe la contraseña');
  await expect(page.getByTestId('efecto-idle')).toContainText('15 minutos');

  // La regla del personal: 5 minutos de inactividad y solo desde la red de la organización. (Rige la más
  // estricta de las que alcanzan a la persona: con 15 en «todas las cuentas», subir el del personal no cambiaría nada.)
  await pestana('Personal de la organización');
  await expect(page.getByTestId('efecto-idle')).toContainText('10 minutos');
  await elegir(page.getByTestId('control-idle'), '5 minutos');
  await expect(page.getByTestId('efecto-idle')).toContainText('5 minutos');
  await tocar('control-network');
  await expect(page.getByTestId('efecto-network')).toContainText('Solo se entra desde la red de la organización');
  await expect(page.getByTestId('vista-reglas')).toContainText('5 minutos'); // la más estricta de las dos reglas
  await expect(page.getByTestId('controles-guardar')).toBeEnabled();

  // Guardar pide confirmación; cancelar no guarda nada.
  await page.getByTestId('controles-guardar').click();
  await expect(page.getByRole('dialog')).toContainText('Rigen desde el próximo inicio de sesión');
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir editando' }).click();
  expect(await hubo('PUT', '/org/session-policies')).toBe(false);

  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);
  const envio = (await peticiones()).find((p) => p.method === 'PUT' && p.url.includes('/org/session-policies'))!;
  const personal = (envio.body as { policies: { scope: string; idleTimeoutMinutes: number; enforceIpRules: boolean }[] }).policies.find((p) => p.scope === 'ORG_STAFF')!;
  expect(personal).toMatchObject({ idleTimeoutMinutes: 5, enforceIpRules: true });

  // Recarga: lo que se ve es lo que quedó guardado.
  await page.reload();
  await expect(page.getByTestId('controles-card')).toBeVisible();
  await pestana('Personal de la organización');
  await expect(page.getByTestId('efecto-idle')).toContainText('5 minutos');
  await expect(interruptor('control-network')).toBeChecked();
  await expect(page.getByTestId('controles-guardar')).toBeDisabled();

  // Y llega al token de quien trabaja en la organización: su sesión ahora se cierra a los 5 minutos.
  await entrar('ana');
  expect(await reclamoDelUltimoLogin('idleTimeoutMinutes')).toBe(5);

  // Ninguna persona, ni siquiera la secretaria de la organización, abre esta pantalla.
  await page.goto('/administration/session-controls');
  await expect(page.getByTestId('header-cuenta')).toBeVisible();
  await expect(page.getByTestId('controles-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Controles de sesión' })).toHaveCount(0);
});

test('1b · el horario laboral se arma en la semana y se guarda; después se vuelve a como estaba', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');

  await tocar('horario-limitar');
  await expect(page.getByTestId('horario-semana')).toBeVisible();
  await expect(page.getByTestId('horario-resumen')).toContainText('Lunes a viernes, de 08:00 a 18:00');
  // Se habilita el sábado tocando su renglón; el domingo sigue sin acceso.
  await page.getByTestId('horario-dia-6').click();
  await expect(page.getByTestId('horario-dia-6')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('horario-resumen')).toContainText('Lunes a sábado');
  await expect(page.getByTestId('horario-dia-0')).toHaveAttribute('aria-pressed', 'false');
  await elegir(page.getByTestId('horario-hasta'), '19:00');

  // La vista previa prueba un ingreso: el domingo a las 21:00 está fuera del horario.
  await elegir(page.getByTestId('controles-prueba-dia'), 'Domingo');
  await expect(page.getByTestId('vista-prueba')).toContainText('No puede entrar');
  await elegir(page.getByTestId('controles-prueba-dia'), 'Lunes');
  await elegir(page.getByTestId('controles-prueba-hora'), '10:00');
  await expect(page.getByTestId('vista-prueba')).toContainText('Puede entrar');

  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);
  const envio = (await peticiones()).filter((p) => p.method === 'PUT' && p.url.includes('/org/session-policies')).at(-1)!;
  const horas = (envio.body as { policies: { scope: string; allowedHours?: { days: number[]; from: string; to: string } }[] }).policies.find((p) => p.scope === 'ORG_STAFF')!.allowedHours;
  expect(horas).toMatchObject({ days: [1, 2, 3, 4, 5, 6], from: '08:00', to: '19:00' });

  await page.reload();
  await pestana('Personal de la organización');
  await expect(page.getByTestId('horario-resumen')).toContainText('Lunes a sábado, de 08:00 a 19:00');

  // Se vuelve a como estaba (también prueba que quitar el horario y la red se guarda).
  await tocar('horario-limitar');
  await tocar('control-network');
  await elegir(page.getByTestId('control-idle'), '10 minutos');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await page.reload();
  await pestana('Personal de la organización');
  await expect(page.getByTestId('efecto-idle')).toContainText('10 minutos');
  await expect(page.getByTestId('control-horario')).toContainText('Sin restricción');
  await expect(interruptor('control-network')).not.toBeChecked();
});

test('2 · la verificación en dos pasos obligatoria se aplica al entrar: pide el código, o deja entrar y lleva a darla de alta', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  await tocar('control-mfa');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);

  // Ana ya tiene los dos pasos: la pantalla le pide el código y con el bueno entra.
  await page.goto('/auth');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('ana@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('Ingrese el código de verificación');
  await page.getByTestId('login-mfa-code').fill('000000');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('no es válido');
  await page.getByTestId('login-mfa-code').fill('123456');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });

  // Marcos no la tiene activada: la API lo deja ENTRAR (`mfaEnrollmentRequired`) y el cliente lo lleva a darla de alta.
  await page.goto('/auth');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('marcos@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/my-account\/security\/mfa/, { timeout: 30_000 });
  await expect(page.getByTestId('mfa-obligatorio')).toContainText('no puede usar el resto de la aplicación');
  const loginDeMarcos = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/iam/auth/login') && p.status === 200).at(-1)!;
  expect((loginDeMarcos.response as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired).toBe(true);

  // Se vuelve a como estaba.
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  await tocar('control-mfa');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await page.reload();
  await pestana('Personal de la organización');
  await expect(interruptor('control-mfa')).not.toBeChecked();
});

test('3 · Ana declara que sigue trabajando aquí: queda registrado, pero la que renueva el vínculo es la organización', async () => {
  await entrar('ana');
  await irA('/my-support');
  const aviso = page.locator('[data-testid^="recertificacion-aviso-"]').first();
  await expect(aviso).toContainText('Confirme que sigue trabajando aquí');
  await expect(aviso).toContainText('la que renueva el vínculo es la organización');
  await expect(aviso).toContainText('se suspende');
  const identificador = (await aviso.getAttribute('data-testid'))!.replace('recertificacion-aviso-', '');

  await page.getByTestId(`recertificacion-confirmar-${identificador}`).click();
  await expect(page.getByRole('dialog')).toContainText('Confirmo que sigo trabajando');
  await expect(page.getByRole('dialog')).toContainText('no renueva su vínculo: la que lo renueva es la organización');
  await confirmar('Confirmar que sigo trabajando aquí');

  await expect.poll(() => hubo('POST', `/me/support-engagements/${identificador}/confirm`)).toBe(true);
  const confirmacion = (await peticiones()).find((p) => p.method === 'POST' && p.url.includes(`/me/support-engagements/${identificador}/confirm`))!;
  expect(confirmacion.body ?? {}).toEqual({});
  expect((confirmacion.response as { reactivated: boolean }).reactivated).toBe(false);

  // El aviso no se va (nada se renovó): cambia a «ya avisó» y no vuelve a ofrecer el botón.
  const declarado = page.getByTestId(`recertificacion-declarado-${identificador}`);
  await expect(declarado).toContainText('Ya avisó que sigue trabajando aquí');
  await expect(declarado).toContainText('Falta que su organización renueve el vínculo');
  await expect(page.getByTestId(`recertificacion-confirmar-${identificador}`)).toHaveCount(0);

  // Recarga: lo que se ve es lo que quedó guardado.
  await page.reload();
  await expect(page.getByTestId('mis-vinculos')).toBeVisible();
  await expect(page.getByTestId(`recertificacion-declarado-${identificador}`)).toBeVisible();

  // «Mi actividad» lo muestra con su nombre.
  await page.getByTestId('mi-actividad-enlace').click();
  await expect(page).toHaveURL(/\/my-support\/activity$/);
  await expect(page.getByTestId('actividad-tabla')).toContainText('La persona confirmó su vínculo');
  await expect(page.getByTestId('actividad-tabla')).not.toContainText('Lucía Paz');
});

test('3c · Silvia, con el vínculo suspendido, ve «Suspendido: pida a su organización que lo renueve», sin botón, y la organización es la que lo reactiva', async () => {
  await entrar('silvia');
  await irA('/my-support');
  const aviso = page.locator('[data-testid^="recertificacion-aviso-"]').first();
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveAttribute('data-estado', 'SUSPENDED');
  await expect(aviso).toContainText('Suspendido: pida a su organización que lo renueve');
  await expect(aviso).toContainText('Solo la organización puede renovarlo');
  // Ningún gesto de la persona lo reactiva: ni botón de confirmar ni de avisar, ni pedir más permisos.
  await expect(page.locator('[data-testid^="recertificacion-confirmar-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="pedir-mas-"]')).toHaveCount(0);
  expect((await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/confirm'))).toBe(false);
  const lista = (await peticiones()).find((p) => p.method === 'GET' && p.url.includes('/me/support-engagements'))!;
  // La API lo dice SUSPENDED y el vínculo no trae lo que la API no tiene.
  const vinculo = (lista.response as { items: Record<string, unknown>[] }).items[0]!;
  expect(vinculo['status']).toBe('SUSPENDED');
  expect(vinculo).not.toHaveProperty('reactivationRequestedAt');
  expect(vinculo).not.toHaveProperty('personEmail');
  expect(vinculo['suspendedAt']).toEqual(expect.any(String));
});

test('3b · lo pedido lleva los nombres del contrato de la API (roleTemplateCode, actions), no los de la pantalla', async () => {
  await entrar('ana');
  await irA('/my-support');
  await page.locator('[data-testid^="pedir-mas-"]').first().click();
  await expect(page.getByTestId('pedido-dialogo')).toBeVisible();
  await elegir(page.getByTestId('pedido-objetivo'), /Jorge Vaca/);
  await page.getByTestId('pedido-agregar').click();
  await page.getByTestId('pedido-enviar').click();
  await expect.poll(() => hubo('POST', '/support-engagement-requests', 201)).toBe(true);
  const envio = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/support-engagement-requests'))!;
  const cuerpo = envio.body as Record<string, unknown> & { items: Record<string, unknown>[] };
  expect(cuerpo['roleTemplateCode']).toBe('SECRETARY');
  expect(cuerpo['parentAssignmentId']).toBeTruthy();
  expect(cuerpo).not.toHaveProperty('roleTemplate');
  expect(cuerpo).not.toHaveProperty('parentEngagementId');
  expect(cuerpo.items[0]).toHaveProperty('actions');
  expect(cuerpo.items[0]).not.toHaveProperty('proposedActions');
});

test('4 · la organización quita permisos en lote en la revisión periódica y reactiva un vínculo suspendido', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-review');
  await expect(page.getByTestId('revision-card')).toBeVisible();

  // Ana declaró que sigue trabajando aquí, pero eso NO renueva el vínculo: lo renueva la organización, así que sigue en
  // la lista —con su declaración a la vista—. Lo más urgente primero.
  const nombres = page.locator('[data-testid^="revision-persona-"]');
  await expect(nombres).toHaveText(['Silvia Soria', 'Pedro Camacho', 'Ana Gutiérrez', 'Gabriel Rojas']);
  await expect(page.locator('[data-testid^="revision-estado-"]')).toHaveText(['Suspendido', 'Vencido', 'Por vencer', 'Por vencer']);
  await expect(page.locator('[data-testid^="revision-declaracion-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="revision-declaracion-"]').first()).toContainText('que sigue trabajando aquí');
  await expect(page.getByTestId('revision-filtro')).toContainText('Suspendidos (1)');

  // Se marcan Pedro y Gabriel y se les quitan los permisos.
  const fila = (nombre: string): Locator => page.getByTestId('tabla-fila').filter({ hasText: nombre });
  /** Marca una fila de la tabla: el `<input>` es invisible, se toca la casilla dibujada. */
  const marcar = (nombre: string): Promise<void> => fila(nombre).locator('.checkbox-box').click();
  await marcar('Pedro Camacho');
  await marcar('Gabriel Rojas');
  await expect(page.getByTestId('revision-seleccionados')).toContainText('2 seleccionados');
  await page.getByTestId('revision-quitar-lote').click();
  await expect(page.getByRole('dialog')).toContainText('Se quitan todos los permisos de 2 personas');
  await expect(page.getByRole('dialog')).toContainText('Pedro Camacho');
  await confirmar('Quitar permisos');

  // Tres permisos retirados (dos de Pedro, uno de Gabriel), uno por petición.
  await expect.poll(async () => (await peticiones()).filter((p) => p.method === 'PATCH' && p.url.includes('/grants') && p.status === 200).length).toBe(3);
  const cuerpos = (await peticiones()).filter((p) => p.method === 'PATCH' && p.url.includes('/grants')).map((p) => p.body as { revoke: boolean });
  expect(cuerpos.every((c) => c.revoke === true)).toBe(true);
  await expect(page.getByTestId('revision-resultado')).toContainText('Se quitaron los permisos de 2 personas');

  // Persistencia: en «Equipo de apoyo» ya no tienen alcance.
  await page.reload();
  await irA('/administration/support-team');
  await expect(page.locator('[data-testid^="equipo-alcance-"]', { hasText: 'Sin permisos todavía' })).toHaveCount(2);

  // El vínculo suspendido se reactiva con «Confirmar seleccionados» (un solo gesto, en lote).
  await irA('/administration/support-review');
  await marcar('Silvia Soria');
  await page.getByTestId('revision-confirmar-lote').click();
  await expect(page.getByTestId('revision-dialogo-confirmar')).toContainText('se las reactiva');
  await page.getByTestId('revision-confirmar-lote-ok').click();
  await expect.poll(() => hubo('POST', '/recertify')).toBe(true);
  await expect(page.getByTestId('revision-resultado')).toContainText('Se confirmó el vínculo de 1 persona');
  await expect(page.locator('[data-testid^="revision-persona-"]', { hasText: 'Silvia Soria' })).toHaveCount(0);

  // El historial lo cuenta.
  await pestana('Historial');
  await expect(page.getByTestId('revision-historial')).toContainText('Se reactivó el vínculo de Silvia Soria');
  await expect(page.getByTestId('revision-historial')).toContainText('Se retiró un permiso');
});

test('5 · la bandeja de solicitudes filtra por persona, rol, estado y antigüedad, pagina y muestra la vencida aparte', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-requests');
  const tarjetas = page.locator('li.solicitud');

  // Pendientes: cinco (cuatro de arranque y la que Ana pidió en el recorrido 3b); la de Rocío, a dos días de vencer, se marca urgente.
  await expect(page.getByTestId('solicitudes-vista')).toContainText('Pendientes (5)');
  await expect(tarjetas).toHaveCount(5);
  await expect(page.locator('[data-testid^="solicitud-vence-"].solicitud__vence--urgente')).toHaveCount(1);

  // Por rol: queda la de Julia (enfermería), y el filtro vive en la URL.
  await filtrar('Rol', 'Enfermería');
  await expect(page).toHaveURL(/rol=NURSING/);
  await expect(tarjetas).toHaveCount(1);
  await expect(tarjetas.first()).toContainText('Julia Mamani');
  await page.reload();
  await expect(tarjetas).toHaveCount(1);
  await expect(page.getByTestId('solicitudes-vista')).toContainText('Pendientes (1)');

  // Por persona.
  await page.goto('/administration/support-requests');
  await filtrar('Persona', 'Sofía Aguilar');
  await expect(page).toHaveURL(/persona=/);
  await expect(tarjetas).toHaveCount(1);
  await expect(tarjetas.first()).toContainText('Sofía Aguilar');

  // Por estado «Vencida»: la vista cambia sola a las resueltas y las dos vencidas se muestran aparte.
  await page.goto('/administration/support-requests?estado=EXPIRED');
  await expect(tarjetas).toHaveCount(2);
  await expect(page.locator('[data-testid^="solicitud-vencida-"]')).toHaveCount(2);
  await expect(page.locator('[data-testid^="solicitud-vencida-"]').first()).toContainText('Ya no se puede aprobar ni rechazar');
  await expect(page.locator('[data-testid^="guardar-decision-"]')).toHaveCount(0);

  // Por antigüedad: quince días o más.
  await page.goto('/administration/support-requests?antiguedad=GE15');
  await expect(page.getByTestId('solicitudes-vista')).toContainText('Pendientes (0)');
  await expect(page.getByTestId('solicitudes-vista')).toContainText('Resueltas (7)');

  // Paginación de las resueltas: cinco y dos.
  await page.goto('/administration/support-requests');
  await page.getByTestId('solicitudes-vista').locator('[data-value="RESOLVED"]').click();
  await expect(tarjetas).toHaveCount(5);
  await expect(page.getByTestId('solicitudes-paginacion')).toContainText('1–5 de 7');
  await page.getByTestId('solicitudes-paginacion').getByRole('button', { name: 'Página siguiente' }).click();
  await expect(tarjetas).toHaveCount(2);

  // Sin coincidencias, lo dice distinto de «no hay solicitudes».
  await page.goto('/administration/support-requests?rol=CALL_CENTER&antiguedad=LT3');
  await expect(page.getByTestId('solicitudes-sin-resultados')).toContainText('Ninguna solicitud coincide con los filtros');
});

test('6 · el aviso de dispositivo nuevo: «Fui yo» lo reconoce y «No fui yo» cierra las otras sesiones', async () => {
  await entrar('lucia');
  const aviso = page.getByTestId('aviso-dispositivo');
  await expect(aviso).toBeVisible();
  await expect(page.getByTestId('aviso-dispositivo-detalle')).toContainText('Chrome en Windows');
  await page.getByTestId('aviso-dispositivo-fui-yo').click();
  // Confirmar desde el propio dispositivo no prueba nada: la API pide el código de 8 dígitos que llega al correo verificado.
  await expect(page.getByTestId('aviso-dispositivo-codigo-paso')).toBeVisible();
  await page.getByTestId('aviso-dispositivo-pedir-codigo').click();
  await expect(page.getByTestId('aviso-dispositivo-enviado')).toBeVisible();
  await page.getByTestId('aviso-dispositivo-codigo').locator('input').or(page.locator('input[data-testid="aviso-dispositivo-codigo"]')).first().fill('12345678');
  await page.getByTestId('aviso-dispositivo-confirmar-codigo').click();
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && /\/iam\/me\/devices\/[^/]+\/confirm$/.test(p.url) && p.status === 200)).toBe(true);
  const confirmado = (await peticiones()).filter((p) => p.method === 'POST' && /\/iam\/me\/devices\/.+\/confirm$/.test(p.url)).at(-1)!;
  expect(confirmado.response).toMatchObject({ confirmed: true });
  await expect(aviso).toHaveCount(0);

  // Reconocido: al volver a entrar ya no avisa.
  await entrar('lucia');
  await expect(page.getByTestId('header-cuenta')).toBeVisible();
  await expect(page.getByTestId('aviso-dispositivo')).toHaveCount(0);

  // Marcos no reconoce el dispositivo: se cierran las otras sesiones y se le manda a cambiar la contraseña.
  await entrar('marcos');
  await expect(page.getByTestId('aviso-dispositivo')).toBeVisible();
  await page.getByTestId('aviso-dispositivo-no-fui-yo').click();
  await expect(page.getByRole('dialog')).toContainText('Se cierran todas las sesiones de su cuenta menos esta');
  await confirmar('Cerrar otras sesiones');
  await expect(page.getByTestId('aviso-dispositivo-resultado')).toContainText('Se cerró 1 sesión');
  await expect(page.getByTestId('aviso-dispositivo-cambiar-clave')).toBeVisible();
  // Una sola operación atómica de la API: `POST /iam/me/devices/:id/not-me`, no listar y revocar de a una.
  const peticionesDeEntonces = await peticiones();
  const noFuiYo = peticionesDeEntonces.filter((p) => p.method === 'POST' && /\/iam\/me\/devices\/.+\/not-me$/.test(p.url));
  expect(noFuiYo).toHaveLength(1);
  expect(noFuiYo[0]!.status).toBe(200);
  expect(noFuiYo[0]!.response).toMatchObject({ revokedSessions: 1 });
  expect(peticionesDeEntonces.filter((p) => /\/iam\/me\/sessions/.test(p.url))).toHaveLength(0);
  await page.getByTestId('aviso-dispositivo-entendido').click();
  await expect(page.getByTestId('aviso-dispositivo')).toHaveCount(0);
});

test('7 · el código de invitación viaja en el fragmento, no se transforma y un código que no sirve se dice siempre igual', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-invitations');
  await page.getByTestId('invitacion-emitir').click();
  await expect(page.getByTestId('invitacion-resultado')).toBeVisible();
  const codigo = (await page.getByTestId('invitacion-codigo').innerText()).trim();
  // Alta entropía: 24 bytes en base64url, con mayúsculas y minúsculas.
  expect(codigo).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(codigo).not.toBe(codigo.toUpperCase());

  // Rosa abre el enlace que lleva el QR (`/my-support#code=…`, el formato lo fija invitation-link.spec):
  // el código se pone en el campo y se borra de la dirección.
  await entrar('rosa');
  await page.goto(`/my-support#code=${codigo}`);
  await expect(page.getByTestId('canje-codigo').locator('input')).toHaveValue(codigo);
  await expect.poll(() => page.evaluate(() => `${location.search}${location.hash}`)).toBe('');
  expect(page.url()).not.toContain('code=');
  expect(await page.evaluate(() => history.length > 0 && !document.referrer.includes('code='))).toBe(true);

  // El mismo código en minúsculas es otro código: se rechaza, igual que uno inventado.
  const rechazos: string[] = [];
  const intentar = async (valor: string): Promise<string> => {
    await page.getByTestId('canje-codigo').locator('input').fill(valor);
    await page.getByTestId('canje-enviar').click();
    const resultado = page.getByTestId('canje-resultado');
    await expect(resultado).toBeVisible();
    return (await resultado.innerText()).trim();
  };
  rechazos.push(await intentar(codigo.toLowerCase()));
  rechazos.push(await intentar('un-codigo-que-nunca-existio-123456'));
  expect(rechazos[0]).toContain('no es válido o ya no está disponible');

  // Con el código exacto, entra. Va tal cual, sin cambiarle las mayúsculas.
  const exito = await intentar(codigo);
  // Un código SIN persona destino (multiuso) no afilia solo: deja una solicitud que la organización decide.
  expect(exito).toContain('quedó pendiente de aprobación');
  const canje = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/affiliation-invitations/redeem')).at(-1)!;
  expect((canje.body as { code: string }).code).toBe(codigo);
  expect(canje.status).toBe(200);

  // Ya usado (un solo uso): el mismo mensaje que si no existiera.
  rechazos.push(await intentar(codigo));
  expect(new Set(rechazos).size).toBe(1);
  const respuestas = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/affiliation-invitations/redeem') && p.status !== 200);
  expect(new Set(respuestas.map((p) => p.status))).toEqual(new Set([422]));
});
