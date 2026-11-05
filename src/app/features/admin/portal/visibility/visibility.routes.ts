import type { Routes } from '@angular/router';

import { buildUiElementDrafts } from '../../../../core/visibility/ui-element-registry';
import { APP_TITLE } from '../../../../core/navigation/navigation.types';
import '../../../../ui-elements.catalog';
import { UI_ELEMENT_DRAFTS } from './ui-element-drafts.token';

/**
 * Las pantallas de visibilidad de la interfaz del grupo «Gobierno y acceso» del portal,
 * relativas a `superadmin/portal`. Se spreadean en las rutas del portal; los roles los hereda
 * del marco y la API decide cada petición (ocultar no es seguridad).
 */
export const PORTAL_VISIBILITY_ROUTES: Routes = [
  {
    path: 'governance/ui-catalog',
    title: `${APP_TITLE} - Catálogo de visibilidad`,
    // El registro del código (menú derivado + elementos que cada feature declara) es lo que el
    // botón «Sincronizar con el código» envía. La API sigue autorizando: catalogar no protege.
    providers: [{ provide: UI_ELEMENT_DRAFTS, useFactory: () => buildUiElementDrafts() }],
    loadComponent: () => import('./catalog/ui-catalog-page').then((m) => m.UiCatalogPage),
  },
  {
    path: 'governance/ui-rules',
    title: `${APP_TITLE} - Reglas de visibilidad`,
    loadComponent: () => import('./rules/ui-rules-page').then((m) => m.UiRulesPage),
  },
  {
    path: 'governance/ui-preview',
    title: `${APP_TITLE} - Ver como`,
    loadComponent: () => import('./preview/ui-preview-page').then((m) => m.UiPreviewPage),
  },
];
