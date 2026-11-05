# Contrato propuesto con la API

Lo que estas pantallas dan por hecho de la API, separado en cuatro: lo que **ya coincide** con sus DTO (se
verificó leyendo `src/modules/delegated_access/dto` y `src/modules/iam/presentation/dto`), lo que el
front **propone** y la API no tiene, lo que **todavía no coincide** y lo que el simulador hace distinto.
Los nombres del contrato compartido no se cambiaron.

## 1 · Ya alineado con los DTO de la API

El cliente (`support-access.client.ts`) traduce en un solo archivo, `support-access.wire.ts`. Manda la API:
lo que sale lleva exactamente sus nombres (`forbidNonWhitelisted` rechaza el resto).

| Ruta | Antes (pantalla) | Ahora (API) |
|---|---|---|
| `POST /support-engagement-requests` | `roleTemplate`, `parentEngagementId`, `items[].proposedActions` | `roleTemplateCode`, `parentAssignmentId`, `items[].actions` |
| `POST /org/support-engagements/:id/recertify` | `{ months }` | `{ recertifyEveryMonths }` (opcional: sin él se repite el período) |
| `POST /org/support-engagements/:id/end` | `{ reasonText }` | `{ reason }` (**obligatorio**) |
| `POST /org/affiliation-invitations` | `roleTemplate`, `targetPersonLabel` | `roleTemplateCode`; sin etiqueta (la API no la tiene: la pantalla la guarda localmente) |
| `POST /practitioner-delegates/:id/accept` | `{ mayReplyOnBehalf?, replyDisclosure? }` | además `acceptsSupportClause: true` (obligatorio) |
| `POST /me/support-patient-search` | `org`, `document` | `tenantId`, `nationalId` |
| `GET /me/support-agenda`, `GET /me/support-inbox[/:id]`, `GET /me/support-reply-templates`, `POST /me/support-patients` | `org` | `tenantId` (rutas que la API aún no tiene) |
| `GET /me/support-catalog` | `org` | `org` — se **mantiene**: así lo declara `SupportCatalogQueryDto` |
| Respuestas con `roleTemplateCode` / `parentAssignmentId` | — | se leen como `roleTemplate` / `parentEngagementId` |
| `GET /me/support-engagements` | `{ engagements, requests }` | `{ items, requests, count }`: se leen las dos formas (el simulador ya manda la de la API) |
| `POST /affiliation-invitations/redeem` | `{ outcome, organizationName }` | `{ kind, tenantId, membershipId?, engagementId?, requestId?, roleAssignmentId?, pendingApproval? }` — ver «Canje de un código multiuso» más abajo |
| Invitación agotada | `USED` | `EXHAUSTED` |
| Canje de un código inválido, usado o vencido | 404 / 409 según el caso | **422 opaco** (`PRECONDITION_FAILED`, «La invitación no es válida»): la pantalla dice lo mismo en los tres casos |
| Código de invitación | `MNT-XXXX-XXXX`, insensible a mayúsculas | 24 bytes en base64url, **distingue mayúsculas**; el cliente no lo transforma |
| QR de la invitación | `/my-support?code=` | `/my-support#code=` (fragmento); se lee una vez y se borra de la dirección y del historial |
| Cuentas del hospital en el simulador | rol `USER` | `USER` + `SECURITY_ADMIN` (la API exige `@Roles('SECURITY_ADMIN')` en `/org/*`); las secciones lo piden igual |

### Política de sesión (`GET|PUT /org/session-policies`)

Coincide con `SessionPolicyDto` y con `domain/session-policy.ts`:

- `{ policies: [{ scope, roleCode?, idleTimeoutMinutes, newDeviceAlert, allowedHours?, enforceIpRules, requireMfa }] }`.
- `allowedHours` es **una** franja: `{ days?: number[] (0 = domingo … 6), from: 'HH:mm', to: 'HH:mm', timeZone? }`; `to < from` cruza la medianoche
  y la franja pertenece al día en que empezó. Ausente = sin restricción. El editor semanal visual arma esa única franja.
- Rigen **todas** las reglas que alcanzan a la persona y se queda con la más estricta: el menor plazo, `requireMfa` si alguna lo exige y cada
  franja tiene que cumplirse. `ALL_ACCOUNTS` alcanza a todos; `ORG_STAFF`, a quien tiene algún rol más allá de `USER` y `PATIENT`; `ROLE`, a
  quien tiene ese **rol del token** (`PRACTITIONER`, `SECURITY_ADMIN`…), no una plantilla de apoyo. La vista previa lo calcula igual.
- La inactividad va de 5 a 1440 minutos en la API; la pantalla ofrece de 5 a 120.
- Rechazos de login (todos `401` con `details.reason`, que es lo que emite la API): `MFA_REQUIRED`, `MFA_INVALID`,
  `OUTSIDE_ALLOWED_HOURS`, `OUTSIDE_ALLOWED_NETWORK`. Sin factor y con dos pasos exigidos el login **entra** (ver abajo).

### Seguridad de la cuenta (ronda de IAM, 2026-10-30)

| Ruta | Forma que lee el front |
|---|---|
| `POST /iam/auth/login` | Además de los tokens: `newDevice: { deviceId, label, ip?, occurredAt }` (solo si el dispositivo es nuevo y una regla tiene `newDeviceAlert`), `mfaEnrollmentRequired: true` (una regla exige los dos pasos y la cuenta no tiene un factor) y `deniedTenants: [{ tenantId, reason }]` (organizaciones que niegan ahora; también en el refresco). **El login ENTRA** salvo que ninguna organización deje entrar. |
| Rechazos de política del login | Solo cuando **ninguna** organización deja entrar: `401` con `details.reason`: `MFA_REQUIRED`, `MFA_INVALID` (también para un código ya usado), `OUTSIDE_ALLOWED_HOURS` y `OUTSIDE_ALLOWED_NETWORK`. El front sigue entendiendo `NETWORK_NOT_ALLOWED`, el nombre que suponía antes (con 403 o 401). `MFA_ENROLLMENT_REQUIRED` ya no existe como motivo. |
| `POST /iam/me/devices/:id/confirm` `{ code? }` | «Fui yo» → `{ confirmed, deviceId }`. **Solo con prueba**: desde otra sesión en un dispositivo de confianza o con `code` (8 dígitos del correo verificado). Sin ellos, `422 DEVICE_CONFIRM_CODE_REQUIRED` (`details.canRequestCode`); código malo o usado, `422 DEVICE_CONFIRM_CODE_INVALID`. Dispositivo ajeno: 404 `DEVICE_NOT_FOUND`. |
| `POST /iam/me/devices/:id/confirm-code` | `{ sent, sentTo }` (dirección enmascarada; `sent:false` si ya era de confianza). Sin correo verificado, `422 DEVICE_CONFIRM_NO_VERIFIED_EMAIL`. Tope de 3 por minuto. |
| `POST /iam/me/devices/:id/not-me` | «No fui yo» → `{ revokedSessions, deviceId }`: la API revoca **las demás** sesiones en una operación. El front ya no arma «listar y revocar de a una». |
| `GET /iam/me/mfa` | `{ required, enrolled, enrollmentRequired, factors[{ id, type, state, label?, verifiedAt?, createdAt }] }`, sin secretos. |
| `POST /iam/me/mfa/totp` `{ label?, currentPassword \| mfaCode }` | **Exige reautenticar** (`422 MFA_REAUTH_REQUIRED` / `MFA_REAUTH_FAILED`). `201` con `MfaFactorResponseDto`: `{ id, userId, state, secret, otpauthUri }` (el estado es un concept id; el secreto y el URI **solo** en esta respuesta). Retira los intentos anteriores sin confirmar. |
| `POST /iam/me/mfa/:factorId/revoke` `{ currentPassword \| mfaCode }` | `{ revoked, remainingVerified }`. Misma reautenticación. Si era el último, el segundo paso queda apagado y una organización que lo exija vuelve a pedir el alta. |
| `GET /iam/me/network` | `{ ip, family, trustProxyHops }`: la dirección con que la API ve la conexión, contra la que se evalúan las reglas de red. |
| `POST /iam/me/mfa/totp/:factorId/confirm` `{ code }` | `{ verified, factorId, verifiedAt }`. Código de 6 a 8 caracteres (si no, 400); uno inválido es **422** `details.reason: MFA_CODE_INVALID`. |
| `GET\|PUT /org/ip-access-rules` | `{ rules: [{ id?, type: ALLOW\|DENY, cidr, description?, validFrom?, validTo? }] }`. `PUT` **reemplaza** el conjunto (máx. 50; vacío = sin restricción). `422`: `IP_RULE_CIDR_INVALID` (con `details.cidr`; el prefijo es obligatorio), `IP_RULE_VALIDITY_INVALID`, `IP_RULES_WOULD_LOCK_OUT_ACTOR`. |
| `PUT /org/session-policies` (rechazos nuevos) | `422`: `SESSION_POLICY_HOURS_EMPTY` (desde = hasta), `SESSION_POLICY_HOURS_TOO_SHORT` (menos de 4 h, `details.minimumMinutes`), `SESSION_POLICY_WOULD_LOCK_OUT_ACTOR` y `IP_RULES_WOULD_LOCK_OUT_ACTOR` también al guardar políticas. El cliente valida franja (≠ y ≥ 4 h) antes de enviar. |
| Claim `idleTimeoutMinutes` | Ya se emite (5–480); el front lo lee. |

**La API impone el alcance limitado.** Quien debe dar de alta el factor recibe un token con el claim `mfaEnrollment: true` (sin roles ni
organizaciones) que solo llega a `/iam/me/mfa*`, al cierre de sesión, al refresco y a `GET /iam/me`; lo demás es `403
MFA_ENROLLMENT_REQUIRED`. El refresco lo conserva y lo **reemite completo** al confirmar el factor: la pantalla de alta pide ese
refresco. `mfaEnrollmentGuard` se conserva como cortesía (lleva a la pantalla de alta; ya no pregunta `GET /iam/me/mfa`: el claim lo dice).
Ver [ADR-0020](../adr/ADR-0020-segundo-paso-lo-hace-cumplir-el-cliente.md).

### Organizaciones que niegan ahora (`deniedTenants`)

La política de una organización rige **solo en ella**. Si una niega (franja, red, segundo factor, inactividad), sale de `tenants`,
`tenantNames`, `tenantTypes` y `scopedRoles` del token y se declara en `deniedTenants`; la persona entra a las demás.

| Dónde | Forma |
|---|---|
| Claim del token | `deniedTenants: { [tenantId]: motivo }` |
| Login y refresco | `deniedTenants: [{ tenantId, reason }]` |
| `403` con `X-Tenant-Id` de una denegada | `reason` y `details: { tenantId, reason }`; no cierra la sesión |
| Motivos | `OUTSIDE_ALLOWED_HOURS`, `OUTSIDE_ALLOWED_NETWORK`, `IDLE_TIMEOUT`, `MFA_REQUIRED`, `MFA_ENROLLMENT_REQUIRED` |

El token **no trae el nombre** de las que niegan: el aviso («La organización X no le permite entrar ahora: motivo») lo completa con `GET /tenants/me`
y, si no puede, dice «una de sus organizaciones». El selector las muestra deshabilitadas, con su motivo.

### Invitaciones de organizaciones (membresías pendientes)

| Ruta | Forma |
|---|---|
| `POST /tenants/:tenantId/memberships` | Deja la membresía **pendiente de aceptación** (`DIR_MEMBERSHIP_PENDING_ACCEPTANCE`): no cuenta para el token ni las políticas hasta que la persona acepte. Canjear un QR o una invitación dirigida sí activa al instante. |
| `GET /tenants/me/membership-invitations` | `{ items: [{ id, tenantId, tenantName, role, invitedAt }] }` (sin organización activa) |
| `POST /tenants/me/membership-invitations/:membershipId/accept` \| `/decline` | `{ id, tenantId, status: 'ACTIVE' \| 'DECLINED' }`; 404 uniforme (ajena, ya decidida o inexistente) |
| `POST /tenants/:tenantId/memberships/:membershipId/offboard` | `{ ok: true }`. Sirve también para **retirar** una invitación pendiente antes de que la acepten. |

Pantalla: «Invitaciones de organizaciones» (`/my-account/security/organization-invitations`), aviso en el selector de organización y, del lado
de la organización, la plantilla dice «Invitación enviada, pendiente de aceptación» con «Retirar invitación».

### Canje de un código multiuso

Un código **sin persona destino** no afilia solo. Doctor: `{ kind: 'PRACTITIONER', tenantId, roleAssignmentId, pendingApproval: true }` (sin `requestId` ni
`membershipId`): la solicitud aparece en «Médicos del centro» (`administration/my-organization/affiliations`) con `initiatedBy: 'PRACTITIONER'`, `practiceSiteId: null` y
`serviceDisplay: null`; la organización la aprueba o rechaza (`POST /role-assignments/:roleId/approve|reject`) y la pantalla la muestra **en toda sede**, «Sin sede
asignada». Si la cuenta ya era miembro activa: `{ kind, tenantId, membershipId }`. Apoyo: `requestId` y `pendingApproval: true`. El dirigido a una persona sigue igual.
Errores `422 PRECONDITION_FAILED` con `details.reason`: `SUPPORT_PRACTITIONER_PROFILE_REQUIRED` (la cuenta no tiene perfil profesional: se ofrece completarlo),
`SUPPORT_AFFILIATION_PRACTICE_MISSING` (la organización no tiene práctica activa; también al **emitir** un QR de doctor sin destino) y el opaco `SUPPORT_INVITATION_INVALID`.

### Vínculos, solicitudes, equipo y actividad (ronda de delegated_access)

| Ruta | Forma que lee el front |
|---|---|
| Estado del vínculo | La API dice `ACTIVE \| SUSPENDED \| REVOKED \| EXPIRED`. `support-access.wire.ts` traduce `REVOKED` y `EXPIRED` a `ENDED`, que es lo que hablan las pantallas. `recertificationDue` se descarta (se calcula con la fecha). |
| `GET /me/support-engagements`, `GET /org/support-engagements` | `{ items, count }` (y `requests` en la de la persona). Cada vínculo trae `personName`, `organizationName`, `ownerKind`, `recertifyEveryMonths`, `lastActivityAt`, `suspendedAt` (vencimiento + 15 días, solo si está suspendido por eso), `lastConfirmedAt` y `lastConfirmedBy` (`PERSON` \| `ORGANIZATION`). **No** hay `personEmail` ni `reactivationRequestedAt`. |
| `POST /me/support-engagements/:id/confirm` | Sin cuerpo. Responde el vínculo más `reactivated: boolean`. Ver la nota de producto de abajo. |
| `GET /org/support-engagement-requests?status&limit&cursor` | `{ items, count, nextCursor }`, de 25 por página (hasta 100). `status` es uno de `PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED`: **`PARTIAL` no es un filtro válido** (400); el front lo recorta de lo recibido. El cliente junta todas las páginas. |
| Solicitud (`EngagementRequestViewDto`) | `roleTemplateId` **y** `roleTemplateCode`, `requesterName`, `organizationName`, `createdAt`, `decisionReason` y, por ítem, `practitionerName`, `serviceName`, `locationName`. Estados: `PENDING`, `APPROVED`, **`PARTIAL`**, `REJECTED`, `EXPIRED`, **`CANCELLED`**. |
| `POST /org/support-engagement-requests/:id/decision` | Responde `{ requestId, status, engagementId?, grantIds[] }`, **no** la solicitud (el front vuelve a leer la bandeja). |
| `POST …/recertify`, `POST …/end`, `PATCH …/grants` | Responden `{ ok: true }`; `POST …/grants`, `201 { id, status }`. |
| `GET /org/support-activity`, `GET /me/practitioner/support-activity`, `GET /me/support-activity` | Filtros que **resuelve la API**: `userId`, `person` (id o nombre completo sin acentos), `doctor` (asignación, perfil o nombre), `action` (código del front —`schedule.confirm`, `engagement.ended`— o asiento crudo), `from`/`to` (`YYYY-MM-DD` = el día completo en La Paz, UTC-4, o un instante ISO), `tenantId`, `limit` 1–200 (fuera de rango, 400), `cursor` opaco (`instante\|id`). Responde `{ items, count, nextCursor }`. |
| Asiento de actividad | `id, tenantId, userId, personName (= actorName), action, auditAction, permission?, entity, entityId?, bookingId?, appointmentId?, practitionerProfileId?, practitionerRoleAssignmentId?, practitionerName?, summary, success, result (SUCCESS\|FAILURE), createdAt (= occurredAt = recordedAt)`. **Sin datos del paciente**: el front dejó de mostrar y de exportar `patientLabel`. El CSV trae fecha, persona, acción, detalle, doctor, resultado y código, y **todas** las filas que cumplen los filtros (se piden las páginas que faltan). |
| `GET /me/practitioner/support-team` | Por integrante: `delegateId, userId, personName, engagementId, tenantId, organizationName, roleTemplateCode (= roleTemplate), status (PENDING_ACCEPTANCE\|ACTIVE\|REVOKED), delegateStatus (ACTIVE\|SUSPENDED\|REVOKED\|EXPIRED), accepted, acceptedAt?, mayReplyOnBehalf, replyDisclosure, actions[], coverageSummary, lastActivityAt?, pendingClinicalRequests[{ requestId, patientLabel, reasonText, requestedAt, requestedHours }]`. «Mi equipo» dice por qué alguien ya no está activo (suspendida por su organización, retirada o vencida). |

**Nota de producto (confirmación de la persona).** La API de hoy deja que la propia persona reactive un vínculo suspendido por recertificación
vencida (`reactivated: true`), lo que debilita el control de la organización. El coordinador lo corrige en la API: la confirmación de la persona será **solo una
declaración** «sigo trabajando aquí» y renovar o reactivar quedará a cargo de la organización. Las pantallas ya están diseñadas para ese comportamiento final:
«Mis accesos» ofrece **«Confirmar que sigo trabajando aquí»** con el texto de que la que renueva es la organización; un vínculo suspendido muestra
**«Suspendido: pida a su organización que lo renueve»** y **ningún botón**; y si la API de hoy respondiera `reactivated: true`, el aviso dice la verdad de lo que quedó.

### Pacientes, agenda y acciones del personal de apoyo (rondas de agenda y pacientes)

| Ruta | Forma que lee el front |
|---|---|
| `POST /me/support-patient-search` | Cuerpo `{ tenantId \| org, nationalId \| document \| phone \| fullName + birthDate }`: si un par llega con valores distintos, 400 `SUPPORT_PATIENT_INPUT_CONFLICT`; lo parcial, 422 `SUPPORT_PATIENT_SEARCH_INEXACT`; más de 20 por minuto o 200 por día, 429 `SUPPORT_PATIENT_SEARCH_THROTTLED`. Responde `{ items, count }`; cada ítem trae `patientProfileId` y `profileId` (el mismo valor), `displayName`, `documentMasked`, `phoneMasked?`, `ageYears`, `isMinor`, `representatives[]?`. |
| `POST /me/support-patients` | `201 CREATED { outcome, patient, invitationSent, identityVerified: false, guardian?: { recorded: true, status: 'PENDING_VERIFICATION' } }` o `200 POSSIBLE_DUPLICATES { duplicates[] }`. **`guardianLink` ya no existe**: el mostrador no crea representaciones legales; el representante queda como contacto pendiente de verificación y la representación legal la establece la organización con documento. El paciente nace «no verificado» («Identidad pendiente de verificación»). `400` si el documento no tiene contenido (menos de 4 caracteres canónicos); `429 SUPPORT_PATIENT_SEARCH_THROTTLED` con `details: { limit: 'PER_MINUTE' \| 'PER_DAY', scope: 'PERSON' \| 'IP' }` (el de IP se explica distinto). Un candidato **de otra organización** viene sin `profileId`, con un nombre genérico y solo `linkedToOrganization: false` y `matchedBy[]`: **«Es esta persona» no se ofrece**. Con `acknowledgeDuplicates` crea igual salvo documento ya registrado, **también una variante** («01.234-567» = «1234567») (409 `SUPPORT_PATIENT_DOCUMENT_REGISTERED`); menor sin representante, 422 `SUPPORT_PATIENT_GUARDIAN_REQUIRED`; el representante exige nombre, documento, **teléfono** y parentesco; `invitationSent: true` significa solo «encolada». |
| `GET /me/support-agenda` | `waitlistCount` se omite cuando es 0; sin `schedule.view` el ítem no trae paciente, motivo, `waitlistCount`, **`bookingId` ni `healthcareServiceId`** (opcionales: el cliente no los asume; la clave del bloque es local y no sirve para actuar) y sí `denialReason`; una cita sin **ninguna** acción `schedule.*` no sale ni como bloque, y con vínculo vivo pero sin permiso de agenda la lista llega **vacía** (no 403: la pantalla lo explica); un vínculo terminado o suspendido es 403 (nunca bloques); `doctors[]` ordenado por nombre sin acentos y luego perfil, **igual que la bandeja**. |
| `POST /scheduling/appointments/direct` | Con `walkIn: true` la respuesta agrega `checkedInAt`. `POST /scheduling/waitlist` lleva `bookableSlotId`. |
| Cancelar, reprogramar y rechazar | `reasonText` ausente, vacío, corto o de relleno es **422** con `reason` `REASON_REQUIRED` o `REASON_PLACEHOLDER` (400 solo si no es texto o pasa de 500). Reprogramar: 404 uniforme si el destino es de otra organización; 422 `RESCHEDULE_TARGET_NOT_FREE`, `RESCHEDULE_TARGET_NOT_FUTURE`, `RESCHEDULE_TARGET_OTHER_SERVICE`. |
| `POST /scheduling/appointments/direct` (apoyo) | Lo declarado se contrasta con los lugares y servicios **propios** del doctor: `403 «El doctor no atiende en ese espacio.»` / `«El doctor no presta ese servicio.»` (también si no tiene servicios propios). Se muestra el mensaje y se deja elegir otro horario, doctor o servicio. |
| Todo rechazo de apoyo en la agenda | El mismo 403 genérico (`SUPPORT_DENIED_MESSAGE`: «Su vínculo de apoyo no le permite esta acción.») que no nombra otra organización. El front muestra ese mensaje tal cual. |

## 2 · Lo que el front todavía propone (no está en la API)

| Qué | Dónde se usa | Por qué |
|---|---|---|
| Operaciones **en lote** de la revisión periódica (`recertify`, `revoke` varios) | Revisión periódica | Hoy el front las arma persona por persona; una ruta en lote sería atómica |
| `GET /org/affiliation-invitations` con la etiqueta del destinatario | Invitaciones | La API no tiene `targetPersonLabel`: la pantalla la guarda localmente |
| `GET /me/support-catalog?org` | Pedir más permisos | Ver §3: el catálogo de la persona tiene otra forma que el de la organización |

## 3 · Todavía no coincide

| Respuesta | Falta o difiere |
|---|---|
| `SupportCatalogResponseDto` | Otra forma: `tenantId`; doctores con `practitionerRoleAssignmentId` y `displayName` (el front espera `id` y `name`) y `placements[{ careSpaceId?, healthcareServiceId? }]`; ubicaciones `SITE` / `SPACE` con `code`, `parentId`, `practiceSiteId` (el front espera `path` y más tipos). **No se alineó en esta ronda**: el editor de permisos y «Pedir más permisos» siguen leyendo la forma del simulador. |
| `SupportGrantViewDto` | No trae `engagementId`, `practitionerName`, `serviceName` ni `locationName` (los resuelve el catálogo). |
| `AccessLookupEntryDto` | Trae `userId`, `practitionerRoleAssignmentId`, `actions` y `grantIds`; el front espera `engagementId`, `personName` y `roleTemplate`. |
| `GET /me/support-engagements` | `requests` es la lista completa de la persona; no hay paginación. |

## 4 · Lo que el simulador hace distinto de la API

- Acepta cualquier contraseña no vacía.
- Aplica horario, dos pasos y aviso de dispositivo nuevo en el login **por organización** (`deniedTenants` en el token y en la respuesta; token de alcance limitado si todas niegan por falta del factor) y pone `idleTimeoutMinutes` en el token. `mock-token-guard.ts` responde 403 `MFA_ENROLLMENT_REQUIRED` / con el motivo de la organización denegada, como la API. Con un factor confirmado, la API pide el código **siempre**; el simulador
  solo cuando una regla exige los dos pasos (para que las otras pruebas entren sin código). El código bueno es `123456`.
- Reautenticación de MFA: acepta cualquier contraseña salvo `incorrecta`, y el código `123456` si la cuenta tiene un factor. Código de «Fui yo»: `12345678` (tras `confirm-code`; `marcos` no tiene correo verificado).
- **No** rechaza el login por red (`OUTSIDE_ALLOWED_NETWORK`): el navegador no tiene una red de organización. Sí reproduce el rechazo de `PUT /org/ip-access-rules`
  por un conjunto que deja afuera a quien lo guarda, con un origen fijo (`190.129.10.4`).
- La confirmación de la persona sigue la **decisión de producto** (solo declara; nunca reactiva), no lo que hace la API de hoy.
- Suspende los vínculos al leerlos (la API lo hará con `POST /…/recertification-sweep`); `suspendedAt` es el vencimiento más 15 días, como la API.
- El tope de búsquedas de pacientes (20 por minuto) se cuenta en memoria por persona; el de 200 por día, también.
- `window.__mockRequests` guarda la respuesta del login y del refresco (y solo esas) para que un e2e pueda leer los claims del token.

## 5 · Bandeja de chat compartida (`/support-inbox`)

Formas **finales** de la API (`community/dto/support-inbox.dto.ts`); el front las lee en
`core/data-access/support-access/support-inbox.types.ts`.

**Dos perfiles del doctor.** `practitionerProfileId` es su perfil **profesional** (filtros y asignación);
`doctorPublicProfileId` es su perfil **de chat**, y es el **único** que sirve como remitente al responder en su nombre: `senderProfileId` y
`onBehalfOfProfileId` llevan `doctorPublicProfileId`. Con el profesional el envío falla (412) porque quien manda no es participante de la conversación.

| Ruta | Qué lee el front |
|---|---|
| `GET /me/support-inbox?tenantId&status&doctor` | `{ items, doctors, count }`. Ítem: `conversationId`, `tenantId` y `organizationId` (el mismo valor), `organizationName`, `practitionerProfileId`, `practitionerName`, **`doctorPublicProfileId`**, `patientLabel` (**solo el nombre público**: ya no trae «CI ***123»), `status` (`NEW\|TAKEN\|WAITING_DOCTOR\|RESOLVED`), `assignedUserId?`, `assignedToName?`, `assignedToMe`, `slaDueAt?` (ausente en `RESOLVED`), `lastMessageAt`, `lastPatientMessage?`, `lastMessagePreview`, `isClinical` (= `clinicalSuspected`). `doctors[]`: `{ id (asignación de rol), practitionerProfileId, name, displayName, specialty }`. Sin `tenantId`, junta las organizaciones con vínculo vivo. 403 `SUPPORT_INBOX_NO_ENGAGEMENT` y `SUPPORT_INBOX_NO_REPLY_PERMISSION`. |
| `GET /me/support-inbox/:conversationId?tenantId` | `messages[{ id, from (PATIENT\|DOCTOR_SIDE), bodyText, sentAt, isClinical, authoredByName?, disclosureShown? }]`, `notes[]` (de la antigua a la reciente, con `authorName`), `replyAllowed`, `replyBlockedReason?`, `replyDisclosure` (`SHOW\|HIDE`), `assignableTo[{ userId, name }]`, `patientContext { reasonLabel, clinicalAccess (NONE\|PENDING\|APPROVED), delegateId, patientProfileId, requestedPermissionId }` y `doctorPublicProfileId`. **Ver la conversación exige poder responder en nombre del doctor**: `replyAllowed` es siempre `true` en lo que se ve y el estado «sin permiso de responder» ya no existe; sin acceso, 404 `CONVERSATION_NOT_FOUND` (también al responder). Mientras `patientContext.clinicalAccess` no sea `APPROVED`, los mensajes del propio doctor y los clínicos salen con `bodyText` = «Contenido clínico oculto: requiere acceso clínico temporal aprobado.», `isClinical: true` y `contentHidden: true`: la pantalla muestra «Contenido clínico oculto» con «Pedir acceso a la historia clínica». En la lista, `lastPatientMessage` (texto recortado, no una fecha) y `lastMessagePreview` pueden traer el mismo marcador. |
| `POST /community/conversations/:id/assignment` | `{ practitionerProfileId?, assignedUserId?, status }` (sin `assignedUserId`, asigna a quien pide) o `{ action: TAKE\|ASSIGN\|SET_STATUS, … }`. 409 `CONVERSATION_ALREADY_TAKEN` con `details.assignedToName`; 422 `CONVERSATION_ASSIGNEE_NOT_ELIGIBLE`, `CONVERSATION_PRACTITIONER_MISMATCH`, `CONVERSATION_STATUS_REQUIRED`. Responde `{ conversationId, status, assignedUserId?, assignedToName?, slaDueAt?, referredToDoctor }`. |
| `POST /community/conversations/:id/internal-notes` | `{ bodyText }` (1–2000). Nunca viaja al paciente ni al chat del doctor |
| `POST /community/conversations/:id/messages` con `onBehalfOfProfileId` | 403 sin permiso o sin la aceptación del doctor; 409 `CONVERSATION_HELD_BY_OTHER` con `details.assignedToName`; 422 `CLINICAL_REQUIRES_DERIVATION` (en `reason` y en `details.reason`) y 422 `SUPPORT_CLINICAL_CONTENT` para un texto saliente clínico. `channels: ['CHAT','EMAIL']`: el correo **solo** con `onBehalfOfProfileId` (si no, 422 `EMAIL_CHANNEL_REQUIRES_ON_BEHALF`). Responde `{ id, conversationId, sentAt, email?: { queued, requestId?, skippedReason? } }`; `skippedReason` es una **frase** de la API («La cuenta del paciente no tiene un correo verificado con credencial activa»), no un código: se muestra tal cual. El compositor ofrece **«Mandar también por correo al paciente»** con el aviso de que lo recibe a nombre del doctor; `queued` no dice que llegó. |
| `GET /community/conversations/:id/messages` (lectura de siempre) | Por mensaje, `repliedByTeam?` (lo ve el paciente, sin nombre) y `teamAuthorName?` (**solo** para el doctor dueño del perfil) |
| `GET /community/conversations` (lectura de siempre) | `awaitingDoctor?: true` solo para el doctor, cuando su equipo le derivó una conversación (`WAITING_DOCTOR`) |
| `GET /me/support-reply-templates?tenantId` | `{ items, count }` con `{ id, category, title, bodyText, practitionerProfileId?, retired, version }`; quien responde ve las no retiradas. `{paciente}` y `{doctor}` los completa el front |
| `GET\|POST /org/reply-templates`, `PATCH /org/reply-templates/:id` | Administración (`SECURITY_ADMIN`): `{ category, title (1–120), bodyText (1–2000), practitionerProfileId? }`; el `PATCH` acepta `title`, `bodyText`, `category`, `retired` y **`expectedVersion`**: si otra persona la cambió, 409 `REPLY_TEMPLATE_STALE` con `details.currentVersion`. Pantalla: «Respuestas preparadas», en `/administration/support-team/reply-templates`. |
| `POST /me/support-access-requests` | Caso 10 (**ruta real**): la persona de apoyo pide al **doctor** acceso clínico temporal. Sin tenant activo; cuerpo `{ tenantId, practitionerProfileId, patientProfileId, encounterId?, reasonText (5–1000) }` → `201 { id, tenantId }`. Lo decide él en `POST /access-requests/:id/decision`. (`POST /practitioner-delegates/:id/access-requests` es de la administración, `SECURITY_ADMIN`: la persona de apoyo recibe 403 `ROLE_INSUFFICIENT`, así que el front ya no la usa.) Sin ficha de paciente (`patientContext.patientProfileId` ausente) no hay a quién pedirle: la pantalla no ofrece el botón. |
| `GET /me/support-agenda` (forma de cable) | `SupportAgendaResponseDto`: **solo citas** (nunca horarios libres), `statusConceptId` (el front resuelve su código con la terminología), doctores por `practitionerProfileId`, y `services` / `locations` (`id`, `name`, `code`) planos y solo de lo que la persona ve. `core/data-access/support-access/support-agenda.wire.ts` la convierte a la agenda de la pantalla. Los horarios libres (`GET /me/support-agenda/free-slots`) son **solo del simulador**: la API no los da al personal de apoyo (`GET /scheduling/slots` no admite `SUPPORT_STAFF`), así que con la API real la agenda muestra lo reservado y no hay desde dónde crear una cita. |
| Claim `accountKind` | Lo firma la API como la clase de cuenta de las **organizaciones** de la persona (`org_account_mode`): el hospital en modo organización firma `ORGANIZATION` para todos los que entran por él, también su secretaria o un doctor. El front trata como cuenta de organización solo a quien no tiene ningún rol de persona (`SUPPORT_STAFF`, `PRACTITIONER`); el simulador firma igual que la API. |

Reglas que el simulador hace cumplir y la API debe repetir (el front solo las explica):

- Una conversación la tiene **una** persona; las demás ven quién. Una conversación resuelta se reabre sola si el paciente vuelve a escribir.
- `isClinical` lo decide la API (el simulador usa una lista de señales); el front nunca clasifica.
- El plazo (`sla_due_at`) es de la API: «vence en», «por vencer» (30 min) y «vencida» se calculan en pantalla con la hora del navegador.
- Los textos de la bandeja tratan de **usted**, como el resto de la aplicación (`check-usted`): «Está respondiendo como Dr. X…», no «Respondes como…».
