import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  SITE_QUANTITY_MAX,
  type SiteAvailabilityDraft,
  type SiteStock,
} from '../../../../core/data-access/pharmacy/pharmacy-site-stock.types';
import { productName, productStatus } from '../../products/product-view';

/**
 * Qué se puede hacer con un producto en una sede:
 *
 * - `TRACKED`: la sede lleva su propio stock y el producto tiene posición.
 * - `UNTRACKED`: la sede lleva su propio stock y el producto no tiene posición
 *   (se publicó después): no se ofrece ahí hasta que se diga «Lo tengo».
 * - `CATALOG`: la sede todavía muestra lo declarado en el catálogo.
 * - `DECLARED_OUT`: marcado sin stock para toda la farmacia. Esa marca gana en
 *   todas las sedes y sólo se quita desde el catálogo: sin interruptor.
 */
export type SiteStockRowKind = 'TRACKED' | 'UNTRACKED' | 'CATALOG' | 'DECLARED_OUT';

/** Un producto publicado, tal como está hoy en la sede. */
export interface SiteStockRow {
  readonly productId: string;
  readonly productCode: string;
  readonly name: string;
  readonly kind: SiteStockRowKind;
  /** Si hoy se ofrece en la sede. */
  readonly available: boolean;
  /** Lo que se puede vender; `null` = sin conteo o sin registrar. */
  readonly quantity: number | null;
}

/** Lo que la persona eligió en una fila, con la cantidad todavía como texto. */
export interface SiteStockEdit {
  readonly available: boolean;
  readonly quantity: string;
}

/** Una sede con al menos una posición lleva su propio stock (modo libro). */
export function isLedgerSite(stock: SiteStock): boolean {
  return stock.items.length > 0;
}

/**
 * Marcado «no lo tengo» para toda la farmacia. La lectura de gestión no sirve
 * la marca: se deduce de `inStock: false` con existencias que no son 0 (con 0
 * la API también responde `inStock: false`, y ahí no se puede distinguir; si
 * estaba marcado, el `PUT` lo rechaza con su motivo).
 */
export function declaredOutOfStock(product: PharmacyProduct): boolean {
  return product.inStock === false && product.stock !== 0;
}

/**
 * Cruza el catálogo con el stock de la sede. Sólo los publicados: un borrador
 * o un retirado no se ofrece en ninguna sede.
 */
export function siteStockRows(products: readonly PharmacyProduct[], stock: SiteStock): readonly SiteStockRow[] {
  const ledger = isLedgerSite(stock);
  const positions = new Map(stock.items.map((item) => [item.productId, item]));
  return products
    .filter((product) => productStatus(product) === 'PUBLISHED')
    .map((product): SiteStockRow => {
      const base = { productId: product.id, productCode: product.productCode, name: productName(product) };
      if (declaredOutOfStock(product)) {
        return { ...base, kind: 'DECLARED_OUT', available: false, quantity: null };
      }
      if (!ledger) {
        return { ...base, kind: 'CATALOG', available: product.inStock !== false, quantity: product.stock ?? null };
      }
      const position = positions.get(product.id);
      return position === undefined
        ? { ...base, kind: 'UNTRACKED', available: false, quantity: null }
        : {
            ...base,
            kind: 'TRACKED',
            available: position.availableQuantity > 0,
            quantity: position.availableQuantity,
          };
    });
}

/** La fila como edición de partida. */
export function initialEdit(row: SiteStockRow): SiteStockEdit {
  return { available: row.available, quantity: row.available && row.quantity !== null ? String(row.quantity) : '' };
}

/** Si lo elegido difiere de lo guardado. Con «No lo tengo» la cantidad no cuenta. */
export function isChanged(row: SiteStockRow, edit: SiteStockEdit): boolean {
  const original = initialEdit(row);
  if (edit.available !== original.available) {
    return true;
  }
  return edit.available && edit.quantity.trim() !== original.quantity;
}

/**
 * El cuerpo del `PUT`, o por qué no se puede mandar. Una cantidad vacía con
 * «Lo tengo» deja que la API tome la del catálogo.
 */
export function availabilityDraft(
  edit: SiteStockEdit,
): { readonly draft: SiteAvailabilityDraft } | { readonly problem: string } {
  if (!edit.available) {
    return { draft: { available: false } };
  }
  const text = edit.quantity.trim();
  if (text === '') {
    return { draft: { available: true } };
  }
  const quantity = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isInteger(quantity) || quantity > SITE_QUANTITY_MAX) {
    return { problem: `La cantidad es un número entero de 1 a ${SITE_QUANTITY_MAX.toLocaleString('es')}.` };
  }
  if (quantity === 0) {
    return { problem: 'Con «Lo tengo» la cantidad es al menos 1. Para dejar de ofrecerlo, elija «No lo tengo».' };
  }
  return { draft: { available: true, quantity } };
}

/** Busca por nombre o código, sin distinguir mayúsculas. */
export function matchesTerm(row: SiteStockRow, term: string): boolean {
  const wanted = term.trim().toLocaleLowerCase('es');
  return (
    wanted === '' ||
    row.name.toLocaleLowerCase('es').includes(wanted) ||
    row.productCode.toLocaleLowerCase('es').includes(wanted)
  );
}

/** «Casa central», «Casa central y Norte», «Casa central, Norte y Sur». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
