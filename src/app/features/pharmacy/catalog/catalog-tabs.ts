import type { ImportTarget } from '../import/import-target/import-target';

/**
 * Las pestañas del catálogo de la farmacia, en el orden en que se dibujan.
 *
 * La clave es la que viaja en `?tab=`: un enlace guardado o una ruta vieja
 * redirigida (`app.routes.ts`) abre la pestaña por su nombre y no por su
 * posición, así que reordenarlas no rompe ningún enlace.
 */
export const CATALOG_TABS = ['products', 'categories', 'prices', 'inventory', 'integration'] as const;

export type CatalogTab = (typeof CATALOG_TABS)[number];

/**
 * `?tab=import` is no longer a tab: it opens the «Importar CSV» modal over the
 * open tab. It is still the key of the old links (the Summary,
 * `administration/pharmacy-import`), so none of them breaks.
 */
export const IMPORT_TAB_KEY = 'import';

/** El rótulo de cada pestaña, tal como se lee en pantalla. */
export const CATALOG_TAB_LABELS: Readonly<Record<CatalogTab, string>> = {
  products: 'Productos',
  categories: 'Categorías',
  prices: 'Precios',
  inventory: 'Inventario',
  integration: 'Integración',
};

/**
 * What the import modal preselects for the open tab. Inventory has its own
 * «Subir CSV» and Integration imports nothing, so both preselect products.
 */
export const IMPORT_TARGET_BY_TAB: Readonly<Record<CatalogTab, ImportTarget>> = {
  products: 'products',
  categories: 'categories',
  prices: 'prices',
  inventory: 'products',
  integration: 'products',
};

/**
 * El índice de la pestaña que pide `?tab=`. Sin valor o con uno desconocido,
 * abre la primera: Productos.
 */
export function tabIndexOf(raw: string | null | undefined): number {
  const index = CATALOG_TABS.indexOf(raw as CatalogTab);
  return index < 0 ? 0 : index;
}

/** La clave de `?tab=` de un índice; fuera de rango, la primera. */
export function tabKeyOf(index: number): CatalogTab {
  return CATALOG_TABS[index] ?? CATALOG_TABS[0];
}
