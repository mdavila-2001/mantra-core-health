# Reserva única y cotizaciones del paciente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer única y visible la navegación de reserva, paralelizar la disponibilidad por sede y construir la pantalla de cotizaciones del paciente con datos trazables.

**Architecture:** La tarjeta de resultado recibe una opción opt-in para bloquear activaciones repetidas sin modificar sus demás consumidores. La disponibilidad mantiene un `ViewState` global y modela por sede el resultado de sus peticiones paralelas. Cotizaciones concentra normalización, ordenamiento y procedencia en un módulo de cuenta, y compone fuentes existentes sin crear precios ni contratos nuevos.

**Tech Stack:** Angular 21 standalone/signals, RxJS, Vitest, HttpTestingController, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-reserva-y-cotizaciones-design.md`

## Global Constraints

- No modificar `src/app/app.routes.ts`, `core/navigation/**`, `booking-new/**`, el interceptor mock ni módulos dueños de documentos.
- Ningún precio sin fuente; UMA se muestra como UMA y no se convierte a bolivianos.
- Todo cambio de comportamiento empieza con una prueba que falla y termina con su suite focalizada en verde.
- Los controles nuevos tienen nombre accesible y no dependen sólo del color.

## Review Focus

- Una navegación que cancela o falla debe liberar el enlace que estaba ocupado.
- Una sede con cupos nunca debe solicitar su búsqueda de próximo hueco.
- Un precio ausente debe ordenarse después de los precios conocidos.
- Ordenar por cercanía sin origen debe explicar cómo elegirlo, sin producir un orden falso.
- Una receta u orden sin ítems no debe crear una cotización vacía que parezca válida.

### Task 1: Navegación única del directorio

**Files:**
- Modify: `src/app/shared/components/molecules/result-card/result-card.ts`
- Modify: `src/app/shared/components/molecules/result-card/result-card.html`
- Modify: `src/app/shared/components/molecules/result-card/result-card.spec.ts`
- Modify: `src/app/features/directory/practitioners-directory/practitioners-directory.ts`
- Modify: `src/app/features/directory/practitioners-directory/practitioners-directory.html`
- Modify: `src/app/features/directory/practitioners-directory/practitioners-directory.spec.ts`

**Interfaces:**
- Produces: `ResultCard.navigationPending: InputSignal<boolean>` and `navigationRequested: OutputEmitterRef<void>`.
- Consumes: `Router.events` to derive the directory navigation state.

- [ ] **Step 1: Write failing component and directory tests**

Test that a pending result-card prevents a second click/Enter, reports `aria-busy`, and that a specialty card becomes pending until router completion.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `corepack yarn test --include=src/app/shared/components/molecules/result-card/result-card.spec.ts --include=src/app/features/directory/practitioners-directory/practitioners-directory.spec.ts --watch=false`

Expected: the new assertions fail because neither pending state nor event guard exists.

- [ ] **Step 3: Implement the opt-in navigation guard**

Add the input/output to `ResultCard`; use an explicit click/keyboard guard that prevents navigation when pending. Derive the directory signal from `NavigationStart` and terminal navigation events, passing it only to this directory.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: pass with no changed behavior in cards that do not opt in.

- [ ] **Step 5: Commit**

`git add src/app/shared/components/molecules/result-card src/app/features/directory/practitioners-directory && git commit -m "fix: prevent duplicate directory navigation"`

### Task 2: Disponibilidad concurrente y estado por sede

**Files:**
- Modify: `src/app/features/directory/practitioner-availability/practitioner-availability.ts`
- Modify: `src/app/features/directory/practitioner-availability/practitioner-availability.html`
- Modify: `src/app/features/directory/practitioner-availability/practitioner-availability.spec.ts`

**Interfaces:**
- Produces: `SedeConCupos` with the terminal state needed to render a per-site loading and empty state.
- Consumes: `SchedulingClient.listResources` and `SchedulingClient.listSlots` one time per resource and date window.

- [ ] **Step 1: Write failing availability tests**

Test that all visible-week requests are issued before any response, no next-window request is issued for a resource with visible slots, and a selected slot blocks all slot controls while navigation is in progress.

- [ ] **Step 2: Run the availability spec and verify RED**

Run: `corepack yarn test --include=src/app/features/directory/practitioner-availability/practitioner-availability.spec.ts --watch=false`

Expected: the pending-control assertion fails; the existing request behavior is captured before refactor.

- [ ] **Step 3: Implement minimal concurrency and navigation state**

Keep per-resource week reads concurrent. Launch each required next-window lookup only after its week is known empty, keep resources independent, and render a status per site while its result resolves. Track the chosen slot id until router navigation settles.

- [ ] **Step 4: Run the availability spec and verify GREEN**

Run the Step 2 command. Expected: pass.

- [ ] **Step 5: Commit**

`git add src/app/features/directory/practitioner-availability && git commit -m "perf: make practitioner availability interactions resilient"`

### Task 3: Dominio puro de cotizaciones del paciente

**Files:**
- Create: `src/app/features/account/cotizaciones/cotizaciones.types.ts`
- Create: `src/app/features/account/cotizaciones/cotizaciones.logic.ts`
- Create: `src/app/features/account/cotizaciones/cotizaciones.logic.spec.ts`

**Interfaces:**
- Produces: `CotizacionResultado`, `VerticalCotizacion`, `ordenarResultados()` and `filtrarResultados()`.
- Consumes: an explicit `price` with `source`, optional `distanceKm`, normalized text and document items.

- [ ] **Step 1: Write failing pure-logic tests**

Cover accent-insensitive search, vertical filtering, price ordering with `null` last, distance ordering only with an origin, and a document with no items.

- [ ] **Step 2: Run the logic spec and verify RED**

Run: `corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.logic.spec.ts --watch=false`

Expected: module-not-found failure.

- [ ] **Step 3: Implement types and pure functions**

Represent unknown prices as `null` with a display source, never a fallback numeric value. Keep sorting and normalization side-effect free.

- [ ] **Step 4: Run the logic spec and verify GREEN**

Run the Step 2 command. Expected: pass.

- [ ] **Step 5: Commit**

`git add src/app/features/account/cotizaciones && git commit -m "feat: add traceable patient quotation results"`

### Task 4: Pantalla de cotizaciones y documentos existentes

**Files:**
- Create: `src/app/features/account/cotizaciones/cotizaciones.ts`
- Create: `src/app/features/account/cotizaciones/cotizaciones.html`
- Create: `src/app/features/account/cotizaciones/cotizaciones.css`
- Create: `src/app/features/account/cotizaciones/cotizaciones.spec.ts`

**Interfaces:**
- Consumes: Task 3 functions, `SearchOriginPicker`, `ClinicalClient.getSummary` and public directory data through existing clients.
- Produces: an isolated standalone `Cotizaciones` component; route registration remains Ender's dependency.

- [ ] **Step 1: Write failing component tests**

Assert loading/data/empty/error states, an actionable no-origin state, document selection that changes vertical and query, and visible “Precio no publicado” for missing sources.

- [ ] **Step 2: Run the component spec and verify RED**

Run: `corepack yarn test --include=src/app/features/account/cotizaciones/cotizaciones.spec.ts --watch=false`

Expected: module-not-found failure.

- [ ] **Step 3: Implement the standalone surface**

Use existing atoms and `SearchOriginPicker`; render input, select controls, an accessible document selector, result cards with icon-plus-text actions, and all declared states. Use only current clients or a documented local fixture boundary; do not alter router or document owners.

- [ ] **Step 4: Run the component spec and verify GREEN**

Run the Step 2 command. Expected: pass.

- [ ] **Step 5: Commit**

`git add src/app/features/account/cotizaciones && git commit -m "feat: add patient quotation screen"`

### Task 5: Evidencia, reporte y regresión

**Files:**
- Create: `docs/trabajo/2026-09-23-reserva-y-cotizaciones/PLAN.md`
- Create: `docs/trabajo/2026-09-23-reserva-y-cotizaciones/REPORTE.md`
- Create: `docs/trabajo/2026-09-23-reserva-y-cotizaciones/evidencia/antes/baseline.md`

- [ ] **Step 1: Record baseline and dependency evidence**

Record the present build failure, the missing route/menu dependency, slot-filter capability and absent medical-service-order contract with their commands and scope.

- [ ] **Step 2: Run focused lint/typecheck/tests**

Run: `corepack yarn lint`, `corepack yarn typecheck`, focused specs, and the full test command.

Expected: no failures attributable to this branch; preserve unrelated baseline failures verbatim.

- [ ] **Step 3: Attempt visual and E2E evidence**

Start only the required local server, run the serial requested routes when compilation allows, capture the actual blocker otherwise, then stop the server.

- [ ] **Step 4: Write the final report and commit**

Include completed work, incomplete work with cause/attempt/next step, evidence level, and confirm no process remains.

`git add docs && git commit -m "docs: report reservation and quotation progress"`
