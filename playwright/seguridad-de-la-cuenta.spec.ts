import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Seguridad de la cuenta y de la organización contra el **backend simulado**, con las formas de la API:
 *
 * 1. **Login con `mfaEnrollmentRequired` → alta del TOTP → acceso normal.** Una regla exige los dos pasos; quien no
 *    tiene factor ENTRA (la API no lo rechaza), el cliente lo lleva a darlo de alta y mantiene la aplicación
 *    restringida hasta que lo hace; con el factor, el siguiente ingreso pide el código y todo funciona.
 * 2. **Redes de la organización**: guardar un conjunto, ver la vista previa, y el rechazo por un conjunto que
 *    dejaría afuera a quien lo guarda (nada cambia).
 *
 * El aviso de dispositivo nuevo con la ruta `not-me` y la confirmación del vínculo (incluido el suspendido) están en
 * `administracion-y-seguridad.spec.ts`.
 *
 * Son **seriales** y comparten pestaña: el simulador guarda su estado en `sessionStorage`. Se levanta con `yarn start:demo`
 * y se apunta con `E2E_BASE_URL`.
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

interface Peticion {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly response?: unknown;
}

const peticiones = (): Promise<Peticion[]> => page.evaluate(() => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? []);

const hubo = async (metodo: string, fragmento: string, estado = 200): Promise<boolean> =>
  (await peticiones()).some((p) => p.method === metodo && p.url.includes(fragmento) && p.status === estado);

/** Empieza una sesión limpia en el login y deja los datos escritos sin enviarlos. */
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
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(ruta.replace(/[/?]/g, '\\$&')));
}

const tocar = (id: string): Promise<void> => page.getByTestId(id).locator('label').first().click();
const pestana = (nombre: string): Promise<void> => page.getByRole('tab', { name: nombre }).click();
const interruptor = (id: string): Locator => page.getByTestId(id).getByRole('switch');
const confirmar = (nombre: string | RegExp = 'Confirmar'): Promise<void> => page.getByRole('dialog').getByRole('button', { name: nombre }).click();
/** El campo de un `app-input`: el `data-testid` va al host o al `<input>` según el componente. */
const campo = (id: string): Locator => page.getByTestId(id).locator('input, textarea').or(page.locator(`input[data-testid="${id}"]`)).first();

/** Cambia el interruptor de dos pasos del personal y guarda (la política es de la organización, no de quien entra). */
async function dosPasosDelPersonal(activar: boolean): Promise<void> {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Personal de la organización');
  const estaba = await interruptor('control-mfa').isChecked();
  if (estaba !== activar) {
    await tocar('control-mfa');
    await page.getByTestId('controles-guardar').click();
    await confirmar();
    await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);
  }
}

test('1 · con una regla que exige los dos pasos, Marcos ENTRA con mfaEnrollmentRequired, queda restringido y da de alta su aplicación', async () => {
  await dosPasosDelPersonal(true);

  await irAlLogin('marcos');
  await page.getByTestId('login-submit').click();
  // No hay rechazo: la API deja entrar y el login lo lleva a dar de alta el factor, con el destino para después.
  await page.waitForURL(/\/my-account\/security\/mfa\?returnUrl=%2F/, { timeout: 30_000 });
  await expect(page.getByTestId('login-error')).toHaveCount(0);
  const login = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/iam/auth/login') && p.status === 200).at(-1)!;
  expect((login.response as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired).toBe(true);
  expect(login.response as object).toHaveProperty('accessToken');

  await expect(page.getByTestId('mfa-obligatorio')).toContainText('Su organización exige este paso');
  await expect(page.getByTestId('mfa-obligatorio')).toContainText('no puede usar el resto de la aplicación');
  await expect(page.getByTestId('mfa-inactiva')).toBeVisible();
  await expect(page.getByTestId('mfa-secreto')).toHaveCount(0);

  // Restringido: ni escribiendo otra dirección ni recargando se usa el resto de la aplicación.
  // (La guarda lo devuelve a la pantalla de alta sin pasar por `/dashboard`: por eso no se espera esa URL.)
  await page.evaluate(() => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/my-account\/security\/mfa/);
  await page.goto('/my-account/appointments');
  await expect(page).toHaveURL(/\/my-account\/security\/mfa/);
  await expect(page.getByTestId('mfa-card')).toBeVisible();
  // Un enlace de invitación (`#code=<secreto>`) abierto mientras falta el segundo paso: el retorno NO copia el código
  // (quedaría en los registros del servidor del front y en el `Referer`).
  const SECRETO = 'Zq3-AbC_9xYkLmNoPqRsTuVwXyZ0123456789abcdef';
  await page.goto(`/my-support#code=${SECRETO}`);
  await expect(page).toHaveURL(/\/my-account\/security\/mfa\?returnUrl=/);
  expect(page.url()).not.toContain(SECRETO);
  expect(decodeURIComponent(page.url())).not.toContain('code=');
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/my-support');
  // Tras la recarga el aviso del login ya no está: el cliente pregunta GET /iam/me/mfa.
  await expect.poll(() => hubo('GET', '/iam/me/mfa')).toBe(true);
  const estado = (await peticiones()).filter((p) => p.method === 'GET' && p.url.endsWith('/iam/me/mfa')).at(-1)!;
  expect(estado.response).toMatchObject({ required: true, enrolled: false, enrollmentRequired: true });

  // Activar: pide el factor y muestra el QR y el código para escribir a mano, una sola vez.
  await page.getByTestId('mfa-empezar').click();
  // La API pide quién es antes de darlo de alta (`currentPassword`): sin eso, 422 MFA_REAUTH_REQUIRED.
  await expect(page.getByTestId('reauth-form')).toBeVisible();
  await campo('reauth-contrasena').fill('cualquiera');
  await page.getByTestId('reauth-enviar').click();
  await expect(page.getByTestId('mfa-qr')).toBeVisible();
  const secreto = ((await page.getByTestId('mfa-secreto').innerText()) ?? '').replace(/\s+/g, '');
  expect(secreto).toMatch(/^[A-Z2-7]{32}$/);
  await expect(page.getByTestId('mfa-pasos')).toContainText('se muestra una sola vez');
  const alta = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/iam/me/mfa/totp'))!;
  expect(alta.status).toBe(201);
  expect(alta.response).toMatchObject({ secret: secreto });
  expect((alta.response as { otpauthUri: string }).otpauthUri).toContain(`secret=${secreto}`);

  // Un código equivocado: 422, se explica, el campo se vacía y el QR sigue ahí.
  await campo('mfa-codigo').fill('000000');
  await page.getByTestId('mfa-confirmar').click();
  await expect(page.getByTestId('mfa-codigo-error')).toContainText('no es correcto o ya venció');
  await expect(campo('mfa-codigo')).toHaveValue('');
  await expect(page.getByTestId('mfa-secreto')).toBeVisible();
  expect(await hubo('POST', '/confirm', 422)).toBe(true);

  // Con el bueno se activa, y el cliente deja de restringir.
  await campo('mfa-codigo').fill('123 456');
  await page.getByTestId('mfa-confirmar').click();
  await expect(page.getByTestId('mfa-listo')).toContainText('quedó activada');
  expect(await hubo('POST', '/confirm', 200)).toBe(true);
  const confirmacion = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/confirm') && p.status === 200).at(-1)!;
  expect(confirmacion.body).toEqual({ code: '123456' });
  expect(confirmacion.response).toMatchObject({ verified: true });

  // Acceso normal: continuar lleva al destino pedido y las demás rutas abren.
  await page.getByTestId('mfa-continuar').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/my-account/security/mfa'), { timeout: 30_000 });
  await expect(page.getByTestId('header-cuenta')).toBeVisible();
  await irA('/my-account/security');
  await expect(page.getByTestId('seguridad-dos-pasos')).toBeVisible();
  await expect(page.getByTestId('seguridad-dos-pasos-enlace')).toBeVisible();
  await page.goto('/my-account/appointments');
  await expect(page).toHaveURL(/\/my-account\/appointments/);
  await expect(page.getByTestId('header-cuenta')).toBeVisible();

  // La pantalla de alta ya la muestra activada.
  await page.goto('/my-account/security/mfa');
  await expect(page.getByTestId('mfa-activada')).toContainText('está activada');
  await expect(page.getByTestId('mfa-obligatorio')).toHaveCount(0);
});

test('1b · con el factor activado, el siguiente ingreso pide el código y entra sin pasar por el alta', async () => {
  await irAlLogin('marcos');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('Ingrese el código de verificación');
  await page.getByTestId('login-mfa-code').fill('000000');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('no es válido');
  await page.getByTestId('login-mfa-code').fill('123456');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/my-account\/security\/mfa/);
  await expect(page.getByTestId('header-cuenta')).toBeVisible();
  const login = (await peticiones()).filter((p) => p.method === 'POST' && p.url.includes('/iam/auth/login') && p.status === 200).at(-1)!;
  expect(login.response as object).not.toHaveProperty('mfaEnrollmentRequired');

  // Se vuelve a como estaba.
  await dosPasosDelPersonal(false);
});

test('2 · las redes de la organización: ayuda, vista previa, guardar, recargar y el rechazo por un conjunto que deja afuera a quien lo guarda', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/session-controls');
  await pestana('Redes de la organización');
  const panel = page.getByTestId('redes-panel');
  await expect(panel).toBeVisible();

  // Sin reglas no se restringe a nadie, y esta pantalla lo dice en lenguaje simple.
  await expect(page.getByTestId('redes-vacio')).toContainText('no se restringe a nadie');
  await expect(page.getByTestId('redes-aviso-bloqueo')).toContainText('No se puede dejar a nadie afuera, tampoco a usted');
  await expect(page.getByTestId('redes-no-exigida')).toContainText('todavía no restringen a nadie');
  await page.getByTestId('redes-ayuda').locator('summary').click();
  await expect(page.getByTestId('redes-ayuda')).toContainText('termina en /32');
  await expect(page.getByTestId('redes-guardar')).toBeDisabled();

  // Un rango sin barra no se manda: se explica al lado del campo.
  await page.getByTestId('redes-agregar-permitida').click();
  await campo('redes-cidr-0').fill('190.129.0.0');
  await page.getByTestId('redes-guardar').click();
  await expect(page.getByTestId('redes-fila-0')).toContainText('Falta la barra y el número del final');
  expect(await hubo('PUT', '/org/ip-access-rules')).toBe(false);

  // Con el rango bueno, la vista previa prueba direcciones ANTES de guardar.
  await campo('redes-cidr-0').fill('190.129.0.0/16');
  await campo('redes-descripcion-0').fill('Sede central');
  await page.getByTestId('redes-agregar-bloqueada').click();
  await campo('redes-cidr-1').fill('190.129.99.0/24');
  await expect(page.getByTestId('redes-resumen')).toContainText('Solo se entra desde la red permitida');
  await campo('redes-prueba-ip').fill('190.129.10.4');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('Puede entrar');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('190.129.0.0/16 (Sede central)');
  await campo('redes-prueba-ip').fill('190.129.99.7');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('No puede entrar');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('Bloquear gana siempre');
  await campo('redes-prueba-ip').fill('8.8.8.8');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('No cae en ninguna red permitida');

  // Guardar pide confirmación; cancelar no cambia nada.
  await page.getByTestId('redes-guardar').click();
  await expect(page.getByRole('dialog')).toContainText('Si alguna deja fuera la red desde la que está trabajando, no se guarda nada');
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir editando' }).click();
  expect(await hubo('PUT', '/org/ip-access-rules')).toBe(false);

  await page.getByTestId('redes-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/ip-access-rules')).toBe(true);
  const envio = (await peticiones()).find((p) => p.method === 'PUT' && p.url.endsWith('/org/ip-access-rules'))!;
  // Se manda el conjunto COMPLETO (la API lo reemplaza), con los nombres del DTO y sin campos vacíos.
  expect(envio.body).toEqual({
    rules: [
      { type: 'ALLOW', cidr: '190.129.0.0/16', description: 'Sede central' },
      { type: 'DENY', cidr: '190.129.99.0/24' },
    ],
  });
  expect((envio.response as { rules: { id: string }[] }).rules.every((r) => r.id !== '')).toBe(true);

  // Recarga: lo que se ve es lo que quedó guardado.
  await page.reload();
  await pestana('Redes de la organización');
  await expect(page.getByTestId('redes-fila-0')).toBeVisible();
  await expect(campo('redes-cidr-0')).toHaveValue('190.129.0.0/16');
  await expect(campo('redes-descripcion-0')).toHaveValue('Sede central');
  await expect(campo('redes-cidr-1')).toHaveValue('190.129.99.0/24');
  await expect(page.getByTestId('redes-guardar')).toBeDisabled();

  // Un conjunto que deja afuera a quien lo guarda: la API responde 422 y NO cambia nada.
  await page.getByTestId('redes-quitar-1').click();
  await campo('redes-cidr-0').fill('203.0.113.0/24');
  await campo('redes-prueba-ip').fill('190.129.10.4');
  await expect(page.getByTestId('redes-prueba-resultado')).toContainText('No puede entrar');
  await page.getByTestId('redes-guardar').click();
  await confirmar();
  const rechazo = page.getByTestId('redes-error');
  await expect(rechazo).toBeVisible();
  await expect(rechazo).toHaveAttribute('data-kind', 'LOCK_OUT');
  await expect(rechazo).toContainText('No se guardó nada');
  await expect(rechazo).toContainText('usted quedaría fuera de su propia organización');
  await expect.poll(() => hubo('PUT', '/org/ip-access-rules', 422)).toBe(true);
  const rechazado = (await peticiones()).filter((p) => p.method === 'PUT' && p.status === 422).at(-1)!;
  expect(rechazado.body).toEqual({ rules: [{ type: 'ALLOW', cidr: '203.0.113.0/24', description: 'Sede central' }] });
  // Lo editado sigue a la vista y lo guardado no cambió.
  await expect(campo('redes-cidr-0')).toHaveValue('203.0.113.0/24');
  await page.reload();
  await pestana('Redes de la organización');
  await expect(campo('redes-cidr-0')).toHaveValue('190.129.0.0/16');
  await expect(page.getByTestId('redes-filas').locator('li')).toHaveCount(2);

  // Con la regla de red encendida, la pestaña lo dice (y se vuelve a dejar como estaba).
  await pestana('Personal de la organización');
  await tocar('control-network');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await expect.poll(() => hubo('PUT', '/org/session-policies')).toBe(true);
  await pestana('Redes de la organización');
  await expect(page.getByTestId('redes-exigida')).toContainText('Personal de la organización');
  await pestana('Personal de la organización');
  await expect(interruptor('control-network')).toBeChecked();
  await tocar('control-network');
  await page.getByTestId('controles-guardar').click();
  await confirmar();
  await pestana('Redes de la organización');
  await page.getByTestId('redes-quitar-1').click();
  await page.getByTestId('redes-quitar-0').click();
  await page.getByTestId('redes-guardar').click();
  await confirmar();
  await page.reload();
  await pestana('Redes de la organización');
  await expect(page.getByTestId('redes-vacio')).toBeVisible();
});
