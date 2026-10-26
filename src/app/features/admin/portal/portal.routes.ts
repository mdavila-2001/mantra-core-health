import { inject } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';

import { APP_TITLE } from '../../../core/navigation/navigation.types';
import { PORTAL_GOVERNANCE_ROUTES } from './governance/governance.routes';
import { PORTAL_BASE } from './portal-nav';

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
    path: 'schema',
    title: `${APP_TITLE} - Esquema`,
    loadComponent: () => import('./schemas/schemas-page').then((m) => m.SchemasPage),
  },
  ...PORTAL_GOVERNANCE_ROUTES,
];

/**
 * TAREA-29 · Las direcciones en castellano que tuvo el portal → la de hoy.
 *
 * Son las que el equipo tiene guardadas o se pasa por chat
 * (`…/catalogo/tablas/iam/users`): siguen abriendo la misma pantalla, con sus
 * parámetros y su consulta (`?riesgo=ALTO`).
 */
export const LEGACY_PORTAL_PATHS: Readonly<Record<string, string>> = {
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
  esquema: 'schema',
  'gobierno/auditoria': 'governance/audit',
  'gobierno/usuarios': 'governance/users',
  'gobierno/deriva-permisos': 'governance/permission-drift',
};

/**
 * Las redirecciones de {@link LEGACY_PORTAL_PATHS}. Van aparte de
 * {@link PORTAL_RUTAS} —que es la lista de pantallas— y después de ellas en
 * `app.routes.ts`.
 *
 * Con una función y no con un `redirectTo` de texto: el texto descarta la
 * consulta, y un `?riesgo=ALTO` guardado llegaría sin filtro.
 */
export const LEGACY_PORTAL_REDIRECTS: Routes = Object.entries(LEGACY_PORTAL_PATHS).map(
  ([legacyPath, current]): Route => ({
    path: legacyPath,
    pathMatch: 'full',
    redirectTo: ({ params, queryParams }) =>
      inject(Router).createUrlTree(
        [
          PORTAL_BASE,
          ...current
            .split('/')
            .map((segment) => (segment.startsWith(':') ? String(params[segment.slice(1)]) : segment)),
        ],
        { queryParams },
      ),
  }),
);
