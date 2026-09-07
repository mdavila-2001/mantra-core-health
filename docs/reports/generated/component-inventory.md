<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de componentes y servicios

445 componentes y 84 servicios inyectables, leídos de `src/`.

## Átomo (19)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-account-icon` | `AccountIcon` | `name` | — | — | OnPush | **no** |
| `app-avatar` | `Avatar` | `src`, `name`, `initials`, `size`, `status`, `alt` | — | — | OnPush | sí |
| `app-back-link` | `BackLink` | `fallback`, `label` | — | — | OnPush | sí |
| `app-badge` | `Badge` | `variant`, `size`, `value`, `max`, `dotOnly`, `label` | — | — | OnPush | sí |
| `a[app-button]` | `AppButtonLink` | `variant`, `size`, `disabled`, `iconOnly` | — | — | OnPush | sí |
| `button[app-button]` | `AppButton` | `variant`, `size`, `isLoading`, `disabled`, `type`, `iconOnly` | `clicked` | — | OnPush | sí |
| `app-checkbox` | `Checkbox` | `disabled`, `label`, `hasError`, `indeterminate`, `hideLabel` | — | `checked` | OnPush | sí |
| `app-chip` | `Chip` | `variant`, `size`, `label`, `removable`, `selectable` | `removed` | `selected` | OnPush | sí |
| `app-divider` | `Divider` | `orientation`, `label` | — | — | OnPush | sí |
| `app-input` | `Input` | `type`, `autocomplete`, `inputMode`, `placeholder`, `disabled`, `readonly`, `hasError`, `hasSuccess`, `testId`, `comboboxAria` | `focused`, `blurred` | `value` | OnPush | sí |
| `a[app-link]` | `Link` | `variant`, `external` | — | — | OnPush | sí |
| `app-nav-icon` | `NavIcon` | `name` | — | — | OnPush | **no** |
| `app-progress` | `Progress` | `value`, `tone`, `size`, `label`, `showMarker` | — | — | OnPush | sí |
| `app-select` | `Select` | `options`, `disabled`, `placeholder`, `hasError`, `ariaLabel` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-skeleton` | `Skeleton` | `variant`, `width`, `height`, `lines` | — | — | OnPush | sí |
| `app-spinner` | `Spinner` | `size`, `label`, `decorative` | — | — | OnPush | sí |
| `app-switch` | `Switch` | `disabled`, `label` | — | `checked` | OnPush | sí |
| `app-textarea` | `Textarea` | `placeholder`, `rows`, `maxRows`, `maxLength`, `autoResize`, `disabled`, `readonly`, `hasError` | `focused`, `blurred` | `value` | OnPush | sí |
| `app-tooltip-panel` | `TooltipPanel` | `text`, `position`, `panelId`, `top`, `left` | — | — | OnPush | **no** |

## Molécula (33)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-accordion-panel` | `AccordionPanel` | `heading`, `disabled` | — | `expanded` | OnPush | **no** |
| `app-accordion` | `Accordion` | `multi` | — | — | OnPush | sí |
| `app-alert` | `Alert` | `tone`, `title`, `dismissible`, `icon` | `dismissed` | — | OnPush | sí |
| `app-avatar-group` | `AvatarGroup` | `overflow`, `size`, `label` | — | — | OnPush | sí |
| `app-breadcrumb` | `Breadcrumb` | `items` | — | — | OnPush | sí |
| `app-card-detail-panel` | `CardDetailPanel` | `heading`, `rows`, `triggerLabel` | — | — | OnPush | sí |
| `app-card` | `Card` | `variant`, `padding`, `interactive` | `activated` | — | OnPush | sí |
| `app-comment-media-picker` | `CommentMediaPicker` | `disabled` | `cambio` | — | OnPush | sí |
| `app-concept-select` | `ConceptSelect` | `target`, `disabled`, `valueField`, `labels`, `placeholder` | — | `value` | OnPush | **no** |
| `app-dialog` | `Dialog` | `config` | `resolved` | — | OnPush | sí |
| `app-empty-state` | `EmptyState` | `title`, `description`, `variant` | — | — | OnPush | sí |
| `app-file-input` | `FileInput` | `multiple`, `disabled`, `accept`, `maxSizeBytes`, `maxFiles` | `rejected` | `files` | OnPush | sí |
| `app-file-preview-image` | `FilePreviewImage` | `fileId`, `altText` | — | — | OnPush | sí |
| `app-form-field` | `FormField` | `label`, `hint`, `errorMessage`, `required`, `description` | — | — | OnPush | sí |
| `app-menu-item` | `MenuItem` | `disabled`, `destructive` | `selected` | — | OnPush | **no** |
| `app-menu` | `Menu` | — | `closed` | — | OnPush | sí |
| `app-pagination` | `Pagination` | `totalItems`, `pageSizeOptions`, `showPageSize` | — | `page`, `pageSize` | OnPush | sí |
| `app-pdf-export-button` | `PdfExportButton` | `filename`, `title`, `target`, `label`, `variant` | — | — | OnPush | sí |
| `app-pais-bandera` | `PaisBandera` | `iso` | — | — | OnPush | **no** |
| `app-phone-input` | `PhoneInput` | `placeholder`, `hasError`, `disabled`, `testId` | — | — | OnPush | sí |
| `app-post-preferences-menu` | `PostPreferencesMenu` | `postLink`, `profileLink`, `shareTitle`, `hasSession` | `hideSimilarRequested`, `reportRequested`, `contactRequested` | — | OnPush | sí |
| `app-radio-group` | `RadioGroup` | `disabled`, `hasError`, `name` | — | `value` | OnPush | sí |
| `app-radio` | `Radio` | `value`, `label`, `disabled` | — | — | OnPush | **no** |
| `app-reference-combobox` | `ReferenceCombobox` | `selected`, `options`, `loading`, `disabled`, `placeholder`, `debounceMs`, `minQueryLength`, `label`, `emptyMessage` | `searched`, `selectionChange` | `value` | OnPush | sí |
| `li[app-result-card]` | `ResultCard` | `resultado`, `maximoDeMeta` | — | — | OnPush | sí |
| `app-rich-text-editor` | `RichTextEditor` | `label`, `placeholder`, `readOnly` | `edited` | `html` | OnPush | sí |
| `app-search-field` | `SearchField` | `placeholder`, `debounceMs`, `loading`, `disabled`, `label` | `searched` | `value` | OnPush | sí |
| `li[app-search-result]` | `SearchResult` | `resultado` | — | — | OnPush | sí |
| `app-stepper` | `Stepper` | `steps`, `label`, `interactive`, `compact` | `stepSelected` | — | OnPush | sí |
| `app-tab-help-block` | `TabHelpBlock` | `helpId`, `title`, `tutorialId` | — | — | OnPush | sí |
| `app-tab` | `Tab` | `label`, `disabled` | — | — | OnPush | **no** |
| `app-tabs` | `Tabs` | `orientation` | — | `selectedIndex` | OnPush | sí |
| `app-toast` | `Toast` | `toast` | `dismissed` | — | OnPush | sí |

## Organismo (26)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-attachment-uploader` | `AttachmentUploader` | `ownerType`, `ownerId`, `linkVia` | `attached` | — | OnPush | sí |
| `app-auth-layout` | `AuthLayout` | `title`, `subtitle`, `showBrand` | — | — | OnPush | sí |
| `app-auth-split` | `AuthSplit` | `claim`, `tagline`, `contentWidth` | — | — | OnPush | sí |
| `app-content-dialog` | `ContentDialog` | `heading`, `description`, `closeLabel` | `opened`, `closed` | — | OnPush | sí |
| `app-data-table` | `DataTable` | `state`, `columns`, `trackBy`, `caption`, `selectable`, `sort`, `cursor`, `rowNavigable` | `sortChanged`, `cursorChanged`, `selectionChanged`, `rowActivated`, `retry`, `refresh` | — | OnPush | sí |
| `app-date-picker` | `DatePicker` | `mode`, `disabled`, `placeholder`, `hasError`, `minDate`, `maxDate`, `allowKeyboard` | — | `value` | OnPush | sí |
| `app-directory-page` | `DirectoryPage` | `titulo`, `subtitulo`, `filtros`, `etiquetaBusqueda`, `estado`, `grupos`, `sustantivo`, `aviso`, `textoSinCoincidencias` | `filtrosCambiaron`, `reintentar` | — | OnPush | **no** |
| `app-filter-bar` | `FilterBar` | `filters`, `searchLabel` | `filtersChanged` | — | OnPush | sí |
| `app-form-actions` | `FormActions` | `submitLabel`, `cancelLabel`, `pending`, `disabled`, `destructive`, `correctionOnly`, `confirmTitle`, `confirmMessage` | `submitted`, `cancelled` | — | OnPush | sí |
| `app-form-section` | `FormSection` | `legend`, `description`, `collapsible`, `invalid` | — | `expanded` | OnPush | sí |
| `header[app-header]` | `Header` | `user`, `tenants`, `activeTenantId`, `showMenuButton`, `menuOpen`, `navPanelId` | `menuToggled`, `logoutRequested`, `tenantChanged` | — | OnPush | sí |
| `app-map` | `AppMap` | `pines`, `etiqueta`, `centro`, `zoom` | `pinElegido`, `pointPicked` | `seleccionado` | OnPush | sí |
| `app-notification-bell` | `NotificationBell` | — | — | — | OnPush | sí |
| `app-page-header` | `PageHeader` | `title`, `subtitle`, `breadcrumbs`, `secondaryActions` | `actionSelected` | — | OnPush | sí |
| `app-paginated-form` | `PaginatedForm` | `paginas`, `form`, `label`, `submitLabel`, `pending`, `destructive`, `confirmTitle`, `confirmMessage`, `cancelLabel`, `interactiveSteps`, `iconOnlyNav`, `compactSteps` | `enviado`, `cancelado`, `pasoVisible` | — | OnPush | sí |
| `app-public-nav-rail` | `PublicNavRail` | — | — | — | OnPush | sí |
| `app-registro-ayuda` | `RegistroAyuda` | `tarjetas` | — | — | OnPush | **no** |
| `app-shell` | `Shell` | `user`, `sections`, `tenants`, `activeTenantId`, `drawerMode` | `logoutRequested`, `tenantChanged` | — | OnPush | sí |
| `app-side-nav` | `SideNav` | `sections`, `collapsed`, `drawer`, `open` | `closeRequested` | — | OnPush | sí |
| `app-specialty-browser` | `SpecialtyBrowser` | `state`, `groups`, `filters`, `searchLabel`, `noMatchesText`, `hasMore` | `filtersChanged`, `retry`, `moreRequested` | — | OnPush | sí |
| `app-status-seal` | `StatusSeal` | `variant`, `label` | — | — | OnPush | sí |
| `app-tenant-switcher` | `TenantSwitcher` | `tenants`, `activeTenantId`, `variant` | `tenantChanged` | — | OnPush | sí |
| `app-toast-container` | `ToastContainer` | — | — | — | OnPush | **no** |
| `app-tree-select` | `TreeSelect` | `groups`, `disabled`, `hasError`, `placeholder`, `dialogTitle`, `searchPlaceholder`, `emptyMessage` | — | `value` | OnPush | sí |
| `app-tutorial-overlay` | `TutorialOverlay` | — | — | — | OnPush | sí |
| `app-view-state-host` | `ViewStateHost` | `state` | `retry`, `refresh` | — | OnPush | sí |

## Feature (364)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-access-requests` | `AccessRequests` | — | — | — | OnPush | **no** |
| `app-appointment-calendar` | `AppointmentCalendar` | `turnos`, `seleccionado` | `turnoElegido`, `diaElegido` | — | OnPush | sí |
| `app-appointments` | `Appointments` | — | — | — | OnPush | sí |
| `app-diagnostic-orders` | `DiagnosticOrders` | — | — | — | OnPush | sí |
| `app-diagnostic-results` | `DiagnosticResults` | — | — | — | OnPush | sí |
| `app-loyalty` | `Loyalty` | — | — | — | OnPush | sí |
| `app-redeem-code` | `RedeemCode` | `comprobante` | `cerrado` | — | OnPush | sí |
| `app-medical-record` | `MedicalRecord` | — | — | — | OnPush | sí |
| `app-where-to-buy` | `WhereToBuy` | — | — | — | OnPush | sí |
| `app-medical-articles` | `MedicalArticles` | — | — | — | OnPush | sí |
| `app-my-profile` | `MyProfile` | — | — | — | OnPush | sí |
| `app-patient-profile-edit` | `PatientProfileEdit` | — | — | — | OnPush | sí |
| `app-practitioner-profile-edit` | `PractitionerProfileEdit` | — | — | — | OnPush | sí |
| `app-practitioner-profile-view` | `PractitionerProfileView` | `perfil`, `esPropio`, `previewMode` | `trayectoriaCambio` | — | OnPush | sí |
| `app-practitioner-profile` | `PractitionerProfile` | — | — | — | OnPush | sí |
| `app-public-profile-preview` | `PublicProfilePreview` | — | — | — | OnPush | sí |
| `app-public-profile-settings` | `PublicProfileSettings` | — | — | — | OnPush | sí |
| `app-work-history` | `WorkHistory` | `layout` | `added` | — | OnPush | sí |
| `app-notification-preferences` | `NotificationPreferences` | — | — | — | OnPush | sí |
| `app-new-order` | `NewOrder` | — | — | — | OnPush | sí |
| `app-order-detail` | `OrderDetail` | — | — | — | OnPush | sí |
| `app-order-payment` | `OrderPayment` | `pedido`, `ocupado` | `pagoSimulado` | — | OnPush | sí |
| `app-order-receipt` | `OrderReceipt` | — | — | — | OnPush | sí |
| `app-pharmacy-orders` | `PharmacyOrders` | — | — | — | OnPush | sí |
| `app-questionnaire-answer` | `QuestionnaireAnswer` | — | — | — | OnPush | sí |
| `app-questionnaires` | `Questionnaires` | — | — | — | OnPush | **no** |
| `app-accounting` | `Accounting` | — | — | — | OnPush | sí |
| `app-assisted-registration` | `AssistedRegistration` | — | — | — | OnPush | sí |
| `app-clinical-forms` | `ClinicalForms` | — | — | — | OnPush | sí |
| `app-forms-catalog` | `FormsCatalog` | — | `duplicar` | — | OnPush | sí |
| `app-content-packs` | `ContentPacks` | — | — | — | OnPush | sí |
| `app-getting-started` | `GettingStarted` | — | — | — | OnPush | sí |
| `app-setup-notice` | `SetupNotice` | — | — | — | OnPush | sí |
| `app-medical-laboratory` | `MedicalLaboratory` | — | — | — | OnPush | sí |
| `app-medical-organization` | `MedicalOrganization` | — | — | — | OnPush | sí |
| `app-moderation` | `Moderation` | — | — | — | OnPush | sí |
| `app-branch-new` | `BranchNew` | — | — | — | OnPush | sí |
| `app-child-organization-new` | `ChildOrganizationNew` | — | — | — | OnPush | sí |
| `app-membership-new` | `MembershipNew` | — | — | — | OnPush | sí |
| `app-organization-detail` | `OrganizationDetail` | — | — | — | OnPush | **no** |
| `app-organization-list` | `OrganizationList` | — | — | — | OnPush | sí |
| `app-organization-new` | `OrganizationNew` | — | — | — | OnPush | sí |
| `app-organization-verify` | `OrganizationVerify` | — | — | — | OnPush | sí |
| `app-patient-detail` | `PatientDetail` | — | — | — | OnPush | sí |
| `app-patient-list` | `PatientList` | — | — | — | OnPush | sí |
| `app-patient-merge` | `PatientMerge` | — | — | — | OnPush | sí |
| `app-patient-new` | `PatientNew` | — | — | — | OnPush | sí |
| `app-related-person-form` | `RelatedPersonForm` | `profileId`, `yaTieneTutor` | `registered`, `cancelled` | — | OnPush | sí |
| `app-procedure-import` | `ProcedureImport` | — | — | — | OnPush | **no** |
| `app-services-catalog` | `ServicesCatalog` | — | — | — | OnPush | sí |
| `app-terminology-catalog` | `TerminologyCatalog` | — | — | — | OnPush | sí |
| `app-version-import` | `VersionImport` | — | — | — | OnPush | sí |
| `app-user-registration` | `UserRegistration` | — | — | — | OnPush | sí |
| `app-agenda-create` | `AgendaCreate` | — | — | — | OnPush | sí |
| `app-agenda` | `Agenda` | — | — | — | OnPush | sí |
| `app-appointment-new` | `AppointmentNew` | — | — | — | OnPush | sí |
| `app-blocks` | `Blocks` | — | — | — | OnPush | sí |
| `app-booking-new` | `BookingNew` | — | — | — | OnPush | sí |
| `app-block-form` | `BlockForm` | `motivos`, `editando` | `bloquear`, `cancelar` | — | OnPush | sí |
| `app-day-view` | `DayView` | `dia`, `cupos`, `citas`, `bloqueos`, `tipologias`, `puedeRegistrarLlegada`, `etiquetas` | `accionPedida`, `ratoTocado`, `quitarOcupado`, `volver`, `diaCambiado`, `detallePedido`, `movimientoPedido`, `cierrePedido` | — | OnPush | sí |
| `app-month-view` | `MonthView` | `mes`, `cupos`, `bloqueos` | `mesElegido`, `diaElegido` | — | OnPush | sí |
| `app-my-agenda` | `MyAgenda` | — | — | — | OnPush | sí |
| `app-schedule-grid` | `ScheduleGrid` | `reglas` | — | — | OnPush | sí |
| `app-tarjeta-del-dia` | `TarjetaDelDia` | `dia`, `resourceId`, `desdeInicial`, `hastaInicial`, `ratosTomados` | `creada`, `cerrada` | — | OnPush | sí |
| `app-week-view` | `WeekView` | `semana`, `cupos`, `bloqueos` | `semanaElegida`, `diaElegido` | — | OnPush | sí |
| `app-alovida-accesos-acceso-de-emergencia-formulario` | `AccesosAccesoDeEmergenciaFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-clinicos-del-paciente-formulario` | `AccesosClinicosDelPacienteFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-clinicos-del-paciente-listado` | `AccesosClinicosDelPacienteListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-clinicos-listado` | `AccesosClinicosListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-clinicos-revocar` | `AccesosClinicosRevocar` | — | — | — | Default | **no** |
| `app-alovida-accesos-alcance-de-recurso-formulario` | `AccesosAlcanceDeRecursoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-alcance-de-recurso-listado` | `AccesosAlcanceDeRecursoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-asignaciones-de-rol-formulario` | `AccesosAsignacionesDeRolFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-asignaciones-de-rol-listado` | `AccesosAsignacionesDeRolListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-cache-invalidar` | `AccesosCacheInvalidar` | — | — | — | Default | **no** |
| `app-alovida-accesos-categorias-de-permiso-formulario` | `AccesosCategoriasDePermisoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-categorias-de-permiso-listado` | `AccesosCategoriasDePermisoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-concesiones-de-permiso-formulario` | `AccesosConcesionesDePermisoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-concesiones-de-permiso-listado` | `AccesosConcesionesDePermisoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-decisiones-evaluar` | `AccesosDecisionesEvaluar` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-de-campo-formulario` | `AccesosPermisosDeCampoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-de-campo-listado` | `AccesosPermisosDeCampoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-del-rol-formulario` | `AccesosPermisosDelRolFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-del-rol-listado` | `AccesosPermisosDelRolListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-formulario` | `AccesosPermisosFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-permisos-listado` | `AccesosPermisosListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-politicas-de-acceso-formulario` | `AccesosPoliticasDeAccesoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-politicas-de-acceso-listado` | `AccesosPoliticasDeAccesoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-relaciones-de-cuidado-formulario` | `AccesosRelacionesDeCuidadoFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-relaciones-de-cuidado-listado` | `AccesosRelacionesDeCuidadoListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-relaciones-de-cuidado-revocar` | `AccesosRelacionesDeCuidadoRevocar` | — | — | — | Default | **no** |
| `app-alovida-accesos-representaciones-legales-formulario` | `AccesosRepresentacionesLegalesFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-representaciones-legales-listado` | `AccesosRepresentacionesLegalesListado` | — | — | — | Default | **no** |
| `app-alovida-accesos-representaciones-legales-revocar` | `AccesosRepresentacionesLegalesRevocar` | — | — | — | Default | **no** |
| `app-alovida-accesos-roles-formulario` | `AccesosRolesFormulario` | — | — | — | Default | **no** |
| `app-alovida-accesos-roles-listado` | `AccesosRolesListado` | — | — | — | Default | **no** |
| `app-alovida-buscar-aseguradoras-listado` | `BuscarAseguradorasListado` | — | — | — | OnPush | **no** |
| `app-alovida-buscar-buscador-listado` | `BuscarBuscadorListado` | — | — | — | OnPush | **no** |
| `app-alovida-buscar-calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | — | — | — | Default | **no** |
| `li[app-centro-card]` | `CentroCard` | `centro` | — | — | OnPush | **no** |
| `app-alovida-buscar-cercania-detalle` | `BuscarCercaniaDetalle` | — | — | — | OnPush | **no** |
| `app-feed-publicaciones` | `FeedPublicaciones` | — | — | — | OnPush | **no** |
| `app-facility-directions-dialog` | `FacilityDirectionsDialog` | `facilityName`, `facilityLocation`, `facilityAddress` | `closed` | — | OnPush | sí |
| `app-alovida-buscar-hospitales-listado` | `BuscarHospitalesListado` | — | — | — | OnPush | **no** |
| `app-alovida-buscar-laboratorios-listado` | `BuscarLaboratoriosListado` | — | — | — | OnPush | **no** |
| `app-alovida-buscar-medicamentos-listado` | `BuscarMedicamentosListado` | — | — | — | OnPush | **no** |
| `app-pharmacy-availability-dialog` | `PharmacyAvailabilityDialog` | `medicationName`, `offers`, `loading`, `failed`, `mapCenter`, `mapZoom`, `originLabel` | `closed` | — | OnPush | sí |
| `app-alovida-buscar-perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | — | — | — | Default | **no** |
| `app-alovida-buscar-perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | — | — | — | Default | **no** |
| `app-alovida-buscar-perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | — | — | — | Default | **no** |
| `app-alovida-buscar-perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | — | — | — | Default | **no** |
| `app-alovida-buscar-perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | — | — | — | Default | **no** |
| `app-alovida-buscar-profesionales-listado` | `BuscarProfesionalesListado` | — | — | — | OnPush | sí |
| `app-alovida-buscar-seguidos-y-guardados-listado` | `BuscarSeguidosYGuardadosListado` | — | — | — | Default | **no** |
| `app-sintomas-publico` | `SintomasPublico` | — | — | — | OnPush | **no** |
| `app-alovida-datos-compartidos-archivos-eliminar` | `DatosCompartidosArchivosEliminar` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-archivos-formulario` | `DatosCompartidosArchivosFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-archivos-listado` | `DatosCompartidosArchivosListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-archivos-obtener-enlace` | `DatosCompartidosArchivosObtenerEnlace` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-archivos-subir` | `DatosCompartidosArchivosSubir` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-contenido-detalle` | `DatosCompartidosContenidoDetalle` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-derivados-formulario` | `DatosCompartidosDerivadosFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-derivados-listado` | `DatosCompartidosDerivadosListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-direcciones-formulario` | `DatosCompartidosDireccionesFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-direcciones-listado` | `DatosCompartidosDireccionesListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-identificadores-formulario` | `DatosCompartidosIdentificadoresFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-identificadores-listado` | `DatosCompartidosIdentificadoresListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-puntos-de-contacto-formulario` | `DatosCompartidosPuntosDeContactoFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-puntos-de-contacto-listado` | `DatosCompartidosPuntosDeContactoListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-puntos-de-contacto-verificar` | `DatosCompartidosPuntosDeContactoVerificar` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-versiones-formulario` | `DatosCompartidosVersionesFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-versiones-internas-escanear` | `DatosCompartidosVersionesInternasEscanear` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-versiones-internas-listado` | `DatosCompartidosVersionesInternasListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-versiones-listado` | `DatosCompartidosVersionesListado` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-vinculos-formulario` | `DatosCompartidosVinculosFormulario` | — | — | — | Default | **no** |
| `app-alovida-datos-compartidos-vinculos-listado` | `DatosCompartidosVinculosListado` | — | — | — | Default | **no** |
| `app-alovida-directorio-asignaciones-de-sucursal-formulario` | `DirectorioAsignacionesDeSucursalFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-membresias-dar-de-baja` | `DirectorioMembresiasDarDeBaja` | — | — | — | Default | **no** |
| `app-alovida-directorio-membresias-formulario` | `DirectorioMembresiasFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-membresias-listado` | `DirectorioMembresiasListado` | — | — | — | Default | **no** |
| `app-alovida-directorio-organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-organizaciones-listado` | `DirectorioOrganizacionesListado` | — | — | — | Default | **no** |
| `app-alovida-directorio-organizaciones-suspender` | `DirectorioOrganizacionesSuspender` | — | — | — | Default | **no** |
| `app-alovida-directorio-organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | — | — | — | Default | **no** |
| `app-alovida-directorio-roles-formulario` | `DirectorioRolesFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-sucursales-formulario` | `DirectorioSucursalesFormulario` | — | — | — | Default | **no** |
| `app-alovida-directorio-sucursales-listado` | `DirectorioSucursalesListado` | — | — | — | Default | **no** |
| `app-alovida-directorio-transferencias-formulario` | `DirectorioTransferenciasFormulario` | — | — | — | Default | **no** |
| `app-alovida-inicio-portada` | `InicioPortada` | — | — | — | Default | **no** |
| `app-alovida-personas-apoderados-de-portal-formulario` | `PersonasApoderadosDePortalFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-apoderados-de-portal-listado` | `PersonasApoderadosDePortalListado` | — | — | — | Default | **no** |
| `app-alovida-personas-autorizaciones-de-jurisdiccion-formulario` | `PersonasAutorizacionesDeJurisdiccionFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-autorizaciones-de-jurisdiccion-listado` | `PersonasAutorizacionesDeJurisdiccionListado` | — | — | — | Default | **no** |
| `app-alovida-personas-credenciales-listado` | `PersonasCredencialesListado` | — | — | — | Default | **no** |
| `app-alovida-personas-credenciales-verificar` | `PersonasCredencialesVerificar` | — | — | — | Default | **no** |
| `app-alovida-personas-especialidades-formulario` | `PersonasEspecialidadesFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-especialidades-listado` | `PersonasEspecialidadesListado` | — | — | — | Default | **no** |
| `app-alovida-personas-pacientes-formulario` | `PersonasPacientesFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-pacientes-fusionar` | `PersonasPacientesFusionar` | — | — | — | Default | **no** |
| `app-alovida-personas-pacientes-listado` | `PersonasPacientesListado` | — | — | — | Default | **no** |
| `app-alovida-personas-pacientes-revertir` | `PersonasPacientesRevertir` | — | — | — | Default | **no** |
| `app-alovida-personas-listado` | `PersonasListado` | — | — | — | Default | **no** |
| `app-alovida-personas-registrar-defuncion` | `PersonasRegistrarDefuncion` | — | — | — | Default | **no** |
| `app-alovida-personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-relacionadas-listado` | `PersonasRelacionadasListado` | — | — | — | Default | **no** |
| `app-alovida-personas-profesionales-formulario` | `PersonasProfesionalesFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-profesionales-listado` | `PersonasProfesionalesListado` | — | — | — | Default | **no** |
| `app-alovida-personas-resumen-propio-listado` | `PersonasResumenPropioListado` | — | — | — | Default | **no** |
| `app-alovida-personas-vinculos-de-cuenta-formulario` | `PersonasVinculosDeCuentaFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-vinculos-de-cuenta-listado` | `PersonasVinculosDeCuentaListado` | — | — | — | Default | **no** |
| `app-alovida-personas-vinculos-de-identidad-formulario` | `PersonasVinculosDeIdentidadFormulario` | — | — | — | Default | **no** |
| `app-alovida-personas-vinculos-de-identidad-listado` | `PersonasVinculosDeIdentidadListado` | — | — | — | Default | **no** |
| `app-alovida-design-notice` | `AlovidaDesignNotice` | — | — | — | OnPush | **no** |
| `app-alovida-public-shell` | `AlovidaPublicShell` | — | — | — | Default | sí |
| `app-alovida-shell` | `AlovidaShell` | — | — | — | Default | sí |
| `app-alovida-terminologia-conceptos-listado` | `TerminologiaConceptosListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-conjuntos-de-valor-formulario` | `TerminologiaConjuntosDeValorFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-deprecacion-de-concepto-formulario` | `TerminologiaDeprecacionDeConceptoFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-designaciones-formulario` | `TerminologiaDesignacionesFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-designaciones-listado` | `TerminologiaDesignacionesListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-expansion-de-conjunto-de-valores-detalle` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | — | — | — | Default | **no** |
| `app-alovida-terminologia-expansion-de-conjunto-de-valores-formulario` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-politicas-de-catalogo-formulario` | `TerminologiaPoliticasDeCatalogoFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-politicas-de-catalogo-listado` | `TerminologiaPoliticasDeCatalogoListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-propiedades-formulario` | `TerminologiaPropiedadesFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-propiedades-listado` | `TerminologiaPropiedadesListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-relaciones-formulario` | `TerminologiaRelacionesFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-relaciones-listado` | `TerminologiaRelacionesListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-sistemas-de-codigos-formulario` | `TerminologiaSistemasDeCodigosFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-traduccion-entre-catalogos-formulario` | `TerminologiaTraduccionEntreCatalogosFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-versiones-de-sistema-formulario` | `TerminologiaVersionesDeSistemaFormulario` | — | — | — | Default | **no** |
| `app-alovida-terminologia-versiones-de-sistema-listado` | `TerminologiaVersionesDeSistemaListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-versiones-importar` | `TerminologiaVersionesImportar` | — | — | — | Default | **no** |
| `app-alovida-terminologia-versiones-listado` | `TerminologiaVersionesListado` | — | — | — | Default | **no** |
| `app-alovida-terminologia-versiones-publicar` | `TerminologiaVersionesPublicar` | — | — | — | Default | **no** |
| `app-assets-liabilities` | `AssetsLiabilities` | — | — | — | OnPush | sí |
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
| `app-signing-key-form` | `SigningKeyForm` | — | — | — | OnPush | sí |
| `app-tenant-binding-form` | `TenantBindingForm` | — | — | — | OnPush | sí |
| `app-activate-account` | `ActivateAccount` | — | — | — | OnPush | sí |
| `app-forgot-password` | `ForgotPassword` | — | — | — | OnPush | sí |
| `app-login` | `Login` | — | — | — | OnPush | sí |
| `app-register-account-type` | `RegisterAccountType` | — | — | — | OnPush | sí |
| `app-register-organization` | `RegisterOrganization` | — | — | — | OnPush | sí |
| `app-register-patient` | `RegisterPatient` | — | — | — | OnPush | sí |
| `app-register-practitioner` | `RegisterPractitioner` | — | — | — | OnPush | sí |
| `app-department-map` | `DepartmentMap` | `departamentos`, `etiqueta`, `testId` | — | `value` | OnPush | sí |
| `app-location-picker` | `LocationPicker` | `ramas`, `municipalityLabel`, `municipalityHint`, `municipalityDescription`, `required`, `errorMessage`, `mapLabel`, `testId` | — | `value` | OnPush | sí |
| `app-resend-verification` | `ResendVerification` | — | — | — | OnPush | sí |
| `app-reset-password` | `ResetPassword` | — | — | — | OnPush | sí |
| `app-tenant-selection` | `TenantSelection` | — | — | — | OnPush | sí |
| `app-verify-email` | `VerifyEmail` | — | — | — | OnPush | sí |
| `app-campaign-detail` | `CampaignDetail` | — | — | — | OnPush | sí |
| `app-clinical-record` | `ClinicalRecord` | — | — | — | OnPush | sí |
| `app-admission-block` | `AdmissionBlock` | `patientProfileId`, `encounterId`, `internaciones` | `cambio` | — | OnPush | sí |
| `app-diagnosis-block` | `DiagnosisBlock` | `patientProfileId`, `encounterId` | `cambio` | — | OnPush | sí |
| `app-diagnostics-block` | `DiagnosticsBlock` | `patientProfileId`, `encounterId` | — | — | OnPush | sí |
| `app-free-note-block` | `FreeNoteBlock` | `patientProfileId`, `encounterId` | `guardada` | — | OnPush | sí |
| `app-medication-block` | `MedicationBlock` | `patientProfileId`, `encounterId`, `recetas`, `diagnosticos`, `medicacionActivaConceptIds` | `cambio`, `descargar` | — | OnPush | sí |
| `app-odontogram` | `Odontogram` | `estados`, `marcas`, `seleccionada`, `readonly` | `pieza` | — | OnPush | sí |
| `app-patient-chart` | `PatientChart` | — | — | — | OnPush | sí |
| `app-procedures-block` | `ProceduresBlock` | `patientProfileId`, `encounterId`, `modo` | — | — | OnPush | sí |
| `app-specialty-form-block` | `SpecialtyFormBlock` | `encounterId`, `patientProfileId` | `cambio` | — | OnPush | sí |
| `app-request-access` | `RequestAccess` | — | — | — | OnPush | **no** |
| `app-component-stock` | `ComponentStock` | — | — | — | OnPush | **no** |
| `app-consultation` | `Consultation` | — | — | — | OnPush | **no** |
| `app-access-tree` | `AccessTree` | `sections` | — | — | OnPush | sí |
| `app-dashboard` | `Dashboard` | — | — | — | OnPush | sí |
| `app-patient-home` | `PatientHome` | — | — | — | OnPush | sí |
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
| `app-diagnostics` | `Diagnostics` | — | — | — | OnPush | sí |
| `app-directories-overview` | `DirectoriesOverview` | — | — | — | OnPush | sí |
| `app-practitioner-availability` | `PractitionerAvailability` | `practitionerProfileId`, `tenantId` | — | — | OnPush | sí |
| `app-practitioner-detail` | `PractitionerDetail` | — | — | — | OnPush | sí |
| `app-practitioners-directory` | `PractitionersDirectory` | — | — | — | OnPush | sí |
| `app-error-recovery` | `ErrorRecovery` | — | — | — | OnPush | **no** |
| `app-composer` | `Composer` | `profileId`, `avisoPii` | `publicado` | — | OnPush | sí |
| `app-feed` | `Feed` | — | — | — | OnPush | sí |
| `app-post-card` | `PostCard` | `post`, `actorProfileId`, `guardado`, `puedeReportar` | `reportar`, `cambio`, `guardarCambiado` | — | OnPush | sí |
| `app-report-post` | `ReportPost` | `postId` | `reportado`, `cancelado` | — | OnPush | sí |
| `app-form-builder` | `FormBuilder` | — | — | — | OnPush | sí |
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
| `app-glossary-category-icon` | `GlossaryCategoryIcon` | `category` | — | — | OnPush | sí |
| `app-glossary-term` | `GlossaryTerm` | — | — | — | OnPush | sí |
| `app-glossary` | `Glossary` | — | — | — | OnPush | sí |
| `app-group-composer` | `GroupComposer` | `accion`, `placeholder`, `enviando`, `cancelable` | `publicado`, `cancelado` | — | OnPush | **no** |
| `app-group-detail` | `GroupDetail` | — | — | — | OnPush | sí |
| `app-group-post` | `GroupPost` | `post`, `puedeResponder`, `respondiendoA` | `responder` | — | OnPush | **no** |
| `app-groups` | `Groups` | — | — | — | OnPush | sí |
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
| `app-broker-detail` | `BrokerDetail` | — | — | — | OnPush | sí |
| `app-broker-directory` | `BrokerDirectory` | — | — | — | OnPush | sí |
| `app-insurance-catalog` | `InsuranceCatalog` | — | — | — | OnPush | sí |
| `app-insurance-claim-detail` | `InsuranceClaimDetail` | — | — | — | OnPush | sí |
| `app-insurance-claims` | `InsuranceClaims` | — | — | — | OnPush | sí |
| `app-interventions` | `Interventions` | — | — | — | OnPush | **no** |
| `app-laboratory-detail` | `LaboratoryDetail` | — | — | — | OnPush | sí |
| `app-laboratory-directory` | `LaboratoryDirectory` | — | — | — | OnPush | sí |
| `app-conversation-list` | `ConversationList` | `conversaciones`, `activaId`, `compacta` | — | — | OnPush | **no** |
| `app-messaging` | `Messaging` | — | — | — | OnPush | sí |
| `app-thread` | `Thread` | — | — | — | OnPush | sí |
| `app-my-services` | `MyServices` | — | — | — | OnPush | sí |
| `app-nearby-places` | `NearbyPlaces` | — | — | — | OnPush | sí |
| `app-not-found` | `NotFound` | — | — | — | OnPush | sí |
| `app-notification-center` | `NotificationCenter` | — | — | — | OnPush | sí |
| `app-onboarding-practitioner` | `OnboardingPractitioner` | — | — | — | OnPush | sí |
| `app-organization-panel` | `OrganizationPanel` | — | — | — | OnPush | sí |
| `app-pharmacy-campaigns` | `PharmacyCampaigns` | — | — | — | OnPush | sí |
| `app-inbox-order` | `InboxOrder` | — | — | — | OnPush | sí |
| `app-pharmacy-inbox` | `PharmacyInbox` | — | — | — | OnPush | sí |
| `app-my-organizations` | `MyOrganizations` | — | — | — | OnPush | sí |
| `app-doctor-visits` | `DoctorVisits` | — | — | — | OnPush | sí |
| `app-pharma-lab-home` | `PharmaLabHome` | — | — | — | OnPush | sí |
| `app-visitor-visits` | `VisitorVisits` | — | — | — | OnPush | sí |
| `app-progress-notes` | `ProgressNotes` | — | — | — | OnPush | sí |
| `app-clinics-directory` | `ClinicsDirectory` | — | — | — | OnPush | **no** |
| `app-pharmacies-directory` | `PharmaciesDirectory` | — | — | — | OnPush | **no** |
| `app-public-post-card` | `PublicPostCard` | `post`, `autorNombre`, `autorHeadline`, `autorAvatar`, `autorIniciales`, `slug`, `enfocada`, `autorEnlazado` | `pedidoDeOcultar`, `pedidoDeDenuncia`, `pedidoDeContacto` | — | OnPush | sí |
| `app-public-post-comments` | `PublicPostComments` | `postId` | — | — | OnPush | sí |
| `app-public-post-detail` | `PublicPostDetail` | — | — | — | OnPush | **no** |
| `app-public-post-reactions` | `PublicPostReactions` | `postId`, `total` | `cerrado` | — | OnPush | sí |
| `app-public-profile-card` | `PublicProfileCard` | `perfil`, `preview` | `escribir` | — | OnPush | sí |
| `app-public-profile` | `PublicProfile` | — | — | — | OnPush | sí |
| `app-surveys-home` | `SurveysHome` | — | — | — | OnPush | **no** |
| `app-survey-detail` | `SurveyDetailScreen` | — | — | — | OnPush | **no** |
| `app-quotation-form` | `QuotationForm` | — | — | — | OnPush | sí |
| `app-quotation-list` | `QuotationList` | — | — | — | OnPush | **no** |
| `app-section-placeholder` | `SectionPlaceholder` | — | — | — | OnPush | sí |
| `app-settings` | `Settings` | — | — | — | OnPush | sí |
| `app-shell-layout` | `ShellLayout` | — | — | — | OnPush | sí |
| `app-symptom-check` | `SymptomCheck` | `sinSesion`, `rutaDeResultados` | — | — | OnPush | sí |
| `app-tutorials-center` | `TutorialsCenter` | — | — | — | OnPush | sí |

## Core (2)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-toast-dev-panel` | `ToastDevPanel` | — | — | — | OnPush | **no** |
| `app-mock-banner` | `MockBanner` | — | — | — | OnPush | **no** |

## Otro (1)

| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |
|---|---|---|---|---|---|---|
| `app-root` | `App` | — | — | — | Default | sí |

## Servicios (84)

| Clase | Archivo | Ámbito | Prueba |
|---|---|---|---|
| `AlovidaRuntimeService` | `src/app/core/alovida/alovida-runtime.service.ts` | root | sí |
| `AuthService` | `src/app/core/auth/auth.service.ts` | root | sí |
| `IdleLogout` | `src/app/core/auth/idle-logout.ts` | root | sí |
| `RefreshTokenStorage` | `src/app/core/auth/refresh-token.storage.ts` | root | **no** |
| `SessionStore` | `src/app/core/auth/session.store.ts` | root | sí |
| `AccountingClient` | `src/app/core/data-access/accounting/accounting.client.ts` | root | sí |
| `AssetsLiabilitiesClient` | `src/app/core/data-access/assets-liabilities/assets-liabilities.client.ts` | root | sí |
| `AuthProvidersClient` | `src/app/core/data-access/auth-providers/auth-providers.client.ts` | root | sí |
| `AuthzClient` | `src/app/core/data-access/authz/authz.client.ts` | root | sí |
| `ChartNotesClient` | `src/app/core/data-access/chart-notes/chart-notes.client.ts` | root | **no** |
| `ChartTemplatesClient` | `src/app/core/data-access/chart-templates/chart-templates.client.ts` | root | sí |
| `ClinicalClient` | `src/app/core/data-access/clinical/clinical.client.ts` | root | sí |
| `AddressesClient` | `src/app/core/data-access/common/addresses.client.ts` | root | **no** |
| `CommunityClient` | `src/app/core/data-access/community/community.client.ts` | root | sí |
| `ContentPacksClient` | `src/app/core/data-access/content-packs/content-packs.client.ts` | root | **no** |
| `DelegatedAccessClient` | `src/app/core/data-access/delegated-access/delegated-access.client.ts` | root | sí |
| `DiagnosticUnitsAdminClient` | `src/app/core/data-access/diagnostic-units/diagnostic-units-admin.client.ts` | root | sí |
| `DiagnosticUnitsClient` | `src/app/core/data-access/diagnostic-units/diagnostic-units.client.ts` | root | sí |
| `DiagnosticsClient` | `src/app/core/data-access/diagnostics/diagnostics.client.ts` | root | sí |
| `DirectoryClient` | `src/app/core/data-access/directory/directory.client.ts` | root | sí |
| `FilesClient` | `src/app/core/data-access/files/files.client.ts` | root | sí |
| `FormsClient` | `src/app/core/data-access/forms/forms.client.ts` | root | sí |
| `GeoClient` | `src/app/core/data-access/geo/geo.client.ts` | root | sí |
| `HealthContextClient` | `src/app/core/data-access/health-context/health-context.client.ts` | root | sí |
| `IamClient` | `src/app/core/data-access/iam/iam.client.ts` | root | sí |
| `IdentityAdminClient` | `src/app/core/data-access/identity/identity-admin.client.ts` | root | sí |
| `IdentityClient` | `src/app/core/data-access/identity/identity.client.ts` | root | sí |
| `InsuranceClient` | `src/app/core/data-access/insurance/insurance.client.ts` | root | sí |
| `SaldoInsuficienteError` | `src/app/core/data-access/loyalty/loyalty.client.ts` | root | sí |
| `MedicalOrganizationClient` | `src/app/core/data-access/medical-organization/medical-organization.client.ts` | root | sí |
| `NotificationsClient` | `src/app/core/data-access/notifications/notifications.client.ts` | root | sí |
| `PharmaLabConcepts` | `src/app/core/data-access/pharma-lab/pharma-lab-concepts.client.ts` | root | **no** |
| `PharmaLabClient` | `src/app/core/data-access/pharma-lab/pharma-lab.client.ts` | root | **no** |
| `PharmacyCampaignsClient` | `src/app/core/data-access/pharmacy-campaigns/pharmacy-campaigns.client.ts` | root | sí |
| `PharmacyOrdersClient` | `src/app/core/data-access/pharmacy-orders/pharmacy-orders.client.ts` | root | sí |
| `PharmacyClient` | `src/app/core/data-access/pharmacy/pharmacy.client.ts` | root | sí |
| `PracticeSitesClient` | `src/app/core/data-access/practice-sites/practice-sites.client.ts` | root | sí |
| `PrescriptionFavoritesClient` | `src/app/core/data-access/prescription-favorites/prescription-favorites.client.ts` | root | sí |
| `ProceduresClient` | `src/app/core/data-access/procedures/procedures.client.ts` | root | sí |
| `ProfilesClient` | `src/app/core/data-access/profiles/profiles.client.ts` | root | sí |
| `PublicDirectoryClient` | `src/app/core/data-access/public-directory/public-directory.client.ts` | root | sí |
| `PublicMarketplaceClient` | `src/app/core/data-access/public-marketplace/public-marketplace.client.ts` | root | sí |
| `PublicClient` | `src/app/core/data-access/public/public.client.ts` | root | **no** |
| `QuotationsClient` | `src/app/core/data-access/quotations/quotations.client.ts` | root | **no** |
| `SchedulingClient` | `src/app/core/data-access/scheduling/scheduling.client.ts` | root | sí |
| `ServicesCatalogClient` | `src/app/core/data-access/services-catalog/services-catalog.client.ts` | root | sí |
| `SurveysClient` | `src/app/core/data-access/surveys/surveys.client.ts` | root | **no** |
| `RelatedPersonRelationshipsCatalog` | `src/app/core/data-access/system-context/related-person-relationships.service.ts` | root | sí |
| `SystemContextClient` | `src/app/core/data-access/system-context/system-context.client.ts` | root | sí |
| `BoDepartmentsCatalog` | `src/app/core/data-access/terminology/bo-departments.service.ts` | root | **no** |
| `BoEmployersCatalog` | `src/app/core/data-access/terminology/bo-employers.service.ts` | root | **no** |
| `BoMunicipalitiesCatalog` | `src/app/core/data-access/terminology/bo-municipalities.service.ts` | root | **no** |
| `BoOccupationsCatalog` | `src/app/core/data-access/terminology/bo-occupations.service.ts` | root | **no** |
| `MedicalSpecialtiesCatalog` | `src/app/core/data-access/terminology/medical-specialties.service.ts` | root | sí |
| `TerminologyClient` | `src/app/core/data-access/terminology/terminology.client.ts` | root | sí |
| `AppErrorHandler` | `src/app/core/errors/app-error-handler.ts` | local | **no** |
| `ErrorReporter` | `src/app/core/errors/error-reporter.ts` | root | sí |
| `TokenRefreshService` | `src/app/core/http/token-refresh.service.ts` | root | sí |
| `Breakpoints` | `src/app/core/layout/breakpoints.ts` | root | sí |
| `ChatSocketService` | `src/app/core/messaging/chat-socket.service.ts` | root | **no** |
| `MessageTemplates` | `src/app/core/messaging/message-templates.ts` | root | **no** |
| `NavigationHistoryService` | `src/app/core/navigation/navigation-history.service.ts` | root | sí |
| `NavigationService` | `src/app/core/navigation/navigation.service.ts` | root | sí |
| `NotificationsStore` | `src/app/core/notifications/notifications.store.ts` | root | sí |
| `FormTracing` | `src/app/core/observability/business/form-tracing.ts` | root | **no** |
| `ErrorDeduplicator` | `src/app/core/observability/errors/error-deduplicator.ts` | root | **no** |
| `ErrorTelemetry` | `src/app/core/observability/errors/error-telemetry.ts` | root | sí |
| `RouterTracing` | `src/app/core/observability/routing/router-tracing.ts` | root | sí |
| `AppStabilityTracing` | `src/app/core/observability/tracing/app-stability.ts` | root | **no** |
| `TracingService` | `src/app/core/observability/tracing/tracing.service.ts` | root | sí |
| `BrowserPermissionsService` | `src/app/core/permissions/browser-permissions.service.ts` | root | sí |
| `ThemeService` | `src/app/core/tokens/theme.service.ts` | root | sí |
| `HelpBlockDismissalStore` | `src/app/core/tutorials/help-block-dismissal.store.ts` | root | sí |
| `TutorialProgressStore` | `src/app/core/tutorials/tutorial-progress.store.ts` | root | sí |
| `TutorialEngine` | `src/app/core/tutorials/tutorial.engine.ts` | root | sí |
| `TutorialRegistry` | `src/app/core/tutorials/tutorial.registry.ts` | root | sí |
| `TarifariosRecordados` | `src/app/features/admin/medical-laboratory/tarifarios-recordados.ts` | root | sí |
| `CaseStatusCatalog` | `src/app/features/identity-verification/case-status.ts` | root | sí |
| `AlarmaDePedidos` | `src/app/features/organization/pharmacy-inbox/alarma-de-pedidos.ts` | local | sí |
| `DialogService` | `src/app/shared/components/molecules/dialog/dialog-service.ts` | root | **no** |
| `PdfExportService` | `src/app/shared/components/molecules/pdf-export-button/pdf-export.service.ts` | root | **no** |
| `ToastService` | `src/app/shared/components/molecules/toast/toast.service.ts` | root | sí |
| `ShellService` | `src/app/shared/components/organisms/shell/shell-service.ts` | root | **no** |
| `CsvExportService` | `src/app/shared/utils/csv-export/csv-export.ts` | root | sí |

## Componentes sin prueba

- `ToastDevPanel` — `src/app/core/dev/toast-dev-panel/toast-dev-panel.ts`
- `MockBanner` — `src/app/core/mock/mock-banner.ts`
- `AccessRequests` — `src/app/features/account/access-requests/access-requests.ts`
- `Questionnaires` — `src/app/features/account/questionnaires/questionnaires.ts`
- `OrganizationDetail` — `src/app/features/admin/organizations/organization-detail/organization-detail.ts`
- `ProcedureImport` — `src/app/features/admin/services-catalog/procedure-import/procedure-import.ts`
- `AccesosAccesoDeEmergenciaFormulario` — `src/app/features/alovida/accesos/acceso-de-emergencia-formulario/acceso-de-emergencia-formulario.ts`
- `AccesosClinicosDelPacienteFormulario` — `src/app/features/alovida/accesos/accesos-clinicos-del-paciente-formulario/accesos-clinicos-del-paciente-formulario.ts`
- `AccesosClinicosDelPacienteListado` — `src/app/features/alovida/accesos/accesos-clinicos-del-paciente-listado/accesos-clinicos-del-paciente-listado.ts`
- `AccesosClinicosListado` — `src/app/features/alovida/accesos/accesos-clinicos-listado/accesos-clinicos-listado.ts`
- `AccesosClinicosRevocar` — `src/app/features/alovida/accesos/accesos-clinicos-revocar/accesos-clinicos-revocar.ts`
- `AccesosAlcanceDeRecursoFormulario` — `src/app/features/alovida/accesos/alcance-de-recurso-formulario/alcance-de-recurso-formulario.ts`
- `AccesosAlcanceDeRecursoListado` — `src/app/features/alovida/accesos/alcance-de-recurso-listado/alcance-de-recurso-listado.ts`
- `AccesosAsignacionesDeRolFormulario` — `src/app/features/alovida/accesos/asignaciones-de-rol-formulario/asignaciones-de-rol-formulario.ts`
- `AccesosAsignacionesDeRolListado` — `src/app/features/alovida/accesos/asignaciones-de-rol-listado/asignaciones-de-rol-listado.ts`
- `AccesosCacheInvalidar` — `src/app/features/alovida/accesos/cache-invalidar/cache-invalidar.ts`
- `AccesosCategoriasDePermisoFormulario` — `src/app/features/alovida/accesos/categorias-de-permiso-formulario/categorias-de-permiso-formulario.ts`
- `AccesosCategoriasDePermisoListado` — `src/app/features/alovida/accesos/categorias-de-permiso-listado/categorias-de-permiso-listado.ts`
- `AccesosConcesionesDePermisoFormulario` — `src/app/features/alovida/accesos/concesiones-de-permiso-formulario/concesiones-de-permiso-formulario.ts`
- `AccesosConcesionesDePermisoListado` — `src/app/features/alovida/accesos/concesiones-de-permiso-listado/concesiones-de-permiso-listado.ts`
- `AccesosDecisionesEvaluar` — `src/app/features/alovida/accesos/decisiones-evaluar/decisiones-evaluar.ts`
- `AccesosPermisosDeCampoFormulario` — `src/app/features/alovida/accesos/permisos-de-campo-formulario/permisos-de-campo-formulario.ts`
- `AccesosPermisosDeCampoListado` — `src/app/features/alovida/accesos/permisos-de-campo-listado/permisos-de-campo-listado.ts`
- `AccesosPermisosDelRolFormulario` — `src/app/features/alovida/accesos/permisos-del-rol-formulario/permisos-del-rol-formulario.ts`
- `AccesosPermisosDelRolListado` — `src/app/features/alovida/accesos/permisos-del-rol-listado/permisos-del-rol-listado.ts`
- `AccesosPermisosFormulario` — `src/app/features/alovida/accesos/permisos-formulario/permisos-formulario.ts`
- `AccesosPermisosListado` — `src/app/features/alovida/accesos/permisos-listado/permisos-listado.ts`
- `AccesosPoliticasDeAccesoFormulario` — `src/app/features/alovida/accesos/politicas-de-acceso-formulario/politicas-de-acceso-formulario.ts`
- `AccesosPoliticasDeAccesoListado` — `src/app/features/alovida/accesos/politicas-de-acceso-listado/politicas-de-acceso-listado.ts`
- `AccesosRelacionesDeCuidadoFormulario` — `src/app/features/alovida/accesos/relaciones-de-cuidado-formulario/relaciones-de-cuidado-formulario.ts`
- `AccesosRelacionesDeCuidadoListado` — `src/app/features/alovida/accesos/relaciones-de-cuidado-listado/relaciones-de-cuidado-listado.ts`
- `AccesosRelacionesDeCuidadoRevocar` — `src/app/features/alovida/accesos/relaciones-de-cuidado-revocar/relaciones-de-cuidado-revocar.ts`
- `AccesosRepresentacionesLegalesFormulario` — `src/app/features/alovida/accesos/representaciones-legales-formulario/representaciones-legales-formulario.ts`
- `AccesosRepresentacionesLegalesListado` — `src/app/features/alovida/accesos/representaciones-legales-listado/representaciones-legales-listado.ts`
- `AccesosRepresentacionesLegalesRevocar` — `src/app/features/alovida/accesos/representaciones-legales-revocar/representaciones-legales-revocar.ts`
- `AccesosRolesFormulario` — `src/app/features/alovida/accesos/roles-formulario/roles-formulario.ts`
- `AccesosRolesListado` — `src/app/features/alovida/accesos/roles-listado/roles-listado.ts`
- `BuscarAseguradorasListado` — `src/app/features/alovida/buscar/aseguradoras-listado/aseguradoras-listado.ts`
- `BuscarBuscadorListado` — `src/app/features/alovida/buscar/buscador-listado/buscador-listado.ts`
- `BuscarCalificarLaAtencionFormulario` — `src/app/features/alovida/buscar/calificar-la-atencion-formulario/calificar-la-atencion-formulario.ts`
- `CentroCard` — `src/app/features/alovida/buscar/centro-card/centro-card.ts`
- `BuscarCercaniaDetalle` — `src/app/features/alovida/buscar/cercania-detalle/cercania-detalle.ts`
- `FeedPublicaciones` — `src/app/features/alovida/buscar/feed-publicaciones/feed-publicaciones.ts`
- `BuscarHospitalesListado` — `src/app/features/alovida/buscar/hospitales-listado/hospitales-listado.ts`
- `BuscarLaboratoriosListado` — `src/app/features/alovida/buscar/laboratorios-listado/laboratorios-listado.ts`
- `BuscarMedicamentosListado` — `src/app/features/alovida/buscar/medicamentos-listado/medicamentos-listado.ts`
- `BuscarPerfilAseguradoraDetalle` — `src/app/features/alovida/buscar/perfil-aseguradora-detalle/perfil-aseguradora-detalle.ts`
- `BuscarPerfilFarmaciaDetalle` — `src/app/features/alovida/buscar/perfil-farmacia-detalle/perfil-farmacia-detalle.ts`
- `BuscarPerfilLaboratorioDetalle` — `src/app/features/alovida/buscar/perfil-laboratorio-detalle/perfil-laboratorio-detalle.ts`
- `BuscarPerfilOrganizacionDetalle` — `src/app/features/alovida/buscar/perfil-organizacion-detalle/perfil-organizacion-detalle.ts`
- `BuscarPerfilProfesionalDetalle` — `src/app/features/alovida/buscar/perfil-profesional-detalle/perfil-profesional-detalle.ts`
- `BuscarSeguidosYGuardadosListado` — `src/app/features/alovida/buscar/seguidos-y-guardados-listado/seguidos-y-guardados-listado.ts`
- `SintomasPublico` — `src/app/features/alovida/buscar/sintomas-publico/sintomas-publico.ts`
- `DatosCompartidosArchivosEliminar` — `src/app/features/alovida/datos-compartidos/archivos-eliminar/archivos-eliminar.ts`
- `DatosCompartidosArchivosFormulario` — `src/app/features/alovida/datos-compartidos/archivos-formulario/archivos-formulario.ts`
- `DatosCompartidosArchivosListado` — `src/app/features/alovida/datos-compartidos/archivos-listado/archivos-listado.ts`
- `DatosCompartidosArchivosObtenerEnlace` — `src/app/features/alovida/datos-compartidos/archivos-obtener-enlace/archivos-obtener-enlace.ts`
- `DatosCompartidosArchivosSubir` — `src/app/features/alovida/datos-compartidos/archivos-subir/archivos-subir.ts`
- `DatosCompartidosContenidoDetalle` — `src/app/features/alovida/datos-compartidos/contenido-detalle/contenido-detalle.ts`
- `DatosCompartidosDerivadosFormulario` — `src/app/features/alovida/datos-compartidos/derivados-formulario/derivados-formulario.ts`
- `DatosCompartidosDerivadosListado` — `src/app/features/alovida/datos-compartidos/derivados-listado/derivados-listado.ts`
- `DatosCompartidosDireccionesFormulario` — `src/app/features/alovida/datos-compartidos/direcciones-formulario/direcciones-formulario.ts`
- `DatosCompartidosDireccionesListado` — `src/app/features/alovida/datos-compartidos/direcciones-listado/direcciones-listado.ts`
- `DatosCompartidosIdentificadoresFormulario` — `src/app/features/alovida/datos-compartidos/identificadores-formulario/identificadores-formulario.ts`
- `DatosCompartidosIdentificadoresListado` — `src/app/features/alovida/datos-compartidos/identificadores-listado/identificadores-listado.ts`
- `DatosCompartidosPuntosDeContactoFormulario` — `src/app/features/alovida/datos-compartidos/puntos-de-contacto-formulario/puntos-de-contacto-formulario.ts`
- `DatosCompartidosPuntosDeContactoListado` — `src/app/features/alovida/datos-compartidos/puntos-de-contacto-listado/puntos-de-contacto-listado.ts`
- `DatosCompartidosPuntosDeContactoVerificar` — `src/app/features/alovida/datos-compartidos/puntos-de-contacto-verificar/puntos-de-contacto-verificar.ts`
- `DatosCompartidosVersionesFormulario` — `src/app/features/alovida/datos-compartidos/versiones-formulario/versiones-formulario.ts`
- `DatosCompartidosVersionesInternasEscanear` — `src/app/features/alovida/datos-compartidos/versiones-internas-escanear/versiones-internas-escanear.ts`
- `DatosCompartidosVersionesInternasListado` — `src/app/features/alovida/datos-compartidos/versiones-internas-listado/versiones-internas-listado.ts`
- `DatosCompartidosVersionesListado` — `src/app/features/alovida/datos-compartidos/versiones-listado/versiones-listado.ts`
- `DatosCompartidosVinculosFormulario` — `src/app/features/alovida/datos-compartidos/vinculos-formulario/vinculos-formulario.ts`
- `DatosCompartidosVinculosListado` — `src/app/features/alovida/datos-compartidos/vinculos-listado/vinculos-listado.ts`
- `DirectorioAsignacionesDeSucursalFormulario` — `src/app/features/alovida/directorio/asignaciones-de-sucursal-formulario/asignaciones-de-sucursal-formulario.ts`
- `DirectorioMembresiasDarDeBaja` — `src/app/features/alovida/directorio/membresias-dar-de-baja/membresias-dar-de-baja.ts`
- `DirectorioMembresiasFormulario` — `src/app/features/alovida/directorio/membresias-formulario/membresias-formulario.ts`
- `DirectorioMembresiasListado` — `src/app/features/alovida/directorio/membresias-listado/membresias-listado.ts`
- `DirectorioOrganizacionesFormulario` — `src/app/features/alovida/directorio/organizaciones-formulario/organizaciones-formulario.ts`
- `DirectorioOrganizacionesHijasFormulario` — `src/app/features/alovida/directorio/organizaciones-hijas-formulario/organizaciones-hijas-formulario.ts`
- `DirectorioOrganizacionesListado` — `src/app/features/alovida/directorio/organizaciones-listado/organizaciones-listado.ts`
- `DirectorioOrganizacionesSuspender` — `src/app/features/alovida/directorio/organizaciones-suspender/organizaciones-suspender.ts`
- `DirectorioOrganizacionesVerificar` — `src/app/features/alovida/directorio/organizaciones-verificar/organizaciones-verificar.ts`
- `DirectorioRolesFormulario` — `src/app/features/alovida/directorio/roles-formulario/roles-formulario.ts`
- `DirectorioSucursalesFormulario` — `src/app/features/alovida/directorio/sucursales-formulario/sucursales-formulario.ts`
- `DirectorioSucursalesListado` — `src/app/features/alovida/directorio/sucursales-listado/sucursales-listado.ts`
- `DirectorioTransferenciasFormulario` — `src/app/features/alovida/directorio/transferencias-formulario/transferencias-formulario.ts`
- `InicioPortada` — `src/app/features/alovida/inicio/portada/portada.ts`
- `PersonasApoderadosDePortalFormulario` — `src/app/features/alovida/personas/apoderados-de-portal-formulario/apoderados-de-portal-formulario.ts`
- `PersonasApoderadosDePortalListado` — `src/app/features/alovida/personas/apoderados-de-portal-listado/apoderados-de-portal-listado.ts`
- `PersonasAutorizacionesDeJurisdiccionFormulario` — `src/app/features/alovida/personas/autorizaciones-de-jurisdiccion-formulario/autorizaciones-de-jurisdiccion-formulario.ts`
- `PersonasAutorizacionesDeJurisdiccionListado` — `src/app/features/alovida/personas/autorizaciones-de-jurisdiccion-listado/autorizaciones-de-jurisdiccion-listado.ts`
- `PersonasCredencialesListado` — `src/app/features/alovida/personas/credenciales-listado/credenciales-listado.ts`
- `PersonasCredencialesVerificar` — `src/app/features/alovida/personas/credenciales-verificar/credenciales-verificar.ts`
- `PersonasEspecialidadesFormulario` — `src/app/features/alovida/personas/especialidades-formulario/especialidades-formulario.ts`
- `PersonasEspecialidadesListado` — `src/app/features/alovida/personas/especialidades-listado/especialidades-listado.ts`
- `PersonasPacientesFormulario` — `src/app/features/alovida/personas/pacientes-formulario/pacientes-formulario.ts`
- `PersonasPacientesFusionar` — `src/app/features/alovida/personas/pacientes-fusionar/pacientes-fusionar.ts`
- `PersonasPacientesListado` — `src/app/features/alovida/personas/pacientes-listado/pacientes-listado.ts`
- `PersonasPacientesRevertir` — `src/app/features/alovida/personas/pacientes-revertir/pacientes-revertir.ts`
- `PersonasListado` — `src/app/features/alovida/personas/personas-listado/personas-listado.ts`
- `PersonasRegistrarDefuncion` — `src/app/features/alovida/personas/personas-registrar-defuncion/personas-registrar-defuncion.ts`
- `PersonasRelacionadasFormulario` — `src/app/features/alovida/personas/personas-relacionadas-formulario/personas-relacionadas-formulario.ts`
- `PersonasRelacionadasListado` — `src/app/features/alovida/personas/personas-relacionadas-listado/personas-relacionadas-listado.ts`
- `PersonasProfesionalesFormulario` — `src/app/features/alovida/personas/profesionales-formulario/profesionales-formulario.ts`
- `PersonasProfesionalesListado` — `src/app/features/alovida/personas/profesionales-listado/profesionales-listado.ts`
- `PersonasResumenPropioListado` — `src/app/features/alovida/personas/resumen-propio-listado/resumen-propio-listado.ts`
- `PersonasVinculosDeCuentaFormulario` — `src/app/features/alovida/personas/vinculos-de-cuenta-formulario/vinculos-de-cuenta-formulario.ts`
- `PersonasVinculosDeCuentaListado` — `src/app/features/alovida/personas/vinculos-de-cuenta-listado/vinculos-de-cuenta-listado.ts`
- `PersonasVinculosDeIdentidadFormulario` — `src/app/features/alovida/personas/vinculos-de-identidad-formulario/vinculos-de-identidad-formulario.ts`
- `PersonasVinculosDeIdentidadListado` — `src/app/features/alovida/personas/vinculos-de-identidad-listado/vinculos-de-identidad-listado.ts`
- `AlovidaDesignNotice` — `src/app/features/alovida/shell/alovida-design-notice.ts`
- `TerminologiaConceptosListado` — `src/app/features/alovida/terminologia/conceptos-listado/conceptos-listado.ts`
- `TerminologiaConjuntosDeValorFormulario` — `src/app/features/alovida/terminologia/conjuntos-de-valor-formulario/conjuntos-de-valor-formulario.ts`
- `TerminologiaConjuntosDeValorListado` — `src/app/features/alovida/terminologia/conjuntos-de-valor-listado/conjuntos-de-valor-listado.ts`
- `TerminologiaConsultaDeConceptoListado` — `src/app/features/alovida/terminologia/consulta-de-concepto-listado/consulta-de-concepto-listado.ts`
- `TerminologiaDeprecacionDeConceptoFormulario` — `src/app/features/alovida/terminologia/deprecacion-de-concepto-formulario/deprecacion-de-concepto-formulario.ts`
- `TerminologiaDesignacionesFormulario` — `src/app/features/alovida/terminologia/designaciones-formulario/designaciones-formulario.ts`
- `TerminologiaDesignacionesListado` — `src/app/features/alovida/terminologia/designaciones-listado/designaciones-listado.ts`
- `TerminologiaExpansionDeConjuntoDeValoresDetalle` — `src/app/features/alovida/terminologia/expansion-de-conjunto-de-valores-detalle/expansion-de-conjunto-de-valores-detalle.ts`
- `TerminologiaExpansionDeConjuntoDeValoresFormulario` — `src/app/features/alovida/terminologia/expansion-de-conjunto-de-valores-formulario/expansion-de-conjunto-de-valores-formulario.ts`
- `TerminologiaPoliticasDeCatalogoFormulario` — `src/app/features/alovida/terminologia/politicas-de-catalogo-formulario/politicas-de-catalogo-formulario.ts`
- `TerminologiaPoliticasDeCatalogoListado` — `src/app/features/alovida/terminologia/politicas-de-catalogo-listado/politicas-de-catalogo-listado.ts`
- `TerminologiaPropiedadesFormulario` — `src/app/features/alovida/terminologia/propiedades-formulario/propiedades-formulario.ts`
- `TerminologiaPropiedadesListado` — `src/app/features/alovida/terminologia/propiedades-listado/propiedades-listado.ts`
- `TerminologiaRelacionesFormulario` — `src/app/features/alovida/terminologia/relaciones-formulario/relaciones-formulario.ts`
- `TerminologiaRelacionesListado` — `src/app/features/alovida/terminologia/relaciones-listado/relaciones-listado.ts`
- `TerminologiaSistemasDeCodigosFormulario` — `src/app/features/alovida/terminologia/sistemas-de-codigos-formulario/sistemas-de-codigos-formulario.ts`
- `TerminologiaSistemasDeCodigosListado` — `src/app/features/alovida/terminologia/sistemas-de-codigos-listado/sistemas-de-codigos-listado.ts`
- `TerminologiaTraduccionEntreCatalogosFormulario` — `src/app/features/alovida/terminologia/traduccion-entre-catalogos-formulario/traduccion-entre-catalogos-formulario.ts`
- `TerminologiaVersionesDeSistemaFormulario` — `src/app/features/alovida/terminologia/versiones-de-sistema-formulario/versiones-de-sistema-formulario.ts`
- `TerminologiaVersionesDeSistemaListado` — `src/app/features/alovida/terminologia/versiones-de-sistema-listado/versiones-de-sistema-listado.ts`
- `TerminologiaVersionesImportar` — `src/app/features/alovida/terminologia/versiones-importar/versiones-importar.ts`
- `TerminologiaVersionesListado` — `src/app/features/alovida/terminologia/versiones-listado/versiones-listado.ts`
- `TerminologiaVersionesPublicar` — `src/app/features/alovida/terminologia/versiones-publicar/versiones-publicar.ts`
- `RequestAccess` — `src/app/features/clinical-record/request-access/request-access.ts`
- `ComponentStock` — `src/app/features/component-stock/component-stock.ts`
- `Consultation` — `src/app/features/consultation/consultation.ts`
- `OrganismsGallery` — `src/app/features/design-system-sample/organisms-gallery/organisms-gallery.ts`
- `ErrorRecovery` — `src/app/features/error-recovery/error-recovery.ts`
- `GroupComposer` — `src/app/features/groups/group-composer/group-composer.ts`
- `GroupPost` — `src/app/features/groups/group-post/group-post.ts`
- `Interventions` — `src/app/features/interventions/interventions.ts`
- `ConversationList` — `src/app/features/messaging/conversation-list/conversation-list.ts`
- `ClinicsDirectory` — `src/app/features/public-directories/clinics-directory.ts`
- `PharmaciesDirectory` — `src/app/features/public-directories/pharmacies-directory.ts`
- `PublicPostDetail` — `src/app/features/public-profile/public-post-detail/public-post-detail.ts`
- `SurveysHome` — `src/app/features/questionnaires/questionnaires.ts`
- `SurveyDetailScreen` — `src/app/features/questionnaires/survey-detail/survey-detail.ts`
- `QuotationList` — `src/app/features/quotations/quotation-list/quotation-list.ts`
- `AccountIcon` — `src/app/shared/components/atoms/account-icon/account-icon.ts`
- `NavIcon` — `src/app/shared/components/atoms/nav-icon/nav-icon.ts`
- `TooltipPanel` — `src/app/shared/components/atoms/tooltip/tooltip-panel.ts`
- `AccordionPanel` — `src/app/shared/components/molecules/accordion/accordion-panel/accordion-panel.ts`
- `ConceptSelect` — `src/app/shared/components/molecules/concept-select/concept-select.ts`
- `MenuItem` — `src/app/shared/components/molecules/menu/menu-item/menu-item.ts`
- `PaisBandera` — `src/app/shared/components/molecules/phone-input/pais-bandera.ts`
- `Radio` — `src/app/shared/components/molecules/radio/radio.ts`
- `Tab` — `src/app/shared/components/molecules/tabs/tab/tab.ts`
- `DirectoryPage` — `src/app/shared/components/organisms/directory-page/directory-page.ts`
- `RegistroAyuda` — `src/app/shared/components/organisms/registro-ayuda/registro-ayuda.ts`
- `ToastContainer` — `src/app/shared/components/organisms/toast-container/toast-container.ts`
