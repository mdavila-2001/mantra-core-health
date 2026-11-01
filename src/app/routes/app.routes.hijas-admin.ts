import type { Routes } from '@angular/router';
import { APP_TITLE } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';
import { organizacionAdministrableGuard } from '../features/admin/organizations/organization-admin.guard';
import { affiliationRoutes } from '../features/organization/practitioner-affiliations/affiliation.routes';
import { inpatientRoutes } from '../features/inpatient/inpatient.routes';
import {
  ADMISSION_DETAIL_PATH,
  loadAdmissionDetail,
} from '../features/admin/admissions/admissions.routes';
import { soloDeQuienAtiende } from './quien-atiende.helper';
import { chunkFallido } from './chunk-fallido';

/**
 * Pantallas hijas de reclamos de seguros, perfil/onboarding, afiliaciones, internación y organizaciones.
 */
export const PANTALLAS_HIJAS_ADMIN: Routes = [
  {
    path: 'administration/insurance-claims/:claimId',
    title: `${APP_TITLE} - Solicitud de seguro`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/insurance/insurance-claim-detail/insurance-claim-detail')
        .then((m) => m.InsuranceClaimDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/brokers/:brokerId',
    title: `${APP_TITLE} - Perfil del corredor`,
    loadComponent: () =>
      import('../features/insurance/broker-detail/broker-detail')
        .then((m) => m.BrokerDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'onboarding',
    title: `${APP_TITLE} - Complete su perfil`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('../features/onboarding-practitioner/onboarding-practitioner')
        .then((m) => m.OnboardingPractitioner)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/edit',
    title: `${APP_TITLE} - Editar perfil`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('../features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit')
        .then((m) => m.PractitionerProfileEdit)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/profile/edit',
    title: `${APP_TITLE} - Editar sus datos`,
    loadComponent: () =>
      import('../features/account/my-profile/patient-profile-edit/patient-profile-edit')
        .then((m) => m.PatientProfileEdit)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/articles',
    title: `${APP_TITLE} - Artículos médicos`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('../features/account/my-profile/medical-articles/medical-articles')
        .then((m) => m.MedicalArticles)
        .catch(() => chunkFallido()),
  },
  ...affiliationRoutes({ practitionerOnly: soloDeQuienAtiende, chunkFailed: chunkFallido }),
  ...inpatientRoutes({ chunkFailed: chunkFallido }),
  {
    path: ADMISSION_DETAIL_PATH,
    title: `${APP_TITLE} - Revisión de admisión`,
    canActivate: [seccionRolesGuard],
    loadComponent: () => loadAdmissionDetail().catch(() => chunkFallido()),
  },
  {
    path: 'administration/terminology/import',
    title: `${APP_TITLE} - Importar terminología`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/terminology/version-import/version-import')
        .then((m) => m.VersionImport)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/getting-started',
    title: `${APP_TITLE} - Puesta en marcha`,
    canActivate: [seccionRolesGuard],
    data: { roles: ['SUPERADMIN', 'SECURITY_ADMIN'] },
    loadComponent: () =>
      import('../features/admin/getting-started/getting-started')
        .then((m) => m.GettingStarted)
        .catch(() => chunkFallido()),
  },
  {
    path: 'superadmin/qa-lab/plans/:planId',
    title: `${APP_TITLE} - Plan de QA`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/qa-lab/plan-detail/qa-plan-detail')
        .then((m) => m.QaPlanDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'superadmin/flows/:flowId',
    title: `${APP_TITLE} - Flujo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/flows/flow-detail/flow-detail')
        .then((m) => m.FlowDetailPage)
        .catch(() => chunkFallido()),
  },
  {
    path: 'superadmin/data-catalog/:objectId',
    title: `${APP_TITLE} - Ficha del catálogo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/data-catalog/object-detail/catalog-object-detail')
        .then((m) => m.CatalogObjectDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/new',
    title: `${APP_TITLE} - Nueva organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/organizations/organization-new/organization-new')
        .then((m) => m.OrganizationNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/verify',
    title: `${APP_TITLE} - Verificar organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/organizations/organization-verify/organization-verify')
        .then((m) => m.OrganizationVerify)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/branches/new',
    title: `${APP_TITLE} - Nueva sucursal`,
    canActivate: [organizacionAdministrableGuard],
    loadComponent: () =>
      import('../features/admin/organizations/branch-new/branch-new')
        .then((m) => m.BranchNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/memberships/new',
    title: `${APP_TITLE} - Sumar a la organización`,
    canActivate: [organizacionAdministrableGuard],
    loadComponent: () =>
      import('../features/admin/organizations/membership-new/membership-new')
        .then((m) => m.MembershipNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/child-organizations/new',
    title: `${APP_TITLE} - Nueva sub-organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/organizations/child-organization-new/child-organization-new')
        .then((m) => m.ChildOrganizationNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId',
    title: `${APP_TITLE} - Ficha de organización`,
    loadComponent: () =>
      import('../features/admin/organizations/organization-detail/organization-detail')
        .then((m) => m.OrganizationDetail)
        .catch(() => chunkFallido()),
  },
];
