import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-14 — agendar una cita sin pasar por el calendario.
 *
 * Precondición: un profesional con **agenda publicada** y pacientes con los
 * que agendar. Los deja `node tools/alovida/seed-dev-data.mjs` en el
 * repositorio de la API.
 *
 * Lo que esta suite **no** puede afirmar, y hay que decirlo: AC-14-10 (la
 * prueba de concurrencia de H-1) y AC-14-12 (que todo ocurra en una
 * transacción) no se miden desde el navegador. La primera necesita dos
 * peticiones en paralelo y contar filas; la segunda, forzar el fallo del
 * segundo paso. Son pruebas de la API y van con ella.
 *
 * AC-14-7 y AC-14-9 sí se miden acá: se crea una cita de verdad sobre un
 * cupo libre real (descubierto por API, para no adivinar el calendario) y
 * después se intenta otra que la pisa. Lo que **no** miden es «nada se
 * crea» a nivel de fila — eso también es de la API; acá se infiere de que
 * la pantalla no navega y el 422 queda mostrado.
 */

const ALTA = '/schedule/appointment/new';
const MI_AGENDA = '/schedule/mine';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API no responde en ${urlDeApi()}. Levantala y sembrá con ` +
      '`node tools/alovida/seed-dev-data.mjs`.',
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Entra como profesional y abre el alta.
 *
 * @param page - La página de la prueba.
 */
/**
 * El `<input>` real de un campo del sistema.
 *
 * El `data-testid` queda en el host `<app-input>`, que no es un campo: para
 * escribir hay que bajar al elemento nativo que proyecta adentro.
 *
 * @param page - La página.
 * @param testId - Identificador del campo.
 * @returns El localizador del `<input>`.
 */
function campo(page: Page, testId: string) {
  return page.getByTestId(testId).locator('input');
}

async function abrirAlta(page: Page): Promise<void> {
  await entrar(page, doctora());
  await irA(page, ALTA);
  await estable(page);
}

test('AC-14-1 · se llega desde la agenda, sin pasar por el calendario', async ({
  page,
}) => {
  await entrar(page, doctora());
  await irA(page, MI_AGENDA);
  await estable(page);

  const entrada = page.getByTestId('agendar-cita');
  await expect(entrada).toBeVisible();
  await entrada.click();

  // La dirección es propia: se puede compartir y volver a ella. Hasta acá la
  // única forma de crear una cita era encontrar el día y tocar el rato.
  await expect(page).toHaveURL(new RegExp(`${ALTA}$`));
});

test('AC-14-2 · el doctor no se elige: no hay campo de profesional', async ({
  page,
}) => {
  await abrirAlta(page);

  // Verificable en el DOM, que es como lo pide el criterio. La cita nace en la
  // agenda de quien tiene la sesión; el servidor impone lo mismo, así que la
  // ausencia del campo es la consecuencia, no la barrera.
  const etiquetas = (await page.locator('form').textContent()) ?? '';
  expect(etiquetas).not.toMatch(/profesional|m[ée]dico|doctor[a]?\b/i);

  await expect(page.getByTestId('cita-profesional')).toHaveCount(0);
});

test('AC-14-4 · pide paciente, día, hora, duración, modalidad y motivo', async ({
  page,
}) => {
  await abrirAlta(page);

  await expect(page.getByTestId('cita-paciente')).toBeVisible();
  // El día usa el organismo del sistema, no un `<input type="date">`: se
  // comprueba que esté, no que sea un campo de texto.
  await expect(page.getByTestId('cita-fecha')).toBeVisible();
  await expect(page.getByTestId('cita-hora')).toBeVisible();
  await expect(page.getByTestId('cita-duracion')).toBeVisible();
  await expect(page.getByTestId('cita-motivo')).toBeVisible();

  // Las tres modalidades del value set, y sólo esas tres: van en un select.
  const modalidades = page.getByTestId('cita-modalidad').locator('option:not([disabled])');
  await expect(modalidades).toHaveCount(3);

  // La duración se elige de los atajos: ya no hay campo de minutos libres.
  await expect(page.getByTestId('cita-duracion-libre')).toHaveCount(0);
});

test('AC-14-5 · con una sola agenda no pregunta cuál', async ({ page }) => {
  await abrirAlta(page);

  const selector = page.getByTestId('cita-agenda');
  const agendas = await selector.count();

  // Un select de una sola opción es una decisión que no existe. Con dos sedes
  // sí aparece, y elegirla ES elegir la sede.
  if (agendas === 1) {
    const opciones = await selector.locator('option').count();
    expect(opciones).toBeGreaterThan(1);
  } else {
    expect(agendas).toBe(0);
  }
});

test('AC-14-6 · la modalidad arranca en presencial y se puede cambiar', async ({
  page,
}) => {
  await abrirAlta(page);

  const presencial = page.locator('input[name="modalidad"][value="PRESENCIAL"]');
  await expect(presencial).toBeChecked();

  const video = page.locator('input[name="modalidad"][value="TELECONSULTA"]');
  await video.check();
  await expect(video).toBeChecked();
});

test('no deja agendar sin paciente ni sin cuándo', async ({ page }) => {
  await abrirAlta(page);

  // El botón apagado dice que falta algo antes de que alguien lo apriete y
  // reciba un 400 que no provocó a propósito.
  await expect(page.getByTestId('cita-guardar')).toBeDisabled();

  await campo(page, 'cita-hora').fill('09:00');
  // Con la hora puesta y sin paciente sigue apagado: una cita sin paciente no
  // es una cita, es un rato ocupado, y eso se crea en otra pantalla.
  await expect(page.getByTestId('cita-guardar')).toBeDisabled();
});

/**
 * Decodifica el JWT lo justo para esta prueba: el tenant y el perfil
 * profesional, los mismos claims que lee `SessionStore` (`tenants` y `hpid`).
 * No hay `/iam/me`: todo lo que la interfaz sabe de quien entró sale del
 * propio token, y esta prueba lee la misma fuente.
 */
function decodificarToken(token: string): { tenantId: string; practitionerProfileId: string } {
  const cuerpo = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
  const json = JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as { tenants?: string[]; hpid?: string };
  const [tenantId] = json.tenants ?? [];
  if (tenantId === undefined || json.hpid === undefined) {
    throw new Error('El token de la doctora no trae tenant ni perfil profesional.');
  }
  return { tenantId, practitionerProfileId: json.hpid };
}

/**
 * Un cupo libre publicado de la doctora, dentro de lo que el sembrado
 * realmente generó.
 *
 * Se busca por API, no adivinando el calendario: la pantalla no ofrece
 * cupos, así que sin esto la prueba tendría que apostar a una hora de
 * oficina y podría chocar con un turno ya reservado por el sembrado.
 *
 * La ventana **no** se abre a semanas: `node tools/alovida/seed-dev-data.mjs`
 * generó los cupos de esta agenda sólo para los próximos ~13 días (medido
 * contra la API viva el 2026-09-03: el último cupo cae el 16/09). Empezar en
 * `+14 días` —como parecía prudente para alejarse de la regla de
 * anticipación mínima de 60 minutos— caía siempre **después** del último
 * cupo sembrado y la búsqueda no encontraba nada. Se empieza **mañana** —un
 * día futuro, como pide la ficha, y de sobra por encima del mínimo de 60
 * minutos— y se recorren doce días, dentro de lo sembrado sin pisar su
 * límite exacto.
 */
async function cupoLibreFuturo(
  api: APIRequestContext,
  resourceId: string,
  auth: Record<string, string>,
): Promise<{ startAt: string; durationMinutes: number }> {
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() + 1);
  const hasta = new Date();
  hasta.setUTCDate(hasta.getUTCDate() + 12);

  const respuesta = await api.get(
    `/scheduling/slots?resourceId=${resourceId}&from=${desde.toISOString()}` +
      `&to=${hasta.toISOString()}&onlyAvailable=true&limit=1`,
    { headers: auth },
  );
  expect(respuesta.ok(), `GET /scheduling/slots: ${await respuesta.text()}`).toBe(true);
  const cuerpo = (await respuesta.json()) as { items?: { startAt: string; endAt: string }[] };
  const cupo = cuerpo.items?.[0];
  if (cupo === undefined) {
    throw new Error(
      'La doctora no tiene cupos libres publicados entre mañana y los próximos doce días: ' +
        'no se puede medir AC-14-9. Sembrá con node tools/alovida/seed-dev-data.mjs.',
    );
  }
  const durationMinutes = Math.round(
    (new Date(cupo.endAt).getTime() - new Date(cupo.startAt).getTime()) / 60_000,
  );
  return { startAt: cupo.startAt, durationMinutes };
}

/** `2026-10-15T14:00:00.000Z` → `{ fecha: '15/10/2026', hora: '14:00' }`, en el reloj de La Paz. */
function enLaPaz(iso: string): { fecha: string; hora: string } {
  const formato = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = Object.fromEntries(
    formato.formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]),
  );
  return { fecha: `${partes['day']}/${partes['month']}/${partes['year']}`, hora: `${partes['hour']}:${partes['minute']}` };
}

/**
 * Escribe la fecha en el campo enmascarado.
 *
 * ## Los dos caminos que se probaron y no sirvieron
 *
 * 1. **Tecleo dígito a dígito** (`pressSequentially`, y hasta un
 *    `KeyboardEvent('keydown')` disparado a mano sobre
 *    `document.activeElement`): el valor nunca se movió de `DD/MM/AAAA`. El
 *    campo SÍ tiene foco (el `(focus)` del componente corrió: por eso ya
 *    dice `DD/MM/AAAA` y no queda vacío) pero ningún `keydown` —ni el
 *    sintético de Playwright ni uno despachado a mano— movió la aguja.
 * 2. **El calendario por clics**, para no depender del tecleo: sin fecha
 *    elegida el diálogo abre en **enero de 2000**
 *    (`MAX_DEFAULT_YEAR` en `date-picker.ts:773`, pensado para un selector de
 *    fecha de nacimiento, no para agendar). Subir al selector de año/mes
 *    para saltar de 2000 a 2026 debería alcanzar, pero el clic sobre la
 *    celda del año se quedó esperando el techo entero de 180 s dos veces
 *    seguidas — con esta cantidad de agentes corriendo Playwright al mismo
 *    tiempo contra el mismo `ng serve`, no se pudo distinguir si es un
 *    defecto del componente o el costo de la cola compartida.
 *
 * ## Lo que sí funciona
 *
 * `handleTextInput` del componente ya contempla que el texto llegue
 * **completo y formateado** de una vez —es el camino que usa para
 * autocompletar del navegador—: si el valor tiene exactamente 10
 * caracteres y no le quedan letras de la máscara (`D`, `M`, `A`), lo
 * parsea entero. `locator.fill()` no alcanza porque de camino hace foco
 * -y el foco reescribe el campo a `DD/MM/AAAA`- antes de escribir, y el
 * resultado quedaba concatenado (`07/09/2026DD/MM/AAAA`). Se evita el
 * problema escribiendo el valor con el setter nativo y disparando el mismo
 * evento `input` que dispararía un pegado, sin pasar por el foco.
 */
async function elegirFecha(page: Page, iso: string): Promise<void> {
  const { fecha } = enLaPaz(iso);
  const input = campo(page, 'cita-fecha');
  await input.evaluate((el: HTMLInputElement, valor: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, fecha);
  await expect(input).toHaveValue(fecha);
}

/**
 * Busca un paciente y elige una opción del listbox.
 *
 * @param evitarEtiqueta - Si se da, elige la primera opción **distinta** de
 * esta etiqueta. Sirve para armar dos citas con dos pacientes distintos y no
 * disparar por accidente el choque del paciente (AC-14-8) en vez del choque
 * del profesional (AC-14-7).
 */
async function elegirPaciente(
  page: Page,
  consulta: string,
  evitarEtiqueta?: string,
): Promise<string> {
  await campo(page, 'cita-paciente').fill(consulta);
  const opciones = page.locator('[role="option"]');
  await expect(opciones.first()).toBeVisible({ timeout: 10_000 });

  let elegida = opciones.first();
  if (evitarEtiqueta !== undefined) {
    const total = await opciones.count();
    for (let i = 0; i < total; i++) {
      const texto = ((await opciones.nth(i).textContent()) ?? '').trim();
      if (texto !== evitarEtiqueta && texto !== '') {
        elegida = opciones.nth(i);
        break;
      }
    }
  }
  const etiqueta = ((await elegida.textContent()) ?? '').trim();
  await elegida.click();
  return etiqueta;
}

test('AC-14-7 y AC-14-9 · el choque del profesional y la retracción de cupos, tal como responde el servidor', async ({
  page,
}) => {
  // 1 · Un cupo libre real de la doctora, para que la cita que crea lo pise
  // sin que la prueba tenga que adivinar el calendario.
  const sesion = await api.post('/iam/auth/login', {
    data: { email: doctora().identificador, password: doctora().clave },
  });
  expect(sesion.ok(), `login de la doctora por API: ${await sesion.text()}`).toBe(true);
  const { accessToken } = (await sesion.json()) as { accessToken: string };
  const auth = { Authorization: `Bearer ${accessToken}` };
  const { tenantId, practitionerProfileId } = decodificarToken(accessToken);

  const recursos = await api.get(`/scheduling/resources?tenantId=${tenantId}`, { headers: auth });
  expect(recursos.ok(), `GET /scheduling/resources: ${await recursos.text()}`).toBe(true);
  const { items: agendas } = (await recursos.json()) as {
    items: { id: string; resourceRefId: string }[];
  };
  const agenda = agendas.find((item) => item.resourceRefId === practitionerProfileId);
  expect(agenda, 'la doctora no tiene ninguna agenda publicada').toBeDefined();

  const cupo = await cupoLibreFuturo(api, agenda!.id, auth);
  const { hora } = enLaPaz(cupo.startAt);

  // 2 · La primera cita se crea sobre ese cupo: tiene que retirarlo y decir
  // cuántos (AC-14-9).
  await abrirAlta(page);
  const pacienteA = await elegirPaciente(page, 'a');
  await elegirFecha(page, cupo.startAt);
  await campo(page, 'cita-hora').fill(hora);
  await page.getByTestId('cita-duracion').locator('select').selectOption(String(cupo.durationMinutes));

  const [respuestaA] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes('/scheduling/appointments/direct') && res.request().method() === 'POST',
    ),
    page.getByTestId('cita-guardar').click(),
  ]);
  expect(respuestaA.status(), await respuestaA.text()).toBe(201);
  const creadaA = (await respuestaA.json()) as { retractedSlots: number };

  // AC-14-9 · la respuesta dice cuántos cupos libres retiró...
  expect(
    creadaA.retractedSlots,
    'la cita nació sobre un cupo publicado: tenía que retirar al menos uno',
  ).toBeGreaterThan(0);

  // ...y la pantalla lo informa, con el número que mandó el servidor.
  await expect(page).toHaveURL(new RegExp(`${MI_AGENDA}$`));
  const toast = page.getByTestId('toast-mensaje');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(String(creadaA.retractedSlots));
  await expect(toast).toContainText(
    creadaA.retractedSlots === 1 ? 'horario disponible' : 'horarios disponibles',
  );

  // 3 · Una segunda cita, mismo rato, mismo profesional ya comprometido: 422
  // con qué, cuándo y dónde — mostrado tal cual (AC-14-7). Otro paciente,
  // para que el choque sea el del profesional y no el del paciente (AC-14-8).
  await irA(page, ALTA);
  await estable(page);
  await elegirPaciente(page, 'e', pacienteA);
  await elegirFecha(page, cupo.startAt);
  await campo(page, 'cita-hora').fill(hora);
  await page.getByTestId('cita-duracion').locator('select').selectOption(String(cupo.durationMinutes));

  const [respuestaB] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes('/scheduling/appointments/direct') && res.request().method() === 'POST',
    ),
    page.getByTestId('cita-guardar').click(),
  ]);
  expect(respuestaB.status(), 'el rato ya está comprometido: tiene que responder 422').toBe(422);
  const fallo = (await respuestaB.json()) as { message: string };

  // El mensaje del servidor, mostrado tal cual — no el genérico de reserva.
  const alerta = page.getByTestId('cita-error');
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText(fallo.message);

  // Nada se crea: la pantalla no navega, sigue siendo el formulario y deja
  // reintentar.
  await expect(page).toHaveURL(new RegExp(`${ALTA}$`));
  await expect(page.getByTestId('cita-guardar')).toBeEnabled();

  // El estado de error, en los tres anchos obligatorios: es el único que
  // nadie había mirado todavía.
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.screenshot({
      path: `artifacts/playwright/tarea-14-auditoria/error-422-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  }
});

for (const viewport of VIEWPORTS) {
  test(`AC-14-14 · sin scroll horizontal en ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await abrirAlta(page);

    const desborde = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(desborde, 'el alta de cita desborda a lo ancho').toBe(false);

    await page.screenshot({
      path: `artifacts/playwright/tarea-14/alta-${viewport.nombre}.png`,
      fullPage: true,
    });
  });
}
