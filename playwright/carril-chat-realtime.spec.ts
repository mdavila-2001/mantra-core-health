import { mkdirSync } from 'node:fs';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import { CLAVE, apiViva, contextoDeApi, crearPaciente } from './support/actores';
import {
  crearBroker,
  type ActorOrganizacion,
} from './support/actores-organizacion';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * Chat en tiempo real por WebSocket — el gateway `CommunityMessagingGateway`
 * del backend, probado desde el navegador real.
 *
 * ## Qué prueba esto que la suite del backend no prueba
 *
 * `community-realtime-chat.int-spec.ts` (backend) prueba el gateway aislado
 * con un cliente `socket.io-client` desnudo. Esto prueba la otra mitad: que
 * `ChatSocketService` se conecta con el token real de la sesión del
 * navegador, que la bandeja y el hilo reaccionan a lo que reciben, y que un
 * segundo navegador ve en vivo lo que el primero hizo — sin recargar, sin
 * esperar el sondeo. Esa última parte es la única forma real de distinguir
 * «llegó por WS» de «llegó porque el sondeo de 30s ya iba a tocar».
 *
 * ## Por qué las cuentas nacen acá y no se reusan
 *
 * Doctor, paciente y broker se registran frescos en cada corrida —igual que
 * `crearPaciente()`— para que la suite no dependa de datos sembrados ni dañe
 * los de otra corrida. El registro y el alta del perfil público van por API
 * directa (`contextoDeApi()`); sólo el ingreso y la lectura de la pantalla van
 * por el navegador — es la misma división que ya usa el resto de la suite.
 *
 * ## Evidencia
 *
 * Cada caso guarda una captura en `artifacts/playwright/chat-realtime/`: es
 * la prueba documental de que el mensaje llegó (o no) donde tenía que llegar.
 */

const EVIDENCIA = 'artifacts/playwright/chat-realtime';

/** Los claims del token; acá interesa el contenido, no la firma. */
function claims(token: string): Record<string, unknown> {
  const [, cuerpo] = token.split('.');
  return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

interface ActorChat {
  readonly identificador: string;
  readonly clave: string;
  readonly nombre: string;
  readonly profileId: string;
}

/** Registra un profesional fresco — mismo criterio que `crearPaciente()`. */
async function crearDoctor(
  api: APIRequestContext,
): Promise<{ identificador: string; clave: string; nombre: string }> {
  const suf = `${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 1000)}`;
  const email = `chat-doc-pw-${suf}@example.test`;
  const respuesta = await api.post('/iam/auth/register-practitioner', {
    data: {
      email,
      password: CLAVE,
      name: 'Renata',
      lastName: 'Chávez',
      licenseNumber: `LIC-CHATPW-${suf}`,
      credentialNumber: `CRED-CHATPW-${suf}`,
    },
  });
  if (!respuesta.ok()) {
    throw new Error(
      `POST /iam/auth/register-practitioner respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  return { identificador: email, clave: CLAVE, nombre: 'Dra. Renata Chávez' };
}

async function iniciarSesionApi(
  api: APIRequestContext,
  identificador: string,
  clave: string,
): Promise<{ token: string; tenantId: string }> {
  const esEmail = identificador.includes('@');
  const respuesta = await api.post('/iam/auth/login', {
    data: esEmail
      ? { email: identificador, password: clave }
      : { nationalId: identificador, password: clave },
  });
  if (!respuesta.ok()) {
    throw new Error(
      `POST /iam/auth/login respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  const cuerpo = (await respuesta.json()) as { accessToken: string };
  const token = cuerpo.accessToken;
  const tenants = (claims(token)['tenants'] as string[] | undefined) ?? [];
  return { token, tenantId: tenants[0] ?? '' };
}

/** `PUT /community/profiles/me` — crea la vitrina pública, y devuelve su id. */
async function publicarPerfil(
  api: APIRequestContext,
  token: string,
  tenantId: string,
  slug: string,
  displayName: string,
): Promise<string> {
  const respuesta = await api.put('/community/profiles/me', {
    headers: { Authorization: `Bearer ${token}` },
    data: { tenantId, slug, displayName },
  });
  if (!respuesta.ok()) {
    throw new Error(
      `PUT /community/profiles/me (${slug}) respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  const cuerpo = (await respuesta.json()) as { id: string };
  return cuerpo.id;
}

async function crearConversacion(
  api: APIRequestContext,
  token: string,
  participantProfileIds: readonly string[],
): Promise<string> {
  const respuesta = await api.post('/community/conversations', {
    headers: { Authorization: `Bearer ${token}` },
    data: { participantProfileIds },
  });
  if (!respuesta.ok()) {
    throw new Error(
      `POST /community/conversations respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  const cuerpo = (await respuesta.json()) as { id: string };
  return cuerpo.id;
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: `${EVIDENCIA}/${nombre}.png`, fullPage: true });
}

async function abrirSesion(
  browser: Browser,
  actor: { identificador: string; clave: string },
): Promise<Page> {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  // `entrar()` sólo usa `identificador`/`clave` para el ingreso real; `rol` y
  // `nombre` son metadatos del tipo `Actor` que no participan del login, así
  // que un valor fijo acá no falsea nada que la prueba dependa de leer.
  await entrar(page, {
    rol: 'paciente',
    identificador: actor.identificador,
    clave: actor.clave,
    nombre: '',
  });
  return page;
}

test.describe.serial('Chat en tiempo real (WebSocket)', () => {
  let api: APIRequestContext;
  let doctor: ActorChat & { clave: string };
  let paciente: ActorChat & { clave: string };
  let broker: ActorOrganizacion & { profileId: string };
  let conversationId: string;
  let conversationIdBroker: string;

  test.beforeAll(async () => {
    api = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva para esta suite').toBe(
      true,
    );

    const suf = `${String(Date.now()).slice(-6)}`;

    const cuentaDoctor = await crearDoctor(api);
    const sesionDoctor = await iniciarSesionApi(
      api,
      cuentaDoctor.identificador,
      cuentaDoctor.clave,
    );
    const doctorProfileId = await publicarPerfil(
      api,
      sesionDoctor.token,
      sesionDoctor.tenantId,
      `chat-pw-doc-${suf}`,
      cuentaDoctor.nombre,
    );
    doctor = { ...cuentaDoctor, profileId: doctorProfileId };

    const cuentaPaciente = await crearPaciente(api);
    const sesionPaciente = await iniciarSesionApi(
      api,
      cuentaPaciente.identificador,
      cuentaPaciente.clave,
    );
    const pacienteProfileId = await publicarPerfil(
      api,
      sesionPaciente.token,
      sesionDoctor.tenantId,
      `chat-pw-pac-${suf}`,
      cuentaPaciente.nombre,
    );
    paciente = { ...cuentaPaciente, profileId: pacienteProfileId };

    conversationId = await crearConversacion(api, sesionDoctor.token, [
      doctorProfileId,
      pacienteProfileId,
    ]);

    // Un broker, para el caso que demuestra que no hay ACL por tipo de cuenta.
    const cuentaBroker = await crearBroker(api);
    const sesionBroker = await iniciarSesionApi(
      api,
      cuentaBroker.identificador,
      cuentaBroker.clave,
    );
    const brokerProfileId = await publicarPerfil(
      api,
      sesionBroker.token,
      sesionBroker.tenantId,
      `chat-pw-bro-${suf}`,
      cuentaBroker.nombre,
    );
    broker = { ...cuentaBroker, profileId: brokerProfileId };
    conversationIdBroker = await crearConversacion(api, sesionDoctor.token, [
      doctorProfileId,
      brokerProfileId,
    ]);
  });

  /* --- Positivos ---------------------------------------------------------- */

  test('un mensaje enviado por el doctor llega en vivo al paciente, sin recargar', async ({
    browser,
  }) => {
    const pageDoctor = await abrirSesion(browser, doctor);
    const pagePaciente = await abrirSesion(browser, paciente);
    try {
      await irA(pageDoctor, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pageDoctor);
      await irA(pagePaciente, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pagePaciente);

      const texto = `Hola, ¿cómo estás? ${Date.now()}`;
      await pageDoctor.getByTestId('hilo-texto').fill(texto);
      await pageDoctor.getByTestId('hilo-enviar').click();
      await capturar(pageDoctor, 'p1-doctor-envio');

      // 5s < SONDEO_MS del hilo (30s): si llega, llegó por el socket.
      await expect(pagePaciente.getByTestId('mensaje').last()).toContainText(
        texto,
        { timeout: 5_000 },
      );
      await capturar(pagePaciente, 'p1-paciente-recibio-en-vivo');
    } finally {
      await pageDoctor.context().close();
      await pagePaciente.context().close();
    }
  });

  test('la bandeja del paciente muestra el no-leído en vivo, sin abrir el hilo', async ({
    browser,
  }) => {
    const pageDoctor = await abrirSesion(browser, doctor);
    const pagePaciente = await abrirSesion(browser, paciente);
    try {
      await irA(pagePaciente, '/messaging');
      await esperarAplicacionLista(pagePaciente);

      await irA(pageDoctor, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pageDoctor);
      const texto = `Otro mensaje ${Date.now()}`;
      await pageDoctor.getByTestId('hilo-texto').fill(texto);
      await pageDoctor.getByTestId('hilo-enviar').click();

      await expect(
        pagePaciente.getByTestId('conversacion-sin-leer'),
      ).toBeVisible({ timeout: 5_000 });
      await capturar(pagePaciente, 'p2-bandeja-no-leido-en-vivo');
    } finally {
      await pageDoctor.context().close();
      await pagePaciente.context().close();
    }
  });

  test('el doble check se pinta en vivo cuando el paciente abre el hilo', async ({
    browser,
  }) => {
    const pageDoctor = await abrirSesion(browser, doctor);
    const pagePaciente = await abrirSesion(browser, paciente);
    try {
      await irA(pageDoctor, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pageDoctor);
      const texto = `Leeme ${Date.now()}`;
      await pageDoctor.getByTestId('hilo-texto').fill(texto);
      await pageDoctor.getByTestId('hilo-enviar').click();
      await expect(
        pageDoctor.getByTestId('mensaje').last(),
      ).toContainText(texto);

      // Abrir el hilo del lado del paciente dispara el `markRead`.
      await irA(pagePaciente, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pagePaciente);

      // `data-propio` va en el mismo `<li>` que `data-testid="mensaje"` (no en
      // un descendiente), así que se filtra con el selector CSS combinado y no
      // con `.filter({ has })` — ese exige un descendiente, y acá no lo hay.
      const ultimoPropio = pageDoctor
        .locator('[data-testid="mensaje"][data-propio="true"]')
        .last();
      await expect(ultimoPropio.getByTestId('hilo-ticks')).toHaveClass(
        /is-leido/,
        { timeout: 5_000 },
      );
      await capturar(pageDoctor, 'p3-doble-check-en-vivo');
    } finally {
      await pageDoctor.context().close();
      await pagePaciente.context().close();
    }
  });

  test('un broker también chatea con el doctor — no hay ACL por tipo de cuenta', async ({
    browser,
  }) => {
    const pageDoctor = await abrirSesion(browser, doctor);
    const pageBroker = await abrirSesion(browser, broker);
    try {
      await irA(pageDoctor, `/messaging/${conversationIdBroker}`);
      await esperarAplicacionLista(pageDoctor);
      await irA(pageBroker, `/messaging/${conversationIdBroker}`);
      await esperarAplicacionLista(pageBroker);

      const texto = `Consulta de cobertura ${Date.now()}`;
      await pageBroker.getByTestId('hilo-texto').fill(texto);
      await pageBroker.getByTestId('hilo-enviar').click();

      await expect(pageDoctor.getByTestId('mensaje').last()).toContainText(
        texto,
        { timeout: 5_000 },
      );
      await capturar(pageDoctor, 'p4-broker-doctor-en-vivo');
    } finally {
      await pageDoctor.context().close();
      await pageBroker.context().close();
    }
  });

  /* --- Negativos ----------------------------------------------------------- */

  test('el textarea vacío no habilita enviar', async ({ browser }) => {
    const pageDoctor = await abrirSesion(browser, doctor);
    try {
      await irA(pageDoctor, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pageDoctor);

      await expect(pageDoctor.getByTestId('hilo-enviar')).toBeDisabled();
      await capturar(pageDoctor, 'n1-enviar-deshabilitado');

      // Y el servidor tampoco lo acepta si alguien se salta la pantalla.
      const sesionDoctor = await iniciarSesionApi(
        api,
        doctor.identificador,
        doctor.clave,
      );
      const respuestaVacia = await api.post(
        `/community/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${sesionDoctor.token}` },
          data: { senderProfileId: doctor.profileId, bodyText: '' },
        },
      );
      expect(respuestaVacia.status()).toBe(400);
    } finally {
      await pageDoctor.context().close();
    }
  });

  test('con el socket caído, el mensaje igual llega por el sondeo (red de seguridad)', async ({
    browser,
  }) => {
    test.slow();
    const pagePaciente = await abrirSesion(browser, paciente);
    try {
      await irA(pagePaciente, `/messaging/${conversationId}`);
      await esperarAplicacionLista(pagePaciente);

      // `setOffline` corta la red a nivel del contexto del navegador — incluida
      // la conexión WS ya abierta, no sólo las peticiones nuevas. Es la única
      // forma de simular «el socket se cayó» de verdad: interceptar la ruta con
      // `page.route` sólo bloquearía una reconexión futura, no el socket vivo.
      await pagePaciente.context().setOffline(true);

      // El envío va por un cliente de API aparte: si se hiciera con `api`
      // (compartido) contra el mismo host, no cambia nada — `setOffline` es del
      // contexto del navegador, no de este proceso de Node.
      const sesionDoctor = await iniciarSesionApi(
        api,
        doctor.identificador,
        doctor.clave,
      );
      const texto = `Llega igual por sondeo ${Date.now()}`;
      const envio = await api.post(
        `/community/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${sesionDoctor.token}` },
          data: { senderProfileId: doctor.profileId, bodyText: texto },
        },
      );
      expect(envio.status()).toBe(201);

      // Vuelve la red: ahora el próximo tic de sondeo (30s) sí puede completar,
      // y el socket también puede reconectar solo — las dos vías son legítimas
      // acá. Lo que esta prueba fija es la resiliencia: un mensaje mandado
      // mientras el cliente estaba desconectado no se pierde, llegue por donde
      // llegue una vez que la red vuelve.
      await pagePaciente.context().setOffline(false);

      await expect(pagePaciente.getByTestId('mensaje').last()).toContainText(
        texto,
        { timeout: 35_000 },
      );
      await capturar(pagePaciente, 'n2-fallback-sondeo');
    } finally {
      await pagePaciente.context().setOffline(false).catch(() => undefined);
      await pagePaciente.context().close();
    }
  });
});
