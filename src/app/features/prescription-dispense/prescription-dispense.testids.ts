/**
 * Ids de prueba de «Abrir receta» de la farmacia (FAR-02).
 *
 * Misma forma que `PRESCRIPTION_SHARE_TESTIDS`: clave camelCase, valor
 * kebab-case con el prefijo `prescription-dispense-`, en inglés como el resto
 * de los `data-testid`.
 */
export const PRESCRIPTION_DISPENSE_TESTIDS = {
  page: 'prescription-dispense-page',
  header: 'prescription-dispense-header',
  patient: 'prescription-dispense-patient',
  notFound: 'prescription-dispense-not-found',
  closed: 'prescription-dispense-closed',
  item: 'prescription-dispense-item',
  itemBalance: 'prescription-dispense-item-balance',
  itemNoMatches: 'prescription-dispense-item-no-matches',
  product: 'prescription-dispense-product',
  productOutOfStock: 'prescription-dispense-product-out-of-stock',
  site: 'prescription-dispense-site',
  siteToggle: 'prescription-dispense-site-toggle',
  siteFailure: 'prescription-dispense-site-failure',
} as const;
