/**
 * Ids de prueba congelados de la sección Farmacia (Ola 0, contrato del plan
 * maestro §4.5). Un solo origen para que Justin, Itzan y este carril no
 * declaren el mismo `data-testid` con grafías distintas.
 *
 * No existe un archivo `*.testids.ts` previo en el repo para copiar su forma
 * (regla 00 §1.5): se eligió un objeto plano con clave camelCase y valor
 * kebab-case, igual a como ya se escriben los `data-testid` sueltos en el
 * resto del código (p. ej. `header-chats` en `shell-layout.html`).
 */
export const PHARMACY_TESTIDS = {
  searchMode: 'pharmacy-search-mode',
  searchTerm: 'pharmacy-search-term',
  searchSort: 'pharmacy-search-sort',
  searchOrigin: 'pharmacy-search-origin',
  searchResults: 'pharmacy-search-results',
  resultAdd: 'pharmacy-result-add',
  resultStore: 'pharmacy-result-store',
  prescriptionButton: 'pharmacy-prescription-button',
  storeHeader: 'pharmacy-store-header',
  storeCatalog: 'pharmacy-store-catalog',
  storeQtyPlus: 'pharmacy-store-qty-plus',
  storeQtyMinus: 'pharmacy-store-qty-minus',
  storeQtyValue: 'pharmacy-store-qty-value',
  storeRxBadge: 'pharmacy-store-rx-badge',
  headerCart: 'header-cart',
  headerCartBadge: 'header-cart-badge',
  cartLines: 'pharmacy-cart-lines',
  cartTotal: 'pharmacy-cart-total',
  cartContinue: 'pharmacy-cart-continue',
  cartClear: 'pharmacy-cart-clear',
  cartConflictDialog: 'pharmacy-cart-conflict-dialog',
  prescriptionsList: 'pharmacy-prescriptions-list',
  prescriptionSearch: 'pharmacy-prescription-search',
  whereToBuyAddToCart: 'where-to-buy-add-to-cart',
} as const;
