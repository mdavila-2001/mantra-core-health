# La calidad de la carga masiva: E2E Playwright contra el contrato, capturas con doble revisión adversarial, gates de seguridad y PHI, y el descubrimiento del segundo perfil

> **Rol:** dueño de `playwright/carga-masiva*`, de los fixtures de E2E, del script de capturas y de la revisión adversarial de lo que hagan los otros · **Fecha:** 2026-09-25 · **Turno:** noche · **Modo:** autónomo, sin nadie a quien preguntar
> **Contrato compartido:** [`CONTRATO-CARGA-MASIVA.md`](../../CONTRATO-CARGA-MASIVA.md) — §3 (`data-testid`: lo que **vos usás**), §4 (fixtures), §7 (kill-test), §5 (Q-9 es **tuya**).
> **Daily de equipo:** [`Daily-Noche-2026-09-25.md`](../../Daily-Noche-2026-09-25.md)
> **7 hitos · 15 subtareas · 98 microtareas**, con CA, DoD y columna «Si se traba».
>
> **Tu carril no espera a Justin ni a Itzan.** Escribís el E2E **hoy** contra los `data-testid` de §3 y lo corrés
> primero contra **la pantalla que ya existe** (baseline: lo que hoy pasa y lo que hoy falla porque el testid no
> está), después contra la rama de Justin cuando la publique (con el doble del simulador: **UI con backend
> simulado**, etiquetado así), y al final contra la API real si Itzan está arriba. Tres corridas, tres peldaños,
> cada uno declarado. Además sos **la segunda pasada** de las capturas de Justin (regla 35.1.6: quien implementa
> no aprueba) y quien resuelve Q-9 (¿existe todo lo que «designaciones» necesita?) **en tu primera hora**,
> porque Itzan y Justin lo leen de tu daily. Y heredás del carril de Ender (que esta noche no está) el
> **parseo XLSX**: la dependencia, los fixtures de la API y `xlsx-parser.ts` contra el contrato de Itzan (H7).

## 0. Ficha de asignación

| Campo | Valor |
|---|---|
| `REPOS` | `alovida/mantra-core-health` (front: Playwright en `playwright/`, `yarn pw`) y `alovida/mantra-core-health-api` (H7: worktree propio desde `origin/dev`, rama `marcelo/carga-masiva-xlsx-2026-09-25`; el resto de la API, sólo lectura) |
| `TARGET_REF` | `origin/mockup`, worktree limpio (el checkout del front tiene cambios sin commitear de Ender). SHA en tu `PLAN.md` |
| `RAMA` | `marcelo/carga-masiva-calidad-2026-09-25` (front). En la API no escribís código: tus hallazgos van a `docs/trabajo/2026-09-25-marcelo-calidad/**` de **este** repo de estándar o del front |
| `ARCHIVOS RESERVADOS PARA VOS` | **API:** `src/modules/terminology/import/xlsx-parser.ts` (+spec) · `test/fixtures/terminology-import/**` · `package.json` + `yarn.lock` (sólo la dependencia XLSX) · `docs/trabajo/2026-09-25-marcelo-calidad/**`. **Front:** `playwright/carga-masiva.spec.ts`, `playwright/carga-masiva-baseline.spec.ts` (nuevos) · `playwright/fixtures/carga-masiva/**` (nuevo) · `scripts/capturas-carga-masiva.mjs` (nuevo) · `docs/trabajo/2026-09-25-marcelo-calidad/**` (front) · `evidencia/doble-revision.md` |
| `ARCHIVOS DE OTROS — NO LOS TOQUES` | `features/admin/terminology/version-import/**`, `terminology.client.ts`, `terminology.handlers.ts` (**Justin**) · `playwright/*.spec.ts` existentes (otros carriles) · el resto de `src/modules/terminology/import/**` (`index.ts` incluido), el servicio, el controlador, los DTO (**Itzan**) · `file-input` |
| `⚠️ RIESGO ALTO` | Playwright contra `ng serve`: **nunca `networkidle`** (con HMR no llega, da verdes falsos); `testId` y `data-testid` caen en elementos distintos (`CLAUDE.md` §5). El drag & drop real **no se automatiza**: se usa `setInputFiles` y el arrastre se verifica a mano en la doble revisión, declarado |
| `DÓNDE SE PRUEBA` | `yarn dev` (simulador) hoy; `yarn start:real-api` + API de Itzan al final si está. `E2E_BASE_URL=http://localhost:4200 yarn pw <spec> --workers=1 --trace on` |
| `LÍMITE DE RECURSOS` | Regla 70: **un** navegador, `--workers=1`, un `ng serve`. Cross-browser al final, uno por comando |

## 1. Antes de escribir una línea — instalación OBLIGATORIA del estándar

> **Esta sección no es opcional y no es el final del día: es lo primero.** Un prompt ejecutado sin
> el estándar cargado produce trabajo que después hay que rehacer, porque no va a tener plan, ni
> evidencia, ni reporte. **Si no podés completar este paso, estás `BLOQUEADO`: avisalo y no sigas.**

### 1.1 Instalar el estándar en tu checkout

```bash
# 1. Clonar el estandar al lado del repo de producto
git clone https://github.com/PabloArauzCaballero/AlovidaPromptManager.git ../AlovidaPromptManager

# 2. Copiarlo DENTRO de tu checkout de trabajo (Claude Code solo carga desde ./.claude/)
cp -r ../AlovidaPromptManager/.claude   ./
cp    ../AlovidaPromptManager/AGENTS.md ./
cp -r ../AlovidaPromptManager/.agents   ./   # solo si tu herramienta no lee .claude/

# 3. Verificar que quedo instalado (pega esta salida en tu daily)
ls .claude/skills | wc -l            # -> 178 (o más: el front trae 4 propias)
ls .claude/rules/[0-9]*.md | wc -l   # -> 15  (mas el README, que no es una regla)
python .claude/hooks/plan_gate.py --self-test    # -> 11 PASS, 0 FAIL
```

⚠️ **Antes de `cp -r`, mirá qué hay:** el front **ya tiene** `.claude/` propio con skills y revisores
(`visual-reviewer`, `frontend-reviewer`, `regression-auditor`). **No los pises**: fusioná y dejá constancia.
Esos revisores te sirven: son la segunda pasada independiente que la regla 35 exige.

### 1.2 Qué te instala eso

| Candado | Qué impide |
|---|---|
| `plan_gate.py` | Escribir código sin `PLAN.md` en disco. Nunca bloquea `.md` ni nada bajo `docs/` |
| `report_gate.py` | Cerrar la sesión con trabajo activo y sin `REPORTE.md`, o sin sus tres secciones |
| `blocker_gate.py` | Cerrar con microtareas en `BLOQUEADO` o `EN CURSO` sin declarar la simulación de los tres niveles del contrato (regla 65) |

**En cualquier otra herramienta los candados NO corren.** El plan y el reporte siguen siendo igual de
obligatorios; lo único que cambia es que nadie te va a frenar.

### 1.3 Skills que tenés que CARGAR para este lote

Son **29**: 11 del proceso y 18 propias de la calidad y el parseo XLSX.

**Del proceso — obligatorias para todos:**

| Skill | Para qué |
|---|---|
| `skills-router` | la entrada al catalogo: mapea la situacion concreta a la skill que toca |
| `factual-discovery` | confirmar el sistema real antes de planificar (Q-9 es exactamente esto) |
| `milestone-planning` | descomponer en hitos, subtareas y microtareas con CA y DoD |
| `anti-hallucination-guard` | localizar lo existente antes de afirmar que falta |
| `evidence-and-verification` | que podes afirmar con que evidencia; los tres peldaños de tus tres corridas |
| `scope-discipline` | no tocar nada fuera del alcance declarado |
| `rationalization-guard` | las excusas tipicas para saltear una verificacion, y su contramedida |
| `context-thrift` | leer por rangos y busqueda, no archivos enteros |
| `progress-reporting` | checkpoints visibles en cada apertura y cierre de microtarea |
| `finish-your-turn` | como se cierra un turno sin dejar nada colgado |
| `work-report-md` | como se redacta el reporte de cierre |

**De tu lote:**

| Skill | Para qué |
|---|---|
| `critical-double-review` | **la más importante de tu lote**: la segunda pasada adversarial con las diez preguntas, severidad y nota por pantalla |
| `e2e-playwright` | locators por rol/etiqueta/texto, web-first assertions, sin `waitForTimeout`, trace en fallo, consola y red vigiladas |
| `e2e-failure-triage` | clasificar cada rojo (`PRODUCT_BUG` / `TEST_BUG` / `ENVIRONMENT` / `DATA` / `EXTERNAL`) con reproducción |
| `visual-proof` | tres viewports, dos temas, cuatro estados; mirar cada captura |
| `visual-regression-testing` | estabilizar las capturas (fuentes, animaciones, datos fijos) para que la comparación valga |
| `test-data-management` | fixtures deterministas y limpiables; cada test crea su versión de prueba |
| `synthetic-test-data-generation` | los archivos de E2E son sintéticos y declarados |
| `accessibility-testing` | teclado completo y `axe` en la pantalla, con evidencia |
| `security-testing` | la matriz negativa desde afuera: sin token, rol insuficiente, archivo basura, zip bomb |
| `data-privacy-phi` | capturas y reporte sin datos de personas; el gate de PHI del trabajo entero |
| `terminology-value-sets` | qué es una designación: para resolver Q-9 con criterio |
| `qa-evidence-reporting` | el reporte de evidencia de QA enlazado desde el `REPORTE.md` |
| `regression-suite-management` | qué corre en la regresión conjunta y en qué orden |
| `agent-resource-control` | un navegador, un worker, un `ng serve` |
| `edge-case-data-catalog` | BOM, comillas, saltos dentro de celda, vacíos, Unicode, 255/256: los fixtures de §4 que generás |
| `dependency-management` | la lib XLSX se justifica antes: qué resuelve, tamaño, licencia, mantenimiento, audit |
| `unit-testing` | un comportamiento por test; el spec cruzado CSV↔XLSX |
| `native-code-patterns` | `xlsx-parser.ts` indistinguible del `csv-parser.ts` de Itzan |

Entrá siempre por `skills-router`: **no leas el catálogo entero, no sirve.**

### 1.4 DoD de esta sección — se verifica como cualquier otra

- [ ] `ls .claude/skills | wc -l` devolvió **178 o más**, y la salida está pegada en tu daily.
- [ ] `python .claude/hooks/plan_gate.py --self-test` devolvió **11 PASS, 0 FAIL**, salida pegada.
- [ ] Leíste `skills-router` y las 29 skills de las dos tablas, **empezando por `critical-double-review`**.
- [ ] Creaste tu `PLAN.md` **antes** del primer `Edit`/`Write` de código.

**Sin estas cuatro casillas, tu lote arranca en `BLOQUEADO`, no en `EN CURSO`.**

> ### ✅ Hechos ya verificados contra el árbol — no los repitas, pero tampoco los creas sin abrir el archivo
>
> | Dónde | Qué hay | Qué significa para vos |
> |---|---|---|
> | `playwright/` (front) | 18 specs (`carril-01-baseline`, `carril-19-route-health`, `carril-02-accesos-rbac`, `mockup-barrido`, `mockup-click-sweep`…), `playwright.config.ts`, `yarn pw`, `pw:rutas`, `pw:accesos` | Copiás la forma de **dos** (login, base URL, cómo evitan `networkidle`, `testId` vs `data-testid`) |
> | `CLAUDE.md` del front §5 | «Playwright contra `ng serve`: nunca esperar `networkidle`… `testId` y `data-testid` caen en elementos distintos» | Regla dura de tu spec |
> | `features/admin/terminology/version-import/version-import.html` | La pantalla **de hoy**: selects de sistema y versión, `app-file-input` con `accept` NDJSON, botón «Importar», bloque de resultado; `data-testid="importar-tope"` | Tu **baseline** E2E se escribe contra esto (lo que existe) y contra §3 (lo que Justin va a poner): la diferencia entre las dos corridas es la evidencia del avance |
> | `core/mock/handlers/terminology.handlers.ts:244` | Manejador `import-file` con respuesta fija | Hasta que Justin publique su doble (hora y media), tu corrida contra el simulador es «UI con backend simulado, respuesta fija» y se etiqueta así |
> | API `src/modules/terminology/dto/create-designation.dto.ts`, `entities/concept_designations.entity.ts`, `controllers/terminology-concepts.controller.ts:241` (`POST :conceptId/designations`) | Existen | **Q-9 se resuelve leyendo esos tres** y `repositories/`: ¿hay repositorio con alta? ¿qué exige el DTO (`language`, `use`, `value`)? ¿cómo se ubica el concepto por `code`? |
> | API `terminology-versions.controller.ts:108-140` | `@Roles('SECURITY_ADMIN')`, tope por `FILE_STORAGE_MAX_SIZE_BYTES` (10 MiB), `files: 1` | Tu matriz negativa desde afuera: sin token, `PRACTITIONER`, archivo de 11 MiB, dos archivos, PDF |
> | `alovida/CREDENCIALES-DEMO.md:20` | Cuenta `SUPERADMIN + SECURITY_ADMIN` | **No copies la contraseña** a ningún archivo. Sólo para la corrida contra la API real |
>
> ⚠️ **Lo que la verificación NO hizo: ejecutar.** H1 corre.

## 2. Resultado observable

| Hito | Prioridad | Qué queda demostrado |
|---|---|---|
| **H1** | `BLOQUEANTE` | Corte, baseline, **Q-9 resuelta en tu primera hora** y publicada en tu daily (Itzan y Justin la leen), fixtures de E2E copiados o creados. |
| **H2** | `ALTA` | `carga-masiva-baseline.spec.ts` contra la pantalla **de hoy** (lo que ya se puede automatizar) en verde; `carga-masiva.spec.ts` contra §3 escrito, con la lista de qué falla hoy porque el testid no existe (evidencia del «antes»). |
| **H3** | `ALTA` | Corrida contra la rama de Justin con el doble del simulador: **«UI con backend simulado»** en verde; consola y red vigiladas dentro del test; `axe` sin violaciones nuevas; teclado. |
| **H4** | `ALTA` | 24 capturas (3 × 2 × 4) por script reproducible, **primera y segunda pasada** con nota por pantalla; hallazgos `BLOQUEANTE`/`MAYOR` reportados a Justin en su daily con captura. |
| **H5** | `ALTA` | Gate de seguridad y PHI del trabajo entero (amenaza / control / test / resultado / residual) escrito con evidencia, incluida la matriz negativa desde afuera contra la API real **si está**. |
| **H6** | `ALTA` | Corrida contra la API real si está (peldaño `VERIFIED`), regresión del front, PR `MERGEABLE`, reporte de evidencia de QA enlazado. |
| **H7** | `ALTA` | Dependencia XLSX decidida con audit (45 min), **fixtures de la API pusheados en la hora 2**, `xlsx-parser.ts` idéntico al CSV de Itzan sobre los gemelos, PR API a `dev` `MERGEABLE`. |

> Orden: **H1 (Q-9 primero) → H7.S1 (dependencia, 45 min) → H7.S2 (fixtures, hora 2) → H2 → H7.S3 (parseador XLSX,
> mientras Justin no publica) → H3 (cuando Justin publique; si no, H4.S1) → H4 → H5 → H6.** Si Justin no publica en toda la noche, H3 y H4.S2 quedan `A MEDIAS`
> con el spec escrito y la corrida baseline como evidencia — **no** `BLOQUEADO`.

**Kill-test del turno:** `cat Marcelo-Daily-Noche-2026-09-25.md | grep -A3 "Q-9"` tiene que tener una decisión
con tres rutas citadas antes de la hora 1. `yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1` verde.
`yarn pw playwright/carga-masiva.spec.ts --workers=1` contra la rama de Justin: verde y etiquetado «backend
simulado». `evidencia/doble-revision.md` con 24 filas y dos pasadas. Si falta cualquiera, el hito no está hecho.

## 3. Alcance

**IN:** corte y baseline · Q-9 · dependencia XLSX con audit · fixtures de la API por script · `xlsx-parser.ts` con spec cruzado · fixtures de E2E (copia de los tuyos de H7.S2 o creados a mano con §4) · spec baseline contra
la pantalla de hoy · spec del contrato contra §3 · corrida contra el doble de Justin · `axe` y teclado · script
de capturas 3 × 2 × 4 · doble revisión con nota por pantalla · gate de seguridad y PHI · matriz negativa desde
afuera · corrida contra API real si está · regresión del front (`pw:rutas`, `pw:accesos`, suite Vitest) ·
`PLAN.md`, `REPORTE.md`, `evidencia/`, reporte de evidencia de QA.

**OUT:** cualquier archivo de Justin o Itzan (incluido `index.ts` de `import/`: el export lo agrega Pablo) (**los defectos se reportan, no se arreglan**) · specs
Playwright existentes de otros carriles · automatizar el drag & drop real (se verifica a mano, declarado) ·
mockear la API dentro del spec para ponerlo en verde (el doble es el del simulador, declarado; el spec no
intercepta rutas) · `retry`, `waitForTimeout`, subir timeouts · cargar catálogos reales · declarar `HECHO` sin correr el DoD.

## 4. Plan — hitos, subtareas y microtareas

Estados: `TODO` · `EN CURSO` · `HECHO` · `A MEDIAS` · `BLOQUEADO` · `DESCARTADO`. La columna «Si se traba» **se ejecuta, no se agenda.**

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
| H1.S1.M1 | Worktree limpio del front desde `origin/mockup` y rama | SHA en `PLAN.md` | `git fetch origin && git worktree add ../mch-front-marcelo origin/mockup && cd ../mch-front-marcelo && git checkout -b marcelo/carga-masiva-calidad-2026-09-25 && git rev-parse HEAD` | `worktree` ocupado → otro nombre | TODO |
| H1.S1.M2 | `yarn install` (PnP) + navegadores de Playwright si faltan | exit 0 | `yarn install; echo "exit=$?"; yarn playwright install chromium; echo "exit=$?"` → `evidencia/antes/install.txt` | Red → un reintento; si no, declarar | TODO |
| H1.S1.M3 | Baseline `typecheck` (incluye `playwright/tsconfig.json`) | exit code | `yarn typecheck; echo "exit=$?"` → `evidencia/antes/baseline.txt` | Rojo previo → M5 | TODO |
| H1.S1.M4 | Baseline `yarn pw:rutas --workers=1` (barrido de rutas de hoy) | Conteo | → `evidencia/antes/pw-rutas.txt` | `ng serve` no está → levantalo (`yarn dev`), un solo proceso | TODO |
| H1.S1.M5 | Clasificar cada rojo previo | Tabla o «ninguno» | `PLAN.md` | — | TODO |

#### H1.S2 — Q-9: ¿existe todo lo que «designaciones» necesita?

**CA:** Dado el módulo de terminología de la API, cuando se lee (sin ejecutar ni escribir), entonces se sabe si
la entidad, el DTO, el endpoint y el repositorio con alta existen, qué exige el DTO, y cómo se localiza un
concepto por `code` dentro de una versión; y la decisión está en tu daily antes de la hora 1.
**DoD:** tabla con ruta y línea por pieza + decisión `SÍ existe / NO existe (qué falta)`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H1.S2.M1 | DTO: `create-designation.dto.ts` — campos, obligatorios, validadores | Tabla | `grep -nE "@Is|@Api|!:|\?:" ../mantra-core-health-api/src/modules/terminology/dto/create-designation.dto.ts` | — | TODO |
| H1.S2.M2 | Entidad: `concept_designations.entity.ts` — columnas, FK a concepto, ¿clave estable (concepto + language + use)? | Tabla | `grep -nE "fieldName|unique" ….entity.ts` | — | TODO |
| H1.S2.M3 | Endpoint: `terminology-concepts.controller.ts:241` — qué servicio llama, qué devuelve | Tabla | `sed -n 235,262p …controller.ts` | — | TODO |
| H1.S2.M4 | Repositorio: `repositories/` — ¿hay `findByCode(versionId, code)` o equivalente? ¿alta de designación? | Tabla | `grep -rn "designation\|byCode\|findByCode" ../mantra-core-health-api/src/modules/terminology/repositories/*.ts` | — | TODO |
| H1.S2.M5 | Índice único en `src/orm/catalog/indexes/terminology.idx.ts` para designaciones | Hallazgo | `grep -n "concept_designations" …terminology.idx.ts` | — | TODO |
| H1.S2.M6 | Decisión Q-9 escrita en tu daily con hora: «SÍ: columnas `code, language, use, value`, clave estable X» o «NO: falta Y» | Sección con hora | `grep -n "Q-9" Marcelo-Daily-Noche-2026-09-25.md` | — | TODO |
| H1.S2.M7 | Commit + push del daily (en **este** repo de estándar: `repartos/2026-09-25/PromptNoche/Marcelo/`) para que Itzan y Justin lo lean | Visible | `git log origin/<rama> -1 --format=%ci` | Sin acceso al repo de estándar → pegalo también en `docs/trabajo/…/Q-9.md` del front y avisá por el canal que use el equipo | TODO |

#### H1.S3 — Fixtures de E2E

**CA:** Dado `playwright/fixtures/carga-masiva/`, cuando se lista, entonces están `ok-50.csv`, `ok-50.xlsx`,
`con-errores.csv`, `con-errores.xlsx`, `vacio-solo-encabezado.csv`, `no-es-nada.pdf`, `error-red.csv`,
`grande.csv` (11 MiB, generado, **no commiteado**: `.gitignore`), con `README.md` que dice «sintético».
**DoD:** `ls` + `README.md`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H1.S3.M1 | ¿Ya generaste los fixtures de la API (H7.S2)? Si todavía no, creá **ahora** a mano `ok-50.csv`, `con-errores.csv` y `no-es-nada.pdf` con §4 (son triviales) y reemplazalos por los generados en H7.S2.M6 | Decisión | `ls playwright/fixtures/carga-masiva/` | — | TODO |
| H1.S3.M2 | Copiar o crear los 8 archivos; `grande.csv` por script (`node -e` que escribe 11 MiB) e ignorado | 8 archivos | `ls playwright/fixtures/carga-masiva \| wc -l` → 9 (con README) | XLSX sin lib en el front → usá los de H7.S2; si aún no están, `con-errores.xlsx` se crea con cualquier planilla **a mano una vez** y se declara | TODO |
| H1.S3.M3 | `README.md`: tabla de §4 + «sintético, 2026-09-25» | Existe | `grep -n "sintético" README.md` | — | TODO |

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
| H2.S1.M1 | Leer 2 specs vecinos (`carril-02-accesos-rbac`, `mockup-barrido`): login, base URL, esperas, `testId` | Rutas + 3 rasgos en `PLAN.md` | — | — | TODO |
| H2.S1.M2 | Cuenta admin del simulador y ruta real de la pantalla | En `PLAN.md` | `grep -rn "SECURITY_ADMIN" src/app/core/mock \| head`; `grep -n -B10 "version-import" src/app/app.routes.ts` | — | TODO |
| H2.S1.M3 | `carga-masiva-baseline.spec.ts`: login → ruta → elegir sistema y versión (por rol/etiqueta) → `setInputFiles` NDJSON de 3 líneas → botón «Importar» → bloque de resultado visible | Compila | `yarn typecheck` | — | TODO |
| H2.S1.M4 | Consola y red vigiladas: `page.on('console')` con `error` y `page.on('response')` con ≥ 500 hacen fallar | Aserción presente | lectura + corrida | — | TODO |
| H2.S1.M5 | Correr | Verde | `E2E_BASE_URL=http://localhost:4200 yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1 --trace on` → `evidencia/h2/baseline.txt` | Rojo → clasificar (80.4); si es `PRODUCT_BUG` de la pantalla actual, **reportar** en `docs/trabajo/…/defectos.md`, no arreglar | TODO |

#### H2.S2 — El spec del contrato

**CA:** Dado §3 y §7, cuando se escribe el spec, entonces recorre el kill-test entero por `data-testid` y
locators por rol, cada test aislado (crea su versión de prueba por API del simulador o elige una en borrador),
sin `waitForTimeout` ni `networkidle`.
**DoD:** compila; corrida contra hoy con la lista de fallos esperados.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H2.S2.M1 | Test 1 «flujo feliz»: perfil → sistema → versión → `setInputFiles('ok-50.csv')` → `carga-validar` → `carga-informe` contiene «50» y «0» → `carga-importar` habilitado → clic → `carga-resumen` contiene «50» | Compila | `yarn typecheck` | — | TODO |
| H2.S2.M2 | Test 2 «idempotencia»: repetir con el mismo archivo → resumen «0 insertadas» y «50 omitidas» | Compila | idem | — | TODO |
| H2.S2.M3 | Test 3 «con errores»: `con-errores.xlsx` → `carga-errores` con 5 filas, cada una con columna; `carga-importar` deshabilitado; alerta «No se guardó nada» | Compila | idem | — | TODO |
| H2.S2.M4 | Test 4 «inválido»: `no-es-nada.pdf` → mensaje legible, sin stacktrace en pantalla | Compila | idem | — | TODO |
| H2.S2.M5 | Test 5 «vacío»: `vacio-solo-encabezado.csv` → «no tiene filas» | Compila | idem | — | TODO |
| H2.S2.M6 | Test 6 «fallo de red preserva»: `error-red.csv` → error visible **y** el nombre del archivo sigue en pantalla, selects intactos | Compila | idem | — | TODO |
| H2.S2.M7 | Test 7 «plantilla»: clic `carga-plantilla-csv` → `page.waitForEvent('download')` → nombre `plantilla-conceptos.csv` → contenido con encabezado `code,display,definition` | Compila | idem | — | TODO |
| H2.S2.M8 | Test 8 «descarga de errores»: tras test 3, clic `carga-descargar-errores` → descarga con 5 filas + encabezado | Compila | idem | — | TODO |
| H2.S2.M9 | Test 9 «sin doble envío»: dos clics rápidos en `carga-validar` → una sola petición (contar con `page.on('request')`) | Compila | idem | — | TODO |
| H2.S2.M10 | Test 10 «teclado»: Tab hasta `carga-archivo`, Enter abre el diálogo (`filechooser`), Tab → validar → Enter | Compila | idem | — | TODO |
| H2.S2.M11 | Test 11 «accesibilidad»: `axe` (`@axe-core/playwright` **si ya está** en `package.json`; si no, `DESCARTADO` con evidencia: no agregás dependencia) sin violaciones `serious`/`critical` | Compila o `DESCARTADO` | `grep -n "axe" package.json` | — | TODO |
| H2.S2.M12 | Cada test aislado y etiquetado en el título con el backend que lo respalda (`[backend simulado]` / `[API real]`) leído de una variable de entorno | Sin estado compartido | lectura | — | TODO |
| H2.S2.M13 | Correr contra la pantalla **de hoy** y guardar qué falla y por qué (testid ausente) | Lista | `yarn pw playwright/carga-masiva.spec.ts --workers=1` → `evidencia/h2/contrato-antes.txt` | — | TODO |
| H2.S2.M14 | Commit + push del spec y avisar en tu daily (Justin puede correrlo contra su rama) | Visible | `git log origin/<rama> -1` | — | TODO |

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
| H3.S1.M1 | ¿Está la rama de Justin? (revisar cada ~90 min **por condición**, no en bucle ciego: `git fetch` cuando cerrás una microtarea) | SHA | `git fetch && git log origin/justin/carga-masiva-pantalla-2026-09-25 -1` | No está aún → seguí con H4.S1 y H5; volvé acá al cerrar cada microtarea. Si no aparece en toda la noche: H3 `A MEDIAS` con la corrida baseline como evidencia | TODO |
| H3.S1.M2 | Worktree de su rama (sin mezclar con la tuya), `yarn install`, `yarn dev` | 4200 sirviendo | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200` | Puerto ocupado → cerrá tu `ng serve` primero (un solo proceso) | TODO |
| H3.S1.M3 | Correr tu spec (desde tu worktree, apuntando a ese 4200) | Verde o lista | `E2E_BACKEND=simulado yarn pw playwright/carga-masiva.spec.ts --workers=1 --trace on` → `evidencia/h3/simulado.txt` | Rojo → M4 | TODO |
| H3.S1.M4 | Clasificar cada rojo: `PRODUCT_BUG` (de Justin → `defectos.md` con captura y pasos, y línea en **su** daily), `TEST_BUG` (tuyo → corregir sin debilitar), `ENVIRONMENT`, `DATA` | Tabla | `docs/trabajo/2026-09-25-marcelo-calidad/defectos.md` | — | TODO |
| H3.S1.M5 | Re-correr tras corregir los `TEST_BUG` | Verde salvo `PRODUCT_BUG` abiertos | `evidencia/h3/simulado-2.txt` | — | TODO |
| H3.S1.M6 | Consola y red de la corrida: 0 `console.error`, 0 respuestas ≥ 500 | Salida | `evidencia/h3/consola-red.txt` | — | TODO |

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
| H4.S1.M1 | Leer cómo el repo ya captura (`scripts/run-recorrido*.mjs`, `playwright/mockup-barrido.spec.ts`) y cómo cambia de tema | Rutas + mecanismo de tema en `PLAN.md` | — | — | TODO |
| H4.S1.M2 | Script: login, ruta, 3 viewports, 2 temas, 4 estados disparados por `data-testid` de §3 (si no existen, captura el estado inicial y lo marca) | 24 PNG | `node scripts/capturas-carga-masiva.mjs && ls evidencia/h4/capturas \| wc -l` → 24 | — | TODO |
| H4.S1.M3 | Estabilidad: `prefers-reduced-motion`, `document.fonts.ready`, datos fijos (fixtures) | Dos corridas con diff de píxeles mínimo | `node … ; node … ; compare` (o hash) → pegado | Diff grande → identificar qué se mueve (reloj, animación) y fijarlo | TODO |
| H4.S1.M4 | Commit + push del script | Visible | `git log origin/<rama> -1` | — | TODO |

#### H4.S2 — Las dos pasadas (contra la rama de Justin)

**CA:** Dadas las 24 capturas de la rama de Justin, cuando se revisan, entonces la primera pasada tiene una
línea por captura contra el CA de la pantalla, y la segunda —**después** de cerrar la primera— responde las
diez preguntas de `critical-double-review` §3 por captura con severidad y nota.
**DoD:** `doble-revision.md` completo; hallazgos reportados.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H4.S2.M1 | Correr el script contra la rama de Justin | 24 PNG | `evidencia/h4/capturas-justin/` | Rama no está → `A MEDIAS`; las dos pasadas se hacen sobre la pantalla de hoy como ensayo, marcado «ensayo» | TODO |
| H4.S2.M2 | Primera pasada: una línea por captura (`visual-proof` §5: layout, texto, estados, tema, sin scroll horizontal) | 24 líneas | `doble-revision.md` §1 | — | TODO |
| H4.S2.M3 | Segunda pasada, adversarial: las diez preguntas por captura, severidad `BLOQUEANTE` / `MAYOR` / `MENOR`, nota por pantalla; ante la duda, la más baja | 24 notas | `doble-revision.md` §2 | Podés usar el revisor `visual-reviewer` de `.claude/agents/` del front como segundo par de ojos (un agente a la vez, regla 70) | TODO |
| H4.S2.M4 | Drag & drop real, **a mano**: arrastrar `ok-50.csv` desde el explorador a la zona en 1280 y 768; anotar si se toma y si `is-dragging` se ve | 2 observaciones | `doble-revision.md` §3 | — | TODO |
| H4.S2.M5 | Reportar cada `BLOQUEANTE`/`MAYOR` a Justin: `defectos.md` + línea en su daily con ruta a la captura | Lista | `grep -c "BLOQUEANTE\|MAYOR" doble-revision.md` = filas en `defectos.md` | — | TODO |
| H4.S2.M6 | Si Justin corrige durante la noche: re-capturar y **las dos pasadas otra vez** sobre la re-captura | Sección §4 | `doble-revision.md` §4 | No corrigió → queda `RECHAZADA`/`CON RESERVAS` en el reporte, no se maquilla | TODO |

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
| H5.S1.M1 | Subida sin rol → `@Roles('SECURITY_ADMIN')` (`terminology-versions.controller.ts`) | Fila | `gate-seguridad-phi.md` | — | TODO |
| H5.S1.M2 | Archivo enorme / zip bomb → tope de multer (`loadStorageEnv().maxSizeBytes`) + tope de filas XLSX (tuyo: `MAX_FILAS_XLSX`, H7.S3.M6) | Fila (o «AUSENTE» → riesgo) | idem | — | TODO |
| H5.S1.M3 | Contenido del archivo en logs → `grep -rn "logger\." …/import/*.ts …/concept-file-import.service.ts …/row-validator.ts` | Fila con salida del `grep` | idem | Ramas no están → sobre `dev`, marcado «pre-cambio» | TODO |
| H5.S1.M4 | 500 con stacktrace ante binario basura → `IMPORT_FORMAT_UNSUPPORTED` (Itzan) | Fila | idem | — | TODO |
| H5.S1.M5 | CSV injection en la descarga de errores del cliente → prefijo `'` (Justin, H4.S2.M8) | Fila | idem | — | TODO |
| H5.S1.M6 | Dos archivos en el multipart (`files: 1`) → 4xx | Fila | idem | — | TODO |
| H5.S1.M7 | PHI: fixtures sintéticos declarados (tus dos READMEs: API y E2E); capturas sin datos de personas; ningún catálogo real cargado | Fila | idem | — | TODO |
| H5.S1.M8 | Rate limit del endpoint (hallazgo de Itzan H4.S2.M7 o tu `grep`) | Fila | idem | — | TODO |

#### H5.S2 — Matriz negativa desde afuera (contra la API real, si está)

**CA:** Dada la API de Itzan arrancada, cuando se llama sin token / `PRACTITIONER` / 11 MiB / dos archivos /
PDF, entonces 401 / 403 / 413 / 4xx / 422, y `count(*)` no cambia.
**DoD:** `curl` pegados o `DESCARTADO` con evidencia de que la API no estuvo.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H5.S2.M1 | ¿Está la rama de Itzan y arranca? (worktree, `.env`, `docker compose up -d postgres postgres-init`, `yarn start:dev`, readiness) | 200 o no | `evidencia/h5/api.txt` | No → `DESCARTADO` con la salida; la matriz queda cubierta por los specs de Itzan, y lo anotás | TODO |
| H5.S2.M2 | Token admin (cuenta demo, sin copiar la contraseña) y token `PRACTITIONER` si hay | Variables | — | Sin `PRACTITIONER` → sólo sin token | TODO |
| H5.S2.M3 | Los cinco `curl` negativos + `count(*)` antes/después | 5 HTTP + 2 conteos | `evidencia/h5/negativos.txt` | — | TODO |
| H5.S2.M4 | Riesgo residual por amenaza sin control | Columna llena | `gate-seguridad-phi.md` | — | TODO |

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
| H6.S1.M1 | Ambas ramas arriba y arrancables | Sí/no | `git fetch` ×2 + readiness | Falta una → `DESCARTADO` con evidencia; el peldaño máximo del E2E es «backend simulado», declarado | TODO |
| H6.S1.M2 | `yarn start:real-api` en el worktree de Justin, spec con `E2E_BACKEND=real` | Verde | `evidencia/h6/real.txt` + trace | Rojo → clasificar y reportar al dueño | TODO |
| H6.S1.M3 | `yarn pw:rutas --workers=1` y `yarn pw:accesos --workers=1`, **en serie** | Sin rojos nuevos vs baseline | `evidencia/h6/regresion-pw.txt` | — | TODO |
| H6.S1.M4 | `yarn test` completo (Vitest, ~140 s) en tu worktree | Sin rojos nuevos | `evidencia/h6/test.txt` | — | TODO |
| H6.S1.M5 | Cross-browser del spec: `--project=firefox` y `--project=webkit` si el config los define, **uno por comando** | Salidas | `evidencia/h6/cross.txt` | No definidos → `DESCARTADO` con `grep -n "projects" playwright.config.ts` | TODO |

#### H6.S2 — PR y cierre

**CA:** Dado el PR, cuando se consulta con `gh`, entonces `MERGEABLE`, no draft, checks sin `fail`.
**DoD:** `evidencia/pr/`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H6.S2.M1 | Diff sólo con tus archivos | `grep` vacío | `git diff origin/mockup --stat \| grep -vE "playwright/carga-masiva|playwright/fixtures/carga-masiva|scripts/capturas-carga-masiva|docs/trabajo/2026-09-25-marcelo"` → vacío | Aparece → revertir | TODO |
| H6.S2.M2 | Rebase sobre `origin/mockup` | Limpio | `git fetch && git rebase origin/mockup && git status` | Conflicto → resolvelo | TODO |
| H6.S2.M3 | PR con plantilla (qué, cómo correrlo, contra qué backend, evidencia, defectos reportados) | URL | `gh pr create --base mockup …` | `gh` sin auth → push + `evidencia/pr/body.md` | TODO |
| H6.S2.M4 | `gh pr view <n> --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefName` | `MERGEABLE` | `evidencia/pr/view.json` | `UNKNOWN` → bucle `until`; `BEHIND` → M2 | TODO |
| H6.S2.M5 | `gh pr checks <n> --watch --fail-fast` | Sin `fail` | `evidencia/pr/checks.txt` | Rojo → clasificar; `EXTERNAL` → `A MEDIAS` | TODO |
| H6.S2.M6 | Reporte de evidencia de QA (`qa-evidence-reporting`): qué se corrió, contra qué backend, qué pasó, qué no se cubrió | Archivo | `docs/trabajo/2026-09-25-marcelo-calidad/evidencia/qa-evidencia.md` | — | TODO |
| H6.S2.M7 | Procesos corriendo (`ng serve` ×n, API, compose, navegadores) cerrados o declarados | Lista | `Get-Process node,chrome`; `docker compose ps` | — | TODO |
| H6.S2.M8 | `REPORTE.md` con `> **AVANCE: <HECHO> / 98 — <%>.**` primero, tres secciones, peldaño por área (E2E: simulado / real), enlaces a `doble-revision.md`, `gate-seguridad-phi.md`, `qa-evidencia.md`, `defectos.md` | `head -3` | `head -3 docs/trabajo/2026-09-25-marcelo-calidad/REPORTE.md` | — | TODO |
| H6.S2.M9 | Daily `Marcelo-Daily-Noche-2026-09-25.md` con §1.4, Q-9 con hora, avance, defectos reportados por persona | Existe | `ls` | — | TODO |

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
| H7.S1.M1 | Worktree de la API desde `origin/dev` y rama `marcelo/carga-masiva-xlsx-2026-09-25`; `yarn install`; baseline `lint`/`typecheck`/`build` | SHA + 3 exit codes | `git worktree add ../mch-api-marcelo origin/dev && … && git rev-parse HEAD`; → `evidencia/antes/api-baseline.txt` | `worktree` ocupado → otro nombre | TODO |
| H7.S1.M2 | Confirmar que nada CSV/XLSX está instalado transitivamente | Lista o vacío | `yarn why xlsx; yarn why exceljs; yarn why csv-parse; yarn why papaparse; yarn why fast-csv` → pegado | — | TODO |
| H7.S1.M3 | ¿Qué usa el equipo en repos hermanos? | Lista | `grep -l "exceljs\|\"xlsx\"" ../*/package.json ../*/*/package.json 2>/dev/null` → pegado | Ninguno → candidata por omisión `exceljs` | TODO |
| H7.S1.M4 | Evaluar **una** candidata: qué resuelve, tamaño instalado (`du -sh node_modules/<lib>`), licencia, última publicación (`yarn npm info <lib> --fields time --json`), audit | Tabla con 5 datos | `yarn add <lib> && yarn npm audit; echo "exit=$?"` → pegado | Audit `high`/`critical` sin fix → **no se agrega**, H7.S3 `A MEDIAS`; audit sin red → `--environment production` una vez; si no, decidí por fecha y **anotá que el audit no corrió** | TODO |
| H7.S1.M5 | ¿Lee desde `Buffer`? ¿Permite acotar filas/hojas? Verificado **en `node_modules/<lib>`**, no de memoria | Rutas citadas | `grep -n "Buffer\|load(" node_modules/<lib>/index.d.ts \| head` → pegado | — | TODO |
| H7.S1.M6 | `decision-dependencia.md` (Contexto / Decisión / Consecuencias / Reversa; cita la cabecera del servicio que descartó la dependencia) | Archivo | `ls docs/trabajo/2026-09-25-marcelo-calidad/` | — | TODO |
| H7.S1.M7 | Commit de `package.json` + `yarn.lock` **solos** + push | Sólo esos 2 archivos | `git show --stat HEAD` | — | TODO |

#### H7.S2 — Fixtures sintéticos de la API publicados en la hora 2

**CA:** Dado `generar-fixtures.mjs`, cuando se corre dos veces, entonces produce los 14 CSV de §4 byte-idénticos
(sin fechas ni aleatoriedad) más sus gemelos XLSX, `grande-10k.xlsx`, `celda-numerica.xlsx` y `no-es-nada.pdf`,
con `README.md` de procedencia sintética; y los tuyos de E2E (H1.S3) son **copia** de estos.
**DoD:** `ls test/fixtures/terminology-import | wc -l` ≥ 31; `sha256sum` iguales en dos corridas; push con hora.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H7.S2.M1 | Leer 2 `README.md` de `test/fixtures/**` de la API para copiar forma | Rutas en `PLAN.md` | — | — | TODO |
| H7.S2.M2 | `generar-fixtures.mjs` que escribe los 14 CSV de §4 con contenidos **exactos** (posiciones de error 5/9/14/20/33 en `con-errores`) + `no-es-nada.pdf` | 15 archivos | `node test/fixtures/terminology-import/generar-fixtures.mjs && ls *.csv \| wc -l` → 13 (+ pdf + README) | — | TODO |
| H7.S2.M3 | Determinismo | Hashes iguales | `sha256sum *.csv > a; node generar-fixtures.mjs; sha256sum *.csv > b; diff a b` → vacío | — | TODO |
| H7.S2.M4 | Gemelos `.xlsx` + `grande-10k.xlsx` + `celda-numerica.xlsx` (celda `10` numérica, fórmula `=1+1` con valor cacheado y otra sin) con la lib; hoja `conceptos`; fechas de creación fijas si la lib las escribe | 16 `.xlsx` | `ls *.xlsx \| wc -l` → 16 | XLSX descartado en H7.S1 → sólo CSV; anotá | TODO |
| H7.S2.M5 | `README.md`: tabla de §4 + «sintético, generado el 2026-09-25 por `generar-fixtures.mjs`, sin procedencia externa» | Existe | `grep -n "sintético" README.md` | — | TODO |
| H7.S2.M6 | Commit + **push dentro de la hora 2** + línea en tu daily con hora; reemplazar tus copias de E2E por estas (`sha256sum` iguales) | Visible | `git log origin/marcelo/carga-masiva-xlsx-2026-09-25 -1 --format=%ci` | — | TODO |

#### H7.S3 — Parseador XLSX contra el contrato de Itzan

**CA:** Dado cada fixture XLSX, cuando se parsea con `XlsxParser`, entonces el resultado es **idéntico** al de
`CsvParser` sobre su gemelo; `celda-numerica` convierte `10` a `"10"`, la fórmula con valor cacheado a su
valor y la sin valor a problema; `grande-10k` parsea en < 5 s.
**DoD:** `xlsx-parser.spec.ts` en verde (spec cruzado parametrizado + 3 casos + límite); PR API `MERGEABLE`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Si se traba | Estado |
|---|---|---|---|---|---|
| H7.S3.M1 | Traer `row-contract.ts` de Itzan: `git fetch && git cherry-pick <SHA de su commit del contrato>` (un archivo) | Compila | `yarn typecheck` | Itzan no publicó a la hora 1 → escribí `row-contract.ts` vos con §1 **literal** (contenido idéntico por contrato) y anotalo: Pablo conserva el de Itzan al integrar | TODO |
| H7.S3.M2 | `src/modules/terminology/import/xlsx-parser.ts`: `class XlsxParser implements ParseadorDeArchivo { formato = 'xlsx' }`, lee desde `Buffer`, hoja `conceptos` o la primera, celdas a texto, columnas por nombre y alias del perfil (si `import-profiles.ts` de Itzan aún no está, copiá el perfil `conceptos` de §1 en el spec y anotalo) | Compila | `yarn typecheck` | XLSX descartado → `DESCARTADO` con referencia a H7.S1.M4 | TODO |
| H7.S3.M3 | Spec cruzado: para cada fixture gemelo, `deepEqual(csv.parsear(csvBuf, perfil), xlsx.parsear(xlsxBuf, perfil))` con el `CsvParser` de Itzan si está (`cherry-pick` de su commit) o, si no, contra la tabla de §4 escrita a mano en el spec | 12 PASS | `yarn test src/modules/terminology/import/xlsx-parser` | — | TODO |
| H7.S3.M4 | Spec: `celda-numerica` (3 casos) | 3 PASS | idem | — | TODO |
| H7.S3.M5 | Spec de límite: `grande-10k.xlsx` < 5 s; `heapUsed` antes/después pegado | PASS con tiempo | idem | Tarda más → meta «parsea», tiempo como riesgo; **no subas `testTimeout`** | TODO |
| H7.S3.M6 | Acotar lectura: `MAX_FILAS_XLSX` nombrada y documentada (zip bomb) si la lib lo permite; si no, riesgo anotado | Constante o riesgo | `grep -n "MAX_FILAS" xlsx-parser.ts` | — | TODO |
| H7.S3.M7 | **No tocás `index.ts`** (es de Itzan): Pablo agrega el export al integrar. `xlsx-parser.ts` queda autocontenido y exporta la clase | `grep` vacío | `git diff origin/dev --stat \| grep -E "index.ts|csv-parser|format-detector|import-profiles|services/|controllers/|dto/"` → vacío (salvo el cherry-pick del contrato) | — | TODO |
| H7.S3.M8 | Sin contenido de filas en logs | `grep` vacío | `grep -n "console\.\|logger\." xlsx-parser.ts` → vacío | — | TODO |
| H7.S3.M9 | Rebase sobre `origin/dev`, PR API con plantilla (`gh pr create --base dev …`), `gh pr view` + `gh pr checks` pegados | `MERGEABLE` | `evidencia/pr/api-view.json`, `api-checks.txt` | `gh` sin auth → push + cuerpo en `evidencia/pr/api-body.md`; `UNKNOWN` → bucle `until` | TODO |

## 5. Ambigüedades registradas

| ID | Ambigüedad | Supuesto con el que trabajás | Quién puede resolverla | Qué bloquea |
|---|---|---|---|---|
| Q-9 | ¿Existe todo lo que «designaciones» necesita? | **La resolvés vos** en H1.S2 y la publicás | Vos → Pablo | H1.S2.M6 |
| Q-M1 | ¿El drag & drop se automatiza? | No: `setInputFiles` + verificación manual declarada | Pablo | H4.S2.M4 |
| Q-M2 | ¿`axe` está disponible? | Sólo si `@axe-core/playwright` ya está en `package.json`; no se agrega | Pablo | H2.S2.M11 |
| Q-M3 | Si Justin no publica en toda la noche | H3 y H4.S2 `A MEDIAS` con baseline; nunca `BLOQUEADO` | — | H3 |
| Q-M4 | Cuenta `PRACTITIONER` demo para la matriz | Si no hay, sólo «sin token» desde afuera; el resto lo cubren los specs de Itzan | Pablo | H5.S2.M2 |

## 6. Definition of Done del hito

- [ ] Todas sus microtareas en `HECHO`, o en `A MEDIAS`/`BLOQUEADO`/`DESCARTADO` **con las cuatro respuestas**.
- [ ] Q-9 publicada antes de la hora 1 con tres rutas citadas.
- [ ] Salida literal de cada DoD en `evidencia/`.
- [ ] Ningún archivo de otros en el diff; **ningún defecto ajeno arreglado** (todos reportados con captura y pasos).
- [ ] Spec sin `waitForTimeout`, sin `networkidle`, sin `retry`, sin selectores por estructura; cada test aislado y etiquetado con su backend.
- [ ] Consola y red vigiladas **dentro** del spec.
- [ ] 24 capturas × 2 pasadas con nota por pantalla; segunda pasada hecha **después** de cerrar la primera.
- [ ] Gate de seguridad y PHI con ≥ 7 amenazas, control con ruta y línea, y riesgo residual.
- [ ] Peldaño del E2E declarado: «backend simulado» o «API real».
- [ ] Fixtures de la API pusheados en la hora 2; dependencia XLSX con audit pegado y `yarn.lock` commiteado solo; `xlsx-parser.ts` idéntico al CSV sobre los gemelos (spec cruzado) sin tocar `index.ts`.
- [ ] Regresión del front sin rojos nuevos; PR `MERGEABLE` pegado; `REPORTE.md` con avance primero y reporte de QA enlazado.

## 7. Cómo trabajás toda la noche sin nadie

1. **Q-9 antes de la hora 1.** Es lo primero después del baseline; Itzan y Justin lo leen de tu daily. **Fixtures de la API en la hora 2** (H7.S2): Itzan y Justin los usan.
2. **Checkpoint** por microtarea; nunca más de tres operaciones materiales sin uno.
3. **«Si se traba» se ejecuta ya.** Si no alcanza: `A MEDIAS` y seguís.
4. **No esperás a Justin ni a Itzan.** Mirás sus ramas **al cerrar cada microtarea** (un `git fetch`), no en un bucle. Mientras no están: H2, H4.S1, H5.S1 son tuyos enteros.
5. **Los defectos ajenos se reportan, nunca se arreglan.** Con captura, pasos, clase y dueño.
6. **Un navegador, un worker, un `ng serve`.** Antes de levantar el de Justin, cerrás el tuyo.
7. `REPORTE.md` con el avance primero; tres secciones; procesos enumerados.
8. **Tu daily** es `Marcelo-Daily-Noche-2026-09-25.md`, en la carpeta de arriba.

## 8. Revisión adversarial antes de cerrar

1. ¿Q-9 la resolviste leyendo tres archivos con ruta y línea, o «seguro que existe»?
2. ¿Arreglaste algo en la pantalla de Justin «porque era una línea»?
3. ¿El spec intercepta rutas o mockea respuestas para ponerse en verde?
4. ¿Hay un `waitForTimeout`, `networkidle`, `retry` o timeout subido?
5. ¿La segunda pasada la hiciste antes de cerrar la primera, o «juntas»?
6. ¿Alguna captura `RECHAZADA` quedó reportada como `HECHO` en algún lado?
7. ¿Declaraste `[API real]` una corrida contra el simulador?
8. ¿Hay datos de personas en alguna captura o en el reporte?
9. ¿Hay alguna microtarea en `BLOQUEADO` cuya columna «Si se traba» no ejecutaste?
10. ¿El PR dice `MERGEABLE` en un archivo, o lo estás recordando?
11. ¿Tocaste `index.ts`, `csv-parser.ts` o el servicio de Itzan «porque el export era una línea»?
12. ¿La lib XLSX entró sin audit pegado, o con una vulnerabilidad `high` «que no aplica»?
