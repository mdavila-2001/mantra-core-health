/* ============================================================================
    Bitácora de auditoría (API: `GET /audit/log` y `GET /audit/data-access`).

    Es una vista de plataforma: atraviesa organizaciones y la lee quien audita
    (`AUDITOR`, `DPO`, `SECURITY_ADMIN`). Cada lectura queda, a su vez,
    registrada como acceso sensible del lado del servidor.

    El riesgo para la seguridad de la salud (`healthRisk`) lo deriva la API al
    leer; esta capa no lo recalcula ni lo infiere.
    ========================================================================== */

/** Resultado de la operación que dejó el sello. `UNKNOWN` = el sello no lo dice. */
export type AuditResult = 'SUCCESS' | 'FAILURE' | 'UNKNOWN';

/** Resultados por los que la API acepta filtrar. */
export const AUDIT_RESULT_FILTERS = ['SUCCESS', 'FAILURE'] as const;

/** Verbos que pueden dejar sello (los que mutan). */
export const AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type AuditMethod = (typeof AUDIT_METHODS)[number];

/** Operaciones que registra la bitácora de accesos a datos. */
export const DATA_OPERATIONS = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'] as const;
export type DataOperation = (typeof DATA_OPERATIONS)[number];

/** Escala de riesgo para la seguridad de la salud, de mayor a menor. */
export const HEALTH_RISKS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type HealthRisk = (typeof HEALTH_RISKS)[number];

/** Tope de elementos por página que acepta la API. */
export const AUDIT_MAX_PAGE_SIZE = 200;

/** Filtros comunes a las dos consultas. Sin rango, la API mira los últimos 30 días. */
export interface AuditPageQuery {
  /** Desde (ISO 8601, incluido). */
  readonly from?: string;
  /** Hasta (ISO 8601, excluido). */
  readonly to?: string;
  /** Quién actuó. */
  readonly userId?: string;
  readonly tenantId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AuditLogQuery extends AuditPageQuery {
  readonly result?: (typeof AUDIT_RESULT_FILTERS)[number];
  /** Acción exacta: código de negocio o `HTTP <VERBO> <plantilla>`. */
  readonly action?: string;
  readonly method?: AuditMethod;
  /** Plantilla exacta de la ruta, con `:parámetros`. */
  readonly route?: string;
  readonly entity?: string;
}

export interface DataAccessQuery extends AuditPageQuery {
  readonly operation?: DataOperation;
  readonly resourceType?: string;
  readonly patientProfileId?: string;
}

/** Una acción que mutó algo. `method` y `route` son `null` si la API no pudo derivarlos. */
export interface AuditLogEntry {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly result: AuditResult | string;
  readonly ip: string | null;
  readonly method: string | null;
  readonly route: string | null;
  readonly healthRisk: HealthRisk | string;
  readonly recordedAt: Date;
}

/** Una lectura (o escritura) de un dato sensible. */
export interface DataAccessEntry {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string | null;
  readonly patientProfileId: string | null;
  readonly operation: DataOperation | string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly purpose: string | null;
  readonly healthRisk: HealthRisk | string;
  readonly recordedAt: Date;
}

/** Una página por cursor. La API no devuelve total: contarlo es lo que el cursor evita. */
export interface AuditPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly limit: number;
}
