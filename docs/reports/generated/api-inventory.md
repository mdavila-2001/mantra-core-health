<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de operaciones HTTP

59 operaciones declaradas en `src/app/core/data-access/**/*.client.ts`.
Ningún componente arma URLs por su cuenta: si esta lista está completa, la
superficie de red de la aplicación está completa.

## `DelegatedAccessClient`

Archivo: `src/app/core/data-access/delegated-access/delegated-access.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/access-requests/:requestId/decision` |
| `POST` | `/authz/effective-actor/evaluate` |
| `POST` | `/delegated-access/expiry-sweep` |
| `POST` | `/delegated-permission-sets` |
| `POST` | `/delegated-permission-sets/:setId/versions` |
| `POST` | `/org/:tenantMembershipId/user-assignments` |
| `PATCH` | `/org/user-assignments/:assignmentId` |
| `POST` | `/practitioner-delegates` |
| `POST` | `/practitioner-delegates/:delegationId/access-requests` |
| `POST` | `/practitioner-delegates/:delegationId/grants` |
| `POST` | `/practitioner-delegates/:delegationId/revoke` |

## `AuthProvidersClient`

Archivo: `src/app/core/data-access/auth-providers/auth-providers.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/auth-providers/account-link-requests` |
| `POST` | `/auth-providers/account-link-requests/complete` |
| `POST` | `/auth-providers/federated-identities/:identityId/unlink` |
| `POST` | `/auth-providers/identity-providers` |
| `PUT` | `/auth-providers/identity-providers/:providerId/attribute-mappings` |
| `POST` | `/auth-providers/identity-providers/:providerId/protocol-configs` |
| `POST` | `/auth-providers/identity-providers/:providerId/provisioning-rules` |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys` |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys/rotate` |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/authorize` |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/callback` |
| `POST` | `/auth-providers/tenant-bindings` |

## `AuthzClient`

Archivo: `src/app/core/data-access/authz/authz.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/authz/care-relationships` |
| `GET` | `/authz/legal-representations` |

## `ClinicalClient`

Archivo: `src/app/core/data-access/clinical/clinical.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/charts/patients/:patientProfileId/chart` |
| `GET` | `/clinical/patients/:patientProfileId/summary` |

## `FilesClient`

Archivo: `src/app/core/data-access/files/files.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/common/files/upload` |

## `IamClient`

Archivo: `src/app/core/data-access/iam/iam.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/iam/auth/activate` |
| `POST` | `/iam/auth/forgot-password` |
| `POST` | `/iam/auth/login` |
| `POST` | `/iam/auth/logout` |
| `POST` | `/iam/auth/register-patient` |
| `POST` | `/iam/auth/register-practitioner` |
| `POST` | `/iam/auth/reset-password` |
| `POST` | `/iam/auth/token/refresh` |
| `POST` | `/iam/auth/verify-email` |
| `POST` | `/iam/users` |
| `POST` | `/iam/users/assisted-registration` |

## `IdentityClient`

Archivo: `src/app/core/data-access/identity/identity.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `POST` | `/identity/me/tenants/:tenantId/verification` |
| `GET` | `/identity/me/verification-cases` |
| `GET` | `/identity/me/verification-cases/:caseId` |

## `ProfilesClient`

Archivo: `src/app/core/data-access/profiles/profiles.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/profiles/patients` |
| `POST` | `/profiles/patients` |
| `GET` | `/profiles/patients/:profileId` |
| `GET` | `/profiles/patients/me/summary` |
| `POST` | `/profiles/persons/:personId/account-links` |
| `POST` | `/profiles/practitioners` |

## `PublicClient`

Archivo: `src/app/core/data-access/public/public.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/public/directory` |

## `SchedulingClient`

Archivo: `src/app/core/data-access/scheduling/scheduling.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/scheduling/bookings` |
| `GET` | `/scheduling/bookings/:bookingId` |
| `GET` | `/scheduling/resources` |
| `GET` | `/scheduling/slots` |

## `TerminologyClient`

Archivo: `src/app/core/data-access/terminology/terminology.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/terminology/concepts` |
| `GET` | `/terminology/concepts` |
| `GET` | `/terminology/value-sets/:valueSetId/$expand` |
