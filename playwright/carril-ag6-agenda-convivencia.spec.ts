import { test, expect, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi } from './support/actores';

/**
 * AG-6 · La convivencia de la agenda, probada de punta a punta.
 *
 * ## Qué protege
 *
 * La promesa de la función agenda es UNA: *que todo conviva en un solo lugar*.
 * Las cuatro piezas se probaron por separado —cada una en su rama, con sus
 * unitarias y el `EntityManager` mockeado—, y ninguna de esas pruebas toca la
 * base. «Conviven» era, hasta acá, una inferencia de leer cuatro PRs.
 *
 * Este recorrido la camina: un odontólogo con **dos agendas**, un paciente, y
 * el día mixto que resulta. Lo que afirma no es que cada pieza funciona, sino
 * que **ninguna se lleva puesta a la otra**.
 *
 * ## Los cinco criterios duros
 *
 * 1. Exactamente **una** agenda del profesional puede ocupar cada minuto — la
 *    regla madre (AG-1), aseverada cruzando las dos sedes.
 * 2. La cita puntual **nace confirmada** y el paciente no tuvo que aceptar nada
 *    (AG-2).
 * 3. La cirugía **retira** los horarios libres que pisa, y lo informa.
 * 4. El **tiempo ocupado es invisible** para el paciente (AG-3).
 * 5. Cancelar la cita puntual **no deja cupo fantasma** (AG-2).
 *
 * ## Por qué por la API y no por el navegador
 *
 * Al revés que J5, que mide lo que ve una persona. Acá lo que se protege son
 * **invariantes de datos que ninguna pantalla muestra entera**: que un cupo
 * quedó en `SLOT_BLOCKED` y no en `SLOT_OPEN` no se ve mirando, se ve
 * preguntando. La pantalla que los muestra tiene sus propias 30 pruebas
 * (`day-view.spec`, `tarjeta-del-dia.spec`); lo que faltaba era el contrato.
 *
 * ## El reloj
 *
 * Los recursos de esta prueba no tienen sede con zona horaria, así que la
 * plantilla interpreta `startTime` como UTC — verificado ejecutando el journey
 * el 27/08. Todo el archivo habla en ese mismo reloj para no inventar un
 * desfase que la API no aplica.
 */

const CLAVE = 'S3cret-passw0rd';

/** Estados del catálogo que esta prueba necesita distinguir. */
const SLOT_BLOCKED = 'SLOT_BLOCKED';
const SLOT_OPEN = 'SLOT_OPEN';
const BOOKING_CONFIRMED = 'BOOKING_CONFIRMED';

interface Sede {
  readonly resourceId: string;
  readonly templateId: string;
}

/**
 * Resuelve códigos de concepto por sus uuids.
 *
 * `GET /terminology/concepts?ids=a,b,c` — separados por coma, no repitiendo la
 * clave, que es como los pide el backend (lo mismo hace el front en
 * `readConceptLabels`). Los estados llegan como uuid en cada respuesta y sin
 * esto la prueba compararía identificadores opacos, que es justo lo que le
 * pedimos a la interfaz que no haga.
 */
async function resolverCodigos(
  api: APIRequestContext,
  auth: Record<string, string>,
  ids: readonly string[],
  destino: Map<string, string>,
): Promise<void> {
  const faltan = [...new Set(ids)].filter((id) => !destino.has(id));
  if (faltan.length === 0) return;
  const res = await api.get(`/terminology/concepts?ids=${faltan.join(',')}`, { headers: auth });
  // La respuesta nombra la clave `conceptId`, no `id`: leerla como `id` deja el
  // mapa vacío y las comparaciones caen contra `undefined` en silencio.
  const cuerpo = (await res.json()) as { items?: { conceptId: string; code: string }[] };
  for (const c of cuerpo.items ?? []) destino.set(c.conceptId, c.code);
}

/** `2026-09-03T14:00:00.000Z` → `14:00`. */
function hhmm(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

/** El jueves que viene a las HH:MM del reloj de la agenda. */
function jueves(hora: number, minuto = 0): Date {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7 || 7));
  d.setUTCHours(hora, minuto, 0, 0);
  return d;
}

/** El primer tenant del token: con ése se publica la agenda. */
function tenantDelToken(token: string): string {
  const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as { tenants?: string[] };
  const [primero] = json.tenants ?? [];
  if (primero === undefined) {
    throw new Error('El token del profesional no declara ninguna organización.');
  }
  return primero;
}

/** Publica una agenda del profesional con su patrón semanal y sus cupos. */
async function publicarAgenda(
  api: APIRequestContext,
  auth: Record<string, string>,
  datos: {
    tenantId: string;
    practitionerProfileId: string;
    nombre: string;
    dias: readonly number[];
    desde: string;
    hasta: string;
  },
): Promise<Sede> {
  const recurso = await api.post('/scheduling/resources', {
    headers: auth,
    data: {
      tenantId: datos.tenantId,
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: datos.practitionerProfileId,
      name: datos.nombre,
    },
  });
  expect(recurso.ok(), `crear ${datos.nombre}: ${await recurso.text()}`).toBe(true);
  const { id: resourceId } = (await recurso.json()) as { id: string };

  const plantilla = await api.post(`/scheduling/resources/${resourceId}/templates`, {
    headers: auth,
    data: {
      name: `Patrón de ${datos.nombre}`,
      slotMinutes: 30,
      rules: datos.dias.map((dayOfWeek) => ({
        dayOfWeek,
        startTime: datos.desde,
        endTime: datos.hasta,
        slotMinutes: 30,
        capacityPerSlot: 1,
      })),
    },
  });
  expect(plantilla.ok(), `plantilla de ${datos.nombre}: ${await plantilla.text()}`).toBe(true);
  const { id: templateId } = (await plantilla.json()) as { id: string };

  const desdeVentana = new Date();
  desdeVentana.setUTCDate(desdeVentana.getUTCDate() + 1);
  desdeVentana.setUTCHours(0, 0, 0, 0);
  const hastaVentana = new Date(desdeVentana);
  hastaVentana.setUTCDate(hastaVentana.getUTCDate() + 14);
  await api.post(`/scheduling/templates/${templateId}/generate-slots`, {
    headers: auth,
    data: { from: desdeVentana.toISOString(), to: hastaVentana.toISOString() },
  });

  return { resourceId, templateId };
}

/** Los cupos de un recurso en el jueves del caso, con su estado en código. */
async function cuposDelJueves(
  api: APIRequestContext,
  auth: Record<string, string>,
  resourceId: string,
  estados: Map<string, string>,
): Promise<{ hora: string; estado: string }[]> {
  const q = `from=${jueves(0).toISOString()}&to=${jueves(23, 59).toISOString()}`;
  const res = await api.get(`/scheduling/resources/${resourceId}/slots?${q}`, { headers: auth });
  const cuerpo = (await res.json()) as { items?: unknown[]; data?: unknown[] };
  const filas = (cuerpo.items ?? cuerpo.data ?? []) as {
    startAt: string;
    statusConceptId: string;
  }[];
  await resolverCodigos(api, auth, filas.map((c) => c.statusConceptId), estados);
  return filas.map((c) => ({
    hora: hhmm(c.startAt),
    estado: estados.get(c.statusConceptId) ?? c.statusConceptId,
  }));
}

/**
 * Los horarios que el PACIENTE ve libres.
 *
 * Va por `GET /scheduling/slots`, que es la ruta que consume la pantalla de
 * reserva. La hermana `GET /scheduling/resources/:id/slots` responde distinto
 * —filtra por capacidad restante y no por estado—; está anotado como tarjeta y
 * esta prueba mide **por donde pasa una persona**.
 */
async function loQueVeElPaciente(
  api: APIRequestContext,
  auth: Record<string, string>,
  resourceId: string,
): Promise<string[]> {
  const q = `from=${jueves(0).toISOString()}&to=${jueves(23, 59).toISOString()}`;
  const res = await api.get(
    `/scheduling/slots?resourceId=${resourceId}&${q}&onlyAvailable=true`,
    { headers: auth },
  );
  const cuerpo = (await res.json()) as { items?: { startAt: string }[] };
  return (cuerpo.items ?? []).map((c) => hhmm(c.startAt));
}

test.describe('AG-6 · el día del odontólogo, con todo conviviendo', () => {
  let api: APIRequestContext;
  let auth: Record<string, string>;
  let authPaciente: Record<string, string>;
  let estados: Map<string, string>;
  let tenantId: string;
  let patientProfileId: string;
  let consultorio: Sede;
  let hospital: Sede;

  test.beforeAll(async () => {
    api = await contextoDeApi();
    if (!(await apiViva(api))) {
      test.skip(true, 'La API no responde: la convivencia no tiene dónde ocurrir.');
      return;
    }

    const suf = String(Date.now()).slice(-9);

    // --- El odontólogo, con sus dos agendas ---------------------------------
    const alta = await api.post('/iam/auth/register-practitioner', {
      data: {
        email: `odontologo-ag6-${suf}@example.test`,
        password: CLAVE,
        displayName: `Dr. Odonto AG6 ${suf}`,
        licenseNumber: `MP-AG6-${suf}`,
        credentialNumber: `TIT-AG6-${suf}`,
        professionalTitle: 'Dr.',
      },
    });
    expect(alta.ok(), `alta del odontólogo: ${await alta.text()}`).toBe(true);
    const { practitionerProfileId } = (await alta.json()) as { practitionerProfileId: string };

    const sesion = await api.post('/iam/auth/login', {
      data: { email: `odontologo-ag6-${suf}@example.test`, password: CLAVE },
    });
    const { accessToken } = (await sesion.json()) as { accessToken: string };
    auth = { Authorization: `Bearer ${accessToken}` };
    tenantId = tenantDelToken(accessToken);

    estados = new Map();

    consultorio = await publicarAgenda(api, auth, {
      tenantId,
      practitionerProfileId,
      nombre: `Consultorio AG6 ${suf}`,
      dias: [2, 4],
      desde: '09:00',
      hasta: '12:00',
    });
    hospital = await publicarAgenda(api, auth, {
      tenantId,
      practitionerProfileId,
      nombre: `Hospital AG6 ${suf}`,
      dias: [4],
      desde: '13:00',
      hasta: '18:00',
    });

    // --- El paciente -------------------------------------------------------
    const ci = `CI-AG6-${suf}`;
    const altaPac = await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: ci,
        password: CLAVE,
        name: 'Ana',
        middleName: 'Lucía',
        lastName: 'Quispe',
        motherLastName: 'Mamani',
        email: `paciente-ag6-${suf}@example.test`,
        phone: '+591 70055555',
        gender: 'FEMALE',
        sexAtBirth: 'FEMALE',
      },
    });
    expect(altaPac.ok(), `alta del paciente: ${await altaPac.text()}`).toBe(true);
    ({ patientProfileId } = (await altaPac.json()) as { patientProfileId: string });

    const sesionPac = await api.post('/iam/auth/login', {
      data: { nationalId: ci, password: CLAVE },
    });
    const { accessToken: tokenPac } = (await sesionPac.json()) as { accessToken: string };
    authPaciente = { Authorization: `Bearer ${tokenPac}` };
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('el día mixto se arma sin que ninguna pieza se lleve puesta a la otra', async () => {
    let cirugiaBookingId = '';

    await test.step('2 · el paciente reserva por la mañana (el flujo de siempre, intacto)', async () => {
      const libres = await loQueVeElPaciente(api, authPaciente, consultorio.resourceId);
      expect(libres.length, 'la mañana del consultorio se ofrece entera').toBeGreaterThan(0);

      const q = `from=${jueves(0).toISOString()}&to=${jueves(23, 59).toISOString()}`;
      const lista = await api.get(`/scheduling/slots?resourceId=${consultorio.resourceId}&${q}`, {
        headers: authPaciente,
      });
      const { items = [] } = (await lista.json()) as { items?: { id: string; startAt: string }[] };
      const cupo = items.find((c) => hhmm(c.startAt) === '09:30') ?? items[1];

      const hold = await api.post(`/scheduling/slots/${cupo.id}/holds`, {
        headers: authPaciente,
        data: { patientProfileId },
      });
      expect(hold.ok(), `retener el cupo: ${await hold.text()}`).toBe(true);
      const { holdToken } = (await hold.json()) as { holdToken: string };

      const reserva = await api.post(`/scheduling/holds/${holdToken}/confirm`, {
        headers: authPaciente,
        data: { tenantId, patientProfileId, channel: 'PORTAL', reasonText: 'Control de rutina' },
      });
      expect(reserva.ok(), `confirmar la reserva: ${await reserva.text()}`).toBe(true);
    });

    await test.step('3 · la cirugía de 3 h nace CONFIRMADA y retira lo que pisa', async () => {
      const respuesta = await api.post('/scheduling/appointments/direct', {
        headers: auth,
        data: {
          patientProfileId,
          resourceId: hospital.resourceId,
          startAt: jueves(14).toISOString(),
          durationMinutes: 180,
          reasonText: 'Cirugía de tercer molar incluido',
        },
      });
      expect(respuesta.status(), await respuesta.text()).toBe(201);
      const cuerpo = (await respuesta.json()) as {
        bookingId: string;
        statusConceptId: string;
        retractedSlots: number;
      };
      cirugiaBookingId = cuerpo.bookingId;

      // CRITERIO 2: nace confirmada — el paciente no tuvo paso de aceptación.
      await resolverCodigos(api, auth, [cuerpo.statusConceptId], estados);
      expect(estados.get(cuerpo.statusConceptId)).toBe(BOOKING_CONFIRMED);

      // CRITERIO 3: retira los horarios libres que pisa, y lo informa. Tres
      // horas sobre cupos de treinta son seis: no «algunos».
      expect(cuerpo.retractedSlots).toBe(6);
    });

    await test.step('4 · la reunión de 13:15 bloquea su rato y NADA más', async () => {
      const reunion = await api.post(`/scheduling/resources/${hospital.resourceId}/exceptions`, {
        headers: auth,
        data: {
          exceptionType: 'ABSENCE',
          startAt: jueves(13, 15).toISOString(),
          endAt: jueves(13, 45).toISOString(),
          reason: 'Reunión de equipo',
          isAvailable: false,
        },
      });
      expect(reunion.status(), await reunion.text()).toBe(201);
      const { blockedSlots } = (await reunion.json()) as { blockedSlots: number };

      // Media hora a caballo de dos cupos toca exactamente dos.
      expect(blockedSlots).toBe(2);

      // Y el resto del día SIGUE ofertándose: bloquear no es cerrar el día.
      const cupos = await cuposDelJueves(api, auth, hospital.resourceId, estados);
      expect(cupos.find((c) => c.hora === '17:00')?.estado).toBe(SLOT_OPEN);
      expect(cupos.find((c) => c.hora === '17:30')?.estado).toBe(SLOT_OPEN);
    });

    await test.step('5 · CRITERIO 1: la regla madre cruza las sedes', async () => {
      const choque = await api.post('/scheduling/appointments/direct', {
        headers: auth,
        data: {
          patientProfileId,
          resourceId: consultorio.resourceId, // ← la OTRA sede
          startAt: jueves(14, 30).toISOString(),
          durationMinutes: 30,
          reasonText: 'La cita que no puede entrar',
        },
      });

      expect(choque.status(), 'una cita sobre tiempo comprometido se rechaza').toBe(422);

      // El mensaje es para una persona: dice QUÉ, CUÁNDO y DÓNDE. Si algún día
      // se degrada a «conflicto de horario», esta prueba lo cuenta.
      const { message } = (await choque.json()) as { message: string };
      expect(message).toContain('14:00');
      expect(message).toContain('17:00');
      expect(message).toContain('Hospital');
      expect(message).toMatch(/no puede estar en dos lugares a la vez/i);
    });

    await test.step('6 · generar el período siguiente informa lo omitido', async () => {
      // Una cirugía en un jueves que TODAVÍA no tiene cupos: al generarlos,
      // los que la pisarían no deben nacer.
      const lejano = jueves(14);
      lejano.setUTCDate(lejano.getUTCDate() + 21);
      const segunda = await api.post('/scheduling/appointments/direct', {
        headers: auth,
        data: {
          patientProfileId,
          resourceId: hospital.resourceId,
          startAt: lejano.toISOString(),
          durationMinutes: 180,
          reasonText: 'Segunda cirugía, tres semanas después',
        },
      });
      expect(segunda.status(), await segunda.text()).toBe(201);

      const desde = new Date();
      desde.setUTCDate(desde.getUTCDate() + 1);
      desde.setUTCHours(0, 0, 0, 0);
      const hasta = new Date(desde);
      hasta.setUTCDate(hasta.getUTCDate() + 35);
      const generar = await api.post(
        `/scheduling/templates/${hospital.templateId}/generate-slots`,
        { headers: auth, data: { from: desde.toISOString(), to: hasta.toISOString() } },
      );
      expect(generar.ok(), await generar.text()).toBe(true);
      const { omittedByCommitments } = (await generar.json()) as {
        omittedByCommitments: number;
      };

      // Seis cupos de treinta bajo tres horas de cirugía. Que el número sea
      // exacto es lo que separa «lo informa» de «lo menciona».
      expect(omittedByCommitments).toBe(6);
    });

    await test.step('7 · CRITERIO 4: el tiempo ocupado es invisible para el paciente', async () => {
      // Lo que el DOCTOR ve: su día entero, con los bloques apagados.
      const delDoctor = await cuposDelJueves(api, auth, hospital.resourceId, estados);
      expect(delDoctor.filter((c) => c.estado === SLOT_BLOCKED).length).toBeGreaterThanOrEqual(8);

      // Lo que el PACIENTE ve: sólo lo que de verdad puede pedir. Ni la
      // reunión, ni la cirugía, ni lo que la cirugía retiró.
      const libres = await loQueVeElPaciente(api, authPaciente, hospital.resourceId);
      expect(libres).toEqual(['17:00', '17:30']);
    });

    await test.step('8 · CRITERIO 5: cancelar no deja cupo fantasma', async () => {
      const cancelar = await api.post(`/scheduling/bookings/${cirugiaBookingId}/cancel`, {
        headers: auth,
        data: { cancelledBy: 'PATIENT', reasonText: 'El paciente pidió otro día para la cirugía' },
      });
      expect(cancelar.ok(), await cancelar.text()).toBe(true);

      // El cupo de la cita puntual es de un solo uso: cancelar lo apaga en vez
      // de devolverlo al pool. Si volviera a SLOT_OPEN, un paciente podría
      // pedir un horario que nunca se publicó.
      const cupos = await cuposDelJueves(api, auth, hospital.resourceId, estados);
      for (const cupo of cupos.filter((c) => c.hora === '14:00')) {
        expect(cupo.estado).toBe(SLOT_BLOCKED);
      }

      const libres = await loQueVeElPaciente(api, authPaciente, hospital.resourceId);
      expect(libres).not.toContain('14:00');
    });
  });
});
