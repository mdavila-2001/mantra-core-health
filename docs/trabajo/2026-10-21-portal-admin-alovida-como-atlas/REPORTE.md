# Reporte — Inventario y portal interno de AloVida como AtlasAdminPortal

> **AVANCE: 2 / 75 — 2,7 %.**

- Fecha: 2026-10-21 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `claude-marcelo/vigilant-bardeen-gcoocw` en `mantra-core-health` (el plan), `mantra-core-health-api` y `mantra-core-health-model` (sin cambios todavía)
- Peldaño de evidencia alcanzado: **`DISCOVERED`** — se localizaron las piezas reales (rutas citadas en el plan §«Hallazgos»); no se escribió código, no se generó ningún inventario.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.S1.M1 | Carpeta del trabajo (`PLAN.md`, `HALLAZGOS.md`, `REPORTE.md`, `evidencia/`) commiteada y en la rama remota | `git log --oneline -1 -- docs/trabajo/2026-10-21-portal-admin-alovida-como-atlas` | PASS — `bc60ea30`; `evidencia/H0-git.txt` |
| H0.S1.M2 | Módulo piloto elegido y justificado con rutas (`scheduling` principal, `audit` de control) | revisión de `HALLAZGOS.md` §0 | PASS |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H0.S1.M3 | TODO | respuesta de Marcelo a las ambigüedades 1–6 del plan |
| H1 (13 microtareas) | TODO | nada: arranca con el visto bueno del plan |
| H2 (10) | TODO | H1 cerrada; checkpoint tras el piloto `scheduling` |
| H3 (10) | TODO | H1 cerrada; `MODEL_ROOT` al repo del modelo (está clonado como hermano) |
| H4 (7) | TODO | ambigüedades 5–6 + H1–H3 |
| H5 (22) | TODO | ambigüedades 5–6; H5.S1–S2 pueden arrancar contra el inventario estático |
| H6 (4) | TODO | todo lo anterior |

## Evidencia
- `evidencia/H0-git.txt` — commit y push del plan.

```text
# Conteos leídos durante el descubrimiento (reproducibles)
python3 -c "import json;d=json.load(open('mantra-core-health-api/openapi/openapi.json'));..."
→ paths 1105 ops 1190 schemas 1078 tags 211
wc -l mantra-core-health-model/docs/data-catalog/{tables,columns,relations,indexes}.csv
→ 1231 / 16852 / 7070 / 7837 líneas (con cabecera)
grep -rn "admin/catalog" mantra-core-health-api/src/modules → (vacío)
```

## No cubierto
Todo lo de H1 en adelante: no se ejecutó ningún generador ni pantalla. Las hipótesis H-1 a H-4 del plan están sin confirmar.

## Desvíos del plan
Ninguno.

## Riesgos residuales
Los de la tabla final del plan. El mayor: que la resolución estática «endpoint → tablas» cubra menos de lo esperado (H-2); se mide en el piloto antes de prometer nada.

## Decisiones y ambigüedades
- Decisiones D-01 a D-07 en el plan, tomadas sin confirmación: todas reversibles y declaradas.
- Ambigüedades 1–6 en el plan, con supuesto tomado y a quién confirmar (Marcelo). Ninguna se presenta como hecho.
