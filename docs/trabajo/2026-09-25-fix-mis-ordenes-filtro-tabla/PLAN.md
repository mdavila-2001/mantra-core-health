# Plan — Fix: «Mis órdenes» no filtraba la tabla

- Fecha: 2026-09-25 · Repo: `mantra-core-health` · Rama: `pablo/fix-mis-ordenes-filtro-tabla`
- Corte: `origin/mockup` @ `28dbff4b976f95ace77acca3c4bc5d21cb211af2`
- Origen: hallazgo del pase consolidado de Playwright de C7 (2026-09-25), corriendo
  `clinica-c9-mis-ordenes.spec.ts` de verdad contra `ng serve` — nadie lo había ejecutado desde que
  C9 (PR #677) se mergeó a `mockup`.
- Resultado observable: en «Mis órdenes», escribir en el buscador o elegir un filtro reduce las
  filas que la tabla pinta, no sólo el número del resumen.
- Kill-test: en `/my-account/diagnostic-orders`, buscar «hemo» dice «1 orden» **y** la tabla muestra
  exactamente esa fila (hoy muestra las cuatro).

## Alcance
- IN: `src/app/features/account/diagnostic-orders/{diagnostic-orders.ts,diagnostic-orders.html}`,
  `playwright/clinica-c9-mis-ordenes.spec.ts`.
- OUT: cualquier otro archivo de C9 o de otro carril.

## H1 — El fix
**CA:** Dado un filtro o búsqueda activos, cuando la pantalla re-renderiza, entonces la tabla
muestra sólo las filas que pasan el filtro, no todas.
**DoD:** `ng test --include=.../diagnostic-orders/*.spec.ts` verde + Playwright real en verde.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | `filasDeTabla()`: sustituye el `data` de `estado()` por `filasPaginadas()` en la rama `ready`, deja pasar el resto | El binding de `<app-data-table>` usa `filasDeTabla()`, no `estado()` | `grep -n '\[state\]="estado()"' diagnostic-orders.html` = 0 | HECHO |
| H1.M2 | Arreglar la carrera del propio spec de Playwright (contaba filas antes de que el debounce del buscador terminara) | El spec espera el resumen `aria-live` antes de contar filas | `npx playwright test playwright/clinica-c9-mis-ordenes.spec.ts` PASS | HECHO |

## Causa raíz

`<app-data-table [state]="estado()">` ataba la tabla directo al `ViewState` crudo de la lectura
inicial (`ready(items.map(...))`, seteado una sola vez en `resolverEtiquetasYArmar()`), mientras que
`filasFiltradas()`/`filasPaginadas()` — que sí reaccionan a pestaña, búsqueda, filtros y página —
sólo se usaban para el resumen de texto (`{{ totalFiltrado() }} órdenes`) y para `app-pagination`.
Buscar o filtrar cambiaba el número, nunca las filas debajo. Ningún unitario lo agarró porque
ninguno afirma sobre lo que la tabla realmente recibe como `[state]`, sólo sobre los `computed` por
separado.

## Riesgos residuales

Ninguno pendiente: se agregó `diagnostic-orders.spec.ts` "lo que la tabla pinta refleja el
buscador, no sólo el resumen" (17/17 tests OK), que falla si alguien vuelve a atar `[state]` a
`estado()` sin pasar por `filasDeTabla()`.
