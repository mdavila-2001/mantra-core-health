import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../core/navigation/navigation.types';
import { PORTAL_GOVERNANCE_ROUTES } from './governance/governance.routes';

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
    path: 'sistemas/operaciones',
    title: `${APP_TITLE} - Operaciones`,
    loadComponent: () =>
      import('./operations/operations-page').then((m) => m.OperationsPage),
  },
  {
    path: 'sistemas/operaciones/:id',
    title: `${APP_TITLE} - Operación`,
    loadComponent: () =>
      import('./operations/operation-detail-page').then((m) => m.OperationDetailPage),
  },
  {
    path: 'sistemas/flujos/diagrama',
    title: `${APP_TITLE} - Diagrama de un proceso`,
    loadComponent: () =>
      import('./process-diagram/process-diagram-page').then((m) => m.ProcessDiagramPage),
  },
  {
    path: 'sistemas/flujos',
    title: `${APP_TITLE} - Mapa de rutas`,
    loadComponent: () => import('./route-map/route-map-page').then((m) => m.RouteMapPage),
  },
  {
    path: 'sistemas/deriva',
    title: `${APP_TITLE} - Deriva`,
    loadComponent: () => import('./drift/drift-page').then((m) => m.DriftPage),
  },
  {
    path: 'sistemas/revision',
    title: `${APP_TITLE} - Revisión del catálogo`,
    loadComponent: () => import('./review/review-page').then((m) => m.ReviewPage),
  },
  {
    path: 'procesos',
    title: `${APP_TITLE} - Procesos`,
    loadComponent: () => import('./processes/processes-page').then((m) => m.ProcessesPage),
  },
  {
    path: 'procesos/:code',
    title: `${APP_TITLE} - Proceso`,
    loadComponent: () =>
      import('./processes/process-detail-page').then((m) => m.ProcessDetailPage),
  },
  {
    path: 'catalogo/tablas',
    title: `${APP_TITLE} - Tablas del modelo`,
    loadComponent: () => import('./tables/tables-page').then((m) => m.TablesPage),
  },
  {
    path: 'catalogo/tablas/:schema/:table',
    title: `${APP_TITLE} - Ficha de una tabla`,
    loadComponent: () => import('./tables/table-detail-page').then((m) => m.TableDetailPage),
  },
  {
    path: 'catalogo/dominios',
    title: `${APP_TITLE} - Dominios y glosario`,
    loadComponent: () => import('./domains/domains-page').then((m) => m.DomainsPage),
  },
  {
    path: 'linaje',
    title: `${APP_TITLE} - Linaje`,
    loadComponent: () => import('./lineage/lineage-page').then((m) => m.LineagePage),
  },
  {
    path: 'esquema',
    title: `${APP_TITLE} - Esquema`,
    loadComponent: () => import('./schemas/schemas-page').then((m) => m.SchemasPage),
  },
  ...PORTAL_GOVERNANCE_ROUTES,
];
