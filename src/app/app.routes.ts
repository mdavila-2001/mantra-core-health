import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { DesignSystemSample } from './features/design-system-sample/design-system-sample';
import { Auth } from './features/auth/auth';

export const routes: Routes = [
    {
        path: '',
        component: Home,
        pathMatch: 'full',
        title: 'Mantra Core Health',
    },
    {
        path: 'design-system',
        component: DesignSystemSample,
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
