# Plan — C5: receta siempre ligada a un diagnóstico confirmado, o con motivo plano

- Fecha: 2026-09-25 · Repo: `mantra-core-health` (worktree `wt-clinica-c5`) · Predecesor: `medication-block` v4.1.6 (ya tiene indicación opcional por diagnóstico o motivo libre)
- Fuente: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Pablo/Noche-EncuentroClinico.C5-Receta/RecetaLigadaADiagnosticoConfirmadoOMotivoPlano.md`
- Rama: `claude/clinica-c5-receta`, desde `origin/mockup` @ `963b728358b9dd612087f89584e3931d40b0611c` (**corte propio, distinto al de Farmacia/C9**: `mockup` avanzó — Marcelo mergeó su Ola 0 de farmacia (#676) mientras yo trabajaba. Confirmado con `git rev-parse origin/mockup`; sin cruce de archivos con mi carril).
- Resultado observable: al recetar, "¿Para qué es esta receta?" exige un diagnóstico **confirmado** o "Otro motivo" con texto; el simulador rechaza (422) lo demás; el PDF y la lista dicen "Diagnóstico: X" / "Motivo: …"; una receta con motivo puede vincularse después a un diagnóstico confirmado.
- Kill-test: si el selector muestra un diagnóstico presuntivo/provisional, C5 no está hecho.

## Alcance
- IN: `medication-block.{ts,html,css,spec.ts}` completo; `clinical.handlers.ts` sólo el bloque de `medication-requests` (líneas ~299-349) + nuevo endpoint `/:id/edit`; sección Diagnóstico/Motivo del PDF de receta; 2 specs de Playwright.
- OUT: `diagnosis-block/**`, `patient-chart.*` (C3) · `where-to-buy/**` · favoritos · `consultation/**` · tipos congelados de C0 · `medical-notes.handlers.ts` (C1) · `diagnostics.handlers.ts` (C2).
- **Bloqueo real, aislado por contrato (regla 65):** `patient-chart.ts:800` (`diagnosticosParaReceta`) arma `DiagnosticoEnFicha[]` sin `verificationStatusConceptId` ni fecha — sólo `{id, etiqueta}` — aunque el `Condition` real (`clinical.types.ts:28`) **sí** trae `verificationStatusConceptId`. Filtrar a "sólo confirmados" es imposible sin ese dato, y no puedo tocar `patient-chart.ts` (reservado a C3). Se aísla: `DiagnosisOption` (alias `DiagnosticoEnFicha` para no romper el import de C3) se **extiende** con `confirmadoEl: string | null` opcional; `medication-block` filtra y etiqueta correctamente contra ese campo, verificado con fixtures propias en los tres niveles (con confirmado, sin ninguno, con uno presuntivo que se excluye). La integración real con `patient-chart.ts` queda **pendiente de que C3 (o quien toque ese archivo después) agregue una línea**: `confirmadoEl: dx.verificationStatusConceptId === 'DXV-CONFIRMED' ? dx.createdAt.toISOString() : null`. Documentado en el `REPORTE.md`, no oculto.
- Ambigüedad registrada: no existe un campo `confirmedAt` separado en `Condition`; "Confirmado el `<fecha>`" usa `createdAt` (cuándo se registró la condición). A confirmar con quien diseñó el contrato clínico si hace falta un timestamp de confirmación aparte.
- Renombres (`DiagnosticoEnFicha`→`DiagnosisOption`, `RecetaEnFicha`→`PrescriptionInChart`): se hacen como **alias de compatibilidad** (`export type DiagnosticoEnFicha = DiagnosisOption`) porque `patient-chart.ts` importa los dos nombres viejos y no puedo tocar ese archivo para actualizar el import.

## H1 — Arranque y baseline
**Estado:** HECHO
- Corte: `963b7283…`. `corepack yarn typecheck` exit 0. Baseline de `medication-block.spec.ts`: **59 passed (59)**.

## H2 — Reglas del handler + `/:id/edit`
**Estado:** HECHO

| ID | Microtarea | CA | Estado | DoD ejecutado |
|---|---|---|---|---|
| C5.H2.M1 | Reglas del handler + ruta `/:id/edit`, 6 casos | 422 sin nada · 422 presuntivo · 201 confirmado · 201 motivo · gana condición si ambos · edit emitida 409 | HECHO | `npx ng test --include='src/app/core/mock/handlers/clinical.handlers.spec.ts' --watch=false` → **10 passed (10)** (4 preexistentes + 6 nuevos) |

## H3 — Formulario, lista, PDF
**Estado:** HECHO (integración real con `patient-chart.ts`/`medical-record.ts` pendiente — ver bloqueo aislado arriba)

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| C5.H3.M1 | Selector filtrado a confirmados + "Otro motivo" obligatorio + renombres (alias) | HECHO | `medication-block.spec.ts` reescrito donde correspondía (5 casos que probaban el "opcional" viejo, ahora prueban lo obligatorio) — **63 passed (63)** |
| C5.H3.M2 | Errores del servidor en el modal | HECHO | `errorDeVincular()` + spec "un 422 del servidor se muestra dentro del diálogo" |
| C5.H3.M3 | Lista: badge de vínculo + "Vincular a un diagnóstico…" | HECHO | 4 specs nuevos (abrir, vincular a diagnóstico, vincular con motivo, error) |
| C5.H3.M4 | PDF con Diagnóstico/Motivo | HECHO | `clinical-pdf.spec.ts` — 3 casos nuevos, **45 passed (45)** en total |

**Desvíos de diseño (regla 00 §1.4, sin poder tocar las piezas ni los archivos ajenos):**
- "Vincular a un diagnóstico…" se agregó al `app-menu` **existente** de la fila (Firmar/Emitir), no a un `app-row-actions` nuevo: la fila ya usa ese patrón (icono con menú desplegable) desde antes de C5, y reemplazarlo por otro componente para una sola acción más habría sido un refactor no pedido (regla 00 §3). El prompt sugiere `app-row-actions`; se prefirió el patrón ya presente en el mismo archivo.
- El motivo pasó de `app-input` a `app-textarea` (pedido explícito de C5 §4: "≤200, contador").
- `app-form-actions` no tiene forma de recibir un testid en su botón: el E2E ubica "Prescribir"/"Vincular" por rol + nombre accesible.

## H4 — Playwright
**Estado:** Escrito (`clinica-c5-receta.spec.ts`, `prescription-official-pdf.spec.ts` con nota agregada) — correr y capturar diferido al pase final de la noche (mismo motivo que Farmacia/C9).

## H5 — Cierre
**Estado:** EN CURSO — PR a `mockup`, `REPORTE.md` escrito, daily pendiente de actualizar.
