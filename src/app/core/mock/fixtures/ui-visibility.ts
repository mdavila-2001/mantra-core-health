import type {
  UiElement,
  UiElementKind,
  UiVisibilityRule,
} from '../../data-access/ui-visibility/ui-visibility.types';
import { IDS, TENANT_FARMACIA } from '../mock-session';
import { iso, uuid } from '../mock-store';

/* ============================================================================
    Catálogo y reglas de ARRANQUE del simulador de visibilidad
    (`handlers/ui-visibility.handlers.ts`). **SIMULADO**: cada etiqueta lleva
    «(SIMULADO)» y ninguna clave sale del código real.
    ========================================================================== */

const SIMULADO = ' (SIMULADO)';

export interface FilaElemento extends UiElement {
  /** Cuándo se creó, sólo para ordenar la auditoría simulada. */
  readonly createdAt: string;
}

export const idElemento = (clave: string): string => uuid(`ui-element-${clave}`);
const idRegla = (n: number): string => uuid(`ui-rule-${n}`);

type Semilla = readonly [
  clave: string,
  kind: UiElementKind,
  etiqueta: string,
  padre: string | null,
  extra?: Partial<Pick<UiElement, 'source' | 'status' | 'defaultVisible' | 'description'>>,
];

const SEMILLA_ELEMENTOS: readonly Semilla[] = [
  ['pharmacy', 'MODULE', 'Farmacia', null],
  ['pharmacy.orders', 'SCREEN', 'Pedidos', 'pharmacy'],
  ['pharmacy.orders.filters', 'SECTION', 'Filtros de pedidos', 'pharmacy.orders'],
  ['pharmacy.orders.export-button', 'ACTION', 'Botón exportar pedidos', 'pharmacy.orders', {
    description: 'Descarga los pedidos filtrados.',
  }],
  ['pharmacy.orders.patient-phone', 'FIELD', 'Teléfono del paciente', 'pharmacy.orders'],
  ['pharmacy.catalog', 'SCREEN', 'Catálogo de productos', 'pharmacy'],
  ['pharmacy.catalog.bulk-import', 'ACTION', 'Carga masiva', 'pharmacy.catalog'],
  ['laboratory', 'MODULE', 'Laboratorio', null],
  ['laboratory.results', 'SCREEN', 'Resultados', 'laboratory'],
  ['laboratory.results.print-button', 'ACTION', 'Botón imprimir', 'laboratory.results'],
  ['laboratory.results.trend-chart', 'WIDGET', 'Gráfico de tendencia', 'laboratory.results'],
  ['agenda', 'MODULE', 'Agenda', null],
  ['agenda.calendar', 'SCREEN', 'Calendario', 'agenda'],
  ['agenda.calendar.new-booking', 'ACTION', 'Nueva reserva', 'agenda.calendar'],
  ['billing', 'MODULE', 'Facturación', null],
  ['billing.invoices', 'SCREEN', 'Facturas', 'billing'],
  ['billing.invoices.void-button', 'ACTION', 'Botón anular factura', 'billing.invoices'],
  ['billing.invoices.manual-note', 'FIELD', 'Nota manual', 'billing.invoices', {
    source: 'ADMIN',
    defaultVisible: false,
    description: 'Alta manual de ejemplo: nace oculta por omisión.',
  }],
  ['billing.legacy-report', 'SCREEN', 'Reporte anterior', 'billing', { status: 'RETIRED' }],
];

export const ELEMENTOS_DE_FABRICA: readonly FilaElemento[] = SEMILLA_ELEMENTOS.map(
  ([key, kind, etiqueta, parentKey, extra]) => ({
    id: idElemento(key),
    key,
    kind,
    moduleCode: key.split('.')[0]!,
    parentKey,
    label: `${etiqueta}${SIMULADO}`,
    description: extra?.description ?? null,
    defaultVisible: extra?.defaultVisible ?? true,
    source: extra?.source ?? 'CODE',
    status: extra?.status ?? 'ACTIVE',
    activeRuleCount: 0,
    createdAt: iso(-30),
  }),
);

const AUTOR_SEMILLA = `Soporte AloVida${SIMULADO}`;
const regla = (
  n: number,
  r: Pick<UiVisibilityRule, 'elementKey' | 'effect' | 'subjectType' | 'subjectId' | 'reason'> &
    Partial<Pick<UiVisibilityRule, 'validFrom' | 'validTo' | 'subjectLabel'>>,
): UiVisibilityRule => ({
  id: idRegla(n),
  validFrom: null,
  validTo: null,
  subjectLabel: null,
  version: 1,
  createdAt: iso(-10 + n),
  createdByLabel: AUTOR_SEMILLA,
  ...r,
});

export const REGLAS_DE_FABRICA: readonly UiVisibilityRule[] = [
  regla(1, {
    elementKey: 'pharmacy.orders.export-button',
    effect: 'HIDE',
    subjectType: 'ROLE',
    subjectId: 'PHARMACY_STAFF',
    reason: 'El personal de mostrador no exporta pedidos (regla sintética).',
  }),
  regla(2, {
    elementKey: 'pharmacy.orders.export-button',
    effect: 'SHOW',
    subjectType: 'USER',
    subjectId: IDS.farmacia.userId,
    reason: 'La cuenta de Farmacia Vida sí exporta: USER gana a ROLE (regla sintética).',
  }),
  regla(3, {
    elementKey: 'laboratory.results',
    effect: 'HIDE',
    subjectType: 'ORG_TYPE',
    subjectId: 'PAYER',
    reason: 'Las aseguradoras no presentan resultados; se oculta la pantalla entera (sintética).',
  }),
  regla(4, {
    elementKey: 'billing.invoices.void-button',
    effect: 'HIDE',
    subjectType: 'ALL',
    subjectId: null,
    validTo: iso(-2),
    reason: 'Se ocultó durante la migración y ya terminó (regla sintética, terminada).',
  }),
  regla(5, {
    elementKey: 'agenda.calendar.new-booking',
    effect: 'HIDE',
    subjectType: 'TENANT',
    subjectId: TENANT_FARMACIA,
    reason: 'Farmacia Vida no agenda reservas (regla sintética).',
  }),
];
