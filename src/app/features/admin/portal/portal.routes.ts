import { inject } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';

import { APP_TITLE } from '../../../core/navigation/navigation.types';
import { PORTAL_DATA_QUALITY_ROUTES } from './data-quality/data-quality.routes';
import { PORTAL_GOVERNANCE_ROUTES } from './governance/governance.routes';
import { PORTAL_RBAC_MATRIX_ROUTES } from './rbac-matrix/rbac-matrix.routes';
import { PORTAL_PERMISSIONS_ROUTES } from './permissions/permissions.routes';
import { PORTAL_VISIBILITY_ROUTES } from './visibility/visibility.routes';
import { PORTAL_MUTABILITY_ROUTES } from './mutability/mutability.routes';
import { PORTAL_CATALOG_FIT_ROUTES } from './probes/catalog-fit/catalog-fit.routes';
import { PORTAL_RUNTIME_PIECES_ROUTES } from './probes/runtime-pieces/runtime-pieces.routes';
import { PORTAL_POLICIES_ROUTES } from './governance/policies/policies.routes';
import { portalUrl } from './portal-nav';

/**
 * Las direcciones que tuvo el portal antes de pasar a inglés (TAREA-29), con
 * la que las reemplaza. Siguen abriendo porque se comparten: un enlace a una
 * operación pegado en un mensaje o guardado en favoritos no puede dar 404.
 */
const LEGACY_PORTAL_PATHS: Readonly<Record<string, string>> = {
  'sistemas/operaciones': 'systems/operations',
  'sistemas/operaciones/:id': 'systems/operations/:id',
  'sistemas/flujos/diagrama': 'systems/flows/diagram',
  'sistemas/flujos': 'systems/flows',
  'sistemas/deriva': 'systems/drift',
  'sistemas/revision': 'systems/review',
  procesos: 'processes',
  'procesos/:code': 'processes/:code',
  'catalogo/tablas': 'catalog/tables',
  'catalogo/tablas/:schema/:table': 'catalog/tables/:schema/:table',
  'catalogo/dominios': 'catalog/domains',
  linaje: 'lineage',
  esquema: 'schemas',
  'gobierno/auditoria': 'governance/audit',
  'gobierno/usuarios': 'governance/users',
  'gobierno/deriva-permisos': 'governance/permission-drift',
};

/**
 * Redirección exacta que conserva los parámetros y la consulta: un
 * `redirectTo` de texto descartaría el `?flujo=` o el `?user=` del enlace.
 */
function legacyPortalRedirect([legacyPath, currentPath]: readonly [string, string]): Route {
  return {
    path: legacyPath,
    pathMatch: 'full',
    redirectTo: ({ params, queryParams }) => {
      const segments = currentPath
        .split('/')
        .map((segment) => (segment.startsWith(':') ? String(params[segment.slice(1)]) : segment));
      return inject(Router).createUrlTree([portalUrl(''), ...segments], { queryParams });
    },
  };
}

/**
 * Las pantallas del portal, relativas a `superadmin/portal`. El marco las
 * contiene (`RUTAS_ANIDADAS['superadmin/portal']` en `app.routes.ts`); cada
 * una se descarga al entrar. Las direcciones son las que declara `PORTAL_NAV`;
 * las fichas cuelgan de la pantalla de la que salen, para que el menú ilumine
 * la correcta. Los roles los hereda del marco: la API decide cada petición.
 */
export const PORTAL_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: `${APP_TITLE} - Centro del portal`,
    loadComponent: () => import('./hub/portal-hub').then((m) => m.PortalHub),
  },
  {
    path: 'systems/operations',
    title: `${APP_TITLE} - Operaciones`,
    loadComponent: () =>
      import('./operations/operations-page').then((m) => m.OperationsPage),
  },
  {
    path: 'systems/operations/:id',
    title: `${APP_TITLE} - Operación`,
    loadComponent: () =>
      import('./operations/operation-detail-page').then((m) => m.OperationDetailPage),
  },
  {
    path: 'systems/flows/diagram',
    title: `${APP_TITLE} - Diagrama de un proceso`,
    loadComponent: () =>
      import('./process-diagram/process-diagram-page').then((m) => m.ProcessDiagramPage),
  },
  {
    path: 'systems/flows',
    title: `${APP_TITLE} - Mapa de rutas`,
    loadComponent: () => import('./route-map/route-map-page').then((m) => m.RouteMapPage),
  },
  {
    path: 'systems/drift',
    title: `${APP_TITLE} - Deriva`,
    loadComponent: () => import('./drift/drift-page').then((m) => m.DriftPage),
  },
  {
    path: 'systems/review',
    title: `${APP_TITLE} - Revisión del catálogo`,
    loadComponent: () => import('./review/review-page').then((m) => m.ReviewPage),
  },
  {
    path: 'processes',
    title: `${APP_TITLE} - Procesos`,
    loadComponent: () => import('./processes/processes-page').then((m) => m.ProcessesPage),
  },
  {
    path: 'processes/:code',
    title: `${APP_TITLE} - Proceso`,
    loadComponent: () =>
      import('./processes/process-detail-page').then((m) => m.ProcessDetailPage),
  },
  {
    path: 'catalog/tables',
    title: `${APP_TITLE} - Tablas del modelo`,
    loadComponent: () => import('./tables/tables-page').then((m) => m.TablesPage),
  },
  {
    path: 'catalog/tables/:schema/:table',
    title: `${APP_TITLE} - Ficha de una tabla`,
    loadComponent: () => import('./tables/table-detail-page').then((m) => m.TableDetailPage),
  },
  {
    path: 'catalog/domains',
    title: `${APP_TITLE} - Dominios y glosario`,
    loadComponent: () => import('./domains/domains-page').then((m) => m.DomainsPage),
  },
  {
    path: 'lineage',
    title: `${APP_TITLE} - Linaje`,
    loadComponent: () => import('./lineage/lineage-page').then((m) => m.LineagePage),
  },
  {
    path: 'schemas',
    title: `${APP_TITLE} - Esquema`,
    loadComponent: () => import('./schemas/schemas-page').then((m) => m.SchemasPage),
  },
  ...PORTAL_GOVERNANCE_ROUTES,
  ...PORTAL_POLICIES_ROUTES,
  ...PORTAL_RUNTIME_PIECES_ROUTES,
  ...PORTAL_MUTABILITY_ROUTES,
  ...PORTAL_VISIBILITY_ROUTES,
  ...PORTAL_PERMISSIONS_ROUTES,
  ...PORTAL_RBAC_MATRIX_ROUTES,
  ...PORTAL_DATA_QUALITY_ROUTES,
  ...PORTAL_CATALOG_FIT_ROUTES,
  ...Object.entries(LEGACY_PORTAL_PATHS).map(legacyPortalRedirect),
];
