# Reporte — Conflictos de PR en model (#65 y #63)

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `claude/p49-contabilidad-simple`, `claude/compassionate-shannon-rw6526` (checkout principal del model, sin worktrees; ya borradas en local)
- Peldaño de evidencia alcanzado: `RUNS` (generadores del repo ejecutados con exit 0 y comparados; sin base de datos levantada). Sin `VERIFIED`.
- Avance: 5 HECHO / 5 microtareas = 100 %

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | #65 `SQL/_generation_report.md`: filas 16 (PR), 18 y 19 (dev), 33 = 43, stubs en unión, Σ recalculada | fórmula de Σ validada contra el reporte base (1235/298/313); `gen_ddl.py all` contrastado | Σ = 1251 / 392 / 334 (la 334 = 313+6+16−1, la fila 17 subió +1 en ambos lados) |
| H1.S1.M2 | #65 `model-manifest.yaml` y `diagram_33_integrity.puml` | `model_inventory.py`; `gen_integrity.py` | `.puml`: unión, 43 entidades, 43 llaves balanceadas, 0 duplicadas. Matriz regenerada: `43 entidades`, diff real (sin CRLF) vacío. Manifest 2910/1347/81/1322/160/7207 = inventario |
| H1.S2.M1 | #63 `seedsGenerales/checksums.json` y `seed-manifest.json` | sha256 de los blobs del índice; método validado contra dev y contra la rama del PR | 65 entradas, 0 diferencias en la validación; sobre el merge: 0 sha incorrectos en checksums y en seed-manifest (64 módulos); `line_count` con el mismo criterio que dev |
| H1.S2.M2 | #63 `model-manifest.yaml` (+ nota) y `physical-materialization.md` | `model_inventory.py` | 2909/1347→1345/81/1320/163/7212 (suma de clases 2909 OK); doc con las dos secciones |
| H1.S3.M1 | Push y estado | `gh pr view` / `gh pr checks` | #65: `{"baseRefName":"dev","isDraft":false,"mergeStateStatus":"CLEAN","mergeable":"MERGEABLE","number":65,"reviewDecision":"","state":"OPEN"}` · #63: ídem con `number":63` · ambos `no checks reported`. Push `18eecf2..c544fe1` y `8bf25b6..971cd21` |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Re-conflicto entre #65 y #63 | previsto | Ambos modifican los conteos de `model-manifest.yaml`: el segundo que se mergee volverá a chocar. Recalcular con `model_inventory.py` tras el primero |
| Número de versión `v4.2.49` | ambigüedad | Ver abajo |

## Evidencia
- Barrido final de PRs abiertos no `MERGEABLE` en los seis repos: lista vacía en todos.
- #65, `git merge-tree` previo: conflictos en `model-manifest.yaml`, `diagram_33_integrity.puml`, `_generation_report.md`. #63: `physical-materialization.md`, `model-manifest.yaml`, `checksums.json`, `seed-manifest.json`.

## No cubierto
- Sin PostgreSQL: no se aplicó el DDL ni el parche; solo regeneración y comparación de archivos.
- `gen_ddl.py all` no es reproducible bit a bit en esta máquina: con la copia local de las notas FK de la bóveda, regenera `26_insurance`, `69_pharma_lab` y `08_clinical` sin la anotación «(inferida por convención)» (ruido de entorno que no viene de los PRs). Se descartó todo lo regenerado; solo se usó para contrastar.
- #63: el `_generation_report.md` que quedó (fusionado por git, sin conflicto) no refleja el CHECK nuevo de `received_services`: fila 33 dice 40 y el `.puml` tiene 41; Σ tablas 1248 vs 1249. Es una inconsistencia de la rama del PR, no del merge; no se tocó por estar fuera de los conflictos y depender de la bóveda.
- `model-manifest.yaml` no se parseó como YAML (no hay PyYAML instalado); solo edición de texto dentro de escalares plegados.
- Sin checks de CI remoto.

## Desvíos del plan
- Se leyó la nota del manifest en #65 y #63 aunque en #63 no estaba en conflicto: quedaba con las cifras viejas de dev tras el merge, se actualizó.
- Se creó una copia de las notas FK de la bóveda en `scratchpad/ws/Mantra Core Health Vault/SALUD/FK` (6801 archivos) solo para poder correr `gen_ddl.py`. Sigue ahí; es una copia, sin enlaces.

## Riesgos residuales
- **Colisión de versión:** la doc de #63 afirma «El número `v4249` no tiene colisión en los remotos», pero `dev` ya usa `v4.2.49` para la tanda de los issues #54–#60 (`model-manifest.yaml`, `physical-materialization.md`). Ahora conviven dos «v4.2.49» en el mismo archivo. Confirmar con el autor del PR si se renumera.
- El supuesto de `SEED_REVISION`: el PR sube a `2.7.0-v4.2.49` en todos los seeds, por eso todos los sha cambian respecto a dev.

## Decisiones y ambigüedades
- Merge de `dev` en la rama del PR (no rebase), sin force.
- `.puml` = fuente → unión de ambos lados; derivados (manifest, checksums, Σ) → recalculados, no elegidos de un lado.
