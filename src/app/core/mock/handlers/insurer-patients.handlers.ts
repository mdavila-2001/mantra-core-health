import { CONCEPT, conversationList, showcaseOf, type SimulatedShowcase } from '../fixtures/community';
import { conceptById } from '../fixtures/concepts';
import { patientById, patientList, type PacienteSimulado } from '../fixtures/people';
import {
  forbidden,
  notFound,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { cuerpo, nuevoId, uuid } from '../mock-store';
import { ASEGURADORAS as ASEGURADORAS_DEL_CATALOGO, perteneceALaAseguradora } from './insurance.handlers';
import { ASEGURADORAS as NOMBRES_DE_ASEGURADORAS } from '../faker';

/* ============================================================================
    Directorio autorizado de pacientes de la aseguradora:

      · POST /insurance/patients/search        — la página, con total exacto
      · GET  /insurance/patients/options       — aseguradoras del alcance
      · POST /insurance/patients/conversation  — abrir el chat interno

    Sin estos tres manejadores la pantalla «Pacientes» de la aseguradora caía en
    el 501 genérico del simulador, con cualquier sesión.

    Las reglas son las de `InsurerPatientsService` de la API, no unas más
    generosas:

      · **Alcance.** `SECURITY_ADMIN` y `SUPERADMIN` leen el padrón autorizado
        (todos los pacientes, con todas las aseguradoras). Una sesión cuya
        organización activa es la aseguradora lee sólo a quienes tienen
        cobertura con ella, y ve únicamente esa aseguradora. Cualquier otra
        sesión es 403: el front no autoriza, y ocultar el menú tampoco.
      · **Filtros.** Nunca amplían el alcance: se aplican dentro de él.
      · **Respuesta mínima.** Filiación y contacto, nada clínico; el total es
        exacto y el cursor es opaco.
      · **Mensajería.** Sólo hay «chat interno» si el paciente tiene perfil de
        comunidad y quien escribe también lo tiene; si no, 422.
    ========================================================================== */

const TAMANOS_DE_PAGINA = [10, 25, 50] as const;
const TAMANO_POR_OMISION = 25;
const ESTADOS_DE_SEGURO = ['ALL', 'WITH_INSURANCE', 'NO_INSURANCE'] as const;
const ORDENES = ['fullName', 'birthDate', 'createdAt'] as const;
const ACCESO_DENEGADO = 'Sin acceso al directorio de pacientes';

type EstadoDeSeguro = (typeof ESTADOS_DE_SEGURO)[number];
type Orden = (typeof ORDENES)[number];

interface Aseguradora {
  readonly id: string;
  readonly name: string;
}

interface Consulta {
  readonly cursor?: string;
  readonly limit?: number;
  readonly search?: string;
  readonly genderConceptId?: string;
  readonly occupation?: string;
  readonly insuranceCarrierId?: string;
  readonly birthDateFrom?: string;
  readonly birthDateTo?: string;
  readonly insuranceStatus?: EstadoDeSeguro;
  readonly sortBy?: Orden;
  readonly sortDirection?: 'asc' | 'desc';
}

/** Sin tildes y en minúsculas: el «contiene» de la API ignora los acentos. */
function plano(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Todas las aseguradoras que el padrón conoce: las del catálogo y las que los
 * pacientes de ejemplo declaran sin tener catálogo propio (BISA, Univida…), con
 * el mismo id que arma la red de aseguradoras para ellas.
 */
function todasLasAseguradoras(): readonly Aseguradora[] {
  const delCatalogo = ASEGURADORAS_DEL_CATALOGO.map(({ id, name }) => ({ id, name }));
  const sueltas = NOMBRES_DE_ASEGURADORAS.filter(
    (nombre) => !delCatalogo.some((aseguradora) => plano(aseguradora.name) === plano(nombre)),
  ).map((nombre) => ({ id: uuid(`carrier-${nombre}`), name: nombre }));
  return [...delCatalogo, ...sueltas];
}

/** Las aseguradoras que el actor puede consultar, o `null` si no tiene acceso. */
function alcance(request: MockRequest): readonly Aseguradora[] | null {
  const roles = request.user?.roles ?? [];
  const todas = todasLasAseguradoras();
  if (roles.includes('SECURITY_ADMIN') || roles.includes('SUPERADMIN')) return todas;
  // La aseguradora de la sesión del simulador es la primera del catálogo (Seguros Andina).
  if (perteneceALaAseguradora(request)) return todas.slice(0, 1);
  return null;
}

/**
 * Las aseguradoras con las que el paciente tiene cobertura vigente, dentro del
 * alcance. La maqueta guarda una sola por paciente, por su nombre corto.
 */
function aseguradorasDe(paciente: PacienteSimulado, visibles: readonly Aseguradora[]): Aseguradora[] {
  if (paciente.aseguradora === undefined) return [];
  const nombre = plano(paciente.aseguradora);
  return visibles.filter((aseguradora) => plano(aseguradora.name) === nombre);
}

function edadA(nacimiento: string, hoy: Date): number {
  const [anio, mes, dia] = nacimiento.split('-').map(Number) as [number, number, number];
  let edad = hoy.getUTCFullYear() - anio;
  if (hoy.getUTCMonth() + 1 < mes || (hoy.getUTCMonth() + 1 === mes && hoy.getUTCDate() < dia)) edad -= 1;
  return edad;
}

function nombreCompleto(paciente: PacienteSimulado): string {
  return [paciente.name, paciente.middleName, paciente.lastName, paciente.motherLastName]
    .filter((parte): parte is string => parte !== undefined && parte !== '')
    .join(' ');
}

function ocupacionDe(paciente: PacienteSimulado): string | undefined {
  const texto = paciente.ocupacionTexto?.trim();
  if (texto) return texto;
  return conceptById(paciente.ocupacionId)?.display;
}

function codigoDeGenero(paciente: PacienteSimulado): string | undefined {
  if (paciente.sexAtBirth === 'MALE') return 'GENDER_MALE';
  if (paciente.sexAtBirth === 'FEMALE') return 'GENDER_FEMALE';
  return undefined;
}

/** `true` si el paciente tiene perfil de comunidad: sin él no hay chat interno. */
function tieneChat(paciente: PacienteSimulado): boolean {
  return showcaseOf(paciente.id) !== undefined;
}

/** El cuerpo ya con su forma de `InsurerPatientSearchQueryDto`, o el motivo del 400. */
function leerConsulta(request: MockRequest): Consulta | string {
  const cuerpoCrudo = cuerpo<Record<string, unknown>>(request);
  const texto = (clave: string): string | undefined => {
    const valor = cuerpoCrudo[clave];
    return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
  };
  const limit = cuerpoCrudo['limit'];
  if (limit !== undefined && !(TAMANOS_DE_PAGINA as readonly unknown[]).includes(Number(limit))) {
    return 'limit must be one of the following values: 10, 25, 50';
  }
  const estado = texto('insuranceStatus') ?? 'ALL';
  if (!(ESTADOS_DE_SEGURO as readonly string[]).includes(estado)) {
    return 'insuranceStatus must be one of the following values: ALL, WITH_INSURANCE, NO_INSURANCE';
  }
  const orden = texto('sortBy') ?? 'fullName';
  if (!(ORDENES as readonly string[]).includes(orden)) {
    return 'sortBy must be one of the following values: fullName, birthDate, createdAt';
  }
  const sentido = texto('sortDirection') ?? 'asc';
  if (sentido !== 'asc' && sentido !== 'desc') {
    return 'sortDirection must be one of the following values: asc, desc';
  }
  for (const clave of ['birthDateFrom', 'birthDateTo']) {
    const fecha = texto(clave);
    if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return `${clave} must be a valid ISO 8601 date string`;
    }
  }
  return {
    cursor: texto('cursor'),
    limit: limit === undefined ? undefined : Number(limit),
    search: texto('search'),
    genderConceptId: texto('genderConceptId'),
    occupation: texto('occupation'),
    insuranceCarrierId: texto('insuranceCarrierId'),
    birthDateFrom: texto('birthDateFrom'),
    birthDateTo: texto('birthDateTo'),
    insuranceStatus: estado as EstadoDeSeguro,
    sortBy: orden as Orden,
    sortDirection: sentido,
  };
}

function decodificarCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  try {
    const { desde } = JSON.parse(atob(cursor)) as { desde?: unknown };
    return typeof desde === 'number' && Number.isInteger(desde) && desde >= 0 ? desde : null;
  } catch {
    return null;
  }
}

function codificarCursor(desde: number): string {
  return btoa(JSON.stringify({ desde }));
}

export function registrarPacientesDeAseguradora(router: MockRouter): void {
  /** Los pacientes del alcance con sus aseguradoras, ya filtrados por la consulta. */
  function filtrar(consulta: Consulta, visibles: readonly Aseguradora[], soloConCobertura: boolean) {
    const busqueda = consulta.search === undefined ? null : plano(consulta.search);
    const profesion = consulta.occupation === undefined ? null : plano(consulta.occupation);
    return patientList
      .todos()
      .map((paciente) => ({ paciente, aseguradoras: aseguradorasDe(paciente, visibles) }))
      .filter(({ paciente, aseguradoras }) => {
        // El alcance de una aseguradora son sus afiliados; el del padrón, todos.
        if (soloConCobertura && aseguradoras.length === 0) return false;
        if (consulta.insuranceStatus === 'WITH_INSURANCE' && aseguradoras.length === 0) return false;
        if (consulta.insuranceStatus === 'NO_INSURANCE' && aseguradoras.length > 0) return false;
        if (
          consulta.insuranceCarrierId !== undefined &&
          !aseguradoras.some((aseguradora) => aseguradora.id === consulta.insuranceCarrierId)
        ) {
          return false;
        }
        if (consulta.genderConceptId !== undefined && paciente.generoId !== consulta.genderConceptId) {
          return false;
        }
        if (profesion !== null && !plano(ocupacionDe(paciente) ?? '').includes(profesion)) return false;
        if (consulta.birthDateFrom !== undefined && (!paciente.birthDate || paciente.birthDate < consulta.birthDateFrom)) return false;
        if (consulta.birthDateTo !== undefined && (!paciente.birthDate || paciente.birthDate > consulta.birthDateTo)) return false;
        if (busqueda !== null) {
          const pajar = plano(`${nombreCompleto(paciente)} ${paciente.phone} ${paciente.email}`);
          if (!pajar.includes(busqueda)) return false;
        }
        return true;
      });
  }

  router.post('/insurance/patients/search', (request) => {
    const visibles = alcance(request);
    if (visibles === null) return forbidden(ACCESO_DENEGADO);

    const consulta = leerConsulta(request);
    if (typeof consulta === 'string') return validation('Error de validación', [{ message: consulta }]);
    const desde = decodificarCursor(consulta.cursor);
    if (desde === null) return validation('Error de validación', [{ field: 'cursor', message: 'is not valid' }]);

    const soloConCobertura = !(request.user?.roles ?? []).some(
      (rol) => rol === 'SECURITY_ADMIN' || rol === 'SUPERADMIN',
    );
    const orden = consulta.sortBy ?? 'fullName';
    const sentido = consulta.sortDirection === 'desc' ? -1 : 1;
    const filas = filtrar(consulta, visibles, soloConCobertura).sort((a, b) => {
      const clave =
        orden === 'birthDate'
          ? a.paciente.birthDate.localeCompare(b.paciente.birthDate)
          : orden === 'createdAt'
            ? a.paciente.patientCode.localeCompare(b.paciente.patientCode)
            : nombreCompleto(a.paciente).localeCompare(nombreCompleto(b.paciente), 'es');
      // El desempate por id hace estable el cursor.
      return (clave !== 0 ? clave : a.paciente.id.localeCompare(b.paciente.id)) * sentido;
    });

    const limit = consulta.limit ?? TAMANO_POR_OMISION;
    const pagina = filas.slice(desde, desde + limit);
    const hoy = new Date();
    return {
      items: pagina.map(({ paciente, aseguradoras }) => ({
        patientProfileId: paciente.id,
        fullName: nombreCompleto(paciente),
        // El alta de mostrador no pide la fecha: sin ella no hay edad que inventar.
        ...(paciente.birthDate ? { birthDate: paciente.birthDate, age: edadA(paciente.birthDate, hoy) } : {}),
        phone: paciente.phone,
        email: paciente.email,
        ...(codigoDeGenero(paciente) === undefined ? {} : { genderCode: codigoDeGenero(paciente) }),
        ...(ocupacionDe(paciente) === undefined ? {} : { occupationDisplay: ocupacionDe(paciente) }),
        insurers: aseguradoras,
        messaging: { channel: 'internal', available: tieneChat(paciente) },
      })),
      total: filas.length,
      limit,
      nextCursor: desde + limit < filas.length ? codificarCursor(desde + limit) : null,
    };
  });

  router.get('/insurance/patients/options', (request) => {
    const visibles = alcance(request);
    if (visibles === null) return forbidden(ACCESO_DENEGADO);
    return {
      insurers: [...visibles].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    };
  });

  router.post('/insurance/patients/conversation', (request) => {
    const visibles = alcance(request);
    if (visibles === null) return forbidden(ACCESO_DENEGADO);

    const datos = cuerpo<{ patientProfileId?: unknown; channel?: unknown }>(request);
    if (typeof datos.patientProfileId !== 'string' || datos.patientProfileId === '') {
      return validation('Error de validación', [{ message: 'patientProfileId must be a UUID' }]);
    }
    if (datos.channel !== 'internal') {
      return validation('Error de validación', [{ message: 'channel must be one of the following values: internal' }]);
    }

    // Un paciente fuera del alcance no se distingue de uno que no existe.
    const paciente = patientById(datos.patientProfileId);
    const soloConCobertura = !(request.user?.roles ?? []).some(
      (rol) => rol === 'SECURITY_ADMIN' || rol === 'SUPERADMIN',
    );
    if (
      paciente === undefined ||
      (soloConCobertura && aseguradorasDe(paciente, visibles).length === 0)
    ) {
      return notFound('Paciente fuera del alcance autorizado');
    }

    const user = request.user;
    const vitrinaDelPaciente = showcaseOf(paciente.id);
    const vitrinaDeQuienEscribe: SimulatedShowcase | undefined =
      user === null
        ? undefined
        : (showcaseOf(user.practitionerProfileId ?? user.patientProfileId ?? user.id) ?? showcaseOf(user.id));
    if (vitrinaDelPaciente === undefined || vitrinaDeQuienEscribe === undefined) {
      return reply(422, {
        statusCode: 422,
        code: 'MESSAGING_UNAVAILABLE',
        message: 'Perfiles no disponibles para mensajería',
      });
    }

    const participantes = [vitrinaDeQuienEscribe.id, vitrinaDelPaciente.id];
    const existente = conversationList
      .todos()
      .find(
        (c) =>
          c.groupId === null &&
          c.participantes.length === 2 &&
          participantes.every((id) => c.participantes.includes(id)),
      );
    const conversacion =
      existente ??
      conversationList.agregar({
        id: nuevoId('conv-aseguradora'),
        conversationTypeConceptId: CONCEPT.conversationDirect,
        groupId: null,
        participantes,
        noLeidosPor: {},
      });
    return { conversationId: conversacion.id };
  });
}
