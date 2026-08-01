import { Routes } from '@angular/router';

import { authGuard, guestGuard, tenantSelectedGuard } from './core/auth/auth.guard';

/**
 * Rutas de la aplicación.
 *
 * Tres áreas, y la diferencia entre ellas es qué guard las cubre:
 *
 * - **`/auth/**`** — públicas, con `guestGuard`: quien ya tiene sesión no vuelve al login.
 * - **Área con sesión** — bajo `ShellLayout`, con `authGuard` + `tenantSelectedGuard`.
 * - **`/design-system`** — abierta a propósito. Es la vitrina del sistema de diseño, no transporta
 *   ningún dato, y tiene que poder mostrarse sin credenciales.
 *
 * ## Todo lo pesado va diferido
 *
 * Ninguna pantalla se importa directamente. El paquete inicial solo carga lo que hace falta para
 * pintar la primera ruta, y la vitrina —que sola pesa unos 900 kB porque instancia el sistema de
 * diseño entero— nunca se descarga si nadie la abre.
 *
 * ## `/panel` y no `/`
 *
 * Para que la portada pueda decidir a dónde mandar en vez de ser ella misma un destino: sin sesión
 * al login, con sesión al panel. Lo resuelve `authGuard` sobre la ruta vacía.
 */
export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
        title: 'Ingresar · Mantra Core Health',
      },
      {
        // En castellano, como el resto de lo que se ve en la barra de direcciones.
        path: 'organizacion',
        loadComponent: () =>
          import('./features/auth/select-organization/select-organization').then(
            (m) => m.SelectOrganization,
          ),
        title: 'Elegí una organización · Mantra Core Health',
      },
      {
        path: 'recuperar',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
        title: 'Recuperar el acceso · Mantra Core Health',
      },
      {
        // Destino del enlace del correo: llega con `?token=`.
        path: 'restablecer',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
        title: 'Elegí una contraseña nueva · Mantra Core Health',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
    ],
  },

  {
    // La vitrina expone el sistema de diseño entero y no hay nada que proteger en ella. Diferida
    // aparte: con import directo se llevaba el presupuesto del paquete inicial por delante.
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system-sample/design-system-sample').then(
        (m) => m.DesignSystemSample,
      ),
    title: 'Vitrina de diseño · Mantra Core Health',
  },

  {
    path: '',
    loadComponent: () => import('./features/shell-layout/shell-layout').then((m) => m.ShellLayout),
    // El orden importa: primero hay sesión, después hay organización. Al revés, quien no tiene
    // sesión terminaría en la pantalla de elegir organización sin ninguna que elegir.
    canActivate: [authGuard, tenantSelectedGuard],
    children: [
      {
        path: 'panel',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Panel · Mantra Core Health',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'panel',
      },
    ],
  },

  {
    // Cualquier otra cosa cae en el área con sesión, que decide: al panel si la hay, al login si no.
    path: '**',
    redirectTo: '',
  },
];
