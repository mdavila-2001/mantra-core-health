# Plan — Perfil admin: medición, catálogos, gobernanza, permisos finos y altas masivas

- Fecha: 2026-10-30 · Repos afectados: `mantra-core-health` (front), `mantra-core-health-api` (API), `mantra-core-health-model` (si cambia el esquema) · Predecesor: ninguno
- Rama de trabajo (ambos repos): `claude/stoic-johnson-4vl5bf` · Entrega: **dos PRs por franja** (uno a `dev`, otro a `test` por cherry-pick desde una rama creada desde `test`), según `CLAUDE.md` del front.
- Resultado observable: una persona con rol admin entra y ve **solo** herramientas de gestión y medición (sin «Mis…» ni autoservicio clínico): uso, dinero movido, errores, latencia y mapas de calor **por funcionalidad**; editores de catálogos por tipo de usuario; observabilidad y gobernanza de datos; permisos de granularidad fina y gobierno de usuarios; y un motor de altas masivas de usuarios. Todo contra la API real.
- Kill-test: iniciar sesión como `PLATFORM_ADMIN` contra la API real y abrir el menú: si aparece cualquier entrada «Mis …», «Farmacia» personal, «Dependientes», «Mi privacidad», o si un tablero muestra cifras que no salen de un endpoint, **no está hecho**.

## Decisiones del usuario (30/10/2026, registradas)

| # | Decisión | Elegida |
|---|---|---|
| D1 | Menú admin | Solo gestión/medición. Se oculta todo «Mis…» y autoservicio clínico para los roles admin. |
| D2 | Fuente del dinero | Facturación, pagos y cotizaciones existentes, agregados por módulo y moneda. Si falta endpoint agregado, se crea en la API. Sin cifras inventadas. |
| D3 | Mapa de calor | Clics/interacción por pantalla, sobre la telemetría UX existente. |
| D4 | Altas masivas | Todos los tipos de usuario; CSV/XLSX; vista previa; validación por fila; trabajo asíncrono idempotente; informe de rechazos. |
| D5 | Catálogos | CRUD global por tipo de usuario (Servicios, Glosarios, Reporte contable…), con auditoría y versión. |
| D6 | Gobernanza | Políticas, PII, calidad de datos, linaje y auditoría al estilo AtlasAdminPortal, sobre endpoints reales. |
| D7 | Entrega | Por franjas, front + API, 2 PRs (dev y test) por franja. |
| D8 | Permisos | **Ultra granulares** y gobierno de usuarios (pedido posterior; ver H5). |

## Alcance

- IN: menú y rutas del dominio admin; tableros de uso/dinero/errores/latencia/heatmap; editores de catálogos; observabilidad y gobernanza; permisos finos y gobierno de usuarios; motor de altas masivas; endpoints de API que falten para lo anterior.
- OUT: funcionalidades clínicas de autoservicio (no se tocan, solo se ocultan al rol admin); rediseño visual global; QA Lab/stress de Atlas (no elegido en D6).
- Autoridad: **la API autoriza**; ocultar un control no es seguridad (CLAUDE.md front, regla 95.6).

## Hallazgos (DISCOVERED, con ruta)

- El grupo «Superadministración» ya existe: `src/app/core/navigation/navigation.platform.ts` (10 secciones: observabilidad, catálogo de datos, portal de inventario, flujos, QA, analítica web, operación).
- El registro de secciones y el menú se construyen por rol: `navigation.map.ts` (2064 líneas, **congelado por `scripts/check-max-lines.mjs`**: no puede crecer → las secciones nuevas van en archivos nuevos, como `navigation.platform.ts`). Grupos hoy: `Administración` (27), `General` (24), `Mi cuenta` (21), `Atención` (13), `Facturación` (2).
- API con controladores admin: `admin`, `admin/analytics`, `admin/catalog`, `admin/content-packs`, `admin/governance`, `admin/ops`, `admin/portal`, `admin/qa`, `admin/tenants`.
- Telemetría UX con seeder de heatmap: `mantra-core-health-api/src/common/seed/telemetry-ux-heatmap-seed.service.ts`; analítica en `src/modules/telemetry/presentation/controllers/telemetry-analytics.controller.ts`.
- Authz ya modela la granularidad: `src/modules/authz/entities/` → `permissions`, `permission_categories`, `roles`, `role_permissions`, `field_permissions`, `resource_scope_grants`, `user_permission_grants`, `user_role_assignments`, `access_policies`, `ip_access_rules`, `break_glass_sessions`, `care_relationships`. Controladores: `authz-roles`, `authz-grants`, `authz-policies`, `authz-catalog`, `authz-pdp` (`decisions/evaluate`), `authz-admin`.
- Front ya tiene capa de datos: `src/app/core/data-access/authz-admin`, `role-assignments`, `iam`, `audit`, `admin-portal`, `telemetry`.
- Subida masiva existente solo para farmacia (`src/modules/pharmacy/controllers/pharmacy-bulk.controller.ts`) y plantilla de terminología (`terminology-import-template.controller.ts`). **No hay motor de altas de usuarios.** Front: `branch-bulk-import` (sucursales) como patrón de UI.
- AtlasAdminPortal (clonado solo lectura en `/home/user/pabloarauzcaballero/atlasadminportal`): rutas `governance`, `governance/pii`, `governance/policies`, `data-quality/issues`, `lineage`, `audit`, `security`, `business-metadata`, `settings/users`, `settings/roles`. Regla de Atlas: nada hardcodeado, todo del backend.

## Desconocidos / hipótesis (a resolver en la descubierta de cada franja)

- ¿Existen endpoints agregados de dinero por módulo? (hipótesis: no → se crean).
- ¿La telemetría UX guarda coordenadas de clic reales o solo el seeder? (verificar antes de H2.S3).
- ¿Qué campos mínimos exige cada tipo de alta para poder crear el usuario por lote? (salen de los DTO de registro existentes, no se inventan).
- Skills de KPI: `SearchSkills` no devolvió ninguna en la cuenta. No se instala código de terceros sin revisar (cadena de suministro). Se usan las locales `indicadores-tablero`, `dashboard-data-ui`, `observabilidad`, `analytics`, `dataviz` y se propone una local `admin-kpi-medicion`.

## Ambigüedades registradas

| Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|
| «Ultra granular» (D8): ¿hasta campo, hasta registro, o ambos? | Ambos: permiso por acción, por campo (`field_permissions`) y por alcance de recurso (`resource_scope_grants`), con condiciones de IP y horario si la API ya las modela. | Usuario |
| «Gobierno de usuarios»: ¿qué ciclo de vida? | Alta, suspensión, reactivación, baja, reasignación de roles, revisión periódica de accesos, historial. Sin borrado físico. | Usuario |
| «Reporte contable a mostrar y editar para todos los usuarios» | Un editor por tipo de usuario del catálogo de reporte contable, con auditoría. | Usuario |
| Roles admin que ven el menú de gestión | Los de `navigation.platform.ts` más los que ya leen `admin/*`. | Usuario |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Alcance muy grande | Entrega parcial | Franjas verticales cerradas de a una (`NO_BIG_BANG_REWRITE`). |
| Falta de datos reales de dinero/heatmap en dev | Tableros vacíos | Estado S1/S2 honestos de `ViewState<T>`; sin cifras inventadas; datos sintéticos declarados solo en dev. |
| `navigation.map.ts` congelado | No se puede agregar ahí | Archivos nuevos de secciones + espaciado. |
| Plantilla rota que `tsc` no ve | 404 en ejecución | `yarn build` + navegador en cada franja. |
| Carga masiva y PII | Fuga de datos personales | Archivo no persiste contenido crudo más allá del trabajo; logs solo con ids; auditoría. |
| CI propio caído | Sin gate automático | `check-*.mjs` a mano y salida pegada. |

---

## H1 — El rol admin ve solo gestión y medición

> **Estado real (30/10/2026): peldaño `TESTED`, no `VERIFIED`.** Falta prueba de navegador (3 viewports × 2 temas, doble revisión) y sesión contra la API real; hasta entonces H1 no se declara hecho. Desvío: «Glosario» sale del menú de gestión hasta que H3 entregue su editor global (sigue accesible por URL).

**CA:** Dado un usuario `PLATFORM_ADMIN`, cuando abre la app, entonces el menú contiene únicamente dominios de gestión (medición, catálogos, gobernanza, usuarios y permisos) y ninguna entrada «Mis …»/autoservicio; y un admin que escribe a mano la URL de un autoservicio recibe la respuesta de la API, no un acceso nuevo.
**DoD:** specs de navegación en verde · `yarn lint`/`typecheck`/`build` exit 0 · captura del menú en 3 viewports y 2 temas, mirada y revisada dos veces · cero errores de consola/red.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Inventariar secciones «Mis…» y de autoservicio visibles hoy para roles admin | Lista con ruta y rol, sin omisiones | volcado del menú por rol → `evidencia/H1-inventario-menu-antes.json` | HECHO |
| H1.S1.M2 | Filtrar el menú del perfil de gestión (solo gestión y medición), en archivo nuevo `navigation.management.ts` | Menú de `SUPERADMIN`/`PLATFORM_ADMIN`/`SECURITY_ADMIN`/`GOVERNANCE_ADMIN` sin autoservicio | `navigation.management.spec.ts` (14 pruebas) en verde | HECHO |
| H1.S1.M3 | Agrupar las secciones admin por dominio funcional (Medición, Catálogos, Gobernanza, Usuarios y permisos) | Cuatro grupos, orden fijo | spec de orden + captura | TODO — se difiere: `NAV_GROUPS` es un set cerrado atado a íconos; los grupos nuevos nacen con las secciones de H2–H5 |
| H1.S1.M4 | Prueba negativa: otro rol conserva su menú intacto | Menú de paciente/médico idéntico a `HEAD` | `navigation.management.spec.ts` + los 158 specs previos de navegación en verde | HECHO |

## H2 — Medición por funcionalidad: uso, dinero, errores, latencia y mapa de calor

**CA:** Dado un admin, cuando elige una funcionalidad (laboratorio, farmacia, consultas, cotizaciones…), entonces ve su uso, el dinero movido por moneda, errores y latencia p50/p95/p99 del periodo, y el mapa de calor de clics de cada pantalla; todo viene de la API y los estados vacío/error son accionables.
**DoD:** endpoints agregados con contrato y spec de API · specs de front · E2E contra API real con petición → respuesta → UI · capturas revisadas dos veces · consola/red sin errores.
**Estado:** TODO

### H2.S1 — API de métricas por funcionalidad
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Descubrir endpoints existentes de uso/latencia/errores (`admin/ops/traffic*`, `admin/analytics`) y su mapeo a funcionalidades | Tabla funcionalidad → endpoint | lectura citada con ruta:línea | TODO |
| H2.S1.M2 | Endpoint agregado de dinero por módulo y moneda desde facturación/pagos/cotizaciones | Suma desde la fuente declarada; importes decimales con moneda | spec + consulta de cuadre pegada | TODO |
| H2.S1.M3 | Endpoint de heatmap de clics por pantalla (si la telemetría guarda coordenadas) | Devuelve celdas normalizadas con total | spec + salida real | TODO |

### H2.S2 — Tablero por funcionalidad
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Capa `data-access` tipada de las métricas | Sin `any`; estados M34 | spec de adaptador | TODO |
| H2.S2.M2 | Vista resumen por funcionalidad con los 9 estados M34 | S1≠S2, S5≠S6, S9 con id de petición | spec + captura | TODO |
| H2.S2.M3 | Vista de heatmap por pantalla | Escala de color no es la única señal; reduce movimiento | captura 3 viewports × 2 temas | TODO |

## H3 — Catálogos globales editables por tipo de usuario

**CA:** Dado un admin, cuando abre Servicios, Glosarios o Reporte contable, entonces elige un tipo de usuario, ve su catálogo y puede crear, editar y desactivar entradas; el cambio persiste tras recargar y queda en auditoría con versión.
**DoD:** mutación probada `UI → request → response → persistencia → recarga → UI` · prueba de autorización negativa (rol insuficiente, sin token) · auditoría visible.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Descubrir contratos de servicios, glosario y reporte contable por tipo de usuario | Mapa catálogo → endpoints CRUD existentes y faltantes | citas ruta:línea | TODO |
| H3.S1.M2 | Completar en API los CRUD que falten, con auditoría y versión | 403 sin permiso; 404 en recurso ajeno | specs de API | TODO |
| H3.S2.M1 | Editor genérico con pestañas por tipo de usuario (una tarjeta, ancho completo) | Cumple `composition-rules.md` §5 | medición + captura | TODO |
| H3.S2.M2 | Conectar Servicios, Glosarios, Reporte contable | Persiste y recarga | E2E real | TODO |

## H4 — Observabilidad y gobernanza de datos (estilo Atlas)

**CA:** Dado un admin de gobernanza, cuando abre el dominio, entonces ve observabilidad (errores, latencia, trazas por `requestId`), políticas, PII, calidad de datos, linaje y auditoría, todos desde endpoints reales de `admin/governance`, `admin/catalog` y `admin/ops`.
**DoD:** una pantalla por sección con estados M34 · specs · E2E con API real · captura revisada dos veces.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Mapear por sección Atlas → endpoint de nuestra API (existente o faltante) | Tabla sin supuestos | lectura citada | TODO |
| H4.S1.M2 | Observabilidad: errores, latencia y traza por `requestId` | Búsqueda de un id real devuelve su traza | E2E real | TODO |
| H4.S2.M1 | Políticas y PII | Lista y detalle desde API | spec + captura | TODO |
| H4.S2.M2 | Calidad de datos y linaje | Issues con acción idempotente | spec + E2E | TODO |
| H4.S2.M3 | Auditoría de cambios | Filtros por actor, recurso y fecha, paginado | spec + captura | TODO |

## H5 — Permisos ultra granulares y gobierno de usuarios

**CA:** Dado un admin autorizado, cuando gestiona un usuario, entonces puede asignar roles, conceder o revocar permisos individuales, restringir por campo y por alcance de recurso (y por IP/horario si la API lo modela), suspender, reactivar y dar de baja; cada acción pide motivo, es idempotente, queda auditada y se puede revisar en una vista de «quién puede qué» con simulación del resultado (`decisions/evaluate`).
**DoD:** matriz de autorización negativa (otro usuario, otra organización, rol insuficiente, sin token) · mutación probada de punta a punta · simulación coincide con la decisión real del PDP · auditoría visible.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | Descubrir qué ya expone authz (`roles`, `grants`, `policies`, `catalog`, `pdp`) y qué falta (suspensión, baja, revisión de accesos) | Tabla acción → endpoint | citas ruta:línea | TODO |
| H5.S1.M2 | Completar en API ciclo de vida de usuario (suspender/reactivar/baja) con precondición en la escritura | Transición inválida → error del contrato | specs de API | TODO |
| H5.S2.M1 | Editor de roles y permisos por acción | Cambios persisten y auditan | E2E real | TODO |
| H5.S2.M2 | Permisos por campo y por alcance de recurso | Un campo restringido no viaja en la respuesta | spec API + UI | TODO |
| H5.S2.M3 | Vista «quién puede qué» y simulador de decisión | Resultado = PDP real | spec + E2E | TODO |
| H5.S3.M1 | Revisión periódica de accesos con historial | Registro de quién revisó y cuándo | spec + captura | TODO |

## H6 — Motor de altas masivas de usuarios

**CA:** Dado un admin, cuando sube un CSV/XLSX de un tipo de usuario, entonces el sistema valida cada fila, muestra una vista previa con errores por fila y por campo, permite confirmar, procesa en segundo plano de forma idempotente (re-subir el mismo archivo no duplica), y entrega un informe descargable de creados, omitidos y rechazados con su motivo; ningún dato personal queda en logs.
**DoD:** plantillas descargables por tipo · test de idempotencia (mismo archivo dos veces) · casos válido/límite/inválido por fila · límites de tamaño y de filas · prueba de autorización negativa · E2E real con persistencia verificada.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | Descubrir DTO/validaciones de alta existentes por tipo de usuario | Campos obligatorios sacados del código | citas ruta:línea | TODO |
| H6.S1.M2 | Módulo API de lote: crear trabajo, validar, previsualizar, confirmar, consultar estado, informe | Estados del trabajo con transición validada | specs de API | TODO |
| H6.S1.M3 | Idempotencia por clave de lote y por fila | Reintento no duplica | test con salida pegada | TODO |
| H6.S1.M4 | Trabajo asíncrono con timeout, reintento y visibilidad | Fallo parcial no aborta el resto | spec | TODO |
| H6.S2.M1 | Plantillas CSV/XLSX por tipo | Descarga con encabezados del contrato | spec | TODO |
| H6.S2.M2 | UI de carga: arrastrar archivo, vista previa, errores, confirmar, progreso, informe | Reutiliza el patrón de `branch-bulk-import` | captura + E2E | TODO |
| H6.S2.M3 | Auditoría del lote y ligazón a permisos (H5) | Cada alta deja actor y lote | spec | TODO |

---

## Orden de franjas (dependencias)

1. H1 (menú) → 2. H2 (medición) → 3. H3 (catálogos) → 4. H4 (gobernanza) → 5. H5 (permisos y gobierno) → 6. H6 (altas masivas, usa permisos de H5).
Una franja a la vez; cada una cierra con su evidencia y sus dos PRs antes de abrir la siguiente.

## Gates por franja

`yarn lint` · `yarn typecheck` · `yarn build` · specs dirigidos · `check-*.mjs` a mano · Playwright contra API real (nunca `networkidle`) · capturas en 3 viewports y 2 temas con doble revisión (`visual-reviewer`, no el mismo agente que implementa) · revisión de `frontend-reviewer` y `regression-auditor` · consola y red sin errores nuevos.

## Peldaño de evidencia actual

H1: `TESTED` (specs dirigidos, lint y typecheck en 0). H2–H6: `DISCOVERED`.
