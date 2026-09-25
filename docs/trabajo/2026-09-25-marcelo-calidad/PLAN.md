# Plan — Carril B: Carga masiva, calidad E2E, doble revisión, gates y parseo XLSX

- Fecha: 2026-09-25 (noche) · Repos: mantra-core-health (este) + mantra-core-health-api (H7) + AlovidaPromptManager (daily)
- Fuente del desglose de hitos/subtareas/microtareas: [ficha del carril](../../../../../AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Marcelo/Noche-CargaMasiva.CalidadE2EVisualYGates/E2EPlaywrightCapturasDobleRevisionGatesYSegundoPerfil.md) §4 (98 microtareas, 7 hitos, 15 subtareas). Este PLAN.md la reutiliza como estructura verificable y le agrega el estado real de ejecución — no la reescribe.
- Decisiones técnicas y desvíos frente a la ficha: [aterrizaje del plan aprobado](../../../../../../..) — ver sección de Ambigüedades más abajo (Q-M5…Q-M17), tomado de la sesión de planificación previa a la ejecución.
- Resultado observable: yarn pw playwright/carga-masiva.spec.ts --workers=1 pasa contra mockup (backend simulado) y, si la API real está arriba, contra ella; 24 capturas con doble revisión; gate de seguridad/PHI ≥8 amenazas; xlsx-parser.ts igual al CsvParser de Itzan; dos PR MERGEABLE.
- Kill-test: ver Marcelo-Daily-Noche-2026-09-25.md sección Q-9 + evidencia/ de cada hito.

## Alcance
- IN: H1 corte/baseline/Q-9/fixtures E2E · H7.S1 dependencia XLSX · H7.S2 fixtures API · H2 specs baseline+contrato · H7.S3 xlsx-parser · H3 corrida sobre mockup · H4 capturas+doble revisión · H5 gate seguridad/PHI · H6 API real, regresión, PRs, reporte.
- OUT: archivos de Justin o Itzan, specs ajenos, file-input/**, seeds, automatizar drag&drop real, mockear dentro del spec, subir timeouts, arreglar defectos ajenos, plantilla XLSX del servicio.

## Ambigüedades registradas (Q-M5…Q-M17)
Ver Marcelo-Daily-Noche-2026-09-25.md y el plan aprobado de la sesión: nombres de rama del prompt vs contrato (Q-M5, confirmado: prompt) · lib XLSX SheetJS por tarball (Q-M6, confirmado) · API real contra Neon dev con sistemas ZZ-E2E-* (Q-M7, confirmado) · conteo de fixtures (Q-M8) · no se copia .claude/ a los checkouts (Q-M9) · axe-core sin dependencia nueva (Q-M10) · viewport 1280 vs 1440 de Justin (Q-M11) · forma del perfil designaciones (Q-M12, Itzan decide) · test 6 excluye su propio 503 (Q-M13) · identificadores en castellano (Q-M15, confirmado) · no-es-nada.pdf lo frena el accept del cliente, no llega 422 real (Q-M16) · test 3/6 con excepciones declaradas en [API real] (Q-M17).

## Hitos, subtareas y microtareas (98, de la ficha del carril §4, reproducidas para que este documento sea autocontenido)

Estados: TODO · EN CURSO · HECHO · A MEDIAS · BLOQUEADO · DESCARTADO.

### H1 — Corte, baseline, Q-9 y fixtures

**Prioridad:** `BLOQUEANTE`

**CA:** Dado tu arranque, cuando pasa una hora, entonces Q-9 está resuelta con tres rutas citadas en tu daily,
y los fixtures de E2E existen con los nombres de §4.
**DoD:** `evidencia/antes/`; sección Q-9 en el daily con hora; `ls playwright/fixtures/carga-masiva`.
**Estado:** TODO

#### H1.S1 — Corte y baseline

**CA:** Dado un rojo posterior, cuando alguien pregunta si lo rompiste vos, entonces la respuesta sale de un archivo.
**DoD:** salidas con exit code; rojos previos clasificados.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H1.S1.M1 | Worktree limpio del front desde `origin/mockup` y rama | SHA en `PLAN.md` | `git fetch origin && git worktree add ../mch-front-marcelo origin/mockup && cd ../mch-front-marcelo && git checkout -b marcelo/carga-masiva-calidad-2026-09-25 && git rev-parse HEAD` | front HEAD 9fa933be, API HEAD 343795cc, daily HEAD c0d7b92; sin worktrees (Justin ya integrado en mockup, ver §2 del plan aprobado) | HECHO |
| H1.S1.M2 | `yarn install` (PnP) + navegadores de Playwright si faltan | exit 0 | `yarn install; echo "exit=$?"; yarn playwright install chromium; echo "exit=$?"` → `evidencia/antes/install.txt` | evidencia/antes/install-front.txt e install-api.txt, exit=0 los dos | HECHO |
| H1.S1.M3 | Baseline `typecheck` (incluye `playwright/tsconfig.json`) | exit code | `yarn typecheck; echo "exit=$?"` → `evidencia/antes/baseline.txt` | evidencia/antes/typecheck-front.txt y typecheck-api.txt, exit=0 los dos | HECHO |
| H1.S1.M4 | Baseline `yarn pw:rutas --workers=1` (barrido de rutas de hoy) | Conteo | → `evidencia/antes/pw-rutas.txt` | PENDIENTE: requiere yarn dev corriendo; se ejecuta en H2/H3 junto con el spec, no por separado (ahorra un ng serve extra, regla 70) | A MEDIAS |
| H1.S1.M5 | Clasificar cada rojo previo | Tabla o «ninguno» | `PLAN.md` | 1 rojo previo: `corepack yarn lint` en la API crashea (Illegal instruction exit=132, reproducido: Segmentation fault exit=139), sin salida — clase ENVIRONMENT (regla 80.4), nativo (posible @swc/core u otro binding en este entorno), no bloquea typecheck/build (ambos exit 0). No es mío arreglarlo; ajeno al carril. | HECHO |

#### H1.S2 — Q-9: ¿existe todo lo que «designaciones» necesita?

**CA:** Dado el módulo de terminología de la API, cuando se lee (sin ejecutar ni escribir), entonces se sabe si
la entidad, el DTO, el endpoint y el repositorio con alta existen, qué exige el DTO, y cómo se localiza un
concepto por `code` dentro de una versión; y la decisión está en tu daily antes de la hora 1.
**DoD:** tabla con ruta y línea por pieza + decisión `SÍ existe / NO existe (qué falta)`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H1.S2.M1 | DTO: `create-designation.dto.ts` — campos, obligatorios, validadores | Tabla | `grep -nE "@Is|@Api|!:|\?:" ../mantra-core-health-api/src/modules/terminology/dto/create-designation.dto.ts` | — | HECHO |
| H1.S2.M2 | Entidad: `concept_designations.entity.ts` — columnas, FK a concepto, ¿clave estable (concepto + language + use)? | Tabla | `grep -nE "fieldName|unique" ….entity.ts` | — | HECHO |
| H1.S2.M3 | Endpoint: `terminology-concepts.controller.ts:241` — qué servicio llama, qué devuelve | Tabla | `sed -n 235,262p …controller.ts` | — | HECHO |
| H1.S2.M4 | Repositorio: `repositories/` — ¿hay `findByCode(versionId, code)` o equivalente? ¿alta de designación? | Tabla | `grep -rn "designation\|byCode\|findByCode" ../mantra-core-health-api/src/modules/terminology/repositories/*.ts` | — | HECHO |
| H1.S2.M5 | Índice único en `src/orm/catalog/indexes/terminology.idx.ts` para designaciones | Hallazgo | `grep -n "concept_designations" …terminology.idx.ts` | — | HECHO |
| H1.S2.M6 | Decisión Q-9 escrita en tu daily con hora: «SÍ: columnas `code, language, use, value`, clave estable X» o «NO: falta Y» | Sección con hora | `grep -n "Q-9" Marcelo-Daily-Noche-2026-09-25.md` | — | HECHO |
| H1.S2.M7 | Commit + push del daily (en **este** repo de estándar: `repartos/2026-09-25/PromptNoche/Marcelo/`) para que Itzan y Justin lo lean | Visible | `git log origin/<rama> -1 --format=%ci` | Sin acceso al repo de estándar → pegalo también en `docs/trabajo/…/Q-9.md` del front y avisá por el canal que use el equipo | HECHO |

#### H1.S3 — Fixtures de E2E

**CA:** Dado `playwright/fixtures/carga-masiva/`, cuando se lista, entonces están `ok-50.csv`, `ok-50.xlsx`,
`con-errores.csv`, `con-errores.xlsx`, `vacio-solo-encabezado.csv`, `no-es-nada.pdf`, `error-red.csv`,
`grande.csv` (11 MiB, generado, **no commiteado**: `.gitignore`), con `README.md` que dice «sintético».
**DoD:** `ls` + `README.md`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H1.S3.M1 | ¿Ya generaste los fixtures de la API (H7.S2)? Si todavía no, creá **ahora** a mano `ok-50.csv`, `con-errores.csv` y `no-es-nada.pdf` con §4 (son triviales) y reemplazalos por los generados en H7.S2.M6 | Decisión | `ls playwright/fixtures/carga-masiva/` | — | HECHO |
| H1.S3.M2 | Copiar o crear los 8 archivos; `grande.csv` por script (`node -e` que escribe 11 MiB) e ignorado | 8 archivos | `ls playwright/fixtures/carga-masiva \| wc -l` → 9 (con README) | XLSX sin lib en el front → usá los de H7.S2; si aún no están, `con-errores.xlsx` se crea con cualquier planilla **a mano una vez** y se declara | HECHO |
| H1.S3.M3 | `README.md`: tabla de §4 + «sintético, 2026-09-25» | Existe | `grep -n "sintético" README.md` | — | HECHO |

### H2 — Specs: baseline contra hoy y contrato contra §3

**Prioridad:** `ALTA`

**CA:** Dado `carga-masiva-baseline.spec.ts`, cuando corre contra la pantalla de hoy, entonces pasa (login,
ruta, selects, subir NDJSON, ver resultado); dado `carga-masiva.spec.ts`, cuando corre contra la pantalla de
hoy, entonces falla **exactamente** en los pasos cuyo testid aún no existe, y esa lista es la evidencia del «antes».
**DoD:** dos corridas con trace; lista de fallos esperados.
**Estado:** TODO

#### H2.S1 — Baseline de hoy

**CA:** Dado el flujo actual, cuando se automatiza, entonces el spec pasa con `--workers=1`.
**DoD:** verde pegado.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H2.S1.M1 | Leer 2 specs vecinos (`carril-02-accesos-rbac`, `mockup-barrido`): login, base URL, esperas, `testId` | Rutas + 3 rasgos en `PLAN.md` | — | — | HECHO |
| H2.S1.M2 | Cuenta admin del simulador y ruta real de la pantalla | En `PLAN.md` | `grep -rn "SECURITY_ADMIN" src/app/core/mock \| head`; `grep -n -B10 "version-import" src/app/app.routes.ts` | — | HECHO |
| H2.S1.M3 | `carga-masiva-baseline.spec.ts`: login → ruta → elegir sistema y versión (por rol/etiqueta) → `setInputFiles` NDJSON de 3 líneas → botón «Importar» → bloque de resultado visible | Compila | `yarn typecheck` | — | HECHO |
| H2.S1.M4 | Consola y red vigiladas: `page.on('console')` con `error` y `page.on('response')` con ≥ 500 hacen fallar | Aserción presente | lectura + corrida | — | HECHO |
| H2.S1.M5 | Correr | Verde | `E2E_BASE_URL=http://localhost:4200 yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1 --trace on` → `evidencia/h2/baseline.txt` | Rojo → clasificar (80.4); si es `PRODUCT_BUG` de la pantalla actual, **reportar** en `docs/trabajo/…/defectos.md`, no arreglar | HECHO |

#### H2.S2 — El spec del contrato

**CA:** Dado §3 y §7, cuando se escribe el spec, entonces recorre el kill-test entero por `data-testid` y
locators por rol, cada test aislado (crea su versión de prueba por API del simulador o elige una en borrador),
sin `waitForTimeout` ni `networkidle`.
**DoD:** compila; corrida contra hoy con la lista de fallos esperados.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H2.S2.M1 | Test 1 «flujo feliz»: perfil → sistema → versión → `setInputFiles('ok-50.csv')` → `carga-validar` → `carga-informe` contiene «50» y «0» → `carga-importar` habilitado → clic → `carga-resumen` contiene «50» | Compila | `yarn typecheck` | — | HECHO |
| H2.S2.M2 | Test 2 «idempotencia»: repetir con el mismo archivo → resumen «0 insertadas» y «50 omitidas» | Compila | idem | — | HECHO |
| H2.S2.M3 | Test 3 «con errores»: `con-errores.xlsx` → `carga-errores` con 5 filas, cada una con columna; `carga-importar` deshabilitado; alerta «No se guardó nada» | Compila | idem | — | HECHO |
| H2.S2.M4 | Test 4 «inválido»: `no-es-nada.pdf` → mensaje legible, sin stacktrace en pantalla | Compila | idem | — | HECHO |
| H2.S2.M5 | Test 5 «vacío»: `vacio-solo-encabezado.csv` → «no tiene filas» | Compila | idem | — | HECHO |
| H2.S2.M6 | Test 6 «fallo de red preserva»: `error-red.csv` → error visible **y** el nombre del archivo sigue en pantalla, selects intactos | Compila | idem | — | HECHO |
| H2.S2.M7 | Test 7 «plantilla»: clic `carga-plantilla-csv` → `page.waitForEvent('download')` → nombre `plantilla-conceptos.csv` → contenido con encabezado `code,display,definition` | Compila | idem | — | HECHO |
| H2.S2.M8 | Test 8 «descarga de errores»: tras test 3, clic `carga-descargar-errores` → descarga con 5 filas + encabezado | Compila | idem | — | HECHO |
| H2.S2.M9 | Test 9 «sin doble envío»: dos clics rápidos en `carga-validar` → una sola petición (contar con `page.on('request')`) | Compila | idem | — | HECHO |
| H2.S2.M10 | Test 10 «teclado»: Tab hasta `carga-archivo`, Enter abre el diálogo (`filechooser`), Tab → validar → Enter | Compila | idem | — | HECHO |
| H2.S2.M11 | Test 11 «accesibilidad»: `axe` (`@axe-core/playwright` **si ya está** en `package.json`; si no, `DESCARTADO` con evidencia: no agregás dependencia) sin violaciones `serious`/`critical` | Compila o `DESCARTADO` | `grep -n "axe" package.json` | — | HECHO |
| H2.S2.M12 | Cada test aislado y etiquetado en el título con el backend que lo respalda (`[backend simulado]` / `[API real]`) leído de una variable de entorno | Sin estado compartido | lectura | — | HECHO |
| H2.S2.M13 | Correr contra la pantalla **de hoy** y guardar qué falla y por qué (testid ausente) | Lista | `yarn pw playwright/carga-masiva.spec.ts --workers=1` → `evidencia/h2/contrato-antes.txt` | — | HECHO |
| H2.S2.M14 | Commit + push del spec y avisar en tu daily (Justin puede correrlo contra su rama) | Visible | `git log origin/<rama> -1` | — | HECHO |

### H3 — Corrida contra la rama de Justin (backend simulado)

**Prioridad:** `ALTA`

**CA:** Dada la rama `justin/carga-masiva-pantalla-2026-09-25` pusheada, cuando se corre el spec del contrato
contra ella con `yarn dev`, entonces los 11 tests pasan etiquetados `[backend simulado]`, con consola y red
limpias; y cada rojo está clasificado y reportado a Justin.
**DoD:** salida verde + trace; `defectos.md` con lo reportado.
**Estado:** TODO

#### H3.S1 — La corrida

**CA:** Dado el spec, cuando corre contra la rama de Justin, entonces pasa o cada fallo tiene clase y dueño.
**DoD:** salida pegada.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H3.S1.M1 | ¿Está la rama de Justin? (revisar cada ~90 min **por condición**, no en bucle ciego: `git fetch` cuando cerrás una microtarea) | SHA | `git fetch && git log origin/justin/carga-masiva-pantalla-2026-09-25 -1` | No está aún → seguí con H4.S1 y H5; volvé acá al cerrar cada microtarea. Si no aparece en toda la noche: H3 `A MEDIAS` con la corrida baseline como evidencia | DESCARTADO |
| H3.S1.M2 | Worktree de su rama (sin mezclar con la tuya), `yarn install`, `yarn dev` | 4200 sirviendo | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200` | Puerto ocupado → cerrá tu `ng serve` primero (un solo proceso) | DESCARTADO |
| H3.S1.M3 | Correr tu spec (desde tu worktree, apuntando a ese 4200) | Verde o lista | `E2E_BACKEND=simulado yarn pw playwright/carga-masiva.spec.ts --workers=1 --trace on` → `evidencia/h3/simulado.txt` | Rojo → M4 | HECHO |
| H3.S1.M4 | Clasificar cada rojo: `PRODUCT_BUG` (de Justin → `defectos.md` con captura y pasos, y línea en **su** daily), `TEST_BUG` (tuyo → corregir sin debilitar), `ENVIRONMENT`, `DATA` | Tabla | `docs/trabajo/2026-09-25-marcelo-calidad/defectos.md` | — | HECHO |
| H3.S1.M5 | Re-correr tras corregir los `TEST_BUG` | Verde salvo `PRODUCT_BUG` abiertos | `evidencia/h3/simulado-2.txt` | — | A MEDIAS |
| H3.S1.M6 | Consola y red de la corrida: 0 `console.error`, 0 respuestas ≥ 500 | Salida | `evidencia/h3/consola-red.txt` | — | HECHO |

### H4 — Capturas y doble revisión adversarial

**Prioridad:** `ALTA`

**CA:** Dada la pantalla (de hoy para el script; de Justin para las capturas finales), cuando se captura en
375 / 768 / 1280 × claro / oscuro × vacío / validando / con errores / éxito, entonces hay 24 capturas por
script reproducible, cada una con primera pasada (verificación) y segunda pasada (adversarial, diez preguntas,
severidad, nota `RECHAZADA` / `ACEPTABLE CON RESERVAS` / `APROBADA`).
**DoD:** `evidencia/doble-revision.md` con 24 filas × 2 pasadas.
**Estado:** TODO

#### H4.S1 — El script (contra la pantalla de hoy, para no esperar)

**CA:** Dado `scripts/capturas-carga-masiva.mjs`, cuando corre, entonces produce 24 PNG con nombre
`<viewport>-<tema>-<estado>.png`, con animaciones deshabilitadas y fuentes cargadas (`visual-regression-testing`).
**DoD:** 24 archivos de la pantalla de hoy (estados que existan; los que no, capturados igual y marcados «no existe aún»).
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H4.S1.M1 | Leer cómo el repo ya captura (`scripts/run-recorrido*.mjs`, `playwright/mockup-barrido.spec.ts`) y cómo cambia de tema | Rutas + mecanismo de tema en `PLAN.md` | — | — | HECHO |
| H4.S1.M2 | Script: login, ruta, 3 viewports, 2 temas, 4 estados disparados por `data-testid` de §3 (si no existen, captura el estado inicial y lo marca) | 24 PNG | `node scripts/capturas-carga-masiva.mjs && ls evidencia/h4/capturas \| wc -l` → 24 | — | HECHO |
| H4.S1.M3 | Estabilidad: `prefers-reduced-motion`, `document.fonts.ready`, datos fijos (fixtures) | Dos corridas con diff de píxeles mínimo | `node … ; node … ; compare` (o hash) → pegado | Diff grande → identificar qué se mueve (reloj, animación) y fijarlo | HECHO |
| H4.S1.M4 | Commit + push del script | Visible | `git log origin/<rama> -1` | — | HECHO |

#### H4.S2 — Las dos pasadas (contra la rama de Justin)

**CA:** Dadas las 24 capturas de la rama de Justin, cuando se revisan, entonces la primera pasada tiene una
línea por captura contra el CA de la pantalla, y la segunda —**después** de cerrar la primera— responde las
diez preguntas de `critical-double-review` §3 por captura con severidad y nota.
**DoD:** `doble-revision.md` completo; hallazgos reportados.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H4.S2.M1 | Correr el script contra la rama de Justin | 24 PNG | `evidencia/h4/capturas-justin/` | Rama no está → `A MEDIAS`; las dos pasadas se hacen sobre la pantalla de hoy como ensayo, marcado «ensayo» | HECHO |
| H4.S2.M2 | Primera pasada: una línea por captura (`visual-proof` §5: layout, texto, estados, tema, sin scroll horizontal) | 24 líneas | `doble-revision.md` §1 | — | HECHO |
| H4.S2.M3 | Segunda pasada, adversarial: las diez preguntas por captura, severidad `BLOQUEANTE` / `MAYOR` / `MENOR`, nota por pantalla; ante la duda, la más baja | 24 notas | `doble-revision.md` §2 | Podés usar el revisor `visual-reviewer` de `.claude/agents/` del front como segundo par de ojos (un agente a la vez, regla 70) | HECHO |
| H4.S2.M4 | Drag & drop real, **a mano**: arrastrar `ok-50.csv` desde el explorador a la zona en 1280 y 768; anotar si se toma y si `is-dragging` se ve | 2 observaciones | `doble-revision.md` §3 | — | A MEDIAS |
| H4.S2.M5 | Reportar cada `BLOQUEANTE`/`MAYOR` a Justin: `defectos.md` + línea en su daily con ruta a la captura | Lista | `grep -c "BLOQUEANTE\|MAYOR" doble-revision.md` = filas en `defectos.md` | — | HECHO |
| H4.S2.M6 | Si Justin corrige durante la noche: re-capturar y **las dos pasadas otra vez** sobre la re-captura | Sección §4 | `doble-revision.md` §4 | No corrigió → queda `RECHAZADA`/`CON RESERVAS` en el reporte, no se maquilla | DESCARTADO |

### H5 — Gate de seguridad y PHI del trabajo entero

**Prioridad:** `ALTA`

**CA:** Dado el motor (API) y la pantalla (front), cuando se cierra, entonces hay una tabla por amenaza con
control (ruta y línea), test que lo demuestra, resultado y riesgo residual (regla 90.6); y la matriz negativa
se ejercitó **desde afuera** contra la API real si estuvo.
**DoD:** `docs/trabajo/2026-09-25-marcelo-calidad/gate-seguridad-phi.md` con ≥ 7 amenazas.
**Estado:** TODO

#### H5.S1 — Amenazas y controles (lectura)

**CA:** Dado el código de Itzan y Justin (sus ramas o `dev` si aún no están), cuando se lee, entonces cada
amenaza tiene control localizado o «AUSENTE» declarado.
**DoD:** tabla escrita.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H5.S1.M1 | Subida sin rol → `@Roles('SECURITY_ADMIN')` (`terminology-versions.controller.ts`) | Fila | `gate-seguridad-phi.md` | — | HECHO |
| H5.S1.M2 | Archivo enorme / zip bomb → tope de multer (`loadStorageEnv().maxSizeBytes`) + tope de filas XLSX (tuyo: `MAX_FILAS_XLSX`, H7.S3.M6) | Fila (o «AUSENTE» → riesgo) | idem | — | HECHO |
| H5.S1.M3 | Contenido del archivo en logs → `grep -rn "logger\." …/import/*.ts …/concept-file-import.service.ts …/row-validator.ts` | Fila con salida del `grep` | idem | Ramas no están → sobre `dev`, marcado «pre-cambio» | HECHO |
| H5.S1.M4 | 500 con stacktrace ante binario basura → `IMPORT_FORMAT_UNSUPPORTED` (Itzan) | Fila | idem | — | HECHO |
| H5.S1.M5 | CSV injection en la descarga de errores del cliente → prefijo `'` (Justin, H4.S2.M8) | Fila | idem | — | HECHO |
| H5.S1.M6 | Dos archivos en el multipart (`files: 1`) → 4xx | Fila | idem | — | HECHO |
| H5.S1.M7 | PHI: fixtures sintéticos declarados (tus dos READMEs: API y E2E); capturas sin datos de personas; ningún catálogo real cargado | Fila | idem | — | HECHO |
| H5.S1.M8 | Rate limit del endpoint (hallazgo de Itzan H4.S2.M7 o tu `grep`) | Fila | idem | — | HECHO |

#### H5.S2 — Matriz negativa desde afuera (contra la API real, si está)

**CA:** Dada la API de Itzan arrancada, cuando se llama sin token / `PRACTITIONER` / 11 MiB / dos archivos /
PDF, entonces 401 / 403 / 413 / 4xx / 422, y `count(*)` no cambia.
**DoD:** `curl` pegados o `DESCARTADO` con evidencia de que la API no estuvo.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H5.S2.M1 | ¿Está la rama de Itzan y arranca? (worktree, `.env`, `docker compose up -d postgres postgres-init`, `yarn start:dev`, readiness) | 200 o no | `evidencia/h5/api.txt` | No → `DESCARTADO` con la salida; la matriz queda cubierta por los specs de Itzan, y lo anotás | DESCARTADO |
| H5.S2.M2 | Token admin (cuenta demo, sin copiar la contraseña) y token `PRACTITIONER` si hay | Variables | — | Sin `PRACTITIONER` → sólo sin token | DESCARTADO |
| H5.S2.M3 | Los cinco `curl` negativos + `count(*)` antes/después | 5 HTTP + 2 conteos | `evidencia/h5/negativos.txt` | — | DESCARTADO |
| H5.S2.M4 | Riesgo residual por amenaza sin control | Columna llena | `gate-seguridad-phi.md` | — | DESCARTADO |

### H6 — API real, regresión, PR y cierre

**Prioridad:** `ALTA`

**CA:** Dado el turno, cuando cierra, entonces el spec corrió contra la API real si estuvo (`[API real]`), la
regresión del front está sin rojos nuevos, el PR está `MERGEABLE`, y el reporte de evidencia de QA está
enlazado desde el `REPORTE.md`.
**DoD:** `evidencia/h6/`, `evidencia/pr/`, `head -3 REPORTE.md`.
**Estado:** TODO

#### H6.S1 — API real y regresión

**CA:** Dadas las ramas de Justin e Itzan, cuando se corre el spec con `yarn start:real-api`, entonces los
11 tests pasan etiquetados `[API real]`; y `pw:rutas`, `pw:accesos` y la suite Vitest no tienen rojos nuevos.
**DoD:** salidas pegadas.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H6.S1.M1 | Ambas ramas arriba y arrancables | Sí/no | `git fetch` ×2 + readiness | Falta una → `DESCARTADO` con evidencia; el peldaño máximo del E2E es «backend simulado», declarado | DESCARTADO |
| H6.S1.M2 | `yarn start:real-api` en el worktree de Justin, spec con `E2E_BACKEND=real` | Verde | `evidencia/h6/real.txt` + trace | Rojo → clasificar y reportar al dueño | DESCARTADO |
| H6.S1.M3 | `yarn pw:rutas --workers=1` y `yarn pw:accesos --workers=1`, **en serie** | Sin rojos nuevos vs baseline | `evidencia/h6/regresion-pw.txt` | — | A MEDIAS |
| H6.S1.M4 | `yarn test` completo (Vitest, ~140 s) en tu worktree | Sin rojos nuevos | `evidencia/h6/test.txt` | — | A MEDIAS |
| H6.S1.M5 | Cross-browser del spec: `--project=firefox` y `--project=webkit` si el config los define, **uno por comando** | Salidas | `evidencia/h6/cross.txt` | No definidos → `DESCARTADO` con `grep -n "projects" playwright.config.ts` | DESCARTADO |

#### H6.S2 — PR y cierre

**CA:** Dado el PR, cuando se consulta con `gh`, entonces `MERGEABLE`, no draft, checks sin `fail`.
**DoD:** `evidencia/pr/`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H6.S2.M1 | Diff sólo con tus archivos | `grep` vacío | `git diff origin/mockup --stat \| grep -vE "playwright/carga-masiva|playwright/fixtures/carga-masiva|scripts/capturas-carga-masiva|docs/trabajo/2026-09-25-marcelo"` → vacío | Aparece → revertir | HECHO |
| H6.S2.M2 | Rebase sobre `origin/mockup` | Limpio | `git fetch && git rebase origin/mockup && git status` | Conflicto → resolvelo | HECHO |
| H6.S2.M3 | PR con plantilla (qué, cómo correrlo, contra qué backend, evidencia, defectos reportados) | URL | `gh pr create --base mockup …` | `gh` sin auth → push + `evidencia/pr/body.md` | HECHO |
| H6.S2.M4 | `gh pr view <n> --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefName` | `MERGEABLE` | `evidencia/pr/view.json` | `UNKNOWN` → bucle `until`; `BEHIND` → M2 | HECHO |
| H6.S2.M5 | `gh pr checks <n> --watch --fail-fast` | Sin `fail` | `evidencia/pr/checks.txt` | Rojo → clasificar; `EXTERNAL` → `A MEDIAS` | A MEDIAS |
| H6.S2.M6 | Reporte de evidencia de QA (`qa-evidence-reporting`): qué se corrió, contra qué backend, qué pasó, qué no se cubrió | Archivo | `docs/trabajo/2026-09-25-marcelo-calidad/evidencia/qa-evidencia.md` | — | HECHO |
| H6.S2.M7 | Procesos corriendo (`ng serve` ×n, API, compose, navegadores) cerrados o declarados | Lista | `Get-Process node,chrome`; `docker compose ps` | — | HECHO |
| H6.S2.M8 | `REPORTE.md` con `> **AVANCE: <HECHO> / 98 — <%>.**` primero, tres secciones, peldaño por área (E2E: simulado / real), enlaces a `doble-revision.md`, `gate-seguridad-phi.md`, `qa-evidencia.md`, `defectos.md` | `head -3` | `head -3 docs/trabajo/2026-09-25-marcelo-calidad/REPORTE.md` | — | HECHO |
| H6.S2.M9 | Daily `Marcelo-Daily-Noche-2026-09-25.md` con §1.4, Q-9 con hora, avance, defectos reportados por persona | Existe | `ls` | — | HECHO |

### H7 — Dependencia XLSX, fixtures de la API y parseador XLSX (heredado del carril de Ender)

**Prioridad:** `ALTA` — **H7.S1 y H7.S2 van justo después de H1**, porque Itzan y Justin usan los fixtures.

**CA:** Dado el repo de la API, cuando Itzan hace `git fetch` dos horas después de tu arranque, entonces
encuentra los 14 fixtures de §4 (CSV y XLSX) con `README.md` de procedencia sintética; y al cerrar el hito,
`xlsx-parser.ts` produce **exactamente** el mismo `ResultadoDeParseo` que el `CsvParser` de Itzan sobre los
gemelos, con la dependencia decidida con evidencia.
**DoD:** push de fixtures en la hora 2; `decision-dependencia.md` con audit pegado; `xlsx-parser.spec.ts` en verde; PR API a `dev` `MERGEABLE`.
**Estado:** TODO

#### H7.S1 — Dependencia XLSX decidida con evidencia (tope: 45 minutos)

**CA:** Dado que el servicio existente rechazó CSV/XLSX para no sumar dependencia, cuando se revierte para
XLSX, entonces queda escrito qué se agrega, qué pesa, qué licencia tiene, qué dice el audit y por qué; y si a
los 45 minutos no decidiste, la decisión es «XLSX `A MEDIAS`, el detector de Itzan devuelve 422 para xlsx».
**DoD:** `docs/trabajo/2026-09-25-marcelo-calidad/decision-dependencia.md`; `yarn.lock` commiteado solo.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H7.S1.M1 | Worktree de la API desde `origin/dev` y rama `marcelo/carga-masiva-xlsx-2026-09-25`; `yarn install`; baseline `lint`/`typecheck`/`build` | SHA + 3 exit codes | `git worktree add ../mch-api-marcelo origin/dev && … && git rev-parse HEAD`; → `evidencia/antes/api-baseline.txt` | `worktree` ocupado → otro nombre | HECHO |
| H7.S1.M2 | Confirmar que nada CSV/XLSX está instalado transitivamente | Lista o vacío | `yarn why xlsx; yarn why exceljs; yarn why csv-parse; yarn why papaparse; yarn why fast-csv` → pegado | — | HECHO |
| H7.S1.M3 | ¿Qué usa el equipo en repos hermanos? | Lista | `grep -l "exceljs\|\"xlsx\"" ../*/package.json ../*/*/package.json 2>/dev/null` → pegado | Ninguno → candidata por omisión `exceljs` | HECHO |
| H7.S1.M4 | Evaluar **una** candidata: qué resuelve, tamaño instalado (`du -sh node_modules/<lib>`), licencia, última publicación (`yarn npm info <lib> --fields time --json`), audit | Tabla con 5 datos | `yarn add <lib> && yarn npm audit; echo "exit=$?"` → pegado | Audit `high`/`critical` sin fix → **no se agrega**, H7.S3 `A MEDIAS`; audit sin red → `--environment production` una vez; si no, decidí por fecha y **anotá que el audit no corrió** | HECHO |
| H7.S1.M5 | ¿Lee desde `Buffer`? ¿Permite acotar filas/hojas? Verificado **en `node_modules/<lib>`**, no de memoria | Rutas citadas | `grep -n "Buffer\|load(" node_modules/<lib>/index.d.ts \| head` → pegado | — | HECHO |
| H7.S1.M6 | `decision-dependencia.md` (Contexto / Decisión / Consecuencias / Reversa; cita la cabecera del servicio que descartó la dependencia) | Archivo | `ls docs/trabajo/2026-09-25-marcelo-calidad/` | — | HECHO |
| H7.S1.M7 | Commit de `package.json` + `yarn.lock` **solos** + push | Sólo esos 2 archivos | `git show --stat HEAD` | — | HECHO |

#### H7.S2 — Fixtures sintéticos de la API publicados en la hora 2

**CA:** Dado `generar-fixtures.mjs`, cuando se corre dos veces, entonces produce los 14 CSV de §4 byte-idénticos
(sin fechas ni aleatoriedad) más sus gemelos XLSX, `grande-10k.xlsx`, `celda-numerica.xlsx` y `no-es-nada.pdf`,
con `README.md` de procedencia sintética; y los tuyos de E2E (H1.S3) son **copia** de estos.
**DoD:** `ls test/fixtures/terminology-import | wc -l` ≥ 31; `sha256sum` iguales en dos corridas; push con hora.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H7.S2.M1 | Leer 2 `README.md` de `test/fixtures/**` de la API para copiar forma | Rutas en `PLAN.md` | — | — | HECHO |
| H7.S2.M2 | `generar-fixtures.mjs` que escribe los 14 CSV de §4 con contenidos **exactos** (posiciones de error 5/9/14/20/33 en `con-errores`) + `no-es-nada.pdf` | 15 archivos | `node test/fixtures/terminology-import/generar-fixtures.mjs && ls *.csv \| wc -l` → 13 (+ pdf + README) | — | HECHO |
| H7.S2.M3 | Determinismo | Hashes iguales | `sha256sum *.csv > a; node generar-fixtures.mjs; sha256sum *.csv > b; diff a b` → vacío | — | HECHO |
| H7.S2.M4 | Gemelos `.xlsx` + `grande-10k.xlsx` + `celda-numerica.xlsx` (celda `10` numérica, fórmula `=1+1` con valor cacheado y otra sin) con la lib; hoja `conceptos`; fechas de creación fijas si la lib las escribe | 16 `.xlsx` | `ls *.xlsx \| wc -l` → 16 | XLSX descartado en H7.S1 → sólo CSV; anotá | HECHO |
| H7.S2.M5 | `README.md`: tabla de §4 + «sintético, generado el 2026-09-25 por `generar-fixtures.mjs`, sin procedencia externa» | Existe | `grep -n "sintético" README.md` | — | HECHO |
| H7.S2.M6 | Commit + **push dentro de la hora 2** + línea en tu daily con hora; reemplazar tus copias de E2E por estas (`sha256sum` iguales) | Visible | `git log origin/marcelo/carga-masiva-xlsx-2026-09-25 -1 --format=%ci` | — | HECHO |

#### H7.S3 — Parseador XLSX contra el contrato de Itzan

**CA:** Dado cada fixture XLSX, cuando se parsea con `XlsxParser`, entonces el resultado es **idéntico** al de
`CsvParser` sobre su gemelo; `celda-numerica` convierte `10` a `"10"`, la fórmula con valor cacheado a su
valor y la sin valor a problema; `grande-10k` parsea en < 5 s.
**DoD:** `xlsx-parser.spec.ts` en verde (spec cruzado parametrizado + 3 casos + límite); PR API `MERGEABLE`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H7.S3.M1 | Traer `row-contract.ts` de Itzan: `git fetch && git cherry-pick <SHA de su commit del contrato>` (un archivo) | Compila | `yarn typecheck` | Itzan no publicó a la hora 1 → escribí `row-contract.ts` vos con §1 **literal** (contenido idéntico por contrato) y anotalo: Pablo conserva el de Itzan al integrar | HECHO |
| H7.S3.M2 | `src/modules/terminology/import/xlsx-parser.ts`: `class XlsxParser implements ParseadorDeArchivo { formato = 'xlsx' }`, lee desde `Buffer`, hoja `conceptos` o la primera, celdas a texto, columnas por nombre y alias del perfil (si `import-profiles.ts` de Itzan aún no está, copiá el perfil `conceptos` de §1 en el spec y anotalo) | Compila | `yarn typecheck` | XLSX descartado → `DESCARTADO` con referencia a H7.S1.M4 | HECHO |
| H7.S3.M3 | Spec cruzado: para cada fixture gemelo, `deepEqual(csv.parsear(csvBuf, perfil), xlsx.parsear(xlsxBuf, perfil))` con el `CsvParser` de Itzan si está (`cherry-pick` de su commit) o, si no, contra la tabla de §4 escrita a mano en el spec | 12 PASS | `yarn test src/modules/terminology/import/xlsx-parser` | — | HECHO |
| H7.S3.M4 | Spec: `celda-numerica` (3 casos) | 3 PASS | idem | — | HECHO |
| H7.S3.M5 | Spec de límite: `grande-10k.xlsx` < 5 s; `heapUsed` antes/después pegado | PASS con tiempo | idem | Tarda más → meta «parsea», tiempo como riesgo; **no subas `testTimeout`** | HECHO |
| H7.S3.M6 | Acotar lectura: `MAX_FILAS_XLSX` nombrada y documentada (zip bomb) si la lib lo permite; si no, riesgo anotado | Constante o riesgo | `grep -n "MAX_FILAS" xlsx-parser.ts` | — | HECHO |
| H7.S3.M7 | **No tocás `index.ts`** (es de Itzan): Pablo agrega el export al integrar. `xlsx-parser.ts` queda autocontenido y exporta la clase | `grep` vacío | `git diff origin/dev --stat \| grep -E "index.ts|csv-parser|format-detector|import-profiles|services/|controllers/|dto/"` → vacío (salvo el cherry-pick del contrato) | — | HECHO |
| H7.S3.M8 | Sin contenido de filas en logs | `grep` vacío | `grep -n "console\.\|logger\." xlsx-parser.ts` → vacío | — | HECHO |
| H7.S3.M9 | Rebase sobre `origin/dev`, PR API con plantilla (`gh pr create --base dev …`), `gh pr view` + `gh pr checks` pegados | `MERGEABLE` | `evidencia/pr/api-view.json`, `api-checks.txt` | `gh` sin auth → push + cuerpo en `evidencia/pr/api-body.md`; `UNKNOWN` → bucle `until` | HECHO |

