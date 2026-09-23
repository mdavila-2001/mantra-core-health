# Plan — Disciplina de tabla con acciones (ADR-0015) y «Dónde atiendo»

- Fecha: 2026-09-22 (turno noche, ejecutado 2026-09-23) · Repos afectados: `mantra-core-health` (frontend) ·
  Predecesor: PR #570 `pablo/refactor-tabla-canonica` (ya mergeado en `mockup`, corte citado en el reparto)
- Fuente del pedido: `docs/requisitos/CORRECCIONES-DOCTOR-Y-PACIENTE-2026-09-22.md` — D-04, D-05, D-06, D-08, D-09
- Verificación previa: `docs/verificacion/VERIFICACION-CONTRA-CODIGO-2026-09-22.md` — §1, §2 (D-04…D-09), §3, §4
- Reparto: `AlovidaPromptManager/repartos/2026-09-22/PromptNoche/Pablo/Noche-DisciplinaDeTablas.PatronYDondeAtiendo/TablaConAccionesModalConfirmacionYPaginacionEnCliente.md`
- Resultado observable: la médica (`medica@alovida.mock`) abre «Dónde atiendo», agrega/edita su
  consultorio en un modal con campos llenos, confirma antes de guardar y antes de retirar, busca/filtra
  arriba, pagina abajo a la derecha sin scroll lateral; el mismo patrón queda publicado como ADR-0015 con
  las piezas (`app-pagination`, `data-table`, `filter-bar`) listas para que Itzan y Marcelo lo monten.
- Kill-test: en `/my-account/edit` → «Dónde atiendo», tocar «Agregar mi consultorio propio». Si el
  formulario aparece **debajo** de la lista y no en un modal, H4 no está hecho.

## Corte

- `TARGET_REF` original citado en el reparto: `origin/mockup` @ `b655e8449abd662d6b24156fd6e2b06aeb120cc1`
  (PR #570, ya mergeado).
- **Corte propio, reconsultado ahora** (regla del reparto: "Reconsultalo y fijá el tuyo"):
  `origin/mockup` @ `8ae7283a2944074d5aecd4f1c634def57ca23083` (2026-09-23).
- Entre ambos SHA se mergearon PR #574 (Marcelo), #575 (Ender), #576 (Itzan), #577/#578/#579 (Justin):
  ninguno toca `data-table/**`, `filter-bar/**`, `pagination/**`, `row-actions/**`, `work-history/**` ni
  `docs/adr/**` — verificado con `git diff --stat` (evidencia en H1.S1).
- Rama de trabajo: `pablo/noche-disciplina-tablas-2026-09-22`, creada desde `origin/mockup` en el SHA de arriba.

## Alcance

- IN: baseline de `lint`/`typecheck`/`test` con rojos previos clasificados · inventario de tablas y
  `confirm` · capturas previas · ADR-0015 con las siete reglas y las dos decisiones (paginación, scroll) ·
  extensión de `CONTRATO-data-table.md` · `app-pagination`: texto en Anterior/Siguiente, select de
  página, alineación · `data-table`: alto máximo con scroll vertical y sin lateral, opt-in · `filter-bar`:
  proyección para la acción a la derecha y receta de buscador multicampo · «Dónde atiendo»: tabla, barra,
  paginación en cliente, modal de alta/edición con campos llenos, guardar por cambios, confirmación al
  guardar y al retirar, mapa dentro del modal, vaciar la dirección al tocar el mapa · historial laboral:
  layout de tabla, editar, retirar, adjunto (contra el simulador, declarado) · veredicto por cada
  `iconOnly` de mis archivos · specs dirigidos · capturas por viewport y tema · `PLAN.md`, `REPORTE.md` y
  `evidencia/`.
- OUT: cualquier archivo fuera de los reservados (ver ficha abajo) · las tres tablas de «Configurar tu
  perfil» (son de Itzan) · `content-dialog` y `dialog-service` (son de Marcelo) ·
  `core/mock/handlers/profiles.handlers.ts` (Itzan) y `scheduling.handlers.ts` (Ender) · escribir API esta
  noche · cambiar el comportamiento por omisión de `data-table`/`filter-bar`/`pagination` para consumidores
  actuales · reemplazar la paginación por cursor del organismo · ampliar el set de íconos «de paso» ·
  convertir los `iconOnly` que no son míos · migrar las 26 tablas que no son «Dónde atiendo» ni las del
  perfil.
- Ambigüedades registradas: ver `Q-5, Q-6, Q-7, Q-9, Q-18, Q-P1, Q-P2` en la §5 del documento del reparto
  (arriba). Se replican las relevantes en cada microtarea que las usa.

## Archivos reservados (no tocar nada fuera de esta lista)

`src/app/shared/components/organisms/data-table/**` · `organisms/filter-bar/**` ·
`src/app/shared/components/molecules/pagination/**` · `molecules/row-actions/**` ·
`src/app/features/account/my-profile/work-history/**` ·
`docs/adr/ADR-0015-*.md`, `docs/adr/index.md`, `docs/adr/CONTRATO-data-table.md`.

## H1 — Corte, baseline, inventario y capturas previas

**Prioridad:** BLOQUEANTE
**CA:** Dado tu entorno, cuando alguien pregunta contra qué versión trabajaste, cuántas tablas y
confirmaciones hay en el producto y cómo se veía «Dónde atiendo» antes, entonces hay SHA, dos tablas de
inventario y capturas — no un recuerdo.
**DoD:** salidas del baseline en `evidencia/antes/` con exit code, inventario de tablas y `confirm` con
dueño, y capturas descritas.
**Estado:** HECHO

### H1.S1 — Corte y baseline

**CA:** Dado un rojo posterior, cuando alguien pregunta si lo rompiste vos, entonces la respuesta sale de
un archivo.
**DoD:** salidas con su código de salida, pegadas, y cada rojo previo clasificado.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar corte y rama | Hay SHA y rama en `PLAN.md` | `git fetch origin && git rev-parse origin/mockup && git branch --show-current` | HECHO |
| H1.S1.M2 | Baseline de `lint` y `typecheck` | Hay salida y exit code | `yarn lint; echo "exit=$?"; yarn typecheck; echo "exit=$?"` → `evidencia/antes/` | HECHO |
| H1.S1.M3 | Baseline de `test` | Hay conteo de fallos previos | `yarn test --watch=false` → `evidencia/antes/test.txt` | HECHO |
| H1.S1.M4 | Clasificar cada rojo previo | Cada uno con su clase de la regla 80.4 | tabla en `PLAN.md` | HECHO |

**Resultado del baseline (evidencia literal en `evidencia/antes/`):**

- `yarn lint` → `exit=0`. Sin rojos.
- `yarn typecheck` → `exit=0`. Sin rojos.
- `yarn test --watch=false` → `exit=1`. **3 archivos de test fallan, 4 tests, de 575 archivos / 7173
  tests** (`7169 passed`).

| Test que falla | Clase (regla 80.4) | Motivo observado | ¿Toca mis archivos? |
|---|---|---|---|
| `src/app/app.routes.spec.ts` — "una sección disponible NO cae en el placeholder" | `PRODUCT_BUG` o `TEST_BUG` (sin diagnosticar; no es mi territorio) | Aserción falla sobre el ruteo de secciones | No — `app.routes.ts` es de Ender (ficha, archivos ajenos) |
| `src/app/features/shell-layout/shell-layout.spec.ts` — "sin rótulo que las agrupe, las cosas parecidas siguen saliendo seguidas" | `PRODUCT_BUG` o `TEST_BUG` (sin diagnosticar) | `expected false to be true` en agrupación de desplegables del header | No — `shell-layout` es de Ender |
| `src/app/features/insurance/insurance-analytics/insurance-analytics.spec.ts` — "el tablero no tiene violaciones mecánicas de accesibilidad" | `ENVIRONMENT` (probable): `Test timed out in 5000ms` | Timeout fijo de Vitest, no una aserción de negocio | No — fuera de los cinco carriles del reparto de esta noche |

Ninguno de los tres toca `data-table/**`, `filter-bar/**`, `pagination/**`, `row-actions/**`,
`work-history/**` ni `docs/adr/**`. Quedan **fuera de alcance** (regla 00 §3): se anotan, no se
arreglan. Se usan como referencia de "no nuevo" en H6.S1 (regresión).

### H1.S2 — Inventario y capturas previas

**CA:** Dado el pedido «siempre», cuando alguien pregunta a cuántas tablas alcanza y quién es dueño de
cada una, entonces hay una tabla de inventario; y hay capturas de cómo se veía lo que vas a tocar.
**DoD:** dos inventarios en `evidencia/antes/` y capturas con su línea.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Inventariar las plantillas que instancian `app-data-table`: ruta, dueño, ¿tiene barra?, ¿tiene paginación? | Ninguna fila sin dueño o «sin dueño» declarado | `git grep -l '<app-data-table' origin/mockup -- 'src/app/**/*.html'` → `evidencia/antes/tablas.md` | HECHO (30 filas) |
| H1.S2.M2 | Inventariar los archivos con `dialogs.confirm(` y qué confirman | Filas con el tipo | `git grep -n 'dialogs.confirm(' origin/mockup -- 'src/app/**/*.ts' ':!*.spec.ts'` → `evidencia/antes/confirmaciones.md` | HECHO (40 sitios reales; el reparto citaba 26, desactualizado — ver nota en el archivo) |
| H1.S2.M3 | Capturar «Dónde atiendo» (ficha y editor) en escritorio y móvil, y ejercitar: ¿«Retirar» confirma? ¿el formulario de alta aparece abajo? | Cuatro capturas miradas + dos respuestas observadas | `evidencia/antes/capturas/` con una línea por captura | HECHO (6 capturas — ver `LEEME.md`) |
| H1.S2.M4 | Revisar consola y red antes de tocar | Hay lista de errores previos (o «ninguno», dicho) | lista en `evidencia/antes/consola-red.txt` | HECHO (ver `capturas/LEEME.md` — 2 errores CSP pre-login ajenos, 0 tras loguearse) |

**H1 completo: HECHO.** Confirmado con evidencia real: el defecto D-04 (formulario en línea, no en
modal) y D-08 (retirar confirma, guardar corrige el mismo defecto) están verificados **ejecutando
el navegador**, no leyendo el código.

## H2 — ADR-0015: la tabla con acciones

**Prioridad:** BLOQUEANTE para Itzan y Marcelo
**CA:** Dado el ADR, cuando alguien lo lee, entonces conoce las siete reglas de D-04/D-08, cómo se pagina
cada tipo de lista, qué decisión anterior reemplaza y con qué piezas se cumple.
**DoD:** `docs/adr/ADR-0015-*.md` indexado; `CONTRATO-data-table.md` extendido.
**Estado:** HECHO

### H2.S1 — Escribir y publicar el ADR

**CA:** Dada cualquiera de las siete reglas, cuando se la busca en el ADR, entonces está con su motivo, su
pieza y su excepción declarada si la tiene.
**DoD:** archivo en disco, `index.md` con su fila, anuncio en el daily con la ruta.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Escribir las siete reglas + la regla madre D-04 | Las 7 + D-04 están, cada una con pieza y motivo | `grep -c '^### Regla' docs/adr/ADR-0015-tabla-con-acciones.md` → 8 | HECHO (salida: `8`) |
| H2.S1.M2 | Decisión de paginación (Q-5) | La decisión dice el criterio y nombra las dos familias | sección «Paginación» del ADR | HECHO |
| H2.S1.M3 | Decisión de scroll (Q-6), conservando la razón del 18/09 | Las dos fechas están; la razón vieja no se borra | sección «Scroll» del ADR con `2026-09-18` y `2026-09-22` | HECHO |
| H2.S1.M4 | Indexar en `docs/adr/index.md` | Hay fila | `grep -c 'ADR-0015' docs/adr/index.md` → 1 | HECHO (salida: `1`) |
| H2.S1.M5 | Publicar en el daily de equipo | Itzan y Marcelo pueden leerlo sin abrir el PR | sección en `Daily-Noche-2026-09-22.md` (repo de estándar) | HECHO |

**H2.S1 completo: HECHO.** El ADR está publicado, indexado y anunciado. Hallazgo registrado para
Marcelo: su `confirmarCambios()` existe en su rama `pablo/inicio-paciente-silueta-voz-y-confirmacion`
pero no llegó todavía a `origin/mockup`; mientras tanto H4.S2.M3 usa `dialogs.confirm()` genérico,
declarado (regla 65).

### H2.S2 — Extender `CONTRATO-data-table.md`

**CA:** Dado el contrato del organismo, cuando alguien pregunta cómo convive con un paginador externo y
cómo se acota el alto, entonces el contrato lo dice, con el input y su valor por omisión.
**DoD:** dos secciones nuevas en el contrato.
**Estado:** HECHO (reordenada después de H3.S2, tal como se registró — ver desvío abajo)

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Sección «Alto máximo y scroll vertical» | Está el input y el por omisión | `grep -n 'scroll vertical' docs/adr/CONTRATO-data-table.md` | HECHO |
| H2.S2.M2 | Sección «Paginación externa» | Está dicho con ejemplo de marcado | `grep -n 'app-pagination' docs/adr/CONTRATO-data-table.md` | HECHO |

**Desvío del plan, registrado:** `CONTRATO-data-table.md` declara en su propio encabezado que "no
es una propuesta: documenta el organismo **tal como existe hoy**". Escribir estas dos secciones
antes de que el input de alto máximo exista en `data-table.ts` sería documentar algo que todavía no
es cierto (regla 00 §1.1). Se invierte el orden: **primero H3.S2 (el input real, con su spec),
después estas dos microtareas**, sin renumerarlas. No es un `BLOQUEADO` de la regla 65 (eso es para
cuando falta el insumo de **otra persona**): acá el contrato es el que yo mismo voy a escribir, así
que es simplemente una reordenación de mi propio trabajo, declarada como `TODO` con su condición.

## H3 — Las piezas del patrón

**Prioridad:** ALTA
**CA:** Dado un consumidor que opta por el patrón, obtiene Anterior/Siguiente con texto, select de página
y de tamaño, alto máximo con scroll vertical sin lateral, y un hueco para el botón de acción a la
derecha — y ningún consumidor que no opte cambia de comportamiento.
**DoD:** specs dirigidos en verde con los tres niveles del contrato; consumidores ajenos comprobados.
**Estado:** HECHO (S1, S2 y S3 completas, verificadas en unit tests y — para lo que H4.S1 llegó a
aplicar en un consumidor real — también en navegador)

### H3.S1 — `app-pagination`: texto, select de página, alineación

**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Anterior/Siguiente con texto e ícono | Cero `iconOnly` en la molécula | `git grep -c iconOnly -- src/app/shared/components/molecules/pagination/pagination.html` → 0 | HECHO (sin salida = 0) |
| H3.S1.M2 | Select de página con `ariaLabel="Ir a la página"` | Elegir una opción navega a esa página | spec: `goTo` desde el select | HECHO (`pageJumpChoices`/`goToFromSelect`, 4 tests nuevos) |
| H3.S1.M3 | Verificar select de tamaño existente y reset a página 1 | Observado en spec | spec: «cambiar tamaño resetea a 1» | HECHO (test preexistente, reapuntado a `.pagination__size select` tras agregar el segundo select) |
| H3.S1.M4 | Alineación a la derecha con tokens, sin literales | A 375 px no desborda | medición pegada | HECHO — ver hallazgo abajo |
| H3.S1.M5 | Spec de tres niveles: correcto/límite/inválido | ≥10 tests en verde | `npx ng test --include=…/pagination.spec.ts --watch=false` | HECHO (30/30, `evidencia/h3/pagination-spec.txt`) |
| H3.S1.M6 | Comprobar los 3 consumidores actuales a mano | Las 3 pantallas se comportan igual que antes | `git grep -l '<app-pagination' origin/mockup -- 'src/app/**/*.html'` + capturas | HECHO (glossary, laboratory-detail vía `fact-section`, design-system) |

**Hallazgo real de H3.S1.M4, corregido en la misma microtarea:** agregar texto visible a
Anterior/Siguiente + el select de saltar página hizo que `.pagination__nav` (sin `flex-wrap`)
desbordara el viewport a 375 px — medido con Playwright en `/glossary`:
`document.documentElement.scrollWidth` 495 vs `clientWidth` 375 (regresión introducida por este
mismo cambio, no preexistente: antes los botones eran `iconOnly`, mucho más angostos). Se corrigió
agregando `flex-wrap: wrap` a `.pagination__nav` y `.pagination__pages`
(`pagination.css`). Re-medido tras el fix: `scrollWidth` 360 = `clientWidth` 360, **sin desborde**.
Capturas antes/después en `evidencia/h3/capturas/consumidor-glossary-375.png` (con desborde) y
`consumidor-glossary-375-corregido.png` (corregido).

### H3.S2 — `data-table`: alto máximo, scroll vertical, sin lateral

**Estado:** HECHO (las 6 microtareas, M6 satisfecha por H4.S1 con hallazgo registrado)

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S2.M1 | Input nuevo que acota el alto, por omisión apagado | Los 30 consumidores no cambian | `git diff` sólo código condicionado | HECHO — `maxHeight`/`effectiveMaxHeight`, por omisión `null` |
| H3.S2.M2 | Sin `overflow-x`, plegado por prioridad también en escritorio | A 1440 px con 8 columnas no hay scroll lateral | medición pegada | HECHO — `.data-table--constrained` fuerza `overflow-x:hidden` y pliega `.data-table__secondary` incluso ≥780px (ver CSS y specs) |
| H3.S2.M3 | `sticky:'end'` sin efecto sin scroll lateral; comentario remite al ADR con las dos fechas | El comentario cita las dos fechas | `grep -n '2026-09-22' data-table.types.ts` | HECHO |
| H3.S2.M4 | Spec de tres niveles | En verde | `npx ng test --include=…/data-table.spec.ts --watch=false` | HECHO — 31/31 (5 tests nuevos: correcto ×2, límite, inválido, CSS) |
| H3.S2.M5 | 3 consumidores ajenos sin la opción | Igual que antes | 3 capturas comparadas | HECHO — `progress-notes`, `my-quotations`, `diagnostics`: sin errores de consola, sin cambio visible (la opción es opt-in y ninguno la usa) |
| H3.S2.M6 | Capturas 375/768/1440 claro/oscuro, miradas, **de la opción activa** | 6 capturas con su línea | `evidencia/h3/capturas/` | HECHO — cumplida por H4.S1 («Dónde atiendo» es la primera aplicación real de `maxHeight`): `evidencia/h4/capturas/01` (1440 claro), `09` (375), `10` (768), `11` (1440 oscuro) — todas miradas. **Con el hallazgo de desborde de contenido a 375 px registrado en H4.S1, no oculto** |

### H3.S3 — `filter-bar`: acción a la derecha y buscador multicampo

**Estado:** HECHO (las 4 microtareas)

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Proyección `[filter-bar-action]` para el botón «Añadir», alineada al final | A la derecha en 1440, debajo en 375 | 2 capturas | HECHO — cumplida por H4.S1: el botón «Agregar mi consultorio propio» se ve a la derecha de la barra en `evidencia/h4/capturas/01` (1440) y debajo en `09` (375) |
| H3.S3.M2 | Receta de buscador multicampo en el comentario de cabecera | Hay ejemplo de 5 líneas | `grep -n 'multicampo' filter-bar.ts` | HECHO |
| H3.S3.M3 | Spec de tres niveles | En verde | `npx ng test --include=…/filter-bar.spec.ts --watch=false` | HECHO — 13/13 (correcto, límite, inválido con doble proyección) |
| H3.S3.M4 | 2 de los 8 consumidores ajenos sin proyección | Igual que antes | 2 capturas comparadas | HECHO — `glossary` (capturado en H3.S1) y `my-services`: sin errores de consola, sin hueco visible (`:empty{display:none}`) |

## H4 — «Dónde atiendo» cumple la disciplina entera

**Prioridad:** ALTA. **Estado:** A MEDIAS (H4.S1 y H4.S2 HECHO; H4.S3 con M3 pendiente de re-captura)

### H4.S1 — La lista pasa a ser tabla, con barra y paginación

**Estado:** HECHO

| ID | Microtarea | Estado |
|---|---|---|
| H4.S1.M1 | Columnas: nombre, tipo (insignia), dirección, QR, acciones | HECHO — 5 columnas reales, `data-table` semántica (`<table>`/`<th scope="col">`), verificado con Playwright: accessibility tree completo con `columnheader`/`row`/`cell` |
| H4.S1.M2 | Barra: `app-filter-bar` con buscador (nombre+dirección, normalizado) + filtro Tipo + botón de alta proyectado a la derecha | HECHO — buscar «banzer» filtra correctamente (spec); botón «Agregar mi consultorio propio» sólo aparece sin consultorio propio (verificado en navegador: no aparece cuando ya hay uno) |
| H4.S1.M3 | Paginación en cliente, `app-pagination`, 10 por omisión | HECHO — «1–4 de 4», selects de página y tamaño, verificado en captura |
| H4.S1.M4 | Alto máximo, sin scroll lateral | HECHO en 1440/768 (medido: `scrollWidth === clientWidth`). **Hallazgo real a 375 px** (ver abajo) |
| H4.S1.M5 | Spec: filtra, pagina, mantiene las acciones | HECHO — `work-history.spec.ts`, 73/73 en verde |
| H4.S1.M6 | Capturas 375/768/1440 × claro/oscuro | HECHO — 6+ capturas en `evidencia/h4/capturas/`, miradas |

**Hallazgo real, verificado y no resuelto — a 375 px hay contenido recortado, no scroll lateral:**
con `overflow-x: hidden` (H3.S2) y sólo las 3 columnas de prioridad 1 (Nombre, Tipo, Acciones —
Dirección y QR ya se pliegan al detalle), el contenido sigue siendo más ancho que la caja: medido
en `/my-account/edit` con Playwright, `scrollBox.scrollWidth` = 452 px contra `clientWidth` = 251 px
a 375 px de viewport. **No hay scroll lateral** (cumple la letra de la regla 6), pero el texto
sobrante queda **oculto**, no accesible ni con scroll. A 768 px y 1440 px no pasa (`scrollWidth ===
clientWidth`). Causa: tres columnas de prioridad 1 con nombres largos y una insignia no entran en
251 px útiles; `data-table` no tiene mecanismo para plegar columnas de prioridad 1. **No se
corrigió**: cambiar qué columnas son «imprescindibles» es una decisión de negocio (¿se puede vivir
sin ver el nombre completo o la insignia en un teléfono angosto?), no una que tome sin confirmarla
— queda registrada como riesgo residual y ambigüedad nueva (ver REPORTE.md).

### H4.S2 — El formulario del consultorio pasa a un modal (D-04, D-06)

**Estado:** HECHO

| ID | Microtarea | Estado |
|---|---|---|
| H4.S2.M1 | Mover el `<form>` a `app-content-dialog size="md"` | HECHO — verificado en navegador: «Editar» abre el modal, el formulario ya no vive en línea (capturas 01-02) |
| H4.S2.M2 | «Guardar» habilitado sólo si el borrador difiere del original | HECHO — `hayCambiosEnSede`/`puedeGuardarSede`; **verificado en navegador**: abrir «Editar» sin tocar nada → botón deshabilitado (captura 02); cambiar el nombre → habilitado (verificado) |
| H4.S2.M3 | Confirmación al guardar (`dialogs.confirm()`, declarado — `confirmarCambios()` de Marcelo aún no mergeado, regla 65) | HECHO — **verificado en navegador**: guardar con cambios muestra «¿Confirmás estos cambios?» apilado sobre el modal (captura 03); confirmar persiste el PATCH y refresca la tabla (captura 04) |
| H4.S2.M4 | Cancelar/`Escape` con cambios → pregunta de descarte; sin cambios cierra directo | HECHO — **verificado en navegador**: con cambios, «Cancelar» muestra «¿Descartar los cambios?» (captura 08); sin cambios cierra sin preguntar (spec) |
| H4.S2.M5 | «Retirar» desde `app-row-actions` sigue confirmando | HECHO — sin cambios de código, ya lo hacía (H1); no se tocó |
| H4.S2.M6 | D-06: `marcarPunto($event)` vacía `direccionDeSede` y anuncia | HECHO — **verificado en navegador de punta a punta**: escribir dirección, tocar el mapa → campo vacío + aviso «Volvé a escribir la dirección…» visible junto al campo (captura 06b/07), `Guardar` se habilita |
| H4.S2.M7 | El mapa dentro del modal mide bien (no 0×0) | HECHO por diseño: el mapa sólo se monta tras un clic manual («Marcar el punto»), posterior a que el modal ya esté abierto y con layout estable — **verificado**: el mapa se vio con calles a la primera, sin gris (captura 05) |
| H4.S2.M8 | Spec: alta, edición con campos llenos, guardar por cambios, descarte, retiro | HECHO — 15 tests nuevos + 58 preexistentes actualizados, 73/73 en verde |
| H4.S2.M9 | Teclado completo | **NO verificado** — no se recorrió el modal sólo con teclado (Tab/Shift+Tab/Escape) en esta sesión; declarado como no cubierto |

### H4.S3 — El historial laboral como tabla con la disciplina (D-09)

**Estado:** A MEDIAS (7 de 8 HECHO; M3 espera re-captura tras corregir un defecto visual)

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H4.S3.M1 | Localizar el manejador simulado del historial y su colección | Hay ruta:línea en `PLAN.md` | `git grep` + lectura de `profiles.client.ts`/`profiles.types.ts` | HECHO — `ProfilesClient` sólo tiene `listAffiliations()`/`addAffiliation()`; `PractitionerAffiliation` no tiene `fileId`; el manejador es de Itzan (`profiles.handlers.ts`, fuera de mi alcance) |
| H4.S3.M2 | Manejador ajeno → pedido anotado + doble simulado en tres niveles | Pedido en los dos dailies; doble declarado | `evidencia/h4/doble-historial.md` | HECHO — doble local (`edicionesLocalesDeAfiliacion`, `idsRetiradosLocalmente`) ejercitado en correcto/límite/inválido, ver el documento |
| H4.S3.M3 | Layout `tabla` con `app-data-table`, barra y paginación en cliente | Con `layout="tabla"` se ve la tabla; sin él, nada cambia | spec + captura | A MEDIAS — anda (tabla, filtro, paginación, editar, retirar verificados en navegador) pero la revisión adversarial (regla 35) encontró un defecto real: institución y cargo salían pegados («Clínica Los OlivosJefa de servicio»). Corregido en `work-history.html` (envoltorio `.historial__institucion`), typecheck exit=0, **falta re-capturar y hacer las dos pasadas** sobre la re-captura. Antes de la corrección: **verificado en navegador real** (stock de componentes, cuenta `medica`): tabla con Institución/Período/Adjunto/Acciones, filtro y paginación reales (`evidencia/h4s3/capturas/h4s3-historial-tabla.png`); `layout` por omisión sigue siendo `'flat'`, no cambia nada para quien no lo pide |
| H4.S3.M4 | Editar y retirar por fila con modal, guardar por cambios y las dos confirmaciones | Ejercitado | capturas | HECHO — **verificado en navegador**: «Editar» abre modal con cargo precargado; «Guardar los cambios» deshabilitado sin cambios, habilitado con cambios; confirmar aplica el cambio y cierra (`h4s3-editar-modal.png`, `h4s3-confirmar-guardar.png`, `h4s3-guardado.png`); «Retirar» confirma y saca la fila con toast (`h4s3-retirar-confirm.png`, `h4s3-retirado.png`) |
| H4.S3.M5 | Adjunto en agregar y en editar, PDF/JPG/PNG; el contrato real no tiene `fileId`: doble declarado | El archivo se guarda y se descarga desde la fila | captura + nota en `REPORTE.md` | HECHO — subida real contra `FilesClient.upload()` (`POST /common/files/upload`), el `fileId` devuelto se asocia en el doble local; spec correcto/inválido (subida OK / subida falla) en `work-history.spec.ts` |
| H4.S3.M6 | El modal de alta existente gana confirmación al guardar y descarte con cambios | Observado | captura ×2 | HECHO — `registrar()` ahora pide `dialogs.confirm()`; `intentarCerrarAltaDeVinculo()`/`confirmarDescarteYCerrarAltaDeVinculo()` con el mismo patrón que H4.S2; cubierto por los 8 tests preexistentes de alta (actualizados a `await`) |
| H4.S3.M7 | Spec del historial: tabla, alta, edición, retiro, adjunto | En verde | `npx ng test --include=…/work-history.spec.ts --watch=false` | HECHO — 83/83 (73 preexistentes + 10 nuevos de H4.S3), salida en `evidencia/h4s3/work-history-spec.txt` |
| H4.S3.M8 | Publicar a Itzan por el daily: selector, input y ejemplo de montaje | Itzan puede montarlo sin preguntarme | sección en el daily propio y de equipo | HECHO — ver `Pablo-Daily-Noche-2026-09-22.md` §0 y `Daily-Noche-2026-09-22.md` |

**Limitación declarada, no oculta:** el doble local (cargo, adjunto, retiro) vive sólo en memoria del
componente — recargar la página lo pierde. No es una regresión: es lo que dice `doble-historial.md`
y lo que ve la persona que retira un vínculo («guardado en este dispositivo»). Deja de ser necesario
en cuanto Itzan publique el `PATCH`/`DELETE`/`fileId` reales.

## H5 — D-05: veredicto por cada `iconOnly`

**Prioridad:** MEDIA. Microtareas H5.S1.M1-M4 según el reparto. **Estado:** TODO

## H6 — Regresión, gates y cierre

**Prioridad:** ALTA. Microtareas H6.S1.M1-M5 y H6.S2.M1-M5 según el reparto. **Estado:** TODO
(H6 no estaba en el alcance de esta sesión — el trabajo cerrado fue H1-H3.S1. Se intentó de
todas formas H6.S1.M2 — `test` completo — como regresión final antes de cerrar.)

| ID | Microtarea | Estado | Evidencia |
|---|---|---|---|
| H6.S1.M1 (`lint`/`typecheck`) | Corrido para `pagination` (no para todo el hito, sólo lo tocado) | HECHO, parcial | `evidencia/h3/lint.txt`, `evidencia/h3/typecheck.txt` — ambos `exit=0` |
| H6.S1.M2 (`test` completo) | **BLOQUEADO — `ENVIRONMENT`** | Dos intentos, dos caídas de infraestructura distintas (`write EPIPE` del pool de workers; `Worker exited unexpectedly`), ninguna es un fallo de aserción. Evidencia y análisis completo en `REPORTE.md` §"Regresión final". No es regla 65 (no depende de otra persona): es inestabilidad de la máquina de test, declarada con evidencia (regla 80.4.1), no maquillada como PASS. |
| Resto de H6 | TODO | No se empezó |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `data-table` (30 consumidores), `filter-bar` (8), `pagination` (3): cambio no opt-in rompería pantallas ajenas | Alto | Todo input nuevo apagado por omisión; muestra ajena comprobada con captura en cada subtarea |
| Historial laboral sin `fileId`/manejador propio en el contrato real (Q-9, Q-P1) | Medio | Doble declarado en `evidencia/h4/doble-historial.md` (regla 65) |
| Confirmación al guardar depende de `confirmarCambios()` de Marcelo | Medio | Si no llegó: `dialogs.confirm()` tal como existe, declarado (regla 65) |
| Alcance de una noche real (68 microtareas) no entra en una sola sesión | Alto, esperado | Prioridad H1 → H2 → H3.S1 primero (desbloquean a Itzan/Marcelo); el resto puede cerrar `A MEDIAS` con detalle |
