# Reporte — Inventario y portal interno de AloVida como AtlasAdminPortal

> **AVANCE: 5 / 73 — 6,8 %.**

- Fecha: 2026-10-21 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `claude-marcelo/vigilant-bardeen-gcoocw` en `mantra-core-health` (plan y evidencia) y `mantra-core-health-api` (código); `mantra-core-health-model` sin cambios todavía
- Peldaño de evidencia alcanzado: **H0 y H1.S1.M1 → `TESTED`**. H1.S1.M1 es un refactor sin superficie visual: se demostró salida idéntica (`diff -r` sobre 67 archivos) y 7 pruebas de la librería nueva. El resto del trabajo sigue en `DISCOVERED`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.S1.M1 | Carpeta del trabajo commiteada en la rama remota | `git log --oneline -1 -- docs/trabajo/2026-10-21-portal-admin-alovida-como-atlas` | PASS — `evidencia/H0-git.txt` |
| H0.S1.M2 | Módulo piloto elegido y justificado con rutas (`scheduling`; control `audit`) | revisión de `HALLAZGOS.md` §0 | PASS |
| H0.S1.M3 | Las seis ambigüedades del plan confirmadas por Marcelo | mensaje del 2026-10-21 («confirmo los seis supuestos, arrancá H1 con scheduling») | PASS |
| H1.S1.M1 | `tools/inventario/lib/openapi.mjs` con la lectura pura del contrato; `generate-endpoint-markdown.mjs` la importa (−80/+16 líneas) y su salida no cambia | `diff -r` original vs refactor; `yarn inventario:test`; `prettier --check` | PASS — `evidencia/H1-S1-M1-equivalencia.txt`: sin diferencias en 67 archivos, 7/7 tests |
| H1.S1.M2 | Índice AST (`lib/ast.mjs`) y cruce contrato ↔ código (`lib/handlers.mjs`) con CLI `--solo-ast` | `node tools/inventario/endpoints.mjs --modulo scheduling,audit --solo-ast`; `yarn inventario:test`; equivalencia del generador | PASS — `evidencia/H1-S1-M2-handlers.txt`: 52/52 handlers de los pilotos con servicio resuelto; 1 190/1 190 en toda la API; 12/12 tests; salida del generador sin cambios |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S1.M2 – M4, H1.S2 (5), H1.S3 (4) | TODO | siguiente: H1.S1.M2 (índice AST por handler). Nada externo |
| H2 (10) | TODO | H1 cerrada; checkpoint con Marcelo tras el piloto `scheduling` (H2.S1.M4) |
| H3 (10) | TODO | H1.S2 cerrada para el cruce operación → tabla; `MODEL_ROOT` al repo del modelo (clonado como hermano) |
| H4 (7) | TODO | H1–H3 |
| H5 (26) | TODO | H5.S1–S2 pueden arrancar contra el inventario estático |
| H6 (4) | TODO | todo lo anterior |

## Evidencia
- `evidencia/H0-git.txt` — commit y push del plan.
- `evidencia/H1-S1-M1-equivalencia.txt` — comparación original vs refactor, tests y estilo, con salida literal.

Comandos de reproducción en `mantra-core-health-api` (requieren `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`, ver HZ-09):

```text
corepack yarn install --immutable        # 1154 paquetes, yarn.lock sin cambios
corepack yarn inventario:test            # 7 pass, 0 fail
corepack yarn docs:endpoints:generate    # 1190 endpoints, 65 módulos, 66 archivos Markdown
```

## No cubierto
- H1.S1.M1 prueba que la **salida de markdown** no cambió; no prueba que `endpoints.json` (que todavía no existe) sea correcto.
- No se corrieron `yarn lint`, `yarn typecheck` ni `yarn test` del API: los archivos tocados son `tools/**/*.mjs`, fuera de lo que cubren esos comandos (`{src,apps,libs,test}`); sólo se verificó Prettier. No se ejecutó `yarn docs:validate` ni `docs:build`.
- El resto del plan (H1.S1.M2 en adelante) no se ejecutó. Las hipótesis H-1 a H-4 siguen sin confirmar.

## Desvíos del plan
1. **Denominador corregido: 73, no 75.** El primer reporte dijo «0 / 75» y luego «2 / 75» con un total estimado a ojo. Contadas las filas del plan: H0 3 · H1 13 · H2 10 · H3 10 · H4 7 · H5 26 · H6 4 = **73**. El porcentaje de arriba usa el valor contado. La tabla «Pendiente» anterior decía H5 = 22; son 26.
2. **Alcance de H1.S1.M1 acotado.** El plan pedía mover a la librería también el payload mínimo y las filas de campos del DTO. Esas piezas dependen del índice AST (`runtimeConstraints`, `effectiveProperty`, `sourceClassProperties`), que es H1.S1.M2. Se movió la parte que es contrato puro y el resto pasó a la fila de H1.S1.M3 (editada en el plan) con su propio criterio de equivalencia.
3. **DoD de H1.S1.M1 corregido.** El plan decía `git diff --stat openapi/endpoints → 0 cambios`. Esa comparación no sirve: la documentación publicada ya difería del generador antes de tocar nada (HZ-08). La prueba válida es original vs refactor sobre el mismo árbol, que es la que se ejecutó.

## Riesgos residuales
- Los de la tabla final del plan. El mayor sigue siendo que la resolución estática «endpoint → tablas» cubra menos de lo esperado (H-2); se mide en H1.S2 sobre el piloto antes de prometer cobertura.
- HZ-08: la referencia de endpoints publicada está desactualizada en 11 de 66 archivos. Quien la lea hoy ve DTOs viejos.

## Decisiones y ambigüedades
- Decisiones D-01 a D-07 del plan, tomadas sin confirmación explícita: todas reversibles y declaradas.
- Ambigüedades 1–6: **confirmadas por Marcelo el 2026-10-21**.
- Nueva, sin confirmar: HZ-08 — si se regenera y commitea la referencia de endpoints vieja (Marcelo / dueños de módulo).
