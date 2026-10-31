/* ============================================================================
    Quirófanos — franja F4 de la infraestructura hospitalaria
    (`CONTRATO-F2-F5.md` §F4.3). Tipos de la vista para la sala, sus bloques y
    su utilización.

    Las fechas viajan como texto ISO y se quedan así: la agenda del día compara
    instantes y los formatea, y convertir cada uno a `Date` en el cliente no
    gana nada que `Date.parse` no dé donde hace falta.
    ========================================================================== */

/** Un concepto del catálogo de infraestructura: código estable y rótulo. */
export interface OrConcept {
  readonly code: string;
  readonly display: string;
}

/** El quirófano visto como espacio de F1: ruta legible incluida. */
export interface OperatingRoomSpace {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Camino desde la raíz del establecimiento, con « › » entre escalones. */
  readonly path: string;
  readonly status: OrConcept;
  readonly operationalStatus: OrConcept | null;
}

/** Una fila de `GET /sites/:siteId/operating-rooms`. */
export interface OperatingRoomSummary {
  readonly careSpace: OperatingRoomSpace;
  /** Recurso agendable R0; `null` si la sala todavía no se puede programar. */
  readonly resourceId: string | null;
  readonly prepMinutes: number;
  readonly cleanupMinutes: number;
  readonly todayCases: number;
  readonly todayBlocks: number;
}

/** Quién es dueño de un bloque. */
export type OrBlockOwnerKind = 'SERVICE' | 'SURGEON';

/** Estado de una instancia de bloque. */
export type OrBlockStatus = 'ORB_ACTIVE' | 'ORB_RELEASED' | 'ORB_CANCELLED';

/** El dueño de un bloque, ya con su rótulo. */
export interface OrBlockOwner {
  readonly kind: OrBlockOwnerKind;
  readonly clinicalUnitId: string | null;
  readonly specialtyCode: string | null;
  readonly surgeonProfileId: string | null;
  /** «Traumatología», «Dra. Pérez»: lo que se pinta. */
  readonly label: string;
}

/** Un caso ligado a un bloque. */
export interface OrBlockCase {
  readonly id: string;
  readonly caseNumber: string;
}

/** Una instancia de bloque quirúrgico. */
export interface OrBlock {
  readonly id: string;
  readonly seriesId: string | null;
  readonly operatingRoomId: string;
  readonly owner: OrBlockOwner;
  readonly startsAt: string;
  readonly endsAt: string;
  /** `startsAt − releaseHours`: a partir de ahí el tiempo sin casos vuelve a la agenda. */
  readonly releaseAt: string;
  readonly status: OrBlockStatus;
  readonly releasedAt: string | null;
  /** `null` con el bloque liberado significa liberación automática. */
  readonly releasedByUserId: string | null;
  readonly releaseReason: string | null;
  readonly releasedMinutes: number | null;
  readonly usedMinutes: number;
  readonly cases: readonly OrBlockCase[];
  readonly rowVersion: number;
}

/** Filtros de `GET /sites/:siteId/or-blocks`. */
export interface OrBlockQuery {
  readonly from: string;
  readonly to: string;
  readonly operatingRoomId?: string;
  readonly owner?: string;
}

/** Recurrencia semanal de una serie de bloques. */
export interface OrBlockRecurrence {
  /** Días ISO: 1 = lunes … 7 = domingo. */
  readonly weekdays: readonly number[];
  /** Último día de la serie, `yyyy-mm-dd`. */
  readonly until: string;
}

/** `POST /sites/:siteId/or-blocks`. */
export interface CreateOrBlockRequest {
  readonly operatingRoomId: string;
  readonly ownerKind: OrBlockOwnerKind;
  readonly clinicalUnitId?: string;
  readonly specialtyCode?: string;
  readonly surgeonProfileId?: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly releaseHours?: number;
  readonly recurrence?: OrBlockRecurrence;
}

/** Respuesta del alta: la serie (si hubo recurrencia) y sus instancias. */
export interface CreateOrBlockResult {
  readonly seriesId: string | null;
  readonly blocks: readonly OrBlock[];
}

/** Agrupación de `GET /sites/:siteId/or-utilization`. */
export type OrUtilizationGroupBy = 'room' | 'block' | 'owner';

/** Una sala en un día: sesión, tiempo útil y recambio. */
export interface RoomDayUtilization {
  readonly operatingRoomId: string;
  readonly roomLabel: string;
  readonly date: string;
  readonly sessionMinutes: number;
  readonly touchMinutes: number;
  /** Tiempo útil ÷ sesión, en %, con un decimal. `null` sin sesión. */
  readonly roomUtilizationPct: number | null;
  /** Mediana del recambio (salida de sala → entrada del siguiente). `null` sin pares. */
  readonly turnoverMinutes: number | null;
  readonly firstCaseOnTimePct: number | null;
  readonly cases: number;
}

/** Un bloque con su uso. */
export interface BlockUtilization {
  readonly blockId: string;
  readonly operatingRoomId: string;
  readonly owner: string;
  readonly startsAt: string;
  readonly allocatedMinutes: number;
  readonly releasedMinutes: number;
  readonly usedInBlockMinutes: number;
  readonly turnoverInBlockMinutes: number;
  /** (usado + recambio) ÷ (asignado − liberado), en %. `null` si todo se liberó. */
  readonly blockUtilizationPct: number | null;
}

/** El uso agregado por dueño (servicio o cirujano). */
export interface OwnerUtilization {
  readonly owner: string;
  readonly allocatedMinutes: number;
  readonly releasedMinutes: number;
  readonly usedInBlockMinutes: number;
  readonly blockUtilizationPct: number | null;
}

/** Los totales del período, para las tarjetas de KPI. */
export interface UtilizationTotals {
  readonly sessionMinutes: number;
  readonly touchMinutes: number;
  readonly roomUtilizationPct: number | null;
  readonly turnoverMinutes: number | null;
  readonly firstCaseOnTimePct: number | null;
  readonly blockUtilizationPct: number | null;
}

/** `GET /sites/:siteId/or-utilization`. */
export interface OrUtilization {
  readonly from: string;
  readonly to: string;
  /** Cuándo se calculó: alimenta S7. */
  readonly asOf: string;
  readonly totals: UtilizationTotals;
  readonly rooms: readonly RoomDayUtilization[];
  readonly blocks: readonly BlockUtilization[];
  readonly owners: readonly OwnerUtilization[];
}

/** Filtros de la utilización. */
export interface OrUtilizationQuery {
  readonly from: string;
  readonly to: string;
  readonly operatingRoomId?: string;
  readonly groupBy?: OrUtilizationGroupBy;
}

/** Estado de la orden de recambio del quirófano (orden de limpieza de F2). */
export type TurnoverCleaningStatus = 'CLN_PENDING' | 'CLN_IN_PROGRESS' | 'CLN_DONE' | 'CLN_INSPECTED';

/** La orden de limpieza que abre la salida de sala. */
export interface TurnoverCleaning {
  readonly id: string;
  readonly status: TurnoverCleaningStatus;
  readonly rowVersion: number;
}

/** Los pasos de la orden que se operan desde la ficha (F2: `/cleaning-orders/:id/…`). */
export type TurnoverStep = 'start' | 'finish' | 'inspect';
