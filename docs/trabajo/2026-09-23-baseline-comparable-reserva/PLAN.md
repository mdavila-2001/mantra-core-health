# Plan — Baseline comparable de Directorio y Reserva

- Fecha: 2026-09-23 · Repo: `mantra-core-health` · Rama: `justin/baseline-historico-reserva-2026-09-23`.
- Cortes a comparar: antes `b7785e36` y después `a43ad2b3` (punta de `origin/mockup`, contiene el merge del PR #583).
  El plan decía `4c9e419f`; el corte que se levantó y se midió es su merge en `mockup`, y el `REPORTE.md` publica ese SHA.
- Estado al cerrar: **11 / 12 microtareas HECHO**. Resultados y límites en [REPORTE.md](./REPORTE.md).

## Resultado

**Actor:** paciente sintético `paciente@alovida.mock`.
**Dónde:** Directorio → especialidad → profesional → disponibilidad.
**Estado inicial:** había una muestra local del estado posterior, pero no baseline equivalente del corte anterior; por ello H1.S1 y H1.S2 del carril original no podían considerarse cerrados.
**Acción:** ejecutar gates en el corte anterior, medir el mismo recorrido en ambos cortes, contar las navegaciones y peticiones de las cuatro activaciones **antes** de iniciar la comprobación móvil y publicar la tabla comparativa.
**Observable:** una persona puede repetir los comandos y distinguir la muestra anterior de la posterior, incluido cualquier límite del mock backend en memoria.
**Fuera:** cambiar contratos de negocio, inventar tráfico HTTP no observable, cambiar latencias de Ender, o afirmar una mejora si las muestras no son comparables.
**Kill-test:** falta un SHA, el recorrido no es el mismo en los dos cortes, se mezclan datos de otra rama, se mezcla la navegación móvil posterior con las cuatro activaciones, o se declara el total como mejora sin evidencia.

## H1 — Baseline anterior reproducible

**CA:** Dado el corte `b7785e36`, cuando se ejecutan lint, typecheck, test y el recorrido de navegador, entonces queda una salida y clasificación verificables.
**DoD:** salidas con exit code y tabla de navegación en `evidencia/antes/`.
**Estado:** HECHO

| ID | Microtarea original | DoD | Estado |
|---|---|---|---|
| H1.S1.M1 | Baseline de lint | lint del spec nuevo, exit `0` | HECHO |
| H1.S1.M2 | Baseline de typecheck | `corepack yarn typecheck`, exit `0` | HECHO |
| H1.S1.M3 | Baseline de test | los 4 archivos rojos del reporte de gates, en `b7785e36`: 137/137 | HECHO |
| H1.S1.M4 | Clasificar los rojos previos | 3 de 4 se corrigieron en `mockup`; el cuarto es un timeout de 5 s por contención, aislado pasa 10/10 | HECHO |

## H2 — Comparación del recorrido

**CA:** Dado el mismo escenario en `b7785e36` y `4c9e419f`, cuando se llega a la disponibilidad, entonces se conocen la duración, navegaciones y solicitudes de negocio visibles de cada corte.
**DoD:** dos ejecuciones aisladas, tablas y capturas/salidas en `evidencia/antes/` y `evidencia/despues/`.
**Estado:** HECHO salvo la publicación

| ID | Microtarea original | DoD | Estado |
|---|---|---|---|
| H1.S2.M1 | Recorrer flujo normal | escenario A: 10 muestras por corte, hasta los cupos a la vista, con la profesional sintética | HECHO |
| H1.S2.M2 | Recorrer semana vacía | escenario B: 10 muestras por corte, camino por defecto que termina sin horarios; misma fixture, verificada por sedes/cupos/etiqueta/mensaje | HECHO |
| H1.S2.M3 | Cuatro clics seguidos | 1 navegación y 0 peticiones de negocio en los dos cortes, con aserción dura | HECHO |
| H1.S2.M4 | Capturas del flujo | 7 pares (14 capturas) 1440×900 y 390×844, sin médicos reales y con animaciones congeladas; dos pasadas de revisión | HECHO |
| H1.S2.M5 | Publicar a Ender | el daily vive en `AlovidaPromptManager`: va en su PR hacia `main` | A MEDIAS |

## H3 — Publicación y verificación

**CA:** Dado el cierre, cuando se abre el reporte, entonces conserva el conteo del carril y sólo adjudica las microtareas cuyo DoD se completó.
**DoD:** reporte con tres secciones, `git diff --check`, tests/gates y PR hacia `mockup`; el resumen de PromptManager se abre hacia `main` si corresponde.
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H3.S1.M1 | Publicar evidencia de producto | `REPORTE.md` y `evidencia/` | HECHO |
| H3.S1.M2 | Abrir PR de producto | PR hacia `mockup`, sin auto-merge | HECHO |
| H3.S1.M3 | Publicar resumen de PromptManager | PR hacia `main`, sin auto-merge | HECHO |

## Riesgos y límites

| Riesgo | Mitigación |
|---|---|
| Dependencias no instaladas en un worktree | Usar el estado de Yarn del worktree correspondiente; no alterar otros procesos |
| Mock en memoria no expone HTTP de negocio | Ocurrió: 0 peticiones de negocio en los dos cortes; lo observado son chunks del servidor de desarrollo |
| La fixture de semana vacía cambió entre cortes | Verificado: sedes, cupos y etiqueta del primer cupo son idénticos en los dos cortes (ver REPORTE) |
| Gates globales rojos ajenos | Clasificados: 3 de los 4 rojos del reporte de gates ya están corregidos en `mockup`; el cuarto es un timeout por contención |
| Publicar en la evidencia a médicos reales del catálogo de aseguradoras | El listado se filtra por una profesional sintética, con una aserción que exige que no quede nadie más en pantalla |
