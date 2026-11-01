import type { Type } from '@angular/core';
import { CATALOG_EDITOR_LOADER, CATALOG_EDITOR_PATH } from './catalog-editor/catalog-editor.routes';
import { cargarSistema } from '../observability/observability.routes';

/**
 * Pantallas diferidas del módulo de Administración y Superadministración.
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const ADMIN_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/users': () =>
    import('./user-registration/user-registration').then((m) => m.UserRegistration),
  'administration/patients': () =>
    import('./patients/patient-list/patient-list').then((m) => m.PatientList),
  'administration/organizations': () =>
    import('./organizations/organization-list/organization-list').then(
      (m) => m.OrganizationList,
    ),
  'administration/medical-organization': () =>
    import('./medical-organization/medical-organization').then(
      (m) => m.MedicalOrganization,
    ),
  'administration/my-organization': () =>
    import('../organization/organization-panel').then((m) => m.OrganizationPanel),
  'administration/medical-laboratory': () =>
    import('./medical-laboratory/medical-laboratory').then(
      (m) => m.MedicalLaboratory,
    ),
  'administration/accounting': () =>
    import('../accounting/summary/summary').then((m) => m.Summary),
  'administration/terminology': () =>
    import('./terminology/terminology-catalog').then((m) => m.TerminologyCatalog),
  'administration/content-packs': () =>
    import('./content-packs/content-packs').then((m) => m.ContentPacks),
  'administration/moderation': () =>
    import('./moderation/moderation').then((m) => m.Moderation),
  'superadmin/observability': cargarSistema,
  'superadmin/measurement': () =>
    import('./measurement/measurement').then((m) => m.Measurement),
  'superadmin/data-catalog': () =>
    import('./data-catalog/data-catalog').then((m) => m.DataCatalog),
  'superadmin/portal': () =>
    import('./portal/portal-shell').then((m) => m.PortalShell),
  'superadmin/flows': () =>
    import('./flows/flows').then((m) => m.Flows),
  'superadmin/web-analytics': () =>
    import('./web-analytics/web-analytics').then((m) => m.WebAnalytics),
  'superadmin/qa-lab': () =>
    import('./qa-lab/qa-lab').then((m) => m.QaLab),
  'superadmin/operations': () =>
    import('./operations/operations').then((m) => m.Operations),
  'superadmin/instances': () =>
    import('./instances/instances').then((m) => m.Instances),
  [CATALOG_EDITOR_PATH]: CATALOG_EDITOR_LOADER,
  'superadmin/bulk-imports': () =>
    import('./bulk-imports/bulk-imports').then((m) => m.BulkImports),
  tutorials: () =>
    import('../tutorials/tutorials-center').then((m) => m.TutorialsCenter),
};
