import { Routes } from '@angular/router';

/**
 * Todas las rutas se cargan **diferidas**. Con `component:` el bundle inicial
 * arrastra cada pantalla de la app aunque el usuario nunca las visite — la
 * vitrina de diseño, que son 433 líneas de demo, es el caso más caro.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/home/home').then((m) => m.Home),
    pathMatch: 'full',
    title: 'Mantra Core Health',
  },
  {
    path: 'design-system',
    loadComponent: () =>
      import('@features/design-system-sample/design-system-sample').then(
        (m) => m.DesignSystemSample,
      ),
    title: 'Mantra Core Health - Vitrina de Diseño',
  },
  {
    path: 'auth',
    loadComponent: () => import('@features/auth/auth').then((m) => m.Auth),
    title: 'Mantra Core Health - Autenticación',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
