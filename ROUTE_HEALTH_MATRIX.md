# Matriz de salud de rutas — carril 19

> **Generado** por `playwright/carril-19-route-health.spec.ts` sobre Chromium, contra la API viva. Se regenera con `yarn pw:rutas`. No editar a mano.

636 aperturas de ruta, sobre las rutas declaradas por el router.

## Qué significa cada estado

| Estado | Qué se vio |
|---|---|
| `ok` | Navegó, pintó contenido, sin errores de consola ni respuestas de fallo. |
| `denegada` | Rebotó **y el rol no alcanzaba**: es el guard funcionando, no un defecto. |
| `no navega` | Rebotó aunque el rol alcanzaba. Menú y guard desacordados. |
| `vacía` | Llegó y la región principal no pintó nada. |
| `error de consola` | Excepción sin capturar o error de la aplicación. |
| `error de API` | 5xx, o un 4xx que no es de autorización ni de «no existe». |

## Recuento

| Estado | Aperturas |
|---|---|
| `error de consola` | 19 |
| `no navega` | 101 |
| `denegada` | 213 |
| `ok` | 303 |

## Hallazgos

| Rol | Ruta | Componente | Estado | Detalle |
|---|---|---|---|---|
| administrador | `/my-visits` | `VisitorVisits` | error de consola | [API] GET /visit-agenda/me → 404 · NOT_FOUND · «El doctor no tiene agenda de visitas habilitada» · correlationId=55e7bde9-9ff9-47c3-aa38-562c6da1dd41 {status: 404, code: NOT_FOUND, message: El doctor  |
| administrador | `/glossary` | `Glossary` | error de consola | [API] GET /visit-requests/mine → 404 · NOT_FOUND · «La cuenta no corresponde a un visitador médico» · correlationId=31d41ba2-7543-4137-92b8-87a12aa2e994 {status: 404, code: NOT_FOUND, message: La cuen |
| administrador | `/questionnaires` | `SurveysHome` | error de consola | [API] GET /surveys/templates → 422 · PRECONDITION_FAILED · «La sesión no tiene perfil profesional asociado» · correlationId=4095ffeb-b555-4846-b431-4c6036c2c8e6 {status: 422, code: PRECONDITION_FAILED |
| administrador | `/administration/users` | `UserRegistration` | error de consola | [API] GET /system-context/dynamic-enums → 404 · NOT_FOUND · «Enumeración no encontrada» · correlationId=e7c08818-c718-4b20-9f08-e37333f00d57 {status: 404, code: NOT_FOUND, message: Enumeración no enco |
| administrador | `/administration/received-claims` | `ReceivedClaims` | error de consola | [API] GET /insurance/analytics/loss-ratio → 404 · NOT_FOUND · «Aseguradora no encontrada» · correlationId=c390d81a-909c-4001-aa3d-45b4b4ac2224 {status: 404, code: NOT_FOUND, message: Aseguradora no en |
| administrador | `/administration/insurance-patients` | `InsurancePatients` | error de consola | [API] GET /insurance/received-claims → 403 · FORBIDDEN · «No hay acceso a las solicitudes recibidas» · correlationId=1c55d915-99a5-4370-8c75-ebb5e8084c9b {status: 403, code: FORBIDDEN, message: No hay |
| administrador | `/administration/insurance-campaigns` | `InsuranceCampaigns` | error de consola | [API] GET /insurance-campaigns → 403 · FORBIDDEN · «La organización activa no es una aseguradora» · correlationId=d2130704-f455-4d7c-ba9d-e1af57bdd9fd {status: 403, code: FORBIDDEN, message: La organi |
| administrador | `/administration/pharmacy` | `PharmacySummaryPage` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-import` | `PharmacyImport` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega | terminó en /dashboard |
| administrador | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega | terminó en /my-account |
| administrador | `/administration/laboratory` | `LaboratorySummaryPage` | no navega | terminó en /dashboard |
| administrador | `/laboratorio/recepcion` | `LabReception` | no navega | terminó en /dashboard |
| administrador | `/laboratorio/cola` | `Diagnostics` | no navega | terminó en /dashboard |
| administrador | `/administration/laboratory-results` | `LaboratoryResults` | no navega | terminó en /dashboard |
| administrador | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega | terminó en /dashboard |
| administrador | `/administration/laboratory-branches` | `OrganizationBranches` | no navega | terminó en /dashboard |
| administrador | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | error de consola | [API] GET /surveys/me/invitations → 403 · FORBIDDEN · «Solo un paciente puede ver sus cuestionarios» · correlationId=175cdd5f-eea4-4dd0-b1e9-d7cad55dea4f {status: 403, code: FORBIDDEN, message: Solo u |
| administrador | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | error de consola | [API] GET /profiles/patients/me/summary → 422 · PRECONDITION_FAILED · «La cuenta no tiene una persona vinculada» · correlationId=1db044ca-d6fc-4a83-abd0-23d9629be865 {status: 422, code: PRECONDITION_F |
| administrador | `/administration/geolocation/trips/close` | `TripClose` | error de consola | [API] GET /profiles/patients/me/summary → 422 · PRECONDITION_FAILED · «La cuenta no tiene una persona vinculada» · correlationId=5833af34-4975-4098-9523-c422e47dd9db {status: 422, code: PRECONDITION_F |
| administrador | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | error de consola | [API] GET /system-context/dynamic-enums → 404 · NOT_FOUND · «Enumeración no encontrada» · correlationId=4d70bcdc-e4a4-4959-adea-70ece73c4d84 {status: 404, code: NOT_FOUND, message: Enumeración no enco |
| administrador | `/my-account/pharmacy-orders/checkout` | `Checkout` | error de consola | [API] GET /profiles/practitioners/me/summary → 422 · PRECONDITION_FAILED · «La cuenta no tiene una persona vinculada» · correlationId=f4a1cc49-7a7c-4c68-85d2-49d902e79218 {status: 422, code: PRECONDIT |
| administrador | `/my-account/profile/edit` | `PatientProfileEdit` | error de consola | [API] GET /profiles/patients/me → 422 · PRECONDITION_FAILED · «La cuenta no tiene una persona vinculada» · correlationId=c61aa236-cf69-4ca0-9b35-e07e25505f9a {status: 422, code: PRECONDITION_FAILED, m |
| administrador | `/onboarding` | `OnboardingPractitioner` | error de consola | [API] GET /profiles/practitioners/me/onboarding → 422 · PRECONDITION_FAILED · «La cuenta no tiene una persona vinculada» · correlationId=585bd2f9-7c3b-4e69-8b4c-43c210d26c18 {status: 422, code: PRECON |
| doctora | `/glossary` | `Glossary` | error de consola | [API] GET /visit-agenda/me → 404 · NOT_FOUND · «El doctor no tiene agenda de visitas habilitada» · correlationId=66b67082-bcd3-43d0-82d8-a1105ee80703 {status: 404, code: NOT_FOUND, message: El doctor  |
| doctora | `/administration/insurance` | `InsuranceCatalog` | no navega | terminó en /dashboard |
| doctora | `/administration/insurance-analytics` | `InsuranceAnalytics` | no navega | terminó en /dashboard |
| doctora | `/administration/received-claims` | `ReceivedClaims` | no navega | terminó en /dashboard |
| doctora | `/administration/insurance-patients` | `InsurancePatients` | no navega | terminó en /dashboard |
| doctora | `/administration/insurance-campaigns` | `InsuranceCampaigns` | no navega | terminó en /dashboard |
| doctora | `/my-account/dependents` | `Dependents` | no navega | terminó en /dashboard |
| doctora | `/my-account/appointments` | `Appointments` | no navega | terminó en /dashboard |
| doctora | `/my-account/medical-record` | `MedicalRecord` | no navega | terminó en /dashboard |
| doctora | `/my-account/diagnostic-results` | `DiagnosticResults` | no navega | terminó en /dashboard |
| doctora | `/my-account/diagnostic-orders` | `DiagnosticOrders` | no navega | terminó en /dashboard |
| doctora | `/my-account/cotizaciones` | `Cotizaciones` | no navega | terminó en /dashboard |
| doctora | `/my-account/questionnaires` | `Questionnaires` | no navega | terminó en /dashboard |
| doctora | `/administration/my-organization` | `OrganizationPanel` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy` | `PharmacySummaryPage` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-import` | `PharmacyImport` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega | terminó en /dashboard |
| doctora | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega | terminó en /my-account |
| doctora | `/administration/laboratory` | `LaboratorySummaryPage` | no navega | terminó en /dashboard |
| doctora | `/laboratorio/recepcion` | `LabReception` | no navega | terminó en /dashboard |
| doctora | `/laboratorio/cola` | `Diagnostics` | no navega | terminó en /dashboard |
| doctora | `/administration/laboratory-results` | `LaboratoryResults` | no navega | terminó en /dashboard |
| doctora | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega | terminó en /dashboard |
| doctora | `/administration/laboratory-branches` | `OrganizationBranches` | no navega | terminó en /dashboard |
| doctora | `/administration/getting-started` | `GettingStarted` | no navega | terminó en /dashboard |
| doctora | `/my-account/edit` | `PractitionerProfileEdit` | error de consola | [API] GET /authz/care-relationships/requests/mine → 403 · FORBIDDEN · «Rol insuficiente para la operación» · correlationId=6b30c814-9119-416f-89ab-2479e9723b83 {status: 403, code: FORBIDDEN, message:  |
| doctora | `/onboarding` | `OnboardingPractitioner` | error de consola | [API] GET /profiles/patients/me → 404 · NOT_FOUND · «Paciente no encontrado» · correlationId=77cf2603-58b9-4797-a598-65ed6a4e0952 {status: 404, code: NOT_FOUND, message: Paciente no encontrado, correl |
| paciente | `/administration/insurance` | `InsuranceCatalog` | no navega | terminó en /dashboard |
| paciente | `/administration/insurance-analytics` | `InsuranceAnalytics` | no navega | terminó en /dashboard |
| paciente | `/administration/received-claims` | `ReceivedClaims` | no navega | terminó en /dashboard |
| paciente | `/administration/insurance-patients` | `InsurancePatients` | no navega | terminó en /dashboard |
| paciente | `/administration/insurance-campaigns` | `InsuranceCampaigns` | no navega | terminó en /dashboard |
| paciente | `/settings` | `Settings` | error de consola | Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| paciente | `/my-account/spending` | `Spending` | error de consola | [API] GET /patient-spending/me → 404 · NOT_FOUND · «Cannot GET /patient-spending/me?from=2025-01-01&to=2026-10-15» · correlationId=a4a4064b-1fcd-494c-888d-45064f9b1b3f {status: 404, code: NOT_FOUND, m |
| paciente | `/administration/my-organization` | `OrganizationPanel` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy` | `PharmacySummaryPage` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-import` | `PharmacyImport` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega | terminó en /dashboard |
| paciente | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega | terminó en /my-account |
| paciente | `/administration/laboratory` | `LaboratorySummaryPage` | no navega | terminó en /dashboard |
| paciente | `/laboratorio/recepcion` | `LabReception` | no navega | terminó en /dashboard |
| paciente | `/laboratorio/cola` | `Diagnostics` | no navega | terminó en /dashboard |
| paciente | `/administration/laboratory-results` | `LaboratoryResults` | no navega | terminó en /dashboard |
| paciente | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega | terminó en /dashboard |
| paciente | `/administration/laboratory-branches` | `OrganizationBranches` | no navega | terminó en /dashboard |
| paciente | `/administration/getting-started` | `GettingStarted` | no navega | terminó en /dashboard |
| paciente | `/my-account/articles` | `MedicalArticles` | no navega | terminó en /dashboard |
| paciente | `/my-account/edit` | `PractitionerProfileEdit` | no navega | terminó en /dashboard |
| paciente | `/onboarding` | `OnboardingPractitioner` | no navega | terminó en /dashboard |
| sin sesión | `/terminologia/versiones-importar` | `TerminologiaVersionesImportar` | no navega | terminó en /auth |
| sin sesión | `/terminologia/versiones-listado` | `TerminologiaVersionesListado` | no navega | terminó en /auth |
| sin sesión | `/terminologia/versiones-publicar` | `TerminologiaVersionesPublicar` | no navega | terminó en /auth |
| sin sesión | `/terminologia/sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | no navega | terminó en /auth |
| sin sesión | `/terminologia/conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | no navega | terminó en /auth |
| sin sesión | `/terminologia/consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | no navega | terminó en /auth |
| sin sesión | `/terminologia/conceptos-listado` | `TerminologiaConceptosListado` | no navega | terminó en /auth |
| sin sesión | `/directorio/organizaciones-listado` | `DirectorioOrganizacionesListado` | no navega | terminó en /auth |
| sin sesión | `/directorio/organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | no navega | terminó en /auth |
| sin sesión | `/directorio/membresias-formulario` | `DirectorioMembresiasFormulario` | no navega | terminó en /auth |
| sin sesión | `/directorio/membresias-listado` | `DirectorioMembresiasListado` | no navega | terminó en /auth |
| sin sesión | `/directorio/sucursales-formulario` | `DirectorioSucursalesFormulario` | no navega | terminó en /auth |
| sin sesión | `/directorio/sucursales-listado` | `DirectorioSucursalesListado` | no navega | terminó en /auth |
| sin sesión | `/directorio/organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | no navega | terminó en /auth |
| sin sesión | `/directorio/organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | no navega | terminó en /auth |
| sin sesión | `/personas/pacientes-formulario` | `PersonasPacientesFormulario` | no navega | terminó en /auth |
| sin sesión | `/personas/pacientes-fusionar` | `PersonasPacientesFusionar` | no navega | terminó en /auth |
| sin sesión | `/personas/pacientes-listado` | `PersonasPacientesListado` | no navega | terminó en /auth |
| sin sesión | `/personas/pacientes-revertir` | `PersonasPacientesRevertir` | no navega | terminó en /auth |
| sin sesión | `/personas/personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | no navega | terminó en /auth |
| sin sesión | `/personas/personas-relacionadas-listado` | `PersonasRelacionadasListado` | no navega | terminó en /auth |
| sin sesión | `/personas/resumen-propio-listado` | `PersonasResumenPropioListado` | no navega | terminó en /auth |
| sin sesión | `/buscar/profesionales-listado` | `BuscarProfesionalesListado` | no navega | terminó en /search/practitioners |
| sin sesión | `/buscar/laboratorios-listado` | `BuscarLaboratoriosListado` | no navega | terminó en /search/diagnostics |
| sin sesión | `/buscar/aseguradoras-listado` | `BuscarAseguradorasListado` | no navega | terminó en /search/insurers |
| sin sesión | `/buscar/perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | no navega | terminó en /search/practitioners |
| sin sesión | `/buscar/perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | no navega | terminó en /search/hospitals |
| sin sesión | `/buscar/perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | no navega | terminó en /search/medications |
| sin sesión | `/buscar/perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | no navega | terminó en /search/diagnostics |
| sin sesión | `/buscar/perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | no navega | terminó en /search/insurers |
| sin sesión | `/buscar/calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | no navega | terminó en /search/practitioners |
| sin sesión | `/inicio` | `InicioPortada` | no navega | terminó en /posts |

## Matriz completa

| Rol | Ruta | Componente | Estado |
|---|---|---|---|
| administrador | `/dashboard` | `Dashboard` | ok |
| administrador | `/tutorials` | `TutorialsCenter` | ok |
| administrador | `/messaging` | `Messaging` | ok |
| administrador | `/directories` | `DirectoriesOverview` | ok |
| administrador | `/directory` | `PractitionersDirectory` | denegada |
| administrador | `/groups` | `Groups` | ok |
| administrador | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| administrador | `/clinics-directory` | `ClinicsDirectory` | ok |
| administrador | `/pharmacies-directory` | `PharmaciesDirectory` | ok |
| administrador | `/insurers-directory` | `InsurersDirectory` | ok |
| administrador | `/schedule` | `Agenda` | ok |
| administrador | `/medical-records` | `ClinicalRecord` | ok |
| administrador | `/diagnostics` | `Diagnostics` | ok |
| administrador | `/interventions` | `Interventions` | ok |
| administrador | `/lab-visits` | `DoctorVisits` | ok |
| administrador | `/my-visits` | `VisitorVisits` | error de consola |
| administrador | `/glossary` | `Glossary` | error de consola |
| administrador | `/form-builder` | `FormBuilder` | denegada |
| administrador | `/my-services` | `MyServices` | ok |
| administrador | `/my-quotations` | `QuotationList` | ok |
| administrador | `/questionnaires` | `SurveysHome` | error de consola |
| administrador | `/administration/patients` | `PatientList` | ok |
| administrador | `/administration/users` | `UserRegistration` | error de consola |
| administrador | `/administration/organizations` | `OrganizationList` | ok |
| administrador | `/administration/insurance` | `InsuranceCatalog` | ok |
| administrador | `/administration/brokers` | `BrokerDirectory` | ok |
| administrador | `/administration/insurance-claims` | `InsuranceClaims` | ok |
| administrador | `/administration/insurance-analytics` | `InsuranceAnalytics` | ok |
| administrador | `/administration/received-claims` | `ReceivedClaims` | error de consola |
| administrador | `/administration/insurance-patients` | `InsurancePatients` | error de consola |
| administrador | `/administration/insurance-campaigns` | `InsuranceCampaigns` | error de consola |
| administrador | `/administration/delegated-access` | `DelegatedAccessHome` | ok |
| administrador | `/administration/identity-providers` | `AuthProvidersHome` | ok |
| administrador | `/administration/identity-assurance` | `IdentityAdminHome` | ok |
| administrador | `/administration/terminology` | `TerminologyCatalog` | ok |
| administrador | `/administration/content-packs` | `ContentPacks` | ok |
| administrador | `/administration/moderation` | `Moderation` | ok |
| administrador | `/administration/data-catalog` | `DataCatalog` | ok |
| administrador | `/administration/web-analytics` | `WebAnalytics` | ok |
| administrador | `/administration/qa-lab` | `QaLab` | ok |
| administrador | `/administration/operations` | `Operations` | ok |
| administrador | `/administration/health-context` | `HealthContextHome` | ok |
| administrador | `/administration/geolocation` | `GeoHome` | ok |
| administrador | `/administration/services-catalog` | `ServicesCatalog` | ok |
| administrador | `/administration/medical-organization` | `MedicalOrganization` | ok |
| administrador | `/administration/medical-laboratory` | `MedicalLaboratory` | ok |
| administrador | `/administration/clinical-forms` | `ClinicalForms` | ok |
| administrador | `/billing` | `Billing` | ok |
| administrador | `/administration/pharma-lab` | `PharmaLabHome` | ok |
| administrador | `/administration/accounting` | `Resumen` | ok |
| administrador | `/my-account/dependents` | `Dependents` | ok |
| administrador | `/my-account` | `MyAccount` | ok |
| administrador | `/my-account/appointments` | `Appointments` | ok |
| administrador | `/my-account/medical-record` | `MedicalRecord` | ok |
| administrador | `/my-account/diagnostic-results` | `DiagnosticResults` | ok |
| administrador | `/my-account/diagnostic-orders` | `DiagnosticOrders` | ok |
| administrador | `/my-account/cotizaciones` | `Cotizaciones` | ok |
| administrador | `/my-account/questionnaires` | `Questionnaires` | ok |
| administrador | `/settings` | `Settings` | ok |
| administrador | `/notification-center` | `NotificationCenter` | ok |
| administrador | `/my-account/identity` | `IdentityHub` | ok |
| administrador | `/my-account/pharmacy` | `StoreFront` | ok |
| administrador | `/my-account/pharmacy-orders` | `PharmacyOrders` | ok |
| administrador | `/my-account/loyalty` | `SectionPlaceholder` | denegada |
| administrador | `/my-account/promotions` | `Promotions` | ok |
| administrador | `/my-account/spending` | `Spending` | ok |
| administrador | `/my-account/invoices` | `MyInvoices` | ok |
| administrador | `/my-account/requests` | `MyRequests` | ok |
| administrador | `/administration/my-practice` | `MyPractice` | ok |
| administrador | `/administration/my-organization` | `OrganizationPanel` | ok |
| administrador | `/administration/pharmacy` | `PharmacySummaryPage` | no navega |
| administrador | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega |
| administrador | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega |
| administrador | `/administration/pharmacy-import` | `PharmacyImport` | no navega |
| administrador | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega |
| administrador | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega |
| administrador | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega |
| administrador | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega |
| administrador | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega |
| administrador | `/administration/laboratory` | `LaboratorySummaryPage` | no navega |
| administrador | `/laboratorio/recepcion` | `LabReception` | no navega |
| administrador | `/laboratorio/cola` | `Diagnostics` | no navega |
| administrador | `/administration/laboratory-results` | `LaboratoryResults` | no navega |
| administrador | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega |
| administrador | `/administration/laboratory-branches` | `OrganizationBranches` | no navega |
| administrador | `/administration/accounting/assets-liabilities` | `AssetsLiabilities` | ok |
| administrador | `/administration/accounting/cockpit` | `Cockpit` | ok |
| administrador | `/administration/accounting/libros` | `Accounting` | ok |
| administrador | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | ok |
| administrador | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | error de consola |
| administrador | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | ok |
| administrador | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | ok |
| administrador | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | ok |
| administrador | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | ok |
| administrador | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | ok |
| administrador | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | ok |
| administrador | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | ok |
| administrador | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | error de consola |
| administrador | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | ok |
| administrador | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | ok |
| administrador | `/administration/geolocation/geofences/new` | `GeofenceForm` | ok |
| administrador | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | ok |
| administrador | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | ok |
| administrador | `/administration/geolocation/subjects/last-position` | `LastPosition` | ok |
| administrador | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | ok |
| administrador | `/administration/geolocation/subjects/pings` | `PingIngest` | ok |
| administrador | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | ok |
| administrador | `/administration/geolocation/trips/close` | `TripClose` | error de consola |
| administrador | `/administration/geolocation/trips/new` | `TripForm` | ok |
| administrador | `/administration/getting-started` | `GettingStarted` | ok |
| administrador | `/administration/health-context/agents/new` | `AgentForm` | ok |
| administrador | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | ok |
| administrador | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | ok |
| administrador | `/administration/health-context/contexts/new` | `ContextForm` | ok |
| administrador | `/administration/health-context/contexts/resolve` | `ContextResolve` | ok |
| administrador | `/administration/health-context/observations/new` | `ObservationForm` | ok |
| administrador | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | ok |
| administrador | `/administration/health-context/schedules/new` | `ScheduleForm` | ok |
| administrador | `/administration/health-context/sources/new` | `SourceForm` | ok |
| administrador | `/administration/health-context/versions/new` | `VersionForm` | ok |
| administrador | `/administration/health-context/versions/publish` | `VersionPublish` | ok |
| administrador | `/administration/health-context/versions/supersede` | `VersionSupersede` | ok |
| administrador | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | ok |
| administrador | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | ok |
| administrador | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | ok |
| administrador | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | ok |
| administrador | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | error de consola |
| administrador | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | ok |
| administrador | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | ok |
| administrador | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | ok |
| administrador | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | ok |
| administrador | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | ok |
| administrador | `/administration/identity-assurance/checks/result` | `CheckResultForm` | ok |
| administrador | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | ok |
| administrador | `/administration/identity-assurance/queue` | `CaseQueue` | ok |
| administrador | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | ok |
| administrador | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | ok |
| administrador | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | ok |
| administrador | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | ok |
| administrador | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | ok |
| administrador | `/administration/identity-providers/keys/new` | `SigningKeyForm` | ok |
| administrador | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | ok |
| administrador | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | ok |
| administrador | `/administration/identity-providers/login/start` | `LoginStartForm` | ok |
| administrador | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | ok |
| administrador | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | ok |
| administrador | `/administration/identity-providers/providers/new` | `ProviderForm` | ok |
| administrador | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | ok |
| administrador | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | ok |
| administrador | `/administration/organizations/new` | `OrganizationNew` | ok |
| administrador | `/administration/patients/assisted-registration` | `AssistedRegistration` | ok |
| administrador | `/administration/patients/merge` | `PatientMerge` | ok |
| administrador | `/administration/patients/new` | `PatientNew` | ok |
| administrador | `/administration/services-catalog/import` | `ProcedureImport` | ok |
| administrador | `/administration/terminology/import` | `VersionImport` | ok |
| administrador | `/glossary/network` | `GlossaryNetwork` | ok |
| administrador | `/my-account/access-requests` | `AccessRequests` | ok |
| administrador | `/my-account/articles` | `MedicalArticles` | ok |
| administrador | `/my-account/edit` | `PractitionerProfileEdit` | ok |
| administrador | `/my-account/pharmacy-orders/checkout` | `Checkout` | error de consola |
| administrador | `/my-account/pharmacy-orders/new` | `NewOrder` | ok |
| administrador | `/my-account/pharmacy/cart` | `CartPage` | ok |
| administrador | `/my-account/pharmacy/prescriptions` | `PrescriptionsPage` | ok |
| administrador | `/my-account/profile/edit` | `PatientProfileEdit` | error de consola |
| administrador | `/my-quotations/new` | `QuotationForm` | ok |
| administrador | `/onboarding` | `OnboardingPractitioner` | error de consola |
| administrador | `/schedule/appointment/new` | `AppointmentNew` | ok |
| administrador | `/schedule/blocks` | `Blocks` | ok |
| administrador | `/schedule/edit` | `AgendaCreate` | ok |
| administrador | `/schedule/new` | `AgendaCreate` | ok |
| doctora | `/dashboard` | `Dashboard` | ok |
| doctora | `/tutorials` | `TutorialsCenter` | ok |
| doctora | `/messaging` | `Messaging` | ok |
| doctora | `/directories` | `DirectoriesOverview` | ok |
| doctora | `/directory` | `PractitionersDirectory` | ok |
| doctora | `/groups` | `Groups` | ok |
| doctora | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| doctora | `/clinics-directory` | `ClinicsDirectory` | ok |
| doctora | `/pharmacies-directory` | `PharmaciesDirectory` | ok |
| doctora | `/insurers-directory` | `InsurersDirectory` | ok |
| doctora | `/schedule` | `Agenda` | ok |
| doctora | `/medical-records` | `ClinicalRecord` | ok |
| doctora | `/diagnostics` | `Diagnostics` | ok |
| doctora | `/interventions` | `Interventions` | denegada |
| doctora | `/lab-visits` | `DoctorVisits` | ok |
| doctora | `/my-visits` | `VisitorVisits` | denegada |
| doctora | `/glossary` | `Glossary` | error de consola |
| doctora | `/form-builder` | `FormBuilder` | ok |
| doctora | `/my-services` | `MyServices` | ok |
| doctora | `/my-quotations` | `QuotationList` | ok |
| doctora | `/questionnaires` | `SurveysHome` | ok |
| doctora | `/administration/patients` | `PatientList` | denegada |
| doctora | `/administration/users` | `UserRegistration` | denegada |
| doctora | `/administration/organizations` | `OrganizationList` | denegada |
| doctora | `/administration/insurance` | `InsuranceCatalog` | no navega |
| doctora | `/administration/brokers` | `BrokerDirectory` | denegada |
| doctora | `/administration/insurance-claims` | `InsuranceClaims` | denegada |
| doctora | `/administration/insurance-analytics` | `InsuranceAnalytics` | no navega |
| doctora | `/administration/received-claims` | `ReceivedClaims` | no navega |
| doctora | `/administration/insurance-patients` | `InsurancePatients` | no navega |
| doctora | `/administration/insurance-campaigns` | `InsuranceCampaigns` | no navega |
| doctora | `/administration/delegated-access` | `DelegatedAccessHome` | denegada |
| doctora | `/administration/identity-providers` | `AuthProvidersHome` | denegada |
| doctora | `/administration/identity-assurance` | `IdentityAdminHome` | denegada |
| doctora | `/administration/terminology` | `TerminologyCatalog` | denegada |
| doctora | `/administration/content-packs` | `ContentPacks` | denegada |
| doctora | `/administration/moderation` | `Moderation` | denegada |
| doctora | `/administration/data-catalog` | `DataCatalog` | denegada |
| doctora | `/administration/web-analytics` | `WebAnalytics` | denegada |
| doctora | `/administration/qa-lab` | `QaLab` | denegada |
| doctora | `/administration/operations` | `Operations` | denegada |
| doctora | `/administration/health-context` | `HealthContextHome` | denegada |
| doctora | `/administration/geolocation` | `GeoHome` | denegada |
| doctora | `/administration/services-catalog` | `ServicesCatalog` | denegada |
| doctora | `/administration/medical-organization` | `MedicalOrganization` | ok |
| doctora | `/administration/medical-laboratory` | `MedicalLaboratory` | denegada |
| doctora | `/administration/clinical-forms` | `ClinicalForms` | denegada |
| doctora | `/billing` | `Billing` | denegada |
| doctora | `/administration/pharma-lab` | `PharmaLabHome` | denegada |
| doctora | `/administration/accounting` | `Resumen` | ok |
| doctora | `/my-account/dependents` | `Dependents` | no navega |
| doctora | `/my-account` | `MyAccount` | ok |
| doctora | `/my-account/appointments` | `Appointments` | no navega |
| doctora | `/my-account/medical-record` | `MedicalRecord` | no navega |
| doctora | `/my-account/diagnostic-results` | `DiagnosticResults` | no navega |
| doctora | `/my-account/diagnostic-orders` | `DiagnosticOrders` | no navega |
| doctora | `/my-account/cotizaciones` | `Cotizaciones` | no navega |
| doctora | `/my-account/questionnaires` | `Questionnaires` | no navega |
| doctora | `/settings` | `Settings` | ok |
| doctora | `/notification-center` | `NotificationCenter` | ok |
| doctora | `/my-account/identity` | `IdentityHub` | ok |
| doctora | `/my-account/pharmacy` | `StoreFront` | denegada |
| doctora | `/my-account/pharmacy-orders` | `PharmacyOrders` | denegada |
| doctora | `/my-account/loyalty` | `SectionPlaceholder` | denegada |
| doctora | `/my-account/promotions` | `Promotions` | denegada |
| doctora | `/my-account/spending` | `Spending` | denegada |
| doctora | `/my-account/invoices` | `MyInvoices` | ok |
| doctora | `/my-account/requests` | `MyRequests` | ok |
| doctora | `/administration/my-practice` | `MyPractice` | ok |
| doctora | `/administration/my-organization` | `OrganizationPanel` | no navega |
| doctora | `/administration/pharmacy` | `PharmacySummaryPage` | no navega |
| doctora | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega |
| doctora | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega |
| doctora | `/administration/pharmacy-import` | `PharmacyImport` | no navega |
| doctora | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega |
| doctora | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega |
| doctora | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega |
| doctora | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega |
| doctora | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega |
| doctora | `/administration/laboratory` | `LaboratorySummaryPage` | no navega |
| doctora | `/laboratorio/recepcion` | `LabReception` | no navega |
| doctora | `/laboratorio/cola` | `Diagnostics` | no navega |
| doctora | `/administration/laboratory-results` | `LaboratoryResults` | no navega |
| doctora | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega |
| doctora | `/administration/laboratory-branches` | `OrganizationBranches` | no navega |
| doctora | `/administration/accounting/assets-liabilities` | `AssetsLiabilities` | ok |
| doctora | `/administration/accounting/cockpit` | `Cockpit` | ok |
| doctora | `/administration/accounting/libros` | `Accounting` | ok |
| doctora | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | denegada |
| doctora | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | denegada |
| doctora | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | denegada |
| doctora | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | denegada |
| doctora | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | denegada |
| doctora | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | denegada |
| doctora | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | denegada |
| doctora | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | denegada |
| doctora | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | denegada |
| doctora | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | denegada |
| doctora | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | denegada |
| doctora | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | denegada |
| doctora | `/administration/geolocation/geofences/new` | `GeofenceForm` | denegada |
| doctora | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | denegada |
| doctora | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | denegada |
| doctora | `/administration/geolocation/subjects/last-position` | `LastPosition` | denegada |
| doctora | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | denegada |
| doctora | `/administration/geolocation/subjects/pings` | `PingIngest` | denegada |
| doctora | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | denegada |
| doctora | `/administration/geolocation/trips/close` | `TripClose` | denegada |
| doctora | `/administration/geolocation/trips/new` | `TripForm` | denegada |
| doctora | `/administration/getting-started` | `GettingStarted` | no navega |
| doctora | `/administration/health-context/agents/new` | `AgentForm` | denegada |
| doctora | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | denegada |
| doctora | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | denegada |
| doctora | `/administration/health-context/contexts/new` | `ContextForm` | denegada |
| doctora | `/administration/health-context/contexts/resolve` | `ContextResolve` | denegada |
| doctora | `/administration/health-context/observations/new` | `ObservationForm` | denegada |
| doctora | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | denegada |
| doctora | `/administration/health-context/schedules/new` | `ScheduleForm` | denegada |
| doctora | `/administration/health-context/sources/new` | `SourceForm` | denegada |
| doctora | `/administration/health-context/versions/new` | `VersionForm` | denegada |
| doctora | `/administration/health-context/versions/publish` | `VersionPublish` | denegada |
| doctora | `/administration/health-context/versions/supersede` | `VersionSupersede` | denegada |
| doctora | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | denegada |
| doctora | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | denegada |
| doctora | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | denegada |
| doctora | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | denegada |
| doctora | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | denegada |
| doctora | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | denegada |
| doctora | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | denegada |
| doctora | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | denegada |
| doctora | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | denegada |
| doctora | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | denegada |
| doctora | `/administration/identity-assurance/checks/result` | `CheckResultForm` | denegada |
| doctora | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | denegada |
| doctora | `/administration/identity-assurance/queue` | `CaseQueue` | denegada |
| doctora | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | denegada |
| doctora | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | denegada |
| doctora | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | denegada |
| doctora | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | denegada |
| doctora | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | denegada |
| doctora | `/administration/identity-providers/keys/new` | `SigningKeyForm` | denegada |
| doctora | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | denegada |
| doctora | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | denegada |
| doctora | `/administration/identity-providers/login/start` | `LoginStartForm` | denegada |
| doctora | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | denegada |
| doctora | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | denegada |
| doctora | `/administration/identity-providers/providers/new` | `ProviderForm` | denegada |
| doctora | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | denegada |
| doctora | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | denegada |
| doctora | `/administration/organizations/new` | `OrganizationNew` | denegada |
| doctora | `/administration/patients/assisted-registration` | `AssistedRegistration` | ok |
| doctora | `/administration/patients/merge` | `PatientMerge` | denegada |
| doctora | `/administration/patients/new` | `PatientNew` | denegada |
| doctora | `/administration/services-catalog/import` | `ProcedureImport` | denegada |
| doctora | `/administration/terminology/import` | `VersionImport` | denegada |
| doctora | `/glossary/network` | `GlossaryNetwork` | ok |
| doctora | `/my-account/access-requests` | `AccessRequests` | ok |
| doctora | `/my-account/articles` | `MedicalArticles` | ok |
| doctora | `/my-account/edit` | `PractitionerProfileEdit` | error de consola |
| doctora | `/my-account/pharmacy-orders/checkout` | `Checkout` | denegada |
| doctora | `/my-account/pharmacy-orders/new` | `NewOrder` | denegada |
| doctora | `/my-account/pharmacy/cart` | `CartPage` | denegada |
| doctora | `/my-account/pharmacy/prescriptions` | `PrescriptionsPage` | denegada |
| doctora | `/my-account/profile/edit` | `PatientProfileEdit` | ok |
| doctora | `/my-quotations/new` | `QuotationForm` | ok |
| doctora | `/onboarding` | `OnboardingPractitioner` | error de consola |
| doctora | `/schedule/appointment/new` | `AppointmentNew` | ok |
| doctora | `/schedule/blocks` | `Blocks` | ok |
| doctora | `/schedule/edit` | `AgendaCreate` | ok |
| doctora | `/schedule/new` | `AgendaCreate` | ok |
| paciente | `/dashboard` | `Dashboard` | ok |
| paciente | `/tutorials` | `TutorialsCenter` | ok |
| paciente | `/messaging` | `Messaging` | ok |
| paciente | `/directories` | `DirectoriesOverview` | ok |
| paciente | `/directory` | `PractitionersDirectory` | ok |
| paciente | `/groups` | `Groups` | denegada |
| paciente | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| paciente | `/clinics-directory` | `ClinicsDirectory` | ok |
| paciente | `/pharmacies-directory` | `PharmaciesDirectory` | ok |
| paciente | `/insurers-directory` | `InsurersDirectory` | ok |
| paciente | `/schedule` | `Agenda` | denegada |
| paciente | `/medical-records` | `ClinicalRecord` | denegada |
| paciente | `/diagnostics` | `Diagnostics` | denegada |
| paciente | `/interventions` | `Interventions` | denegada |
| paciente | `/lab-visits` | `DoctorVisits` | denegada |
| paciente | `/my-visits` | `VisitorVisits` | denegada |
| paciente | `/glossary` | `Glossary` | denegada |
| paciente | `/form-builder` | `FormBuilder` | denegada |
| paciente | `/my-services` | `MyServices` | denegada |
| paciente | `/my-quotations` | `QuotationList` | denegada |
| paciente | `/questionnaires` | `SurveysHome` | denegada |
| paciente | `/administration/patients` | `PatientList` | denegada |
| paciente | `/administration/users` | `UserRegistration` | denegada |
| paciente | `/administration/organizations` | `OrganizationList` | denegada |
| paciente | `/administration/insurance` | `InsuranceCatalog` | no navega |
| paciente | `/administration/brokers` | `BrokerDirectory` | denegada |
| paciente | `/administration/insurance-claims` | `InsuranceClaims` | denegada |
| paciente | `/administration/insurance-analytics` | `InsuranceAnalytics` | no navega |
| paciente | `/administration/received-claims` | `ReceivedClaims` | no navega |
| paciente | `/administration/insurance-patients` | `InsurancePatients` | no navega |
| paciente | `/administration/insurance-campaigns` | `InsuranceCampaigns` | no navega |
| paciente | `/administration/delegated-access` | `DelegatedAccessHome` | denegada |
| paciente | `/administration/identity-providers` | `AuthProvidersHome` | denegada |
| paciente | `/administration/identity-assurance` | `IdentityAdminHome` | denegada |
| paciente | `/administration/terminology` | `TerminologyCatalog` | denegada |
| paciente | `/administration/content-packs` | `ContentPacks` | denegada |
| paciente | `/administration/moderation` | `Moderation` | denegada |
| paciente | `/administration/data-catalog` | `DataCatalog` | denegada |
| paciente | `/administration/web-analytics` | `WebAnalytics` | denegada |
| paciente | `/administration/qa-lab` | `QaLab` | denegada |
| paciente | `/administration/operations` | `Operations` | denegada |
| paciente | `/administration/health-context` | `HealthContextHome` | denegada |
| paciente | `/administration/geolocation` | `GeoHome` | denegada |
| paciente | `/administration/services-catalog` | `ServicesCatalog` | denegada |
| paciente | `/administration/medical-organization` | `MedicalOrganization` | denegada |
| paciente | `/administration/medical-laboratory` | `MedicalLaboratory` | denegada |
| paciente | `/administration/clinical-forms` | `ClinicalForms` | denegada |
| paciente | `/billing` | `Billing` | denegada |
| paciente | `/administration/pharma-lab` | `PharmaLabHome` | denegada |
| paciente | `/administration/accounting` | `Resumen` | denegada |
| paciente | `/my-account/dependents` | `Dependents` | ok |
| paciente | `/my-account` | `MyAccount` | ok |
| paciente | `/my-account/appointments` | `Appointments` | ok |
| paciente | `/my-account/medical-record` | `MedicalRecord` | ok |
| paciente | `/my-account/diagnostic-results` | `DiagnosticResults` | ok |
| paciente | `/my-account/diagnostic-orders` | `DiagnosticOrders` | ok |
| paciente | `/my-account/cotizaciones` | `Cotizaciones` | ok |
| paciente | `/my-account/questionnaires` | `Questionnaires` | ok |
| paciente | `/settings` | `Settings` | error de consola |
| paciente | `/notification-center` | `NotificationCenter` | ok |
| paciente | `/my-account/identity` | `IdentityHub` | ok |
| paciente | `/my-account/pharmacy` | `StoreFront` | ok |
| paciente | `/my-account/pharmacy-orders` | `PharmacyOrders` | ok |
| paciente | `/my-account/loyalty` | `SectionPlaceholder` | denegada |
| paciente | `/my-account/promotions` | `Promotions` | ok |
| paciente | `/my-account/spending` | `Spending` | error de consola |
| paciente | `/my-account/invoices` | `MyInvoices` | ok |
| paciente | `/my-account/requests` | `MyRequests` | ok |
| paciente | `/administration/my-practice` | `MyPractice` | denegada |
| paciente | `/administration/my-organization` | `OrganizationPanel` | no navega |
| paciente | `/administration/pharmacy` | `PharmacySummaryPage` | no navega |
| paciente | `/administration/pharmacy-catalog` | `PharmacyProducts` | no navega |
| paciente | `/administration/pharmacy-categories` | `PharmacyCategories` | no navega |
| paciente | `/administration/pharmacy-import` | `PharmacyImport` | no navega |
| paciente | `/administration/pharmacy-inventory` | `PharmacyInventory` | no navega |
| paciente | `/administration/pharmacy-prices` | `PharmacyPrices` | no navega |
| paciente | `/administration/pharmacy-orders` | `PharmacyInbox` | no navega |
| paciente | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | no navega |
| paciente | `/administration/pharmacy-profile` | `SectionPlaceholder` | no navega |
| paciente | `/administration/laboratory` | `LaboratorySummaryPage` | no navega |
| paciente | `/laboratorio/recepcion` | `LabReception` | no navega |
| paciente | `/laboratorio/cola` | `Diagnostics` | no navega |
| paciente | `/administration/laboratory-results` | `LaboratoryResults` | no navega |
| paciente | `/administration/laboratory-prices` | `LaboratoryPrices` | no navega |
| paciente | `/administration/laboratory-branches` | `OrganizationBranches` | no navega |
| paciente | `/administration/accounting/assets-liabilities` | `AssetsLiabilities` | denegada |
| paciente | `/administration/accounting/cockpit` | `Cockpit` | denegada |
| paciente | `/administration/accounting/libros` | `Accounting` | denegada |
| paciente | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | denegada |
| paciente | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | denegada |
| paciente | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | denegada |
| paciente | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | denegada |
| paciente | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | denegada |
| paciente | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | denegada |
| paciente | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | denegada |
| paciente | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | denegada |
| paciente | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | denegada |
| paciente | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | denegada |
| paciente | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | denegada |
| paciente | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | denegada |
| paciente | `/administration/geolocation/geofences/new` | `GeofenceForm` | denegada |
| paciente | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | denegada |
| paciente | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | denegada |
| paciente | `/administration/geolocation/subjects/last-position` | `LastPosition` | denegada |
| paciente | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | denegada |
| paciente | `/administration/geolocation/subjects/pings` | `PingIngest` | denegada |
| paciente | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | denegada |
| paciente | `/administration/geolocation/trips/close` | `TripClose` | denegada |
| paciente | `/administration/geolocation/trips/new` | `TripForm` | denegada |
| paciente | `/administration/getting-started` | `GettingStarted` | no navega |
| paciente | `/administration/health-context/agents/new` | `AgentForm` | denegada |
| paciente | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | denegada |
| paciente | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | denegada |
| paciente | `/administration/health-context/contexts/new` | `ContextForm` | denegada |
| paciente | `/administration/health-context/contexts/resolve` | `ContextResolve` | denegada |
| paciente | `/administration/health-context/observations/new` | `ObservationForm` | denegada |
| paciente | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | denegada |
| paciente | `/administration/health-context/schedules/new` | `ScheduleForm` | denegada |
| paciente | `/administration/health-context/sources/new` | `SourceForm` | denegada |
| paciente | `/administration/health-context/versions/new` | `VersionForm` | denegada |
| paciente | `/administration/health-context/versions/publish` | `VersionPublish` | denegada |
| paciente | `/administration/health-context/versions/supersede` | `VersionSupersede` | denegada |
| paciente | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | denegada |
| paciente | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | denegada |
| paciente | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | denegada |
| paciente | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | denegada |
| paciente | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | denegada |
| paciente | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | denegada |
| paciente | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | denegada |
| paciente | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | denegada |
| paciente | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | denegada |
| paciente | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | denegada |
| paciente | `/administration/identity-assurance/checks/result` | `CheckResultForm` | denegada |
| paciente | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | denegada |
| paciente | `/administration/identity-assurance/queue` | `CaseQueue` | denegada |
| paciente | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | denegada |
| paciente | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | denegada |
| paciente | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | denegada |
| paciente | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | denegada |
| paciente | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | denegada |
| paciente | `/administration/identity-providers/keys/new` | `SigningKeyForm` | denegada |
| paciente | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | denegada |
| paciente | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | denegada |
| paciente | `/administration/identity-providers/login/start` | `LoginStartForm` | denegada |
| paciente | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | denegada |
| paciente | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | denegada |
| paciente | `/administration/identity-providers/providers/new` | `ProviderForm` | denegada |
| paciente | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | denegada |
| paciente | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | denegada |
| paciente | `/administration/organizations/new` | `OrganizationNew` | denegada |
| paciente | `/administration/patients/assisted-registration` | `AssistedRegistration` | ok |
| paciente | `/administration/patients/merge` | `PatientMerge` | denegada |
| paciente | `/administration/patients/new` | `PatientNew` | denegada |
| paciente | `/administration/services-catalog/import` | `ProcedureImport` | denegada |
| paciente | `/administration/terminology/import` | `VersionImport` | denegada |
| paciente | `/glossary/network` | `GlossaryNetwork` | denegada |
| paciente | `/my-account/access-requests` | `AccessRequests` | ok |
| paciente | `/my-account/articles` | `MedicalArticles` | no navega |
| paciente | `/my-account/edit` | `PractitionerProfileEdit` | no navega |
| paciente | `/my-account/pharmacy-orders/checkout` | `Checkout` | ok |
| paciente | `/my-account/pharmacy-orders/new` | `NewOrder` | ok |
| paciente | `/my-account/pharmacy/cart` | `CartPage` | ok |
| paciente | `/my-account/pharmacy/prescriptions` | `PrescriptionsPage` | ok |
| paciente | `/my-account/profile/edit` | `PatientProfileEdit` | ok |
| paciente | `/my-quotations/new` | `QuotationForm` | denegada |
| paciente | `/onboarding` | `OnboardingPractitioner` | no navega |
| paciente | `/schedule/appointment/new` | `AppointmentNew` | denegada |
| paciente | `/schedule/blocks` | `Blocks` | denegada |
| paciente | `/schedule/edit` | `AgendaCreate` | denegada |
| paciente | `/schedule/new` | `AgendaCreate` | denegada |
| sin sesión | `/datos-compartidos/versiones-internas-escanear` | `DatosCompartidosVersionesInternasEscanear` | ok |
| sin sesión | `/datos-compartidos/versiones-internas-listado` | `DatosCompartidosVersionesInternasListado` | ok |
| sin sesión | `/datos-compartidos/archivos-eliminar` | `DatosCompartidosArchivosEliminar` | ok |
| sin sesión | `/datos-compartidos/archivos-formulario` | `DatosCompartidosArchivosFormulario` | ok |
| sin sesión | `/datos-compartidos/archivos-listado` | `DatosCompartidosArchivosListado` | ok |
| sin sesión | `/datos-compartidos/archivos-obtener-enlace` | `DatosCompartidosArchivosObtenerEnlace` | ok |
| sin sesión | `/datos-compartidos/archivos-subir` | `DatosCompartidosArchivosSubir` | ok |
| sin sesión | `/datos-compartidos/contenido-detalle` | `DatosCompartidosContenidoDetalle` | ok |
| sin sesión | `/datos-compartidos/vinculos-formulario` | `DatosCompartidosVinculosFormulario` | ok |
| sin sesión | `/datos-compartidos/vinculos-listado` | `DatosCompartidosVinculosListado` | ok |
| sin sesión | `/datos-compartidos/versiones-formulario` | `DatosCompartidosVersionesFormulario` | ok |
| sin sesión | `/datos-compartidos/versiones-listado` | `DatosCompartidosVersionesListado` | ok |
| sin sesión | `/datos-compartidos/puntos-de-contacto-formulario` | `DatosCompartidosPuntosDeContactoFormulario` | ok |
| sin sesión | `/datos-compartidos/puntos-de-contacto-listado` | `DatosCompartidosPuntosDeContactoListado` | ok |
| sin sesión | `/datos-compartidos/puntos-de-contacto-verificar` | `DatosCompartidosPuntosDeContactoVerificar` | ok |
| sin sesión | `/datos-compartidos/direcciones-formulario` | `DatosCompartidosDireccionesFormulario` | ok |
| sin sesión | `/datos-compartidos/direcciones-listado` | `DatosCompartidosDireccionesListado` | ok |
| sin sesión | `/datos-compartidos/identificadores-formulario` | `DatosCompartidosIdentificadoresFormulario` | ok |
| sin sesión | `/datos-compartidos/identificadores-listado` | `DatosCompartidosIdentificadoresListado` | ok |
| sin sesión | `/datos-compartidos/derivados-formulario` | `DatosCompartidosDerivadosFormulario` | ok |
| sin sesión | `/datos-compartidos/derivados-listado` | `DatosCompartidosDerivadosListado` | ok |
| sin sesión | `/terminologia/versiones-importar` | `TerminologiaVersionesImportar` | no navega |
| sin sesión | `/terminologia/versiones-listado` | `TerminologiaVersionesListado` | no navega |
| sin sesión | `/terminologia/versiones-publicar` | `TerminologiaVersionesPublicar` | no navega |
| sin sesión | `/terminologia/expansion-de-conjunto-de-valores-formulario` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | ok |
| sin sesión | `/terminologia/sistemas-de-codigos-formulario` | `TerminologiaSistemasDeCodigosFormulario` | ok |
| sin sesión | `/terminologia/sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | no navega |
| sin sesión | `/terminologia/versiones-de-sistema-formulario` | `TerminologiaVersionesDeSistemaFormulario` | ok |
| sin sesión | `/terminologia/versiones-de-sistema-listado` | `TerminologiaVersionesDeSistemaListado` | ok |
| sin sesión | `/terminologia/deprecacion-de-concepto-formulario` | `TerminologiaDeprecacionDeConceptoFormulario` | ok |
| sin sesión | `/terminologia/designaciones-formulario` | `TerminologiaDesignacionesFormulario` | ok |
| sin sesión | `/terminologia/designaciones-listado` | `TerminologiaDesignacionesListado` | ok |
| sin sesión | `/terminologia/propiedades-formulario` | `TerminologiaPropiedadesFormulario` | ok |
| sin sesión | `/terminologia/propiedades-listado` | `TerminologiaPropiedadesListado` | ok |
| sin sesión | `/terminologia/relaciones-formulario` | `TerminologiaRelacionesFormulario` | ok |
| sin sesión | `/terminologia/relaciones-listado` | `TerminologiaRelacionesListado` | ok |
| sin sesión | `/terminologia/politicas-de-catalogo-formulario` | `TerminologiaPoliticasDeCatalogoFormulario` | ok |
| sin sesión | `/terminologia/politicas-de-catalogo-listado` | `TerminologiaPoliticasDeCatalogoListado` | ok |
| sin sesión | `/terminologia/conjuntos-de-valor-formulario` | `TerminologiaConjuntosDeValorFormulario` | ok |
| sin sesión | `/terminologia/conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | no navega |
| sin sesión | `/terminologia/consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | no navega |
| sin sesión | `/terminologia/traduccion-entre-catalogos-formulario` | `TerminologiaTraduccionEntreCatalogosFormulario` | ok |
| sin sesión | `/terminologia/conceptos-listado` | `TerminologiaConceptosListado` | no navega |
| sin sesión | `/terminologia/expansion-de-conjunto-de-valores-detalle` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | ok |
| sin sesión | `/directorio/organizaciones-listado` | `DirectorioOrganizacionesListado` | no navega |
| sin sesión | `/directorio/organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | no navega |
| sin sesión | `/directorio/membresias-dar-de-baja` | `DirectorioMembresiasDarDeBaja` | ok |
| sin sesión | `/directorio/membresias-formulario` | `DirectorioMembresiasFormulario` | no navega |
| sin sesión | `/directorio/membresias-listado` | `DirectorioMembresiasListado` | no navega |
| sin sesión | `/directorio/asignaciones-de-sucursal-formulario` | `DirectorioAsignacionesDeSucursalFormulario` | ok |
| sin sesión | `/directorio/roles-formulario` | `DirectorioRolesFormulario` | ok |
| sin sesión | `/directorio/transferencias-formulario` | `DirectorioTransferenciasFormulario` | ok |
| sin sesión | `/directorio/sucursales-formulario` | `DirectorioSucursalesFormulario` | no navega |
| sin sesión | `/directorio/sucursales-listado` | `DirectorioSucursalesListado` | no navega |
| sin sesión | `/directorio/organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | no navega |
| sin sesión | `/directorio/organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | no navega |
| sin sesión | `/directorio/organizaciones-suspender` | `DirectorioOrganizacionesSuspender` | ok |
| sin sesión | `/personas/pacientes-formulario` | `PersonasPacientesFormulario` | no navega |
| sin sesión | `/personas/pacientes-fusionar` | `PersonasPacientesFusionar` | no navega |
| sin sesión | `/personas/pacientes-listado` | `PersonasPacientesListado` | no navega |
| sin sesión | `/personas/pacientes-revertir` | `PersonasPacientesRevertir` | no navega |
| sin sesión | `/personas/vinculos-de-identidad-formulario` | `PersonasVinculosDeIdentidadFormulario` | ok |
| sin sesión | `/personas/vinculos-de-identidad-listado` | `PersonasVinculosDeIdentidadListado` | ok |
| sin sesión | `/personas/apoderados-de-portal-formulario` | `PersonasApoderadosDePortalFormulario` | ok |
| sin sesión | `/personas/apoderados-de-portal-listado` | `PersonasApoderadosDePortalListado` | ok |
| sin sesión | `/personas/personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | no navega |
| sin sesión | `/personas/personas-relacionadas-listado` | `PersonasRelacionadasListado` | no navega |
| sin sesión | `/personas/credenciales-listado` | `PersonasCredencialesListado` | ok |
| sin sesión | `/personas/credenciales-verificar` | `PersonasCredencialesVerificar` | ok |
| sin sesión | `/personas/personas-listado` | `PersonasListado` | ok |
| sin sesión | `/personas/personas-registrar-defuncion` | `PersonasRegistrarDefuncion` | ok |
| sin sesión | `/personas/vinculos-de-cuenta-formulario` | `PersonasVinculosDeCuentaFormulario` | ok |
| sin sesión | `/personas/vinculos-de-cuenta-listado` | `PersonasVinculosDeCuentaListado` | ok |
| sin sesión | `/personas/profesionales-formulario` | `PersonasProfesionalesFormulario` | ok |
| sin sesión | `/personas/profesionales-listado` | `PersonasProfesionalesListado` | ok |
| sin sesión | `/personas/autorizaciones-de-jurisdiccion-formulario` | `PersonasAutorizacionesDeJurisdiccionFormulario` | ok |
| sin sesión | `/personas/autorizaciones-de-jurisdiccion-listado` | `PersonasAutorizacionesDeJurisdiccionListado` | ok |
| sin sesión | `/personas/especialidades-formulario` | `PersonasEspecialidadesFormulario` | ok |
| sin sesión | `/personas/especialidades-listado` | `PersonasEspecialidadesListado` | ok |
| sin sesión | `/personas/resumen-propio-listado` | `PersonasResumenPropioListado` | no navega |
| sin sesión | `/accesos/acceso-de-emergencia-formulario` | `AccesosAccesoDeEmergenciaFormulario` | ok |
| sin sesión | `/accesos/accesos-clinicos-del-paciente-formulario` | `AccesosClinicosDelPacienteFormulario` | ok |
| sin sesión | `/accesos/accesos-clinicos-del-paciente-listado` | `AccesosClinicosDelPacienteListado` | ok |
| sin sesión | `/accesos/relaciones-de-cuidado-formulario` | `AccesosRelacionesDeCuidadoFormulario` | ok |
| sin sesión | `/accesos/relaciones-de-cuidado-listado` | `AccesosRelacionesDeCuidadoListado` | ok |
| sin sesión | `/accesos/relaciones-de-cuidado-revocar` | `AccesosRelacionesDeCuidadoRevocar` | ok |
| sin sesión | `/accesos/representaciones-legales-formulario` | `AccesosRepresentacionesLegalesFormulario` | ok |
| sin sesión | `/accesos/representaciones-legales-listado` | `AccesosRepresentacionesLegalesListado` | ok |
| sin sesión | `/accesos/representaciones-legales-revocar` | `AccesosRepresentacionesLegalesRevocar` | ok |
| sin sesión | `/accesos/accesos-clinicos-listado` | `AccesosClinicosListado` | ok |
| sin sesión | `/accesos/accesos-clinicos-revocar` | `AccesosClinicosRevocar` | ok |
| sin sesión | `/accesos/decisiones-evaluar` | `AccesosDecisionesEvaluar` | ok |
| sin sesión | `/accesos/cache-invalidar` | `AccesosCacheInvalidar` | ok |
| sin sesión | `/accesos/categorias-de-permiso-formulario` | `AccesosCategoriasDePermisoFormulario` | ok |
| sin sesión | `/accesos/categorias-de-permiso-listado` | `AccesosCategoriasDePermisoListado` | ok |
| sin sesión | `/accesos/permisos-formulario` | `AccesosPermisosFormulario` | ok |
| sin sesión | `/accesos/permisos-listado` | `AccesosPermisosListado` | ok |
| sin sesión | `/accesos/alcance-de-recurso-formulario` | `AccesosAlcanceDeRecursoFormulario` | ok |
| sin sesión | `/accesos/alcance-de-recurso-listado` | `AccesosAlcanceDeRecursoListado` | ok |
| sin sesión | `/accesos/roles-formulario` | `AccesosRolesFormulario` | ok |
| sin sesión | `/accesos/roles-listado` | `AccesosRolesListado` | ok |
| sin sesión | `/accesos/permisos-de-campo-formulario` | `AccesosPermisosDeCampoFormulario` | ok |
| sin sesión | `/accesos/permisos-de-campo-listado` | `AccesosPermisosDeCampoListado` | ok |
| sin sesión | `/accesos/permisos-del-rol-formulario` | `AccesosPermisosDelRolFormulario` | ok |
| sin sesión | `/accesos/permisos-del-rol-listado` | `AccesosPermisosDelRolListado` | ok |
| sin sesión | `/accesos/politicas-de-acceso-formulario` | `AccesosPoliticasDeAccesoFormulario` | ok |
| sin sesión | `/accesos/politicas-de-acceso-listado` | `AccesosPoliticasDeAccesoListado` | ok |
| sin sesión | `/accesos/concesiones-de-permiso-formulario` | `AccesosConcesionesDePermisoFormulario` | ok |
| sin sesión | `/accesos/concesiones-de-permiso-listado` | `AccesosConcesionesDePermisoListado` | ok |
| sin sesión | `/accesos/asignaciones-de-rol-formulario` | `AccesosAsignacionesDeRolFormulario` | ok |
| sin sesión | `/accesos/asignaciones-de-rol-listado` | `AccesosAsignacionesDeRolListado` | ok |
| sin sesión | `/buscar/buscador-listado` | `BuscarBuscadorListado` | ok |
| sin sesión | `/buscar/profesionales-listado` | `BuscarProfesionalesListado` | no navega |
| sin sesión | `/buscar/medicamentos-listado` | `BuscarMedicamentosListado` | ok |
| sin sesión | `/buscar/hospitales-listado` | `BuscarHospitalesListado` | ok |
| sin sesión | `/buscar/laboratorios-listado` | `BuscarLaboratoriosListado` | no navega |
| sin sesión | `/buscar/aseguradoras-listado` | `BuscarAseguradorasListado` | no navega |
| sin sesión | `/buscar/perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | no navega |
| sin sesión | `/buscar/perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | no navega |
| sin sesión | `/buscar/perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | no navega |
| sin sesión | `/buscar/perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | no navega |
| sin sesión | `/buscar/perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | no navega |
| sin sesión | `/buscar/cercania-detalle` | `BuscarCercaniaDetalle` | ok |
| sin sesión | `/buscar/seguidos-y-guardados-listado` | `BuscarSeguidosYGuardadosListado` | ok |
| sin sesión | `/buscar/calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | no navega |
| sin sesión | `/inicio` | `InicioPortada` | no navega |

