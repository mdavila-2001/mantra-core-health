# F2-APP — evidencia real (31/10/2026)

Carril App (`telemetry`, `read_models`). Rama `claude/busy-dijkstra-5apd55` del API. Contrato JSON: `CONTRATO-analytics-app.md`.

## Qué es y qué no es

- **Es:** salidas reales de `verify.mjs` contra Postgres 16 (`salud`, 5544) y dos copias del API compiladas del árbol de trabajo (`tsc -p tsconfig.build.json`, EXIT 0) y arrancadas en otros puertos: **A** `:3020` con `TELEMETRY_PLATFORM_MIN_SAMPLE=1` y **B** `:3021` con el piso por defecto (5). La API compartida `:3010` no se tocó ni se reinició.
- **No es:** navegador. Los eventos los manda el script con el cuerpo del SDK (curl/fetch); ningún clic salió de Angular. El `dist` verificado se compiló del árbol de trabajo, que incluye cambios sin commitear de otros carriles (`roles.guard.ts`, alias de roles).
- El índice único parcial `ux_user_activity_events_anonymous_idempotency` ya estaba en la base (parche v4.2.81 del modelo aplicado por otro carril). **No se probó la carrera sin el índice contra Postgres**; sin índice el `SAVEPOINT` simplemente nunca ve conflicto (cubierto sólo por prueba unitaria del flujo `null`).
- Conceptos nuevos (`ERROR_CLASS_*`, `ROUTE_DEPRECATED`) y partes se sembraron con `seed-cli` de mi copia.

## 1. Siembra de partes (H2.S1.M2) — 2.ª corrida = 0

`node dist/src/seed-cli.js --only=catalogo-de-conceptos,partes-del-frontend` (DB_ROLE_PURPOSE=migration):

```
1.ª: {"event":"seed.read_models.frontend_routes","origin":"partes.seed.json","surfaces":4,"routes":195,"updated":0,"deprecated":0}
2.ª: {"event":"seed.read_models.frontend_routes","origin":"partes.seed.json","surfaces":0,"routes":0,"updated":0,"deprecated":0}
     catálogo de conceptos: inserted 0
```
```
select portal_code,count(*) from read_models.frontend_routes r join read_models.portal_surfaces s on s.id=r.portal_surface_id group by 1;
MOBILE|3  WEB|169  INSIGHTS|9  WEB_PUBLICO|14      (195 rutas reales del front: navigation.*.ts, app.routes.ts, insights-nav.ts, main.dart)
```

## 2. Pruebas unitarias (Jest)

```
Test Suites: 40 passed, 40 total
Tests:       480 passed, 480 total
```

Cambios a pruebas existentes (todos **añaden** campos; ninguna aserción se relajó): claves nuevas en `heatmap`/`devices` (`scope`, `metric`, `views`, `scroll`, `rage/dead/value`, `dead` en elementos), mocks con `scroll`/`views`, y **dos pruebas reemplazadas** que fijaban «SUPERADMIN sin tenant → 412 TENANT_REQUIRED» (heatmap y devices): ese es justo el contrato que X-5 cambia; el 412 sigue cubierto para roles sin alcance plataforma en `analytics-scope.spec.ts` y en la matriz real de abajo. En las pruebas anónimas de `telemetry-events.service.spec.ts` el evento anónimo ahora se inserta con `insertAnonymous` (SAVEPOINT) en vez de `create`.

## 3. Hallazgos de seguridad de la coordinación (corregidos, commit `5ecacf9fa` + `b6c61e6f2`)

1. `lastRequestId` (errors, fingerprints) sólo a roles RAW; paridad con `fingerprint/:fp` (prueba `telemetry-errors-analytics.service.spec.ts`: sin RAW ningún `request_id` en las tres respuestas; con RAW, los tres).
2. La muestra de supresión cuenta **sujetos distintos**: `count(DISTINCT coalesce(user_id, analytics_subject_id, session_id))` en overview/timeseries; `coalesce(analytics_subject_id, session_journey_id)` en web vitals; `coalesce(analytics_subject_id, session_id)` (LATERAL) en dispositivos; sujetos distintos en dwell. Prueba: 1 persona con 40 mediciones queda suprimida (`telemetry-analytics.platform-scope.spec.ts`).
3. En plataforma, cada conteo/percentil sale `null` + `notMeasured` bajo `minSample`: totales, rutas, eventos por cubo, `samples`/percentiles/`ratings` de web vitals, grupos de dispositivos. `pipeline-health` **deja de ser de plataforma** (exige organización: PLATFORM_ADMIN sin cabecera → 403, abajo).
- Una celda con un solo sujeto: `select count(distinct user_id)` de los 6 clics de la celda (1,1) = **1**. En B (piso 5) plataforma: `cells: []`, `totals.clicks: null`, `notMeasured[0].metric = "minSample"`; la **misma celda** con `X-Tenant-Id` propio: `clicks = 6` (líneas «B (piso 5)» abajo).
- Los eventos anónimos (sin usuario, sujeto ni sesión) cuentan 0 sujetos: en plataforma no alcanzan `minSample` por sí solos (`parts.views` es conteo de eventos y no se suprime; los `users` sí).

## 4. Salida completa de `verify.mjs` (script: `scratchpad/f2app/verify.mjs`, 57 comprobaciones)

```
# F2-APP verificación real  2026-10-31T13:08:36.292Z  ventana 2026-10-31T13:08:35.292Z .. 2026-10-31T14:08:36.292Z
POST /telemetry/activity-events -> 201 {"inserted":21,"skipped":0}
OK   lote UX insertado completo  esperado 21
GET /admin/analytics/__e2e-404 -> 404 x-request-id= 8ec64cd4-c0b3-46cc-ad89-eb4310a8fece
POST client-errors (con token) -> 201 {"inserted":3,"rejected":0} | (sin token) -> 201 {"inserted":1,"rejected":0}
OK   4 errores insertados (3 con token + 1 sin token)

## psql
user_activity_events (ventana): clic|8 ; pagina_abandonada|5 ; pagina_vista|8
OK   psql: 5 pagina_vista identificadas + 3 anónimas = 8
OK   psql: 8 clic (6 celda + 1 otra celda + 1 otra ruta)
OK   psql: anónimas con user_id y session_id NULL
OK   psql: client_error_events = 4 (ventana)
client_error_events: f71c1c4cbc3fb0f9|Cannot read properties of undefined (reading x) para [correo] ci :n|/superadmin/measurement|true|1befcfea-44c0-563a-81cd-337ec6acc840|-
   f71c1c4cbc3fb0f9|Cannot read properties of undefined (reading x) para [correo] ci :n|/superadmin/measurement|true|1befcfea-44c0-563a-81cd-337ec6acc840|-
   821055dd3719b35f|Http failure response|/superadmin/web-analytics|true|1befcfea-44c0-563a-81cd-337ec6acc840|8ec64cd4-c0b3-46cc-ad89-eb4310a8fece
   e2eee6c67a92ca64|No match for /esta-ruta-no-existe-e2e|/esta-ruta-no-existe-e2e|false|-|-
OK   psql: 3 huellas distintas (las 2 JS iguales agrupan)
OK   psql: ningún correo ni documento en sanitized_message
OK   psql: el error sin token quedó sin usuario/tenant; los de token con usuario y tenant
OK   psql: api_route_template sin query y request_id guardado
request_id en observability.error_events: 0

## API (alcance organización: X-Tenant-Id)
heatmap totals {"clicks":7,"positioned":7,"keyboard":0,"withoutPosition":0,"repeated":3,"dead":1} cell(1,1) {"column":1,"row":1,"x":0.075,"y":0.075,"clicks":6,"rage":3,"dead":1,"value":6,"share":0.8571}
OK   heatmap: celda (1,1) clicks = 6 exacto
OK   heatmap: totales 7 clics (el de otra ruta no cuenta), rage 3, dead 1
OK   heatmap: vistas = 5 identificadas... 1 + 3 anónimas de la ruta  views=4
OK   heatmap: byElement nav-recoger = 7
OK   heatmap metric=rage: sólo la celda (1,1) con value 3
OK   heatmap metric=dead: value 1
scroll ["0.1:5","0.2:5","0.3:4","0.4:4","0.5:4","0.6:2","0.7:2","0.8:2","0.9:2","1:1"]
OK   scroll: 5 páginas; alcanzaron 0.2→5, 0.3→4, 0.5→4, 0.6→2, 0.9→2, 1.0→1
OK   heatmap screenSize=movil: 0 clics (no se inventa)
parts: ["WEB.SUPERADMINISTRACION.SUPERADMIN_MEASUREMENT:4v/2e","WEB.GENERAL.DASHBOARD:1v/0e","WEB.ADMINISTRACION.ADMINISTRATION_DATA_CATALOG:1v/0e","WEB.SUPERADMINISTRACION.SUPERADMIN_OBSERVABILITY:1v/0e","WEB.SUPERADMINISTRACION.SUPERADMIN_WEB_ANALYTICS:1v/1e"]
OK   parts: 5 pantallas navegadas aparecen resueltas a route_code
OK   parts: /superadmin/measurement views = 4 (1 identificada + 3 anónimas), users = 1, errores = 2  {"v":4,"u":1,"e":2,"dwell":{"samples":5,"p50":3000,"p75":4000}}
OK   parts: dwell p50 = 3000 ms (5 abandonos 1000..5000)
OK   parts: árbol con las 4 superficies; (plataforma) unmapped incluye la ruta inexistente con su error  tree=INSIGHTS,MOBILE,WEB,WEB_PUBLICO
OK   parts/:routeCode: keyActions nav-recoger = 7 y serie de vistas suma 4
OK   parts/:routeCode inexistente -> 404
errors totals {"errors":3,"suppressedRepeats":0,"fingerprints":2,"sessionsAffected":1,"sessionsWithError":1,"affectedUsers":1,"s9Shown":null} byClass [{"class":"JS","errors":2,"fingerprints":1},{"class":"HTTP","errors":1,"fingerprints":1}]
OK   errors (organización T1): 3 errores (el sin token queda fuera del tenant), 2 huellas
errors totals (plataforma) {"errors":4,"suppressedRepeats":0,"fingerprints":3,"sessionsAffected":null,"sessionsWithError":1,"affectedUsers":1,"s9Shown":null} {"level":"platform","tenantId":null,"minSample":1}
OK   errors (plataforma, sin cabecera): 4 errores, 3 huellas, scope platform
OK   errors: byHttpStatus 404 = 1, byApiRoute con la plantilla sin query
fingerprints ["JS:2:Cannot read properties of undefined (reading x) para [correo] ci :n","ROUTE:1:No match for /esta-ruta-no-existe-e2e","HTTP:1:Http failure response"]
OK   fingerprints: la JS agrupa count = 2; la HTTP lleva lastRequestId
OK   fingerprints/:fp: serie suma 2; PLATFORM_ADMIN (rol RAW) ve request_id recientes (array)
OK   routes-not-found: lista /esta-ruta-no-existe-e2e con 1
OK   errors?class=ROUTE filtra a 1

## Alcance plataforma (X-5)
OK   A (piso 1): PLATFORM_ADMIN sin cabecera ve la celda (1,1) = 6  scope={"level":"platform","tenantId":null,"minSample":1}
B (piso 5) heatmap: 200 {"cells":[],"totals":{"clicks":null,"positioned":null,"keyboard":null,"withoutPosition":null,"repeated":null,"dead":null},"notMeasured":{"metric":"minSample","reason":"Menos de 5 personas distintas hicieron clic en esta ruta: alcance plataforma (agregado entre organizaciones), todo se suprime."}}
OK   B (piso 5): 1 sola persona < 5 -> todo suprimido y declarado en notMeasured
OK   B (piso 5) con X-Tenant-Id rige la organización: sin supresión
OK   B parts plataforma: users null bajo minSample; views visibles
OK   B overview plataforma: totales suprimidos (muestra < 5) y declarados  {"metric":"totals","reason":"Menos de 5 sujetos en toda la ventana: el total se suprime (alcance plataforma)."}
OK   devices plataforma 200 con scope
OK   pipeline-health NO es de plataforma: PLATFORM_ADMIN sin cabecera -> 403  status=403 reason=TENANT_AMBIGUOUS
OK   pipeline-health con X-Tenant-Id -> 200
OK   web-vitals plataforma 200

## Matriz de autorización
/admin/analytics/errors  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/errors autorización
/admin/analytics/errors/fingerprints  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/errors/fingerprints autorización
/admin/analytics/errors/routes-not-found  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/errors/routes-not-found autorización
/admin/analytics/heatmap  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/heatmap autorización
/admin/analytics/parts  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/parts autorización
/admin/analytics/devices  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/devices autorización
/admin/analytics/overview  sin token=401  medico(2 orgs, sin cabecera)=403/TENANT_AMBIGUOUS  medico+T1=403/ROLE_INSUFFICIENT  medico+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN+tenant ajeno=403/TENANT_MEMBERSHIP_REQUIRED  PLATFORM_ADMIN sin cabecera=200  SUPERADMIN sin cabecera=200
OK   /admin/analytics/overview autorización
OK   POST client-errors sin token es público (201) y con cuerpo roto -> 400
OK   POST client-errors: campo no declarado (userId) -> 400
OK   POST client-errors: más de 50 por lote -> 400
OK   retention/purge: sin token 401; usuario con rol ordinario 403 (SUPERADMIN pasa por el comodín del RolesGuard, igual que en toda ruta SYSTEM)  401/403

## Retención
purge #1 -> 200 {"totalEvents":2,"totalProperties":1,"purposes":["PLATFORM_USAGE_AGGREGATE:2"],"withoutRetention":["PORTAL_UX_HEATMAP"]}
OK   retención: antes 3 (2 vencidos por 1 s y 1h, 1 dentro por 1h); después 1
OK   retención: la propiedad del evento vencido también se fue
OK   retención: PORTAL_UX_HEATMAP (sin retención) no se toca y se declara
OK   retención idempotente: 2.ª corrida = 0 eventos  {"totalEvents":0}

## Idempotencia anónima (dos lotes concurrentes con la misma clave)
índice único parcial presente: 1
6 lotes simultáneos -> 201:2/0  201:0/2  201:0/2  201:0/2  201:0/2  201:0/2
OK   concurrencia: ningún 500; exactamente 2 filas pese a 12 envíos; inserted total = 2  filas=2 inserted=2
OK   rate limit: ráfaga de 70 lotes desde una IP -> hay 429  429 x15

# RESULTADO: TODO OK
```

## 5. Qué no se ejecutó / pendiente

- Navegador/Playwright (otro carril); `yarn test` completo del API; lint; `docker-compose` del worker `telemetry` (el entrypoint `src/worker-telemetry.ts` y los scripts `start:worker:telemetry` existen; añadir el servicio al compose es de quien lo mantiene). El worker no se arrancó: la purga se ejercitó llamando al endpoint con un token `SYSTEM` firmado con el secreto del `.env`.
- `request_id` ↔ `observability.error_events`: la copia no persistió el 404 (cuenta 0 arriba); sólo se verificó que el `request_id` queda guardado en `client_error_events`. El enlace depende de que F2-SISTEMA capture esa petición.
- `permits_cross_tenant_aggregation=false` de `PORTAL_UX_HEATMAP` **no se aplica**: el heatmap de plataforma agrega igual (decisión U-3 + `minSample`). Si el DPO quiere respetar la bandera hay que filtrar por propósito.
- `PORTAL_UX_HEATMAP` sin `default_retention_days`: no se purga (declarado en `withoutRetention`).
- `SUPERADMIN` pasa por el comodín del `RolesGuard` también en las rutas `SYSTEM` (p. ej. `retention/purge`), como en el resto de la API.
- Maqueta de onboarding: `@deprecated`, no retirada (el front la consume).
- Seed-bootstrap: añadí un parámetro `@Optional` final y un paso (`seed-bootstrap.service.ts`, `seed.module.ts`), archivos fuera de mi lista; además `package.json` (2 scripts).
