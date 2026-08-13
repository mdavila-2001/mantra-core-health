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
  dashboard: Dashboard,
  'my-account/identity/verify': IdentityVerification,
};

/** Secciones con pantalla propia que se descargan al entrar, no antes. */
const PANTALLAS_DIFERIDAS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  schedule: () => import('./features/agenda/agenda').then((m) => m.Agenda),
  'medical-records': () =>
    import('./features/clinical-record/clinical-record').then((m) => m.ClinicalRecord),
  'administration/users': () =>
    import('./features/admin/user-registration/user-registration').then((m) => m.UserRegistration),
  'administration/patients': () =>
    import('./features/admin/patients/patient-list/patient-list').then((m) => m.PatientList),
  'administration/organizations': () =>
    import('./features/admin/organizations/organization-list/organization-list').then(
      (m) => m.OrganizationList,
    ),
  'accounting': () => import('./features/accounting/accounting').then((m) => m.Accounting),
  'administration/terminology': () =>
    import('./features/admin/terminology/terminology-catalog').then((m) => m.TerminologyCatalog),
  'my-account': () => import('./features/account/my-profile/my-profile').then((m) => m.MyProfile),
  'my-account/appointments': () =>
    import('./features/account/appointments/appointments').then((m) => m.Appointments),
  'my-account/identity/cases': () =>
    import('./features/identity-assurance/verification-cases/verification-cases').then(
      (m) => m.VerificationCases,
    ),
  'administration/delegated-access': () =>
    import('./features/delegated-access/delegated-access-home/delegated-access-home').then(
      (m) => m.DelegatedAccessHome,
    ),
  'administration/identity-providers': () =>
    import('./features/auth-providers/auth-providers-home/auth-providers-home').then(
      (m) => m.AuthProvidersHome,
    ),
  'administration/identity-assurance': () =>
    import('./features/identity-assurance/identity-admin-home/identity-admin-home').then(
      (m) => m.IdentityAdminHome,
    ),
  'administration/health-context': () =>
    import('./features/health-context/health-context-home/health-context-home').then(
      (m) => m.HealthContextHome,
    ),
  'administration/geolocation': () =>
    import('./features/geo/geo-home/geo-home').then((m) => m.GeoHome),
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
 * que `/administration/patients/new` sigue resolviendo a «Pacientes».
 */
const PANTALLAS_HIJAS: Routes = [
  {
    // El expediente de una persona concreta. Cuelga de «Archivo clínico», que
    // es la pantalla que elige a quién se mira: sin paciente no hay expediente,
    // y las dos lecturas del backend piden el perfil en la ruta.
    path: 'medical-records/:profileId',
    title: `${APP_TITLE} - Expediente clínico`,
    loadComponent: () =>
      import('./features/clinical-record/patient-chart/patient-chart')
        .then((m) => m.PatientChart)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/new',
    title: `${APP_TITLE} - Nuevo paciente`,
    loadComponent: () =>
      import('./features/admin/patients/patient-new/patient-new')
        .then((m) => m.PatientNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/merge',
    title: `${APP_TITLE} - Fusionar duplicados`,
    loadComponent: () =>
      import('./features/admin/patients/patient-merge/patient-merge')
        .then((m) => m.PatientMerge)
        .catch(() => chunkFallido()),
  },
  {
    // Estaba en la raíz de la sección; se corre acá para dejarle el lugar al
    // listado, que es la pantalla que el vault declara como principal de
    // V05-01. Cambia la ruta, no la pantalla.
    path: 'administration/patients/assisted-registration',
    title: `${APP_TITLE} - Alta asistida`,
    loadComponent: () =>
      import('./features/admin/assisted-registration/assisted-registration')
        .then((m) => m.AssistedRegistration)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/:profileId',
    title: `${APP_TITLE} - Ficha de paciente`,
    loadComponent: () =>
      import('./features/admin/patients/patient-detail/patient-detail')
        .then((m) => m.PatientDetail)
        .catch(() => chunkFallido()),
  },
  {
    // Ficha de un caso de verificación (V27-01): una fila del listado de
    // `identidad/casos` abierta.
    path: 'my-account/identity/cases/:caseId',
    title: `${APP_TITLE} - Caso de verificación`,
    loadComponent: () =>
      import('./features/identity-assurance/verification-case-detail/verification-case-detail')
        .then((m) => m.VerificationCaseDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/new',
    title: `${APP_TITLE} - Nueva organización`,
    loadComponent: () =>
      import('./features/admin/organizations/organization-new/organization-new')
        .then((m) => m.OrganizationNew)
        .catch(() => chunkFallido()),
  },
  {
    // Ficha de una organización (V04-06·L, V04-02·L y V04-07·L): sus
    // sucursales, su plantilla y sus sub-organizaciones. Va DESPUÉS de
    // `/new`, o el literal se comería el parámetro.
    path: 'administration/organizations/:tenantId',
    title: `${APP_TITLE} - Ficha de organización`,
    loadComponent: () =>
      import('./features/admin/organizations/organization-detail/organization-detail')
        .then((m) => m.OrganizationDetail)
        .catch(() => chunkFallido()),
  },
  {
    // La reserva de un cupo concreto (V41-09 → V41-05). La franja viaja por
    // query string porque la pantalla relee el cupo para revalidarlo.
    path: 'schedule/book/:slotId',
    title: `${APP_TITLE} - Reservar un turno`,
    data: { entrada: 'DESK' },
    loadComponent: () =>
      import('./features/agenda/booking-new/booking-new')
        .then((m) => m.BookingNew)
        .catch(() => chunkFallido()),
  },
  {
    // La MISMA pantalla de reserva, entrada del paciente: el turno queda a su
    // nombre y el canal que se guarda es `PORTAL`. Es una ruta aparte y no un
    // query param porque el destino del `routerLink` es lo que decide de qué
    // sección cuelga el breadcrumb.
    path: 'my-account/appointments/book/:slotId',
    title: `${APP_TITLE} - Pedir un turno`,
    data: { entrada: 'PORTAL' },
    loadComponent: () =>
      import('./features/agenda/booking-new/booking-new')
        .then((m) => m.BookingNew)
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
  return pantallaDeOperacion('administration/delegated-access', subpath, titulo, loader);
}

function pantallaDeProveedoresDeIdentidad(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administration/identity-providers', subpath, titulo, loader);
}

function pantallaDeVerificacionIdentidad(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administration/identity-assurance', subpath, titulo, loader);
}

function pantallaDeContextoSanitario(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administration/health-context', subpath, titulo, loader);
}

/**
 * La sección cuelga de `administration/` a propósito: `/geo` es un prefijo del
 * proxy y se compara por inicio de ruta, así que `geolocation` a nivel raíz se
 * iría entera a la API. Lo hace cumplir `scripts/check-route-prefixes.mjs`.
 */
function pantallaDeGeolocalizacion(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administration/geolocation', subpath, titulo, loader);
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

/* ============================================================================
    Las direcciones viejas, en castellano.

    El router pasó a inglés (2026-08-11) y una dirección no es un identificador
    interno: está en los favoritos de alguien, en un correo ya enviado y en el
    historial del navegador. Borrarla sin más convierte todo eso en un 404.

    Se redirigen **las raíces de sección y las landings públicas**, que es donde
    viven los enlaces que salieron del producto. Las sub-rutas de los paneles de
    operación no: se llega a ellas desde su panel, no desde un favorito.

    El router **conserva el query string** al redirigir, y de eso depende que
    `/auth/verificar?token=…` —el enlace del correo de verificación— siga
    funcionando. Es la razón principal de que esta tabla exista.

    Retirada: cuando deje de haber tráfico en estas rutas. Están catalogadas en
    `docs/routes/route-catalog.md` con esa nota.
    ========================================================================== */

/** Dirección vieja → dirección nueva. Absolutas para no depender del padre. */
const RUTAS_HEREDADAS: Readonly<Record<string, string>> = {
  panel: '/dashboard',
  agenda: '/schedule',
  clinico: '/medical-records',
  facturacion: '/billing',
  'mi-cuenta': '/my-account',
  'mi-cuenta/turnos': '/my-account/appointments',
  'identidad/verificar': '/my-account/identity/verify',
  'identidad/casos': '/my-account/identity/cases',
  'administracion/pacientes': '/administration/patients',
  'administracion/usuarios': '/administration/users',
  'administracion/organizaciones': '/administration/organizations',
  'administracion/acceso-delegado': '/administration/delegated-access',
  'administracion/proveedores-identidad': '/administration/identity-providers',
  'administracion/verificacion-identidad': '/administration/identity-assurance',
  'administracion/terminologia': '/administration/terminology',
};

/** Las landings públicas, que son las que viajan en los correos. */
const RUTAS_HEREDADAS_PUBLICAS: Readonly<Record<string, string>> = {
  'auth/organizacion': '/auth/organization',
  'auth/registro': '/auth/register',
  'auth/verificar': '/auth/verify-email',
  'auth/recuperar': '/auth/forgot-password',
  'auth/nueva-clave': '/auth/reset-password',
  'auth/activar': '/auth/activate',
  'auth/reenviar-verificacion': '/auth/resend-verification',
};

/**
 * `pathMatch: 'full'` en las dos tablas: sin él, `administracion/pacientes`
 * capturaría también `administracion/pacientes/<id>` y lo mandaría al listado,
 * perdiendo el identificador en silencio — que es peor que el 404.
 */
function rutasHeredadas(mapa: Readonly<Record<string, string>>): Routes {
  return Object.entries(mapa).map(([vieja, nueva]) => ({
    path: vieja,
    pathMatch: 'full' as const,
    redirectTo: nueva,
  }));
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
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      ...rutasDeSecciones(),
      ...PANTALLAS_HIJAS,
      pantallaDeAccesoDelegado('delegations/new', 'Nueva delegación', () =>
        import(
          './features/delegated-access/practitioner-delegate-form/practitioner-delegate-form'
        ).then((m) => m.PractitionerDelegateForm),
      ),
      pantallaDeAccesoDelegado('delegations/revoke', 'Revocar delegación', () =>
        import('./features/delegated-access/delegation-revocation/delegation-revocation').then(
          (m) => m.DelegationRevocation,
        ),
      ),
      pantallaDeAccesoDelegado('delegations/requests/new', 'Solicitar acceso delegado', () =>
        import('./features/delegated-access/access-request-form/access-request-form').then(
          (m) => m.AccessRequestForm,
        ),
      ),
      pantallaDeAccesoDelegado('delegations/grants/new', 'Otorgar concesión', () =>
        import('./features/delegated-access/grant-form/grant-form').then((m) => m.GrantForm),
      ),
      pantallaDeAccesoDelegado('assignments/new', 'Asignar usuario de organización', () =>
        import('./features/delegated-access/org-assignment-form/org-assignment-form').then(
          (m) => m.OrgAssignmentForm,
        ),
      ),
      pantallaDeAccesoDelegado('assignments/edit', 'Reasignar o suspender asignación', () =>
        import('./features/delegated-access/org-assignment-update/org-assignment-update').then(
          (m) => m.OrgAssignmentUpdate,
        ),
      ),
      pantallaDeAccesoDelegado('requests/resolve', 'Resolver solicitud de acceso', () =>
        import(
          './features/delegated-access/access-request-resolution/access-request-resolution'
        ).then((m) => m.AccessRequestResolution),
      ),
      pantallaDeAccesoDelegado('permission-sets/new', 'Publicar set de permisos', () =>
        import('./features/delegated-access/permission-set-form/permission-set-form').then(
          (m) => m.PermissionSetForm,
        ),
      ),
      pantallaDeAccesoDelegado('permission-sets/new-version', 'Versionar set de permisos', () =>
        import('./features/delegated-access/set-version-form/set-version-form').then(
          (m) => m.SetVersionForm,
        ),
      ),
      pantallaDeAccesoDelegado('operations/evaluate-actor', 'Evaluar actor efectivo', () =>
        import('./features/delegated-access/actor-evaluation/actor-evaluation').then(
          (m) => m.ActorEvaluation,
        ),
      ),
      pantallaDeAccesoDelegado('operations/expiry-sweep', 'Barrido de expiración', () =>
        import('./features/delegated-access/expiry-sweep/expiry-sweep').then((m) => m.ExpirySweep),
      ),
      pantallaDeProveedoresDeIdentidad('providers/new', 'Registrar proveedor de identidad', () =>
        import('./features/auth-providers/provider-form/provider-form').then(
          (m) => m.ProviderForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'providers/protocol',
        'Configurar protocolo del proveedor',
        () =>
          import('./features/auth-providers/protocol-config-form/protocol-config-form').then(
            (m) => m.ProtocolConfigForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('providers/attribute-mappings', 'Fijar mapeo de atributos', () =>
        import('./features/auth-providers/attribute-mappings-form/attribute-mappings-form').then(
          (m) => m.AttributeMappingsForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'providers/provisioning-rule',
        'Definir regla de aprovisionamiento',
        () =>
          import('./features/auth-providers/provisioning-rule-form/provisioning-rule-form').then(
            (m) => m.ProvisioningRuleForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('keys/new', 'Publicar clave de firma', () =>
        import('./features/auth-providers/signing-key-form/signing-key-form').then(
          (m) => m.SigningKeyForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('keys/rotate', 'Rotar clave de firma', () =>
        import('./features/auth-providers/key-rotation-form/key-rotation-form').then(
          (m) => m.KeyRotationForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'organizations/link',
        'Vincular proveedor a una organización',
        () =>
          import('./features/auth-providers/tenant-binding-form/tenant-binding-form').then(
            (m) => m.TenantBindingForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad('login/start', 'Iniciar login federado', () =>
        import('./features/auth-providers/login-start-form/login-start-form').then(
          (m) => m.LoginStartForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('login/callback', 'Procesar callback del proveedor', () =>
        import('./features/auth-providers/login-callback-form/login-callback-form').then(
          (m) => m.LoginCallbackForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('accounts/link', 'Solicitar vinculación de cuenta', () =>
        import('./features/auth-providers/account-link-request-form/account-link-request-form').then(
          (m) => m.AccountLinkRequestForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'accounts/complete',
        'Completar vinculación de cuenta',
        () =>
          import(
            './features/auth-providers/account-link-complete-form/account-link-complete-form'
          ).then((m) => m.AccountLinkCompleteForm),
      ),
      pantallaDeProveedoresDeIdentidad(
        'accounts/unlink',
        'Desvincular identidad federada',
        () =>
          import('./features/auth-providers/identity-unlink-form/identity-unlink-form').then(
            (m) => m.IdentityUnlinkForm,
          ),
      ),
      pantallaDeVerificacionIdentidad('authorities/new', 'Registrar autoridad de identidad', () =>
        import('./features/identity-assurance/authority-form/authority-form').then(
          (m) => m.AuthorityForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('authorities/endpoint', 'Publicar endpoint de autoridad', () =>
        import(
          './features/identity-assurance/authority-endpoint-form/authority-endpoint-form'
        ).then((m) => m.AuthorityEndpointForm),
      ),
      pantallaDeVerificacionIdentidad('policies/new', 'Crear política de verificación', () =>
        import(
          './features/identity-assurance/verification-policy-form/verification-policy-form'
        ).then((m) => m.VerificationPolicyForm),
      ),
      // La cola va primero: es la lectura desde la que se llega a las demás.
      pantallaDeVerificacionIdentidad('queue', 'Cola de revisión de identidad', () =>
        import('./features/identity-assurance/case-queue/case-queue').then((m) => m.CaseQueue),
      ),
      pantallaDeVerificacionIdentidad('cases/new', 'Abrir caso de verificación', () =>
        import('./features/identity-assurance/case-open-form/case-open-form').then(
          (m) => m.CaseOpenForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('cases/evidence', 'Aportar evidencia a un caso', () =>
        import('./features/identity-assurance/case-evidence-form/case-evidence-form').then(
          (m) => m.CaseEvidenceForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('cases/checks', 'Planificar checks del caso', () =>
        import('./features/identity-assurance/check-plan-form/check-plan-form').then(
          (m) => m.CheckPlanForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('cases/expire-sweep', 'Barrer casos vencidos', () =>
        import('./features/identity-assurance/case-expire-sweep/case-expire-sweep').then(
          (m) => m.CaseExpireSweep,
        ),
      ),
      pantallaDeVerificacionIdentidad(
        'checks/attempt',
        'Registrar intento contra la autoridad',
        () =>
          import('./features/identity-assurance/check-attempt-form/check-attempt-form').then(
            (m) => m.CheckAttemptForm,
          ),
      ),
      pantallaDeVerificacionIdentidad('checks/result', 'Registrar resultado del check', () =>
        import('./features/identity-assurance/check-result-form/check-result-form').then(
          (m) => m.CheckResultForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('checks/fraud-signal', 'Registrar señal de fraude', () =>
        import('./features/identity-assurance/fraud-signal-form/fraud-signal-form').then(
          (m) => m.FraudSignalForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('review/escalate', 'Escalar a revisión manual', () =>
        import('./features/identity-assurance/manual-review-form/manual-review-form').then(
          (m) => m.ManualReviewForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('review/decision', 'Decidir revisión manual', () =>
        import('./features/identity-assurance/review-decision-form/review-decision-form').then(
          (m) => m.ReviewDecisionForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('assertions/issue', 'Emitir aserción', () =>
        import('./features/identity-assurance/assertion-issue-form/assertion-issue-form').then(
          (m) => m.AssertionIssueForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('assertions/revoke', 'Revocar aserción', () =>
        import('./features/identity-assurance/assertion-revoke-form/assertion-revoke-form').then(
          (m) => m.AssertionRevokeForm,
        ),
      ),
      // La única lectura del M44: resolver el contexto vigente.
      pantallaDeContextoSanitario('contexts/resolve', 'Contexto vigente', () =>
        import('./features/health-context/context-resolve/context-resolve').then(
          (m) => m.ContextResolve,
        ),
      ),
      pantallaDeContextoSanitario('contexts/new', 'Nuevo contexto de país', () =>
        import('./features/health-context/context-form/context-form').then((m) => m.ContextForm),
      ),
      pantallaDeContextoSanitario('agents/new', 'Nuevo agente', () =>
        import('./features/health-context/agent-form/agent-form').then((m) => m.AgentForm),
      ),
      pantallaDeContextoSanitario('sources/new', 'Nueva fuente', () =>
        import('./features/health-context/source-form/source-form').then((m) => m.SourceForm),
      ),
      pantallaDeContextoSanitario('schedules/new', 'Nueva agenda de recolección', () =>
        import('./features/health-context/schedule-form/schedule-form').then(
          (m) => m.ScheduleForm,
        ),
      ),
      pantallaDeContextoSanitario('collection-runs/new', 'Iniciar corrida', () =>
        import('./features/health-context/collection-run-form/collection-run-form').then(
          (m) => m.CollectionRunForm,
        ),
      ),
      pantallaDeContextoSanitario('observations/new', 'Registrar observación', () =>
        import('./features/health-context/observation-form/observation-form').then(
          (m) => m.ObservationForm,
        ),
      ),
      pantallaDeContextoSanitario('versions/new', 'Redactar versión', () =>
        import('./features/health-context/version-form/version-form').then((m) => m.VersionForm),
      ),
      pantallaDeContextoSanitario('quality-reviews/new', 'Registrar revisión de calidad', () =>
        import('./features/health-context/quality-review-form/quality-review-form').then(
          (m) => m.QualityReviewForm,
        ),
      ),
      pantallaDeContextoSanitario('versions/publish', 'Publicar versión', () =>
        import('./features/health-context/version-publish/version-publish').then(
          (m) => m.VersionPublish,
        ),
      ),
      pantallaDeContextoSanitario('versions/supersede', 'Retirar versión', () =>
        import('./features/health-context/version-supersede/version-supersede').then(
          (m) => m.VersionSupersede,
        ),
      ),
      pantallaDeContextoSanitario('collection-runs/finish', 'Cerrar corrida', () =>
        import('./features/health-context/collection-run-finish/collection-run-finish').then(
          (m) => m.CollectionRunFinish,
        ),
      ),
      pantallaDeGeolocalizacion('subjects/new', 'Nuevo sujeto rastreado', () =>
        import('./features/geo/tracked-subject-form/tracked-subject-form').then(
          (m) => m.TrackedSubjectForm,
        ),
      ),
      pantallaDeGeolocalizacion('sessions/new', 'Abrir sesión de rastreo', () =>
        import('./features/geo/tracking-session-form/tracking-session-form').then(
          (m) => m.TrackingSessionForm,
        ),
      ),
      pantallaDeGeolocalizacion('trips/new', 'Iniciar viaje', () =>
        import('./features/geo/trip-form/trip-form').then((m) => m.TripForm),
      ),
      pantallaDeGeolocalizacion('subjects/pings', 'Ingerir posiciones', () =>
        import('./features/geo/ping-ingest/ping-ingest').then((m) => m.PingIngest),
      ),
      pantallaDeGeolocalizacion('geofences/new', 'Nueva geocerca', () =>
        import('./features/geo/geofence-form/geofence-form').then((m) => m.GeofenceForm),
      ),
      pantallaDeGeolocalizacion('geofence-events/new', 'Registrar cruce de geocerca', () =>
        import('./features/geo/geofence-event-form/geofence-event-form').then(
          (m) => m.GeofenceEventForm,
        ),
      ),
      pantallaDeGeolocalizacion('subjects/revoke-consent', 'Revocar consentimiento', () =>
        import('./features/geo/consent-revocation/consent-revocation').then(
          (m) => m.ConsentRevocation,
        ),
      ),
      pantallaDeGeolocalizacion('sessions/close', 'Cerrar sesión de rastreo', () =>
        import('./features/geo/tracking-session-close/tracking-session-close').then(
          (m) => m.TrackingSessionClose,
        ),
      ),
      pantallaDeGeolocalizacion('trips/close', 'Cerrar viaje', () =>
        import('./features/geo/trip-close/trip-close').then((m) => m.TripClose),
      ),
      // La única lectura del M13. Dos rutas, el mismo componente: sin parámetro
      // la pantalla pide el identificador; con él, consulta — y así el enlace a
      // una posición concreta se puede compartir. Precedente: `booking-new`.
      pantallaDeGeolocalizacion('subjects/last-position', 'Última posición', () =>
        import('./features/geo/last-position/last-position').then((m) => m.LastPosition),
      ),
      pantallaDeGeolocalizacion(
        'subjects/last-position/:trackedSubjectId',
        'Última posición',
        () => import('./features/geo/last-position/last-position').then((m) => m.LastPosition),
      ),
      // Las direcciones viejas van **últimas**, después de toda pantalla real.
      // Hoy no podrían tapar a ninguna —son textos distintos y van con
      // `pathMatch: 'full'`—, pero el día que una ruta nueva se llame como una
      // vieja, gana la que pinta algo. Es más barato ordenarlas que acordarse.
      ...rutasHeredadas(RUTAS_HEREDADAS),
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
    path: 'auth/organization',
    component: TenantSelection,
    title: 'Mantra Core Health - Elegí tu organización',
  },
  {
    path: 'auth/register',
    component: RegisterPatient,
    title: 'Mantra Core Health - Crear cuenta',
  },
  {
    // El enlace del correo trae el token por query string: /auth/verificar?token=…
    path: 'auth/verify-email',
    component: VerifyEmail,
    title: 'Mantra Core Health - Verificar correo',
  },
  {
    path: 'auth/forgot-password',
    component: ForgotPassword,
    title: 'Mantra Core Health - Recuperar contraseña',
  },
  {
    // V01-08. El token puede venir por el enlace (`?token=…`) o escribirse a
    // mano: el alta asistida lo entrega en pantalla para que alguien lo pase
    // por teléfono o en papel, y obligar a armar una URL sería devolverle el
    // problema a quien menos herramientas tiene.
    path: 'auth/activate',
    component: ActivateAccount,
    title: 'Mantra Core Health - Activar cuenta',
  },
  {
    // V01-14.
    path: 'auth/resend-verification',
    component: ResendVerification,
    title: 'Mantra Core Health - Reenviar verificación',
  },
  {
    // También por query string: /auth/nueva-clave?token=…
    path: 'auth/reset-password',
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
  // Las landings públicas en castellano. Van **después** de las nuevas y antes
  // del comodín: si estuvieran primero, `auth/verificar` capturaría antes de
  // que el router llegue a `auth/verify-email`, que es la que pinta algo.
  ...rutasHeredadas(RUTAS_HEREDADAS_PUBLICAS),
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
