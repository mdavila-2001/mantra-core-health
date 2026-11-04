import type {
  PharmacyProduct,
  PharmacyProductStatus,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import type { SortAccessors } from '../catalog/catalog-sort';

/** El nombre con que se lee un producto: marca, y si no, genérico, y si no, el código. */
export function productName(product: PharmacyProduct): string {
  return product.brandName ?? product.genericName ?? product.productCode;
}

/** Concentración, presentación y forma, separadas por «·»; «—» si no hay nada. */
export function productPresentation(product: PharmacyProduct): string {
  const parts = [product.strengthText, product.packageSizeText, product.dosageForm?.display];
  const visible = parts.filter((part): part is string => part !== null && part !== undefined && part !== '');
  return visible.length === 0 ? '—' : visible.join(' · ');
}

/** El estado de un producto; sin dato es que la API lo devolvió publicado. */
export function productStatus(product: PharmacyProduct): PharmacyProductStatus {
  return product.status ?? 'PUBLISHED';
}

/** Umbral de alerta mientras la farmacia no fija el suyo (el de la API). */
export const DEFAULT_MIN_STOCK = 5;

/** Cómo se llama cada estado en pantalla. */
export const PRODUCT_STATUS_LABEL: Readonly<Record<PharmacyProductStatus, string>> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  WITHDRAWN: 'Retirado',
};

/**
 * Existencias y umbral con que se decide una alerta; sin conteo (`null`) o sin
 * dato no hay alerta. Sin umbral propio vale {@link DEFAULT_MIN_STOCK}.
 */
export function isLowStock(product: PharmacyProduct): boolean {
  const stock = product.stock;
  const minimum = product.minStock;
  if (stock === undefined || stock === null) return false;
  return stock > 0 && stock <= (minimum ?? DEFAULT_MIN_STOCK);
}

/** Los números de un texto de precio, o `null` sin precio. */
function priceNumber(product: PharmacyProduct): number | null {
  return product.unitPrice ? Number(product.unitPrice) : null;
}

/**
 * Qué ordena cada columna de las tablas del catálogo (`catalog-sort.ts`). El
 * estado ordena por su rótulo, como se lee; la receta pone primero «Sí».
 */
export const PRODUCT_SORT_ACCESSORS: SortAccessors<PharmacyProduct> = {
  name: productName,
  code: (product) => product.productCode,
  category: (product) => product.category,
  price: priceNumber,
  current: priceNumber,
  stock: (product) => product.stock,
  status: (product) => PRODUCT_STATUS_LABEL[productStatus(product)],
  prescription: (product) =>
    product.requiresPrescription === null ? null : product.requiresPrescription ? 0 : 1,
};
