# Reporte — C6 · Historia clínica del paciente: en estudio, activas, históricos y la línea del encuentro

> **AVANCE: 6 / 9 — 66,7 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c6-historia-paciente`
- Base: `origin/mockup` @ `bf2c3545` · PR contra `mockup`
- Peldaño de evidencia alcanzado: **`TESTED`** en lo que se pudo ejercitar (73 pruebas dirigidas
  propias + 61 de regresión, todas en verde) y **`WRITTEN`** en el Playwright y en todo lo visual.
  **No hay `VERIFIED` en ninguna parte de este carril: no hubo navegador.**

## Completado

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| C6.H1.M1 | Worktree, rama y `PLAN.md` en disco; baseline del spec de la pantalla registrado | `corepack yarn test --include='…/medical-record.spec.ts'` | PASS · **21 passed** · [`evidencia/00-baseline-medical-record.txt`](./evidencia/00-baseline-medical-record.txt) |
| C6.H2.M1 | Organismo `app-encounter-timeline`: presentacional puro, ordena nota → orden → diagnóstico → reconsulta → receta, y aparece en el stock | `corepack yarn test --include='…/encounter-timeline.spec.ts'` · `corepack yarn stock:generate` | PASS · **12 passed** · 550 componentes, 35 organismos · [`evidencia/01-encounter-timeline.txt`](./evidencia/01-encounter-timeline.txt) |
| C6.H3.M1 | Pestaña «Diagnósticos» con sus tres bloques y `diagnosisStateOf`/`DIAGNOSIS_STATE_LABELS` propios, resueltos por **código** de catálogo. **Kill-test cubierto**: `DXV-REFUTED` nunca cae en «Enfermedades activas», ni con `COND-ACTIVE` | `corepack yarn test --include='…/medical-record.spec.ts'` y `--include='…/history-view-model.spec.ts'` | PASS · **33 + 19 passed** · [`evidencia/02-pantalla-y-modelo.txt`](./evidencia/02-pantalla-y-modelo.txt) |
| C6.H3.M2 | «Atenciones» con `EncounterInHistory` (renombra `AtencionVisible`) y la línea del encuentro al desplegar. Al montar **no** salen `/charts/…/chart` ni `/diagnostic-results/me/orders`; al primer despliegue salen las dos, una sola vez para toda la historia | Dos pruebas propias con `http.expectNone` / `http.expectOne` | PASS · dentro de las 33 |
| C6.H3.M3 | «Qué nunca ve el paciente»: ningún uuid de 36 caracteres en el HTML renderizado, en la pestaña de diagnósticos, con la línea desplegada, ni en el organismo | Tres pruebas con `expect(innerHTML).not.toMatch(/uuid/)` | PASS · dentro de las 33 + 12 |
| C6.H5.M1 | Gates, tres commits, push y PR contra `mockup`; el diff **no toca** `where-to-buy/` | `corepack yarn typecheck` · `corepack yarn lint` · `git diff origin/mockup --stat -- …/where-to-buy` · `gh pr view` | PASS · typecheck **0**, lint **6 errores los 6 preexistentes**, diff de `where-to-buy` **vacío** · [`evidencia/03-gates.txt`](./evidencia/03-gates.txt), [`evidencia/04-pr.txt`](./evidencia/04-pr.txt) |

## A medias

### C6.H3.M4 — PDF «Descargar tu historia» con las secciones nuevas

- **Qué anda:** el documento ya lleva «Diagnósticos por estado» (los tres bloques, vacíos
  incluidos, con su certeza y su detalle) y «Línea de cada atención» (los hechos en el mismo orden
  que la pantalla, con el estado de la atención). Las dos secciones se insertan **antes del pie**.
  9 pruebas del armador en verde, incluido el kill-test en el papel y la ausencia de uuid.
  El botón «Descargar mi historia completa» ya llama al armador nuevo, y ahora además traduce los
  conceptos de los estudios — antes el PDF imprimía «Sin registrar» donde había un hemograma.
- **Qué no anda:** nada roto; lo que falta es la **comprobación**. El DoD del carril pide abrir el
  PDF y renderizarlo con pdf.js, y eso exige navegador.
- **Qué falta exactamente:** correr la descarga en un navegador, abrir el archivo y comprobar que
  las dos secciones aparecen y que el pie sigue siendo la última línea. Un paso, un navegador.
- **Dónde quedó:** `src/app/shared/utils/clinical-pdf/historia-con-encuentros.ts` (+ su spec) y la
  llamada en `medical-record.ts`. Compila, `typecheck` en 0, specs en verde.

### C6.H4.M1 — Playwright `clinica-c6-historia-paciente.spec.ts`

- **Qué anda:** el archivo existe, compila (`yarn typecheck` incluye `playwright/`) y cubre el
  recorrido del §6 con los cinco `data-testid` pedidos: `historia-en-estudio`, `historia-activas`,
  `historia-historicos`, `historia-linea-encuentro` y `historia-reconsulta`, más el PDF por evento
  `download`, la recarga que conserva la pestaña y la aserción de que no hay uuid en `innerText`.
- **Qué no anda:** no se ejecutó, así que **no se sabe si pasa**.
- **Qué falta exactamente:** `node scripts/pw-guard.mjs --port 4216 --spec playwright/clinica-c6-historia-paciente.spec.ts --serve`. Dos obstáculos reales: `scripts/pw-guard.mjs` **no existe en
  este árbol** (era de C0, que no se publicó) y este carril tiene prohibido levantar un servidor
  mientras corren otros tres agentes. Hay que escribir el guard o esperar a C0, y correrlo en la
  regresión central.
- **Dónde quedó:** `playwright/clinica-c6-historia-paciente.spec.ts`, commiteado. Peldaño `WRITTEN`.

### C6.H4.M2 — Capturas de cinco viewports, claro/oscuro, y la Regla 8 medida

- **Qué anda:** la Regla 8 está **implementada**: las pestañas viven en UNA `app-card`
  (`variant="outlined"`, `padding="lg"`) con `inline-size: 100%` y sin tope propio de ancho —el
  tope lo pone `.app-main__inner`—, el aside «Descargar tu historia» se conserva, y el CSS nuevo es
  mobile-first, con tokens únicamente, sin un literal de color o espaciado
  (`node scripts/check-css-tokens.mjs` no reporta ni un token de este carril).
- **Qué no anda:** no hay ni una captura, ni la medición de holgura izquierda/derecha (≤ 2 px) ni la
  del ancho del bloque (≥ 85 %), ni la revisión del tema oscuro. Tampoco la doble revisión crítica
  de la regla 35.1, que se hace **sobre capturas** y sin ellas no tiene objeto.
- **Qué falta exactamente:** levantar la app, capturar `/my-account/medical-record` con la pestaña
  Diagnósticos y con una atención desplegada, en los cinco viewports y en los dos temas; medir la
  Regla 8 como lo hace `playwright/mi-perfil-paciente.mjs`; y hacer las dos pasadas de
  `critical-double-review` con nota por pantalla.
- **Dónde quedó:** `medical-record.css` y `encounter-timeline.css`, commiteados. **Peldaño visual
  real: `WRITTEN`.** No se tomó ni se inventó ninguna evidencia visual.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| — | — | Ninguna microtarea quedó en `TODO` ni en `DESCARTADO`. Las tres `A MEDIAS` de arriba dependen todas de lo mismo: **un navegador y permiso para levantar un servidor**, que este turno no tenía. |

## Qué se omitió porque C1–C4 no habían llegado (para C8)

Esto es lo que C8 tiene que retomar. Cada punto tiene su `// TODO C8` en el código:

| Carril | Qué iba a dejar | Qué hace C6 mientras tanto | Dónde está el TODO |
|---|---|---|---|
| **C0** | `shared/clinical/diagnosis-state.ts` con `diagnosisStateOf` y `DIAGNOSIS_STATE_LABELS` | Los escribe **dentro de la carpeta de este carril**, no en `shared/clinical/`: crear la carpeta que C0 va a crear garantizaría el conflicto de merge. Cuando C0 aterrice, el archivo se muda entero y la pantalla sólo cambia de import | `src/app/features/account/medical-record/diagnosis-state.ts:5` |
| **C1** | `entries` en `ChartNote`: los apartados que la nota declara | La nota se arma con los cinco campos fijos del contrato actual —`chiefComplaintText`, `subjectiveText`, `objectiveText`, `assessmentText`, `planText`— rotulados para el paciente | `history-view-model.ts`, en `notaDeLaLinea` |
| **C2** | `category` ya resuelta en la orden | Traduce `categoryConceptId` contra el catálogo, que es lo que el propio carril indica hacer si C2 no llega. Hizo falta una **segunda lectura de terminología**, porque las órdenes llegan después del resumen | `history-view-model.ts`, en `ordenDeLaLinea` |
| **C3** | `verification.reasonText`: el motivo **escrito** del rechazo | El histórico dice «resuelto el \<fecha\>» o, si no hay fecha, la **etiqueta del catálogo** del estado de verificación («Descartado»). Un hecho publicado en vez de un texto inventado | `history-view-model.ts`, en `razonDelHistorico` |
| **C4** | `followUpOf` en la reserva | **La reconsulta no se muestra.** El organismo ya la dibuja y su input `followUp` está en el contrato, pero el contenedor no tiene de dónde sacarla: `Booking` no declara de qué encuentro deriva, y `searchBookings` sin ese campo devolvería citas que no se pueden atar a una atención. No se llama al endpoint: una petición cuyo resultado no se puede usar es una petición de más | `medical-record.html`, junto a `<app-encounter-timeline>` |
| **C5** | La sección de receta del PDF | Las secciones nuevas viven en `historia-con-encuentros.ts`, no dentro de `bloquesDeHistoria`, para no chocar. **C8 tiene que fundirlas** en un solo `downloadHistoryPdf` | `src/app/shared/utils/clinical-pdf/historia-con-encuentros.ts:18` |
| **(contrato)** | «Quién lo confirmó» (§4 del carril) | **No se puede.** `Condition` no declara autor ni profesional, y el paciente no puede leer el padrón. Inventarlo sería atribuirle el diagnóstico a alguien | `history-view-model.ts`, en `diagnosticoVisible` |

## Evidencia

Índice de [`evidencia/`](./evidencia/):

- `00-baseline-medical-record.txt` — el estado de partida: 21 pruebas en verde.
- `01-encounter-timeline.txt` — el organismo y su entrada en el stock.
- `02-pantalla-y-modelo.txt` — las 73 pruebas dirigidas + 61 de regresión de los vecinos.
- `03-gates.txt` — typecheck, lint, los cuatro `check-*.mjs`, y **la lista de lo que NO se ejecutó**.
- `04-pr.txt` — la salida literal de `gh pr view --json …`.

```text
$ corepack yarn test --watch=false --include='src/app/features/account/medical-record/medical-record.spec.ts'
 Test Files  1 passed (1)
      Tests  33 passed (33)          # baseline antes de C6: 21 passed

$ corepack yarn typecheck
(sin salida: 0 errores)

$ git diff origin/mockup --stat -- src/app/features/account/medical-record/where-to-buy
(vacío)
```

## No cubierto

Lo que se escribió pero **no se ejercitó**:

1. **Todo lo visual.** Ni una captura, en ningún viewport ni tema. El tema oscuro de
   `encounter-timeline.css` está armado con los tríos `--st-*` del sistema —que el tema resuelve
   solo— pero **nadie lo miró**. Tampoco se comprobó `prefers-reduced-motion`: el organismo no
   anima nada propio, así que no habría qué respetar, pero eso es un razonamiento, no una
   observación.
2. **El recorrido de punta a punta.** El Playwright está escrito y no corrido; no se sabe si los
   cinco `data-testid` se encuentran en la app real ni si el `download` del PDF se dispara.
3. **El PDF como archivo.** Se probó qué dice el documento (sus bloques), no cómo queda maquetado
   ni que abra.
4. **Capturas «antes».** Parte de la descripción de C6.H1.M1; no ejecutables sin navegador.
5. **La suite completa y el build.** Prohibidos por el límite de recursos de este turno. Se
   corrieron los cuatro specs propios y tres de regresión de los vecinos más cercanos
   (`historia-y-orden`, `where-to-buy`, `accordion`), todos en verde.
6. **La reconsulta**, por C4 (arriba). El camino existe en el organismo y está probado ahí con un
   doble; contra datos reales no se ejercitó nunca porque no hay de dónde sacarlos.

## Desvíos del plan

1. **Cinco aserciones existentes cambiaron** —cuatro en `medical-record.spec.ts`, una en
   `playwright/nova-patient-experience.spec.ts`— porque **cambió el requisito**, no para que la
   suite pasara. Ninguna se borró, ninguna se debilitó, no hay un solo `skip`. El detalle:

   | Aserción | Antes | Ahora | Por qué |
   |---|---|---|---|
   | `tabs.length` | `4` | `5` | La pestaña «Diagnósticos» es el entregable del carril |
   | `titulos.some(… 'Diagnósticos')` | `false` (F-42: no hay lista suelta) | `true` | C6 pide exactamente esa lista. Su contrato nuevo lo fijan 5 pruebas propias |
   | `#historia-diagnosticos` es `null` | sí | se quitó | Mismo motivo. La mitad de F-42 que sobrevive —los formularios siguen sin listarse, el valor enmascarado sigue sin llegar a la pantalla— **quedó en pie, palabra por palabra** |
   | «una historia con sólo condiciones se declara vacía» | vacía | **ya no lo está** | Con la pestaña hay tres bloques que leer; decirle a esa persona que su historia está vacía sería falso |
   | `toHaveCount(4)` en el E2E | `4` | `5` | Idem. El prompt reserva ese archivo «sólo si tu cambio lo rompe» |

2. **El DoD de C6.H3.M2 y C6.H3.M3 se cumplió con aserciones y no con capturas** (de la pestaña Red
   y de Playwright): una aserción que revienta es evidencia más fuerte que una captura que alguien
   mira, y las capturas no eran ejecutables acá.
3. **La sección nueva del PDF vive en un archivo propio** en vez de dentro de `bloquesDeHistoria`,
   siguiendo la instrucción del reparto ante una coincidencia con C5.
4. **`prettier --write` sobre la carpeta `medical-record/` reescribió también `where-to-buy/`**,
   que es de otro agente. Se revirtió con `git checkout --` en el momento y se verificó con
   `git diff origin/mockup --stat -- …/where-to-buy`, que sale vacío. Lección: prettier por archivo,
   nunca por carpeta, cuando la carpeta está compartida.

## Riesgos residuales

1. **Sin prueba visual, la pantalla puede verse mal y las pruebas pasan igual.** Es el riesgo
   principal de esta entrega y no está mitigado. La línea del encuentro es un riel vertical nuevo
   con un `::after` posicionado: es exactamente la clase de CSS que se rompe en un viewport que
   nadie miró.
2. **El desfasaje de un día del `DatePipe`** sobre fechas de calendario afecta al resto del repo.
   C6 lo evita en sus tres fechas clínicas; las demás pantallas siguen como estaban. Anotado, no
   arreglado (regla 00 §3.2).
3. **`diagnosisStateOf` duplicado** hasta que C0 llegue. Si C0 clasifica distinto, la pantalla y el
   resto del producto dirán cosas distintas del mismo diagnóstico. Es el `TODO C8` más urgente.
4. **La segunda lectura de terminología** (la de los estudios) se fusiona sobre el mapa de
   etiquetas. Si el catálogo devolviera el mismo `conceptId` con otra etiqueta, gana la última.
   Hoy no puede pasar, pero es una suposición que el código no comprueba.

## Decisiones y ambigüedades

| # | Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|---|
| A-1 | «En estudio» no está definido en el carril | `DXV-PROVISIONAL` o `DXV-DIFFERENTIAL`, mientras no esté resuelto ni descartado. Y **todo lo que el catálogo no resuelva** cae acá, que es la afirmación más débil de las tres | Producto / C0 |
| A-2 | Un descartado **sin** `resolvedAt` | Entra a Históricos igual, con la etiqueta del catálogo como razón. El kill-test lo exige | Producto |
| A-3 | «el motivo del rechazo» exige `verification.reasonText` (C3) | Se omite el texto libre y se dice la etiqueta del catálogo | C3 / C8 |
| A-4 | Reconsulta sin `followUpOf` (C4) | No se muestra y **no se llama a `searchBookings`** | C4 / C8 |
| A-5 | ¿Una historia con sólo diagnósticos sigue «vacía»? | Ya no. Cambió `estaVacia` y su prueba | Producto |
| A-6 | `COND-REMISSION` («En remisión») no encaja limpio en ninguno de los tres bloques | Va a **Históricos**: dejó de ser una enfermedad activa. La fila «Estado clínico» conserva el matiz sin esconderlo | Producto |
| A-7 | Las fechas clínicas emitidas a medianoche UTC se corrían un día | Se formatean **en UTC**, porque son fechas de calendario y no instantes | Producto / quien sea dueño del formateo de fechas |
| A-8 | Una nota con `releasedToPatient: false` | **No se dibuja.** Aunque el servidor ya filtre, la pantalla no puede ser la que la muestre si dejara de hacerlo | Producto |
| A-9 | El detalle del acordeón podría repetir el motivo del encuentro | El organismo **no** dibuja una cabecera propia: usa `encounter` para el nombre accesible de la lista y para el cierre de la línea. Sin duplicación | — |

## Gate de seguridad (regla 90.5 · historia clínica)

- **Amenaza considerada:** que la pantalla más sensible del producto filtre identificadores
  internos, o muestre una nota clínica que el profesional no liberó al paciente.
- **Control agregado:** (1) todo `*ConceptId` se traduce contra el catálogo y lo que no resuelve
  sale como «Sin registrar», nunca como uuid; (2) el rótulo de la nota es de cuatro caracteres, no
  el identificador; (3) `releasedToPatient` se comprueba en el mapeo (`history-view-model.ts`,
  en `atencionDeLaHistoria`).
- **Test que lo demuestra:** cuatro pruebas con `expect(innerHTML).not.toMatch(/uuid/)` —pantalla,
  organismo, papel— y «una nota no liberada al paciente no entra en la línea».
- **Resultado:** PASS, dentro de las 73 pruebas dirigidas.
- **Riesgo residual:** el `innerText` de la app **real** no se comprobó (el Playwright que lo hace
  no se ejecutó); lo verificado es el HTML renderizado en las pruebas de componente.
