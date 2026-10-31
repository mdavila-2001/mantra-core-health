import type { GovernanceTiles } from './governance-reports.types';

/* ============================================================================
    Los diez mosaicos del tablero de gobierno (CONTRATO-GOBIERNO §6.6, §9.3 fila 2) y «Lo que
    necesita su atención hoy». Puro: recibe la respuesta de `GET /org/governance/summary` y
    devuelve lo que la pantalla pinta. Nunca depende solo del color: cada mosaico trae su
    `statusText`.
   ========================================================================== */

export type GovernanceTileId = keyof GovernanceTiles;
export type TileTone = 'ok' | 'warn' | 'risk' | 'info';

export interface GovernanceTileView {
  readonly id: GovernanceTileId;
  readonly label: string;
  readonly value: number;
  readonly tone: TileTone;
  /** «En orden», «Requiere atención», «Revise pronto» o «Informativo»: el semáforo en palabras. */
  readonly statusText: string;
  /** Una oración con el número y su plural. */
  readonly description: string;
  /** A dónde lleva el mosaico: su lista filtrada. */
  readonly route: string;
  readonly query?: Readonly<Record<string, string>>;
}

export interface AttentionItem {
  readonly id: GovernanceTileId;
  readonly tone: TileTone;
  readonly text: string;
  readonly actionLabel: string;
  readonly route: string;
  readonly query?: Readonly<Record<string, string>>;
}

const BASE = '/administration/access-governance';

interface TileSpec {
  readonly id: GovernanceTileId;
  readonly label: string;
  /** Qué tan grave es que sea mayor que cero. */
  readonly severity: 'info' | 'warn' | 'risk';
  readonly route: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly actionLabel: string;
  readonly one: string;
  readonly many: string;
  readonly none: string;
}

/** El orden es el del tablero. La gravedad ordena «lo que necesita su atención». */
const SPECS: readonly TileSpec[] = [
  {
    id: 'peopleWithLiveAccess',
    label: 'Personas con acceso',
    severity: 'info',
    route: `${BASE}/matrix`,
    actionLabel: 'Ver la matriz',
    one: '1 persona tiene acceso vigente.',
    many: '{n} personas tienen acceso vigente.',
    none: 'Nadie tiene acceso vigente.',
  },
  {
    id: 'highRiskGrants',
    label: 'Accesos de alto riesgo',
    severity: 'warn',
    route: `${BASE}/matrix`,
    query: { sensitivity: 'HIGH' },
    actionLabel: 'Revisar los accesos',
    one: '1 permiso de alto riesgo está vigente.',
    many: '{n} permisos de alto riesgo están vigentes.',
    none: 'No hay permisos de alto riesgo.',
  },
  {
    id: 'overdueCertifications',
    label: 'Certificaciones vencidas',
    severity: 'risk',
    route: `${BASE}/campaigns`,
    query: { status: 'overdue' },
    actionLabel: 'Ver las campañas',
    one: '1 certificación vencida sin revisar.',
    many: '{n} certificaciones vencidas sin revisar.',
    none: 'No hay certificaciones vencidas.',
  },
  {
    id: 'ownerlessAccounts',
    label: 'Cuentas sin dueño',
    severity: 'warn',
    route: `${BASE}/lifecycle`,
    actionLabel: 'Asignar un dueño',
    one: '1 cuenta no tiene responsable.',
    many: '{n} cuentas no tienen responsable.',
    none: 'Todas las cuentas tienen responsable.',
  },
  {
    id: 'inactiveAccounts',
    label: 'Cuentas inactivas',
    severity: 'warn',
    route: '/administration/support-team',
    actionLabel: 'Ver las cuentas',
    one: '1 cuenta lleva días sin usarse.',
    many: '{n} cuentas llevan días sin usarse.',
    none: 'No hay cuentas inactivas.',
  },
  {
    id: 'activeSodExceptions',
    label: 'Excepciones vigentes',
    severity: 'warn',
    route: `${BASE}/sod`,
    query: { tab: 'exceptions' },
    actionLabel: 'Ver las excepciones',
    one: '1 excepción de separación de funciones está vigente.',
    many: '{n} excepciones de separación de funciones están vigentes.',
    none: 'No hay excepciones vigentes.',
  },
  {
    id: 'pendingApprovalsOver24h',
    label: 'Aprobaciones pendientes',
    severity: 'warn',
    route: `${BASE}/approvals`,
    actionLabel: 'Ver las aprobaciones',
    one: '1 aprobación espera hace más de un día.',
    many: '{n} aprobaciones esperan hace más de un día.',
    none: 'No hay aprobaciones atrasadas.',
  },
  {
    id: 'openAnomalies',
    label: 'Anomalías abiertas',
    severity: 'risk',
    route: `${BASE}/anomalies`,
    actionLabel: 'Ver las anomalías',
    one: '1 anomalía abierta.',
    many: '{n} anomalías abiertas.',
    none: 'No hay anomalías abiertas.',
  },
  {
    id: 'grantsAboveCeiling',
    label: 'Permisos fuera de techo',
    severity: 'risk',
    route: '/administration/support-team',
    actionLabel: 'Corregir los permisos',
    one: '1 permiso excede el techo de su rol.',
    many: '{n} permisos exceden el techo de su rol.',
    none: 'Ningún permiso excede su techo.',
  },
  {
    id: 'breakGlassUnreviewed',
    label: 'Accesos de emergencia por revisar',
    severity: 'risk',
    route: '/administration/support-activity',
    actionLabel: 'Revisar la actividad',
    one: '1 acceso de emergencia espera revisión.',
    many: '{n} accesos de emergencia esperan revisión.',
    none: 'No hay accesos de emergencia por revisar.',
  },
];

const RANK: Readonly<Record<TileTone, number>> = { risk: 3, warn: 2, info: 1, ok: 0 };

function valueOf(tiles: GovernanceTiles, id: GovernanceTileId): number {
  const raw = (tiles as Partial<Record<GovernanceTileId, number>>)[id];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function toneOf(spec: TileSpec, value: number): TileTone {
  if (spec.severity === 'info') return 'info';
  return value > 0 ? spec.severity : 'ok';
}

function statusOf(tone: TileTone): string {
  switch (tone) {
    case 'ok':
      return 'En orden';
    case 'info':
      return 'Informativo';
    case 'warn':
      return 'Revise pronto';
    case 'risk':
      return 'Requiere atención';
  }
}

function describe(spec: TileSpec, value: number): string {
  if (value === 0) return spec.none;
  return (value === 1 ? spec.one : spec.many).replace('{n}', String(value));
}

/** Los diez mosaicos, en el orden del tablero. */
export function tileViews(tiles: GovernanceTiles): readonly GovernanceTileView[] {
  return SPECS.map((spec) => {
    const value = valueOf(tiles, spec.id);
    const tone = toneOf(spec, value);
    return {
      id: spec.id,
      label: spec.label,
      value,
      tone,
      statusText: statusOf(tone),
      description: describe(spec, value),
      route: spec.route,
      ...(spec.query === undefined ? {} : { query: spec.query }),
    };
  });
}

/** «Lo que necesita su atención hoy»: hasta cinco acciones, las de más riesgo y más volumen primero. */
export function attentionItems(tiles: GovernanceTiles, max = 5): readonly AttentionItem[] {
  return SPECS.map((spec, order) => ({ spec, order, value: valueOf(tiles, spec.id) }))
    .filter(({ spec, value }) => spec.severity !== 'info' && value > 0)
    .sort(
      (a, b) =>
        RANK[b.spec.severity] - RANK[a.spec.severity] || b.value - a.value || a.order - b.order,
    )
    .slice(0, max)
    .map(({ spec, value }) => ({
      id: spec.id,
      tone: toneOf(spec, value),
      text: describe(spec, value),
      actionLabel: spec.actionLabel,
      route: spec.route,
      ...(spec.query === undefined ? {} : { query: spec.query }),
    }));
}
