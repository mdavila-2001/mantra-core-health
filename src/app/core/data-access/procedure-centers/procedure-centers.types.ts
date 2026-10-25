import type { GeoPoint } from '../pharmacy/pharmacy.types';

/** Qué se le manda a `GET /clinical/me/procedure-centers`: nunca los procedimientos. */
export interface ProcedureCentersQuery {
  /** Desde dónde medir; sólo si la persona lo eligió. */
  readonly origin?: GeoPoint;
  /** Tope de centros. */
  readonly limit?: number;
}

/** Un procedimiento pedido a la persona y todavía sin cumplir. */
export interface PendingProcedure {
  readonly serviceRequestId: string;
  readonly conceptId: string;
  readonly categoryConceptId: string;
  readonly requestedAt: Date;
}

/** Una sede que ofrece al menos uno de los procedimientos pedidos. */
export interface ProcedureCenter {
  readonly siteId: string;
  readonly practiceId: string;
  readonly practiceName: string;
  readonly siteName: string;
  readonly complete: boolean;
  readonly missingProcedureConceptIds: readonly string[];
  readonly distanceKm: number | null;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

/** Respuesta: lo pendiente y las sedes, completas primero. */
export interface ProcedureCentersResult {
  readonly procedures: readonly PendingProcedure[];
  readonly centers: readonly ProcedureCenter[];
  readonly total: number;
  readonly limit: number;
}
