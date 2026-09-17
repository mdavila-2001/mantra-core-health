import type { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { ShellLayout } from './features/shell-layout/shell-layout';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterAccountType } from './features/auth/register-account-type/register-account-type';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { ActivateAccount } from './features/auth/activate-account/activate-account';
import { ResendVerification } from './features/auth/resend-verification/resend-verification';
import { ErrorRecovery } from './features/error-recovery/error-recovery';
import { NotFound } from './features/not-found/not-found';
import { ALOVIDA_ROUTES } from './features/alovida/alovida.routes';
import { perfilPublicoResolver } from './features/public-profile/public-profile.resolver';
import { environment } from '../environments/environment';
import { authGuard, homeGuard } from './core/auth/auth.guard';
import {
  APP_SECTIONS,
  ROLES_DE_QUIEN_ATIENDE,
} from './core/navigation/navigation.map';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import {
  APP_TITLE,
  ROLES_ROUTE_DATA,
  SECTION_ROUTE_DATA,
  titleOf,
  type AppSection,
} from './core/navigation/navigation.types';

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
  settings: () => import('./features/settings/settings').then((m) => m.Settings),
  // FT-18-R01/R02 · la portada de los cuatro directorios.
  directories: () =>
    import('./features/directories-overview/directories-overview').then(
      (m) => m.DirectoriesOverview,
    ),
  // La guía que ocupó su lugar en el menú.
  directory: () =>
    import('./features/directory/practitioners-directory/practitioners-directory').then(
      (m) => m.PractitionersDirectory,
    ),
  // FT-19 · farmacias, imagenología y centros médicos cerca del paciente.
  'nearby-places': () =>
    import('./features/nearby-places/nearby-places').then((m) => m.NearbyPlaces),
  'laboratory-directory': () =>
    import('./features/laboratory-directory/laboratory-directory').then(
      (m) => m.LaboratoryDirectory,
    ),
  // A5 y A6 del plan de UX · los dos hermanos que faltaban. Diferidos como el
  // resto de los directorios: no son la primera pantalla de nadie.
  'clinics-directory': () =>
    import('./features/public-directories/clinics-directory').then((m) => m.ClinicsDirectory),
  'pharmacies-directory': () =>
    import('./features/public-directories/pharmacies-directory').then(
      (m) => m.PharmaciesDirectory,
    ),
  // §4.H del plan de UX · las dos pantallas nuevas del panel del médico.
  // Diferidas como el resto: sólo las alcanza quien atiende, y el presupuesto
  // del bundle inicial está al límite —cargarlas de entrada lo pasaba por 4 kB
  // y le costaba la descarga a todo el mundo, paciente incluido—.
  'progress-notes': () =>
    import('./features/progress-notes/progress-notes').then((m) => m.ProgressNotes),
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
  'administration/insurance-claims': () =>
    import('./features/insurance/insurance-claims/insurance-claims').then(
      (m) => m.InsuranceClaims,
    ),
  'administration/insurance-analytics': () =>
    import('./features/insurance/insurance-analytics/insurance-analytics').then(
      (m) => m.InsuranceAnalytics,
    ),
  // Contabilidad abre en el **cockpit**: el estado del ejercicio, los documentos
  // frenados y la cartera. Los libros —balance, diario y el registro de
  // movimientos— viven en `administration/accounting/libros`, a un clic. El
  // orden es el que pidió el propietario el 2026-09-12: primero cómo va el
  // ejercicio, después el renglón por renglón.
  'administration/accounting': () =>
    import('./features/accounting/cockpit/cockpit').then((m) => m.Cockpit),
  // FT-26 · activos y pasivos, en auto-servicio del doctor.
  'assets-liabilities': () =>
    import('./features/assets-liabilities/assets-liabilities').then(
      (m) => m.AssetsLiabilities,
    ),
  'my-organizations': () =>
    import('./features/organizations/my-organizations').then((m) => m.MyOrganizations),
  'administration/terminology': () =>
    import('./features/admin/terminology/terminology-catalog').then((m) => m.TerminologyCatalog),
  'administration/content-packs': () =>
    import('./features/admin/content-packs/content-packs').then((m) => m.ContentPacks),
  'administration/moderation': () =>
    import('./features/admin/moderation/moderation').then((m) => m.Moderation),
  tutorials: () => import('./features/tutorials/tutorials-center').then((m) => m.TutorialsCenter),
  'my-account': () => import('./features/account/my-profile/my-profile').then((m) => m.MyProfile),
  'my-account/dependents': () =>
    import('./features/account/dependents/dependents').then((m) => m.Dependents),
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
  'my-account/loyalty': () =>
    import('./features/account/loyalty/loyalty').then((m) => m.Loyalty),
  'my-account/promotions': () =>
    import('./features/account/promotions/promotions').then((m) => m.Promotions),
  'administration/pharmacy-orders': () =>
    import('./features/organization/pharmacy-inbox/pharmacy-inbox').then(
      (m) => m.PharmacyInbox,
    ),
  // FAR-I7: las campañas de la farmacia. Ruta hermana de la bandeja y no una
  // sección dentro del panel de organización, por el mismo motivo que aquélla:
  // el panel es de TP-1 y así no se le toca una línea.
  // **La verificación de identidad dejó de ir directa** (2026-09-10). Iba, y el
  // motivo era bueno mientras la ruta apuntaba a una pantalla sola: es la salida
  // del 403 `IDENTITY_VERIFICATION_REQUIRED`, y diferirla agrega una descarga
  // donde alguien ya está esperando.
  //
  // Al unificarla con «Mis trámites» dejó de ser una pantalla y pasó a ser un
  // centro con pestañas, y con él entraron al paquete inicial las pestañas y la
  // tarjeta. El bundle quedó **9 kB por encima del techo de `angular.json`** y el
  // build pasó a fallar. El reparto correcto cambió con el tamaño: la descarga
  // la paga una vez quien cae en un 403 —un camino de error, ya interrumpido— en
  // vez de pagarla **toda** primera visita a la aplicación.
  'my-account/identity': () =>
    import('./features/identity-verification/identity-hub/identity-hub').then(
      (m) => m.IdentityHub,
    ),
  'administration/my-practice': () =>
    import('./features/practice/my-practice/my-practice').then((m) => m.MyPractice),
  'administration/pharmacy-campaigns': () =>
    import('./features/organization/pharmacy-campaigns/pharmacy-campaigns').then(
      (m) => m.PharmacyCampaigns,
    ),
  // La ficha legal de la farmacia. Ruta hermana de las dos de arriba y no una
  // sección del panel de organización, por el mismo motivo: el panel es de
  // TP-1 y así no se le toca una línea. Diferida: arrastra el mapa.
  'administration/pharmacy-profile': () =>
    import('./features/organization/pharmacy-profile/pharmacy-profile').then(
      (m) => m.PharmacyProfile,
    ),
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
  // La lectura del mismo catálogo, para quien atiende. Diferida: se consulta
  // antes de cotizar, no al entrar, así que no es la primera pantalla de nadie.
  'my-services': () => import('./features/my-services/my-services').then((m) => m.MyServices),
  // FT-24. El listado de cotizaciones armadas sobre ese mismo catálogo.
  // Diferida como el resto: no es la primera pantalla de nadie.
  'my-quotations': () =>
    import('./features/quotations/quotation-list/quotation-list').then((m) => m.QuotationList),
  'administration/clinical-forms': () =>
    import('./features/admin/clinical-forms/clinical-forms').then((m) => m.ClinicalForms),
  questionnaires: () =>
    import('./features/questionnaires/questionnaires').then((m) => m.SurveysHome),
  'my-account/questionnaires': () =>
    import('./features/account/questionnaires/questionnaires').then((m) => m.Questionnaires),
  glossary: () => import('./features/glossary/glossary').then((m) => m.Glossary),
  // El generador de formularios del doctor. Diferido: no es el destino del
  // login de nadie y arrastra el motor de formularios por partes para la vista
  // previa. La ruta **no puede llamarse `forms`** — es prefijo del proxy hacia
  // la API y lo verifica `check-route-prefixes.mjs`.
  'form-builder': () =>
    import('./features/form-builder/form-builder').then((m) => m.FormBuilder),
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
    // Los libros: balance de sumas y saldos, diario y el registro de ingresos y
    // gastos. Era la pantalla de Contabilidad hasta el 2026-09-12; ahora esa
    // dirección abre el cockpit y esto queda un clic más adentro. **No** entra
    // al menú: la lista de secciones del médico es cerrada y hay un spec que
    // falla si alguien le agrega una (carril 9).
    path: 'administration/accounting/libros',
    title: `${APP_TITLE} - Libros contables`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/accounting/accounting')
        .then((m) => m.Accounting)
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
    // El checkout del pedido (T-E3 · pantalla G): entrega, dirección, medio de
    // pago y resumen. Sin `:orderId`: el pedido se crea recién en su
    // confirmación final (D-FARMOCK-T-E1-01). Antes de `:orderId`, como `new`.
    path: 'my-account/pharmacy-orders/checkout',
    title: `${APP_TITLE} - Entrega y pago`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/pharmacy-orders/checkout/checkout')
        .then((m) => m.Checkout)
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
    // El comprobante interno del pago (carril FAR-I5). Es el destino de la
    // notificación futura del backend (`PHARMACY_RECEIPT` en la tabla de la
    // campana); sin pago registrado, la pantalla dice su vacío honesto.
    path: 'my-account/pharmacy-orders/:orderId/receipt',
    title: `${APP_TITLE} - Comprobante de pago`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/pharmacy-orders/order-receipt/order-receipt')
        .then((m) => m.OrderReceipt)
        .catch(() => chunkFallido()),
  },
  {
    // La factura del pedido (T-E4 · F2.1.12, F3.3). Hermana del comprobante
    // interno y distinta de él: el comprobante dice que no es una factura.
    // Sin contrato de facturación, un pedido sin factura dice su vacío honesto.
    path: 'my-account/pharmacy-orders/:orderId/invoice',
    title: `${APP_TITLE} - Factura`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/pharmacy-orders/order-invoice/order-invoice')
        .then((m) => m.OrderInvoice)
        .catch(() => chunkFallido()),
  },
  {
    // El mismo pedido, visto desde el mostrador (carril FAR-I3): la
    // «recepción por un link» del registro del cliente. Hija de la bandeja;
    // hereda por prefijo su regla de acceso por membresía.
    path: 'administration/pharmacy-orders/:orderId',
    title: `${APP_TITLE} - Pedido en el mostrador`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/organization/pharmacy-inbox/inbox-order/inbox-order')
        .then((m) => m.InboxOrder)
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
    // La atención: todo lo que se ESCRIBE durante una consulta. Cuelga del
    // expediente y comparte su compuerta de roles porque es la misma persona y
    // el mismo permiso; lo que cambia es el modo de trabajo. Vivía dentro del
    // expediente y se separó: leer una historia y registrar una consulta son
    // dos cosas distintas, y compartiendo pantalla se estorbaban.
    path: 'medical-records/:profileId/encounter',
    title: `${APP_TITLE} - Atención clínica`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/clinical-record/encounter-workspace/encounter-workspace')
        .then((m) => m.EncounterWorkspace)
        .catch(() => chunkFallido()),
  },
  {
    // FT-07-R05: pedir el vínculo, previo a poder leer el expediente sin un
    // turno confirmado el mismo día. Cuelga de la misma sección que el
    // expediente — no es una pantalla nueva del menú, es un paso de este flujo.
    path: 'medical-records/:profileId/request-access',
    title: `${APP_TITLE} - Solicitar vinculación`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/clinical-record/request-access/request-access')
        .then((m) => m.RequestAccess)
        .catch(() => chunkFallido()),
  },
  {
    // FT-07-R06: a dónde lleva el aviso "un médico pidió acceder a tu
    // historia clínica". Sin entrada de menú, como `my-account/identity/cases`
    // — se llega por el enlace de la notificación.
    path: 'my-account/access-requests',
    title: `${APP_TITLE} - Solicitudes de vínculo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/account/access-requests/access-requests')
        .then((m) => m.AccessRequests)
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
    // FT-24. El alta de una cotización. Cuelga de «Cotizaciones», que es el
    // listado que la sección declara; con `seccionRolesGuard` explícito como
    // el resto de las hijas de una sección que declara roles.
    path: 'my-quotations/new',
    title: `${APP_TITLE} - Nueva cotización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/quotations/quotation-form/quotation-form')
        .then((m) => m.QuotationForm)
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
    // El detalle de una solicitud de seguro (TAREA-16): se llega desde el
    // listado, nunca desde el menú.
    //
    // **Con el guard de sección, igual que su listado.** La sección declara
    // `SECURITY_ADMIN` porque es el único rol que la plataforma sabe emitir
    // para esto —los `BILLING`/`FINANCE` que nombran las escrituras del ciclo
    // del reclamo no existen en el `RoleCode` cerrado de la API—, y dejar el
    // detalle destapado mientras el listado se pide con rol es una
    // inconsistencia: la dirección se escribe a mano. La barrera de verdad
    // sigue siendo el alcance por tenant del servidor, que responde el mismo
    // 404 para una solicitud ajena que para un uuid inexistente.
    path: 'administration/insurance-claims/:claimId',
    title: `${APP_TITLE} - Solicitud de seguro`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/insurance/insurance-claim-detail/insurance-claim-detail')
        .then((m) => m.InsuranceClaimDetail)
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
    // Corregir los datos propios del paciente. **Sin `soloDeQuienAtiende()`**:
    // es de quien se atiende, no de quien atiende — «Mi perfil» no declara
    // roles y esta hija tampoco los restringe, igual que el caso de
    // verificación de identidad. El sujeto lo resuelve el backend desde la
    // sesión, así que no hay perfil ajeno que abrir escribiendo la URL.
    path: 'my-account/profile/edit',
    title: `${APP_TITLE} - Editar tus datos`,
    loadComponent: () =>
      import('./features/account/my-profile/patient-profile-edit/patient-profile-edit')
        .then((m) => m.PatientProfileEdit)
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
    // La importación por archivo. No es una sección del menú: cuelga de
    // Terminología, que es donde alguien va a buscarla, y se alcanza desde ahí
    // o por enlace directo.
    path: 'administration/terminology/import',
    title: `${APP_TITLE} - Importar terminología`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/terminology/version-import/version-import')
        .then((m) => m.VersionImport)
        .catch(() => chunkFallido()),
  },
  {
    // El recorrido de puesta en marcha. No es una sección del menú: se llega
    // desde el aviso del panel o desde el ingreso, y es un destino, no un
    // lugar donde quedarse.
    path: 'administration/getting-started',
    title: `${APP_TITLE} - Puesta en marcha`,
    canActivate: [seccionRolesGuard],
    data: { roles: ['SUPERADMIN', 'SECURITY_ADMIN'] },
    loadComponent: () =>
      import('./features/admin/getting-started/getting-started')
        .then((m) => m.GettingStarted)
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
    // Las tres pantallas de escritura de una organización. Van ANTES de la
    // ficha (`:tenantId`) no por el parámetro —el suyo también lo es— sino
    // porque sus segmentos finales son literales: `.../verify` tiene que
    // resolver acá y no caer en la ficha con `verify` de id.
    //
    // Con guard de sección: las tres son administrativas, a diferencia de la
    // ficha, cuyas lecturas la API abre a cualquier miembro del tenant.
    path: 'administration/organizations/:tenantId/verify',
    title: `${APP_TITLE} - Verificar organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/organizations/organization-verify/organization-verify')
        .then((m) => m.OrganizationVerify)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/branches/new',
    title: `${APP_TITLE} - Nueva sucursal`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/organizations/branch-new/branch-new')
        .then((m) => m.BranchNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/memberships/new',
    title: `${APP_TITLE} - Sumar a la organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/organizations/membership-new/membership-new')
        .then((m) => m.MembershipNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/organizations/:tenantId/child-organizations/new',
    title: `${APP_TITLE} - Nueva sub-organización`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('./features/admin/organizations/child-organization-new/child-organization-new')
        .then((m) => m.ChildOrganizationNew)
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
/**
 * Las secciones que además son un marco: la pantalla queda montada y lo que
 * cambia es lo que se pinta en su `router-outlet`.
 *
 * Hoy es una sola, la mensajería. El hilo de una conversación **no** es otra
 * pantalla: es el panel derecho del chat, y declararlo como hermana hacía que
 * abrir una conversación destruyera la bandeja y la volviera a pedir —la lista
 * parpadeaba, el scroll se perdía y durante un instante no había nada—. Es lo
 * primero que separa esto de cualquier chat que la gente ya usa.
 *
 * La sección sigue siendo una sola entrada del registro, así que el menú, el
 * título y `seccionRolesGuard` no cambian: el guard del padre cubre a las
 * hijas, que es justo lo que se quiere.
 */
const RUTAS_ANIDADAS: Readonly<Record<string, Routes>> = {
  messaging: [
    {
      // Sin hilo abierto. No pinta nada a propósito: el hueco de la derecha
      // —«elegí una conversación»— lo dibuja el propio marco, y un componente
      // aparte para eso sería un fragmento más que descargar para no mostrar
      // nada. Tiene que existir igual: una ruta con hijas sólo casa si alguna
      // consume lo que queda de la dirección, y sin ésta `/messaging` a secas
      // caía en el comodín de «no encontrada».
      //
      // `children: []` y no una ruta pelada: el router exige que toda ruta
      // declare con qué se resuelve (NG04014), y una lista de hijas vacía es
      // la forma de decir «con nada».
      path: '',
      children: [],
    },
    {
      // Carril P2 · el hilo de una conversación, dentro del marco del chat. Se
      // llega desde la bandeja o desde una notificación de la campana.
      path: ':conversationId',
      title: `${APP_TITLE} - Conversación`,
      loadComponent: () =>
        import('./features/messaging/thread/thread')
          .then((m) => m.Thread)
          .catch(() => chunkFallido()),
    },
  ],
};

function rutasDeSecciones(): Routes {
  return APP_SECTIONS.map((section) => ({
    path: section.path,
    title: titleOf(section),
    ...(RUTAS_ANIDADAS[section.path] === undefined
      ? {}
      : { children: RUTAS_ANIDADAS[section.path] }),
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
  // «Preferencias de avisos» dejó de ser una sección y pasó a ser un panel de
  // Ajustes. Estuvo en el menú, así que la dirección está en favoritos y en el
  // historial de quien ya la usó: se redirige en vez de devolver un 404.
  // Apunta directo a la dirección vigente, no a `/ajustes`: encadenar dos
  // redirecciones es una navegación más por nada.
  'my-account/notification-preferences': '/settings',
  // TAREA-29, por arrastre de TAREA-17: Ajustes pasó a `/settings`. La
  // dirección en castellano se alcanzaba por el ícono del encabezado desde el
  // 28/08, así que está en historiales y favoritos.
  ajustes: '/settings',
  panel: '/dashboard',
  agenda: '/schedule',
  clinico: '/medical-records',
  facturacion: '/billing',
  contabilidad: '/administration/accounting',
  'mi-cuenta': '/my-account',
  'mi-cuenta/turnos': '/my-account/appointments',
  'identidad/verificar': '/my-account/identity',
  'identidad/casos': '/my-account/identity',
  // Las dos rutas propias de antes de unificar (2026-09-10). Están en
  // historiales, en favoritos y en los correos que la plataforma ya mandó.
  'my-account/identity/verify': '/my-account/identity',
  'my-account/identity/cases': '/my-account/identity',
  // «Mis organizaciones» pasó a ser una pestaña de «Organización médica»
  // (2026-09-10). Está en historiales y en el lateral de «Mi perfil».
  'my-organizations': '/administration/medical-organization',
  'administracion/pacientes': '/administration/patients',
  'administracion/usuarios': '/administration/users',
  'administracion/organizaciones': '/administration/organizations',
  'administracion/acceso-delegado': '/administration/delegated-access',
  'administracion/proveedores-identidad': '/administration/identity-providers',
  'administracion/verificacion-identidad': '/administration/identity-assurance',
  'administracion/terminologia': '/administration/terminology',
};

/**
 * La superficie de búsqueda pública, renombrada a inglés por TAREA-29.
 *
 * ## Por qué van en su propia tabla y no en `RUTAS_HEREDADAS_PUBLICAS`
 *
 * Porque estas rutas **son las que la gente comparte**: un enlace a
 * `/buscar/profesionales?q=cardio` pegado en un mensaje tiene que seguir
 * abriendo el directorio, no un 404. Separarlas deja ver de un vistazo cuáles
 * son las del buscador y cuáles las del correo de alta.
 *
 * ## `pathMatch: 'full'`, una por una, y no un redirect de prefijo sobre `buscar`
 *
 * Un `{ path: 'buscar', redirectTo: 'search' }` con coincidencia por prefijo
 * habría cubierto las siete de una línea — y se habría llevado puestas las
 * **doce** pantallas portadas que el archivo GENERADO
 * `features/alovida/alovida.routes.ts` declara bajo el mismo `buscar`
 * (`buscador-listado`, `seguidos-y-guardados-listado`,
 * `calificar-la-atencion-formulario`, las cinco fichas `perfil-*-detalle`…).
 * Ésas no son de esta tarea y la regla de arrastre dice que no se tocan, así
 * que cada redirect nombra su ruta exacta y ninguna otra.
 */
const RUTAS_HEREDADAS_DEL_BUSCADOR: Readonly<Record<string, string>> = {
  publicaciones: '/posts',
  'buscar/profesionales': '/search/practitioners',
  'buscar/medicamentos': '/search/medications',
  'buscar/hospitales': '/search/hospitals',
  'buscar/diagnostico': '/search/diagnostics',
  'buscar/aseguradoras': '/search/insurers',
  'buscar/sintomas': '/search/symptoms',
  'buscar/mapa': '/search/map',
};

/** Las landings públicas, que son las que viajan en los correos. */
const RUTAS_HEREDADAS_PUBLICAS: Readonly<Record<string, string>> = {
  'auth/organizacion': '/auth/organization',
  'auth/registro': '/auth/register',
  'auth/register-organization': '/auth/register/organization',
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
      import('./features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
    children: [
      // La vista de una publicación suelta cuelga sólo de `p/` —quien publica
      // es un profesional—, y va antes que `:slug` porque tiene más segmentos.
      ...(prefijo === 'p'
        ? [
            {
              path: ':slug/post/:postId',
              data: { kind, pantallaReal: true },
              resolve: { perfil: perfilPublicoResolver },
              loadComponent: () =>
                import('./features/public-profile/public-post-detail/public-post-detail').then(
                  (m) => m.PublicPostDetail,
                ),
            },
          ]
        : []),
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
 * `scripts/port-vistas-alovida.mjs` deriva el segmento del **nombre del archivo
 * de la maqueta**, así que la portada quedó en `/buscar/buscador-listado` y los
 * verticales en `/buscar/…-listado`. Sirve para recorrer la bóveda; no sirve
 * como superficie pública. Estas URL son las que la ficha declara —`/search`,
 * `/search/practitioners`, `/search/map`—, las que se pegan en un mensaje y
 * las que un buscador indexa, y son cortas y estables porque un directorio
 * público las cambia una sola vez.
 *
 * ## Por qué van antes de `ALOVIDA_ROUTES` y no dentro
 *
 * Porque `alovida.routes.ts` es un **archivo generado**: escribirlas ahí las
 * borra la próxima vez que alguien porte una vista. Declaradas acá conviven
 * con el bloque generado —el router prueba estas primero y retrocede al
 * siguiente `buscar` cuando el segmento no coincide—, así que los enlaces de
 * la bóveda que todavía apuntan a `/buscar/buscador-listado` siguen abriendo.
 * Hay una prueba que resuelve las dos formas y falla si eso deja de ser cierto.
 */
function rutasDeBusquedaPublica(): Routes {
  return [
    {
      // La portada pública: lo último que publicaron todos los profesionales.
      // Es el destino por defecto de quien entra sin sesión (ver `homeGuard`),
      // y va en su propia ruta y no en `/search` porque son dos cosas
      // distintas: acá se lee sin saber a quién buscar, allá se busca a
      // alguien concreto.
      path: 'posts',
      loadComponent: () =>
        import('./features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Lo último de los profesionales — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/feed-publicaciones/feed-publicaciones').then(
              (m) => m.FeedPublicaciones,
            ),
        },
      ],
    },
    {
      /* TAREA-29 · `/buscar` a secas tiene que seguir abriendo el buscador.
         No alcanza con un `redirectTo` en la tabla del final: el archivo
         GENERADO `features/alovida/alovida.routes.ts` declara su propio `buscar`
         —con `{ path: '', redirectTo: 'buscador-listado' }` adentro— y lo
         captura antes de que el router llegue ahí. Se declara acá, en el
         bloque que va primero, y con el redirect en el hijo vacío para que
         `/buscar/loQueSea` **no** coincida y siga retrocediendo a las doce
         pantallas portadas que cuelgan de aquél. */
      path: 'buscar',
      children: [{ path: '', pathMatch: 'full', redirectTo: '/search' }],
    },
    {
      path: 'search',
      loadComponent: () =>
        import('./features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Buscar en AloVida — profesionales, medicamentos y centros de salud',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/buscador-listado/buscador-listado').then(
              (m) => m.BuscarBuscadorListado,
            ),
        },
        {
          // El triaje de síntomas, sin sesión. Era lo primero que veía un
          // paciente **al entrar**, y entrar es justamente lo que no hizo quien
          // todavía no sabe a qué médico ir: la pregunta que trae a alguien
          // —«me pasa esto, ¿a quién consulto?»— quedaba detrás del registro.
          path: 'symptoms',
          title: '¿A qué especialista consultar? — AloVida',
          data: { arquetipo: 'formulario', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/sintomas-publico/sintomas-publico').then(
              (m) => m.SintomasPublico,
            ),
        },
        {
          path: 'practitioners',
          title: 'Profesionales de salud — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/profesionales-listado/profesionales-listado').then(
              (m) => m.BuscarProfesionalesListado,
            ),
        },
        {
          path: 'medications',
          title: 'Medicamentos y farmacias — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/medicamentos-listado/medicamentos-listado').then(
              (m) => m.BuscarMedicamentosListado,
            ),
        },
        {
          path: 'hospitals',
          title: 'Hospitales y clínicas — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/hospitales-listado/hospitales-listado').then(
              (m) => m.BuscarHospitalesListado,
            ),
        },
        {
          path: 'diagnostics',
          title: 'Laboratorios e imagen — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/laboratorios-listado/laboratorios-listado').then(
              (m) => m.BuscarLaboratoriosListado,
            ),
        },
        {
          path: 'insurers',
          title: 'Aseguradoras y convenios — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/aseguradoras-listado/aseguradoras-listado').then(
              (m) => m.BuscarAseguradorasListado,
            ),
        },
        {
          // V65-12. `mapa` y no `cercania`: es el rótulo de la pestaña y el
          // que la ficha declara.
          path: 'map',
          title: 'Cerca mío — AloVida',
          data: { arquetipo: 'detalle', pantallaReal: true },
          loadComponent: () =>
            import('./features/alovida/buscar/cercania-detalle/cercania-detalle').then(
              (m) => m.BuscarCercaniaDetalle,
            ),
        },
      ],
    },
    {
      // FAR-I7: el detalle de una promoción, con URL propia y compartible.
      //
      // Cuelga del marco público —y no de `administration/`— porque el enlace
      // se manda por mensaje: quien lo recibe tiene que ver la promoción, no
      // una pantalla de login. Va fuera de `buscar` para que la URL sea
      // `/promotions/:id`: una promoción no es un resultado de búsqueda.
      path: 'promotions/:campaignId',
      loadComponent: () =>
        import('./features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Promoción — AloVida',
          data: { arquetipo: 'detalle', pantallaReal: true },
          loadComponent: () =>
            import('./features/campaigns/campaign-detail/campaign-detail').then(
              (m) => m.CampaignDetail,
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
  // Las pantallas portadas desde la bóveda, con su propio marco ALOVIDA. Van
  // primero y con segmento propio: no compiten con el armazón de abajo, que
  // vive en `path: ''`, así que ninguna de las dos depende de que el router
  // retroceda para encontrar a la otra.
  ...ALOVIDA_ROUTES,
  // Las fichas públicas por slug. Van con el marco público y **sin guard**:
  // son la superficie anónima, y el enlace que alguien pega en un mensaje.
  //
  // Los cinco prefijos son cortos por diseño —`/p/`, `/o/`, `/f/`, `/l/`,
  // `/s/`— y cada uno promete un tipo de sujeto: la ruta lo declara en `data`
  // y el cliente lo traduce al prefijo de la API, que devuelve 404 si el slug
  // es de otra clase en vez de redirigir.
  ...rutasDeFichasPublicas(),
  // La raíz, antes del armazón guardado: sin sesión manda a la superficie
  // pública (`/search`) y no al login; con sesión, al panel. Los dos destinos
  // salen del propio `homeGuard` (un `UrlTree`, nunca `true`) porque Angular no
  // deja combinar `canActivate` con `redirectTo` en la misma ruta. Sin
  // `component`/`redirectTo` propios, `children: []` es lo mínimo que exige
  // una ruta válida — el guard nunca deja que lleguen a importar.
  {
    path: '',
    pathMatch: 'full',
    canActivate: [homeGuard],
    children: [],
  },
  {
    // El armazón: header con el usuario, navegación y selector de organización.
    // El guard corre en el padre — S1 del M34: autorizar ANTES de pedir datos —
    // y cubre a todas las hijas.
    path: '',
    component: ShellLayout,
    canActivate: [authGuard],
    children: [
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
      // `/schedule/edit`, que la bitácora pide como ruta APARTE de `/new`. Es
      // la misma pantalla: el formulario ya sabía distinguir alta de cambio
      // —precarga el horario vigente y el botón dice «Guardar»—, lo que no
      // tenía era una dirección propia. Sin ella, «editar mi horario» no se
      // podía enlazar desde ningún lado ni compartir.
      pantallaDeOperacion('schedule', 'edit', 'Cambiar mi horario', () =>
        import('./features/agenda/agenda-create/agenda-create').then((m) => m.AgendaCreate),
      ),
      // Los bloqueos, con el mismo flujo que los horarios. Es lo que el pedido
      // original del carril 11 dice en mayúsculas: «TIENE EL MISMO DISEÑO Y
      // RUTAS QUE TODO EL FLUJO DE HORARIOS». Hasta acá eran un panel dentro de
      // «Mi agenda», sin lista, sin históricos y sin dirección propia.
      pantallaDeOperacion('schedule', 'blocks', 'Bloqueos de agenda', () =>
        import('./features/agenda/blocks/blocks').then((m) => m.Blocks),
      ),
      // El alta de cita del profesional (TAREA-14). Dirección propia porque el
      // pedido es justamente poder agendar **sin pasar por el calendario**:
      // hasta acá la única forma era tocar un rato del día y abrir la tarjeta,
      // que exige llegar primero al día correcto.
      // El importador del arancel (TAREA-22 · S2). Cuelga del catálogo de
      // servicios: se llega desde ahí, que es donde uno mira su lista y se da
      // cuenta de que le falta un procedimiento.
      pantallaDeOperacion(
        'administration/services-catalog',
        'import',
        'Importar del arancel',
        () =>
          import(
            './features/admin/services-catalog/procedure-import/procedure-import'
          ).then((m) => m.ProcedureImport),
      ),
      pantallaDeOperacion('schedule', 'appointment/new', 'Agendar una cita', () =>
        import('./features/agenda/appointment-new/appointment-new').then(
          (m) => m.AppointmentNew,
        ),
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
    /* El stock de componentes: la lista de todo lo que existe, sacada del
       código, con cada pieza montada con datos de prueba.

       `canMatch` y no `canActivate`: con `canMatch` la ruta **no existe** allí
       donde no hay backend simulado —o sea, en cualquier rama que no sea
       `mockup`—, así que cae en el comodín y da 404 como cualquier dirección
       inventada. Con `canActivate` existiría y sólo estaría prohibida, que es
       otra cosa: anuncia que hay algo detrás.

       Va fuera del armazón, como la vitrina: no pide sesión, porque montar un
       componente suelto no la necesita y pedirla obligaría a entrar sólo para
       mirar un botón. */
    path: 'design-system/stock',
    canMatch: [() => environment.mockBackend],
    loadComponent: () =>
      import('./features/component-stock/component-stock')
        .then((m) => m.ComponentStock)
        .catch(() => chunkFallido()),
    title: 'AloVida - Stock de componentes',
  },
  {
    /* Comodín y no `:clave`: la clave de un componente es su ruta de archivo
       —`shared/components/atoms/badge/badge`— y lleva barras, que un parámetro
       de un solo segmento no captura. Con `**` la URL sigue siendo legible y
       se puede copiar y pegar. */
    path: 'design-system/stock/**',
    canMatch: [() => environment.mockBackend],
    loadComponent: () =>
      import('./features/component-stock/component-stock')
        .then((m) => m.ComponentStock)
        .catch(() => chunkFallido()),
    title: 'AloVida - Stock de componentes',
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
    // La elección de tipo de cuenta. Cada alta cuelga de acá con URL propia, así
    // que «registrate como doctor» se puede enlazar desde afuera.
    path: 'auth/register',
    component: RegisterAccountType,
    pathMatch: 'full',
    title: 'AloVida - Crear cuenta',
  },
  {
    path: 'auth/register/patient',
    // Diferida: el alta arrastra el árbol de municipios y el combobox de
    // ocupaciones, y con import directo eso viaja en el bundle inicial que
    // toda visita paga —incluida la de quien sólo entra a leer—. Mismo
    // criterio que la vitrina de diseño.
    loadComponent: () =>
      import('./features/auth/register-patient/register-patient').then((m) => m.RegisterPatient),
    title: 'AloVida - Crear cuenta de paciente',
  },
  {
    // Cada alta monta SU componente. Las dos vivían en `RegisterPatient`, que
    // decidía cuál dibujar leyendo `data.tipoDeCuenta`; eran dos formularios,
    // dos juegos de páginas y dos endpoints en la misma clase, así que el dato
    // de ruta se fue con la separación y lo que queda es lo que ya decía la
    // URL.
    path: 'auth/register/practitioner',
    // Diferida por lo mismo que el alta de paciente: arrastra el árbol de
    // municipios y el catálogo de especialidades.
    loadComponent: () =>
      import('./features/auth/register-practitioner/register-practitioner').then(
        (m) => m.RegisterPractitioner,
      ),
    title: 'AloVida - Crear cuenta de profesional',
  },
  {
    // Signup público de una organización aseguradora: crea el tenant `PAYER`
    // y su usuario owner en la misma operación.
    // Diferida desde la subtarea 1.2: la documentación legal en PDF arrastra
    // `app-file-input` (y con él `FilePreview`/`pdfjs-dist`, diferido a su vez).
    path: 'auth/register/organization',
    loadComponent: () =>
      import('./features/auth/register-organization/register-organization').then(
        (m) => m.RegisterOrganization,
      ),
    title: 'AloVida - Registrar aseguradora',
  },
  {
    // El alta del laboratorio de sangre: los dieciocho puntos de datos legales
    // del proceso 4.1 del stakeholder. Todavía sin endpoint —cierra con una
    // solicitud, no con una cuenta—; ver el JSDoc de `RegisterLaboratory`.
    path: 'auth/register/laboratory',
    // Diferida por lo mismo que las otras dos altas largas: arrastra el mapa,
    // que no tiene por qué viajar en el paquete inicial de toda visita.
    loadComponent: () =>
      import('./features/auth/register-laboratory/register-laboratory').then(
        (m) => m.RegisterLaboratory,
      ),
    title: 'AloVida - Registrar laboratorio',
  },
  {
    // El alta del centro de imagenología: el módulo «ANÁLISIS MÉDICOS (RAYOS X,
    // RESONANCIA, ETC.)» del registro del stakeholder. Los dieciocho puntos de
    // datos legales son los mismos que los del laboratorio de sangre —la fuente
    // los repite enteros—, y lo que cambia es qué estudios hace el centro; ver
    // el JSDoc de `RegisterImagingCenter`. Tampoco tiene endpoint todavía:
    // cierra con una solicitud, no con una cuenta.
    //
    // La ruta dice `imaging-center` y no `imaging` a secas para no chocar con
    // `?kind=IMAGING`, que es la **categoría** del directorio de laboratorios:
    // aquélla filtra una vitrina, ésta da de alta una empresa.
    path: 'auth/register/imaging-center',
    // Diferida por lo mismo que las otras altas largas: arrastra el mapa, que
    // no tiene por qué viajar en el paquete inicial de toda visita.
    loadComponent: () =>
      import('./features/auth/register-imaging-center/register-imaging-center').then(
        (m) => m.RegisterImagingCenter,
      ),
    title: 'AloVida - Registrar centro de imagenología',
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
  // TAREA-29 · Las del buscador, por el mismo motivo y con el mismo orden.
  // Además tienen que ir después del bloque generado de ALOVIDA: `buscar` a
  // secas existe en las dos partes, y acá gana la que redirige sólo cuando
  // ninguna pantalla real coincidió.
  ...rutasHeredadas(RUTAS_HEREDADAS_DEL_BUSCADOR),
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
