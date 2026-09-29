import type {
  PharmacyProduct,
  PharmacyProductStatus,
} from '../../../core/data-access/pharmacy/pharmacy.types';

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

/** Cómo se llama cada estado en pantalla. */
export const PRODUCT_STATUS_LABEL: Readonly<Record<PharmacyProductStatus, string>> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  WITHDRAWN: 'Retirado',
};

/** Existencias y umbral con que se decide una alerta; sin dato no hay alerta. */
export function isLowStock(product: PharmacyProduct): boolean {
  const stock = product.stock;
  const minimum = product.minStock;
  return stock !== undefined && minimum !== undefined && stock > 0 && stock <= minimum;
}
