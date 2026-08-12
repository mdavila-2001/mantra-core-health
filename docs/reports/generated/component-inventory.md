<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de componentes y servicios

158 componentes y 36 servicios inyectables, leídos de `src/`.

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

## Molécula (21)

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

## Feature (104)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-appointments` | `Appointments` | — | — | — | OnPush | **no** |
| `app-my-profile` | `MyProfile` | — | — | — | OnPush | sí |
| `app-assisted-registration` | `AssistedRegistration` | — | — | — | OnPush | sí |
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

## Servicios (36)

| Clase | Archivo | Ámbito | Prueba |
|---|---|---|---|
| `AuthService` | `src/app/core/auth/auth.service.ts` | root | sí |
| `IdleLogout` | `src/app/core/auth/idle-logout.ts` | root | sí |
| `RefreshTokenStorage` | `src/app/core/auth/refresh-token.storage.ts` | root | **no** |
| `SessionStore` | `src/app/core/auth/session.store.ts` | root | sí |
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
| `ThemeService` | `src/app/core/tokens/theme.service.ts` | root | sí |
| `CaseStatusCatalog` | `src/app/features/identity-verification/case-status.ts` | root | sí |
| `DialogService` | `src/app/shared/components/molecules/dialog/dialog-service.ts` | root | **no** |
| `ToastService` | `src/app/shared/components/molecules/toast/toast.service.ts` | root | sí |
| `ShellService` | `src/app/shared/components/organisms/shell/shell-service.ts` | root | **no** |

## Componentes sin prueba

- `ToastDevPanel` — `src/app/core/dev/toast-dev-panel/toast-dev-panel.ts`
- `Appointments` — `src/app/features/account/appointments/appointments.ts`
- `OrganismsGallery` — `src/app/features/design-system-sample/organisms-gallery/organisms-gallery.ts`
- `ErrorRecovery` — `src/app/features/error-recovery/error-recovery.ts`
- `TooltipPanel` — `src/app/shared/components/atoms/tooltip/tooltip-panel.ts`
- `AccordionPanel` — `src/app/shared/components/molecules/accordion/accordion-panel/accordion-panel.ts`
- `ConceptSelect` — `src/app/shared/components/molecules/concept-select/concept-select.ts`
- `MenuItem` — `src/app/shared/components/molecules/menu/menu-item/menu-item.ts`
- `Radio` — `src/app/shared/components/molecules/radio/radio.ts`
- `Tab` — `src/app/shared/components/molecules/tabs/tab/tab.ts`
- `ToastContainer` — `src/app/shared/components/organisms/toast-container/toast-container.ts`
