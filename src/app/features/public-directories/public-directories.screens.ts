import type { Type } from '@angular/core';

/**
 * Pantallas diferidas del ecosistema de directorios y funciones públicas/comunitarias.
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const PUBLIC_DIRECTORIES_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  feed: () => import('../feed/feed').then((m) => m.Feed),
  'notification-center': () =>
    import('../notifications/notification-center').then((m) => m.NotificationCenter),
  messaging: () => import('../messaging/messaging').then((m) => m.Messaging),
  groups: () => import('../groups-hub/groups-hub').then((m) => m.GroupsHub),
  settings: () => import('../settings/settings').then((m) => m.Settings),
  directories: () =>
    import('../directories-overview/directories-overview').then((m) => m.DirectoriesOverview),
  directory: () =>
    import('../directory/practitioners-directory/practitioners-directory').then(
      (m) => m.PractitionersDirectory,
    ),
  'psychological-help': () =>
    import('../psychological-help/psychological-help').then((m) => m.PsychologicalHelp),
  'laboratory-directory': () =>
    import('../laboratory-directory/laboratory-directory').then((m) => m.LaboratoryDirectory),
  'clinics-directory': () =>
    import('./clinics-directory').then((m) => m.ClinicsDirectory),
  'pharmacies-directory': () =>
    import('./pharmacies-directory').then((m) => m.PharmaciesDirectory),
  'insurers-directory': () =>
    import('./insurers-directory').then((m) => m.InsurersDirectory),
};
