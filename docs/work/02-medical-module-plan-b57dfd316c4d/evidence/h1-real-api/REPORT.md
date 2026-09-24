# Evidencia H1: alta médica, credenciales y especialidades contra API real

Fecha: 2026-09-24. Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.

## Último recorrido compuesto

El recorrido pasó **1/1 en Chromium** sobre frontend `df611861172f25c94a36dcaf417253a093768506` (`justin/medical-module-execution-20260924`) y API `783d26976e8ca0eb16d0bbf2f514a636ab9e7461` de la misma rama. Angular usó `real-api` (`mockBackend=false`) en `127.0.0.1:4390`, Node API en `127.0.0.1:3000` y PostgreSQL 18 en el puerto aislado `55444`, base `mch_medical_plan`. Datos en `/tmp/mch-medical-plan-b57dfd316c4d-editor-pgdata`; archivos en `/tmp/mch-medical-plan-b57dfd316c4d-editor-files`. Se usó proxy de mismo origen; `.env`, `proxy.conf.json`, CORS, modelo y DDL no se tocaron. Los servicios observados en otros puertos quedaron intactos.

Comando ejecutado en `wt-medical-execution-fe`:

```sh
E2E_BASE_URL=http://127.0.0.1:4390 DOTENV_CONFIG_PATH=/dev/null corepack yarn pw playwright/medical-credential-editor-real-api.temp.spec.ts --workers=1 --reporter=list
```

El script Playwright archivado para reproducir está en [`extended-smoke/editor/medical-credential-editor-real-api.spec.ts`](extended-smoke/editor/medical-credential-editor-real-api.spec.ts), SHA-256 `b5c22bd6737a5ee96e2de75616e97aaebb994d9fef8117f65d923bf206e21c91`. Desde el worktree FE, copiarlo a `playwright/medical-credential-editor-real-api.temp.spec.ts` y ejecutar el comando anterior. No quedó como test permanente del producto.

Una profesional sintética registró desde navegador ocho documentos (dos por tipo `DEGREE`, `DIPLOMA`, `MASTER` y `DOCTORATE`) y eligió tres especialidades distintas. En el editor del perfil agregó además un grado profesional con institución/PDF y dos credenciales `SPECIALTY`, cada una con institución y PDF. El resumen autenticado devolvió las 11 filas; PostgreSQL verifica **11 credenciales y 11 `file_id` únicos**: `DEGREE` 3/3, `DIPLOMA` 2/2, `MASTER` 2/2, `DOCTORATE` 2/2 y `SPECIALTY` 2/2. Hay tres especialidades activas. La consulta de catálogo mapea explícitamente `SPECIALTY` al concepto `profiles:CREDENTIAL_TYPE_SPECIALTY`.

Desde la UI se abrió el diálogo de edición de una credencial `DEGREE`, se cambió número e institución y el `PATCH /profiles/practitioners/me/credentials/:id` respondió 204. Tras recargar, el resumen respondió 200 y la misma fila conservó `credentialTypeConceptId` y el mismo `fileId`, con el número e institución nuevos. Los once registros y los once PDFs distintos permanecen, junto con las tres especialidades. El titular descargó los tres PDFs agregados desde el perfil: respuesta 200, `application/pdf` y bytes iniciales `%PDF-1.4`.

Se registró e inició sesión con una segunda cuenta de profesional sintética. Su resumen propio contiene cero credenciales y un PATCH autenticado al UUID de la primera persona responde 404. Al revisar después la cuenta dueña, el número editado y su `fileId` siguen intactos. El endpoint de descarga ajena continúa además cubierto por integración API separada (403); no se mezcló ninguna cuenta ni flujo de Paciente.

Consulta SQL de cierre (perfil sintético `204950df-61b1-4173-a345-7a9bd1096fbb`): `profiles.professional_credentials` tiene 11 filas/11 archivos distintos; `profiles.practitioner_specialties` tiene 3 filas. Por tipo: `CREDENTIAL_TYPE_DEGREE` 3/3, `CREDENTIAL_TYPE_DIPLOMA` 2/2, `CREDENTIAL_TYPE_MASTER` 2/2, `CREDENTIAL_TYPE_DOCTORATE` 2/2, `CREDENTIAL_TYPE_SPECIALTY` 2/2. La fila editada `d98c0d63-c3cd-494e-87e4-bedd4ec9667e` conserva el tipo de grado, número `UNI-1-FI4UM4KND-EDIT`, institución `Institución corregida por la profesional FI4UM4KND` y `file_id` `07fff124-1a10-4811-ab57-2b66bcda5094`. Los valores y PDFs son sintéticos.

Capturas de 390 × 844, inspeccionadas visualmente: [alta con carreras y posgrados](extended-smoke/editor/medical-credentials-before-editor-mobile.png), [selección de especialidades](extended-smoke/editor/medical-specialties-before-editor-mobile.png), [11 registros documentales en Trayectoria](extended-smoke/editor/medical-specialty-credentials-profile-mobile.png), [diálogo de edición](extended-smoke/editor/medical-credential-editor-mobile.png) y [valor tras recarga](extended-smoke/editor/medical-credential-editor-persisted-mobile.png).

## Evidencia previa y estado restante

Una corrida real anterior verificó descarga de los ocho PDFs iniciales por el titular y una ficha cuyo DTO no expone `fileId`. La integración API/PostgreSQL `practitioner-credential-registration-files.int-spec.ts` es cobertura separada: verifica diez credenciales (dos por cada tipo, incluido `SPECIALTY`), resumen propio, ocultamiento de `fileId`, descarga permitida al dueño (200), descarga ajena (403) y reuso rechazado (422).

Diez criterios individuales se actualizan a `HECHO / VERIFIED`: `RP-MED-L0187`, `RP-MED-L0188` y `RP-MED-L0190`–`RP-MED-L0197`. `MED-E01` sigue `A MEDIAS`: falta verificar tras la recarga los tres nombres de pila de L0168 y, para L0174.AC02, que el catálogo completo siga disponible sin filtrar por profesión. Este smoke anterior no verificó ese comportamiento; la implementación se alineó posteriormente con la fuente en la continuación L0174. También falta el cierre de H1 y escenarios H2–H8. El conteo queda **10/98 HECHO, 60 A MEDIAS, 11 TODO, 17 BLOQUEADOS y 2 DESCARTADOS**. Este smoke no se presenta como cierre total del plan.
