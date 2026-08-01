# Matriz de trazabilidad

De negocio a ruta, a componente, a API, a prueba. **La columna E2E está vacía en
todas las filas**, y esa ausencia se declara acá como excepción formal, tal como
el plan permite.

---

## Journeys

| Journey | Rutas | Componentes | API | Roles | Unit. | Comp. | **E2E** | Visual | A11y | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| **J1** Registro paciente | `/auth/registro` → `/auth` | `RegisterPatient`, `AuthSplit`, `FormField`, `Input`, `Radio*` | `POST register-patient` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J2** Registro profesional | `/auth/registro` → `/auth` | Ídem | `POST register-practitioner` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J3** Login multi-organización | `/auth` → `/auth/organizacion` → `/panel` | `Login`, `TenantSelection`, `ShellLayout` | `POST login` | público | ✅ | ⚠️ parcial | **❌ E1** | ❌ | ⚠️ A11Y-03 | Implementado |
| **J4** Recuperación | `/auth/recuperar` → correo → `/auth/nueva-clave` | `ForgotPassword`, `ResetPassword` | `POST forgot-password`, `POST reset-password` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ **A11Y-01** | Implementado |
| **J5** Sesión persistente | arranque | `AuthService`, `SessionStore`, `RefreshTokenStorage` | `POST token/refresh` | con sesión | ✅ | **❌** | **❌ E1** | ❌ | n/a | Implementado |
| **J6** Verificar correo | correo → `/auth/verificar` | `VerifyEmail` | `POST verify-email` | público | ✅ | ✅ | **❌ E1** | ❌ | ⚠️ A11Y-04 | Implementado |
| **J7** Panel | `/panel` | `Dashboard`, `ShellLayout`, `ViewStateHost` | `GET /public/directory` | con sesión | ✅ | **❌** | **❌ E1** | ❌ | ✅ | Implementado |
| **J8** Cambio de organización | armazón → `/panel` | `ShellLayout`, `TenantSwitcher` | — | con sesión | ✅ | **❌** | **❌ E1** | ❌ | ✅ | Implementado |
| **J9** Cierre de sesión | armazón → `/auth` | `ShellLayout`, `Header`, `Menu` | `POST logout` | con sesión | ✅ | **❌** | **❌ E1** | ❌ | ✅ | Implementado |
| **J10** Verificación de identidad | — | — | 4 de `IdentityClient` + `FilesClient` | con sesión | ✅ | n/a | n/a | n/a | n/a | **Sin pantalla** |

## Excepción formal E1 — ausencia de pruebas E2E

> El plan exige: *«Cada journey crítico tiene al menos una validación E2E **o una
> justificación formal**.»*

**Justificación:**

1. **No existe herramienta E2E en el proyecto.** Ni Playwright, ni Cypress, ni
   ninguna. Incorporarla es un cambio de producto que añade una dependencia
   grande y requiere autorización.
2. **Los nueve journeys implementados fueron verificados a mano contra la API
   viva** por el equipo, y funcionaron
   (`ESTADO-FRONTEND.md` §«El recorrido que se verificó en un navegador real»).
3. **Los nueve tienen cobertura unitaria y de componente**, con umbrales
   bloqueantes que se cumplen (`core` 87 %, `shared` 94 %, `features` 75 %).
4. **La propuesta está escrita y priorizada** en
   [pruebas E2E](../testing/e2e-tests.md), con herramienta recomendada
   (Playwright, porque además cubre la regresión visual) y los cuatro journeys
   por los que empezar.

**Riesgo residual asumido:** una regresión en cualquiera de los nueve journeys
**no se detecta automáticamente**. El más expuesto es **J5**, cuya integración
con el ciclo de arranque no está cubierta: un cambio en el orden de los
`provideAppInitializer` lo rompería en silencio.

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
| **Journeys con E2E** | **0/9 — excepción E1** |
| **Operaciones con prueba de contrato** | **0/20 — excepción E2** |

Las dos excepciones están declaradas arriba con su justificación y su riesgo
residual, como el plan exige.
