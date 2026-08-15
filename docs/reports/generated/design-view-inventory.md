<!-- GENERADO POR scripts/audit-design-views.mjs — NO EDITAR A MANO. -->

# Inventario de vistas del diseñador y cableado real

Carril 01. 25 secciones del registro, 30 pantallas hijas o de operación y 126 vistas portadas desde la bóveda.

## Estados

| Estado | Qué significa |
|---|---|
| `conectada` | Inyecta al menos un cliente de `core/data-access`. |
| `conectada con deuda` | Lee la API, pero además arrastra un marcador (`TODO`, dato de muestra). |
| `presentacional` | Pinta sin pedir nada. Correcto si es un panel de acciones; sospechoso si debía listar. |
| `maqueta portada` | Vista de la bóveda con marcado estático. Es el entregable del diseñador, no una pantalla a medio hacer. |
| `maqueta` | Pinta con constantes `_DE_MUESTRA` fuera de `redsat/`. |
| `con deuda` | Tiene `TODO`, promesa sin pantalla u otro marcador. |
| `placeholder` | Sección declarada `planificada`: cae en `SectionPlaceholder` a propósito. |

## Secciones del menú

| Rol | Ruta | Vista actual | API que usa | Estado | Acción |
|---|---|---|---|---|---|
| cualquier sesión | `/dashboard` | `Dashboard` | IdentityClient, ProfilesClient, PublicClient | conectada con deuda | resolver: promesa sin pantalla |
| cualquier sesión | `/tutorials` | `TutorialsCenter` | — | presentacional | verificar que no deba listar |
| cualquier sesión | `/directory` | `PractitionersDirectory` | ProfilesClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/laboratory-directory` | `LaboratoryDirectory` | DiagnosticUnitsClient | conectada | ninguna |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule` | `Agenda` | ProfilesClient, SchedulingClient, TerminologyClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/medical-records` | `ClinicalRecord` | ChartTemplatesClient, ClinicalClient, DiagnosticsClient, FilesClient, FormsClient, ProceduresClient, ProfilesClient, SystemContextClient, TerminologyClient | conectada | ninguna |
| CLINICIAN · PRACTITIONER | `/diagnostics` | `Diagnostics` | DiagnosticsClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/glossary` | `Glossary` | TerminologyClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/patients` | `PatientList` | ProfilesClient | conectada con deuda | resolver: TODO/FIXME |
| SECURITY_ADMIN | `/administration/users` | `UserRegistration` | IamClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/organizations` | `OrganizationList` | DirectoryClient, TerminologyClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/delegated-access` | `DelegatedAccessHome` | — | presentacional | verificar que no deba listar |
| IDENTITY_ADMIN | `/administration/identity-providers` | `AuthProvidersHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/identity-assurance` | `IdentityAdminHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/terminology` | `TerminologyCatalog` | TerminologyClient | conectada | ninguna |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context` | `HealthContextHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/geolocation` | `GeoHome` | — | presentacional | verificar que no deba listar |
| SECURITY_ADMIN | `/administration/services-catalog` | `ServicesCatalog` | ServicesCatalogClient | conectada | ninguna |
| SECURITY_ADMIN | `/administration/clinical-forms` | `ClinicalForms` | ChartTemplatesClient, TerminologyClient | conectada | ninguna |
| BILLING · FINANCE · CASHIER · PAYMENTS_ADMIN | `/billing` | `SectionPlaceholder` | — | placeholder | ninguna — declarada planificada |
| SECURITY_ADMIN · ACCOUNTING_APPROVER · PRACTITIONER | `/administration/accounting` | `Accounting` | AccountingClient | conectada | ninguna |
| cualquier sesión | `/my-account` | `MyProfile` | CommunityClient, FilesClient, IdentityClient, PracticeSitesClient, ProfilesClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/appointments` | `Appointments` | SchedulingClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/identity/verify` | `IdentityVerification` | FilesClient, IdentityClient, TerminologyClient | conectada | ninguna |
| cualquier sesión | `/my-account/identity/cases` | `VerificationCases` | IdentityClient | conectada | ninguna |

## Pantallas hijas y de operación

| Rol | Ruta | Vista actual | API que usa | Estado |
|---|---|---|---|---|
| SECURITY_ADMIN | `/administration/delegated-access/delegations/grants/new` | `GrantForm` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/delegated-access/operations/expiry-sweep` | `ExpirySweep` | DelegatedAccessClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/geofences/new` | `GeofenceForm` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/last-position` | `LastPosition` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/last-position/:trackedSubjectId` | `LastPosition` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/subjects/pings` | `PingIngest` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/trips/close` | `TripClose` | GeoClient | conectada |
| SECURITY_ADMIN | `/administration/geolocation/trips/new` | `TripForm` | GeoClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/agents/new` | `AgentForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/contexts/new` | `ContextForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/sources/new` | `SourceForm` | HealthContextClient | conectada |
| CONTEXT_CURATOR · CONTEXT_CONSUMER · SOURCE_ADMIN · QUALITY_REVIEWER · PLATFORM_ADMIN | `/administration/health-context/versions/new` | `VersionForm` | HealthContextClient | conectada |
| SECURITY_ADMIN | `/administration/identity-assurance/queue` | `CaseQueue` | IdentityAdminClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/:tenantId` | `OrganizationDetail` | DirectoryClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/organizations/new` | `OrganizationNew` | DirectoryClient, IamClient, TerminologyClient | conectada con deuda |
| SECURITY_ADMIN | `/administration/patients/:profileId` | `PatientDetail` | AuthzClient, ProfilesClient, TerminologyClient | conectada |
| SECURITY_ADMIN | `/administration/patients/assisted-registration` | `AssistedRegistration` | IamClient | conectada |
| SECURITY_ADMIN | `/administration/patients/merge` | `PatientMerge` | ProfilesClient | conectada |
| SECURITY_ADMIN | `/administration/patients/new` | `PatientNew` | ProfilesClient | conectada |
| cualquier sesión | `/directory/:profileId` | `PractitionerDetail` | FilesClient, ProfilesClient, TerminologyClient | conectada |
| cualquier sesión | `/glossary/:conceptId` | `GlossaryTerm` | TerminologyClient | conectada |
| cualquier sesión | `/laboratory-directory/:unitId` | `LaboratoryDetail` | DiagnosticUnitsClient | conectada |
| CLINICIAN · PRACTITIONER | `/medical-records/:profileId` | `PatientChart` | ChartTemplatesClient, ClinicalClient, DiagnosticsClient, FilesClient, FormsClient, ProceduresClient, ProfilesClient, SystemContextClient, TerminologyClient | conectada |
| cualquier sesión | `/my-account/appointments/book/:slotId` | `BookingNew` | ProfilesClient, SchedulingClient | conectada |
| cualquier sesión | `/my-account/articles` | `MedicalArticles` | CommunityClient | conectada |
| cualquier sesión | `/my-account/edit` | `PractitionerProfileEdit` | ProfilesClient | conectada |
| cualquier sesión | `/my-account/identity/cases/:caseId` | `VerificationCaseDetail` | IdentityClient | conectada |
| cualquier sesión | `/my-account/preview` | `PublicProfilePreview` | CommunityClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/book/:slotId` | `BookingNew` | ProfilesClient, SchedulingClient | conectada |
| SCHEDULING_ADMIN · SCHEDULING_AGENT · PRACTITIONER | `/schedule/new` | `AgendaCreate` | SchedulingClient | conectada |

## Vistas del diseñador portadas desde la bóveda

Las 126 pantallas de `features/redsat/`, generadas por `scripts/port-vistas-redsat.mjs` desde la bóveda. Son **la vista del diseñador** a la que se refiere la corrección #8: antes de crear una pantalla nueva hay que buscar acá. 0 todavía pintan con datos de muestra.

| Código | Actor | Ruta | Componente | API que usa | Estado |
|---|---|---|---|---|---|
| V02-08 | security-admin | `/datos-compartidos/versiones-internas-escanear` | `DatosCompartidosVersionesInternasEscanear` | — | maqueta portada |
| V02-08 | security-admin | `/datos-compartidos/versiones-internas-listado` | `DatosCompartidosVersionesInternasListado` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/datos-compartidos/archivos-eliminar` | `DatosCompartidosArchivosEliminar` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/datos-compartidos/archivos-formulario` | `DatosCompartidosArchivosFormulario` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/datos-compartidos/archivos-listado` | `DatosCompartidosArchivosListado` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/datos-compartidos/archivos-obtener-enlace` | `DatosCompartidosArchivosObtenerEnlace` | — | maqueta portada |
| V02-01 | sesion-autenticada | `/datos-compartidos/archivos-subir` | `DatosCompartidosArchivosSubir` | — | maqueta portada |
| V02-02 | sesion-autenticada | `/datos-compartidos/contenido-detalle` | `DatosCompartidosContenidoDetalle` | — | maqueta portada |
| V02-03 | sesion-autenticada | `/datos-compartidos/vinculos-formulario` | `DatosCompartidosVinculosFormulario` | — | maqueta portada |
| V02-03 | sesion-autenticada | `/datos-compartidos/vinculos-listado` | `DatosCompartidosVinculosListado` | — | maqueta portada |
| V02-04 | sesion-autenticada | `/datos-compartidos/versiones-formulario` | `DatosCompartidosVersionesFormulario` | — | maqueta portada |
| V02-04 | sesion-autenticada | `/datos-compartidos/versiones-listado` | `DatosCompartidosVersionesListado` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/datos-compartidos/puntos-de-contacto-formulario` | `DatosCompartidosPuntosDeContactoFormulario` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/datos-compartidos/puntos-de-contacto-listado` | `DatosCompartidosPuntosDeContactoListado` | — | maqueta portada |
| V02-05 | sesion-autenticada | `/datos-compartidos/puntos-de-contacto-verificar` | `DatosCompartidosPuntosDeContactoVerificar` | — | maqueta portada |
| V02-06 | sesion-autenticada | `/datos-compartidos/direcciones-formulario` | `DatosCompartidosDireccionesFormulario` | — | maqueta portada |
| V02-06 | sesion-autenticada | `/datos-compartidos/direcciones-listado` | `DatosCompartidosDireccionesListado` | — | maqueta portada |
| V02-07 | sesion-autenticada | `/datos-compartidos/identificadores-formulario` | `DatosCompartidosIdentificadoresFormulario` | — | maqueta portada |
| V02-07 | sesion-autenticada | `/datos-compartidos/identificadores-listado` | `DatosCompartidosIdentificadoresListado` | — | maqueta portada |
| V02-09 | sesion-autenticada | `/datos-compartidos/derivados-formulario` | `DatosCompartidosDerivadosFormulario` | — | maqueta portada |
| V02-09 | sesion-autenticada | `/datos-compartidos/derivados-listado` | `DatosCompartidosDerivadosListado` | — | maqueta portada |
| V03-01 | security-admin | `/terminologia/versiones-importar` | `TerminologiaVersionesImportar` | — | maqueta portada |
| V03-01 | security-admin | `/terminologia/versiones-listado` | `TerminologiaVersionesListado` | — | maqueta portada |
| V03-01 | security-admin | `/terminologia/versiones-publicar` | `TerminologiaVersionesPublicar` | — | maqueta portada |
| V03-04 | security-admin | `/terminologia/expansion-de-conjunto-de-valores-formulario` | `TerminologiaExpansionDeConjuntoDeValoresFormulario` | — | maqueta portada |
| V03-05 | security-admin | `/terminologia/sistemas-de-codigos-formulario` | `TerminologiaSistemasDeCodigosFormulario` | — | maqueta portada |
| V03-05 | security-admin | `/terminologia/sistemas-de-codigos-listado` | `TerminologiaSistemasDeCodigosListado` | — | maqueta portada |
| V03-06 | security-admin | `/terminologia/versiones-de-sistema-formulario` | `TerminologiaVersionesDeSistemaFormulario` | — | maqueta portada |
| V03-06 | security-admin | `/terminologia/versiones-de-sistema-listado` | `TerminologiaVersionesDeSistemaListado` | — | maqueta portada |
| V03-08 | security-admin | `/terminologia/deprecacion-de-concepto-formulario` | `TerminologiaDeprecacionDeConceptoFormulario` | — | maqueta portada |
| V03-09 | security-admin | `/terminologia/designaciones-formulario` | `TerminologiaDesignacionesFormulario` | — | maqueta portada |
| V03-09 | security-admin | `/terminologia/designaciones-listado` | `TerminologiaDesignacionesListado` | — | maqueta portada |
| V03-10 | security-admin | `/terminologia/propiedades-formulario` | `TerminologiaPropiedadesFormulario` | — | maqueta portada |
| V03-10 | security-admin | `/terminologia/propiedades-listado` | `TerminologiaPropiedadesListado` | — | maqueta portada |
| V03-11 | security-admin | `/terminologia/relaciones-formulario` | `TerminologiaRelacionesFormulario` | — | maqueta portada |
| V03-11 | security-admin | `/terminologia/relaciones-listado` | `TerminologiaRelacionesListado` | — | maqueta portada |
| V03-12 | security-admin | `/terminologia/politicas-de-catalogo-formulario` | `TerminologiaPoliticasDeCatalogoFormulario` | — | maqueta portada |
| V03-12 | security-admin | `/terminologia/politicas-de-catalogo-listado` | `TerminologiaPoliticasDeCatalogoListado` | — | maqueta portada |
| V03-13 | security-admin | `/terminologia/conjuntos-de-valor-formulario` | `TerminologiaConjuntosDeValorFormulario` | — | maqueta portada |
| V03-13 | security-admin | `/terminologia/conjuntos-de-valor-listado` | `TerminologiaConjuntosDeValorListado` | — | maqueta portada |
| V03-02 | sesion-autenticada | `/terminologia/consulta-de-concepto-listado` | `TerminologiaConsultaDeConceptoListado` | — | maqueta portada |
| V03-03 | sesion-autenticada | `/terminologia/traduccion-entre-catalogos-formulario` | `TerminologiaTraduccionEntreCatalogosFormulario` | — | maqueta portada |
| V03-07 | sesion-autenticada | `/terminologia/conceptos-listado` | `TerminologiaConceptosListado` | — | maqueta portada |
| V03-14 | sesion-autenticada | `/terminologia/expansion-de-conjunto-de-valores-detalle` | `TerminologiaExpansionDeConjuntoDeValoresDetalle` | — | maqueta portada |
| V04-01 | security-admin | `/directorio/organizaciones-listado` | `DirectorioOrganizacionesListado` | — | maqueta portada |
| V04-01 | security-admin | `/directorio/organizaciones-verificar` | `DirectorioOrganizacionesVerificar` | — | maqueta portada |
| V04-02 | security-admin | `/directorio/membresias-dar-de-baja` | `DirectorioMembresiasDarDeBaja` | — | maqueta portada |
| V04-02 | security-admin | `/directorio/membresias-formulario` | `DirectorioMembresiasFormulario` | — | maqueta portada |
| V04-02 | security-admin | `/directorio/membresias-listado` | `DirectorioMembresiasListado` | — | maqueta portada |
| V04-03 | security-admin | `/directorio/asignaciones-de-sucursal-formulario` | `DirectorioAsignacionesDeSucursalFormulario` | — | maqueta portada |
| V04-04 | security-admin | `/directorio/roles-formulario` | `DirectorioRolesFormulario` | — | maqueta portada |
| V04-05 | security-admin | `/directorio/transferencias-formulario` | `DirectorioTransferenciasFormulario` | — | maqueta portada |
| V04-06 | security-admin | `/directorio/sucursales-formulario` | `DirectorioSucursalesFormulario` | — | maqueta portada |
| V04-06 | security-admin | `/directorio/sucursales-listado` | `DirectorioSucursalesListado` | — | maqueta portada |
| V04-07 | security-admin | `/directorio/organizaciones-hijas-formulario` | `DirectorioOrganizacionesHijasFormulario` | — | maqueta portada |
| V04-01 | superadmin | `/directorio/organizaciones-formulario` | `DirectorioOrganizacionesFormulario` | — | maqueta portada |
| V04-01 | superadmin | `/directorio/organizaciones-suspender` | `DirectorioOrganizacionesSuspender` | — | maqueta portada |
| V05-01 | security-admin | `/personas/pacientes-formulario` | `PersonasPacientesFormulario` | — | maqueta portada |
| V05-01 | security-admin | `/personas/pacientes-fusionar` | `PersonasPacientesFusionar` | — | maqueta portada |
| V05-01 | security-admin | `/personas/pacientes-listado` | `PersonasPacientesListado` | — | maqueta portada |
| V05-01 | security-admin | `/personas/pacientes-revertir` | `PersonasPacientesRevertir` | — | maqueta portada |
| V05-02 | security-admin | `/personas/vinculos-de-identidad-formulario` | `PersonasVinculosDeIdentidadFormulario` | — | maqueta portada |
| V05-02 | security-admin | `/personas/vinculos-de-identidad-listado` | `PersonasVinculosDeIdentidadListado` | — | maqueta portada |
| V05-04 | security-admin | `/personas/apoderados-de-portal-formulario` | `PersonasApoderadosDePortalFormulario` | — | maqueta portada |
| V05-04 | security-admin | `/personas/apoderados-de-portal-listado` | `PersonasApoderadosDePortalListado` | — | maqueta portada |
| V05-05 | security-admin | `/personas/personas-relacionadas-formulario` | `PersonasRelacionadasFormulario` | — | maqueta portada |
| V05-05 | security-admin | `/personas/personas-relacionadas-listado` | `PersonasRelacionadasListado` | — | maqueta portada |
| V05-06 | security-admin | `/personas/credenciales-listado` | `PersonasCredencialesListado` | — | maqueta portada |
| V05-06 | security-admin | `/personas/credenciales-verificar` | `PersonasCredencialesVerificar` | — | maqueta portada |
| V05-07 | security-admin | `/personas/personas-listado` | `PersonasListado` | — | maqueta portada |
| V05-07 | security-admin | `/personas/personas-registrar-defuncion` | `PersonasRegistrarDefuncion` | — | maqueta portada |
| V05-08 | security-admin | `/personas/vinculos-de-cuenta-formulario` | `PersonasVinculosDeCuentaFormulario` | — | maqueta portada |
| V05-08 | security-admin | `/personas/vinculos-de-cuenta-listado` | `PersonasVinculosDeCuentaListado` | — | maqueta portada |
| V05-09 | security-admin | `/personas/profesionales-formulario` | `PersonasProfesionalesFormulario` | — | maqueta portada |
| V05-09 | security-admin | `/personas/profesionales-listado` | `PersonasProfesionalesListado` | — | maqueta portada |
| V05-10 | security-admin | `/personas/autorizaciones-de-jurisdiccion-formulario` | `PersonasAutorizacionesDeJurisdiccionFormulario` | — | maqueta portada |
| V05-10 | security-admin | `/personas/autorizaciones-de-jurisdiccion-listado` | `PersonasAutorizacionesDeJurisdiccionListado` | — | maqueta portada |
| V05-11 | security-admin | `/personas/especialidades-formulario` | `PersonasEspecialidadesFormulario` | — | maqueta portada |
| V05-11 | security-admin | `/personas/especialidades-listado` | `PersonasEspecialidadesListado` | — | maqueta portada |
| V05-03 | sesion-autenticada | `/personas/resumen-propio-listado` | `PersonasResumenPropioListado` | — | maqueta portada |
| V06-05 | clinical-approver | `/accesos/acceso-de-emergencia-formulario` | `AccesosAccesoDeEmergenciaFormulario` | — | maqueta portada |
| V06-06 | clinical-approver | `/accesos/accesos-clinicos-del-paciente-formulario` | `AccesosClinicosDelPacienteFormulario` | — | maqueta portada |
| V06-06 | clinical-approver | `/accesos/accesos-clinicos-del-paciente-listado` | `AccesosClinicosDelPacienteListado` | — | maqueta portada |
| V06-01 | clinician | `/accesos/relaciones-de-cuidado-formulario` | `AccesosRelacionesDeCuidadoFormulario` | — | maqueta portada |
| V06-01 | clinician | `/accesos/relaciones-de-cuidado-listado` | `AccesosRelacionesDeCuidadoListado` | — | maqueta portada |
| V06-01 | clinician | `/accesos/relaciones-de-cuidado-revocar` | `AccesosRelacionesDeCuidadoRevocar` | — | maqueta portada |
| V06-02 | security-admin | `/accesos/representaciones-legales-formulario` | `AccesosRepresentacionesLegalesFormulario` | — | maqueta portada |
| V06-02 | security-admin | `/accesos/representaciones-legales-listado` | `AccesosRepresentacionesLegalesListado` | — | maqueta portada |
| V06-02 | security-admin | `/accesos/representaciones-legales-revocar` | `AccesosRepresentacionesLegalesRevocar` | — | maqueta portada |
| V06-03 | security-admin | `/accesos/accesos-clinicos-listado` | `AccesosClinicosListado` | — | maqueta portada |
| V06-03 | security-admin | `/accesos/accesos-clinicos-revocar` | `AccesosClinicosRevocar` | — | maqueta portada |
| V06-04 | security-admin | `/accesos/decisiones-evaluar` | `AccesosDecisionesEvaluar` | — | maqueta portada |
| V06-07 | security-admin | `/accesos/cache-invalidar` | `AccesosCacheInvalidar` | — | maqueta portada |
| V06-08 | security-admin | `/accesos/categorias-de-permiso-formulario` | `AccesosCategoriasDePermisoFormulario` | — | maqueta portada |
| V06-08 | security-admin | `/accesos/categorias-de-permiso-listado` | `AccesosCategoriasDePermisoListado` | — | maqueta portada |
| V06-09 | security-admin | `/accesos/permisos-formulario` | `AccesosPermisosFormulario` | — | maqueta portada |
| V06-09 | security-admin | `/accesos/permisos-listado` | `AccesosPermisosListado` | — | maqueta portada |
| V06-10 | security-admin | `/accesos/alcance-de-recurso-formulario` | `AccesosAlcanceDeRecursoFormulario` | — | maqueta portada |
| V06-10 | security-admin | `/accesos/alcance-de-recurso-listado` | `AccesosAlcanceDeRecursoListado` | — | maqueta portada |
| V06-11 | security-admin | `/accesos/roles-formulario` | `AccesosRolesFormulario` | — | maqueta portada |
| V06-11 | security-admin | `/accesos/roles-listado` | `AccesosRolesListado` | — | maqueta portada |
| V06-12 | security-admin | `/accesos/permisos-de-campo-formulario` | `AccesosPermisosDeCampoFormulario` | — | maqueta portada |
| V06-12 | security-admin | `/accesos/permisos-de-campo-listado` | `AccesosPermisosDeCampoListado` | — | maqueta portada |
| V06-13 | security-admin | `/accesos/permisos-del-rol-formulario` | `AccesosPermisosDelRolFormulario` | — | maqueta portada |
| V06-13 | security-admin | `/accesos/permisos-del-rol-listado` | `AccesosPermisosDelRolListado` | — | maqueta portada |
| V06-14 | security-admin | `/accesos/politicas-de-acceso-formulario` | `AccesosPoliticasDeAccesoFormulario` | — | maqueta portada |
| V06-14 | security-admin | `/accesos/politicas-de-acceso-listado` | `AccesosPoliticasDeAccesoListado` | — | maqueta portada |
| V06-15 | security-admin | `/accesos/concesiones-de-permiso-formulario` | `AccesosConcesionesDePermisoFormulario` | — | maqueta portada |
| V06-15 | security-admin | `/accesos/concesiones-de-permiso-listado` | `AccesosConcesionesDePermisoListado` | — | maqueta portada |
| V06-16 | security-admin | `/accesos/asignaciones-de-rol-formulario` | `AccesosAsignacionesDeRolFormulario` | — | maqueta portada |
| V06-16 | security-admin | `/accesos/asignaciones-de-rol-listado` | `AccesosAsignacionesDeRolListado` | — | maqueta portada |
| V65-01 | publico | `/buscar/buscador-listado` | `BuscarBuscadorListado` | — | maqueta portada |
| V65-02 | publico | `/buscar/profesionales-listado` | `BuscarProfesionalesListado` | — | maqueta portada |
| V65-03 | publico | `/buscar/medicamentos-listado` | `BuscarMedicamentosListado` | — | maqueta portada |
| V65-04 | publico | `/buscar/hospitales-listado` | `BuscarHospitalesListado` | — | maqueta portada |
| V65-05 | publico | `/buscar/laboratorios-listado` | `BuscarLaboratoriosListado` | — | maqueta portada |
| V65-06 | publico | `/buscar/aseguradoras-listado` | `BuscarAseguradorasListado` | — | maqueta portada |
| V65-07 | publico | `/buscar/perfil-profesional-detalle` | `BuscarPerfilProfesionalDetalle` | — | maqueta portada |
| V65-08 | publico | `/buscar/perfil-organizacion-detalle` | `BuscarPerfilOrganizacionDetalle` | — | maqueta portada |
| V65-09 | publico | `/buscar/perfil-farmacia-detalle` | `BuscarPerfilFarmaciaDetalle` | — | maqueta portada |
| V65-10 | publico | `/buscar/perfil-laboratorio-detalle` | `BuscarPerfilLaboratorioDetalle` | — | maqueta portada |
| V65-11 | publico | `/buscar/perfil-aseguradora-detalle` | `BuscarPerfilAseguradoraDetalle` | — | maqueta portada |
| V65-12 | publico | `/buscar/cercania-detalle` | `BuscarCercaniaDetalle` | — | maqueta portada |
| V65-13 | sesion-autenticada | `/buscar/seguidos-y-guardados-listado` | `BuscarSeguidosYGuardadosListado` | — | maqueta portada |
| V65-14 | sesion-autenticada | `/buscar/calificar-la-atencion-formulario` | `BuscarCalificarLaAtencionFormulario` | — | maqueta portada |
| null | — | `/inicio` | `InicioPortada` | — | maqueta portada |

## Recuento

| Estado | Pantallas |
|---|---|
| maqueta portada | 126 |
| conectada | 45 |
| presentacional | 6 |
| conectada con deuda | 3 |
| placeholder | 1 |
