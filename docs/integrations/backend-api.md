# API de backend

Las 87 operaciones que el frontend consume, su contrato y su modelo de error.

> **Esta página es el contrato declarado.** `scripts/check-api-contract-drift.mjs`
> compara la lista de abajo con lo que el código realmente llama, y falla si
> alguien agrega una operación sin documentarla.

---

## Configuración

| Aspecto | Valor |
|---|---|
| Raíz | `API_BASE_URL` (`InjectionToken`), desde `environment.apiBaseUrl` |
| Por defecto | `''` — rutas relativas |
| Cliente | `HttpClient` con `withFetch()` |
| Interceptor | `authInterceptor` |
| Prefijos | `/iam` `/public` `/terminology` `/profiles` `/identity` `/common` `/scheduling` `/charts` `/clinical` `/authz` `/practitioner-delegates` `/access-requests` `/delegated-access` `/delegated-permission-sets` `/org` `/auth-providers` `/admin/tenants` |

```ts
export function apiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl === '' ? normalizedPath : `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
}
```

`API_BASE_URL` es un token y no una lectura directa de `environment` *«para que
las pruebas puedan fijar otra raíz sin tocar el archivo de entorno, y para que un
futuro despliegue con varias APIs pueda proveerla por rama del árbol de
inyección»*.

---

## Catálogo de operaciones

### `IamClient` — 12 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/iam/auth/login` | `Login` | Sí |
| `POST` | `/iam/auth/token/refresh` | Interceptor + arranque | Sí |
| `POST` | `/iam/auth/register-patient` | `RegisterPatient` | Sí |
| `POST` | `/iam/auth/register-practitioner` | `RegisterPatient` | Sí |
| `POST` | `/iam/auth/verify-email` | `VerifyEmail` | Sí |
| `POST` | `/iam/auth/resend-verification` | `ResendVerification` (V01-14) | Sí |
| `POST` | `/iam/auth/activate` | **Sin consumidor** | Sí |
| `POST` | `/iam/auth/forgot-password` | `ForgotPassword` | No declarada |
| `POST` | `/iam/auth/reset-password` | `ResetPassword` | No declarada |
| `POST` | `/iam/auth/logout` | `ShellLayout` | No |
| `GET` | `/iam/users` | `OrganizationNew` (buscador de owner, V04-01·F) | No |
| `POST` | `/iam/users` | `UserRegistration` | No |
| `POST` | `/iam/users/assisted-registration` | `AssistedRegistration` | No |

#### Las tres altas no son la misma operación con distintos campos

Se parecen y hacen cosas distintas; confundirlas es cómo alguien termina fijando
la contraseña de otra persona.

| | Quién la ejecuta | La contraseña la elige | Devuelve |
|---|---|---|---|
| `/iam/auth/register-patient` · `register-practitioner` | la persona, sin sesión | su dueño, al registrarse | los ids del perfil |
| `/iam/users` | un `SECURITY_ADMIN` | **quien crea la cuenta** | la cuenta creada |
| `/iam/users/assisted-registration` | un `SECURITY_ADMIN` o `CLINICIAN` | su dueño, **al activar** | un **token de activación de un solo uso** |

`/iam/users` es la única de las tres que fija una clave desde afuera, y por eso
la pantalla que la usa dice explícitamente que hay que entregarla por un canal
seguro y pedir que la cambien.

El **alta asistida no lleva contraseña en el cuerpo** —mandarla devuelve
`400 property password should not exist`, porque el backend valida con
`forbidNonWhitelisted`— y exige `reason`, que queda en la trazabilidad C-18: es
lo que justifica haber creado una cuenta a nombre de otra persona.

**Ninguna de las dos se orquesta desde el frontend.** El backend crea persona,
perfil y cuenta en la misma transacción (registro CTI atómico, regla 11 de la
v4.0.7), así que no hay estado intermedio que reanudar: o quedó todo, o no quedó
nada. Lo que sí se evita acá es el **doble envío**, y de eso se ocupa
`app-form-actions`.

### `PublicClient` — 1 operación

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/public/directory` | `Dashboard` |

Admite dos filtros opcionales de query string, `city` y `specialty`, que **se
omiten si no vienen**: mandarlos vacíos filtraría por la cadena vacía en vez de
no filtrar. `Dashboard` llama sin ninguno.

### `IdentityClient` — 6 operaciones

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `POST` | `/identity/me/tenants/:tenantId/verification` |
| `GET` | `/identity/me/verification-cases` |
| `GET` | `/identity/me/verification-cases/:caseId` |

Todo `identity/me` resuelve el sujeto de la sesión: ninguna ruta recibe a quién
se verifica, y por eso la pantalla de verificación no tiene selector de persona.
La única elección es cuál de las organizaciones **propias** — las del token — se
quiere verificar (`:tenantId`).

### `IdentityAdminClient` — 15 operaciones · 14 comandos y una lectura

El lado administrativo del M27 (`SECURITY_ADMIN`): autoridades, políticas y el
ciclo completo del caso de verificación. La única lectura es la **cola de
revisión**, y es la que evita que quien revisa tenga que conocer de antemano el
id del caso: enlaza a `revision/escalar` con `?caseId=`. El resto de las
pantallas siguen operando con identificadores pegados hasta que el backend
publique los `GET` que faltan.

> La cola se acota **por rol, no por dato**:
> `identity_assurance.identity_verification_cases` no tiene `tenant_id`, así
> que el RLS por `app.current_tenant_id` no la alcanza y un `SECURITY_ADMIN` ve
> los casos de todos los tenants. Deuda abierta, documentada también en
> `IdentityCasesService.listQueue` del backend.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/identity/verification-cases` | `CaseQueue` (V27-02·L) |
| `POST` | `/identity/authorities` | `AuthorityForm` (V27-09) |
| `POST` | `/identity/authorities/:authorityId/endpoints` | `AuthorityEndpointForm` (V27-10) |
| `POST` | `/identity/verification-policies` | `VerificationPolicyForm` (V27-18) |
| `POST` | `/identity/verification-cases` | `CaseOpenForm` (V27-02) |
| `POST` | `/identity/verification-cases/:caseId/evidence` | `CaseEvidenceForm` (V27-05) |
| `POST` | `/identity/verification-cases/:caseId/checks:plan` | `CheckPlanForm` (V27-04) |
| `POST` | `/identity/verification-cases/:caseId/fraud-signals` | `FraudSignalForm` (V27-06) |
| `POST` | `/identity/verification-cases/:caseId/manual-review` | `ManualReviewForm` (V27-07) |
| `POST` | `/identity/verification-cases/:caseId/assertions` | `AssertionIssueForm` (V27-03) |
| `POST` | `/identity/verification-cases/expire-sweep` | `CaseExpireSweep` (V27-02·A) |
| `POST` | `/identity/checks/:checkId/attempts` | `CheckAttemptForm` (V27-11) |
| `POST` | `/identity/checks/:checkId/results` | `CheckResultForm` (V27-12) |
| `POST` | `/identity/manual-review/:reviewId/decision` | `ReviewDecisionForm` (V27-13) |
| `POST` | `/identity/assertions/:assertionId/revoke` | `AssertionRevokeForm` (V27-08·A) |

**`checks:plan` lleva los dos puntos en la URL de verdad**: el backend declara
el segmento escapado (`checks\:plan`), al revés que el `rotate` del M40.

### `ProfilesClient` — 9 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/profiles/patients` | `PatientList` (V05-01·L) · `PatientMerge` (candidatos) |
| `GET` | `/profiles/patients/:profileId` | `PatientDetail` (ficha F-01) |
| `GET` | `/profiles/patients/me/summary` | `MyProfile` (V05-03) |
| `POST` | `/profiles/patients` | `PatientNew` (V05-01·F) |
| `GET` | `/profiles/patients/merge-events` | `ProfilesClient.listMergeEvents` (UC-05-09·L) |
| `POST` | `/profiles/patients/merge` | `PatientMerge` (V05-01·A, UC-05-08) |
| `POST` | `/profiles/patients/merge/:eventId/reverse` | `PatientMerge` (V05-01·A, UC-05-09) |
| `POST` | `/profiles/patients/:profileId/related-persons` | `RelatedPersonForm` (V05-05, UC-05-10) |
| `POST` | `/profiles/practitioners` | — |
| `POST` | `/profiles/persons/:personId/account-links` | — |

> **V05-05 no necesitó ningún `GET` nuevo.** El vault la marcaba «Listado pendiente», pero los
> contactos llegan **embebidos** en la respuesta de `GET /profiles/patients/:profileId`
> (`relatedPersons`). La tabla es real desde el primer día; sólo faltaba el alta.
>
> Sin `personId` el backend **crea** la persona con los datos del cuerpo; con él reutiliza una
> existente. Hoy sólo se ofrece el primer caso: reutilizar exigiría un buscador de personas, y no
> hay `GET /profiles/persons`.

> **La reversión de una fusión ya no caduca al cerrar la pantalla.** El `eventId` que
> `…/merge/:eventId/reverse` exige venía **únicamente** en la respuesta de
> `POST /profiles/patients/merge`: en cuanto se perdía de vista, unir dos historias clínicas dejaba
> de tener vuelta atrás desde la aplicación. Eso era P9 y se cerró con
> `GET /profiles/patients/merge-events`, que devuelve ese identificador — filtrando por paciente en
> **los dos lados** de la fusión, porque quien revisa un registro no sabe si el que mira sobrevivió
> o fue el absorbido.
>
> `PatientMerge` sigue ofreciendo el «Deshacer» en la pantalla de resultado, que es donde se
> necesita —el error se ve en el momento—, pero su aviso dejó de decir que era la última
> oportunidad.

Las tres lecturas entraron con el PR #31 del backend y son lo que sacó a la
sección de pacientes del estado «Listado pendiente» que el vault marca en 674 de
las 693 vistas.

**El listado pagina por cursor y no devuelve total.** Contarlo obligaría al
backend a recorrer la tabla entera en cada página; para «¿hay más?», `nextCursor`.
Como el contrato sólo entrega el cursor hacia adelante, el camino de vuelta lo
recuerda la pantalla.

**`GET /profiles/patients/me/summary` no lleva identificador**: el sujeto lo
resuelve la sesión. Exige identidad verificada vigente y sin ella responde `403`
con `IDENTITY_VERIFICATION_REQUIRED`, que es el único 403 del contrato que llega
a la interfaz **con una salida** en vez de un muro.


### `DirectoryClient` — 2 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/admin/tenants` | `OrganizationList` (V04-01·L) |
| `POST` | `/admin/tenants` | `OrganizationNew` (V04-01·F) |

**`/admin/tenants` es la cara de plataforma del directorio**: opera fuera del
contexto RLS de tenant. El listado admite `SECURITY_ADMIN` y `SUPERADMIN`; el
alta, sólo `SUPERADMIN`. La organización nace `pending` y sin verificar — la
verificación (`POST /admin/tenants/:tenantId/verification`) es otra operación,
de otro rol, y el frontend todavía no la llama.

**El proxy la declara con dos segmentos** (`/admin/tenants`, no `/admin`):
`/admin` a secas capturaría `/administracion/*`, que es una ruta de la
aplicación — ya desvió `/administracion/pacientes` una vez.

### `SchedulingClient` — 8 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/scheduling/resources` | `Agenda` (V41) |
| `GET` | `/scheduling/slots` | `Agenda` · `BookingNew` (revalida el cupo) |
| `GET` | `/scheduling/bookings` | `Agenda` |
| `GET` | `/scheduling/bookings/:bookingId` | — |
| `POST` | `/scheduling/slots/:slotId/holds` | `BookingNew` (V41-09, UC-41-05) |
| `POST` | `/scheduling/holds/:holdToken/confirm` | `BookingNew` (V41-05, UC-41-06) |
| `POST` | `/scheduling/bookings/:bookingId/cancel` | `Agenda` (V41-02·A, UC-41-09) |
| `POST` | `/scheduling/bookings/:bookingId/check-in` | `Agenda` (V41-02·A, UC-41-10) |

**El ciclo de reserva es de dos pasos y el token viaja entre ellos.** El hold
retiene el cupo con anti-double-booking y un TTL (300 s por defecto, de la
política); el `holdToken` **se entrega una sola vez** y el confirm lo consume.
Un hold vencido no se puede confirmar: `BookingNew` trata ese rechazo como
«volver a retener», no como error terminal. Y **no existe
`GET /scheduling/slots/:id`**: la pantalla de reserva reencuentra el cupo
releyendo `GET /scheduling/slots` acotado a la franja que la URL trae.

El módulo se había construido **entero de escritura**: se generaban cupos y se
confirmaban citas, pero no había forma de verlos, y sin `GET /scheduling/slots`
tampoco se podía obtener el `slotId` que exige
`POST /scheduling/slots/{id}/holds`. Estas cuatro lecturas son las que sacaron a
la agenda del estado de placeholder.

**`GET /scheduling/bookings` exige acotar.** Sin `patientProfileId` ni
`resourceId` responde `422 PRECONDITION_FAILED`: no existe «la agenda de toda la
organización». Por eso la pantalla no ofrece un «todos los recursos» que sería un
botón que devuelve un error, y elige el primer recurso cuando la URL no trae uno.

**`GET /scheduling/resources` exige `tenantId`.** Sin organización elegida no se
pide nada: un `400` ahí se leería como «la agenda falló» y lo que falta es un
paso previo.

### `ClinicalClient` — 4 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/clinical/patients/:patientProfileId/summary` | `PatientChart` (UC-39-20) |
| `GET` | `/charts/patients/:patientProfileId/chart` | `PatientChart` (UC-40-14) |
| `POST` | `/clinical/encounters/check-in` | `PatientChart` (UC-08-02) |
| `POST` | `/clinical/encounters/:encounterId/close` | `PatientChart` (UC-08-14) |

**El encuentro se abre y se cierra desde el expediente**, que es donde está
quien atiende. Abrirlo no exige un episodio de cuidado previo (`episodeId` es
opcional) y el backend le pone la hora de inicio y la clase por omisión.

**Cerrar dos veces no es idempotente**: el backend responde `422` sobre un
encuentro que ya no está en curso, así que la pantalla lo muestra como estado y
no como fallo. El cierre admite `expectedRowVersion` para el bloqueo optimista
que el modelo exige (`row_version`), y arrastra los periodos abiertos de
participantes y ubicaciones.

**Dos módulos del backend y un solo cliente**, porque son dos lecturas de lo
mismo: `clinical` guarda lo estructurado —condiciones, alergias, medicación,
observaciones, encuentros— y `chart` lo narrativo —notas, planes de cuidados,
documentos—. La separación es de **escritura**: quien atiende no piensa en dos
módulos, y ninguna pantalla quiere media historia clínica.

Ambas exigen `CLINICIAN` o `PRACTITIONER` a nivel de controlador. **No existe un
listado de colección, y no es una omisión**: la lista de todas las historias de
una organización es exactamente el dato que no debe existir como pantalla.

**El tope es por bloque, no por respuesta.** `limit` acota cada lista por
separado y la respuesta declara en `truncated` cuáles quedaron cortadas. Se
reenvía tal cual a la vista: un expediente al que le faltan notas sin avisar se
lee como «no hay antecedentes».

### `AuthzClient` — 2 operaciones · sólo lectura

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/authz/care-relationships` | `PatientDetail` (V06-01) |
| `GET` | `/authz/legal-representations` | — |

No son permisos: son el **motivo** por el que alguien puede mirar la historia de
otra persona. El PDP los consume; la interfaz sólo los muestra.

**Las dos exigen paciente**, y tampoco es una omisión: el listado completo de
«quién atiende a quién» de una organización es un mapa de su actividad clínica
entera. Se lee de a un paciente, que es como se usa —desde su ficha— y como se
puede auditar. Las respuestas son arrays desnudos, sin sobre de paginación.

### `DelegatedAccessClient` — 11 operaciones · sólo comando

El M29 completo (`SECURITY_ADMIN`): delegaciones de profesional, solicitudes y
concesiones, asignaciones de usuario de organización, sets de permisos y las dos
operaciones de evaluación y barrido. El backend no expone ningún `GET`, así que
las pantallas son paneles de operación con identificadores pegados.

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/practitioner-delegates` | `PractitionerDelegateForm` (V29-01) |
| `POST` | `/practitioner-delegates/:delegationId/revoke` | `DelegationRevocation` (V29-02) |
| `POST` | `/practitioner-delegates/:delegationId/access-requests` | `AccessRequestForm` (V29-03) |
| `POST` | `/practitioner-delegates/:delegationId/grants` | `GrantForm` (V29-04) |
| `POST` | `/org/:tenantMembershipId/user-assignments` | `OrgAssignmentForm` (V29-05) |
| `PATCH` | `/org/user-assignments/:assignmentId` | `OrgAssignmentUpdate` (V29-06) |
| `POST` | `/access-requests/:requestId/decision` | `AccessRequestResolution` (V29-07) |
| `POST` | `/delegated-permission-sets` | `PermissionSetForm` (V29-08) |
| `POST` | `/delegated-permission-sets/:setId/versions` | `SetVersionForm` (V29-09) |
| `POST` | `/authz/effective-actor/evaluate` | `ActorEvaluation` (V29-10) |
| `POST` | `/delegated-access/expiry-sweep` | `ExpirySweep` (V29-11) |

**La evaluación vive bajo `/authz`** aunque el módulo sea el M29: el evaluador
del actor efectivo es el PDP, y el backend lo publica junto al resto de la
autorización.

### `AuthProvidersClient` — 12 operaciones · sólo comando

El M40 (`IDENTITY_ADMIN`): proveedores de identidad federada, sus protocolos,
mapeos, reglas, claves de firma y vinculación a organizaciones, más el flujo de
login federado y la vinculación de cuentas. Sin `GET` en el backend todavía.

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/auth-providers/identity-providers` | `ProviderForm` (V40-03) |
| `POST` | `/auth-providers/identity-providers/:providerId/protocol-configs` | `ProtocolConfigForm` (V40-06) |
| `PUT` | `/auth-providers/identity-providers/:providerId/attribute-mappings` | `AttributeMappingsForm` (V40-04) |
| `POST` | `/auth-providers/identity-providers/:providerId/provisioning-rules` | `ProvisioningRuleForm` (V40-07) |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys` | `SigningKeyForm` (V40-08) |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys/rotate` | `KeyRotationForm` (V40-08·A) |
| `POST` | `/auth-providers/tenant-bindings` | `TenantBindingForm` (V40-09) |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/authorize` | `LoginStartForm` (V40-05·A) |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/callback` | `LoginCallbackForm` (V40-10) |
| `POST` | `/auth-providers/account-link-requests` | `AccountLinkRequestForm` (V40-01) |
| `POST` | `/auth-providers/account-link-requests/complete` | `AccountLinkCompleteForm` (V40-01·A) |
| `POST` | `/auth-providers/federated-identities/:identityId/unlink` | `IdentityUnlinkForm` (V40-02·A) |

Los doce comandos tienen pantalla. Las doce operan con identificadores pegados
—o con el código del proveedor, en el flujo por `by-code`—; cuando lleguen los
endpoints de consulta, los listados reemplazan ese gesto.

### `TerminologyClient` — 2 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/terminology/value-sets/:valueSetId/$expand` | — |
| `GET` | `/terminology/concepts` | `PatientDetail`, `MyProfile` |

La segunda se llama con `?ids=` —los identificadores separados por coma— o con
`?q=` para buscar por texto, que es lo que usa el catálogo de terminología.

**La resolución por ids se trocea de a 200**, que es el tope que el endpoint
declara. Un expediente clínico con sus ocho bloques lo pasa sin esfuerzo, y sin
trocear la petición vuelve `400` y la pantalla entera se queda sin etiquetas por
culpa del id doscientos uno.

La segunda es el camino **inverso** al del selector: el resto del contrato
devuelve `*ConceptId` en uuid y ninguna pantalla puede mostrar un uuid. Se piden
todos los de una pantalla en una sola llamada, no uno por campo, y su fallo
degrada esos campos a «Sin registrar» sin tumbar la pantalla.

### `FilesClient` — 1 operación

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/common/files/upload` | `IdentityVerification` (V27-14…17) |

**Cinco operaciones sin pantalla que las llame** — las dos altas restantes de
`ProfilesClient`, la reserva puntual de `SchedulingClient`, las bases legítimas
de `AuthzClient` y el `$expand` de terminología. Eran más: V05-01 y V05-03
encendieron las altas de perfil, y las vistas de verificación de identidad
(V27-01 y V27-14…17) encendieron las cuatro de `IdentityClient` y esta subida.
No es código muerto: todas tienen prueba y son la mitad de un flujo cuya
interfaz todavía no se escribió.
Ver [el mapa de integraciones §3](../architecture/integration-map.md#3--operaciones-sin-consumidor).

---

## Modelo de error

Copiado de `src/common/errors/error-codes.ts` del backend, que los declara parte
del contrato:

```ts
export const API_ERROR_CODES = [
  'VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN',
  'IDENTITY_VERIFICATION_REQUIRED', 'NOT_FOUND', 'CONFLICT',
  'PRECONDITION_FAILED', 'CONCURRENCY_CONFLICT', 'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED', 'DEPENDENCY_UNAVAILABLE', 'INTERNAL',
] as const;
```

### Cuerpo de error

```jsonc
{
  "code": "VALIDATION_FAILED",
  "message": "…",                 // para mostrar, NO para ramificar
  "correlationId": "…",           // si el servidor asignó uno
  "details": { "messages": ["…"] },
  "timestamp": "…",
  "path": "…"
}
```

### **Se ramifica por `code`, nunca por `message`**

Es la regla del proyecto, y tiene dos razones:

1. El mensaje está pensado para humanos y puede cambiar de redacción o de idioma.
2. **Dos códigos comparten el 403** y hay que separarlos, así que el estado HTTP
   tampoco alcanza:

| Código | Significado | Estado |
|---|---|---|
| `FORBIDDEN` | Rol insuficiente. **Un muro sin salida** | S5 sin acción |
| `IDENTITY_VERIFICATION_REQUIRED` | Identidad sin verificar. **Una puerta** | S5 **con** acción |

> *«Para la persona son estados opuestos: rol insuficiente es un muro sin salida,
> e identidad sin verificar es una puerta —hay algo que puede hacer y hay que
> ofrecérselo.»*

### `readApiError` devuelve `null` cuando no confía

```ts
export function readApiError(error: HttpErrorResponse): ApiErrorBody | null {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const code = (body as Record<string, unknown>)['code'];
  if (typeof code !== 'string' || !isApiErrorCode(code)) return null;
  …
}
```

> *«Devuelve `null` cuando la respuesta no tiene esa forma —un proxy que devuelve
> HTML, un fallo de red, un 502 de infraestructura—, que es exactamente cuando no
> hay que confiar en lo que venga.»*

Un `code` que no esté en la lista se descarta: el frontend no inventa
significados que el contrato no declara.

### Traducción completa a estados

Ver [flujo de datos §5](../architecture/data-flow.md#5--el-error-se-traduce-a-un-estado-del-m34).

---

## Reglas del transporte

### 1 · Los cuerpos se arman campo por campo

El backend valida con `forbidNonWhitelisted`: **un campo de más devuelve 400**. Y
un opcional presente en `undefined` viaja como clave declarada, así que se omite
con spread condicional o con `stripUndefined()`.

### 2 · Los tipos de la vista no son los DTO

```ts
export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;      // ← el transporte manda texto ISO
}
```

> *«Que la API devuelva una fecha como texto ISO es asunto del transporte, no de
> la pantalla.»*

### 3 · Las uniones discriminadas impiden peticiones imposibles

```ts
export type LoginCredentials =
  | { kind: 'email';      email: string;      password: string; mfaCode?: string }
  | { kind: 'nationalId'; nationalId: string; password: string; mfaCode?: string };
```

> *«Con dos opcionales, mandar los dos compilaría y fallaría recién contra el
> servidor; así no se puede ni escribir.»*

### 4 · El `$` de terminología va literal

> *«Express enruta sobre el path sin decodificar, así que `%24expand` no casa con
> la ruta `:id/$expand` y vuelve 404 — verificado contra la API viva.»*

### 5 · La subida no fija `Content-Type`

El navegador tiene que ponerlo él para incluir el `boundary`.

### 6 · El cursor es opaco

Se reenvía tal cual y no se interpreta. Y **no hay total**: solo `count` de la
página y `nextCursor`.

---

## Lo que NO está cubierto

| Aspecto | Estado |
|---|---|
| Cancelación de peticiones | **No se usa.** Ninguna llamada se cancela al destruir el componente |
| Timeout explícito | **No se fija.** Se usa el del navegador |
| Reintentos automáticos | **Ninguno**, salvo el refresco único del interceptor |
| Deduplicación | Solo el refresco |
| Respuestas parciales | No se contemplan |
| Fallback ante fallo | Ninguno. Se muestra S8/S9 |
| Tipos generados desde OpenAPI | **No.** Escritos a mano |
| Pruebas de contrato | **No existen** |

### Las dos que más pesan

**Sin cancelación**, una pantalla que se destruye mientras su petición viaja
recibe la respuesta y escribe en una señal huérfana. Hoy es inocuo —las señales
no lanzan— pero es un patrón que no escala.

**Sin tipos generados ni pruebas de contrato**, la única defensa contra un cambio
del backend es que alguien lo note. Los comentarios rastrean el origen
(«verificadas una por una contra `iam-auth.controller.ts`»), pero eso es
trazabilidad, no verificación.

Las dos están en [el análisis de brechas](../reports/documentation-gap-analysis.md),
la segunda como `HIGH`.

---

## Verificación

```bash
node scripts/check-api-contract-drift.mjs
```

Compara los endpoints del código con los de esta página. **Detecta que alguien
agregue una llamada sin documentarla; no detecta que el backend cambie el
contrato.** Esa segunda mitad exige acceso al OpenAPI del backend, que no es
alcanzable desde este repositorio.
