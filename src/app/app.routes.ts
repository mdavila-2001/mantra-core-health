import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterPatient } from './features/auth/register-patient/register-patient';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: Home,
        pathMatch: 'full',
        // El guard resuelve la autorización ANTES de que la pantalla pida
        // datos: es el estado S1 del M34, distinto de «cargando».
        canActivate: [authGuard],
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
