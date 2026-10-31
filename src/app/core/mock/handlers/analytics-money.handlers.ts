import { addDecimalStrings } from '../../money/decimal-strings';
import { reply, type MockRequest, type MockRouter } from '../mock-router';
import type { MoneyItem, MoneyNotMeasured, MoneyReport } from '../../data-access/admin-portal/analytics-money.types';

/* ============================================================================
    Backend simulado del dinero por módulo (`GET /admin/analytics/money`).

    **SIMULADO · DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Ninguna
    cifra es una medición ni sale de una factura real. El contrato lo está
    implementando la API; este doble cumple el contrato acordado:
    - `amount` es un decimal exacto como cadena; se escala por días con suma de
      cadenas (`addDecimalStrings`), nunca con `number`.
    - Cada fila es de una sola moneda, y hay más de una a propósito.
    - Lo que no se mide figura en `notMeasured` con su razón, no con importe 0.
    - `from` debe ser anterior a `to`; la ventana por defecto es el día de `to`.
    ========================================================================== */

const MS_DIA = 24 * 3_600_000;
const MAX_DIAS = 31;
const SIMULADO = ' (SIMULADO)';

/** Importe y operaciones de un día de actividad sintética. */
const POR_DIA: readonly Omit<MoneyItem, 'moduleLabel'>[] = [
  { module: 'billing', kind: 'FACTURADO', currency: 'BOB', operations: 12, amount: '18450.50' },
  { module: 'billing', kind: 'COBRADO', currency: 'BOB', operations: 9, amount: '14200.00' },
  { module: 'billing', kind: 'FACTURADO', currency: 'USD', operations: 2, amount: '310.75' },
  { module: 'quotations', kind: 'COTIZADO', currency: 'BOB', operations: 21, amount: '53210.00' },
  { module: 'insurance', kind: 'FACTURADO', currency: 'BOB', operations: 6, amount: '9875.25' },
  { module: 'pharmacy', kind: 'COBRADO', currency: 'BOB', operations: 140, amount: '8420.25' },
  { module: 'payments', kind: 'COBRADO', currency: 'USD', operations: 1, amount: '45.00' },
];

const ROTULOS: Readonly<Record<string, string>> = {
  billing: 'Facturación',
  quotations: 'Cotizaciones',
  insurance: 'Seguros',
  pharmacy: 'Farmacia',
  payments: 'Pagos',
};

const NO_MEDIDO: readonly MoneyNotMeasured[] = [
  { module: 'laboratory', reason: 'SIMULADO: el laboratorio todavía no registra importes por operación; no es cero, no está medido.' },
  { module: 'scheduling', reason: 'SIMULADO: la agenda no cobra por sí misma; sus honorarios se miden en Facturación.' },
];

function ventanaInvalida(reason: string, message: string) {
  return reply(422, { statusCode: 422, code: 'VALIDATION_FAILED', message, error: 'Unprocessable Entity', details: { reason } });
}

/** Misma regla que el tráfico: `from` por defecto es la medianoche UTC del día de `to`. */
function resolverVentana(req: MockRequest) {
  const aTexto = req.query.get('to');
  const to = aTexto ? new Date(aTexto) : new Date();
  if (Number.isNaN(to.getTime())) return ventanaInvalida('INVALID_DATE', 'Fecha de ventana no válida');
  const medianoche = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const desdeTexto = req.query.get('from');
  const from = desdeTexto ? new Date(desdeTexto) : new Date(medianoche < to.getTime() ? medianoche : medianoche - MS_DIA);
  if (Number.isNaN(from.getTime())) return ventanaInvalida('INVALID_DATE', 'Fecha de ventana no válida');
  if (from.getTime() >= to.getTime()) return ventanaInvalida('EMPTY_WINDOW', '"from" debe ser anterior a "to"');
  return { from, to };
}

/** `importe × dias` por suma de cadenas decimales: ningún `number` toca el dinero. */
function escalar(importe: string, dias: number): string {
  return addDecimalStrings(Array.from({ length: dias }, () => importe)) ?? importe;
}

export function registrarDinero(router: MockRouter): void {
  router.get('/admin/analytics/money', (req: MockRequest): MoneyReport | ReturnType<typeof reply> => {
    const ventana = resolverVentana(req);
    if ('status' in ventana) return ventana;
    const dias = Math.min(MAX_DIAS, Math.max(1, Math.ceil((ventana.to.getTime() - ventana.from.getTime()) / MS_DIA)));
    return {
      window: { from: ventana.from.toISOString(), to: ventana.to.toISOString() },
      items: POR_DIA.map((fila) => ({
        ...fila,
        moduleLabel: `${ROTULOS[fila.module] ?? fila.module}${SIMULADO}`,
        operations: fila.operations * dias,
        amount: escalar(fila.amount, dias),
      })),
      notMeasured: NO_MEDIDO,
    };
  });
}
