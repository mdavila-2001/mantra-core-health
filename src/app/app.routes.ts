import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Auth } from './features/auth/auth';

export const routes: Routes = [
    {
        path: '',
        component: Home,
        pathMatch: 'full',
        title: 'Mantra Core Health',
    },
    {
        // Diferida a propósito: la vitrina expone el sistema de diseño entero
        // y nadie que entre a la aplicación real necesita descargarla. Con
        // import directo se llevaba el presupuesto inicial por delante.
        path: 'design-system',
        loadComponent: () =>
            import('./features/design-system-sample/design-system-sample').then(
                (m) => m.DesignSystemSample,
            ),
        title: 'Mantra Core Health - Vitrina de Diseño',
    },
    {
        path: 'auth',
        component: Auth,
        title: 'Mantra Core Health - Autenticación',
    },
    {
        path: '**',
        redirectTo: '',
    },
];
