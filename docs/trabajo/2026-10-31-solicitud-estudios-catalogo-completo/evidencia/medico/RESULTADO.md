# Evidencia del flujo del MÉDICO (modo demo, simulador) — 31/10/2026

Rama `claude/brave-carson-h23qzh`. Cuenta `medica@alovida.mock`, paciente «Elena María Guzmán Arauz», casilla «Orden de análisis» de la consulta (`consulta-casilla-ordenes` → `consulta-modal`).
Chromium `/opt/pw-browsers/chromium`, headless, un solo navegador a la vez, sin `networkidle`.

## Cómo se corrió (desvío declarado)
`yarn ng serve --configuration development,demo` murió tres veces (OOM del compilador y *deadlock* de esbuild bajo la carga de otros agentes). Se usó `yarn ng build --configuration development,demo` (mismo código, mismos reemplazos de entorno) servido por un servidor estático mínimo con respaldo a `index.html`. Es lo mismo que sirve `ng serve` en demo, sin HMR. Hubo dos builds: **antes** de las correcciones (`flujo-antes-de-correcciones.*`) y **después** (todo lo demás).

## Qué se vio (build corregido salvo donde se dice)
**Laboratorio** (`flujo.log`, `lab-*.png`)
- Tipo = Laboratorio muestra `lab-picker`. Buscar «hemoglobina»: **antes** 1 resultado (solo HbA1c; el hemograma no aparecía), **después** 5, entre ellos los dos hemogramas (defecto D1, corregido).
- Marcar «Hemograma (sin diferencial)»: casilla padre `checked + indeterminate` (11 de 13 componentes por defecto; contador «1 análisis · 11 componentes»). En Lista (`11/13 ▸`, expandir) el estado es el mismo; desmarcar «Hemoglobina» da 10; al volver a Tabla sigue desmarcada.
- Desmarcar los 13: padre `checked=false`, `estudios-panel-vacio` visible («Marque al menos un componente…»), «Pedir estudios» **deshabilitado**. Volver a marcar: habilitado.
- Pedir: `POST /clinical/service-requests/duplicate-check` 200 → `POST /clinical/requisitions` 201 con 11 `componentConceptIds`, `specimenTypeConceptId`, `category:LAB`. Toast + el modal se cierra.
- Persistencia: `sessionStorage` `mock.clinica.ordenes` +1 renglón y `…ordenes.detalle` +1 (`persistencia-lab.json`). Tras `page.reload()` la sesión sigue, se reabre la casilla y el histórico trae «Hemograma (sin diferencial) … Leucocitos (recuento), Eritrocitos (recuento), Hemoglobina, Hematocrito y 7 más · Muestra: Sangre total (EDTA, tubo lila)» (`historico-1-…png`).

**Imagenología** (`img-*.png`, `img-canvas-A/B/C`)
- «Radiografía de mano PA y oblicua»: región por defecto Mano. **Clic real** (`page.mouse.click`) sobre la mano izquierda del paciente (lado derecho de la pantalla): el select pasa a «Metacarpo · Miembro superior», aviso vivo «Región: Metacarpo, izquierda.», lado Izquierda marcado. Clic en antebrazo/muñeca: no cambia y avisa «Esa pieza no corresponde a ninguna región de estudio.» (el estudio no los admite).
- Cambiar el select a «Dedos de la mano»: el 3D resalta los dedos y encuadra (`img-4-…png`; el canvas difiere píxel a píxel de antes: B≠C). Que «encuadra» sea correcto es juicio visual mío sobre la captura; no hay medida de cámara.
- Contraste: el RX lo fija («Sin contraste» activo; los otros dos deshabilitados). No se pudo probar elegir contraste en este estudio; no se probó un estudio con contraste opcional.
- Pedir: `POST /clinical/requisitions` 201 con `imaging{modalityConceptId, bodySiteConceptId (Dedos), lateralityConceptId (Izq), contrastConceptId}`. Tras recargar, histórico: «Radiografía simple · Dedos de la mano · Izquierda · Sin contraste».

**Otros / ECG** — «Electrocardiograma» ya tenía informe previo: aparece el aviso de duplicado. «Cancelar» → 0 escrituras y el modal sigue abierto; «Confirmar prescripción justificada» → `POST /clinical/service-requests` 201 con `previousDiagnosticReportId` + `duplicateOverrideReason`. «Consultar y reutilizar resultados» → 201 con `reusePreviousReport:true`, toast «cubierto por el informe previo».

**Cerrar con selección pendiente** — «¿Descartar lo escrito?» aparece; «Seguir escribiendo» conserva la selección; «Descartar» cierra, 0 escrituras, al reabrir el contador vuelve a «Todavía no eligió ningún análisis».

**422 y duplicado** — el duplicado salió natural (ECG). El 422 **no se pudo provocar desde los controles** (la interfaz no deja armar un componente ajeno; el simulador no tiene modo 422 en `mock:fallos`). Se entregó a `flow.start` (el mismo camino que «Pedir estudios») un renglón con un componente de otro panel, usando `window.ng.getComponent`: `POST /clinical/requisitions` → **422** `COMPONENT_NOT_IN_PANEL`, la alerta por renglón (`estudios-error-renglon`) dice «Perfil lipídico (componente ajeno): uno de los componentes no pertenece a este panel.» y el almacén no cambió (852 → 852). Es una prueba del mapeo del error, no del flujo de una persona.

## Cadena UI → request → response → persistencia → recarga → UI
En demo no hay tráfico de red: el simulador responde dentro del navegador. Lo que se **observó**: la UI, las escrituras anotadas por el interceptor (`sessionStorage['mock:registro']`, volcado en `flujo-peticiones-mock.json` con cuerpo y estado), el contenido de las tablas persistidas en `sessionStorage` y el histórico tras `reload`. Lo que **no** se observó: HTTP real, cabeceras, la API de verdad (no existe el contrato), `If-Match`/`Idempotency-Key` más allá de lo anotado.

## Defectos encontrados
| # | Sev. | Dónde | Estado |
|---|---|---|---|
| D1 | mayor | Buscar «hemoglobina» no encontraba el hemograma: el listado no trae componentes (llegan con el detalle al marcar) y el picker buscaba solo local | **Corregido**: el catálogo pregunta al servidor (`q`) y el picker suma esos resultados (`serverMatches`, `queryChange`). Spec en `lab-analysis-picker.logic.spec.ts` (2 casos). Evidencia `defectos/D1-…` (antes) y `lab-1-…` (después) |
| D2 | menor | Desplegables de modalidad y estudio mostraban el código crudo `SC_MOD_RX · Mano` | **Corregido** (`shortModalityCode`). Specs en `imaging-study-picker.logic.spec.ts` y `.spec.ts`. `defectos/D2-…` |
| D3 | menor | Tras pedir, el toast dice «lo verá acá abajo» pero el modal se cierra y «Lo registrado en este encuentro» no lista órdenes (la casilla tampoco tiene contador: `ordenes: null` a propósito en `consultation.ts:499`) | Sin corregir: copia del toast (`analysis-order-block.ts:471`) y diseño de `consultation` fuera del alcance acordado. `lab-6-…png` |
| D4 | menor | A 768 el botón «Pedir estudios» (pegajoso, `app-form-actions`) deja ver una franja del select de región/lado por debajo (`medico-img-3d-768-*.png`) | Sin corregir: componente compartido |
| D5 | menor | Tamaños de toque < 44 px: botones/segmentados/selects de 40 px (segmentado Tabla/Lista de 32 px, `chip__remove` 24 px, «Cerrar» 40 px). Las casillas miden 18×40 la etiqueta, pero la fila que las envuelve (`.lab__fila`) tiene `min-block-size: 44px` y reenvía el clic; no se midió la fila en esta corrida | Sin corregir: átomos compartidos. Cifras en `mediciones.json` (`targets`) |
| D6 | menor | Con el filtro «dedos» el select de región tiene un encabezado de grupo y una fila: teclado necesita dos ↓ + Enter (una sola ↓ + Enter no elige) | Sin corregir: `tree-select` compartido; funciona |
| D7 | observación | `NG0955` (track duplicado «Consulta») 25 veces en consola; en una corrida `Application did not stabilize within 9 seconds` | Fuera de alcance (consulta) |
| D8 | observación | El catálogo del simulador es un subconjunto (52 análisis, 66 estudios), no los 532/475 del plan | Esperado hasta H3.M2 |
| D9 | cosmético | En 1440 el buscador de imagen queda ~24 px más abajo que el select de modalidad (misma fila) | Sin corregir |

## Mediciones (`mediciones.json`)
Medido en el diálogo abierto, 390/768/1440 × claro/oscuro, en laboratorio (Tabla, Lista), imagenología y histórico.
- Centrado: la tarjeta dentro del cuerpo del modal tiene holgura izquierda = derecha (diferencia **0 px** en todas) y llena 88,8 % (390), 92,5 % (768), 95,1 % (1440) ≥ 85 %. El formulario dentro de la tarjeta: 0 px y ≥ 99,4 %. Sin desborde horizontal en ningún caso. **Reserva:** el modal mide 980 px como máximo (`size="xl"`), no el área de 1440 px de la página; la regla §5 se midió contra el modal.
- Targets ≥ 44 px: **no se cumple** (ver D5); entre 17 y 37 elementos por estado miden menos de 44 px (tabla en el JSON).

## Teclado y foco (`teclado-claro.log`, `teclado-oscuro.log`, `teclado-*.png`)
- Tab desde el buscador: segmentado Tabla/Lista → chip de sección → casillas de cada tarjeta. Foco visible en todos (contorno de 2–4 px; la casilla lo muestra sobre el recuadro).
- ←/→ en Tabla/Lista cambia la vista y mueve el foco. Espacio marca/desmarca padre y componente; Espacio sobre el padre parcial lo lleva a «todos» (13/13).
- Select de estudio: Enter abre, se escribe, ↓ Enter elige. Select de región: foco visible, Enter abre con foco en el buscador, Enter elige (con dos ↓, ver D6), el foco vuelve al disparador, Escape lo cierra sin cambiar (en una corrida en claro el diálogo seguía abierto tras Escape; no se reprodujo en la oscura ni aislado: **intermitente, sin explicar**). ←/→ en «Lado del paciente» cambia el lado y el resumen.
- El canvas 3D es alcanzable (`tabindex=0`, `role=application`, etiqueta con instrucciones de flechas). Girar/zoom con teclado **no se probó**.

## Consola y red
`consola-red-*.json`, `teclado-consola-red-*.json`, `flujo-consola-red.json`. Errores: **1** `console.error` y es el 422 provocado a propósito (`[API] POST /clinical/requisitions → 422`). Sin `pageerror`, sin respuestas ≥ 400 reales, sin `requestfailed`. Avisos: `NG0955`, hidratación `NG0505` (filtrada), mensajes de rendimiento de WebGL.

## Qué NO se probó
API real; contraste elegible (estudio con contraste opcional); orden de varios renglones a la vez; selector de ejecutor con centro elegido; vista de bandeja del receptor; rotación/zoom del 3D por teclado; lector de pantalla; contraste de color medido; carga lenta y error del catálogo (estados S2/S8/S9); sin WebGL 2; carrera de la búsqueda en servidor con red lenta (solo cubierta por el descarte por secuencia en el código).

## Correcciones y verificación de código
Archivos tocados: `analysis-order-block/{analysis-order-block.html, study-order-catalog.ts, lab-analysis-picker/*.ts, imaging-study-picker/*.ts}` y sus specs (solo se agregaron casos). `eslint` sobre `analysis-order-block`: sin hallazgos. Specs de `analysis-order-block/**` (`yarn ng test --include`): 11 archivos, 237 pruebas, todas pasan. No se corrió `yarn test` completo, ni `typecheck`, ni los `check-*.mjs`; el build de demo sí compiló las plantillas.

Guiones usados: `guion/` (Playwright sobre Chromium del entorno; `serve.cjs` es el servidor estático).
