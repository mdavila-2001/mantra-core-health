import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import type {
  CatalogPhoto,
  CatalogPresentation,
  CatalogProduct,
  CatalogSource,
  PharmacyProduct,
} from '../../../core/data-access/pharmacy/pharmacy.types';

/** Cómo se nombra cada registro oficial en pantalla: sigla y país del que lo emite. */
export const CATALOG_SOURCE_LABEL: Readonly<Record<CatalogSource, string>> = {
  agemed: 'AGEMED · Bolivia',
  cima: 'CIMA · España',
  invima: 'INVIMA · Colombia',
  anvisa: 'ANVISA · Brasil',
};

/** Cuántos resultados pide el buscador del catálogo: una lista que se lee de un vistazo. */
export const CATALOG_SEARCH_LIMIT = 12;

/**
 * Lo que el modal enseña del producto oficial, venga de una búsqueda recién
 * hecha o de un producto que la farmacia ya tiene cargado.
 */
export interface OfficialView {
  readonly name: string;
  readonly activeIngredients: string | null;
  readonly strength: string | null;
  readonly dosageForm: string | null;
  readonly presentation: string | null;
  readonly prescription: 'sí' | 'no' | null;
  readonly holder: string | null;
  readonly atc: readonly string[];
  readonly sourceLabel: string;
  readonly registration: string;
  readonly sourceUrl: string | null;
  readonly photo: CatalogPhoto | null;
}

function prescriptionOf(value: boolean | null | undefined): 'sí' | 'no' | null {
  if (value === true) return 'sí';
  return value === false ? 'no' : null;
}

/**
 * Las presentaciones que se pueden elegir: las que la fuente no dio de baja y
 * que traen código, porque el alta identifica la presentación por su código.
 */
export function sellablePresentations(product: CatalogProduct): readonly CatalogPresentation[] {
  return product.presentations.filter(
    (presentation) => presentation.active !== false && presentation.code !== null,
  );
}

/** Una fila del buscador: el nombre del registro y, debajo, lo que desambigua. */
export function catalogOption(product: CatalogProduct): ReferenceOption {
  const detail = [product.strengthText, product.holder, CATALOG_SOURCE_LABEL[product.source]]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
  return {
    value: product.id,
    label: product.display,
    hint: product.selectable ? detail : `Registro no vigente · ${detail}`,
    disabled: !product.selectable,
  };
}

export function officialOfCatalog(
  product: CatalogProduct,
  presentation: CatalogPresentation | null,
): OfficialView {
  return {
    name: product.display,
    activeIngredients: product.activeIngredients.map((i) => i.name).join(' + ') || null,
    strength: product.strengthText,
    dosageForm: product.dosageForm,
    presentation: presentation?.name ?? null,
    prescription: prescriptionOf(product.requiresPrescription),
    holder: product.holder,
    atc: product.atc,
    sourceLabel: CATALOG_SOURCE_LABEL[product.source],
    registration: product.code,
    sourceUrl: product.sourceUrl,
    photo: product.photo,
  };
}

/** Lo oficial de un producto ya cargado: nombre, concentración y receta son del registro. */
export function officialOfProduct(product: PharmacyProduct): OfficialView | null {
  const link = product.catalog;
  if (link === null || link === undefined) return null;
  return {
    name: product.brandName ?? product.genericName ?? product.productCode,
    activeIngredients: product.genericName,
    strength: product.strengthText,
    dosageForm: product.dosageForm?.display ?? null,
    presentation: product.packageSizeText,
    prescription: prescriptionOf(product.requiresPrescription),
    holder: null,
    atc: [],
    sourceLabel: CATALOG_SOURCE_LABEL[link.source],
    registration: link.code,
    sourceUrl: null,
    photo: link.officialPhoto,
  };
}
