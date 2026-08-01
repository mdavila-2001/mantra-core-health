import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { ShellLayout } from './features/shell-layout/shell-layout';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterPatient } from './features/auth/register-patient/register-patient';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    {
        // El armazón: header con el usuario, navegación y selector de organización.
        // El guard corre en el padre — S1 del M34: autorizar ANTES de pedir datos —
        // y cubre a todas las hijas.
        path: '',
        component: ShellLayout,
        canActivate: [authGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'panel' },
            {
                path: 'panel',
                component: Dashboard,
                title: 'Mantra Core Health - Panel',
            },
        ],
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
        component: Login,
        pathMatch: 'full',
        title: 'Mantra Core Health - Iniciar sesión',
    },
    {
        // La ruta la fija `TENANT_SELECTION_ROUTE`, que es a donde manda el guard.
        path: 'auth/organizacion',
        component: TenantSelection,
        title: 'Mantra Core Health - Elegí tu organización',
    },
    {
        path: 'auth/registro',
        component: RegisterPatient,
        title: 'Mantra Core Health - Crear cuenta',
    },
    {
        // El enlace del correo trae el token por query string: /auth/verificar?token=…
        path: 'auth/verificar',
        component: VerifyEmail,
        title: 'Mantra Core Health - Verificar correo',
    },
    {
        path: 'auth/recuperar',
        component: ForgotPassword,
        title: 'Mantra Core Health - Recuperar contraseña',
    },
    {
        // También por query string: /auth/nueva-clave?token=…
        path: 'auth/nueva-clave',
        component: ResetPassword,
        title: 'Mantra Core Health - Nueva contraseña',
    },
    {
        path: '**',
        redirectTo: '',
    },
];
