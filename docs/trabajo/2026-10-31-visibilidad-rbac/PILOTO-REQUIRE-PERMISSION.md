# Piloto `@RequirePermission` — permisos finos que gobiernan endpoints (2026-11-01)

Pendiente 1 de [TRASPASO.md](./TRASPASO.md) · Hallazgo de partida: [RBAC-POR-MODULO.md](./RBAC-POR-MODULO.md) §1.1–1.3
(«asignar un permiso a un rol no cambia lo que un endpoint permite»).

**Peldaño de evidencia:** `TESTED` con dobles **y** una prueba HTTP contra Postgres real (§9). **Estado (2026-11-01):** el usuario
autorizó aplicar el piloto en `shadow`; el diff de §5 **está aplicado** a las 11 rutas (7 archivos de controlador), sin tocar `@Roles`
ni ningún otro comportamiento y sin variables que pongan algo en `enforce`. Los 11 códigos de §4 **siguen sin sembrar** (decisión abierta):
mientras no se siembren, el PDP responde `permiso inexistente` y **toda** petición que pase `@Roles` en esas rutas (salvo `SUPERADMIN` de
plataforma) dejará un `SHADOW_WOULD_DENY` en el log. Es ruido esperado, no un fallo; la medición útil empieza al sembrar.

## 1. Qué se construyó (API, rama `claude/upbeat-darwin-rm3rn2`)

| Archivo | Qué es |
|---|---|
| `src/common/auth/permission-decision.port.ts` | Puerto `PERMISSION_DECISION_POINT` (token + tipos), resolución del modo por entorno, mapeo verbo→acción del catálogo, clave de metadata. |
| `src/common/auth/require-permission.decorator.ts` | `@RequirePermission('modulo.recurso.accion', { resourceIdParam?, pdpAction? })`. Valida el código al cargar y monta la guarda con `@UseGuards`. |
| `src/common/auth/require-permission.guard.ts` | `RequirePermissionGuard`: consulta el PDP a través del puerto; shadow/enforce/off. |
| `src/modules/authz/services/authz-permission-decision-point.ts` | Adaptador fino sobre `AuthzPdpService.evaluate` (no repite lógica del PDP). |
| `src/modules/authz/authz.module.ts` | +2 proveedores: el adaptador y `{ provide: PERMISSION_DECISION_POINT, useExisting }`. |
| `src/common/errors/system-error-reasons.ts` | +2 `reason`: `PERMISSION_INSUFFICIENT` (403) y `AUTHZ_DECISION_UNAVAILABLE` (503). |
| Specs | `require-permission.guard.spec.ts` (29), `require-permission.decorator.spec.ts` (11, incluye cableado HTTP real de Nest), `authz-permission-decision-point.spec.ts` (3). |

`common` sigue sin importar módulos de dominio: la guarda pide la decisión por el token y `AuthzModule` lo provee. La guarda
busca el token en todo el contenedor (`moduleRef.get(token, { strict: false })`), así que un controlador de cualquier módulo
puede usar el decorador sin importar `AuthzModule`. Lo prueba el spec HTTP: el controlador vive en un módulo que **no** importa
al que provee el PDP.

## 2. Semántica elegida

La guarda la monta el decorador (`@UseGuards`), así que **sólo corre en las rutas que lo declaran** y siempre **después** de los
guards globales (`JwtAuthGuard` → `TenantScopeGuard` → `RolesGuard` → `VerifiedIdentityGuard`). Si `@Roles` niega, el PDP ni se consulta.

| Modo | `@Roles` niega | `@Roles` permite + PDP `PERMIT` | `@Roles` permite + PDP `DENY` | PDP caído / no registrado | Sin tenant resoluble |
|---|---|---|---|---|---|
| sin decorador | 403 (como hoy) | — | — | — | — |
| `off` | 403 `ROLE_INSUFFICIENT` | pasa | pasa | pasa | pasa |
| **`shadow` (por defecto)** | 403 `ROLE_INSUFFICIENT` | pasa, log `debug` `AGREE` | **pasa**, log `warn` `SHADOW_WOULD_DENY` | pasa, log `SHADOW_PDP_ERROR` | pasa, log `SHADOW_NOT_EVALUABLE` |
| `enforce` | 403 `ROLE_INSUFFICIENT` | pasa | **403 `PERMISSION_INSUFFICIENT`** | **503 `AUTHZ_DECISION_UNAVAILABLE`** (fail-closed) | **403 `PERMISSION_INSUFFICIENT`** (`cause: TENANT_UNRESOLVED`) |

- **`enforce` = `@Roles` Y permiso.** Una ruta con `@RequirePermission` y sin `@Roles` queda en «autenticado Y permiso».
- **`shadow` no bloquea ni añade latencia:** la consulta al PDP se lanza sin esperarla (probado con una promesa que nunca resuelve).
  Sólo ve las peticiones que `@Roles` dejó pasar; mide «¿cuántos que hoy entran quedarían fuera?», no lo contrario.
- **`SUPERADMIN` de plataforma pasa sin consultar** (misma regla que `RolesGuard` y que el adaptador de `bulk_import` de dev);
  un `SUPERADMIN` acotado a un tenant (`scopedRoles`) no es comodín.
- **Alcance:** tenant = el que resolvió `TenantScopeGuard` (`request.resolvedTenantId`); si no hay, el único tenant del actor; si no,
  no evaluable. Con `resourceIdParam` el id de la ruta (sólo si es UUID) va al PDP como `resourceId`, para que cuenten los grants
  por recurso (`authz.resource_scope_grants`). No se pasa `patientProfileId`: el PHI sigue siendo de `ClinicalRecordAccessGuard`.
- **Cómo se consulta el PDP:** `resource` = **el código completo** (`accounting.journal_transactions.approve`), `action` = verbo final
  mapeado al catálogo (`read`/`list`→`READ`, `create`→`CREATE`, `update`→`WRITE`, `delete`→`DELETE`, `approve`/`reject`→`APPROVE`,
  `assign`/`configure`/`export`/`audit`→`EXECUTE`), sobreescribible con `pdpAction`. Es la misma convención que ya usa
  `bulk_import` (`resource = código`); como el recurso es el código, `…approve` y `…reject` siguen siendo permisos distintos.
- **Respuesta al cliente:** 403/503 con `details.permission` (el código). El motivo del PDP **sólo va al log**.
- **Log** (`PinoLogger`, `operation: 'authz.permission.check'`): `permission`, `mode`, `modeSource`, `userId`, `tenantId`, `method`,
  `route` (**plantilla**, nunca la URL real con ids o query), `outcome`, `pdpReason`. No se persiste en `audit` (ver pregunta 6).

### Configuración del modo (por entorno, por módulo)

```bash
AUTHZ_PERMISSION_MODE=shadow                 # global (si falta: shadow)
AUTHZ_PERMISSION_MODE__ACCOUNTING=enforce    # por módulo = primer segmento del código, en mayúsculas
AUTHZ_PERMISSION_MODE__AUTHZ=off
```

Prioridad: variable del módulo > global > `shadow`. Un valor no reconocido se ignora (cae al siguiente nivel) y se avisa una vez:
un error de tipeo nunca abre a `off` ni cierra a `enforce` por sorpresa. No hay modo en el decorador **a propósito**: endurecer una
ruta es una decisión de operación, no un cambio de código que pueda colarse en un PR. Las variables se leen de `process.env` en cada
petición (no se agregaron al esquema Joi de arranque; se puede agregar si se quiere validación al boot).

## 3. Elección del piloto

Re-ejecuté el escáner del informe (`evidencia/scan-rbac-por-modulo.cjs`) sobre la rama actual (ya fusionada con dev):
**1 907 rutas** y **43** rutas `delete/export/approve/reject/assign/configure` sólo por `@Roles` (el informe decía 37 antes del merge).
Los módulos que más concentran: `accounting` 4, `scheduling` 4, `authz` 3, `pharmacy` 3. Propongo **`accounting` + `authz` + `scheduling`
= 11 rutas**: los tres con más rutas sensibles, y `accounting`/`authz` están en la lista de mayor sensibilidad del informe (§5.3).

Ninguno de los 11 códigos existe hoy en el catálogo: lo único sembrado en `authz.permissions` es `DIAGNOSTIC_RESULT_READ`,
`bulk_import.users` y `bulk_import.clinical` (`src/modules/authz/authz.seed.ts`). **Los 11 habría que sembrarlos** (§4).

| # | Método y ruta | Controlador · archivo:línea (`@Roles`) | `@Roles` actual | Código propuesto | Acción PDP | `resourceIdParam` | ¿Sembrado? |
|---|---|---|---|---|---|---|---|
| 1 | `POST /accounting/journal-transactions/:id/approve` | `AccountingLedgerController.approve` · `accounting/controllers/accounting-ledger.controller.ts:274` | `SECURITY_ADMIN`, `ACCOUNTING_APPROVER` | `accounting.journal_transactions.approve` | `APPROVE` | `id` | No |
| 2 | `DELETE /accounting/practitioner/simple/accounts/:id` | `AccountingPractitionerSimpleController.deleteAccount` · `accounting/controllers/accounting-practitioner-simple.controller.ts:138` | `PRACTITIONER` | `accounting.simple_accounts.delete` | `DELETE` | `id` | No |
| 3 | `DELETE /accounting/practitioner/simple/records/:id` | `…deleteRecord` · mismo archivo `:210` | `PRACTITIONER` | `accounting.simple_records.delete` | `DELETE` | `id` | No |
| 4 | `DELETE /accounting/practitioner/simple/transactions/:id` | `…deleteTransaction` · mismo archivo `:277` | `PRACTITIONER` | `accounting.simple_transactions.delete` | `DELETE` | `id` | No |
| 5 | `DELETE /authz/users/:userId/role-assignments/:assignmentId` | `AuthzAdminController.revoke` · `authz/controllers/authz-admin.controller.ts:73` | `SECURITY_ADMIN` | `authz.users_role_assignments.delete` | `DELETE` | `assignmentId` | No |
| 6 | `DELETE /authz/clinical-access-grants/:grantId` | `AuthzClinicalController.revokeClinicalAccess` · `authz/controllers/authz-clinical.controller.ts:84` (clase: `CLINICAL_APPROVER`, `SECURITY_ADMIN`, l. 29) | `SECURITY_ADMIN` | `authz.clinical_access_grants.delete` | `DELETE` | `grantId` | No |
| 7 | `DELETE /authz/resource-scope-grants/:grantId` | `AuthzGovernanceExtController.endScopeGrant` · `authz/controllers/authz-governance-ext.controller.ts:89` | `SECURITY_ADMIN` | `authz.resource_scope_grants.delete` | `DELETE` | `grantId` | No |
| 8 | `POST /scheduling/bookings/:id/reject` | `SchedulingBookingsController.reject` · `scheduling/presentation/controllers/scheduling-bookings.controller.ts:240` | `SCHEDULING_ADMIN`, `SCHEDULING_AGENT`, `PRACTITIONER` | `scheduling.bookings.reject` | `APPROVE` | `id` | No |
| 9 | `POST /scheduling/bookings/:id/payment-receipts/:receiptId/reject` | `…rejectPaymentReceipt` · mismo archivo `:413` | `PRACTITIONER`, `SCHEDULING_ADMIN`, `SCHEDULING_AGENT` | `scheduling.bookings_payment_receipts.reject` | `APPROVE` | `receiptId` | No |
| 10 | `DELETE /scheduling/templates/:id` | `SchedulingController.retireTemplate` · `scheduling/presentation/controllers/scheduling.controller.ts:330` | `SCHEDULING_ADMIN`, `PRACTITIONER` | `scheduling.templates.delete` | `DELETE` | `id` | No |
| 11 | `DELETE /scheduling/exceptions/:id` | `SchedulingController.removeException` · mismo archivo `:611` | `SCHEDULING_ADMIN`, `PRACTITIONER` | `scheduling.exceptions.delete` | `DELETE` | `id` | No |

Rutas relativas a `src/modules/`. Los códigos son los que deriva el escáner; algunos nombres son mecánicos (`users_role_assignments`)
y conviene renombrarlos **antes** de sembrar (el código queda en la metadata del decorador y en `authz.permissions`).
La #7 está en `authz-governance-ext.controller.ts`, que hoy trabaja otro agente: no tocarlo sin coordinar.

## 4. Siembra propuesta (NO aplicada)

Mismo patrón que `PLATFORM_PERMISSION_SEED` de `authz.seed.ts` (ids deterministas, `seedPermissionRoleGrants` idempotente, un rol sin
fila en `authz.roles` se **omite** y se informa en `skippedMissingRole`). `grantToRoleCodes` = los roles de `@Roles` de hoy, para que
`enforce` no quite nada **a quien tiene el rol en `authz`**:

```ts
// Propuesta para src/modules/authz/authz.seed.ts → PLATFORM_PERMISSION_SEED (NO aplicada)
const pilot = (code: string, name: string, action: PlatformPermissionSeed['action'],
               scope: RoleScope, grantToRoleCodes: readonly string[]): PlatformPermissionSeed => ({
  id: platformPermissionId(code), code, name, resource: code, action, scope,
  isDangerous: true, grantToRoleCodes, provenance: RBAC_PILOT_PROVENANCE,
});
pilot('accounting.journal_transactions.approve', 'Aprobar un asiento contable', 'APPROVE', 'TENANT', ['SECURITY_ADMIN', 'ACCOUNTING_APPROVER']),
pilot('accounting.simple_accounts.delete', 'Borrar una cuenta de la contabilidad simple', 'DELETE', 'SELF', ['PRACTITIONER']),
pilot('accounting.simple_records.delete', 'Borrar un registro de la contabilidad simple', 'DELETE', 'SELF', ['PRACTITIONER']),
pilot('accounting.simple_transactions.delete', 'Borrar un movimiento de la contabilidad simple', 'DELETE', 'SELF', ['PRACTITIONER']),
pilot('authz.users_role_assignments.delete', 'Revocar una asignación de rol', 'DELETE', 'TENANT', ['SECURITY_ADMIN']),
pilot('authz.clinical_access_grants.delete', 'Revocar un acceso clínico', 'DELETE', 'TENANT', ['SECURITY_ADMIN']),
pilot('authz.resource_scope_grants.delete', 'Terminar un permiso por alcance de recurso', 'DELETE', 'TENANT', ['SECURITY_ADMIN']),
pilot('scheduling.bookings.reject', 'Rechazar una reserva', 'APPROVE', 'TENANT', ['SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'PRACTITIONER']),
pilot('scheduling.bookings_payment_receipts.reject', 'Rechazar un comprobante de pago de una reserva', 'APPROVE', 'TENANT', ['PRACTITIONER', 'SCHEDULING_ADMIN', 'SCHEDULING_AGENT']),
pilot('scheduling.templates.delete', 'Retirar una plantilla de agenda', 'DELETE', 'TENANT', ['SCHEDULING_ADMIN', 'PRACTITIONER']),
pilot('scheduling.exceptions.delete', 'Quitar una excepción de agenda', 'DELETE', 'TENANT', ['SCHEDULING_ADMIN', 'PRACTITIONER']),
```

## 5. Diff de los controladores (APLICADO el 2026-11-01, modo shadow)

Sólo agrega una línea por ruta y un import; no cambia `@Roles`, ni rutas, ni DTOs, ni servicios. Con el modo por defecto (`shadow`)
el comportamiento HTTP **no cambia**: sólo aparece el log de discrepancias. (Alternativa: exportar `RequirePermission` desde el barril
`src/common/index.ts` e importarlo junto a `Roles`; no lo toqué porque es compartido.)

```diff
--- a/src/modules/accounting/controllers/accounting-ledger.controller.ts
+++ b/src/modules/accounting/controllers/accounting-ledger.controller.ts
@@ imports (tras la l. 23, el import de '../../../common')
+import { RequirePermission } from '../../../common/auth/require-permission.decorator';
@@ -273,2 +274,3 @@
   @Post('journal-transactions/:id/approve')
   @Roles('SECURITY_ADMIN', 'ACCOUNTING_APPROVER')
+  @RequirePermission('accounting.journal_transactions.approve', { resourceIdParam: 'id' })

--- a/src/modules/accounting/controllers/accounting-practitioner-simple.controller.ts
+++ b/src/modules/accounting/controllers/accounting-practitioner-simple.controller.ts
@@ imports
+import { RequirePermission } from '../../../common/auth/require-permission.decorator';
@@ -137,2 +138,3 @@
   @Delete('accounts/:id')
   @Roles('PRACTITIONER')
+  @RequirePermission('accounting.simple_accounts.delete', { resourceIdParam: 'id' })
@@ -209,2 +211,3 @@
   @Delete('records/:id')
   @Roles('PRACTITIONER')
+  @RequirePermission('accounting.simple_records.delete', { resourceIdParam: 'id' })
@@ -276,2 +279,3 @@
   @Delete('transactions/:id')
   @Roles('PRACTITIONER')
+  @RequirePermission('accounting.simple_transactions.delete', { resourceIdParam: 'id' })

--- a/src/modules/authz/controllers/authz-admin.controller.ts
+++ b/src/modules/authz/controllers/authz-admin.controller.ts
@@ imports
+import { RequirePermission } from '../../../common/auth/require-permission.decorator';
@@ -72,2 +73,3 @@
   @Delete('users/:userId/role-assignments/:assignmentId')
   @Roles('SECURITY_ADMIN')
+  @RequirePermission('authz.users_role_assignments.delete', { resourceIdParam: 'assignmentId' })

--- a/src/modules/authz/controllers/authz-clinical.controller.ts
+++ b/src/modules/authz/controllers/authz-clinical.controller.ts
@@ imports
+import { RequirePermission } from '../../../common/auth/require-permission.decorator';
@@ -83,2 +84,3 @@
   @Delete('clinical-access-grants/:grantId')
   @Roles('SECURITY_ADMIN')
+  @RequirePermission('authz.clinical_access_grants.delete', { resourceIdParam: 'grantId' })

--- a/src/modules/authz/controllers/authz-governance-ext.controller.ts   (archivo de otro agente: coordinar)
+++ b/src/modules/authz/controllers/authz-governance-ext.controller.ts
@@ imports
+import { RequirePermission } from '../../../common/auth/require-permission.decorator';
@@ -88,2 +89,3 @@
   @Delete('resource-scope-grants/:grantId')
   @Roles('SECURITY_ADMIN')
+  @RequirePermission('authz.resource_scope_grants.delete', { resourceIdParam: 'grantId' })

--- a/src/modules/scheduling/presentation/controllers/scheduling-bookings.controller.ts
+++ b/src/modules/scheduling/presentation/controllers/scheduling-bookings.controller.ts
@@ imports
+import { RequirePermission } from '../../../../common/auth/require-permission.decorator';
@@ -239,2 +240,3 @@
   @Post(':id/reject')
   @Roles('SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'PRACTITIONER')
+  @RequirePermission('scheduling.bookings.reject', { resourceIdParam: 'id' })
@@ -412,2 +414,3 @@
   @Post(':id/payment-receipts/:receiptId/reject')
   @Roles('PRACTITIONER', 'SCHEDULING_ADMIN', 'SCHEDULING_AGENT')
+  @RequirePermission('scheduling.bookings_payment_receipts.reject', { resourceIdParam: 'receiptId' })

--- a/src/modules/scheduling/presentation/controllers/scheduling.controller.ts
+++ b/src/modules/scheduling/presentation/controllers/scheduling.controller.ts
@@ imports
+import { RequirePermission } from '../../../../common/auth/require-permission.decorator';
@@ -327,4 +328,5 @@
   @Delete('templates/:id')
   // Mismo alcance que publicar y generar: el servicio comprueba que el recurso
   // sea del actor con `assertActorResource`.
   @Roles('SCHEDULING_ADMIN', 'PRACTITIONER')
+  @RequirePermission('scheduling.templates.delete', { resourceIdParam: 'id' })
@@ -608,4 +610,5 @@
   @Delete('exceptions/:id')
   // Mismo alcance que el POST hermano: el servicio verifica que el recurso de
   // la excepción sea del actor (`assertActorResource`).
   @Roles('SCHEDULING_ADMIN', 'PRACTITIONER')
+  @RequirePermission('scheduling.exceptions.delete', { resourceIdParam: 'id' })
```

## 6. Quién perdería acceso en `enforce` aunque se siembre §4 — **decisión del usuario**

El PDP calcula los roles efectivos **sólo** desde `authz.user_role_assignments` (`authz-pdp.service.ts`, paso 2). El claim `roles` del
token que mira `@Roles`, en cambio, junta `iam.user_global_roles` + `authz.user_role_assignments` + roles derivados del login
(`PHARMACY_STAFF`). Todo rol que llega al token **por fuera de `authz`** es invisible para el PDP:

| Rol | Por qué el PDP no lo ve | Rutas del piloto afectadas en `enforce` |
|---|---|---|
| **`SECURITY_ADMIN`** | Rol global de `iam`; **no tiene fila en `authz.roles`** (código reservado `ROLE_CODE_RESERVED`); `seedPermissionRoleGrants` lo omite (`skippedMissingRole`), igual que ya pasa con `bulk_import`. | **#1** (lo pierde; `ACCOUNTING_APPROVER` sigue) y **#5, #6, #7: nadie salvo `SUPERADMIN`** podría revocar asignaciones, accesos clínicos ni grants. **Riesgo de bloqueo operativo.** |
| `PRACTITIONER` concedido como rol global de `iam` (`POST /iam/users/:id/global-roles`) | Igual: sólo cuenta si además tiene asignación `PRACTITIONER` en `authz`. | #2, #3, #4, #8, #9, #10, #11 para esos usuarios. |
| Cualquiera **sin tenant resoluble** (sin membresía, o varias sin `X-Tenant-Id`) | El PDP exige `tenantId`; la guarda niega en `enforce` (`TENANT_UNRESOLVED`). Probable en el profesional independiente de la contabilidad simple. | #2, #3, #4 sobre todo. |
| `ACCOUNTING_APPROVER`, `SCHEDULING_ADMIN`, `SCHEDULING_AGENT` | Tienen fila en `authz.roles` (`authz.business-roles.seed.ts`, `scheduling.roles.ts`): **no pierden**, si su asignación está vigente y es global o del tenant de la petición. | — |
| `SUPERADMIN` de plataforma | Pasa sin consultar (comodín, como `RolesGuard`). | — |

Además, en `enforce` cualquier `DENY` de una política ABAC del tenant sobre el recurso, o una excepción de usuario `DENY`, corta la ruta:
es justo lo que se busca, pero hoy no tiene efecto y nadie las revisó con esa consecuencia.

**Recomendación:** activar sólo `shadow` (default, sin tocar entorno), aplicar el diff de §5 y la siembra de §4, y medir unos días
`operation=authz.permission.check outcome=SHADOW_WOULD_DENY` agrupado por `permission` antes de poner un módulo en `enforce`.
**No poner `authz` en `enforce`** hasta resolver la pregunta 1.

## 7. Preguntas para el usuario

1. **`SECURITY_ADMIN` frente al PDP:** ¿(a) crear una representación de `SECURITY_ADMIN` en `authz.roles` + asignación (hoy está reservado),
   (b) tratar los roles globales de `iam` como roles efectivos en el PDP (cambio del PDP, dueño de `authz`), o (c) concesiones directas
   por usuario (`user_permission_grants`)? Sin esto, `enforce` en `authz` deja sólo a `SUPERADMIN`.
2. **`PRACTITIONER` global de `iam`:** misma pregunta; ¿se migra a asignación de `authz`?
3. ¿Se acepta el piloto `accounting` + `authz` + `scheduling` (11 rutas) y los códigos/nombres de §3–4, o se renombran antes de sembrar?
4. ¿`SUPERADMIN` de plataforma debe seguir pasando sin consultar el PDP?
5. ¿`reject` → acción `APPROVE` está bien, o se amplía `PERMISSION_ACTIONS` (cambio de modelo: concepto `ACTION_REJECT`)?
6. ¿Las discrepancias de `shadow` alcanzan con el log, o se persisten en `audit` (tabla/evento nuevo, dueño de `audit`)?
7. ¿Autorizás tocar los 6 controladores del diff (uno, `authz-governance-ext.controller.ts`, lo trabaja otro agente)?

## 8. Evidencia (ejecutada el 2026-11-01)

- `tsc --noEmit --incremental false -p tsconfig.json` (API completa, specs incluidos): **exit 0**.
- `jest --runInBand src/common/auth/require-permission src/modules/authz/services/authz-permission-decision-point`:
  **3 suites, 43 pruebas, todas en verde** (con dobles; el spec HTTP usa Nest + supertest y un PDP falso).
- Regresión cercana: `jest src/common/auth/ …authz-pdp … core-error-contract` → **16 suites, 161 pruebas en verde** (incluye `roles.guard.spec`).
- `eslint` sobre los 9 archivos tocados: **exit 0**.
- Escáner: `node evidencia/scan-rbac-por-modulo.cjs <api>` (con `typescript` del front) → 1 907 rutas, 43 sensibles sólo por rol.
- **No ejecutado:** contra Postgres, API arrancada, `enforce` con datos reales, medición de `shadow`.

## 9. Aplicación del piloto en shadow (2026-11-01)

- Aplicado a `accounting-ledger`, `accounting-practitioner-simple`, `authz-admin`, `authz-clinical`, `authz-governance-ext`,
  `scheduling-bookings` y `scheduling` (controladores). Spec de metadatos nuevo: `src/common/auth/require-permission.pilot-routes.spec.ts`
  comprueba en las 11 rutas el código y `resourceIdParam` esperados, la guarda montada y que **método, ruta y `@Roles` siguen iguales**.
- `jest` del spec nuevo + specs de la guarda/decorador/adaptador + specs existentes de `accounting-ledger`, `accounting-practitioner-simple`,
  `authz-clinical` y `scheduling` controllers: **8 suites, 88 pruebas en verde**. `eslint` de los 8 archivos tocados: **exit 0**.
- `tsc` de toda la API: **exit 2 por 2 errores ajenos** (`src/modules/system_ops/services/governance-catalog.service.spec.ts:221,242`,
  `Cannot find module '../system_ops.concepts'`, archivo en curso de otro agente). Ninguno en archivos de este piloto.
- **HTTP contra Postgres 16 real** (`127.0.0.1:5433/alovida`, API `dist` en :3100; evidencia:
  [`evidencia/piloto-shadow-http-2026-11-01.txt`](./evidencia/piloto-shadow-http-2026-11-01.txt)), id inexistente fijo:

  | Actor | Ruta | Respuesta | Log del guard |
  |---|---|---|---|
  | `superadmin@alovida.local` (SUPERADMIN) | `DELETE /authz/resource-scope-grants/:id` | 404 `RESOURCE_SCOPE_GRANT_NOT_FOUND` | ninguno (comodín, no consulta) |
  | `farmacia.demo` (USER + PRACTITIONER) | `DELETE /authz/resource-scope-grants/:id` | 403 `ROLE_INSUFFICIENT` (lo corta `@Roles`) | ninguno |
  | superadmin | `DELETE /scheduling/exceptions/:id` | 404 | ninguno |
  | `farmacia.demo` (PRACTITIONER pasa `@Roles`) | `DELETE /scheduling/exceptions/:id` | **404 del servicio** (no bloqueó) | **`warn` `SHADOW_WOULD_DENY`**, `pdpReason: permiso inexistente para scheduling.exceptions.delete:DELETE`, `route` = plantilla |

  Repetido en dos arranques con resultado idéntico. **Límite honesto:** el `dist` ya había sido recompilado (por otro agente) con los
  decoradores antes de mi primer arranque, y mi `nest build` falló (`nest: not found`), así que **no hay un arranque «sin decorador»**
  para comparar byte a byte. Lo que sí está demostrado: las respuestas son las que deciden `@Roles` y el servicio (403 por rol, 404 del
  handler), y el modo shadow no cambió ninguna. Para tener una cuenta que pase `@Roles` sin ser SUPERADMIN, a `farmacia.demo` se le
  concedió `PRACTITIONER` global por `POST /iam/users/:id/global-roles` (200) y se le revocó al terminar (200).
