# Plan — C9: «Mis órdenes» del paciente, por tipo, con buscador, filtros, tabla sin scroll y paginación

- Fecha: 2026-09-25 · Repo: `mantra-core-health` (worktree `wt-clinica-c9`) · Predecesor: `features/account/diagnostic-orders/**` existente (agrupado por atención)
- Fuente: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Pablo/Noche-EncuentroClinico.C9-MisOrdenes/MisOrdenesPorTipoConBarraYPaginacion.md`
- Rama: `claude/clinica-c9-mis-ordenes`, desde `origin/mockup` @ `bf2c35452363ede1d367f94c4fd726b2b9a63cb1` (mismo corte que Farmacia, confirmado sin novedades con `git rev-parse origin/mockup`).
- Resultado observable: `paciente@alovida.mock` ve «Mis órdenes» como una tarjeta centrada con 4 pestañas (Todas/Laboratorio/Imagenología/Otros), cada una con buscador + 3 filtros + tabla sin scroll lateral + paginación.
- Kill-test: scroll lateral en la tabla a 390/768, o un paginador sin número de página.

## Alcance
- IN: `features/account/diagnostic-orders/**` reescrito completo (tipos, componente, plantilla, specs); reusar `app-tabs`, `app-filter-bar`, `app-data-table`, `app-pagination`, `app-row-actions`, `app-view-state-host`, `app-status-seal`; derivar `type: AnalysisCategory` desde `categoryConceptId` (`SRQ-LAB`→Laboratorio, `SRQ-IMAGING`→Imagenología, resto→Otros) vía `TerminologyClient.readConceptLabels` (patrón ya existente en el archivo actual); URL de ida y vuelta (pestaña/búsqueda/filtros/página); Playwright `clinica-c9-mis-ordenes.spec.ts`; capturas y doble revisión (diferidas al pase final de la noche, junto con Farmacia — ver nota de secuenciamiento).
- OUT: tocar el mock/seed (`core/mock/handlers/diagnostics.handlers.ts`, `fixtures/clinica.ts`, de C2) · `account/diagnostic-results/**` · `laboratory-directory/**` · los componentes compartidos `data-table`/`filter-bar`/`pagination`/`row-actions` (si falta algo, se anota) · `account/medical-record/**` (C6) · inventar un paginador propio · esperar a C2.
- Ambigüedad registrada: el archivo actual tiene una cuarta acción, «Reservar hora en un laboratorio» (refactor UX previo, no mencionada en el prompt de C9). El prompt enumera sólo tres acciones («Ver resultado», «Ver preparación», «Ver liquidación») pero no dice explícitamente que se retire la cuarta. **Se conserva** como cuarta acción de `app-row-actions` (con texto, como las demás) para no perder una capacidad ya entregada sin que nadie lo haya pedido — con `ROW_ACTIONS_INLINE_MAX = 2`, las cuatro entran igual (2 en la fila, 2 en el desplegable). A confirmar con el propietario si debía sacarse.

## H1 — Arranque, estándar, baseline
**Estado:** HECHO
- Corte confirmado: `bf2c3545…` (igual a Farmacia). `corepack yarn typecheck` → exit 0. Spec existente de `diagnostic-orders` → **15 passed (15)** antes de tocar nada.
- Capturas «antes» (390/1440): diferidas al pase final de Playwright de la noche (ver nota de H4/H8 de Farmacia — mismo motivo: exige el stack local completo).

## H2 — Modelo de vista y estado
**Estado:** HECHO

| ID | Microtarea | CA | Estado | DoD ejecutado |
|---|---|---|---|---|
| C9.H2.M1 | `PatientOrderRow` + derivación de `AnalysisCategory` (con y sin `category`) | Sin `any`; sin uuids en la fila; spec con los dos caminos | HECHO | `diagnostic-orders.spec.ts` "con categoría SRQ-LAB..." y "sin categoryConceptId..." |
| C9.H2.M2 | Señales (`tab`,`q`,`estado`,`resultado`,`periodo`,`pagina`,`tamano`), `computed` de filtrado/paginado, URL ida y vuelta | Cambiar un control cambia la URL; entrar por URL restaura la vista | HECHO | `diagnostic-orders.spec.ts` "cambiar un filtro actualiza la URL" y "entrar por una URL con filtros restaura la vista" — **se descubrió que requieren `RouterTestingHarness`**, no `TestBed.createComponent` a secas: `Router.navigate([], {relativeTo})` con un `ActivatedRoute` no adjunto a un outlet no escribe nada. Desvío documentado en el spec |

## H3 — Plantilla, acciones, estados M34, accesibilidad
**Estado:** HECHO (accesibilidad automática corrida; falta la manual con teclado/lector, ver "No cubierto")

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| C9.H3.M1 | Plantilla §4 completa (tabs, filter-bar, data-table, pagination) | HECHO | `corepack yarn build` exit 0 |
| C9.H3.M2 | `app-row-actions` con texto y los modales/enlaces | HECHO | `diagnostic-orders.spec.ts`: "Ver resultado" condicional, "Ver preparación" condicional y abre diálogo, "todas las acciones llevan texto" |
| C9.H3.M3 | Estados M34 (S2 loading/S3 empty/S9 error) | HECHO | S2=`loading()`, S3=`empty()` con próxima acción (specs "sin órdenes..." y "no lee nada..."), S9=`errorToViewState` (ya probado en el componente anterior, sin cambios en esa vía) |
| C9.H3.M4 | Accesibilidad | HECHO parcial | `node scripts/check-contrast.mjs` — 67 combinaciones, sin regresión nueva (las 3 excepciones R2/R3 son deuda de diseño preexistente, no de este cambio). La verificación manual con teclado/lector queda en "No cubierto" del `REPORTE.md`: exige el stack local corriendo |

**Desvíos de diseño descubiertos al implementar (regla 00 §1.4, sin poder tocar las piezas compartidas):**
- `app-tabs`/`app-tab` no tienen forma de recibir un `data-testid` en el botón visible de cada pestaña (lo dibuja `Tabs` internamente); el `data-testid="mis-ordenes-tab-*"` puesto en `<app-tab>` cae en el panel, no en el botón. E2E y specs ubican el botón por `role="tab"` + texto. Anotado, no se tocó el componente compartido.
- `app-row-actions`/`RowAction` no tiene campo de ruta: «Ver resultado» y «Reservar hora» navegan por `Router.navigate()` en vez de un `<a routerLink>` real (se pierde clic-medio / "abrir en pestaña nueva" que sí tenía la versión anterior). Riesgo residual, no se tocó el componente compartido.
- `scripts/pw-guard.mjs`, que el prompt pide para correr el E2E, **no existe en este repo** (confirmado con `find . -iname "pw-guard*"`). El spec de Playwright se escribió igual (`playwright/clinica-c9-mis-ordenes.spec.ts`); correrlo usa `npx playwright test` directo, sin el guard.
- `app-status-seal` es vocabulario de un trámite adjudicado (pending/in-review/approved/rejected/expired), no de una orden (`VS_RECORD_STATUS`). Sólo se tradujeron los dos casos donde el significado coincide (`PENDING`→pending, `COMPLETED`→approved); el resto usa el `unknown` neutro del propio componente, con el texto real igual visible.
- Se conserva la acción «Reservar hora en un laboratorio» (no mencionada por el prompt de C9, ver ambigüedad de arriba).

## H4 — Playwright y revisión visual
**Estado:** TODO — el spec está escrito (`playwright/clinica-c9-mis-ordenes.spec.ts`); correrlo y las capturas se difieren al pase final de Playwright de la noche (stack local completo, ver nota de Farmacia H8) — mismo motivo, un solo levantamiento del stack para toda la noche.

## H5 — Cierre
**Estado:** EN CURSO — PR a `mockup` con revisores `jsaldias39,PabloArauzCaballero`, `REPORTE.md` escrito, daily pendiente de actualizar (Pablo-Daily-Noche, sección Carril C).

## Riesgos
| Riesgo | Mitigación |
|---|---|
| Reescribir borra tests de una feature (agrupar por atención) que el propio prompt pide reemplazar | Se documenta como redisño deliberado (owner literal quote), no como debilitamiento de tests (regla 00 §4) |
| `ROW_ACTIONS_INLINE_MAX=2` con 4 acciones | Ya soportado por el componente (overflow a desplegable); no es un problema nuevo |
