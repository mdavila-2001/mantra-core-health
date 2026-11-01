/* ============================================================================
    Piezas en ejecución (`GET /admin/ops/runtime-pieces`).

    Espejo del contrato de la API (`platform_ops/runtime_pieces`). Una «pieza»
    es cualquier cosa del código que puede estar corriendo: un proceso, un tick
    programado, un consumidor de cola, un endpoint interno, una comprobación de
    salud, un conector externo. El servidor las descubre leyendo el código, las
    contrasta con el registro de herramientas y con los latidos, y decide el
    estado; el front sólo lo pinta. Las instancias reutilizan el estado de la
    sonda de vida (`ops-liveness.types.ts`), no lo redefinen.
    ========================================================================== */

import type { InstanceCause, InstanceState, InstanceType } from './ops-liveness.types';

export const PIECE_KINDS = [
  'PROCESO',
  'JOB_PROGRAMADO',
  'TEMPORIZADOR',
  'CONSUMIDOR_COLA',
  'JOB_NOMBRADO',
  'ENDPOINT_INTERNO',
  'SALUD',
  'CONECTOR',
] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

/** `NO_MEDIBLE`: la clase de pieza no tiene mecanismo de latido; que exista no prueba que corra. */
export const PIECE_STATES = [
  'VIVA',
  'SIN_LATIDO',
  'NO_REGISTRADA',
  'HUERFANA',
  'DESHABILITADA',
  'NO_MEDIBLE',
] as const;
export type PieceState = (typeof PIECE_STATES)[number];

/** De dónde sale la prueba de vida: la propia pieza, su proceso anfitrión, o nada. */
export type EvidenceLevel = 'PROPIO' | 'ANFITRION' | 'NINGUNO';

/** Causas propias de las piezas; el resto son las de la sonda de vida. */
export type PieceOwnCause =
  | 'SELF'
  | 'HOST_ALIVE'
  | 'NOT_IN_REGISTRY'
  | 'NOT_IN_CODE'
  | 'REGISTRY_DISABLED'
  | 'CONFIG_FLAG_OFF'
  | 'NO_HEARTBEAT_MECHANISM'
  | 'HOST_UNRESOLVED'
  | 'CODE_UNAVAILABLE';
export type PieceCause = InstanceCause | PieceOwnCause;

export type ScheduleType = 'interval' | 'cron' | 'timeout' | 'poll';

export interface PieceSchedule {
  readonly type: ScheduleType;
  /** `null` si el argumento no se pudo resolver en el código. */
  readonly intervalMs: number | null;
  readonly cron: string | null;
  /** El argumento tal como está escrito en el código. */
  readonly raw: string;
}

export interface PieceLauncher {
  readonly file: string;
  readonly line: number;
  readonly what: string;
}

export interface PieceEnable {
  readonly how: string;
  /** Sólo NOMBRES de variables de entorno, nunca valores. */
  readonly envVars: readonly string[];
  readonly launchers: readonly PieceLauncher[];
}

export type HeartbeatMode = 'PROCESS' | 'SELF' | 'INHERITED' | 'NONE';

export interface PieceHeartbeat {
  readonly mode: HeartbeatMode;
  readonly instanceId: string | null;
}

export interface PieceProvenance {
  readonly source: string;
  /** `archivo:línea` donde se descubrió. */
  readonly evidence: string;
  readonly discoveredAt: string;
  readonly fingerprint: string;
  readonly kind: string;
  readonly heartbeat: string;
}

export interface PieceRegistry {
  readonly present: boolean;
  readonly active: boolean | null;
  readonly provenance: PieceProvenance | null;
  /** `true` si el registro quedó atrás del código. */
  readonly stale: boolean | null;
}

export type PieceAttribute = string | number | boolean | null;

export interface RuntimePiece {
  /** `code` en el registro de herramientas (`rtp.<tipo>.…`). */
  readonly id: string;
  readonly kind: PieceKind;
  readonly name: string;
  readonly module: string;
  readonly hosts: readonly string[];
  readonly state: PieceState;
  readonly cause: PieceCause;
  readonly causeDetail: string;
  readonly evidenceLevel: EvidenceLevel;
  /** Estado de la instancia anfitriona según la sonda; `null` si no aplica. */
  readonly instanceState: InstanceState | null;
  /** `null` cuando no hay código disponible. */
  readonly inCode: boolean | null;
  /** `false`: declarada en el código pero ningún módulo la registra. */
  readonly wired: boolean | null;
  readonly required: boolean | null;
  readonly evidence: { readonly file: string; readonly line: number };
  readonly schedule: PieceSchedule | null;
  readonly enable: PieceEnable;
  readonly heartbeat: PieceHeartbeat;
  readonly attributes: Readonly<Record<string, PieceAttribute>>;
  readonly registry: PieceRegistry;
}

export interface RuntimePieceDetail extends RuntimePiece {
  readonly evaluatedAt: string;
  readonly findings: readonly RuntimeFinding[];
  readonly launchers: readonly PieceLauncher[];
}

export const FINDING_SEVERITIES = ['ALTA', 'MEDIA', 'BAJA', 'INFO'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_RULES = [
  'NO_REGISTRADA',
  'HUERFANA',
  'NO_CABLEADA',
  'SIN_LATIDO_REQUERIDA',
  'SIN_LATIDO',
  'FUERA_DE_SONDA',
  'NO_DESPLEGADA',
  'HUELLA_DESACTUALIZADA',
  'JOB_SIN_CONSUMIDOR',
  'SIN_PROCEDENCIA',
  'CODIGO_NO_DISPONIBLE',
] as const;
export type FindingRule = (typeof FINDING_RULES)[number];

export interface RuntimeFinding {
  readonly id: string;
  readonly rule: FindingRule;
  readonly severity: FindingSeverity;
  readonly pieceId: string | null;
  readonly message: string;
}

/** Una instancia (API o worker) con lo que el código dice que aloja. */
export interface RuntimeInstance {
  readonly id: string;
  readonly label: string;
  readonly type: InstanceType;
  readonly required: boolean;
  readonly state: InstanceState;
  readonly cause: InstanceCause;
  readonly causeDetail: string;
  readonly lastHeartbeatAt: string | null;
  readonly ageSeconds: number | null;
  readonly startedAt: string | null;
  readonly reportedStatus: 'running' | 'draining' | 'starting' | 'stopped' | null;
  readonly pieceCount: number;
  readonly piecesByKind: Readonly<Partial<Record<PieceKind, number>>>;
}

export interface RuntimePiecesSummary {
  readonly total: number;
  readonly byState: Readonly<Record<PieceState, number>>;
  readonly byKind: Readonly<Record<PieceKind, number>>;
}

export interface RuntimePiecesMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface RuntimePiecesScan {
  /** `false`: no hay código fuente ni manifiesto de compilación; no se puede detectar lo huérfano ni lo no registrado. */
  readonly available: boolean;
  /** `live`: se leyó `src/` en el momento. `manifest`: la lista congelada al compilar (la imagen sólo trae `dist/`). */
  readonly source: 'live' | 'manifest';
  /** Cuándo se generó el manifiesto; `null` si la lectura es en vivo. */
  readonly generatedAt: string | null;
  readonly reason: string | null;
  readonly filesRead: number;
  readonly warnings: readonly string[];
}

export interface RuntimePiecesThresholds {
  readonly workerHeartbeatIntervalSeconds: number;
  readonly degradedAfterSeconds: number;
  readonly downAfterSeconds: number;
}

export interface RuntimePiecesPage {
  readonly data: readonly RuntimePiece[];
  readonly meta: RuntimePiecesMeta;
  readonly evaluatedAt: string;
  readonly summary: RuntimePiecesSummary;
  readonly scan: RuntimePiecesScan;
  readonly heartbeatStore: { readonly status: 'up' | 'down'; readonly reason: string | null };
  readonly thresholds: RuntimePiecesThresholds;
  readonly instances: readonly RuntimeInstance[];
  readonly findings: readonly RuntimeFinding[];
  /** Lo que esta lectura no mide: se declara, nunca se pinta como «viva». */
  readonly notMeasured: readonly string[];
}

/** Filtros del listado; todos opcionales. La API rechaza los desconocidos. */
export interface RuntimePiecesQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly kind?: PieceKind;
  readonly state?: PieceState;
  readonly host?: string;
  readonly module?: string;
  readonly q?: string;
  readonly withFindings?: boolean;
}

export interface DiscoveryReport {
  readonly dryRun: boolean;
  readonly discoveredAt: string;
  readonly scanned: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly orphans: number;
  readonly conflicts: number;
  readonly createdIds: readonly string[];
  readonly updatedIds: readonly string[];
  readonly orphanIds: readonly string[];
  readonly conflictIds: readonly string[];
  readonly warnings: readonly string[];
}
