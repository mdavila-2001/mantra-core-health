import { CATALOG_EDITOR_LOADER, CATALOG_EDITOR_PATH } from './features/admin/catalog-editor/catalog-editor.routes';
import { inject, type Type } from '@angular/core';
import { Router, type RedirectFunction, type Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { ShellLayout } from './features/shell-layout/shell-layout';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import {
  RUTAS_HEREDADAS_PUBLICAS,
  RUTAS_HEREDADAS_DEL_BUSCADOR,
  rutasHeredadas,
} from './app.routes.redirects';
import { MEDICAL_CENTER_SCREENS } from './features/auth/register-medical-center/medical-center.routes';
import { PUBLIC_DIRECTORIES_SCREENS } from './features/public-directories/public-directories.screens';
import { ACCOUNT_SCREENS } from './features/account/account.screens';
import { INSURANCE_SCREENS } from './features/insurance/insurance.screens';
import { ADMIN_SCREENS } from './features/admin/admin.screens';
import { PHARMACY_LABORATORY_SCREENS } from './features/pharmacy/pharmacy-laboratory.screens';
import { ACCESS_GOVERNANCE_SCREENS } from './features/access-governance/access-governance.screens';
import { CLINICAL_OPERATIONS_SCREENS } from './features/clinical-operations.screens';
import { ErrorRecovery } from './features/error-recovery/error-recovery';
import { INPATIENT_SCREENS } from './features/inpatient/inpatient.routes';
import { NotFound } from './features/not-found/not-found';
import { ADMISSIONS_SCREENS } from './features/admin/admissions/admissions.routes';
import { PORTAL_RUTAS } from './features/admin/portal/portal.routes';
import { insightsPortalRoute } from './features/insights/insights-portal.route';
import { publicPrescriptionShareRoutes } from './features/prescription-share/prescription-share.routes';
import {
  designMockupRoutes,
  legacyMockupRedirects,
  profileSlugRedirects,
} from './features/alovida/design-mockup-gate';
import { environment } from '../environments/environment';
import { simulatorRoutes } from './simulator-routes';
import { authGuard, homeGuard } from './core/auth/auth.guard';
import { mfaEnrollmentGuard } from './core/auth/mfa-enrollment.guard';
import {
  PANTALLA_NO_DISPONIBLE_ROUTE,
  visibilityChildGuard,
} from './core/visibility/visibility.guard';
import { APP_SECTIONS, ROLES_DE_QUIEN_ATIENDE } from './core/navigation/navigation.map';
import {
  RUTAS_HEREDADAS_CON_PARAMETRO,
  rutasHeredadasConParametro,
} from './core/navigation/redirecciones-heredadas';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import { mockRoutes } from './features/reporting/reporting-mock.routes';
import {
  APP_TITLE,
  ROLES_ROUTE_DATA,
  SECTION_ROUTE_DATA,
  titleOf,
  type AppSection,
} from './core/navigation/navigation.types';
import { chunkFallido } from './routes/chunk-fallido';
import { SECCIONES_DE_QUIEN_ATIENDE } from './routes/quien-atiende.helper';
import { PANTALLAS_HIJAS_ACCOUNTING } from './routes/app.routes.hijas-accounting';
import { PANTALLAS_HIJAS_CLINICAL } from './routes/app.routes.hijas-clinical';
import { PANTALLAS_HIJAS_ADMIN } from './routes/app.routes.hijas-admin';
import { PANTALLAS_HIJAS_GLOSSARY } from './routes/app.routes.hijas-glossary';
import { RUTAS_OPERACIONES_CLINICAS } from './routes/app.routes.operaciones-clinicas';
import { RUTAS_OPERACIONES_IAM } from './routes/app.routes.operaciones-iam';
import { RUTAS_OPERACIONES_CONTEXTO } from './routes/app.routes.operaciones-contexto';
import {
  RUTAS_HEREDADAS,
  rutasDeBusquedaPublica,
  rutasDeFichasPublicas,
} from './routes/app.routes.publicas';
import {
  type DestinoRedirigido,
  redireccionConQuery,
} from './routes/redireccion-query.helper';

/**
 * Qué componente pinta cada sección que ya tiene pantalla.
 */
const PANTALLAS: Readonly<Record<string, Type<unknown>>> = {
  dashboard: Dashboard,
};

/** Secciones con pantalla propia que se descargan al entrar, no antes. */
const PANTALLAS_DIFERIDAS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  ...MEDICAL_CENTER_SCREENS,
  ...ADMISSIONS_SCREENS,
  ...INPATIENT_SCREENS,
  ...PUBLIC_DIRECTORIES_SCREENS,
  ...ACCOUNT_SCREENS,
  ...INSURANCE_SCREENS,
  ...ADMIN_SCREENS,
  ...PHARMACY_LABORATORY_SCREENS,
  ...ACCESS_GOVERNANCE_SCREENS,
  ...CLINICAL_OPERATIONS_SCREENS,
};

/** Pantallas que cuelgan de una sección sin ser entradas de menú. */
const PANTALLAS_HIJAS: Routes = [
  ...PANTALLAS_HIJAS_ACCOUNTING,
  ...PANTALLAS_HIJAS_CLINICAL,
  ...PANTALLAS_HIJAS_ADMIN,
  ...PANTALLAS_HIJAS_GLOSSARY,
];

/** Las secciones que además son un marco en su router-outlet. */
const RUTAS_ANIDADAS: Readonly<Record<string, Routes>> = {
  'superadmin/portal': PORTAL_RUTAS,
  messaging: [
    {
      path: '',
      children: [],
    },
    {
      path: ':conversationId',
      title: `${APP_TITLE} - Conversación`,
      loadComponent: () =>
        import('./features/messaging/thread/thread')
          .then((m) => m.Thread)
          .catch(() => chunkFallido()),
    },
  ],
};

function rutasDeSecciones(): Routes {
  return APP_SECTIONS.flatMap((section) => {
    const ruta: Routes[number] = {
      path: section.path,
      title: titleOf(section),
      ...(RUTAS_ANIDADAS[section.path] === undefined
        ? {}
        : { children: RUTAS_ANIDADAS[section.path] }),
      ...(SECCIONES_REDIRIGIDAS[section.path] === undefined
        ? { canActivate: [seccionRolesGuard] }
        : {}),
      data: {
        [SECTION_ROUTE_DATA]: section,
        ...(SECCIONES_DE_QUIEN_ATIENDE.has(section.path)
          ? { [ROLES_ROUTE_DATA]: ROLES_DE_QUIEN_ATIENDE }
          : {}),
      },
      ...componenteDe(section),
    };
    if (section.path !== 'my-account') {
      return [ruta];
    }

    return [
      ruta,
      {
        ...ruta,
        path: 'account/profile',
        pathMatch: 'full',
        data: { ...ruta.data, [ROLES_ROUTE_DATA]: section.roles },
      },
    ];
  });
}

/** Secciones que siguen registradas pero cuya pantalla se retiró. */
export const SECCIONES_REDIRIGIDAS: Readonly<Record<string, DestinoRedirigido>> = {
  'my-support': { ruta: '/my-team', query: { tab: 'mis-accesos' } },
  'my-account/loyalty': { ruta: '/my-account', query: { pestana: 'puntos' } },
  'my-account/clinical-access': { ruta: '/my-account/privacy', query: { ver: 'historia' } },
  'administration/pharmacy-profile': { ruta: '/my-account' },
  'administration/data-catalog': { ruta: '/superadmin/data-catalog' },
  'administration/web-analytics': { ruta: '/superadmin/web-analytics' },
  'administration/qa-lab': { ruta: '/superadmin/qa-lab' },
  'administration/operations': { ruta: '/superadmin/operations' },
  'administration/marketing-insights': { ruta: '/insights' },
};

export { type DestinoRedirigido, redireccionConQuery } from './routes/redireccion-query.helper';

function componenteDe(
  section: AppSection,
): Pick<Routes[number], 'component' | 'loadComponent' | 'redirectTo' | 'pathMatch'> {
  const redirige = SECCIONES_REDIRIGIDAS[section.path];
  if (redirige !== undefined) {
    return { redirectTo: redireccionConQuery(redirige), pathMatch: 'full' };
  }

  const pantalla = PANTALLAS[section.path];
  if (pantalla !== undefined) {
    return { component: pantalla };
  }

  const diferida = PANTALLAS_DIFERIDAS[section.path];
  if (diferida !== undefined) {
    return { loadComponent: () => diferida().catch(() => chunkFallido()) };
  }

  return {
    loadComponent: () =>
      import('./features/section-placeholder/section-placeholder')
        .then((m) => m.SectionPlaceholder)
        .catch(() => chunkFallido()),
  };
}

export const routes: Routes = [
  ...rutasDeBusquedaPublica(),
  ...designMockupRoutes(environment.designMockups),
  ...rutasDeFichasPublicas(),
  ...mockRoutes(chunkFallido, environment.reportingMockEnabled),
  insightsPortalRoute(chunkFallido),
  {
    path: '',
    pathMatch: 'full',
    canActivate: [homeGuard],
    children: [],
  },
  {
    path: '',
    component: ShellLayout,
    canActivate: [authGuard],
    canActivateChild: [mfaEnrollmentGuard, visibilityChildGuard],
    children: [
      ...rutasDeSecciones(),
      ...PANTALLAS_HIJAS,
      {
        path: PANTALLA_NO_DISPONIBLE_ROUTE.slice(1),
        title: `${APP_TITLE} - No disponible para su perfil`,
        loadComponent: () =>
          import('./features/visibility-unavailable/visibility-unavailable').then((m) => m.VisibilityUnavailable),
      },
      {
        path: 'feed',
        title: 'Muro profesional',
        loadComponent: () => import('./features/feed/feed').then((m) => m.Feed),
      },
      ...RUTAS_OPERACIONES_CLINICAS,
      ...RUTAS_OPERACIONES_IAM,
      ...RUTAS_OPERACIONES_CONTEXTO,
      {
        path: 'my-organizations',
        pathMatch: 'full',
        redirectTo: redireccionConQuery({
          ruta: '/administration/medical-organization',
          query: { tab: 'memberships' },
        }),
      },
      ...rutasHeredadas(RUTAS_HEREDADAS),
      ...rutasHeredadasConParametro(RUTAS_HEREDADAS_CON_PARAMETRO),
    ],
  },
  {
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system-sample/design-system-sample')
        .then((m) => m.DesignSystemSample)
        .catch(() => chunkFallido()),
    title: 'AloVida - Vitrina de Diseño',
  },
  ...simulatorRoutes(chunkFallido),
  {
    path: 'verify/portability/:manifestHash',
    loadComponent: () =>
      import('./features/insurance/portability-verify/portability-verify').then(
        (m) => m.PortabilityVerify,
      ),
    title: 'AloVida - Verificar certificado',
  },
  ...publicPrescriptionShareRoutes(chunkFallido),
  ...AUTH_ROUTES,
  {
    path: 'error',
    component: ErrorRecovery,
    title: 'AloVida',
  },
  ...rutasHeredadas(RUTAS_HEREDADAS_PUBLICAS),
  ...rutasHeredadas(RUTAS_HEREDADAS_DEL_BUSCADOR),
  ...profileSlugRedirects(),
  ...legacyMockupRedirects(),
  {
    path: '**',
    component: NotFound,
    title: 'AloVida - Página no encontrada',
  },
];
