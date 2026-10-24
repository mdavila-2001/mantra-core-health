# Auditoría de cobertura funcional — front `mockup` × API `dev`

- **Fecha:** 2026-09-24 · **Modo:** solo lectura (no se ejecutó nada contra la API ni el front).
- **Front:** `mantra-core-health/` rama `mockup`, HEAD `9b3e0101` (2026-09-24 14:57, PR #621).
- **API:** `mantra-core-health-redesa-api/` rama `dev`, HEAD `7541797c` (2026-09-23, PR #452).
- **Insumos:** `brecha/api-routes.json` (1 362 rutas), `brecha/api-unused.json` (868 rutas sin handler en el mock), `brecha/client-calls.json` (490 llamadas únicas de los clientes, 21 sin ruta API), `brecha/mock-missing.json` (34 handlers del mock sin ruta API).
- **Scripts de esta auditoría (scratchpad):** `screens.js` → `screens.json` (pantalla → endpoints), `uc.js` + `uc2.js` → `ucs2.json` (caso de uso → rutas API → ¿las usa el front?), `table.js` → `tabla-pantallas.md`.
- **Excluido de lo pendiente, por pedido:** pasarela de pago (`payments`, `scheduling/bookings/:id/payment-state`, el pago del checkout de farmacia) y delivery (`tracking`, viajes/geocercas de `geo`).

## Cómo leer las cifras (límites del método)

1. **«Endpoints detectados» es análisis estático aproximado.** Para cada componente de ruta se recorre su cierre de imports (sin entrar en `shared/`), se toman los métodos de cliente invocados y se resuelven a la ruta HTTP que llama cada método. Falla en tres casos: (a) clientes que arman la URL en una variable (`PublicDirectoryClient`: por eso `/search/*` sale con 0); (b) colisiones de nombre de método entre clientes (algunos endpoints ajenos pueden colarse, p. ej. el `/{p,o,f,l,s}/:slug` público lista `GET /clinical/patients/:id/summary`, casi seguro un falso positivo); (c) los endpoints de sesión (`/iam/auth/login|logout|refresh|activate|register-patient`) se filtraron porque el `AuthService` entra en el cierre de casi todas las pantallas.
2. **«API sin pantalla»** = `api-unused.json` (rutas sin handler en el mock de `mockup`). Coincide casi exacto con «ninguna llamada del cliente la usa» (900 rutas); diferencias: 4 rutas que el cliente llama pero el mock no atiende (`GET /loyalty/me`, `GET /loyalty/me/points`, `POST /loyalty/me/points/redeem`, `POST /scheduling/appointments/walk-in`) y 36 que el mock atiende pero la detección de cliente no vio por URL dinámica.
3. **«Caso de uso con pantalla»** = el UC-ID aparece citado en el JSDoc/`@ApiOperation` de un handler de la API cuya ruta usa el front, **o** el UC-ID se cita en el código del front. 717 de los 760 UC tienen al menos una ruta API atribuida. Es una aproximación: un UC puede estar «cubierto» por una pantalla que sólo ejerce una parte.
4. **Nada de esto es verificación en runtime.** Lo que dice «funciona» o «roto» sin evidencia de ejecución queda marcado **sin confirmar**.

---

## Resumen ejecutivo

- **~205 rutas con pantalla en el árbol real**: 67 secciones del registro `APP_SECTIONS` (1 redirige: `my-account/loyalty`) + 46 pantallas hijas + 61 pantallas de operación + ~30 públicas/auth, más **126 maquetas estáticas** portadas de la bóveda (`features/alovida/`, sin guard ni datos).
- **Una sola sección es placeholder:** `/billing` (Facturación, `availability: 'planificada'`). Pero hay **pantallas que no leen nada de la API**: 5 hubs de administración (acceso delegado, proveedores de identidad, verificación de identidad, contexto sanitario, geolocalización) son menús de formularios de escritura sin ningún listado; y la vertical de farmacia del lado comercio (promociones, ficha legal, factura del pedido) funciona con **fixtures locales**.
- **La rama `mockup` corre siempre contra el mock** (`src/environments/environment.ts:65` `mockBackend: true`, sin override por entorno, también en producción). Toda la demo publicada sobre esta rama ejerce el backend simulado, no la API.
- **868 de 1 362 rutas de la API (64 %) no tienen pantalla.** Clasificadas por módulo: ~390 son producto de la demo/lanzamiento (categoría 1; incluye 23 de perioperatorio, fase 3 de la bóveda, y ~60 de administración secundaria), ~326 infraestructura interna (cat. 2), ~126 producto futuro (cat. 3) y 26 excluidas por pedido (cat. 4: `payments` 14, `tracking` 11, `payment-state` 1).
- **154 casos de uso de actores principales (paciente, médico, organización) no tienen pantalla**; los más graves: todo M07 Consent (8 UC del paciente), el ciclo de firma/enmienda/liberación de notas (M15), referencias y teleconsulta (M18), recepción de muestras y liberación de resultados del laboratorio (M20), hospitales (M22), cobertura/elegibilidad/EOB (M26).
- **Propósito central («el paciente dueño de su historia: ver/descargar/actualizar + labs y hospitales»): NO está completo de punta a punta contra la API real.** Ver: sí (lectura del resumen; la corrección de D-3 está en el código, sin confirmar en runtime). Descargar: sólo un PDF armado en el navegador + la receta oficial; no hay exportación oficial de la historia. Actualizar por el paciente: la pantalla llama `GET/PUT /clinical/me/medical-aspects`, **ruta que la API no tiene**. Labs: no existe pantalla para que el laboratorio registre/libere un informe (única fuente de lo que ve «Mis resultados»). Hospitales: sin consola ni alta.

---

## TAREA A — Mapa de pantallas por actor

Leyenda de «Rol/guard»: `[*]` = `ANY_ROLE` (cualquier sesión); `+tenant` = exige membresía en una organización; «(hija)» = no es entrada de menú, se llega desde su sección y hereda su guard salvo excepción comentada en `app.routes.ts`. ⚠ = la ruta llamada no existe en la API (`dev`). Todas las rutas del armazón pasan por `authGuard` (`app.routes.ts:1481-1483`).

### Resumen por actor

| Actor | Pantallas | Placeholder | Sólo mockup / fixtures | Llaman rutas inexistentes en la API | Observación |
|---|---|---|---|---|---|
| Paciente | 33 | 0 | 7 (pedidos de farmacia, promociones, dónde comprar) | 2 (`my-account/questionnaires`, `pharmacies-directory/:slug`) | Historia, resultados, órdenes, citas, identidad, dependientes: con lectura real. «Mis puntos» redirige a `/my-account` (`app.routes.ts:1071-1073`). |
| Médico / profesional | 36 | 0 | 0 | 5 (`form-builder`, `questionnaires/:surveyId`, `medical-records/:profileId`, `.../consultation`, `my-account/edit`) | El núcleo clínico (agenda, expediente, consulta, contabilidad, cotizaciones) es el más cubierto. |
| Administrador de organización (incl. aseguradora) | 52 | 0 | 0 | 1 (`identity-assurance/cases/checks`, probable falso positivo por escape `\:`) | 3 hubs sin lectura; 35 formularios de escritura sueltos (acceso delegado, verificación de identidad). |
| Superadmin / plataforma | 48 | 0 | 0 | 0 | 3 hubs sin lectura (proveedores de identidad, contexto sanitario, geolocalización). |
| Visitador / laboratorio farmacéutico | 2 (+`lab-visits` del médico) | 0 | 0 | 0 | 54/76 endpoints de `pharma_lab` sin pantalla. |
| Farmacia (comercio) | 4 | 0 | 3 (bandeja parcial, promociones, ficha) | 0 | Menú visible a cualquier miembro de organización (sin filtro por tipo). |
| Laboratorio / imagenología | 1 (+2 altas públicas) | 0 | 0 | 0 | Las dos altas públicas **no tienen endpoint** (`app.routes.ts:1974-2006`); no hay pantalla para informes/muestras. |
| Público sin sesión | 29 + 126 maquetas | 0 | 2 (`/promotions/:campaignId`, `/design-system/stock`) | 1 (`/search/symptoms` → `POST /v1/triage/analyze`) | Buscador y fichas públicas por slug con datos reales. |
| Transversal (con sesión) | 8 | 1 (`/billing`) | 0 | chat (`GET /community/conversations/:id`) | Panel, chat, notificaciones, ajustes, tutoriales. |

### Tabla completa (generada por `table.js`; endpoints aproximados, ver «límites del método»)


#### PACIENTE (33)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/directories` | directories-overview | [*] | General › Directorios | 2 | GET /diagnostic-units/:id; GET /terminology/value-sets |  |
| `/directory` | practitioners-directory | [PATIENT] | General › Directorio de médicos | 3 | GET /profiles/practitioners; GET /profiles/practitioners/specialty-counts; GET /terminology/concepts |  |
| `/nearby-places` | nearby-places | [PATIENT] | General › Lugares cercanos | 3 | GET /clinical/patients/:patientProfileId/summary; GET /profiles/patients/me; GET /terminology/concepts |  |
| `/laboratory-directory` | laboratory-directory | [*] | General › Directorio de laboratorios | 2 | GET /diagnostic-units/:id; GET /terminology/value-sets |  |
| `/clinics-directory` | clinics-directory | [*] | General › Directorio de clínicas | 1 | GET /terminology/value-sets |  |
| `/pharmacies-directory` | pharmacies-directory | [*] | General › Directorio de farmacias | 1 | GET /terminology/value-sets |  |
| `/my-account` | my-profile | [*] | Mi cuenta › Mi perfil | 31 | DELETE /practitioners/me/sites/:siteId; DELETE /profiles/practitioners/me/affiliations/:affiliationId; DELETE /profiles/practitioners/me/credentials/:credentialId; GET /community/comments/media/:fileId/content; GET /community/profiles/me; GET /identity/me/verification-cases; GET /insurance/portability/certificates/:certificateId/json; GET /insurance/portability/certificates/:certificateId/pdf; GET /loyalty/me; GET /loyalty/me/points; … (+21) |  |
| `/my-account/dependents` | dependents | [*] (oculto a PRACTITIONER) | Mi cuenta › Dependientes | 4 | GET /profiles/patients/me/dependents; GET /system-context/dynamic-enums; GET /terminology/value-sets; POST /profiles/patients/me/dependents |  |
| `/my-account/appointments` | appointments | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis citas | 8 | GET /profiles/patients/me/dependents; GET /scheduling/bookings; GET /scheduling/resources; GET /scheduling/slots; GET /scheduling/waitlist; GET /terminology/concepts; POST /scheduling/bookings/:id/cancel; POST /scheduling/waitlist |  |
| `/my-account/medical-record` | medical-record | [*] (oculto a PRACTITIONER) | Mi cuenta › Mi historia clínica | 8 | GET /clinical/patients/:patientProfileId/summary; GET /clinical/prescriptions/:id/pdf; GET /diagnostic-results/me; GET /diagnostic-results/me/orders; GET /forms/me/instances; GET /forms/me/instances/:id; GET /profiles/patients/me/dependents; GET /terminology/concepts |  |
| `/my-account/diagnostic-results` | diagnostic-results | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis resultados | 6 | GET /diagnostic-results/me; GET /diagnostic-results/me/:reportId/shares; GET /terminology/concepts; POST /common/files/:id/download-url; POST /diagnostic-results/me/:reportId/shares; POST /diagnostic-results/me/:reportId/shares/:shareId/revoke |  |
| `/my-account/diagnostic-orders` | diagnostic-orders | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis órdenes | 2 | GET /diagnostic-results/me/orders; GET /terminology/concepts |  |
| `/my-account/cotizaciones` | cotizaciones | [*] (oculto a PRACTITIONER) | Mi cuenta › Cotizaciones | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/my-account/pharmacy-orders` | pharmacy-orders | [PATIENT] | Mi cuenta › Mis pedidos | 1 | GET /pharmacy/orders/me |  |
| `/my-account/promotions` | promotions | [PATIENT] | Mi cuenta › Promociones | 0 | — | usa fixtures locales |
| `/my-account/identity` | identity-hub | [*] | Mi cuenta › Mi identidad | 9 | GET /common/files/:id/content; GET /identity/me/verification-cases; GET /identity/me/verification-cases/:caseId; GET /terminology/concepts; POST /common/files/upload; POST /identity/me/identity-verification; POST /identity/me/practitioner/identity-verification; POST /identity/me/practitioner/license-verification; POST /identity/me/tenants/:tenantId/verification |  |
| `/my-account/identity/cases` | verification-cases | [*] | Mi cuenta › Mi identidad (hija) | 3 | GET /common/files/:id/content; GET /identity/me/verification-cases; GET /terminology/concepts |  |
| `/my-account/questionnaires` | questionnaires | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis cuestionarios | 3 | GET /clinical/me/medical-aspects ⚠; GET /surveys/me/invitations; PUT /clinical/me/medical-aspects ⚠ | llama rutas que la API no tiene |
| `/my-account/questionnaires/:invitationId` | answer | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis cuestionarios (hija) | 2 | GET /surveys/me/invitations/:id; POST /surveys/me/invitations/:id/responses |  |
| `/my-account/medical-record/where-to-buy/:requestId` | where-to-buy | [*] (oculto a PRACTITIONER) | Mi cuenta › Mi historia clínica (hija) | 5 | GET /clinical/patients/:patientProfileId/summary; GET /pharmacy-inventory/availability; GET /pharmacy/products; GET /profiles/patients/me; GET /terminology/concepts | usa fixtures locales |
| `/my-account/pharmacy-orders/new` | new-order | [PATIENT] | Mi cuenta › Mis pedidos (hija) | 1 | POST /pharmacy/orders | usa fixtures locales |
| `/my-account/pharmacy-orders/checkout` | checkout | [PATIENT] | Mi cuenta › Mis pedidos (hija) | 1 | POST /pharmacy/orders | usa fixtures locales |
| `/my-account/pharmacy-orders/:orderId` | order-detail | [PATIENT] | Mi cuenta › Mis pedidos (hija) | 2 | GET /notifications/me; POST /pharmacy/orders | usa fixtures locales |
| `/my-account/pharmacy-orders/:orderId/receipt` | order-receipt | [PATIENT] | Mi cuenta › Mis pedidos (hija) | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/my-account/pharmacy-orders/:orderId/invoice` | order-invoice | [PATIENT] | Mi cuenta › Mis pedidos (hija) | 0 | — | usa fixtures locales |
| `/my-account/access-requests` | access-requests | [*] | Mi cuenta › Mi perfil (hija) | 4 | GET /authz/care-relationships/requests/mine; GET /profiles/practitioners/me/summary; GET /terminology/value-sets; POST /authz/care-relationships/:id/respond |  |
| `/my-account/identity/cases/:caseId` | verification-case-detail | [*] | Mi cuenta › Mi identidad (hija) | 2 | GET /identity/me/verification-cases/:caseId; GET /terminology/concepts |  |
| `/directory/:profileId` | practitioner-detail | [PATIENT] | General › Directorio de médicos (hija) | 20 | DELETE /practitioners/me/sites/:siteId; DELETE /profiles/practitioners/me/affiliations/:affiliationId; DELETE /profiles/practitioners/me/credentials/:credentialId; GET /community/profiles/me; GET /practitioners/:profileId/sites; GET /profiles/practitioners/me/affiliations; GET /profiles/practitioners/me/linkable-organizations; GET /profiles/practitioners/me/summary; GET /scheduling/resources; GET /scheduling/slots; … (+10) |  |
| `/laboratory-directory/:unitId` | laboratory-detail | [*] | General › Directorio de laboratorios (hija) | 2 | GET /diagnostic-units/:id; GET /terminology/value-sets |  |
| `/clinics-directory/:slug` | clinic-detail | [*] | General › Directorio de clínicas (hija) | 1 | GET /public/profiles/:prefijo/:slug |  |
| `/pharmacies-directory/:slug` | pharmacy-detail | [*] | General › Directorio de farmacias (hija) | 2 | GET /public/profiles/:prefijo/:slug; GET /public/profiles/f/:slug/branch-availability ⚠ | llama rutas que la API no tiene |
| `/my-account/profile/edit` | patient-profile-edit | [*] | Mi cuenta › Mi perfil (hija) | 3 | GET /profiles/patients/me; GET /terminology/value-sets; PATCH /profiles/patients/me |  |
| `/my-account/appointments/book/:slotId` | booking-new | [*] (oculto a PRACTITIONER) | Mi cuenta › Mis citas (hija) | 7 | GET /profiles/patients; GET /profiles/patients/me/dependents; GET /scheduling/resources; GET /scheduling/slots; POST /scheduling/holds/:holdToken/confirm; POST /scheduling/holds/:holdToken/request; POST /scheduling/slots/:id/holds |  |

#### MEDICO (36)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/feed` | feed | authGuard (hija; ver comentario en app.routes) | — | 11 | DELETE /community/bookmarks; GET /community/comments/media/:fileId/content; GET /community/feed; GET /community/groups; GET /community/posts/:postId/comments; GET /community/profiles/me; POST /community/bookmarks; POST /community/comments; POST /community/profiles/:profileId/posts; POST /community/reports; … (+1) |  |
| `/groups` | groups | [ejercen/administran] | General › Grupos y foros | 6 | GET /community/groups; GET /community/profiles/me; GET /community/topics; POST /common/files/upload; POST /community/groups; PUT /community/profiles/me |  |
| `/progress-notes` | progress-notes | [CLINICIAN, PRACTITIONER] | Atención › Evoluciones | 4 | GET /charts/patients/:patientProfileId/chart; GET /scheduling/bookings; GET /scheduling/resources; GET /terminology/concepts |  |
| `/schedule` | agenda | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas | 27 | DELETE /scheduling/exceptions/:id; DELETE /scheduling/templates/:id; GET /pharma-labs/reference/concepts; GET /profiles/patients; GET /scheduling/activity-types; GET /scheduling/bookings; GET /scheduling/exception-types; GET /scheduling/resources; GET /scheduling/resources/:id/exceptions; GET /scheduling/resources/:id/templates; … (+17) |  |
| `/diagnostics` | diagnostics | [CLINICIAN, PRACTITIONER] | Atención › Laboratorio e imagen | 2 | GET /diagnostics/work-orders; GET /terminology/concepts |  |
| `/interventions` | interventions | [SURGEON, ANESTHESIOLOGIST, PERIOP_NURSE, SURGERY_SCHEDULER, PERIOP_ADMIN] | Atención › Intervenciones | 5 | GET /procedure-cases; GET /procedure-cases/:id/team-members; GET /terminology/concepts; POST /procedure-cases/:id/team-members/:memberId/accept; POST /procedure-cases/:id/team-members/:memberId/respond |  |
| `/medical-records` | clinical-record | [CLINICIAN, PRACTITIONER] | Atención › Archivo clínico | 2 | GET /profiles/patients; GET /terminology/value-sets |  |
| `/administration/medical-organization` | medical-organization | [SECURITY_ADMIN, PERIOP_ADMIN, PRACTITIONER] | Administración › Organización médica | 4 | GET /practices; GET /practices/:practiceId/organization; GET /practitioners/me/role-assignments; POST /practices/:practiceId/role-assignments/self-request |  |
| `/administration/accounting` | resumen | [SECURITY_ADMIN, ACCOUNTING_APPROVER, PRACTITIONER] | Facturación › Contabilidad | 6 | GET /accounting/assets; GET /accounting/balance-sheet; GET /accounting/income-statement; GET /accounting/open-items; GET /practices; POST /accounting/clearing-documents |  |
| `/my-organizations` | my-organizations | authGuard (hija; ver comentario en app.routes) | — | 3 | GET /practices; GET /practitioners/me/role-assignments; POST /practices/:practiceId/role-assignments/self-request |  |
| `/administration/my-practice` | my-practice | [PRACTITIONER] | Administración › Mis organizaciones | 12 | DELETE /practitioners/me/sites/:siteId; DELETE /profiles/practitioners/me/affiliations/:affiliationId; GET /practitioners/:profileId/sites; GET /profiles/practitioners/me/affiliations; GET /profiles/practitioners/me/linkable-organizations; GET /terminology/value-sets; PATCH /practitioners/me/sites/:siteId; PATCH /profiles/practitioners/me/affiliations/:affiliationId; POST /common/files/upload; POST /practitioners/me/sites; … (+2) |  |
| `/my-services` | my-services | [CLINICIAN,PRACTITIONER] | Atención › Mis servicios | 7 | GET /billing/service-catalog; GET /practices; GET /scheduling/resources; GET /scheduling/resources/:id/exceptions; GET /scheduling/resources/:id/templates; PATCH /billing/service-catalog/:id; POST /scheduling/resources/:id/exceptions |  |
| `/my-quotations` | quotation-list | [CLINICIAN,PRACTITIONER] | Atención › Cotizaciones | 2 | GET /profiles/patients; GET /quotations |  |
| `/questionnaires` | questionnaires | [PRACTITIONER, CLINICIAN] | Atención › Encuestas | 2 | GET /surveys/templates; POST /surveys/templates |  |
| `/glossary` | glossary | [ejercen/administran] | Atención › Glosario | 2 | GET /terminology/concepts; GET /terminology/value-sets |  |
| `/form-builder` | form-builder | [CLINICIAN,PRACTITIONER] | Atención › Formularios | 10 | DELETE /forms/assignments/:assignmentId ⚠; GET /charts/templates; GET /charts/templates/:id; GET /forms/assignments/budget; GET /terminology/concepts; PATCH /forms/assignments/:assignmentId ⚠; PATCH /forms/field-definitions/:fieldId ⚠; POST /forms/assignments; POST /forms/field-definitions; PUT /forms/assignments/order ⚠ | llama rutas que la API no tiene |
| `/lab-visits` | doctor-visits | [PRACTITIONER, CLINICIAN] | Atención › Visitas de laboratorio | 8 | GET /pharma-labs/reference/concepts; GET /visit-agenda/me; GET /visit-records/inbox; GET /visit-requests/inbox; GET /visit-requests/mine; POST /visit-requests/:visitRequestId/accept; POST /visit-requests/:visitRequestId/cancel; POST /visit-requests/:visitRequestId/reject |  |
| `/administration/accounting/cockpit` | cockpit | [SECURITY_ADMIN, ACCOUNTING_APPROVER, PRACTITIONER] | Facturación › Contabilidad (hija) | 16 | GET /accounting/accrual-objects; GET /accounting/assets; GET /accounting/balance-sheet; GET /accounting/dimensions; GET /accounting/fiscal-years; GET /accounting/income-statement; GET /accounting/journal-transactions; GET /accounting/journal-transactions/:id/document-flow; GET /accounting/open-items; GET /accounting/trial-balance; … (+6) |  |
| `/administration/accounting/assets-liabilities` | assets-liabilities | [SECURITY_ADMIN, ACCOUNTING_APPROVER, PRACTITIONER] | Facturación › Contabilidad (hija) | 10 | GET /accounting/accounts; GET /accounting/practitioner/assets; GET /accounting/practitioner/liabilities; GET /practices; PATCH /accounting/practitioner/assets/:id/automation; PATCH /accounting/practitioner/liabilities/:id/automation; POST /accounting/practitioner/assets; POST /accounting/practitioner/assets/:id/progress; POST /accounting/practitioner/liabilities; POST /accounting/practitioner/liabilities/:id/progress |  |
| `/administration/accounting/libros` | accounting | [SECURITY_ADMIN, ACCOUNTING_APPROVER, PRACTITIONER] | Facturación › Contabilidad (hija) | 12 | GET /accounting/accounts; GET /accounting/balance-sheet; GET /accounting/general-ledger; GET /accounting/income-statement; GET /accounting/journal-transactions; GET /accounting/practitioner/paid-consultations; GET /accounting/trial-balance; GET /practices; POST /accounting/journal-transactions; POST /accounting/journal-transactions/drafts; … (+2) |  |
| `/groups/:groupId` | group-detail | [ejercen/administran] | General › Grupos y foros (hija) | 8 | DELETE /community/groups/:groupId/members/:member; GET /community/groups/:groupId; GET /community/groups/:groupId/members; GET /community/groups/:groupId/posts; GET /community/profiles/me; PATCH /community/groups/:groupId/members/:member; POST /community/groups/:groupId/members; POST /community/groups/:groupId/posts |  |
| `/questionnaires/:surveyId` | survey-detail | [PRACTITIONER, CLINICIAN] | Atención › Encuestas (hija) | 10 | DELETE /surveys/templates/:surveyId/questions/:questionId ⚠; GET /surveys/templates/:id; GET /surveys/templates/:id/responses; PATCH /surveys/templates/:surveyId/questions/:questionId ⚠; POST /surveys/assignments; POST /surveys/templates/:id/deactivate; POST /surveys/templates/:id/questions; POST /surveys/templates/:id/versions; POST /surveys/templates/:id/versions/:versionNumber/publish; PUT /surveys/templates/:surveyId/questions/order ⚠ | llama rutas que la API no tiene |
| `/medical-records/:profileId` | patient-chart | [CLINICIAN, PRACTITIONER] | Atención › Archivo clínico (hija) | 24 | GET /charts/patients/:patientProfileId/chart; GET /clinical/patients/:patientProfileId/summary; GET /profiles/patients/me; GET /profiles/practitioners/me/summary; GET /system-context/dynamic-enums; GET /terminology/concepts; GET /terminology/concepts/:conceptId; POST /cds/check-interactions; POST /charts/care-plans; POST /charts/documents; … (+14) | llama rutas que la API no tiene |
| `/medical-records/:profileId/consultation` | consultation | [CLINICIAN, PRACTITIONER] | Atención › Archivo clínico (hija) | 45 | GET /accounting/practitioner/paid-consultations; GET /charts/patients/:patientProfileId/chart; GET /charts/templates; GET /clinical/patients/:patientProfileId/summary; GET /dental-procedures; GET /dental-procedures/catalog; GET /diagnostics/patients/:patientProfileId/orders; GET /forms/instances; GET /forms/instances/:id; GET /practices; … (+35) | llama rutas que la API no tiene |
| `/medical-records/:profileId/request-access` | request-access | [CLINICIAN, PRACTITIONER] | Atención › Archivo clínico (hija) | 2 | GET /profiles/patients/me; POST /authz/care-relationships/request |  |
| `/my-quotations/new` | quotation-form | [CLINICIAN,PRACTITIONER] | Atención › Cotizaciones (hija) | 7 | GET /billing/service-catalog; GET /practices; GET /profiles/patients; GET /profiles/patients/me; GET /scheduling/bookings; PATCH /billing/service-catalog/:id; POST /quotations |  |
| `/onboarding` | onboarding-practitioner | authGuard (hija; ver comentario en app.routes) | — | 1 | GET /profiles/practitioners/me/onboarding |  |
| `/my-account/edit` | practitioner-profile-edit | [*] | Mi cuenta › Mi perfil (hija) | 26 | DELETE /practitioners/me/sites/:siteId; DELETE /profiles/practitioners/me/affiliations/:affiliationId; DELETE /profiles/practitioners/me/credentials/:credentialId; DELETE /profiles/practitioners/me/jurisdiction-authorizations/:licenseId ⚠; DELETE /profiles/practitioners/me/specialties/:specialtyId ⚠; GET /common/files/:id/content; GET /practitioners/:profileId/sites; GET /profiles/practitioners/me/affiliations; GET /profiles/practitioners/me/linkable-organizations; GET /profiles/practitioners/me/summary; … (+16) | llama rutas que la API no tiene |
| `/my-account/articles` | medical-articles | [*] | Mi cuenta › Mi perfil (hija) | 8 | GET /community/posts/:postId; GET /community/posts/:postId/comments; GET /community/profiles/by-slug/:slug; GET /community/profiles/me; POST /common/files/upload; POST /community/comments; POST /community/profiles/:profileId/posts; PUT /community/profiles/me |  |
| `/schedule/book/:slotId` | booking-new | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas (hija) | 7 | GET /profiles/patients; GET /profiles/patients/me/dependents; GET /scheduling/resources; GET /scheduling/slots; POST /scheduling/holds/:holdToken/confirm; POST /scheduling/holds/:holdToken/request; POST /scheduling/slots/:id/holds |  |
| `/glossary/:conceptId` | glossary-term | [ejercen/administran] | Atención › Glosario (hija) | 1 | GET /terminology/concepts/:conceptId |  |
| `/feed` | feed | authGuard (hija; ver comentario en app.routes) | — | 11 | DELETE /community/bookmarks; GET /community/comments/media/:fileId/content; GET /community/feed; GET /community/groups; GET /community/posts/:postId/comments; GET /community/profiles/me; POST /community/bookmarks; POST /community/comments; POST /community/profiles/:profileId/posts; POST /community/reports; … (+1) |  |
| `/schedule/new` | agenda-create | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas (hija) | 7 | DELETE /scheduling/templates/:id; GET /scheduling/resources; GET /scheduling/resources/:id/templates; POST /scheduling/booking-policies; POST /scheduling/resources; POST /scheduling/resources/:id/templates; POST /scheduling/templates/:id/generate-slots |  |
| `/schedule/edit` | agenda-create | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas (hija) | 7 | DELETE /scheduling/templates/:id; GET /scheduling/resources; GET /scheduling/resources/:id/templates; POST /scheduling/booking-policies; POST /scheduling/resources; POST /scheduling/resources/:id/templates; POST /scheduling/templates/:id/generate-slots |  |
| `/schedule/blocks` | blocks | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas (hija) | 6 | DELETE /scheduling/exceptions/:id; GET /scheduling/exception-types; GET /scheduling/resources; GET /scheduling/resources/:id/exceptions; PATCH /scheduling/exceptions/:id; POST /scheduling/resources/:id/exceptions |  |
| `/schedule/appointment/new` | appointment-new | [SCHEDULING_ADMIN, SCHEDULING_AGENT, PRACTITIONER] | Atención › Consultas médicas (hija) | 5 | GET /profiles/patients; GET /scheduling/resources; GET /terminology/value-sets; POST /scheduling/appointments/direct; POST /scheduling/appointments/walk-in |  |

#### ADMIN_ORG (52)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/administration/users` | user-registration | [SECURITY_ADMIN] | Administración › Usuarios | 1 | POST /iam/users |  |
| `/administration/patients` | patient-list | [SECURITY_ADMIN] | Administración › Pacientes | 2 | GET /profiles/patients; GET /system-context/dynamic-enums |  |
| `/administration/organizations` | organization-list | [SECURITY_ADMIN] | Administración › Organizaciones | 2 | GET /admin/tenants; GET /terminology/concepts |  |
| `/administration/my-organization` | organization-panel | [*] (oculto a PATIENT, PRACTITIONER) +tenant | Administración › Tu organización | 7 | GET /tenants/:tenantId/agenda; GET /tenants/:tenantId/memberships; GET /tenants/:tenantId/practitioner-requests; GET /tenants/me; PATCH /tenants/:tenantId; POST /tenants/:tenantId/practitioner-requests/:affiliationId/approve; POST /tenants/:tenantId/practitioner-requests/:affiliationId/reject |  |
| `/administration/insurance` | insurance-catalog | [*] (oculto a PATIENT, PRACTITIONER) +tenant | Administración › Aseguradora | 7 | GET /insurance-carriers; GET /insurance-carriers/:id; POST /insurance-plans/:planId/benefits; POST /insurance-products/:productId/plans; PUT /insurance-plans/:planId/benefits/:benefitId; PUT /insurance-plans/:planId/benefits/:benefitId/rules; PUT /insurance-plans/:planId/premium |  |
| `/administration/brokers` | broker-directory | [SECURITY_ADMIN] | Administración › Brokers | 1 | GET /insurance-brokers |  |
| `/administration/insurance-claims` | insurance-claims | [BILLING_OPERATOR, SECURITY_ADMIN] | Administración › Solicitudes de seguro | 2 | GET /insurance-carriers; GET /insurance-claims |  |
| `/administration/insurance-analytics` | insurance-analytics | [*] (oculto a PATIENT, PRACTITIONER) +tenant | Administración › Siniestralidad y analítica | 3 | GET /insurance-carriers; GET /insurance-carriers/:id; GET /insurance/analytics/loss-ratio |  |
| `/administration/delegated-access` | delegated-access-home | [SECURITY_ADMIN] | Administración › Acceso delegado | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/administration/identity-assurance` | identity-admin-home | [SECURITY_ADMIN] | Administración › Verificación de identidad | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/administration/services-catalog` | services-catalog | [SECURITY_ADMIN] | Administración › Catálogo de servicios | 4 | GET /billing/service-catalog; GET /practices; PATCH /billing/service-catalog/:id; POST /billing/service-catalog |  |
| `/administration/clinical-forms` | clinical-forms | [SECURITY_ADMIN] | Administración › Formularios clínicos | 4 | GET /charts/templates; GET /terminology/concepts; POST /charts/templates; POST /charts/templates/:templateId/assignments |  |
| `/administration/patients/new` | patient-new | [SECURITY_ADMIN] | Administración › Pacientes (hija) | 1 | POST /profiles/patients |  |
| `/administration/patients/merge` | patient-merge | [SECURITY_ADMIN] | Administración › Pacientes (hija) | 3 | GET /profiles/patients; POST /profiles/patients/merge; POST /profiles/patients/merge/:eventId/reverse |  |
| `/administration/patients/assisted-registration` | assisted-registration | [SECURITY_ADMIN] | Administración › Pacientes (hija) | 1 | POST /iam/users/assisted-registration |  |
| `/administration/patients/:profileId` | patient-detail | [SECURITY_ADMIN] | Administración › Pacientes (hija) | 4 | GET /authz/care-relationships; GET /profiles/patients/me; GET /terminology/concepts; POST /profiles/patients/:profileId/related-persons |  |
| `/administration/insurance-claims/:claimId` | insurance-claim-detail | [BILLING_OPERATOR, SECURITY_ADMIN] | Administración › Solicitudes de seguro (hija) | 2 | GET /insurance-claims/:id; POST /insurance-claims/:id/disputes |  |
| `/administration/brokers/:brokerId` | broker-detail | [SECURITY_ADMIN] | Administración › Brokers (hija) | 2 | GET /insurance-brokers/:id; GET /insurance-brokers/:id/clients |  |
| `/administration/getting-started` | getting-started | authGuard (hija; ver comentario en app.routes) | — | 4 | GET /admin/tenants; GET /tenants/:tenantId/branches; GET /tenants/:tenantId/memberships; GET /terminology/concepts |  |
| `/administration/organizations/new` | organization-new | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 3 | GET /iam/users; GET /terminology/concepts; POST /admin/tenants |  |
| `/administration/organizations/:tenantId/verify` | organization-verify | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 3 | GET /tenants/me; GET /terminology/concepts; POST /admin/tenants/:tenantId/verification |  |
| `/administration/organizations/:tenantId/branches/new` | branch-new | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 1 | POST /tenants/:tenantId/branches |  |
| `/administration/organizations/:tenantId/memberships/new` | membership-new | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 4 | GET /iam/users; GET /tenants/:tenantId/branches; POST /tenants/:tenantId/memberships; POST /tenants/:tenantId/memberships/:membershipId/branch-assignments |  |
| `/administration/organizations/:tenantId/child-organizations/new` | child-organization-new | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 3 | GET /iam/users; GET /terminology/concepts; POST /tenants/:tenantId/child-tenants |  |
| `/administration/organizations/:tenantId` | organization-detail | [SECURITY_ADMIN] | Administración › Organizaciones (hija) | 5 | GET /tenants/:tenantId/branches; GET /tenants/:tenantId/child-tenants; GET /tenants/:tenantId/memberships; GET /tenants/me; GET /terminology/concepts |  |
| `/administration/services-catalog/import` | procedure-import | [SECURITY_ADMIN] | Administración › Catálogo de servicios (hija) | 6 | GET /billing/service-catalog; GET /billing/service-catalog/procedure-specialties; GET /billing/service-catalog/procedures; GET /practices; PATCH /billing/service-catalog/:id; POST /billing/service-catalog |  |
| `/administration/delegated-access/delegations/new` | practitioner-delegate-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /practitioner-delegates |  |
| `/administration/delegated-access/delegations/revoke` | delegation-revocation | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /practitioner-delegates/:id/revoke |  |
| `/administration/delegated-access/delegations/requests/new` | access-request-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /practitioner-delegates/:id/access-requests |  |
| `/administration/delegated-access/delegations/grants/new` | grant-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /practitioner-delegates/:id/grants |  |
| `/administration/delegated-access/assignments/new` | org-assignment-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /org/:tenantMembershipId/user-assignments |  |
| `/administration/delegated-access/assignments/edit` | org-assignment-update | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | PATCH /org/user-assignments/:id |  |
| `/administration/delegated-access/requests/resolve` | access-request-resolution | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /access-requests/:id/decision |  |
| `/administration/delegated-access/permission-sets/new` | permission-set-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /delegated-permission-sets |  |
| `/administration/delegated-access/permission-sets/new-version` | set-version-form | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /delegated-permission-sets/:id/versions |  |
| `/administration/delegated-access/operations/evaluate-actor` | actor-evaluation | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /authz/effective-actor/evaluate |  |
| `/administration/delegated-access/operations/expiry-sweep` | expiry-sweep | [SECURITY_ADMIN] | Administración › Acceso delegado (hija) | 1 | POST /delegated-access/expiry-sweep |  |
| `/administration/identity-assurance/authorities/new` | authority-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/authorities |  |
| `/administration/identity-assurance/authorities/endpoint` | authority-endpoint-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/authorities/:id/endpoints |  |
| `/administration/identity-assurance/policies/new` | verification-policy-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-policies |  |
| `/administration/identity-assurance/queue` | case-queue | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 2 | GET /identity/verification-cases; GET /terminology/concepts |  |
| `/administration/identity-assurance/cases/new` | case-open-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases |  |
| `/administration/identity-assurance/cases/evidence` | case-evidence-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/:id/evidence |  |
| `/administration/identity-assurance/cases/checks` | check-plan-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/:caseId/checks:plan ⚠ | llama rutas que la API no tiene |
| `/administration/identity-assurance/cases/expire-sweep` | case-expire-sweep | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/expire-sweep |  |
| `/administration/identity-assurance/checks/attempt` | check-attempt-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/checks/:id/attempts |  |
| `/administration/identity-assurance/checks/result` | check-result-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/checks/:id/results |  |
| `/administration/identity-assurance/checks/fraud-signal` | fraud-signal-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/:id/fraud-signals |  |
| `/administration/identity-assurance/review/escalate` | manual-review-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/:id/manual-review |  |
| `/administration/identity-assurance/review/decision` | review-decision-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/manual-review/:id/decision |  |
| `/administration/identity-assurance/assertions/issue` | assertion-issue-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/verification-cases/:id/assertions |  |
| `/administration/identity-assurance/assertions/revoke` | assertion-revoke-form | [SECURITY_ADMIN] | Administración › Verificación de identidad (hija) | 1 | POST /identity/assertions/:id/revoke |  |

#### PLATAFORMA (48)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/administration/terminology` | terminology-catalog | [SECURITY_ADMIN] | Administración › Terminología | 1 | GET /terminology/concepts |  |
| `/administration/content-packs` | content-packs | [SUPERADMIN] | Administración › Paquetes de contenido | 2 | GET /admin/content-packs; POST /admin/content-packs/:code/apply |  |
| `/administration/moderation` | moderation | [SECURITY_ADMIN] | Administración › Moderación | 4 | GET /community/moderation/appeals; GET /community/moderation/queue; POST /community/moderation/appeals/:appealId/resolve; POST /community/moderation/queue/:queueId/decision |  |
| `/administration/data-catalog` | data-catalog | [SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DPO] | Administración › Catálogo de datos | 5 | GET /admin/catalog/coverage; GET /admin/catalog/objects; GET /admin/catalog/scans; GET /admin/catalog/schemas; POST /admin/catalog/scans |  |
| `/administration/web-analytics` | web-analytics | [PLATFORM_ADMIN, SECURITY_ADMIN, DATA_PLATFORM_ADMIN, MARKETING_MANAGER, DPO] | Administración › Analítica web | 8 | GET /admin/analytics/funnels; GET /admin/analytics/funnels/:funnelId/report; GET /admin/analytics/overview; GET /admin/analytics/pipeline-health; GET /admin/analytics/sessions; GET /admin/analytics/sessions/:id; GET /admin/analytics/timeseries; GET /admin/analytics/web-vitals |  |
| `/administration/qa-lab` | qa-lab | [QA_ADMIN, QA_ENGINEER, RELEASE_MANAGER, PLATFORM_ADMIN] | Administración › QA Lab | 9 | GET /admin/qa/defects; GET /admin/qa/environments; GET /admin/qa/plans; GET /admin/qa/runs; GET /admin/qa/runs/:runId; GET /admin/qa/suites; GET /admin/qa/targets; POST /admin/qa/plans; POST /admin/qa/plans/preflight |  |
| `/administration/operations` | operations | [PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN] | Administración › Operación | 5 | GET /admin/ops/backups; GET /admin/ops/deployments; GET /admin/ops/incidents; GET /admin/ops/readiness; GET /admin/ops/slos |  |
| `/administration/identity-providers` | auth-providers-home | [IDENTITY_ADMIN] | Administración › Proveedores de identidad | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/administration/health-context` | health-context-home | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/administration/geolocation` | geo-home | [SECURITY_ADMIN] | Administración › Geolocalización | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/administration/terminology/import` | version-import | [SECURITY_ADMIN] | Administración › Terminología (hija) | 4 | GET /terminology/code-systems; GET /terminology/code-systems/:id/versions; POST /terminology/versions/:versionId/import-file; POST /terminology/versions/:versionId/publish |  |
| `/administration/qa-lab/plans/:planId` | qa-plan-detail | [QA_ADMIN, QA_ENGINEER, RELEASE_MANAGER, PLATFORM_ADMIN] | Administración › QA Lab (hija) | 3 | GET /admin/qa/plans/:planId; POST /admin/qa/plans/:planId/approvals; POST /admin/qa/plans/:planId/cancel |  |
| `/administration/data-catalog/:objectId` | catalog-object-detail | [SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DPO] | Administración › Catálogo de datos (hija) | 9 | GET /admin/catalog/objects/:objectId; GET /admin/catalog/objects/:objectId/changes; GET /admin/catalog/objects/:objectId/columns; GET /admin/catalog/objects/:objectId/evidence; GET /admin/catalog/objects/:objectId/history; GET /admin/catalog/objects/:objectId/impact; POST /admin/catalog/annotations/:annotationId/review; POST /admin/catalog/objects/:objectId/evidence; PUT /admin/catalog/objects/:objectId/annotation |  |
| `/administration/identity-providers/providers/new` | provider-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers |  |
| `/administration/identity-providers/providers/protocol` | protocol-config-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/:id/protocol-configs |  |
| `/administration/identity-providers/providers/attribute-mappings` | attribute-mappings-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | PUT /auth-providers/identity-providers/:id/attribute-mappings |  |
| `/administration/identity-providers/providers/provisioning-rule` | provisioning-rule-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/:id/provisioning-rules |  |
| `/administration/identity-providers/keys/new` | signing-key-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/:id/signing-keys |  |
| `/administration/identity-providers/keys/rotate` | key-rotation-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/:id/signing-keys/rotate |  |
| `/administration/identity-providers/organizations/link` | tenant-binding-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/tenant-bindings |  |
| `/administration/identity-providers/login/start` | login-start-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/by-code/:code/authorize |  |
| `/administration/identity-providers/login/callback` | login-callback-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/identity-providers/by-code/:code/callback |  |
| `/administration/identity-providers/accounts/link` | account-link-request-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/account-link-requests |  |
| `/administration/identity-providers/accounts/complete` | account-link-complete-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/account-link-requests/complete |  |
| `/administration/identity-providers/accounts/unlink` | identity-unlink-form | [IDENTITY_ADMIN] | Administración › Proveedores de identidad (hija) | 1 | POST /auth-providers/federated-identities/:id/unlink |  |
| `/administration/health-context/contexts/resolve` | context-resolve | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | GET /health-context/contexts/resolve |  |
| `/administration/health-context/contexts/new` | context-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/contexts |  |
| `/administration/health-context/agents/new` | agent-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/agents |  |
| `/administration/health-context/sources/new` | source-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/sources |  |
| `/administration/health-context/schedules/new` | schedule-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/schedules |  |
| `/administration/health-context/collection-runs/new` | collection-run-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/collection-runs |  |
| `/administration/health-context/observations/new` | observation-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/collection-runs/:id/observations |  |
| `/administration/health-context/versions/new` | version-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/contexts/:id/versions |  |
| `/administration/health-context/quality-reviews/new` | quality-review-form | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/versions/:id/quality-reviews |  |
| `/administration/health-context/versions/publish` | version-publish | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/versions/:id/publish |  |
| `/administration/health-context/versions/supersede` | version-supersede | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/versions/:id/supersede |  |
| `/administration/health-context/collection-runs/finish` | collection-run-finish | [CONTEXT_CURATOR,CONTEXT_CONSUMER,SOURCE_ADMIN,QUALITY_REVIEWER,PLATFORM_ADMIN] | Administración › Contexto sanitario (hija) | 1 | POST /health-context/collection-runs/:id/finish |  |
| `/administration/geolocation/subjects/new` | tracked-subject-form | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/tracked-subjects |  |
| `/administration/geolocation/sessions/new` | tracking-session-form | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/tracking-sessions |  |
| `/administration/geolocation/trips/new` | trip-form | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/trips |  |
| `/administration/geolocation/subjects/pings` | ping-ingest | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/tracked-subjects/:id/pings |  |
| `/administration/geolocation/geofences/new` | geofence-form | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/geofences |  |
| `/administration/geolocation/geofence-events/new` | geofence-event-form | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/geofence-events |  |
| `/administration/geolocation/subjects/revoke-consent` | consent-revocation | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/tracked-subjects/:id/revoke-consent |  |
| `/administration/geolocation/sessions/close` | tracking-session-close | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/tracking-sessions/:id/close |  |
| `/administration/geolocation/trips/close` | trip-close | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | POST /geo/trips/:id/close |  |
| `/administration/geolocation/subjects/last-position` | last-position | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | GET /geo/tracked-subjects/:id/last-position |  |
| `/administration/geolocation/subjects/last-position/:trackedSubjectId` | last-position | [SECURITY_ADMIN] | Administración › Geolocalización (hija) | 1 | GET /geo/tracked-subjects/:id/last-position |  |

#### VISITADOR (2)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/administration/pharma-lab` | pharma-lab-home | [PHARMA_LAB_ADMIN, BUSINESS_ADMIN, PLATFORM_ADMIN] | Administración › Laboratorio farmacéutico | 8 | GET /pharma-labs; GET /pharma-labs/:pharmaLabId/materials; GET /pharma-labs/:pharmaLabId/medical-visitors; GET /pharma-labs/:pharmaLabId/pharmacovigilance/reports; GET /pharma-labs/:pharmaLabId/products; GET /pharma-labs/:pharmaLabId/regulatory-documents; GET /visit-records/labs/:pharmaLabId/rating-summary; POST /pharma-labs/:pharmaLabId/medical-visitors/:medicalVisitorId/unlink |  |
| `/my-visits` | visitor-visits | [MEDICAL_VISITOR] | Atención › Mis visitas médicas | 2 | GET /visit-requests/mine; POST /visit-requests/:visitRequestId/cancel |  |

#### FARMACIA (4)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/administration/pharmacy-orders` | pharmacy-inbox | [*] (oculto a PATIENT) +tenant | Administración › Pedidos de farmacia | 1 | GET /pharmacy/orders | usa fixtures locales |
| `/administration/pharmacy-campaigns` | pharmacy-campaigns | [*] (oculto a PATIENT) +tenant | Administración › Promociones | 2 | GET /pharmacy/pharmacies; GET /pharmacy/products | usa fixtures locales |
| `/administration/pharmacy-profile` | pharmacy-profile | [*] (oculto a PATIENT) +tenant | Administración › Ficha de la farmacia | 0 | — | usa fixtures locales |
| `/administration/pharmacy-orders/:orderId` | inbox-order | [*] (oculto a PATIENT) +tenant | Administración › Pedidos de farmacia (hija) | 1 | GET /pharmacy/products | usa fixtures locales |

#### LAB (1)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/administration/medical-laboratory` | medical-laboratory | [SECURITY_ADMIN] | Administración › Laboratorio médico | 7 | DELETE /diagnostic-study-offerings/:id; GET /diagnostic-units/:id; GET /diagnostic-units/:id/administration; GET /system-context/dynamic-enums; POST /diagnostic-units/:id/price-schedules; POST /diagnostic-units/:id/study-offerings; POST /diagnostic-units/:id/verify-and-publish |  |

#### PUBLICO (29)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/p/:slug/post/:postId` | public-post-detail | público (sin guard) | — | 2 | POST /community/comments; PUT /community/reactions |  |
| `/{p,o,f,l,s}/:slug` | public-profile | público (sin guard) | — | 5 | GET /clinical/patients/:patientProfileId/summary; GET /public/profiles/:prefijo/:slug/reviews; POST /community/comments; POST /patients/me/reviews; PUT /community/reactions |  |
| `/posts` | feed-publicaciones | público (sin guard) | — | 8 | GET /community/profiles/me; GET /public/posts; GET /public/profiles/:prefijo/:slug; GET /public/search/practitioners; POST /community/comments; POST /community/profiles/:profileId/posts; POST /community/reports; PUT /community/reactions |  |
| `/search` | buscador-listado | público (sin guard) | — | 0 | — | PublicDirectoryClient con ruta en variable: GET /public/search/* (detección estática no la resuelve; sin confirmar) |
| `/search/symptoms` | sintomas-publico | público (sin guard) | — | 3 | GET /profiles/practitioners; GET /terminology/concepts; POST /v1/triage/analyze ⚠ | llama rutas que la API no tiene |
| `/search/practitioners` | profesionales-listado | público (sin guard) | — | 1 | GET /terminology/value-sets |  |
| `/search/medications` | medicamentos-listado | público (sin guard) | — | 2 | GET /public/medications; GET /public/medications/:conceptId/availability |  |
| `/search/hospitals` | hospitales-listado | público (sin guard) | — | 1 | GET /terminology/value-sets |  |
| `/search/diagnostics` | laboratorios-listado | público (sin guard) | — | 0 | — | PublicDirectoryClient con ruta en variable: GET /public/search/* (detección estática no la resuelve; sin confirmar) |
| `/search/insurers` | aseguradoras-listado | público (sin guard) | — | 0 | — | PublicDirectoryClient con ruta en variable: GET /public/search/* (detección estática no la resuelve; sin confirmar) |
| `/search/map` | cercania-detalle | público (sin guard) | — | 0 | — | PublicDirectoryClient con ruta en variable: GET /public/search/* (detección estática no la resuelve; sin confirmar) |
| `/promotions/:campaignId` | campaign-detail | público (sin guard) | — | 0 | — | usa fixtures locales |
| `/design-system` | design-system-sample | público (sin guard) | — | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/design-system/stock` | component-stock | público (sin guard) | — | 438 | DELETE /common/files/:id; DELETE /community/bookmarks; DELETE /community/groups/:groupId/members/:member; DELETE /diagnostic-study-offerings/:id; DELETE /forms/assignments/:assignmentId ⚠; DELETE /practitioners/me/sites/:siteId; DELETE /profiles/practitioners/me/affiliations/:affiliationId; DELETE /profiles/practitioners/me/credentials/:credentialId; DELETE /profiles/practitioners/me/jurisdiction-authorizations/:licenseId ⚠; DELETE /profiles/practitioners/me/specialties/:specialtyId ⚠; … (+428) | llama rutas que la API no tiene; SOLO mockup (canMatch mockBackend) |
| `/verify/portability/:manifestHash` | portability-verify | público (sin guard) | — | 1 | GET /public/portability/verify/:manifestHash |  |
| `/auth/register/patient` | register-patient | público (sin guard) | — | 3 | GET /insurance-carrier-catalog; GET /system-context/dynamic-enums; GET /terminology/value-sets |  |
| `/auth/register/practitioner` | register-practitioner | público (sin guard) | — | 4 | GET /system-context/dynamic-enums; GET /terminology/value-sets; POST /iam/auth/register-practitioner; POST /iam/auth/upload-registration-document |  |
| `/auth/register/organization` | register-organization | público (sin guard) | — | 3 | GET /system-context/dynamic-enums; POST /iam/auth/register-organization; POST /iam/auth/upload-registration-document |  |
| `/auth/register/laboratory` | register-laboratory | público (sin guard) | — | 0 | — | sin endpoint (cierra en solicitud local) |
| `/auth/register/imaging-center` | register-imaging-center | público (sin guard) | — | 0 | — | sin endpoint (cierra en solicitud local) |
| `/auth` | login | público (sin guard) | — | 1 | POST /iam/auth/login (vía AuthService) | |
| `/auth/organization` | tenant-selection | público (sin guard) | — | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/auth/register` | register-account-type | público (sin guard) | — | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/auth/verify-email` | verify-email | público (sin guard) | — | 1 | POST /iam/auth/verify-email |  |
| `/auth/forgot-password` | forgot-password | público (sin guard) | — | 1 | POST /iam/auth/forgot-password |  |
| `/auth/reset-password` | reset-password | público (sin guard) | — | 1 | POST /iam/auth/reset-password |  |
| `/auth/activate` | activate-account | público (sin guard) | — | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/auth/resend-verification` | resend-verification | público (sin guard) | — | 1 | POST /iam/auth/resend-verification |  |
| `/{p,o,f,l,s}/:slug` (resolver) | public-profile.resolver | público (sin guard) | — | 1 | GET /public/profiles/:prefijo/:slug |  |

#### TRANSVERSAL (8)

| Ruta | Componente | Rol/guard | Menú | # ep | Endpoints detectados | Estado |
|---|---|---|---|---|---|---|
| `/notification-center` | notification-center | [*] | Mi cuenta › Notificaciones | 5 | GET /community/notifications; GET /community/profiles/me; GET /notifications/me; POST /notifications/in-app/:id/read; POST /notifications/in-app/read-all |  |
| `/messaging` | messaging | [*] | General › Chats | 14 | GET /community/conversations; GET /community/conversations/:conversationId ⚠; GET /community/conversations/:conversationId/messages; GET /community/profiles/:profileId/reviews; GET /community/profiles/by-slug/:slug; GET /community/profiles/me; GET /public/search/practitioners; PATCH /community/conversations/:conversationId/messages/:messageId; POST /common/files/upload; POST /community/conversations; … (+4) | llama rutas que la API no tiene |
| `/settings` | settings | [*] | Mi cuenta › Ajustes | 20 | GET /community/conversations; GET /community/conversations/:conversationId ⚠; GET /community/conversations/:conversationId/messages; GET /community/notifications; GET /community/profiles/:profileId/reviews; GET /community/profiles/by-slug/:slug; GET /community/profiles/me; GET /notifications/me; GET /notifications/preferences/me; GET /public/search/practitioners; … (+10) | llama rutas que la API no tiene |
| `/tutorials` | tutorials-center | [*] | General › Tutoriales | 0 | — | 0 lecturas detectadas (hub/estática) |
| `/messaging/:conversationId` | thread | [*] | General › Chats (hija) | 14 | GET /community/conversations; GET /community/conversations/:conversationId ⚠; GET /community/conversations/:conversationId/messages; GET /community/profiles/:profileId/reviews; GET /community/profiles/by-slug/:slug; GET /community/profiles/me; GET /public/search/practitioners; PATCH /community/conversations/:conversationId/messages/:messageId; POST /common/files/upload; POST /community/conversations; … (+4) | llama rutas que la API no tiene |
| `/billing` | section-placeholder | [BILLING, FINANCE, CASHIER, PAYMENTS_ADMIN] | Facturación › Facturación | 0 | — | PLACEHOLDER |
| `/dashboard` | dashboard | [*] | General › Panel | 23 | DELETE /community/groups/:groupId/members/:member; GET /admin/tenants; GET /clinical/patients/:patientProfileId/summary; GET /community/groups; GET /community/groups/:groupId; GET /community/groups/:groupId/members; GET /community/groups/:groupId/posts; GET /community/profiles/me; GET /community/topics; GET /diagnostic-units/:id; … (+13) | llama rutas que la API no tiene |
| `/shell (layout)` | shell-layout | authGuard (hija; ver comentario en app.routes) | — | 15 | GET /community/conversations; GET /community/conversations/:conversationId ⚠; GET /community/conversations/:conversationId/messages; GET /community/profiles/:profileId/reviews; GET /community/profiles/by-slug/:slug; GET /community/profiles/me; GET /profiles/patients/me/dependents; GET /public/search/practitioners; PATCH /community/conversations/:conversationId/messages/:messageId; POST /common/files/upload; … (+5) | llama rutas que la API no tiene |

#### Maquetas portadas de la bóveda (126 pantallas, `features/alovida/alovida.routes.ts`, archivo generado)

| Grupo | Rutas | Guard | Datos | Estado |
|---|---|---|---|---|
| `/inicio` | 1 | ninguno | marcado estático | maqueta de portada |
| `/buscar/*-listado`, `/buscar/perfil-*-detalle`, `/buscar/seguidos-…`, `/buscar/calificar-…` | 14 | ninguno | los 6 listados reales se reusan desde `/search/*`; fichas y formularios estáticos | parcialmente reemplazadas por `/search/*` y `/{p,o,f,l,s}/:slug` |
| `/datos-compartidos/*` (M02 common: archivos, versiones, vínculos, contactos, direcciones, identificadores, derivados) | 21 | ninguno | estático (componentes de 14 líneas, sin inyección) | **sólo diseño** |
| `/terminologia/*` (M03) | 23 | ninguno | estático | sólo diseño |
| `/directorio/*` (M04) | 13 | ninguno | estático | sólo diseño |
| `/personas/*` (M05) | 23 | ninguno | estático | sólo diseño |
| `/accesos/*` (M06 authz: break-the-glass, accesos clínicos, relaciones de cuidado, representaciones legales, roles, permisos…) | 31 | ninguno | estático | sólo diseño |

Marcadas con el aviso «Referencia de diseño, no la aplicación» (`features/alovida/shell/alovida-design-notice.ts:83`; hallazgo H-1 de `DESIGN_VIEW_INVENTORY.md`, corregido). Ninguna consume la API.

---

## TAREA B — API sin pantalla, por módulo

Base: `api-unused.json` (868 rutas). «Sin/Total» = rutas sin handler en el mock / rutas del módulo. Propósito tomado del `README.md` del módulo (`src/modules/<m>/README.md`), del controlador o del `.puml` de casos de uso; la fase es la que la bóveda sugiere en `SALUD/Vistas/Vnn … — Vistas.md`.

Categorías: **1** = falta pantalla y es producto de demo/lanzamiento · **2** = infraestructura interna, no necesita UI · **3** = producto futuro / fuera de alcance · **4** = excluido por pedido (pasarela de pago, delivery).

| Módulo | Sin/Total | Cat. | Fase bóveda | Propósito (fuente) y justificación |
|---|---|---|---|---|
| consent | 15/15 | **1** | 1 | «Directivas de privacidad, bases legales y evidencia de consentimiento» (README). El paciente es actor principal de 8 de sus 12 UC (UC-07-01..09). Cero pantallas. Condición legal para compartir historia. |
| clinical_ext | 22/26 | **1** (parcial 2) | 1 | Referencias, teleconsulta, equipos de cuidado, alertas, brechas (README). Referencias y teleconsulta son producto; las altas de reglas CDS/interacciones/order-sets son administración clínica (2). |
| clinical | 11/30 | **1** | 1 | Registro clínico nuclear (README). Faltan: ciclo de vida de receta (editar/invalidar/reemplazar/renovar), procedimientos, inmunizaciones, administración de medicación, enmienda de observación, políticas de firma de receta (D-05). |
| chart | 10/19 | **1** | 1 | Notas, firmas y planes de cuidado. Faltan firmar/cosignar/enmendar/liberar/retener nota, hallazgos de examen, listado de notas, PDF del encuentro y descarga de documentos. |
| diagnostics | 19/27 | **1** | 3 | Laboratorio, imagen, DICOM (README: 14 UC del M20). Falta **todo el lado del laboratorio**: muestras, acesión, rechazo, custodia, órdenes de trabajo, corridas de analizador, verificación de resultados, versiones y **liberación de informes**, críticos; y el detalle `GET /diagnostic-results/me/:reportId`. |
| diagnostic_units | 12/22 | **1** | 3 | Ciclo de vida de laboratorios/imagenología (README). Falta el alta (`POST /diagnostic-units`), sitios, especialidades, equipos, acreditaciones y asignación de especialistas. Las altas públicas `/auth/register/laboratory|imaging-center` no llaman a nada. |
| organization_extensions | 9/9 | **1** | 1 | «Especializa organizaciones como hospitales, líneas de servicio, licencias, afiliaciones» (README). Cero pantallas: los hospitales del propósito central no tienen consola ni alta. |
| insurance | 20/40 | **1** | 2 | Aseguradoras, planes, reclamos. Faltan cobertura del paciente (`POST /patient-coverages`), elegibilidad, autorización previa, adjudicación, EOB, reversa, decisión de apelación, alta de aseguradora/producto/corredor/red/grupo empleador, conciliación, comisiones. |
| billing | 13/18 | **1** (sin pasarela) | 2 | «Facturación al paciente (CxC), CxP, conciliación, morosidad, planes de pago» (README). La sección `/billing` es el único placeholder. Ninguna de estas rutas es la pasarela (esa es `payments`). |
| directory | 6/19 | **1** | 0 | Tenants, sedes, membresías. Faltan transferir/cambiar rol/dar de baja a un miembro, suspender tenant, editar perfil público, ficha `GET /tenants/:id`. |
| practice | 19/28 | **1** | 1 | Organización de atención, sedes, unidades, espacios y **asignaciones de rol** (README). Falta aprobar/rechazar/suspender/terminar la asignación de un médico a una práctica, altas de práctica/sede/unidad/espacio, ajustes, servicios, inventario. |
| profiles | 9/43 | **1** | 0 | Personas, pacientes y profesionales. Faltan: verificar credencial del médico (`POST /profiles/credentials/:id/verify`), proxy de portal (representante), defunción, vínculos de identidad, ficha `GET /profiles/patients/:id` y resumen público del profesional. |
| authz | 15/24 | **1** | 0 | Accesos clínicos con propósito, break-the-glass, roles (README). Faltan otorgar/revocar acceso clínico por el paciente, emergencia, y la administración de roles/permisos (sólo maqueta en `/accesos/*`). |
| iam | 16/31 | **1** (parcial 2) | 0 | Cuentas, MFA, dispositivos, sesiones. Faltan MFA, dispositivos de confianza, cerrar sesión en todos lados, ficha/bloqueo/rol global de un usuario, alta asistida de profesional. `sessions/purge` es interno (2). |
| scheduling | 16/53 | **1** (parcial 2 y 4) | 1 | Faltan pedir información/proponer horario al paciente, recordatorios, reglas de confirmación (tabla REDESA `booking_confirmation_rules`), lista de espera por recurso. `internal/*` es 2; `payment-state` es 4. |
| forms | 11/21 | **1** (admin) | 1 | Formularios dinámicos. Faltan sets de definición y su publicación, migraciones, dependencias, localización, reglas de acceso, corrección de valores. |
| pharma_lab | 54/76 | **1** | — (REDESA) | Carril 17. Faltan alta de laboratorio farmacéutico y de visitadores, productos, material con aprobación, avisos, registros de visita con confirmación y calificación, encuestas, farmacovigilancia (acciones), documentos regulatorios. |
| pharmacy | 13/17 | **1** | 3 | Farmacia, sedes, catálogo, precios (README). Falta el alta de farmacia y su catálogo/precios: sin eso el pedido real no tiene qué vender. `integration-connections`/`projections` son 2. |
| pharmacy_inventory | 17/29 | **1** (parcial 3) | 3 | Falta ficha del pedido `GET /pharmacy/orders/:id`, stock por sede, reservas, dispensación. Compras/proveedores/transferencias/conteos/recall = 3 para la demo. |
| medical_groups | 8/8 | **1** (sin confirmar alcance) | — (REDESA) | «Grupo médico: evento de equipo alrededor de un servicio del catálogo, roster y pago por cargo» (README). Cero pantallas y sin cliente en el front. |
| procedures_perioperative | 23/32 | **1** (baja prioridad) | 3 | Ciclo quirúrgico completo. La sección `/interventions` sólo lista casos y acepta/responde integrantes del equipo. |
| common | 12/19 | **1** (contacto) / **2** (resto) | 0 | Verificar teléfono/correo (`contact-points`) es producto; versiones/derivados de archivos y `internal/*` son 2. |
| community | 27/90 | **1** (parcial 2) | 4 | Red social. Faltan fijar conversación, presencia, encuestas en publicaciones, estadísticas del perfil, alta de perfil público. `internal/*` (feed, búsqueda, insignias) es 2; `GET /p|o|f|l|s/:slug` duplican las `/public/profiles/*` que el front sí usa. |
| accounting | 9/44 | **1** (baja) | 2 | Altas de catálogo contable (cuentas, ejercicios, tipos de cambio, devengos, partidas abiertas, pagos de pasivo). La contabilidad del médico ya está cubierta. |
| audit | 11/11 | **2**, salvo DSAR = **1** | 5 | WORM, cadena hash, provenance (README). `POST/PATCH /privacy/dsar` es un derecho del titular (acceso/portabilidad) y encaja con «descargar mi historia». `moderation/decisions` duplicado de community. |
| health_data | 16/16 | **2**, salvo `$everything` = **1** | 5 | Ingesta y recurso canónico FHIR. `GET /fhir/r5/Patient/:id/$everything` es la exportación estándar de la historia completa del paciente. |
| identity_assurance | 6/27 | 2 | 0 | Los 6 son `internal/*` y `checks\:plan` (el front llama `checks:plan`; el `\:` del decorador es un escape de Nest, probablemente la misma ruta — sin confirmar). |
| terminology | 12/21 | 2 | 0 | Mantenimiento del catálogo (code systems, designaciones, `$translate`, `$lookup`). Operación de plataforma; la importación ya tiene pantalla. |
| system_context | 12/13 | 2 | 0 | Enumeraciones dinámicas gobernadas (README). |
| data_catalog | 8/22 | 2 | 5 | Catálogo de datos; la pantalla existe, faltan evidencias/historial por columna y cancelar escaneo. |
| telemetry | 13/21 | 2 | 5 | Ingesta de eventos/Web Vitals desde el cliente; no son pantallas (el banner de aceptación de tracking podría ser 1, sin confirmar si aplica). |
| health_context | 1/13 | 2 | 0 | Sólo `internal/schedules/run-due`. |
| messaging | 12/17 | 2 | 4 | Outbox, colas, entrega de notificaciones (README). La bandeja del usuario ya está cubierta. |
| workflow | 11/11 | 2 | 5 | Motor de máquinas de estado (README). |
| read_models | 14/15 | 2 | 5 | Contratos de read model y vistas de frontend (README). |
| integrations | 15/15 | 2 | 5 | Conectividad externa. |
| integration_contracts | 12/12 | 2 | 5 | Contratos B2B gobernados (README). |
| object_storage | 14/14 | 2 | 5 | Multiparte, WORM, DICOM (README). |
| document_store | 5/5 | 2 | 5 | Almacén documental complementario (README). |
| search_platform | 3/3 | 2 | 5 | OpenSearch (README). |
| redis_runtime | 5/5 | 2 | 5 | Caché y locks (README). |
| time_series | 14/14 | 2 | 5 | TimescaleDB (README). |
| vector_rag | 16/16 | 2 | 5 | Embeddings y retrieval (README). |
| graph_intelligence | 15/15 | 2 | 5 | Grafo de relaciones y fraude (README). |
| polyglot_storage | 15/15 | 2 | 5 | Gobierno de ubicación de datos (README). |
| cross_store_consistency | 16/16 | 2 | 5 | Proyecciones, reconciliación, borrado (README). |
| lakehouse | 13/13 | 2 | 5 | Lago de datos e investigación (README). |
| platform_ops | 15/15 | 2 | 5 | CAB, despliegues, incidentes (README). |
| ops_console | 2/7 | 2 | 5 | Consola de operación (sin README; la pantalla existe). |
| system_ops | 24/24 | 2 | 5 | Gobierno de datos: retención, residencia, legal hold (README). |
| qa_lab | 13/19 | 2 | 3 | Laboratorio de QA (README). |
| qa_execution | 2/9 | 2 | — | Ejecución de QA (README). |
| audio_assets | 10/10 | 2 | — | Caché TTS (README). |
| health (+`app.controller`) | 6/6 | 2 | — | Sondas de vida y fuentes de datos. |
| promotions | 18/18 | **3** | 4 | Lealtad, cupones, referidos (README). «Mis puntos» se retiró (redirige). Ojo: las promociones de farmacia del front son fixtures, no usan este módulo (CV-15). |
| automation | 17/17 | 3 | 5 | Agentes y orquestación con IA (README). |
| reporting | 12/12 | 3 | 5 | BI gobernado (README). |
| ads | 18/18 | 3 | 4 | Publicidad (README). |
| crm | 16/16 | 3 | 4 | CRM (README). |
| erp | 17/17 | 3 | 2 | Back-office (README). |
| marketing | 14/14 | 3 | 4 | Journeys y atribución (README). |
| education | 14/14 | 3 | 4 | Cursos y CME (README). |
| payments | 14/14 | **4** | 2 | «Cobros con pasarela» (README). Excluido. |
| tracking | 11/11 | **4** | 4 | Envíos, hitos, prueba de entrega (README). Delivery. Excluido. |
| geo | 0/10 | (4) | 0 | Rastreo móvil, geocercas, viajes (README). **Ya tiene 11 pantallas** de administración (`/administration/geolocation/*`): trabajo hecho sobre un módulo cuyo uso principal es delivery. |
| auth_providers · delegated_access · content_packs · quotations · surveys | 0 | — | — | Todo su contrato tiene handler en el mock. Pero acceso delegado no tiene **ningún GET de listado** en la API (la bóveda lo anota: «pendientes de GET de listado»), así que su hub sólo ofrece formularios ciegos (CV-13). |

### Categoría 1 — endpoints concretos y pantalla que faltaría

| Módulo | Endpoints sin pantalla | Pantalla que faltaría (actor) |
|---|---|---|
| consent | `POST /consent/consents` · `POST /consent/consents/:id/withdraw` · `PATCH /consent/consents/:id/provisions` · `POST /consent/hipaa-authorizations` · `POST /consent/hipaa-authorizations/:id/revoke` · `POST /consent/patient-objections` · `POST /consent/patient-objections/:id/resolve` · `POST /consent/privacy-restrictions` · `POST /consent/treatment-informed-consents` · `POST /consent/consent-evidence` · `POST /consent/processing-legal-bases` · `POST/GET /consent/practitioner-access-requests(/mine)` · `POST …/:id/decision` | «Mi privacidad» en Mi cuenta: consentimientos vigentes, retirar, autorizar divulgación, objetar (paciente). Consentimiento informado dentro de la consulta (médico). Bases legales y objeciones (DPO/admin). Aclarar la convivencia de `consent/practitioner-access-requests` con `authz/care-relationships/request` que el front ya usa. |
| clinical_ext | `POST /referrals` · `PATCH /referrals/:id/respond` · `GET /referrals` · `POST /virtual-encounters` · `PATCH /virtual-encounters/:id/join` · `PATCH /virtual-encounters/:id/end` · `POST/GET /care-teams` · `PATCH /care-teams/:id/members/:memberId/set-responsible` · `PATCH /clinical-alerts/:id/acknowledge|override` · `POST /care-gaps/recompute` · `PATCH /care-gaps/:id/close` · `POST /patients/:id/immunization-plan/project` | Derivar desde la consulta y bandeja de derivaciones recibidas (médico); teleconsulta: iniciar/unirse/cerrar (médico y paciente); equipo de cuidado del paciente; alertas clínicas en el expediente. |
| clinical | `POST /clinical/medication-requests/:id/edit|invalidate|replace|renew` · `POST /clinical/procedures` · `POST /clinical/immunizations` · `POST /clinical/medication-records` · `PATCH /clinical/observations/:id/amend` · `POST/GET /clinical/prescription-signature-policies` · `POST …/:id/deactivate` | Acciones sobre una receta emitida en el expediente (médico); vacunas y procedimientos en la rejilla de consulta; políticas de firma de receta (admin de organización, regla D-05). |
| chart | `GET /charts/notes` · `POST /charts/notes/:noteId/versions/:versionId/sign|cosign` · `POST /charts/notes/:noteId/amendments` · `POST /charts/notes/versions/:versionId/release|withhold|exam-findings` · `PATCH /charts/care-plans/:planId/activities/:activityId` · `GET /charts/encounters/:id/pdf` · `GET /charts/documents/:documentId/files/:fileId/content` | Firmar/enmendar la evolución y liberarla al paciente (médico); ver las notas liberadas y descargar el PDF oficial del encuentro y los documentos adjuntos (paciente). |
| diagnostics | `POST /diagnostics/work-orders` · `POST /diagnostics/specimens` · `POST /diagnostics/accessions` · `POST /diagnostics/specimens/:id/rejection|containers` · `POST /diagnostics/containers/:id/custody-events` · `POST /diagnostics/analyzer-runs(/:id/messages)` · `POST /diagnostics/results/:observationId/verifications` · `POST /diagnostics/reports/:reportId/versions` · `POST …/versions/:versionId/release` · `POST /diagnostics/critical-results(/:id/acknowledge)` · `POST /diagnostics/imaging-endpoints|clinical-media|data-quality-events` · `POST /diagnostics/imaging-studies/:id/dose-events` · `POST /dicomweb/studies` · `GET /diagnostic-results/me/:reportId` | Consola operativa del laboratorio/imagen: recepción de muestras, cargar resultado, validar y **liberar al paciente** (laboratorio). Detalle de un resultado propio (paciente). |
| diagnostic_units | `POST /diagnostic-units` · `POST /diagnostic-units/:id/sites` · `PATCH /diagnostic-unit-sites/:siteId` · `POST /diagnostic-unit-sites/:siteId/equipment` · `PATCH /diagnostic-equipment/:id` · `PUT /diagnostic-units/:id/specialties` · `POST /diagnostic-units/:id/practitioner-assignments` · `POST /diagnostic-units/:id/accreditations` · `POST /diagnostic-unit-accreditations/:id/renew` · `GET /diagnostic-units/administration|search` · `POST /diagnostic-units/:id/reproject` | Conectar `/auth/register/laboratory` y `/auth/register/imaging-center` a `POST /diagnostic-units`; completar la consola `administration/medical-laboratory` con sitios, equipos, acreditaciones y especialistas (laboratorio). |
| organization_extensions | `POST /orgext/hospitals` · `POST /orgext/hospitals/:id/activate` · `POST|DELETE /orgext/hospitals/:id/service-lines(/:lineId)` · `POST /orgext/facility-licenses(/:id/verify)` · `POST /orgext/affiliations(/:id/terminate)` · `POST /orgext/data-boundaries` | Alta y consola de hospital: líneas de servicio, licencias, afiliaciones con otras organizaciones (admin de hospital); verificación de licencias (plataforma). |
| insurance | `POST /patient-coverages` · `POST /coverage-eligibility-requests` · `POST /coordination-of-benefits` · `POST /prior-authorization-requests(/:id/determinations)` · `POST /insurance-claims/:id/adjudications|eob|reversals` · `POST /claim-disputes/:id/appeal-decisions` · `POST /insurance-carriers` · `PUT /insurance-carriers/:id/contact-channels` · `POST /insurance-carriers/:id/products` · `POST /insurance-brokers(/:id/agreements)` · `POST /provider-networks(/:id/memberships)` · `POST /employer-groups` · `POST /reconciliation-batches(/:id/items)` · `POST /broker-commission-statements` | «Mi cobertura» (paciente); elegibilidad y autorización previa en la consulta (médico); adjudicar reclamo, emitir EOB, resolver apelación (aseguradora); altas de producto/corredor/red (aseguradora). |
| billing | `POST /billing/invoices:issue-from-encounter` · `POST /billing/invoices/:id:credit-note` · `POST /billing/patient-statements:generate` · `POST /billing/payment-plans` · `POST /billing/bills` · `POST /billing/payments-received:apply` · `POST /billing/payments-made:execute` · `POST /billing/reimbursements:link` · `POST /billing/reconciliation:clear` · `POST /billing/documents/:id:post-to-ledger` · `POST /billing/dunning-runs:execute` · `POST /billing/kpi-snapshots:compute` | Reemplazar el placeholder `/billing`: facturar un encuentro, nota de crédito, estado de cuenta del paciente, plan de pagos (facturación de la organización). Sin pasarela. |
| directory | `POST /tenants/:tenantId/memberships/:membershipId/transfer|offboard` · `PATCH …/role` · `POST /admin/tenants/:tenantId/suspend` · `PUT /admin/tenants/:tenantId/public-profile` · `GET /tenants/:tenantId` | Acciones sobre un miembro en la ficha de organización (admin de organización); suspender y editar perfil público (plataforma). |
| practice | `POST /role-assignments/:roleId/approve|reject|suspend|end|support-assignments` · `POST /practices/:practiceId/role-assignments` · `POST /practices` · `POST|DELETE /practices/:practiceId/sites(/:siteId)` · `GET /practices/:practiceId/sites` · `POST /sites/:siteId/clinical-units` · `GET|POST /sites/:siteId/care-spaces` · `PUT /practices/:practiceId/settings/:settingKey` · `POST /practices/:practiceId/healthcare-services|accreditations|inventory-items` · `POST /accreditations/:id/verify` · `POST /inventory-items/:itemId/movements` | Bandeja de solicitudes de médicos a la práctica (el médico ya puede pedir con `self-request`, nadie puede aprobar desde la UI); estructura de sedes/unidades/espacios (admin de organización). |
| profiles | `POST /profiles/credentials/:credentialId/verify` · `POST /profiles/patients/:profileId/portal-proxies` · `POST /profiles/persons/:personId/decease` · `POST /profiles/patients/:profileId/identity-links` · `GET /profiles/patients/:profileId` · `GET /profiles/practitioners/:profileId/summary` · `POST /profiles/practitioners/:profileId/affiliations` · `DELETE /profiles/practitioners/:profileId/photo` · `POST /tenants/:tenantId/practitioner-requests/:affiliationId/revoke` | Verificar la matrícula del médico (plataforma); representante/apoderado del paciente (paciente); revocar un médico ya aprobado (admin de organización). |
| authz | `POST /authz/patients/:patientProfileId/clinical-access-grants` · `DELETE /authz/clinical-access-grants/:grantId` · `POST /authz/patients/:patientProfileId/break-the-glass` · `GET|POST /authz/roles` · `PUT /authz/roles/:roleId/permissions|field-permissions` · `POST /authz/users/:userId/role-assignments|permission-grants` · `POST /authz/resource-scope-grants` · `POST /authz/tenants/:tenantId/access-policies` · `POST /authz/permission-categories|permissions` · `POST /authz/decisions/evaluate` | «Quién ve mi historia»: otorgar/revocar accesos (paciente); acceso de emergencia (médico); roles y permisos de la organización (admin). |
| iam | `POST /iam/users/:id/mfa-factors` · `GET /iam/users/:id/mfa-factors|devices|sessions|credentials|global-roles` · `POST /iam/users/:id/devices` · `POST /iam/auth/logout-all` · `POST /iam/users/:id/lock|global-roles|anonymize` · `POST /iam/users/:id/credentials/federated|:cid/revoke` · `GET /iam/users/:id` · `POST /iam/users/assisted-practitioner-registration` | Seguridad de la cuenta en Ajustes: MFA, dispositivos, cerrar sesión en todos lados (todos); ficha de usuario con bloqueo y rol global (plataforma). |
| scheduling | `POST /scheduling/bookings/:id/request-info|propose-schedule|reminders` · `GET|POST /scheduling/confirmation-rules` · `POST …/:id/activate|deactivate` · `POST /scheduling/confirmation-rules/evaluate` · `GET /scheduling/resources/:id/slots` · `GET /scheduling/resources/:resourceId/waitlist` · `POST /scheduling/appointments/walk-in` (el cliente lo llama; falta handler en el mock) | Negociación de horario con el paciente y recordatorios (médico/recepción); reglas de confirmación automática (admin). |
| forms | `GET|POST /forms/definition-sets(/:id)` · `POST …/versions/:ver/publish` · `POST …/migrations/:migrationId/run` · `POST /forms/fields/:id/dependencies|access-rules` · `PUT /forms/fields/:id/localizations/:lang` · `POST /forms/values/import` · `PATCH /forms/values/:id` · `GET /forms/assignments` | Gestor de sets de formularios y corrección de un valor capturado (admin/médico). |
| pharma_lab | `POST /pharma-labs` · `PATCH /pharma-labs/:id` · `POST /pharma-labs/:id/medical-visitors(/…/verifications|relink)` · `PUT …/products|specialties` · `POST|PATCH /pharma-labs/:id/products(/:productId(/status))` · `POST /pharma-labs/:id/materials(/…/assets|submit|decision)` · `GET …/approvals|assets` · `GET /pharma-labs/notices/mine` · `POST /pharma-labs/notices/:id/read` · `POST|GET /pharma-labs/visitor-posts` · `POST /visit-records(/:id/confirm|rating)` · `GET /visit-requests/:id` · `POST /visit-requests/:id/request-info|propose-time|reschedule` · `POST|GET /visit-agenda/blocks` · `/visit-surveys/*` · staff, costos, farmacovigilancia (acciones), documentos regulatorios | Completar el carril 17: alta de visitadores y productos, material promocional con aprobación, registrar/confirmar/calificar la visita, reprogramar (laboratorio farmacéutico, visitador, médico). |
| pharmacy + pharmacy_inventory | `POST /pharmacies` · `POST /pharmacies/:id/sites|products|price-lists(/…/prices|close)` · `DELETE /pharmacies/:id/products/:productId` · `POST /pharmacies/:id/licenses/:licenseId/verify` · `GET /pharmacy/pharmacies/:id` · `GET /pharmacy/sites/:siteId/prices` · `GET /pharmacy/orders/:id` · `GET /pharmacy-inventory/sites/:siteId/stock` · `POST /pharmacy/:pharmacyId/reservations|dispensations` · `POST /pharmacy/dispensations/:id/reverse` | Alta de farmacia, catálogo y precios (farmacia); ficha real del pedido y stock por sede (paciente/farmacia). |
| medical_groups | `GET|POST /medical-groups` · `GET /medical-groups/:id` · `POST /medical-groups/:id/members/:memberId/respond` · `POST /medical-groups/:id/reschedule-requests(/respond)` · `PATCH /medical-groups/:id/exercise-notes` · `GET /medical-groups/patients/:patientProfileId/conditions` | Grupo médico sobre un servicio (médico). Alcance de demo sin confirmar. |
| procedures_perioperative | `POST /procedure-cases` · `PATCH /procedure-cases/:id` · `POST /procedure-cases/:id/confirm|diagnoses|preoperative-assessments|preoperative-orders(/verify)|safety-checklists/…/responses|anesthesia-plans(/…/approve)|anesthesia-events|operative-steps|findings|implants|medication-uses|specimens|operative-reports(/…/sign)|pacu-stays|cancel|charge-items/post` · `POST /pacu-stays/:stayId/assessments|discharge` | Programar y documentar la cirugía (cirujano/anestesia). Fase 3. |
| common | `POST /common/contact-points` · `POST /common/contact-points/:id/verify` · `POST /common/identifiers` | Verificar teléfono (todos). |
| community | `POST|DELETE /community/conversations/:id/pin` · `GET …/presence` · `PATCH …/participant` · `DELETE …/messages/:messageId` · `GET …/attachments/:fileId/content` · `POST /community/posts/:postId/polls` · `POST /community/polls/:pollId/votes` · `GET /community/profiles/me/stats` · `POST /community/public-profiles` · `GET /public/comments/:commentId/replies` · `GET /public/media/:id` | Acciones de chat y encuestas en publicaciones (todos). Baja prioridad. |
| accounting | `POST /accounting/accounts|fiscal-years|exchange-rates|accrual-objects|open-items` · `POST /accounting/assets/capitalize` · `POST /accounting/postings/determine-accounts` · `POST /accounting/journal-transactions/:id/files` · `POST /accounting/liabilities/:id/payments` | Plan de cuentas, ejercicios y adjuntos a un asiento (contador). Baja. |
| audit (DSAR) · health_data (`$everything`) | `POST /privacy/dsar` · `PATCH /privacy/dsar/:id` · `GET /fhir/r5/Patient/:id/$everything` · `POST /fhir/r5/$export` | «Descargar todos mis datos» / exportación oficial de la historia (paciente); tramitación de la solicitud (DPO). |

---

## TAREA C — Casos de uso de actores principales sin pantalla

Fuente: `casos_uso_00_INDICE_MAESTRO.puml` (actores: Paciente/Portal, Clínico, Recepción, Farmacia, Laboratorio, Cirujano, Facturación, Aseguradora, Admin Seguridad) + los 60 `casos_de_uso/casos_uso_NN_*.puml` (760 UC). Cruce en `ucs2.json`.

- 760 UC · 717 con al menos una ruta API atribuida · **144 con alguna ruta usada por el front**.
- **220 UC tienen como actor al paciente, a un clínico/médico o a un rol de organización** (admisión, recepción, administrador de organización). **154 de ellos no tienen pantalla.**
- Quitando los de módulos de categoría 2, 3 y 4 (infra, futuro, pagos), quedan **82 UC de producto sin pantalla**. Los de la demo:

| Actor | UC sin pantalla (ID · nombre · ruta API) |
|---|---|
| **Paciente** | UC-07-01 Capturar consentimiento (`POST /consent/consents`) · UC-07-02 Retirar consentimiento (`…/withdraw`) · UC-07-03 Objeción (`POST /consent/patient-objections`) · UC-07-04/05 Autorización de divulgación y su revocación (`/consent/hipaa-authorizations`) · UC-07-08 Consentimiento informado de tratamiento · UC-07-09 Provisiones granulares · UC-06-06 Otorgar acceso clínico con propósito (`POST /authz/patients/:id/clinical-access-grants`) · UC-06-10 Revocar acceso clínico (`DELETE /authz/clinical-access-grants/:grantId`) · UC-05-11 Proxy de portal a representante · UC-10-08 DSAR (`/privacy/dsar`) · UC-15-06 Recibir nota liberada · UC-18-12 Teleconsulta (`/virtual-encounters`) · UC-26-02 Registrar cobertura (`POST /patient-coverages`) · UC-26-08 Ver EOB · UC-01-03 MFA · UC-01-05 Dispositivo de confianza · UC-01-08 Cerrar sesión en todos lados · UC-01-02 Vincular credencial federada |
| **Médico / clínico** | UC-15-03 Firmar nota · UC-15-05 Enmendar nota firmada · UC-15-06 Liberar al paciente · UC-15-07 Retener · UC-15-08 Hallazgos de examen · UC-08-11 Administrar medicación · UC-08-12 Registrar procedimiento · UC-08-13 Registrar inmunización · UC-18-05 Alertas clínicas · UC-18-06 Order sets · UC-18-07 Emitir referencia · UC-18-10 Cerrar brecha de cuidado · UC-18-12 Teleconsulta · UC-06-07 Acceso de emergencia (break-the-glass) · UC-26-03 Elegibilidad · UC-26-04 Autorización previa · UC-09-09 Corregir valor de formulario · UC-10-05 Historial de un registro · UC-14-04/05 Unidades y espacios de atención · UC-23-04/09/10 Especialidades, equipos y especialistas de la unidad diagnóstica · UC-22-03/04 Líneas de servicio hospitalarias · UC-53-01..13 (11 UC) perioperatorio · UC-02-02/03 Puntos de contacto |
| **Organización (admin, admisión, laboratorio, farmacia)** | UC-04-07 Transferir membresía · UC-04-08 Cambiar rol de miembro · UC-04-09 Offboarding · UC-04-10 Suspender tenant · UC-06-04 Asignar rol con vigencia · UC-06-09 Grant sobre recurso · UC-05-12 Defunción · UC-07-10 Evidencia de consentimiento · UC-09-01/03/13 Sets de formularios · UC-14-01/07/12 Sitios y ajustes de práctica · UC-20-01 Acesionar muestra · UC-20-02 Rechazar muestra · UC-22-01/02/07/09 Hospital y afiliaciones · UC-23-01/02 Alta de unidad diagnóstica y sitio · UC-24-01/02 Alta de farmacia y sede · UC-01-09/10 Revocar credencial, rol global · UC-03-01/12 Terminología por tenant |

Además, el índice maestro no tiene UC para varias cosas que el front **sí** construyó (pedidos de farmacia, cotizaciones, grupos médicos, visitador, contabilidad del médico): son alcance REDESA agregado después del modelo v3.9 y no se pueden cruzar por UC-ID.

La lista completa (154 filas con ID, actor, módulo, nombre y rutas) está en `scratchpad/uc-sin.txt`.

---

## TAREA D — Propósito central: «el paciente dueño de su historia»

Intención de producto (memoria `proposito-historia-clinica-paciente.md`, Justin, 2026-08-17): **ver · descargar · que se le actualice en cada atención · que laboratorios y hospitales también aporten.**

### Qué dicen los documentos del repo

| Documento | Fecha (último commit) | Qué dice del propósito | Vigencia |
|---|---|---|---|
| `ROUTE_HEALTH_MATRIX.md` | 2026-08-15 | `/my-account/medical-record` → `MedicalRecord` **ok** para paciente (línea 244). «ok» = navegó y pintó sin errores de consola ni 5xx; no mide contenido ni flujo. | Vieja: lista rutas que hoy redirigen (`/my-account/identity/verify`). |
| `DESIGN_VIEW_INVENTORY.md` | 2026-09-05 | Sólo diseño: las 126 maquetas no persisten nada (H-1). No habla del flujo. | Vigente para las maquetas. |
| `ESTADO-FRONTEND.md` | 2026-08-01 | «todo lo que se ve viene de la API: nada está simulado» (línea 12). | **Obsoleto y hoy falso** en `mockup`: `mockBackend: true` fijo. |
| `INFORME_AVANCE_GLOBAL_Y_PROXIMOS_PASOS.md` | 2026-09-12 | Hito 1 = altas y documentos legales; próximos pasos = GPS de aseguradora, gerencias, claims del pagador, roles IAM. **No menciona la historia del paciente.** | El plan vigente no prioriza el propósito central. |
| Memoria `proposito-historia-clinica-paciente.md` | 2026-08-17 | Paso 1 roto (D-3, 403 al titular); pasos 2-4 sin verificar. | Ver abajo: D-3 tiene corrección en el código. |

### Estado paso a paso (código de `mockup` × `dev`)

| Paso | Pantalla | Endpoints | Estado contra la API real |
|---|---|---|---|
| 1. **Ver** la historia | `/my-account/medical-record` (`features/account/medical-record/medical-record.ts`) | `GET /clinical/patients/:id/summary`, `GET /diagnostic-results/me(/orders)`, `GET /forms/me/instances(/:id)`, `GET /profiles/patients/me/dependents` | **Probable, sin confirmar.** D-3 tiene corrección en la API: `ClinicalRecordAccessGuard` delega en `assertPuedeLeerHistoria` y el paciente lee sólo la propia (`clinical/controllers/clinical-read.controller.ts:30-46`). Hay pruebas contra API real (`playwright/carril-j5-vertical-p0.spec.ts:51`, `cypress/e2e/real/02-paciente.cy.ts`), pero no se encontró evidencia de su última corrida. **No incluye** notas de evolución liberadas, documentos adjuntos ni procedimientos/vacunas (no hay escritura de esos datos en la UI). |
| 1b. Ver resultados de laboratorio | `/my-account/diagnostic-results` | `GET /diagnostic-results/me`, compartir/revocar | La pantalla existe, pero **nada en la UI produce lo que lee**: la API muestra sólo versiones liberadas con evento de liberación (`diagnostics/services/diagnostics-patient-results.service.ts:63-70`, `diagnostic_release_events`), que se crean por `POST /diagnostics/reports/:reportId/versions/:versionId/release` — **sin pantalla**. El `POST /clinical/diagnostic-reports/:id/release` que usa la consulta del médico marca el reporte como final pero no escribe ese evento (`clinical/services/diagnostic-reports.service.ts:102-160`): que lo liberado por el médico aparezca en «Mis resultados» está **sin confirmar**, probablemente no. Fuera de semillas, la lista queda vacía. |
| 2. **Descargar** | mismo | `GET /clinical/prescriptions/:id/pdf` (receta oficial, con prueba real `playwright/prescription-official-pdf.real.spec.ts`) · la historia completa y cada atención se arman **en el navegador** (`medical-record.ts:452-467`, `downloadHistoryPdf` de `shared/utils/clinical-pdf`) | Parcial. La historia descargada no es un documento emitido por el sistema (sin firma, sin notas ni adjuntos). No se usan `GET /charts/encounters/:id/pdf`, `GET /charts/documents/:documentId/files/:fileId/content`, `GET /fhir/r5/Patient/:id/$everything` ni `POST /privacy/dsar`. |
| 3. **Actualizar**: (a) el médico en cada atención | `/medical-records/:profileId/consultation` | condiciones, alergias, recetas (firma/emisión), observaciones, encuentros, episodios, reportes diagnósticos, notas, planes, documentos | Cubierto del lado del médico (45 endpoints). Faltan firmar/liberar la nota al paciente (UC-15-03/06), vacunas, procedimientos. Adjuntar a alergia/receta llama rutas **inexistentes** (`POST /clinical/allergy-intolerances/:id/attachments`, `POST /clinical/medication-requests/:id/attachments`). |
| 3. (b) el propio paciente | `/my-account/questionnaires` (aspectos médicos declarados) | `GET/PUT /clinical/me/medical-aspects` (`core/data-access/clinical/clinical.client.ts:133-160`) | **Roto contra la API real**: la ruta no existe en `dev` (grep sin resultados en `src/modules`); sólo la atiende el mock. |
| 4. **Laboratorios** aportan | ninguna del lado laboratorio | ver 1b | **No hay flujo.** La consola `administration/medical-laboratory` sólo gestiona oferta y precios; las altas `/auth/register/laboratory` y `/auth/register/imaging-center` «cierran con una solicitud, no con una cuenta» (`app.routes.ts:1974-2006`). |
| 4. **Hospitales** aportan | ninguna | `organization_extensions` 9/9 sin UI | **No hay flujo.** El único aporte «hospitalario» es el episodio de internación que abre el médico desde la consulta (`POST /clinical/care-episodes`). No existe tipo de organización hospital operable desde la UI ni importación externa (`health_data` 16/16 sin UI). |
| Transversal | toda la rama | — | La demo de `mockup` corre sobre el mock (`environment.ts:65`); ningún paso se demuestra contra la API en esa superficie. Para probar contra la API existe la configuración `real-api` (`angular.json:123-128`, `environment.real-api.ts:44`). |

**Veredicto D: el flujo NO está completo de punta a punta contra la API real.** Ver: probable (sin confirmar en runtime). Descargar: parcial (receta sí; historia = PDF del cliente). Actualizar por el paciente: roto (ruta inexistente). Labs: sin flujo. Hospitales: sin flujo.

---

## Hallazgos

Severidad: **Bloqueante demo** · **Alta** · **Media** · **Baja**. Evidencia `archivo:línea` relativa a cada repo (front = `mantra-core-health/`, API = `mantra-core-health-redesa-api/`).

### CV-01 · La autodeclaración de salud del paciente llama una ruta que la API no tiene — **Bloqueante demo**
- **Evidencia:** front `src/app/core/data-access/clinical/clinical.client.ts:133-160` (`GET/PUT /clinical/me/medical-aspects`); consumido por `/my-account/questionnaires`; `brecha/mock-missing.json` (handler sólo en `core/mock/handlers/clinical.handlers.ts`); API: `grep medical-aspects src/modules` → 0 resultados.
- **Qué hacer:** implementar en `clinical` (UC nuevo, con su `.puml` y DDL si hace falta una tabla) o reapuntar la pantalla a un recurso existente (p. ej. `forms/me/instances`). Decisión de producto primero; no inventar el contrato en el front.
- **Criterios:**
  ```gherkin
  Dado un paciente con sesión contra la API real (configuración real-api)
  Cuando abre /my-account/questionnaires y guarda sus aspectos médicos
  Entonces la API responde 200 a PUT /clinical/me/medical-aspects
  Y al recargar la página ve los valores guardados
  Y su médico los ve en /medical-records/:profileId
  ```

### CV-02 · El laboratorio no tiene cómo publicar un resultado: «Mis resultados» queda vacío fuera de semillas — **Bloqueante demo**
- **Evidencia:** API `src/modules/diagnostics/services/diagnostics-patient-results.service.ts:63-70` (sólo versiones con `diagnostic_release_events`); rutas sin pantalla `POST /diagnostics/reports/:reportId/versions` y `…/versions/:versionId/release`, `POST /diagnostics/specimens|accessions|work-orders` (`api-unused.json`); `src/modules/clinical/services/diagnostic-reports.service.ts:102-160` (la liberación clínica no escribe `diagnostic_release_events` — sin confirmar en runtime); front: ningún cliente llama `/diagnostics/reports`.
- **Qué hacer:** consola operativa del laboratorio (recepción de orden/muestra → cargar resultado → validar → liberar con visibilidad para el paciente); y confirmar en runtime si lo que libera el médico desde la consulta llega a `GET /diagnostic-results/me` — si no, unificar las dos liberaciones en la API.
- **Criterios:**
  ```gherkin
  Dado un laboratorio con una orden de un paciente
  Cuando el laboratorio carga el informe y lo libera como visible para el paciente
  Entonces POST /diagnostics/reports/:id/versions/:versionId/release responde 2xx
  Y el paciente ve el informe en /my-account/diagnostic-results al recargar
  Y puede descargar su archivo

  Dado un médico que emite y libera un reporte desde la consulta
  Cuando el paciente abre /my-account/diagnostic-results
  Entonces el reporte figura en la lista
  ```

### CV-03 · Laboratorios, centros de imagen y hospitales no pueden darse de alta ni operar — **Alta**
- **Evidencia:** front `src/app/app.routes.ts:1974-2006` («Todavía sin endpoint — cierra con una solicitud, no con una cuenta»); `POST /diagnostic-units` sin uso (`api-unused.json`); `organization_extensions` 9/9 sin UI; UC-22-01/02, UC-23-01/02 sin pantalla (`uc-sin.txt`).
- **Qué hacer:** conectar las dos altas públicas a `POST /diagnostic-units` (o a `register-organization` con tipo, como hizo la aseguradora); crear alta y consola de hospital sobre `/orgext/hospitals`.
- **Criterios:**
  ```gherkin
  Dado un visitante sin sesión
  Cuando completa /auth/register/laboratory y confirma
  Entonces se crea una unidad diagnóstica en la API y una cuenta dueña
  Y tras verificar el correo puede entrar a administration/medical-laboratory con su unidad

  Dado el administrador de un hospital
  Cuando activa el hospital y agrega una línea de servicio
  Entonces POST /orgext/hospitals/:id/activate y …/service-lines responden 2xx
  Y la línea figura al recargar
  ```

### CV-04 · La rama `mockup` nunca habla con la API: la demo no demuestra integración — **Alta** (Bloqueante si la demo se promete «contra la API real»)
- **Evidencia:** front `src/environments/environment.ts:65` (`mockBackend: true`, «no lee el entorno del proceso a propósito»); `environment.real-api.spec.ts:30` (producción también `true`); `ESTADO-FRONTEND.md:12` afirma lo contrario.
- **Qué hacer:** declarar explícitamente qué superficie de demo es mock y cuál es real; para la demo del propósito central, publicar un build `real-api` contra `dev` y correr los e2e reales (`cypress/e2e/real/*`, `playwright/*.real.spec.ts`) antes de afirmar nada. Actualizar `ESTADO-FRONTEND.md`.
- **Criterios:**
  ```gherkin
  Dado el build de demo publicado
  Cuando se abre la aplicación
  Entonces un indicador visible dice si los datos son simulados o reales
  Y el build del recorrido del paciente usa la configuración real-api
  Y cypress/e2e/real/02-paciente.cy.ts pasa contra ese despliegue
  ```

### CV-05 · 21 llamadas del front apuntan a rutas que la API `dev` no tiene — **Alta**
- **Evidencia:** `brecha/client-calls.json` (21 con `api: null`) y `brecha/mock-missing.json` (34 handlers). Lista: `GET/PUT /clinical/me/medical-aspects`; `POST /clinical/medication-requests/:id/attachments`; `POST /clinical/allergy-intolerances/:id/attachments`; `GET /community/conversations/:id`; `PATCH /forms/field-definitions/:id`; `PATCH|DELETE /forms/assignments/:id`; `PUT /forms/assignments/order`; `PATCH /profiles/practitioners/me/credentials/:id`; `PATCH|DELETE /profiles/practitioners/me/specialties/:id`; `PATCH|DELETE /profiles/practitioners/me/jurisdiction-authorizations/:id`; `GET /public/profiles/f/:slug/branch-availability`; `PATCH /surveys/templates/:id`; `PATCH|DELETE /surveys/templates/:id/questions/:questionId`; `PUT /surveys/templates/:id/questions/order`; `POST /v1/triage/analyze`; `POST /identity/verification-cases/:id/checks:plan` (probable coincidencia con `checks\:plan`). En el mock además: `POST /charts/notes/:id/versions` (la API es `PUT`), `POST /community/reactions` (API: `PUT`), `PATCH /notifications/preferences/me` (API: `PUT`), `POST /pharmacy/orders/:id/mark-ready|keep-original` (API: `ready|prefer-original`), `POST /procedure-cases/:id/team-members/:memberId/decline` (API: `respond`), `POST /scheduling/bookings/:id/payment-state` (API: `PUT`), `GET /public/profiles/o/:slug/services`, `GET /public/profiles/f/:slug/products|branches`, `POST /surveys/templates/:id/publish`.
- **Qué hacer:** por cada fila, o se implementa en la API (con modelo) o se corrige el cliente/mock para que use el verbo y la ruta reales. Agregar un chequeo en CI que falle si un handler del mock no casa con `api-routes`.
- **Criterios:**
  ```gherkin
  Dado el inventario de rutas de la API dev
  Cuando se corre el chequeo mock-vs-api
  Entonces 0 handlers del mock y 0 llamadas de cliente quedan sin ruta API
  ```

### CV-06 · La descarga de la historia es un PDF armado en el navegador, sin notas ni adjuntos — **Alta**
- **Evidencia:** front `src/app/features/account/medical-record/medical-record.ts:452-467` (`downloadHistoryPdf`); sin uso: `GET /charts/encounters/:id/pdf`, `GET /charts/documents/:documentId/files/:fileId/content`, `GET /fhir/r5/Patient/:id/$everything`, `POST /privacy/dsar` (`api-unused.json`).
- **Qué hacer:** definir con producto qué es «descargar mi historia» (documento emitido y verificable como la receta, o exportación FHIR/DSAR) y consumir el endpoint oficial; incluir notas liberadas y adjuntos.
- **Criterios:**
  ```gherkin
  Dado un paciente con dos atenciones, una nota liberada y un documento adjunto
  Cuando descarga su historia completa
  Entonces el archivo proviene de un endpoint de la API
  Y contiene las dos atenciones, la nota liberada y el enlace o contenido del adjunto
  Y el documento es verificable como la receta oficial
  ```

### CV-07 · Consentimiento (M07) sin ninguna pantalla — **Alta**
- **Evidencia:** `consent` 15/15 en `api-unused.json`; UC-07-01..10 sin pantalla (`uc-sin.txt`); bóveda `SALUD/Vistas/V07 consent — Vistas.md` (Fase 1, 9 vistas especificadas, «0 con listado real»); el front resuelve el vínculo médico-paciente con `authz/care-relationships/request` (`features/clinical-record/request-access`), no con `consent/practitioner-access-requests`, que queda huérfano.
- **Qué hacer:** «Mi privacidad» en Mi cuenta (consentimientos vigentes, retirar, autorizar divulgación, objetar); consentimiento informado en la consulta; decidir cuál de los dos mecanismos de solicitud de acceso es el canónico y retirar el otro. La API tampoco expone GET de listado de consentimientos (bóveda: «9 pendientes de GET de listado»): hace falta primero.
- **Criterios:**
  ```gherkin
  Dado un paciente con un consentimiento activo para un propósito
  Cuando lo retira desde Mi privacidad
  Entonces POST /consent/consents/:id/withdraw responde 2xx
  Y al recargar el consentimiento figura como retirado
  Y el acceso del médico basado en ese propósito se reevalúa
  ```

### CV-08 · Notas clínicas: no se firman, enmiendan ni liberan al paciente — **Alta**
- **Evidencia:** `chart` 10/19 sin UI: `POST /charts/notes/:noteId/versions/:versionId/sign|cosign`, `POST /charts/notes/:noteId/amendments`, `POST /charts/notes/versions/:versionId/release|withhold|exam-findings`, `GET /charts/notes` (`api-unused.json`); UC-15-03/05/06/07/08 sin pantalla.
- **Qué hacer:** firmar/enmendar en `/progress-notes` y en la consulta; «liberar al paciente» y su lectura en `/my-account/medical-record`.
- **Criterios:**
  ```gherkin
  Dado un médico con una nota en borrador
  Cuando la firma y la libera al paciente
  Entonces la nota queda sellada y no editable, y una enmienda crea un addendum
  Y el paciente la ve en Mi historia clínica al recargar
  ```

### CV-09 · Receta: sin renovar, reemplazar, invalidar ni editar borrador; políticas de firma sin administración — **Alta**
- **Evidencia:** `POST /clinical/medication-requests/:id/edit|invalidate|replace|renew`, `POST|GET /clinical/prescription-signature-policies` y `…/:id/deactivate` en `api-unused.json`.
- **Qué hacer:** acciones sobre la receta emitida en el expediente; pantalla de políticas de firma para el admin de organización (hoy las 27 políticas son semillas).
- **Criterios:**
  ```gherkin
  Dado una receta emitida
  Cuando el médico la invalida con un motivo
  Entonces la API responde 2xx y la receta figura invalidada para el médico y el paciente
  Y la verificación pública de la receta informa que no es válida
  ```

### CV-10 · Derivaciones y teleconsulta sin pantalla — **Alta**
- **Evidencia:** `POST|GET /referrals`, `PATCH /referrals/:id/respond`, `POST /virtual-encounters`, `PATCH /virtual-encounters/:id/join|end` (`api-unused.json`); UC-18-07, UC-18-12 sin pantalla; ningún archivo del front menciona `referrals` ni `virtual-encounters`.
- **Qué hacer:** «Derivar» en la rejilla de consulta y bandeja de derivaciones recibidas; teleconsulta desde la cita (médico y paciente).
- **Criterios:**
  ```gherkin
  Dado un médico en una consulta
  Cuando deriva al paciente a otro profesional
  Entonces el destinatario ve la derivación en su bandeja y puede aceptarla o rechazarla
  Y el paciente la ve en su historia
  ```

### CV-11 · Seguros: la cobertura del paciente y el ciclo del reclamo del lado aseguradora no tienen UI — **Media**
- **Evidencia:** `insurance` 20/40 sin UI (`POST /patient-coverages`, `/coverage-eligibility-requests`, `/prior-authorization-requests`, `/insurance-claims/:id/adjudications|eob|reversals`, `/claim-disputes/:id/appeal-decisions`, altas de carrier/producto/broker/red); UC-26-02/03/04/08; `INFORME_AVANCE_GLOBAL_Y_PROXIMOS_PASOS.md:97-99` (falta el GET de reclamos para el pagador).
- **Qué hacer:** «Mi cobertura» (paciente); adjudicar/EOB/apelación (aseguradora), en el orden del plan vigente (subtareas 6.3/6.4).
- **Criterios:**
  ```gherkin
  Dado un paciente con una aseguradora del catálogo
  Cuando registra su cobertura y la de un dependiente
  Entonces POST /patient-coverages responde 2xx y ambas figuran al recargar
  ```

### CV-12 · Facturación: única sección placeholder — **Media**
- **Evidencia:** front `src/app/core/navigation/navigation.map.ts:1038-1047` (`availability: 'planificada'`), `app.routes.ts:1102-1107` (cae en `SectionPlaceholder`); `billing` 13/18 sin UI.
- **Qué hacer:** facturar un encuentro, nota de crédito, estado de cuenta y plan de pagos, sin pasarela (excluida). Si no entra en la demo, sacar la entrada del menú en vez de mostrar un placeholder.
- **Criterios:**
  ```gherkin
  Dado un encuentro cerrado
  Cuando facturación emite la factura desde el encuentro
  Entonces POST /billing/invoices:issue-from-encounter responde 2xx
  Y la factura figura en /billing al recargar
  ```

### CV-13 · Cinco hubs de administración son menús de formularios de escritura sin ningún listado — **Media**
- **Evidencia:** `/administration/delegated-access`, `/identity-providers`, `/identity-assurance`, `/health-context`, `/geolocation`: 0 lecturas detectadas (`scratchpad/screens.json`); sus 61 pantallas de operación (`app.routes.ts:1549-1846`) son formularios `POST` que piden identificadores a mano; la bóveda anota «pendientes de GET de listado» (p. ej. V07/V29).
- **Qué hacer:** pedir a la API los GET de listado mínimos (delegaciones, proveedores, casos, contextos) y convertir los hubs en listados con acciones por fila.
- **Criterios:**
  ```gherkin
  Dado un administrador en /administration/delegated-access
  Cuando abre la sección
  Entonces ve la lista de delegaciones vigentes leída de la API
  Y puede revocar una desde su fila sin escribir su identificador
  ```

### CV-14 · Aprobación de médicos por la organización y gestión de miembros sin UI — **Media**
- **Evidencia:** `POST /role-assignments/:roleId/approve|reject|suspend|end` (practice) y `POST /tenants/:tenantId/memberships/:membershipId/transfer|offboard`, `PATCH …/role` (directory) en `api-unused.json`; el médico sí pide con `POST /practices/:practiceId/role-assignments/self-request` (`features/admin/medical-organization`). UC-04-07/08/09.
- **Qué hacer:** bandeja de solicitudes en la consola de la práctica; acciones de cambio de rol y baja en la ficha de organización.
- **Criterios:**
  ```gherkin
  Dado un médico que solicitó unirse a una práctica
  Cuando el administrador de la práctica aprueba la solicitud
  Entonces la asignación pasa a activa en la API
  Y el médico ve la práctica en «Mis organizaciones» al recargar
  ```

### CV-15 · Farmacia (comercio): promociones, ficha legal y factura sobre fixtures; sin alta de farmacia ni catálogo — **Media**
- **Evidencia:** `src/app/core/data-access/pharmacy-campaigns/pharmacy-campaigns.client.ts:10` y `:191-258` (`of(...)` desde fixtures); `src/app/features/organization/pharmacy-profile/pharmacy-profile.ts:32`; `features/account/pharmacy-orders/order-invoice/order-invoice.fixtures.ts`; sin UI: `POST /pharmacies`, `/pharmacies/:id/sites|products|price-lists`, `GET /pharmacy/orders/:id`, `GET /pharmacy-inventory/sites/:siteId/stock`; `promotions` 18/18.
- **Qué hacer:** alta y catálogo de farmacia contra `pharmacy`; ficha del pedido con `GET /pharmacy/orders/:id`; decidir si las campañas usan `POST /promotions` o se retiran. El checkout/pago queda fuera (excluido).
- **Criterios:**
  ```gherkin
  Dado el dueño de una farmacia registrada
  Cuando publica un producto con precio en una sede
  Entonces el producto aparece en /search/medications y en «dónde comprar mi receta»
  Y la ficha del pedido del paciente se lee de GET /pharmacy/orders/:id
  ```

### CV-16 · El menú de farmacia se ofrece a cualquier miembro de cualquier organización — **Media** (sin confirmar en navegador)
- **Evidencia:** `src/app/core/navigation/navigation.map.ts:1474-1532`: `administration/pharmacy-orders|pharmacy-campaigns|pharmacy-profile` con `roles: [ANY_ROLE]`, `requiresTenant: true`, `hiddenFor: ['PATIENT']` y ningún filtro por tipo de organización.
- **Qué hacer:** filtrar por tipo de tenant (farmacia) o por rol de farmacia; verificar con un admin de aseguradora y uno de laboratorio.
- **Criterios:**
  ```gherkin
  Dado el administrador de una aseguradora
  Cuando abre el menú lateral
  Entonces no ve «Pedidos de farmacia», «Promociones» ni «Ficha de la farmacia»
  Y si escribe /administration/pharmacy-orders es redirigido
  ```

### CV-17 · Visitador médico y laboratorio farmacéutico: 54 de 76 endpoints sin UI — **Media**
- **Evidencia:** `pharma_lab` 54/76 (`api-unused.json`); `/my-visits` sólo lista y cancela (`GET /visit-requests/mine`, `POST …/cancel`).
- **Qué hacer:** completar el carril 17: alta de visitadores y productos, material con aprobación, registro y calificación de la visita.
- **Criterios:**
  ```gherkin
  Dado un visitador con una visita aceptada por un médico
  Cuando registra la visita y el médico la confirma
  Entonces POST /visit-records y …/confirm responden 2xx
  Y el laboratorio ve la visita en su panel con la calificación del médico
  ```

### CV-18 · Agenda: sin negociación de horario, recordatorios ni reglas de confirmación — **Media**
- **Evidencia:** `POST /scheduling/bookings/:id/request-info|propose-schedule|reminders`, `/scheduling/confirmation-rules*` en `api-unused.json`; `POST /scheduling/appointments/walk-in` lo llama el cliente pero no lo atiende el mock (`brecha/cross2`).
- **Qué hacer:** acciones en la tarjeta de la solicitud de turno; pantalla de reglas de confirmación; agregar el handler de walk-in al mock.
- **Criterios:**
  ```gherkin
  Dado una solicitud de turno pendiente
  Cuando el médico propone otro horario
  Entonces el paciente recibe el aviso y puede aceptarlo desde Mis citas
  ```

### CV-19 · Accesos clínicos: el paciente no ve ni revoca quién accede a su historia; sin acceso de emergencia — **Media**
- **Evidencia:** `POST /authz/patients/:id/clinical-access-grants`, `DELETE /authz/clinical-access-grants/:grantId`, `POST /authz/patients/:id/break-the-glass` sin UI; sólo maqueta estática en `/accesos/*` (`features/alovida/accesos/`); UC-06-06/07/10.
- **Qué hacer:** «Quién ve mi historia» en Mi cuenta (listar relaciones de cuidado y accesos, revocar); acceso de emergencia auditado en el expediente.
- **Criterios:**
  ```gherkin
  Dado un paciente con un médico vinculado
  Cuando revoca el vínculo desde «Quién ve mi historia»
  Entonces el médico recibe 403 al abrir /medical-records/:profileId sin turno de hoy
  ```

### CV-20 · Verificación de la matrícula del médico sin UI — **Media**
- **Evidencia:** `POST /profiles/credentials/:credentialId/verify` en `api-unused.json`; el médico carga credenciales (`POST /profiles/practitioners/me/credentials`) pero nadie puede verificarlas desde la UI.
- **Qué hacer:** cola de verificación de credenciales para la plataforma (puede colgar de `identity-assurance`).
- **Criterios:**
  ```gherkin
  Dado un médico con una credencial cargada
  Cuando un verificador de la plataforma la aprueba
  Entonces la credencial figura verificada en la ficha pública del médico
  ```

### CV-21 · Documentación de estado desactualizada o contradictoria — **Baja**
- **Evidencia:** `ESTADO-FRONTEND.md:12` («nada está simulado», 2026-08-01) contra `environment.ts:65`; `ROUTE_HEALTH_MATRIX.md` (2026-08-15) lista rutas que hoy redirigen y su «ok» no mide contenido; `INFORME_AVANCE_GLOBAL_Y_PROXIMOS_PASOS.md` (2026-09-12) no menciona la historia del paciente.
- **Qué hacer:** regenerar la matriz (`yarn pw:rutas`) con estado de contenido, fechar `ESTADO-FRONTEND.md` como histórico y agregar el propósito central al plan.
- **Criterios:**
  ```gherkin
  Dado el repositorio front
  Cuando se lee el documento de estado vigente
  Entonces declara si la superficie usa mock o API y cuál es el estado del recorrido del paciente
  ```

### CV-22 · Seguridad de la cuenta: sin MFA, dispositivos ni «cerrar sesión en todos lados» — **Baja**
- **Evidencia:** `POST /iam/users/:id/mfa-factors`, `/devices`, `POST /iam/auth/logout-all` sin UI; `src/app/core/auth/auth.service.ts:134` usa `logout` y no `logout-all` a propósito; UC-01-03/05/08.
- **Qué hacer:** sección Seguridad en Ajustes.
- **Criterios:**
  ```gherkin
  Dado un usuario con dos sesiones abiertas
  Cuando elige «cerrar sesión en todos lados»
  Entonces la otra sesión recibe 401 en su próxima llamada
  ```

### CV-23 · Perioperatorio: la sección sólo gestiona el equipo quirúrgico — **Baja** (fase 3)
- **Evidencia:** `procedures_perioperative` 23/32 sin UI; `/interventions` consume 5 endpoints (listar casos y equipo, aceptar/responder).
- **Qué hacer:** planificar para fase 3; no bloquea la demo.
- **Criterios:**
  ```gherkin
  Dado un caso quirúrgico programado
  Cuando el equipo completa el checklist OMS por fases
  Entonces cada fase queda registrada y el caso no avanza sin la anterior
  ```

### CV-24 · Maquetas de la bóveda publicadas sin guard — **Baja**
- **Evidencia:** `src/app/features/alovida/alovida.routes.ts` (138 rutas, sin `canActivate`); `DESIGN_VIEW_INVENTORY.md` H-1 (ya marcadas con aviso).
- **Qué hacer:** mantener el aviso; considerar sacarlas del build de producción o ponerlas detrás de `canMatch` como el stock.
- **Criterios:**
  ```gherkin
  Dado un visitante sin sesión en el build de producción
  Cuando abre /personas/pacientes-listado
  Entonces no ve un padrón que parezca real (404 o aviso de maqueta a pantalla completa)
  ```

### CV-25 · Módulo `geo` con 11 pantallas construidas para un uso principalmente de delivery — **Baja** (informativo)
- **Evidencia:** `app.routes.ts:1801-1846`; README de `geo`: rastreo móvil, geocercas y viajes.
- **Qué hacer:** confirmar con producto si tiene uso fuera de delivery; si no, congelarlo (no invertir más) de acuerdo a la exclusión pedida.
- **Criterios:**
  ```gherkin
  Dado el alcance de lanzamiento sin delivery
  Cuando se revisa el menú de administración
  Entonces Geolocalización está oculta o justificada por un caso de uso no-delivery
  ```

### CV-26 · Grupos médicos: módulo REDESA completo en la API y sin ninguna pantalla — **Media** (alcance sin confirmar)
- **Evidencia:** `medical_groups` 8/8 sin UI; ningún archivo del front menciona `medical-groups`.
- **Qué hacer:** confirmar si entra en la demo; si entra, pantalla de grupo sobre un servicio del catálogo con roster y respuesta de invitación.
- **Criterios:**
  ```gherkin
  Dado un médico que arma un grupo sobre un servicio del catálogo
  Cuando invita a un colega por cargo
  Entonces el colega ve la invitación y puede aceptarla
  ```
