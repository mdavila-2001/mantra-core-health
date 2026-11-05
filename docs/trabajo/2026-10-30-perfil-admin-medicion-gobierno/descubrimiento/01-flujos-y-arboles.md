# 01 — Flujos de usuario y de datos: inventario, diagramas y árboles de decisión

- Fecha: 2026-10-30 · Peldaño: `DISCOVERED` (solo lectura de código; no se arrancó nada, no se corrió ningún test).
- Rutas: `API` = `/home/user/mantra-core-health-api` · `FRONT` = `/home/user/mantra-core-health` · `ATLAS` = `/home/user/pabloarauzcaballero/atlasadminportal`. Las rutas `src/modules/...` son de `API`.
- Convención de líneas: donde dice «inv.» la línea sale de `inventario/endpoints/*.json` (`codigo.fuente`), que apunta al **primer decorador** del handler, no al `@Post`. Donde el `@Post`/`throw` se leyó directamente, la línea es la exacta.
- No hay PII/PHI en este documento (solo rutas, nombres de tablas y de clases).

## 0. Hallazgo de partida: hay DOS fuentes de «flujos» en la API y no son lo mismo

| | Catálogo de flujos QA (`/admin/qa/flows*`) | Inventario del portal (`/admin/portal/flujos*`) |
|---|---|---|
| Qué es | Recorridos de usuario **curados a mano** en JSON, con ramas válidas/límite/inválidas y caso de prueba | Procesos **derivados del código** (controladores, servicios, tablas) con grafo y árbol por operación |
| Fuente | `src/modules/qa_lab/domain/flows/catalog/*.flow.json`, registrados en `domain/flows/index.ts:5-14` | `inventario/**` en `API` (291 archivos versionados, `git ls-files inventario`), servidos por `InventoryRepository` (`src/modules/data_catalog/infrastructure/repositories/inventory.repository.ts:1-80`) |
| Controlador | `src/modules/qa_lab/presentation/controllers/qa-lab-read.controller.ts:134-152` (`GET admin/qa/flows`, `GET admin/qa/flows/:flowId`; roles `QA_ADMIN, QA_ENGINEER, RELEASE_MANAGER, PLATFORM_ADMIN`, `:27-32`) | `src/modules/data_catalog/presentation/controllers/admin-portal.controller.ts:56-160` (`GET admin/portal/operaciones[/:id[/arbol]]`, `flujos`, `flujos/mapa`, `flujos/:codigo[/grafo]`, `linaje`) |
| Volumen hoy | **3 flujos** (1.3, 2.6, 2.7), 43 nodos | **74 procesos** (72 `MODULO` + 2 `CRITICO`), **1 642 operaciones**, 12 máquinas de estado |
| Front que ya lo pinta | `FRONT/src/app/features/admin/flows/*` (`flows.ts`, `flow-detail`, `flow-tree`) | `FRONT/src/app/features/admin/portal/{processes,process-diagram,operations,lineage,route-map}` |
| Qué NO trae | Tablas, servicios, repositorios, eventos | Ramas de negocio, casos válidos/límite/inválidos, quién llama desde qué pantalla |

Conteos del segundo salen de `inventario/flujos/procesos.json` (74 elementos), `inventario/endpoints/*.json` (1 642 operaciones) y `inventario/flujos/maquinas.json` (12 máquinas) — contados con un script ad hoc, no hay otro lugar donde estén escritos.

## 1. Flujos que ya expone la API (catálogo QA)

Forma de cada flujo (`FlowDetail`, `FRONT/src/app/core/data-access/admin-portal/flows.types.ts:139-153`; origen `qa-flows.service.ts:177-200`): `id, module, title, source, actors[], frontRoutes[], root, openQuestions[], counts, contract, qa, nodes[]`. Cada nodo: `kind (SCREEN|API_CALL|DECISION|OUTCOME), actor, uiRoute, endpoint{method,path,operationId,contract DECLARED|MISSING}, gap, effects[], sourceRef, branches[]`; cada rama: `kind (HAPPY_PATH=válido|EDGE=límite|NEGATIVE=inválido), condition, expected, next, loopsTo, reason, qaCase{método, ruta, estado esperado, observedOn, seeded, drifted, lastResult}` (`flows.types.ts:91-137`). La API **no** devuelve cuerpos ni cabeceras de los casos (`qa-flows.service.ts:93-99`).

| Id | Nombre | Módulo del Registro | Nodos | Llamadas API | `gap` (paso sin endpoint) | Ramas (válida/límite/inválida) | Ramas con caso / sin caso | Fuente |
|---|---|---|---|---|---|---|---|---|
| 1.3 | Agendar hora para consultas médicas | 1 · Paciente | 15 | 11 | 2 (`datos-facturacion`, `aviso-cupo-libre`) | 13 / 3 / 8 | 13 / 11 | `1.3.flow.json` (nodo `datos-facturacion` :353, `aviso-cupo-libre` :442) |
| 2.6 | Consulta y elaboración de la ficha médica (sin seguro) | 2 · Médico | 13 | 10 | 2 (`enlace-paciente` :104, `cronograma-medicamentos` :331) | 12 / 1 / 8 | 9 / 12 | `2.6.flow.json` |
| 2.7 | Facturación y/o pago por la consulta médica | 2 · Médico | 15 | 10 | 5 (`qr-monto-total` :38, `qr-coaseguro`, `comprobante-pago` :134, `datos-facturacion` :151, `programar-facturacion` :299) | 13 / 3 / 5 | 5 / 16 | `2.7.flow.json` |

(Conteos calculados leyendo los JSON; el README del módulo confirma «Hoy hay tres», `domain/flows/README.md:8`.)

**Observaciones sobre los 3 flujos (hipótesis a verificar, no hechos):**

1. El `gap` `qr-monto-total`/`comprobante-pago` de 2.7 puede estar desactualizado: la API sí monta `PUT /practitioners/me/sites/{siteId}/bank-qr` (`practice/controllers/practitioner-sites.controller.ts:169-185`, P33, el profesional fija su QR bancario por sede) y `POST /scheduling/bookings/{id}/payment-receipts` (+ `confirm`/`reject`; `scheduling/presentation/controllers/scheduling-bookings.controller.ts:313-406`, el paciente sube comprobante y el prestador lo confirma). No emiten «un QR por un monto», pero cubren parte del paso. Hay que contrastar con el texto del cliente antes de cambiar el `gap` (`docs/requisitos/REQUISITOS-CLIENTE-ALOVIDA.md:286-311` en `AlovidaPromptManager`).
2. El flujo 1.3 modela la reserva con `POST /scheduling/holds/{holdToken}/confirm`, pero el camino real del **paciente** es `POST /scheduling/holds/{holdToken}/request` (queda `PENDING_CONFIRMATION` hasta que el profesional acepta): `confirm` lo documenta el propio caso de uso como «entrada del mostrador» (`scheduling/application/bookings/use-cases/confirm-booking.use-case.ts:20-31`). Ver flujo C2 abajo.
3. La numeración `1.x/2.x` coincide con el orden de secciones del documento del cliente (Paciente: Registro `:50`, Registro con link `:87`, Agendar `:102`, Laboratorios `:113`, Recepción del link `:118`; Médico: Registro `:192`, Facturación `:229`, Horarios `:245`, Calendario `:250`, Recepción `:256`, Consulta `:273`, Facturación consulta `:286`; todo en `AlovidaPromptManager/docs/requisitos/REQUISITOS-CLIENTE-ALOVIDA.md`). El «Registro de procesos por módulo» de la bóveda no está en este workspace, así que **la numeración que propongo abajo para los flujos nuevos es deducida y no verificada** contra él.

## 2. Flujos reales que FALTAN en el catálogo (≥ 25, deducidos de controladores/servicios)

Leyenda de «Estado»: **EXISTE** = ya en el catálogo QA · **FALTA** = no está. «Ancla» = endpoint de entrada con su archivo:línea. El campo «Id propuesto» es la sección del Registro del cliente a la que corresponde cuando la hay (no verificado, ver punto 3 arriba); `—` = no hay sección del cliente, sería flujo técnico.

| Dominio | # | Flujo (de punta a punta) | Estado | Ancla (método ruta · archivo:línea) | Id propuesto |
|---|---|---|---|---|---|
| Identidad | I1 | Login, sesión, MFA opcional y bloqueo de cuenta | FALTA | `POST /iam/auth/login` · `iam/presentation/controllers/iam-auth.controller.ts:354` | — |
| Identidad | I2 | Registro de paciente con documento (cuenta usable al instante, correo opcional) | FALTA | `POST /iam/auth/register-patient` · `iam-auth.controller.ts:113` | 1.1 (`REQUISITOS…:50`) |
| Identidad | I3 | Verificación de correo, reenvío y activación con token de un solo uso | FALTA | `POST /iam/auth/verify-email` `:319`, `resend-verification` (inv. `:299`), `activate` (inv. `:332`) · `iam-auth.controller.ts` | 1.2 (`:87`) |
| Identidad | I4 | Registro de profesional + verificación de identidad y de licencia | FALTA | `POST /iam/auth/register-practitioner` (inv. `:266`); `POST /identity/me/practitioner/{identity,license}-verification` · `identity_assurance/controllers/identity-self-service.controller.ts:60,78` | 2.1 (`:192`) |
| Identidad | I5 | Refresh con rotación y detección de reuso; logout / logout-all | FALTA | `POST /iam/auth/token/refresh` · `iam-auth.controller.ts:424` (reuso detectado: `iam-auth.service.ts:655`) | — |
| Citas | C1 | Agendar consulta (búsqueda → cupo → hold → cita) | **EXISTE (1.3)** | `POST /scheduling/slots/{id}/holds` · `scheduling/presentation/controllers/scheduling.controller.ts:693` | 1.3 |
| Citas | C2 | Solicitud del paciente → aceptar / rechazar / proponer otro horario / pedir información | FALTA | `POST /scheduling/holds/{holdToken}/request` `scheduling.controller.ts:744`; `POST /scheduling/bookings/{id}/{accept,reject,propose-schedule,request-info}` (inv. `scheduling-bookings.controller.ts:156,233,212,184`) | 1.3 / 2.4 |
| Citas | C3 | Cancelar, reprogramar, no-show y liberación de cupo | FALTA | `POST /scheduling/bookings/{id}/cancel` (inv. `:500`), `reschedule` (inv. `:479`) · `scheduling-bookings.controller.ts` | 1.3 / 2.4 |
| Citas | C4 | Lista de espera → promoción por worker → aviso de cupo libre | FALTA (en 1.3 hay 2 nodos y 1 `gap`) | `POST /scheduling/waitlist` `scheduling.controller.ts:766`; `POST /scheduling/internal/promote-waitlist/{slotId}` (inv. `scheduling-internal.controller.ts:82`) | 1.3 |
| Citas | C5 | Comprobante de pago de la cita (subir → confirmar/rechazar) | FALTA | `POST /scheduling/bookings/{id}/payment-receipts` `scheduling-bookings.controller.ts:313`, `…/{receiptId}/confirm` `:384` | 2.7 |
| Citas | C6 | Check-in, inicio y término de la cita (máquina `BOOKING_TRANSITIONS`) | FALTA | `POST /scheduling/bookings/{id}/{check-in,start,complete}` (inv. `:522,434,458`) | 2.5 (`:256`) |
| Historia clínica | H1 | Consulta y ficha médica | **EXISTE (2.6)** | `POST /charts/notes` · `chart/controllers/chart-notes.controller.ts:99` | 2.6 |
| Historia clínica | H2 | Cierre sellado de la consulta (hash + aviso al paciente) | FALTA | `POST /clinical/encounters/{id}/close` · `clinical/controllers/clinical-encounters.controller.ts:107` → `clinical/services/encounters.service.ts:370-470` | 2.6 |
| Historia clínica | H3 | Nota: firmar, cofirmar, enmendar, liberar/retener al paciente | FALTA | `POST /charts/notes/{noteId}/versions/{versionId}/{sign,cosign}`, `…/amendments`, `versions/{versionId}/{release,withhold}` · `chart-notes.controller.ts:137,155,173,190,207` | 2.6 |
| Historia clínica | H4 | Solicitud de acceso del profesional al paciente → decisión del paciente → grant | FALTA | `POST /consent/practitioner-access-requests` `consent/controllers/practitioner-access-requests.controller.ts:36`, `…/{id}/decision` `:68` | — |
| Historia clínica | H5 | Retiro de consentimiento y revocación inmediata del acceso | FALTA | `POST /consent/me/consents/{id}/withdraw` · `consent/controllers/consent-me.controller.ts:83` | — |
| Historia clínica | H6 | Acceso de emergencia (break-the-glass) auditado | FALTA | `POST /authz/patients/{patientProfileId}/break-the-glass` · `authz/controllers/authz-clinical.controller.ts:61` | — |
| Farmacia | F1 | Receta (borrador → firma → emisión) | FALTA (en 2.6 son 2 nodos) | `POST /clinical/medication-requests` `clinical/controllers/clinical-records.controller.ts:227`, `…/{id}/issue` `:332` | 2.6 |
| Farmacia | F2 | Pedido de farmacia: crear → revisar → confirmar/sustituir → listo → dispensar con código de retiro | FALTA | `POST /pharmacy/orders` · `pharmacy_inventory/presentation/controllers/pharmacy-orders.controller.ts:94`; `…/{id}/dispense` `:345` | 3.2 (`:341`) |
| Farmacia | F3 | Inventario: reserva, recall, conteo y recepción de compras | FALTA | `POST /pharmacy/{pharmacyId}/reservations` · `pharmacy-inventory.controller.ts:84`; `POST /pharmacy/recall-holds` `:159` | 3.1 (`:315`) |
| Laboratorio | L1 | Orden clínica → recepción en laboratorio → muestra → resultado → liberación → paciente | FALTA (en 2.6 son 2 nodos) | `POST /clinical/service-requests` · `clinical/controllers/clinical-orders.controller.ts:82`; `POST /diagnostics/specimens` `diagnostics/controllers/diagnostics-specimens.controller.ts:57` | 1.4 (`:113`), 4.x (`:416`) |
| Laboratorio | L2 | Resultado crítico: detectar → acuse del clínico | FALTA | `POST /diagnostics/critical-results` `diagnostics-reports.controller.ts:79`, `…/{id}/acknowledge` `:95` | — |
| Laboratorio | L3 | Imagen / estudios (DICOMweb, dosis, calidad de datos) | FALTA | `POST /dicomweb/studies` · `diagnostics-imaging.controller.ts:110` | 5.x (`:454`) |
| Seguros | S1 | Elegibilidad → autorización previa → reclamo → adjudicación → EOB | FALTA | `POST /coverage-eligibility-requests` `insurance/presentation/controllers/coverage.controller.ts:101`; `POST /prior-authorization-requests` `prior-auth.controller.ts:96`; `POST /insurance-claims` `claims.controller.ts:100` | 2.7 (`:298`), 6.x (`:520`) |
| Seguros | S2 | Disputa y apelación de un reclamo | FALTA | `POST /insurance-claims/{id}/disputes` `claims.controller.ts:220`; `POST /claim-disputes/{id}/appeal-decisions` `appeals.controller.ts:37` | 6.x |
| Seguros | S3 | Aseguradora recibe reclamo y decide | FALTA | `POST /insurance/received-claims/{id}/decision` · `insurer-received-claims.controller.ts:96` | 6.x (`:547`) |
| Facturación/pagos | B1 | Facturación de la consulta (sin/con seguro) | **EXISTE (2.7)** | `POST /billing/simulated/charges/{chargeId}/payment` · `billing/controllers/billing-simulated.controller.ts:61` | 2.7 |
| Facturación/pagos | B2 | Pago por pasarela: intención → checkout → callback firmado → estado | FALTA | `POST /payments/intents` `payments/controllers/payments-intents.controller.ts:54`; `POST /payments/callbacks/{callbackPath}` `payments-operations.controller.ts:95` | pasarela (`:575`) |
| Contabilidad | B3 | Asiento contable: clasificar → aprobar → contabilizar → revertir | FALTA | `POST /accounting/journal-transactions` `accounting/controllers/accounting-ledger.controller.ts:189`, `…/{id}/{classify,approve,post,reverse}` (inv. `:232,268,286`) | — |
| Mensajería | M1 | Notificación: solicitud → outbox → relay → entrega → recibo del proveedor | FALTA | `POST /notifications/requests` `messaging/controllers/messaging.controller.ts:97`; `POST /internal/outbox/relay/run` (inv. `messaging-internal.controller.ts:78`); `POST /webhooks/providers/{providerCode}/receipts` (inv. `provider-webhooks.controller.ts:33`) | — |
| Mensajería | M2 | Conversación paciente–profesional (chat) | FALTA | `POST /community/conversations` `community/controllers/community-messaging.controller.ts:70`, `…/{id}/messages` `:86` | — |
| Comunidad | K1 | Publicación en grupo, reporte, cola de moderación, apelación | FALTA | `POST /community/groups/{groupId}/posts` `community-groups.controller.ts:164`; `POST /community/reports` `community-moderation.controller.ts:61` | — |
| Comunidad | K2 | Reseña de un profesional y su respuesta | FALTA | `POST /community/profiles/{profileId}/reviews` · `community-reviews.controller.ts:51` | — |
| Telemetría | T1 | Consentimiento de seguimiento → captura de eventos → cierre de sesión → embudos admin | FALTA | `POST /telemetry/tracking-consents` `telemetry/controllers/telemetry-consent.controller.ts:64`; `POST /telemetry/activity-events` `telemetry-events.controller.ts:45`; `GET /admin/analytics/overview` `telemetry-analytics.controller.ts:121` | — |
| Telemetría | T2 | Encuesta de satisfacción: invitación → respuesta | FALTA | `POST /surveys/me/invitations/{id}/responses` · `surveys/controllers/surveys-patient.controller.ts:61` | — |

Recuento: 31 flujos listados, 3 ya existen (C1, H1, B1), **28 faltan**. No se listaron módulos de plataforma (ERP, lakehouse, vector_rag, etc.: 74 procesos en `procesos.json`) porque no tienen recorrido de usuario final.

**Dos huecos del cliente sin ningún endpoint ancla encontrado:** «Compras de supermercados» (`REQUISITOS…:366`) y «Módulo de puntos/promociones» (`:373`, `:381`): existe `promotions` (20 operaciones en `procesos.json`) pero no se leyó su controlador; **no verificado** si cubre el recorrido.

---

## 3. Ocho flujos clave: flujo de datos + árbol de decisión

Cada par de diagramas: (a) **flujo de datos** cliente → endpoint → servicio → repositorio → tabla; (b) **árbol de decisión** con validación, autorización, errores del contrato y estados. Los nombres de clase y las tablas salen de `via` de `inventario/endpoints/*.json` (cadena de llamadas estática) y se cotejaron con el código donde hay `file:línea`. Una tabla con confianza `POR_TIPO`/`POR_SQL` (no `DIRECTA`) es inferencia estática; se marca.

### F1 · I1 — Login, sesión y bloqueo

**Datos**

```mermaid
flowchart LR
  A["Cliente web o móvil"] -->|"POST /iam/auth/login<br/>Throttle 10 por 60 s"| B["IamAuthController.login<br/>iam-auth.controller.ts:354-369"]
  B --> C["IamAuthService.login → performLogin<br/>iam-auth.service.ts:325, 351"]
  C --> D["CredentialsRepository.findActivePasswordByLoginIdentifier<br/>credentials.repository.ts:100-114"]
  D --> T1[("iam.authentication_credentials<br/>common.contact_points<br/>profiles.person_account_links")]
  C --> E["UsersRepository.findById"] --> T2[("iam.users")]
  C --> F["assertMfaChallenge<br/>iam-auth.service.ts:490"] --> T3[("iam.mfa_factors")]
  C --> G["mergeRoleCodes · loadActiveTenantIds · loadTenantDisplay"] --> T4[("authz.roles<br/>authz.user_role_assignments<br/>iam.user_global_roles<br/>directory.tenant_memberships<br/>directory.tenants")]
  C --> H["TokenService.issueSessionTokens + SessionsRepository.create + RefreshTokensRepository.create<br/>iam-auth.service.ts:414-445"] --> T5[("iam.sessions<br/>iam.refresh_tokens")]
  C --> I["SecurityEventsRepository.record<br/>SEC_LOGIN · iam-auth.service.ts:453"] --> T6[("iam.security_events")]
  C -.->|"contraseña mala"| J["handleFailedPassword<br/>iam-auth.service.ts:784-850"] --> T7[("iam.account_lockouts<br/>iam.sessions revocadas<br/>iam.refresh_tokens revocados<br/>iam.users estado USER_LOCKED")]
  B --> K["deliverTokens iam-auth.controller.ts:460<br/>cookie de refresh"] --> A
```

**Árbol de decisión**

```mermaid
flowchart TD
  S["POST /iam/auth/login"] --> V{"Cuerpo válido?<br/>LoginDto, lista blanca"}
  V -->|no| E400["400 VALIDATION_FAILED"]
  V -->|si| R{"Más de 10 por minuto desde la IP?"}
  R -->|si| E429["429 RATE_LIMITED"]
  R -->|no| SUB{"Hay documento o correo?<br/>iam-auth.service.ts:358-363"}
  SUB -->|no| E401a["401 Credenciales inválidas<br/>registra no-subject"]
  SUB -->|si| CRED{"Credencial activa con hash?<br/>:378-381"}
  CRED -->|no| E401b["401 Credenciales inválidas<br/>registra no-credential"]
  CRED -->|si| ACT{"Usuario ACTIVO?<br/>:385-388"}
  ACT -->|no, incluye bloqueado| E401c["401 Credenciales inválidas<br/>registra user-not-active"]
  ACT -->|si| PW{"argon2.verify ok?<br/>:393-398"}
  PW -->|no| FAIL["handleFailedPassword :784<br/>registra SEC_LOGIN_FAILED y cuenta fallos"]
  FAIL --> TH{"fallos >= lockThreshold?<br/>:806"}
  TH -->|si| LOCK["usuario USER_LOCKED + lockout + revoca sesiones y refresh<br/>:817-845"]
  TH -->|no| E401d["401 Credenciales inválidas"]
  LOCK --> E401d
  PW -->|si| MFA{"AUTH_MFA_CHALLENGE_ENABLED y factor verificado?<br/>:490-512"}
  MFA -->|"sin código"| E401e["401 MFA_REQUIRED"]
  MFA -->|"código malo"| E401f["401 MFA_INVALID + cuenta como fallo<br/>:521-523"]
  MFA -->|"no aplica o ok"| TX["Transacción: roles, tenants, tokens, sesión, refresh, lastLoginAt, SEC_LOGIN<br/>:402-470"]
  TX --> OK["200 accessToken, refreshToken, expiresAt + cookie"]
```

Notas: el mismo 401 «Credenciales inválidas» para cuatro causas distintas es deliberado (anti-enumeración; comentario en `iam-auth.service.ts:381`). Respuestas posibles del contrato: 200, 400 `VALIDATION_FAILED`, 401 `UNAUTHENTICATED`, 429 `RATE_LIMITED` (`inventario/endpoints/iam.json`, op `IamAuthController_login`). `iam.users` y `iam.account_lockouts` figuran como escritura con confianza `POR_TIPO` (inferencia), el resto `DIRECTA`.

---

### F2 · I2 — Registro de paciente

**Datos**

```mermaid
flowchart LR
  A["Formulario de registro"] -->|"POST /iam/auth/register-patient<br/>Throttle 10 por 60 s"| B["IamAuthController.registerPatient<br/>iam-auth.controller.ts:110-132"]
  B --> C["IamPatientSelfRegistrationService.registerPatient → performRegisterPatient<br/>iam-patient-self-registration.service.ts:155, 163"]
  C -->|"cerrojo por documento :176"| D["CredentialsRepository.lockSubjectForRegistration / findLivePasswordBySubject"] --> T1[("iam.authentication_credentials")]
  C -->|":201"| E["ProfilesRegistrationAdapter.assertIsAdministrativeArea"] --> T2[("terminology.value_sets<br/>value_set_versions<br/>value_set_members")]
  C --> F["Alta en una sola transacción :173"]
  F --> T3[("common.identifiers<br/>common.contact_points")]
  F --> T4[("profiles.persons<br/>profiles.person_profiles<br/>profiles.patient_profiles<br/>profiles.person_account_links")]
  F --> T5[("iam.users<br/>iam.authentication_credentials<br/>iam.user_global_roles<br/>iam.email_verifications<br/>iam.security_events")]
  F --> T6[("directory.tenant_memberships")]
  C -->|"FUERA de la transacción :499"| G["sendVerificationEmail :593 → MessagingEmailNoticeAdapter.enqueueEmail → NotificationsService.createRequest"] --> T7[("messaging.notification_requests<br/>message_channels · message_templates<br/>recipient_preferences")]
  G -.->|"outbox / relay (ver F-M1)"| H["Entrega del correo"]
```

**Árbol de decisión**

```mermaid
flowchart TD
  S["POST /iam/auth/register-patient"] --> V{"RegisterPatientDto válido?"}
  V -->|no| E400["400 VALIDATION_FAILED"]
  V -->|si| R{"Límite 10 por minuto?"}
  R -->|excedido| E429["429 RATE_LIMITED"]
  R -->|ok| L["Cerrojo por documento dentro de la transacción :176"]
  L --> DUP{"Ya hay credencial viva con ese documento?<br/>:177-193"}
  DUP -->|si| E409["409 NATIONAL_ID_ALREADY_REGISTERED"]
  DUP -->|no| AREA{"El departamento emisor pertenece al catálogo de áreas administrativas?<br/>:201"}
  AREA -->|no| E422["rechazo antes de escribir<br/>código exacto: no verificado"]
  AREA -->|si| W["Crea persona, perfil, paciente, vínculo, usuario, credencial, rol global, membresía, verificación"]
  W --> COMMIT["commit"]
  COMMIT --> MAIL{"Vino correo y hay token?<br/>:497-499"}
  MAIL -->|no| OK201a["201 emailVerificationSent=false"]
  MAIL -->|si| ENQ{"Se encoló el correo?<br/>:593-612"}
  ENQ -->|si| OK201b["201 emailVerificationSent=true"]
  ENQ -->|"falla mensajería"| OK201c["201 emailVerificationSent=false<br/>la cuenta NO se deshace y es usable"]
```

Notas: contrato 201, 400, 401, 409 `CONFLICT`, 422 `PRECONDITION_FAILED`, 429 (`inventario/endpoints/iam.json`, `IamAuthController_registerPatient`). El 401 aparece en el contrato aunque la ruta es `@Public()`; **no verificado** de dónde sale.

---

### F3 · C1 + C2 — Agendar cita (cupo, hold, solicitud, aceptación)

**Datos**

```mermaid
flowchart LR
  P["Paciente"] -->|"POST /scheduling/slots/{id}/holds"| C1["SchedulingController.placeHold<br/>scheduling.controller.ts:693"]
  C1 --> S1["SchedulingBookingsService.placeHold → PlaceHoldUseCase.execute<br/>place-hold.use-case.ts:50-160"]
  S1 -->|"antes de la tx :61"| A["BookingAccess.assertMayActForPatient"] --> T0[("profiles.patient_profiles<br/>patient_portal_proxies<br/>person_account_links")]
  S1 -->|"tx :64"| R1["SchedulingBookingsRepository.findSlotForUpdate :65<br/>createHold :136<br/>countActiveBookingsForPatient :115"]
  R1 --> T1[("scheduling.bookable_slots<br/>capacidad restante - 1")]
  R1 --> T2[("scheduling.slot_holds<br/>TTL 300 s por defecto")]
  S1 --> POL["SlotPolicyResolver.resolvePolicy :99"] --> T3[("scheduling.booking_policies<br/>scheduling.schedule_templates")]
  P -->|"POST /scheduling/holds/{holdToken}/request"| C2["scheduling.controller.ts:744"]
  C2 --> U2["RequestBookingUseCase.execute :54-61"]
  P2["Mostrador o agenda"] -->|"POST /scheduling/holds/{holdToken}/confirm"| C3["scheduling.controller.ts:715"]
  C3 --> U3["ConfirmBookingUseCase.execute :46"]
  U2 --> M["BookingMaterializer.materializeBooking<br/>booking-materializer.ts:96-276"]
  U3 --> M
  M --> T4[("scheduling.appointment_bookings<br/>scheduling.appointment_reminders<br/>clinical.appointments<br/>scheduling.slot_holds estado CONSUMED")]
  U2 --> N["notifier.notifyRequest (fuera de la tx)"] --> T5[("community.conversations<br/>messaging.notification_requests")]
  PR["Profesional"] -->|"POST /scheduling/bookings/{id}/accept / reject / propose-schedule"| C4["scheduling-bookings.controller.ts inv. :156 / :233 / :212"]
  C4 --> T6[("scheduling.appointment_bookings<br/>audit.appointment_bookings_history<br/>scheduling.booking_cancellations<br/>scheduling.booking_reschedules<br/>scheduling.waitlist_entries")]
  W["Worker"] -->|"POST /scheduling/internal/expire-holds"| C5["scheduling-internal.controller.ts inv. :47"] --> T1
```

**Árbol de decisión (reserva y solicitud)**

```mermaid
flowchart TD
  S["POST /scheduling/slots/{id}/holds"] --> AUTH{"Rol SCHEDULING_ADMIN, SCHEDULING_AGENT o PATIENT?<br/>y puede actuar por ese paciente?"}
  AUTH -->|no| E403["403 FORBIDDEN"]
  AUTH -->|si| SL{"Existe el slot? :66"}
  SL -->|no| E404["404 NOT_FOUND Slot no encontrado"]
  SL -->|si| REF{"slotHoldRefusal :71"}
  REF -->|BLOCKED| E422a["422 El slot está bloqueado"]
  REF -->|RETRACTED| E422b["422 Ese horario ya no está disponible"]
  REF -->|NO_CAPACITY| E409a["409 El slot no tiene cupos disponibles"]
  REF -->|libre| TM{"slotTimingRefusal :99"}
  TM -->|ALREADY_PASSED| E422c["422 Ese horario ya pasó"]
  TM -->|"antes del aviso mínimo"| E422d["422 pedir con minNoticeMinutes de anticipación"]
  TM -->|ok| MAX{"El paciente supera maxActivePerPatient? :113-130"}
  MAX -->|si| E409b["409 máximo de citas activas"]
  MAX -->|no| H["crea hold TTL 300 s y resta 1 a la capacidad :134-150"]
  H --> HOK["201 holdToken, expiresAt, remainingCapacity"]
  HOK --> SEL{"Quién cierra la reserva?"}
  SEL -->|"paciente: /request"| MAT
  SEL -->|"mostrador: /confirm"| MAT
  MAT{"materializeBooking: hold existe y está ACTIVO? :96-107"}
  MAT -->|no| E404b["404 / 409"]
  MAT -->|si| EXP{"hold vencido? :109"}
  EXP -->|si| E409c["409 La reserva temporal expiró"]
  EXP -->|no| PAST{"slot ya pasó? :129"}
  PAST -->|si| E422e["422 Ese horario ya pasó"]
  PAST -->|no| ST{"Estado destino"}
  ST -->|"/confirm"| CONF["CONFIRMED (booking) + cita BOOKED"]
  ST -->|"/request"| PEND["PENDING_CONFIRMATION + cita PENDING + chat y aviso al profesional"]
  PEND --> PROF{"Profesional decide"}
  PROF -->|accept| CONF
  PROF -->|reject| CAN["CANCELLED + libera cupo + puede promover lista de espera"]
  PROF -->|propose-schedule| REPROG["propone otro horario (booking_reschedules)"]
  CONF --> M2{"Máquina BOOKING_TRANSITIONS"}
  M2 --> ST1["CONFIRMED → CHECKED_IN | IN_PROGRESS | CANCELLED | NO_SHOW<br/>CHECKED_IN → IN_PROGRESS | CANCELLED | NO_SHOW<br/>IN_PROGRESS → COMPLETED<br/>terminales: COMPLETED, CANCELLED, NO_SHOW"]
```

Notas: la máquina de estados está en `scheduling/domain/booking/booking-state-machine.ts:33-61`; la reprogramación **no** es una transición (`:25-28`). El cupo se toma con `findSlotForUpdate` (nombre y comentario `place-hold.use-case.ts:65`); el `SELECT ... FOR UPDATE` literal vive en el repositorio y no se leyó. `confirm` y `request` terminan en el mismo `materializeBooking` y difieren solo en el estado (`confirm-booking.use-case.ts:46-60` vs `request-booking.use-case.ts:54-61`).

---

### F4 · H1 + H2 + F1 — Consulta: nota, cierre sellado y receta

**Datos**

```mermaid
flowchart LR
  M["Médico"] -->|"POST /charts/notes"| N1["ChartNotesController.createNote<br/>chart-notes.controller.ts:99"]
  N1 --> N2["ChartNotesService.createNote<br/>valida encuentro escribible"] --> N3["ClinicalNotesRepository.createHeader / versión"] --> T1[("chart.clinical_note_headers<br/>chart.clinical_note_versions<br/>lee clinical.encounters")]
  M -->|"POST /clinical/medication-requests"| R1["ClinicalRecordsController.prescribeMedication<br/>clinical-records.controller.ts:227"]
  R1 --> R2["MedicationsService.prescribe :351 → versionRequest"] --> T2[("clinical.medication_requests<br/>audit.medication_requests_history")]
  M -->|"POST /clinical/medication-requests/{id}/issue"| R3["clinical-records.controller.ts:332"]
  R3 --> R4["MedicationsService.issue :544-640 → AuditTrailService.record"] --> T3[("clinical.medication_requests<br/>audit.audit_log<br/>audit.medication_requests_history")]
  R4 -->|"fuera de la tx"| R5["ClinicalNotificationsService.prescriptionIssued"] --> T4[("messaging.notification_requests<br/>in_app_notifications<br/>notification_deliveries")]
  M -->|"POST /clinical/encounters/{id}/close"| E1["ClinicalEncountersController.close<br/>clinical-encounters.controller.ts:107"]
  E1 --> E2["EncountersService.close<br/>encounters.service.ts:370-470"]
  E2 --> T5[("clinical.encounters (FINISHED, endAt, contentHash, sealedAt)<br/>clinical.encounter_participants<br/>clinical.encounter_locations")]
  E2 -->|"fuera de la tx :465"| E3["clinicalNotifications.encounterClosed"] --> T4
```

**Árbol de decisión (emitir receta y cerrar consulta)**

```mermaid
flowchart TD
  I["POST /clinical/medication-requests/{id}/issue"] --> RL{"Rol CLINICIAN o PRACTITIONER?"}
  RL -->|no| E403["403 FORBIDDEN"]
  RL -->|si| LD{"loadRequestForWrite: existe y puede escribir el historial?"}
  LD -->|no| E404["404 / 403"]
  LD -->|si| IDEM{"Misma clave de idempotencia y ya ISSUED? :555-562"}
  IDEM -->|si| OKR["200 repite el resultado sin escribir"]
  IDEM -->|no| DR{"Estado = DRAFT? :565"}
  DR -->|no| E422a["422 MEDICATION_REQUEST_NOT_ISSUABLE"]
  DR -->|si| KEY{"La clave ya emitió otra receta? :575-585"}
  KEY -->|si| E409["409 MEDICATION_ISSUE_IDEMPOTENCY_KEY_CONFLICT"]
  KEY -->|no| SIG{"Sin firma y la política del tenant exige firma? :590-602"}
  SIG -->|si| E422b["422 MEDICATION_SIGNATURE_REQUIRED"]
  SIG -->|no| ISS["ISSUED + issuedAt + auditoría + versión :606-625"]
  ISS --> NOTI["aviso al paciente fuera de la tx"]
  C["POST /clinical/encounters/{id}/close"] --> C1{"Existe el encuentro? :382"}
  C1 -->|no| E404b["404 ENCOUNTER_NOT_FOUND"]
  C1 -->|si| C2{"assertCanWriteHistory? :391"}
  C2 -->|no| E403b["403 FORBIDDEN"]
  C2 -->|si| C3{"Estado = IN_PROGRESS? :395"}
  C3 -->|no| E422c["422 ENCOUNTER_NOT_IN_PROGRESS"]
  C3 -->|si| C4{"expectedRowVersion coincide? :406"}
  C4 -->|no| E409b["409 ENCOUNTER_VERSION_MISMATCH / CONCURRENCY_CONFLICT"]
  C4 -->|si| C5["FINISHED + cierra participantes y ubicaciones + hash de sellado :420-446"]
  C5 --> C6["aviso «tu consulta está disponible» fuera de la tx :465"]
```

Notas: `POST /charts/notes` y `/clinical/encounters/{id}/close` exigen `CLINICIAN` o `PRACTITIONER` (inv.). La cadena exacta de decisiones de `createNote` solo se leyó hasta `assertEncounterBelongsToPatientAndWritable` (`chart-notes.service.ts:~97-105`); sus códigos de error: contrato 400, 401, 403, 404, 422, 429 (`inventario/endpoints/chart.json`). Receta: contrato 400, 401, 403, 404, 409, 422, 429 y **500 `INTERNAL`** (inv. `clinical.json`; el 500 declarado en `issue` y `prescribe` es un defecto del contrato a revisar, no se investigó la causa).

---

### F5 · F2 — Pedido de farmacia hasta la dispensación

**Datos**

```mermaid
flowchart LR
  P["Paciente"] -->|"POST /pharmacy/orders"| A["PharmacyOrdersController.create<br/>pharmacy-orders.controller.ts:94"]
  A --> B["PharmacyOrdersService.create → PharmacyOrdersUseCases.create<br/>pharmacy-orders.use-cases.ts:367"]
  B -->|":395 :408 :429"| LK["lee sede, receta propia, productos vendibles"] --> TL[("pharmacy.pharmacy_sites<br/>pharmacy.pharmacy_products<br/>pharmacy.pharmacy_price_lists<br/>clinical.medication_requests")]
  B -->|"precio congelado al crear"| RS["reserva de stock"] --> TR[("pharmacy_inventory.inventory_reservations<br/>inventory_reservation_lines<br/>inventory_stock_positions<br/>inventory_ledger_entries")]
  B --> OB["MessagingDomainEventAdapter.publish → OutboxService.publishDomainEvent"] --> TO[("messaging.domain_events<br/>messaging.outbox_messages")]
  S["Personal de farmacia"] -->|"POST /pharmacy/orders/{id}/confirm / ready / reject / dispense"| C["pharmacy-orders.controller.ts:224 / 320 / 294 / 345"]
  C --> D["PharmacyOrdersUseCases.confirm :901 · ready :1286 · reject :1215 · dispense :1388"]
  D --> TR
  D --> TD2[("pharmacy_inventory.medication_dispensations<br/>medication_dispensation_lines<br/>pharmacy_order_substitutions")]
  D --> OB
  D -->|"avisos"| NT["PharmacyOrderNotificationsService → NotificationsService.emitInApp → WebPushService.pushToUser"] --> TN[("messaging.in_app_notifications<br/>notification_requests<br/>iam.devices (suscripciones web push)")]
```

**Árbol de decisión (dispensar y transiciones)**

```mermaid
flowchart TD
  D["POST /pharmacy/orders/{id}/dispense"] --> RL{"Rol SECURITY_ADMIN o PHARMACY_STAFF?"}
  RL -->|no| E403["403 FORBIDDEN"]
  RL -->|si| LD{"Pedido de ESTE tenant (bloqueo for update)? loadTenantOrderForUpdate :1390"}
  LD -->|no| E404["404 Pedido no encontrado"]
  LD -->|si| IK{"idempotencyKey ya usada? :1398-1411"}
  IK -->|"mismo pedido"| OKI["200 sin reescribir"]
  IK -->|"otro pedido"| E409["409 clave ya usada para otra entrega"]
  IK -->|nueva| ST{"Estado = LISTO_PARA_RETIRO? :1416"}
  ST -->|no| E422a["422 Solo un pedido listo para retiro puede dispensarse"]
  ST -->|si| PC{"pickupCode coincide? :1430"}
  PC -->|no| E422b["422 PICKUP_CODE_MISMATCH, el pedido no se modificó"]
  PC -->|si| LN{"Productos pedidos con saldo en pie? :1457"}
  LN -->|no| E422c["422 productos sin saldo"]
  LN -->|si| ANY{"Hay saldo que entregar? :1467"}
  ANY -->|no| E422d["422 El pedido no tiene saldo en pie"]
  ANY -->|si| OKD["200: registra entrega, descuenta stock, ledger, evento outbox, aviso al prescriptor"]
  TR["Transiciones de personal ORDER_STAFF_TRANSITIONS :169-199"] --> T1["ENVIADO → EN_REVISION | CONFIRMADO | ACEPTACION_PENDIENTE | RECHAZADO"]
  TR --> T2["EN_REVISION → CONFIRMADO | ACEPTACION_PENDIENTE | RECHAZADO"]
  TR --> T3["CONFIRMADO → LISTO_PARA_RETIRO | RECHAZADO"]
  TR --> T4["ACEPTACION_PENDIENTE → RECHAZADO · ACEPTADO → LISTO_PARA_RETIRO | RECHAZADO"]
  TR --> X["transición fuera de la tabla → 422 La transición no es legal :2072-2084"]
```

Notas: el código de retiro tiene 6 caracteres y alfabeto de 31 símbolos, unicidad por sede con índice parcial (`pharmacy-orders.use-cases.ts:95-130`). El estado `LISTO_PARA_RETIRO → ENTREGADO` no aparece en `ORDER_STAFF_TRANSITIONS`: la dispensación lo hace por otra vía (**no verificado** dónde se fija el estado final). `POST /pharmacy/{pharmacyId}/dispensations` (`pharmacy-dispensing.controller.ts:38`) es una segunda puerta de dispensación solo para `SECURITY_ADMIN`: dos caminos para el mismo hecho, a revisar.

---

### F6 · L1 — Laboratorio: de la orden clínica a la liberación del informe

**Datos**

```mermaid
flowchart LR
  M["Médico"] -->|"POST /clinical/service-requests"| A["ClinicalOrdersController.createServiceRequest<br/>clinical-orders.controller.ts:82"]
  A --> B["ServiceRequestsService.create<br/>service-requests.service.ts:254-380"]
  B --> B1["assertEncounterBelongsToPatient :269 · basedOnNotes.assertUsable :272<br/>performerSelection.resolve :291 · resolveDuplicateDecision :300"]
  B1 --> T1[("clinical.service_requests<br/>clinical.service_request_notes<br/>lee billing.service_catalog · diagnostic_reports")]
  B --> OB["OutboxService.publishDomainEvent ServiceRequestPlaced :356"] --> T2[("messaging.domain_events<br/>messaging.outbox_messages")]
  B --> NO["serviceRequestPlaced :374 (campana del paciente)"] --> T3[("messaging.in_app_notifications<br/>notification_requests")]
  L["Personal de laboratorio · LabStaffGuard"] -->|"POST /diagnostics/service-requests/inbox (solo lee)"| R["diagnostics-reception.controller.ts:38"]
  L -->|"POST /diagnostics/specimens :57 · /accessions :104 · /work-orders (lab:75)"| S["diagnostics-specimens / diagnostics-lab controllers"] --> T4[("diagnostics.specimens<br/>laboratory_accessions<br/>laboratory_work_orders<br/>laboratory_work_order_tests")]
  L -->|"POST /diagnostics/results/{observationId}/verifications<br/>diagnostics-lab.controller.ts:128"| V["verifica resultado"] --> T5[("diagnostics.result_verifications")]
  K["Clínico"] -->|"POST /diagnostics/reports/{reportId}/versions :44, …/{versionId}/release :61"| RL["DiagnosticsReportsService.releaseVersion :141-205"]
  RL --> T6[("diagnostics.diagnostic_report_versions<br/>diagnostics.diagnostic_release_events<br/>clinical.diagnostic_reports (versión liberada, visibilidad)")]
  PA["Paciente"] -->|"GET /diagnostics/patients/{id}/orders"| PR["diagnostics-patient-results.service.ts:303 releasedReportByOrder"]
```

**Árbol de decisión (liberar versión del informe)**

```mermaid
flowchart TD
  R["POST /diagnostics/reports/{reportId}/versions/{versionId}/release"] --> RL{"Rol CLINICIAN o PRACTITIONER? (inv.)"}
  RL -->|no| E403["403 FORBIDDEN"]
  RL -->|si| SC{"scope.report: el informe es de este ámbito? :150"}
  SC -->|no| E404a["404"]
  SC -->|si| VER{"La versión pertenece al informe? :153-163"}
  VER -->|no| E404b["404 Versión de informe no encontrada"]
  VER -->|si| EL{"releaseEligibility = ELIGIBLE? :164-168"}
  EL -->|no| E422["422 La versión no es elegible para liberación"]
  EL -->|si| FIN{"Ya está FINAL? :169-173"}
  FIN -->|si| E409["409 La versión ya fue liberada"]
  FIN -->|no| VIS{"patientVisibility HIDDEN o VISIBLE :175-179"}
  VIS --> EVT["registra evento de liberación + versión FINAL + issuedAt + informe apunta a la versión liberada :181-205"]
  EVT --> OK["200 id y estado"]
  CR["Resultado crítico: POST /diagnostics/critical-results"] --> DUPC{"Ya hay notificación crítica para la observación? :236"}
  DUPC -->|si| E409b["409 Ya existe una notificación crítica"]
  DUPC -->|no| PEND["crea notificación CRITICAL_PENDING con vencimiento de escalamiento"]
  PEND --> ACK["POST …/{id}/acknowledge (clínico) → 200, o 409 si ya estaba acusada"]
```

Notas: los controladores de recepción, muestras y laboratorio **no** tienen `@Roles` sino `@UseGuards(LabStaffGuard)` a nivel de clase (`diagnostics-specimens.controller.ts:46`, `diagnostics-lab.controller.ts:45`, `diagnostics-reception.controller.ts:23`; guard en `diagnostics/guards/lab-staff.guard.ts:63`). El árbol que sirve el portal para `POST /diagnostics/specimens` dice «Sin @Roles en el controlador (si hay regla de acceso, vive en el servicio)» (`inventario/arboles/diagnostics.json`): el árbol **no ve el guard**. La orden `ServiceRequestPlaced` y el aviso al paciente se emiten dentro de la transacción (`service-requests.service.ts:356-380`). Nota de contrato: `POST /diagnostics/service-requests/inbox` es `POST` pero no escribe (inv.: `ESCRIBE []`).

---

### F7 · B1 + B2 — Cobro de la consulta y pago por pasarela

**Datos**

```mermaid
flowchart LR
  P["Paciente"] -->|"POST /billing/simulated/charges/{chargeId}/payment"| A["BillingSimulatedController.payment<br/>billing-simulated.controller.ts:61"]
  A --> B["BillingSimulatedService.registerPayment<br/>billing-simulated.service.ts:609-690"]
  B -->|"1 cuenta por cobrar"| C["InvoicesService.issueFromEncounter"] --> T1[("billing.invoices<br/>billing.invoice_lines<br/>billing.billing_document_links")]
  B -->|"2 pago real asignado"| D["PaymentsReceivedService.apply"] --> T2[("billing.payments_received<br/>billing.receivable_payment_allocations")]
  G["Pasarela"] -->|"POST /payments/callbacks/{callbackPath}<br/>público, firma HMAC"| E["PaymentsOperationsController.applyCallback<br/>payments-operations.controller.ts:95-112"]
  E --> F["PaymentsTransactionsService.applyCallback :261-420"]
  F --> T3[("payments.payment_transactions<br/>payments.payment_intents<br/>payments.payment_webhook_events")]
  F -->|"estado nuevo"| H["decideCallback / payment-callback-machine.ts:43"]
  T2 -.->|"post-to-ledger (manual)"| L["POST /billing/documents/{id}:post-to-ledger<br/>billing-operations.controller.ts:60"] -.-> LG[("asientos: accounting.*, nombres no verificados")]
```

**Árbol de decisión (registrar pago y callback)**

```mermaid
flowchart TD
  S["POST /billing/simulated/charges/{chargeId}/payment"] --> EN{"Simulador habilitado? ensureEnabled :613"}
  EN -->|no| E404x["rechazo (código no verificado)"]
  EN -->|si| MT{"methodCode en el catálogo simulado? :615-623"}
  MT -->|no| E400["400 Método de pago inválido"]
  MT -->|si| CH{"El cobro existe en el alcance del usuario? :624"}
  CH -->|no| E404["404"]
  CH -->|si| PD{"Ya está pagado? :625"}
  PD -->|si| E409["409 ALREADY_PAID"]
  PD -->|no| PR{"Total y saldo mayores que cero? :630"}
  PR -->|no| E422["422 PRICE_NOT_DEFINED, definir el precio del servicio"]
  PR -->|si| REC{"Existe cuenta por cobrar? :638"}
  REC -->|no| ISS["emite factura real desde el encuentro, moneda BOB"]
  REC -->|si| APPLY
  ISS --> APPLY["aplica el pago real con referencia SIAT-SIM:MP:código :661-675"]
  APPLY --> OK["201 vista del cobro"]
  CB["POST /payments/callbacks/{callbackPath}"] --> TX{"Existe la transacción por gatewayTransactionRef? :276-281"}
  TX -->|no| E404b["404 GATEWAY_TRANSACTION_REF_NOT_FOUND"]
  TX -->|si| SG{"Firma HMAC válida con el secreto de la conexión? :295-322"}
  SG -->|no| E401a["401 firma inválida (cierra en falla)"]
  SG -->|si| EP{"Endpoint, IP de origen y ventana de repetición permitidos? :334-352"}
  EP -->|no| E401b["401 Callback no autorizado para este endpoint"]
  EP -->|si| DEC{"decideCallback(estado actual, estado reportado) :363"}
  DEC -->|aplicar| UPD["transición válida: PROCESSING → AUTHORIZED | CAPTURED | FAILED; AUTHORIZED → CAPTURED | FAILED; CAPTURED → SETTLED"]
  DEC -->|duplicado| DUP["200 duplicate=true, sin reaplicar efectos"]
  DEC -->|obsoleto| OBS["200 applied=false, se ignora el evento atrasado"]
  DEC -->|contradiccion| CON["200 reconciliationRequired=true, queda archivado sin procesar"]
```

Notas: el cobro de la consulta **hoy es simulado**: ruta `/billing/simulated/*`, `ensureEnabled()` y referencia `SIAT-SIM`, pero escribe en tablas reales de facturación (comentario `billing-simulated.service.ts:660`: «El pago REAL, asignado a esa cuenta por cobrar»). El inbox del webhook archiva el hecho verificado antes de decidir (`payments-transactions.service.ts:372-390`). Máquina `payments.TRANSITIONS`: `payments/services/payment-callback-machine.ts:43` (6 estados, 6 transiciones, `maquinas.json`). La API no tiene un endpoint que ligue la pasarela con el cobro de la consulta: **no verificado** cómo se une `payments.payment_intents` con `billing.payments_received`.

---

### F8 · S1 — Seguros: reclamo (837) sobre un servicio

**Datos**

```mermaid
flowchart LR
  F["Facturación o finanzas"] -->|"POST /insurance-claims"| A["ClaimsController.submit<br/>claims.controller.ts:100-111"]
  A --> B["ClaimsService.submitClaim<br/>claims.service.ts:81-260"]
  B -->|"cobertura :154 · plan :165"| C["CoverageRepository.findCoverage · InsuranceCatalog.findPlanForCarrier"] --> T1[("insurance.patient_coverages<br/>insurance.insurance_plans")]
  B -->|":159"| D["ClaimCareRelationshipGate.assertCareRelationship"] --> T2[("authz.care_relationships")]
  B -->|":183"| E["validatePriorAuthorization"] --> T3[("insurance.prior_authorization_requests")]
  B -->|":184"| F2["ClaimCoveragePolicy.evaluate (parte del paciente por línea)"] --> T4[("insurance.benefits y reglas del plan (nombres no verificados)")]
  B -->|":213"| G["ClaimRepository.createClaim / createLine · estado CLAIM_SUBMITTED"] --> T5[("insurance.insurance_claims<br/>insurance.insurance_claim_lines")]
  H["Aseguradora o conciliación"] -->|"POST /insurance-claims/{id}/adjudications :150"| I["ClaimsService.adjudicate"] --> T6[("insurance.claim_adjudication_versions<br/>insurance.claim_line_adjudications")]
  H -->|"…/eob :168 · …/reversals :186 · …/disputes :220 · …/patient-invoice :125"| J["EOB, reversa, disputa, factura al paciente"]
```

**Árbol de decisión (enviar el reclamo)**

```mermaid
flowchart TD
  S["POST /insurance-claims"] --> AU{"Autorización: @Roles() vacío en el método (:106); el servicio exige membresía OWNER/ADMIN por origen"}
  AU -->|no| E403["403 FORBIDDEN"]
  AU -->|si| LK{"El reclamo viene de un pedido vinculado? (reserva de farmacia o service request) :86"}
  LK -->|si| AD["assertAdministrator :89"]
  LK -->|no| PS["assertProviderClaimScope :90"]
  AD --> ONE{"Trae reserva Y service request a la vez? :92-93"}
  PS --> ONE
  ONE -->|si| E422a["422 Un reclamo sólo puede representar un pedido"]
  ONE -->|no| SEQ{"lineSequence repetidas? :98-100"}
  SEQ -->|si| E422b["422 secuencias de líneas únicas"]
  SEQ -->|no| BRANCH{"Vinculado?"}
  BRANCH -->|si| CAN{"El pedido está confirmado y sin sustituciones pendientes? :126"}
  CAN -->|no| E422c["422 debe estar confirmado y sin sustituciones"]
  CAN -->|si| ACTV{"Ya hay reclamo activo del pedido? :145"}
  ACTV -->|si| E409a["409 El pedido ya tiene un reclamo activo"]
  ACTV -->|no| PA["validatePriorAuthorization :147"]
  BRANCH -->|no| COV{"Existe la cobertura? :154"}
  COV -->|no| E404["404 Cobertura no encontrada"]
  COV -->|si| CARE{"Relación asistencial vigente? :159"}
  CARE -->|no| E403b["403"]
  CARE -->|si| PLAN{"La cobertura es de esa aseguradora? :172"}
  PLAN -->|no| E422d["422 no corresponde a la aseguradora indicada"]
  PLAN -->|si| IDK{"idempotencyKey repetida? :176-179"}
  IDK -->|si| E409b["409 Reclamo duplicado"]
  IDK -->|no| PA
  PA --> POL["evalúa cobertura por línea y fija la parte del paciente"]
  POL --> CR["crea reclamo SUBMITTED + líneas → 201"]
  CR --> NEXT["adjudicación → ADJUDICATED · reversa → REVERSED (estados INS.CLAIM_*, :213 y :517)"]
```

Notas: **no hay máquina de estados del reclamo en el inventario**: `insurance.TRANSITIONS` de `maquinas.json` es la de *campañas* (`DRAFT→ACTIVE→PAUSED/EXPIRED`, `insurance-campaigns.service.ts:124-131`), no la del reclamo; el árbol del reclamo se dedujo solo de `submitClaim` y de los usos de `INS.CLAIM_SUBMITTED/ADJUDICATED/REVERSED` (`claims.service.ts:213, 517-518`). Contrato de `POST /insurance-claims`: 201, 400, 401, 403, 404, 409, 422, 429. Discrepancia: el inventario muestra roles `BILLING, FINANCE` para esta ruta (`inventario/endpoints/insurance.json`) pero el método declara `@Roles()` vacío (`claims.controller.ts:106`); **no verificado** si un `@Roles()` vacío anula o hereda los de clase (`:59`).

---

### Extra · H4 + H5 — Consentimiento: solicitud de acceso del profesional y retiro

**Datos**

```mermaid
flowchart LR
  PR["Profesional"] -->|"POST /consent/practitioner-access-requests"| A["PractitionerAccessRequestsController.request<br/>practitioner-access-requests.controller.ts:36"]
  A --> B["PractitionerAccessRequestsService.request :73-130"] --> T1[("consent.consents (ACCESS_REQUEST_PENDING)<br/>consent.consent_provisions<br/>consent.consent_events<br/>audit.audit_log")]
  B --> N["aviso in-app al paciente"] --> T2[("messaging.notification_requests<br/>in_app_notifications")]
  PA["Paciente titular"] -->|"POST …/{id}/decision :68"| C["PractitionerAccessRequestsService.decide :207-330"]
  C -->|"aceptar"| T3[("authz.clinical_access_grants (vigencia en meses)<br/>consent.consents → ACTIVE")]
  PA -->|"POST /consent/me/consents/{id}/withdraw consent-me.controller.ts:83"| W["ConsentsService.withdrawAsOwner → withdrawScoped"] --> T4[("consent.consent_events<br/>authz.clinical_access_grants (revokeForConsent)<br/>audit.audit_log")]
  PDP["Cada acceso posterior a PHI"] --> Z["authz-pdp.service.ts evalúa: rol, grant vigente, relación asistencial y nivel de acción"]
```

**Árbol de decisión (decisión del paciente)**

```mermaid
flowchart TD
  S["POST /consent/practitioner-access-requests/{id}/decision"] --> RL{"Rol PATIENT?"}
  RL -->|no| E403["403 FORBIDDEN"]
  RL -->|si| EX{"La solicitud existe y es de categoría acceso de profesional? :222-228"}
  EX -->|no| E404a["404 Solicitud no encontrada"]
  EX -->|si| OWN{"Es el paciente titular? :230-238"}
  OWN -->|no| E404b["404 (mismo mensaje: no se revela existencia)"]
  OWN -->|si| PEN{"Sigue pendiente? :240"}
  PEN -->|no| E409["409 Esta solicitud ya fue decidida"]
  PEN -->|si| DEC{"Decisión"}
  DEC -->|rechazar| REJ["estado rechazado, sin grant"]
  DEC -->|aceptar| SUB{"Las especialidades autorizadas son subconjunto de las pedidas? :299-306"}
  SUB -->|no| E422a["422 Sólo se pueden autorizar especialidades que el profesional pidió"]
  SUB -->|si| NZ{"Al menos una especialidad? :309-313"}
  NZ -->|no| E422b["422 Aceptar exige autorizar al menos una"]
  NZ -->|si| GR["crea grant con vigencia (por defecto DEFAULT_VALIDITY_MONTHS) y deja auditoría"]
  REQ["Al pedir: POST …/practitioner-access-requests"] --> DUP{"Ya hay solicitud pendiente o vínculo activo con ese paciente? :85-100"}
  DUP -->|si| E409b["409 Ya existe una solicitud pendiente o un vínculo activo"]
```

Notas: solo `PATIENT` decide (inv.); el rol del flujo crítico `critico:consent` dice «PATIENT (otorga/retira)» pero `POST /consent/consents` exige `SECURITY_ADMIN` (inv. `consent.json`): el camino real del paciente es `/consent/me/*` y `/decision`, no el flujo documentado (`docs/business/critical-workflows.md:84`, vía `procesos.json`).

---

## 4. Árbol del inventario: lo que ya pinta el front y lo que no

El front ya consume el inventario (74 procesos, 1 642 operaciones): `FRONT/src/app/core/data-access/admin-portal/portal.client.ts:40-108` (version, operaciones, árbol, procesos, grafo, mapa, hallazgos, tablas, deriva, linaje, glosario). Tipos del grafo: `NodoGrafo {id,tipo,etiqueta,operacionId?,riesgo?,etapa?}`, `AristaGrafo {de,a,tipo}` (`portal.types.ts:248-269`); del árbol: `NodoArbol {tipo, txt, corto, detalle, destino, tabla, operacion, confianza, excepcion, estado, codigo, mensaje, hijos, entonces, sino}` (`portal.types.ts:153-178`). Contadores sobre los JSON reales:

| Medida | Valor |
|---|---|
| Tipos de nodo en `inventario/grafos/*.json` | `TABLA` 3 229 · `OPERACION` 3 222 · `ETAPA` 758 · `ACTOR` 377 · `EVENTO` 86 · `DOMINIO` 17 · `TRABAJO` 2 |
| Tipos de arista | `LEE` 16 329 · `ESCRIBE` 5 858 · `REFERENCIA` 4 608 · `CONTIENE` 1 657 · `ACTUA` 1 657 · `PERTENECE` 1 230 · `PUBLICA` 107 · `BORRA` 106 · `SIGUE` 4 · `ENCOLA` 3 |
| Tipos de nodo en `inventario/arboles/*.json` | `ACCESO` 8 436 · `RESPUESTA` 1 627 · `LLAMADA` 1 618 · `SI` 28 · `INTENTAR` 1 · `TRABAJO` 1 |
| Operaciones con tablas / sin tablas / con eventos / con trabajos | 1 565 / 77 / 102 / 3 |
| Confianza de las 16 000+ relaciones operación→tabla | `DIRECTA` 9 175 · `POR_SQL` 1 173 · `POR_TIPO` 847 · `POR_REGISTRO` 84 |
| Ficha de operación: `tablas[].via` | Sí: cadena de llamadas controlador → servicio → repositorio (DTO `portal-response.dto.ts:103-108`; el front ya la muestra como texto «Vía A → B → C», `operation-data.html:24-25`) |

---

## 5. Qué hay que construir en el front para igualar el detalle de Atlas

Referencia Atlas: `Flow` trae `reads[]`, `writes[]`, `guards[]`, `roles[]`, `callers[]` y un `analysis {chainLength, services[], writes[{table,op,via}], errors[], blockCalls[{target,at}], unknowns[{reason,at}], transactional}` (`ATLAS/src/features/flows/types.ts:28-81`); su grafo tiene 13 tipos de nodo (`ACTOR, CLIENT, ENDPOINT, GUARD, CONTROLLER, HANDLER, SERVICE, REPOSITORY, DATABASE, ERROR, BLOCK_CALL, EVENT, UNKNOWN`) en 4 capas (`CLIENT, API, BACKEND, DATA`) y aristas con `confidence` y `evidence[]` (`types.ts:140-174`), dibujado con `@xyflow/react` + ELK en un Web Worker (`graph-layout.ts:1-84`) y un nodo `UNKNOWN` punteado «que es un hueco declarado» (`flow-node-card.tsx`). El front de AloVida **no tiene** librería de grafos (`package.json` sin `elkjs`, `@xyflow`, `mermaid`, `d3`, `dagre`); el diagrama de proceso es HTML/CSS por carriles (`process-diagram/process-graph.ts`, `process-graph.model.ts:1-60`). Agregar una librería requiere decisión registrada (regla 95.1.4 de la casa).

### 5.1 Lo que se puede hacer HOY solo en el front (sin tocar la API)

1. **Pestaña «Flujo de datos» en `flow-detail`** (`FRONT/src/app/features/admin/flows/flow-detail/flow-detail.ts`). Para cada nodo `API_CALL` con `endpoint.contract = DECLARED` y `operationId` (`flows.types.ts:117-122`), pedir `PortalClient.getOperation(operationId)` (`portal.client.ts:48`) y pintar carriles: pantalla (`uiRoute`) → endpoint → `codigo.controlador.handler` → `tablas[].via` (servicio/repositorio) → tablas por efecto (`ESCRIBE`/`BORRA`/`LEE`), más `eventos` y `trabajos`. Reusar `buildLanes`/`GraphLane` de `process-graph.model.ts` y los rótulos de `portal-labels.ts`. **Riesgo/hipótesis:** que el `operationId` que calcula `RouteIndexService` (`qa-flows.service.ts:113-126`) coincida con el `id` del inventario (`IamAuthController_login`); **no verificado**.
2. **Árbol de decisión enriquecido**: en `flow-tree` mostrar bajo cada nodo `API_CALL` las respuestas posibles de la operación (`respuestasPosibles`: estado + código + causas, `inventory.types.ts:46-50`) y el árbol de acceso/validación de `GET /admin/portal/operaciones/{id}/arbol` (nodos `ACCESO`/`LLAMADA`/`RESPUESTA` con `falla {estado,codigo}`), para que las ramas narrativas (`condition`/`expected`) queden contrastadas con los códigos reales del contrato.
3. **Estados de transición**: superponer `GET /admin/portal/flujos/{codigo}` → `maquinasDeEstado` (`portal.types.ts:244`; estados, transiciones, terminales; `ProcesoDetalle`) en los nodos que mutan estado (agenda, farmacia, pagos, contabilidad, defectos de QA). Hoy hay 12 máquinas en `maquinas.json`.
4. **Hueco declarado**: pintar los `gap` y `noResuelto` de la operación como recuadro punteado con su motivo (patrón Atlas), nunca como un hecho; y mostrar la `confianza` (`DIRECTA` / `POR_SQL` / `POR_TIPO` / `POR_REGISTRO`) como etiqueta por tabla, para no vender inferencia como certeza.
5. **Selector de flujos del catálogo + procesos del inventario** en una sola pantalla: hoy son dos mundos (`/superadmin/flows` vs `/superadmin/portal/processes`, `app.routes.ts:225,971`); ofrecer en el detalle del flujo un enlace «ver el mismo recorrido derivado del código» al proceso del inventario.
6. **Árbol y datos del diagrama de proceso** ya existentes (`process-diagram`, `decision-tree`) se enlazan desde cada nodo, con el mismo deep link `?open=` que usa Atlas (`flow-graph-page.tsx`).

### 5.2 Lo que FALTA en la API para pintar el árbol y el flujo de datos con el mismo detalle que Atlas

| # | Falta | Evidencia | Qué pedir |
|---|---|---|---|
| A1 | El catálogo QA no sabe de datos: `FlowNode` solo tiene `endpoint`, `gap`, `effects[]` de texto libre | `qa_lab/domain/flow-catalog.ts:68-82` | Que `GET /admin/qa/flows/:id` incluya por nodo `operationId` ya resuelto y un resumen `data {writes[], reads[], events[], jobs[]}` tomado del inventario (o que el front haga el join, 5.1.1). |
| A2 | El grafo del inventario **no tiene capas servicio/repositorio, guard, error ni cliente**: solo `ACTOR/ETAPA/OPERACION/TABLA/EVENTO/DOMINIO/TRABAJO` | conteo de §4; Atlas tiene `SERVICE, REPOSITORY, GUARD, ERROR, BLOCK_CALL, CLIENT` | Un `GET /admin/portal/operaciones/{id}/grafo` (cadena `via` convertida en nodos y aristas) o ampliar `inventario/grafos` con esos tipos. La cadena ya está en `tablas[].via`. |
| A3 | Las aristas no llevan `confidence` ni `evidence` | `AristaGrafo {de,a,tipo}` (`portal.types.ts:257-261`) vs Atlas `GraphEdge` (`types.ts:161-169`); la confianza sí existe en `tablas[].confianza` y la evidencia en `tablas[].fuente` (`inventory.types.ts:30-39`) | Copiar `confianza` y `fuente` a la arista `LEE/ESCRIBE/BORRA`. |
| A4 | **Los guards propios son invisibles**: la API solo reporta `@Roles`; 23 archivos de controlador usan `@UseGuards(...)` y su operación sale «sin roles» | `diagnostics-specimens.controller.ts:46` + `inventario/arboles/diagnostics.json` («Sin @Roles…, vive en el servicio»); `grep -rln "UseGuards(" --include=*.controller.ts src/modules` = 23 | Que el generador de inventario (`tools/inventario/endpoints.mjs`) añada `guards[]` a `autenticacion` y un nodo `ACCESO` por guard (Atlas expone `guards`, `types.ts:50`). |
| A5 | El inventario puede mentir sobre roles: `@Roles()` vacío no se distingue de «hereda los de clase» | `claims.controller.ts:106` vs `inventario/endpoints/insurance.json` (`BILLING,FINANCE`) | Decidir qué significa y marcarlo (`rolesDeMetodo` vs `rolesDeClase`). |
| A6 | Atribución errónea de máquinas de estado por colisión de nombre (`TRANSITIONS`): `payments.TRANSITIONS` lista `PATCH /insurance-campaigns/{id}/status` entre sus operaciones; `insurance.TRANSITIONS` es de campañas, no de reclamos | `inventario/flujos/maquinas.json` (leído por script); `insurance-campaigns.service.ts:124` | Calificar por archivo en el código de la máquina y modelar la del reclamo (hoy sin máquina). |
| A7 | No hay **quién llama** (pantalla/cliente → operación) en el inventario | `MapaFila.llamadaPor` existe (`inventory.types.ts:184`) pero solo con datos si el análisis del front se importó; Atlas guarda `callers[]` y `screens` | Importar las rutas del front (`uiRoute` de los flujos ya lo cubre en 3 flujos) o generar `frontRoutes` desde `app.routes.ts`. |
| A8 | El detalle del flujo no trae **errores del contrato por nodo** ni **hallazgos** del flujo | `qa-flows.service.ts:177-200` no incluye `respuestasPosibles`; el portal sí tiene `hallazgos` (`admin-portal.controller.ts:111-128`) | Cruzar por `operationId`. |
| A9 | **Eventos y outbox poco visibles**: solo 102 operaciones declaran `eventos` y 3 `trabajos`, aunque casi todo el dominio publica por outbox (p. ej. farmacia usa `MessagingDomainEventAdapter.publish`) | conteo de §4; `via` de `POST /pharmacy/orders` | Que el análisis siga `OutboxService.publishDomainEvent` y los llene en `eventos` con su consumidor (patrón Atlas `EVENT`). |
| A10 | No hay **versión/huella del flujo curado** ni «frescura»: `observedOn` por caso, pero no estado del flujo (`UNVERIFIED/VERIFIED/BROKEN`, `FRESH/STALE`) | Atlas `FLOW_VERIFICATIONS` y `FLOW_FRESHNESS` (`types.ts:11-12`) | Derivar de `qa.lastRun` + `drifted` + `observedOn` y exponerlo en `FlowSummary`. |
| A11 | Solo 3 de ~28 flujos de usuario están en el catálogo (§2); cada uno nuevo exige JSON + `observedOn` contra API real y registro en `domain/flows/index.ts` | `domain/flows/README.md:46-52` | Backlog priorizado: C2, F2, L1, S1, I1, I2, H4/H5, B2. |

### 5.3 Orden sugerido (dependencias, `NO_BIG_BANG_REWRITE`)

1. 5.1.1 + 5.1.4 (join por `operationId` y hueco declarado): no cambian contrato, solo front; verificar primero la hipótesis del `operationId`.
2. A1/A8 en la API (enriquecer `flows/:id`) y entonces 5.1.2–5.1.3.
3. A2–A4 (grafo con capas, confianza en aristas, guards) antes de cualquier diagrama «tipo Atlas»; sin A4 los árboles de laboratorio seguirán mostrando «sin roles».
4. Decidir la librería de render (ADR) solo si los carriles HTML no alcanzan para >60 nodos; los grafos de módulo llegan a 288 nodos (`systems-ops` en Atlas, comentario `graph-layout.ts`) y el de `scheduling` ya tiene 156 (`TABLA` 67 + `OPERACION` 66 + `ACTOR` 15 + `ETAPA` 8, `inventario/grafos/scheduling.json`).
5. Flujos nuevos al catálogo (A11) en paralelo, uno por PR, con los 3 niveles válido/límite/inválido (regla 65) y `observedOn` real.

## 6. No verificado / limitaciones

- No se ejecutó la API ni el front; ningún código de estado se observó en runtime (peldaño `DISCOVERED`). Los códigos HTTP salen de `respuestasPosibles` del inventario y de las excepciones leídas.
- Las cadenas `via` y las tablas son **análisis estático**: aparecen tablas dudosas (p. ej. `POST /scheduling/bookings/{id}/cancel` lista `community.conversation_participants`, que sí se explica por el chat al cancelar, pero `iam.devices` en `…/exceptions` es solo suscripción web push). La columna `confianza` debe leerse siempre.
- Las líneas «inv.» apuntan al primer decorador del handler y pueden diferir 1-3 líneas del `@Post`.
- El documento «Registro de procesos por módulo» de la bóveda no está en este workspace; los «Id propuestos» son deducidos del orden de secciones del documento del cliente.
- No se leyó: `BookingMaterializer` más allá de las líneas citadas, el repositorio de agenda (`SELECT ... FOR UPDATE` literal), `PharmacyOrdersUseCases.create` completo, `ChartNotesService.createNote` completo, `ClaimsService.adjudicate/dispute`, el módulo `promotions`, la integración real de la pasarela con la cuenta por cobrar.
- Los dos PRs por cambio (`dev` y `test`) no aplican: este archivo es de descubrimiento y no hay commit.
