<!-- GENERADO POR scripts/audit-design-views.mjs — NO EDITAR A MANO. -->

# Inventario de vistas del diseñador y cableado real

Carril 01. 85 secciones del registro, 118 pantallas hijas o de operación y 126 vistas portadas desde la bóveda.

## Estados

| Estado | Qué significa |
|---|---|
| `conectada` | Inyecta al menos un cliente de `core/data-access`. |
| `conectada con deuda` | Lee la API, pero además arrastra un marcador (`TODO`, dato de muestra). |
| `presentacional` | Pinta sin pedir nada. Correcto si es un panel de acciones; sospechoso si debía listar. |
| `maqueta portada` | Vista de la bóveda con marcado estático. Es el entregable del diseñador, no una pantalla a medio hacer. |
| `maqueta` | Pinta con constantes `_DE_MUESTRA` fuera de `alovida/`. |
| `con deuda` | Tiene `TODO`, promesa sin pantalla u otro marcador. |
| `placeholder` | Sección declarada `planificada`: cae en `SectionPlaceholder` a propósito. |

## Secciones del menú

| Rol | Ruta | Vista actual | API que usa | Estado | Acción |
|---|---|---|---|---|---|
| cualquier sesión | `/dashboard` | `Dashboard` | ClinicalClient, ProfilesClient, SchedulingClient, TerminologyClient | conectada con deuda | resolver: promesa sin pantalla |
| cualquier sesión | `/tutorials` | `TutorialsCenter` | — | presentacional | verificar que no deba listar |
| cualquier sesión | `/messaging` | `Messaging` | CommunityClient | conectada | ninguna |
| cualquier sesión | `/directories` | `DirectoriesOverview` | DiagnosticUnitsClient, PublicDirectoryClient | conectada | ninguna |
| PATIENT · PRACTITIONER | `/directory` | `PractitionersDirectory` | ProfilesClient, TerminologyClient | conectada | ninguna |
| PATIENT | `/psychological-help` | `PsychologicalHelp` | — | presentacional | verificar que no deba listar |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/groups` | `Groups` | CommunityClient | conectada | ninguna |
| cualquier sesión | `/laboratory-directory` | `LaboratoryDirectory` | DiagnosticUnitsClient | conectada | ninguna |
| cualquier sesión | `/clinics-directory` | `ClinicsDirectory` | InsuranceClient, PublicCatalogClient, PublicDirectoryClient | conectada | ninguna |
| cualquier sesión | `/pharmacies-directory` | `PharmaciesDirectory` | InsuranceClient, PublicCatalogClient, PublicDirectoryClient | conectada | ninguna |
| cualquier sesión | `/insurers-directory` | `InsurersDirectory` | InsuranceClient, PublicCatalogClient, PublicDirectoryClient | conectada | ninguna |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule` | `Agenda` | ClinicalClient, PharmaLabClient, ProfilesClient, SchedulingClient, TerminologyClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/medical-records` | `ClinicalRecord` | AccountingClient, AuthzClient, BillingSimulatedClient, ChartCarePlansClient, ChartDocumentsClient, ChartNotesClient, ChartTemplatesClient, ClinicalClient, ConsentClient, DiagnosticsClient, FilesClient, FormsClient, PracticeSitesClient, ProceduresClient, ProfilesClient, QuotationsClient, ReferralsClient, SchedulingClient, SystemContextClient, TerminologyClient, DiagnosisIaClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/diagnostics` | `Diagnostics` | DiagnosticsClient, TerminologyClient | conectada | ninguna |
| SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN | `/interventions` | `Interventions` | ProceduresClient, TerminologyClient | conectada | ninguna |
| PRACTITIONER · CLINICIAN | `/lab-visits` | `DoctorVisits` | PharmaLabClient | conectada | ninguna |
| MEDICAL_VISITOR | `/my-visits` | `VisitorVisits` | PharmaLabClient | conectada | ninguna |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/glossary` | `Glossary` | AnatomyAtlasClient, TerminologyClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/form-builder` | `FormBuilder` | ChartTemplatesClient, FormsClient, ProfilesClient, TerminologyClient | conectada con deuda | resolver: datos de muestra |
| CLINICIAN · PRACTITIONER | `/my-services` | `MyServices` | SchedulingClient, ServicesCatalogClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/my-quotations` | `QuotationList` | ProfilesClient, QuotationsClient | conectada | ninguna |
| PRACTITIONER · CLINICIAN | `/questionnaires` | `SurveysHome` | SurveysClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/patients` | `PatientList` | ProfilesClient, SystemContextClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/users` | `UserRegistration` | IamClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/organizations` | `OrganizationList` | DirectoryClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/administration/insurance` | `InsuranceCatalog` | InsuranceClient, ServicesCatalogClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/brokers` | `BrokerDirectory` | InsuranceClient | conectada | ninguna |
| BILLING_OPERATOR · SECURITY_ADMIN | `/administration/insurance-claims` | `InsuranceClaims` | InsuranceClient | conectada | ninguna |
| cualquier sesión | `/administration/insurance-analytics` | `InsuranceAnalytics` | InsuranceAnalyticsClient, InsuranceClient | conectada | ninguna |
| cualquier sesión | `/administration/received-claims` | `ReceivedClaims` | InsuranceClient | conectada | ninguna |
| cualquier sesión | `/administration/insurance-patients` | `InsurancePatients` | InsuranceClient, SystemContextClient | conectada | ninguna |
| cualquier sesión | `/administration/insurance-campaigns` | `InsuranceCampaigns` | InsuranceClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/delegated-access` | `DelegatedAccessHome` | — | presentacional | verificar que no deba listar |
| IDENTITY_ADMIN | `/administration/identity-providers` | `AuthProvidersHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/identity-assurance` | `IdentityAdminHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/terminology` | `TerminologyCatalog` | TerminologyClient | conectada con deuda | resolver: datos de muestra |
| SUPERADMIN | `/administration/content-packs` | `ContentPacks` | ContentPacksClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/moderation` | `Moderation` | CommunityClient | conectada | ninguna |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context` | `HealthContextHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/geolocation` | `GeoHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/services-catalog` | `ServicesCatalog` | ServicesCatalogClient | conectada | ninguna |
| SECURITY_ADMIN · PERIOP_ADMIN · PRACTITIONER | `/administration/medical-organization` | `MedicalOrganization` | AccountingClient, MedicalOrganizationClient, PracticeSitesClient, TerminologyClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/medical-laboratory` | `MedicalLaboratory` | DiagnosticUnitsAdminClient, SystemContextClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/clinical-forms` | `ClinicalForms` | ChartTemplatesClient, TerminologyClient | conectada | ninguna |
| BILLING · FINANCE · CASHIER · PAYMENTS_ADMIN | `/billing` | `Billing` | BillingSimulatedClient | conectada | ninguna |
| PHARMA_LAB_ADMIN · BUSINESS_ADMIN · PLATFORM_ADMIN | `/administration/pharma-lab` | `PharmaLabHome` | PharmaLabClient | conectada | ninguna |
| SECURITY_ADMIN · ACCOUNTING_APPROVER · PRACTITIONER | `/administration/accounting` | `Summary` | AccountingClient | conectada | ninguna |
| cualquier sesión | `/my-account/dependents` | `Dependents` | ProfilesClient | conectada | ninguna |
| cualquier sesión | `/my-account` | `MyAccount` | — | presentacional | verificar que no deba listar |
| PATIENT | `/my-account/privacy` | `AccountPrivacy` | ConsentClient | conectada | ninguna |
| PATIENT | `/my-account/clinical-access` | `AccountClinicalAccess` | AuthzClient | conectada | ninguna |
| cualquier sesión | `/my-account/security` | `AccountSecurity` | AccountSecurityClient | conectada | ninguna |
| cualquier sesión | `/my-account/appointments` | `Appointments` | SchedulingClient, TerminologyClient | conectada con deuda | resolver: promesa sin pantalla |
| cualquier sesión | `/my-account/medical-record` | `MedicalRecord` | ClinicalClient, DiagnosticUnitsClient, DiagnosticsClient, FormsClient, PharmacyCampaignsClient, PharmacyOrdersClient, PharmacyClient, ProfilesClient, SchedulingClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/diagnostic-results` | `DiagnosticResults` | AuthzClient, DiagnosticsClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/diagnostic-orders` | `DiagnosticOrders` | DiagnosticsClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/cotizaciones` | `Quotations` | DiagnosticUnitsClient, PharmacyClient, ProfilesClient, ServicesCatalogClient | conectada | ninguna |
| cualquier sesión | `/my-account/questionnaires` | `Questionnaires` | ClinicalClient, SurveysClient | conectada | ninguna |
| cualquier sesión | `/settings` | `Settings` | — | presentacional | verificar que no deba listar |
| cualquier sesión | `/notification-center` | `NotificationCenter` | NotificationsClient | conectada | ninguna |
| cualquier sesión | `/my-account/identity` | `IdentityHub` | — | presentacional | verificar que no deba listar |
| PATIENT | `/my-account/pharmacy` | `StoreFront` | PharmacyOrdersClient, ProfilesClient | conectada | ninguna |
| PATIENT | `/my-account/pharmacy-orders` | `PharmacyOrders` | NotificationsClient, PharmacyCampaignsClient, PharmacyOrdersClient | conectada | ninguna |
| PATIENT | `/my-account/loyalty` | `SectionPlaceholder` | — | sin pantalla | ninguna |
| PATIENT | `/my-account/promotions` | `Promotions` | PromotionsClient | conectada | ninguna |
| PATIENT | `/my-account/spending` | `Spending` | PatientSpendingClient | conectada | ninguna |
| cualquier sesión | `/my-account/invoices` | `MyInvoices` | BillingSimulatedClient | conectada | ninguna |
| cualquier sesión | `/my-account/requests` | `MyRequests` | InsuranceClient | conectada | ninguna |
| PRACTITIONER | `/administration/my-practice` | `MyPractice` | — | presentacional | verificar que no deba listar |
| cualquier sesión | `/administration/my-organization` | `OrganizationPanel` | DirectoryClient, OrganizationLogoClient, PharmacyCampaignsClient, PharmacyOrdersClient, PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy` | `PharmacySummaryPage` | PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-catalog` | `PharmacyProducts` | FilesClient, PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-categories` | `PharmacyCategories` | PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-import` | `PharmacyImport` | PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-inventory` | `PharmacyInventory` | PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-prices` | `PharmacyPrices` | PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-orders` | `PharmacyInbox` | PharmacyOrdersClient, PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-campaigns` | `PharmacyCampaigns` | PharmacyCampaignsClient, PharmacyClient | conectada | ninguna |
| cualquier sesión | `/administration/pharmacy-profile` | `SectionPlaceholder` | — | sin pantalla | ninguna |
| cualquier sesión | `/administration/laboratory` | `LaboratorySummaryPage` | LabPortalClient | conectada | ninguna |
| cualquier sesión | `/laboratorio/recepcion` | `LabReception` | DiagnosticsLabClient, SystemContextClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/laboratorio/cola` | `Diagnostics` | DiagnosticsClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/administration/laboratory-results` | `LaboratoryResults` | LabPortalClient | conectada | ninguna |
| cualquier sesión | `/administration/laboratory-prices` | `LaboratoryPrices` | LabPortalClient | conectada | ninguna |
| cualquier sesión | `/administration/laboratory-branches` | `OrganizationBranches` | DirectoryClient | conectada | ninguna |

## Pantallas hijas y de operación

| Rol | Ruta | Vista actual | API que usa | Estado |
|---|---|---|---|---|
| SECURITY_ADMIN · ACCOUNTING_APPROVER · PRACTITIONER | `/administration/accounting/assets-liabilities` | `AssetsLiabilities` | AccountingClient, AssetsLiabilitiesClient | conectada |
| SECURITY_ADMIN · ACCOUNTING_APPROVER · PRACTITIONER | `/administration/accounting/cockpit` | `Cockpit` | AccountingClient | conectada |
| SECURITY_ADMIN · ACCOUNTING_APPROVER · PRACTITIONER | `/administration/accounting/libros` | `Accounting` | AccountingClient, SimpleAccountingClient | conectada |
| SECURITY_ADMIN | `/administration/brokers/:brokerId` | `BrokerDetail` | InsuranceClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/assignments/edit` | `OrgAssignmentUpdate` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/assignments/new` | `OrgAssignmentForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/delegations/new` | `PractitionerDelegateForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/delegations/requests/new` | `AccessRequestForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/delegations/revoke` | `DelegationRevocation` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/operations/evaluate-actor` | `ActorEvaluation` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/permission-sets/new` | `PermissionSetForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/permission-sets/new-version` | `SetVersionForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/requests/resolve` | `AccessRequestResolution` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/geofence-events/new` | `GeofenceEventForm` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/geofences/new` | `GeofenceForm` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/sessions/close` | `TrackingSessionClose` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/sessions/new` | `TrackingSessionForm` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/last-position` | `LastPosition` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/last-position/:trackedSubjectId` | `LastPosition` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/new` | `TrackedSubjectForm` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/pings` | `PingIngest` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/revoke-consent` | `ConsentRevocation` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/trips/close` | `TripClose` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/trips/new` | `TripForm` | GeoClient | conectada |
| cualquier sesión | `/administration/getting-started` | `GettingStarted` | DirectoryClient, TerminologyClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/agents/new` | `AgentForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/collection-runs/finish` | `CollectionRunFinish` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/collection-runs/new` | `CollectionRunForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/contexts/new` | `ContextForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/contexts/resolve` | `ContextResolve` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/observations/new` | `ObservationForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/quality-reviews/new` | `QualityReviewForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/schedules/new` | `ScheduleForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/sources/new` | `SourceForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/versions/new` | `VersionForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/versions/publish` | `VersionPublish` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/versions/supersede` | `VersionSupersede` | HealthContextClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/assertions/issue` | `AssertionIssueForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/assertions/revoke` | `AssertionRevokeForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/authorities/endpoint` | `AuthorityEndpointForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/authorities/new` | `AuthorityForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/cases/:caseId` | `CaseDetail` | FilesClient, IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/cases/checks` | `CheckPlanForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/cases/evidence` | `CaseEvidenceForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/cases/expire-sweep` | `CaseExpireSweep` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/cases/new` | `CaseOpenForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/checks/attempt` | `CheckAttemptForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/checks/fraud-signal` | `FraudSignalForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/checks/result` | `CheckResultForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/policies/new` | `VerificationPolicyForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/queue` | `CaseQueue` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/review/decision` | `ReviewDecisionForm` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/review/escalate` | `ManualReviewForm` | IdentityAdminClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/accounts/complete` | `AccountLinkCompleteForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/accounts/link` | `AccountLinkRequestForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/accounts/unlink` | `IdentityUnlinkForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/keys/new` | `SigningKeyForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/keys/rotate` | `KeyRotationForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/login/callback` | `LoginCallbackForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/login/start` | `LoginStartForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/organizations/link` | `TenantBindingForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/providers/attribute-mappings` | `AttributeMappingsForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/providers/new` | `ProviderForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/providers/protocol` | `ProtocolConfigForm` | AuthProvidersClient | conectada |
| IDENTITY_ADMIN | `/administration/identity-providers/providers/provisioning-rule` | `ProvisioningRuleForm` | AuthProvidersClient | conectada |
| BILLING_OPERATOR · SECURITY_ADMIN | `/administration/insurance-claims/:claimId` | `InsuranceClaimDetail` | InsuranceClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId` | `OrganizationDetail` | DirectoryClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId/branches/new` | `BranchNew` | DirectoryClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId/child-organizations/new` | `ChildOrganizationNew` | DirectoryClient, IamClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId/memberships/new` | `MembershipNew` | DirectoryClient, IamClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId/verify` | `OrganizationVerify` | DirectoryClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/new` | `OrganizationNew` | DirectoryClient, IamClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/patients/:profileId` | `PatientDetail` | AuthzClient, ProfilesClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/patients/assisted-registration` | `AssistedRegistration` | IamClient | conectada |
| SECURITY_ADMIN | `/administration/patients/merge` | `PatientMerge` | ProfilesClient | conectada |
| SECURITY_ADMIN | `/administration/patients/new` | `PatientNew` | ProfilesClient | conectada |
| cualquier sesión | `/administration/pharmacy-orders/:orderId` | `InboxOrder` | PharmacyOrdersClient, PharmacyClient | conectada |
| SECURITY_ADMIN | `/administration/services-catalog/import` | `ProcedureImport` | ServicesCatalogClient | conectada |
| SECURITY_ADMIN | `/administration/terminology/import` | `VersionImport` | TerminologyClient | conectada con deuda |
| cualquier sesión | `/clinics-directory/:slug` | `ClinicDetail` | PublicCatalogClient | conectada |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/glossary/:conceptId` | `GlossaryTerm` | AnatomyAtlasClient, TerminologyClient | conectada |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/glossary/anatomy-atlas` | `GlossaryAnatomyAtlas` | AnatomyAtlasClient, TerminologyClient | conectada |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/glossary/network` | `GlossaryNetwork` | AnatomyAtlasClient, TerminologyClient | conectada |
| PRACTITIONER · CLINICIAN · SCHEDULING_ADMIN · SCHEDULING_AGENT · SURGEON · ANESTHESIOLOGIST · PERIOP_NURSE · SURGERY_SCHEDULER · PERIOP_ADMIN · MEDICAL_VISITOR · SECURITY_ADMIN | `/groups/:groupId` | `GroupDetail` | CommunityClient | conectada |
| cualquier sesión | `/insurers-directory/:slug` | `InsurerDetail` | InsuranceClient | conectada |
| cualquier sesión | `/laboratory-directory/:unitId` | `LaboratoryDetail` | DiagnosticUnitsClient | conectada |
| CLINICIAN · PRACTITIONER | `/medical-records/:profileId` | `PatientChart` | AccountingClient, AuthzClient, BillingSimulatedClient, ChartCarePlansClient, ChartDocumentsClient, ChartNotesClient, ChartTemplatesClient, ClinicalClient, DiagnosticsClient, FilesClient, FormsClient, PracticeSitesClient, ProceduresClient, ProfilesClient, ReferralsClient, SchedulingClient, SystemContextClient, TerminologyClient, DiagnosisIaClient | conectada |
| CLINICIAN · PRACTITIONER | `/medical-records/:profileId/consultation` | `Consultation` | ClinicalClient, ConsentClient, ProfilesClient, QuotationsClient, TerminologyClient | conectada |
| CLINICIAN · PRACTITIONER | `/medical-records/:profileId/request-access` | `RequestAccess` | AuthzClient, ProfilesClient | conectada |
| cualquier sesión | `/my-account/access-requests` | `AccessRequests` | AuthzClient, ProfilesClient | conectada |
| cualquier sesión | `/my-account/appointments/book/:slotId` | `BookingNew` | ProfilesClient, SchedulingClient | conectada |
| cualquier sesión | `/my-account/articles` | `MedicalArticles` | CommunityClient, FilesClient | conectada |
| cualquier sesión | `/my-account/edit` | `PractitionerProfileEdit` | FilesClient, PracticeLogoClient, ProfilesClient, SignatureAndSealClient, TerminologyClient | conectada |
| cualquier sesión | `/my-account/identity/cases/:caseId` | `PractitionerDetail` | FilesClient, ProfilesClient, TerminologyClient | conectada |
| cualquier sesión | `/my-account/medical-record/where-to-buy/:requestId` | `WhereToBuy` | ClinicalClient, DiagnosticUnitsClient, DiagnosticsClient, PharmacyCampaignsClient, PharmacyOrdersClient, PharmacyClient, ProfilesClient, TerminologyClient | conectada |
| PATIENT | `/my-account/pharmacy-orders/:orderId` | `OrderDetail` | NotificationsClient, PharmacyOrdersClient | conectada |
| PATIENT | `/my-account/pharmacy-orders/:orderId/invoice` | `OrderInvoice` | PharmacyOrdersClient | conectada |
| PATIENT | `/my-account/pharmacy-orders/:orderId/receipt` | `OrderReceipt` | PharmacyOrdersClient | conectada |
| PATIENT | `/my-account/pharmacy-orders/checkout` | `Checkout` | PharmacyCampaignsClient, PharmacyOrdersClient | conectada |
| PATIENT | `/my-account/pharmacy-orders/new` | `NewOrder` | PharmacyCampaignsClient, PharmacyOrdersClient | conectada |
| PATIENT | `/my-account/pharmacy/cart` | `CartPage` | PharmacyOrdersClient, PharmacyClient | conectada |
| PATIENT | `/my-account/pharmacy/prescriptions` | `PrescriptionsPage` | ClinicalClient, TerminologyClient | conectada |
| cualquier sesión | `/my-account/profile/edit` | `PatientProfileEdit` | ProfilesClient | conectada |
| cualquier sesión | `/my-account/questionnaires/:invitationId` | `QuestionnaireAnswer` | SurveysClient | conectada |
| CLINICIAN · PRACTITIONER | `/my-quotations/new` | `QuotationForm` | ProfilesClient, QuotationsClient, SchedulingClient, ServicesCatalogClient | conectada |
| cualquier sesión | `/onboarding` | `OnboardingPractitioner` | ProfilesClient | conectada |
| cualquier sesión | `/pharmacies-directory/:slug` | `PharmacyDetail` | PublicCatalogClient | conectada |
| PRACTITIONER · CLINICIAN | `/questionnaires/:surveyId` | `SurveyDetailScreen` | SurveysClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/appointment/new` | `AppointmentNew` | ProfilesClient, SchedulingClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/blocks` | `Blocks` | SchedulingClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/book/:slotId` | `BookingNew` | ProfilesClient, SchedulingClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/edit` | `AgendaCreate` | SchedulingClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/new` | `AgendaCreate` | SchedulingClient | conectada |
| cualquier sesión | `/superadmin/data-catalog/:objectId` | `CatalogObjectDetail` | DataCatalogClient | conectada |
| cualquier sesión | `/superadmin/flows/:flowId` | `FlowDetailPage` | FlowsClient | conectada |
| cualquier sesión | `/superadmin/qa-lab/plans/:planId` | `QaPlanDetail` | QaLabClient | conectada |

## Vistas del diseñador portadas desde la bóveda

Las 126 pantallas de `features/alovida/`, generadas por `scripts/port-vistas-alovida.mjs` desde la bóveda. Son **la vista del diseñador** a la que se refiere la corrección #8: antes de crear una pantalla nueva hay que buscar acá. 0 todavía pintan con datos de muestra.

| Código | Actor | Ruta | Componente | API que usa | Estado |
|---|---|---|---|---|---|
| V02-08 | security-admin | `/shared-data/internal-versions-scan` | `DatosCompartidosVersionesInternasEscanear` | — | maqueta portada |
| V02-08 | security-admin | `/shared-data/internal-versions-list` | `DatosCompartidosVersionesInternasListado` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/shared-data/files-delete` | `DatosCompartidosArchivosEliminar` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/shared-data/files-form` | `DatosCompartidosArchivosFormulario` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/shared-data/files-list` | `DatosCompartidosArchivosListado` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/shared-data/files-get-link` | `DatosCompartidosArchivosObtenerEnlace` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/shared-data/files-upload` | `DatosCompartidosArchivosSubir` | — | maqueta portada |
| V02-02 | sesion-autenticada | `/shared-data/content-detail` | `DatosCompartidosContenidoDetalle` | — | maqueta portada |
| V02-03 | sesion-autenticada | `/shared-data/links-form` | `DatosCompartidosVinculosFormulario` | — | maqueta portada |
| V02-03 | sesion-autenticada | `/shared-data/links-list` | `DatosCompartidosVinculosListado` | — | maqueta portada |
| V02-04 | sesion-autenticada | `/shared-data/versions-form` | `DatosCompartidosVersionesFormulario` | — | maqueta portada |
| V02-04 | sesion-autenticada | `/shared-data/versions-list` | `DatosCompartidosVersionesListado` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/shared-data/contact-points-form` | `DatosCompartidosPuntosDeContactoFormulario` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/shared-data/contact-points-list` | `DatosCompartidosPuntosDeContactoListado` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/shared-data/contact-points-verify` | `DatosCompartidosPuntosDeContactoVerificar` | — | maqueta portada |
| V02-06 | sesion-autenticada | `/shared-data/addresses-form` | `DatosCompartidosDireccionesFormulario` | — | maqueta portada |
| V02-06 | sesion-autenticada | `/shared-data/addresses-list` | `DatosCompartidosDireccionesListado` | — | maqueta portada |
| V02-07 | sesion-autenticada | `/shared-data/identifiers-form` | `DatosCompartidosIdentificadoresFormulario` | — | maqueta portada |
| V02-07 | sesion-autenticada | `/shared-data/identifiers-list` | `DatosCompartidosIdentificadoresListado` | — | maqueta portada |
| V02-09 | sesion-autenticada | `/shared-data/derivatives-form` | `DatosCompartidosDerivadosFormulario` | — | maqueta portada |
| V02-09 | sesion-autenticada | `/shared-data/derivatives-list` | `DatosCompartidosDerivadosListado` | — | maqueta portada |
| V03-01 | security-admin | `/vocabulary/versions-import` | `TerminologiaVersionesImportar` | — | maqueta portada |
| V03-01 | security-admin | `/vocabulary/versions-list` | `TerminologiaVersionesListado` | — | maqueta portada |
| V03-01 | security-admin | `/vocabulary/versions-publish` | `TerminologiaVersionesPublicar` | — | maqueta portada |
| V03-04 | security-admin | `/vocabulary/value-set-expansion-form` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | — | maqueta portada |
| V03-05 | security-admin | `/vocabulary/code-systems-form` | `TerminologiaSistemasDeCodigosFormulario` | — | maqueta portada |
| V03-05 | security-admin | `/vocabulary/code-systems-list` | `TerminologiaSistemasDeCodigosListado` | — | maqueta portada |
| V03-06 | security-admin | `/vocabulary/system-versions-form` | `TerminologiaVersionesDeSistemaFormulario` | — | maqueta portada |
| V03-06 | security-admin | `/vocabulary/system-versions-list` | `TerminologiaVersionesDeSistemaListado` | — | maqueta portada |
| V03-08 | security-admin | `/vocabulary/concept-deprecation-form` | `TerminologiaDeprecacionDeConceptoFormulario` | — | maqueta portada |
| V03-09 | security-admin | `/vocabulary/designations-form` | `TerminologiaDesignacionesFormulario` | — | maqueta portada |
| V03-09 | security-admin | `/vocabulary/designations-list` | `TerminologiaDesignacionesListado` | — | maqueta portada |
| V03-10 | security-admin | `/vocabulary/properties-form` | `TerminologiaPropiedadesFormulario` | — | maqueta portada |
| V03-10 | security-admin | `/vocabulary/properties-list` | `TerminologiaPropiedadesListado` | — | maqueta portada |
| V03-11 | security-admin | `/vocabulary/relationships-form` | `TerminologiaRelacionesFormulario` | — | maqueta portada |
| V03-11 | security-admin | `/vocabulary/relationships-list` | `TerminologiaRelacionesListado` | — | maqueta portada |
| V03-12 | security-admin | `/vocabulary/catalog-policies-form` | `TerminologiaPoliticasDeCatalogoFormulario` | — | maqueta portada |
| V03-12 | security-admin | `/vocabulary/catalog-policies-list` | `TerminologiaPoliticasDeCatalogoListado` | — | maqueta portada |
| V03-13 | security-admin | `/vocabulary/value-sets-form` | `TerminologiaConjuntosDeValorFormulario` | — | maqueta portada |
| V03-13 | security-admin | `/vocabulary/value-sets-list` | `TerminologiaConjuntosDeValorListado` | — | maqueta portada |
| V03-02 | sesion-autenticada | `/vocabulary/concept-lookup-list` | `TerminologiaConsultaDeConceptoListado` | — | maqueta portada |
| V03-03 | sesion-autenticada | `/vocabulary/catalog-translation-form` | `TerminologiaTraduccionEntreCatalogosFormulario` | — | maqueta portada |
| V03-07 | sesion-autenticada | `/vocabulary/concepts-list` | `TerminologiaConceptosListado` | — | maqueta portada |
| V03-14 | sesion-autenticada | `/vocabulary/value-set-expansion-detail` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | — | maqueta portada |
| V04-01 | security-admin | `/institutions/organizations-list` | `DirectorioOrganizacionesListado` | — | maqueta portada |
| V04-01 | security-admin | `/institutions/organizations-verify` | `DirectorioOrganizacionesVerificar` | — | maqueta portada |
| V04-02 | security-admin | `/institutions/memberships-deactivate` | `DirectorioMembresiasDarDeBaja` | — | maqueta portada |
| V04-02 | security-admin | `/institutions/memberships-form` | `DirectorioMembresiasFormulario` | — | maqueta portada |
| V04-02 | security-admin | `/institutions/memberships-list` | `DirectorioMembresiasListado` | — | maqueta portada |
| V04-03 | security-admin | `/institutions/branch-assignments-form` | `DirectorioAsignacionesDeSucursalFormulario` | — | maqueta portada |
| V04-04 | security-admin | `/institutions/roles-form` | `DirectorioRolesFormulario` | — | maqueta portada |
| V04-05 | security-admin | `/institutions/transfers-form` | `DirectorioTransferenciasFormulario` | — | maqueta portada |
| V04-06 | security-admin | `/institutions/branches-form` | `DirectorioSucursalesFormulario` | — | maqueta portada |
| V04-06 | security-admin | `/institutions/branches-list` | `DirectorioSucursalesListado` | — | maqueta portada |
| V04-07 | security-admin | `/institutions/child-organizations-form` | `DirectorioOrganizacionesHijasFormulario` | — | maqueta portada |
| V04-01 | superadmin | `/institutions/organizations-form` | `DirectorioOrganizacionesFormulario` | — | maqueta portada |
| V04-01 | superadmin | `/institutions/organizations-suspend` | `DirectorioOrganizacionesSuspender` | — | maqueta portada |
| V05-01 | security-admin | `/people/patients-form` | `PersonasPacientesFormulario` | — | maqueta portada |
| V05-01 | security-admin | `/people/patients-merge` | `PersonasPacientesFusionar` | — | maqueta portada |
| V05-01 | security-admin | `/people/patients-list` | `PersonasPacientesListado` | — | maqueta portada |
| V05-01 | security-admin | `/people/patients-revert` | `PersonasPacientesRevertir` | — | maqueta portada |
| V05-02 | security-admin | `/people/identity-links-form` | `PersonasVinculosDeIdentidadFormulario` | — | maqueta portada |
| V05-02 | security-admin | `/people/identity-links-list` | `PersonasVinculosDeIdentidadListado` | — | maqueta portada |
| V05-04 | security-admin | `/people/portal-proxies-form` | `PersonasApoderadosDePortalFormulario` | — | maqueta portada |
| V05-04 | security-admin | `/people/portal-proxies-list` | `PersonasApoderadosDePortalListado` | — | maqueta portada |
| V05-05 | security-admin | `/people/related-persons-form` | `PersonasRelacionadasFormulario` | — | maqueta portada |
| V05-05 | security-admin | `/people/related-persons-list` | `PersonasRelacionadasListado` | — | maqueta portada |
| V05-06 | security-admin | `/people/credentials-list` | `PersonasCredencialesListado` | — | maqueta portada |
| V05-06 | security-admin | `/people/credentials-verify` | `PersonasCredencialesVerificar` | — | maqueta portada |
| V05-07 | security-admin | `/people/people-list` | `PersonasListado` | — | maqueta portada |
| V05-07 | security-admin | `/people/people-record-death` | `PersonasRegistrarDefuncion` | — | maqueta portada |
| V05-08 | security-admin | `/people/account-links-form` | `PersonasVinculosDeCuentaFormulario` | — | maqueta portada |
| V05-08 | security-admin | `/people/account-links-list` | `PersonasVinculosDeCuentaListado` | — | maqueta portada |
| V05-09 | security-admin | `/people/practitioners-form` | `PersonasProfesionalesFormulario` | — | maqueta portada |
| V05-09 | security-admin | `/people/practitioners-list` | `PersonasProfesionalesListado` | — | maqueta portada |
| V05-10 | security-admin | `/people/jurisdiction-authorizations-form` | `PersonasAutorizacionesDeJurisdiccionFormulario` | — | maqueta portada |
| V05-10 | security-admin | `/people/jurisdiction-authorizations-list` | `PersonasAutorizacionesDeJurisdiccionListado` | — | maqueta portada |
| V05-11 | security-admin | `/people/specialties-form` | `PersonasEspecialidadesFormulario` | — | maqueta portada |
| V05-11 | security-admin | `/people/specialties-list` | `PersonasEspecialidadesListado` | — | maqueta portada |
| V05-03 | sesion-autenticada | `/people/own-summary-list` | `PersonasResumenPropioListado` | — | maqueta portada |
| V06-05 | clinical-approver | `/access/emergency-access-form` | `AccesosAccesoDeEmergenciaFormulario` | — | maqueta portada |
| V06-06 | clinical-approver | `/access/patient-clinical-access-form` | `AccesosClinicosDelPacienteFormulario` | — | maqueta portada |
| V06-06 | clinical-approver | `/access/patient-clinical-access-list` | `AccesosClinicosDelPacienteListado` | — | maqueta portada |
| V06-01 | clinician | `/access/care-relationships-form` | `AccesosRelacionesDeCuidadoFormulario` | — | maqueta portada |
| V06-01 | clinician | `/access/care-relationships-list` | `AccesosRelacionesDeCuidadoListado` | — | maqueta portada |
| V06-01 | clinician | `/access/care-relationships-revoke` | `AccesosRelacionesDeCuidadoRevocar` | — | maqueta portada |
| V06-02 | security-admin | `/access/legal-representations-form` | `AccesosRepresentacionesLegalesFormulario` | — | maqueta portada |
| V06-02 | security-admin | `/access/legal-representations-list` | `AccesosRepresentacionesLegalesListado` | — | maqueta portada |
| V06-02 | security-admin | `/access/legal-representations-revoke` | `AccesosRepresentacionesLegalesRevocar` | — | maqueta portada |
| V06-03 | security-admin | `/access/clinical-access-list` | `AccesosClinicosListado` | — | maqueta portada |
| V06-03 | security-admin | `/access/clinical-access-revoke` | `AccesosClinicosRevocar` | — | maqueta portada |
| V06-04 | security-admin | `/access/decisions-evaluate` | `AccesosDecisionesEvaluar` | — | maqueta portada |
| V06-07 | security-admin | `/access/cache-invalidate` | `AccesosCacheInvalidar` | — | maqueta portada |
| V06-08 | security-admin | `/access/permission-categories-form` | `AccesosCategoriasDePermisoFormulario` | — | maqueta portada |
| V06-08 | security-admin | `/access/permission-categories-list` | `AccesosCategoriasDePermisoListado` | — | maqueta portada |
| V06-09 | security-admin | `/access/permissions-form` | `AccesosPermisosFormulario` | — | maqueta portada |
| V06-09 | security-admin | `/access/permissions-list` | `AccesosPermisosListado` | — | maqueta portada |
| V06-10 | security-admin | `/access/resource-scope-form` | `AccesosAlcanceDeRecursoFormulario` | — | maqueta portada |
| V06-10 | security-admin | `/access/resource-scope-list` | `AccesosAlcanceDeRecursoListado` | — | maqueta portada |
| V06-11 | security-admin | `/access/roles-form` | `AccesosRolesFormulario` | — | maqueta portada |
| V06-11 | security-admin | `/access/roles-list` | `AccesosRolesListado` | — | maqueta portada |
| V06-12 | security-admin | `/access/field-permissions-form` | `AccesosPermisosDeCampoFormulario` | — | maqueta portada |
| V06-12 | security-admin | `/access/field-permissions-list` | `AccesosPermisosDeCampoListado` | — | maqueta portada |
| V06-13 | security-admin | `/access/role-permissions-form` | `AccesosPermisosDelRolFormulario` | — | maqueta portada |
| V06-13 | security-admin | `/access/role-permissions-list` | `AccesosPermisosDelRolListado` | — | maqueta portada |
| V06-14 | security-admin | `/access/access-policies-form` | `AccesosPoliticasDeAccesoFormulario` | — | maqueta portada |
| V06-14 | security-admin | `/access/access-policies-list` | `AccesosPoliticasDeAccesoListado` | — | maqueta portada |
| V06-15 | security-admin | `/access/permission-grants-form` | `AccesosConcesionesDePermisoFormulario` | — | maqueta portada |
| V06-15 | security-admin | `/access/permission-grants-list` | `AccesosConcesionesDePermisoListado` | — | maqueta portada |
| V06-16 | security-admin | `/access/role-assignments-form` | `AccesosAsignacionesDeRolFormulario` | — | maqueta portada |
| V06-16 | security-admin | `/access/role-assignments-list` | `AccesosAsignacionesDeRolListado` | — | maqueta portada |
| V65-01 | publico | `/explore/finder-list` | `BuscarBuscadorListado` | PublicDirectoryClient | conectada |
| V65-02 | publico | `/explore/practitioners-list` | `BuscarProfesionalesListado` | PublicDirectoryClient | conectada con deuda |
| V65-03 | publico | `/explore/medications-list` | `BuscarMedicamentosListado` | PublicMarketplaceClient | conectada |
| V65-04 | publico | `/explore/hospitals-list` | `BuscarHospitalesListado` | PublicDirectoryClient | conectada |
| V65-05 | publico | `/explore/laboratories-list` | `BuscarLaboratoriosListado` | PublicDirectoryClient | conectada |
| V65-06 | publico | `/explore/insurers-list` | `BuscarAseguradorasListado` | PublicDirectoryClient | conectada |
| V65-07 | publico | `/explore/practitioner-profile-detail` | `BuscarPerfilProfesionalDetalle` | — | maqueta portada |
| V65-08 | publico | `/explore/organization-profile-detail` | `BuscarPerfilOrganizacionDetalle` | — | maqueta portada |
| V65-09 | publico | `/explore/pharmacy-profile-detail` | `BuscarPerfilFarmaciaDetalle` | — | maqueta portada |
| V65-10 | publico | `/explore/laboratory-profile-detail` | `BuscarPerfilLaboratorioDetalle` | — | maqueta portada |
| V65-11 | publico | `/explore/insurer-profile-detail` | `BuscarPerfilAseguradoraDetalle` | — | maqueta portada |
| V65-12 | publico | `/explore/nearby-detail` | `BuscarCercaniaDetalle` | PublicDirectoryClient | conectada |
| V65-13 | sesion-autenticada | `/explore/followed-and-saved-list` | `BuscarSeguidosYGuardadosListado` | — | maqueta portada |
| V65-14 | sesion-autenticada | `/explore/rate-care-form` | `BuscarCalificarLaAtencionFormulario` | — | maqueta portada |
| null | — | `/home` | `InicioPortada` | — | maqueta portada |

## Recuento

| Estado | Pantallas |
|---|---|
| conectada | 191 |
| maqueta portada | 119 |
| presentacional | 11 |
| conectada con deuda | 6 |
| sin pantalla | 2 |
