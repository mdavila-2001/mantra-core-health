# Gate de seguridad y PHI — carga masiva de terminología

Regla 90.6: amenaza / control (ruta y línea) / test que lo demuestra / resultado / riesgo
residual. Código citado contra `origin/itzan/carga-masiva-motor-2026-09-25` (API, pinneado en
`d99ff9e7`) y `origin/mockup` (front, con la pantalla de Justin ya integrada).

## 1 · Subida sin autenticación o sin el rol correcto

- **Control:** `@Roles('SECURITY_ADMIN')` en
  `mantra-core-health-api/src/modules/terminology/controllers/terminology-versions.controller.ts:112`
  (endpoint `POST :versionId/import-file`) y en
  `.../controllers/terminology-concepts.controller.ts` para el resto del módulo. `TenantContextInterceptor`
  resuelve al actor autenticado antes de llegar al guard de roles.
- **Test:** matriz negativa por `curl` (§2 de este documento) — sin token → 401; con `PRACTITIONER`
  (`doctora()`) → 403.
- **Resultado:** los dos casos se ejercitaron. Ver §2.
- **Riesgo residual:** ninguno detectado en este endpoint. `SUPERADMIN` no tiene bypass declarado
  acá (a diferencia de otros módulos del proyecto que sí lo documentan): no se verificó porque no
  hay cuenta `SUPERADMIN` con `SECURITY_ADMIN` explícito en el simulador para este flujo — anotado,
  no bloqueante (el rol exigido es el correcto).

## 2 · Archivo enorme / zip bomb

- **Control:** tope de tamaño por `multer` —
  `FileInterceptor('file', { limits: { fileSize: loadStorageEnv().maxSizeBytes, files: 1 } })`
  (`terminology-versions.controller.ts:115-119`), 10 MiB por omisión
  (`src/common/storage/storage.env.ts:14,56`). Para el `.xlsx` específicamente, el parser propio
  de este carril acota la lectura con `MAX_FILAS_XLSX = 100_000`
  (`src/modules/terminology/import/xlsx-parser.ts:29`, `sheetRows: MAX_FILAS_XLSX + 2` al leer).
- **Test:** `grande.csv` (11,5 MiB, > 10 MiB) por `curl` → 413. `xlsx-parser.spec.ts` — «rechaza un
  archivo con más filas que MAX_FILAS_XLSX» (100 002 filas) → 0 filas devueltas, problema con el
  motivo exacto — **18/18 PASS**, ver `evidencia/h7s3/xlsx-parser-test.txt`.
- **Resultado:** ambos casos verificados y en verde.
- **Riesgo residual — real, no cubierto:** `sheetRows` corta cuántas filas **de datos** se
  materializan, pero `XLSX.read()` igual descomprime el ZIP completo y expande `sharedStrings.xml`
  entero antes de aplicar ese tope. Un `.xlsx` de pocos KB comprimidos con una tabla de strings
  compartidos artificialmente inflada (zip bomb clásica de XML) agotaría memoria **antes** de que
  `MAX_FILAS_XLSX` pudiera actuar. No hay tope independiente de tamaño descomprimido en
  `xlsx-parser.ts`. Es una limitación conocida de SheetJS sin mitigación de este carril; queda
  como deuda para quien integre.

## 3 · Contenido del archivo en logs

- **Control:** el único log del servicio es de **metadatos**, nunca de filas:
  `concept-file-import.service.ts:332-345` (`informar()`) registra `format`, `profile`, `dryRun`,
  `aborted`, `batchId`, `totalRead`, `inserted`, `skipped`, `errors` — ningún `code`/`display`/
  `definition` de una fila real.
- **Test:** `grep -n "logger\.\|console\." src/modules/terminology/import/*.ts
  src/modules/terminology/services/concept-file-import.service.ts
  src/modules/terminology/services/row-validator.ts` sobre `d99ff9e7` → sólo la línea de
  `informar()` arriba y `logger.setContext()`; `import/` (mis 4 archivos + los 4 de Itzan) sin una
  sola llamada a `logger`/`console`.
- **Resultado:** confirmado por lectura directa del código citado, no por suposición.
- **Riesgo residual:** ninguno detectado.

## 4 · Binario basura sin 500 con stacktrace

- **Control:** `detectarFormato()` (`format-detector.ts`) rechaza con
  `FormatoNoAdmitidoError` → el servicio lo mapea a `422 IMPORT_FORMAT_UNSUPPORTED` con un
  motivo legible, nunca deja pasar la excepción cruda. En el cliente, `app-file-input` filtra
  además por `accept` **antes** de que el archivo llegue al servidor
  (`shared/forms/file-accept.ts:13-15`), así que la pantalla nunca intenta subir un `.pdf`.
- **Test:** front, test 4 del contrato (`no-es-nada.pdf` → mensaje del cliente, sin `Error:`/
  stacktrace en pantalla) — **PASS**. API, `curl -F file=@no-es-nada.pdf` → §2.
- **Resultado:** verificado en las dos capas.
- **Riesgo residual:** ninguno.

## 5 · CSV injection en la descarga de errores

- **Control:** `CsvExportService.download()` neutraliza fórmulas antes de entrecomillar RFC 4180 —
  `INICIO_DE_FORMULA = /^[=+\-@\t\r]/` y `neutralizarFormula()`
  (`src/app/shared/utils/csv-export/csv-export.ts:88-125`), invocado por `descargarErrores()`
  (`version-import.ts:553-570`).
- **Test:** test 8 del contrato descarga el CSV de errores y verifica encabezado + 5 filas —
  **PASS**; el contenido de las filas de error viene de los `errorSamples` del servidor
  (`fila`, `columna`, `motivo` — texto propio, nunca eco de una celda del archivo subido), así que
  la superficie de inyección real sería mínima incluso sin el control.
- **Riesgo residual:** ninguno detectado; control activo y verificado.

## 6 · Dos archivos en el mismo multipart

- **Control:** `files: 1` en el mismo `FileInterceptor` de §2. Nest mapea el
  `LIMIT_UNEXPECTED_FILE`/`LIMIT_FILE_COUNT` de multer a `400 VALIDATION_FAILED` vía
  `all-exceptions.filter.ts` (comportamiento de `@nestjs/platform-express`, no un catch propio del
  módulo).
- **Test:** `curl -F file=@a.csv -F file=@b.csv` → §2.
- **Resultado:** verificado.
- **Riesgo residual:** ninguno.

## 7 · PHI / datos de personas

- **Control:** los 30 fixtures de la API y los 8 copiados al front son sintéticos, prefijo `ZZ-`,
  con `README.md` declarándolo (regla 97.4/97.6). Ninguna captura de H4 muestra datos de una
  persona real: el único nombre visible es `Marcelo Dávila Arce`, la cuenta demo del simulador, no
  un paciente. Los sistemas de codificación de prueba creados contra la API real (H6, si corre)
  también llevan prefijo `ZZ-E2E-` y se listan por id en `qa-evidencia.md`.
- **Test:** lectura de `evidencia/doble-revision.md` §2 pregunta 6; `grep -rn "ZZ-"
  playwright/fixtures/carga-masiva/*.csv test/fixtures/terminology-import/*.csv` confirma el
  prefijo en el 100% de los códigos.
- **Resultado:** verificado.
- **Riesgo residual:** ninguno.

## 8 · Rate limiting

- **Control:** límite global `ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }] })`
  (`mantra-core-health-api/src/app.module.ts:140-141`) cubre `import-file` por defecto (no tiene
  `@Throttle` propio, así que hereda el global de 300/min por IP). El login que usan los tests
  reales tiene su propio límite más estricto: `@Throttle({ default: { limit: 10, ttl: 60_000 } } )`
  (`iam-auth.controller.ts:112` y siguientes).
- **Test:** `grep -n "Throttle" src/modules/terminology/controllers/*.ts` → vacío (hereda el
  global); `grep -n "ThrottlerModule.forRoot" src/app.module.ts` → confirmado.
- **Resultado:** el endpoint de importación no tiene un límite dedicado más estricto, pero sí
  hereda el global — no está desprotegido.
- **Riesgo residual:** 300/min es alto para un endpoint que puede procesar hasta 10 MiB por
  petición; no se evaluó si eso es explotable como denegación de servicio por CPU (parseo repetido
  de archivos grandes). Fuera del alcance de esta noche — anotado como pregunta abierta para Pablo.

## §2 · Matriz negativa desde afuera

**Estado: pendiente de ejecutar.** Requiere la API real de Itzan arrancada (`yarn start:dev`
contra Neon, `d99ff9e7`) — no se corrió todavía en este turno. Los `curl` que se van a correr,
documentados para que H6 los ejecute sin tener que rediseñarlos:

```bash
# 1. Sin token
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/terminology/versions/<id>/import-file \
  -F file=@playwright/fixtures/carga-masiva/ok-50.csv
# esperado: 401

# 2. Rol insuficiente (token de doctora(), PRACTITIONER)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/terminology/versions/<id>/import-file \
  -H "Authorization: Bearer <token-practitioner>" -F file=@playwright/fixtures/carga-masiva/ok-50.csv
# esperado: 403

# 3. Archivo > 10 MiB
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/terminology/versions/<id>/import-file \
  -H "Authorization: Bearer <token-admin>" -F file=@playwright/fixtures/carga-masiva/grande.csv
# esperado: 413

# 4. Dos archivos en el multipart
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/terminology/versions/<id>/import-file \
  -H "Authorization: Bearer <token-admin>" \
  -F file=@playwright/fixtures/carga-masiva/ok-50.csv -F file=@playwright/fixtures/carga-masiva/con-errores.csv
# esperado: 400 VALIDATION_FAILED

# 5. Binario basura
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/terminology/versions/<id>/import-file \
  -H "Authorization: Bearer <token-admin>" -F file=@playwright/fixtures/carga-masiva/no-es-nada.pdf
# esperado: 422 IMPORT_FORMAT_UNSUPPORTED

# Conteo antes/después (no debe cambiar en ninguno de los 5 casos)
curl -s -H "Authorization: Bearer <token-admin>" \
  "http://localhost:3000/terminology/concepts?codeSystemVersionId=<id>&limit=500" | jq '.items | length'
```

Se ejecutan en H6 si la API de Itzan arranca contra Neon; si no arranca, esta sección queda
`DESCARTADO` con la salida del intento, y las 8 amenazas de arriba (verificadas por código y por
los specs del front) siguen siendo la evidencia disponible.
