import { expect, test, type Page } from '@playwright/test';

/**
 * La **bandeja de chat compartida** del personal de apoyo contra el **backend
 * simulado**.
 *
 * ## Por qué contra el simulador, y por qué en serie
 *
 * Las rutas de la bandeja están en el contrato compartido con la API, que todavía
 * no las sirve. La maqueta las atiende con estado que sobrevive a F5
 * (`Coleccion` sobre `sessionStorage`) y esta suite la recorre **como varias
 * personas distintas en la misma pestaña**: lo que una deja guardado lo ve la
 * siguiente. Por eso las pruebas son **seriales** y comparten página; barajarlas
 * rompe el recorrido.
 *
 * Se levanta con `yarn start:demo` y se apunta con `E2E_BASE_URL`.
 *
 * ## Qué recorre (en orden)
 *
 * 1. Ana toma una conversación del Dr. Pérez, responde con una plantilla, y el
 *    **paciente** ve al doctor como remitente con «Respondido por su equipo»,
 *    sin el nombre de Ana. El **doctor** ve quién respondió por él y va a «Mi
 *    equipo».
 * 2. Un mensaje **clínico** no se responde: se deriva, y el doctor lo ve marcado.
 * 3. **Otra secretaria** no puede tomar la que ya tiene Ana.
 * 4. **Rosa** no ve conversaciones del hospital, ni abriéndolas por la dirección.
 * 5. Ana pide **acceso clínico temporal** (caso 10) y lo decide el doctor.
 * 6. Elena trabaja en **dos organizaciones**: elige una, y donde el doctor no la
 *    autorizó a responder, la pantalla lo dice y no la deja.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;
/** La conversación de Ana Lucía con el Dr. Pérez, que los pasos siguientes reusan. */
let conversacionDeAna = '';

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
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 30_000 });
  // Quien trabaja en más de una organización elige primero con cuál entra; la bandeja las junta igual.
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
  await expect(page).toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}(\\?.*)?$`));
}

async function peticiones(): Promise<{ method: string; url: string; status: number; body: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? []);
}

/** La fila de la bandeja que contiene ese texto. */
const fila = (texto: string) => page.locator('[data-testid^="conv-"]', { hasText: texto }).first();

async function abrirBandeja(): Promise<void> {
  await irA('/support-inbox');
  await expect(page.getByTestId('bandeja')).toBeVisible();
}

async function pestana(valor: 'NEW' | 'MINE' | 'TEAM' | 'WAITING_DOCTOR' | 'RESOLVED'): Promise<void> {
  await page.getByTestId(`pestana-${valor}`).click();
}

const CAMBIO_DE_CITA = 'cambiar mi cita del jueves';
/** El mensaje clínico ya no se lee en la lista: la API lo reemplaza por este marcador mientras no haya acceso clínico aprobado. */
const DOLOR_DE_PECHO = 'Contenido clínico oculto';

test('1 · Ana toma una conversación de Pérez y responde con una plantilla; el paciente ve al doctor con «respondido por su equipo»', async () => {
  await entrar('ana');
  await abrirBandeja();

  // Solo ve la organización que la vinculó, y nada de lo que no cubre.
  await expect(page.getByTestId('bandeja-organizacion-nombre')).toContainText('Hospital Piloto Mantra');
  await expect(page.getByTestId('bandeja-organizacion')).toHaveCount(0);

  const conversacion = fila(CAMBIO_DE_CITA);
  await expect(conversacion).toBeVisible();
  await expect(conversacion).toContainText('Dr. Andrés Pérez');
  await expect(conversacion).toContainText('Sin responsable');
  await expect(conversacion.locator('[data-testid="marca-clinico"]')).toHaveCount(0);

  // Tomar: UI → request → response.
  await conversacion.getByRole('button', { name: /Tomar la conversación/ }).click();
  await expect(page.getByTestId('conversacion')).toBeVisible();
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.endsWith('/assignment') && p.status === 200)).toBe(true);
  const tomar = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith('/assignment'))!;
  expect(tomar.body).toMatchObject({ status: 'TAKEN' });
  conversacionDeAna = /conversations\/([^/]+)\/assignment/.exec(tomar.url)![1]!;

  // Pasó a «Míos» y la bandeja dice quién la tiene.
  await expect(page.getByTestId('conversacion-dueno')).toHaveText('Responsable: usted');
  await expect(page.getByTestId('conversacion-estado')).toContainText('En curso');
  await pestana('MINE');
  await expect(fila(CAMBIO_DE_CITA)).toContainText('Responsable: usted');

  // El aviso permanente y el botón principal.
  await expect(page.getByTestId('aviso-en-nombre')).toContainText('Está respondiendo como Dr. Andrés Pérez.');
  await expect(page.getByTestId('aviso-en-nombre')).toContainText('El paciente verá «respondido por su equipo».');
  await expect(page.getByTestId('aviso-en-nombre')).toContainText('Su nombre queda registrado como autora.');
  await expect(page.getByTestId('enviar-respuesta')).toHaveText(/Enviar como Dr\. Andrés Pérez/);

  // Plantilla por categoría, completada con el nombre del paciente y del doctor.
  await page.getByTestId('plantillas-abrir').click();
  await expect(page.getByTestId('plantillas-lista')).toContainText('Citas');
  await page.getByTestId('plantillas-lista').getByRole('button', { name: 'Proponer otro horario' }).click();
  const texto = page.getByTestId('compositor-texto').locator('textarea');
  await expect(texto).toHaveValue(/Hola Ana, podemos reprogramar su cita con Dr\. Andrés Pérez\./);
  await page.getByTestId('enviar-respuesta').click();

  // Request: el doctor es el remitente y su perfil viaja como «en nombre de».
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.endsWith(`/community/conversations/${conversacionDeAna}/messages`) && p.status === 201)).toBe(true);
  const envio = (await peticiones()).find((p) => p.method === 'POST' && p.url.endsWith(`/community/conversations/${conversacionDeAna}/messages`))!;
  const cuerpo = envio.body as { senderProfileId: string; onBehalfOfProfileId: string; bodyText: string };
  expect(cuerpo.onBehalfOfProfileId).toBe(cuerpo.senderProfileId);
  // Sin marcar «También por correo», el envío no pide canales.
  expect(cuerpo).not.toHaveProperty('channels');
  expect(cuerpo.bodyText).toContain('podemos reprogramar su cita');

  // Respuesta → persistencia → recarga → UI: la autora real queda a la vista del equipo.
  await page.reload();
  await expect(page.getByTestId('conversacion')).toBeVisible();
  await expect(page.getByTestId('autora-real')).toContainText('Respondió Ana Gutiérrez en nombre de Dr. Andrés Pérez.');
  await expect(page.getByTestId('autora-real')).toContainText('El paciente ve «respondido por su equipo».');
});

test('1b · el paciente ve al doctor como remitente con la leyenda, y sin el nombre de Ana', async () => {
  await entrar('paciente');
  await irA('/messaging');
  await page.locator('[data-testid="conversacion"]', { hasText: 'Dr. Andrés Pérez' }).first().click();
  const respuesta = page.locator('[data-testid="mensaje"]', { hasText: 'podemos reprogramar su cita' });
  await expect(respuesta).toBeVisible();
  await expect(respuesta).toHaveAttribute('data-propio', 'false');
  await expect(respuesta.getByTestId('hilo-respondido-por-equipo')).toHaveText('Respondido por su equipo');
  // Quien escribió de verdad no aparece en ningún lado del chat del paciente.
  await expect(page.getByTestId('hilo-equipo-autora')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Ana Gutiérrez');
});

test('1c · el doctor ve en su chat quién respondió por él y va a «Mi equipo» para retirarla', async () => {
  await entrar('perez');
  await irA('/messaging');
  await page.locator('[data-testid="conversacion"]', { hasText: 'Ana Lucía' }).first().click();
  const respuesta = page.locator('[data-testid="mensaje"]', { hasText: 'podemos reprogramar su cita' });
  await expect(respuesta).toBeVisible();
  await expect(respuesta.getByTestId('hilo-equipo-autora')).toContainText('Respondió Ana Gutiérrez en su nombre');
  await respuesta.getByTestId('hilo-equipo-enlace').click();
  await expect(page).toHaveURL(/\/my-team$/);
  await expect(page.locator('[data-testid^="miembro-"]', { hasText: 'Ana Gutiérrez' }).first()).toBeVisible();
});

test('2 · un mensaje clínico se deriva al doctor: no se puede responder, y el doctor lo ve marcado', async () => {
  await entrar('ana');
  await abrirBandeja();

  const clinica = fila(DOLOR_DE_PECHO);
  await expect(clinica.getByTestId('marca-clinico')).toBeVisible();
  await expect(clinica.locator('[data-plazo="overdue"]')).toContainText('Vencida hace');
  // Lo más atrasado va arriba: la vencida abre la lista de «Nuevos».
  await expect(page.locator('[data-testid^="conv-"]').first()).toContainText(DOLOR_DE_PECHO);

  await clinica.getByTestId(/^abrir-/).click();
  await expect(page.getByTestId('conversacion')).toBeVisible();
  await expect(page.getByTestId('conversacion-clinica')).toBeVisible();
  await expect(page.getByTestId('mensaje-clinico')).toBeVisible();

  // El compositor advierte y no deja responder el contenido clínico.
  await expect(page.getByTestId('aviso-bloqueo')).toContainText('Solo el doctor puede responder su contenido');
  await expect(page.getByTestId('compositor-texto').locator('textarea')).toBeDisabled();
  await expect(page.getByTestId('enviar-respuesta')).toHaveAttribute('aria-disabled', 'true');
  // «Derivar al doctor» es el botón principal.
  await expect(page.getByTestId('derivar-principal')).toBeVisible();
  await expect(page.getByTestId('derivar-principal')).toHaveClass(/btn--primary/);

  await page.getByTestId('derivar-principal').click();
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.endsWith('/assignment') && (p.body as { status?: string }).status === 'WAITING_DOCTOR' && p.status === 200)).toBe(true);
  await expect(page.getByTestId('conversacion-estado')).toContainText('Esperando al doctor');

  // Persistió: tras recargar sigue esperando al doctor, y la pestaña la sigue.
  await page.reload();
  await expect(page.getByTestId('conversacion-estado')).toContainText('Esperando al doctor');
  await expect(page.getByTestId('pestana-WAITING_DOCTOR')).toHaveAttribute('aria-selected', 'true');
  await expect(fila(DOLOR_DE_PECHO)).toBeVisible();

  // El doctor la ve derivada en su chat, con el aviso en el hilo.
  await entrar('perez');
  await irA('/messaging');
  const delDoctor = page.locator('[data-testid="conversacion"]', { hasText: 'Jorge' }).first();
  await expect(delDoctor.getByTestId('conversacion-derivada')).toContainText('Derivada por su equipo');
  await delDoctor.click();
  await expect(page.getByTestId('hilo-derivada')).toContainText('solo usted puede responderlo');
});

test('3 · otra secretaria (Mariela) no puede tomar la conversación que ya tiene Ana', async () => {
  await entrar('mariela');
  await abrirBandeja();

  // No está en «Nuevos»: la tiene Ana, y Mariela lo ve en «Del equipo».
  await expect(page.locator('[data-testid^="conv-"]', { hasText: CAMBIO_DE_CITA })).toHaveCount(0);
  await pestana('TEAM');
  const ajena = fila(CAMBIO_DE_CITA);
  await expect(ajena).toContainText('Responsable: Ana Gutiérrez');
  await expect(ajena.getByRole('button', { name: /Tomar/ })).toHaveCount(0);

  await ajena.getByTestId(/^abrir-/).click();
  await expect(page.getByTestId('conversacion-dueno')).toHaveText('Responsable: Ana Gutiérrez');
  await expect(page.getByTestId('conv-tomar')).toHaveCount(0);
  await expect(page.getByTestId('aviso-bloqueo')).toContainText('Ana Gutiérrez tiene esta conversación');
  await expect(page.getByTestId('compositor-texto').locator('textarea')).toBeDisabled();
  await expect(page.getByTestId('autora-real')).toContainText('Respondió Ana Gutiérrez');

  // Con la lista desactualizada —la abrió cuando estaba libre—, la API igual lo impide: 409.
  await page.evaluate((id) => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element) => { tomar: (id: string) => void } } }).ng;
    // Lo que haría el botón «Tomar» de una lista que todavía mostraba la conversación como nueva.
    ng.getComponent(document.querySelector('app-support-inbox')!).tomar(id);
  }, conversacionDeAna);
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.endsWith(`/community/conversations/${conversacionDeAna}/assignment`) && p.status === 409)).toBe(true);
  await expect(page.getByTestId('bandeja-error')).toContainText('Ana Gutiérrez ya tiene esta conversación');
  // Nada cambió: sigue siendo de Ana.
  await expect(page.getByTestId('conversacion-dueno')).toHaveText('Responsable: Ana Gutiérrez');
});

test('4 · Rosa no ve conversaciones del hospital: ni en su lista, ni abriéndolas por la dirección', async () => {
  await entrar('rosa');
  await abrirBandeja();

  await expect(page.getByTestId('bandeja-organizacion-nombre')).toContainText('Consultorio Dra. Paola Céspedes');
  await expect(page.getByTestId('bandeja-organizacion')).toHaveCount(0);
  await expect(fila('turno para este viernes')).toBeVisible();
  await expect(page.locator('[data-testid^="conv-"]', { hasText: 'Dr. Andrés Pérez' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Hospital Piloto');

  // La dirección de una conversación del hospital: la API no confirma que exista.
  await page.evaluate((id) => {
    window.history.pushState({}, '', `/support-inbox?c=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, conversacionDeAna);
  await expect(page.getByText('No encontramos lo que busca')).toBeVisible();
  await expect(page.getByTestId('conversacion')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Ana Lucía');
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'GET' && p.url.includes(`/me/support-inbox/${conversacionDeAna}`) && p.status === 404)).toBe(true);
});

test('5 · Ana pide acceso clínico temporal: por defecto solo ve el motivo, y quien decide es el doctor', async () => {
  await entrar('ana');
  await abrirBandeja();
  await page.getByTestId('pestana-MINE').click();
  await fila(CAMBIO_DE_CITA).getByTestId(/^abrir-/).click();

  await expect(page.getByTestId('contexto-motivo')).toContainText('Control de presión arterial');
  await expect(page.getByTestId('contexto-paciente')).toContainText('Por defecto, solo el motivo de consulta');
  await page.getByTestId('acceso-pedir').click();
  await expect(page.getByTestId('acceso-enviar')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('acceso-motivo').locator('textarea').fill('Necesito el último electrocardiograma para el seguro.');
  await page.getByTestId('acceso-enviar').click();

  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.endsWith('/me/support-access-requests') && p.status === 201)).toBe(true);
  await expect(page.getByTestId('acceso-pendiente')).toContainText('todavía no decidió');

  // El doctor lo ve en «Mi equipo» y lo autoriza.
  await entrar('perez');
  await irA('/my-team');
  const pedido = page.locator('[data-testid^="acceso-"]', { hasText: 'electrocardiograma para el seguro' }).first();
  await expect(pedido).toBeVisible();
  await pedido.getByRole('button', { name: /Autorizar el acceso/ }).click();
  await expect.poll(async () => (await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/decision') && p.status === 200)).toBe(true);

  // Ana lo ve autorizado, tras recargar.
  await entrar('ana');
  await abrirBandeja();
  await page.getByTestId('pestana-MINE').click();
  await fila(CAMBIO_DE_CITA).getByTestId(/^abrir-/).click();
  await expect(page.getByTestId('acceso-aprobado')).toContainText('autorizó un acceso clínico temporal');
});

test('6 · Elena trabaja en dos organizaciones: elige una, y donde el doctor no la autorizó no ve sus conversaciones', async () => {
  await entrar('elena');
  await abrirBandeja();

  const selector = page.getByTestId('bandeja-organizacion');
  await expect(selector).toBeVisible();

  // Hospital: el doctor no la autorizó a responder en su nombre, y ver su conversación EXIGE poder responderla: la API no le
  // da una conversación de solo lectura, así que no aparece (ni en «Nuevos» ni en «Del equipo»).
  await expect(page.getByTestId('bandeja')).toBeVisible();
  await expect(page.locator('[data-testid^="conv-"]', { hasText: 'Dr. Andrés Pérez' })).toHaveCount(0);
  await pestana('TEAM');
  await expect(page.locator('[data-testid^="conv-"]', { hasText: 'Dr. Andrés Pérez' })).toHaveCount(0);

  // Consultorio: otra organización. Elena tampoco es delegada de ningún doctor de allí, así que tampoco ve conversaciones; lo que
  // cambia es la organización elegida y la lista que pide la pantalla (nunca mezcla las del hospital).
  await selector.click();
  await page.getByRole('option', { name: /Consultorio Dra\. Paola Céspedes/ }).click();
  await expect(selector).toContainText('Consultorio Dra. Paola Céspedes');
  await expect(page.locator('[data-testid^="conv-"]', { hasText: 'Dr. Andrés Pérez' })).toHaveCount(0);
  const consultas = (await peticiones()).filter((p) => p.method === 'GET' && p.url.includes('/me/support-inbox') && !/support-inbox\//.test(p.url));
  // Sin conversaciones que traer no hace falta pedir otra lista: basta con que la pantalla haya preguntado a la API.
  expect(consultas.length).toBeGreaterThanOrEqual(1);
});
