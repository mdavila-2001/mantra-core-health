/* ============================================================================
    Quirófanos — franja F4 de la infraestructura hospitalaria
    (`CONTRATO-F2-F5.md` §F4.3). Formas **de la API**
    (`procedures_perioperative/services/or/*.ts` y `periop-or.controller.ts`):
    lo que la vista necesita y la API no manda se arma en el cliente, nunca se
    da por existente.

    Las fechas viajan como texto ISO y se quedan así.
    ========================================================================== */

/** La sala tal como la lista `GET /sites/:siteId/operating-rooms`. */
export interface OperatingRoomSpace {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Una fila de `GET /sites/:siteId/operating-rooms` (`OperatingRoomsReadUseCases.list`). */
export interface OperatingRoomSummary {
  readonly careSpace: OperatingRoomSpace;
  /** Recurso agendable R0; `null` si la sala todavía no se puede programar. */
  readonly resourceId: string | null;
  readonly prepMinutes: number;
  readonly cleanupMinutes: number;
  /** Celda operativa de F2 (disponibilidad, higiene…); la agenda no la interpreta. */
  readonly cell?: unknown;
  readonly todayCases: number;
  readonly todayBlocks: number;
}

/** Quién es dueño de un bloque. */
export type OrBlockOwnerKind = 'SERVICE' | 'SURGEON';

/** Estado de una instancia de bloque. */
export type OrBlockStatus = 'ORB_ACTIVE' | 'ORB_RELEASED' | 'ORB_CANCELLED';

/** El dueño de un bloque (`blockView.owner`): ids, sin rótulo. */
export interface OrBlockOwner {
  readonly kind: OrBlockOwnerKind;
  readonly clinicalUnitId: string | null;
  readonly specialtyConceptId: string | null;
  readonly surgeonProfileId: string | null;
  /**
   * Rótulo resuelto por la API (unidad, especialidad o cirujano; `3036730d2`).
   * Sin él, el cliente lo arma con sus catálogos.
   */
  readonly label?: string | null;
}

/** `blockView`: lo que devuelven el alta, la liberación y la cancelación. */
export interface OrBlockView {
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
  readonly rowVersion: number;
}

/** Una fila de `GET /sites/:siteId/or-blocks`: la vista más su uso. */
export interface OrBlock extends OrBlockView {
  readonly usedMinutes: number;
  /** Ids de los casos ligados (sin número: la agenda los cruza con sus casos). */
  readonly cases: readonly string[];
}

/** Filtros de `GET /sites/:siteId/or-blocks` (la API no filtra por dueño). */
export interface OrBlockQuery {
  readonly from: string;
  readonly to: string;
  readonly operatingRoomId?: string;
}

/** Recurrencia semanal de una serie de bloques. */
export interface OrBlockRecurrence {
  /** Días ISO: 1 = lunes … 7 = domingo. */
  readonly weekdays: readonly number[];
  /** Último día de la serie, `yyyy-mm-dd`. */
  readonly until: string;
}

/** `POST /sites/:siteId/or-blocks` (`CreateOrBlocksDto`). */
export interface CreateOrBlockRequest {
  readonly operatingRoomId: string;
  readonly ownerKind: OrBlockOwnerKind;
  readonly clinicalUnitId?: string;
  /** Concepto de especialidad (UUID del catálogo). */
  readonly specialtyConceptId?: string;
  readonly surgeonProfileId?: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly releaseHours?: number;
  readonly recurrence?: OrBlockRecurrence;
}

/** Respuesta del alta: la serie (si hubo recurrencia) y sus instancias. */
export interface CreateOrBlockResult {
  readonly seriesId: string | null;
  readonly blocks: readonly OrBlockView[];
}

/** El uso de bloques de una sala en el período. */
export interface RoomBlockUtilization {
  readonly allocated: number;
  readonly released: number;
  /** usado ÷ (asignado − liberado), en %. `null` si todo se liberó o no hubo. */
  readonly blockUtilizationPct: number | null;
}

/** Una sala en el período (`utilization().rooms[]`). */
export interface RoomUtilization {
  readonly operatingRoomId: string;
  readonly code: string;
  readonly sessionMinutes: number;
  readonly touchMinutes: number;
  /** Tiempo útil ÷ sesión, en %. `null` sin sesión. */
  readonly roomUtilizationPct: number | null;
  /** Mediana del recambio (salida → entrada del siguiente). `null` sin pares. */
  readonly turnoverMinutesP50: number | null;
  readonly blocks: RoomBlockUtilization;
}

/** Los totales que manda la API (`3036730d2`). */
export interface ApiUtilizationTotals {
  readonly sessionMinutes: number;
  readonly touchMinutes: number;
  readonly roomUtilizationPct: number | null;
  readonly blockUtilizationPct: number | null;
}

/** Los totales para las tarjetas: los de la API más lo que el cliente suma de `rooms[]`. */
export interface UtilizationTotals extends ApiUtilizationTotals {
  readonly turnoverMinutesP50: number | null;
  readonly blockAllocated: number;
  readonly blockReleased: number;
}

/** `GET /sites/:siteId/or-utilization`. */
export interface OrUtilization {
  readonly from: string;
  readonly to: string;
  readonly rooms: readonly RoomUtilization[];
  /** Cuándo se calculó. Sin él, S7 usa la hora de la respuesta. */
  readonly asOf?: string;
  /** Totales: los de la API completados por el cliente (`withTotals`). */
  readonly totals?: UtilizationTotals;
}

/** Filtros de la utilización. */
export interface OrUtilizationQuery {
  readonly from: string;
  readonly to: string;
  readonly operatingRoomId?: string;
}

/** Estado de una orden de limpieza de F2 (`CLEANING_STATUS`). */
export type CleaningStatusCode = 'CLN_PENDING' | 'CLN_IN_PROGRESS' | 'CLN_DONE' | 'CLN_INSPECTED' | 'CLN_REJECTED' | 'CLN_CANCELLED';

/** La orden de recambio del quirófano, como la usa la ficha del caso. */
export interface TurnoverCleaning {
  readonly id: string;
  readonly statusCode: CleaningStatusCode;
  readonly rowVersion: number;
  /** Lo que el actor puede hacer con la orden según la API (`start`, `finish`…). Ausente = no se sabe. */
  readonly allowedTransitions?: readonly string[];
}

/** `CleaningOrderDto` (F2): lo que devuelven `start` y `finish`. */
export interface CleaningOrderDto {
  readonly id: string;
  readonly careSpaceId: string;
  readonly careSpaceCode: string;
  readonly careSpaceName: string;
  readonly typeCode: string;
  readonly statusCode: CleaningStatusCode;
  readonly rowVersion: number;
}

/** `inspect` devuelve la orden y, si se rechazó, la que se abre en su lugar. */
export interface CleaningInspectResult {
  readonly order: CleaningOrderDto;
  readonly nextOrderId: string | null;
}

/** Los pasos de la orden que se operan desde la ficha (F2: `/cleaning-orders/:id/…`). */
export type TurnoverStep = 'start' | 'finish' | 'inspect';
