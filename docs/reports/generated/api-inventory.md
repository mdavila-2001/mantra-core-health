<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de operaciones HTTP

20 operaciones declaradas en `src/app/core/data-access/**/*.client.ts`.
Ningún componente arma URLs por su cuenta: si esta lista está completa, la
superficie de red de la aplicación está completa.

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

## `IdentityClient`

Archivo: `src/app/core/data-access/identity/identity.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `GET` | `/identity/me/verification-cases/:caseId` |

## `ProfilesClient`

Archivo: `src/app/core/data-access/profiles/profiles.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/profiles/patients` |
| `POST` | `/profiles/persons/:personId/account-links` |
| `POST` | `/profiles/practitioners` |

## `PublicClient`

Archivo: `src/app/core/data-access/public/public.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/public/directory` |

## `TerminologyClient`

Archivo: `src/app/core/data-access/terminology/terminology.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/terminology/value-sets/:valueSetId/$expand` |
