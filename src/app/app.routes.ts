import type { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { ShellLayout } from './features/shell-layout/shell-layout';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterPatient } from './features/auth/register-patient/register-patient';
import { RegisterOrganization } from './features/auth/register-organization/register-organization';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { ActivateAccount } from './features/auth/activate-account/activate-account';
import { ResendVerification } from './features/auth/resend-verification/resend-verification';
import { ErrorRecovery } from './features/error-recovery/error-recovery';
import { IdentityVerification } from './features/identity-verification/identity-verification';
import { NotFound } from './features/not-found/not-found';
import { REDSAT_ROUTES } from './features/redsat/redsat.routes';
import { perfilPublicoResolver } from './features/public-profile/public-profile.resolver';
import { authGuard } from './core/auth/auth.guard';
import { APP_SECTIONS } from './core/navigation/navigation.map';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import {
  APP_TITLE,
  ROLES_ROUTE_DATA,
  SECTION_ROUTE_DATA,
  titleOf,
  type AppSection,
} from './core/navigation/navigation.types';

/**
 * Los roles de quien atiende, para las hijas de «Mi perfil» que son sólo suyas.
 *
 * Es la misma pareja que declaran «Archivo clínico» y «Laboratorio e imagen» en
 * el registro (`navigation.map.ts`): la Guía es del paciente; configurar el
 * perfil profesional, la vitrina pública y los artículos médicos son de quien
 * atiende. Un paciente que escribía la dirección llegaba a una pantalla que le
 * hablaba de «las personas que atendí» (feedback de la analista, 18/08/2026).
 */
const ROLES_DE_QUIEN_ATIENDE: readonly string[] = ['CLINICIAN', 'PRACTITIONER'];

/** La declaración que cierra una hija de «Mi perfil» a quien atiende. */
function soloDeQuienAtiende(): Pick<Routes[number], 'canActivate' | 'data'> {
  return {
    canActivate: [seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: ROLES_DE_QUIEN_ATIENDE },
  };
}

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
  // Diferida: el muro no es la primera pantalla de nadie, y arrastra la tarjeta
  // de publicación con sus reacciones.
  //
  // Sigue existiendo aunque el menú ya no la ofrezca (carril R2-1): quien tenga
  // el enlace guardado llega igual. Borrarla es una decisión de producto que el
  // cliente no pidió — dijo «sacar del perfil de paciente», no «eliminar».
  feed: () => import('./features/feed/feed').then((m) => m.Feed),
  // Carril P1 · el centro de notificaciones. Diferido: la campana del header ya
  // resuelve el 90 % de los casos —enterarse y saltar— y esta pantalla sólo la
  // abre quien viene a revisar.
  'notification-center': () =>
    import('./features/notifications/notification-center').then((m) => m.NotificationCenter),
  // Carril P2 · la bandeja de mensajería. Diferida: no es la primera pantalla
  // de nadie y arrastra el buscador del directorio.
  messaging: () => import('./features/messaging/messaging').then((m) => m.Messaging),
  // El directorio de grupos (P7). Diferido como el muro: no es la primera
  // pantalla de nadie y arrastra la tarjeta de grupo con su alta.
  groups: () => import('./features/groups/groups').then((m) => m.Groups),
  // Carril P9 · las preferencias de aviso. Diferida: se abre una vez y se
  // olvida, que es exactamente lo que una pantalla de preferencias debería
  // conseguir.
  'my-account/notification-preferences': () =>
    import('./features/account/notification-preferences/notification-preferences').then(
      (m) => m.NotificationPreferences,
    ),
  // La guía que ocupó su lugar en el menú.
  directory: () =>
    import('./features/directory/practitioners-directory/practitioners-directory').then(
      (m) => m.PractitionersDirectory,
    ),
  'laboratory-directory': () =>
    import('./features/laboratory-directory/laboratory-directory').then(
      (m) => m.LaboratoryDirectory,
    ),
  schedule: () => import('./features/agenda/agenda').then((m) => m.Agenda),
  diagnostics: () => import('./features/diagnostics/diagnostics').then((m) => m.Diagnostics),
  interventions: () =>
    import('./features/interventions/interventions').then((m) => m.Interventions),
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
  // Carril 13: la consola de la organización médica. Diferida como el resto de
  // administración — sólo la alcanza quien administra, así que no tiene sentido
  // que la descargue todo el mundo al entrar.
  'administration/medical-organization': () =>
    import('./features/admin/medical-organization/medical-organization').then(
      (m) => m.MedicalOrganization,
    ),
  // TP-1: la organización mirándose a sí misma. Diferida por lo mismo que sus
  // hermanas de administración.
  'administration/my-organization': () =>
    import('./features/organization/organization-panel').then(
      (m) => m.OrganizationPanel,
    ),
  // Carril 16: la consola del laboratorio. Distinta de `laboratory-directory`,
  // que es la vitrina del paciente y sigue en pie sin cambios.
  'administration/medical-laboratory': () =>
    import('./features/admin/medical-laboratory/medical-laboratory').then(
      (m) => m.MedicalLaboratory,
    ),
  'administration/insurance': () =>
    import('./features/insurance/insurance-catalog/insurance-catalog').then(
      (m) => m.InsuranceCatalog,
    ),
  'administration/brokers': () =>
    import('./features/insurance/broker-directory/broker-directory').then((m) => m.BrokerDirectory),
  'administration/accounting': () =>
    import('./features/accounting/accounting').then((m) => m.Accounting),
  'administration/terminology': () =>
    import('./features/admin/terminology/terminology-catalog').then((m) => m.TerminologyCatalog),
  'administration/moderation': () =>
    import('./features/admin/moderation/moderation').then((m) => m.Moderation),
  tutorials: () => import('./features/tutorials/tutorials-center').then((m) => m.TutorialsCenter),
  'my-account': () => import('./features/account/my-profile/my-profile').then((m) => m.MyProfile),
  'my-account/appointments': () =>
    import('./features/account/appointments/appointments').then((m) => m.Appointments),
  'my-account/medical-record': () =>
    import('./features/account/medical-record/medical-record').then((m) => m.MedicalRecord),
  'my-account/diagnostic-results': () =>
    import('./features/account/diagnostic-results/diagnostic-results').then(
      (m) => m.DiagnosticResults,
    ),
  'my-account/diagnostic-orders': () =>
    import('./features/account/diagnostic-orders/diagnostic-orders').then(
      (m) => m.DiagnosticOrders,
    ),
  'my-account/pharmacy-orders': () =>
    import('./features/account/pharmacy-orders/pharmacy-orders').then((m) => m.PharmacyOrders),
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
  'administration/services-catalog': () =>
    import('./features/admin/services-catalog/services-catalog').then((m) => m.ServicesCatalog),
  'administration/clinical-forms': () =>
    import('./features/admin/clinical-forms/clinical-forms').then((m) => m.ClinicalForms),
  questionnaires: () =>
    import('./features/questionnaires/questionnaires').then((m) => m.SurveysHome),
  'my-account/questionnaires': () =>
    import('./features/account/questionnaires/questionnaires').then((m) => m.Questionnaires),
  glossary: () => import('./features/glossary/glossary').then((m) => m.Glossary),
  // Carril 17. Las tres pantallas van diferidas: cada una la alcanza un rol
  // distinto —el administrador del laboratorio, el visitador y el doctor— y
  // ninguna es el destino del login de nadie.
  'administration/pharma-lab': () =>
    import('./features/pharma-lab/pharma-lab-home/pharma-lab-home').then((m) => m.PharmaLabHome),
  'my-visits': () =>
    import('./features/pharma-lab/visitor-visits/visitor-visits').then((m) => m.VisitorVisits),
  'lab-visits': () =>
    import('./features/pharma-lab/doctor-visits/doctor-visits').then((m) => m.DoctorVisits),
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
 *
 * **El rol de la sección se hace cumplir también en la hija.** Una hija cuya
 * sección declara `roles` lleva `seccionRolesGuard` explícito, como las rutas
 * de sección: sin él, quien escribe la dirección a mano llega al formulario
 * aunque el listado del que cuelga lo rebote. Las tres excepciones —el alta
 * asistida, la ficha del corredor y la ficha de organización— dicen por qué en
 * su propio comentario: la API acepta ahí un rol que la sección no declara, y
 * el guard nunca niega lo que la API permite. `app.routes.spec.ts` fija la regla.
 */
const PANTALLAS_HIJAS: Routes = [
  {
    // Carril P2 · el hilo de una conversación. Cuelga de `messaging` y se llega
    // desde la bandeja o desde una notificación de la campana, no desde el
    // menú: es la ficha de una conversación concreta.
    //
    // Sin `seccionRolesGuard` explícito porque su sección no declara roles; el
    // backend comprueba que quien lee participe del hilo, que es la única
    // barrera que importa acá.
    path: 'messaging/:conversationId',
    title: `${APP_TITLE} - Conversación`,
    loadComponent: () =>
      import('./features/messaging/thread/thread')
        .then((m) => m.Thread)
        .catch(() => chunkFallido()),
  },
  {
    // El grupo por dentro (P7). El directorio es la sección `groups`, que el
    // registro declara; esto es la ficha a la que se llega desde una tarjeta,
    // y por eso vive acá y no en el menú.
    //
    // Con guard desde F-20 (18/08/2026): su sección pasó a declarar los roles
    // de quien ejerce o administra, y sin esto el enlace directo a un grupo
    // seguiría entrando aunque el directorio del que cuelga rebote.
    path: 'groups/:groupId',
    title: `${APP_TITLE} - Grupo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/groups/group-detail/group-detail')
        .then((m) => m.GroupDetail)
        .catch(() => chunkFallido()),
  },
  {
    // La ficha de una encuesta (carril 10): cuestionario, publicación y
    // respuestas. Se llega desde el listado, no desde el menú.
    path: 'questionnaires/:surveyId',
    title: `${APP_TITLE} - Encuesta`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/questionnaires/survey-detail/survey-detail')
        .then((m) => m.SurveyDetailScreen)
        .catch(() => chunkFallido()),
  },
  {
    // Responder un cuestionario concreto. Cuelga de «Mis cuestionarios».
    path: 'my-account/questionnaires/:invitationId',
    title: `${APP_TITLE} - Responder cuestionario`,
    loadComponent: () =>
      import('./features/account/questionnaires/answer/answer')
        .then((m) => m.QuestionnaireAnswer)
        .catch(() => chunkFallido()),
  },
  {
    // Dónde comprar una receta (carril E3). Cuelga de «Mi historia clínica»:
    // se llega desde el botón de cada receta, y la lectura pide el resumen
    // clínico propio — sin receta no hay nada que comprar.
    path: 'my-account/medical-record/where-to-buy/:requestId',
    title: `${APP_TITLE} - Dónde comprar mi receta`,
    loadComponent: () =>
      import('./features/account/medical-record/where-to-buy/where-to-buy')
        .then((m) => m.WhereToBuy)
        .catch(() => chunkFallido()),
  },
  {
    // La confirmación del pedido de farmacia (carril FAR-I2). Cuelga de «Mis
    // pedidos»; se llega desde «dónde comprar mi receta», que deja el borrador
    // en el cliente — nada viaja por la URL. Con `seccionRolesGuard` porque su
    // sección es la única de «Mi cuenta» que declara roles, y la regla de
    // `app.routes.spec.ts` exige cumplirlos también en la hija.
    path: 'my-account/pharmacy-orders/new',
    title: `${APP_TITLE} - Confirmá tu pedido`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/pharmacy-orders/new-order/new-order')
        .then((m) => m.NewOrder)
        .catch(() => chunkFallido()),
  },
  {
    // La ficha de un pedido concreto: línea de tiempo, decisión de sustitución
    // y código de retiro. `new` va declarada antes: el router prueba en orden
    // y el parámetro se la tragaría.
    path: 'my-account/pharmacy-orders/:orderId',
    title: `${APP_TITLE} - Pedido de farmacia`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/pharmacy-orders/order-detail/order-detail')
        .then((m) => m.OrderDetail)
        .catch(() => chunkFallido()),
  },
  {
    // El expediente de una persona concreta. Cuelga de «Archivo clínico», que
    // es la pantalla que elige a quién se mira: sin paciente no hay expediente,
    // y las dos lecturas del backend piden el perfil en la ruta.
    path: 'medical-records/:profileId',
    title: `${APP_TITLE} - Expediente clínico`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/clinical-record/patient-chart/patient-chart')
        .then((m) => m.PatientChart)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/new',
    title: `${APP_TITLE} - Nuevo paciente`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/patients/patient-new/patient-new')
        .then((m) => m.PatientNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/patients/merge',
    title: `${APP_TITLE} - Fusionar duplicados`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/patients/patient-merge/patient-merge')
        .then((m) => m.PatientMerge)
        .catch(() => chunkFallido()),
  },
  {
    // Estaba en la raíz de la sección; se corre acá para dejarle el lugar al
    // listado, que es la pantalla que el vault declara como principal de
    // V05-01. Cambia la ruta, no la pantalla.
    //
    // Sin guard de sección a propósito: `POST /iam/users/assisted-registration`
    // acepta también a `CLINICIAN`, que llega por su propio flujo y no es
    // `SECURITY_ADMIN`. El guard por sección lo dejaría afuera de un alta que
    // la API le permite.
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
    canActivate: [seccionRolesGuard],
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
    // La ficha de un profesional: el destino del clic en la guía (R2-1). No va
    // en el menú — se llega desde la guía, nunca desde el shell.
    path: 'directory/:profileId',
    title: `${APP_TITLE} - Perfil profesional`,
    // La ficha es parte de la Guía, así que hereda su restricción a paciente
    // (corrección #2). Se declara explícita y no por prefijo: ver el porqué en
    // `section-roles.guard.ts` — hay hijas cuyo rol legítimo no es el de su
    // sección, y cerrarlas todas por prefijo rompería flujos que nadie pidió
    // tocar.
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/directory/practitioner-detail/practitioner-detail')
        .then((m) => m.PractitionerDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'laboratory-directory/:unitId',
    title: `${APP_TITLE} - Perfil de laboratorio`,
    loadComponent: () =>
      import('./features/laboratory-directory/laboratory-detail/laboratory-detail')
        .then((m) => m.LaboratoryDetail)
        .catch(() => chunkFallido()),
  },
  {
    // La ficha de un corredor (C14): se llega desde el listado de brokers,
    // nunca desde el menú, así que no es una sección del registro.
    //
    // Sin guard de sección a propósito: `GET /insurance-brokers/:id` no exige
    // rol global por decisión escrita en la API (el administrador de la
    // aseguradora ve su propio catálogo sin ser `SECURITY_ADMIN`; el
    // aislamiento lo da el tenant). Cerrarla acá contradiría esa decisión.
    path: 'administration/brokers/:brokerId',
    title: `${APP_TITLE} - Perfil del corredor`,
    loadComponent: () =>
      import('./features/insurance/broker-detail/broker-detail')
        .then((m) => m.BrokerDetail)
        .catch(() => chunkFallido()),
  },
  {
    // Se cuelga de «Mi perfil»: se llega por el botón «Configurar mi perfil»,
    // nunca desde el menú. Y sólo la abre quien atiende: «Mi perfil» no
    // declara roles, así que la restricción va en la ruta.
    // TJ-1 · el alta del profesional. Se cuelga fuera de «Mi cuenta» porque no
    // es un dato que se consulta: es una tarea con principio y fin. Sólo la abre
    // quien atiende — a un paciente no le corresponde.
    path: 'onboarding',
    title: `${APP_TITLE} - Completá tu perfil`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('./features/onboarding-practitioner/onboarding-practitioner')
        .then((m) => m.OnboardingPractitioner)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/edit',
    title: `${APP_TITLE} - Configurar tu perfil`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('./features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit')
        .then((m) => m.PractitionerProfileEdit)
        .catch(() => chunkFallido()),
  },
  {
    // La vitrina pública: se configura y se ve en la misma pantalla.
    path: 'my-account/preview',
    title: `${APP_TITLE} - Tu perfil público`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('./features/account/my-profile/public-profile-preview/public-profile-preview')
        .then((m) => m.PublicProfilePreview)
        .catch(() => chunkFallido()),
  },
  {
    // Publicar, revisar lo publicado y sus comentarios. Cuelga de la vitrina:
    // sin vitrina, no hay dónde publicar un artículo.
    path: 'my-account/articles',
    title: `${APP_TITLE} - Artículos médicos`,
    ...soloDeQuienAtiende(),
    loadComponent: () =>
      import('./features/account/my-profile/medical-articles/medical-articles')
        .then((m) => m.MedicalArticles)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/new',
    title: `${APP_TITLE} - Nueva organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/organizations/organization-new/organization-new')
        .then((m) => m.OrganizationNew)
        .catch(() => chunkFallido()),
  },
  {
    // Ficha de una organización (V04-06·L, V04-02·L y V04-07·L): sus
    // sucursales, su plantilla y sus sub-organizaciones. Va DESPUÉS de
    // `/new`, o el literal se comería el parámetro.
    //
    // Sin guard de sección a propósito: sus tres lecturas
    // (`GET /tenants/:id/branches|memberships|child-tenants`) no declaran rol
    // en la API — cualquier sesión del tenant es legítima ahí — y el guard
    // nunca niega lo que la API permite. Si el equipo decide que la ficha es
    // sólo administrativa, la línea es una y el spec ya la contempla.
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
    // Es la entrada de mostrador: hereda el rol de la agenda. El paciente tiene
    // la suya propia justo abajo, sin guard, porque su sección no declara roles.
    canActivate: [seccionRolesGuard],
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
  {
    // La ficha de un término del glosario. Es ruta y no panel porque un término
    // se comparte: «mirá qué quiere decir esto» es un enlace, y un panel no
    // tiene enlace. Cuelga de `/glossary`, así que el rastro de migas y la
    // sección marcada en el menú siguen diciendo «Glosario» sin que haya que
    // tocar `navigation.map.ts`. Y hereda sus roles: un enlace compartido a un
    // término no le abre al paciente lo que el listado le cierra.
    path: 'glossary/:conceptId',
    title: `${APP_TITLE} - Término del glosario`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/glossary/glossary-term')
        .then((m) => m.GlossaryTerm)
        .catch(() => chunkFallido()),
  },
];

/**
 * Pantalla de operación de una sección sin listados (M29, M40): una acción de
 * la sección, no una entrada de menú. Como con las pantallas hijas, la sección
 * del breadcrumb la resuelve `NavigationService` por la coincidencia más larga.
 *
 * Lleva el guard de rol de su sección **siempre**: una pantalla de operación es
 * un formulario que la sección ofrece, y no tiene sentido que la sección rebote
 * a quien no tiene el rol mientras el formulario lo deja pasar. La sección se
 * resuelve por prefijo, así que el guard aplica los mismos `roles` que el menú
 * (`APP_SECTIONS`) sin repetirlos acá.
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
    canActivate: [seccionRolesGuard],
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
    // Los roles que el registro declara se hacen cumplir **también por ruta**
    // (carril 02). Filtrar el menú es cortesía; quien escribe la dirección a
    // mano llega igual, y la corrección #2 pide que la Guía de profesionales no
    // sea *accesible* para quien no es paciente, no sólo que no se vea.
    canActivate: [seccionRolesGuard],
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
  contabilidad: '/administration/accounting',
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

/**
 * Las cinco fichas públicas por slug, bajo el marco público del buscador.
 *
 * Se generan del mapa en vez de escribirse cinco veces porque las cinco son la
 * misma pantalla con otro tipo esperado: lo único que cambia es el prefijo y el
 * `kind`, y cinco bloques copiados serían cinco lugares donde arreglar el mismo
 * defecto.
 *
 * Diferidas: quien entra por el buscador no necesita este fragmento hasta que
 * abre una ficha, y quien llega directo de un enlace descarga sólo esto.
 */
function rutasDeFichasPublicas(): Routes {
  const TIPOS = [
    ['p', 'PRACTITIONER'],
    ['o', 'ORGANIZATION'],
    ['f', 'PHARMACY'],
    ['l', 'DIAGNOSTIC_UNIT'],
    ['s', 'INSURER'],
  ] as const;

  return TIPOS.map(([prefijo, kind]) => ({
    path: prefijo,
    loadComponent: () =>
      import('./features/redsat/shell/redsat-public-shell').then((m) => m.RedsatPublicShell),
    children: [
      {
        path: ':slug',
        data: { kind, pantallaReal: true },
        resolve: { perfil: perfilPublicoResolver },
        loadComponent: () =>
          import('./features/public-profile/public-profile').then((m) => m.PublicProfile),
      },
    ],
  }));
}

/**
 * Las rutas públicas del buscador, con las URL que la ficha V65 declara.
 *
 * ## Por qué existen además de las que genera el portador de vistas
 *
 * `scripts/port-vistas-redsat.mjs` deriva el segmento del **nombre del archivo
 * de la maqueta**, así que la portada quedó en `/buscar/buscador-listado` y los
 * verticales en `/buscar/…-listado`. Sirve para recorrer la bóveda; no sirve
 * como superficie pública. Estas URL son las que la ficha declara —`/buscar`,
 * `/buscar/profesionales`, `/buscar/mapa`—, las que se pegan en un mensaje y
 * las que un buscador indexa, y son cortas y estables porque un directorio
 * público las cambia una sola vez.
 *
 * ## Por qué van antes de `REDSAT_ROUTES` y no dentro
 *
 * Porque `redsat.routes.ts` es un **archivo generado**: escribirlas ahí las
 * borra la próxima vez que alguien porte una vista. Declaradas acá conviven
 * con el bloque generado —el router prueba estas primero y retrocede al
 * siguiente `buscar` cuando el segmento no coincide—, así que los enlaces de
 * la bóveda que todavía apuntan a `/buscar/buscador-listado` siguen abriendo.
 * Hay una prueba que resuelve las dos formas y falla si eso deja de ser cierto.
 */
function rutasDeBusquedaPublica(): Routes {
  return [
    {
      path: 'buscar',
      loadComponent: () =>
        import('./features/redsat/shell/redsat-public-shell').then((m) => m.RedsatPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Buscar en AloVida — profesionales, medicamentos y centros de salud',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/buscador-listado/buscador-listado').then(
              (m) => m.BuscarBuscadorListado,
            ),
        },
        {
          path: 'profesionales',
          title: 'Profesionales de salud — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/profesionales-listado/profesionales-listado').then(
              (m) => m.BuscarProfesionalesListado,
            ),
        },
        {
          path: 'medicamentos',
          title: 'Medicamentos y farmacias — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/medicamentos-listado/medicamentos-listado').then(
              (m) => m.BuscarMedicamentosListado,
            ),
        },
        {
          path: 'hospitales',
          title: 'Hospitales y clínicas — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/hospitales-listado/hospitales-listado').then(
              (m) => m.BuscarHospitalesListado,
            ),
        },
        {
          path: 'diagnostico',
          title: 'Laboratorios e imagen — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/laboratorios-listado/laboratorios-listado').then(
              (m) => m.BuscarLaboratoriosListado,
            ),
        },
        {
          path: 'aseguradoras',
          title: 'Aseguradoras y convenios — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/aseguradoras-listado/aseguradoras-listado').then(
              (m) => m.BuscarAseguradorasListado,
            ),
        },
        {
          // V65-12. `mapa` y no `cercania`: es el rótulo de la pestaña y el
          // que la ficha declara.
          path: 'mapa',
          title: 'Cerca mío — AloVida',
          data: { arquetipo: 'detalle', pantallaReal: true },
          loadComponent: () =>
            import('./features/redsat/buscar/cercania-detalle/cercania-detalle').then(
              (m) => m.BuscarCercaniaDetalle,
            ),
        },
      ],
    },
  ];
}

export const routes: Routes = [
  // La superficie pública del buscador con sus URL limpias. Va **antes** del
  // bloque generado: las dos declaran `buscar`, y la primera que coincide gana.
  ...rutasDeBusquedaPublica(),
  // Las pantallas portadas desde la bóveda, con su propio marco REDSAT. Van
  // primero y con segmento propio: no compiten con el armazón de abajo, que
  // vive en `path: ''`, así que ninguna de las dos depende de que el router
  // retroceda para encontrar a la otra.
  ...REDSAT_ROUTES,
  // Las fichas públicas por slug. Van con el marco público y **sin guard**:
  // son la superficie anónima, y el enlace que alguien pega en un mensaje.
  //
  // Los cinco prefijos son cortos por diseño —`/p/`, `/o/`, `/f/`, `/l/`,
  // `/s/`— y cada uno promete un tipo de sujeto: la ruta lo declara en `data`
  // y el cliente lo traduce al prefijo de la API, que devuelve 404 si el slug
  // es de otra clase en vez de redirigir.
  ...rutasDeFichasPublicas(),
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
      {
        // El muro profesional, **sin entrada de menú**.
        //
        // El carril R2-1 sacó el ítem del menú del paciente porque el cliente
        // pidió reemplazarlo por la guía de doctores, y su comentario en
        // `navigation.map.ts` dice que «el muro NO se borró: `features/feed/`
        // sigue en pie y su ruta también». Lo segundo no era cierto: las rutas
        // se construyen desde `APP_SECTIONS`, así que al salir del registro la
        // ruta salió con él. El cargador diferido quedó declarado y sin nada que
        // lo alcance — la pantalla existía y no se podía abrir.
        //
        // Se declara acá y no en `APP_SECTIONS` justamente para respetar la
        // decisión de producto: sin ítem de menú, pero alcanzable por enlace
        // directo, que es lo que el comentario decía que pasaba.
        path: 'feed',
        title: 'Muro profesional',
        loadComponent: () => import('./features/feed/feed').then((m) => m.Feed),
      },
      // Alta de agenda por fases (UC-41-01 → UC-41-04). Cuelga de la sección
      // `schedule`: se llega desde la propia agenda, no desde el menú, igual que
      // las demás pantallas de operación. La autoridad sigue siendo el backend
      // (`SCHEDULING_ADMIN`); el guard de la sección sólo evita ofrecer la
      // pantalla a quien la API igual negaría.
      pantallaDeOperacion('schedule', 'new', 'Publicar mi agenda', () =>
        import('./features/agenda/agenda-create/agenda-create').then((m) => m.AgendaCreate),
      ),
      // «Mi agenda» (MAC-4): el horario publicado, en palabras. Es la primera
      // pantalla donde un médico ve lo que publicó — hasta que existió el GET
      // de plantillas, no había forma de volver a leerlo.
      pantallaDeOperacion('schedule', 'mine', 'Mi agenda', () =>
        import('./features/agenda/my-agenda/my-agenda').then((m) => m.MyAgenda),
      ),
      pantallaDeAccesoDelegado('delegations/new', 'Nueva delegación', () =>
        import('./features/delegated-access/practitioner-delegate-form/practitioner-delegate-form').then(
          (m) => m.PractitionerDelegateForm,
        ),
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
        import('./features/delegated-access/access-request-resolution/access-request-resolution').then(
          (m) => m.AccessRequestResolution,
        ),
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
        import('./features/auth-providers/provider-form/provider-form').then((m) => m.ProviderForm),
      ),
      pantallaDeProveedoresDeIdentidad(
        'providers/protocol',
        'Configurar protocolo del proveedor',
        () =>
          import('./features/auth-providers/protocol-config-form/protocol-config-form').then(
            (m) => m.ProtocolConfigForm,
          ),
      ),
      pantallaDeProveedoresDeIdentidad(
        'providers/attribute-mappings',
        'Fijar mapeo de atributos',
        () =>
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
      pantallaDeProveedoresDeIdentidad('accounts/complete', 'Completar vinculación de cuenta', () =>
        import('./features/auth-providers/account-link-complete-form/account-link-complete-form').then(
          (m) => m.AccountLinkCompleteForm,
        ),
      ),
      pantallaDeProveedoresDeIdentidad('accounts/unlink', 'Desvincular identidad federada', () =>
        import('./features/auth-providers/identity-unlink-form/identity-unlink-form').then(
          (m) => m.IdentityUnlinkForm,
        ),
      ),
      pantallaDeVerificacionIdentidad('authorities/new', 'Registrar autoridad de identidad', () =>
        import('./features/identity-assurance/authority-form/authority-form').then(
          (m) => m.AuthorityForm,
        ),
      ),
      pantallaDeVerificacionIdentidad(
        'authorities/endpoint',
        'Publicar endpoint de autoridad',
        () =>
          import('./features/identity-assurance/authority-endpoint-form/authority-endpoint-form').then(
            (m) => m.AuthorityEndpointForm,
          ),
      ),
      pantallaDeVerificacionIdentidad('policies/new', 'Crear política de verificación', () =>
        import('./features/identity-assurance/verification-policy-form/verification-policy-form').then(
          (m) => m.VerificationPolicyForm,
        ),
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
        import('./features/health-context/schedule-form/schedule-form').then((m) => m.ScheduleForm),
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
      pantallaDeGeolocalizacion('subjects/last-position/:trackedSubjectId', 'Última posición', () =>
        import('./features/geo/last-position/last-position').then((m) => m.LastPosition),
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
    title: 'AloVida - Vitrina de Diseño',
  },
  {
    path: 'auth',
    component: Login,
    pathMatch: 'full',
    title: 'AloVida - Iniciar sesión',
  },
  {
    // La ruta la fija `TENANT_SELECTION_ROUTE`, que es a donde manda el guard.
    path: 'auth/organization',
    component: TenantSelection,
    title: 'AloVida - Elegí tu organización',
  },
  {
    path: 'auth/register',
    component: RegisterPatient,
    title: 'AloVida - Crear cuenta',
  },
  {
    // Signup público de una organización aseguradora: crea el tenant `PAYER`
    // y su usuario owner en la misma operación.
    path: 'auth/register-organization',
    component: RegisterOrganization,
    title: 'AloVida - Registrar aseguradora',
  },
  {
    // El enlace del correo trae el token por query string: /auth/verificar?token=…
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
    // V01-08. El token puede venir por el enlace (`?token=…`) o escribirse a
    // mano: el alta asistida lo entrega en pantalla para que alguien lo pase
    // por teléfono o en papel, y obligar a armar una URL sería devolverle el
    // problema a quien menos herramientas tiene.
    path: 'auth/activate',
    component: ActivateAccount,
    title: 'AloVida - Activar cuenta',
  },
  {
    // V01-14.
    path: 'auth/resend-verification',
    component: ResendVerification,
    title: 'AloVida - Reenviar verificación',
  },
  {
    // También por query string: /auth/nueva-clave?token=…
    path: 'auth/reset-password',
    component: ResetPassword,
    title: 'AloVida - Nueva contraseña',
  },
  {
    // Pantalla de recuperación: a donde llega un fragmento que no bajó.
    // No lleva `title` propio para no anunciar «error» en la pestaña de
    // alguien que quizá solo necesita recargar.
    path: 'error',
    component: ErrorRecovery,
    title: 'AloVida',
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
    title: 'AloVida - Página no encontrada',
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
