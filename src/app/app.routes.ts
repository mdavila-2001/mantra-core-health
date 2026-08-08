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
  agenda: () => import('./features/agenda/agenda').then((m) => m.Agenda),
  clinico: () =>
    import('./features/clinical-record/clinical-record').then((m) => m.ClinicalRecord),
  'administracion/usuarios': () =>
    import('./features/admin/user-registration/user-registration').then((m) => m.UserRegistration),
  'administracion/pacientes': () =>
    import('./features/admin/patients/patient-list/patient-list').then((m) => m.PatientList),
  'administracion/terminologia': () =>
    import('./features/admin/terminology/terminology-catalog').then((m) => m.TerminologyCatalog),
  'mi-cuenta': () => import('./features/account/my-profile/my-profile').then((m) => m.MyProfile),
  'identidad/casos': () =>
    import('./features/identity-assurance/verification-cases/verification-cases').then(
      (m) => m.VerificationCases,
    ),
  'administracion/acceso-delegado': () =>
    import('./features/delegated-access/delegated-access-home/delegated-access-home').then(
      (m) => m.DelegatedAccessHome,
    ),
  'administracion/proveedores-identidad': () =>
    import('./features/auth-providers/auth-providers-home/auth-providers-home').then(
      (m) => m.AuthProvidersHome,
    ),
  'administracion/verificacion-identidad': () =>
    import('./features/identity-assurance/identity-admin-home/identity-admin-home').then(
      (m) => m.IdentityAdminHome,
    ),
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
    // El expediente de una persona concreta. Cuelga de «Archivo clínico», que
    // es la pantalla que elige a quién se mira: sin paciente no hay expediente,
    // y las dos lecturas del backend piden el perfil en la ruta.
    path: 'clinico/:profileId',
    title: `${APP_TITLE} - Expediente clínico`,
    loadComponent: () =>
      import('./features/clinical-record/patient-chart/patient-chart')
        .then((m) => m.PatientChart)
        .catch(() => chunkFallido()),
  },
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
  {
    // Ficha de un caso de verificación (V27-01): una fila del listado de
    // `identidad/casos` abierta.
    path: 'identidad/casos/:caseId',
    title: `${APP_TITLE} - Caso de verificación`,
    loadComponent: () =>
      import('./features/identity-assurance/verification-case-detail/verification-case-detail')
        .then((m) => m.VerificationCaseDetail)
        .catch(() => chunkFallido()),
  },
];

/**
 * Pantalla de operación de una sección sin listados (M29, M40): una acción de
 * la sección, no una entrada de menú. Como con las pantallas hijas, la sección
 * del breadcrumb la resuelve `NavigationService` por la coincidencia más larga.
 */
function pantallaDeOperacion(
  seccion: string,
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return {
    path: `${seccion}/${subpath}`,
    title: `${APP_TITLE} - ${titulo}`,
    loadComponent: () => loader().catch(() => chunkFallido()),
  };
}

function pantallaDeAccesoDelegado(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administracion/acceso-delegado', subpath, titulo, loader);
}

function pantallaDeProveedoresDeIdentidad(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administracion/proveedores-identidad', subpath, titulo, loader);
}

function pantallaDeVerificacionIdentidad(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administracion/verificacion-identidad', subpath, titulo, loader);
}

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
      pantallaDeAccesoDelegado('delegaciones/nueva', 'Nueva delegación', () =>
        import(
          './features/delegated-access/practitioner-delegate-form/practitioner-delegate-form'
        ).then((m) => m.PractitionerDelegateForm),
      ),
      pantallaDeAccesoDelegado('delegaciones/revocar', 'Revocar delegación', () =>
        import('./features/delegated-access/delegation-revocation/delegation-revocation').then(
          (m) => m.DelegationRevocation,
        ),
      ),
      pantallaDeAccesoDelegado('delegaciones/solicitudes/nueva', 'Solicitar acceso delegado', () =>
        import('./features/delegated-access/access-request-form/access-request-form').then(
          (m) => m.AccessRequestForm,
        ),
      ),
      pantallaDeAccesoDelegado('delegaciones/concesiones/nueva', 'Otorgar concesión', () =>
        import('./features/delegated-access/grant-form/grant-form').then((m) => m.GrantForm),
      ),
      pantallaDeAccesoDelegado('asignaciones/nueva', 'Asignar usuario de organización', () =>
        import('./features/delegated-access/org-assignment-form/org-assignment-form').then(
          (m) => m.OrgAssignmentForm,
        ),
      ),
      pantallaDeAccesoDelegado('asignaciones/editar', 'Reasignar o suspender asignación', () =>
        import('./features/delegated-access/org-assignment-update/org-assignment-update').then(
          (m) => m.OrgAssignmentUpdate,
        ),
      ),
      pantallaDeAccesoDelegado('solicitudes/resolver', 'Resolver solicitud de acceso', () =>
        import(
          './features/delegated-access/access-request-resolution/access-request-resolution'
        ).then((m) => m.AccessRequestResolution),
      ),
      pantallaDeAccesoDelegado('conjuntos/nuevo', 'Publicar set de permisos', () =>
        import('./features/delegated-access/permission-set-form/permission-set-form').then(
          (m) => m.PermissionSetForm,
        ),
      ),
      pantallaDeAccesoDelegado('conjuntos/versionar', 'Versionar set de permisos', () =>
        import('./features/delegated-access/set-version-form/set-version-form').then(
          (m) => m.SetVersionForm,
        ),
      ),
      pantallaDeAccesoDelegado('operacion/evaluar-actor', 'Evaluar actor efectivo', () =>
        import('./features/delegated-access/actor-evaluation/actor-evaluation').then(
          (m) => m.ActorEvaluation,
        ),
      ),
      pantallaDeAccesoDelegado('operacion/barrido-expiracion', 'Barrido de expiración', () =>
        import('./features/delegated-access/expiry-sweep/expiry-sweep').then((m) => m.ExpirySweep),
      ),
      pantallaDeProveedoresDeIdentidad('proveedores/nuevo', 'Registrar proveedor de identidad', () =>
        import('./features/auth-providers/provider-form/provider-form').then(
          (m) => m.ProviderForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'proveedores/protocolo',
        'Configurar protocolo del proveedor',
        () =>
          import('./features/auth-providers/protocol-config-form/protocol-config-form').then(
            (m) => m.ProtocolConfigForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('proveedores/mapeo-atributos', 'Fijar mapeo de atributos', () =>
        import('./features/auth-providers/attribute-mappings-form/attribute-mappings-form').then(
          (m) => m.AttributeMappingsForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'proveedores/regla-aprovisionamiento',
        'Definir regla de aprovisionamiento',
        () =>
          import('./features/auth-providers/provisioning-rule-form/provisioning-rule-form').then(
            (m) => m.ProvisioningRuleForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('claves/nueva', 'Publicar clave de firma', () =>
        import('./features/auth-providers/signing-key-form/signing-key-form').then(
          (m) => m.SigningKeyForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('claves/rotar', 'Rotar clave de firma', () =>
        import('./features/auth-providers/key-rotation-form/key-rotation-form').then(
          (m) => m.KeyRotationForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'organizaciones/vincular',
        'Vincular proveedor a una organización',
        () =>
          import('./features/auth-providers/tenant-binding-form/tenant-binding-form').then(
            (m) => m.TenantBindingForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('login/iniciar', 'Iniciar login federado', () =>
        import('./features/auth-providers/login-start-form/login-start-form').then(
          (m) => m.LoginStartForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('login/callback', 'Procesar callback del proveedor', () =>
        import('./features/auth-providers/login-callback-form/login-callback-form').then(
          (m) => m.LoginCallbackForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('cuentas/vincular', 'Solicitar vinculación de cuenta', () =>
        import('./features/auth-providers/account-link-request-form/account-link-request-form').then(
          (m) => m.AccountLinkRequestForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'cuentas/completar',
        'Completar vinculación de cuenta',
        () =>
          import(
            './features/auth-providers/account-link-complete-form/account-link-complete-form'
          ).then((m) => m.AccountLinkCompleteForm),
      ),
      pantallaDeProveedoresDeIdentidad(
        'cuentas/desvincular',
        'Desvincular identidad federada',
        () =>
          import('./features/auth-providers/identity-unlink-form/identity-unlink-form').then(
            (m) => m.IdentityUnlinkForm,
          ),
      ),
      pantallaDeVerificacionIdentidad('autoridades/nueva', 'Registrar autoridad de identidad', () =>
        import('./features/identity-assurance/authority-form/authority-form').then(
          (m) => m.AuthorityForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('autoridades/endpoint', 'Publicar endpoint de autoridad', () =>
        import(
          './features/identity-assurance/authority-endpoint-form/authority-endpoint-form'
        ).then((m) => m.AuthorityEndpointForm),
      ),
      pantallaDeVerificacionIdentidad('politicas/nueva', 'Crear política de verificación', () =>
        import(
          './features/identity-assurance/verification-policy-form/verification-policy-form'
        ).then((m) => m.VerificationPolicyForm),
      ),
      pantallaDeVerificacionIdentidad('casos/nuevo', 'Abrir caso de verificación', () =>
        import('./features/identity-assurance/case-open-form/case-open-form').then(
          (m) => m.CaseOpenForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('casos/evidencia', 'Aportar evidencia a un caso', () =>
        import('./features/identity-assurance/case-evidence-form/case-evidence-form').then(
          (m) => m.CaseEvidenceForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('casos/checks', 'Planificar checks del caso', () =>
        import('./features/identity-assurance/check-plan-form/check-plan-form').then(
          (m) => m.CheckPlanForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('casos/barrido', 'Barrer casos vencidos', () =>
        import('./features/identity-assurance/case-expire-sweep/case-expire-sweep').then(
          (m) => m.CaseExpireSweep,
        ),
      ),
      pantallaDeVerificacionIdentidad(
        'checks/intento',
        'Registrar intento contra la autoridad',
        () =>
          import('./features/identity-assurance/check-attempt-form/check-attempt-form').then(
            (m) => m.CheckAttemptForm,
          ),
      ),
      pantallaDeVerificacionIdentidad('checks/resultado', 'Registrar resultado del check', () =>
        import('./features/identity-assurance/check-result-form/check-result-form').then(
          (m) => m.CheckResultForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('checks/fraude', 'Registrar señal de fraude', () =>
        import('./features/identity-assurance/fraud-signal-form/fraud-signal-form').then(
          (m) => m.FraudSignalForm,
        ),
      ),
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
