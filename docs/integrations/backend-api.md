# API de backend

Las 184 operaciones que el frontend consume, su contrato y su modelo de error.

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
| Prefijos | `/iam` `/public` `/terminology` `/profiles` `/identity` `/common` `/scheduling` `/charts` `/clinical` `/authz` `/practitioner-delegates` `/access-requests` `/delegated-access` `/delegated-permission-sets` `/org` `/auth-providers` `/admin/tenants` `/community` `/procedure-cases` `/dental-procedures` `/diagnostic-units` |

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

### `IamClient` — 14 operaciones

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
| `POST` | `/iam/auth/register-organization` | `ActivateAccount` y 13 pantallas más | Sí |

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

### `IdentityClient` — 7 operaciones

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `POST` | `/identity/me/tenants/:tenantId/verification` |
| `GET` | `/identity/me/verification-cases` |
| `GET` | `/identity/me/verification-cases/:caseId` |
| `GET` | `/identity/me/verification-types` | `Dashboard` y 4 pantallas más | No |

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

### `ProfilesClient` — 31 operaciones

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
| `GET` | `/profiles/practitioners/me/summary` | `MyProfile` · `PractitionerProfile` |
| `PATCH` | `/profiles/practitioners/me` | `PractitionerProfileEdit` |
| `POST` | `/profiles/practitioners/:profileId/specialties` | — (UC-05-06) |
| `POST` | `/profiles/practitioners/:profileId/jurisdiction-authorizations` | — |
| `GET` | `/profiles/practitioners` | `PractitionersDirectory` (guía, carril R2-1) |
| `GET` | `/profiles/practitioners/:profileId/summary` | `PractitionerDetail` (ficha de la guía, R2-1) |
| `GET` | `/profiles/practitioners/me/affiliations` | `WorkHistory` (carril 5) |
| `POST` | `/profiles/practitioners/me/affiliations` | `WorkHistory` (carril 5) |
| `GET` | `/practitioners/:practitionerProfileId/sites` | `PracticeSitesClient` (carril 5) |
| `POST` | `/clinical/care-episodes` | `admission-block` (carril 5) |
| `POST` | `/cds/check-interactions` | receta y medicación (Pablo) |
| `GET` | `/profiles/patients/me` | `AccessRequests` y 27 pantallas más | No |
| `PATCH` | `/profiles/patients/me` | `AccessRequests` y 27 pantallas más | No |
| `DELETE` | `/profiles/patients/me/photo` | `AccessRequests` y 27 pantallas más | No |
| `PUT` | `/profiles/patients/me/photo` | `AccessRequests` y 27 pantallas más | No |
| `PUT` | `/profiles/practitioners/:profileId/photo` | `AccessRequests` y 27 pantallas más | No |
| `POST` | `/profiles/practitioners/me/credentials` | `AccessRequests` y 27 pantallas más | No |
| `DELETE` | `/profiles/practitioners/me/credentials/:credentialId` | `AccessRequests` y 27 pantallas más | No |
| `GET` | `/profiles/practitioners/me/linkable-organizations` | `AccessRequests` y 27 pantallas más | No |
| `GET` | `/profiles/practitioners/me/onboarding` | `AccessRequests` y 27 pantallas más | No |
| `GET` | `/profiles/practitioners/specialty-counts` | `AccessRequests` y 27 pantallas más | No |

> **Las cinco últimas no son de `ProfilesClient` y están declaradas acá al resolver el
> carril R2-1, no por sus autores.** Vienen de los carriles 3, 4 y 5 y de la medicación, que
> agregaron operaciones sin declararlas. `check-api-contract-drift` no distingue «lo agregó
> otro» de «lo agregué yo»: mientras estén sin declarar, **toda** rama que mezcle `dev`
> hereda el rojo. Si su autor prefiere moverlas a una sección propia, mejor — lo que no puede
> quedar es sin declarar.

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


### `DirectoryClient` — 18 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/admin/tenants` | `OrganizationList` (V04-01·L) |
| `POST` | `/admin/tenants` | `OrganizationNew` (V04-01·F) |
| `GET` | `/tenants/:tenantId` | `OrganizationDetail` (V04-06·L) |
| `GET` | `/tenants/:tenantId/branches` | `OrganizationDetail` (V04-02·L) |
| `GET` | `/tenants/:tenantId/memberships` | `OrganizationDetail` (V04-04·L) |
| `GET` | `/tenants/:tenantId/memberships/:membershipId/branch-assignments` | `OrganizationDetail` (V04-03·L) |
| `GET` | `/tenants/:tenantId/child-tenants` | `OrganizationDetail` (V04-07·L) |
| `POST` | `/admin/tenants/:tenantId/verification` | `BranchNew` y 9 pantallas más | No |
| `PATCH` | `/tenants/:tenantId` | `BranchNew` y 9 pantallas más | No |
| `GET` | `/tenants/:tenantId/agenda` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/branches` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/child-tenants` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/memberships` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/memberships/:membershipId/branch-assignments` | `BranchNew` y 9 pantallas más | No |
| `GET` | `/tenants/:tenantId/practitioner-requests` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/practitioner-requests/:affiliationId/approve` | `BranchNew` y 9 pantallas más | No |
| `POST` | `/tenants/:tenantId/practitioner-requests/:affiliationId/reject` | `BranchNew` y 9 pantallas más | No |
| `GET` | `/tenants/me` | `BranchNew` y 9 pantallas más | No |

**`/admin/tenants` es la cara de plataforma del directorio**: opera fuera del
contexto RLS de tenant. El listado admite `SECURITY_ADMIN` y `SUPERADMIN`; el
alta, sólo `SUPERADMIN`. La organización nace `pending` y sin verificar — la
verificación (`POST /admin/tenants/:tenantId/verification`) es otra operación,
de otro rol, y el frontend todavía no la llama.

**El proxy la declara con dos segmentos** (`/admin/tenants`, no `/admin`):
`/admin` a secas capturaría `/administracion/*`, que es una ruta de la
aplicación — ya desvió `/administration/patients` una vez.

**`/tenants/{id}/…` es la otra cara, la de la organización**: sus sucursales,
su plantilla y sus sub-organizaciones. Dos cosas que no son evidentes y que
costaron un 403 y un falso verde:

- **Declaran el tenant que consultan.** La API rechaza con
  `FORBIDDEN — La solicitud privilegiada declara tenants propietarios
  contradictorios` la petición cuyo `X-Tenant-Id` no coincide con el tenant de
  la ruta. Como estas pantallas miran una organización **distinta** de la
  activa, el cliente pone la cabecera y el interceptor la respeta en vez de
  pisarla con la de la sesión.
- **El proxy las declara con barra final** (`/tenants/`, no `/tenants`): la
  API no recibe nada en la ruta pelada —el listado de plataforma es
  `/admin/tenants`— y sin barra capturaría cualquier ruta futura de Angular
  que empiece por `tenants`. Si falta el contexto, el servidor devuelve el
  `index.html` **con 200** y la llamada parece pasar sin haber tocado la API.

`listBranches` y `listBranchAssignments` **no paginan**: devuelven todo con su
`count`, así que la pantalla no puede prometer «Siguientes» sobre eso.

### `AccountingClient` — 13 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/practices` | `Accounting` (elige de qué práctica son los libros) |
| `GET` | `/accounting/accounts` | `Accounting` (plan de cuentas, UC-16-01·L) |
| `GET` | `/accounting/trial-balance` | `Accounting` (sumas y saldos, UC-16-06) |
| `GET` | `/accounting/journal-transactions` | `Accounting` (libro diario, UC-16-01·L) |
| `GET` | `/accounting/journal-transactions/:transactionId` | `Accounting` (el asiento con sus líneas, UC-16-01·D) |
| `GET` | `/accounting/balance-sheet` | `Accounting` y 2 pantallas más | No |
| `GET` | `/accounting/general-ledger` | `Accounting` y 2 pantallas más | No |
| `GET` | `/accounting/income-statement` | `Accounting` y 2 pantallas más | No |
| `POST` | `/accounting/journal-transactions` | `Accounting` y 2 pantallas más | No |
| `POST` | `/accounting/journal-transactions/drafts` | `Accounting` y 2 pantallas más | No |
| `POST` | `/accounting/practitioner/consultation-income` | `Accounting` y 2 pantallas más | No |
| `POST` | `/accounting/practitioner/entries` | `Accounting` y 2 pantallas más | No |
| `GET` | `/accounting/practitioner/paid-consultations` | `Accounting` y 2 pantallas más | No |

**Todo cuelga de un `practiceId`** y no existe «la práctica del usuario»: una
organización puede tener varias. Por eso `/practices` va primero; sin esa lista
la pantalla no tiene qué pedir. La API lo acota por el tenant del contexto, no
por un parámetro.

**Los importes viajan como texto decimal** (`"1250.00"`), y así se quedan. Pasarlos
a `number` sería el error clásico: `0.1 + 0.2` no da `0.3` en coma flotante y un
balance descuadrado por un céntimo no se distingue de uno con un error contable
real. Los totales los calcula la API con enteros; el navegador no suma dinero.

**`balanced` y `truncated` se leen, no se deducen.** El primero es la
comprobación de la que depende que el resto del informe signifique algo; el
segundo avisa de que la agregación tocó su tope — un balance recortado en
silencio es un balance que miente.

**Las cuatro lecturas del mayor responden 403** si el `practiceId` pertenece a
otra organización. Es lo que hace seguro que las pueda pedir un `PRACTITIONER`
y no sólo un `SECURITY_ADMIN`.

### `ServicesCatalogClient` — 5 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/billing/service-catalog` | `ServicesCatalog` (carril 1) |
| `POST` | `/billing/service-catalog` | `ServicesCatalog` (alta de un servicio) |
| `PATCH` | `/billing/service-catalog/:id` | `MyServices` y 3 pantallas más | No |
| `GET` | `/billing/service-catalog/procedure-specialties` | `MyServices` y 3 pantallas más | No |
| `GET` | `/billing/service-catalog/procedures` | `MyServices` y 3 pantallas más | No |

Reusa `GET /practices` de `AccountingClient` para elegir de qué práctica es el
catálogo — mismo motivo: no existe «la práctica del usuario».

### `SchedulingClient` — 33 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/scheduling/resources` | `Agenda` (V41) |
| `GET` | `/scheduling/slots` | `Agenda` · `BookingNew` (revalida el cupo) |
| `GET` | `/scheduling/bookings` | `Agenda` |
| `GET` | `/scheduling/bookings/:bookingId` | — |
| `POST` | `/scheduling/resources` | `AgendaCreate` (fase 1, UC-41-01) |
| `POST` | `/scheduling/booking-policies` | `AgendaCreate` (fase 2, UC-41-01) |
| `POST` | `/scheduling/resources/:resourceId/templates` | `AgendaCreate` (fase 3, UC-41-02) |
| `POST` | `/scheduling/templates/:templateId/generate-slots` | `AgendaCreate` (fase 4, UC-41-03) |
| `POST` | `/scheduling/resources/:resourceId/exceptions` | `AgendaCreate` (fase 5, UC-41-04) |
| `POST` | `/scheduling/slots/:slotId/holds` | `BookingNew` (V41-09, UC-41-05) |
| `POST` | `/scheduling/holds/:holdToken/confirm` | `BookingNew` (V41-05, UC-41-06) |
| `POST` | `/scheduling/bookings/:bookingId/cancel` | `Agenda` (V41-02·A, UC-41-09) |
| `POST` | `/scheduling/bookings/:bookingId/check-in` | `Agenda` (V41-02·A, UC-41-10) |
| `POST` | `/scheduling/bookings/:bookingId/reschedule` | `Appointments` (mi cuenta: mover el turno a otro cupo) |
| `POST` | `/scheduling/holds/:holdToken/request` | `BookingNew` (el paciente solicita, no confirma) |
| `POST` | `/scheduling/bookings/:bookingId/reject` | `Agenda` (el doctor rechaza una solicitud) |
| `POST` | `/scheduling/bookings/:bookingId/:accion` | `Agenda` (acepta/atiende: la acción va en la ruta) |
| `GET` | `/scheduling/activity-types` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/appointments/direct` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/bookings/:bookingId/delay` | `Agenda` y 11 pantallas más | No |
| `PUT` | `/scheduling/bookings/:bookingId/payment-state` | `Agenda` y 11 pantallas más | No |
| `GET` | `/scheduling/exception-types` | `Agenda` y 11 pantallas más | No |
| `DELETE` | `/scheduling/exceptions/:exceptionId` | `Agenda` y 11 pantallas más | No |
| `PATCH` | `/scheduling/exceptions/:exceptionId` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/resources/:resourceId/close-slots` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/resources/:resourceId/delay` | `Agenda` y 11 pantallas más | No |
| `GET` | `/scheduling/resources/:resourceId/exceptions` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/resources/:resourceId/shift-slots` | `Agenda` y 11 pantallas más | No |
| `GET` | `/scheduling/resources/:resourceId/templates` | `Agenda` y 11 pantallas más | No |
| `DELETE` | `/scheduling/templates/:templateId` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/templates/:templateId/reactivate` | `Agenda` y 11 pantallas más | No |
| `GET` | `/scheduling/waitlist` | `Agenda` y 11 pantallas más | No |
| `POST` | `/scheduling/waitlist` | `Agenda` y 11 pantallas más | No |

> **Las tres últimas se declaran acá al resolver el conflicto del carril 13/16,
> no por sus autores.** Entraron a `dev` con los carriles 06 y 07 sin pasar por
> esta página, y eso deja `check-api-contract-drift` en rojo para todo el que
> abra un PR después — el verificador no distingue «lo agregó otro» de «lo
> agregué yo». Si algún consumidor quedó mal atribuido, corregilo: se dedujo de
> quién importa el cliente.

**La construcción de agenda es de cinco fases encadenadas por id** (`AgendaCreate`,
`/schedule/new`, sólo `SCHEDULING_ADMIN`). El alta del recurso devuelve el
`resourceId` sobre el que cuelgan la plantilla y las excepciones; la política
devuelve el `bookingPolicyId` que la plantilla referencia; la plantilla devuelve
el `templateId` que se materializa en cupos. Cada fase persiste contra su propio
`POST` antes de avanzar: no se acumula para guardar al final.

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

### `ClinicalClient` — 19 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/clinical/patients/:patientProfileId/summary` | `PatientChart` (UC-39-20) |
| `GET` | `/charts/patients/:patientProfileId/chart` | `PatientChart` (UC-40-14) |
| `POST` | `/clinical/encounters/check-in` | `PatientChart` (UC-08-02) |
| `POST` | `/clinical/encounters/:encounterId/close` | `PatientChart` (UC-08-14) |
| `POST` | `/clinical/conditions` | `PatientChart` — diagnóstico |
| `POST` | `/clinical/allergy-intolerances` | `PatientChart` — alergia |
| `POST` | `/clinical/observations` | `PatientChart` — observación |
| `POST` | `/clinical/medication-requests` | `PatientChart` — prescripción |
| `POST` | `/clinical/medication-requests/:medicationRequestId/sign` | `PatientChart` — firma |
| `POST` | `/clinical/medication-requests/:medicationRequestId/issue` | `PatientChart` — emisión |
| `POST` | `/clinical/diagnostic-reports` | `ClinicalClient` — informe diagnóstico (UC-08-06) |
| `POST` | `/clinical/diagnostic-reports/:diagnosticReportId/release` | `ClinicalClient` — liberación (UC-08-07) |
| `POST` | `/clinical/allergy-intolerances/:allergyId/attachments` | `AdmissionBlock` y 12 pantallas más | No |
| `POST` | `/clinical/conditions/:conditionId/attachments` | `AdmissionBlock` y 12 pantallas más | No |
| `POST` | `/clinical/conditions/:conditionId/change-status` | `AdmissionBlock` y 12 pantallas más | No |
| `GET` | `/clinical/me/medical-aspects` | `AdmissionBlock` y 12 pantallas más | No |
| `PUT` | `/clinical/me/medical-aspects` | `AdmissionBlock` y 12 pantallas más | No |
| `POST` | `/clinical/medication-requests/:requestId/attachments` | `AdmissionBlock` y 12 pantallas más | No |
| `POST` | `/clinical/procedures/:procedureId/attachments` | `AdmissionBlock` y 12 pantallas más | No |

Las seis escrituras clínicas **no estaban declaradas**: entraron con el registro
del expediente y el contrato quedó atrás, así que la comprobación de deriva
—que compara lo que el código llama contra lo que este archivo declara— venía
fallando en `dev` para todo el mundo. Se declaran acá.

Las dos últimas —el informe diagnóstico— son las únicas de la tabla que
**ninguna pantalla usa todavía**, y la columna «Consumidor» lo dice nombrando al
cliente en vez de a una vista. No es un olvido: el informe no aparece en
`getSummary` ni en `getChart`, y el backend no expone ningún `GET` de reportes,
así que el formulario se tragaría el dato sin poder mostrarlo. El contrato entra
verificado para que, cuando exista la lectura, falte sólo la vista.

La prescripción son **tres pasos y no uno**: crear, firmar y emitir. El modelo
los separa porque firmar es un acto del profesional y emitir es lo que la vuelve
utilizable en una farmacia; colapsarlos escondería quién hizo qué.

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

### `ChartTemplatesClient` — 3 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/charts/templates` | `ClinicalForms` (listado por especialidad) |
| `GET` | `/charts/templates/:id` | `ClinicalForms` · `SpecialtyFormBlock` (esquema de campos) |
| `POST` | `/charts/templates` | `ClinicalForms` (alta) |

Completa el CRUD que antes sólo tenía `assignTemplate` — crear, listar y leer
el esquema de una plantilla por especialidad, no sólo asignarla.

### `FormsClient` — 14 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/forms/instances` | `SpecialtyFormBlock` (abre una instancia) |
| `POST` | `/forms/instances/:instanceId/values` | `SpecialtyFormBlock` (captura valores) |
| `POST` | `/forms/instances/:instanceId/close` | `SpecialtyFormBlock` (cierra la instancia) |
| `POST` | `/forms/field-definitions` | `FormBuilder` (declara el campo, UC-09-02) |
| `POST` | `/forms/assignments` | `FormBuilder` (lo cuelga del formulario, UC-09-06) |
| `GET` | `/forms/assignments/budget` | `FormBuilder` (cuánto queda por extender) |
| `DELETE` | `/forms/assignments/:assignmentId` | `FormBuilder` y 2 pantallas más | No |
| `PATCH` | `/forms/assignments/:assignmentId` | `FormBuilder` y 2 pantallas más | No |
| `PUT` | `/forms/assignments/order` | `FormBuilder` y 2 pantallas más | No |
| `PATCH` | `/forms/field-definitions/:fieldId` | `FormBuilder` y 2 pantallas más | No |
| `GET` | `/forms/instances` | `FormBuilder` y 2 pantallas más | No |
| `GET` | `/forms/instances/:instanceId` | `FormBuilder` y 2 pantallas más | No |
| `GET` | `/forms/me/instances` | `FormBuilder` y 2 pantallas más | No |
| `GET` | `/forms/me/instances/:instanceId` | `FormBuilder` y 2 pantallas más | No |

Las tres primeras son el ciclo de vida que `specialty-form-block` necesita
—abrir, capturar, cerrar—. El motor de `forms` tiene mucho más (sets versionados,
migraciones) y sigue sin cliente hasta que una pantalla lo necesite de verdad.

Las tres últimas son el generador del doctor, y **son dos permisos distintos, no
uno**: declarar un campo sólo pide estar autenticado, colgarlo de un formulario
exige poder asignar dentro del tenant. Por eso se hacen en dos llamadas y no en
una, y por eso un fallo en la segunda deja un campo declarado que todavía no
cuelga de nada.

`GET /forms/assignments/budget` es el techo antes de empezar: la política de
extensibilidad (`extension_target_policies.maximumFields`) dice cuántos campos
propios admite ese target, y la pantalla lo consulta para no ofrecer un alta que
el backend va a rechazar.

### `AuthzClient` — 5 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/authz/care-relationships` | `PatientDetail` (V06-01) |
| `GET` | `/authz/legal-representations` | — |
| `POST` | `/authz/care-relationships/:id/respond` | `AccessRequests` y 2 pantallas más | No |
| `POST` | `/authz/care-relationships/request` | `AccessRequests` y 2 pantallas más | No |
| `GET` | `/authz/care-relationships/requests/mine` | `AccessRequests` y 2 pantallas más | No |

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

### `TerminologyClient` — 8 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/terminology/value-sets/:valueSetId/$expand` | — |
| `GET` | `/terminology/concepts` | `PatientDetail`, `MyProfile` |
| `GET` | `/terminology/concepts/:conceptId` | `Glossary` (entrada del glosario, carril R2-6) |
| `GET` | `/terminology/value-sets` | `Glossary` (las etiquetas por las que se hojea, R2-6) |
| `GET` | `/terminology/code-systems` | `Agenda` y 34 pantallas más | No |
| `GET` | `/terminology/code-systems/:codeSystemId/versions` | `Agenda` y 34 pantallas más | No |
| `POST` | `/terminology/versions/:versionId/import-file` | `Agenda` y 34 pantallas más | No |
| `POST` | `/terminology/versions/:versionId/publish` | `Agenda` y 34 pantallas más | No |

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

### `SystemContextClient` — 1 operación

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/system-context/dynamic-enums` | `ConceptSelect` (alta de paciente) |

**Es lo que convierte un `*_concept_id` en un selector.** La regla del modelo es
que ningún campo de catálogo se escribe a mano, pero para poblarlo hay que saber
**qué conjunto de valores gobierna esa columna** — y eso no estaba en ninguna
parte legible: el `$expand` de terminología exige el uuid del conjunto, y los
uuid no eran constantes publicadas. Por eso el alta de paciente salió sin género
ni sexo al nacer.

Se pide por `?target=esquema.tabla.columna`: por **el campo que se va a llenar**,
no por el catálogo que lo llena. Es la diferencia entre lo que un formulario sabe
y lo que no tiene por qué averiguar.

**Se memoiza por target, y eso es parte del contrato, no una optimización:** los
identificadores son UUIDv5 deterministas y la respuesta trae `cacheToken`, la
huella de la versión publicada. Un fallo **no** se memoiza — un corte de red no
puede dejar un campo marcado como «sin opciones» por el resto de la sesión.

Las etiquetas del catálogo vienen en inglés técnico («Administrative gender
female») porque son terminología, no copy de producto: `ConceptSelect` las
traduce por **código** —`GENDER_FEMALE`—, que es la identidad semántica estable
del concepto, igual que hace `case-status.ts` con los estados de un trámite.

### `HealthContextClient` — 12 operaciones · 11 comandos y una lectura

El M44 completo salvo la operación de sistema. Recolección gobernada del
contexto sanitario de un país: agentes, fuentes con su licencia y su nivel de
confianza, programaciones, corridas idempotentes, observaciones inmutables y
contextos versionados con hechos trazables a su evidencia.

La única lectura, `contexts/resolve`, **no es un listado**: exige país, dominio y
clave, y los dos primeros pasan por `ParseUUIDPipe`. No existe `GET` de colección
de nada, así que el resto de las pantallas son formularios con identificadores
pegados.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/health-context/contexts/resolve` | `ContextResolve` (V44-03·L) |
| `POST` | `/health-context/agents` | `AgentForm` (V44-07) |
| `POST` | `/health-context/sources` | `SourceForm` (V44-09) |
| `POST` | `/health-context/schedules` | `ScheduleForm` (V44-08) |
| `POST` | `/health-context/contexts` | `ContextForm` (V44-03·F) |
| `POST` | `/health-context/contexts/:contextId/versions` | `VersionForm` (V44-04) |
| `POST` | `/health-context/versions/:versionId/quality-reviews` | `QualityReviewForm` (V44-06) |
| `POST` | `/health-context/versions/:versionId/publish` | `VersionPublish` (V44-05·A) |
| `POST` | `/health-context/versions/:versionId/supersede` | `VersionSupersede` (V44-05·A) |
| `POST` | `/health-context/collection-runs` | `CollectionRunForm` (V44-01) |
| `POST` | `/health-context/collection-runs/:collectionRunId/observations` | `ObservationForm` (V44-02) |
| `POST` | `/health-context/collection-runs/:collectionRunId/finish` | `CollectionRunFinish` (V44-01·A) |

**`POST /health-context/internal/schedules/run-due` no está en el cliente.** Es
`@Roles('SYSTEM')`: ninguna persona lo puede ejecutar, así que un método que
siempre responde 403 sería código muerto. El vault lo cataloga aparte, en su
tabla de operaciones internas (V44-10).

### `GeoClient` — 11 operaciones · 10 comandos y una lectura

El M13 completo (`SECURITY_ADMIN` en los cuatro controllers): sujetos rastreados
con su consentimiento, sesiones, pings de alta frecuencia, viajes y geocercas con
sus cruces.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/geo/tracked-subjects/:trackedSubjectId/last-position` | `LastPosition` (V13-02) |
| `POST` | `/geo/tracked-subjects` | `TrackedSubjectForm` (V13-01) |
| `POST` | `/geo/tracked-subjects/:trackedSubjectId/pings` | `PingIngest` (V13-03) |
| `POST` | `/geo/tracked-subjects/:trackedSubjectId/revoke-consent` | `ConsentRevocation` (V13-01·A) |
| `POST` | `/geo/tracking-sessions` | `TrackingSessionForm` (V13-04) |
| `POST` | `/geo/tracking-sessions/:sessionId/close` | `TrackingSessionClose` (V13-04·A) |
| `POST` | `/geo/trips` | `TripForm` (V13-05) |
| `POST` | `/geo/trips/:tripId/close` | `TripClose` (V13-05·A) |
| `POST` | `/geo/geofences` | `GeofenceForm` (V13-07) |
| `POST` | `/geo/geofence-events` | `GeofenceEventForm` (V13-06) |

#### Dos asimetrías del contrato que el cliente respeta

**Las coordenadas entran como número y salen como texto.** El `POST` de pings las
valida con `@IsLatitude`/`@IsLongitude` sobre `number`; la lectura las devuelve
`string` porque son `numeric` de Postgres. Convertirlas al leer perdería
decimales y ceros significativos, así que `LastPosition.latitude` es `string` y
hay un assert dedicado a impedir que alguien lo «arregle». Lo mismo vale para
`Trip.distanceM` y para los tres contadores de `RunFinished`, que son `bigint`.

**`state`, `status`, `subjectType`, `shapeType` y `eventType` de las respuestas
son uuid de concepto**, no las palabras que se mandan al crear. Para mostrarlos
hay que resolverlos contra terminología; si eso falla, se muestra el uuid, nunca
una etiqueta inventada.

#### `tenantId` es un campo de propiedad, no un dato más

`NewTrackedSubject.tenantId` (opcional) y `NewGeofence.tenantId` (obligatorio)
están en la lista `OWNERSHIP_FIELDS` del backend: su interceptor de tenant los
contrasta con la cabecera `X-Tenant-Id` y responde **403** si difieren. En el
sujeto conviene omitirlo y dejar que lo resuelva el interceptor; en la geocerca
tiene que ser el tenant activo de la sesión.

### `ProceduresClient` — 4 operaciones · carril 3

El histórico de procedimientos quirúrgicos y odontológicos (M53).

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/procedure-cases` | `ProceduresBlock` (ficha del paciente) |
| `GET` | `/procedure-cases/:caseId` | `ProceduresBlock` |
| `GET` | `/dental-procedures` | `ProceduresBlock` |
| `GET` | `/dental-procedures/catalog` | `ProceduresBlock` |
| `POST` | `/dental-procedures` | `ProceduresBlock` |

### `DiagnosticUnitsClient` — 2 operaciones · punto 3

Directorio de unidades verificadas del tenant activo (M23). No es la cola clínica
de `/diagnostics`: lista laboratorios e imagenología y abre su perfil público.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/diagnostic-units` | `LaboratoryDirectory` |
| `GET` | `/diagnostic-units/:id` | `LaboratoryDetail` |

### `DiagnosticUnitsAdminClient` — 8 operaciones

La **consola de administración** del laboratorio (M23), no su vitrina.

Es un cliente aparte de `DiagnosticUnitsClient` porque responde otra pregunta y
la contesta con otros datos. Aquél sirve el directorio que un paciente usa para
elegir dónde hacerse un estudio: filtra a unidades activas **y** verificadas,
ofertas activas y precios de cronogramas marcados como públicos. Éste devuelve
el mismo dominio **sin** esos filtros —para poder terminar de configurar lo que
todavía no se publicó— y agrega dos cosas que a la vitrina no le corresponden:
el personal con sus permisos de validación y firma, y los números de serie del
equipamiento.

Las dos operaciones exigen `SECURITY_ADMIN`, y una unidad de otro tenant
responde el mismo `404` que una inexistente.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/diagnostic-units/administration` | `MedicalLaboratory` |
| `GET` | `/diagnostic-units/:id/administration` | `MedicalLaboratory` |
| `DELETE` | `/diagnostic-study-offerings/:offeringId` | `MedicalLaboratory` | No |
| `POST` | `/diagnostic-units/:unitId/price-schedules` | `MedicalLaboratory` | No |
| `POST` | `/diagnostic-units/:unitId/study-offerings` | `MedicalLaboratory` | No |
| `POST` | `/diagnostic-units/:unitId/verify-and-publish` | `MedicalLaboratory` | No |
| `POST` | `/price-schedules/:scheduleId/study-prices` | `MedicalLaboratory` | No |
| `POST` | `/study-prices/:priceId/close` | `MedicalLaboratory` | No |

### `MedicalOrganizationClient` — 2 operaciones · carril 13

La consola del administrador de organización médica (M14 `practice`).

`GET /practices/:practiceId/organization` devuelve **el árbol completo en una
lectura**: sedes, áreas, infraestructura, servicios, plantilla, documentación
legal e inventario. Es una sola respuesta y no siete endpoints porque las siete
listas cuelgan del mismo identificador y se miran juntas; pedirlas por separado
obligaría a la pantalla a encadenar siete peticiones y a manejar siete estados
de carga para un único ámbito.

Existe porque el módulo tenía once operaciones de escritura y tres lecturas: se
daban de alta sedes, áreas, quirófanos, consultorios, servicios, personal,
acreditaciones e inventario, y ninguna operación los volvía a mencionar.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/practices` | `MedicalOrganization` (elige qué organización se administra) |
| `GET` | `/practices/:practiceId/organization` | `MedicalOrganization` |

> `GET /practices` ya lo consumía `AccountingClient` para elegir de qué práctica
> son los libros. Se reusa el mismo endpoint: no se forkea el contrato.

### `DiagnosticsClient` — 6 operaciones

Laboratorios e imagenología (M52).

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/diagnostics/patients/:patientProfileId/orders` | `DiagnosticsBlock` · `Diagnostics` |
| `GET` | `/diagnostics/patients/:patientProfileId/imaging-studies` | `DiagnosticsBlock` · `Diagnostics` |
| `GET` | `/diagnostics/work-orders` | `Diagnostics` |
| `POST` | `/clinical/service-requests/duplicate-check` | `DiagnosticsBlock` (antiduplicación de estudios · T-26, subtarea 3.2) |
| `POST` | `/clinical/service-requests` | `Diagnostics` (pedir un estudio) |
| `GET` | `/diagnostic-results/me/orders` | `DiagnosticOrders` y 4 pantallas más | No |

> **Declaradas acá al resolver el conflicto del carril 15, no por sus autores.**
> Los carriles 3 y 4 entraron a `dev` sin pasar por esta página, y eso dejó el
> job `verificar` en rojo para todo el mundo: `check-api-contract-drift` no
> distingue «lo agregó otro» de «lo agregué yo». Si algún consumidor de arriba
> quedó mal atribuido, corregilo — se dedujo de quién importa cada cliente.

### `FilesClient` — 6 operaciones

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/common/files/upload` | `IdentityVerification` (V27-14…17) · `AttachmentUploader` |
| `GET` | `/common/files/links` | `AttachmentsBlock` (adjuntos de la ficha) |
| `POST` | `/common/files/:fileId/links` | `AttachmentUploader` |
| `POST` | `/common/files/:fileId/download-url` | `AttachmentsBlock` |
| `DELETE` | `/common/files/:fileId` | — (borrado lógico, sin pantalla todavía) |
| `GET` | `/common/files/:fileId/content` | `AttachmentUploader` y 10 pantallas más | No |

#### Adjuntar son dos operaciones, no una

`upload` deja el archivo en el sistema; `:fileId/links` lo cuelga de un recurso.
Están separadas en el backend porque **el mismo archivo puede adjuntarse en más
de un lado**, y acá se respetan como dos llamadas.

Importa para el mensaje de error: si la segunda falla, el archivo **ya existe**.
Decir «no se pudo subir» llevaría a reintentar y dejar dos copias.

#### Los adjuntos cuelgan del paciente, no del encuentro

`file_links.owner_type` admite `USER`, `PATIENT` y `TENANT` — **no hay
`ENCOUNTER`**. Es una restricción del modelo: quien quiera adjuntos por episodio
tiene que promoverlo al `.puml` primero.

#### La URL de descarga se pide al hacer clic

Es firmada y vence. Emitir una por adjunto al pintar la lista dejaría veinte
enlaces vivos a datos clínicos de los que diecinueve nadie abrió.

### `PublicDirectoryClient` — 13 operaciones

El directorio público del buscador V65 (carril P4). Es **otra superficie**, no
otras rutas de `CommunityClient`: aquélla habla con la red social **con
sesión** y sus respuestas traen `tenantId`, ids de concepto y de archivo; ésta
es anónima, y el servidor arma cada respuesta con una lista blanca de campos.

Una petición de este cliente **no lleva `Authorization`**. No es una omisión
sino el contrato: el resultado no depende de quién mira, y mandar un token
ataría una respuesta cacheada `public, max-age=60` a una sesión.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/public/search` | `BuscarBuscadorListado` (`/buscar`) |
| `GET` | `/public/search/practitioners` | `BuscarProfesionalesListado` |
| `GET` | `/public/search/medications` | — (devuelve vacío por construcción, ver abajo) |
| `GET` | `/public/search/organizations` | `BuscarHospitalesListado` |
| `GET` | `/public/search/diagnostic-units` | `BuscarLaboratoriosListado` |
| `GET` | `/public/search/insurers` | `BuscarAseguradorasListado` |
| `GET` | `/public/search/pharmacies` | — (sin pantalla propia todavía) |
| `GET` | `/public/nearby` | `BuscarCercaniaDetalle` (`/buscar/mapa`) |
| `GET` | `/public/profiles/:prefijo/:slug` | `perfilPublicoResolver` (`/p/:slug`…) |
| `GET` | `/public/comments/:commentId/replies` | `BuscarAseguradorasListado` y 12 pantallas más | Sí |
| `GET` | `/public/posts` | `BuscarAseguradorasListado` y 12 pantallas más | Sí |
| `GET` | `/public/posts/:postId/comments` | `BuscarAseguradorasListado` y 12 pantallas más | Sí |
| `GET` | `/public/posts/:postId/reactions` | `BuscarAseguradorasListado` y 12 pantallas más | Sí |

**La ficha se pide por `/public/profiles/…` y no por `/p/:slug`**, aunque la
API sirva las dos. `/p/:slug` es también **la URL de la pantalla**, y las dos
no pueden convivir del lado del navegador: el proxy enruta comparando el
comienzo de la ruta, así que mandar `/p` a la API se come la ruta del router, y
no mandarla deja la llamada pidiéndole `/p/:slug` al servidor de Angular, que
responde el `index.html` con **200** — el cliente recibe HTML donde espera
JSON. Las cinco rutas cortas siguen siendo el contrato público para quien las
llame directo.

**Los filtros que existen son `q`, `cursor`, `limit` y `verified`.** El
contrato de la API declara además `city`, `specialty`, `form`, `inStock`,
`kind`, `study`, `planKind` y `open`, y el controlador **no los lee**: están
marcados como *previstos* en `openapi/CONTRATO-PUBLICO.md` §2. Por eso las
pantallas no dibujan esos filtros — uno que no filtra le dice a quien lo usó,
sin decírselo, que todos los resultados cumplen su criterio.

#### `/public/search/medications` devuelve vacío, y va a seguir devolviéndolo

Su índice es `community.public_profiles`, y **un medicamento no es un perfil**:
el catálogo vive en el esquema `pharmacy`. El filtro `kind: 'MEDICATION'` no
encuentra nunca nada ahí, así que la ruta responde una página vacía en vez de
un error. No es un defecto pendiente de arreglo: llenar ese índice con cajas de
remedios sería duplicar el catálogo entero dentro de un buscador de personas.

Lo que sirve esa pantalla es `PublicMarketplaceClient`, abajo.

### `PublicMarketplaceClient` — 2 lecturas anónimas

La **vitrina pública de medicamentos** (`/buscar/medicamentos`). Misma familia
que `PublicDirectoryClient` —anónima, sin `Authorization`, cacheable— pero
contra otro módulo de la API: el catálogo de farmacia, no el índice de
perfiles.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/public/medications` | `BuscarMedicamentosListado` |
| `GET` | `/public/medications/:conceptId/availability` | `BuscarMedicamentosListado` |

**Es una vitrina de exhibición y consulta, no una tienda.** Ninguna de las dos
respuestas trae un identificador de producto, de sede ni de lista de precios:
no hay con qué armar un pedido, una reserva ni un pago. Es deliberado —
AloVida no vende medicamentos ni cobra comisión sobre estos precios— y la
pantalla lo dice en el banner, no en letra chica.

**Los importes viajan como texto.** El backend los declara `numeric`; pasarlos
por `number` perdería el centavo que la farmacia publicó. La pantalla los
reformatea (`46.00` → `Bs 46,00`) sin convertirlos.

**El origen es opcional y viaja entero o no viaja.** Sin `lat`/`lng` la vitrina
funciona igual y las distancias vuelven en `null`; con origen, `radiusKm` acota
y el orden pasa a ser por cercanía. Media coordenada la API la descarta en vez
de fallar. La ubicación **se pide, no se toma**: la pantalla no toca la API de
geolocalización hasta que alguien aprieta el botón, y ofrece medir desde una
ciudad como alternativa que no entrega nada.

**Las distancias son en línea recta** (Haversine sobre la dirección publicada),
y cada número lo dice: la ruta real depende de un servicio de mapas que este
sistema no tiene.

### `CommunityClient` — 49 operaciones

La red social médica (M19). Las 16 lecturas entraron primero, antes que
cualquier pantalla — ver la nota de abajo. Las 4 escrituras que siguen
entraron recién con «Mi perfil», «Vitrina pública» y «Mis artículos médicos»,
que son sus primeros consumidores.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/community/profiles/:profileId` | — (ficha pública, V65-07…11) |
| `GET` | `/community/profiles/:profileId/posts` | `MedicalArticles` |
| `GET` | `/community/profiles/:profileId/reviews` | — (V65-14) |
| `GET` | `/community/posts/:postId` | `MedicalArticles` |
| `GET` | `/community/posts/:postId/comments` | `MedicalArticles` |
| `GET` | `/community/posts/:postId/reactions` | — |
| `GET` | `/community/feed` | — (V19-13 muro) |
| `GET` | `/community/notifications` | — |
| `GET` | `/community/follows` | — (V65-13) |
| `GET` | `/community/bookmarks` | — |
| `GET` | `/community/blocks` | — |
| `GET` | `/community/groups` | — (V19-07) |
| `GET` | `/community/groups/:groupId/members` | — (V19-08) |
| `GET` | `/community/conversations` | — (V19-01) |
| `GET` | `/community/conversations/:conversationId/messages` | — (V19-02) |
| `GET` | `/community/polls/:pollId` | — |
| `GET` | `/community/profiles/me` | `PublicProfilePreview` · `MedicalArticles` |
| `PUT` | `/community/profiles/me` | `PublicProfilePreview` |
| `POST` | `/community/profiles/:profileId/posts` | `MedicalArticles` |
| `POST` | `/community/comments` | `MedicalArticles` |
| `PUT` | `/community/reactions` | `PostCard` (muro) |
| `DELETE` | `/community/blocks` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/blocks` | `ChatStore` y 12 pantallas más | No |
| `DELETE` | `/community/bookmarks` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/bookmarks` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/comments/media/:fileId/content` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/conversations` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/conversations/:conversationId/messages` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/conversations/:conversationId/read` | `ChatStore` y 12 pantallas más | No |
| `DELETE` | `/community/follows` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/follows` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/groups` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/groups/:groupId` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/groups/:groupId/members` | `ChatStore` y 12 pantallas más | No |
| `PATCH` | `/community/groups/:groupId/members/:memberId` | `ChatStore` y 12 pantallas más | No |
| `DELETE` | `/community/groups/:groupId/members/:memberProfileId` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/groups/:groupId/posts` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/groups/:groupId/posts` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/moderation/appeals` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/moderation/appeals/:appealId/resolve` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/moderation/decisions` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/moderation/decisions/:decisionId/appeal` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/moderation/queue` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/moderation/queue/:queueId/decision` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/profiles/:profileId/reviews` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/profiles/:profileId/reviews/:reviewId/responses` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/profiles/by-slug/:slug` | `ChatStore` y 12 pantallas más | No |
| `POST` | `/community/reports` | `ChatStore` y 12 pantallas más | No |
| `GET` | `/community/topics` | `ChatStore` y 12 pantallas más | No |

#### Reaccionar es `PUT` y es *upsert*

Reaccionar de nuevo con otro tipo **cambia** la reacción, no agrega una segunda.
Por eso el contrato exige `actorProfileId` en el cuerpo: es la mitad de la clave
`(actor, objeto)`, no un dato que el servidor deduzca de la sesión.

Y ahí hay una asimetría real del backend que conviene no confundir: **se escribe
con la palabra** (`LIKE`, `INSIGHTFUL`…) y **se lee con el uuid**
(`reactionTypeConceptId`). Los tipos de reacción son un enum cerrado del
contrato, no conceptos de terminología.

**La vitrina propia es un `PUT` idempotente**, igual razón que
`upsertOwnProfile` del resto del repo: crea si no existía, actualiza si sí, y
la pantalla que la edita no necesita saber cuál de las dos está haciendo.

**Publicar siempre pasa por `CommunityClient.publishPost`**, que agrega el
hashtag `articulo-medico` cuando `esArticulo` es verdadero — el backend no
distingue un artículo de cualquier otra publicación, sólo la etiqueta.

#### Por qué el cliente existe antes que las pantallas

Las 16 lecturas ya están en el backend. Lo que falta para que la red social se
vea son dos cosas distintas: que sus endpoints sean **públicos** (`@Public()` +
límite por IP) y que haya **pantallas**. Ninguna de las dos cambia la forma de
la llamada — el decorador cambia el guard del servidor, no la URL ni el cuerpo.

Así que este cliente se escribe y se prueba hoy, y el día que la superficie
pública entre no hay que tocarlo. Es la misma razón por la que el contrato va
primero al repartir trabajo entre personas: para que nadie espere a nadie.

#### `actorProfileId` es opcional, y ahí está la superficie pública

Seis lecturas aceptan «quién mira». Con actor, la respuesta agrega lo que sólo
tiene sentido para esa persona —con qué reaccionaste, qué votaste—; sin actor,
la misma lectura devuelve la vista anónima, que es exactamente la que necesita
un visitante sin sesión.

**El cliente no manda el id de sesión por defecto.** Quien llama decide si la
lectura es personal o pública: hacerlo automático convertiría toda pantalla
pública en una consulta identificada sin que nadie lo pidiera.

#### Dos cosas que el contrato declara y conviene no confundir

- **`GET /community/notifications` trae `unreadCount`**, que **no** es el total
  de la página: es cuántas sin leer tiene la persona en total. Es lo que va en
  la campana.
- **`GET /community/conversations` no acepta `cursor`**, sólo `limit`. Devuelve
  `nextCursor` igual, pero hoy no hay forma de pedir la página siguiente. Está
  anotado, no inventado.

**Cinco operaciones sin pantalla que las llame** — las dos altas restantes de
`ProfilesClient`, la reserva puntual de `SchedulingClient`, las bases legítimas
de `AuthzClient` y el `$expand` de terminología. Eran más: V05-01 y V05-03
encendieron las altas de perfil, y las vistas de verificación de identidad
(V27-01 y V27-14…17) encendieron las cuatro de `IdentityClient` y esta subida.
No es código muerto: todas tienen prueba y son la mitad de un flujo cuya
interfaz todavía no se escribió.
Ver [el mapa de integraciones §3](../architecture/integration-map.md#3--operaciones-sin-consumidor).

### `DiagnosticsClient` — lecturas del paciente · carril 11

Lo que el paciente ve de sus propios estudios: el resultado, su descarga y con
quién lo compartió. No es la cola clínica, que sigue en `/diagnostics`.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/diagnostic-results/me` | `DiagnosticResults` |
| `GET` | `/diagnostic-results/me/:reportId` | `DiagnosticResults` |
| `GET` | `/diagnostic-results/me/:reportId/shares` | `DiagnosticResults` |
| `POST` | `/diagnostic-results/me/:reportId/shares` | `DiagnosticResults` |
| `POST` | `/diagnostic-results/me/:reportId/shares/:shareId/revoke` | `DiagnosticResults` |
| `GET` | `/diagnostic-units/search` | `LaboratoryDirectory` |

### `InsuranceClient` — 14 operaciones

La superficie de lectura de aseguradoras y corredores (M26). Solo la relación
comercial: ni el corredor ni la aseguradora ven historial médico.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/insurance-carriers` | `InsuranceCatalog` |
| `GET` | `/insurance-carriers/:id` | `InsuranceCatalog` |
| `GET` | `/insurance-brokers` | `BrokerDirectory` |
| `GET` | `/insurance-brokers/:id` | `BrokerDetail` |
| `GET` | `/insurance-brokers/:id/clients` | `BrokerDetail` |
| `GET` | `/insurance-carrier-catalog` | `BrokerDetail` y 5 pantallas más | No |
| `GET` | `/insurance-claims` | `BrokerDetail` y 5 pantallas más | No |
| `POST` | `/insurance-claims/:claimId/disputes` | `BrokerDetail` y 5 pantallas más | No |
| `GET` | `/insurance-claims/:id` | `BrokerDetail` y 5 pantallas más | No |
| `POST` | `/insurance-products/:productId/plans` | `InsuranceCatalog` |
| `POST` | `/insurance-plans/:planId/benefits` | `InsuranceCatalog` |
| `PUT` | `/insurance-plans/:planId/benefits/:benefitId` | `InsuranceCatalog` |
| `PUT` | `/insurance-plans/:planId/benefits/:benefitId/rules` | `InsuranceCatalog` |
| `PUT` | `/insurance-plans/:planId/premium` | `InsuranceCatalog` |

> **`GET /insurance-claims/:id` gana `lines[].duplicateStudy` (subtarea 3.2, v4.2.17).**
> Cuando el ítem factura una orden de laboratorio/imagenología con un informe
> previo del mismo estudio dentro de la ventana de antiduplicación, la línea
> trae `duplicateStudy: { previousDiagnosticReportId, studyName, performedAt,
> daysAgo, providerName, justification, reused } | null` — sin el informe en
> sí (FT-32-R02); lo consume `InsuranceClaimDetail` (badge «Posible
> duplicado» · `BILLING_OPERATOR`/`SECURITY_ADMIN`).

> **`GET /insurance-claims/:id` gana `settlement` y `eob` (Tarea 3 · H8, CA-3.1/CA-3.3).**
> `settlement: { availability, totalBilledAmount, totalApprovedAmount,
> totalPatientAmount, totalDeniedAmount, reconciled, exclusions }` —
> `totalBilledAmount = totalApprovedAmount + totalPatientAmount +
> totalDeniedAmount`; `reconciled` es `true` sólo cuando esa ecuación cuadra
> al centavo. `eob: { id, publishedAt } | null`. Una exclusión sin
> `policyClauseReference`, una línea sin adjudicar o un descuadre degradan
> `availability` a `UNDER_REVIEW` en vez de publicarse como liquidación
> firme; sin dictamen o sin EOB publicada es `PENDING_PUBLICATION`. Lo
> consume la nueva sección «Liquidación» de `InsuranceClaimDetail` y, del
> lado del paciente, `PatientInsuranceSettlement` (misma semántica, otro
> endpoint).

### `InsuranceAnalyticsClient` — 1 operación · subtarea 3.1, v4.2.14

El tablero de siniestralidad, gasto per cápita y morbilidad de la
aseguradora del tenant activo (M26). Todo agregado; ningún identificador de
paciente cruza esta ruta.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/insurance/analytics/loss-ratio` | `InsuranceAnalytics` |

### `InsurancePortabilityClient` — 4 operaciones · subtarea 3.3, v4.2.19

Portabilidad de póliza e historial de siniestralidad a 1 clic: el titular
exporta su propio historial (pólizas, **atenciones**, siniestros,
adjudicaciones, diagnósticos — `schemaVersion: 'alovida.insurance-portability/2'`),
sellado en SHA-256 sobre módulo 52 (`health_export_jobs` +
`health_export_manifests`), y cualquiera puede verificar el certificado por su
hash sin sesión, en mayúsculas o minúsculas. Confirmar en el diálogo sin
tocar el desplegable descarga PDF y JSON (`BUNDLE` es el formato por
defecto).

| Método | Ruta | Consumidor |
|---|---|---|
| `POST` | `/insurance/portability/export` | `PortabilityExportDialog` |
| `GET` | `/insurance/portability/certificates/:certificateId/pdf` | `PortabilityExportDialog` |
| `GET` | `/insurance/portability/certificates/:certificateId/json` | `PortabilityExportDialog` |
| `GET` | `/public/portability/verify/:manifestHash` | `PortabilityVerify` |

**La última es pública** (sin sesión, `Cache-Control: no-store`): a ella apunta
el QR impreso en el certificado PDF, y la atiende
`/verify/portability/:manifestHash` en el front — ver
[su ficha](../routes/verify-portability.md). Las otras tres autorizan por
titularidad del perfil de paciente (`ProfileOwnershipService`); un
`patientProfileId` ajeno responde `403` y queda auditado.

### `PharmaLabClient` — 21 operaciones · carril 17

Laboratorio farmacéutico, visitadores médicos y visitas (M62 `pharma_lab`).

**No hay ninguna ruta clínica en esta tabla y no puede haberla**: la
especificación le prohíbe al visitador el acceso a pacientes, recetas y
diagnósticos (5316-5318), y que su cliente no las nombre es la mitad de esa
garantía — la otra la pone la API, que revalida cada petición.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/pharma-labs` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/staff` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/medical-visitors` | `PharmaLabHome` |
| `POST` | `/pharma-labs/:pharmaLabId/medical-visitors/:medicalVisitorId/unlink` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/products` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/materials` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/pharmacovigilance/reports` | `PharmaLabHome` |
| `GET` | `/pharma-labs/:pharmaLabId/regulatory-documents` | `PharmaLabHome` |
| `GET` | `/visit-agenda/me` | `DoctorVisits` |
| `PUT` | `/visit-agenda/me` | `DoctorVisits` |
| `GET` | `/visit-agenda/doctors/:doctorUserId` | `VisitorVisits` |
| `POST` | `/visit-requests` | `VisitorVisits` |
| `GET` | `/visit-requests/mine` | `VisitorVisits` |
| `GET` | `/visit-requests/inbox` | `DoctorVisits` |
| `POST` | `/visit-requests/:visitRequestId/accept` | `DoctorVisits` |
| `POST` | `/visit-requests/:visitRequestId/reject` | `DoctorVisits` |
| `POST` | `/visit-requests/:visitRequestId/cancel` | `VisitorVisits` · `DoctorVisits` |
| `GET` | `/visit-records/inbox` | `DoctorVisits` |
| `GET` | `/visit-records/labs/:pharmaLabId` | `PharmaLabHome` |
| `GET` | `/visit-records/labs/:pharmaLabId/rating-summary` | `PharmaLabHome` |

### `PharmaLabConcepts` — 1 operación · carril 17

El diccionario que traduce cada `*_concept_id` del carril a su rótulo. Existe
porque recalcular en el navegador el UUID determinista del backend obligaría a
duplicar su función de derivación —dos implementaciones de la misma regla, que
se separan en cuanto una cambia— y pintar el identificador crudo no le dice nada
a nadie. Se pide una vez por sesión y se comparte.

| Método | Ruta | Consumidor |
|---|---|---|
| `GET` | `/pharma-labs/reference/concepts` | `PharmaLabHome` · `VisitorVisits` · `DoctorVisits` |

### Operaciones que suman otros carriles

Entradas sueltas que amplían clientes ya documentados más arriba.

| Método | Ruta | Cliente | Consumidor |
|---|---|---|---|
| `GET` | `/procedure-cases/:caseId/team-members` | `ProceduresClient` | `Interventions` (carril 12) |
| `POST` | `/procedure-cases/:caseId/team-members/:memberId/accept` | `ProceduresClient` | `Interventions` |
| `POST` | `/procedure-cases/:caseId/team-members/:memberId/respond` | `ProceduresClient` | `Interventions` |
| `POST` | `/charts/templates/:templateId/assignments` | `ChartTemplatesClient` | `ClinicalForms` (R2-5) |

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

### `AddressesClient` — 1 operacion

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/common/addresses` | — | No |

### `AssetsLiabilitiesClient` — 8 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/accounting/practitioner/assets` | `AssetsLiabilities` | No |
| `POST` | `/accounting/practitioner/assets` | `AssetsLiabilities` | No |
| `PATCH` | `/accounting/practitioner/assets/:assetId/automation` | `AssetsLiabilities` | No |
| `POST` | `/accounting/practitioner/assets/:assetId/progress` | `AssetsLiabilities` | No |
| `GET` | `/accounting/practitioner/liabilities` | `AssetsLiabilities` | No |
| `POST` | `/accounting/practitioner/liabilities` | `AssetsLiabilities` | No |
| `PATCH` | `/accounting/practitioner/liabilities/:liabilityId/automation` | `AssetsLiabilities` | No |
| `POST` | `/accounting/practitioner/liabilities/:liabilityId/progress` | `AssetsLiabilities` | No |

### `ChartNotesClient` — 2 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/charts/notes` | `FreeNoteBlock` | No |
| `PUT` | `/charts/notes/:noteId/versions` | `FreeNoteBlock` | No |

### `ContentPacksClient` — 2 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/admin/content-packs` | `ContentPacks` | No |
| `POST` | `/admin/content-packs/:code/apply` | `ContentPacks` | No |

### `NotificationsClient` — 5 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/notifications/in-app/:id/read` | `AvisoDeHuecoLibre` y 3 pantallas más | No |
| `POST` | `/notifications/in-app/read-all` | `AvisoDeHuecoLibre` y 3 pantallas más | No |
| `GET` | `/notifications/me` | `AvisoDeHuecoLibre` y 3 pantallas más | No |
| `GET` | `/notifications/preferences/me` | `AvisoDeHuecoLibre` y 3 pantallas más | No |
| `PUT` | `/notifications/preferences/me` | `AvisoDeHuecoLibre` y 3 pantallas más | No |

### `PharmacyClient` — 3 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/pharmacy-inventory/availability` | `InboxOrder` y 2 pantallas más | No |
| `GET` | `/pharmacy/pharmacies` | `InboxOrder` y 2 pantallas más | No |
| `GET` | `/pharmacy/products` | `InboxOrder` y 2 pantallas más | No |

### `PharmacyOrdersClient` — 4 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/pharmacy/orders` | `InboxOrder` y 6 pantallas más | No |
| `GET` | `/pharmacy/orders` | `InboxOrder` y 6 pantallas más | No |
| `POST` | `/pharmacy/orders` | `InboxOrder` y 6 pantallas más | No |
| `GET` | `/pharmacy/orders/me` | `InboxOrder` y 6 pantallas más | No |

### `PracticeSitesClient` — 4 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/practices/:practiceId/role-assignments/self-request` | `MyOrganizations` y 2 pantallas más | No |
| `GET` | `/practitioners/me/role-assignments` | `MyOrganizations` y 2 pantallas más | No |
| `POST` | `/practitioners/me/sites` | `MyOrganizations` y 2 pantallas más | No |
| `DELETE` | `/practitioners/me/sites/:siteId` | `MyOrganizations` y 2 pantallas más | No |

### `PrescriptionFavoritesClient` — 3 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/prescription-favorites` | `MedicationBlock` | No |
| `POST` | `/prescription-favorites` | `MedicationBlock` | No |
| `DELETE` | `/prescription-favorites/:id` | `MedicationBlock` | No |

### `QuotationsClient` — 4 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `GET` | `/quotations` | `QuotationForm` + `QuotationList` | No |
| `POST` | `/quotations` | `QuotationForm` + `QuotationList` | No |
| `GET` | `/quotations/:id` | `QuotationForm` + `QuotationList` | No |
| `POST` | `/quotations/simulate` | `QuotationForm` + `QuotationList` | No |

### `SurveysClient` — 17 operaciones

| Método | Ruta | Consumidor | Pública |
|---|---|---|---|
| `POST` | `/surveys/assignments` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/invitations` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `GET` | `/surveys/me/invitations` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `GET` | `/surveys/me/invitations/:invitationId` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/me/invitations/:invitationId/responses` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `GET` | `/surveys/templates` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/templates` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `GET` | `/surveys/templates/:surveyId` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `PATCH` | `/surveys/templates/:surveyId` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/templates/:surveyId/deactivate` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/templates/:surveyId/questions` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `DELETE` | `/surveys/templates/:surveyId/questions/:questionId` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `PATCH` | `/surveys/templates/:surveyId/questions/:questionId` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `PUT` | `/surveys/templates/:surveyId/questions/order` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `GET` | `/surveys/templates/:surveyId/responses` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/templates/:surveyId/versions` | `QuestionnaireAnswer` y 3 pantallas más | No |
| `POST` | `/surveys/templates/:surveyId/versions/:versionNumber/publish` | `QuestionnaireAnswer` y 3 pantallas más | No |
