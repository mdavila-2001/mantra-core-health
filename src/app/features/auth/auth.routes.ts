import type { Routes } from '@angular/router';

import { ActivateAccount } from './activate-account/activate-account';
import { ForgotPassword } from './forgot-password/forgot-password';
import { Login } from './login/login';
import { RegisterAccountType } from './register-account-type/register-account-type';
import { MEDICAL_CENTER_SIGNUP_ROUTE } from './register-medical-center/medical-center.routes';
import { ResendVerification } from './resend-verification/resend-verification';
import { ResetPassword } from './reset-password/reset-password';
import { TenantSelection } from './tenant-selection/tenant-selection';
import { VerifyEmail } from './verify-email/verify-email';

/**
 * Rutas de autenticación, onboarding y registro público (AloVida).
 * Desacopladas de app.routes.ts para gobernanza lean y cumplimiento de <= 300 líneas.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'auth',
    component: Login,
    pathMatch: 'full',
    title: 'AloVida - Iniciar sesión',
  },
  {
    path: 'auth/organization',
    component: TenantSelection,
    title: 'AloVida - Elija su organización',
  },
  {
    path: 'auth/register',
    component: RegisterAccountType,
    pathMatch: 'full',
    title: 'AloVida - Crear cuenta',
  },
  {
    path: 'auth/register/organization-type',
    component: RegisterAccountType,
    data: { audience: 'organizations' },
    title: 'AloVida - Registre su organización',
  },
  {
    path: 'auth/register/patient',
    loadComponent: () =>
      import('./register-patient/register-patient').then((m) => m.RegisterPatient),
    title: 'AloVida - Crear cuenta de paciente',
  },
  {
    path: 'auth/register/practitioner',
    loadComponent: () =>
      import('./register-practitioner/register-practitioner').then(
        (m) => m.RegisterPractitioner,
      ),
    title: 'AloVida - Crear cuenta de profesional',
  },
  {
    path: 'auth/register/support-staff',
    loadComponent: () =>
      import('./register-support-staff/register-support-staff').then(
        (m) => m.RegisterSupportStaff,
      ),
    title: 'AloVida - Crear cuenta de personal de apoyo',
  },
  {
    path: 'auth/register/organization',
    loadComponent: () =>
      import('./register-organization/register-organization').then(
        (m) => m.RegisterOrganization,
      ),
    title: 'AloVida - Registrar aseguradora',
  },
  {
    path: 'auth/register/laboratory',
    loadComponent: () =>
      import('./register-laboratory/register-laboratory').then(
        (m) => m.RegisterLaboratory,
      ),
    title: 'AloVida - Registrar laboratorio',
  },
  {
    path: 'auth/register/imaging-center',
    loadComponent: () =>
      import('./register-imaging-center/register-imaging-center').then(
        (m) => m.RegisterImagingCenter,
      ),
    title: 'AloVida - Registrar centro de imagenología',
  },
  {
    path: 'auth/register/pharmacy',
    loadComponent: () =>
      import('./register-pharmacy/register-pharmacy').then((m) => m.RegisterPharmacy),
    title: 'AloVida - Registrar farmacia',
  },
  MEDICAL_CENTER_SIGNUP_ROUTE,
  {
    path: 'auth/verify-email',
    component: VerifyEmail,
    title: 'AloVida - Verificar correo',
  },
  {
    path: 'auth/forgot-password',
    component: ForgotPassword,
    title: 'AloVida - Recuperar contraseña',
  },
  {
    path: 'auth/activate',
    component: ActivateAccount,
    title: 'AloVida - Activar cuenta',
  },
  {
    path: 'auth/resend-verification',
    component: ResendVerification,
    title: 'AloVida - Reenviar verificación',
  },
  {
    path: 'auth/reset-password',
    component: ResetPassword,
    title: 'AloVida - Nueva contraseña',
  },
];
