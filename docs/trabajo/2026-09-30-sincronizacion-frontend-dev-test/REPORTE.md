# Hito 2 - reporte de integracion

Estado de ejecucion: EN CURSO. Este reporte se actualiza con cada gate; no certifica cierre.

## Completado

| ID | Resultado | Comando | Evidencia |
|---|---|---|---|
| H2.S1.M1-M3 | Worktree aislado desde dev, referencias y plan versionados antes del codigo | git rev-parse; git log | 01-input-refs.txt; d9eabb8b |
| H2.S1.M4 | Contratos reales diferenciados de demo | Inspeccion de fuentes H1 y consumidores | MATRIZ.md, 53 enlaces locales validos |
| H2.S2.M1 | Merge mockup con 113 conflictos resueltos individualmente | git merge; corepack yarn typecheck | b11d57f7; 06-typecheck.txt exit 0 |
| H2.S3.M1 | Tipos de app/Cypress/Playwright integrados | corepack yarn typecheck | 11-typecheck-integrated.txt exit 0; previo a nuevas suites de navegador |
| H2.S2.M4 | Entornos reales sin datos fabricados y demo explicita | node scripts/check-real-api-config.mjs | PASS: API real por defecto, demo explicita y production-api con SSR. |

## A medias

| ID | Que anda | Que no esta verificado | Que falta exactamente | Donde quedo |
|---|---|---|---|---|
| H2.S2.M5 | Instalacion immutable exit 0, sin upgrades | PnP no existia en ninguna entrada | Resolver discrepancia documental; se conserva node-modules existente | PLAN.md, 22-install-integrated.txt |
| H2.S3.M7-M8 | 13 suites dirigidas, 178 tests aprobados | Regresion completa y ultimos casos agregados | Ejecutar test:coverage sin bajar umbrales | 14-directed-integrated.txt; rama actual |
| H2.S3.M10 | Suites nuevas de laboratorio, aseguradora y accesibilidad escritas | Navegador y persistencia real | Chromium serial, capturas y revision independiente; API disponible | playwright/hito2-*.spec.ts; MATRIZ.md |

## Pendiente

- Cobertura, gates individuales y validacion final de tipos/lint.
- Chromium serial con capturas 390/1440 y revision independiente.
- Integracion real de los contratos ausentes de H1: bloquea certificacion completa, no el trabajo independiente demo.
- Reporte final, commits, publicacion y PR hacia dev con ambos reviewers, mergeabilidad y checks remotos.

## Evidencia

Los archivos bajo evidencia/ son salidas del comando indicado en su nombre o decisiones de merge. Los fallos iniciales se conservan junto a la comprobacion posterior, no se presentan como resultado final.

- Instalacion inicial reproducible: corepack yarn install --immutable, exit 0. Advertencias peer/build scripts registradas en 03-install.txt.
- Typecheck inicial fallo por duplicados y ruta retirada: 05-typecheck-initial.txt. Corregido, exit 0 en 06-typecheck.txt.
- Typecheck tras test fallo por diagnosticUnitId duplicado y ValidationIssue.message: 09-typecheck-integrated.txt. Corregido, exit 0 en 11-typecheck-integrated.txt.

## No cubierto

Los flujos demo de navegador se verificaron posteriormente en el checkpoint final de este reporte. Ninguna persistencia en API real ha sido certificada todavia en esta integracion. H1 PR #520 sigue siendo la fuente de codigo; su DDL/runtime no cuentan con evidencia completada. Ver MATRIZ.md por endpoint.

## Desvios y riesgos residuales

- Conflictos reales: 113 en mockup y 42 en test. No se aplico seleccion global de rama.
- Se eliminaron solamente miembros identicos duplicados y se respeto la retirada documentada de progress-notes por C1; la nota vive en la consulta.
- P39: filas estructuradas se serializan a objectiveText para el contrato real existente; demo conserva entries. Persistencia real pendiente.
- La regla de receta con diagnostico confirmado del mock no esta implementada por H1. Su 400 no prueba paridad con la API.
- Los historicos divergentes se preservan con su procedencia en evidencia/historical-dev y historical-test; no se sustituyen sus resultados por afirmaciones nuevas.
- La API real no publica varios portales/acciones de laboratorio, contabilidad y aseguradora. Un verde demo no elimina esos pendientes.
- La revision humana precede cualquier merge del PR. Esta entrega no promueve dev a test/mockup.

## Checkpoint unitario intermedio

`13-directed-integrated.txt`: 11 archivos; 7 aprobados y 4 fallidos; 153 pruebas aprobadas y 7 fallidas (dos suites adicionales no arrancaron por vi.mock relativo incompatible con Angular). PatientChart, Menu, mock-backend, los dos entornos y ruta farmacia aprobaron. Altas demo recibieron 422 por validaciones antiguas. Se repararon ambas causas sin reducir aserciones; repeticion en 14-directed-integrated.txt.

La revision independiente encontro y se corrigio tambien el escenario de enmienda que enviaba patientProfileId (no pertenece al DTO de versiones), y la emision doble de diagnosticUnitId en el mock. La identificacion del representante sigue exigida en contratos antiguos, con excepcion declarada para formas demo posteriores.

Instalacion: los tres SHA ya usaban node-modules. El diagnostico PnP del plan era incorrecto; preferencia consultada, ver PLAN. No se presenta la instalacion inicial aprobada como validacion PnP.

## Checkpoint de compilacion preliminar

- Lint: `corepack yarn lint`, exit 0, evidencia/21-lint.txt (sin errores ni warnings).
- Instalacion del arbol integrado: `corepack yarn install --immutable`, exit 0, evidencia/22-install-integrated.txt. Peer warnings previos permanecen; sin upgrades.
- Produccion: `corepack yarn build --configuration=production`, exit 0, evidencia/23-build-production.txt. Angular informa initial 1.35 MB, inferior a maximumError 1.5 MB; supera aviso de 620 kB. Avisos CSS de 4 kB/CommonJS/imports no usados no se ocultaron.
- `node scripts/check-bundle-budget.mjs`, exit 0, evidencia/24-bundle-budget.txt, contra dist recien generado. Limitacion del script existente: suma referencias directas del HTML (275.46 kB), menos que el grafo inicial de Angular (1.35 MB). El limite real tambien fue aplicado por Angular; no se usa 275.46 kB para afirmar el peso inicial completo.
- Fuente del build preliminar: evidencia/23-source-snapshot.json y diff guardado. Se volvera a vincular el artefacto final a commit tras reparaciones de runtime si las hubiera.

## Checkpoint SSR

- Segundo merge registrado: `78982619`, con los tres SHA de entrada como ancestros. Incorporado dev posterior `1b1bcaaf` mediante `8b83ada3` (cache lint).
- Reparaciones posteriores registradas en `da161f8b1ee03cc97c2646d6db581e7559522b98`.
- `corepack yarn build --configuration=production-api`: exit 0, initial 1.35 MB, evidencia/26-build-production-api.txt.
- Artefacto del commit da161f8b ejecutado con Node, PORT=4102. `/auth`: status 200, `ng-server-context` presente, `login-identifier` renderizado, sin banner demo, Cache-Control no-cache y nosniff. `/chunk-hito2-missing.js`: 404. Resultado literal PASS en evidencia/27-production-api-runtime.json; servidor sin errores en 27-production-api-server.txt. Esto comprueba SSR de login; no certifica backend ni persistencia real.

La primera invocacion demo (28-build-demo.txt) fallo antes de compilar: PowerShell interpreto la coma sin comillas como separador y Angular recibio `production demo`. Repeticion con `corepack yarn build "--configuration=production,demo"` en 29-build-demo.txt, sin cambio de configuracion ni codigo.

Demo compilada: `corepack yarn build "--configuration=production,demo"`, exit 0, initial 1.35 MB, evidencia/29-build-demo.txt. Compilacion no implica validacion de los recorridos.

## Regresion completa inicial y reparaciones

Commit comprobado: 4247bb0a. `corepack yarn test:coverage` termino con exit 1: **45 archivos fallidos, 662 aprobados; 137 pruebas fallidas, 9366 aprobadas (9503)**. Salida literal: evidencia/31-coverage.txt. No se acredita cobertura aprobada con esta corrida.

Causas reproducidas y reparaciones escritas, pendientes de repetir:

- Configuraciones demo antes implicitas ahora deben declararse por fixture; escenarios reales conservan flags apagados.
- HTTP: ValidationPipe real usa 400/VALIDATION_FAILED/details.violations; precondicion de dominio usa 422/PRECONDITION_FAILED. Fuente API: src/common/errors/domain.exception.ts:106-124 y src/common/filters/all-exceptions.filter.ts:393-407. Los endpoints demo nuevos no se presentan como implementados por esta compatibilidad.
- Capas duplicadas del mapa y de seguros del perfil; helper de pruebas que hacia bind sobre signals y perdia set; foco buscando boton de acciones retirado por una rama.
- Navegacion conserva adjudicacion real del pagador y oculta la seccion ajena a farmacia/laboratorio; quita un duplicado exacto de subgroup.
- El barrido de escrituras simulado contaminaba sesiones/reclamos de otras suites; se aislaron modulos y almacenamiento sin cambiar expectativas de 14 reclamos/Bs12450.
- Calendario probaba un supuesto falso el ultimo dia del mes: ese dia aun aparece en la grilla del mes siguiente. Fixture ahora fija mitad de mes; limite de dias adyacentes productivo intacto.
- Notas reales serializadas en objectiveText: pruebas de los tres consumidores ahora exigen todo el texto/campos, conservando archivos y recarga; suite del cliente mantiene comparacion real/demo.
- Prueba PDF cargaba el doble global de otra suite; reinicia import para ejercitar jsPDF real y exigir cabecera PDF.
- Coste del reconocimiento: memoizacion dentro de cada analisis reduce trabajo repetido, sin retener texto entre consultas; limite 16 ms y corpus intactos. Ver evidencia/35-motor-profile.md cuando se registre.

## Gates y bloqueos encontrados

- 32-check-architecture: cuatro ciclos, un import contra capas y tres detectores de fetch. Tipos/lectores reubicados sin excluir reglas; gate posterior del agente exit 0, pendiente captura final root.
- Seis formularios paginados mediante el componente existente; modo embebido impide anidar form en campos compuestos. Gate posterior del agente exit 0; pruebas nuevas padre/hijo aun pendientes.
- 33-check-css-tokens: exit 0 tras usar tokens existentes y reservas para variables de animacion enlazadas por plantilla.
- 34-check-client-prefixes, check-api-prefixes, check-route-prefixes y check-api-contract-drift: exit 0. Agregados seis prefijos especificos y documentadas 605 operaciones unicas; no implica que backend implemente las demo.
- Gate de ingles: el primer exit 0 NO es aprobacion. Git superaba maxBuffer y el script omitio el analisis; reproduccion ENOBUFS con 1077248 bytes. Lector ampliado y error ahora bloqueante. 33-check-english-identifiers registra 1548 hallazgos heredados frente a dev. Migracion extensa consultada al usuario; mientras no se acuerde esa ampliacion, bloqueo explicito, sin renombres masivos ni bajar el gate.
- Documentacion: evidencia historica con 14 enlaces rotos y regla que prohibe TODO incluso en planes que deben usar ese estado. MATRIZ.md distingue artefactos disponibles fuera de Git, enlaces dependientes del workspace y plan de farmacia no localizado. No se reescribe evidencia pasada para presentar verde.

## Disponibilidad real actual

Revision de solo lectura: no hay API en puertos3000/3001; Postgres18 nativo escucha5432, sin base SALUD/configuracion local identificada. Docker no responde (pipe LinuxEngine ausente); Redis/MongoDB/OpenSearch no escuchan. El .env API apunta fuera de loopback, y SEED_ON_BOOT ausente equivale a true. No se arranco esa configuracion ni se aplico DDL/semillas. Artefacto backend local27/09 anterior a H1 no demuestra codigo30/09. Falta runtime local aislado con conexiones correctas, esquema/catalogos y artefacto H1 actualizado. La prueba HTTP futura usa doble declarado de transporte y no elimina este bloqueo de persistencia real.

## Aislamiento de regresion posterior

- `56-coverage-after-clinical-fix.txt`: `EXIT_CODE=1`; 9505/9507 pruebas pasaron. Fallaron un refresh token heredado (`r-2` en vez de `r-1`) y la seed de reconsulta tras mutaciones/fechas de otras suites.
- `57-auth-scheduling-directed.txt`: `EXIT_CODE=1`; la prueba nueva de renovar una reconsulta al vencer no tenia un segundo origen completado elegible. `58-reconsulta-diagnostic.txt` y `59-reconsulta-origin-diagnostic.txt` acotaron la causa: 103 cupos de la medica libres, pero un solo origen completado para esa paciente, ya usado. Se retiro ese cambio de producto; no se fabrica una segunda reconsulta desde un origen sin completar.
- `60-auth-agenda-directed.txt`: `EXIT_CODE=0`, 44/44 pruebas. `61-coverage-after-storage-isolation.txt`: `EXIT_CODE=1`, 9506/9507; otra suite habia alterado el estado del origen usado por la seed. La prueba de la seed ahora importa un fixture fresco tras aislar `mock.agenda.reservas`, y restaura el almacenamiento anterior al terminar. `agenda-ids-estables.spec.ts` limpia su clave al entrar y salir. `62-auth-agenda-fresh-seed-directed.txt`: `EXIT_CODE=0`, 44/44.
- `63-coverage-fresh-seed.txt`: 708/708 archivos y 9507/9507 pruebas pasaron, pero `EXIT_CODE=1`: core branches 76,11 % frente al umbral 80 %. El detalle generado mide 9842/12930 ramas core cubiertas; faltan al menos 502. El umbral permanece intacto. H2.S3.M8 y H2.S3.M15 siguen A MEDIAS.

## Checkpoint final de la correccion de la prueba 75

### Completado

| ID | Resultado | Comando y salida |
|---|---|---|
| H2.S3.M17-M18 | Scanner HTTP corregido; dictamen y EOB demo con validacion de entradas. | `node scripts/check-mock-vs-client.mjs`: exit 0; `68-insurance-adjudication-directed.txt`: 86/86. |
| H2.S3.M19-M21 | Encabezado movil sin desborde, aviso demo fuera de los controles y panel de campana dentro del viewport. Glosario parte consultas largas; selectores E2E apuntan a controles nativos. | `84-playwright-demo-matrix-final.txt`: 9/9, `EXIT_CODE=0`, Chromium serial sin reintentos. Capturas sinteticas a 390 y 1440 px. |
| H2.S3.M22 | Refacturacion demo toma el maximo numero persistido, incluidos historicos, tras recarga. | `83-insurer-received-claims-unit.txt`: 12/12, `EXIT_CODE=0`; `82-playwright-insurance-after-number-fix.txt`: 2/2, `EXIT_CODE=0`. |
| H2.S3.M1-M6 | Tipos, lint y builds optimizados finales, con artefacto SSR ejercitado. | `85-typecheck-final.txt`, `86-lint-final.txt`, `87-build-production-final.txt`, `88-bundle-budget-final.txt`, `89-build-production-api-final.txt`, `91-build-demo-final.txt`: todos `EXIT_CODE=0`; `90-production-api-runtime-final.json`: `/auth` 200, SSR y login presentes, banner demo ausente, recurso inexistente 404. |

### A medias y pendiente

| ID | Que anda | Que no anda | Que falta exactamente | Donde quedo |
|---|---|---|---|---|
| H2.S3.M8/M13-M15 | La corrida completa anterior aprobo 9507/9507 pruebas y se aislaron los estados mutables de auth/agenda. | Cobertura core branches 76,11 % menor al 80 %; `test:coverage` termina en 1. | Cubrir al menos 502 ramas core adicionales con pruebas funcionales y repetir cobertura despues de los cambios actuales. | `63-coverage-fresh-seed.txt`, `coverage/mantra-core-health/coverage-summary.json`, PLAN M15. |
| H2.S3.M10 | Demo y transporte HTTP con doble declarado fueron ejercitados en navegador. | No se comprobo persistencia ni contratos faltantes contra el backend H1 real. | Levantar H1 con DDL/catalogos y repetir matriz API real. | MATRIZ.md y `73-playwright-real-http-after-insurance.txt`. |
| H2.S4.M3-M4 | Rama y evidencia preparadas para publicar. | Estado remoto del PR aun sin registrar en este checkpoint. | Push, PR a dev, reviewers, checks y mergeabilidad. | Rama `marcelo/feat-sincronizacion-mockup-dev-test`. |

### Evidencia literal recortada

```text
84-playwright-demo-matrix-final.txt: 9 passed (3.0m); EXIT_CODE=0
83-insurer-received-claims-unit.txt: Test Files 1 passed (1); Tests 12 passed (12); EXIT_CODE=0
87-build-production-final.txt: Initial total 1.35 MB; EXIT_CODE=0
89-build-production-api-final.txt: Initial total 1.35 MB; EXIT_CODE=0
91-build-demo-final.txt: EXIT_CODE=0
63-coverage-fresh-seed.txt: 9507/9507 pruebas pasan; core branches 76,11 % < 80 %; EXIT_CODE=1
```

### No cubierto y riesgos residuales

- La evidencia 84 corresponde a demo con datos sinteticos; no acredita API ni persistencia real.
- El build de produccion supera el umbral de aviso de 620 kB y permanece bajo el maximo de 1,5 MB; no se rebajo ningun presupuesto.
- Los gates historicos de enlaces, cobertura documental e identificadores en ingles siguen en rojo conforme a `67-gate-*.txt`; no se alteraron reglas ni evidencia pasada para presentarlos como aprobados.
- `90-production-api-runtime-final.json` comprueba SSR de login y 404, no contratos de negocio ni backend H1.

### Regresion del arbol posterior y proxima reparacion

`92-coverage-final-current.txt`: `EXIT_CODE=1`, 703/709 archivos y 9500/9511 pruebas aprobaron; fallaron 11 pruebas en seis archivos. No se obtuvo un resumen de cobertura final en esta corrida porque Vitest detuvo la certificacion al fallar pruebas. Dos causas de fecha fueron reparadas y `93-dates-directed.txt` registra 22/22, `EXIT_CODE=0`: los gastos de hoy no incluyen horas futuras y la prueba de seis ventanas contables usa una fecha en la que esas ventanas no coinciden. La regresion global sigue pendiente. `94-timeouts-directed-serial.txt` documenta que `ng test` rechaza `--maxWorkers`; no se uso como prueba. `95-timeouts-directed.txt` reproduce nueve timeouts en cuatro archivos incluso en corrida dirigida. H2.S3.M25 registra su investigacion y reparacion pendiente. Ningun timeout se amplio y ninguna asercion se retiro.
