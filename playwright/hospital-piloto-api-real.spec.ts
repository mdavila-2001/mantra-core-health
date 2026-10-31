import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

/**
 * Los casos del **hospital piloto** (`CONTRATO.md`) recorridos con el front **contra la API real**, sin simulador.
 *
 * Qué se necesita (no se levanta desde acá):
 *
 * - la API real con la base del modelo y `salud-db/demo/04-hospital-piloto.sql` (cuentas `DEMO-<NOMBRE-APELLIDO>`, contraseña
 *   `Demo-Apoyo-2026`), más los datos de agenda de `E2E_REAL_SEED` (agendas, cupos y citas del piloto);
 * - el front compilado con `--configuration real-api` (modo desarrollo: usa `window.ng`) servido con proxy a esa API;
 * - `E2E_BASE_URL` apuntando a ese servidor y `E2E_REAL_DB` con los datos de conexión para leer cupos y citas
 *   (`host:puerto:usuario:base`).
 *
 * Todo lo que ve la persona sale de las pantallas del front. Cuando una acción no tiene pantalla —el personal de apoyo no puede
 * listar cupos libres en la API— se llama al **mismo cliente del front** (`SchedulingClient` del ejecutor de la agenda), con la
 * sesión real, y se mira lo que contesta la API. Son seriales y comparten pestaña.
 */
// Cada caso entra por su cuenta (no dependen unos de otros), pero comparten pestaña y corren de a uno.
test.describe.configure({ mode: 'default' });

const CONTRASENA = 'Demo-Apoyo-2026';
const [HOST, PUERTO, USUARIO, BASE] = (
  process.env['E2E_REAL_DB'] ?? '127.0.0.1:5494:mantra:salud_real'
).split(':');

let page: Page;
let portador = '';

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext();
  page = await contexto.newPage();
  // La sesión real: el `Authorization` de lo último que mandó el front, para repetir una petición con su misma identidad.
  page.on('request', (r) => {
    const a = r.headers()['authorization'];
    if (a !== undefined) portador = a;
  });
});

test.afterAll(async () => {
  await page.context().close();
});

/** Consulta la base del piloto (qué cupo o cita usar) y la restablece entre corridas; no la usa el front, solo la prueba. */
function consulta(sql: string): string[][] {
  const salida = execFileSync(
    'psql',
    ['-h', HOST!, '-p', PUERTO!, '-U', USUARIO!, '-d', BASE!, '-At', '-F', '|', '-c', sql],
    {
      env: { ...process.env, PGPASSWORD: process.env['E2E_REAL_DB_PASSWORD'] ?? 'mantra' },
      encoding: 'utf8',
    },
  );
  return salida
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => l.split('|'));
}

/** El hospital piloto (se lee de la base cada vez: un caso que falla reinicia el proceso y no deja variables). */
const hospitalId = (): string =>
  consulta(`select id from directory.tenants where code='DEMO_HOSPITAL_PILOTO'`)[0]![0]!;

/** El cupo libre de un doctor en un espacio (el más lejano: no choca con las citas sembradas). */
function cupoLibre(doctor: string, espacio: string, nth = 0): { slotId: string } {
  const [fila] = consulta(
    `select s.id from scheduling.bookable_slots s join scheduling.schedulable_resources r on r.id=s.resource_id join profiles.persons p on p.id=r.resource_ref_id join practice.care_spaces cs on cs.id=s.care_space_id where p.display_name='${doctor}' and cs.code='${espacio}' and s.remaining_capacity>0 order by s.start_at desc offset ${nth} limit 1`,
  );
  if (fila === undefined) throw new Error(`Sin cupo libre de ${doctor} en ${espacio}`);
  return { slotId: fila[0]! };
}

function citaDe(doctor: string, espacio: string): { bookingId: string; patientProfileId: string } {
  const [fila] = consulta(
    `select b.id, b.patient_profile_id from scheduling.appointment_bookings b join scheduling.schedulable_resources r on r.id=b.resource_id join profiles.persons p on p.id=r.resource_ref_id join practice.care_spaces cs on cs.id=b.care_space_id where p.display_name='${doctor}' and cs.code='${espacio}' order by b.created_at limit 1`,
  );
  if (fila === undefined) throw new Error(`Sin cita de ${doctor} en ${espacio}`);
  return { bookingId: fila[0]!, patientProfileId: fila[1]! };
}

/** Las citas con las que arrancó la corrida (las 7 de 09 y las 13 de 07), para dejarlas tal cual al restablecer. */
let citasDeArranque: string[][] = [];

/**
 * Deja la agenda como estaba al arrancar esta corrida: las citas del demo (las 7 del piloto de 09 y las 13 del gobierno de 07) con su
 * estado de origen, y sin las que crearon los casos. Los cupos que ya no tienen cita vuelven a quedar libres.
 */
function restablecerAgenda(): void {
  const originales = citasDeArranque.map(([id]) => `'${id}'`).join(',');
  consulta(`delete from scheduling.appointment_bookings where id not in (${originales})`);
  for (const [id, estado, llegada] of citasDeArranque) {
    consulta(
      `update scheduling.appointment_bookings set status_concept_id='${estado}', checked_in_at=${llegada === '' ? 'null' : `'${llegada}'`} where id='${id}'`,
    );
  }
  consulta(
    `update scheduling.bookable_slots set remaining_capacity=1, status_concept_id=(select id from terminology.catalog_concepts where code='SLOT_OPEN') where id not in (select bookable_slot_id from scheduling.appointment_bookings)`,
  );
}

/** Un paciente del piloto, el n-ésimo: cada caso usa uno distinto para no chocar con «ya tiene una cita a esa hora». */
function paciente(n: number): string {
  return consulta(
    `select distinct patient_profile_id from scheduling.appointment_bookings order by 1`,
  )[n % 4]![0]!;
}

async function entrar(documento: string): Promise<void> {
  await page.goto('/auth');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(documento);
  await page.getByTestId('login-password').fill(CONTRASENA);
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
}

async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(ruta.split('?')[0]!.replace(/[/]/g, '\\/')));
}

const CITAS_DEL_PILOTO = [
  'ad2802c8-fc2d-54d5-a072-9a8a3da0ccc3',
  'be06936b-9b9c-5b2f-9263-3e412b78814b',
  'c18c36b7-0bc8-5f13-8ee6-016da561c9a1',
  'a07f9a9c-e823-55b2-9703-a4ee7cf4cb71',
  '5ffec7ee-07ca-5ab1-b111-c68ce4ce6094',
  'f435ea2d-de4b-5d87-abb4-8a46563ddde5',
  'c1e0a65d-4437-575c-b808-6b2d9732c044',
] as const;
const EN_LISTA = CITAS_DEL_PILOTO.map((id) => `'${id}'`).join(',');

/**
 * El lunes de la semana donde caen las citas sembradas. El demo trae fechas ABSOLUTAS (miércoles 2026-11-04 a viernes 2026-11-06), así
 * que «esta semana» del reloj real no las muestra: se lee de la base cuál es la semana del piloto.
 */
const lunes = (): string => {
  const [fila] = consulta(
    `select to_char((min(s.start_at) at time zone 'America/La_Paz')::date, 'YYYY-MM-DD') from scheduling.appointment_bookings b join scheduling.bookable_slots s on s.id=b.bookable_slot_id where b.id in (${EN_LISTA})`,
  );
  const [a, m, d] = (fila?.[0] ?? new Date().toISOString().slice(0, 10)).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const dia = new Date(Date.UTC(a, m - 1, d));
  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
  return dia.toISOString().slice(0, 10);
};

async function abrirAgenda(): Promise<void> {
  await irA(`/combined-agenda?vista=semana&fecha=${lunes()}`);
  await expect(page.getByTestId('agenda-titulo')).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByTestId('agenda-grilla')
      .or(page.getByTestId('agenda-linea'))
      .or(page.getByTestId('agenda-sin-horarios')),
  ).toBeVisible({ timeout: 30_000 });
}

interface Resultado {
  readonly ok: boolean;
  readonly status?: number;
  readonly mensaje?: string;
  readonly reason?: string;
  readonly valor?: unknown;
}

/**
 * Llama a un método del **cliente de agenda del front** (el del ejecutor de acciones de la agenda combinada) con la sesión real.
 * Devuelve el estado HTTP y el motivo que contestó la API.
 */
async function conElCliente(
  cliente: 'scheduling' | 'support',
  metodo: string,
  ...args: unknown[]
): Promise<Resultado> {
  return page.evaluate(
    async ({ cliente, metodo, args }) => {
      type Llamable = Record<
        string,
        (...a: unknown[]) => {
          subscribe: (o: { next: (v: unknown) => void; error: (e: unknown) => void }) => void;
        }
      >;
      const ng = (
        window as unknown as {
          ng: {
            getComponent: (el: Element) => { runner: { scheduling: Llamable }; support: Llamable };
          };
        }
      ).ng;
      const agenda = ng.getComponent(document.querySelector('app-combined-agenda')!);
      const objetivo: Llamable =
        cliente === 'scheduling' ? agenda.runner.scheduling : agenda.support;
      return new Promise<Resultado>((resolver) => {
        objetivo[metodo]!(...args).subscribe({
          next: (valor: unknown) => resolver({ ok: true, valor }),
          error: (fallo: unknown) => {
            const e = fallo as {
              status?: number;
              error?: { message?: string; details?: { reason?: string }; reason?: string };
            };
            resolver({
              ok: false,
              status: e.status,
              mensaje: e.error?.message,
              reason: e.error?.details?.reason ?? e.error?.reason,
            });
          },
        });
      });
    },
    { cliente, metodo, args },
  );
}

/** Una petición con la sesión de quien está dentro, por el mismo origen que usa el front (proxy a la API real). */
async function api(
  metodo: 'GET' | 'POST',
  ruta: string,
  cuerpo?: unknown,
): Promise<{ status: number; body: unknown }> {
  const r = await page.request.fetch(ruta, {
    method: metodo,
    headers: { authorization: portador, 'content-type': 'application/json' },
    ...(cuerpo === undefined ? {} : { data: cuerpo }),
  });
  const texto = await r.text();
  let body: unknown = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* no era JSON */
  }
  return { status: r.status(), body };
}

/** «Crear una cita» como la hace la pantalla: retener el cupo y confirmarlo. */
async function crearCita(slotId: string, paciente: string): Promise<Resultado> {
  const retenido = await conElCliente('scheduling', 'placeHold', slotId, {
    patientProfileId: paciente,
  });
  if (!retenido.ok) return retenido;
  const { holdToken } = retenido.valor as { holdToken: string };
  return conElCliente('scheduling', 'confirmHold', holdToken, {
    tenantId: hospitalId(),
    patientProfileId: paciente,
    channel: 'DESK',
    reasonText: 'Caso del hospital piloto',
  });
}

test('00 · el piloto está sembrado y el hospital se lee del token', async () => {
  expect(
    consulta(
      `select count(*) from scheduling.appointment_bookings where id in (${EN_LISTA})`,
    )[0]![0],
  ).toBe('7');
  citasDeArranque = consulta(
    `select id, status_concept_id, coalesce(checked_in_at::text,'') from scheduling.appointment_bookings`,
  );
  await entrar('DEMO-ANA-GUTIERREZ');
  expect(hospitalId()).toMatch(/^[0-9a-f-]{36}$/);
  restablecerAgenda();
});

test('01 · Ana crea una cita con Pérez en consulta externa (A-P1): permitido', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await abrirAgenda();
  const r = await crearCita(cupoLibre('Andrés Pérez', 'DEMO_A_103').slotId, paciente(0));
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
});

test('02 · Ana agenda a Pérez en el piso 2 (A-P2): permitido', async () => {
  const r = await crearCita(cupoLibre('Andrés Pérez', 'DEMO_A_201', 1).slotId, paciente(1));
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
});

test('03 · Lucía registra la llegada de un paciente de Méndez en el 105: permitido, y desde la pantalla', async () => {
  await entrar('DEMO-LUCIA-PAZ');
  await abrirAgenda();
  const cita = citaDe('Carla Méndez', 'DEMO_A_105');
  const fila = page.getByTestId(`item-${cita.bookingId}`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.click();
  await page.getByTestId('agenda-registrar-llegada').click();
  await expect
    .poll(
      async () =>
        consulta(
          `select status_concept_id=(select id from terminology.catalog_concepts where code='BOOKING_CHECKED_IN') from scheduling.appointment_bookings where id='${cita.bookingId}'`,
        )[0]![0],
    )
    .toBe('t');
});

test('04 · Lucía intenta registrar una llegada en internación (A-P4): negado, y la cita ni aparece', async () => {
  await entrar('DEMO-LUCIA-PAZ');
  await abrirAgenda();
  const cita = citaDe('Carla Méndez', 'DEMO_A_P4');
  await expect(page.getByTestId(`item-${cita.bookingId}`)).toHaveCount(0);
  const r = await conElCliente('scheduling', 'checkInBooking', cita.bookingId);
  expect(r).toMatchObject({ ok: false, status: 403 });
});

test('05 · Lucía crea una cita con Pérez en consulta: negado (su plantilla no incluye crear)', async () => {
  await entrar('DEMO-LUCIA-PAZ');
  await abrirAgenda();
  await expect(page.getByTestId('agenda-crear-cita')).toHaveCount(0);
  const r = await crearCita(cupoLibre('Andrés Pérez', 'DEMO_A_103').slotId, paciente(2));
  expect(r).toMatchObject({ ok: false, status: 403 });
});

test('06 · Marcos agenda una ecografía con Antelo en la sala 201: permitido', async () => {
  await entrar('DEMO-MARCOS-RIBERA');
  await abrirAgenda();
  const r = await crearCita(cupoLibre('Lucía Antelo', 'DEMO_A_201').slotId, paciente(1));
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
});

test('07 · Marcos agenda eco obstétrica con Rojas en B204: negado', async () => {
  await entrar('DEMO-MARCOS-RIBERA');
  await abrirAgenda();
  const r = await crearCita(cupoLibre('Valeria Rojas', 'DEMO_B_204').slotId, paciente(0));
  expect(r).toMatchObject({ ok: false, status: 403 });
});

test('08 · Marcos: Suárez en Sede Norte permitido, y en el Edificio B negado', async () => {
  await entrar('DEMO-MARCOS-RIBERA');
  await abrirAgenda();
  const norte = await crearCita(cupoLibre('Martín Suárez', 'DEMO_N_102').slotId, paciente(2));
  expect(norte, JSON.stringify(norte)).toMatchObject({ ok: true });
  const edificioB = await crearCita(cupoLibre('Martín Suárez', 'DEMO_B_102').slotId, paciente(0));
  expect(edificioB).toMatchObject({ ok: false, status: 403 });
});

test('09 · Ana responde el mensaje de un paciente de Pérez: permitido, la autora real es Ana y el paciente ve al doctor', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await irA('/support-inbox');
  await expect(page.getByTestId('bandeja')).toBeVisible({ timeout: 30_000 });
  const fila = page
    .locator('[data-testid^="conv-"]', { hasText: 'cambiar mi cita del jueves' })
    .first();
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByRole('button', { name: /Tomar la conversación/ }).click();
  await expect(page.getByTestId('conversacion')).toBeVisible();
  const respuesta =
    'Hola, claro: podemos reprogramar su cita para la tarde. Le confirmamos por este medio.';
  await page.getByTestId('compositor-texto').locator('textarea').fill(respuesta);
  await page.getByTestId('enviar-respuesta').click();
  await expect(page.getByTestId('autora-real')).toContainText(
    'Respondió Ana Gutiérrez en nombre de',
    { timeout: 30_000 },
  );
  // En la base: el remitente es el perfil del DOCTOR (lo que ve el paciente) y la autora real queda aparte.
  const [guardado] = consulta(
    `select m.sender_profile_id = pp.id, m.authored_by_user_id is not null, m.on_behalf_of_profile_id is not null from community.direct_messages m, profiles.persons p, community.public_profiles pp where p.display_name='Andrés Pérez' and pp.target_id=p.id and m.body_text like 'Hola, claro: podemos reprogramar%'`,
  );
  expect(guardado, 'la respuesta no quedó guardada').toEqual(['t', 't', 't']);
});

test('10 · Ana abre un mensaje clínico: el contenido sale oculto y, sin el átomo de pedir acceso, la API lo niega', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await irA('/support-inbox');
  await expect(page.getByTestId('bandeja')).toBeVisible({ timeout: 30_000 });
  const fila = page
    .locator('[data-testid^="conv-"]', { hasText: 'Contenido clínico oculto' })
    .first();
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await expect(fila).not.toContainText('dolor fuerte');
  await fila.getByTestId(/^abrir-/).click();
  await expect(page.locator('[data-testid^="oculto-"]').first()).toContainText(
    'Contenido clínico oculto',
  );
  await expect(page.locator('body')).not.toContainText('dolor fuerte en el pecho');
  await page.locator('[data-testid^="oculto-pedir-"]').first().click();
  await page
    .getByTestId('acceso-motivo')
    .locator('textarea')
    .fill('Necesito leer el mensaje para derivarlo bien al doctor.');
  await page.getByTestId('acceso-enviar').click();
  // El demo oficial (07) escribe los permisos de Ana como átomos y NO le da `patients.clinical.request_temporary_access`: con
  // permisos en átomos la API exige ese átomo (`assertMayRequestClinicalAccess`), así que niega el pedido con su motivo. La pantalla
  // tiene que decirlo con las palabras del servidor y el contenido seguir oculto. (El caso positivo —pedirlo con el átomo concedido— no
  // se recorre: el demo no lo trae y darlo pide el segundo paso del administrador.)
  await expect(
    page.getByText('Su vínculo de apoyo no le permite pedir acceso clínico.'),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="oculto-pendiente-"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('dolor fuerte en el pecho');
});

test('11 · Rosa pide la agenda del Hospital Piloto: negado (solo ve la de Céspedes)', async () => {
  await entrar('DEMO-ROSA-QUIROGA');
  await abrirAgenda();
  const desde = new Date().toISOString();
  const hasta = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const r = await conElCliente('support', 'getSupportAgenda', {
    org: hospitalId(),
    from: desde,
    to: hasta,
  });
  expect(r).toMatchObject({ ok: false, status: 403 });
});

test('13 · Ana busca «Juan»: negado. La pantalla no manda una búsqueda parcial y la API la rechaza si llega', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await abrirAgenda();
  // Una búsqueda por nombre sin fecha de nacimiento (o un documento a medias) no es exacta: la API la rechaza.
  const sinFecha = await api('POST', '/me/support-patient-search', {
    tenantId: hospitalId(),
    fullName: 'Juan',
  });
  expect(sinFecha.status, JSON.stringify(sinFecha.body)).toBeGreaterThanOrEqual(400);
  expect(sinFecha.status).toBeLessThan(500);
  const parcial = await api('POST', '/me/support-patient-search', {
    tenantId: hospitalId(),
    nationalId: '411',
  });
  expect(parcial.status, JSON.stringify(parcial.body)).toBeGreaterThanOrEqual(400);
  expect(parcial.status).toBeLessThan(500);
  // Con el documento completo sí se encuentra, con datos mínimos (documento enmascarado).
  const exacta = await api('POST', '/me/support-patient-search', {
    tenantId: hospitalId(),
    nationalId: '4111111',
  });
  expect(exacta.status).toBe(201 === exacta.status ? 201 : 200);
  expect(JSON.stringify(exacta.body)).not.toContain('4111111');
});

/* ---- las pantallas de cada lado, solo leídas, con la forma real de la API ---------------------------------------------- */

test('14 · la agenda de Ana se pinta con las citas reales (solo citas: la API no da cupos libres)', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await irA(`/combined-agenda?vista=semana&fecha=${lunes()}`);
  await expect(page.getByTestId('agenda-titulo')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="item-"]').first()).toBeVisible({ timeout: 30_000 });
  // Los doctores de «Mis doctores» salen de la respuesta (perfil profesional + nombre).
  await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Pérez');
  await expect(page.getByTestId('agenda-mis-doctores')).not.toContainText('Méndez');
});

test('15 · «Mis accesos» de Ana y «Mi equipo» del doctor leen lo que la API contesta', async () => {
  await entrar('DEMO-ANA-GUTIERREZ');
  await irA('/my-support');
  await expect(page.getByTestId('mis-vinculos')).toContainText('Hospital Piloto Mantra');
  await entrar('DEMO-ANDRES-PEREZ');
  await irA('/my-team');
  await expect(page.locator('[data-testid^="miembro-"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toContainText('Ana Gutiérrez');
});

test('16 · la administración del hospital: equipo, solicitudes, invitaciones, revisión, actividad y controles de sesión cargan', async () => {
  await entrar('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  for (const [ruta, visible] of [
    ['/administration/support-team', 'equipo-card'],
    ['/administration/support-requests', 'solicitudes-card'],
    ['/administration/support-invitations', 'invitaciones-card'],
    ['/administration/session-controls', 'controles-card'],
  ] as const) {
    await irA(ruta);
    await expect(page.getByTestId(visible), ruta).toBeVisible({ timeout: 30_000 });
  }
  await irA('/administration/support-review');
  await expect(page.locator('main')).toBeVisible();
  await irA('/administration/support-activity');
  await expect(page.locator('main')).toBeVisible();
});

/* El último: termina el vínculo de Ana, y los demás casos la necesitan viva. */
test('12 · Ana, tras el fin de su vínculo: negado, y sus citas siguen', async () => {
  const antes = consulta(`select count(*) from scheduling.appointment_bookings`)[0]![0];
  await entrar('DEMO-ADMINISTRADOR-HOSPITAL-PILOTO');
  await irA('/administration/support-team');
  const nombre = page
    .locator('[data-testid^="equipo-nombre-"]', { hasText: 'Ana Gutiérrez' })
    .first();
  await expect(nombre).toBeVisible({ timeout: 30_000 });
  const id = ((await nombre.getAttribute('data-testid')) ?? '').replace('equipo-nombre-', '');
  await page.getByTestId(`equipo-terminar-${id}`).click();
  await page
    .getByRole('dialog')
    .locator('textarea, input[type="text"]')
    .first()
    .fill('Fin de contrato de la demostración');
  await page.getByRole('dialog').getByRole('button', { name: 'Terminar el vínculo' }).click();
  await expect(page.getByTestId(`equipo-estado-${id}`)).toContainText(
    /Terminado|terminó|Finalizado/i,
  );

  await entrar('DEMO-ANA-GUTIERREZ');
  const agenda = await api(
    'GET',
    `/me/support-agenda?tenantId=${hospitalId()}&from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 7 * 86_400_000).toISOString())}`,
  );
  expect(agenda.status).toBe(403);
  expect(consulta(`select count(*) from scheduling.appointment_bookings`)[0]![0]).toBe(antes);
});
