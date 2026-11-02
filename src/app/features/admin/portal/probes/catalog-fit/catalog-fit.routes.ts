import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../../core/navigation/navigation.types';

/**
 * La pantalla de la sonda de ajuste de la catalogación, relativa a `superadmin/portal`. La
 * dirección es la que declara `PORTAL_NAV`; los roles los hereda el marco del portal y la API
 * decide cada petición: ocultar el botón de ejecutar no autoriza nada.
 */
export const PORTAL_CATALOG_FIT_ROUTES: Routes = [
  {
    path: 'catalog/fit',
    title: `${APP_TITLE} - Sonda de catalogación`,
    loadComponent: () => import('./catalog-fit-page').then((m) => m.CatalogFitPage),
  },
];
