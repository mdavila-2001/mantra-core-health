# Matriz de trazabilidad

De negocio a ruta, a componente, a API, a prueba. **Seis de los diez journeys
tienen E2E**; los cuatro que no, mantienen la excepción formal declarada más
abajo, con el motivo de cada uno.

---

## Journeys

| Journey | Rutas | Componentes | API | Roles | Unit. | Comp. | **E2E** | Visual | A11y | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| **J1** Registro paciente | `/auth/registro` → `/auth` | `RegisterPatient`, `AuthSplit`, `FormField`, `Input`, `Radio*` | `POST register-patient` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J2** Registro profesional | `/auth/registro` → `/auth` | Ídem | `POST register-practitioner` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J3** Login multi-organización | `/auth` → `/auth/organizacion` → `/panel` | `Login`, `TenantSelection`, `ShellLayout` | `POST login` | público | ✅ | ⚠️ parcial | **✅** | ❌ | ⚠️ A11Y-03 | Implementado |
| **J4** Recuperación | `/auth/recuperar` → correo → `/auth/nueva-clave` | `ForgotPassword`, `ResetPassword` | `POST forgot-password`, `POST reset-password` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ **A11Y-01** | Implementado |
| **J5** Sesión persistente | arranque | `AuthService`, `SessionStore`, `RefreshTokenStorage` | `POST token/refresh` | con sesión | ✅ | **❌** | **✅✅** | ❌ | n/a | Implementado |
| **J6** Verificar correo | correo → `/auth/verificar` | `VerifyEmail` | `POST verify-email` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J7** Panel | `/panel` | `Dashboard`, `ShellLayout`, `ViewStateHost` | `GET /public/directory` | con sesión | ✅ | ✅ | **✅** | ❌ | ✅ | Implementado |
| **J8** Cambio de organización | armazón → `/panel` | `ShellLayout`, `TenantSwitcher` | — | con sesión | ✅ | ✅ | **❌ E1** | ❌ | ✅ | Implementado |
| **J9** Cierre de sesión | armazón → `/auth` | `ShellLayout`, `Header`, `Menu` | `POST logout` | con sesión | ✅ | ✅ | **✅✅** | ❌ | ✅ | Implementado |
| **J10** Verificación de identidad | `/identidad/verificar` | `IdentityVerification` | 4 de `IdentityClient` + `FilesClient` | con sesión | ✅ | ✅ | **❌ E1** | ❌ | ✅ | Implementado |

## Los journeys con E2E

`e2e/sesion.spec.ts` corre **contra el artefacto de producción construido**, con
la red simulada. Siete pruebas cubren J3, J5, J7 y J9, más dos caminos de fallo
que ninguna fila de arriba representa: el guard sin sesión, y el refresh token
muerto.

Los marcados **✅✅** son los dos que encontraron un defecto real:

| Journey | Qué encontró |
|---|---|
| **J5** Sesión persistente | Que `security.allowedHosts` hacía que el servidor devolviera **400 en cualquier dominio real** |
| **J9** Cierre de sesión | Que el refresh token **sobrevivía al cierre de sesión** y la siguiente recarga restauraba la sesión |

J5 era el journey señalado como «el más expuesto» en la revisión anterior. Lo era.

## Excepción formal E1 — los cuatro journeys que siguen sin E2E

> El plan exige: *«Cada journey crítico tiene al menos una validación E2E **o una
> justificación formal**.»*

| Journey | Por qué no tiene E2E |
|---|---|
| **J1** Registro paciente | El alta cruza a la pantalla de login sin sesión; el valor añadido sobre la prueba de componente es bajo |
| **J2** Registro profesional | Ídem |
| **J4** Recuperación | **Cruza el correo.** Sin buzón no hay forma de seguir el enlace |
| **J6** Verificar correo | Ídem |
| **J8** Cambio de organización | Necesita un token con varias organizaciones **y** datos distintos por organización, que hoy no hay |
| **J10** Verificación de identidad | Necesita subir un archivo real y un caso de verificación del lado de la API |

**Justificación común:** los seis tienen cobertura unitaria y de componente con
umbrales bloqueantes (`core` 87 %, `shared` 94 %, `features` 75 %), y los cuatro
primeros dependen de infraestructura que este repositorio no puede simular sin
volver la prueba menos fiable que lo que verifica.

**Riesgo residual asumido:** una regresión en J1, J2, J4, J6, J8 o J10 no se
detecta automáticamente de punta a punta. J4 y J6 son los más expuestos, y su
punto frágil está **fuera del frontend**: que el dominio de los enlaces del
correo coincida con el del frontend (ver H-11).

## Componentes críticos

| Componente | Importadores | Rutas que lo usan | Prueba | Visual |
|---|---:|---|---|---|
| `AppButton` | 25 | Todas | ✅ | ❌ |
| `FORM_CONTROL_CONTEXT` | 19 | Las 6 con formulario | ✅ | n/a |
| `ViewState` (tipos) | 14 | Todas | ✅ | n/a |
| `Input` | 11 | Las 6 con formulario | ✅ | ❌ |
| `FormField` | 11 | Ídem | ✅ | ❌ |
| `SessionStore` | 8 | Toda superficie autenticada | ✅ | n/a |
| `ViewStateHost` | — | `/panel` | ✅ | ❌ |
| `Shell` | — | `/panel` | ✅ | ❌ |
| **`ShellLayout`** | — | `/panel` | **❌** | ❌ |
| **`Dashboard`** | — | `/panel` | **❌** | ❌ |

## Operaciones de API

| Operación | Cliente | Pantalla | Prueba de cliente | **Contrato** |
|---|---|---|---|---|
| `POST /iam/auth/login` | `IamClient` | Login | ✅ | **❌ E2** |
| `POST /iam/auth/token/refresh` | `IamClient` | arranque + interceptor | ✅ | **❌ E2** |
| `POST /iam/auth/register-patient` | `IamClient` | Registro | ✅ | **❌ E2** |
| `POST /iam/auth/register-practitioner` | `IamClient` | Registro | ✅ | **❌ E2** |
| `POST /iam/auth/verify-email` | `IamClient` | Verificar | ✅ | **❌ E2** |
| `POST /iam/auth/forgot-password` | `IamClient` | Recuperar | ✅ | **❌ E2** |
| `POST /iam/auth/reset-password` | `IamClient` | Nueva contraseña | ✅ | **❌ E2** |
| `POST /iam/auth/logout` | `IamClient` | Armazón | ✅ | **❌ E2** |
| `GET /public/directory` | `PublicClient` | Panel | ⚠️ sin spec propio | **❌ E2** |
| Las 11 restantes | varios | **ninguna** | ✅ | **❌ E2** |

## Excepción formal E2 — ausencia de pruebas de contrato

**Justificación:** el OpenAPI del backend **no es alcanzable desde este
repositorio**. Los tipos se escribieron a mano contra el contrato, con la
referencia anotada en comentarios («copiados de
`src/common/errors/error-codes.ts` del backend», «verificadas una por una contra
`iam-auth.controller.ts`»). Es **trazabilidad, no verificación**.

**Lo que sí se verifica:** `check-api-contract-drift.mjs` compara los endpoints
que el código llama con los documentados, y falla si divergen.

**Riesgo residual:** un cambio del backend —campo renombrado, código de error
nuevo, ruta movida— **no se detecta hasta producción**. El caso más silencioso es
un `code` nuevo, que se degrada a S9 genérico sin romper nada.

**Parte de la solución no está en manos de este repositorio.** Ver
[pruebas de contrato](../testing/contract-tests.md).

## Requisitos no funcionales

| Requisito | Fuente | Verificación | Estado |
|---|---|---|---|
| 9 estados de interfaz | M34 | `M34_CODE_BY_STATUS` + prueba | ✅ |
| S1 ≠ S2 | M34 | `authGuard` en el padre; `ViewStateHost` | ✅ |
| S5 ≠ S6 | M34 | Dos códigos para el mismo 403 | ✅ |
| S7 expone antigüedad | M34 | `asOf` obligatorio en el tipo | ✅ |
| WCAG 2.2 AA | Contractual | **Solo revisión de código** | ⚠️ **no verificado** |
| Identidad REDSAT | `identidad-visual.md` | Pruebas de tokens | ⚠️ nombres sí, contrastes no |
| Presupuesto de bundle | `angular.json` | `check-bundle-budget.mjs` | ⚠️ **18,95 kB sobre el aviso** |
| Cero regresiones | Plan | [Validación](../reports/regression-validation.md) | ✅ |

## Cobertura de la matriz

| Dimensión | Cobertura |
|---|---|
| Journeys implementados documentados | **9/9 (100 %)** |
| Rutas documentadas | **11/11 (100 %)** |
| Operaciones de API trazadas | **20/20 (100 %)** |
| Componentes críticos identificados | **10/10** |
| Journeys con prueba automatizada | 9/9 (unitaria/componente) |
| **Journeys con E2E** | **4/10** · 6 con excepción E1 |
| **Operaciones con prueba de contrato** | **0/20 — excepción E2** |

Las dos excepciones están declaradas arriba con su justificación y su riesgo
residual, como el plan exige.
