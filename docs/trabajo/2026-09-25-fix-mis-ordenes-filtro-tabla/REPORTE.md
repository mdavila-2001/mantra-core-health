# Reporte — Fix: «Mis órdenes» no filtraba la tabla

> **AVANCE: 2 / 2 — 100 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `pablo/fix-mis-ordenes-filtro-tabla`
- Peldaño de evidencia alcanzado: `VERIFIED_FUNCTIONAL_ONLY` — Playwright real corrido dos veces
  (antes y después del fix, contra `ng serve` limpio), más el unitario de regresión nuevo. No hay
  captura de pantalla adicional a la ya tomada como evidencia del bug (no es un cambio visual, es de
  comportamiento).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | `filasDeTabla()` sustituye el `data` de `estado()` por `filasPaginadas()` en `ready`; `<app-data-table>` ya no lee `estado()` directo | `grep -n '\[state\]="estado()"' src/app/features/account/diagnostic-orders/diagnostic-orders.html` | 0 líneas |
| H1.M1 | Regresión unitaria y typecheck | `ng test --include=.../diagnostic-orders/*.spec.ts`, `tsc --noEmit` | 17/17 tests OK, exit 0 |
| H1.M2 | `clinica-c9-mis-ordenes.spec.ts` corregido (esperaba el resumen `aria-live`, no la fila 0) | `E2E_BASE_URL=http://localhost:4219 npx playwright test playwright/clinica-c9-mis-ordenes.spec.ts` | PASS (antes: FAIL con el bug reproducido, ver evidencia) |

## Evidencia

```text
Antes del fix (bug reproducido):
  Locator: [data-testid="mis-ordenes-tabla"] tbody tr, fila 1
  Expected pattern: /hemo/i
  Received: "18/08/2026 Perfil lipídico Laboratorio Completado Disponible ..."
  → 33 filas en la tabla pese a buscar «hemo»; el resumen sí decía «1 orden».

Después del fix:
  1 passed (8.0s)
```

La captura de pantalla del bug (resumen «1 orden» con la tabla mostrando las 4 filas igual) quedó en
`artifacts/playwright/salida/` de la corrida donde se reprodujo (efímera, no versionada). El hallazgo
en sí está narrado con más detalle en el `PLAN.md`/`REPORTE.md` de C7
(`wt-clinica-c7/docs/trabajo/2026-09-25-encuentro-clinico/c7/`), que es donde se detectó al correr
`clinica-c9-mis-ordenes.spec.ts` durante su pase consolidado de Playwright.

## No cubierto

- No se revisaron los otros filtros (`Estado`, `Resultado`, `Período`) uno por uno contra la tabla
  real en navegador — comparten el mismo `filasDeTabla()`, así que el mismo mecanismo los cubre a
  todos, pero sólo `q` (buscador) se ejercitó de punta a punta con Playwright.
- No se investigó por qué ningún unitario existente había detectado esto antes (todos afirmaban
  sobre `filasFiltradas()` en aislamiento, nunca sobre lo que el template realmente pasa a
  `[state]`) más allá de agregar el test puntual que lo cierra.

## Decisiones y ambigüedades

Ninguna.
