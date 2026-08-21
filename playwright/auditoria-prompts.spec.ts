import { expect, test } from '@playwright/test';

import { apiViva } from './support/actores';
import {
  CLAVE_AUDITORIA,
  PREFIJO,
  LimitadorActivo,
  crearPacienteYEntrar,
  entrarComoAdmin,
  evidencia,
  leer,
  sufijo,
  type Respuesta,
  type Sesion,
} from './support/auditoria';

/**
 * **TJ-4 · Los criterios de aceptación de los 12 prompts, ejecutables.**
 *
 * ## Qué es esto
 *
 * Los prompts que nos pasaron traían dos cosas: una sección «Tarea» escrita
 * para otro repo —inservible— y unos **criterios de aceptación** que describen
 * qué tiene que cumplir el producto. Esto es lo segundo, convertido en código.
 *
 * No arregla nada: **descubre**. Cada rojo es un defecto encontrado y va al
 * `REGISTRO-DEFECTOS.md` con su evidencia literal y su prompt de origen. Cada
 * verde es la prueba de algo que ya cumplimos.
 *
 * Por eso la regla del carril es **quien mide no arregla en el mismo PR**: un
 * arreglo metido acá haría desaparecer la medición que lo justificaba.
 *
 * ## Corre contra la API viva, no contra dobles
 *
 * `E2E_API_URL` (por defecto `http://localhost:3005`; el stack local publica en
 * el 3000). Sin API, la suite se salta entera en vez de fallar 18 veces por el
 * mismo motivo: un backend caído hace fallar cada prueba por una razón distinta
 * y ninguna dice la verdad.
 *
 * ## Los datos son propios
 *
 * Todo lo que necesita lo crea con prefijo `tj4-`. No depende de seeds, y por
 * buenos motivos: **esta máquina descubrió que su base no tiene el catálogo de
 * v4.0.11**, así que un criterio anclado a datos sembrados mediría qué paquete
 * tiene cargada la máquina y no qué cumple el producto.
 *
 * ## Cómo leer un `fixme`
 *
 * Los criterios que dependen de una tarea que todavía no mergeó se marcan
 * `fixme` con el motivo. No son deuda de esta suite: quedan escritos para
 * ponerse verdes solos cuando aquella tarea llegue.
 */

/** Etiquetas de origen: cada criterio dice de qué prompt salió. */
const P = {
  privacidad: '[P00.4]',
  especialidad: '[P01]',
  organizaciones: '[P02]',
  vinculo: '[P03]',
  wizard: '[P04]',
  medios: '[P05]',
  perfilPublico: '[P06]',
  crearGrupo: '[P07]',
  vidaDelGrupo: '[P08]',
  disponibilidad: '[P09]',
  reserva: '[P10]',
  confirmacion: '[P11]',
  cancelacion: '[P12]',
} as const;

/** Ventana de búsqueda de cupos: la misma que usa el portal del paciente. */
const DIAS = 14;

let admin: Sesion;
/**
 * Un paciente recién dado de alta, compartido por toda la suite.
 *
 * Se crea **una sola vez** y no por prueba: `POST /iam/auth/login` está
 * limitado a diez por minuto y por IP —una defensa contra fuerza bruta que
 * funciona—, y una suite que entra en cada prueba la agota en segundos. El
 * `429` que vuelve haría fallar media auditoría por un motivo que no tiene
 * nada que ver con los criterios: reportaría defectos que no existen, que es
 * peor que no medir nada.
 */
let paciente: Sesion;
let correoDelPaciente = '';
let documentoDelPaciente = '';
let hayApi = false;
/** El motivo por el que la auditoría no pudo abrir sesión, si pasó. */
let limitador = '';

test.beforeAll(async () => {
  const { request } = await import('@playwright/test');
  const sonda = await request.newContext({
    baseURL: process.env['E2E_API_URL'] ?? 'http://localhost:3005',
  });
  hayApi = await apiViva(sonda);
  await sonda.dispose();
  if (!hayApi) return;
  try {
    admin = await entrarComoAdmin();
    const alta = await crearPacienteYEntrar();
    paciente = alta.sesion;
    correoDelPaciente = alta.email;
    documentoDelPaciente = alta.nationalId;
  } catch (error) {
    // Con el limitador caliente —una corrida anterior demasiado cerca— la
    // auditoría no puede abrir sesión y, por lo tanto, no puede medir nada. Se
    // salta entera y lo dice, en vez de anotar dieciocho defectos falsos.
    if (error instanceof LimitadorActivo) {
      limitador = error.message;
      return;
    }
    throw error;
  }
});

test.beforeEach(() => {
  test.skip(!hayApi, 'No hay API viva en E2E_API_URL: la auditoría no puede medir nada.');
  test.skip(limitador !== '', limitador);
});

/* ══════════════════════════════════════════════════════════════════════════
   Grupo A · Agenda y citas (prompts 09–12)
   ══════════════════════════════════════════════════════════════════════════ */

/** Un cupo libre de la ventana próxima, o `null` si la agenda no tiene ninguno. */
async function cupoLibre(sesion: Sesion): Promise<{ id: string; resourceId: string } | null> {
  const desde = new Date();
  const hasta = new Date(desde.getTime() + DIAS * 24 * 60 * 60 * 1000);
  const r = await leer(
    await sesion.api.get('/scheduling/slots', {
      params: {
        from: desde.toISOString(),
        to: hasta.toISOString(),
        onlyAvailable: 'true',
        limit: '50',
      },
    }),
  );
  if (r.status !== 200) return null;
  const items = (
    r.json as { items?: { id: string; resourceId: string; remainingCapacity: number }[] }
  ).items;
  return items?.find((s) => s.remainingCapacity > 0) ?? null;
}

test(`${P.reserva} dos confirmaciones en paralelo del MISMO cupo dejan exactamente una reserva viva`, async () => {
  const cupo = await cupoLibre(admin);
  test.skip(cupo === null, 'La agenda no tiene ningún cupo libre en las próximas dos semanas.');

  // Dos retenciones simultáneas sobre el mismo hueco. La capacidad es 1: la
  // segunda no debería poder existir, o si existe, no debería poder confirmar.
  const [a, b] = await Promise.all([
    leer(await admin.api.post(`/scheduling/slots/${cupo!.id}/holds`, { data: {} })),
    leer(await admin.api.post(`/scheduling/slots/${cupo!.id}/holds`, { data: {} })),
  ]);

  const exitosas = [a, b].filter((r) => r.status === 201);
  const rechazadas = [a, b].filter((r) => r.status === 409 || r.status === 422);

  expect(
    exitosas.length,
    `Se retuvo el mismo cupo dos veces. A: ${evidencia(a)} · B: ${evidencia(b)}`,
  ).toBe(1);
  expect(
    rechazadas.length,
    `La segunda retención no fue rechazada con 409/422. B: ${evidencia(b)}`,
  ).toBe(1);
});

test(`${P.reserva} un cupo del pasado no se puede retener`, async () => {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hasta = new Date(Date.now() - 60 * 60 * 1000);
  const listado = await leer(
    await admin.api.get('/scheduling/slots', {
      params: { from: desde.toISOString(), to: hasta.toISOString(), limit: '20' },
    }),
  );
  const items =
    (listado.json as { items?: { id: string; remainingCapacity: number }[] }).items ?? [];
  const pasado = items.find((s) => s.remainingCapacity > 0);
  test.skip(
    pasado === undefined,
    'No hay cupos pasados con capacidad en la base: no se puede medir el criterio.',
  );

  const r = await leer(await admin.api.post(`/scheduling/slots/${pasado!.id}/holds`, { data: {} }));
  expect(
    r.status,
    `Retener un cupo del pasado debería rechazarse. ${evidencia(r)}`,
  ).toBeGreaterThanOrEqual(400);
});

test(`${P.reserva} un recurso inexistente no se puede reservar`, async () => {
  // El id tiene forma de uuid: si respondiera 400 estaríamos midiendo el
  // validador de formato, no la regla de que el recurso tiene que existir.
  const r = await leer(
    await admin.api.post('/scheduling/slots/00000000-0000-4000-8000-000000000000/holds', {
      data: {},
    }),
  );
  expect(r.status, `Debería ser 404 o 422, no otra cosa. ${evidencia(r)}`).toBeGreaterThanOrEqual(
    400,
  );
  expect(r.status, `Un cupo inexistente no puede dar 5xx. ${evidencia(r)}`).toBeLessThan(500);
});

test(`${P.disponibilidad} la disponibilidad no ofrece huecos del pasado`, async () => {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hasta = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000);
  const r = await leer(
    await admin.api.get('/scheduling/slots', {
      params: {
        from: desde.toISOString(),
        to: hasta.toISOString(),
        onlyAvailable: 'true',
        limit: '100',
      },
    }),
  );
  expect(r.status, evidencia(r)).toBe(200);

  const items = (r.json as { items?: { id: string; startAt: string }[] }).items ?? [];
  const vencidos = items.filter((s) => new Date(s.startAt).getTime() < Date.now());
  // `onlyAvailable` significa «lo que se puede pedir». Un hueco de ayer no se
  // puede pedir, y ofrecerlo hace que el portal muestre horarios imposibles.
  expect(
    vencidos.length,
    `«Sólo disponibles» devolvió ${vencidos.length} huecos ya vencidos, p. ej. ${vencidos[0]?.startAt}.`,
  ).toBe(0);
});

test(`${P.cancelacion} cancelar devuelve el cupo a la disponibilidad`, async () => {
  const cupo = await cupoLibre(admin);
  test.skip(cupo === null, 'La agenda no tiene ningún cupo libre para el ciclo completo.');

  const hold = await leer(
    await admin.api.post(`/scheduling/slots/${cupo!.id}/holds`, { data: {} }),
  );
  test.skip(hold.status !== 201, `No se pudo retener el cupo: ${evidencia(hold)}`);
  const token = (hold.json as { holdToken: string }).holdToken;

  const confirmada = await leer(
    await admin.api.post(`/scheduling/holds/${token}/confirm`, { data: {} }),
  );
  test.skip(
    confirmada.status !== 201 && confirmada.status !== 200,
    `No se pudo confirmar la reserva: ${evidencia(confirmada)}`,
  );
  const bookingId = (confirmada.json as { id?: string }).id;

  const cancelada = await leer(
    await admin.api.post(`/scheduling/bookings/${bookingId}/cancel`, {
      data: { reasonText: `${PREFIJO} auditoría de criterios` },
    }),
  );
  expect(cancelada.status, `La cancelación falló: ${evidencia(cancelada)}`).toBeLessThan(400);

  const otraVez = await cupoLibre(admin);
  const vueltos = otraVez !== null;
  // El criterio punta a punta del prompt 12: si el cupo no reaparece, cancelar
  // le quita el horario a todo el mundo en vez de devolverlo.
  expect(vueltos, 'Tras cancelar, la disponibilidad no volvió a ofrecer ningún cupo.').toBe(true);
});

test(`${P.confirmacion} confirmar con un token de retención inválido no revienta`, async () => {
  const r = await leer(
    await admin.api.post('/scheduling/holds/00000000-0000-4000-8000-000000000000/confirm', {
      data: {},
    }),
  );
  // El criterio del prompt 11 es sobre la CALIDAD del error: quien perdió la
  // carrera tiene que recibir algo que se pueda mostrar, no un 500.
  expect(r.status, `Un token inválido devolvió 5xx. ${evidencia(r)}`).toBeLessThan(500);
  expect(r.status, `Debería rechazar. ${evidencia(r)}`).toBeGreaterThanOrEqual(400);
});

test(`${P.privacidad} el listado de reservas no expone el motivo de consulta a la organización`, async () => {
  // El listado EXIGE acotar por paciente o por recurso —verificado contra la
  // API viva: sin filtro contesta 422—, así que se pide el de un recurso, que
  // es exactamente la vista que tiene la organización.
  const cupo = await cupoLibre(admin);
  test.skip(cupo === null, 'Sin cupos no hay recurso por el cual pedir el listado.');

  const r = await leer(
    await admin.api.get('/scheduling/bookings', {
      params: { resourceId: cupo!.resourceId, limit: '20' },
    }),
  );
  expect(r.status, evidencia(r)).toBe(200);

  // Regla 00.4: los datos clínicos no viajan a vistas de la organización. Se
  // mira el payload crudo y no un campo concreto, porque lo que importa es que
  // el texto no esté, se llame como se llame.
  const crudo = r.texto;
  const sospechosos = ['reasonText', 'reason_text', 'chiefComplaint', 'motivoConsulta'];
  const filtrados = sospechosos.filter((clave) => crudo.includes(`"${clave}"`));
  expect(
    filtrados,
    `El listado de la organización trae ${filtrados.join(', ')}. Payload: ${evidencia(r, 600)}`,
  ).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
   Grupo B · Grupos (prompts 06–08)
   ══════════════════════════════════════════════════════════════════════════ */

/** Crea un grupo con nombre propio; devuelve la respuesta cruda para poder medirla. */
async function crearGrupo(sesion: Sesion, extra: Record<string, unknown> = {}): Promise<Respuesta> {
  const s = sufijo();
  return leer(
    await sesion.api.post('/community/groups', {
      data: {
        name: `${PREFIJO} grupo ${s}`,
        // `slug` es obligatorio —verificado contra la API viva: sin él vuelve
        // 400 «slug must be a string»—. Va derivado del sufijo para que dos
        // corridas no choquen.
        slug: `${PREFIJO}-grupo-${s}`,
        description: 'Grupo creado por la auditoría de criterios (TJ-4).',
        ...extra,
      },
    }),
  );
}

test(`${P.crearGrupo} al crear un grupo queda exactamente un miembro, y es el dueño`, async () => {
  const creado = await crearGrupo(admin);
  test.skip(
    creado.status >= 400,
    `No se pudo crear el grupo, así que el criterio no se puede medir: ${evidencia(creado)}`,
  );
  const groupId = (creado.json as { id?: string }).id;

  const miembros = await leer(await admin.api.get(`/community/groups/${groupId}/members`));
  expect(miembros.status, evidencia(miembros)).toBe(200);

  const items = (miembros.json as { items?: unknown[] }).items ?? [];
  // El criterio del prompt 07: crear el grupo y agregar al creador son un solo
  // hecho. Un grupo con cero miembros es un grupo sin dueño que nadie puede
  // administrar.
  expect(items.length, `El grupo recién creado tiene ${items.length} miembros.`).toBe(1);

  const rol = JSON.stringify(items[0]).toUpperCase();
  expect(
    /OWNER|DUEÑ|ADMIN/.test(rol),
    `El único miembro no parece el dueño: ${JSON.stringify(items[0])}`,
  ).toBe(true);
});

test(`${P.vidaDelGrupo} un grupo sin miembros ya no se ofrece`, async () => {
  const creado = await crearGrupo(admin);
  test.skip(creado.status >= 400, `No se pudo crear el grupo: ${evidencia(creado)}`);
  const groupId = (creado.json as { id?: string }).id;

  const miembros = await leer(await admin.api.get(`/community/groups/${groupId}/members`));
  const items =
    (miembros.json as { items?: { profileId?: string; memberProfileId?: string; id?: string }[] })
      .items ?? [];
  test.skip(items.length === 0, 'El grupo nació sin miembros: lo mide el criterio anterior.');

  const quien = items[0].memberProfileId ?? items[0].profileId ?? items[0].id;
  const salida = await leer(
    await admin.api.delete(`/community/groups/${groupId}/members/${quien}`),
  );
  test.skip(
    salida.status >= 400,
    `El último miembro no pudo salir, así que no se puede medir qué pasa después: ${evidencia(salida)}`,
  );

  const ficha = await leer(await admin.api.get(`/community/groups/${groupId}`));
  // El criterio del prompt 08: un grupo vacío no sigue existiendo como una
  // sala a la que nadie puede entrar ni administrar.
  expect(
    ficha.status,
    `El grupo vacío sigue accesible por su URL directa. ${evidencia(ficha)}`,
  ).toBe(404);
});

test(`${P.vidaDelGrupo} dos salidas simultáneas no dejan el grupo en un estado roto`, async () => {
  const creado = await crearGrupo(admin);
  test.skip(creado.status >= 400, `No se pudo crear el grupo: ${evidencia(creado)}`);
  const groupId = (creado.json as { id?: string }).id;

  const miembros = await leer(await admin.api.get(`/community/groups/${groupId}/members`));
  const items =
    (miembros.json as { items?: { profileId?: string; memberProfileId?: string; id?: string }[] })
      .items ?? [];
  test.skip(items.length === 0, 'El grupo nació sin miembros.');
  const quien = items[0].memberProfileId ?? items[0].profileId ?? items[0].id;

  const [a, b] = await Promise.all([
    leer(await admin.api.delete(`/community/groups/${groupId}/members/${quien}`)),
    leer(await admin.api.delete(`/community/groups/${groupId}/members/${quien}`)),
  ]);

  // Lo que se mide no es cuál gana: es que la que pierde reciba una respuesta
  // que se pueda mostrar. Un 500 en una carrera es una carrera sin manejar.
  for (const r of [a, b]) {
    expect(r.status, `Una de las dos salidas devolvió 5xx: ${evidencia(r)}`).toBeLessThan(500);
  }
});

test(`${P.perfilPublico} crear un grupo público sin perfil público configurado se rechaza`, async () => {
  const r = await crearGrupo(paciente, { visibility: 'PUBLIC', isPublic: true });

  // El criterio del prompt 06: un grupo público con un dueño invisible es un
  // grupo sin cara. Un paciente recién dado de alta no tiene perfil público.
  expect(
    r.status,
    `Un paciente sin perfil público pudo crear un grupo público. ${evidencia(r)}`,
  ).toBeGreaterThanOrEqual(400);
  expect(r.status, `Y el rechazo no puede ser un 5xx. ${evidencia(r)}`).toBeLessThan(500);
});

/* ══════════════════════════════════════════════════════════════════════════
   Grupo C · Identidad y organización (prompts 01–03)
   ══════════════════════════════════════════════════════════════════════════ */

test(`${P.especialidad} una especialidad que no es del catálogo se rechaza con 422`, async () => {
  // Se crea el profesional en vez de buscar uno sembrado: este tenant no tiene
  // ninguno (`GET /profiles/practitioners` devuelve 0), y un criterio que se
  // saltea según qué paquete de seeds tenga la máquina no mide el producto.
  const s = sufijo();
  const alta = await leer(
    await admin.api.post('/profiles/practitioners', {
      data: {
        practitionerCode: `${PREFIJO.toUpperCase()}-MP-${s}`,
        displayName: 'Profesional de auditoría',
        licenseNumber: `${PREFIJO}-lic-${s}`,
        credentialNumber: `${PREFIJO}-cred-${s}`,
      },
    }),
  );
  test.skip(alta.status >= 400, `No se pudo dar de alta el profesional: ${evidencia(alta)}`);
  const profileId = (alta.json as { profileId?: string }).profileId;

  // Un uuid con forma válida que no es una especialidad: si pasara el filtro,
  // sería porque nadie mira el catálogo, que es justo lo que TJ-3 arregla.
  const r = await leer(
    await admin.api.post(`/profiles/practitioners/${profileId}/specialties`, {
      data: { specialtyConceptId: '00000000-0000-4000-8000-000000000000' },
    }),
  );
  expect(
    r.status,
    `Se aceptó como especialidad un uuid que no está en el catálogo. ${evidencia(r)}`,
  ).toBe(422);
});

test(`${P.organizaciones} un recurso de otra organización no se puede leer manipulando el id`, async () => {
  const practicas = await leer(await admin.api.get('/practices', { params: { limit: '5' } }));
  expect(practicas.status, evidencia(practicas)).toBe(200);

  // Se pide una práctica con un uuid que no existe en ningún tenant: la
  // respuesta correcta es «no está» o «no podés», nunca los datos de otro.
  const ajena = await leer(
    await admin.api.get('/practices/00000000-0000-4000-8000-000000000000/sites'),
  );
  expect([403, 404].includes(ajena.status), `Debería ser 403 o 404. ${evidencia(ajena)}`).toBe(
    true,
  );
});

test(`${P.organizaciones} un paciente no puede leer el padrón de profesionales de la organización`, async () => {
  const r = await leer(await paciente.api.get('/practices', { params: { limit: '5' } }));

  // No se afirma un código concreto: se afirma que NO devuelve el padrón. Un
  // 200 con datos acá sería una fuga entre roles.
  expect(
    r.status < 400 ? 'devolvió datos' : 'rechazó',
    `Un paciente recibió ${evidencia(r, 300)}`,
  ).toBe('rechazó');
});

test.fixme(`${P.vinculo} un médico sin vínculo aprobado no aparece asociado a la organización`, async () => {
  // Depende de TP-2 (Pablo): hoy no existe la aprobación del vínculo, así que
  // no hay estado «pendiente» que medir. La prueba queda escrita para
  // ponerse verde sola cuando esa tarea mergee.
  expect(true).toBe(false);
});

/* ══════════════════════════════════════════════════════════════════════════
   Grupo D · Perfil y wizard (prompts 04–05)
   ══════════════════════════════════════════════════════════════════════════ */

test.fixme(`${P.wizard} completar el alta salteando pasos se rechaza con detalle`, async () => {
  // Depende de TJ-1 (Mac): el alta por pasos todavía no existe como recorrido
  // retomable, así que no hay «paso salteado» que medir.
  expect(true).toBe(false);
});

test(`${P.medios} una foto de perfil con tipo no permitido se rechaza`, async () => {
  const perfil = await leer(await paciente.api.get('/profiles/patients/me/summary'));
  test.skip(perfil.status !== 200, `No se pudo leer el perfil propio: ${evidencia(perfil)}`);

  // Un GIF diminuto pero válido: lo que se mide es el filtro de tipo, no que
  // el archivo esté roto.
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
  const r = await leer(
    await paciente.api.fetch('/object-storage/files', {
      method: 'POST',
      multipart: {
        file: { name: `${PREFIJO}.gif`, mimeType: 'image/gif', buffer: gif },
      },
    }),
  );
  // Si la ruta no existe, el criterio no se puede medir acá: es un hueco de
  // superficie y se anota como tal en vez de darse por verde.
  test.skip(r.status === 404, 'No hay POST /object-storage/files: hueco de superficie, anotado.');
  expect(
    r.status,
    `Se aceptó un GIF como archivo de perfil. ${evidencia(r)}`,
  ).toBeGreaterThanOrEqual(400);
});

test(`${P.wizard} el alta de paciente exige contraseña fuerte`, async () => {
  const { request } = await import('@playwright/test');
  const anonimo = await request.newContext({
    baseURL: process.env['E2E_API_URL'] ?? 'http://localhost:3005',
  });
  const s = sufijo();
  const r = await leer(
    await anonimo.post('/iam/auth/register-patient', {
      data: {
        nationalId: `CI-${PREFIJO.toUpperCase()}-DEBIL-${s}`,
        password: '123',
        name: 'Clave',
        middleName: 'Muy',
        lastName: 'Debil',
        motherLastName: 'Prueba',
        email: `${PREFIJO}-debil-${s}@example.test`,
        phone: '+591 70044444',
        gender: 'FEMALE',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  await anonimo.dispose();
  expect(r.status, `Se aceptó «123» como contraseña. ${evidencia(r)}`).toBeGreaterThanOrEqual(400);
});

test(`${P.wizard} quien se registra con un correo puede entrar con ese correo`, async () => {
  const { request } = await import('@playwright/test');
  const anonimo = await request.newContext({
    baseURL: process.env['E2E_API_URL'] ?? 'http://localhost:3005',
  });
  const porCorreo = await leer(
    await anonimo.post('/iam/auth/login', {
      data: { email: correoDelPaciente, password: CLAVE_AUDITORIA },
    }),
  );
  await anonimo.dispose();

  // El formulario de alta PIDE el correo y la pantalla de ingreso lo acepta,
  // así que quien se registró con él espera poder usarlo. Si el producto exige
  // verificarlo primero, el mensaje tiene que decir eso —no «credenciales
  // inválidas», que manda a la persona a dudar de su contraseña—.
  expect(
    porCorreo.status,
    `El mismo correo del alta no sirve para entrar. Con documento sí funciona. ${evidencia(porCorreo)}`,
  ).toBe(200);
});

test(`${P.wizard} entrar con la contraseña equivocada no distingue «no existe» de «clave mala»`, async () => {
  const { request } = await import('@playwright/test');
  const anonimo = await request.newContext({
    baseURL: process.env['E2E_API_URL'] ?? 'http://localhost:3005',
  });

  // Se compara por DOCUMENTO, que es el camino que funciona para un paciente:
  // por correo los dos casos darían 401 y la comparación no probaría nada.
  const existeMalClave = await leer(
    await anonimo.post('/iam/auth/login', {
      data: { nationalId: documentoDelPaciente, password: `${CLAVE_AUDITORIA}-mal` },
    }),
  );
  const noExiste = await leer(
    await anonimo.post('/iam/auth/login', {
      data: {
        nationalId: `CI-${PREFIJO.toUpperCase()}-NADIE-${sufijo()}`,
        password: CLAVE_AUDITORIA,
      },
    }),
  );
  await anonimo.dispose();

  // Si el limitador contestó, los dos códigos son 429 y coincidirían por el
  // motivo equivocado: eso sería un verde inventado.
  test.skip(
    existeMalClave.status === 429 || noExiste.status === 429,
    'El limitador de ingresos está activo: este criterio no se pudo medir.',
  );

  // Enumerar cuentas es una fuga: si los dos casos responden distinto, se puede
  // averiguar quién tiene cuenta probando correos.
  expect(
    existeMalClave.status,
    `Clave mala: ${evidencia(existeMalClave)} · inexistente: ${evidencia(noExiste)}`,
  ).toBe(noExiste.status);
});
