import type { PatientRepresentative, SupportPatientMatch } from '../../data-access/support-access/support-patients.types';
import { agendaDePartida } from '../fixtures/support-hospital-agenda';
import { patientList, type PacienteSimulado } from '../fixtures/people';
import { forbidden, reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { conMotivo } from './support-access.errors';
import { cuerpo, uuid } from '../mock-store';
import { canonicalNationalId, MIN_CANONICAL_NATIONAL_ID_LENGTH } from '../../data-access/support-access/national-id';
import { anotar, permisosEfectivos } from './support-access.core';
import { CATALOGOS } from '../fixtures/support-hospital';

/* ============================================================================
    Pacientes para el personal de apoyo, con los códigos de la API:

    - `POST /me/support-patient-search`  búsqueda **exacta**, auditada, con tope de 20 por
      minuto y 200 por día (429 `SUPPORT_PATIENT_SEARCH_THROTTLED`, compartido con el alta);
      lo parcial es 422 `SUPPORT_PATIENT_SEARCH_INEXACT`; los dos nombres de un par con
      valores distintos, 400 `SUPPORT_PATIENT_INPUT_CONFLICT`;
    - `POST /me/support-patients`        alta rápida: 201 `CREATED` o 200 `POSSIBLE_DUPLICATES`;
      documento ya registrado (también una variante: «01.234-567» y «1234567» son el mismo),
      409 `SUPPORT_PATIENT_DOCUMENT_REGISTERED`; documento sin contenido (menos de 4
      caracteres canónicos), 400; menor sin representante, 422
      `SUPPORT_PATIENT_GUARDIAN_REQUIRED`. El paciente creado nace con
      `identityVerified: false` y el representante queda como contacto pendiente de
      verificación (`guardian: { recorded: true, status: 'PENDING_VERIFICATION' }`): el
      mostrador **no** crea representaciones legales y no hay `guardianLink`.
    - 429 `SUPPORT_PATIENT_SEARCH_THROTTLED` con `details: { limit: 'PER_MINUTE' | 'PER_DAY',
      scope: 'PERSON' | 'IP' }`: el tope por persona es de 20 por minuto y 200 por día; el de
      la IP, de 60 y 600, y se cuenta aparte.

    Lo que vuelve son datos mínimos: nombre, edad y documento y teléfono con lo
    central tapado. Nada clínico. Un posible duplicado de **otra organización** viene sin
    perfil, nombre ni edad del registro ajeno: solo `linkedToOrganization: false` y `matchedBy`.
   ========================================================================== */

const MAYORIA_DE_EDAD = 18;

/** Los representantes de los menores de la maqueta; los demás menores no tienen. */
const REPRESENTANTES: Readonly<Record<string, readonly PatientRepresentative[]>> = {
  'Martín Rocha Antelo': [
    { id: uuid('rep-rocha-madre'), name: 'Sandra Antelo Vaca', relationship: 'Madre' },
    { id: uuid('rep-rocha-padre'), name: 'Felipe Rocha Salvatierra', relationship: 'Padre' },
  ],
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digitos(texto: string): string {
  return texto.replace(/\D+/g, '');
}

/** Los últimos ocho dígitos: un celular boliviano, con o sin +591. */
function celular(texto: string): string {
  return digitos(texto).slice(-8);
}

function edadDe(nacimiento: string): number {
  const fecha = new Date(`${nacimiento}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return 0;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad -= 1;
  return Math.max(edad, 0);
}

function tapar(texto: string, visibles: number): string {
  return texto.length <= visibles ? texto : `***${texto.slice(-visibles)}`;
}

/** Cuántos intentos lleva cada persona, para el tope por minuto y por día. Se cuentan búsquedas y altas juntas. */
const intentos = new Map<string, number[]>();
/** El mismo conteo por IP de origen: el navegador del simulador es un solo origen, así que es un solo cubo. */
let intentosPorIp: number[] = [];
const UN_MINUTO = 60_000;
const UN_DIA = 86_400_000;
const TOPE_POR_PERSONA = { minuto: 20, dia: 200 } as const;
const TOPE_POR_IP = { minuto: 60, dia: 600 } as const;

/** Para las pruebas: vuelve a cero lo que cada persona (y el origen) lleva buscado. */
export function reiniciarTopeDeBusquedas(): void {
  intentos.clear();
  intentosPorIp = [];
}

/** Para las pruebas: deja el cubo de la IP en su tope, como si otras cuentas lo hubieran gastado. */
export function agotarTopePorIp(ventana: 'PER_MINUTE' | 'PER_DAY'): void {
  // Los del día quedan de hace dos minutos: llenan el cupo diario sin tocar el del minuto.
  const instante = Date.now() - (ventana === 'PER_DAY' ? 2 * UN_MINUTO : 0);
  intentosPorIp = Array.from({ length: ventana === 'PER_DAY' ? TOPE_POR_IP.dia : TOPE_POR_IP.minuto }, () => instante);
}

function demasiadas(limit: 'PER_MINUTE' | 'PER_DAY', scope: 'PERSON' | 'IP'): MockReply {
  const quien = scope === 'IP' ? 'Desde esta conexión se hicieron' : 'Hizo';
  return reply(429, {
    statusCode: 429,
    code: 'RATE_LIMITED',
    message: `${quien} demasiadas consultas de pacientes: espere antes de volver a intentar`,
    error: 'Too Many Requests',
    reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED',
    details: { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit, scope },
  });
}

function frenada(userId: string): MockReply | null {
  const ahoraMs = Date.now();
  const previos = (intentos.get(userId) ?? []).filter((t) => ahoraMs - t < UN_DIA);
  intentosPorIp = intentosPorIp.filter((t) => ahoraMs - t < UN_DIA);
  const ipEnElMinuto = intentosPorIp.filter((t) => ahoraMs - t < UN_MINUTO).length;
  const personaEnElMinuto = previos.filter((t) => ahoraMs - t < UN_MINUTO).length;
  // Primero la persona, como la API: es el tope que ella puede entender y arreglar.
  if (personaEnElMinuto >= TOPE_POR_PERSONA.minuto || previos.length >= TOPE_POR_PERSONA.dia) {
    intentos.set(userId, previos);
    return demasiadas(previos.length >= TOPE_POR_PERSONA.dia && personaEnElMinuto < TOPE_POR_PERSONA.minuto ? 'PER_DAY' : 'PER_MINUTE', 'PERSON');
  }
  if (ipEnElMinuto >= TOPE_POR_IP.minuto || intentosPorIp.length >= TOPE_POR_IP.dia) {
    intentos.set(userId, previos);
    return demasiadas(intentosPorIp.length >= TOPE_POR_IP.dia && ipEnElMinuto < TOPE_POR_IP.minuto ? 'PER_DAY' : 'PER_MINUTE', 'IP');
  }
  intentos.set(userId, [...previos, ahoraMs]);
  intentosPorIp = [...intentosPorIp, ahoraMs];
  return null;
}

/** Los pacientes que ya son de una organización: los que tienen citas en su agenda o los que se registraron acá. */
const registradosAqui = new Set<string>();
function esDeLaOrganizacion(p: PacienteSimulado, org: string): boolean {
  return registradosAqui.has(p.id) || agendaDePartida().some((f) => f.tenantId === org && (f.patientLabel ?? '').startsWith(p.displayName));
}

const ETIQUETA_DE_OTRA_ORGANIZACION = 'Persona registrada en otra organización';

function vistaDe(p: PacienteSimulado): SupportPatientMatch & { patientProfileId: string } {
  const edad = edadDe(p.birthDate);
  const menor = edad < MAYORIA_DE_EDAD;
  const telefono = celular(p.phone);
  return {
    // El mismo valor con los dos nombres: el contrato compartido y el front usan nombres distintos.
    patientProfileId: p.id,
    profileId: p.id,
    displayName: p.displayName,
    documentMasked: tapar(p.nationalId, 3),
    ...(telefono.length < 8 ? {} : { phoneMasked: `${telefono.slice(0, 1)}******${telefono.slice(-1)}` }),
    ageYears: edad,
    isMinor: menor,
    ...(menor ? { representatives: REPRESENTANTES[p.displayName] ?? [] } : {}),
  };
}

function nombreCompleto(p: PacienteSimulado): string {
  return normalizar([p.name, p.middleName ?? '', p.lastName, p.motherLastName].join(' '));
}

/**
 * Quien pide debe tener un vínculo vigente con la organización que declara. La organización
 * puede venir como `tenantId` **u** `org`, y el documento como `nationalId` **o** `document`:
 * si llegan los dos de un par con valores distintos, 400 `SUPPORT_PATIENT_INPUT_CONFLICT`.
 */
function organizacionDe(request: MockRequest): { org: string } | MockReply {
  const cuerpoOrg = cuerpo<{ tenantId: string; org: string; nationalId: string; document: string }>(request);
  if ((cuerpoOrg.tenantId !== undefined && cuerpoOrg.org !== undefined && cuerpoOrg.tenantId !== cuerpoOrg.org) || (cuerpoOrg.nationalId !== undefined && cuerpoOrg.document !== undefined && cuerpoOrg.nationalId !== cuerpoOrg.document)) {
    return conMotivo(400, 'Los datos del pedido se contradicen: mande un solo valor por dato.', 'SUPPORT_PATIENT_INPUT_CONFLICT');
  }
  const org = cuerpoOrg.tenantId ?? cuerpoOrg.org ?? '';
  const user = request.user;
  if (user === null || CATALOGOS[org] === undefined || permisosEfectivos(user.id, org).length === 0) {
    return forbidden('No tiene un vínculo de apoyo vigente con esta organización.');
  }
  return { org };
}

function esRespuesta(valor: { org: string } | MockReply): valor is MockReply {
  return 'status' in valor;
}

/** Lo parcial no se busca: 422 `SUPPORT_PATIENT_SEARCH_INEXACT`, con el mensaje de cómo buscar. */
const inexacta = (mensaje: string): MockReply => conMotivo(422, mensaje, 'SUPPORT_PATIENT_SEARCH_INEXACT');

export function registrarApoyoPacientes(router: MockRouter): void {
  router.post('/me/support-patient-search', (request) => {
    const contexto = organizacionDe(request);
    if (esRespuesta(contexto)) return contexto;
    const user = request.user!;
    const frenado = frenada(user.id);
    if (frenado !== null) return frenado;
    const entrada = cuerpo<{ nationalId: string; document: string; phone: string; fullName: string; birthDate: string }>(request);
    const datos = { ...entrada, document: entrada.nationalId ?? entrada.document };
    const todos = patientList.todos();
    let hallados: readonly PacienteSimulado[];
    let como: string;
    if (datos.document !== undefined) {
      const documento = normalizar(datos.document).replace(/ /g, '');
      if (documento.length < 6) {
        anotar(contexto.org, user.displayName, 'patient.search_refused', `${user.displayName} intentó una búsqueda parcial por documento y se rechazó.`);
        return inexacta('La búsqueda es exacta: escriba el documento completo del paciente.');
      }
      hallados = todos.filter((p) => normalizar(p.nationalId).replace(/ /g, '') === documento);
      como = 'documento';
    } else if (datos.phone !== undefined) {
      const telefono = digitos(datos.phone);
      if (telefono.length < 8) {
        anotar(contexto.org, user.displayName, 'patient.search_refused', `${user.displayName} intentó una búsqueda parcial por teléfono y se rechazó.`);
        return inexacta('La búsqueda es exacta: escriba el teléfono completo, con todos sus dígitos.');
      }
      hallados = todos.filter((p) => celular(p.phone) === celular(telefono));
      como = 'teléfono';
    } else if (datos.fullName !== undefined && datos.birthDate !== undefined) {
      const palabras = normalizar(datos.fullName).split(' ').filter((w) => w.length > 1);
      if (palabras.length < 2) {
        anotar(contexto.org, user.displayName, 'patient.search_refused', `${user.displayName} intentó una búsqueda parcial por nombre y se rechazó.`);
        return inexacta('La búsqueda es exacta: escriba el nombre completo (nombre y apellido) y la fecha de nacimiento.');
      }
      hallados = todos.filter((p) => p.birthDate === datos.birthDate && palabras.every((w) => nombreCompleto(p).split(' ').includes(w)));
      como = 'nombre y fecha de nacimiento';
    } else {
      anotar(contexto.org, user.displayName, 'patient.search_refused', `${user.displayName} intentó una búsqueda parcial de pacientes y se rechazó.`);
      return inexacta('La búsqueda es exacta: documento completo, teléfono completo, o nombre completo con fecha de nacimiento.');
    }
    // Sin desafío (pendiente 58): la API real no pide motivo ni segundo paso al buscar (`SupportPatientSearchDto` no admite motivo);
    // lo que protege a un paciente reservado lo decide el servidor, no un diálogo.
    anotar(contexto.org, user.displayName, 'patient.search', `${user.displayName} buscó a un paciente por ${como}.`);
    const items = hallados.slice(0, 5).map(vistaDe);
    return { items, count: items.length };
  });

  router.post('/me/support-patients', (request) => {
    const contexto = organizacionDe(request);
    if (esRespuesta(contexto)) return contexto;
    const user = request.user!;
    const puede = permisosEfectivos(user.id, contexto.org).some((g) => g.actions.includes('patient.register'));
    if (!puede) return forbidden('Su permiso no incluye registrar pacientes nuevos.');
    const frenado = frenada(user.id);
    if (frenado !== null) return frenado;
    const datos = cuerpo<{
      name: string;
      lastName: string;
      motherLastName: string;
      document: string;
      birthDate: string;
      phone: string;
      guardian: { name: string; document: string; phone: string; relationship: string };
      inviteToPortal: boolean;
      acknowledgeDuplicates: boolean;
    }>(request);
    const nombre = (datos.name ?? '').trim();
    const apellido = (datos.lastName ?? '').trim();
    const documento = (datos.document ?? '').trim();
    if (canonicalNationalId(documento).length < MIN_CANONICAL_NATIONAL_ID_LENGTH) {
      // Un documento «.-.-» no tiene contenido: 400 con el campo, como lo dice la API.
      return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'El documento de identidad no es válido.', error: 'Bad Request', details: { field: 'document' } });
    }
    if (nombre === '' || apellido === '' || documento.length < 5 || celular(datos.phone ?? '').length < 7 || Number.isNaN(new Date(datos.birthDate ?? '').getTime())) {
      return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Faltan datos del paciente: nombre, apellido, documento, fecha de nacimiento y teléfono.', error: 'Bad Request', details: { fields: [{ field: 'patient', message: 'datos incompletos' }] } });
    }
    const menor = edadDe(datos.birthDate!) < MAYORIA_DE_EDAD;
    if (menor && (datos.guardian === undefined || (datos.guardian.name ?? '').trim() === '' || (datos.guardian.document ?? '').trim().length < 5 || celular(datos.guardian.phone ?? '').length < 7 || (datos.guardian.relationship ?? '').trim() === '')) {
      return conMotivo(422, 'Un menor de edad se registra con su representante legal o un familiar autorizado: indique su nombre, documento, teléfono y parentesco.', 'SUPPORT_PATIENT_GUARDIAN_REQUIRED');
    }
    // Ya registrado también si es otra forma del mismo documento: «01.234-567» y «1234567».
    if (patientList.todos().some((p) => canonicalNationalId(p.nationalId) === canonicalNationalId(documento))) {
      return conMotivo(409, 'Ese documento ya está registrado. Búsquelo por documento en lugar de registrarlo de nuevo.', 'SUPPORT_PATIENT_DOCUMENT_REGISTERED');
    }
    if (datos.acknowledgeDuplicates !== true) {
      const completo = normalizar([nombre, apellido, datos.motherLastName ?? ''].join(' '));
      const palabras = completo.split(' ').filter((w) => w.length > 1);
      const parecidos = patientList
        .todos()
        .flatMap((p) => {
          const porNombre = p.birthDate === datos.birthDate && palabras.every((w) => nombreCompleto(p).split(' ').includes(w));
          const porTelefono = celular(p.phone) === celular(datos.phone!) && normalizar(p.lastName) === normalizar(apellido);
          return porNombre || porTelefono ? [{ p, basis: [...(porNombre ? ['NAME_AND_BIRTH_DATE'] : []), ...(porTelefono ? ['PHONE_AND_SURNAME'] : [])] }] : [];
        });
      if (parecidos.length > 0) {
        anotar(contexto.org, user.displayName, 'patient.duplicate_warning', `${user.displayName} recibió un aviso de posible duplicado al registrar a un paciente.`);
        const declarada = edadDe(datos.birthDate!);
        return {
          outcome: 'POSSIBLE_DUPLICATES',
          duplicates: parecidos.slice(0, 5).map(({ p, basis }) =>
            esDeLaOrganizacion(p, contexto.org)
              ? { ...vistaDe(p), linkedToOrganization: true, matchedBy: basis }
              : // De otra organización: sin perfil, nombre ni edad ajenos; lo tapado y la edad son lo que se escribió.
                { displayName: ETIQUETA_DE_OTRA_ORGANIZACION, documentMasked: tapar(documento, 3), ageYears: declarada, isMinor: declarada < MAYORIA_DE_EDAD, linkedToOrganization: false, matchedBy: basis },
          ),
        };
      }
    }
    const id = uuid(`hp-paciente-${documento}-${Date.now()}`);
    const nuevo: PacienteSimulado = {
      id,
      personId: uuid(`person-${id}`),
      userId: uuid(`user-${id}`),
      patientCode: `PAC-${Date.now() % 100000}`,
      displayName: [nombre, apellido, (datos.motherLastName ?? '').trim()].filter((p) => p !== '').join(' '),
      name: nombre,
      lastName: apellido,
      motherLastName: (datos.motherLastName ?? '').trim(),
      birthDate: datos.birthDate!,
      nationalId: documento,
      email: '',
      phone: datos.phone!,
      municipioId: '',
      departamentoId: '',
      ocupacionId: '',
      direccion: '',
      deceased: false,
      identityVerified: false,
    };
    patientList.agregar(nuevo);
    registradosAqui.add(nuevo.id);
    anotar(contexto.org, user.displayName, 'patient.register', `${user.displayName} registró a un paciente nuevo${datos.inviteToPortal === true ? ' y lo invitó a activar su cuenta' : ''}.`);
    return {
      status: 201,
      body: {
        outcome: 'CREATED',
        patient: { ...vistaDe(nuevo), ...(menor && datos.guardian !== undefined ? { representatives: [{ id: uuid(`rep-${id}`), name: datos.guardian.name, relationship: datos.guardian.relationship }] } : {}) },
        // `true` solo quiere decir que la invitación quedó encolada.
        invitationSent: datos.inviteToPortal === true,
        // Nadie comprobó el documento: lo escribió el mostrador.
        identityVerified: false,
        // El representante queda como contacto pendiente de verificación; la respuesta es la misma tenga o no cuenta.
        ...(menor && datos.guardian !== undefined ? { guardian: { recorded: true, status: 'PENDING_VERIFICATION' } } : {}),
      },
    };
  });
}
