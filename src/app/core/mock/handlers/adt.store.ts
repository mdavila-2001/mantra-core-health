import type {
  AdtConcept,
  AdtViewer,
  BedBoardCell,
  CensusAdjustment,
  CensusDay,
  CensusField,
  CompatibilityRule,
  CompatibilityViolation,
  IndicatorsByUnit,
  InpatientIndicators,
  PlacementIncident,
  StayBedRef,
  StayMovement,
  StayPatient,
} from '../../data-access/adt/adt.types';
import { CENSUS_FIELDS } from '../../data-access/adt/adt.types';
import { stayDays } from '../../data-access/adt/adt.logic';
import {
  ADMISSION_SOURCES,
  DISCHARGE_DISPOSITIONS,
  ISOLATION_PRECAUTIONS,
  LEVELS_OF_CARE,
} from '../../data-access/adt/adt.catalog';
import {
  ESPACIOS_ADT,
  EN_MANTENIMIENTO,
  HISTORIA,
  OFFSET_SEDE_MIN,
  SITIO_ADT,
  SUCIAS_HOY,
  VIVAS,
  unidadDe,
  type EstanciaSemilla,
} from '../fixtures/adt.data';
import { CATALOGO, c, UNIDADES_SEMILLA, type EspacioSim } from '../fixtures/infrastructure.data';
import { ENCOUNTER_CLASS, ENCOUNTER_STATUS, STATUS } from '../fixtures/concepts';
import { EPISODE_TYPE, encounterList, episodeList } from '../fixtures/clinic';
import { MEDICAL, PATIENTS, PROFESSIONALS } from '../fixtures/people';
import type { PacienteSimulado } from '../fixtures/people.types';
import { TENANT_CLINICA } from '../mock-session';
import { reply, type MockReply, type MockRequest } from '../mock-router';
import { Coleccion, nuevoId, uuid } from '../mock-store';
import { concepto, espacios, vigente, vinculos } from './infrastructure.store';

/* ============================================================================
    Estado y reglas del backend simulado de internación / ADT (franja F3).

    Aquí viven las colecciones (persistidas en `sessionStorage`), la regla de
    compatibilidad de `§F3.2`, el doble del tablero de F2 que F3 necesita
    (celdas, higiene, órdenes de limpieza), los movimientos atómicos y el
    cálculo del censo y de los indicadores. Las rutas están en
    `adt.handlers.ts`.

    ## Lo que NO está escrito

    Ni una cifra del censo ni de los indicadores: se **calculan** de las
    ubicaciones (`encounter_locations`) con las definiciones del contrato, tanto
    la vista previa del día abierto como el snapshot que se congela al cerrar.
    Cerrar un día lo congela y ya no se puede tocar (`GuardaDeInmutabilidad`);
    una corrección es una fila aparte en los ajustes.

    ## Lo que es una simplificación del simulador

    - Los permisos salen de los roles del token (ver `perfilAdt`); la API real
      los resuelve por asignación delegada. `sessionStorage['mock:adt-perfil']`
      permite ver el 403 de cada perfil.
    - El ciclo de higiene (limpiar → inspeccionar) es de F2: aquí el doble sólo
      marca sucia y crea la orden; `window.__adtSim.completarLimpieza(código)`
      cierra el ciclo para poder demostrar «vuelve a ser asignable».
    - La carrera (`mock:adt-carrera`): otra persona ocupa la cama justo antes
      de confirmar → 409 `BED_DOUBLE_OCCUPANCY`.
    - `infra.inspection_required = false`, `infra.adt_cancel_window_minutes = 120`,
      `infra.census_close_grace_minutes = 15`, `infra.swap_requires_cleaning = false`.
    ========================================================================== */

export const VENTANA_CANCELACION_MIN = 120;
export const GRACIA_CIERRE_MIN = 15;

/* ---- tiempo en la zona de la sede -------------------------------------------- */

const MIN = 60_000;
const DIA = 86_400_000;

/** `YYYY-MM-DD` del instante, en la zona de la sede. */
export function fechaLocal(instante: string | number | Date): string {
  const ms = typeof instante === 'number' ? instante : new Date(instante).getTime();
  return new Date(ms + OFFSET_SEDE_MIN * MIN).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

/** 00:00 del día, en la zona de la sede, como instante ISO. */
export function inicioDeDia(fecha: string): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) - OFFSET_SEDE_MIN * MIN).toISOString();
}

/** El corte del censo del día `fecha`: 00:00 del día siguiente. */
export function corteDeDia(fecha: string): string {
  return inicioDeDia(sumarDias(fecha, 1));
}

export const hoyLocal = (): string => fechaLocal(Date.now());

/** `dias` atrás, a la `hora` local de la sede. */
export function haceLocal(dias: number, hora: number): string {
  return new Date(Date.parse(inicioDeDia(sumarDias(hoyLocal(), -dias))) + hora * 60 * MIN).toISOString();
}

/* ---- filas ------------------------------------------------------------------------ */

export interface IngresoSim {
  readonly id: string;
  readonly episodeId: string;
  readonly patientProfileId: string;
  readonly siteId: string;
  readonly attendingId: string;
  readonly levelOfCare: string;
  readonly admissionSource: string;
  readonly isolation: string;
  readonly isolationOrganism: string | null;
  readonly reasonText: string;
  readonly expectedDischargeAt: string | null;
  status: 'IN_PROGRESS' | 'FINISHED';
  readonly startAt: string;
  endAt: string | null;
  disposition: string | null;
  rowVersion: number;
}

export type EstadoUbicacion = 'LOCATION_ACTIVE' | 'LOCATION_COMPLETED' | 'LOCATION_RESERVED' | 'LOCATION_CANCELLED';
export type TipoMovimiento = 'ADT_ADMIT' | 'ADT_TRANSFER' | 'ADT_SWAP' | 'ADT_RESERVE';
export type MotivoFin =
  | 'ADT_END_DISCHARGE'
  | 'ADT_END_TRANSFER_OUT'
  | 'ADT_END_SWAP'
  | 'ADT_END_RESERVATION_CANCELLED'
  | 'ADT_END_TRANSFER_CANCELLED'
  | 'ADT_END_RESERVATION_CONVERTED';

export interface UbicacionSim {
  readonly id: string;
  readonly encounterId: string;
  readonly careSpaceId: string;
  status: EstadoUbicacion;
  readonly movementType: TipoMovimiento;
  readonly previousLocationId: string | null;
  endReason: MotivoFin | null;
  readonly periodStart: string;
  periodEnd: string | null;
  readonly bedCategory: string | null;
  incidentId: string | null;
}

export interface IncidenteSim {
  readonly id: string;
  readonly encounterId: string;
  readonly encounterLocationId: string;
  readonly careSpaceId: string;
  readonly violations: readonly { rule: CompatibilityRule; detail: string }[];
  readonly justificationText: string;
  readonly authorizedBy: string;
  readonly createdAt: string;
  status: 'PLC_INC_OPEN' | 'PLC_INC_REVIEWED' | 'PLC_INC_CLOSED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface OpsCamaSim {
  /** = id del espacio. */
  readonly id: string;
  hygiene: 'HYG_CLEAN' | 'HYG_DIRTY' | 'HYG_CLEANING' | 'HYG_INSPECTED' | 'HYG_CONTAMINATED';
  hygieneSince: string;
  terminalRequired: boolean;
  availability: 'SPACE_OP_AVAILABLE' | 'SPACE_OP_MAINTENANCE' | 'SPACE_OP_BLOCKED_CLINICAL';
  availabilityReason: string | null;
  availabilityUntil: string | null;
  availabilitySince: string;
  isolation: string;
  isolationOrganism: string | null;
  opsVersion: number;
  lastEventAt: string;
}

export interface OrdenLimpiezaSim {
  readonly id: string;
  readonly careSpaceId: string;
  readonly type: 'DISCHARGE' | 'TERMINAL';
  readonly trigger: 'CLN_TRG_DISCHARGE' | 'CLN_TRG_TRANSFER';
  status: 'CLN_PENDING' | 'CLN_IN_PROGRESS' | 'CLN_DONE' | 'CLN_INSPECTED' | 'CLN_CANCELLED';
  readonly sourceRefId: string;
  /** Instante del egreso o del traslado que la originó (inicio del cronómetro de rotación). */
  readonly releasedAt: string;
  readonly requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  inspectedAt: string | null;
}

export interface BloqueoSim {
  readonly id: string;
  readonly careSpaceId: string;
  readonly from: string;
  readonly to: string | null;
}

export interface CensoSim extends CensusDay {
  /** Para la colección: `id` nunca es null en lo guardado. */
  readonly id: string;
}

export interface AjusteSim extends CensusAdjustment {
  /** Sólo para `Coleccion`; igual que `id`. */
  readonly idFila?: never;
}

export interface EventoSim {
  readonly id: string;
  readonly eventType: string;
  readonly hl7: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly requestId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/* ---- semillas ---------------------------------------------------------------------- */

export function paciente(clave: string | number): PacienteSimulado {
  const p = typeof clave === 'number' ? PATIENTS[clave] : PATIENTS.find((x) => x.lastName === clave);
  if (p === undefined) throw new Error(`Paciente de la semilla de ADT no encontrado: ${String(clave)}`);
  return p;
}

/** El espacio por código dentro del establecimiento de ADT. */
export function camaPorCodigo(code: string): EspacioSim {
  const e = espacios.filtrar((x) => x.siteId === SITIO_ADT && x.code === code)[0];
  if (e === undefined) throw new Error(`Cama de la semilla de ADT no encontrada: ${code}`);
  return e;
}

interface Semillas {
  ingresos: IngresoSim[];
  ubicaciones: UbicacionSim[];
  ordenes: OrdenLimpiezaSim[];
  ops: OpsCamaSim[];
  bloqueos: BloqueoSim[];
}

function sembrar(): Semillas {
  const s: Semillas = { ingresos: [], ubicaciones: [], ordenes: [], ops: [], bloqueos: [] };
  const camaId = (code: string): string => uuid(`infra-sanlucas-${code}`);
  const instante = (par: readonly [number, number]): string => haceLocal(par[0], par[1]);

  const procesar = (e: EstanciaSemilla, viva: boolean): void => {
    const p = paciente(e.paciente);
    const encounterId = e.clave === 'V1' ? uuid('encounter-301-B') : uuid(`adt-encounter-${e.clave}`);
    const primera = e.camas[0]!;
    const startAt = instante(primera.desde);
    const finalizada = !viva;
    s.ingresos.push({
      id: encounterId,
      episodeId: uuid(`adt-episode-${e.clave}`),
      patientProfileId: p.id,
      siteId: SITIO_ADT,
      attendingId: MEDICAL.id,
      levelOfCare: e.nivel,
      admissionSource: e.fuente,
      isolation: e.aislamiento ?? 'ISO_NONE',
      isolationOrganism: null,
      reasonText: e.motivo,
      expectedDischargeAt: e.esperadoEn === undefined ? null : haceLocal(-e.esperadoEn, 11),
      status: finalizada ? 'FINISHED' : 'IN_PROGRESS',
      startAt,
      endAt: finalizada ? instante(e.egreso!.cuando) : null,
      disposition: finalizada ? e.egreso!.disposicion : null,
      rowVersion: 1 + e.camas.length,
    });
    let previa: string | null = null;
    e.camas.forEach((tramo, i) => {
      const id = uuid(`adt-loc-${e.clave}-${i}`);
      const abierta = tramo.hasta === undefined;
      s.ubicaciones.push({
        id,
        encounterId,
        careSpaceId: camaId(tramo.cama),
        status: abierta ? 'LOCATION_ACTIVE' : 'LOCATION_COMPLETED',
        movementType: i === 0 ? 'ADT_ADMIT' : 'ADT_TRANSFER',
        previousLocationId: previa,
        endReason: abierta ? null : tramo.motivoFin === 'TRANSFER_OUT' ? 'ADT_END_TRANSFER_OUT' : 'ADT_END_DISCHARGE',
        periodStart: instante(tramo.desde),
        periodEnd: abierta ? null : instante(tramo.hasta!),
        bedCategory: null,
        incidentId: null,
      });
      previa = id;
      // Cada egreso o traslado dejó la cama sucia y una orden; las pasadas ya se limpiaron.
      if (!abierta) {
        const soltada = instante(tramo.hasta!);
        const esHoy = SUCIAS_HOY.includes(tramo.cama) && e.clave === 'H8';
        s.ordenes.push({
          id: uuid(`adt-order-${e.clave}-${i}`),
          careSpaceId: camaId(tramo.cama),
          type: 'DISCHARGE',
          trigger: tramo.motivoFin === 'TRANSFER_OUT' ? 'CLN_TRG_TRANSFER' : 'CLN_TRG_DISCHARGE',
          status: esHoy ? 'CLN_PENDING' : 'CLN_INSPECTED',
          sourceRefId: id,
          releasedAt: soltada,
          requestedAt: soltada,
          startedAt: esHoy ? null : new Date(Date.parse(soltada) + (25 + i * 7) * MIN).toISOString(),
          finishedAt: esHoy ? null : new Date(Date.parse(soltada) + (70 + i * 9) * MIN).toISOString(),
          inspectedAt: esHoy ? null : new Date(Date.parse(soltada) + (95 + i * 11) * MIN).toISOString(),
        });
      }
    });
  };
  HISTORIA.forEach((e) => procesar(e, false));
  VIVAS.forEach((e) => procesar(e, true));

  // Una orden por cada egreso de rotación con tiempos distintos: cuatro muestras de la
  // rotación (espera + limpieza + inspección) para que p50 y p90 no sean un solo punto.
  const ahora = new Date().toISOString();
  for (const code of [...new Set(['301-A', EN_MANTENIMIENTO.cama, ...HISTORIA.flatMap((h) => h.camas.map((t) => t.cama))])]) {
    const id = camaId(code);
    const sucia = SUCIAS_HOY.includes(code);
    s.ops.push({
      id,
      hygiene: sucia ? 'HYG_DIRTY' : 'HYG_INSPECTED',
      hygieneSince: sucia ? haceLocal(1, 9) : haceLocal(2, 10),
      terminalRequired: false,
      availability: 'SPACE_OP_AVAILABLE',
      availabilityReason: null,
      availabilityUntil: null,
      availabilitySince: haceLocal(30, 8),
      isolation: 'ISO_NONE',
      isolationOrganism: null,
      opsVersion: 1,
      lastEventAt: ahora,
    });
  }
  const mant = camaId(EN_MANTENIMIENTO.cama);
  const opsMant = s.ops.find((o) => o.id === mant);
  const desde = instante(EN_MANTENIMIENTO.desde);
  const hasta = instante(EN_MANTENIMIENTO.hasta);
  if (opsMant !== undefined) {
    opsMant.availability = 'SPACE_OP_MAINTENANCE';
    opsMant.availabilityReason = 'Mantenimiento preventivo del sistema de gases';
    opsMant.availabilityUntil = hasta;
    opsMant.availabilitySince = desde;
  }
  s.bloqueos.push({ id: uuid(`adt-block-${EN_MANTENIMIENTO.cama}`), careSpaceId: mant, from: desde, to: null });
  return s;
}

const SEMILLAS = sembrar();

export const ingresos = new Coleccion<IngresoSim>(SEMILLAS.ingresos).persistirEn('mock.adt.ingresos');
export const ubicaciones = new Coleccion<UbicacionSim>(SEMILLAS.ubicaciones).persistirEn('mock.adt.ubicaciones');
export const incidentes = new Coleccion<IncidenteSim>([]).persistirEn('mock.adt.incidentes');
export const opsCamas = new Coleccion<OpsCamaSim>(SEMILLAS.ops).persistirEn('mock.adt.ops');
export const ordenes = new Coleccion<OrdenLimpiezaSim>(SEMILLAS.ordenes).persistirEn('mock.adt.ordenes');
export const bloqueosDeCama = new Coleccion<BloqueoSim>(SEMILLAS.bloqueos).persistirEn('mock.adt.bloqueos');
export const eventos = new Coleccion<EventoSim>([]).persistirEn('mock.adt.eventos');
export const ajustes = new Coleccion<CensusAdjustment>([]).persistirEn('mock.adt.ajustes');

/* ---- guarda de inmutabilidad del censo cerrado ---------------------------------------- */

/** El trigger de la base: rechaza UPDATE y DELETE sobre un día CERRADO. */
export class GuardaDeInmutabilidad extends Error {
  constructor(readonly censoId: string) {
    super(`El censo ${censoId} está cerrado: no admite UPDATE ni DELETE (INV-35).`);
  }
}

class ColeccionDeCensos extends Coleccion<CensoSim> {
  override actualizar(id: string, cambios: Partial<CensoSim>): CensoSim | undefined {
    if (this.get(id)?.status === 'CLOSED') throw new GuardaDeInmutabilidad(id);
    return super.actualizar(id, cambios);
  }
  override borrar(id: string): boolean {
    if (this.get(id)?.status === 'CLOSED') throw new GuardaDeInmutabilidad(id);
    return super.borrar(id);
  }
}

/** Los días CERRADOS (el snapshot). Los abiertos no se persisten: son vista previa. */
export const censosCerrados = new ColeccionDeCensos([]);
censosCerrados.persistirEn('mock.adt.censos');

/* ---- siembra de lo que F1 no trae (camas, vínculos, clínica) ------------------------------ */

let sembrado = false;

/**
 * Inserta en el árbol de F1 las habitaciones y camas de ADT que falten, sus
 * vínculos con la unidad y las filas de la historia clínica (episodio y
 * encuentro `ENC_IMP`) de cada internación. Idempotente: se puede llamar en cada
 * `registerAdt`, también tras recargar con lo guardado en `sessionStorage`.
 */
export function sembrarCamasAdt(): void {
  for (const e of ESPACIOS_ADT) {
    if (!espacios.has(e.id)) espacios.agregar({ ...e });
    if (e.clinicalUnitId !== null && vinculos.filtrar((v) => v.careSpaceId === e.id).length === 0) {
      vinculos.agregar({
        id: uuid(`infra-vinculo-${e.id}`),
        careSpaceId: e.id,
        clinicalUnitId: e.clinicalUnitId,
        roleCode: 'SPACE_UNIT_ROLE_OWNER',
        validFrom: e.validFrom ?? '2025-01-01',
        validTo: null,
      });
    }
  }
  sincronizarClinica();
  sembrado = true;
}

export const camasSembradas = (): boolean => sembrado;

/** Que el expediente vea la internación: un episodio abierto y un encuentro `ENC_IMP`. */
export function sincronizarClinica(): void {
  for (const i of ingresos.todos()) {
    if (!episodeList.has(i.episodeId)) {
      episodeList.agregar({
        id: i.episodeId,
        patientProfileId: i.patientProfileId,
        tenantId: TENANT_CLINICA,
        typeConceptId: EPISODE_TYPE,
        statusConceptId: i.status === 'IN_PROGRESS' ? STATUS['ST-ACTIVE']! : STATUS['ST-CLOSED']!,
        responsiblePractitionerId: i.attendingId,
        startAt: i.startAt,
        endAt: i.endAt,
        createdAt: i.startAt,
      });
    }
    if (!encounterList.has(i.id)) {
      encounterList.agregar({
        id: i.id,
        patientProfileId: i.patientProfileId,
        episodeId: i.episodeId,
        statusConceptId: i.status === 'IN_PROGRESS' ? ENCOUNTER_STATUS['ENCST-IN-PROGRESS']! : ENCOUNTER_STATUS['ENCST-FINISHED']!,
        classConceptId: ENCOUNTER_CLASS['ENC-IMP']!,
        primaryPractitionerId: i.attendingId,
        reasonText: i.reasonText,
        startAt: i.startAt,
        endAt: i.endAt,
      });
    }
  }
}

/* ---- permisos (sólo simulación de lo que decide la API real) ----------------------------- */

export type PerfilAdt = 'SUPERVISION' | 'ENFERMERIA' | 'ADMISION' | 'ADMIN_ORG' | 'FACTURACION' | 'LIMPIEZA' | 'SIN_ROL';

const PERFILES: readonly PerfilAdt[] = ['SUPERVISION', 'ENFERMERIA', 'ADMISION', 'ADMIN_ORG', 'FACTURACION', 'LIMPIEZA', 'SIN_ROL'];

export function perfilAdt(request: MockRequest): PerfilAdt {
  try {
    const forzado = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('mock:adt-perfil');
    if (forzado !== null && (PERFILES as readonly string[]).includes(forzado)) return forzado as PerfilAdt;
  } catch {
    // Almacenamiento bloqueado: se sigue con el rol del token.
  }
  const roles = request.user?.roles ?? [];
  if (roles.some((r) => ['PRACTITIONER', 'CLINICIAN', 'PERIOP_NURSE'].includes(r))) return 'SUPERVISION';
  if (roles.some((r) => ['SUPERADMIN', 'SECURITY_ADMIN', 'PLATFORM_ADMIN'].includes(r))) return 'ADMIN_ORG';
  if (roles.some((r) => ['BILLING', 'FINANCE', 'BILLING_OPERATOR'].includes(r))) return 'FACTURACION';
  return 'SIN_ROL';
}

const OPERAN: readonly PerfilAdt[] = ['SUPERVISION', 'ENFERMERIA', 'ADMISION'];

export const puedeOperarCamas = (p: PerfilAdt): boolean => OPERAN.includes(p);
export const veDatosDePaciente = (p: PerfilAdt): boolean => OPERAN.includes(p);
export const puedeVerCenso = (p: PerfilAdt): boolean => p !== 'LIMPIEZA' && p !== 'SIN_ROL';

export function viewerDe(p: PerfilAdt): AdtViewer {
  return {
    canOperateBeds: puedeOperarCamas(p),
    canOverride: p === 'SUPERVISION',
    canReviewIncidents: p === 'SUPERVISION',
    canCloseCensus: p === 'SUPERVISION' || p === 'ADMISION' || p === 'ADMIN_ORG',
    canAdjustCensus: p === 'SUPERVISION' || p === 'ADMIN_ORG',
  };
}

export function noPermitido(requiredRoles: readonly string[]): MockReply {
  return reply(403, {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Su asignación no incluye esta acción sobre el espacio.',
    error: 'Forbidden',
    details: { reason: 'INFRA_ACTION_NOT_ALLOWED', requiredRoles },
    correlationId: requestId(),
    timestamp: new Date().toISOString(),
    path: '',
  });
}

let secuencia = 0;
export const requestId = (): string => `req-adt-${String(++secuencia).padStart(4, '0')}`;

/* ---- rechazos con la forma del contrato de errores ---------------------------------------- */

function falla(status: number, code: string, reason: string, message: string, extra: Record<string, unknown> = {}): MockReply {
  return reply(status, {
    statusCode: status,
    code,
    message,
    error: status === 409 ? 'Conflict' : status === 412 ? 'Precondition Failed' : 'Unprocessable Entity',
    details: { reason, ...extra },
    correlationId: requestId(),
    timestamp: new Date().toISOString(),
    path: '',
  });
}

export const conflicto = (reason: string, message: string, extra?: Record<string, unknown>): MockReply => falla(409, 'CONFLICT', reason, message, extra);
export const regla = (reason: string, message: string, extra?: Record<string, unknown>): MockReply => falla(422, 'PRECONDITION_FAILED', reason, message, extra);
export const versionVieja = (): MockReply => falla(412, 'CONCURRENCY_CONFLICT', 'OPS_VERSION_MISMATCH', 'El encuentro cambió desde que lo leyó.');

/* ---- lecturas de datos ------------------------------------------------------------------------- */

export const concepto0 = (lista: readonly AdtConcept[], code: string | null): AdtConcept | null =>
  code === null ? null : (lista.find((x) => x.code === code) ?? c(code, code));

const MOVIMIENTOS: readonly AdtConcept[] = [
  c('ADT_ADMIT', 'Ingreso (A01)'),
  c('ADT_TRANSFER', 'Traslado (A02)'),
  c('ADT_SWAP', 'Intercambio (A17)'),
  c('ADT_RESERVE', 'Reserva de cama (A15)'),
];
const ESTADOS_UBICACION: readonly AdtConcept[] = [
  c('LOCATION_ACTIVE', 'En curso'),
  c('LOCATION_COMPLETED', 'Completada'),
  c('LOCATION_RESERVED', 'Reservada'),
  c('LOCATION_CANCELLED', 'Cancelada'),
];
const MOTIVOS_FIN: readonly AdtConcept[] = [
  c('ADT_END_DISCHARGE', 'Egreso'),
  c('ADT_END_TRANSFER_OUT', 'Traslado a otra cama'),
  c('ADT_END_SWAP', 'Intercambio de cama'),
  c('ADT_END_RESERVATION_CANCELLED', 'Reserva cancelada'),
  c('ADT_END_TRANSFER_CANCELLED', 'Traslado cancelado'),
  c('ADT_END_RESERVATION_CONVERTED', 'Reserva convertida en ocupación'),
];
const ESTADOS_ENCUENTRO: readonly AdtConcept[] = [c('IN_PROGRESS', 'En curso'), c('FINISHED', 'Finalizado')];
const ESTADOS_INCIDENTE: readonly AdtConcept[] = [
  c('PLC_INC_OPEN', 'Abierto'),
  c('PLC_INC_REVIEWED', 'Revisado'),
  c('PLC_INC_CLOSED', 'Cerrado'),
];
const CATEGORIAS_CAMA: readonly AdtConcept[] = CATALOGO.attributes.bedCategory;

export const esCama = (e: EspacioSim): boolean => e.form === 'LOC_FORM_BED';

export function camasDelSitio(siteId: string): EspacioSim[] {
  return espacios.filtrar((e) => e.siteId === siteId && esCama(e)).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
}

function ancestros(e: EspacioSim): EspacioSim[] {
  const lista: EspacioSim[] = [];
  let actual = e.parentId === null ? undefined : espacios.get(e.parentId);
  while (actual !== undefined && lista.length < 20) {
    lista.unshift(actual);
    actual = actual.parentId === null ? undefined : espacios.get(actual.parentId);
  }
  return lista;
}

export function referenciaDeCama(e: EspacioSim): StayBedRef {
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    path: ancestros(e).map((p) => ({ id: p.id, code: p.code, name: p.name, form: p.form })),
  };
}

/** La unidad de una cama: la propietaria vigente propia o, si no tiene, la del ancestro más cercano. */
export function unidadDeCama(e: EspacioSim): { id: string; code: string; name: string } | null {
  for (const nodo of [e, ...ancestros(e).reverse()]) {
    const v = vinculos.filtrar((x) => x.careSpaceId === nodo.id && x.validTo === null && x.roleCode === 'SPACE_UNIT_ROLE_OWNER')[0];
    if (v !== undefined) {
      const u = UNIDADES_SEMILLA.find((x) => x.id === v.clinicalUnitId);
      if (u !== undefined) return { id: u.id, code: u.code, name: u.name };
    }
  }
  return null;
}

export function unidadesConCamas(siteId: string): { id: string; code: string; name: string }[] {
  const mapa = new Map<string, { id: string; code: string; name: string }>();
  for (const cama of camasDelSitio(siteId)) {
    const u = unidadDeCama(cama);
    if (u !== null) mapa.set(u.id, u);
  }
  return [...mapa.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export const edadEnAnios = (nacimiento: string, ref: number = Date.now()): number => Math.floor((ref - Date.parse(nacimiento)) / (365.25 * DIA));
export const edadEnDias = (nacimiento: string, ref: number = Date.now()): number => Math.floor((ref - Date.parse(nacimiento)) / DIA);
export const codigoSexo = (p: PacienteSimulado): string => (p.sexAtBirth === 'FEMALE' ? 'SEX_FEMALE' : 'SEX_MALE');

function iniciales(p: PacienteSimulado): string {
  return `${p.name.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

export function pacienteResumido(p: PacienteSimulado): StayPatient {
  return { id: p.id, name: p.displayName, initials: iniciales(p), sexCode: codigoSexo(p), ageYears: edadEnAnios(p.birthDate) };
}

export function pacienteDe(i: IngresoSim): PacienteSimulado {
  const p = PATIENTS.find((x) => x.id === i.patientProfileId);
  if (p === undefined) throw new Error(`Paciente sin ficha: ${i.patientProfileId}`);
  return p;
}

export const ubicacionesDe = (encounterId: string): UbicacionSim[] =>
  ubicaciones.filtrar((u) => u.encounterId === encounterId).sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.id.localeCompare(b.id));

export const ubicacionActiva = (encounterId: string): UbicacionSim | undefined =>
  ubicaciones.filtrar((u) => u.encounterId === encounterId && u.status === 'LOCATION_ACTIVE')[0];

export const ubicacionReservada = (encounterId: string): UbicacionSim | undefined =>
  ubicaciones.filtrar((u) => u.encounterId === encounterId && u.status === 'LOCATION_RESERVED')[0];

/** Quién ocupa o tiene reservada una cama hoy. */
export function ocupanteDe(careSpaceId: string): { ubicacion: UbicacionSim; ingreso: IngresoSim } | undefined {
  const u = ubicaciones.filtrar((x) => x.careSpaceId === careSpaceId && (x.status === 'LOCATION_ACTIVE' || x.status === 'LOCATION_RESERVED'))[0];
  if (u === undefined) return undefined;
  const ingreso = ingresos.get(u.encounterId);
  return ingreso === undefined ? undefined : { ubicacion: u, ingreso };
}

export function opsDe(careSpaceId: string): OpsCamaSim {
  const existente = opsCamas.get(careSpaceId);
  if (existente !== undefined) return existente;
  return opsCamas.agregar({
    id: careSpaceId,
    hygiene: 'HYG_INSPECTED',
    hygieneSince: haceLocal(10, 8),
    terminalRequired: false,
    availability: 'SPACE_OP_AVAILABLE',
    availabilityReason: null,
    availabilityUntil: null,
    availabilitySince: haceLocal(30, 8),
    isolation: 'ISO_NONE',
    isolationOrganism: null,
    opsVersion: 1,
    lastEventAt: new Date().toISOString(),
  });
}

/* ---- el doble del tablero: celda y asignabilidad (F2) ----------------------------------------- */

export function estaLimpia(o: OpsCamaSim): boolean {
  return (o.hygiene === 'HYG_INSPECTED' || o.hygiene === 'HYG_CLEAN') && !o.terminalRequired;
}

/** Resumen HL7 v2-0116 (+R) por la primera regla que aplica (`bed-status-v2`, §F2.2). */
export function codigoV2(e: EspacioSim, o: OpsCamaSim, ocupacion: 'OCC_FREE' | 'OCC_RESERVED' | 'OCC_OCCUPIED'): string {
  if (o.availability !== 'SPACE_OP_AVAILABLE' || e.status !== 'SPACE_ACTIVE') return 'C';
  if (o.hygiene === 'HYG_CONTAMINATED') return 'K';
  if (o.isolation !== 'ISO_NONE') return 'I';
  if (ocupacion === 'OCC_OCCUPIED') return 'O';
  if (ocupacion === 'OCC_RESERVED') return 'R';
  if (o.hygiene === 'HYG_DIRTY' || o.hygiene === 'HYG_CLEANING' || o.terminalRequired) return 'H';
  return 'U';
}

export function celda(e: EspacioSim, perfil: PerfilAdt): BedBoardCell {
  const o = opsDe(e.id);
  const ocupante = ocupanteDe(e.id);
  const ocupacion = ocupante === undefined ? 'OCC_FREE' : ocupante.ubicacion.status === 'LOCATION_ACTIVE' ? 'OCC_OCCUPIED' : 'OCC_RESERVED';
  const activo = e.status === 'SPACE_ACTIVE' && vigente(e);
  const asignable = activo && o.availability === 'SPACE_OP_AVAILABLE' && ocupacion === 'OCC_FREE' && estaLimpia(o);
  const orden = ordenes.filtrar((x) => x.careSpaceId === e.id && ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'].includes(x.status))[0];
  const p = ocupante === undefined || !veDatosDePaciente(perfil) ? undefined : pacienteResumido(pacienteDe(ocupante.ingreso));
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    path: referenciaDeCama(e).path,
    form: concepto(CATALOGO.forms, e.form)!,
    function: c(e.function, CATALOGO.functions.find((f) => f.code === e.function)?.display ?? e.function),
    lifecycle: concepto(CATALOGO.lifecycle, e.status)!,
    availability: {
      code: o.availability,
      reasonCode: o.availability === 'SPACE_OP_AVAILABLE' ? null : 'BLOCK_RSN_PREVENTIVE_MAINTENANCE',
      reasonText: o.availabilityReason,
      expectedUntil: o.availabilityUntil,
      since: o.availabilitySince,
    },
    hygiene: { code: o.hygiene, since: o.hygieneSince, terminalRequired: o.terminalRequired },
    isolation: { code: o.isolation, organism: o.isolationOrganism, since: null },
    occupancy: {
      code: ocupacion,
      since: ocupante?.ubicacion.periodStart ?? null,
      ...(ocupante === undefined || !veDatosDePaciente(perfil) ? {} : { encounterId: ocupante.ingreso.id }),
      ...(p === undefined ? {} : { patient: { initials: p.initials, sexCode: p.sexCode, ageYears: p.ageYears } }),
    },
    v2Code: codigoV2(e, o, ocupacion),
    assignable: asignable,
    openCleaningOrderId: orden?.id ?? null,
    lastEventAt: o.lastEventAt,
    opsVersion: o.opsVersion,
  };
}

/* ---- compatibilidad (§F3.2) ----------------------------------------------------------------------- */

export interface PedidoDeCompatibilidad {
  readonly paciente: PacienteSimulado;
  readonly nivel: string;
  readonly aislamiento: string;
  readonly organismo: string | null;
  /** El encuentro que se evalúa, para no contarse a sí mismo como ocupante. */
  readonly encounterId?: string;
  /** Intercambio: la cama destino la ocupa hoy el otro, que a su vez viene a la nuestra. */
  readonly ignorarOcupanteDe?: string;
}

const NIVELES_ICU = ['LOC_CARE_ICU', 'LOC_CARE_NEONATAL_ICU'];
const NIVELES_GENERALES = ['LOC_CARE_GENERAL', 'LOC_CARE_INTERMEDIATE'];

export function evaluarCompatibilidad(cama: EspacioSim, pedido: PedidoDeCompatibilidad): CompatibilityViolation[] {
  const v: CompatibilityViolation[] = [];
  const o = opsDe(cama.id);
  const bloq = (rule: CompatibilityRule, detail: string): void => void v.push({ rule, severity: 'BLOCKING', detail });
  const forz = (rule: CompatibilityRule, detail: string): void => void v.push({ rule, severity: 'OVERRIDABLE', detail });

  if (cama.status !== 'SPACE_ACTIVE' || !vigente(cama)) bloq('LIFECYCLE', `La cama ${cama.code} no está activa (${concepto(CATALOGO.lifecycle, cama.status)?.display ?? cama.status}).`);
  if (o.availability !== 'SPACE_OP_AVAILABLE') {
    bloq('AVAILABILITY', `La cama ${cama.code} no está disponible: ${o.availabilityReason ?? 'bloqueada'}.`);
  }
  const ocupante = ocupanteDe(cama.id);
  if (ocupante !== undefined && ocupante.ingreso.id !== pedido.ignorarOcupanteDe && ocupante.ingreso.id !== pedido.encounterId) {
    bloq('OCCUPANCY', `La cama ${cama.code} ya está ${ocupante.ubicacion.status === 'LOCATION_RESERVED' ? 'reservada' : 'ocupada'} por otra internación.`);
  }
  if (!estaLimpia(o)) {
    bloq('HYGIENE', `La cama ${cama.code} no está limpia (${o.terminalRequired ? 'requiere limpieza terminal' : 'higiene pendiente'}).`);
  }
  const aerea = pedido.aislamiento === 'ISO_AIRBORNE';
  const padre = cama.parentId === null ? undefined : espacios.get(cama.parentId);
  const habitacion = padre?.form === 'LOC_FORM_ROOM' ? padre : undefined;
  const esAiir =
    habitacion?.function === 'SPACE_FN_ISOLATION_AIIR' && habitacion.pressure === 'PRESSURE_NEGATIVE' && habitacion.hvacValidatedOn !== null;
  if (aerea && !esAiir) bloq('ISOLATION_AIRBORNE', 'El aislamiento aéreo solo se asigna a un local AIIR con presión negativa y climatización validada.');

  const sexo = codigoSexo(pedido.paciente);
  const restriccion = habitacion?.sexRestriction ?? null;
  if (restriccion !== null && restriccion !== 'SEX_ANY' && restriccion !== sexo) {
    forz('SEX', `${habitacion!.name} es solo para ${restriccion === 'SEX_FEMALE' ? 'mujeres' : 'hombres'} y la persona es ${sexo === 'SEX_FEMALE' ? 'mujer' : 'hombre'}.`);
  }
  const hermanos =
    habitacion === undefined
      ? []
      : espacios.filtrar((x) => x.parentId === habitacion.id && esCama(x) && x.id !== cama.id).flatMap((x) => {
          const oc = ocupanteDe(x.id);
          return oc === undefined || oc.ingreso.id === pedido.encounterId || oc.ingreso.id === pedido.ignorarOcupanteDe ? [] : [oc];
        });
  const otroSexo = hermanos.find((h) => codigoSexo(pacienteDe(h.ingreso)) !== sexo);
  if (otroSexo !== undefined && (restriccion === null || restriccion === 'SEX_ANY')) {
    forz('SEX', `La habitación ya aloja a una persona de otro sexo (alojamiento del mismo sexo).`);
  }

  const grupo = cama.ageGroup ?? habitacion?.ageGroup ?? null;
  const anios = edadEnAnios(pedido.paciente.birthDate);
  const dias = edadEnDias(pedido.paciente.birthDate);
  if (grupo === 'AGE_PEDIATRIC' && anios >= 15) forz('AGE', `${habitacion?.name ?? cama.name} es pediátrica (menores de 15 años) y la persona tiene ${anios}.`);
  if (grupo === 'AGE_ADULT' && anios < 15) forz('AGE', `${habitacion?.name ?? cama.name} es de adultos y la persona tiene ${anios} años.`);
  if (grupo === 'AGE_NEONATAL' && dias >= 28) forz('AGE', `${habitacion?.name ?? cama.name} es neonatal (menores de 28 días).`);

  if (pedido.aislamiento !== 'ISO_NONE' && hermanos.length > 0) {
    const mismo = hermanos.every((h) => h.ingreso.isolationOrganism !== null && h.ingreso.isolationOrganism === pedido.organismo);
    forz('ISOLATION_COHORT', mismo ? 'Cohorte del mismo organismo: requiere aval de control de infecciones.' : 'La habitación tiene otra persona sin el mismo organismo: no se puede formar cohorte.');
  }

  if (cama.function === 'SPACE_FN_BED_ICU' && !NIVELES_ICU.includes(pedido.nivel)) forz('LEVEL_OF_CARE', 'La cama es de terapia intensiva y el nivel de cuidado de la internación no lo es.');
  if (cama.function === 'SPACE_FN_BED_STANDARD' && !NIVELES_GENERALES.includes(pedido.nivel)) forz('LEVEL_OF_CARE', 'La cama es estándar y el nivel de cuidado de la internación requiere terapia.');
  return v;
}

export function pedidoDe(i: IngresoSim, extra: Partial<PedidoDeCompatibilidad> = {}): PedidoDeCompatibilidad {
  return { paciente: pacienteDe(i), nivel: i.levelOfCare, aislamiento: i.isolation, organismo: i.isolationOrganism, encounterId: i.id, ...extra };
}

/* ---- eventos, ops y transacciones ----------------------------------------------------------------------- */

export function emitir(eventType: string, hl7: string, aggregateId: string, payload: Record<string, unknown> = {}): void {
  eventos.agregar({ id: nuevoId('evt'), eventType, hl7, aggregateId, occurredAt: new Date().toISOString(), requestId: `req-adt-${secuencia}`, payload });
}

/** Cambio de ocupación de una cama: evento A20 y versión operativa nueva. */
export function registrarOcupacion(careSpaceId: string, desde: string, hasta: string, sourceRefId: string): void {
  const o = opsDe(careSpaceId);
  opsCamas.actualizar(careSpaceId, { opsVersion: o.opsVersion + 1, lastEventAt: new Date().toISOString() });
  emitir('practice.care_space.status_changed', 'ADT^A20', careSpaceId, { axis: 'AXIS_OCCUPANCY', from: desde, to: hasta, source: 'SRC_ADT', sourceRefId });
}

/**
 * El doble de `CareSpaceOpsPort.markDirtyFromSource` (F2): la cama queda sucia,
 * con limpieza terminal si hay aislamiento, y nace una orden en la cola.
 */
export function marcarSucia(careSpaceId: string, trigger: 'CLN_TRG_DISCHARGE' | 'CLN_TRG_TRANSFER', terminal: boolean, sourceRefId: string, cuando: string): string {
  const o = opsDe(careSpaceId);
  const orden: OrdenLimpiezaSim = {
    id: nuevoId('clean-order'),
    careSpaceId,
    type: terminal ? 'TERMINAL' : 'DISCHARGE',
    trigger,
    status: 'CLN_PENDING',
    sourceRefId,
    releasedAt: cuando,
    requestedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    inspectedAt: null,
  };
  ordenes.agregar(orden);
  opsCamas.actualizar(careSpaceId, {
    hygiene: terminal ? 'HYG_CONTAMINATED' : 'HYG_DIRTY',
    hygieneSince: cuando,
    terminalRequired: terminal,
    opsVersion: o.opsVersion + 1,
    lastEventAt: new Date().toISOString(),
  });
  emitir('practice.cleaning_order.created', 'ADT^A20', orden.id, { careSpaceId, trigger, type: orden.type });
  emitir('practice.care_space.status_changed', 'ADT^A20', careSpaceId, { axis: 'AXIS_HYGIENE', to: terminal ? 'HYG_CONTAMINATED' : 'HYG_DIRTY', source: 'SRC_ADT', sourceRefId });
  return orden.id;
}

/** Hook de demostración: el ciclo limpiar → inspeccionar que en producción hace F2. */
export function completarLimpieza(code: string): boolean {
  const cama = espacios.filtrar((e) => e.siteId === SITIO_ADT && e.code === code)[0];
  if (cama === undefined) return false;
  const ahora = new Date().toISOString();
  for (const o of ordenes.filtrar((x) => x.careSpaceId === cama.id && ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'].includes(x.status))) {
    ordenes.actualizar(o.id, {
      status: 'CLN_INSPECTED',
      startedAt: o.startedAt ?? ahora,
      finishedAt: o.finishedAt ?? ahora,
      inspectedAt: ahora,
    });
  }
  const ops = opsDe(cama.id);
  opsCamas.actualizar(cama.id, { hygiene: 'HYG_INSPECTED', terminalRequired: false, hygieneSince: ahora, opsVersion: ops.opsVersion + 1, lastEventAt: ahora });
  emitir('practice.care_space.status_changed', 'ADT^A20', cama.id, { axis: 'AXIS_HYGIENE', to: 'HYG_INSPECTED', source: 'SRC_CLEANING' });
  return true;
}

/** Foto de las colecciones que una operación toca, para el «todo o nada». */
type Foto = { col: Coleccion<{ readonly id: string }>; filas: { readonly id: string }[] }[];

const TRANSACCIONALES = (): Coleccion<{ readonly id: string }>[] =>
  [ingresos, ubicaciones, incidentes, opsCamas, ordenes, eventos, ajustes] as unknown as Coleccion<{ readonly id: string }>[];

/** Falla inyectable para demostrar que un error a mitad no deja nada hecho (pruebas). */
export const inyeccion: { fallarEn: string | null } = { fallarEn: null };

export function punto(nombre: string): void {
  if (inyeccion.fallarEn === nombre) {
    inyeccion.fallarEn = null;
    throw new Error(`Falla inyectada en «${nombre}»`);
  }
}

/** Ejecuta `fn`; si lanza, restaura todas las colecciones al estado previo y relanza. */
export function transaccion<T>(fn: () => T): T {
  const foto: Foto = TRANSACCIONALES().map((col) => ({ col, filas: col.todos().map((f) => structuredClone(f)) }));
  try {
    return fn();
  } catch (error) {
    for (const { col, filas } of foto) {
      for (const f of col.todos()) col.borrar(f.id);
      for (const f of filas) col.agregar(f);
    }
    throw error;
  }
}

/* ---- vistas de salida ------------------------------------------------------------------------------------ */

export function movimiento(u: UbicacionSim): StayMovement {
  const cama = espacios.get(u.careSpaceId)!;
  const ahora = Date.now();
  const ultimoTraslado =
    u.movementType === 'ADT_TRANSFER' && u.status === 'LOCATION_ACTIVE'
      ? new Date(Date.parse(u.periodStart) + VENTANA_CANCELACION_MIN * MIN).toISOString()
      : null;
  const reserva = u.status === 'LOCATION_RESERVED' ? new Date(ahora + 365 * DIA).toISOString() : null;
  return {
    id: u.id,
    movementType: concepto0(MOVIMIENTOS, u.movementType)!,
    bed: referenciaDeCama(cama),
    status: concepto0(ESTADOS_UBICACION, u.status)!,
    periodStart: u.periodStart,
    periodEnd: u.periodEnd,
    previousLocationId: u.previousLocationId,
    endReason: concepto0(MOTIVOS_FIN, u.endReason),
    bedCategory: concepto0(CATEGORIAS_CAMA, cama.bedCategory),
    incidentId: u.incidentId,
    cancellableUntil: reserva ?? (ultimoTraslado !== null && Date.parse(ultimoTraslado) > ahora ? ultimoTraslado : null),
  };
}

export function incidenteVisible(i: IncidenteSim): PlacementIncident {
  return {
    id: i.id,
    encounterLocationId: i.encounterLocationId,
    bed: referenciaDeCama(espacios.get(i.careSpaceId)!),
    violations: i.violations,
    justificationText: i.justificationText,
    authorizedBy: i.authorizedBy,
    createdAt: i.createdAt,
    status: concepto0(ESTADOS_INCIDENTE, i.status)!,
    reviewedBy: i.reviewedBy,
    reviewedAt: i.reviewedAt,
    reviewNote: i.reviewNote,
  };
}

export const nivelDe = (code: string): AdtConcept => concepto0(LEVELS_OF_CARE, code)!;
export const fuenteDe = (code: string): AdtConcept => concepto0(ADMISSION_SOURCES, code)!;
export const aislamientoDe = (code: string): AdtConcept => concepto0(ISOLATION_PRECAUTIONS, code)!;
export const disposicionDe = (code: string | null): AdtConcept | null => concepto0(DISCHARGE_DISPOSITIONS, code);
export const estadoDeEncuentro = (s: IngresoSim['status']): AdtConcept => concepto0(ESTADOS_ENCUENTRO, s)!;

export function nombreDeProfesional(id: string): string | null {
  return PROFESSIONALS.find((p) => p.id === id)?.displayName ?? null;
}

/* ============================================================================
    Censo diario
   ========================================================================== */

type Cifras = Record<CensusField, number>;

function camasDeUnidad(siteId: string, unitId: string): EspacioSim[] {
  return camasDelSitio(siteId).filter((b) => unidadDeCama(b)?.id === unitId);
}

const contiene = (u: UbicacionSim, instante: number): boolean =>
  Date.parse(u.periodStart) <= instante && (u.periodEnd === null || instante < Date.parse(u.periodEnd));

const cuentaParaCenso = (u: UbicacionSim): boolean => u.status === 'LOCATION_ACTIVE' || u.status === 'LOCATION_COMPLETED';

/** Cifras del día para una unidad, con las definiciones de `§F3.3`. */
export function calcularCifras(siteId: string, unitId: string, fecha: string): Cifras {
  const camas = camasDeUnidad(siteId, unitId);
  const ids = new Set(camas.map((b) => b.id));
  const corte = Date.parse(corteDeDia(fecha));
  const inicio = Date.parse(inicioDeDia(fecha));
  const dentro = (iso: string): boolean => Date.parse(iso) >= inicio && Date.parse(iso) < corte;

  const censables = camas.filter((b) => b.censable === true && b.status === 'SPACE_ACTIVE');
  const disponibles = censables.filter((b) => !bloqueosDeCama.filtrar((x) => x.careSpaceId === b.id).some((x) => Date.parse(x.from) <= corte && (x.to === null || corte < Date.parse(x.to))));
  const delasUbicaciones = ubicaciones.filtrar((u) => ids.has(u.careSpaceId) && cuentaParaCenso(u));

  const alCorte = delasUbicaciones.filter((u) => contiene(u, corte));
  const ingresosDelDia = delasUbicaciones.filter((u) => u.movementType === 'ADT_ADMIT' && dentro(u.periodStart));
  const egresosDelDia = delasUbicaciones.filter((u) => u.endReason === 'ADT_END_DISCHARGE' && u.periodEnd !== null && dentro(u.periodEnd));
  const trasladosIn = delasUbicaciones.filter((u) => u.movementType === 'ADT_TRANSFER' && dentro(u.periodStart));
  const trasladosOut = delasUbicaciones.filter((u) => u.endReason === 'ADT_END_TRANSFER_OUT' && u.periodEnd !== null && dentro(u.periodEnd));
  const mismoDia = egresosDelDia.filter((u) => u.movementType === 'ADT_ADMIT' && dentro(u.periodStart));
  const muertes = egresosDelDia.filter((u) => ingresos.get(u.encounterId)?.disposition === 'DISP_DEATH');
  const diasDeEstancia = egresosDelDia.reduce((suma, u) => {
    const ing = ingresos.get(u.encounterId);
    return suma + (ing === undefined ? 1 : stayDays(ing.startAt, u.periodEnd!, OFFSET_SEDE_MIN));
  }, 0);

  return {
    beds_censable: censables.length,
    beds_available: disponibles.length,
    beds_blocked: censables.length - disponibles.length,
    patients_at_cutoff: alCorte.length,
    admissions: ingresosDelDia.length,
    discharges: egresosDelDia.length,
    deaths: muertes.length,
    transfers_in: trasladosIn.length,
    transfers_out: trasladosOut.length,
    same_day_stays: mismoDia.length,
    patient_days: alCorte.length + mismoDia.length,
    discharge_stay_days: diasDeEstancia,
  };
}

function hash(valor: unknown): string {
  const texto = JSON.stringify(valor);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function aDia(siteId: string, unidad: { id: string; code: string; name: string }, fecha: string, cifras: Cifras, cerrado: Partial<CensusDay> = {}): CensusDay {
  return {
    id: null,
    siteId,
    unit: unidad,
    censusDate: fecha,
    cutoffAt: corteDeDia(fecha),
    status: 'OPEN',
    closedAt: null,
    closedBy: null,
    bedsCensable: cifras.beds_censable,
    bedsAvailable: cifras.beds_available,
    bedsBlocked: cifras.beds_blocked,
    patientsAtCutoff: cifras.patients_at_cutoff,
    admissions: cifras.admissions,
    discharges: cifras.discharges,
    deaths: cifras.deaths,
    transfersIn: cifras.transfers_in,
    transfersOut: cifras.transfers_out,
    sameDayStays: cifras.same_day_stays,
    patientDays: cifras.patient_days,
    dischargeStayDays: cifras.discharge_stay_days,
    contentHash: null,
    ...cerrado,
  };
}

export const cerradoDe = (siteId: string, unitId: string, fecha: string): CensoSim | undefined =>
  censosCerrados.filtrar((x) => x.siteId === siteId && x.unit.id === unitId && x.censusDate === fecha)[0];

/** Día cerrado → snapshot guardado; abierto → vista previa calculada (no se persiste). */
export function diaDeCenso(siteId: string, unidad: { id: string; code: string; name: string }, fecha: string): CensusDay {
  const cerrado = cerradoDe(siteId, unidad.id, fecha);
  if (cerrado !== undefined) return cerrado;
  return aDia(siteId, unidad, fecha, calcularCifras(siteId, unidad.id, fecha));
}

export function ajustesDe(censoId: string): CensusAdjustment[] {
  return ajustes.filtrar((a) => a.censusDayId === censoId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const CLAVES: Readonly<Record<CensusField, keyof CensusDay>> = {
  beds_censable: 'bedsCensable',
  beds_available: 'bedsAvailable',
  beds_blocked: 'bedsBlocked',
  patients_at_cutoff: 'patientsAtCutoff',
  admissions: 'admissions',
  discharges: 'discharges',
  deaths: 'deaths',
  transfers_in: 'transfersIn',
  transfers_out: 'transfersOut',
  same_day_stays: 'sameDayStays',
  patient_days: 'patientDays',
  discharge_stay_days: 'dischargeStayDays',
};

export function cifrasDe(d: CensusDay): Cifras {
  return Object.fromEntries(CENSUS_FIELDS.map((f) => [f, d[CLAVES[f]] as number])) as Cifras;
}

/** El snapshot con el último ajuste de cada campo aplicado. El snapshot no cambia. */
export function totalesAjustados(d: CensusDay): Cifras {
  const totales = cifrasDe(d);
  if (d.id === null) return totales;
  for (const a of ajustesDe(d.id)) totales[a.fieldCode] = a.newValue;
  return totales;
}

export function cerrarDia(siteId: string, unidad: { id: string; code: string; name: string }, fecha: string, quien: string | null): CensoSim {
  const cifras = calcularCifras(siteId, unidad.id, fecha);
  const id = uuid(`adt-census-${siteId}-${unidad.id}-${fecha}`);
  const dia = aDia(siteId, unidad, fecha, cifras, {
    id,
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
    closedBy: quien,
    contentHash: hash([siteId, unidad.id, fecha, cifras]),
  }) as CensoSim;
  return censosCerrados.agregar(dia);
}

/* ============================================================================
    Indicadores (§F3.3)
   ========================================================================== */

function percentil(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.max(0, Math.ceil((p / 100) * orden.length) - 1)]!;
}

const media = (v: readonly number[]): number | null => (v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length);
const r2 = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);

export function fechasDelPeriodo(desde: string, hasta: string): string[] {
  const lista: string[] = [];
  for (let d = desde; d <= hasta && lista.length < 400; d = sumarDias(d, 1)) lista.push(d);
  return lista;
}

interface Acumulado { dcd: number; dp: number; adm: number; egr: number; diasEstancia: number }

function razones(a: Acumulado, dias: number): Omit<IndicatorsByUnit, 'unit'> & { avgBeds: number; crossOcc: number | null } {
  const camasPromedio = dias === 0 ? 0 : a.dcd / dias;
  const ocupacion = a.dcd === 0 ? null : (a.dp / a.dcd) * 100;
  const alos = a.egr === 0 ? null : a.diasEstancia / a.egr;
  const giro = a.egr === 0 || camasPromedio === 0 ? null : a.egr / camasPromedio;
  const sustitucion = a.egr === 0 ? null : (a.dcd - a.dp) / a.egr;
  const cruzada = alos === null || giro === null || dias === 0 ? null : ((alos * giro) / dias) * 100;
  return {
    bedDaysAvailable: a.dcd,
    patientDays: a.dp,
    discharges: a.egr,
    dischargeStayDays: a.diasEstancia,
    occupancyPct: r2(ocupacion),
    alos: r2(alos),
    bedTurnover: r2(giro),
    turnoverInterval: r2(sustitucion),
    avgBeds: r2(camasPromedio) ?? 0,
    crossOcc: r2(cruzada),
  };
}

export function calcularIndicadores(siteId: string, desde: string, hasta: string, unitId: string | null): InpatientIndicators {
  const unidades = unidadesConCamas(siteId).filter((u) => unitId === null || u.id === unitId);
  const fechas = fechasDelPeriodo(desde, hasta);
  const total: Acumulado = { dcd: 0, dp: 0, adm: 0, egr: 0, diasEstancia: 0 };
  const porUnidad = new Map<string, Acumulado>(unidades.map((u) => [u.id, { dcd: 0, dp: 0, adm: 0, egr: 0, diasEstancia: 0 }]));
  const faltan: string[] = [];
  let cerrados = 0;

  for (const f of fechas) {
    const filas = unidades.map((u) => cerradoDe(siteId, u.id, f));
    if (filas.some((x) => x === undefined)) {
      faltan.push(f);
      continue;
    }
    cerrados += 1;
    for (const fila of filas as CensoSim[]) {
      const t = totalesAjustados(fila);
      for (const acum of [total, porUnidad.get(fila.unit.id)!]) {
        acum.dcd += t.beds_available;
        acum.dp += t.patient_days;
        acum.adm += t.admissions;
        acum.egr += t.discharges;
        acum.diasEstancia += t.discharge_stay_days;
      }
    }
  }

  const dias = fechas.length;
  const g = razones(total, dias);
  const rotaciones = ordenes
    .filtrar((o) => o.status === 'CLN_INSPECTED' && o.inspectedAt !== null && o.startedAt !== null && o.finishedAt !== null)
    .filter((o) => {
      const cama = espacios.get(o.careSpaceId);
      const u = cama === undefined ? null : unidadDeCama(cama);
      const dia = fechaLocal(o.releasedAt);
      return cama !== undefined && cama.siteId === siteId && (unitId === null || u?.id === unitId) && dia >= desde && dia <= hasta;
    });
  const minutos = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / MIN);
  const totales = rotaciones.map((o) => minutos(o.releasedAt, o.inspectedAt!));
  const deltaPct = g.crossOcc === null || g.occupancyPct === null || g.occupancyPct === 0 ? null : r2(((g.crossOcc - g.occupancyPct) / g.occupancyPct) * 100);

  return {
    period: { from: desde, to: hasta },
    days: dias,
    bedDaysAvailable: total.dcd,
    patientDays: total.dp,
    admissions: total.adm,
    discharges: total.egr,
    dischargeStayDays: total.diasEstancia,
    avgBeds: g.avgBeds,
    occupancyPct: g.occupancyPct,
    alos: g.alos,
    bedTurnover: g.bedTurnover,
    turnoverInterval: g.turnoverInterval,
    bedTurnaroundMinutes: {
      p50: percentil(totales, 50),
      p90: percentil(totales, 90),
      waitToStart: r2(media(rotaciones.map((o) => minutos(o.releasedAt, o.startedAt!)))),
      cleaning: r2(media(rotaciones.map((o) => minutos(o.startedAt!, o.finishedAt!)))),
      inspection: r2(media(rotaciones.map((o) => minutos(o.finishedAt!, o.inspectedAt!)))),
    },
    crossCheck: { occupancyFromAlos: g.crossOcc, deltaPct },
    coverage: { daysClosed: cerrados, daysMissing: faltan },
    asOf: new Date().toISOString(),
    byUnit: unidades.map((u) => {
      const { avgBeds: _a, crossOcc: _c, ...resto } = razones(porUnidad.get(u.id)!, dias);
      return { unit: u, ...resto };
    }),
  };
}

/* ---- siembra de los censos pasados -------------------------------------------------------------------------- */

/** Cierra los días de la semana pasada (salvo ayer, que queda abierto para la demostración). */
export function sembrarCensosPasados(siteId: string): void {
  if (censosCerrados.tamano > 0) return;
  const hoy = hoyLocal();
  for (const u of unidadesConCamas(siteId)) {
    for (let atras = 7; atras >= 2; atras--) {
      cerrarDia(siteId, u, sumarDias(hoy, -atras), null);
    }
  }
}

/* ---- ayudas para las rutas ------------------------------------------------------------------------------------ */

export function ingresoDe(id: string): IngresoSim | undefined {
  const i = ingresos.get(id);
  return i !== undefined && i.siteId === SITIO_ADT ? i : undefined;
}

export const unidadPorId = (id: string): { id: string; code: string; name: string } | undefined => {
  const u = UNIDADES_SEMILLA.find((x) => x.id === id);
  return u === undefined ? undefined : { id: u.id, code: u.code, name: u.name };
};

export { unidadDe };
