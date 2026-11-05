# 01 — Entrada del Portal Admin, bug de selección de organización y redefinición del portal

> Frente 1 del plan `2026-10-31-portal-observabilidad-gobierno` (ver `CONTEXTO-COMUN.md`). Dueño único de este archivo.
> Peldaño de evidencia de este documento: **`DISCOVERED`** (todo lo afirmado abajo se leyó en el código el 31/10/2026, con ruta:línea; nada se ejecutó contra la API real ni contra Postgres). Lo que no se leyó se marca «no verificado».
> Ramas: `claude/busy-dijkstra-5apd55` en `mantra-core-health` (front) y `mantra-core-health-api` (API). `F:` = front, `A:` = API.

## 0. Resumen en diez líneas

1. **Causa raíz del bug.** `F:src/app/core/auth/session.store.ts:227-229` define `needsTenantSelection = tenants().length > 1 && selectedTenantId() === null` sin mirar roles; `F:src/app/features/auth/login/login.ts:219-222` y `F:src/app/core/auth/auth.guard.ts:36-38` mandan a `/auth/organization` apenas eso es `true`. Un `SUPERADMIN`/`PLATFORM_ADMIN` con membresía activa en dos o más organizaciones cae en el selector **antes** de cualquier otra regla (el `returnUrl` y el destino por portal se evalúan después, `login.ts:230-236`).
2. **Segunda pata del bug, en la API.** La API sólo trata como «alcance plataforma» a `SUPERADMIN` y `SYSTEM` (`A:src/common/tenant/tenant-resolution.ts:12`). Un `PLATFORM_ADMIN` con 2+ membresías que llama **sin** `X-Tenant-Id` recibe `403 TENANT_AMBIGUOUS` (`tenant-resolution.ts:62-80`), y el interceptor del front lo convierte en una navegación a `/auth/organization` (`F:src/app/core/http/auth.interceptor.ts:136-142`). Por eso **arreglar sólo el front produce un bucle**: hay que arreglar los dos lados.
3. **«Está bugueado todo».** El portal `/reports` es una maqueta que habla con dos rutas que **la API no tiene** (`F:src/app/core/data-access/reporting/reporting.client.ts:16-20, 28, 33`; el módulo `A:src/modules/reporting/controllers/reporting.controller.ts:48-294` sólo expone `POST` de definiciones/ejecuciones) y que **el proxy de desarrollo no reenvía** (`F:proxy.conf.json` no lista `/reporting`): contra la API real el catálogo y todas las pestañas terminan en el estado de error. Lista completa en §1.4.
4. **Decisión recomendada sobre la maqueta comercial:** retirarla de la entrada y de la navegación **ya** (bandera apagada por defecto, `/reports` redirige al panel) y **borrarla** en la franja siguiente, cuando el panel de observabilidad esté `VERIFIED` contra la API real y se hayan rescatado a `shared/` las piezas reutilizables. Costo real de cada opción en §3.2.
5. **Entrada definitiva:** sin selector de portales. Quien tiene alcance de plataforma entra a `/dashboard`, que ya pinta el «Centro de la plataforma» (`F:src/app/features/dashboard/dashboard.html:6-15`), y desde ahí al panel de observabilidad y gobierno bajo `/superadmin/*` (ya existe como dominio «Superadministración»). El conmutador de organización que ya tiene el armazón (`F:src/app/features/shell-layout/shell-layout.html:364-392`) pasa a ofrecer «Toda la plataforma» como opción por defecto para esos roles.
6. **Kill-test binario (§5):** entrar como `admin@alovidasalud.com` contra la API real con la cuenta miembro de dos organizaciones y aterrizar en el Centro de la plataforma sin pasar por `/auth/organization`, con `GET /admin/ops/traffic` respondiendo 200 sin `X-Tenant-Id`.

---

## 1. Diagnóstico (DISCOVERED)

### 1.1 La cadena exacta en el front

| Paso | Dónde | Qué hace |
|---|---|---|
| 1 | `F:src/app/core/auth/access-token.ts:29-31, 208-211` | El token se lee tal cual: `roles[]`, `tenants[]` (membresías activas), `scopedRoles` opcional. No hay claim de «alcance de plataforma». |
| 2 | `F:src/app/core/auth/session.store.ts:98` | `tenants = claims.tenants ?? []`. |
| 3 | `F:src/app/core/auth/session.store.ts:163-170` | `activeTenantId`: con una sola membresía se resuelve sola; con varias y ninguna elegida es `null` (deliberado: «no se adivina»). |
| 4 | `F:src/app/core/auth/session.store.ts:227-229` | **`needsTenantSelection = tenants().length > 1 && selectedTenantId() === null`.** No consulta `roles()`. |
| 5 | `F:src/app/core/auth/auth.service.ts:293-314` | Al abrir sesión aplica la organización recordada en `localStorage` (`refresh-token.storage.ts:33, 123, 140`), si la hay. Un dispositivo nuevo no tiene ninguna. |
| 6 | `F:src/app/features/auth/login/login.ts:219-222` | `destinoNormal()`: **primero** `needsTenantSelection()` → `TENANT_SELECTION_ROUTE` (`/auth/organization`, `core/auth/tenant-selection-route.ts:9`). Recién después mira `tenants().length === 0`, el `returnUrl` y `entryDestination(roles)` (`login.ts:223-236`). El propio comentario de `login.ts:258-259` fija que el `returnUrl` «se ignora cuando hay que elegir organización». |
| 7 | `F:src/app/core/auth/auth.guard.ts:28-41` | `authGuard` repite la regla: con sesión y `needsTenantSelection()` → `/auth/organization`. Cubre `/dashboard`, `/superadmin/*`, `/reports`, `/insights`, `/portal-selector` (`app.routes.ts:1819-1842, 1859-1864`). |
| 8 | `F:src/app/features/auth/tenant-selection/tenant-selection.ts:79-83` | Al elegir, `selectTenant` y `entryDestination(roles)`. No hay opción «toda la plataforma». |
| 9 | `F:src/app/features/reporting/reporting-access.ts:119-128` | `entryDestination`: con 2+ accesos → `/portal-selector`; `PLATFORM_ADMIN` está en `ROLES_REPORTERIA` (`:20-27`), `ROLES_ADMINISTRACION` (`:45-56`) y `ROLES_INSIGHTS` (`:63-68`), así que siempre tiene 3 accesos y siempre pasa por el selector de portales. |
| 10 | `F:src/app/features/portal-selector/portal-selector.ts:55-87` | Tres tarjetas; sólo redirige solo con un acceso. |
| 11 | `F:src/app/core/http/auth.interceptor.ts:196-210` | `X-Tenant-Id` viaja **sólo** si `activeTenantId()` no es `null`. Con alcance plataforma y sin elección, no viaja. Correcto, pero ver 1.2. |
| 12 | `F:src/app/core/http/auth.interceptor.ts:136-142, 248-255` | Si la API responde **403/422** con `reason ∈ {TENANT_REQUIRED, TENANT_AMBIGUOUS}` y `tenants().length > 1` → navega a `/auth/organization` sin `returnUrl`. Un **412** (ver 1.2) **no** se reconoce. |

Consumidores adicionales de la ruta de selección: `F:src/app/app.routes.ts:2382-2387` (ruta), `F:src/app/app.routes.server.ts:86` (SSR), `F:src/app/features/geo/geofence-form/geofence-form.ts:226` (S5 con «Elegir organización»), `F:src/app/core/navigation/navigation.types.ts:300-312` (`requiresTenant`).

### 1.2 Lo que hace la API cuando un rol de plataforma llama sin tenant activo

Orden de guards: `JwtAuthGuard → TenantScopeGuard → RolesGuard → VerifiedIdentityGuard` (`A:src/common/auth/README.md`, sección «Orden de los guards globales»).

| Hecho | Dónde |
|---|---|
| Sólo `SUPERADMIN` y `SYSTEM` son «alcance plataforma» (`PRIVILEGED_TENANT_ROLES`). Y sólo si el código **no** viene en `scopedRoles`. | `A:src/common/tenant/tenant-resolution.ts:12, 23-31` |
| Actor **no** privilegiado, sin `X-Tenant-Id`: 1 membresía → se resuelve; 0 → `403 TENANT_REQUIRED`; 2+ → **`403 TENANT_AMBIGUOUS`** («indique cuál en X-Tenant-Id»). `details.reason` repetido para el cliente. | `tenant-resolution.ts:44-81` |
| Actor privilegiado sin tenant declarado → `undefined` = barrido de sistema (`runSystemSweep`). | `tenant-resolution.ts:91-110`; `A:src/common/tenant/tenant-context.interceptor.ts:127-134, 191-203` |
| `TenantScopeGuard` deja pasar sin resolver si la ruta es `@Public`, `@TenantAgnostic` o `@PlatformTenantOptional(...roles)` y el actor tiene uno de esos roles **como global**. | `A:src/common/auth/tenant-scope.guard.ts:36-63`; `A:src/common/tenant/platform-tenant-optional.decorator.ts:9-26` |
| `RolesGuard`: `SUPERADMIN` global es comodín; el resto autoriza sólo si el rol es global o está concedido en el tenant resuelto. | `A:src/common/auth/roles.guard.ts:27-43, 86-99` |
| **`/admin/ops/*` (`ops_console`) exige `@Roles(...OPS_READ_ROLES)` y NO declara `@TenantAgnostic` ni `@PlatformTenantOptional`** → un `PLATFORM_ADMIN` con 2+ membresías sin cabecera recibe `403 TENANT_AMBIGUOUS` aunque el servicio no use el tenant (ningún `requireTenantId` en `A:src/modules/ops_console/application/*.ts`). | `A:src/modules/ops_console/presentation/controllers/ops-console.controller.ts:14-20, 25-33` |
| **`/admin/analytics/*` (`telemetry`) está acotado a tenant por diseño**: «no hay barrido global, ni siquiera para `SUPERADMIN`»; usa `requireTenantId()`, que lanza **`412 PreconditionFailed` con `reason: TENANT_REQUIRED`**. El front no reconoce 412 (1.1 paso 12) y lo pinta como error genérico. | `A:src/modules/telemetry/presentation/controllers/telemetry-analytics.controller.ts:29-35, 108-118`; `A:src/common/tenant/tenant-context.ts:60-68` |
| `/admin/portal/*` y `/admin/catalog/*` (`data_catalog`) son `@TenantAgnostic` a nivel de clase: funcionan sin tenant. Su archivo de roles documenta la condición: el rol de plataforma debe asignarse **sin `tenantId`**; con tenant entra a `scopedRoles` y en rutas `@TenantAgnostic` da 403. | `A:src/modules/data_catalog/presentation/controllers/admin-portal.controller.ts:56-58`; `admin-catalog.controller.ts:77-78`; `A:src/modules/data_catalog/data_catalog.roles.ts:6-14` |
| Precedentes de `@PlatformTenantOptional` a nivel de clase: auditoría y administración de authz. | `A:src/modules/audit/controllers/audit-query.controller.ts:36`; `A:src/modules/authz/controllers/authz-admin.controller.ts:47` |
| Cómo se arma el token: `roles` = globales de `iam.user_global_roles` (sólo `USER, SECURITY_ADMIN, SUPERADMIN, PATIENT, PRACTITIONER, CLINICIAN`, `A:src/modules/iam/domain/role-mapping.ts:12-18`) ∪ asignaciones de `authz`; `scopedRoles` sólo con las asignaciones que declaran `tenantId`; `tenants` = `tenantClaims.listActiveTenantIds` (membresías activas). | `A:src/modules/iam/application/services/iam-auth.service.ts:168-228, 403-422` |
| `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`, `SRE`, `RELEASE_MANAGER`, `QA_ADMIN`… son roles `authz` de alcance `GLOBAL`; `REPORTING_ADMIN`/`REPORT_AUTHOR`/`REPORT_VIEWER` son `TENANT`. | `A:src/modules/authz/authz.platform-roles.seed.ts:93-101`; `A:src/modules/data_catalog/data_catalog.roles.ts:20-56` |
| `PlatformAdminScopeGuard`: **no existe** en la API (`grep -rn PlatformAdminScopeGuard src` vacío). El `CONTEXTO-COMUN.md` lo nombra; hay que corregir esa referencia o crearlo (ver §2.3). | — |

**Consecuencia combinada.** Hoy, el flujo «elegir organización → entrar» *funciona* para cualquier admin porque, una vez elegida, `X-Tenant-Id` viaja en todas las peticiones y la API resuelve. Si el front deja de pedir organización a los roles de plataforma **sin tocar la API**, un `PLATFORM_ADMIN` (no `SUPERADMIN`) con 2+ membresías llegará al Centro de la plataforma, éste pedirá `/admin/ops/traffic`, `/admin/ops/readiness`, etc. (`F:src/app/features/dashboard/platform-home/platform-home.ts:153-178`), la API responderá `403 TENANT_AMBIGUOUS` y el interceptor lo devolverá a `/auth/organization`: **bucle**. Un `SUPERADMIN` sí entraría (es privilegiado en la API), pero `/admin/analytics/*` le dará 412 en todas las pestañas de analítica.

### 1.3 Cuentas que reproducen el bug

| Cuenta | Roles | Membresías | Reproduce | Dónde |
|---|---|---|---|---|
| `superadmin@alovida.mock` (simulador) | `SUPERADMIN, SECURITY_ADMIN, PLATFORM_ADMIN, REPORTING_ADMIN` | 3 (`TENANT_PLATAFORMA, TENANT_CLINICA, TENANT_HOSPITAL`) | **Sí**: cae en `/auth/organization` y luego en `/portal-selector` (3 accesos). | `F:src/app/core/mock/mock-session.ts:249-253` |
| `admin@alovida.mock` (simulador) | `PLATFORM_ADMIN`, `BUSINESS_ADMIN`, `REPORTING_ADMIN` + 13 admin de negocio | 1 (`TENANT_CLINICA`) | Selección de organización **no**; selector de portales **sí**. | `mock-session.ts:217-243` |
| `medica@alovida.mock` (simulador) | `PRACTITIONER` (+`SCHEDULING_ADMIN` con ámbito) | 3 | Selección **sí, y es correcto**: no es rol de plataforma. Es el caso que la regla nueva **no debe romper**. | `mock-session.ts:186-194` |
| `admin@alovidasalud.com` / `12345678` (API real, local/dev) | `SUPERADMIN` global (`iam.user_global_roles`) | 1 sembrada (`SEED.tenantId`, membresía `STAFF`) | Reproduce **sólo si** la cuenta pasó a tener 2+ membresías activas (al aprovisionar organizaciones desde la UI, al aceptar invitaciones, o por seeds de demostración). **No verificado**: no se leyó qué seeds o flujos agregan membresías a esta cuenta; el usuario reporta que en su entorno le pide organización, lo que implica `tenants.length > 1`. | `A:src/common/seed/bootstrap-admin-seed.service.ts:207-260`; `F:src/app/features/auth/login/local-login-hint.ts:44` |
| Cuentas con `PLATFORM_ADMIN` en la API real | — | — | **No hay seed que asigne `PLATFORM_ADMIN` a ninguna cuenta** (`grep "'PLATFORM_ADMIN'"` en `src/common/seed/` y `src/modules/**/seed*` sólo encuentra listas `@Roles` y el catálogo de roles). Se asigna a mano por `POST /authz/users/:userId/role-assignments`. | `A:src/modules/authz/authz.platform-roles.seed.ts:101` |

### 1.4 Por qué «está bugueado todo»: defectos de la maqueta `features/reporting/`

| ID | Defecto | Dónde | Efecto contra la API real |
|---|---|---|---|
| D-01 | El cliente pide `GET /reporting/catalog` y `POST /reporting/commercial/:pestana`, que **la API no implementa** (el módulo `reporting` real sólo tiene `POST` de definiciones, versiones, ejecuciones, schedules, dashboards). | `F:src/app/core/data-access/reporting/reporting.client.ts:16-36`; `A:src/modules/reporting/controllers/reporting.controller.ts:48-294` | Con `API_BASE_URL` absoluto → 404 → `reportErrorState` → S9 (error con `requestId`) en el grid y en cada pestaña. |
| D-02 | `proxy.conf.json` no lista `/reporting` entre los `context`. | `F:proxy.conf.json` (bloque `context`) | Con `ng serve` y rutas relativas, el dev-server devuelve `index.html` con 200 → `HttpClient` falla al parsear JSON → error. Nadie ve un 404 limpio. |
| D-03 | Todo el dato es de EJEMPLO generado en el navegador (`CONSTRUCTORES`, 50+ archivos en `core/mock/handlers/reporting/`), con «reloj del servidor simulado». La tarjeta del selector lo declara («Datos de ejemplo»). | `F:src/app/core/mock/handlers/reporting.handlers.ts:40-110`; `F:src/app/features/portal-selector/portal-selector.html:61, 81` | Es lo que el usuario rechazó: una maqueta sin fuente. |
| D-04 | Estados forzados por `localStorage['mock:reporting:estado'] ∈ {error, vacio, sin-permiso, atrasado}`. Si una sesión de capturas lo dejó escrito, **todo el portal queda en error/sin permiso** hasta borrarlo a mano. | `reporting.handlers.ts:54-66` | Explica «todo da error» en una máquina donde corrió `reporteria-capturas.spec.ts`. |
| D-05 | El alcance por defecto es `plataforma` (`ReportContextStore.alcance = 'plataforma'`); el armazón lo corrige a `organizacion` para quien no es de plataforma. El mock **no filtra por alcance ni por tenant**: la misma cifra para «Plataforma» y «Mi organización». | `F:src/app/features/reporting/state/report-context.store.ts:43`; `F:src/app/features/reporting/shell/reporting-shell.ts:141-145` | No es dato: es decorado. |
| D-06 | El selector de portales obliga a elegir entre tres puertas a quien tiene `PLATFORM_ADMIN` (3 accesos), aunque dos de ellas sean maquetas. | `reporting-access.ts:119-128`; `portal-selector.ts:69-75` | Fricción en cada inicio de sesión sin organización recordada. |
| D-07 | El cierre de sesión importa cuatro piezas de `features/reporting` (`ReportAssistantData`, historiales, `ReportContextStore`, `ReportPrefsStore`): acoplamiento de `core` con la maqueta. | `F:src/app/session-cleanup.lazy.ts:5-8, 26-31` | Borrar la maqueta toca el logout. |
| D-08 | El 412 `TENANT_REQUIRED` de `/admin/analytics/*` no se reconoce (sólo 403/422). | `auth.interceptor.ts:250` | La analítica web muestra «error inesperado» en vez de pedir organización. |
| D-09 | `app.routes.ts` está en **2 564 líneas con techo 2 273** (`scripts/baselines/max-lines.json:7`) y `check-max-lines` **falla hoy** en 126 archivos de la rama (corrida local del 31/10). Las rutas `portal-selector` + `reports` suman ~22 líneas (`app.routes.ts:1819-1841`). | `node scripts/check-max-lines.mjs` | El gate no distingue lo nuestro del arrastre; hay que medir «neto ≤ 0» a mano. |
| D-10 | La suite Playwright **acepta y oculta** el síntoma: `entrar()` espera `/(dashboard|auth\/organization|portal-selector)/` y hace clic en la primera organización y en «Portal de administración». Lo mismo en `login-cuenta-local.mjs:75`, `portal-admin-visual.mjs:78-85`, `auditoria-qa-mockup.spec.ts:16-21`. | `F:playwright/support/sesion.ts:102-118` | Ninguna prueba falla por el bug; la matriz de roles (`fable-matriz-roles.spec.ts`) tampoco lo ve porque mide después de entrar. |
| D-11 | `fable-matriz-roles.spec.ts` toma sus cuentas de `mock-session.ts` (`:22, 37-63`); la última evidencia es del **08/09/2026** (`docs/frontend/evidence/roles/matriz-roles.json`: 2 220 filas; OK 1 661 · GUARDIA-OK 492 · **REDIRIGE-INESPERADO 24** · **ENTRA-SIN-PERMISO 42** · DESBORDE 1). No cubre `superadmin/*`, `/reports`, `/insights`, `/portal-selector` ni la API real. | `F:playwright/fable-matriz-roles.spec.ts`; `F:docs/frontend/evidence/roles/matriz-roles.json` | Hay 66 veredictos rojos sin triage desde septiembre. |
| D-12 | `CONTEXTO-COMUN.md` cita un `PlatformAdminScopeGuard` que no existe en la API. | `A:src/common/auth/` (listado) | Riesgo de que otro frente lo use como si existiera. |

Plantillas rotas (regla 3 de `CLAUDE.md`): **no verificado** —no se ejecutó `ng build` ni se abrió `/reports` en navegador en esta sesión. Los specs `reporting.routes.spec.ts`, `reporting-shell.spec.ts`, `report-grid.spec.ts` y `commercial-dashboard.spec.ts` existen (247 `it()` en `features/reporting/`), lo que baja la probabilidad de un 404 por plantilla, sin eliminarla.

---

## 2. Propuesta de arreglo (front + API)

### 2.1 Regla de «alcance de plataforma»

**Definición (una sola, compartida por los dos repos):** una sesión tiene alcance de plataforma cuando alguno de sus roles **globales** (en `roles` y **ausente** de `scopedRoles`, misma regla que `roleAuthorizesInTenant(user, role, undefined)` y que `effectiveRoles` del front) pertenece a `PLATFORM_SCOPE_ROLES = ['SUPERADMIN', 'PLATFORM_ADMIN', 'DATA_PLATFORM_ADMIN', 'GOVERNANCE_ADMIN']`.

- **No** entra `SECURITY_ADMIN`: es rol global de `iam` pero lo usan administradores de **una** organización (`hospital.piloto@alovida.mock` lo lleva con un solo tenant, `mock-session.ts:378-384`); quien lo tenga con dos organizaciones debe seguir eligiendo. **No** entran `BUSINESS_ADMIN` (negocio, por tenant) ni `REPORTING_ADMIN` (`TENANT` en `authz.platform-roles.seed.ts:93`). `SRE`, `RELEASE_MANAGER`, `DPO`, `QA_ADMIN` quedan **fuera por ahora** (ambigüedad A-2).
- Efecto: la sesión **no elige organización al entrar**; `activeTenantId` queda `null` → **no viaja `X-Tenant-Id`** → la API trata la petición como de plataforma en las rutas que lo admiten (§2.3). La persona puede fijar una organización en cualquier momento desde el conmutador del armazón («Toda la plataforma» ↔ cada organización); al fijarla, todo vuelve a comportarse como hoy.
- **No es seguridad**: la autoridad sigue siendo la API. Lo que cambia en el front es qué puerta se ofrece primero.

### 2.2 Cambios en el front

| Archivo | Cambio | Pruebas |
|---|---|---|
| `F:src/app/core/auth/platform-scope.ts` (**nuevo**, ≤ 60 líneas) | `PLATFORM_SCOPE_ROLES` y `hasPlatformScope(claims): boolean` con la regla de 2.1 (usa `effectiveRoles(claims, null)` de `session.store.ts:281-298`: con `activeTenantId = null` sólo quedan los globales, que es exactamente lo que se quiere). Vive en `core/auth` y no en `features/reporting` para que `core` no importe de `features`. | `platform-scope.spec.ts`: global → `true`; mismo código en `scopedRoles` → `false`; `SECURITY_ADMIN` solo → `false`; sin claims → `false`. |
| `F:src/app/core/auth/session.store.ts:227-229` | `needsTenantSelection = tenants().length > 1 && selectedTenantId() === null && !this.hasPlatformScope()`; nueva `readonly hasPlatformScope = computed(...)`; nueva `readonly platformWide = computed(() => hasPlatformScope() && selectedTenantId() === null)` (para rotular «Toda la plataforma»). `activeTenantId` **no cambia** (sigue `null` sin elección: no se adivina). | `session.store.spec.ts` (+6 `it()`; las 4 existentes de `:93-116` se conservan tal cual, con cuentas sin rol de plataforma). |
| `F:src/app/core/auth/auth.guard.ts:36-38` | Sin cambio de código: hereda la regla. Añadir prueba: sesión de plataforma con 3 tenants → `true`. | `auth.guard.spec.ts` (+2). |
| `F:src/app/features/auth/login/login.ts:219-237` | `destinoNormal()`: la rama `needsTenantSelection()` ya no dispara para plataforma; **nuevo orden**: `returnUrl` válido → ese; alcance plataforma → `'/'` (dashboard = Centro de la plataforma); si no, `entryDestination(roles)` hasta que §3.1 lo reemplace. | `login.spec.ts` (+3; las de `:185, 248` se conservan con `medica`). |
| `F:src/app/features/auth/tenant-selection/tenant-selection.ts:79-83` + `.html` | (a) Acepta `?returnUrl=` validado con la misma regla de `login.ts:261-268` (extraer a `core/auth/return-url.ts`, ≤ 30 líneas, para no duplicar). (b) Si `hasPlatformScope()`, muestra una opción extra «Toda la plataforma (sin fijar organización)» con `data-testid="tenant-plataforma"` que **no** llama `selectTenant` y navega al destino. | `tenant-selection.spec.ts` (+3). |
| `F:src/app/features/shell-layout/shell-layout.ts:731-734, 790-793` + `.html:364-392` | El conmutador ya existe. (a) `organizacionActiva()` devuelve «Toda la plataforma» cuando `platformWide()`; (b) el menú agrega la opción «Toda la plataforma» (`data-testid="header-organization-plataforma"`) que llama a un nuevo `AuthService.clearSelectedTenant()` (borra la señal y el `localStorage`, `refresh-token.storage.ts:140`); (c) `@if (tenants().length > 1)` pasa a `tenants().length > 1 || hasPlatformScope()` para que una cuenta de plataforma con **una** sola membresía también pueda alternar. **Ojo**: `shell-layout.ts` (828/645) y `.html` (792/686) ya exceden su techo; el delta debe ser ≤ +12 líneas o extraer el bloque a `shell-layout/tenant-menu/` (preferido). | `shell-layout.spec.ts` (+3). |
| `F:src/app/core/auth/auth.service.ts:211-220` | `clearSelectedTenant()` simétrico a `selectTenant`. `session.store.ts` gana `clearTenant()`. | `auth.service.spec.ts` (+2). |
| `F:src/app/core/http/auth.interceptor.ts:136-142, 248-255` | (a) `isTenantRequired` reconoce también **412** con `reason: TENANT_REQUIRED` (D-08). (b) Si `session.hasPlatformScope()`, **no navega**: deja subir el error para que `errorToViewState` lo pinte como S5 con `nextAction = { label: 'Elegir organización', route: '/auth/organization?returnUrl=<ruta actual>' }` (precedente `geofence-form.ts:226`). Si no, mantiene la navegación actual **agregando `returnUrl`**. | `auth.interceptor.spec.ts` (+4). |
| `F:src/app/core/http/error-to-view-state.ts` | Mapea `TENANT_REQUIRED`/`TENANT_AMBIGUOUS` (403/412/422) a `forbidden` con esa `nextAction` cuando la sesión es de plataforma. **No verificado**: no se leyó el archivo; comprobar que no exista ya un mapeo de `reason`. | `error-to-view-state.access.spec.ts` (+2). |
| `F:src/app/core/mock/mock-session.ts:249-253` | Sin cambio: `superadmin@alovida.mock` (3 tenants) es la cuenta de regresión de este bug en modo simulador. Añadir `plataforma@alovida.mock` con **sólo** `PLATFORM_ADMIN` y 2 tenants (para probar el caso no-`SUPERADMIN`). El archivo ya está sobre techo (663/600): la cuenta nueva reemplaza a una redundante o va en `mock-session.accounts.ts`. | `mock-backend.spec.ts`. |

### 2.3 Lo que debe garantizar la API

| Cambio | Dónde | Por qué así y no de otro modo |
|---|---|---|
| **A1.** `A:src/common/tenant/platform-scope.ts` (**nuevo**): `PLATFORM_SCOPE_ROLES` (los cuatro de 2.1) y `hasPlatformScope(user)` reutilizando `roleAuthorizesInTenant(user, role, undefined)`. **No** se amplía `PRIVILEGED_TENANT_ROLES` (`tenant-resolution.ts:12`): eso permitiría a `PLATFORM_ADMIN` declarar `X-Tenant-Id` de un tenant **del que no es miembro** (`resolvePrivilegedTenantId` no exige membresía, `:91-110`) → escalada. | `src/common/tenant/` | Separar «puede operar sin tenant» (plataforma) de «puede elegir cualquier tenant» (`SUPERADMIN`/`SYSTEM`). |
| **A2.** `@PlatformTenantOptional(...PLATFORM_SCOPE_ROLES, ...OPS_READ_ROLES)` a nivel de clase en `OpsConsoleController` (precedente `audit-query.controller.ts:36`). Sin tenant → barrido de sistema (ya lo hace el interceptor, `tenant-context.interceptor.ts:124-125`). Con `X-Tenant-Id` → sigue la resolución ordinaria (debe ser membresía) y el servicio filtra si el dato lo admite. | `A:src/modules/ops_console/presentation/controllers/ops-console.controller.ts:25` | El servicio ya es agregado global; el 403 era un efecto colateral del guard. |
| **A3.** `TelemetryAnalyticsController`: decisión de contrato (A-3). Propuesta: `@PlatformTenantOptional(...PLATFORM_SCOPE_ROLES)` + en el servicio `getCurrentTenantId() ?? ALL` con agregación entre tenants **sólo** para alcance plataforma y con `minSample` (sin PHI). Hasta que exista, el 412 se mantiene y el front lo pinta como S5 «Elegir organización» (2.2). | `telemetry-analytics.controller.ts:108-118`; servicio (frente 02/03) | «Null ≠ 0»: mientras no haya agregación, decirlo. |
| **A4.** 403 correctos: `ROLE_INSUFFICIENT` para quien no tiene rol de lectura (ya, `roles.guard.ts:94-98`); `TENANT_AMBIGUOUS`/`TENANT_REQUIRED` **sólo** para actores sin alcance plataforma en rutas acotadas a tenant. Un `PLATFORM_ADMIN` cuyo rol vino **con** `tenantId` (está en `scopedRoles`) **no** es de plataforma: 403 `TENANT_AMBIGUOUS` como hoy (coherente con `data_catalog.roles.ts:10-14`). | guards existentes | No crear `PlatformAdminScopeGuard`: la metadata `@PlatformTenantOptional` + `hasOptionalPlatformTenant` ya lo son. Corregir la referencia del `CONTEXTO-COMUN.md` (D-12). |
| **A5.** Seed opcional detrás de `SEED_DEMO_*` (candado `demo-gate.ts`): `plataforma@alovida.test` con `PLATFORM_ADMIN` **global** y membresía en dos organizaciones del padrón. Es la cuenta del kill-test «no-superadmin». | `A:src/common/seed/` (nuevo `platform-admin-demo-seed.service.ts`) | Hoy no existe ninguna cuenta real con `PLATFORM_ADMIN` (1.3). |
| **A6.** Pruebas: `tenant-scope.guard.spec.ts` (+4: plataforma sin header en ruta `@PlatformTenantOptional` → pasa; con header de tenant ajeno → `TENANT_MEMBERSHIP_REQUIRED`; `PLATFORM_ADMIN` con ámbito → `TENANT_AMBIGUOUS`; `REPORT_VIEWER` → `ROLE_INSUFFICIENT`); e2e de `ops-console.controller` con token real firmado por `TokenService` para los cuatro casos. | `src/common/auth/`, `src/modules/ops_console/` | Matriz negativa exigida por `CONTEXTO-COMUN.md`. |

### 2.4 Pruebas de la matriz de roles

- **Unitarias (front):** las de la tabla 2.2 (~25 `it()` nuevas). Regla `NO_TEST_WEAKENING`: ninguna de las existentes sobre `needsTenantSelection` (`session.store.spec.ts:93-116`), `TENANT_SELECTION_ROUTE` (`auth.guard.spec.ts:53`, `login.spec.ts:185, 248`) se borra ni se relaja; se les fija explícitamente una cuenta **sin** rol de plataforma si hoy usan roles ambiguos (**no verificado** cuáles usan).
- **Playwright, matriz por rol (`F:playwright/fable-matriz-roles.spec.ts`):**
  1. Nueva columna `urlTrasLogin` por cuenta: hoy `entrar()` oculta la ruta de aterrizaje (D-10). Añadir en `support/sesion.ts` un `entrarYObservar()` que devuelva la primera URL tras `login-submit` **sin** hacer clic en nada, y una prueba `matriz-de-entrada` con la tabla esperada: `superadmin@` → `/dashboard`; `plataforma@` → `/dashboard`; `admin@` (1 tenant, sin plataforma) → `/dashboard`; `medica@` → `/auth/organization`; `paciente@` → `/dashboard`; `marketing@` → `/insights/home` (hoy, `docs/trabajo/2026-10-30-alovida-insights-portal/PLAN.md:140`) → **decidir** en §3.1.
  2. Agregar al catálogo de rutas de la matriz `superadmin/*`, `/insights`, `/reports` (mientras exista) y `/portal-selector` (mientras exista), con sus roles de `navigation.platform.ts:91-220`.
  3. Dos modos: contra el simulador (cuentas de `mock-session.ts`) **y** contra la API real (`admin@alovidasalud.com` + `plataforma@alovida.test` del seed A5). El resultado contra la API real es el único que cuenta como `VERIFIED`.
  4. Triage de los 66 veredictos rojos de la evidencia del 08/09 (D-11): se regeneran y se clasifican en el REPORTE de esta franja; **no** se cambian los veredictos para que pasen.
- **Playwright, kill-test (§5)** como spec propio `playwright/entrada-portal-admin.spec.ts`, serie, un solo navegador, con `vigilar()` de `support/salud-de-rutas` para consola y red.

---

## 3. Redefinición: de «portal de reportería» a «panel de observabilidad y gobierno»

### 3.1 El selector de tres portales

**Decisión propuesta: se retira de la entrada.** Fundamento: el único «portal» que un rol de plataforma necesita es el panel; Insights es una sección más del dominio de plataforma (ya tiene menú propio, `navigation.insights.ts`, y puerta en el Centro); la maqueta comercial se retira (3.2).

- `entryDestination(roles)` (`reporting-access.ts:119-128`) pasa a devolver `'/'` siempre que la bandera de la maqueta esté apagada; con la bandera encendida conserva la lógica actual (para no romper las 35 pruebas de `reporteria-capturas.spec.ts` mientras vivan).
- `/portal-selector` queda **como redirección** a `/` (dos líneas en `app.routes.ts`, −9 netas al quitar `loadComponent` y `data`), el componente y sus 15 `it()` se borran en la franja de archivo (H6). `app.routes.server.ts:93` se actualiza igual.
- `MARKETING_MANAGER` puro (`marketing@alovida.mock`): hoy aterriza en `/insights/home`. Supuesto A-4: sigue igual (no es rol de plataforma; `entryDestination` con bandera apagada devuelve `/insights` si `insights && !administracion`).
- La tarjeta «Portal de reportería» del Centro de la plataforma (`platform-home.ts:111-141`) se renombra **«Observabilidad y gobierno»** y enlaza a `/superadmin/observability`; los destinos que lista ya son los correctos (`superadmin/observability|instances|web-analytics|operations|qa-lab|flows`).

### 3.2 La maqueta comercial `features/reporting/`: tres opciones y su costo real

Inventario atado (contado el 31/10 con `grep -c "^\s*it("`): `features/reporting/` **247 `it()`** (incluye `reporting-access.spec.ts` 24), `core/mock/handlers/reporting/` **161 `it()`** (54 archivos de datasets), `core/data-access/reporting/` **9 `it()`**, `features/portal-selector/` **15 `it()`** → **432 `it()`** propios. Playwright: `reporteria-capturas.spec.ts` (6 `test()` que se expanden a **35 casos**, `REPORTE.md` del 30/10). Dependientes fuera de la carpeta: `app.routes.ts:45-48, 1819-1841`, `app.routes.server.ts:90-99`, `login.ts:18-20`, `tenant-selection.ts:13`, `portal-selector.ts:10-17`, `insights-portal.route.ts:7` (importa `ROLES_INSIGHTS`), `insights-shell.ts`, `session-cleanup.lazy.ts:5-8, 26-31`, `mock/handlers/index.ts` (**no verificado**), `playwright/support/sesion.ts:107-118`, 3 `.mjs` y 1 spec que aceptan `/portal-selector`, ADR-0017 (ECharts; **se queda**: `chart-panel` vive en `shared/components/organisms/`). (El «~677» del encargo corresponde a las «pruebas dirigidas en 32 archivos» del `REPORTE.md`, que sumaba también chart-panel, auth y sesión.)

| Opción | Qué implica | Costo (estimado en archivos/pruebas, no en horas) | Riesgo |
|---|---|---|---|
| **A. Archivar = borrar** `features/reporting/`, `portal-selector/`, `mock/handlers/reporting*`, `data-access/reporting/` | Mover `ROLES_*`/`rolesAlcanzan`-based helpers a `core/navigation/portal-access.ts` (lo importan login, insights, tenant-selection); limpiar `session-cleanup.lazy.ts`; quitar rutas; actualizar 4 scripts Playwright; borrar `reporteria-capturas.spec.ts`; docs (`check-doc-coverage` exige cada URL de pantalla en `docs/**`: quitar `/reports*` de los docs). | −432 `it()`, −35 casos PW, −~22 líneas en `app.routes.ts` (ayuda a D-09), −~60 archivos. **Antes** de borrar: rescatar a `shared/` lo reutilizable (`kpi-tile` + `sparkline`, `report-filter-bar`, `tab-view`/`report-table`, `chart-theme.service`), con sus specs. | Perder componentes que el panel necesita si se borra sin rescate; `NO_BIG_BANG_REWRITE` si se hace en la misma PR que el panel. |
| **B. Detrás de bandera, fuera de la navegación** (`environment.reportingMockEnabled`, `false` por defecto) | `accesoAPortales().reporteria = flag && rol`; ruta `/reports` → con bandera apagada `redirectTo: '/superadmin/observability'`; tarjeta del selector y enlaces del Centro desaparecen; `reporteria-capturas.spec.ts` se marca `test.skip` salvo con la bandera (`process.env.PW_REPORTING_MOCK`). | +1 bandera en `environment.types.ts` y generador; ~6 archivos; las 432 `it()` siguen corriendo (~coste de `ng test` sin cambio); código de maqueta sigue en el bundle como **chunk diferido** (no inicial). | Deuda que no se paga sola; dos rutas para el mismo concepto durante una franja. |
| **C. Reconvertir la maqueta en el panel** (reusar shell, filter-bar, tab-view en `/reports`) | Reescribir datasets contra `/admin/ops`, `/admin/analytics`, `/admin/catalog`; mantener la palabra «reportería». | Las 161 `it()` de datasets quedan obsoletas igual (se reescriben); el armazón propio de `/reports` duplica `ShellLayout` (menú, conmutador, tema). | Conserva el nombre y la forma que el usuario rechazó; mezcla el módulo `reporting` real de la API (definiciones/ejecuciones) con observabilidad. |

**Recomendación: B en esta franja (H4), A en la siguiente (H6), nunca C.** Razón: hoy no hay panel real que reemplace la maqueta; retirarla de la vista cuesta poco y es reversible; borrarla con rescate previo de componentes es la forma de no «debilitar pruebas» (se borran con la funcionalidad que prueban, no para que algo pase).

### 3.3 Rutas definitivas

| Alternativa | Veredicto | Por qué |
|---|---|---|
| `/portal/...` (armazón nuevo fuera de `ShellLayout`, como `/reports` y `/insights`) | **No** | Tercer armazón con menú, conmutador y tema propios; más líneas en `app.routes.ts` (ya 291 sobre su techo) y en `app.routes.server.ts`; `check-doc-coverage` exige documentar cada URL nueva; el conmutador de organización ya vive en `ShellLayout`. |
| `/administration/...` | **No** | Es el dominio de administración **de una organización** (pacientes, usuarios, farmacia…, `app.routes.ts:160-440`); las cuatro secciones de plataforma ya se **mudaron** de ahí a `superadmin/*` el 17/10 y las viejas redirigen (`SECCIONES_REDIRIGIDAS`, `app.routes.ts:1372-1384`). Volver sería deshacer esa decisión. |
| `/reports` | **No** | Nombre de la maqueta rechazada; además `/reports/*` es ruta de API en los specs de gobierno (`playwright/gobierno-api-real.spec.ts:1270` usa `/reports/access-matrix/export`), aunque hoy `check-route-prefixes` pasa (232 rutas, 103 prefijos, 31/10). |
| **`/superadmin/...`** (dentro de `ShellLayout`, grupo «Superadministración») | **Sí** | Ya existe con portada en `observability` (`app.routes.ts:1519`, `navigation.platform.ts:85-220`, subgrupo «Plataforma» en `navigation.subgroups.ts:310-326`), SSR configurado, guards por sección (`seccionRolesGuard`), redirecciones heredadas y el conmutador de organización del armazón. |

Mapa propuesto (las pantallas en sí son de otros frentes; aquí sólo la entrada y la estructura):

| Ruta | Contenido (una tarjeta a lo ancho con pestañas, `composition-rules.md` §5) | Estado |
|---|---|---|
| `/dashboard` (`esGestion`) | «Centro de la plataforma»: dos puertas → «Administración» y «Observabilidad y gobierno», más estado global. Existe. | renombrar puerta |
| `/superadmin/observability` | **Sistema**: pestañas `Resumen · Errores · Latencia · Uso por parte de la app · Heatmap`. Hoy existe sólo tráfico/endpoints (`features/admin/observability/`). | ampliar (frentes 02/03) |
| `/superadmin/measurement` | Medición por funcionalidad (existe). Candidato a fusionarse como pestaña «Uso por parte» de la anterior (A-5). | decidir |
| `/superadmin/instances`, `/superadmin/operations` | Existen. | sin cambio |
| `/superadmin/data-catalog`, `/superadmin/portal` | **Catálogo y gobierno de datos** (Atlas): existen; el gobierno (PII, políticas, calidad, linaje oficial) es del frente de gobierno. | ampliar (frente 04) |
| `/superadmin/web-analytics` | Analítica web (existe; necesita A3 para alcance plataforma). | contrato |
| `/insights/*` | Marketing: se queda como está; enlace desde el Centro. | sin cambio |
| `/reports`, `/reports/**` | `redirectTo: '/superadmin/observability'` (bandera apagada). | H4 |
| `/portal-selector` | `redirectTo: '/'`. | H4 |
| `/auth/organization` | Se queda para quien sí debe elegir; gana `returnUrl` y la opción «Toda la plataforma». | H1 |

### 3.4 Roles → qué ve cada quien (presentación; la API autoriza)

Fuente de cada fila: las listas `@Roles` de la API citadas en 1.2 y las secciones de `navigation.platform.ts`.

| Rol | Entra sin elegir organización (2.1) | Centro de la plataforma (`esPerfilDeGestion`, `navigation.management.ts:22-39, 107-117`) | Sistema / Errores / Latencia / Uso (`OPS_READ_ROLES`, `ops-console.controller.ts:14-20`) | Heatmap / Analítica web (`ANALYTICS_READ_ROLES`, `telemetry-analytics.controller.ts:29-35`) | Catálogo e inventario (`navigation.platform.ts:125, 137`; constante `PORTAL_READ_ROLES` del API **no leída**) | Gobierno de datos (frente 04) |
|---|---|---|---|---|---|---|
| `SUPERADMIN` | Sí | Sí | Sí (comodín) | Sí (con A3; hoy 412 sin tenant) | Sí | Sí |
| `PLATFORM_ADMIN` | Sí | Sí | Sí | Sí | Sí | Sí |
| `DATA_PLATFORM_ADMIN` | Sí | Sí | **No** (no está en `OPS_READ_ROLES`) → pestaña oculta y 403 si entra a mano | Sí | Sí | Sí |
| `GOVERNANCE_ADMIN` | Sí | Sí | Sí | **No** | Sí | Sí |
| `SECURITY_ADMIN` | **No** (elige organización si tiene 2+) | Sí si no tiene roles de persona | Sí | Sí | Sí | según frente 04 |
| `BUSINESS_ADMIN` | No | No (es administrativo de negocio, `navigation.management.ts:48-63`) | No | No | No | No |
| `SRE`, `RELEASE_MANAGER` | No (A-2) | Sí | Sí | No | No | No |
| `DPO` | No (A-2) | Sí | No | Sí | Sí | según frente 04 |
| `MARKETING_MANAGER` | No | Sí | No | Sí | No | No |

Regla de pestañas: una pestaña cuyo rol la sesión no alcanza **no se dibuja**; si la persona llega por URL a una ruta de pestaña, la API responde 403 y la pantalla muestra S5 con «a quién pedir acceso». Nunca una pestaña vacía.

### 3.5 Navegación y el techo de líneas

- `navigation.map.ts`: 2 008 líneas, techo 2 080 (`scripts/baselines/max-lines.json:10`) → **72 líneas de margen**, pero la regla de la casa es no tocarlo: las secciones de plataforma viven en `navigation.platform.ts` (221 líneas, sin techo propio, < 600) y se esparcen desde el map (`navigation.platform.ts:14-16`). Cambios de esta franja: **ninguna sección nueva**; se ajustan `label`/`summary` de `superadmin/observability` («Observabilidad y gobierno») y se registra, si el frente 04 lo pide, `superadmin/governance` **en `navigation.platform.ts`**, más su subgrupo en `navigation.subgroups.ts:310-326`.
- `navigation.management.ts:22-39`: `ROLES_DE_GESTION` ya contiene los cuatro roles de plataforma; `REPORTING_ADMIN` fue agregado el 31/10 para que `superadmin@alovida.mock` aterrizara en el Centro (`:34-38`). Al borrar la maqueta (H6) **se conserva** (no es de la maqueta: es el rol del módulo `reporting` real de la API).
- `check-max-lines`: rojo en la rama (126 archivos, incluidos `app.routes.ts` 2 564/2 273, `shell-layout.ts` 828/645, `mock-session.ts` 663/600). Criterio de esta franja: **neto ≤ 0 en cada archivo ya excedido** (medido con `wc -l` antes/después en el REPORTE), sin reescribir el baseline.

### 3.6 Coexistencia con el «Centro de la plataforma»

El Centro (`platform-home.ts`) **es** la entrada del panel: ya carga tráfico, sonda, herramientas, preparación, incidentes, despliegues, pruebas y respaldos, cada bloque con su `ViewState` (`:153-178`). No se crea otra portada. Lo que cambia: (1) la puerta «Portal de reportería» → «Observabilidad y gobierno» con destino `/superadmin/observability`; (2) nada de la maqueta se enlaza; (3) con alcance plataforma y sin organización fijada, los bloques que hoy piden tenant (analítica) muestran S5 «Elegir organización» y no un error. El plan previo (`docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/PLAN.md` H8) dejó el supuesto «portal admin / portal de reportería = las dos puertas de la portada»: este documento lo **reemplaza** por «Administración / Observabilidad y gobierno».

---

## 4. Hitos

Orden de dependencias: H2 (API) y H1 (front) se pueden escribir en paralelo en archivos disjuntos, pero **H1 no se da por verificado sin H2 desplegado en el entorno de prueba** (si no, bucle de 1.2). H3 depende de H1. H4 depende de H1+H2. H5 cierra. H6 es franja aparte.

### H1 — Alcance de plataforma en la sesión (front)

**CA.** Dado un token con `PLATFORM_ADMIN` global y `tenants.length ≥ 2`, cuando la persona entra sin `returnUrl`, entonces aterriza en `/dashboard` sin pasar por `/auth/organization`, el armazón rotula «Toda la plataforma», ninguna petición lleva `X-Tenant-Id` y, si fija una organización en el conmutador, la cabecera empieza a viajar y el panel vuelve a `/dashboard`. Dado un token con `PRACTITIONER` y 3 tenants, cuando entra, entonces sigue viendo `/auth/organization` (sin regresión). Dado un token con `PLATFORM_ADMIN` **con ámbito** (`scopedRoles`), entonces se comporta como hoy (elige).

**DoD ejecutable.** `yarn typecheck`, `yarn lint`, `yarn test --include 'src/app/core/auth/**' --include 'src/app/features/auth/**' --include 'src/app/features/shell-layout/**' --include 'src/app/core/http/**'` en verde con las pruebas nuevas; `wc -l` de `shell-layout.{ts,html}`, `mock-session.ts` sin crecer; capturas 390/1440 claro/oscuro de: login de `superadmin@alovida.mock` → Centro; conmutador abierto con «Toda la plataforma»; `medica@alovida.mock` → selector con `returnUrl` honrado.

| ID | Microtarea | Archivos | Estado |
|---|---|---|---|
| H1.S1.M1 | `core/auth/platform-scope.ts` + spec | nuevo | pendiente || H1.S1.M2 | `needsTenantSelection`, `hasPlatformScope`, `platformWide`, `clearTenant` en `SessionStore` + spec | `session.store.ts`, `.spec.ts` | pendiente || H1.S1.M3 | `AuthService.clearSelectedTenant()` (borra señal y `localStorage`) + spec | `auth.service.ts`, `refresh-token.storage.ts` | pendiente || H1.S2.M1 | `core/auth/return-url.ts` (extraído de `login.ts:261-268`) + `destinoNormal()` nuevo orden + specs | `login.ts`, `login.spec.ts` | pendiente || H1.S2.M2 | `tenant-selection`: `returnUrl` + opción «Toda la plataforma» + specs | `tenant-selection.{ts,html,spec.ts}` | pendiente || H1.S3.M1 | Conmutador del armazón: rótulo, opción «Toda la plataforma», condición de visibilidad; extraer a `shell-layout/tenant-menu/` si el delta > +12 líneas | `shell-layout.{ts,html}` | pendiente || H1.S4.M1 | Interceptor: 412 reconocido; sin navegación para alcance plataforma; `returnUrl` en la navegación | `auth.interceptor.ts`, specs | pendiente || H1.S4.M2 | `error-to-view-state`: `TENANT_*` → S5 con `nextAction` «Elegir organización» | `error-to-view-state.ts`, spec | pendiente || H1.S5.M1 | Cuenta mock `plataforma@alovida.mock` (sólo `PLATFORM_ADMIN`, 2 tenants) | `mock-session.ts` (o `mock-session.accounts.ts`) | pendiente || H1.S5.M2 | Doc: `docs/adr/ADR-00xx-alcance-de-plataforma.md` (regla 2.1, por qué no `SECURITY_ADMIN`) y actualización de `docs/frontend/*` que nombran `needsTenantSelection` | docs | pendiente |
### H2 — Rutas de plataforma sin tenant (API)

**CA.** Dado un `PLATFORM_ADMIN` global con 2 membresías y sin `X-Tenant-Id`, cuando pide `GET /admin/ops/traffic`, entonces 200. Con `X-Tenant-Id` de una organización ajena → 403 `TENANT_MEMBERSHIP_REQUIRED`. Dado un `PLATFORM_ADMIN` **con `tenantId`** en su asignación → 403 `TENANT_AMBIGUOUS`. Dado un `REPORT_VIEWER` → 403 `ROLE_INSUFFICIENT`. Dado un `SUPERADMIN` sin cabecera en `GET /admin/analytics/overview` → respuesta con `reason: TENANT_REQUIRED` (412 hoy; si A3 se aprueba, 200 agregado).

**DoD ejecutable.** `corepack yarn test --runInBand src/common/auth src/common/tenant src/modules/ops_console` en verde; e2e con `TokenService` real; `curl` contra la API local con Postgres (no el simulador) de los cuatro casos, guardado en `evidencia/h2-curl.md` con `x-request-id` de cada respuesta.

| ID | Microtarea | Archivos | Estado |
|---|---|---|---|
| H2.S1.M1 | `common/tenant/platform-scope.ts` + spec | nuevo | pendiente || H2.S1.M2 | `@PlatformTenantOptional(...)` en `OpsConsoleController` + e2e de 4 casos | `ops-console.controller.ts`, spec | pendiente || H2.S1.M3 | `tenant-scope.guard.spec.ts` +4 casos de 2.3/A6 | spec | pendiente || H2.S2.M1 | Decisión A3 registrada en `CONTEXTO-COMUN.md`/`DECISIONES`; si se aprueba, `@PlatformTenantOptional` en analítica y agregación con `minSample` (coordinar con frente 02) | `telemetry-analytics.controller.ts`, servicio | pendiente || H2.S3.M1 | Seed demo `plataforma@alovida.test` (`PLATFORM_ADMIN` global, 2 membresías) tras `demo-gate` | `common/seed/` nuevo + `seed.module.ts` + `README.md` | pendiente || H2.S3.M2 | Corregir `CONTEXTO-COMUN.md` (no existe `PlatformAdminScopeGuard`) — lo hace quien coordina; aquí sólo se registra | — | pendiente |
### H3 — Conmutador de organización dentro del panel (front)

Incluido en H1.S3; se separa como hito para la evidencia de mutación: **UI → `selectTenant` → `X-Tenant-Id` en la siguiente request (consola-red.json) → recarga (`localStorage` recordado) → UI**, y el camino inverso con «Toda la plataforma». CA/DoD: capturas antes/después y `consola-red.json` con la cabecera presente/ausente.

| ID | Microtarea | Estado |
|---|---|---|
| H3.S1.M1 | Spec Playwright `conmutador-organizacion.spec.ts` (simulador) con los dos sentidos y recarga | pendiente || H3.S1.M2 | Misma corrida contra la API real con `plataforma@alovida.test` | pendiente |
### H4 — Entrada: sin selector de portales, maqueta detrás de bandera

**CA.** Dado cualquier rol de gestión, cuando entra, entonces aterriza en `/dashboard` (Centro) y no en `/portal-selector`. Dado `/reports/commercial/resumen` en la barra, entonces redirige a `/superadmin/observability` (bandera apagada). Dado la bandera encendida en el simulador, entonces `reporteria-capturas.spec.ts` sigue verde (no se toca su contenido). Dado el Centro, entonces la segunda puerta se llama «Observabilidad y gobierno» y lleva a `/superadmin/observability`.

**DoD ejecutable.** `app.routes.spec.ts` y `reporting-access.spec.ts` ampliados (bandera on/off); `app.routes.ts` con **neto ≤ 0** líneas (medido); `node scripts/check-route-prefixes.mjs` y `check-doc-coverage.mjs` en verde; `playwright/support/sesion.ts:107-118` deja de aceptar `/portal-selector` **y** `/auth/organization` para las cuentas de plataforma (sigue aceptándolo para `medica`); los 3 `.mjs` + `auditoria-qa-mockup.spec.ts` actualizados y **ejecutados** (no sólo `node --check`).

| ID | Microtarea | Archivos | Estado |
|---|---|---|---|
| H4.S1.M1 | Bandera `reportingMockEnabled` (false) en `environment.types.ts` + generador | `src/environments/*` | pendiente || H4.S1.M2 | `entryDestination`/`accesoAPortales` leen la bandera; specs on/off | `reporting-access.ts`, spec | pendiente || H4.S1.M3 | `/reports/**` → redirect; `/portal-selector` → redirect; `app.routes.server.ts` acorde | `app.routes.ts`, `app.routes.server.ts`, `app.routes.spec.ts` | pendiente || H4.S2.M1 | Centro: puerta renombrada y destino | `platform-home.ts`, `.html`, spec | pendiente || H4.S2.M2 | `navigation.platform.ts:91-98`: `label`/`summary` de observabilidad | `navigation.platform.ts`, `navigation.map.spec.ts` | pendiente || H4.S3.M1 | `playwright/support/sesion.ts` + `login-cuenta-local.mjs` + `portal-admin-visual.mjs` + `auditoria-qa-mockup.spec.ts` | playwright | pendiente || H4.S3.M2 | `reporteria-capturas.spec.ts`: `test.skip` sin `PW_REPORTING_MOCK=1` (sin tocar casos) | playwright | pendiente || H4.S4.M1 | Docs: quitar `/reports` y `/portal-selector` de la navegación documentada; `docs/index.md`, `docs/reports/generated/rutas.json` regenerado | docs | pendiente |
### H5 — Matriz de roles y kill-test contra la API real

**CA.** Dado `admin@alovidasalud.com` miembro de 2+ organizaciones **y** `plataforma@alovida.test`, cuando entran contra la API real, entonces la primera URL tras el envío es `/dashboard`, el Centro pinta al menos el bloque «API hoy» con datos (no esqueleto, no error), la red muestra `GET /admin/ops/traffic` → 200 **sin** `X-Tenant-Id`, y `medica@` sigue viendo el selector.

**DoD ejecutable.** `playwright/entrada-portal-admin.spec.ts` (serie, un navegador) en verde contra `ng serve` + API local con Postgres; `fable-matriz-roles.spec.ts` regenerado en los dos modos con la columna `urlTrasLogin`; triage de los veredictos rojos en el REPORTE; revisión de `visual-reviewer`, `frontend-reviewer`, `regression-auditor` (quien implementa no aprueba).

| ID | Microtarea | Estado |
|---|---|---|
| H5.S1.M1 | `support/sesion.ts › entrarYObservar()` | pendiente || H5.S1.M2 | `entrada-portal-admin.spec.ts` (kill-test §5) | pendiente || H5.S2.M1 | Matriz: catálogo con `superadmin/*`, `/insights`, cuentas reales; dos corridas; evidencia en `docs/frontend/evidence/roles/` con fecha | pendiente || H5.S2.M2 | Triage de rojos (D-11) en `REPORTE.md` | pendiente || H5.S3.M1 | Dos PRs por repo (`dev` y `test`, cherry-pick desde `test`) | pendiente |
### H6 — (franja siguiente) Archivo definitivo de la maqueta

Precondición: panel de observabilidad `VERIFIED` contra la API real por otro frente. Pasos: rescatar a `shared/` (`kpi-tile`+`sparkline`, `report-filter-bar`, `tab-view`/`report-table`, `chart-theme.service`) con specs; mover `ROLES_ADMINISTRACION`/`ROLES_INSIGHTS`/`puedeVer*` a `core/navigation/portal-access.ts`; borrar `features/reporting/`, `features/portal-selector/`, `core/mock/handlers/reporting*`, `core/data-access/reporting/`, `reporteria-capturas.spec.ts`; limpiar `session-cleanup.lazy.ts`; quitar la bandera. Costo: −432 `it()`, −35 PW, −~60 archivos (3.2).

---

## 5. Kill-test (binario)

> **Entro como Portal Admin de AloVida contra la API real y no veo selección de organización; aterrizo en el panel.**

Pasos exactos (`playwright/entrada-portal-admin.spec.ts`, contra `ng serve` con `proxy.conf.json` hacia la API local con Postgres, **no** el simulador):

1. `page.goto('/auth')`, `esperarAplicacionLista`, escribir `admin@alovidasalud.com` / `12345678` (cuenta con **2+ membresías activas**; si en el entorno tiene una sola, el test la agrega a una segunda organización vía API antes y lo registra), clic en `login-submit`.
2. **Afirmar** que la primera navegación tras el envío es `/dashboard` y que **nunca** se visitó `/auth/organization` ni `/portal-selector` (lista de `framenavigated`).
3. **Afirmar** `getByTestId('header-organization')` con texto «Toda la plataforma».
4. **Afirmar** en la red: `GET /admin/ops/traffic` → 200 y la request **no** lleva `x-tenant-id`; `x-request-id` presente en la respuesta.
5. **Afirmar** que el bloque «API hoy» del Centro no está en esqueleto ni en error a los 10 s.
6. Repetir 1-5 con `plataforma@alovida.test` (`PLATFORM_ADMIN` sin `SUPERADMIN`).
7. Control negativo: `medica@` (o una cuenta real con 2 membresías y sin rol de plataforma) **sí** llega a `/auth/organization`.

Falla cualquiera de 2, 3, 4, 6 o 7 → **no está hecho**. Un toast, una captura sin red o una corrida contra el simulador no cuentan.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Arreglar el front sin H2 desplegado produce bucle `/dashboard ↔ /auth/organization` para `PLATFORM_ADMIN` (1.2). | H1 no se verifica sin H2 en el entorno; el interceptor deja de navegar para alcance plataforma (H1.S4.M1), así que el peor caso es S5, no bucle. |
| Ampliar `PRIVILEGED_TENANT_ROLES` por «rapidez» → `PLATFORM_ADMIN` podría leer cualquier tenant por cabecera. | Prohibido en 2.3/A1; prueba negativa «tenant ajeno → 403» en H2.S1.M2. |
| Pantallas de plataforma que hoy dependen de tenant (analítica, bulk-imports `bulk-imports.client.ts:25`) quedan en S5 para quien no fije organización. | Es correcto y explícito («null ≠ 0»); A3 decide la agregación. |
| `check-max-lines` rojo en 126 archivos: el ratchet no protege. | Medir neto por archivo en el REPORTE; `shell-layout` se extrae a subcomponente. |
| El `superadmin` real quizá tenga una sola membresía y el kill-test «pase» sin probar nada. | Paso 1 del kill-test exige 2+ membresías y lo registra con la consulta a `directory.tenant_memberships`. |
| Conflictos con `claude/stoic-johnson-4vl5bf` (TRASPASO.md: 35 archivos del front, incluidos `navigation.platform.ts`, `navigation.management.ts`, `app.routes.ts`). | Esta franja toca `navigation.platform.ts` sólo en `label`/`summary` y `app.routes.ts` sólo en 2 redirecciones; se rebasa sobre `dev`, nunca sobre esa rama. |
| Tocar `playwright/support/sesion.ts` cambia el comportamiento de los 18 specs que lo usan. | Nueva función `entrarYObservar()`; `entrar()` conserva su contrato salvo que deja de aceptar `/portal-selector` cuando la bandera está apagada. |
| Rate limit de login (10/min/IP, `sesion.ts:63-70`) con tres cuentas en el kill-test. | Serie, un navegador, reutilizar sesión por `storageState` entre pasos. |

## 7. Ambigüedades y supuestos tomados

| ID | Ambigüedad | Supuesto |
|---|---|---|
| A-1 | ¿Qué cuenta es «Portal Admin de AloVida»? | `admin@alovidasalud.com` (`SUPERADMIN`, `local-login-hint.ts:44`) en local; en otros entornos, una cuenta con `PLATFORM_ADMIN` asignado a mano. El plan cubre ambas. |
| A-2 | ¿`SRE`, `RELEASE_MANAGER`, `DPO`, `QA_ADMIN` entran sin elegir organización? | **No** en esta franja: `PLATFORM_SCOPE_ROLES` son los cuatro de 2.1. Ampliar es una línea en dos archivos y una prueba. |
| A-3 | ¿Analítica web (`/admin/analytics`) debe agregar entre organizaciones para plataforma? | Hoy no (diseño explícito del controlador). Se propone sí, con `minSample`; hasta decidirlo, S5 «Elegir organización». |
| A-4 | Destino de `MARKETING_MANAGER` puro tras el login. | `/insights` como hoy. |
| A-5 | ¿`superadmin/measurement` se fusiona como pestaña de `observability`? | Se propone sí (una tarjeta con pestañas, §5 de composición); lo decide el frente del dashboard. |
| A-6 | ¿Hace falta un claim nuevo en el token (p. ej. `platformScope: true`)? | **No**: se deriva de `roles`/`scopedRoles` con la misma regla en ambos lados. Evita tocar `TokenService` y el contrato del token. |
| A-7 | ¿Se conserva `REPORTING_ADMIN` en `ROLES_DE_GESTION` al borrar la maqueta? | Sí: es rol del módulo `reporting` real de la API. |

## 8. Fuera de este frente (coordinación)

- Contenido de las pestañas Sistema/Errores/Latencia/Uso/Heatmap (frentes 02/03) y Catálogo/Gobierno (frente 04): este documento fija **dónde cuelgan** (`/superadmin/*`), **quién las ve** (3.4) y **qué contrato de tenant** necesitan de la API (2.3).
- Corrección de `CONTEXTO-COMUN.md` (D-12): no hay `PlatformAdminScopeGuard`; lo que existe es `@PlatformTenantOptional` + `hasOptionalPlatformTenant`.
- Esquema: esta franja **no** toca `mantra-core-health-model`.
