import { conceptoPorId } from '../fixtures/conceptos';
import { CONCEPTO, conversaciones, vitrinaDe } from '../fixtures/comunidad';
import { PACIENTES, type PacienteSimulado } from '../fixtures/personas';
import { forbidden, notFound, preconditionFailed, validation, type MockRequest, type MockRouter } from '../mock-router';
import { bodyAsQuery, Coleccion, cuerpo, nuevoId, paginar, texto, uuid } from '../mock-store';
import { perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Directorio de pacientes de la aseguradora — `POST /insurance/patients/search`.

    La pantalla vino de `dev` (PR #955), donde la sirve la API real. En la
    maqueta no había quien contestara y el pedido caía en `[mock] sin manejador`.

    Las personas son las mismas que presentan solicitudes en «Solicitudes
    recibidas»: las escritas y las primeras generadas. Las de
    `USUARIO_PACIENTES_1.md` quedan fuera, igual que allá: exponer en un
    directorio a alguien que existe sería afirmar algo sobre esa persona.

    Sólo filiación y contacto, nada clínico: es lo que promete el contrato.
    ========================================================================== */

/** Las mismas que siembra «Solicitudes recibidas». */
const PACIENTES_DEL_DIRECTORIO = PACIENTES.slice(0, 60);

/** El catálogo rotula en inglés; la maqueta guarda `GEN-F`/`GEN-M`. */
const GENERO_DEL_CONTRATO: Readonly<Record<string, string>> = {
  'GEN-F': 'GENDER_FEMALE',
  'GEN-M': 'GENDER_MALE',
};

export interface PacienteDelDirectorio {
  readonly id: string;
  readonly patientProfileId: string;
  readonly fullName: string;
  readonly birthDate: string;
  readonly phone: string;
  readonly email: string;
  readonly genderConceptId: string | null;
  readonly genderCode: string | null;
  readonly occupationDisplay: string | null;
  readonly insurers: readonly { readonly id: string; readonly name: string }[];
  readonly createdAt: string;
}

function idDeAseguradora(nombre: string): string {
  return uuid(`directory-insurer-${nombre}`);
}

function fila(paciente: PacienteSimulado, indice: number): PacienteDelDirectorio {
  const genero = paciente.generoId === undefined ? undefined : conceptoPorId(paciente.generoId);
  return {
    id: paciente.id,
    patientProfileId: paciente.id,
    fullName: paciente.displayName,
    birthDate: paciente.birthDate,
    phone: paciente.phone,
    email: paciente.email,
    genderConceptId: paciente.generoId ?? null,
    genderCode: genero === undefined ? null : (GENERO_DEL_CONTRATO[genero.code] ?? null),
    occupationDisplay: conceptoPorId(paciente.ocupacionId)?.display ?? null,
    insurers:
      paciente.aseguradora === undefined
        ? []
        : [{ id: idDeAseguradora(paciente.aseguradora), name: paciente.aseguradora }],
    // Antigüedad estable: el orden por alta no cambia entre recargas.
    createdAt: new Date(Date.UTC(2025, 0, 1 + indice)).toISOString(),
  };
}

/** Años cumplidos a hoy, por fecha civil. */
function edad(nacimiento: string): number {
  const [anio, mes, dia] = nacimiento.split('-').map(Number) as [number, number, number];
  const hoy = new Date();
  const cumplio = hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
  return hoy.getFullYear() - anio - (cumplio ? 0 : 1);
}

function comoRenglon(p: PacienteDelDirectorio) {
  return {
    patientProfileId: p.patientProfileId,
    fullName: p.fullName,
    birthDate: p.birthDate,
    age: edad(p.birthDate),
    phone: p.phone,
    email: p.email,
    ...(p.genderCode === null ? {} : { genderCode: p.genderCode }),
    ...(p.occupationDisplay === null ? {} : { occupationDisplay: p.occupationDisplay }),
    insurers: p.insurers,
    messaging: { channel: 'internal' as const, available: vitrinaDe(p.patientProfileId) !== undefined },
  };
}

const ORDENES: Readonly<Record<string, (a: PacienteDelDirectorio, b: PacienteDelDirectorio) => number>> = {
  fullName: (a, b) => a.fullName.localeCompare(b.fullName, 'es'),
  birthDate: (a, b) => a.birthDate.localeCompare(b.birthDate),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
};

function puedeVer(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return perteneceALaAseguradora(request) || roles.includes('SUPERADMIN') || roles.includes('SECURITY_ADMIN');
}

export interface OpcionesDelDirectorio {
  /** Las pruebas la apagan: cada una arranca de la siembra limpia. */
  readonly persistir?: boolean;
}

export function registerInsurerPatients(router: MockRouter, { persistir = true }: OpcionesDelDirectorio = {}): void {
  let tabla: Coleccion<PacienteDelDirectorio> | null = null;
  const pacientes = (): Coleccion<PacienteDelDirectorio> =>
    (tabla ??= new Coleccion(PACIENTES_DEL_DIRECTORIO.map((p, i) => fila(p, i)), persistir ? 'mock.insurance.patients' : undefined));

  router.post('/insurance/patients/search', (request) => {
    if (!puedeVer(request)) return forbidden();
    const query = bodyAsQuery(request);
    const busqueda = texto(query, 'search')?.toLocaleLowerCase('es') ?? null;
    const genero = texto(query, 'genderConceptId');
    const ocupacion = texto(query, 'occupation')?.toLocaleLowerCase('es') ?? null;
    const aseguradora = texto(query, 'insuranceCarrierId');
    const sinSeguro = texto(query, 'insuranceStatus') === 'NO_INSURANCE';
    const desde = texto(query, 'birthDateFrom');
    const hasta = texto(query, 'birthDateTo');
    if (desde !== null && hasta !== null && desde > hasta) {
      return validation('Rango de fechas inválido', [{ field: 'birthDateFrom', problem: 'Debe ser anterior o igual a birthDateTo' }]);
    }

    const orden = ORDENES[texto(query, 'sortBy') ?? 'fullName'] ?? ORDENES['fullName']!;
    const sentido = texto(query, 'sortDirection') === 'desc' ? -1 : 1;
    const filtrados = pacientes()
      .filtrar(
        (p) =>
          (busqueda === null ||
            [p.fullName, p.email, p.phone].some((v) => v.toLocaleLowerCase('es').includes(busqueda))) &&
          (genero === null || p.genderConceptId === genero) &&
          (ocupacion === null || (p.occupationDisplay ?? '').toLocaleLowerCase('es').includes(ocupacion)) &&
          (aseguradora === null || p.insurers.some((i) => i.id === aseguradora)) &&
          (!sinSeguro || p.insurers.length === 0) &&
          (desde === null || p.birthDate >= desde) &&
          (hasta === null || p.birthDate <= hasta),
      )
      .sort((a, b) => orden(a, b) * sentido);

    const pagina = paginar(filtrados.map(comoRenglon), query, 25);
    return { items: pagina.items, total: pagina.count, limit: pagina.limit, nextCursor: pagina.nextCursor };
  });

  router.get('/insurance/patients/options', (request) => {
    if (!puedeVer(request)) return forbidden();
    const porId = new Map<string, { id: string; name: string }>();
    for (const p of pacientes().todos()) for (const i of p.insurers) porId.set(i.id, i);
    return { insurers: [...porId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')) };
  });

  router.post('/insurance/patients/conversation', (request) => {
    if (!puedeVer(request)) return forbidden();
    const { patientProfileId } = cuerpo<{ patientProfileId: string; channel: string }>(request);
    const paciente = patientProfileId === undefined ? undefined : pacientes().get(patientProfileId);
    if (paciente === undefined) return notFound('El paciente no está en el directorio');

    // Las dos puntas necesitan perfil de mensajería: es lo que pide la API. El
    // de la aseguradora es el de su organización, no el de la cuenta.
    const usuario = request.user!;
    const tenant = request.headers.get('X-Tenant-Id') ?? usuario.tenants[0] ?? '';
    const propia = vitrinaDe(tenant) ?? vitrinaDe(usuario.id);
    const suya = vitrinaDe(paciente.patientProfileId);
    if (propia === undefined || suya === undefined) {
      return preconditionFailed('Ambos deben tener la mensajería activa', { reason: 'MESSAGING_UNAVAILABLE' });
    }
    const participantes = [propia.id, suya.id];
    const existente = conversaciones.filtrar(
      (c) => c.participantes.length === 2 && participantes.every((p) => c.participantes.includes(p)),
    )[0];
    const conversacion =
      existente ??
      conversaciones.agregar({
        id: nuevoId('conv'),
        conversationTypeConceptId: CONCEPTO.conversationDirect,
        groupId: null,
        participantes,
        noLeidosPor: {},
      });
    return { conversationId: conversacion.id };
  });
}
