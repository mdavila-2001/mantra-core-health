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

Ningun flujo de navegador ni persistencia en API real ha sido certificado todavia en esta integracion. H1 PR #520 sigue siendo la fuente de codigo; su DDL/runtime no cuentan con evidencia completada. Ver MATRIZ.md por endpoint.

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
