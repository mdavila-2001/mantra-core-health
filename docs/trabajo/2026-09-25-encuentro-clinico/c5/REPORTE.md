# Reporte — C5: receta siempre ligada a un diagnóstico confirmado, o con motivo plano

> **AVANCE: 8 / 9 — 88,9 %.** (H1, H2.M1, H3.M1-M4 hechos; falta H4/H5 — Playwright corrido y cierre del PR)

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c5-receta`
- Peldaño de evidencia alcanzado: **TESTED** por área (specs dirigidos en verde: mock handler 10/10, `medication-block` 63/63, `clinical-pdf` 45/45). **No** `VERIFIED`: falta la prueba visual real y el E2E corrido, diferidos al pase final de la noche.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 | Corte confirmado (`963b7283…`, distinto al de Farmacia/C9 porque Marcelo mergeó su Ola 0 de farmacia mientras tanto) | `npx ng test --include='.../medication-block/*.spec.ts' --watch=false` (antes de tocar nada) | 59 passed (59) |
| H2.M1 | 422 sin indicación · 422 diagnóstico no confirmado · 201 confirmado · 201 motivo · gana la condición si hay las dos · `/:id/edit` con 409 sobre emitida | `npx ng test --include='.../clinical.handlers.spec.ts' --watch=false` | **10 passed (10)** |
| H3.M1 | Selector filtrado a confirmados, con fecha; "Otro motivo" obligatorio; `DiagnosisOption`/`PrescriptionInChart` (alias hacia los nombres viejos) | `medication-block.spec.ts` | **63 passed (63)** |
| H3.M2 | Error del servidor visible dentro del diálogo de "Vincular" | spec "un 422 del servidor se muestra dentro del diálogo" | PASS |
| H3.M3 | Badge `receta-vinculo` ("Diagnóstico: …" / "Motivo: …"); "Vincular a un diagnóstico…" en el menú existente de la fila, con su propio diálogo | 4 specs nuevos de vincular | PASS |
| H3.M4 | Sección "Diagnóstico"/"Motivo" del PDF, nunca vacía | `clinical-pdf.spec.ts` | **45 passed (45)** |
| — | Lint de todo lo tocado | `npx eslint <7 rutas>` | sin hallazgos |
| — | Build | `corepack yarn build` | exit 0 |

## A medias

### Integración real con `patient-chart.ts` / `consultation.ts` / `medical-record.ts`
- Qué anda: `medication-block` filtra, valida y ofrece "Vincular…" correctamente contra **cualquier** dato que cumpla el contrato — verificado con fixtures propias en los tres niveles (confirmado, sin confirmar, presuntivo excluido).
- Qué no anda: **ninguno de los tres archivos que arman los datos reales está a mi alcance esta noche** (`patient-chart.ts` es de C3; `consultation.ts` está explícitamente fuera; `medical-record.ts` es de C6). Ninguno de los tres puebla todavía `confirmadoEl` en `DiagnosisOption`, `vinculo`/`vinculoEsDiagnostico` en `PrescriptionInChart`, ni `porQueEs` en `DocumentoDeReceta` — aunque los tres tienen ya el dato de origen (`verificationStatusConceptId`, `indicationConditionId`/`indicationText`).
- Qué falta exactamente: en `patient-chart.ts` (`diagnosticosParaReceta`, l.~800): agregar `confirmadoEl: dx.verificationStatusConceptId === 'DXV-CONFIRMED' ? dx.createdAt.toISOString() : null`; en `recetasEnFicha` (l.~782): agregar `vinculo`/`vinculoEsDiagnostico` a partir de `indicationConditionId`/`indicationText`. En `medical-record.ts`/`consultation.ts`: poblar `porQueEs` del `DocumentoDeReceta` con el mismo criterio.
- Dónde quedó: los tres campos son **opcionales** en los tipos que exporto (para no romper la compilación de esos archivos), documentados con JSDoc señalando exactamente la línea a agregar.

### H4 — Playwright
- Qué anda: `playwright/clinica-c5-receta.spec.ts` escrito con el recorrido completo del prompt §6; `prescription-official-pdf.spec.ts` con nota sobre la nueva sección.
- Qué no anda: no se ejecutó — sin stack local levantado.
- Qué falta: levantar el stack (una sola vez, junto con Farmacia/C9/C7) y correr `npx playwright test playwright/clinica-c5-receta.spec.ts playwright/prescription-official-pdf.spec.ts`, capturas y doble revisión.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H4 (correr el E2E + capturas) | BLOQUEADO | Stack local, pase único al final de la noche |
| H5 (push, PR, daily) | EN CURSO | Este mismo commit lo abre |
| Integración real (3 archivos ajenos) | BLOQUEADO — no es mío | Que C3/C6/quien toque `consultation.ts` agregue las líneas señaladas arriba |

## Evidencia

```text
$ npx ng test --include='src/app/core/mock/handlers/clinical.handlers.spec.ts' --watch=false
Tests  10 passed (10)

$ npx ng test --include='.../medication-block/*.spec.ts' --watch=false
Tests  63 passed (63)

$ npx ng test --include='src/app/shared/utils/clinical-pdf/*.spec.ts' --watch=false
Tests  45 passed (45)

$ corepack yarn build
Output location: .../dist/mantra-core-health   (sin errores)
```

## No cubierto
- Prueba visual real, E2E corrido, doble revisión — dependen del stack local.
- La integración real con datos de `patient-chart.ts`/`consultation.ts`/`medical-record.ts` (ver "A medias").
- Accesibilidad manual (teclado, lector de pantalla) del nuevo diálogo "Vincular".

## Desvíos del plan
- Ver "Desvíos de diseño" en `PLAN.md` §H3: "Vincular…" en el menú existente (no `app-row-actions` nuevo); `app-textarea` en vez de `app-input` para el motivo; testids del envío por rol/nombre accesible.
- Los renombres pedidos (`DiagnosticoEnFicha`→`DiagnosisOption`, `RecetaEnFicha`→`PrescriptionInChart`) se hicieron con **alias de compatibilidad** hacia los nombres viejos, porque `patient-chart.ts` (fuera de mi alcance) los importa por esos nombres.

## Riesgos residuales
- Hasta que C3 agregue la línea en `patient-chart.ts`, **el selector de diagnósticos no muestra ninguno real** en producción (todo cae en "Otro motivo") — comportamiento seguro (nunca ofrece un presuntivo) pero incompleto para el usuario final.
- Mismo riesgo para el badge de vínculo en la lista y la sección del PDF: sin la integración, siempre muestran su estado "sin datos" honesto.

## Decisiones y ambigüedades
- **"Confirmado el `<fecha>`"** usa `Condition.createdAt` (no hay un campo `confirmedAt` separado en el contrato). A confirmar con quien diseñó el contrato clínico.
- **`app-status-seal` para el estado de la receta** ya existía (`selloDe()`, sin tocar) — no es parte de este carril.
