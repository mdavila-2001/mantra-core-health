import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { APP_TITLE } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';
import { PRACTITIONER_ASSISTED_ROUTE } from '../features/admin/practitioner-assisted-registration/practitioner-assisted-registration.route';
import { redireccionConQuery } from './redireccion-query.helper';
import { chunkFallido } from './chunk-fallido';

/**
 * Pantallas hijas de expediente clínico, grupos médicos, pacientes y directorios.
 */
export const PANTALLAS_HIJAS_CLINICAL: Routes = [
  {
    path: 'medical-records/:profileId',
    title: `${APP_TITLE} - Expediente clínico`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/clinical-record/patient-chart/patient-chart')
        .then((m) => m.PatientChart)
        .catch(() => chunkFallido()),
  },
  {
    path: 'medical-records/:profileId/consultation',
    title: `${APP_TITLE} - Consulta`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/clinical-record/consultation/consultation')
        .then((m) => m.Consultation)
        .catch(() => chunkFallido()),
  },
  {
    path: 'medical-records/:profileId/request-access',
    title: `${APP_TITLE} - Solicitar vinculación`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/clinical-record/request-access/request-access')
        .then((m) => m.RequestAccess)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/access-requests',
    title: `${APP_TITLE} - Solicitudes de vínculo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/access-requests/access-requests')
        .then((m) => m.AccessRequests)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/new',
    title: `${APP_TITLE} - Nuevo paciente`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/patients/patient-new/patient-new')
        .then((m) => m.PatientNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-quotations/new',
    title: `${APP_TITLE} - Nueva cotización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/quotations/quotation-form/quotation-form')
        .then((m) => m.QuotationForm)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-medical-groups/new',
    title: `${APP_TITLE} - Crear grupo médico`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/medical-groups/medical-group-form/medical-group-form')
        .then((m) => m.MedicalGroupForm)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-medical-groups/:id',
    title: `${APP_TITLE} - Grupo médico`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/medical-groups/medical-group-detail/medical-group-detail')
        .then((m) => m.MedicalGroupDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/merge',
    title: `${APP_TITLE} - Fusionar duplicados`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/patients/patient-merge/patient-merge')
        .then((m) => m.PatientMerge)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/assisted-registration',
    title: `${APP_TITLE} - Alta asistida`,
    loadComponent: () =>
      import('../features/admin/assisted-registration/assisted-registration')
        .then((m) => m.AssistedRegistration)
        .catch(() => chunkFallido()),
  },
  PRACTITIONER_ASSISTED_ROUTE,
  {
    path: 'administration/patients/:profileId',
    title: `${APP_TITLE} - Ficha de paciente`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/admin/patients/patient-detail/patient-detail')
        .then((m) => m.PatientDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/identity/cases',
    pathMatch: 'full',
    redirectTo: redireccionConQuery({ ruta: '/my-account/identity', query: { tab: 'cases' } }),
  },
  ...(['laboratory/reception', 'laboratory/queue', 'administration/laboratory-results'] as const).map(
    (vieja) => ({
      path: vieja,
      pathMatch: 'full' as const,
      redirectTo: redireccionConQuery({ ruta: '/administration/laboratory-orders' }),
    }),
  ),
  ...(['categories', 'prices', 'inventory', 'import'] as const).map((tab) => ({
    path: `administration/pharmacy-${tab}`,
    pathMatch: 'full' as const,
    redirectTo: redireccionConQuery({ ruta: '/administration/pharmacy-catalog', query: { tab } }),
  })),
  {
    path: 'my-account/identity/cases/:caseId',
    pathMatch: 'full',
    redirectTo: ({ params, queryParams }: { params: Record<string, string>; queryParams: Record<string, string> }) =>
      inject(Router).createUrlTree(['/my-account/identity'], {
        queryParams: { ...queryParams, tab: 'cases', case: params['caseId'] },
      }),
  },
  {
    path: 'directory/:profileId',
    title: `${APP_TITLE} - Perfil profesional`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/directory/practitioner-detail/practitioner-detail')
        .then((m) => m.PractitionerDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'laboratory-directory/:unitId',
    title: `${APP_TITLE} - Perfil de laboratorio`,
    loadComponent: () =>
      import('../features/laboratory-directory/laboratory-detail/laboratory-detail')
        .then((m) => m.LaboratoryDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'clinics-directory/:slug',
    title: `${APP_TITLE} - Perfil de clínica`,
    loadComponent: () =>
      import('../features/public-directories/clinic-detail/clinic-detail')
        .then((m) => m.ClinicDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'insurers-directory/:slug',
    title: `${APP_TITLE} - Aseguradora`,
    loadComponent: () =>
      import('../features/public-directories/insurer-detail/insurer-detail')
        .then((m) => m.InsurerDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'pharmacies-directory/:slug',
    title: `${APP_TITLE} - Perfil de farmacia`,
    loadComponent: () =>
      import('../features/public-directories/pharmacy-detail/pharmacy-detail')
        .then((m) => m.PharmacyDetail)
        .catch(() => chunkFallido()),
  },
];
