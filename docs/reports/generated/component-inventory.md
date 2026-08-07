<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de componentes y servicios

72 componentes y 25 servicios inyectables, leídos de `src/`.

## Átomo (15)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-avatar` | `Avatar` | `src`, `name`, `initials`, `size`, `status`, `alt` | — | — | OnPush | sí |
| `app-badge` | `Badge` | `variant`, `size`, `value`, `max`, `dotOnly`, `label` | — | — | OnPush | sí |
| `button[app-button]` | `AppButton` | `variant`, `size`, `isLoading`, `disabled`, `type`, `iconOnly` | `clicked` | — | OnPush | sí |
| `app-checkbox` | `Checkbox` | `disabled`, `label`, `hasError`, `indeterminate`, `hideLabel` | — | `checked` | OnPush | sí |
| `app-chip` | `Chip` | `variant`, `size`, `label`, `removable`, `selectable` | `removed` | `selected` | OnPush | sí |
| `app-divider` | `Divider` | `orientation`, `label` | — | — | OnPush | sí |
| `app-input` | `Input` | `type`, `autocomplete`, `placeholder`, `disabled`, `readonly`, `hasError`, `hasSuccess`, `testId` | `focused`, `blurred` | `value` | OnPush | sí |
| `a[app-link]` | `Link` | `variant`, `external` | — | — | OnPush | sí |
| `app-progress` | `Progress` | `value`, `tone`, `size`, `label` | — | — | OnPush | sí |
| `app-select` | `Select` | `options`, `disabled`, `placeholder`, `hasError`, `ariaLabel` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-skeleton` | `Skeleton` | `variant`, `width`, `height`, `lines` | — | — | OnPush | sí |
| `app-spinner` | `Spinner` | `size`, `label`, `decorative` | — | — | OnPush | sí |
| `app-switch` | `Switch` | `disabled`, `label` | — | `checked` | OnPush | sí |
| `app-textarea` | `Textarea` | `placeholder`, `rows`, `maxRows`, `maxLength`, `autoResize`, `disabled`, `readonly`, `hasError` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-tooltip-panel` | `TooltipPanel` | `text`, `position`, `panelId`, `top`, `left` | — | — | OnPush | **no** |

## Molécula (19)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-accordion-panel` | `AccordionPanel` | `heading`, `disabled` | — | `expanded` | OnPush | **no** |
| `app-accordion` | `Accordion` | `multi` | — | — | OnPush | sí |
| `app-alert` | `Alert` | `tone`, `title`, `dismissible`, `icon` | `dismissed` | — | OnPush | sí |
| `app-avatar-group` | `AvatarGroup` | `overflow`, `size`, `label` | — | — | OnPush | sí |
| `app-breadcrumb` | `Breadcrumb` | `items` | — | — | OnPush | sí |
| `app-card` | `Card` | `variant`, `padding`, `interactive` | `activated` | — | OnPush | sí |
| `app-dialog` | `Dialog` | `config` | `resolved` | — | OnPush | sí |
| `app-empty-state` | `EmptyState` | `title`, `description`, `variant` | — | — | OnPush | sí |
| `app-file-input` | `FileInput` | `multiple`, `disabled`, `accept`, `maxSizeBytes`, `maxFiles` | `rejected` | `files` | OnPush | sí |
| `app-form-field` | `FormField` | `label`, `hint`, `errorMessage`, `required` | — | — | OnPush | sí |
| `app-menu-item` | `MenuItem` | `disabled`, `destructive` | `selected` | — | OnPush | **no** |
| `app-menu` | `Menu` | — | `closed` | — | OnPush | sí |
| `app-pagination` | `Pagination` | `totalItems`, `pageSizeOptions`, `showPageSize` | — | `page`, `pageSize` | OnPush | sí |
| `app-radio-group` | `RadioGroup` | `disabled`, `hasError`, `name` | — | `value` | OnPush | sí |
| `app-radio` | `Radio` | `value`, `label`, `disabled` | — | — | OnPush | **no** |
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

## Feature (21)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-my-profile` | `MyProfile` | — | — | — | OnPush | sí |
| `app-assisted-registration` | `AssistedRegistration` | — | — | — | OnPush | sí |
| `app-patient-detail` | `PatientDetail` | — | — | — | OnPush | sí |
| `app-patient-list` | `PatientList` | — | — | — | OnPush | sí |
| `app-patient-new` | `PatientNew` | — | — | — | OnPush | sí |
| `app-user-registration` | `UserRegistration` | — | — | — | OnPush | sí |
| `app-forgot-password` | `ForgotPassword` | — | — | — | OnPush | sí |
| `app-login` | `Login` | — | — | — | OnPush | sí |
| `app-register-patient` | `RegisterPatient` | — | — | — | OnPush | sí |
| `app-reset-password` | `ResetPassword` | — | — | — | OnPush | sí |
| `app-tenant-selection` | `TenantSelection` | — | — | — | OnPush | sí |
| `app-verify-email` | `VerifyEmail` | — | — | — | OnPush | sí |
| `app-dashboard` | `Dashboard` | — | — | — | OnPush | sí |
| `app-design-system-sample` | `DesignSystemSample` | — | — | — | OnPush | sí |
| `app-organisms-gallery` | `OrganismsGallery` | — | — | — | OnPush | **no** |
| `app-view-state-gallery` | `ViewStateGallery` | — | — | — | OnPush | sí |
| `app-error-recovery` | `ErrorRecovery` | — | — | — | OnPush | **no** |
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

## Servicios (25)

| Clase | Archivo | Ámbito | Prueba |
|---|---|---|---|
| `AuthService` | `src/app/core/auth/auth.service.ts` | root | sí |
| `IdleLogout` | `src/app/core/auth/idle-logout.ts` | root | sí |
| `RefreshTokenStorage` | `src/app/core/auth/refresh-token.storage.ts` | root | **no** |
| `SessionStore` | `src/app/core/auth/session.store.ts` | root | sí |
| `FilesClient` | `src/app/core/data-access/files/files.client.ts` | root | sí |
| `IamClient` | `src/app/core/data-access/iam/iam.client.ts` | root | sí |
| `IdentityClient` | `src/app/core/data-access/identity/identity.client.ts` | root | sí |
| `ProfilesClient` | `src/app/core/data-access/profiles/profiles.client.ts` | root | sí |
| `PublicClient` | `src/app/core/data-access/public/public.client.ts` | root | **no** |
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
| `DialogService` | `src/app/shared/components/molecules/dialog/dialog-service.ts` | root | **no** |
| `ToastService` | `src/app/shared/components/molecules/toast/toast.service.ts` | root | sí |
| `ShellService` | `src/app/shared/components/organisms/shell/shell-service.ts` | root | **no** |

## Componentes sin prueba

- `ToastDevPanel` — `src/app/core/dev/toast-dev-panel/toast-dev-panel.ts`
- `OrganismsGallery` — `src/app/features/design-system-sample/organisms-gallery/organisms-gallery.ts`
- `ErrorRecovery` — `src/app/features/error-recovery/error-recovery.ts`
- `TooltipPanel` — `src/app/shared/components/atoms/tooltip/tooltip-panel.ts`
- `AccordionPanel` — `src/app/shared/components/molecules/accordion/accordion-panel/accordion-panel.ts`
- `MenuItem` — `src/app/shared/components/molecules/menu/menu-item/menu-item.ts`
- `Radio` — `src/app/shared/components/molecules/radio/radio.ts`
- `Tab` — `src/app/shared/components/molecules/tabs/tab/tab.ts`
- `ToastContainer` — `src/app/shared/components/organisms/toast-container/toast-container.ts`
