# Correcciones de receta para mockup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar el bloque de medicación de la maqueta a C-15–C-22, preservando el contrato de recetas y sin inventar datos clínicos.

**Architecture:** El cambio queda concentrado en `MedicationBlock`: se eliminan los caminos de descarga, demostración y favoritos; se simplifica el formulario para que la dosis sea siempre texto y la unidad no viaje; y se mantienen selectores reutilizables para opciones finitas. La frecuencia por defecto se lee solamente de una propiedad publicada por el catálogo; si esa propiedad no está disponible, el formulario conserva la entrada manual y el estado se documenta como bloqueado.

**Tech Stack:** Angular 21 standalone, signals, Vitest 4, Yarn 4.18, Playwright.

**Spec:** `AlovidaPromptManager/repartos/2026-09-20/PromptNoche/Justin/Noche-CorreccionesDoctor.Receta/RecetaLimpiaMotivoDosisYPosologia.md` (C-15–C-22).

## Global Constraints

- Base: `mockup`; el PR se abre contra `mockup`, nunca se escribe directamente en la rama compartida.
- Alcance de código: `src/app/features/clinical-record/patient-chart/medication-block/**` y, sólo si queda sin consumidores, `src/app/core/data-access/prescription-favorites/**`.
- No tocar `consultation/**`, `core/mock/**` ni `shared/**`; cada dependencia se registra en el reporte.
- El medicamento sigue siendo un concepto de catálogo; no se habilita texto libre para él.
- No se inventa una frecuencia por medicamento ni se presenta una sugerencia como indicación clínica.
- Mantener tokens existentes, controles `app-select`/`app-menu`, accesibilidad por teclado y pruebas RED→GREEN.

## Review Focus

- Una receta emitida conserva sus acciones clínicas, pero no ofrece descarga desde el bloque de escritura.
- Abrir el formulario no emite solicitudes a `prescription-favorites`.
- Una receta sin diagnóstico puede guardar un motivo escrito y una receta sin “para qué” sigue siendo válida.
- La dosis escrita prevalece aunque el catálogo exponga presentación o concentración; `unitConceptId` se omite.
- Una frecuencia mal formada o ausente en el catálogo no deja el formulario inutilizable ni rellena una pauta inventada.

---

### Task 1: Línea de base y contrato actual

**Files:**
- Create: `docs/trabajo/2026-09-21-correcciones-receta-mockup/PLAN.md`
- Create: `docs/trabajo/2026-09-21-correcciones-receta-mockup/evidencia/`
- Modify: none

**Interfaces:**
- Consumes: `origin/mockup`, `MedicationBlock` y su spec existente.
- Produces: SHA, gates de partida, inventario de dependencias y evidencia para distinguir regresiones previas.

- [ ] **Step 1: Fijar el corte y crear el plan operativo del repo**

Run: `git fetch origin; git log -1 --format='%H %ad %s' origin/mockup`

Expected: SHA y fecha escritos en `docs/trabajo/2026-09-21-correcciones-receta-mockup/PLAN.md` antes de editar producción.

- [ ] **Step 2: Ejecutar la prueba dirigida de partida**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: la suite dirigida termina con exit 0 o cada rojo preexistente queda copiado literalmente como baseline.

- [ ] **Step 3: Medir consumidores de favoritos y los controles a retirar**

Run: `git grep -n "PrescriptionFavoritesClient\|prescription-favorites\|receta-descargar\|demoActiva\|casosDemo" -- src/app`

Expected: una tabla en el plan operativo que separe el único consumidor de cada dependencia de las referencias ajenas.

### Task 2: Retirar descarga, demostración y favoritos (C-15–C-17)

**Files:**
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.html`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts`
- Delete: `src/app/core/data-access/prescription-favorites/prescription-favorites.client.ts` only if the consumer scan is zero after removal.
- Delete: `src/app/core/data-access/prescription-favorites/prescription-favorites.types.ts` only with the client.
- Delete: `src/app/core/data-access/prescription-favorites/prescription-favorites.client.spec.ts` only with the client.

**Interfaces:**
- Consumes: `MedicationBlock` inputs/outputs and existing prescription list actions.
- Produces: bloque de medicación sin UI ni solicitudes de descarga, demo o favoritos.

- [ ] **Step 1: Escribir tests que expresen la superficie nueva**

Add to `medication-block.spec.ts`:

```ts
it('no ofrece descarga, demostración ni favoritos al abrir una receta', () => {
  fixture.componentRef.setInput('recetas', [FIRMADA]);
  responderCatalogo();
  fixture.detectChanges();

  expect(texto()).not.toContain('Descargar PDF');
  expect(texto()).not.toContain('Casos de demostración');
  expect(texto()).not.toContain('favorito');
  expect(http.match('/prescription-favorites')).toHaveLength(0);
});
```

- [ ] **Step 2: Ejecutar el test y confirmar RED**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: FAIL porque la plantilla actual todavía ofrece por lo menos uno de los tres caminos.

- [ ] **Step 3: Eliminar el flujo completo de cada función retirada**

Remove imports, signals, métodos, salidas y markup de favoritos; retirar `CASOS_RECETA_DEMO`, `demoActiva` y la barra; retirar el botón que emite `descargar`. Preserve `firmar` y `emitir`.

- [ ] **Step 4: Ejecutar test dirigido y scan de consumidores**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run; git grep -n "PrescriptionFavoritesClient\|prescription-favorites" -- src/app`

Expected: PASS; si no hay consumidores de producción, retirar el cliente y sus pruebas en un commit separado y dejar el resultado del scan en el reporte.

### Task 3: Motivo libre y “para qué” opcional (C-18, C-22)

**Files:**
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.html`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts`

**Interfaces:**
- Consumes: `indicationConditionId`, `indicationText` y `exigeDiagnostico`.
- Produces: motivo visible sin diagnóstico y cuerpo válido sin `indicationConditionId` ni `indicationText` cuando ambos son opcionales.

- [ ] **Step 1: Escribir pruebas de motivo libre sin selección previa y emisión sin “para qué”**

```ts
it('permite escribir un motivo sin elegir otro motivo ni diagnóstico', () => {
  responderCatalogo();
  señal<string>('medicamento').set('med-amoxi');
  señal<string>('motivoLibre').set('Control postoperatorio');
  expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
});

it('omite indicación al guardar una receta sin diagnóstico ni motivo', async () => {
  responderCatalogo();
  señal<string>('medicamento').set('med-amoxi');
  await interno<() => Promise<void>>('recetar')();
  const req = http.expectOne('/clinical/medication-requests');
  expect(req.request.body).not.toHaveProperty('indicationConditionId');
  expect(req.request.body).not.toHaveProperty('indicationText');
  req.flush(RESPUESTA);
});
```

- [ ] **Step 2: Ejecutar RED y luego implementar la regla mínima**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: las dos pruebas fallan antes de cambiar `hayMotivo`/`puedeRecetar`; tras el cambio, pasan y los casos con diagnóstico siguen enviando sólo `indicationConditionId`.

### Task 4: Dosis de texto y retiro de Unidad (C-19)

**Files:**
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.html`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts`

**Interfaces:**
- Consumes: catálogo de conceptos con `strengths` y `dose_forms`.
- Produces: `doseText` igual al texto escrito por la persona y cuerpo sin `unitConceptId`.

- [ ] **Step 1: Escribir tests RED para ambos catálogos**

```ts
it('mantiene la dosis escrita aunque el medicamento tenga concentración y presentación', async () => {
  responderCatalogo();
  interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
  responderFicha({ strengths: ['1 g'], dose_forms: ['capsule'] });
  señal<string>('dosis').set('1 g por vía oral cada 8 horas');
  await interno<() => Promise<void>>('recetar')();
  const req = http.expectOne('/clinical/medication-requests');
  expect(req.request.body.doseText).toBe('1 g por vía oral cada 8 horas');
  expect(req.request.body).not.toHaveProperty('unitConceptId');
  req.flush(RESPUESTA);
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: FAIL porque `posologia()` compone las propiedades del catálogo y hoy puede mandar `unitConceptId`.

- [ ] **Step 3: Hacer que `dosis` sea siempre la fuente de `doseText`**

Keep the catalog properties as contextual read-only data only if still useful; never let them replace `dosis`. Remove the Unidad state, catalogue request, markup and body field.

- [ ] **Step 4: Ejecutar GREEN dirigido**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: PASS, including an existing historical recipe fixture with `unitConceptId`.

### Task 5: Frecuencia de catálogo sin inventar posología (C-20)

**Files:**
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.html`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts`

**Interfaces:**
- Consumes: properties of the selected terminology concept.
- Produces: frequency source state: absent, accepted catalog default, or malformed catalog value.

- [ ] **Step 1: Confirmar la clave publicada antes de escribir producción**

Run: `git grep -n -i "frequency\|frecuencia\|posology" -- src data docs`

Expected: use the exact key and wire format already published by Ender. If absent, record `BLOCKED` for the production key and use tests only to preserve manual frequency; do not guess a key.

- [ ] **Step 2: Escribir RED sólo después de encontrar el contrato publicado**

Create one test with the exact property name and value shape discovered in Step 1; it must assert that a valid catalog value replaces the empty frequency, while an absent or malformed property leaves manual input unchanged.

Expected: if no published key exists, do not add a speculative production test; record the dependency and move to Task 6.

- [ ] **Step 3: Implement only the confirmed catalog contract**

On a valid published value, set `frecuencia` and render source copy. On absent or malformed values, retain manual text and render no clinical suggestion.

- [ ] **Step 4: Run the targeted suite**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: PASS for all three states, or a documented `BLOCKED` without unverified production code.

### Task 6: Selects, actions and quality gates (C-21, C-06)

**Files:**
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.html`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts`
- Modify: `src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts`
- Create: `docs/trabajo/2026-09-21-correcciones-receta-mockup/REPORTE.md`

**Interfaces:**
- Consumes: existing `app-select` and existing menu primitives in `shared/`.
- Produces: option controls represented as selects, actions with text/icon semantics, and evidence of the final state.

- [ ] **Step 1: Write RED template tests for select controls and action labels**

```ts
it('renders frequency and duration options as selects and keeps manual frequency input', () => {
  responderCatalogo();
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('app-select').length).toBeGreaterThanOrEqual(2);
  expect(root.textContent).toContain('Frecuencia');
});
```

- [ ] **Step 2: Run RED, replace option chips with existing `app-select`, and reuse an existing menu**

Run: `yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run`

Expected: the test fails before the template change and passes afterward. If no menu primitive is already usable without modifying `shared/**`, record C-06 as blocked by Itzan instead of creating a duplicate.

- [ ] **Step 3: Run static, unit and architecture gates**

Run: `yarn lint; yarn typecheck; yarn test src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --run; yarn build; node scripts/check-architecture.mjs`

Expected: each command exits 0; any baseline red is reported separately from new failures.

- [ ] **Step 4: Run local browser verification and close artifacts**

Run: `yarn start` once, exercise the medication route at all required viewports and both themes, then stop the process. Run the relevant Playwright route/barrido command with `--workers=1` if its existing selectors cover the route.

Expected: screenshots, console/request observations and a report with `HECHO`, `A MEDIAS`, and `PENDIENTE` sections. Do not claim a backend mutation is verified unless UI → request → response → reload → UI was observed.
