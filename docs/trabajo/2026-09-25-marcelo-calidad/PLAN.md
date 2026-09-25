# Plan — Calidad de la carga masiva: E2E, doble revisión, gates y XLSX (Carril Marcelo B)

- Fecha: 2026-09-25 · Repos afectados: `alovida/mantra-core-health` (front: H1-H6) · `alovida/mantra-core-health-api` (H7: worktree propio) · Predecesor: Carril A (Farmacia) cerrado 24/30
- Resultado observable: `carga-masiva.spec.ts` corre contra el contrato §3 (primero contra la pantalla de hoy, después contra la rama de Justin con backend simulado); 24 capturas con doble revisión; gate de seguridad/PHI escrito; `xlsx-parser.ts` produce el mismo resultado que el `CsvParser` de Itzan.
- Kill-test: ver §del original — `Q-9` publicada con tres rutas antes de la hora 1; specs verdes contra baseline y contra la rama de Justin; `evidencia/doble-revision.md` con 24 filas.
- **Ficha completa (98 microtareas, CA/DoD/columna "Si se traba" por cada una): [`FICHA-ORIGINAL.md`](./FICHA-ORIGINAL.md)** — este `PLAN.md` no la duplica; referencia sus IDs y registra el estado real de cada una en la tabla de la sección 3.

## Alcance
- IN: corte+baseline · Q-9 · dependencia XLSX con audit · fixtures de la API por script · `xlsx-parser.ts` + spec cruzado · fixtures de E2E · spec baseline (hoy) · spec del contrato (§3) · corrida contra la rama de Justin · capturas + doble revisión · gate de seguridad/PHI · matriz negativa · regresión · PR.
- OUT: archivos de Justin/Itzan (`features/admin/terminology/version-import/**`, `terminology.client.ts`, `terminology.handlers.ts`, `src/modules/terminology/import/index.ts`, servicio/controlador/DTO de import) · automatizar el drag & drop real · mockear la API dentro del spec · subir timeouts.
- Ambigüedades registradas: Q-9 (la resuelvo yo, H1.S2), Q-M1 (drag&drop manual, ya decidido por la ficha), Q-M2 (axe sólo si ya está en package.json), Q-M3 (si Justin no publica, H3/H4.S2 quedan A MEDIAS con baseline — **Justin SÍ publicó**: `justin/carga-masiva-pantalla-2026-09-25` existe en origin, verificado con `git ls-remote`), Q-M4 (cuenta PRACTITIONER demo si existe).
- **Restricción de esta sesión, no de la ficha:** `git push`/`gh pr create` están bloqueados por el clasificador de auto-modo del harness ("Out-of-Place Publication"). Todo lo que la ficha pide "pushear en la hora N" queda commiteado local y declarado `A MEDIAS` por esta causa — no por decisión de scope ni por bloqueo real del carril.

## Orden de ejecución (el que fija la propia ficha, §2)
H1 (Q-9 primero) → H7.S1 (dependencia XLSX, 45 min) → H7.S2 (fixtures) → H2 → H7.S3 (parseador XLSX) → H3 (Justin ya publicó) → H4 → H5 → H6.

## Estado por hito

| Hito | Microtareas | HECHO | A MEDIAS | BLOQUEADO | TODO | Nota |
|---|---|---|---|---|---|---|
| H1 | 15 | | | | | |
| H2 | 19 | | | | | |
| H3 | 6 | | | | | |
| H4 | 10 | | | | | |
| H5 | 12 | | | | | |
| H6 | 14 | | | | | |
| H7 | 22 | | | | | |
| **Total** | **98** | | | | | |

(Se completa al cerrar cada hito, sumando desde la tabla de la sección 3.)

## 3. Ledger de microtareas — estado real (fuente de verdad de esta sesión)

Formato: `ID | Estado | Evidencia/nota`. Sólo se listan acá las que cambian de `TODO` (implícito para
las no listadas, que siguen exactamente como en `FICHA-ORIGINAL.md`).
