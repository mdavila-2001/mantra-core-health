# Plan — C6 · Historia clínica del paciente: en estudio, activas, históricos y la línea del encuentro

- Fecha: 2026-09-25 · Repos afectados: `mantra-core-health` (worktree `wt-clinica-c6`) · Predecesor: `origin/mockup` @ `bf2c3545`
- Rama: `claude/clinica-c6-historia-paciente`
- Resultado observable: `paciente@alovida.mock` entra a `/my-account/medical-record` y ve una pestaña
  **«Diagnósticos»** con tres bloques (En estudio · Enfermedades activas · Históricos) y, en
  «Atenciones», cada atención se despliega en una **línea del encuentro** (nota, órdenes,
  diagnósticos, reconsulta, recetas). «Descargar tu historia» incluye lo mismo. Ningún uuid en pantalla.
- Kill-test: si un diagnóstico **rechazado** (`DXV-REFUTED`) aparece como enfermedad activa, C6 no está hecho.

## Alcance

- **IN:** `src/app/features/account/medical-record/**` (menos `where-to-buy/**`) ·
  `src/app/shared/components/organisms/encounter-timeline/**` (nuevo) ·
  `src/app/shared/utils/clinical-pdf/historia-*.ts` (archivo nuevo) ·
  `playwright/clinica-c6-historia-paciente.spec.ts` (nuevo) ·
  `playwright/nova-patient-experience.spec.ts` (**sólo** el conteo de pestañas que este cambio rompe) ·
  `src/app/shared/components/organisms/index.ts` (una línea de export) ·
  `src/app/features/component-stock/component-index.generated.ts` (**generado** por `yarn stock:generate`) ·
  `docs/trabajo/2026-09-25-encuentro-clinico/c6/**`.
- **OUT:** `where-to-buy/**` (lo tiene otro agente **ahora mismo**) · todo lo del doctor (C1–C5, C7) ·
  los clientes de `core/data-access` · los handlers **y fixtures** del simulador ·
  `account/diagnostic-orders/**` (C9) · `shared/utils/clinical-pdf/clinical-pdf.ts` y
  `clinical-pdf.types.ts` (C5 toca la sección de receta del mismo archivo: se **agrega otra función**
  en un archivo nuevo, no se edita aquélla) · montar el organismo en pantallas del doctor (C8).

### Hechos confirmados por lectura (no supuestos)

| Hecho | Dónde |
|---|---|
| `Condition` trae `verificationStatusConceptId`, `clinicalStatusConceptId`, `clinicalCourseConceptId`, `onsetAt`, `expectedResolutionAt`, `resolvedAt`, `noteText`, `encounterId` | `core/data-access/clinical/clinical.types.ts:23-40` |
| `ConceptLabels` es `Map<conceptId, ValueSetOption>` y `ValueSetOption` **trae `code`** → el estado se decide por código de catálogo, no por etiqueta | `core/data-access/terminology/terminology.types.ts:11-20,47` |
| Códigos reales del simulador: `DXV-CONFIRMED`, `DXV-PROVISIONAL`, `DXV-DIFFERENTIAL`, `DXV-REFUTED`; `COND-ACTIVE/REMISSION/RESOLVED/RECURRENCE`; `COND_COURSE_CHRONIC` | `core/mock/fixtures/conceptos.ts:558-609` |
| El primer paciente tiene un diagnóstico por bloque: I10 confirmado+activo, E78.5 provisional+activo, J06.9 resuelto | `core/mock/fixtures/clinica.ts:168,235-240` |
| `ChartNote` **no tiene `entries`** (C1 no llegó); tiene `chiefComplaintText`/`subjectiveText`/`objectiveText`/`assessmentText`/`planText` y `releasedToPatient` | `clinical.types.ts:288-305` |
| `Condition` **no tiene `verification.reasonText`** (C3 no llegó) | idem |
| `Booking` **no tiene `followUpOf`** (C4 no llegó) | `core/data-access/scheduling/scheduling.types.ts:183-230` |
| `PatientOrder` trae `encounterId`, `codeConceptId`, `categoryConceptId`, `statusConceptId`, `hasReleasedResult` — `category` ya resuelto (C2) **no llegó** | `diagnostics.types.ts:275-296` |
| `AccordionPanel.expanded` es un `model<boolean>` → se puede enganchar la carga perezosa al primer despliegue | `molecules/accordion/accordion-panel/accordion-panel.ts:46` |
| `bloquesDeHistoria` vive en `clinical-pdf.ts` y termina en un bloque `caption` (el pie) | `clinical-pdf.ts:341,536` |
| El stock de componentes se **genera** escaneando el árbol; no hay archivo que editar a mano | `scripts/generate-component-index.mjs` |

### Ambigüedades registradas

| # | Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|---|
| A-1 | «En estudio» no tiene definición en el prompt | `DXV-PROVISIONAL` o `DXV-DIFFERENTIAL`, mientras el estado clínico no sea resuelto — es lo que el catálogo publica como certeza no cerrada | Producto / C0 |
| A-2 | «Históricos» de un diagnóstico **rechazado** sin `resolvedAt` | Entra a Históricos igual, con la razón «Descartado por el profesional» (etiqueta del catálogo, no inventada). El kill-test lo exige | Producto |
| A-3 | «el motivo del rechazo» exige `verification.reasonText`, que C3 no dejó | Se omite el texto libre; se muestra la **etiqueta de catálogo** del estado de verificación. `// TODO C8` en el sitio exacto | C3 / C8 |
| A-4 | Reconsulta sin `followUpOf` (C4) | El organismo **recibe** `followUp` y lo pinta; el contenedor no tiene de dónde sacarlo y pasa `undefined`. Nada se inventa | C4 / C8 |
| A-5 | ¿Una historia con **sólo** condiciones sigue estando «vacía»? | Ya no: con la pestaña Diagnósticos sí hay algo que mirar. Cambia `estaVacia` y su spec | Producto |

## H1 — Arranque y baseline

**CA:** El worktree está en la rama correcta, el plan existe y el estado de partida de los specs afectados está registrado.
**DoD:** `git rev-parse --abbrev-ref HEAD` = `claude/clinica-c6-historia-paciente`; salida del spec de partida en `evidencia/`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| C6.H1.M1 | Arranque, estándar, baseline, `PLAN.md` | El plan está en disco y el baseline del spec de la pantalla corrió | `corepack yarn test --watch=false --include='src/app/features/account/medical-record/medical-record.spec.ts'` → **21 passed**, `evidencia/00-baseline-medical-record.txt` | HECHO |

> Capturas «antes»: **no ejecutables** en este entorno (prohibido levantar servidor; `pw-guard.mjs` no existe en el árbol). Se declara y no se inventa.

## H2 — El organismo compartido

**CA:** `app-encounter-timeline` existe, es presentacional puro (ningún cliente adentro) y aparece en el stock.
**DoD:** spec dirigido en verde + `yarn stock:generate` deja la entrada.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| C6.H2.M1 | `encounter-timeline` organismo + spec + stock | El componente ordena nota → orden → diagnóstico → reconsulta → receta y no inyecta ningún cliente | **12 passed** + `stock:generate` → 550 componentes, entrada `app-encounter-timeline`; `evidencia/01-encounter-timeline.txt` | HECHO |

## H3 — La pantalla del paciente

**CA:** Las tres piezas observables (pestaña Diagnósticos, línea del encuentro, PDF) están en la pantalla.
**DoD:** spec de la pantalla en verde + typecheck + lint.
**Estado:** A MEDIAS — M1/M2/M3 `HECHO`, M4 `A MEDIAS` (el PDF no se pudo abrir sin navegador).

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| C6.H3.M1 | Pestaña «Diagnósticos» con `diagnosisStateOf`/`DIAGNOSIS_STATE_LABELS` propios | Un `DXV-REFUTED` **nunca** cae en «Enfermedades activas» (kill-test) | `medical-record.spec.ts` **33 passed** + `history-view-model.spec.ts` **19 passed**; `evidencia/02-pantalla-y-modelo.txt` | HECHO |
| C6.H3.M2 | «Atenciones» con `EncounterInHistory` y la línea al desplegar | Al montar **no** sale `GET /diagnostic-results/me/orders`; al primer despliegue sí, y una sola vez | Dos pruebas propias con `http.expectNone`/`expectOne`, en verde | HECHO |
| C6.H3.M3 | «Qué nunca ve el paciente» | El HTML renderizado no contiene ningún uuid de 36 caracteres | Tres pruebas con regex sobre `innerHTML` (pantalla, organismo y papel), en verde | HECHO |
| C6.H3.M4 | PDF «Descargar tu historia» con las secciones nuevas | Los bloques del PDF traen «Diagnósticos por estado» y «Línea de cada atención» | `historia-con-encuentros.spec.ts` **9 passed**. **El DoD del carril —abrir el PDF y renderizarlo con pdf.js— NO se ejecutó: exige navegador.** | A MEDIAS |

## H4 — Playwright y prueba visual

**CA:** El spec E2E está escrito con los cinco `data-testid` del prompt.
**DoD:** `yarn typecheck` (que incluye `playwright/`) en 0.
**Estado:** A MEDIAS — escrito y compilando; ninguna de las dos microtareas se pudo ejecutar.

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| C6.H4.M1 | Playwright `clinica-c6-historia-paciente.spec.ts` | El archivo existe, compila y cubre el recorrido del §6 | `corepack yarn typecheck` → **0**. **No ejecutado**: `scripts/pw-guard.mjs` no existe en este árbol y el carril tiene prohibido levantar un servidor. Peldaño real: `WRITTEN` | A MEDIAS |
| C6.H4.M2 | Capturas cinco viewports, claro/oscuro; Regla 8 medida | — | **No ejecutado**: sin navegador no hay captura ni medición. No se inventa evidencia visual | A MEDIAS |

## H5 — Cierre

**CA:** PR abierto contra `mockup`, mergeable, sin tocar `where-to-buy/`.
**DoD:** salida literal de `gh pr view --json …` en `evidencia/`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| C6.H5.M1 | Gates, commits, push, PR, `REPORTE.md` | `git diff origin/mockup --stat -- …/where-to-buy` vacío y `mergeable` != `CONFLICTING` | typecheck **0** · lint **6 errores, los 6 preexistentes y en archivos no tocados** · `gh pr view` en `evidencia/04-pr.txt` | HECHO |

## Ambigüedades y desvíos aparecidos durante la ejecución

| # | Qué apareció | Qué se decidió |
|---|---|---|
| A-6 | `COND-REMISSION` («En remisión») no encaja limpiamente en ninguno de los tres bloques | Va a **Históricos**: dejó de ser una enfermedad activa, y listarla entre las activas diría lo contrario. La fila «Estado clínico» conserva el matiz sin esconderlo. Confirmar con producto |
| A-7 | El `dateStyle: 'short'` de `Intl` con `es-BO` devuelve `9/1/24` y, sobre fechas emitidas a medianoche UTC, **corre el día para atrás** en toda Bolivia (UTC−4): «hasta el 24/11» se imprimía «23/11» | Las tres fechas clínicas de C6 (`onsetAt`, `expectedResolutionAt`, `resolvedAt`) se formatean a mano y **en UTC**, porque son fechas de calendario y no instantes. Fijado en `history-view-model.spec.ts` |
| A-8 | El mismo desfasaje afecta a **todo** el repo, que usa el `DatePipe` en hora local sobre fechas de calendario | **Anotado, no arreglado** (regla 00 §3.2): excede el alcance de C6. Queda para quien sea dueño del formateo de fechas |
| A-9 | `prettier --write` sobre la carpeta `medical-record/` reescribió también `where-to-buy/**`, que es de otro agente | Revertido con `git checkout --` en el momento; verificado con `git diff origin/mockup --stat`, que sale vacío. En adelante, prettier sólo por archivo |

## Desvíos del plan

1. **Cuatro aserciones de `medical-record.spec.ts` y una de `nova-patient-experience.spec.ts` cambiaron**
   porque cambió el requisito, no para que la suite pasara. Ninguna se borró ni se debilitó; las
   dos que se invirtieron (`titulos.some(… 'Diagnósticos')` y «una historia con sólo condiciones
   se declara vacía») tienen su contrato nuevo fijado por pruebas propias. Detalle en el `REPORTE.md`.
2. **El DoD de C6.H3.M2 y C6.H3.M3 se cumplió con aserciones en vez de con capturas** de la pestaña
   Red y de Playwright: una aserción que revienta es evidencia más fuerte que una captura que
   alguien mira, y las capturas no eran ejecutables en este entorno.
3. **La sección nueva del PDF vive en un archivo propio** (`historia-con-encuentros.ts`) y no dentro
   de `bloquesDeHistoria`, porque C5 está tocando la sección de receta de esa misma función. Es lo
   que el reparto indica hacer ante una coincidencia: agregar otra función y que C8 unifique.

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La pestaña nueva rompe 4 aserciones existentes de `medical-record.spec.ts` y 1 de `nova-patient-experience.spec.ts` | Specs en rojo | Son `TEST_BUG` **por cambio de requisito** (regla 80.4): se actualiza la aserción conservando su intención (el diagnóstico sigue leyéndose dentro de su atención; los formularios siguen sin listarse; el valor enmascarado sigue sin llegar), y se declara como desvío en el `REPORTE.md`. Ninguna se borra ni se debilita |
| Cruce con el agente de Farmacia en `where-to-buy/**` | Conflicto de merge | No se abre un solo archivo de esa carpeta; se verifica con `git diff --stat` antes del PR |
| Sin navegador no hay prueba visual ni E2E corrido | Peldaño visual bajo | Se declara `A MEDIAS` con la causa real y el peldaño (`WRITTEN`), nunca `VERIFIED` |
| Los fixtures del simulador no declaran `expectedResolutionAt` ni curso crónico | «hasta <fecha>» y «crónica» no se ven en el mock | Se cubren con spec unitario dirigido (contrato ejercitado en los tres niveles: con fecha, crónica, y sin ninguno de los dos). Tocar fixtures está OUT |
