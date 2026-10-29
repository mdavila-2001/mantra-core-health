import { ADMISSION_SOURCES, DISCHARGE_DISPOSITIONS, LEVELS_OF_CARE, OVERRIDE_MIN_LENGTH, TRANSFER_REASONS } from '../../data-access/adt/adt.catalog';
import { blockingOf, overridableOf } from '../../data-access/adt/adt.logic';
import {
  CENSUS_FIELDS,
  type AdmissionRequest,
  type AdmissionResult,
  type BedBoard,
  type CensusField,
  type CensusResponse,
  type CompatibilityViolation,
  type InpatientRow,
  type OverrideRequest,
  type StayView,
} from '../../data-access/adt/adt.types';
import { SITIO_ADT } from '../fixtures/adt.data';
import { MEDICAL, PATIENTS } from '../fixtures/people';
import { notFound, noContent, reply, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo, nuevoId } from '../mock-store';

/** El cuerpo con su tipo completo: lo que falta lo comprueba cada ruta, no el compilador. */
const leer = <T extends object>(request: { readonly body: unknown }): T => cuerpo<T>(request) as T;
import {
  aislamientoDe,
  ajustes,
  ajustesDe,
  calcularIndicadores,
  camasDelSitio,
  celda,
  cerradoDe,
  cerrarDia,
  censosCerrados,
  completarLimpieza,
  conflicto,
  corteDeDia,
  diaDeCenso,
  disposicionDe,
  emitir,
  estadoDeEncuentro,
  evaluarCompatibilidad,
  eventos,
  fuenteDe,
  GRACIA_CIERRE_MIN,
  hoyLocal,
  incidenteVisible,
  incidentes,
  ingresoDe,
  ingresos,
  marcarSucia,
  movimiento,
  nivelDe,
  noPermitido,
  nombreDeProfesional,
  opsCamas,
  opsDe,
  ordenes,
  pacienteDe,
  pacienteResumido,
  pedidoDe,
  perfilAdt,
  puedeOperarCamas,
  puedeVerCenso,
  referenciaDeCama,
  regla,
  registrarOcupacion,
  requestId,
  sembrarCamasAdt,
  sembrarCensosPasados,
  sincronizarClinica,
  totalesAjustados,
  transaccion,
  punto,
  ubicaciones,
  ubicacionActiva,
  ubicacionReservada,
  ubicacionesDe,
  unidadDeCama,
  unidadesCensables,
  unidadesConCamas,
  veDatosDePaciente,
  versionVieja,
  viewerDe,
  VENTANA_CANCELACION_MIN,
  type IngresoSim,
  type PedidoDeCompatibilidad,
  type PerfilAdt,
  type UbicacionSim,
} from './adt.store';
import { atrasoDeLectura, espacios, sitioPropio } from './infrastructure.store';
import { episodeList, encounterList } from '../fixtures/clinic';
import { ENCOUNTER_STATUS, STATUS } from '../fixtures/concepts';

/* ============================================================================
    Backend simulado de internación / ADT — franja F3.

    Contesta cada fila de la tabla de `§F3.3` de `CONTRATO-F2-F5.md` con su
    cuerpo y sus errores: 409 `PATIENT_ALREADY_ADMITTED`, `BED_NOT_ASSIGNABLE`
    (con `details.violations`), `BED_DOUBLE_OCCUPANCY`, `ENCOUNTER_ALREADY_HAS_BED`,
    `ENCOUNTER_HAS_NO_BED`, `SWAP_*`, `CENSUS_ALREADY_CLOSED`; 422
    `BED_COMPATIBILITY_OVERRIDE_REQUIRED`, `OVERRIDE_*`, `TRANSFER_TO_SAME_BED`,
    `CENSUS_DATE_NOT_ENDED`…; 403 `INFRA_ACTION_NOT_ALLOWED` con
    `requiredRoles`; 412 ante un `If-Match` viejo; y 404 —igual que un id
    inexistente— ante un establecimiento o encuentro de otro tenant.

    El `reason` viaja en `details.reason` y el `code` es uno de los del contrato
    de errores (`CONFLICT`, `PRECONDITION_FAILED`, `FORBIDDEN`…), que es lo que
    ramifica `errorToViewState`.

    Toda operación que mueve más de una fila corre en `transaccion`: o queda
    todo o no queda nada (INV-33).
    ========================================================================== */

type Resultado<T> = { ok: true; valor: T } | { ok: false; respuesta: MockReply };

const AHORA = (): string => new Date().toISOString();
/** Instante de una lectura, atrasado lo que pida `mock:infra-antiguedad` (la maqueta del S7). */
const LECTURA = (): string => new Date(Date.now() - atrasoDeLectura() * 60_000).toISOString();
const CODIGOS = <T extends { code: string }>(lista: readonly T[]): string[] => lista.map((x) => x.code);

function exigir(request: MockRequest, permitido: (p: PerfilAdt) => boolean, roles: readonly string[]): { perfil: PerfilAdt } | MockReply {
  const perfil = perfilAdt(request);
  return permitido(perfil) ? { perfil } : noPermitido(roles);
}

const esRespuesta = (x: unknown): x is MockReply => typeof x === 'object' && x !== null && 'status' in x && 'body' in x;

const ROLES_OPERAR = ['NURSE', 'ADMISSION'];

/** `If-Match` del encuentro: ausente = no se compara; presente y distinto = 412. */
function versionDelEncuentro(request: MockRequest, actual: number): MockReply | null {
  const cabecera = request.headers.get('If-Match');
  if (cabecera === null) return null;
  return Number(cabecera.replaceAll('"', '')) === actual ? null : versionVieja();
}

function aplicarOverride(
  violaciones: readonly CompatibilityViolation[],
  override: OverrideRequest | undefined,
  perfil: PerfilAdt,
): Resultado<{ forzadas: readonly CompatibilityViolation[] }> {
  const bloqueantes = blockingOf(violaciones);
  if (bloqueantes.length > 0) {
    return { ok: false, respuesta: conflicto('BED_NOT_ASSIGNABLE', 'La cama no se puede asignar a esta persona.', { violations: violaciones }) };
  }
  const forzables = overridableOf(violaciones);
  if (forzables.length === 0) return { ok: true, valor: { forzadas: [] } };
  if (override === undefined) {
    return { ok: false, respuesta: regla('BED_COMPATIBILITY_OVERRIDE_REQUIRED', 'La cama no es compatible; forzarla exige justificación y supervisión.', { violations: violaciones }) };
  }
  if (perfil !== 'SUPERVISION') return { ok: false, respuesta: noPermitido(['NURSE_SUPERVISOR']) };
  if ((override.justification ?? '').trim().length < OVERRIDE_MIN_LENGTH) {
    return { ok: false, respuesta: regla('OVERRIDE_JUSTIFICATION_TOO_SHORT', `La justificación necesita al menos ${OVERRIDE_MIN_LENGTH} caracteres.`) };
  }
  const reglasForzables = new Set(forzables.map((v) => v.rule));
  const pedidas = override.ruleCodes ?? [];
  if (pedidas.some((r) => !reglasForzables.has(r))) {
    return { ok: false, respuesta: regla('OVERRIDE_RULE_NOT_OVERRIDABLE', 'Una de las reglas indicadas no se puede forzar.') };
  }
  if ([...reglasForzables].some((r) => !pedidas.includes(r))) {
    return { ok: false, respuesta: regla('BED_COMPATIBILITY_OVERRIDE_REQUIRED', 'La justificación no cubre todas las reglas incumplidas.', { violations: violaciones }) };
  }
  return { ok: true, valor: { forzadas: forzables } };
}

function crearIncidente(i: IngresoSim, u: UbicacionSim, forzadas: readonly CompatibilityViolation[], override: OverrideRequest, perfil: PerfilAdt): string {
  const id = nuevoId('placement-incident');
  incidentes.agregar({
    id,
    encounterId: i.id,
    encounterLocationId: u.id,
    careSpaceId: u.careSpaceId,
    violations: forzadas.map((v) => ({ rule: v.rule, detail: v.detail })),
    justificationText: override.justification.trim(),
    authorizedBy: perfil === 'SUPERVISION' ? 'Supervisión de enfermería' : 'Usuario',
    createdAt: AHORA(),
    status: 'PLC_INC_OPEN',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  });
  ubicaciones.actualizar(u.id, { incidentId: id });
  emitir('clinical.adt.placement_override', 'ADT^A01', i.id, { incidentId: id, rules: forzadas.map((v) => v.rule) });
  return id;
}

/** La carrera: otra persona ocupa la cama justo antes de confirmar (`mock:adt-carrera=1`). */
function carreraPorCama(careSpaceId: string): MockReply | null {
  try {
    if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('mock:adt-carrera') !== '1') return null;
    sessionStorage.removeItem('mock:adt-carrera');
  } catch {
    return null;
  }
  ocuparConRival(careSpaceId);
  return conflicto('BED_DOUBLE_OCCUPANCY', 'La base rechazó la segunda ocupación de la cama (EXCLUDE).');
}

let rivales = 0;

/** Otra sesión ocupa la cama: una internación de urgencia de un paciente que la semilla no usa. */
function ocuparConRival(careSpaceId: string): void {
  const rival = PATIENTS[19 + (rivales++ % 20)]!;
  const idRival = nuevoId('adt-rival');
  ingresos.agregar({
    id: idRival,
    episodeId: nuevoId('adt-episode'),
    patientProfileId: rival.id,
    siteId: SITIO_ADT,
    attendingId: MEDICAL.id,
    levelOfCare: 'LOC_CARE_GENERAL',
    admissionSource: 'ADM_SRC_EMERGENCY',
    isolation: 'ISO_NONE',
    isolationOrganism: null,
    reasonText: 'Ingreso de urgencia (otra sesión)',
    expectedDischargeAt: null,
    status: 'IN_PROGRESS',
    startAt: AHORA(),
    endAt: null,
    disposition: null,
    rowVersion: 1,
  });
  ubicaciones.agregar({
    id: nuevoId('adt-loc'),
    encounterId: idRival,
    careSpaceId,
    status: 'LOCATION_ACTIVE',
    movementType: 'ADT_ADMIT',
    previousLocationId: null,
    endReason: null,
    periodStart: AHORA(),
    periodEnd: null,
    bedCategory: null,
    incidentId: null,
  });
  sincronizarClinica();
}

function cama(id: string) {
  const e = espacios.get(id);
  return e !== undefined && e.siteId === SITIO_ADT ? e : undefined;
}

/* ---- vistas ---------------------------------------------------------------------------------- */

function vistaDeEstancia(i: IngresoSim, perfil: PerfilAdt): StayView {
  const p = pacienteDe(i);
  const activa = ubicacionActiva(i.id) ?? ubicacionReservada(i.id);
  const unidad = activa === undefined ? null : unidadDeCama(espacios.get(activa.careSpaceId)!);
  const fin = i.endAt ?? AHORA();
  return {
    encounter: {
      id: i.id,
      siteId: i.siteId,
      episodeId: i.episodeId,
      patient: pacienteResumido(p),
      status: estadoDeEncuentro(i.status),
      levelOfCare: nivelDe(i.levelOfCare),
      admissionSource: fuenteDe(i.admissionSource),
      isolation: aislamientoDe(i.isolation),
      isolationOrganism: i.isolationOrganism,
      reasonText: i.reasonText,
      attendingName: nombreDeProfesional(i.attendingId),
      startAt: i.startAt,
      endAt: i.endAt,
      expectedDischargeAt: i.expectedDischargeAt,
      dischargeDisposition: disposicionDe(i.disposition),
      unitName: unidad?.name ?? null,
      rowVersion: i.rowVersion,
      losDays: Math.max(1, Math.floor((Date.parse(fin) - Date.parse(i.startAt)) / 86_400_000)),
    },
    currentBed: activa === undefined ? null : referenciaDeCama(espacios.get(activa.careSpaceId)!),
    movements: ubicacionesDe(i.id).map(movimiento),
    incidents: incidentes.filtrar((x) => x.encounterId === i.id).map(incidenteVisible),
    asOf: LECTURA(),
    viewer: viewerDe(perfil),
  };
}

function filaDeCensoVivo(i: IngresoSim): InpatientRow {
  const activa = ubicacionActiva(i.id) ?? ubicacionReservada(i.id);
  const cama = activa === undefined ? null : espacios.get(activa.careSpaceId)!;
  return {
    encounterId: i.id,
    patient: pacienteResumido(pacienteDe(i)),
    bed: cama === null ? null : referenciaDeCama(cama),
    since: activa?.periodStart ?? i.startAt,
    levelOfCare: nivelDe(i.levelOfCare),
    isolation: aislamientoDe(i.isolation),
    expectedDischargeAt: i.expectedDischargeAt,
    losDays: Math.max(1, Math.floor((Date.now() - Date.parse(i.startAt)) / 86_400_000)),
    unitName: cama === null ? null : (unidadDeCama(cama)?.name ?? null),
  };
}

/* ---- rutas --------------------------------------------------------------------------------------- */

export function registerAdt(router: MockRouter): void {
  sembrarCamasAdt();
  sembrarCensosPasados(SITIO_ADT);
  instalarAyudasDeDemostracion();

  router.post('/clinical/encounters/:id/bed-compatibility', (request) => {
    const perm = exigir(request, veDatosDePaciente, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const i = ingresoDe(request.params['id']!);
    if (i === undefined) return notFound();
    const destino = cama(leer<{ careSpaceId: string }>(request).careSpaceId ?? '');
    if (destino === undefined) return notFound('Cama no encontrada');
    if (destino.form !== 'LOC_FORM_BED') return regla('SPACE_NOT_A_BED', 'El espacio no es una cama.');
    const v = evaluarCompatibilidad(destino, pedidoDe(i));
    return { assignable: v.length === 0, violations: v };
  });

  // DESVÍO F3-A (propuesta): la compatibilidad antes de que exista el encuentro.
  router.post('/clinical/admissions/bed-compatibility', (request) => {
    const perm = exigir(request, veDatosDePaciente, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const datos = leer<{ patientProfileId: string; careSpaceId: string; levelOfCareCode: string; isolationPrecautionCode?: string; isolationOrganismText?: string }>(request);
    const p = PATIENTS.find((x) => x.id === datos.patientProfileId);
    const destino = cama(datos.careSpaceId ?? '');
    if (p === undefined || destino === undefined) return notFound();
    const pedido: PedidoDeCompatibilidad = {
      paciente: p,
      nivel: datos.levelOfCareCode ?? 'LOC_CARE_GENERAL',
      aislamiento: datos.isolationPrecautionCode ?? 'ISO_NONE',
      organismo: datos.isolationOrganismText ?? null,
    };
    const v = evaluarCompatibilidad(destino, pedido);
    return { assignable: v.length === 0, violations: v };
  });

  router.post('/clinical/admissions', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const b = leer<AdmissionRequest>(request);
    const faltan: { field: string; message: string }[] = [];
    if (!b.patientProfileId) faltan.push({ field: 'patientProfileId', message: 'es obligatorio' });
    if (!b.practiceSiteId) faltan.push({ field: 'practiceSiteId', message: 'es obligatorio' });
    if (!b.attendingPractitionerId) faltan.push({ field: 'attendingPractitionerId', message: 'es obligatorio' });
    if (!CODIGOS(LEVELS_OF_CARE).includes(b.levelOfCareCode ?? '')) faltan.push({ field: 'levelOfCareCode', message: 'no es un nivel de cuidado válido' });
    if (!CODIGOS(ADMISSION_SOURCES).includes(b.admissionSourceCode ?? '')) faltan.push({ field: 'admissionSourceCode', message: 'no es una procedencia válida' });
    if ((b.reasonText ?? '').trim() === '') faltan.push({ field: 'reasonText', message: 'es obligatorio' });
    if (faltan.length > 0) return validation('Error de validación', faltan);

    if (sitioPropio(b.practiceSiteId) === undefined) return notFound();
    const p = PATIENTS.find((x) => x.id === b.patientProfileId);
    if (p === undefined) return notFound('Paciente no encontrado');
    if (ingresos.filtrar((x) => x.patientProfileId === p.id && x.status === 'IN_PROGRESS').length > 0) {
      return conflicto('PATIENT_ALREADY_ADMITTED', 'La persona ya tiene una internación en curso.');
    }

    const destino = b.bed === undefined ? undefined : cama(b.bed.careSpaceId);
    let forzadas: readonly CompatibilityViolation[] = [];
    const pedido: PedidoDeCompatibilidad = {
      paciente: p,
      nivel: b.levelOfCareCode,
      aislamiento: b.isolationPrecautionCode ?? 'ISO_NONE',
      organismo: b.isolationOrganismText?.trim() || null,
    };
    if (b.bed !== undefined) {
      if (destino === undefined) return notFound('Cama no encontrada');
      if (destino.form !== 'LOC_FORM_BED') return regla('SPACE_NOT_A_BED', 'El espacio no es una cama.');
      const r = aplicarOverride(evaluarCompatibilidad(destino, pedido), b.override, perm.perfil);
      if (!r.ok) return r.respuesta;
      forzadas = r.valor.forzadas;
      const rival = carreraPorCama(destino.id);
      if (rival !== null) return rival;
    }

    const resultado = transaccion((): AdmissionResult => {
      const encounterId = nuevoId('adt-encounter');
      const episodeId = b.episodeId ?? nuevoId('adt-episode');
      ingresos.agregar({
        id: encounterId,
        episodeId,
        patientProfileId: p.id,
        siteId: b.practiceSiteId,
        attendingId: b.attendingPractitionerId,
        levelOfCare: b.levelOfCareCode,
        admissionSource: b.admissionSourceCode,
        isolation: b.isolationPrecautionCode ?? 'ISO_NONE',
        isolationOrganism: b.isolationOrganismText?.trim() || null,
        reasonText: b.reasonText.trim(),
        expectedDischargeAt: b.expectedDischargeAt ?? null,
        status: 'IN_PROGRESS',
        startAt: AHORA(),
        endAt: null,
        disposition: null,
        rowVersion: 1,
      });
      punto('admision:tras-encuentro');
      let encounterLocationId: string | undefined;
      let incidentId: string | undefined;
      if (b.bed !== undefined && destino !== undefined) {
        encounterLocationId = nuevoId('adt-loc');
        const reservar = b.bed.mode === 'RESERVE';
        const u: UbicacionSim = {
          id: encounterLocationId,
          encounterId,
          careSpaceId: destino.id,
          status: reservar ? 'LOCATION_RESERVED' : 'LOCATION_ACTIVE',
          movementType: reservar ? 'ADT_RESERVE' : 'ADT_ADMIT',
          previousLocationId: null,
          endReason: null,
          periodStart: AHORA(),
          periodEnd: null,
          bedCategory: destino.bedCategory,
          incidentId: null,
        };
        ubicaciones.agregar(u);
        registrarOcupacion(destino.id, 'OCC_FREE', reservar ? 'OCC_RESERVED' : 'OCC_OCCUPIED', encounterLocationId);
        if (forzadas.length > 0 && b.override !== undefined) incidentId = crearIncidente(ingresos.get(encounterId)!, u, forzadas, b.override, perm.perfil);
      }
      emitir(b.bed?.mode === 'RESERVE' ? 'clinical.adt.reservation_created' : 'clinical.adt.admitted', b.bed?.mode === 'RESERVE' ? 'ADT^A15' : 'ADT^A01', encounterId, { episodeId, careSpaceId: b.bed?.careSpaceId ?? null });
      sincronizarClinica();
      return {
        episodeId,
        encounterId,
        ...(encounterLocationId === undefined ? {} : { encounterLocationId }),
        ...(destino === undefined ? {} : { cell: celda(destino, perm.perfil) }),
        ...(incidentId === undefined ? {} : { incidentId }),
      };
    });
    return reply(201, resultado);
  });

  router.post('/clinical/encounters/:id/bed-assignment', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const i = ingresoDe(request.params['id']!);
    if (i === undefined) return notFound();
    const viejo = versionDelEncuentro(request, i.rowVersion);
    if (viejo !== null) return viejo;
    if (i.status !== 'IN_PROGRESS') return conflicto('ENCOUNTER_NOT_IN_PROGRESS', 'La internación ya no está en curso.');
    if (ubicacionActiva(i.id) !== undefined) return conflicto('ENCOUNTER_ALREADY_HAS_BED', 'La internación ya tiene cama; use traslado.');
    const b = leer<{ careSpaceId: string; mode: 'ASSIGN' | 'RESERVE'; override?: OverrideRequest }>(request);
    const destino = cama(b.careSpaceId ?? '');
    if (destino === undefined) return notFound('Cama no encontrada');
    if (destino.form !== 'LOC_FORM_BED') return regla('SPACE_NOT_A_BED', 'El espacio no es una cama.');
    const propia = ubicacionReservada(i.id);
    const r = aplicarOverride(evaluarCompatibilidad(destino, pedidoDe(i, propia?.careSpaceId === destino.id ? { encounterId: i.id } : {})), b.override, perm.perfil);
    if (!r.ok) return r.respuesta;
    const rival = carreraPorCama(destino.id);
    if (rival !== null) return rival;

    const resultado = transaccion(() => {
      const reservar = b.mode === 'RESERVE';
      let ubicacion: UbicacionSim;
      if (propia !== undefined && propia.careSpaceId === destino.id && !reservar) {
        ubicacion = ubicaciones.actualizar(propia.id, { status: 'LOCATION_ACTIVE', movementType: 'ADT_ADMIT', periodEnd: null })!;
      } else {
        if (propia !== undefined) ubicaciones.actualizar(propia.id, { status: 'LOCATION_CANCELLED', endReason: 'ADT_END_RESERVATION_CANCELLED', periodEnd: AHORA() });
        ubicacion = ubicaciones.agregar({
          id: nuevoId('adt-loc'),
          encounterId: i.id,
          careSpaceId: destino.id,
          status: reservar ? 'LOCATION_RESERVED' : 'LOCATION_ACTIVE',
          movementType: reservar ? 'ADT_RESERVE' : 'ADT_ADMIT',
          previousLocationId: null,
          endReason: null,
          periodStart: AHORA(),
          periodEnd: null,
          bedCategory: destino.bedCategory,
          incidentId: null,
        });
      }
      ingresos.actualizar(i.id, { rowVersion: i.rowVersion + 1 });
      registrarOcupacion(destino.id, 'OCC_FREE', reservar ? 'OCC_RESERVED' : 'OCC_OCCUPIED', ubicacion.id);
      const incidentId = r.valor.forzadas.length > 0 && b.override !== undefined ? crearIncidente(i, ubicacion, r.valor.forzadas, b.override, perm.perfil) : undefined;
      emitir(reservar ? 'clinical.adt.reservation_created' : 'clinical.adt.bed_assigned', reservar ? 'ADT^A15' : 'ADT^A01', i.id, { careSpaceId: destino.id });
      return { encounterLocationId: ubicacion.id, cell: celda(destino, perm.perfil), ...(incidentId === undefined ? {} : { incidentId }) };
    });
    return reply(200, resultado);
  });

  router.post('/clinical/encounters/:id/transfer', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const i = ingresoDe(request.params['id']!);
    if (i === undefined) return notFound();
    const viejo = versionDelEncuentro(request, i.rowVersion);
    if (viejo !== null) return viejo;
    if (i.status !== 'IN_PROGRESS') return conflicto('ENCOUNTER_NOT_IN_PROGRESS', 'La internación ya no está en curso.');
    const origen = ubicacionActiva(i.id);
    if (origen === undefined) return conflicto('ENCOUNTER_HAS_NO_BED', 'La internación no tiene cama.');
    const b = leer<{ toCareSpaceId: string; occurredAt?: string; reasonCode: string; override?: OverrideRequest }>(request);
    const destino = cama(b.toCareSpaceId ?? '');
    if (destino === undefined) return notFound('Cama no encontrada');
    if (destino.form !== 'LOC_FORM_BED') return regla('SPACE_NOT_A_BED', 'El espacio no es una cama.');
    if (destino.id === origen.careSpaceId) return regla('TRANSFER_TO_SAME_BED', 'El destino es la cama actual.');
    if ((b.reasonCode ?? '') === '' || !CODIGOS(TRANSFER_REASONS).includes(b.reasonCode)) {
      return validation('Error de validación', [{ field: 'reasonCode', message: 'no es un motivo de traslado válido' }]);
    }
    const t = b.occurredAt ?? AHORA();
    if (Date.parse(t) > Date.now() + 60_000) return regla('OCCURRED_AT_IN_FUTURE', 'La hora del traslado es futura.');
    if (Date.parse(t) < Date.parse(origen.periodStart)) return regla('OCCURRED_AT_BEFORE_CURRENT_START', 'La hora es anterior al inicio de la ubicación actual.');
    const r = aplicarOverride(evaluarCompatibilidad(destino, pedidoDe(i)), b.override, perm.perfil);
    if (!r.ok) return r.respuesta;
    const rival = carreraPorCama(destino.id);
    if (rival !== null) return rival;

    const resultado = transaccion(() => {
      ubicaciones.actualizar(origen.id, { status: 'LOCATION_COMPLETED', endReason: 'ADT_END_TRANSFER_OUT', periodEnd: t });
      punto('traslado:tras-cerrar-origen');
      const nueva = ubicaciones.agregar({
        id: nuevoId('adt-loc'),
        encounterId: i.id,
        careSpaceId: destino.id,
        status: 'LOCATION_ACTIVE',
        movementType: 'ADT_TRANSFER',
        previousLocationId: origen.id,
        endReason: null,
        periodStart: t,
        periodEnd: null,
        bedCategory: destino.bedCategory,
        incidentId: null,
      });
      const terminal = i.isolation !== 'ISO_NONE' || opsDe(origen.careSpaceId).isolation !== 'ISO_NONE';
      const orden = marcarSucia(origen.careSpaceId, 'CLN_TRG_TRANSFER', terminal, origen.id, t);
      registrarOcupacion(origen.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', origen.id);
      registrarOcupacion(destino.id, 'OCC_FREE', 'OCC_OCCUPIED', nueva.id);
      ingresos.actualizar(i.id, { rowVersion: i.rowVersion + 1 });
      if (r.valor.forzadas.length > 0 && b.override !== undefined) crearIncidente(i, nueva, r.valor.forzadas, b.override, perm.perfil);
      emitir('clinical.adt.transferred', 'ADT^A02', i.id, { from: origen.careSpaceId, to: destino.id, previous: origen.id });
      return { fromLocationId: origen.id, toLocationId: nueva.id, cleaningOrderId: orden };
    });
    return resultado;
  });

  router.post('/clinical/bed-swaps', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const b = leer<{ encounterAId: string; encounterBId: string; occurredAt?: string; reasonText: string; override?: OverrideRequest }>(request);
    if ((b.reasonText ?? '').trim() === '') return validation('Error de validación', [{ field: 'reasonText', message: 'es obligatorio' }]);
    if (b.encounterAId === b.encounterBId) return conflicto('SWAP_SAME_ENCOUNTER', 'Son la misma internación.');
    const a = ingresoDe(b.encounterAId ?? '');
    const c = ingresoDe(b.encounterBId ?? '');
    if (a === undefined || c === undefined) return notFound();
    const ua = ubicacionActiva(a.id);
    const uc = ubicacionActiva(c.id);
    if (ua === undefined || uc === undefined) return conflicto('SWAP_REQUIRES_TWO_OCCUPIED_BEDS', 'Las dos internaciones necesitan una cama ocupada.');
    const t = b.occurredAt ?? AHORA();
    if (Date.parse(t) > Date.now() + 60_000) return regla('OCCURRED_AT_IN_FUTURE', 'La hora del intercambio es futura.');
    if (Date.parse(t) < Math.max(Date.parse(ua.periodStart), Date.parse(uc.periodStart))) {
      return regla('OCCURRED_AT_BEFORE_CURRENT_START', 'La hora es anterior al inicio de una de las ubicaciones.');
    }
    const camaA = espacios.get(ua.careSpaceId)!;
    const camaC = espacios.get(uc.careSpaceId)!;
    // Compatibilidad cruzada: A va a la cama de C y C a la de A; cada cama la ocupa hoy el otro.
    const cruzada = [
      ...evaluarCompatibilidad(camaC, pedidoDe(a, { ignorarOcupanteDe: c.id })),
      ...evaluarCompatibilidad(camaA, pedidoDe(c, { ignorarOcupanteDe: a.id })),
    ];
    const r = aplicarOverride(cruzada, b.override, perm.perfil);
    if (!r.ok) return r.respuesta;

    const resultado = transaccion(() => {
      // Con la `EXCLUDE` diferida el estado intermedio no falla; aquí el orden de las filas es el de la transacción.
      ubicaciones.actualizar(ua.id, { status: 'LOCATION_COMPLETED', endReason: 'ADT_END_SWAP', periodEnd: t });
      ubicaciones.actualizar(uc.id, { status: 'LOCATION_COMPLETED', endReason: 'ADT_END_SWAP', periodEnd: t });
      punto('intercambio:tras-cerrar');
      const nuevaA = ubicaciones.agregar({ id: nuevoId('adt-loc'), encounterId: a.id, careSpaceId: camaC.id, status: 'LOCATION_ACTIVE', movementType: 'ADT_SWAP', previousLocationId: ua.id, endReason: null, periodStart: t, periodEnd: null, bedCategory: camaC.bedCategory, incidentId: null });
      const nuevaC = ubicaciones.agregar({ id: nuevoId('adt-loc'), encounterId: c.id, careSpaceId: camaA.id, status: 'LOCATION_ACTIVE', movementType: 'ADT_SWAP', previousLocationId: uc.id, endReason: null, periodStart: t, periodEnd: null, bedCategory: camaA.bedCategory, incidentId: null });
      ingresos.actualizar(a.id, { rowVersion: a.rowVersion + 1 });
      ingresos.actualizar(c.id, { rowVersion: c.rowVersion + 1 });
      registrarOcupacion(camaA.id, 'OCC_OCCUPIED', 'OCC_OCCUPIED', nuevaC.id);
      registrarOcupacion(camaC.id, 'OCC_OCCUPIED', 'OCC_OCCUPIED', nuevaA.id);
      if (r.valor.forzadas.length > 0 && b.override !== undefined) {
        crearIncidente(a, nuevaA, r.valor.forzadas, b.override, perm.perfil);
      }
      emitir('clinical.adt.swapped', 'ADT^A17', a.id, { encounterAId: a.id, encounterBId: c.id });
      return { locations: [ua.id, uc.id, nuevaA.id, nuevaC.id].map((id) => movimiento(ubicaciones.get(id)!)) };
    });
    return reply(200, resultado);
  });

  router.post('/clinical/encounters/:id/discharge', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const i = ingresoDe(request.params['id']!);
    if (i === undefined) return notFound();
    const viejo = versionDelEncuentro(request, i.rowVersion);
    if (viejo !== null) return viejo;
    if (i.status !== 'IN_PROGRESS') return conflicto('ENCOUNTER_NOT_IN_PROGRESS', 'La internación ya no está en curso.');
    const b = leer<{ dischargeDispositionCode: string; occurredAt: string; reasonText?: string; closeEpisode?: boolean }>(request);
    if (!CODIGOS(DISCHARGE_DISPOSITIONS).includes(b.dischargeDispositionCode ?? '')) {
      return regla('DISCHARGE_DISPOSITION_REQUIRED', 'Indique cómo egresa la persona.');
    }
    const t = b.occurredAt ?? AHORA();
    if (Date.parse(t) > Date.now() + 60_000) return regla('OCCURRED_AT_IN_FUTURE', 'La hora del egreso es futura.');
    if (Date.parse(t) < Date.parse(i.startAt)) return regla('OCCURRED_AT_BEFORE_CURRENT_START', 'La hora es anterior al ingreso.');
    const activa = ubicacionActiva(i.id);
    if (activa !== undefined && Date.parse(t) < Date.parse(activa.periodStart)) return regla('OCCURRED_AT_BEFORE_CURRENT_START', 'La hora es anterior al inicio de la ubicación actual.');

    const resultado = transaccion(() => {
      let orden: string | null = null;
      const reservada = ubicacionReservada(i.id);
      if (reservada !== undefined) {
        ubicaciones.actualizar(reservada.id, { status: 'LOCATION_CANCELLED', endReason: 'ADT_END_RESERVATION_CANCELLED', periodEnd: t });
        registrarOcupacion(reservada.careSpaceId, 'OCC_RESERVED', 'OCC_FREE', reservada.id);
      }
      if (activa !== undefined) {
        ubicaciones.actualizar(activa.id, { status: 'LOCATION_COMPLETED', endReason: 'ADT_END_DISCHARGE', periodEnd: t });
        punto('egreso:tras-cerrar-ubicacion');
        const terminal = i.isolation !== 'ISO_NONE' || opsDe(activa.careSpaceId).isolation !== 'ISO_NONE';
        orden = marcarSucia(activa.careSpaceId, 'CLN_TRG_DISCHARGE', terminal, activa.id, t);
        registrarOcupacion(activa.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', activa.id);
      }
      ingresos.actualizar(i.id, { status: 'FINISHED', endAt: t, disposition: b.dischargeDispositionCode, rowVersion: i.rowVersion + 1 });
      encounterList.actualizar(i.id, { statusConceptId: ENCOUNTER_STATUS['ENCST-FINISHED']!, endAt: t });
      if (b.closeEpisode !== false) episodeList.actualizar(i.episodeId, { statusConceptId: STATUS['ST-CLOSED']!, endAt: t });
      emitir('clinical.adt.discharged', 'ADT^A03', i.id, { disposition: b.dischargeDispositionCode });
      return { encounterId: i.id, cleaningOrderId: orden };
    });
    return resultado;
  });

  router.post('/clinical/encounter-locations/:id/cancel', (request) => {
    const perm = exigir(request, puedeOperarCamas, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const u = ubicaciones.get(request.params['id']!);
    const i = u === undefined ? undefined : ingresoDe(u.encounterId);
    if (u === undefined || i === undefined) return notFound();
    const b = leer<{ reasonText: string }>(request);
    if ((b.reasonText ?? '').trim() === '') return validation('Error de validación', [{ field: 'reasonText', message: 'es obligatorio' }]);

    if (u.status === 'LOCATION_RESERVED') {
      transaccion(() => {
        ubicaciones.actualizar(u.id, { status: 'LOCATION_CANCELLED', endReason: 'ADT_END_RESERVATION_CANCELLED', periodEnd: AHORA() });
        registrarOcupacion(u.careSpaceId, 'OCC_RESERVED', 'OCC_FREE', u.id);
        emitir('clinical.adt.reservation_cancelled', 'ADT^A11', i.id, { reason: b.reasonText.trim() });
      });
      return noContent();
    }
    const ultimo = ubicacionesDe(i.id).filter((x) => x.status === 'LOCATION_ACTIVE').at(-1);
    if (u.status !== 'LOCATION_ACTIVE' || u.movementType !== 'ADT_TRANSFER' || ultimo?.id !== u.id || u.previousLocationId === null) {
      return conflicto('LOCATION_NOT_CANCELLABLE', 'Este movimiento no se puede cancelar.');
    }
    if (Date.now() - Date.parse(u.periodStart) > VENTANA_CANCELACION_MIN * 60_000) {
      return conflicto('ADT_CANCEL_WINDOW_EXPIRED', 'Pasó el plazo para cancelar el traslado.');
    }
    const previa = ubicaciones.get(u.previousLocationId)!;
    if (ocupantePrevio(previa.careSpaceId, i.id)) {
      return conflicto('PREVIOUS_BED_NO_LONGER_AVAILABLE', 'La cama anterior ya no está libre.');
    }
    transaccion(() => {
      ubicaciones.actualizar(u.id, { status: 'LOCATION_CANCELLED', endReason: 'ADT_END_TRANSFER_CANCELLED', periodEnd: AHORA() });
      ubicaciones.actualizar(previa.id, { status: 'LOCATION_ACTIVE', endReason: null, periodEnd: null });
      for (const o of [...opsCamas.todos()].filter((x) => x.id === previa.careSpaceId)) {
        opsCamas.actualizar(o.id, { hygiene: 'HYG_INSPECTED', terminalRequired: false, opsVersion: o.opsVersion + 1, lastEventAt: AHORA() });
      }
      // La orden de limpieza que había nacido del traslado ya no hace falta.
      for (const orden of ordenes.filtrar((o) => o.careSpaceId === previa.careSpaceId && o.status === 'CLN_PENDING' && o.sourceRefId === previa.id)) {
        ordenes.actualizar(orden.id, { status: 'CLN_CANCELLED' });
      }
      registrarOcupacion(u.careSpaceId, 'OCC_OCCUPIED', 'OCC_FREE', u.id);
      registrarOcupacion(previa.careSpaceId, 'OCC_FREE', 'OCC_OCCUPIED', previa.id);
      emitir('clinical.adt.transfer_cancelled', 'ADT^A12', i.id, { reason: b.reasonText.trim() });
    });
    return noContent();
  });

  router.get('/sites/:siteId/inpatients', (request) => {
    if (sitioPropio(request.params['siteId']!) === undefined) return notFound();
    const perm = exigir(request, veDatosDePaciente, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const unidad = request.query.get('unitId');
    const filas = ingresos
      .filtrar((x) => x.siteId === request.params['siteId'] && x.status === 'IN_PROGRESS')
      .map(filaDeCensoVivo)
      .filter((f) => unidad === null || (f.bed !== null && unidadDeCama(espacios.get(f.bed.id)!)?.id === unidad))
      .sort((a, b) => (a.bed?.code ?? 'ZZZ').localeCompare(b.bed?.code ?? 'ZZZ', 'es', { numeric: true }));
    return { items: filas, nextCursor: null, generatedAt: LECTURA(), viewer: viewerDe(perm.perfil) };
  });

  router.get('/clinical/encounters/:id/stay', (request) => {
    const perm = exigir(request, veDatosDePaciente, ROLES_OPERAR);
    if (esRespuesta(perm)) return perm;
    const i = ingresoDe(request.params['id']!);
    return i === undefined ? notFound() : vistaDeEstancia(i, perm.perfil);
  });

  router.patch('/clinical/placement-incidents/:id', (request) => {
    const perm = exigir(request, (p) => p === 'SUPERVISION', ['NURSE_SUPERVISOR', 'INFECTION_CONTROL']);
    if (esRespuesta(perm)) return perm;
    const inc = incidentes.get(request.params['id']!);
    if (inc === undefined) return notFound();
    const b = leer<{ status: 'REVIEWED' | 'CLOSED'; reviewNote: string }>(request);
    if (b.status !== 'REVIEWED' && b.status !== 'CLOSED') return validation('Error de validación', [{ field: 'status', message: 'debe ser REVIEWED o CLOSED' }]);
    if ((b.reviewNote ?? '').trim() === '') return validation('Error de validación', [{ field: 'reviewNote', message: 'es obligatoria' }]);
    const nuevo = incidentes.actualizar(inc.id, {
      status: b.status === 'REVIEWED' ? 'PLC_INC_REVIEWED' : 'PLC_INC_CLOSED',
      reviewedBy: 'Supervisión de enfermería',
      reviewedAt: AHORA(),
      reviewNote: b.reviewNote.trim(),
    })!;
    emitir('clinical.adt.placement_incident_reviewed', 'ADT^A01', inc.id, { status: b.status });
    return incidenteVisible(nuevo);
  });

  /* ---- censo ------------------------------------------------------------------------------------- */

  router.get('/sites/:siteId/census', (request) => {
    const siteId = request.params['siteId']!;
    if (sitioPropio(siteId) === undefined) return notFound();
    const perm = exigir(request, puedeVerCenso, ['NURSE', 'ADMISSION', 'ORG_ADMIN', 'BILLING']);
    if (esRespuesta(perm)) return perm;
    const fecha = request.query.get('date') ?? hoyLocal();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return validation('Error de validación', [{ field: 'date', message: 'debe ser AAAA-MM-DD' }]);
    const unitId = request.query.get('unitId');
    const unidades = unidadesCensables(siteId).filter((u) => unitId === null || u.id === unitId);
    const respuesta: CensusResponse = {
      siteId,
      date: fecha,
      asOf: LECTURA(),
      units: unidades.map((u) => {
        const day = diaDeCenso(siteId, u, fecha);
        return { day, adjustments: day.id === null ? [] : ajustesDe(day.id), adjustedTotals: day.id === null ? null : totalesAjustados(day) };
      }),
      viewer: viewerDe(perm.perfil),
    };
    return respuesta;
  });

  router.post('/sites/:siteId/census/:date/close', (request) => {
    const siteId = request.params['siteId']!;
    if (sitioPropio(siteId) === undefined) return notFound();
    const perm = exigir(request, (p) => viewerDe(p).canCloseCensus, ['ORG_ADMIN', 'ADMISSION', 'NURSE_SUPERVISOR']);
    if (esRespuesta(perm)) return perm;
    const fecha = request.params['date']!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return validation('Error de validación', [{ field: 'date', message: 'debe ser AAAA-MM-DD' }]);
    if (Date.now() < Date.parse(corteDeDia(fecha)) + GRACIA_CIERRE_MIN * 60_000) {
      return regla('CENSUS_DATE_NOT_ENDED', 'El día todavía no terminó.');
    }
    const pedidas = leer<{ unitIds?: string[] }>(request).unitIds;
    const unidades = unidadesCensables(siteId).filter((u) => pedidas === undefined || pedidas.includes(u.id));
    const pendientes = unidades.filter((u) => cerradoDe(siteId, u.id, fecha) === undefined);
    if (pendientes.length === 0) return conflicto('CENSUS_ALREADY_CLOSED', 'Ese censo ya estaba cerrado.');
    const cerrados = pendientes.map((u) => cerrarDia(siteId, u, fecha, 'Cierre manual'));
    for (const d of cerrados) emitir('clinical.census_day.closed', 'ADT^A01', d.id, { date: fecha, unit: d.unit.code });
    return { closed: cerrados };
  });

  router.post('/census-days/:id/adjustments', (request) => {
    const perm = exigir(request, (p) => viewerDe(p).canAdjustCensus, ['ORG_ADMIN', 'NURSE_SUPERVISOR']);
    if (esRespuesta(perm)) return perm;
    const dia = censosCerrados.get(request.params['id']!);
    if (dia === undefined) return notFound();
    const b = leer<{ fieldCode: CensusField; newValue: number; reasonText: string; entryRefId?: string }>(request);
    if (!(CENSUS_FIELDS as readonly string[]).includes(b.fieldCode ?? '')) return regla('ADJUSTMENT_FIELD_INVALID', 'Ese dato del censo no se puede ajustar.');
    if ((b.reasonText ?? '').trim() === '') return regla('ADJUSTMENT_REASON_REQUIRED', 'El ajuste necesita un motivo.');
    if (!Number.isInteger(b.newValue) || b.newValue < 0) return validation('Error de validación', [{ field: 'newValue', message: 'debe ser un entero mayor o igual a cero' }]);
    const previo = totalesAjustados(dia)[b.fieldCode];
    const ajuste = ajustes.agregar({
      id: nuevoId('census-adj'),
      censusDayId: dia.id,
      fieldCode: b.fieldCode,
      previousValue: previo,
      newValue: b.newValue,
      reasonText: b.reasonText.trim(),
      entryRefId: b.entryRefId ?? null,
      adjustedBy: perm.perfil === 'SUPERVISION' ? 'Supervisión de enfermería' : 'Administración de la organización',
      requestId: requestId(),
      createdAt: AHORA(),
    });
    emitir('clinical.census_day.adjusted', 'ADT^A01', dia.id, { field: b.fieldCode, from: previo, to: b.newValue });
    return reply(201, ajuste);
  });

  router.get('/sites/:siteId/inpatient-indicators', (request) => {
    const siteId = request.params['siteId']!;
    if (sitioPropio(siteId) === undefined) return notFound();
    const perm = exigir(request, puedeVerCenso, ['NURSE', 'ADMISSION', 'ORG_ADMIN', 'BILLING']);
    if (esRespuesta(perm)) return perm;
    const hasta = request.query.get('to') ?? hoyLocal();
    const desde = request.query.get('from') ?? hasta;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(desde) || !re.test(hasta) || desde > hasta) {
      return validation('Error de validación', [{ field: 'from', message: 'el período es inválido' }]);
    }
    if ((Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1 > 366) return regla('INDICATOR_RANGE_TOO_LONG', 'El período no puede superar 366 días.');
    return { ...calcularIndicadores(siteId, desde, hasta, request.query.get('unitId')), asOf: LECTURA() };
  });
}

/**
 * El doble de `GET /sites/:siteId/bed-board` (F2). Se registra **al final** de
 * `crearRouterSimulado` y sólo si nadie más registró esa ruta: cuando la franja
 * F2 se integre, su manejador gana y este se vuelve inalcanzable.
 */
export function registerAdtBedBoardDouble(router: MockRouter): void {
  if (router.match('GET', '/sites/x/bed-board') !== null) return;
  router.get('/sites/:siteId/bed-board', (request) => {
    const siteId = request.params['siteId']!;
    if (sitioPropio(siteId) === undefined) return notFound();
    const perfil = perfilAdt(request);
    const unitId = request.query.get('unitId');
    const unidades = unidadesConCamas(siteId).filter((u) => unitId === null || u.id === unitId);
    const ahora = AHORA();
    const board: BedBoard = {
      generatedAt: ahora,
      lastEventAt: ahora,
      nextCursor: null,
      viewer: viewerDe(perfil),
      units: unidades.map((u) => {
        const cells = camasDelSitio(siteId)
          .filter((b) => unidadDeCama(b)?.id === u.id)
          .map((b) => celda(b, perfil));
        const cuenta = (f: (c: (typeof cells)[number]) => boolean): number => cells.filter(f).length;
        return {
          unitId: u.id,
          name: u.name,
          counts: {
            total: cells.length,
            assignable: cuenta((x) => x.assignable),
            occupied: cuenta((x) => x.occupancy.code === 'OCC_OCCUPIED'),
            reserved: cuenta((x) => x.occupancy.code === 'OCC_RESERVED'),
            blocked: cuenta((x) => x.availability.code !== 'SPACE_OP_AVAILABLE'),
            maintenance: cuenta((x) => x.availability.code === 'SPACE_OP_MAINTENANCE'),
            dirty: cuenta((x) => x.hygiene.code === 'HYG_DIRTY'),
            cleaning: cuenta((x) => x.hygiene.code === 'HYG_CLEANING'),
            isolation: cuenta((x) => x.isolation.code !== 'ISO_NONE'),
            contaminated: cuenta((x) => x.hygiene.code === 'HYG_CONTAMINATED'),
          },
          cells,
        };
      }),
    };
    return board;
  });
}

/* ---- auxiliares de la cancelación de traslado ------------------------------------------------------ */

function ocupantePrevio(careSpaceId: string, encounterId: string): boolean {
  return ubicaciones.filtrar((x) => x.careSpaceId === careSpaceId && x.encounterId !== encounterId && (x.status === 'LOCATION_ACTIVE' || x.status === 'LOCATION_RESERVED')).length > 0;
}

/* ---- ayudas de demostración ------------------------------------------------------------------------- */

interface AyudasDeAdt {
  completarLimpieza(code: string): boolean;
  eventos(): readonly { eventType: string; hl7: string; aggregateId: string; payload: unknown }[];
  ocupacionPorCodigo(): Readonly<Record<string, string | null>>;
  /** Otra sesión ocupa la cama antes de que se confirme (para ver el rechazo por cama ocupada). */
  tomarCama(code: string): boolean;
  /** El id de perfil de un paciente de la maqueta, por apellido (para armar enlaces en la evidencia). */
  pacienteId(apellido: string): string | null;
}

/**
 * `window.__adtSim`: ayudas de la **maqueta** para la evidencia de navegador.
 * No son parte del contrato ni existen contra la API real: cierran el ciclo de
 * limpieza que en producción hace F2 y leen el registro de eventos del
 * simulador (lo más cercano a «SELECT del outbox» que tiene una maqueta).
 */
function instalarAyudasDeDemostracion(): void {
  if (typeof window === 'undefined') return;
  const ayudas: AyudasDeAdt = {
    completarLimpieza,
    pacienteId: (apellido) => PATIENTS.find((p) => p.lastName === apellido)?.id ?? null,
    tomarCama: (code) => {
      const e = espacios.filtrar((x) => x.siteId === SITIO_ADT && x.code === code)[0];
      if (e === undefined) return false;
      ocuparConRival(e.id);
      return true;
    },
    eventos: () => eventos.todos().map(({ eventType, hl7, aggregateId, payload }) => ({ eventType, hl7, aggregateId, payload })),
    ocupacionPorCodigo: () =>
      Object.fromEntries(camasDelSitio(SITIO_ADT).map((b) => [b.code, celda(b, 'SUPERVISION').occupancy.encounterId ?? null])),
  };
  (window as unknown as { __adtSim?: AyudasDeAdt }).__adtSim = ayudas;
}

