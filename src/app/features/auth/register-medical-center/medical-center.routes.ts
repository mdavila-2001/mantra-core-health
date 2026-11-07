import type { Type } from '@angular/core';
import type { Route } from '@angular/router';

/**
 * Las rutas del centro médico (CM-11), fuera de `app.routes.ts`: ese archivo ya
 * supera el techo de líneas del repo y no puede crecer.
 */

/**
 * El alta pública de una organización médica: `register-organization` con el
 * tipo de institución que se elige (hospital, clínica, consultorio, centro de
 * enfermería u otra). Queda pendiente de verificación; su práctica y su sede se
 * abren después en `administration/medical-center-setup`. La ruta conserva su
 * nombre para no romper enlaces ya publicados.
 */
export const MEDICAL_CENTER_SIGNUP_ROUTE: Route = {
  path: 'auth/register/medical-center',
  loadComponent: () => import('./register-medical-center').then((m) => m.RegisterMedicalCenter),
  title: 'AloVida - Registrar organización médica',
};

/**
 * La pantalla de la organización verificada: abre su práctica y su primera
 * sede. Se registra en el mapa de navegación como
 * `administration/medical-center-setup` y se descarga al entrar.
 */
export const MEDICAL_CENTER_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/medical-center-setup': () =>
    import('../../organization/medical-center-setup/medical-center-setup').then(
      (m) => m.MedicalCenterSetup,
    ),
  // Its branches (2026-11-06): the same screen as pharmacy, laboratory and
  // imaging, with the map and each site's category.
  'administration/medical-branches': () =>
    import('../../organization/organization-branches/organization-branches').then(
      (m) => m.OrganizationBranches,
    ),
  // The doctors of the organization (2026-11-07): who asks to join and who already works there.
  'administration/my-organization/affiliations': () =>
    import('../../organization/practitioner-affiliations/practitioner-affiliations').then(
      (m) => m.PractitionerAffiliations,
    ),
  'administration/doctor-access': () =>
    import('../../organization/doctor-access/doctor-access').then((m) => m.DoctorAccess),
};
