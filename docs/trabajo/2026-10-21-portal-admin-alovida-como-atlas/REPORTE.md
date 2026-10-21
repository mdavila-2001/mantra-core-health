# Reporte — Inventario y portal interno de AloVida como AtlasAdminPortal

> **AVANCE: 22 / 73 — 30,1 %.**

- Fecha: 2026-10-21 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `claude-marcelo/vigilant-bardeen-gcoocw` en `mantra-core-health` (plan y evidencia) y `mantra-core-health-api` (código); `mantra-core-health-model` sin cambios todavía
- Peldaño de evidencia alcanzado: **H0, H1 y H2 (lo hecho) → `TESTED`**. Ninguna parte tiene superficie visual del portal todavía: los diagramas Mermaid se parsearon en un navegador y se miró uno por tipo (árbol y máquina de estados), no se hizo prueba visual del portal (eso es H5). H3 en adelante sigue en `UNKNOWN`/`DISCOVERED`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.S1.M1 | Carpeta del trabajo commiteada en la rama remota | `git log --oneline -1 -- docs/trabajo/2026-10-21-portal-admin-alovida-como-atlas` | PASS — `evidencia/H0-git.txt` |
| H0.S1.M2 | Módulo piloto elegido y justificado con rutas (`scheduling`; control `audit`) | revisión de `HALLAZGOS.md` §0 | PASS |
| H0.S1.M3 | Las seis ambigüedades del plan confirmadas por Marcelo | mensaje del 2026-10-21 («confirmo los seis supuestos, arrancá H1 con scheduling») | PASS |
| H1.S1.M1 | `tools/inventario/lib/openapi.mjs` con la lectura pura del contrato; `generate-endpoint-markdown.mjs` la importa (−80/+16 líneas) y su salida no cambia | `diff -r` original vs refactor; `yarn inventario:test`; `prettier --check` | PASS — `evidencia/H1-S1-M1-equivalencia.txt`: sin diferencias en 67 archivos, 7/7 tests |
| H1.S1.M2 | Índice AST (`lib/ast.mjs`) y cruce contrato ↔ código (`lib/handlers.mjs`) con CLI `--solo-ast` | `node tools/inventario/endpoints.mjs --modulo scheduling,audit --solo-ast`; `yarn inventario:test`; equivalencia del generador | PASS — `evidencia/H1-S1-M2-handlers.txt`: 52/52 handlers de los pilotos con servicio resuelto; 1 190/1 190 en toda la API; 12/12 tests; salida del generador sin cambios |
| H1.S1.M3 | Lector de DTO (`lib/dto.mjs`), payload mínimo y campos estructurados con decorador literal y `fuente` | `yarn inventario:test`; equivalencia del generador; medición sobre 863 operaciones con cuerpo | PASS — `evidencia/H1-S1-M3-M4-dto-y-requerimientos.txt`: 5 678 campos, 1,6 % sin fuente, generador byte-idéntico |
| H1.S1.M4 | Requerimientos por operación con límites leídos del código (`lib/requerimientos.mjs`) | medición sobre 1 190 operaciones | PASS — 0 listas vacías; 27/27 tests |
| H1.S2.M1-M3 | Tablas afectadas por operación (`lib/datos.mjs`): 1 240 entidades, 1 164 de 1 190 operaciones con ≥ 1 tabla (97,8 %), confianza por efecto, camino más corto | `yarn inventario:test`; `evidencia/H1-S2-tablas-eventos.txt` | PASS — 42/42; 5 032 DIRECTA · 713 POR_TIPO · 196 POR_SQL · 56 POR_REGISTRO; generador de endpoints byte-idéntico |
| H1.S2.M4 | Eventos y trabajos por operación | `grep` vs análisis | PASS — 87 sitios en el código, 87 detectados, 0 sin detectar |
| H1.S2.M5 | Cotejo manual de 10 operaciones contra el código | lectura de archivo:línea | PASS — `evidencia/H1-S2-M5-cotejo-manual.md`: 10/10, con 2 defectos del análisis hallados y corregidos |
| H1.S3.M1-M4 | Inventario de endpoints completo: 1 223 operaciones (1 190 del contrato + 33 sólo en el código), con explicación de negocio y de sistema, tablas, DTO y restricciones, requerimientos, payload mínimo, riesgo y pruebas; JSON por módulo y markdown por módulo | `yarn inventario:test` (59 pruebas); `yarn inventario:verificar`; `mkdocs build --strict`; `docs:links` | PASS — `evidencia/H1-S3-inventario-endpoints.txt` |
| H2.S1.M1 | Procesos desde el README de cada módulo y desde `critical-workflows.md` (`lib/flujos.mjs`); «Ciclo de vida de una cita» con hold → confirm → check-in y cinco alternativas | `node tools/inventario/flujos.mjs --modulo scheduling --json`; `flujos.test.mjs` | PASS — `evidencia/H2-piloto-scheduling.json`; las 8 referencias del documento resueltas, 0 sin resolver |
| H2.S1.M2 | Árbol de decisión por operación desde el AST (`lib/arbol.mjs`, `lib/excepciones.mjs`): accesos, ramas, errores con estado y código, efectos por tabla, eventos | `node --test` (`arbol.test.mjs`, `excepciones.test.mjs`); cotejo manual de `holds` | PASS — `evidencia/H2-S1-M2-cotejo-holds.md` (12/12 filas); 1 223/1 223 árboles, 0 truncados; la mutación del estado 422→412 rompe 2 pruebas |
| H2.S2.M1 | Todos los módulos: 67 procesos; 570 operaciones (46,6 %) en un UC del README y 653 agrupadas por controlador | `node tools/inventario/flujos.mjs` | PASS — `evidencia/H2-flujos.txt` |
| H2.S2.M2 | `flujos[]` y `respuestasPosibles` escritos en los registros de endpoints, con ida y vuelta | `flujos.test.mjs` «ida y vuelta» | PASS — 1 223/1 223 operaciones con flujo; la mutación que quita las alternativas del documento rompe 2 pruebas |
| H2.S2.M3 | Mapa de operaciones y 10 hallazgos con severidad y qué hacer (`lib/mapa.mjs`, cruce con los clientes del frontend) | `node tools/inventario/flujos.mjs`; cotejo de FLU-02, FLU-06 y GET que escribe contra el código | PASS — `docs/inventario/flujos/{mapa,hallazgos}.md`, HZ-22 a HZ-28 |
| H2.S3.M3 | Un grafo JSON por proceso con su esquema (`schema/grafo.schema.json`) | `grafos.test.mjs` (ajv) | PASS — 67 grafos válidos, 0 aristas huérfanas, el esquema rechaza un tipo inventado |

## A medias
### H2.S1.M3 — Máquinas de estado
- **Qué anda:** 10 máquinas leídas de las tablas `*_TRANSITIONS` del código, con estados, aristas, iniciales, terminales y, en cada arista, las operaciones cuyo método nombra el estado de destino (POR_REFERENCIA). Dibujo de la cita mirado: `evidencia/H2-S1-M3-maquina-cita.png`, coincide con el encabezado de `booking-state-machine.ts`.
- **Qué no anda:** el DoD pide que el diagrama renderice en `docs:build`, y ese comando aborta en este entorno (ver abajo).
- **Qué falta exactamente:** correr `yarn docs:build` con la configuración real en un entorno con acceso a `unpkg.com`.
- **Dónde quedó:** `mantra-core-health-api`, commit 2195664e; compila, 29/29 pruebas de lo tocado.

### H2.S3.M1 — Mermaid por proceso y por módulo
- **Qué anda:** 67 procesos con diagrama (el mayor, 8 393 caracteres); 1 205 diagramas parsean en Chromium con mermaid 11.4.1; `mkdocs build --strict` con una configuración temporal que sirve mermaid local termina con exit 0 (`evidencia/H2-S3-mermaid-y-docs.txt`).
- **Qué no anda:** `python3 -m mkdocs build --strict` con la configuración del repositorio aborta por `MERMAID2 - Cannot check URL` (unpkg responde 403 desde este entorno). Clasificado ENVIRONMENT: el mismo aviso sale excluyendo las páginas nuevas.
- **Qué falta exactamente:** correr `yarn docs:build` donde unpkg sea alcanzable.
- **Dónde quedó:** `mantra-core-health-api`, commits 43d4e2e6 y 3bfce4dc; compila.

### H2.S3.M2 — Mermaid por operación
- **Qué anda:** 1 223 árboles; 1 106 se dibujan como `flowchart TD` (tope de 70 nodos por diagrama, con un nodo que lo dice si se corta) y 117 sin decisiones propias van en tabla; todos parsean; `holds` cotejado y mirado.
- **Qué no anda:** el mismo `docs:build` real del DoD.
- **Qué falta exactamente:** lo mismo que H2.S3.M1.
- **Dónde quedó:** igual que H2.S3.M1.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H2.S1.M4 | DESCARTADO | Lo decidió Marcelo el 2026-10-21 («seguí con todo el plan completo sin parar»). La revisión del piloto `scheduling` pasa a la revisión final: ver «Decisiones» |
| H3 (10) | TODO | `MODEL_ROOT` al repo del modelo (ya es hermano); nada externo |
| H4 (7) | TODO | H1–H3 |
| H5 (26) | TODO | H5.S1–S2 pueden arrancar contra el inventario estático |
| H6 (4) | TODO | todo lo anterior |

## Evidencia
- `evidencia/H0-git.txt` — commit y push del plan.
- `evidencia/H1-*.txt|md` — equivalencia del generador, handlers, DTO y requerimientos, tablas y eventos, cotejo manual de 10 operaciones, inventario de endpoints.
- `evidencia/H2-flujos.txt` — salida literal de `flujos.mjs`, `--verificar`, `inventario:test` (89/89), cobertura, máquinas y hallazgos.
- `evidencia/H2-S3-mermaid-y-docs.txt` — 1 205 diagramas parseados, control negativo, y el bloqueo de red del `docs:build`.
- `evidencia/H2-S1-M2-cotejo-holds.md` y `H2-S1-M2-holds-arbol.png` — cotejo línea por línea y dibujo del árbol.
- `evidencia/H2-S1-M3-maquina-cita.png` — máquina de estados de la cita con la operación de cada arista.
- `evidencia/H2-piloto-scheduling.json` — procesos y máquinas del piloto.

Comandos de reproducción en `mantra-core-health-api` (requieren `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`, ver HZ-09; el cruce con el frontend necesita `../mantra-core-health` o `FRONT_ROOT`):

```text
corepack yarn inventario:test       # 89 pass, 0 fail
node tools/inventario/endpoints.mjs # regenera inventario/endpoints y docs/inventario/endpoints
node tools/inventario/flujos.mjs    # regenera flujos, árboles, grafos, mapa y hallazgos
corepack yarn inventario:verificar  # exit 0: lo escrito coincide con el código
```

## No cubierto
- **`docs:build` con la configuración real del repositorio:** BLOQUEADO por la red de este entorno (A MEDIAS en H2.S1.M3, S3.M1, S3.M2). Verificado con mermaid local.
- **Que los árboles sean exhaustivos o que cada rama sea alcanzable:** el análisis es estático; sólo ve lo que alcanza (README del inventario, «Lo que los flujos NO afirman»). Un `throw` detrás de una llamada cuyo destino depende de un dato en ejecución no aparece.
- **El bloqueo pesimista `FOR UPDATE` no se modela** en el árbol; sólo se ve por el nombre de la llamada.
- **Los hallazgos del mapa** se cotejaron a mano sólo en parte: FLU-02 (2 casos), FLU-06 (3 rutas), `GET` que escribe (2 casos) y el estado `NO_SHOW`. FLU-03, FLU-04, FLU-05, FLU-07 a FLU-10 son lo que calcula el análisis y no se verificó fila por fila.
- **«Quién la llama»** se lee de `docs/reports/generated/api-inventory.md` del frontend, que es un archivo generado: si está desactualizado, el cruce también.
- **Ninguna prueba visual del portal** (no existe todavía). No se corrieron `yarn lint`, `yarn typecheck` ni `yarn test` del API: los archivos tocados son `tools/**/*.mjs`, fuera de lo que cubren esos comandos; se verificó Prettier y una comprobación estática de funciones no declaradas.
- `ajv` se usa en una prueba como dependencia transitiva (llega por eslint): no está en `package.json`. Si cambia el árbol de dependencias, la prueba de esquema fallará, no pasará en silencio.
- H3 en adelante no se ejecutó. Las hipótesis H-1 a H-4 siguen sin confirmar.

## Desvíos del plan
1. **Denominador corregido: 73, no 75.** El primer reporte dijo «0 / 75» y luego «2 / 75» con un total estimado a ojo. Contadas las filas del plan: H0 3 · H1 13 · H2 10 · H3 10 · H4 7 · H5 26 · H6 4 = **73**. El porcentaje de arriba usa el valor contado. La tabla «Pendiente» anterior decía H5 = 22; son 26.
2. **Alcance de H1.S1.M1 acotado.** El plan pedía mover a la librería también el payload mínimo y las filas de campos del DTO. Esas piezas dependen del índice AST (`runtimeConstraints`, `effectiveProperty`, `sourceClassProperties`), que es H1.S1.M2. Se movió la parte que es contrato puro y el resto pasó a la fila de H1.S1.M3 (editada en el plan) con su propio criterio de equivalencia.
3. **DoD de H1.S1.M1 corregido.** El plan decía `git diff --stat openapi/endpoints → 0 cambios`. Esa comparación no sirve: la documentación publicada ya difería del generador antes de tocar nada (HZ-08). La prueba válida es original vs refactor sobre el mismo árbol, que es la que se ejecutó.
4. **Salida de flujos repartida en varios archivos (D-10).** El CA decía `inventario/flujos.json`; son `inventario/flujos/*.json`, `inventario/arboles/*.json` e `inventario/grafos/*.json`, para no tener un monolito de ~14 MB.
5. **Proceso = módulo, etapa = caso de uso (D-11).** El plan decía «uno por caso de uso agrupado»; se hizo un proceso por módulo con una etapa por UC, más los dos críticos, porque el README no agrupa los UC en procesos de negocio y inventarlo estaba fuera de lo declarable.
6. **Checkpoint H2.S1.M4 no ocurrió.** Marcelo pidió seguir «sin parar»; la revisión del piloto pasa a la revisión final. El plan se avanzó sobre una definición de flujo que él no vio.
7. **Tres microtareas de H2 pasaron a A MEDIAS** por el `docs:build` bloqueado, aunque lo que se podía demostrar con mermaid local está demostrado. La regla 80.4 prohíbe presentar ENVIRONMENT como PASS.
8. **`respuestasPosibles` se agregó al registro de endpoints** (no estaba en el CA): lo necesita la pestaña de respuestas de la ficha (H5).

## Riesgos residuales
- Los de la tabla final del plan. H-2 (cobertura estática endpoint → tablas) quedó medida en H1: 97,8 % de las operaciones del contrato con al menos una tabla, 26 explicadas.
- HZ-08: la referencia de endpoints publicada está desactualizada en 11 de 66 archivos. Quien la lea hoy ve DTOs viejos.
- Un cambio en el README de un módulo o en `critical-workflows.md` cambia los procesos: `inventario:verificar` lo detecta, pero hay que regenerar.
- Los 7 hallazgos nuevos (HZ-22 a HZ-28) incluyen riesgo real: 45 pantallas del frontend contra rutas que no existen, `GET` que mutan y 84 operaciones de riesgo alto sin prueba de integración.

## Decisiones y ambigüedades
- Decisiones D-01 a D-11 del plan, tomadas sin confirmación explícita: todas reversibles y declaradas.
- Ambigüedades 1–6: **confirmadas por Marcelo el 2026-10-21**.
- **Para que Marcelo revise al final** (lo que habría visto en el checkpoint de H2): `docs/inventario/flujos/scheduling.md` (proceso, máquina y árboles), `docs/inventario/flujos/mapa.md` y `hallazgos.md`, y la definición D-11 (proceso por módulo).
- Sin confirmar: HZ-08 — si se regenera y commitea la referencia de endpoints vieja (Marcelo / dueños de módulo).
