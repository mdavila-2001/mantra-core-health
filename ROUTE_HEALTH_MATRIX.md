# Matriz de salud de rutas — carril 19

> **Generado** por `playwright/carril-19-route-health.spec.ts` sobre Chromium, contra la API viva. Se regenera con `yarn pw:rutas`. No editar a mano.

408 aperturas de ruta, sobre las rutas declaradas por el router.

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
| `denegada` | 30 |
| `ok` | 378 |

## Hallazgos

Ninguno: toda ruta alcanzable pintó contenido sin errores.

## Matriz completa

| Rol | Ruta | Componente | Estado |
|---|---|---|---|
| administrador | `/dashboard` | `Dashboard` | ok |
| administrador | `/tutorials` | `TutorialsCenter` | ok |
| administrador | `/directory` | `PractitionersDirectory` | denegada |
| administrador | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| administrador | `/schedule` | `Agenda` | ok |
| administrador | `/medical-records` | `ClinicalRecord` | ok |
| administrador | `/diagnostics` | `Diagnostics` | ok |
| administrador | `/glossary` | `Glossary` | ok |
| administrador | `/administration/patients` | `PatientList` | ok |
| administrador | `/administration/users` | `UserRegistration` | ok |
| administrador | `/administration/organizations` | `OrganizationList` | ok |
| administrador | `/administration/delegated-access` | `DelegatedAccessHome` | ok |
| administrador | `/administration/identity-providers` | `AuthProvidersHome` | ok |
| administrador | `/administration/identity-assurance` | `IdentityAdminHome` | ok |
| administrador | `/administration/terminology` | `TerminologyCatalog` | ok |
| administrador | `/administration/health-context` | `HealthContextHome` | ok |
| administrador | `/administration/geolocation` | `GeoHome` | ok |
| administrador | `/administration/services-catalog` | `ServicesCatalog` | ok |
| administrador | `/administration/clinical-forms` | `ClinicalForms` | ok |
| administrador | `/billing` | `SectionPlaceholder` | ok |
| administrador | `/administration/accounting` | `Accounting` | ok |
| administrador | `/my-account` | `MyProfile` | ok |
| administrador | `/my-account/appointments` | `Appointments` | ok |
| administrador | `/my-account/medical-record` | `MedicalRecord` | ok |
| administrador | `/my-account/identity/verify` | `IdentityVerification` | ok |
| administrador | `/my-account/identity/cases` | `VerificationCases` | ok |
| administrador | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | ok |
| administrador | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | ok |
| administrador | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | ok |
| administrador | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | ok |
| administrador | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | ok |
| administrador | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | ok |
| administrador | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | ok |
| administrador | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | ok |
| administrador | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | ok |
| administrador | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | ok |
| administrador | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | ok |
| administrador | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | ok |
| administrador | `/administration/geolocation/geofences/new` | `GeofenceForm` | ok |
| administrador | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | ok |
| administrador | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | ok |
| administrador | `/administration/geolocation/subjects/last-position` | `LastPosition` | ok |
| administrador | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | ok |
| administrador | `/administration/geolocation/subjects/pings` | `PingIngest` | ok |
| administrador | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | ok |
| administrador | `/administration/geolocation/trips/close` | `TripClose` | ok |
| administrador | `/administration/geolocation/trips/new` | `TripForm` | ok |
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
| administrador | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | ok |
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
| administrador | `/my-account/articles` | `MedicalArticles` | ok |
| administrador | `/my-account/edit` | `PractitionerProfileEdit` | ok |
| administrador | `/my-account/preview` | `PublicProfilePreview` | ok |
| administrador | `/schedule/new` | `AgendaCreate` | ok |
| doctora | `/dashboard` | `Dashboard` | ok |
| doctora | `/tutorials` | `TutorialsCenter` | ok |
| doctora | `/directory` | `PractitionersDirectory` | denegada |
| doctora | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| doctora | `/schedule` | `Agenda` | ok |
| doctora | `/medical-records` | `ClinicalRecord` | ok |
| doctora | `/diagnostics` | `Diagnostics` | ok |
| doctora | `/glossary` | `Glossary` | ok |
| doctora | `/administration/patients` | `PatientList` | denegada |
| doctora | `/administration/users` | `UserRegistration` | denegada |
| doctora | `/administration/organizations` | `OrganizationList` | denegada |
| doctora | `/administration/delegated-access` | `DelegatedAccessHome` | denegada |
| doctora | `/administration/identity-providers` | `AuthProvidersHome` | denegada |
| doctora | `/administration/identity-assurance` | `IdentityAdminHome` | denegada |
| doctora | `/administration/terminology` | `TerminologyCatalog` | denegada |
| doctora | `/administration/health-context` | `HealthContextHome` | denegada |
| doctora | `/administration/geolocation` | `GeoHome` | denegada |
| doctora | `/administration/services-catalog` | `ServicesCatalog` | denegada |
| doctora | `/administration/clinical-forms` | `ClinicalForms` | denegada |
| doctora | `/billing` | `SectionPlaceholder` | denegada |
| doctora | `/administration/accounting` | `Accounting` | ok |
| doctora | `/my-account` | `MyProfile` | ok |
| doctora | `/my-account/appointments` | `Appointments` | ok |
| doctora | `/my-account/medical-record` | `MedicalRecord` | ok |
| doctora | `/my-account/identity/verify` | `IdentityVerification` | ok |
| doctora | `/my-account/identity/cases` | `VerificationCases` | ok |
| doctora | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | ok |
| doctora | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | ok |
| doctora | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | ok |
| doctora | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | ok |
| doctora | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | ok |
| doctora | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | ok |
| doctora | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | ok |
| doctora | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | ok |
| doctora | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | ok |
| doctora | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | ok |
| doctora | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | ok |
| doctora | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | ok |
| doctora | `/administration/geolocation/geofences/new` | `GeofenceForm` | ok |
| doctora | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | ok |
| doctora | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | ok |
| doctora | `/administration/geolocation/subjects/last-position` | `LastPosition` | ok |
| doctora | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | ok |
| doctora | `/administration/geolocation/subjects/pings` | `PingIngest` | ok |
| doctora | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | ok |
| doctora | `/administration/geolocation/trips/close` | `TripClose` | ok |
| doctora | `/administration/geolocation/trips/new` | `TripForm` | ok |
| doctora | `/administration/health-context/agents/new` | `AgentForm` | ok |
| doctora | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | ok |
| doctora | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | ok |
| doctora | `/administration/health-context/contexts/new` | `ContextForm` | ok |
| doctora | `/administration/health-context/contexts/resolve` | `ContextResolve` | ok |
| doctora | `/administration/health-context/observations/new` | `ObservationForm` | ok |
| doctora | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | ok |
| doctora | `/administration/health-context/schedules/new` | `ScheduleForm` | ok |
| doctora | `/administration/health-context/sources/new` | `SourceForm` | ok |
| doctora | `/administration/health-context/versions/new` | `VersionForm` | ok |
| doctora | `/administration/health-context/versions/publish` | `VersionPublish` | ok |
| doctora | `/administration/health-context/versions/supersede` | `VersionSupersede` | ok |
| doctora | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | ok |
| doctora | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | ok |
| doctora | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | ok |
| doctora | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | ok |
| doctora | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | ok |
| doctora | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | ok |
| doctora | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | ok |
| doctora | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | ok |
| doctora | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | ok |
| doctora | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | ok |
| doctora | `/administration/identity-assurance/checks/result` | `CheckResultForm` | ok |
| doctora | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | ok |
| doctora | `/administration/identity-assurance/queue` | `CaseQueue` | ok |
| doctora | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | ok |
| doctora | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | ok |
| doctora | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | ok |
| doctora | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | ok |
| doctora | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | ok |
| doctora | `/administration/identity-providers/keys/new` | `SigningKeyForm` | ok |
| doctora | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | ok |
| doctora | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | ok |
| doctora | `/administration/identity-providers/login/start` | `LoginStartForm` | ok |
| doctora | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | ok |
| doctora | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | ok |
| doctora | `/administration/identity-providers/providers/new` | `ProviderForm` | ok |
| doctora | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | ok |
| doctora | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | ok |
| doctora | `/administration/organizations/new` | `OrganizationNew` | ok |
| doctora | `/administration/patients/assisted-registration` | `AssistedRegistration` | ok |
| doctora | `/administration/patients/merge` | `PatientMerge` | ok |
| doctora | `/administration/patients/new` | `PatientNew` | ok |
| doctora | `/my-account/articles` | `MedicalArticles` | ok |
| doctora | `/my-account/edit` | `PractitionerProfileEdit` | ok |
| doctora | `/my-account/preview` | `PublicProfilePreview` | ok |
| doctora | `/schedule/new` | `AgendaCreate` | ok |
| paciente | `/dashboard` | `Dashboard` | ok |
| paciente | `/tutorials` | `TutorialsCenter` | ok |
| paciente | `/directory` | `PractitionersDirectory` | ok |
| paciente | `/laboratory-directory` | `LaboratoryDirectory` | ok |
| paciente | `/schedule` | `Agenda` | denegada |
| paciente | `/medical-records` | `ClinicalRecord` | denegada |
| paciente | `/diagnostics` | `Diagnostics` | denegada |
| paciente | `/glossary` | `Glossary` | ok |
| paciente | `/administration/patients` | `PatientList` | denegada |
| paciente | `/administration/users` | `UserRegistration` | denegada |
| paciente | `/administration/organizations` | `OrganizationList` | denegada |
| paciente | `/administration/delegated-access` | `DelegatedAccessHome` | denegada |
| paciente | `/administration/identity-providers` | `AuthProvidersHome` | denegada |
| paciente | `/administration/identity-assurance` | `IdentityAdminHome` | denegada |
| paciente | `/administration/terminology` | `TerminologyCatalog` | denegada |
| paciente | `/administration/health-context` | `HealthContextHome` | denegada |
| paciente | `/administration/geolocation` | `GeoHome` | denegada |
| paciente | `/administration/services-catalog` | `ServicesCatalog` | denegada |
| paciente | `/administration/clinical-forms` | `ClinicalForms` | denegada |
| paciente | `/billing` | `SectionPlaceholder` | denegada |
| paciente | `/administration/accounting` | `Accounting` | denegada |
| paciente | `/my-account` | `MyProfile` | ok |
| paciente | `/my-account/appointments` | `Appointments` | ok |
| paciente | `/my-account/medical-record` | `MedicalRecord` | ok |
| paciente | `/my-account/identity/verify` | `IdentityVerification` | ok |
| paciente | `/my-account/identity/cases` | `VerificationCases` | ok |
| paciente | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | ok |
| paciente | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | ok |
| paciente | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | ok |
| paciente | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | ok |
| paciente | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | ok |
| paciente | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | ok |
| paciente | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | ok |
| paciente | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | ok |
| paciente | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | ok |
| paciente | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | ok |
| paciente | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | ok |
| paciente | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | ok |
| paciente | `/administration/geolocation/geofences/new` | `GeofenceForm` | ok |
| paciente | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | ok |
| paciente | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | ok |
| paciente | `/administration/geolocation/subjects/last-position` | `LastPosition` | ok |
| paciente | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | ok |
| paciente | `/administration/geolocation/subjects/pings` | `PingIngest` | ok |
| paciente | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | ok |
| paciente | `/administration/geolocation/trips/close` | `TripClose` | ok |
| paciente | `/administration/geolocation/trips/new` | `TripForm` | ok |
| paciente | `/administration/health-context/agents/new` | `AgentForm` | ok |
| paciente | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | ok |
| paciente | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | ok |
| paciente | `/administration/health-context/contexts/new` | `ContextForm` | ok |
| paciente | `/administration/health-context/contexts/resolve` | `ContextResolve` | ok |
| paciente | `/administration/health-context/observations/new` | `ObservationForm` | ok |
| paciente | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | ok |
| paciente | `/administration/health-context/schedules/new` | `ScheduleForm` | ok |
| paciente | `/administration/health-context/sources/new` | `SourceForm` | ok |
| paciente | `/administration/health-context/versions/new` | `VersionForm` | ok |
| paciente | `/administration/health-context/versions/publish` | `VersionPublish` | ok |
| paciente | `/administration/health-context/versions/supersede` | `VersionSupersede` | ok |
| paciente | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | ok |
| paciente | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | ok |
| paciente | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | ok |
| paciente | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | ok |
| paciente | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | ok |
| paciente | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | ok |
| paciente | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | ok |
| paciente | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | ok |
| paciente | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | ok |
| paciente | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | ok |
| paciente | `/administration/identity-assurance/checks/result` | `CheckResultForm` | ok |
| paciente | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | ok |
| paciente | `/administration/identity-assurance/queue` | `CaseQueue` | ok |
| paciente | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | ok |
| paciente | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | ok |
| paciente | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | ok |
| paciente | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | ok |
| paciente | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | ok |
| paciente | `/administration/identity-providers/keys/new` | `SigningKeyForm` | ok |
| paciente | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | ok |
| paciente | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | ok |
| paciente | `/administration/identity-providers/login/start` | `LoginStartForm` | ok |
| paciente | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | ok |
| paciente | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | ok |
| paciente | `/administration/identity-providers/providers/new` | `ProviderForm` | ok |
| paciente | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | ok |
| paciente | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | ok |
| paciente | `/administration/organizations/new` | `OrganizationNew` | ok |
| paciente | `/administration/patients/assisted-registration` | `AssistedRegistration` | ok |
| paciente | `/administration/patients/merge` | `PatientMerge` | ok |
| paciente | `/administration/patients/new` | `PatientNew` | ok |
| paciente | `/my-account/articles` | `MedicalArticles` | ok |
| paciente | `/my-account/edit` | `PractitionerProfileEdit` | ok |
| paciente | `/my-account/preview` | `PublicProfilePreview` | ok |
| paciente | `/schedule/new` | `AgendaCreate` | ok |
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
| sin sesión | `/terminologia/versiones-importar` | `TerminologiaVersionesImportar` | ok |
| sin sesión | `/terminologia/versiones-listado` | `TerminologiaVersionesListado` | ok |
| sin sesión | `/terminologia/versiones-publicar` | `TerminologiaVersionesPublicar` | ok |
| sin sesión | `/terminologia/expansion-de-conjunto-de-valores-formulario` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | ok |
| sin sesión | `/terminologia/sistemas-de-codigos-formulario` | `TerminologiaSistemasDeCodigosFormulario` | ok |
| sin sesión | `/terminologia/sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | ok |
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
| sin sesión | `/terminologia/conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | ok |
| sin sesión | `/terminologia/consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | ok |
| sin sesión | `/terminologia/traduccion-entre-catalogos-formulario` | `TerminologiaTraduccionEntreCatalogosFormulario` | ok |
| sin sesión | `/terminologia/conceptos-listado` | `TerminologiaConceptosListado` | ok |
| sin sesión | `/terminologia/expansion-de-conjunto-de-valores-detalle` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | ok |
| sin sesión | `/directorio/organizaciones-listado` | `DirectorioOrganizacionesListado` | ok |
| sin sesión | `/directorio/organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | ok |
| sin sesión | `/directorio/membresias-dar-de-baja` | `DirectorioMembresiasDarDeBaja` | ok |
| sin sesión | `/directorio/membresias-formulario` | `DirectorioMembresiasFormulario` | ok |
| sin sesión | `/directorio/membresias-listado` | `DirectorioMembresiasListado` | ok |
| sin sesión | `/directorio/asignaciones-de-sucursal-formulario` | `DirectorioAsignacionesDeSucursalFormulario` | ok |
| sin sesión | `/directorio/roles-formulario` | `DirectorioRolesFormulario` | ok |
| sin sesión | `/directorio/transferencias-formulario` | `DirectorioTransferenciasFormulario` | ok |
| sin sesión | `/directorio/sucursales-formulario` | `DirectorioSucursalesFormulario` | ok |
| sin sesión | `/directorio/sucursales-listado` | `DirectorioSucursalesListado` | ok |
| sin sesión | `/directorio/organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | ok |
| sin sesión | `/directorio/organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | ok |
| sin sesión | `/directorio/organizaciones-suspender` | `DirectorioOrganizacionesSuspender` | ok |
| sin sesión | `/personas/pacientes-formulario` | `PersonasPacientesFormulario` | ok |
| sin sesión | `/personas/pacientes-fusionar` | `PersonasPacientesFusionar` | ok |
| sin sesión | `/personas/pacientes-listado` | `PersonasPacientesListado` | ok |
| sin sesión | `/personas/pacientes-revertir` | `PersonasPacientesRevertir` | ok |
| sin sesión | `/personas/vinculos-de-identidad-formulario` | `PersonasVinculosDeIdentidadFormulario` | ok |
| sin sesión | `/personas/vinculos-de-identidad-listado` | `PersonasVinculosDeIdentidadListado` | ok |
| sin sesión | `/personas/apoderados-de-portal-formulario` | `PersonasApoderadosDePortalFormulario` | ok |
| sin sesión | `/personas/apoderados-de-portal-listado` | `PersonasApoderadosDePortalListado` | ok |
| sin sesión | `/personas/personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | ok |
| sin sesión | `/personas/personas-relacionadas-listado` | `PersonasRelacionadasListado` | ok |
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
| sin sesión | `/personas/resumen-propio-listado` | `PersonasResumenPropioListado` | ok |
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
| sin sesión | `/buscar/profesionales-listado` | `BuscarProfesionalesListado` | ok |
| sin sesión | `/buscar/medicamentos-listado` | `BuscarMedicamentosListado` | ok |
| sin sesión | `/buscar/hospitales-listado` | `BuscarHospitalesListado` | ok |
| sin sesión | `/buscar/laboratorios-listado` | `BuscarLaboratoriosListado` | ok |
| sin sesión | `/buscar/aseguradoras-listado` | `BuscarAseguradorasListado` | ok |
| sin sesión | `/buscar/perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | ok |
| sin sesión | `/buscar/perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | ok |
| sin sesión | `/buscar/perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | ok |
| sin sesión | `/buscar/perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | ok |
| sin sesión | `/buscar/perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | ok |
| sin sesión | `/buscar/cercania-detalle` | `BuscarCercaniaDetalle` | ok |
| sin sesión | `/buscar/seguidos-y-guardados-listado` | `BuscarSeguidosYGuardadosListado` | ok |
| sin sesión | `/buscar/calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | ok |
| sin sesión | `/inicio` | `InicioPortada` | ok |

