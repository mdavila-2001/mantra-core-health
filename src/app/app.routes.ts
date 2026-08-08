import type { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { ShellLayout } from './features/shell-layout/shell-layout';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterPatient } from './features/auth/register-patient/register-patient';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { ActivateAccount } from './features/auth/activate-account/activate-account';
import { ResendVerification } from './features/auth/resend-verification/resend-verification';
import { ErrorRecovery } from './features/error-recovery/error-recovery';
import { IdentityVerification } from './features/identity-verification/identity-verification';
import { NotFound } from './features/not-found/not-found';
import { authGuard } from './core/auth/auth.guard';
import { APP_SECTIONS } from './core/navigation/navigation.map';
import {
  APP_TITLE,
  SECTION_ROUTE_DATA,
  titleOf,
  type AppSection,
} from './core/navigation/navigation.types';

/**
 * Qué componente pinta cada sección **que ya tiene pantalla**.
 *
 * Las que no figuran acá caen en el placeholder, y esa es toda la ceremonia de
 * encender una sección: agregarle su fila a este mapa. El registro
 * (`APP_SECTIONS`) sigue siendo el único que declara qué secciones existen, su
 * rótulo, sus roles y su grupo — acá solo se dice quién las dibuja.
 *
 * El panel y la verificación van **directos**: son parte del camino inmediato de
 * una sesión abierta —el panel es el destino del login, la verificación es la
 * salida del 403— y diferirlos agregaría una descarga justo donde la persona ya
 * está esperando.
 *
 * Las altas administrativas van **diferidas**: solo las alcanza un
 * `SECURITY_ADMIN`, así que no tiene sentido que las descargue todo el mundo al
 * entrar.
 */
const PANTALLAS: Readonly<Record<string, Type<unknown>>> = {
  panel: Dashboard,
  'identidad/verificar': IdentityVerification,
};

/** Secciones con pantalla propia que se descargan al entrar, no antes. */
const PANTALLAS_DIFERIDAS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administracion/usuarios': () =>
    import('./features/admin/user-registration/user-registration').then((m) => m.UserRegistration),
  'administracion/pacientes': () =>
    import('./features/admin/patients/patient-list/patient-list').then((m) => m.PatientList),
  'mi-cuenta': () => import('./features/account/my-profile/my-profile').then((m) => m.MyProfile),
};

/**
 * Pantallas que cuelgan de una sección **sin ser entradas de menú**: el alta,
 * la ficha de un registro concreto, un flujo alternativo.
 *
 * Van aparte del registro de secciones a propósito. `APP_SECTIONS` responde
 * «qué hay en el menú», y una ficha de paciente no está en el menú — está a un
 * clic de una fila. Meterlas ahí llenaría la navegación de destinos a los que
 * nadie llega desde el menú.
 *
 * **El orden importa.** El router prueba en orden de declaración, así que los
 * segmentos fijos (`nuevo`, `alta-asistida`) van antes que el parámetro
 * (`:profileId`), que si no se los tragaría.
 *
 * El breadcrumb y el menú marcado siguen funcionando sin tocar nada:
 * `NavigationService` resuelve la sección por la coincidencia **más larga**, así
 * que `/administracion/pacientes/nuevo` sigue resolviendo a «Pacientes».
 */
const PANTALLAS_HIJAS: Routes = [
  {
    path: 'administracion/pacientes/nuevo',
    title: `${APP_TITLE} - Nuevo paciente`,
    loadComponent: () =>
      import('./features/admin/patients/patient-new/patient-new')
        .then((m) => m.PatientNew)
        .catch(() => chunkFallido()),
  },
  {
    // Estaba en la raíz de la sección; se corre acá para dejarle el lugar al
    // listado, que es la pantalla que el vault declara como principal de
    // V05-01. Cambia la ruta, no la pantalla.
    path: 'administracion/pacientes/alta-asistida',
    title: `${APP_TITLE} - Alta asistida`,
    loadComponent: () =>
      import('./features/admin/assisted-registration/assisted-registration')
        .then((m) => m.AssistedRegistration)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administracion/pacientes/:profileId',
    title: `${APP_TITLE} - Ficha de paciente`,
    loadComponent: () =>
      import('./features/admin/patients/patient-detail/patient-detail')
        .then((m) => m.PatientDetail)
        .catch(() => chunkFallido()),
  },
];

/**
 * Las rutas hijas del armazón, derivadas del registro de secciones.
 *
 * Construirlas en vez de escribirlas es lo que hace **estructuralmente
 * imposible** el defecto clásico: un ítem de menú que apunta a una ruta que
 * nadie declaró. Menú y rutas salen del mismo array, así que o existen las dos
 * cosas o no existe ninguna.
 */
function rutasDeSecciones(): Routes {
  return APP_SECTIONS.map((section) => ({
    path: section.path,
    title: titleOf(section),
    // La sección viaja con la ruta: el placeholder la lee de acá y no necesita
    // saber cuál de todas es.
    data: { [SECTION_ROUTE_DATA]: section },
    ...componenteDe(section),
  }));
}

/**
 * El componente de una sección, o la carga diferida del placeholder.
 *
 * El placeholder se difiere porque es el caso mayoritario y no se necesita
 * hasta que alguien entra a una sección planificada; el `catch` cubre el mismo
 * caso que la vitrina —se despliega una versión nueva y el fragmento que pide
 * una pestaña vieja ya no existe—, que sin esto deja la navegación muerta y sin
 * avisar.
 */
function componenteDe(section: AppSection): Pick<Routes[number], 'component' | 'loadComponent'> {
  const pantalla = PANTALLAS[section.path];
  if (pantalla !== undefined) {
    return { component: pantalla };
  }

  const diferida = PANTALLAS_DIFERIDAS[section.path];
  if (diferida !== undefined) {
    return { loadComponent: () => diferida().catch(() => chunkFallido()) };
  }

  return {
    loadComponent: () =>
      import('./features/section-placeholder/section-placeholder')
        .then((m) => m.SectionPlaceholder)
        .catch(() => chunkFallido()),
  };
}

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
      ...rutasDeSecciones(),
      ...PANTALLAS_HIJAS,
    ],
  },
  {
    // Diferida a propósito: la vitrina expone el sistema de diseño entero
    // y nadie que entre a la aplicación real necesita descargarla. Con
    // import directo se llevaba el presupuesto inicial por delante.
    //
    // El `catch` cubre el fallo más probable en producción: se despliega una
    // versión nueva, alguien tenía la anterior abierta, y el fragmento que
    // su `index.html` pide ya no existe (`outputHashing: "all"` renombra
    // todo). Sin esto la navegación no completa y no avisa nada.
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system-sample/design-system-sample')
        .then((m) => m.DesignSystemSample)
        .catch(() => chunkFallido()),
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
    // V01-08. El token puede venir por el enlace (`?token=…`) o escribirse a
    // mano: el alta asistida lo entrega en pantalla para que alguien lo pase
    // por teléfono o en papel, y obligar a armar una URL sería devolverle el
    // problema a quien menos herramientas tiene.
    path: 'auth/activar',
    component: ActivateAccount,
    title: 'Mantra Core Health - Activar cuenta',
  },
  {
    // V01-14.
    path: 'auth/reenviar-verificacion',
    component: ResendVerification,
    title: 'Mantra Core Health - Reenviar verificación',
  },
  {
    // También por query string: /auth/nueva-clave?token=…
    path: 'auth/nueva-clave',
    component: ResetPassword,
    title: 'Mantra Core Health - Nueva contraseña',
  },
  {
    // Pantalla de recuperación: a donde llega un fragmento que no bajó.
    // No lleva `title` propio para no anunciar «error» en la pestaña de
    // alguien que quizá solo necesita recargar.
    path: 'error',
    component: ErrorRecovery,
    title: 'Mantra Core Health',
  },
  {
    // Antes esto redirigía a `/`, que mandaba al panel —o al login, vía el
    // guard— a quien escribiera mal una dirección, sin decirle que se había
    // equivocado. Ahora lo dice.
    path: '**',
    component: NotFound,
    title: 'Mantra Core Health - Página no encontrada',
  },
];

/**
 * Componente que se muestra cuando un fragmento diferido no se pudo descargar.
 *
 * Devolverlo en vez de relanzar es lo que convierte una navegación muerta en un
 * mensaje accionable: la pantalla de recuperación ofrece recargar, que es
 * exactamente lo que resuelve el caso.
 */
function chunkFallido(): typeof ErrorRecovery {
  return ErrorRecovery;
}
