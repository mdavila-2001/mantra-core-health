<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de componentes y servicios

304 componentes y 38 servicios inyectables, leídos de `src/`.

## Átomo (16)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-avatar` | `Avatar` | `src`, `name`, `initials`, `size`, `status`, `alt` | — | — | OnPush | sí |
| `app-badge` | `Badge` | `variant`, `size`, `value`, `max`, `dotOnly`, `label` | — | — | OnPush | sí |
| `a[app-button]` | `AppButtonLink` | `variant`, `size`, `disabled`, `iconOnly` | — | — | OnPush | sí |
| `button[app-button]` | `AppButton` | `variant`, `size`, `isLoading`, `disabled`, `type`, `iconOnly` | `clicked` | — | OnPush | sí |
| `app-checkbox` | `Checkbox` | `disabled`, `label`, `hasError`, `indeterminate`, `hideLabel` | — | `checked` | OnPush | sí |
| `app-chip` | `Chip` | `variant`, `size`, `label`, `removable`, `selectable` | `removed` | `selected` | OnPush | sí |
| `app-divider` | `Divider` | `orientation`, `label` | — | — | OnPush | sí |
| `app-input` | `Input` | `type`, `autocomplete`, `placeholder`, `disabled`, `readonly`, `hasError`, `hasSuccess`, `testId`, `comboboxAria` | `focused`, `blurred` | `value` | OnPush | sí |
| `a[app-link]` | `Link` | `variant`, `external` | — | — | OnPush | sí |
| `app-progress` | `Progress` | `value`, `tone`, `size`, `label` | — | — | OnPush | sí |
| `app-select` | `Select` | `options`, `disabled`, `placeholder`, `hasError`, `ariaLabel` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-skeleton` | `Skeleton` | `variant`, `width`, `height`, `lines` | — | — | OnPush | sí |
| `app-spinner` | `Spinner` | `size`, `label`, `decorative` | — | — | OnPush | sí |
| `app-switch` | `Switch` | `disabled`, `label` | — | `checked` | OnPush | sí |
| `app-textarea` | `Textarea` | `placeholder`, `rows`, `maxRows`, `maxLength`, `autoResize`, `disabled`, `readonly`, `hasError` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-tooltip-panel` | `TooltipPanel` | `text`, `position`, `panelId`, `top`, `left` | — | — | OnPush | **no** |

## Molécula (22)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-accordion-panel` | `AccordionPanel` | `heading`, `disabled` | — | `expanded` | OnPush | **no** |
| `app-accordion` | `Accordion` | `multi` | — | — | OnPush | sí |
| `app-alert` | `Alert` | `tone`, `title`, `dismissible`, `icon` | `dismissed` | — | OnPush | sí |
| `app-avatar-group` | `AvatarGroup` | `overflow`, `size`, `label` | — | — | OnPush | sí |
| `app-breadcrumb` | `Breadcrumb` | `items` | — | — | OnPush | sí |
| `app-card` | `Card` | `variant`, `padding`, `interactive` | `activated` | — | OnPush | sí |
| `app-concept-select` | `ConceptSelect` | `target`, `disabled`, `valueField`, `labels`, `placeholder` | — | `value` | OnPush | **no** |
| `app-dialog` | `Dialog` | `config` | `resolved` | — | OnPush | sí |
| `app-empty-state` | `EmptyState` | `title`, `description`, `variant` | — | — | OnPush | sí |
| `app-file-input` | `FileInput` | `multiple`, `disabled`, `accept`, `maxSizeBytes`, `maxFiles` | `rejected` | `files` | OnPush | sí |
| `app-form-field` | `FormField` | `label`, `hint`, `errorMessage`, `required` | — | — | OnPush | sí |
| `app-menu-item` | `MenuItem` | `disabled`, `destructive` | `selected` | — | OnPush | **no** |
| `app-menu` | `Menu` | — | `closed` | — | OnPush | sí |
| `app-pagination` | `Pagination` | `totalItems`, `pageSizeOptions`, `showPageSize` | — | `page`, `pageSize` | OnPush | sí |
| `app-radio-group` | `RadioGroup` | `disabled`, `hasError`, `name` | — | `value` | OnPush | sí |
| `app-radio` | `Radio` | `value`, `label`, `disabled` | — | — | OnPush | **no** |
| `app-reference-combobox` | `ReferenceCombobox` | `selected`, `options`, `loading`, `disabled`, `placeholder`, `debounceMs`, `minQueryLength`, `label`, `emptyMessage` | `searched`, `selectionChange` | `value` | OnPush | sí |
| `app-search-field` | `SearchField` | `placeholder`, `debounceMs`, `loading`, `disabled`, `label` | `searched` | `value` | OnPush | sí |
| `li[app-search-result]` | `SearchResult` | `resultado` | — | — | OnPush | sí |
| `app-tab` | `Tab` | `label`, `disabled` | — | — | OnPush | **no** |
| `app-tabs` | `Tabs` | `orientation` | — | `selectedIndex` | OnPush | sí |
| `app-toast` | `Toast` | `toast` | `dismissed` | — | OnPush | sí |

## Organismo (15)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-auth-layout` | `AuthLayout` | `title`, `subtitle`, `showBrand` | — | — | OnPush | sí |
| `app-auth-split` | `AuthSplit` | `claim`, `tagline` | — | — | OnPush | sí |
| `app-data-table` | `DataTable` | `state`, `columns`, `trackBy`, `caption`, `selectable`, `sort`, `cursor` | `sortChanged`, `cursorChanged`, `selectionChanged`, `retry`, `refresh` | — | OnPush | sí |
| `app-date-picker` | `DatePicker` | `mode`, `disabled`, `placeholder`, `hasError` | — | `value` | OnPush | sí |
| `app-filter-bar` | `FilterBar` | `filters`, `searchLabel` | `filtersChanged` | — | OnPush | sí |
| `app-form-actions` | `FormActions` | `submitLabel`, `cancelLabel`, `pending`, `disabled`, `destructive`, `correctionOnly`, `confirmTitle`, `confirmMessage` | `submitted`, `cancelled` | — | OnPush | sí |
| `app-form-section` | `FormSection` | `legend`, `description`, `collapsible`, `invalid` | — | `expanded` | OnPush | sí |
| `header[app-header]` | `Header` | `user`, `tenants`, `activeTenantId`, `showMenuButton`, `menuOpen`, `navPanelId` | `menuToggled`, `logoutRequested`, `tenantChanged` | — | OnPush | sí |
| `app-page-header` | `PageHeader` | `title`, `subtitle`, `breadcrumbs`, `secondaryActions` | `actionSelected` | — | OnPush | sí |
| `app-shell` | `Shell` | `user`, `sections`, `tenants`, `activeTenantId`, `drawerMode` | `logoutRequested`, `tenantChanged` | — | OnPush | sí |
| `app-side-nav` | `SideNav` | `sections`, `collapsed`, `drawer`, `open` | `closeRequested` | — | OnPush | sí |
| `app-status-seal` | `StatusSeal` | `variant`, `label` | — | — | OnPush | sí |
| `app-tenant-switcher` | `TenantSwitcher` | `tenants`, `activeTenantId`, `variant` | `tenantChanged` | — | OnPush | sí |
| `app-toast-container` | `ToastContainer` | — | — | — | OnPush | **no** |
| `app-view-state-host` | `ViewStateHost` | `state` | `retry`, `refresh` | — | OnPush | sí |

## Feature (249)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-appointments` | `Appointments` | — | — | — | OnPush | sí |
| `app-my-profile` | `MyProfile` | — | — | — | OnPush | sí |
| `app-accounting` | `Accounting` | — | — | — | OnPush | **no** |
| `app-assisted-registration` | `AssistedRegistration` | — | — | — | OnPush | sí |
| `app-organization-detail` | `OrganizationDetail` | — | — | — | OnPush | **no** |
| `app-organization-list` | `OrganizationList` | — | — | — | OnPush | sí |
| `app-organization-new` | `OrganizationNew` | — | — | — | OnPush | sí |
| `app-patient-detail` | `PatientDetail` | — | — | — | OnPush | sí |
| `app-patient-list` | `PatientList` | — | — | — | OnPush | sí |
| `app-patient-merge` | `PatientMerge` | — | — | — | OnPush | sí |
| `app-patient-new` | `PatientNew` | — | — | — | OnPush | sí |
| `app-related-person-form` | `RelatedPersonForm` | `profileId`, `yaTieneTutor` | `registered`, `cancelled` | — | OnPush | sí |
| `app-terminology-catalog` | `TerminologyCatalog` | — | — | — | OnPush | sí |
| `app-user-registration` | `UserRegistration` | — | — | — | OnPush | sí |
| `app-agenda` | `Agenda` | — | — | — | OnPush | sí |
| `app-booking-new` | `BookingNew` | — | — | — | OnPush | sí |
| `app-account-link-complete-form` | `AccountLinkCompleteForm` | — | — | — | OnPush | sí |
| `app-account-link-request-form` | `AccountLinkRequestForm` | — | — | — | OnPush | sí |
| `app-attribute-mappings-editor` | `AttributeMappingsEditor` | `disabled` | — | — | OnPush | sí |
| `app-attribute-mappings-form` | `AttributeMappingsForm` | — | — | — | OnPush | sí |
| `app-auth-providers-home` | `AuthProvidersHome` | — | — | — | OnPush | sí |
| `app-discovered-keys-editor` | `DiscoveredKeysEditor` | `disabled` | — | — | OnPush | sí |
| `app-identity-unlink-form` | `IdentityUnlinkForm` | — | — | — | OnPush | sí |
| `app-key-rotation-form` | `KeyRotationForm` | — | — | — | OnPush | sí |
| `app-login-callback-form` | `LoginCallbackForm` | — | — | — | OnPush | sí |
| `app-login-start-form` | `LoginStartForm` | — | — | — | OnPush | sí |
| `app-protocol-config-form` | `ProtocolConfigForm` | — | — | — | OnPush | sí |
| `app-provider-form` | `ProviderForm` | — | — | — | OnPush | sí |
| `app-provisioning-rule-form` | `ProvisioningRuleForm` | — | — | — | OnPush | sí |
| `app-signing-key-fields` | `SigningKeyFields` | `disabled` | — | — | OnPush | sí |
| `app-signing-key-form` | `SigningKeyForm` | — | — | — | OnPush | sí |
| `app-tenant-binding-form` | `TenantBindingForm` | — | — | — | OnPush | sí |
| `app-activate-account` | `ActivateAccount` | — | — | — | OnPush | sí |
| `app-forgot-password` | `ForgotPassword` | — | — | — | OnPush | sí |
| `app-login` | `Login` | — | — | — | OnPush | sí |
| `app-register-patient` | `RegisterPatient` | — | — | — | OnPush | sí |
| `app-resend-verification` | `ResendVerification` | — | — | — | OnPush | sí |
| `app-reset-password` | `ResetPassword` | — | — | — | OnPush | sí |
| `app-tenant-selection` | `TenantSelection` | — | — | — | OnPush | sí |
| `app-verify-email` | `VerifyEmail` | — | — | — | OnPush | sí |
| `app-clinical-record` | `ClinicalRecord` | — | — | — | OnPush | sí |
| `app-diagnosis-block` | `DiagnosisBlock` | `patientProfileId`, `encounterId` | `cambio` | — | OnPush | sí |
| `app-medication-block` | `MedicationBlock` | `patientProfileId`, `encounterId`, `recetas` | `cambio` | — | OnPush | sí |
| `app-patient-chart` | `PatientChart` | — | — | — | OnPush | sí |
| `app-dashboard` | `Dashboard` | — | — | — | OnPush | sí |
| `app-access-request-form` | `AccessRequestForm` | — | — | — | OnPush | sí |
| `app-access-request-resolution` | `AccessRequestResolution` | — | — | — | OnPush | sí |
| `app-actor-evaluation` | `ActorEvaluation` | — | — | — | OnPush | sí |
| `app-delegated-access-home` | `DelegatedAccessHome` | — | — | — | OnPush | sí |
| `app-delegation-revocation` | `DelegationRevocation` | — | — | — | OnPush | sí |
| `app-expiry-sweep` | `ExpirySweep` | — | — | — | OnPush | sí |
| `app-grant-form` | `GrantForm` | — | — | — | OnPush | sí |
| `app-org-assignment-form` | `OrgAssignmentForm` | — | — | — | OnPush | sí |
| `app-org-assignment-update` | `OrgAssignmentUpdate` | — | — | — | OnPush | sí |
| `app-permission-set-form` | `PermissionSetForm` | — | — | — | OnPush | sí |
| `app-practitioner-delegate-form` | `PractitionerDelegateForm` | — | — | — | OnPush | sí |
| `app-set-items-editor` | `SetItemsEditor` | `disabled` | — | — | OnPush | sí |
| `app-set-version-form` | `SetVersionForm` | — | — | — | OnPush | sí |
| `app-design-system-sample` | `DesignSystemSample` | — | — | — | OnPush | sí |
| `app-organisms-gallery` | `OrganismsGallery` | — | — | — | OnPush | **no** |
| `app-view-state-gallery` | `ViewStateGallery` | — | — | — | OnPush | sí |
| `app-error-recovery` | `ErrorRecovery` | — | — | — | OnPush | **no** |
| `app-consent-revocation` | `ConsentRevocation` | — | — | — | OnPush | sí |
| `app-geo-home` | `GeoHome` | — | — | — | OnPush | sí |
| `app-geofence-event-form` | `GeofenceEventForm` | — | — | — | OnPush | sí |
| `app-geofence-form` | `GeofenceForm` | — | — | — | OnPush | sí |
| `app-last-position` | `LastPosition` | — | — | — | OnPush | sí |
| `app-ping-ingest` | `PingIngest` | — | — | — | OnPush | sí |
| `app-tracked-subject-form` | `TrackedSubjectForm` | — | — | — | OnPush | sí |
| `app-tracking-session-close` | `TrackingSessionClose` | — | — | — | OnPush | sí |
| `app-tracking-session-form` | `TrackingSessionForm` | — | — | — | OnPush | sí |
| `app-trip-close` | `TripClose` | — | — | — | OnPush | sí |
| `app-trip-form` | `TripForm` | — | — | — | OnPush | sí |
| `app-agent-form` | `AgentForm` | — | — | — | OnPush | sí |
| `app-collection-run-finish` | `CollectionRunFinish` | — | — | — | OnPush | sí |
| `app-collection-run-form` | `CollectionRunForm` | — | — | — | OnPush | sí |
| `app-context-form` | `ContextForm` | — | — | — | OnPush | sí |
| `app-context-resolve` | `ContextResolve` | — | — | — | OnPush | sí |
| `app-health-context-home` | `HealthContextHome` | — | — | — | OnPush | sí |
| `app-observation-form` | `ObservationForm` | — | — | — | OnPush | sí |
| `app-quality-review-form` | `QualityReviewForm` | — | — | — | OnPush | sí |
| `app-schedule-form` | `ScheduleForm` | — | — | — | OnPush | sí |
| `app-source-form` | `SourceForm` | — | — | — | OnPush | sí |
| `app-version-form` | `VersionForm` | — | — | — | OnPush | sí |
| `app-version-publish` | `VersionPublish` | — | — | — | OnPush | sí |
| `app-version-supersede` | `VersionSupersede` | — | — | — | OnPush | sí |
| `app-assertion-issue-form` | `AssertionIssueForm` | — | — | — | OnPush | sí |
| `app-assertion-revoke-form` | `AssertionRevokeForm` | — | — | — | OnPush | sí |
| `app-authority-endpoint-form` | `AuthorityEndpointForm` | — | — | — | OnPush | sí |
| `app-authority-form` | `AuthorityForm` | — | — | — | OnPush | sí |
| `app-case-evidence-form` | `CaseEvidenceForm` | — | — | — | OnPush | sí |
| `app-case-expire-sweep` | `CaseExpireSweep` | — | — | — | OnPush | sí |
| `app-case-open-form` | `CaseOpenForm` | — | — | — | OnPush | sí |
| `app-case-queue` | `CaseQueue` | — | — | — | OnPush | sí |
| `app-check-attempt-form` | `CheckAttemptForm` | — | — | — | OnPush | sí |
| `app-check-plan-form` | `CheckPlanForm` | — | — | — | OnPush | sí |
| `app-check-result-form` | `CheckResultForm` | — | — | — | OnPush | sí |
| `app-fraud-signal-form` | `FraudSignalForm` | — | — | — | OnPush | sí |
| `app-identity-admin-home` | `IdentityAdminHome` | — | — | — | OnPush | sí |
| `app-manual-review-form` | `ManualReviewForm` | — | — | — | OnPush | sí |
| `app-review-decision-form` | `ReviewDecisionForm` | — | — | — | OnPush | sí |
| `app-verification-case-detail` | `VerificationCaseDetail` | — | — | — | OnPush | sí |
| `app-verification-cases` | `VerificationCases` | — | — | — | OnPush | sí |
| `app-verification-policy-form` | `VerificationPolicyForm` | — | — | — | OnPush | sí |
| `app-identity-verification` | `IdentityVerification` | — | — | — | OnPush | sí |
| `app-not-found` | `NotFound` | — | — | — | OnPush | sí |
| `app-redsat-accesos-acceso-de-emergencia-formulario` | `AccesosAccesoDeEmergenciaFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-clinicos-del-paciente-formulario` | `AccesosClinicosDelPacienteFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-clinicos-del-paciente-listado` | `AccesosClinicosDelPacienteListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-clinicos-listado` | `AccesosClinicosListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-clinicos-revocar` | `AccesosClinicosRevocar` | — | — | — | Default | **no** |
| `app-redsat-accesos-alcance-de-recurso-formulario` | `AccesosAlcanceDeRecursoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-alcance-de-recurso-listado` | `AccesosAlcanceDeRecursoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-asignaciones-de-rol-formulario` | `AccesosAsignacionesDeRolFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-asignaciones-de-rol-listado` | `AccesosAsignacionesDeRolListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-cache-invalidar` | `AccesosCacheInvalidar` | — | — | — | Default | **no** |
| `app-redsat-accesos-categorias-de-permiso-formulario` | `AccesosCategoriasDePermisoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-categorias-de-permiso-listado` | `AccesosCategoriasDePermisoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-concesiones-de-permiso-formulario` | `AccesosConcesionesDePermisoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-concesiones-de-permiso-listado` | `AccesosConcesionesDePermisoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-decisiones-evaluar` | `AccesosDecisionesEvaluar` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-de-campo-formulario` | `AccesosPermisosDeCampoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-de-campo-listado` | `AccesosPermisosDeCampoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-del-rol-formulario` | `AccesosPermisosDelRolFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-del-rol-listado` | `AccesosPermisosDelRolListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-formulario` | `AccesosPermisosFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-permisos-listado` | `AccesosPermisosListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-politicas-de-acceso-formulario` | `AccesosPoliticasDeAccesoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-politicas-de-acceso-listado` | `AccesosPoliticasDeAccesoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-relaciones-de-cuidado-formulario` | `AccesosRelacionesDeCuidadoFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-relaciones-de-cuidado-listado` | `AccesosRelacionesDeCuidadoListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-relaciones-de-cuidado-revocar` | `AccesosRelacionesDeCuidadoRevocar` | — | — | — | Default | **no** |
| `app-redsat-accesos-representaciones-legales-formulario` | `AccesosRepresentacionesLegalesFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-representaciones-legales-listado` | `AccesosRepresentacionesLegalesListado` | — | — | — | Default | **no** |
| `app-redsat-accesos-representaciones-legales-revocar` | `AccesosRepresentacionesLegalesRevocar` | — | — | — | Default | **no** |
| `app-redsat-accesos-roles-formulario` | `AccesosRolesFormulario` | — | — | — | Default | **no** |
| `app-redsat-accesos-roles-listado` | `AccesosRolesListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-aseguradoras-listado` | `BuscarAseguradorasListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-buscador-listado` | `BuscarBuscadorListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | — | — | — | Default | **no** |
| `app-redsat-buscar-cercania-detalle` | `BuscarCercaniaDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-hospitales-listado` | `BuscarHospitalesListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-laboratorios-listado` | `BuscarLaboratoriosListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-medicamentos-listado` | `BuscarMedicamentosListado` | — | — | — | Default | **no** |
| `app-redsat-buscar-perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | — | — | — | Default | **no** |
| `app-redsat-buscar-profesionales-listado` | `BuscarProfesionalesListado` | — | — | — | OnPush | **no** |
| `app-redsat-buscar-seguidos-y-guardados-listado` | `BuscarSeguidosYGuardadosListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-archivos-eliminar` | `DatosCompartidosArchivosEliminar` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-archivos-formulario` | `DatosCompartidosArchivosFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-archivos-listado` | `DatosCompartidosArchivosListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-archivos-obtener-enlace` | `DatosCompartidosArchivosObtenerEnlace` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-archivos-subir` | `DatosCompartidosArchivosSubir` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-contenido-detalle` | `DatosCompartidosContenidoDetalle` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-derivados-formulario` | `DatosCompartidosDerivadosFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-derivados-listado` | `DatosCompartidosDerivadosListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-direcciones-formulario` | `DatosCompartidosDireccionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-direcciones-listado` | `DatosCompartidosDireccionesListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-identificadores-formulario` | `DatosCompartidosIdentificadoresFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-identificadores-listado` | `DatosCompartidosIdentificadoresListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-puntos-de-contacto-formulario` | `DatosCompartidosPuntosDeContactoFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-puntos-de-contacto-listado` | `DatosCompartidosPuntosDeContactoListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-puntos-de-contacto-verificar` | `DatosCompartidosPuntosDeContactoVerificar` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-versiones-formulario` | `DatosCompartidosVersionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-versiones-internas-escanear` | `DatosCompartidosVersionesInternasEscanear` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-versiones-internas-listado` | `DatosCompartidosVersionesInternasListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-versiones-listado` | `DatosCompartidosVersionesListado` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-vinculos-formulario` | `DatosCompartidosVinculosFormulario` | — | — | — | Default | **no** |
| `app-redsat-datos-compartidos-vinculos-listado` | `DatosCompartidosVinculosListado` | — | — | — | Default | **no** |
| `app-redsat-directorio-asignaciones-de-sucursal-formulario` | `DirectorioAsignacionesDeSucursalFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-membresias-dar-de-baja` | `DirectorioMembresiasDarDeBaja` | — | — | — | Default | **no** |
| `app-redsat-directorio-membresias-formulario` | `DirectorioMembresiasFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-membresias-listado` | `DirectorioMembresiasListado` | — | — | — | Default | **no** |
| `app-redsat-directorio-organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-organizaciones-listado` | `DirectorioOrganizacionesListado` | — | — | — | Default | **no** |
| `app-redsat-directorio-organizaciones-suspender` | `DirectorioOrganizacionesSuspender` | — | — | — | Default | **no** |
| `app-redsat-directorio-organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | — | — | — | Default | **no** |
| `app-redsat-directorio-roles-formulario` | `DirectorioRolesFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-sucursales-formulario` | `DirectorioSucursalesFormulario` | — | — | — | Default | **no** |
| `app-redsat-directorio-sucursales-listado` | `DirectorioSucursalesListado` | — | — | — | Default | **no** |
| `app-redsat-directorio-transferencias-formulario` | `DirectorioTransferenciasFormulario` | — | — | — | Default | **no** |
| `app-redsat-inicio-portada` | `InicioPortada` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-asignaciones-de-sucursal-formulario` | `OrganizacionesAsignacionesDeSucursalFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-membresias-dar-de-baja` | `OrganizacionesMembresiasDarDeBaja` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-membresias-formulario` | `OrganizacionesMembresiasFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-membresias-listado` | `OrganizacionesMembresiasListado` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-formulario` | `OrganizacionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-hijas-formulario` | `OrganizacionesHijasFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-listado` | `OrganizacionesListado` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-suspender` | `OrganizacionesSuspender` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-verificar` | `OrganizacionesVerificar` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-roles-formulario` | `OrganizacionesRolesFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-sucursales-formulario` | `OrganizacionesSucursalesFormulario` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-sucursales-listado` | `OrganizacionesSucursalesListado` | — | — | — | Default | **no** |
| `app-redsat-organizaciones-transferencias-formulario` | `OrganizacionesTransferenciasFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-apoderados-de-portal-formulario` | `PersonasApoderadosDePortalFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-apoderados-de-portal-listado` | `PersonasApoderadosDePortalListado` | — | — | — | Default | **no** |
| `app-redsat-personas-autorizaciones-de-jurisdiccion-formulario` | `PersonasAutorizacionesDeJurisdiccionFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-autorizaciones-de-jurisdiccion-listado` | `PersonasAutorizacionesDeJurisdiccionListado` | — | — | — | Default | **no** |
| `app-redsat-personas-credenciales-listado` | `PersonasCredencialesListado` | — | — | — | Default | **no** |
| `app-redsat-personas-credenciales-verificar` | `PersonasCredencialesVerificar` | — | — | — | Default | **no** |
| `app-redsat-personas-especialidades-formulario` | `PersonasEspecialidadesFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-especialidades-listado` | `PersonasEspecialidadesListado` | — | — | — | Default | **no** |
| `app-redsat-personas-pacientes-formulario` | `PersonasPacientesFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-pacientes-fusionar` | `PersonasPacientesFusionar` | — | — | — | Default | **no** |
| `app-redsat-personas-pacientes-listado` | `PersonasPacientesListado` | — | — | — | Default | **no** |
| `app-redsat-personas-pacientes-revertir` | `PersonasPacientesRevertir` | — | — | — | Default | **no** |
| `app-redsat-personas-listado` | `PersonasListado` | — | — | — | Default | **no** |
| `app-redsat-personas-registrar-defuncion` | `PersonasRegistrarDefuncion` | — | — | — | Default | **no** |
| `app-redsat-personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-relacionadas-listado` | `PersonasRelacionadasListado` | — | — | — | Default | **no** |
| `app-redsat-personas-profesionales-formulario` | `PersonasProfesionalesFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-profesionales-listado` | `PersonasProfesionalesListado` | — | — | — | Default | **no** |
| `app-redsat-personas-resumen-propio-listado` | `PersonasResumenPropioListado` | — | — | — | Default | **no** |
| `app-redsat-personas-vinculos-de-cuenta-formulario` | `PersonasVinculosDeCuentaFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-vinculos-de-cuenta-listado` | `PersonasVinculosDeCuentaListado` | — | — | — | Default | **no** |
| `app-redsat-personas-vinculos-de-identidad-formulario` | `PersonasVinculosDeIdentidadFormulario` | — | — | — | Default | **no** |
| `app-redsat-personas-vinculos-de-identidad-listado` | `PersonasVinculosDeIdentidadListado` | — | — | — | Default | **no** |
| `app-redsat-public-shell` | `RedsatPublicShell` | — | — | — | Default | **no** |
| `app-redsat-shell` | `RedsatShell` | — | — | — | Default | sí |
| `app-redsat-terminologia-conceptos-listado` | `TerminologiaConceptosListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-conjuntos-de-valor-formulario` | `TerminologiaConjuntosDeValorFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-deprecacion-de-concepto-formulario` | `TerminologiaDeprecacionDeConceptoFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-designaciones-formulario` | `TerminologiaDesignacionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-designaciones-listado` | `TerminologiaDesignacionesListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-expansion-de-conjunto-de-valores-detalle` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | — | — | — | Default | **no** |
| `app-redsat-terminologia-expansion-de-conjunto-de-valores-formulario` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-politicas-de-catalogo-formulario` | `TerminologiaPoliticasDeCatalogoFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-politicas-de-catalogo-listado` | `TerminologiaPoliticasDeCatalogoListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-propiedades-formulario` | `TerminologiaPropiedadesFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-propiedades-listado` | `TerminologiaPropiedadesListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-relaciones-formulario` | `TerminologiaRelacionesFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-relaciones-listado` | `TerminologiaRelacionesListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-sistemas-de-codigos-formulario` | `TerminologiaSistemasDeCodigosFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-traduccion-entre-catalogos-formulario` | `TerminologiaTraduccionEntreCatalogosFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-versiones-de-sistema-formulario` | `TerminologiaVersionesDeSistemaFormulario` | — | — | — | Default | **no** |
| `app-redsat-terminologia-versiones-de-sistema-listado` | `TerminologiaVersionesDeSistemaListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-versiones-importar` | `TerminologiaVersionesImportar` | — | — | — | Default | **no** |
| `app-redsat-terminologia-versiones-listado` | `TerminologiaVersionesListado` | — | — | — | Default | **no** |
| `app-redsat-terminologia-versiones-publicar` | `TerminologiaVersionesPublicar` | — | — | — | Default | **no** |
| `app-section-placeholder` | `SectionPlaceholder` | — | — | — | OnPush | sí |
| `app-shell-layout` | `ShellLayout` | — | — | — | OnPush | sí |

## Core (1)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-toast-dev-panel` | `ToastDevPanel` | — | — | — | OnPush | **no** |

## Otro (1)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-root` | `App` | — | — | — | Default | sí |

## Servicios (38)

| Clase | Archivo | Ámbito | Prueba |
|---|---|---|---|
| `AuthService` | `src/app/core/auth/auth.service.ts` | root | sí |
| `IdleLogout` | `src/app/core/auth/idle-logout.ts` | root | sí |
| `RefreshTokenStorage` | `src/app/core/auth/refresh-token.storage.ts` | root | **no** |
| `SessionStore` | `src/app/core/auth/session.store.ts` | root | sí |
| `AccountingClient` | `src/app/core/data-access/accounting/accounting.client.ts` | root | **no** |
| `AuthProvidersClient` | `src/app/core/data-access/auth-providers/auth-providers.client.ts` | root | sí |
| `AuthzClient` | `src/app/core/data-access/authz/authz.client.ts` | root | sí |
| `ClinicalClient` | `src/app/core/data-access/clinical/clinical.client.ts` | root | sí |
| `DelegatedAccessClient` | `src/app/core/data-access/delegated-access/delegated-access.client.ts` | root | sí |
| `DirectoryClient` | `src/app/core/data-access/directory/directory.client.ts` | root | sí |
| `FilesClient` | `src/app/core/data-access/files/files.client.ts` | root | sí |
| `GeoClient` | `src/app/core/data-access/geo/geo.client.ts` | root | sí |
| `HealthContextClient` | `src/app/core/data-access/health-context/health-context.client.ts` | root | sí |
| `IamClient` | `src/app/core/data-access/iam/iam.client.ts` | root | sí |
| `IdentityAdminClient` | `src/app/core/data-access/identity/identity-admin.client.ts` | root | sí |
| `IdentityClient` | `src/app/core/data-access/identity/identity.client.ts` | root | sí |
| `ProfilesClient` | `src/app/core/data-access/profiles/profiles.client.ts` | root | sí |
| `PublicClient` | `src/app/core/data-access/public/public.client.ts` | root | **no** |
| `SchedulingClient` | `src/app/core/data-access/scheduling/scheduling.client.ts` | root | sí |
| `SystemContextClient` | `src/app/core/data-access/system-context/system-context.client.ts` | root | sí |
| `TerminologyClient` | `src/app/core/data-access/terminology/terminology.client.ts` | root | sí |
| `AppErrorHandler` | `src/app/core/errors/app-error-handler.ts` | local | **no** |
| `ErrorReporter` | `src/app/core/errors/error-reporter.ts` | root | sí |
| `TokenRefreshService` | `src/app/core/http/token-refresh.service.ts` | root | sí |
| `Breakpoints` | `src/app/core/layout/breakpoints.ts` | root | sí |
| `NavigationService` | `src/app/core/navigation/navigation.service.ts` | root | sí |
| `FormTracing` | `src/app/core/observability/business/form-tracing.ts` | root | **no** |
| `ErrorDeduplicator` | `src/app/core/observability/errors/error-deduplicator.ts` | root | **no** |
| `ErrorTelemetry` | `src/app/core/observability/errors/error-telemetry.ts` | root | sí |
| `RouterTracing` | `src/app/core/observability/routing/router-tracing.ts` | root | sí |
| `AppStabilityTracing` | `src/app/core/observability/tracing/app-stability.ts` | root | **no** |
| `TracingService` | `src/app/core/observability/tracing/tracing.service.ts` | root | sí |
| `RedsatRuntimeService` | `src/app/core/redsat/redsat-runtime.service.ts` | root | sí |
| `ThemeService` | `src/app/core/tokens/theme.service.ts` | root | sí |
| `CaseStatusCatalog` | `src/app/features/identity-verification/case-status.ts` | root | sí |
| `DialogService` | `src/app/shared/components/molecules/dialog/dialog-service.ts` | root | **no** |
| `ToastService` | `src/app/shared/components/molecules/toast/toast.service.ts` | root | sí |
| `ShellService` | `src/app/shared/components/organisms/shell/shell-service.ts` | root | **no** |

## Componentes sin prueba

- `ToastDevPanel` — `src/app/core/dev/toast-dev-panel/toast-dev-panel.ts`
- `Accounting` — `src/app/features/accounting/accounting.ts`
- `OrganizationDetail` — `src/app/features/admin/organizations/organization-detail/organization-detail.ts`
- `OrganismsGallery` — `src/app/features/design-system-sample/organisms-gallery/organisms-gallery.ts`
- `ErrorRecovery` — `src/app/features/error-recovery/error-recovery.ts`
- `AccesosAccesoDeEmergenciaFormulario` — `src/app/features/redsat/accesos/acceso-de-emergencia-formulario/acceso-de-emergencia-formulario.ts`
- `AccesosClinicosDelPacienteFormulario` — `src/app/features/redsat/accesos/accesos-clinicos-del-paciente-formulario/accesos-clinicos-del-paciente-formulario.ts`
- `AccesosClinicosDelPacienteListado` — `src/app/features/redsat/accesos/accesos-clinicos-del-paciente-listado/accesos-clinicos-del-paciente-listado.ts`
- `AccesosClinicosListado` — `src/app/features/redsat/accesos/accesos-clinicos-listado/accesos-clinicos-listado.ts`
- `AccesosClinicosRevocar` — `src/app/features/redsat/accesos/accesos-clinicos-revocar/accesos-clinicos-revocar.ts`
- `AccesosAlcanceDeRecursoFormulario` — `src/app/features/redsat/accesos/alcance-de-recurso-formulario/alcance-de-recurso-formulario.ts`
- `AccesosAlcanceDeRecursoListado` — `src/app/features/redsat/accesos/alcance-de-recurso-listado/alcance-de-recurso-listado.ts`
- `AccesosAsignacionesDeRolFormulario` — `src/app/features/redsat/accesos/asignaciones-de-rol-formulario/asignaciones-de-rol-formulario.ts`
- `AccesosAsignacionesDeRolListado` — `src/app/features/redsat/accesos/asignaciones-de-rol-listado/asignaciones-de-rol-listado.ts`
- `AccesosCacheInvalidar` — `src/app/features/redsat/accesos/cache-invalidar/cache-invalidar.ts`
- `AccesosCategoriasDePermisoFormulario` — `src/app/features/redsat/accesos/categorias-de-permiso-formulario/categorias-de-permiso-formulario.ts`
- `AccesosCategoriasDePermisoListado` — `src/app/features/redsat/accesos/categorias-de-permiso-listado/categorias-de-permiso-listado.ts`
- `AccesosConcesionesDePermisoFormulario` — `src/app/features/redsat/accesos/concesiones-de-permiso-formulario/concesiones-de-permiso-formulario.ts`
- `AccesosConcesionesDePermisoListado` — `src/app/features/redsat/accesos/concesiones-de-permiso-listado/concesiones-de-permiso-listado.ts`
- `AccesosDecisionesEvaluar` — `src/app/features/redsat/accesos/decisiones-evaluar/decisiones-evaluar.ts`
- `AccesosPermisosDeCampoFormulario` — `src/app/features/redsat/accesos/permisos-de-campo-formulario/permisos-de-campo-formulario.ts`
- `AccesosPermisosDeCampoListado` — `src/app/features/redsat/accesos/permisos-de-campo-listado/permisos-de-campo-listado.ts`
- `AccesosPermisosDelRolFormulario` — `src/app/features/redsat/accesos/permisos-del-rol-formulario/permisos-del-rol-formulario.ts`
- `AccesosPermisosDelRolListado` — `src/app/features/redsat/accesos/permisos-del-rol-listado/permisos-del-rol-listado.ts`
- `AccesosPermisosFormulario` — `src/app/features/redsat/accesos/permisos-formulario/permisos-formulario.ts`
- `AccesosPermisosListado` — `src/app/features/redsat/accesos/permisos-listado/permisos-listado.ts`
- `AccesosPoliticasDeAccesoFormulario` — `src/app/features/redsat/accesos/politicas-de-acceso-formulario/politicas-de-acceso-formulario.ts`
- `AccesosPoliticasDeAccesoListado` — `src/app/features/redsat/accesos/politicas-de-acceso-listado/politicas-de-acceso-listado.ts`
- `AccesosRelacionesDeCuidadoFormulario` — `src/app/features/redsat/accesos/relaciones-de-cuidado-formulario/relaciones-de-cuidado-formulario.ts`
- `AccesosRelacionesDeCuidadoListado` — `src/app/features/redsat/accesos/relaciones-de-cuidado-listado/relaciones-de-cuidado-listado.ts`
- `AccesosRelacionesDeCuidadoRevocar` — `src/app/features/redsat/accesos/relaciones-de-cuidado-revocar/relaciones-de-cuidado-revocar.ts`
- `AccesosRepresentacionesLegalesFormulario` — `src/app/features/redsat/accesos/representaciones-legales-formulario/representaciones-legales-formulario.ts`
- `AccesosRepresentacionesLegalesListado` — `src/app/features/redsat/accesos/representaciones-legales-listado/representaciones-legales-listado.ts`
- `AccesosRepresentacionesLegalesRevocar` — `src/app/features/redsat/accesos/representaciones-legales-revocar/representaciones-legales-revocar.ts`
- `AccesosRolesFormulario` — `src/app/features/redsat/accesos/roles-formulario/roles-formulario.ts`
- `AccesosRolesListado` — `src/app/features/redsat/accesos/roles-listado/roles-listado.ts`
- `BuscarAseguradorasListado` — `src/app/features/redsat/buscar/aseguradoras-listado/aseguradoras-listado.ts`
- `BuscarBuscadorListado` — `src/app/features/redsat/buscar/buscador-listado/buscador-listado.ts`
- `BuscarCalificarLaAtencionFormulario` — `src/app/features/redsat/buscar/calificar-la-atencion-formulario/calificar-la-atencion-formulario.ts`
- `BuscarCercaniaDetalle` — `src/app/features/redsat/buscar/cercania-detalle/cercania-detalle.ts`
- `BuscarHospitalesListado` — `src/app/features/redsat/buscar/hospitales-listado/hospitales-listado.ts`
- `BuscarLaboratoriosListado` — `src/app/features/redsat/buscar/laboratorios-listado/laboratorios-listado.ts`
- `BuscarMedicamentosListado` — `src/app/features/redsat/buscar/medicamentos-listado/medicamentos-listado.ts`
- `BuscarPerfilAseguradoraDetalle` — `src/app/features/redsat/buscar/perfil-aseguradora-detalle/perfil-aseguradora-detalle.ts`
- `BuscarPerfilFarmaciaDetalle` — `src/app/features/redsat/buscar/perfil-farmacia-detalle/perfil-farmacia-detalle.ts`
- `BuscarPerfilLaboratorioDetalle` — `src/app/features/redsat/buscar/perfil-laboratorio-detalle/perfil-laboratorio-detalle.ts`
- `BuscarPerfilOrganizacionDetalle` — `src/app/features/redsat/buscar/perfil-organizacion-detalle/perfil-organizacion-detalle.ts`
- `BuscarPerfilProfesionalDetalle` — `src/app/features/redsat/buscar/perfil-profesional-detalle/perfil-profesional-detalle.ts`
- `BuscarProfesionalesListado` — `src/app/features/redsat/buscar/profesionales-listado/profesionales-listado.ts`
- `BuscarSeguidosYGuardadosListado` — `src/app/features/redsat/buscar/seguidos-y-guardados-listado/seguidos-y-guardados-listado.ts`
- `DatosCompartidosArchivosEliminar` — `src/app/features/redsat/datos-compartidos/archivos-eliminar/archivos-eliminar.ts`
- `DatosCompartidosArchivosFormulario` — `src/app/features/redsat/datos-compartidos/archivos-formulario/archivos-formulario.ts`
- `DatosCompartidosArchivosListado` — `src/app/features/redsat/datos-compartidos/archivos-listado/archivos-listado.ts`
- `DatosCompartidosArchivosObtenerEnlace` — `src/app/features/redsat/datos-compartidos/archivos-obtener-enlace/archivos-obtener-enlace.ts`
- `DatosCompartidosArchivosSubir` — `src/app/features/redsat/datos-compartidos/archivos-subir/archivos-subir.ts`
- `DatosCompartidosContenidoDetalle` — `src/app/features/redsat/datos-compartidos/contenido-detalle/contenido-detalle.ts`
- `DatosCompartidosDerivadosFormulario` — `src/app/features/redsat/datos-compartidos/derivados-formulario/derivados-formulario.ts`
- `DatosCompartidosDerivadosListado` — `src/app/features/redsat/datos-compartidos/derivados-listado/derivados-listado.ts`
- `DatosCompartidosDireccionesFormulario` — `src/app/features/redsat/datos-compartidos/direcciones-formulario/direcciones-formulario.ts`
- `DatosCompartidosDireccionesListado` — `src/app/features/redsat/datos-compartidos/direcciones-listado/direcciones-listado.ts`
- `DatosCompartidosIdentificadoresFormulario` — `src/app/features/redsat/datos-compartidos/identificadores-formulario/identificadores-formulario.ts`
- `DatosCompartidosIdentificadoresListado` — `src/app/features/redsat/datos-compartidos/identificadores-listado/identificadores-listado.ts`
- `DatosCompartidosPuntosDeContactoFormulario` — `src/app/features/redsat/datos-compartidos/puntos-de-contacto-formulario/puntos-de-contacto-formulario.ts`
- `DatosCompartidosPuntosDeContactoListado` — `src/app/features/redsat/datos-compartidos/puntos-de-contacto-listado/puntos-de-contacto-listado.ts`
- `DatosCompartidosPuntosDeContactoVerificar` — `src/app/features/redsat/datos-compartidos/puntos-de-contacto-verificar/puntos-de-contacto-verificar.ts`
- `DatosCompartidosVersionesFormulario` — `src/app/features/redsat/datos-compartidos/versiones-formulario/versiones-formulario.ts`
- `DatosCompartidosVersionesInternasEscanear` — `src/app/features/redsat/datos-compartidos/versiones-internas-escanear/versiones-internas-escanear.ts`
- `DatosCompartidosVersionesInternasListado` — `src/app/features/redsat/datos-compartidos/versiones-internas-listado/versiones-internas-listado.ts`
- `DatosCompartidosVersionesListado` — `src/app/features/redsat/datos-compartidos/versiones-listado/versiones-listado.ts`
- `DatosCompartidosVinculosFormulario` — `src/app/features/redsat/datos-compartidos/vinculos-formulario/vinculos-formulario.ts`
- `DatosCompartidosVinculosListado` — `src/app/features/redsat/datos-compartidos/vinculos-listado/vinculos-listado.ts`
- `DirectorioAsignacionesDeSucursalFormulario` — `src/app/features/redsat/directorio/asignaciones-de-sucursal-formulario/asignaciones-de-sucursal-formulario.ts`
- `DirectorioMembresiasDarDeBaja` — `src/app/features/redsat/directorio/membresias-dar-de-baja/membresias-dar-de-baja.ts`
- `DirectorioMembresiasFormulario` — `src/app/features/redsat/directorio/membresias-formulario/membresias-formulario.ts`
- `DirectorioMembresiasListado` — `src/app/features/redsat/directorio/membresias-listado/membresias-listado.ts`
- `DirectorioOrganizacionesFormulario` — `src/app/features/redsat/directorio/organizaciones-formulario/organizaciones-formulario.ts`
- `DirectorioOrganizacionesHijasFormulario` — `src/app/features/redsat/directorio/organizaciones-hijas-formulario/organizaciones-hijas-formulario.ts`
- `DirectorioOrganizacionesListado` — `src/app/features/redsat/directorio/organizaciones-listado/organizaciones-listado.ts`
- `DirectorioOrganizacionesSuspender` — `src/app/features/redsat/directorio/organizaciones-suspender/organizaciones-suspender.ts`
- `DirectorioOrganizacionesVerificar` — `src/app/features/redsat/directorio/organizaciones-verificar/organizaciones-verificar.ts`
- `DirectorioRolesFormulario` — `src/app/features/redsat/directorio/roles-formulario/roles-formulario.ts`
- `DirectorioSucursalesFormulario` — `src/app/features/redsat/directorio/sucursales-formulario/sucursales-formulario.ts`
- `DirectorioSucursalesListado` — `src/app/features/redsat/directorio/sucursales-listado/sucursales-listado.ts`
- `DirectorioTransferenciasFormulario` — `src/app/features/redsat/directorio/transferencias-formulario/transferencias-formulario.ts`
- `InicioPortada` — `src/app/features/redsat/inicio/portada/portada.ts`
- `OrganizacionesAsignacionesDeSucursalFormulario` — `src/app/features/redsat/organizaciones/asignaciones-de-sucursal-formulario/asignaciones-de-sucursal-formulario.ts`
- `OrganizacionesMembresiasDarDeBaja` — `src/app/features/redsat/organizaciones/membresias-dar-de-baja/membresias-dar-de-baja.ts`
- `OrganizacionesMembresiasFormulario` — `src/app/features/redsat/organizaciones/membresias-formulario/membresias-formulario.ts`
- `OrganizacionesMembresiasListado` — `src/app/features/redsat/organizaciones/membresias-listado/membresias-listado.ts`
- `OrganizacionesFormulario` — `src/app/features/redsat/organizaciones/organizaciones-formulario/organizaciones-formulario.ts`
- `OrganizacionesHijasFormulario` — `src/app/features/redsat/organizaciones/organizaciones-hijas-formulario/organizaciones-hijas-formulario.ts`
- `OrganizacionesListado` — `src/app/features/redsat/organizaciones/organizaciones-listado/organizaciones-listado.ts`
- `OrganizacionesSuspender` — `src/app/features/redsat/organizaciones/organizaciones-suspender/organizaciones-suspender.ts`
- `OrganizacionesVerificar` — `src/app/features/redsat/organizaciones/organizaciones-verificar/organizaciones-verificar.ts`
- `OrganizacionesRolesFormulario` — `src/app/features/redsat/organizaciones/roles-formulario/roles-formulario.ts`
- `OrganizacionesSucursalesFormulario` — `src/app/features/redsat/organizaciones/sucursales-formulario/sucursales-formulario.ts`
- `OrganizacionesSucursalesListado` — `src/app/features/redsat/organizaciones/sucursales-listado/sucursales-listado.ts`
- `OrganizacionesTransferenciasFormulario` — `src/app/features/redsat/organizaciones/transferencias-formulario/transferencias-formulario.ts`
- `PersonasApoderadosDePortalFormulario` — `src/app/features/redsat/personas/apoderados-de-portal-formulario/apoderados-de-portal-formulario.ts`
- `PersonasApoderadosDePortalListado` — `src/app/features/redsat/personas/apoderados-de-portal-listado/apoderados-de-portal-listado.ts`
- `PersonasAutorizacionesDeJurisdiccionFormulario` — `src/app/features/redsat/personas/autorizaciones-de-jurisdiccion-formulario/autorizaciones-de-jurisdiccion-formulario.ts`
- `PersonasAutorizacionesDeJurisdiccionListado` — `src/app/features/redsat/personas/autorizaciones-de-jurisdiccion-listado/autorizaciones-de-jurisdiccion-listado.ts`
- `PersonasCredencialesListado` — `src/app/features/redsat/personas/credenciales-listado/credenciales-listado.ts`
- `PersonasCredencialesVerificar` — `src/app/features/redsat/personas/credenciales-verificar/credenciales-verificar.ts`
- `PersonasEspecialidadesFormulario` — `src/app/features/redsat/personas/especialidades-formulario/especialidades-formulario.ts`
- `PersonasEspecialidadesListado` — `src/app/features/redsat/personas/especialidades-listado/especialidades-listado.ts`
- `PersonasPacientesFormulario` — `src/app/features/redsat/personas/pacientes-formulario/pacientes-formulario.ts`
- `PersonasPacientesFusionar` — `src/app/features/redsat/personas/pacientes-fusionar/pacientes-fusionar.ts`
- `PersonasPacientesListado` — `src/app/features/redsat/personas/pacientes-listado/pacientes-listado.ts`
- `PersonasPacientesRevertir` — `src/app/features/redsat/personas/pacientes-revertir/pacientes-revertir.ts`
- `PersonasListado` — `src/app/features/redsat/personas/personas-listado/personas-listado.ts`
- `PersonasRegistrarDefuncion` — `src/app/features/redsat/personas/personas-registrar-defuncion/personas-registrar-defuncion.ts`
- `PersonasRelacionadasFormulario` — `src/app/features/redsat/personas/personas-relacionadas-formulario/personas-relacionadas-formulario.ts`
- `PersonasRelacionadasListado` — `src/app/features/redsat/personas/personas-relacionadas-listado/personas-relacionadas-listado.ts`
- `PersonasProfesionalesFormulario` — `src/app/features/redsat/personas/profesionales-formulario/profesionales-formulario.ts`
- `PersonasProfesionalesListado` — `src/app/features/redsat/personas/profesionales-listado/profesionales-listado.ts`
- `PersonasResumenPropioListado` — `src/app/features/redsat/personas/resumen-propio-listado/resumen-propio-listado.ts`
- `PersonasVinculosDeCuentaFormulario` — `src/app/features/redsat/personas/vinculos-de-cuenta-formulario/vinculos-de-cuenta-formulario.ts`
- `PersonasVinculosDeCuentaListado` — `src/app/features/redsat/personas/vinculos-de-cuenta-listado/vinculos-de-cuenta-listado.ts`
- `PersonasVinculosDeIdentidadFormulario` — `src/app/features/redsat/personas/vinculos-de-identidad-formulario/vinculos-de-identidad-formulario.ts`
- `PersonasVinculosDeIdentidadListado` — `src/app/features/redsat/personas/vinculos-de-identidad-listado/vinculos-de-identidad-listado.ts`
- `RedsatPublicShell` — `src/app/features/redsat/shell/redsat-public-shell.ts`
- `TerminologiaConceptosListado` — `src/app/features/redsat/terminologia/conceptos-listado/conceptos-listado.ts`
- `TerminologiaConjuntosDeValorFormulario` — `src/app/features/redsat/terminologia/conjuntos-de-valor-formulario/conjuntos-de-valor-formulario.ts`
- `TerminologiaConjuntosDeValorListado` — `src/app/features/redsat/terminologia/conjuntos-de-valor-listado/conjuntos-de-valor-listado.ts`
- `TerminologiaConsultaDeConceptoListado` — `src/app/features/redsat/terminologia/consulta-de-concepto-listado/consulta-de-concepto-listado.ts`
- `TerminologiaDeprecacionDeConceptoFormulario` — `src/app/features/redsat/terminologia/deprecacion-de-concepto-formulario/deprecacion-de-concepto-formulario.ts`
- `TerminologiaDesignacionesFormulario` — `src/app/features/redsat/terminologia/designaciones-formulario/designaciones-formulario.ts`
- `TerminologiaDesignacionesListado` — `src/app/features/redsat/terminologia/designaciones-listado/designaciones-listado.ts`
- `TerminologiaExpansionDeConjuntoDeValoresDetalle` — `src/app/features/redsat/terminologia/expansion-de-conjunto-de-valores-detalle/expansion-de-conjunto-de-valores-detalle.ts`
- `TerminologiaExpansionDeConjuntoDeValoresFormulario` — `src/app/features/redsat/terminologia/expansion-de-conjunto-de-valores-formulario/expansion-de-conjunto-de-valores-formulario.ts`
- `TerminologiaPoliticasDeCatalogoFormulario` — `src/app/features/redsat/terminologia/politicas-de-catalogo-formulario/politicas-de-catalogo-formulario.ts`
- `TerminologiaPoliticasDeCatalogoListado` — `src/app/features/redsat/terminologia/politicas-de-catalogo-listado/politicas-de-catalogo-listado.ts`
- `TerminologiaPropiedadesFormulario` — `src/app/features/redsat/terminologia/propiedades-formulario/propiedades-formulario.ts`
- `TerminologiaPropiedadesListado` — `src/app/features/redsat/terminologia/propiedades-listado/propiedades-listado.ts`
- `TerminologiaRelacionesFormulario` — `src/app/features/redsat/terminologia/relaciones-formulario/relaciones-formulario.ts`
- `TerminologiaRelacionesListado` — `src/app/features/redsat/terminologia/relaciones-listado/relaciones-listado.ts`
- `TerminologiaSistemasDeCodigosFormulario` — `src/app/features/redsat/terminologia/sistemas-de-codigos-formulario/sistemas-de-codigos-formulario.ts`
- `TerminologiaSistemasDeCodigosListado` — `src/app/features/redsat/terminologia/sistemas-de-codigos-listado/sistemas-de-codigos-listado.ts`
- `TerminologiaTraduccionEntreCatalogosFormulario` — `src/app/features/redsat/terminologia/traduccion-entre-catalogos-formulario/traduccion-entre-catalogos-formulario.ts`
- `TerminologiaVersionesDeSistemaFormulario` — `src/app/features/redsat/terminologia/versiones-de-sistema-formulario/versiones-de-sistema-formulario.ts`
- `TerminologiaVersionesDeSistemaListado` — `src/app/features/redsat/terminologia/versiones-de-sistema-listado/versiones-de-sistema-listado.ts`
- `TerminologiaVersionesImportar` — `src/app/features/redsat/terminologia/versiones-importar/versiones-importar.ts`
- `TerminologiaVersionesListado` — `src/app/features/redsat/terminologia/versiones-listado/versiones-listado.ts`
- `TerminologiaVersionesPublicar` — `src/app/features/redsat/terminologia/versiones-publicar/versiones-publicar.ts`
- `TooltipPanel` — `src/app/shared/components/atoms/tooltip/tooltip-panel.ts`
- `AccordionPanel` — `src/app/shared/components/molecules/accordion/accordion-panel/accordion-panel.ts`
- `ConceptSelect` — `src/app/shared/components/molecules/concept-select/concept-select.ts`
- `MenuItem` — `src/app/shared/components/molecules/menu/menu-item/menu-item.ts`
- `Radio` — `src/app/shared/components/molecules/radio/radio.ts`
- `Tab` — `src/app/shared/components/molecules/tabs/tab/tab.ts`
- `ToastContainer` — `src/app/shared/components/organisms/toast-container/toast-container.ts`
