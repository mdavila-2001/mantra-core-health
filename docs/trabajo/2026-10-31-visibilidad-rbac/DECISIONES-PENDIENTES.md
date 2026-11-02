# Decisiones pendientes (no las toma quien implementa)

Registro al 01/11/2026. Cada una bloquea solo lo que dice; el resto del trabajo sigue.

| # | Decisión | Dueño | Qué bloquea | Estado |
|---|---|---|---|---|
| D1 | ¿Cómo entra `SECURITY_ADMIN` (rol global de `iam`, sin fila en `authz.roles`) al PDP? Opciones: fila en `authz.roles`, que el PDP cuente roles globales de `iam`, o concesiones directas. Igual para `PRACTITIONER` global. | Producto + seguridad | Pasar cualquier módulo del piloto `@RequirePermission` a `enforce` (en particular `authz`). | Abierta |
| D2 | Aprobar o renombrar los 11 códigos del piloto antes de sembrarlos (`PILOTO-REQUIRE-PERMISSION.md`). Hasta sembrarlos, el modo shadow registra `SHADOW_WOULD_DENY` en esas rutas. | Producto + seguridad | Siembra de los códigos; señal útil del shadow. | Abierta |
| D3 | ¿SUPERADMIN sigue pasando sin consultar el PDP? | Seguridad | Semántica final de la guarda. | Abierta (hoy: pasa, igual que `RolesGuard`) |
| D4 | ¿`reject` se mapea a la acción APPROVE o se amplía el catálogo de acciones (cambio de modelo)? | Modelo | Códigos de rechazo del piloto. | Abierta |
| D5 | ¿Las discrepancias del shadow alcanzan con el log o se persisten en `audit`? | Seguridad | Medición del piloto. | Abierta (hoy: log) |
| D6 | Reporte contable por tipo de usuario (contrato H3 §4): no hay API. | Producto | Pestaña «Reporte contable» del editor de catálogos. | Abierta |
| D7 | Alcance de `SECURITY_ADMIN` en `ui_visibility` (hoy cualquier SECURITY_ADMIN da de alta/sincroniza el catálogo, y es global). ¿Los administradores acotados a una organización pierden ciclo de vida/revisiones/simulador (hoy 403)? | Producto + seguridad | Endurecer permisos de visibilidad. | Abierta |
| D8 | Cumplimiento/DPO: plazos de retención (solo 8 tablas tienen plazo del modelo) y bases legales; `is_official` del linaje (hoy `false`); `MIN_ASSERT_LEVEL` para `is_append_only`; `LIFECYCLE_ONLY` vs `APPEND_ONLY` en 31 contradicciones (la más grave `common.file_versions`). | Cumplimiento/DPO | Retención y linaje oficial. Sin fuente, quedan vacíos y visibles como brecha. | Abierta |
| D9 | `iam` (código de `dev`): el ciclo de vida no protege a `SUPERADMIN` (un admin de plataforma puede suspender/dar de baja a un SUPERADMIN); `deactivate` no revoca `authz.user_role_assignments`. | Dueño de `iam` | Cierre de dos huecos de seguridad. | Abierta |
| D10 | Umbral de frescura del escaneo de piezas (35 min, puesto por quien implementó). | Operaciones | Semáforo de la sonda de piezas. | Abierta |
| D11 | Explicación de negocio del catálogo: 0 operaciones curadas, 3,4 % de columnas con descripción propia. Requiere curación humana por dominio. | Dueños de dominio | Calidad del catálogo (no técnica). | Abierta |
| D12 | `GET /admin/ops/tools` está declarado dos veces. Responde la de `platform_ops` (`{evaluatedAt, items, notMeasured}`); la de `ops_console` es inalcanzable y tiene otra forma (`isHealthy`, `checkType`, `missingEnvVars`), que es la que el front declara consumir (`core/data-access/admin-portal/ops-tools.types.ts`). Borrar cualquiera fija el contrato. | Dueño de ops | Pantalla de herramientas de ops contra la API real (hoy el front espera la forma que nunca llega). | Abierta |

Lo aprobado por el usuario el 01/11/2026: aplicar `@RequirePermission` en modo **shadow** en las 11 rutas del piloto.
