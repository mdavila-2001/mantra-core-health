# Plan — Carga masiva: pantalla, cliente y doble del simulador

- Fecha: 2026-09-25 · Repo afectado: `mantra-core-health` (front) · Predecesor: ninguno
- Worktree: `wt-justin-carga-masiva` · Rama: `justin/carga-masiva-pantalla-2026-09-25`
- Base: `origin/mockup` @ **`bf2c35452363ede1d367f94c4fd726b2b9a63cb1`**
- Contrato: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/CONTRATO-CARGA-MASIVA.md` (§2 HTTP, §3 `data-testid`, §4 fixtures, §5 supuestos)
- Resultado observable: en `/administration/terminology/import`, con la cuenta `SECURITY_ADMIN` del
  simulador, la persona elige **qué** carga (perfil + sistema + versión), se baja la plantilla,
  arrastra un CSV/XLSX, **valida sin guardar**, ve informe + vista previa + errores, e **importa**
  sólo si la validación dio 0 errores; ve el resumen, se baja los errores en CSV y puede cargar otro
  archivo sin re-elegir el paso 1. Ante cualquier fallo no pierde nada de lo que había elegido.
- Kill-test: arrastrar `ok-50.csv` → «Validar sin guardar» → `carga-informe` dice 50 leídas / 0
  errores y `carga-importar` se habilita → «Importar» → `carga-resumen` dice 50 insertadas.
  Con `con-errores.xlsx`: `carga-errores` muestra 5 filas con columna y `carga-importar` sigue
  deshabilitado.

## Alcance

**IN** — exactamente los archivos reservados en §0 del contrato:
- `src/app/core/mock/handlers/terminology.handlers.ts` (**sólo** `import-file` e `import-template`)
- `src/app/core/data-access/terminology/terminology.client.ts` y `terminology.types.ts` (**sólo** la sección de import)
- `src/app/core/data-access/terminology/terminology.client.spec.ts` (se **ensancha**, sección import)
- `src/app/features/admin/terminology/version-import/**`
- `src/app/core/mock/handlers/terminology.handlers.spec.ts` (nuevo, del doble)
- `docs/trabajo/2026-09-25-justin-pantalla/**`

**OUT** — no se tocan, aunque haga falta algo de ellos:
`shared/components/molecules/file-input/**` · `app.routes.ts` · `core/navigation/**` ·
`features/alovida/terminologia/**` · `playwright/**` · `scripts/capturas-*` · el resto del cliente
de terminología · `core/http/api-error.ts` (ver ambigüedad Q-J4) · la API · cualquier dependencia nueva.

## Hallazgos del descubrimiento (hechos, con ruta)

| # | Hecho | Dónde |
|---|---|---|
| F-1 | La ruta es `administration/terminology/import`, `canActivate: [seccionRolesGuard]` | `src/app/app.routes.ts:763-771` |
| F-2 | Cuenta admin del simulador: `admin@alovida.mock` (clave `admin`), rol `SECURITY_ADMIN` | `src/app/core/mock/mock-session.ts:110-134` |
| F-3 | El manejador del doble hoy es una respuesta fija, sin leer el `FormData` | `terminology.handlers.ts:244-254` |
| F-4 | Precedente de leer `FormData` en el simulador: `form.get('file') instanceof File`, con `typeof FormData !== 'undefined'` como guarda de SSR | `files.handlers.ts:161-170`, `auth.handlers.ts:286-320` |
| F-5 | `MockReply` admite `{ status, body, headers }`; `emitir()` lanza `HttpErrorResponse` sólo con `status >= 400` | `mock-backend.interceptor.ts:130-153`, `mock-router.ts:29-33` |
| F-6 | **Un manejador NO puede emitir un fallo de red (status 0)**: `emitirFallo` es la única vía y la dispara `sessionStorage['mock:fallos']`, no el manejador | `mock-backend.interceptor.ts:110-128`, `fallos-simulados.ts` |
| F-7 | `responseType: 'blob'` funciona contra el doble: `adaptarCuerpo` envuelve un string en `Blob` | `mock-backend.interceptor.ts:196-211` |
| F-8 | `readApiError` **descarta** todo cuerpo cuyo `code` no esté en `API_ERROR_CODES`; los `IMPORT_*` no están | `core/http/api-error.ts:10-30,54-77` |
| F-9 | `CsvExportService` ya existe y ya neutraliza fórmulas (`^[=+\-@\t\r]` → `'`), escapa RFC 4180 y pone BOM | `shared/utils/csv-export/csv-export.ts` |
| F-10 | Precedente de descarga de Blob: `responseType:'blob', observe:'response'` + `nombreDeContentDisposition` + `blobToDataUrl` + `FileDownloader.trigger` | `insurance-portability.client.ts:62-100`, `portability-export-dialog.ts:146-172`, `files/file-downloader.ts` |
| F-11 | `app-file-input` inputs reales: `files` (model), `testId`, `removeTestId`, `label`, `accessibleLabel`, `hasError`, `required`, `multiple`, `disabled`, `accept`, `maxSizeBytes`, `maxFiles`, `showList`, `showFeedback`; output `rejected` | `file-input.ts:46-81` |
| F-12 | `app-data-table` exige `state: ViewState<readonly Row[]>`, `columns: ColumnDef<Row>[]`, `trackBy` | `data-table.ts:96-100` |
| F-13 | `empty()` del M34 exige `nextAction` obligatorio | `core/view-state/view-state.ts:39` |
| F-14 | `ConceptImportResult` actual: `batchId: string` (no nullable), `totalRead`, `inserted`, `skipped`, `errors`, `errorSamples: ImportFileIssue[]` | `terminology.types.ts:466-476` |

**Desconocidos / hipótesis:** la API real de Itzan no existe todavía (H6.S1 lo comprueba una vez).

## Baseline (H1.S1) — `evidencia/antes/`

| Comando | Exit | Nota |
|---|---|---|
| `corepack yarn typecheck` | **0** | Requiere `node scripts/generate-env.mjs` antes (el script `typecheck` no lo invoca; `test` sí). Sin eso: 4 × TS2307 por `env.generated`. Pre-existente, de entorno, no del código. |
| `corepack yarn lint` | **1** | **6 errores pre-existentes**, ninguno en archivos míos: 4 en `playwright/**` (de Marcelo) y 2 `no-empty-function` en specs de `insurance-contact-channels` y `patient-coverage-card`. Clase `TEST_BUG` ajeno, fuera de alcance: se anota, no se arregla (regla 00 §3.2). |
| `yarn test --include=**/version-import.spec.ts` | **0** | 1 archivo / **5 pruebas** en verde. |
| `yarn test --include=**/terminology.client.spec.ts` | **0** | 1 archivo / **26 pruebas** en verde. |

## Los nueve estados M34 en esta pantalla (H4.S2.M12)

| M34 | Dónde vive en la pantalla | Cómo se resuelve | Spec |
|---|---|---|---|
| S1 `route-auth-pending` | La ruta | `seccionRolesGuard` en `app.routes.ts` — **fuera de mi alcance**, ya resuelto por el router | — (no lo toco) |
| S2 `loading` | Sección 1, carga de sistemas | `estado()` arranca en `loading()`, lo pinta `app-view-state-host` | spec existente (arranque) |
| S3 `empty` | Sección 3, vista previa sin filas válidas | `app-data-table [state]="empty({label:'Elegí otro archivo'})"` | `vista previa vacía…` |
| S4 `validation` | Sección 3, 412 / 413 / 422 | `errorToViewState` → `validation`; `resultadoEstado` lo muestra en `app-alert tone="error"` | `413 …`, `422 IMPORT_FORMAT_UNSUPPORTED …` |
| S5 `forbidden` | Sección 3, 401 / 403 | `errorToViewState` → `forbidden`, mensaje sin acción (muro) | `403 …` |
| S6 `not-found` | Sección 1, sistema/versión que ya no existe | `errorToViewState` → `notFound()`; lo pinta el host | heredado del host |
| S7 `stale` | No aplica: no hay proyección materializada en esta pantalla | Declarado, no simulado | — |
| S8 `offline` | Sección 3, la petición no llegó | `errorToViewState` lee `status === 0` → `offline()` | `un fallo de red no borra …` |
| S9 `error` | Sección 3, 5xx o cuerpo fuera de contrato | `unexpectedError(requestId)`; el `requestId` se muestra | `un 500 muestra el requestId` |

## H1 — Corte, baseline y la pantalla de hoy

**CA:** Dado el checkout, cuando alguien pregunta cómo estaba antes, hay SHA, salidas con exit code y capturas.
**DoD:** `evidencia/antes/`.
**Estado:** A MEDIAS (S1 HECHO, S2 BLOQUEADO por falta de navegador)

### H1.S1 — Corte y baseline · **HECHO**

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.S1.M1 | Worktree limpio desde `origin/mockup` + rama | `git rev-parse HEAD` → `bf2c3545…` | HECHO |
| H1.S1.M2 | Dependencias instaladas | `node_modules` enlazado por el operador; **no se corre `yarn install`** (instrucción explícita de sesión) | HECHO |
| H1.S1.M3 | Baseline `lint` + `typecheck` | `evidencia/antes/lint.txt`, `typecheck.txt` | HECHO |
| H1.S1.M4 | Baseline spec dirigido | `evidencia/antes/spec.txt` (5 PASS), `spec-client.txt` (26 PASS) | HECHO |
| H1.S1.M5 | Clasificar cada rojo previo | Tabla «Baseline» de arriba | HECHO |

### H1.S2 — La pantalla de hoy · **BLOQUEADO** (sin navegador en esta corrida)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.S2.M1 | Ruta real + guard | `app.routes.ts:763-771` → F-1 | HECHO |
| H1.S2.M2 | Cuenta admin del simulador | `mock-session.ts:110` → F-2 (`admin@alovida.mock`, sintética) | HECHO |
| H1.S2.M3 | `yarn dev`, abrir, capturar 1280 y 375 | — | BLOQUEADO |
| H1.S2.M4 | Subir un NDJSON de 3 líneas por el flujo actual | — | BLOQUEADO |
| H1.S2.M5 | Consola y red | — | BLOQUEADO |

> **Causa del bloqueo (M3–M5):** la corrida prohíbe explícitamente levantar cualquier servidor
> (`yarn dev`/`start`/`build`/Playwright) porque hay **cuatro carriles en paralelo** en esta
> máquina (regla 70.1.4–70.1.6). No hay navegador disponible. **«Si se traba» ejecutado:** se
> sustituyó la observación en navegador por specs dirigidos que ejercitan el mismo contrato
> (`HttpTestingController` y el manejador del doble llamado en proceso). Lo que queda sin
> verificar está declarado en `REPORTE.md` §No cubierto.

## H2 — El doble del simulador en tres niveles

**CA:** Dado `terminology.handlers.ts`, cuando la pantalla llama `import-file` con un archivo cuyo
nombre contiene `ok` / `con-errores` / `grande` / `.pdf` / `vacio` / `error-red`, responde §2 en los
tres niveles; y `import-template` devuelve el CSV de dos líneas.
**DoD:** `terminology.handlers.spec.ts` en verde → **21/21 PASS** (`evidencia/h2/spec-doble.txt`);
`mock-backend.spec.ts` sigue en **31/31** (`evidencia/h2/mock-backend.txt`).
**Publicado:** commit `8926f5af`, push a `origin` el 2026-09-25 **04:00:55 -0400**.
**Estado:** HECHO

### H2.S1 — El manejador

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Leer 2 manejadores que leen `FormData` y cómo devuelven errores | Rutas en el plan | F-4, F-5, F-6 | HECHO |
| H2.S1.M2 | Nivel correcto `*ok*`: informe con `preview` de 20 filas `ZZ-`; `inserted` según `dryRun`; segunda real con el mismo nombre → `inserted:0, skipped:50` (memoria por `versionId`) | spec | `--include=**/terminology.handlers.spec.ts` | HECHO |
| H2.S1.M3 | Nivel límite: `*con-errores*` → `aborted:true, errors:5, inserted:0` con `line` 5/9/14/20/33 y su `column`; `*grande*` → 413 | spec ×2 | idem | HECHO |
| H2.S1.M4 | Nivel inválido: `*.pdf*` → 422 `IMPORT_FORMAT_UNSUPPORTED`; `*vacio*` → 422 `IMPORT_EMPTY_FILE`; sin archivo → 412; `*error-red*` → ver Q-J5 | spec ×4 | idem | HECHO |
| H2.S1.M5 | Sin rol admin → 403 | spec o `DESCARTADO` con evidencia | idem | HECHO |
| H2.S1.M6 | `GET /terminology/import-template?profile&format` → CSV de 2 líneas + `Content-Disposition`; `format` desconocido → 422 | spec | idem | HECHO |
| H2.S1.M7 | Commit + push del doble | `git log origin/<rama> -1` | HECHO |

## H3 — Cliente y tipos (sección import)

**CA:** `importarArchivo(versionId, file, { dryRun, profile })` y `descargarPlantilla(profile, format)`
coinciden con §2 y tipan con §2; nada existente cambia de nombre ni de tipo.
**DoD:** `terminology.client.spec.ts` ensanchado en verde → **37/37 PASS** (eran 26; +11 de import,
`evidencia/h3/spec-cliente.txt`) · `corepack yarn typecheck` exit **0** (`evidencia/h3/typecheck.txt`).
**Estado:** HECHO

> **Desvío declarado:** `ConceptImportResult.batchId` pasó de `string` a **`string | null`**. §2 del
> contrato declara `"batchId": "uuid | null"` y dice que es `null` en dry-run y en `aborted`, así que
> dejarlo `string` sería un tipo que miente. `grep -rn "batchId" src/app` confirma que **no hay ningún
> consumidor** fuera de mis archivos reservados y de los specs, así que el ensanche no rompe a nadie.
> El resto de los campos nuevos —`format`, `profile`, `dryRun`, `aborted`, `preview` y
> `ImportFileIssue.column`— van **opcionales**, como pedía la instrucción.

### H3.S1 — Tipos y métodos

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Leer cómo el cliente arma `FormData` y cómo el repo descarga un Blob | Rutas | F-10 | HECHO |
| H3.S1.M2 | Tipos: `ConceptImportResult` ensanchado (nuevos **opcionales**), `ImportFileIssue.column?`, `ImportPreviewRow`, `ImportProfile`, `ImportTemplateFormat` | `typecheck` 0 | `corepack yarn typecheck` | HECHO |
| H3.S1.M3 | `importarArchivo(versionId, file, opciones)` con `dryRun` y `profile` en el `FormData` | Compila | `typecheck` | HECHO |
| H3.S1.M4 | `descargarPlantilla(profile, format): Observable<BinaryDownload>` | Compila | `typecheck` | HECHO |
| H3.S1.M5 | Spec: el `FormData` lleva `file`, `dryRun='true'`, `profile='conceptos'`; URL de §2 | PASS | `--include=**/terminology.client.spec.ts` | HECHO |
| H3.S1.M6 | Spec: la plantilla pide `responseType:'blob'` con los query params y lee `Content-Disposition` | PASS | idem | HECHO |
| H3.S1.M7 | Spec: un 422 con `code` de import llega al consumidor con su código legible | PASS | idem | HECHO |

## H4 — La pantalla en tres pasos

**CA/DoD:** los del prompt §4 H4.
**DoD ejecutado:** `version-import.spec.ts` → **39/39 PASS** (baseline 5; +34 pruebas, ninguna
borrada ni debilitada — `evidencia/h4/spec-pantalla.txt`) · `typecheck` exit **0** · `lint` con los
**mismos 6 errores del baseline y 0 nuevos** (`evidencia/h4/typecheck-lint.txt`) · cero literales de
color y 3 de `px` justificados uno por uno (`evidencia/h4/tokens.txt`).
**Estado:** HECHO salvo M3 (`A MEDIAS`: recorrido escrito y derivado del DOM del spec, no observado
en navegador) y M7 (`BLOQUEADO`: sin navegador).

> **Desvío declarado — secciones en vez de pestañas.** `CLAUDE.md` §6 y
> `docs/components/composition-rules.md` §5 piden «UNA tarjeta **con pestañas**». Se cumple la
> tarjeta única, centrada, `inline-size: 100%`, `margin-inline: auto` y **sin tope propio de ancho**
> —que es lo que la regla vino a arreglar—, pero las tres partes van como **secciones en orden**, no
> como pestañas, porque esto es un flujo secuencial y no tres vistas equivalentes: la 3 no tiene nada
> que mostrar hasta que la 1 y la 2 están resueltas, y una pestaña que se puede abrir vacía invita a
> empezar por el final. Es además lo que pide el prompt (H4.S1.M2, literal: «tres secciones dentro de
> **una** tarjeta a lo ancho»). A confirmar con Pablo.

### H4.S1 — Paso 1 «Qué vas a cargar» y paso 2 «El archivo»

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H4.S1.M1 | Muestrear 2 pantallas de `features/admin/**` | `content-packs.css`, `version-import.css` — tarjeta `--bg-surface` + `--border-default` + `--r-md` + `--sp-4` | HECHO |
| H4.S1.M2 | Tres secciones dentro de **una** tarjeta a lo ancho | spec + CSS | HECHO |
| H4.S1.M3 | `carga-perfil` | spec | HECHO |
| H4.S1.M4 | `carga-sistema` y `carga-version`, alerta de «sin versiones» conservada | spec existente verde | HECHO |
| H4.S1.M5 | `carga-plantilla-csv` / `carga-plantilla-xlsx` | spec | HECHO |
| H4.S1.M6 | Texto de ayuda del paso 2 derivado del perfil | spec | HECHO |
| H4.S1.M7 | `app-file-input` con `accept` ensanchado, envuelto en `[data-testid=carga-archivo]` | spec | HECHO |
| H4.S1.M8 | Cambiar el archivo limpia informe, preview, errores y resumen | spec | HECHO |

### H4.S2 — Validar, importar, resumen, descargar, otro

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H4.S2.M1 | `carga-validar` → `dryRun:true`; sin doble envío | spec | HECHO |
| H4.S2.M2 | «validando» como parcial M34 | spec | HECHO |
| H4.S2.M3 | `carga-informe` + alerta de `aborted` | spec | HECHO |
| H4.S2.M4 | `carga-preview` con `app-data-table` y vacío que orienta | spec | HECHO |
| H4.S2.M5 | `carga-errores` (`fila`,`columna`,`motivo`), «primeros 20 de M», oculta si 0 | spec ×2 | HECHO |
| H4.S2.M6 | `carga-importar`: `computed(informe.errors===0 && !cargando)`; «Importar N conceptos»; sin `dryRun`; sin doble envío | spec ×3 | HECHO |
| H4.S2.M7 | `carga-resumen` con `batchId` y explicación de «omitidas» | spec | HECHO |
| H4.S2.M8 | `carga-descargar-errores`: CSV en cliente vía `CsvExportService` (F-9), `=1+1` → `'=1+1` | spec | HECHO |
| H4.S2.M9 | Datos preservados ante fallo (red, 413, 422, 5xx) | spec ×2 | HECHO |
| H4.S2.M10 | `carga-otro` | spec | HECHO |
| H4.S2.M11 | Mapeo de errores por código | spec por código | HECHO |
| H4.S2.M12 | Tabla de los nueve estados M34 | la tabla de arriba | HECHO |

### H4.S3 — Accesibilidad, microcopy, tokens

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H4.S3.M1 | Nombres accesibles + `aria-live` en el informe | spec | HECHO |
| H4.S3.M2 | Foco al informe tras validar y al resumen tras importar | spec | HECHO |
| H4.S3.M3 | Recorrido de teclado escrito | `evidencia/h4/teclado.md` | A MEDIAS |
| H4.S3.M4 | Microcopy revisada (lista abajo) | este plan | HECHO |
| H4.S3.M5 | Sólo tokens en el CSS | `grep -nE "#[0-9a-fA-F]{3,6}\|[0-9]+px"` vacío | HECHO |
| H4.S3.M6 | `lint` + `typecheck` + spec dirigido | `evidencia/h4/` | HECHO |
| H4.S3.M7 | Recorrer la ruta contra `yarn dev` | — | BLOQUEADO (sin navegador, regla 70) |

## H5 — Prueba visual y regresión

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H5.S1.M1 | 24 capturas (3×2×4) | — | BLOQUEADO (sin navegador) |
| H5.S1.M2 | Una línea por captura | — | BLOQUEADO |
| H5.S1.M3 | Sin scroll horizontal a 375 | — | A MEDIAS (verificado por lectura del CSS mobile-first, no observado) |
| H5.S1.M4 | Contraste en oscuro | — | BLOQUEADO |
| H5.S1.M5 | `yarn test` completo | — | DESCARTADO: la corrida prohíbe la suite entera; la corre el operador, centralizada |
| H5.S1.M6 | Diff no toca archivos de otros | `git diff origin/mockup --stat \| grep -E "file-input\|app.routes\|navigation\|playwright\|alovida/terminologia"` vacío | HECHO |

## H6 — API real, PR y cierre

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H6.S1.M1 | ¿Está la rama de Itzan? | salida de `git log` | HECHO |
| H6.S1.M2 | Levantar la API | — | DESCARTADO |
| H6.S1.M3 | Kill-test contra la API real | — | DESCARTADO |
| H6.S1.M4 | Diferencias doble ↔ API real | `REPORTE.md` §Contra el doble | HECHO |
| H6.S2.M1 | Rebase sobre `origin/mockup` | `git status` | HECHO |
| H6.S2.M2 | PR contra `mockup` | URL | HECHO |
| H6.S2.M3 | `gh pr view` → `MERGEABLE` | `evidencia/pr/view.json` | HECHO |
| H6.S2.M4 | `gh pr checks` | `evidencia/pr/checks.txt` | A MEDIAS |
| H6.S2.M5 | Procesos corriendo cerrados o declarados | lista | HECHO |
| H6.S2.M6 | `REPORTE.md` con el avance primero | `head -3` | HECHO |
| H6.S2.M7 | Daily | `ls` | HECHO |

## Microcopy (H4.S3.M4)

| Dónde | Texto |
|---|---|
| Sección 1 | «1 · Qué vas a cargar» |
| Perfil | «Qué vas a cargar» · opción «Conceptos» |
| Plantilla | «Descargar plantilla (CSV)» / «Descargar plantilla (XLSX)» |
| Sección 2 | «2 · El archivo» · «Columnas: code (obligatoria), display (obligatoria), definition (opcional). También acepta código/nombre/definición.» |
| Validar | «Validar sin guardar» |
| Importar | «Importar N conceptos» (sin N: «Importar») |
| Informe | «Leídas: N · Con error: M · Formato: CSV · Perfil: Conceptos» |
| `aborted` | «No se guardó nada: corregí las filas y volvé a validar.» |
| Errores | «Primeros 20 errores de M.» · «Fila 5, columna display: está vacía» |
| Resumen | «Leídas / Insertadas / Omitidas / Errores» · «Omitidas: ya existían en esta versión y no se tocaron.» |
| Cargar otro | «Cargar otro archivo» |
| 413 | «El archivo supera los 10 MB que acepta el servidor.» |
| 422 formato | «Ese archivo no es CSV, XLSX ni NDJSON.» |
| 422 vacío | «El archivo no tiene filas.» |
| 422 perfil | «Elegí qué vas a cargar.» |
| 403 | «Hace falta administración de seguridad para importar terminología.» |
| red | «No pudimos conectarnos. Revisá tu conexión y reintentá. Tu archivo y tus selecciones siguen acá.» |

## Ambigüedades registradas

| ID | Ambigüedad | Supuesto tomado | A quién confirmar | Qué bloquea |
|---|---|---|---|---|
| Q-5 | ¿Parsear en el navegador? | No: la vista previa la devuelve el servidor en el dry-run | Pablo | H4.S2.M4 |
| Q-8 | ¿Importar sin validar? | No desde la UI | Pablo | H4.S2.M6 |
| Q-9 | ¿Perfil «Designaciones»? | **Una sola opción** («Conceptos»): no hay daily de Marcelo en esta corrida que lo confirme. El select existe igual | Marcelo | H4.S1.M3 |
| Q-J1 | ¿Dry-run responde 200 o 201? | El doble responde **200** en dry-run y **201** en real; el cliente **no ramifica por status** | Itzan | H3.S1.M3 |
| Q-J2 | ¿`<a download>` o `createObjectURL`? | **Hay precedente** (F-10): `blobToDataUrl` + `FileDownloader.trigger`. Se copia | Pablo | H4.S1.M5 |
| Q-J3 | ¿Vista previa tras importar? | No: tras importar se muestra sólo el resumen | Pablo | H4.S2.M7 |
| **Q-J4** | Los códigos `IMPORT_*` **no están** en `API_ERROR_CODES` (F-8), así que `errorToViewState` los devuelve como error genérico | La pantalla lee el `code` **del cuerpo crudo del `HttpErrorResponse`**, sin tocar `core/http/api-error.ts` (fuera de alcance). Cuando Itzan publique los códigos, Pablo los agrega ahí y la pantalla sigue andando igual | Pablo / Itzan | H4.S2.M11 |
| **Q-J5** | Un manejador del simulador **no puede** emitir un fallo de red (status 0) (F-6): la única vía es `sessionStorage['mock:fallos']`, y el interceptor es de otro | `*error-red*` devuelve **503 `DEPENDENCY_UNAVAILABLE`** con `correlationId` (S9, lo más cercano que el manejador puede emitir) y el doble **documenta** cómo provocar el S8 real: `sessionStorage.setItem('mock:fallos', '[{"patron":"/import-file","modo":"red"}]')`. El S8 de la pantalla sí se verifica en su spec con `HttpTestingController` (status 0) | Pablo | H2.S1.M4 |

## Defecto propio encontrado y corregido

**Al escribir el spec del doble borré un spec ajeno, y lo restauré.**
`src/app/core/mock/handlers/terminology.handlers.spec.ts` **ya existía** en `origin/mockup` con 71
líneas y **4 pruebas** de las propiedades de un concepto (la frecuencia por defecto de un
medicamento, C-20). Lo creé con `Write` dando por hecho que no estaba, y lo pisé entero: el commit
`8926f5af` lo dejó con mis 21 pruebas y sin las 4 de antes. Es exactamente lo que prohíbe la regla
00 §4.1. Lo destapó `git diff origin/mockup --stat`, que mostraba el archivo como **modificado con
borrados** en vez de nuevo.

Corregido antes de abrir el PR: se recuperó el contenido original con
`git show origin/mockup:<ruta>`, mi `describe` quedó **anidado debajo** del que ya estaba, y el
archivo pasó de 21 a **25 pruebas** (4 + 21). Verificado con la aserción más dura posible:
`git diff origin/mockup -- <ruta> | grep "^-"` sale **vacío**, o sea que el diff del PR no borra ni
una línea de lo que había.

*Lección para el resto del carril: comprobar la existencia del archivo antes de un `Write`, no
después.*

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Renombrar un `data-testid` de §3 rompe el E2E de Marcelo | Alto | Los 14 nombres se copian literales; hay un spec que los cuenta uno a uno |
| `ConceptImportResult.batchId` pasa a admitir `null` | Medio | El campo se mantiene `string` y se **agrega** `batchId` nullable sólo en el tipo nuevo; ningún consumidor existente cambia |
| Sin navegador no hay prueba visual | Alto para la entrega visual | Declarado `BLOQUEADO` con causa; peldaño visual = `UNKNOWN`, nunca `VERIFIED` |
