import type { Type } from '@angular/core';
import type { Route } from '@angular/router';

/**
 * Las rutas del centro médico (CM-11), fuera de `app.routes.ts`: ese archivo ya
 * supera el techo de líneas del repo y no puede crecer.
 */

/**
 * El alta pública de un centro médico: `register-organization` con
 * `tenantType: 'HOSPITAL'`, un tipo de salud que ya existe. Queda pendiente de
 * verificación; su práctica y su sede se abren después en
 * `administration/medical-center-setup`.
 */
export const RUTA_DE_ALTA_DE_CENTRO_MEDICO: Route = {
  path: 'auth/register/medical-center',
  loadComponent: () => import('./register-medical-center').then((m) => m.RegisterMedicalCenter),
  title: 'AloVida - Registrar centro médico',
};

/**
 * La pantalla de la organización verificada: abre su práctica y su primera
 * sede. Se registra en el mapa de navegación como
 * `administration/medical-center-setup` y se descarga al entrar.
 */
export const PANTALLAS_DE_CENTRO_MEDICO: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/medical-center-setup': () =>
    import('../../organization/medical-center-setup/medical-center-setup').then(
      (m) => m.MedicalCenterSetup,
    ),
};
