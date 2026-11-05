import { isDecimalString } from '../../../core/money/decimal-strings';
import type { MoneyItem, MoneyKind } from '../../../core/data-access/admin-portal/analytics-money.types';

/* ============================================================================
    Formato y orden del dinero en «Medición por funcionalidad».

    **Ningún importe pasa por `number`.** El importe llega como cadena decimal
    exacta y se formatea cortando la cadena: separador de miles en la parte
    entera, coma decimal, al menos dos decimales. `Number('9007199254740993.10')`
    daría `9007199254740992`; acá se conserva el último centavo.
    ========================================================================== */

/** `"18450.5"` → `"18.450,50"`. Lo que no es un decimal válido se muestra tal cual, sin inventar. */
export function formatearImporte(importe: string): string {
  const texto = importe.trim();
  if (!isDecimalString(texto)) return importe;
  const negativo = texto.startsWith('-');
  const [entera = '0', fraccion = ''] = texto.replace(/^[+-]/, '').split('.');
  const miles = entera.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${miles},${fraccion.padEnd(2, '0')}`;
}

export const ROTULO_TIPO: Readonly<Record<MoneyKind, string>> = {
  FACTURADO: 'Facturado',
  COBRADO: 'Cobrado',
  COTIZADO: 'Cotizado',
  OTRO: 'Otro',
};

/** Qué cuenta cada tipo: son importes distintos y la pantalla no los suma entre sí. */
export const AYUDA_TIPO: Readonly<Record<MoneyKind, string>> = {
  FACTURADO: 'Emitido en facturas.',
  COBRADO: 'Efectivamente cobrado.',
  COTIZADO: 'Presupuestado, aún sin facturar.',
  OTRO: 'Importe de otra clase.',
};

const ORDEN_TIPO: Readonly<Record<MoneyKind, number>> = { FACTURADO: 0, COBRADO: 1, COTIZADO: 2, OTRO: 3 };

/** Un tipo que la API agregue y este front no conozca se muestra con su código. */
export function rotuloDeTipo(tipo: string): string {
  return (ROTULO_TIPO as Readonly<Record<string, string>>)[tipo] ?? tipo;
}

/** Las filas de una moneda, ordenadas por módulo y tipo (estable, sin tocar el importe). */
export interface GrupoDeMoneda {
  readonly currency: string;
  readonly items: readonly MoneyItem[];
}

/**
 * Reparte las filas por moneda. **No suma nada**: cada moneda queda en su propio
 * grupo y dentro de él cada fila conserva su importe tal como llegó.
 */
export function agruparPorMoneda(items: readonly MoneyItem[]): readonly GrupoDeMoneda[] {
  const porMoneda = new Map<string, MoneyItem[]>();
  for (const item of items) {
    const lista = porMoneda.get(item.currency) ?? [];
    lista.push(item);
    porMoneda.set(item.currency, lista);
  }
  return [...porMoneda.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, lista]) => ({
      currency,
      items: [...lista].sort(
        (a, b) =>
          a.moduleLabel.localeCompare(b.moduleLabel, 'es') ||
          (ORDEN_TIPO[a.kind] ?? 9) - (ORDEN_TIPO[b.kind] ?? 9),
      ),
    }));
}
