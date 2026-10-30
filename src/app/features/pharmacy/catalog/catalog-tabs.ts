/**
 * Las pestañas del catálogo de la farmacia, en el orden en que se dibujan.
 *
 * La clave es la que viaja en `?tab=`: un enlace guardado o una ruta vieja
 * redirigida (`app.routes.ts`) abre la pestaña por su nombre y no por su
 * posición, así que reordenarlas no rompe ningún enlace.
 */
export const CATALOG_TABS = ['products', 'categories', 'prices', 'inventory', 'import'] as const;

export type CatalogTab = (typeof CATALOG_TABS)[number];

/** El rótulo de cada pestaña, tal como se lee en pantalla. */
export const CATALOG_TAB_LABELS: Readonly<Record<CatalogTab, string>> = {
  products: 'Productos',
  categories: 'Categorías',
  prices: 'Precios',
  inventory: 'Inventario',
  import: 'Importación',
};

/**
 * El índice de la pestaña que pide `?tab=`. Sin valor, con uno desconocido o
 * con uno que todavía no tiene pestaña (`integration`), abre la primera:
 * Productos.
 */
export function tabIndexOf(raw: string | null | undefined): number {
  const index = CATALOG_TABS.indexOf(raw as CatalogTab);
  return index < 0 ? 0 : index;
}

/** La clave de `?tab=` de un índice; fuera de rango, la primera. */
export function tabKeyOf(index: number): CatalogTab {
  return CATALOG_TABS[index] ?? CATALOG_TABS[0];
}
