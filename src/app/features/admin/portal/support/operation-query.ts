import type {
  MetodoHttp,
  OperacionesQuery,
  Riesgo,
} from '../../../../core/data-access/admin-portal/portal.types';
import { metodoHttp, operationOrigin, riesgo, type LabelTable } from '../portal-labels';

/** Los filtros de operaciones y del mapa de rutas, tal como viajan en la URL. */
export const OPERATION_FILTER_KEYS = [
  'q',
  'modulo',
  'flujo',
  'riesgo',
  'metodo',
  'origen',
  'senal',
] as const;
export type OperationFilters = Readonly<Record<(typeof OPERATION_FILTER_KEYS)[number], string>>;

/** ¿El código es uno de los que la API acepta para ese filtro? */
function isKnown<T extends string>(table: LabelTable, value: string): value is T {
  return table.codes.includes(value);
}

/**
 * De la URL a la consulta. Un código que la API no acepta (una dirección
 * escrita a mano con `?riesgo=FOO`) se descarta en vez de volver como 400.
 */
export function operationQuery(
  filters: OperationFilters,
  page: { readonly cursor?: string; readonly limit: number },
): OperacionesQuery {
  const { q, modulo, flujo, senal, riesgo: risk, metodo, origen } = filters;
  return {
    ...(q ? { q } : {}),
    ...(modulo ? { modulo } : {}),
    ...(flujo ? { flujo } : {}),
    ...(senal ? { senal } : {}),
    ...(isKnown<Riesgo>(riesgo, risk) ? { riesgo: risk } : {}),
    ...(isKnown<MetodoHttp>(metodoHttp, metodo) ? { metodo } : {}),
    ...(isKnown<'CONTRATO' | 'CONTRATO_AUSENTE'>(operationOrigin, origen) ? { origen } : {}),
    ...(page.cursor ? { cursor: page.cursor } : {}),
    limit: page.limit,
  };
}
