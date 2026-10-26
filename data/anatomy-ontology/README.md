# data/anatomy-ontology

Fuente del catálogo del atlas anatómico 3D (`/glossary/anatomy-atlas`).

| Archivo | Qué es | De dónde sale |
|---|---|---|
| `provenance.json` | release, URL, SHA-256 y licencia de cada fuente | `tools/anatomy-atlas-3d/extract_ontology.py` |
| `uberon-human.json` | las 6 074 clases de UBERON 2026-10-01 con xref FMA (el criterio de «humana»), con definición, referencias, sinónimos exactos, `is_a`, relaciones de la lista publicada y región | idem |
| `bodyparts3d-parts.json` | las 934 mallas de BodyParts3D 3.0 y su cruce con UBERON (`fma_exact`, `fma_parent` = sólo el paso «Right X → X», o sin cruce) | idem |
| `netter-mapping/*.json` | cruce de las 3 161 entradas del índice de Netter con UBERON, por región | agentes por región con `tools/anatomy-atlas-3d/uberon_lookup.py`; sólo vale una coincidencia de `label` o sinónimo EXACTO, y el generador la vuelve a comprobar |
| `netter-mapping-report.json` | aceptadas, sin cruce (con motivo), rechazadas por el generador | `scripts/gen-anatomy-ontology-fixture.mjs` |
| `es/*.json` | nombre y definición en castellano | **traducción automática sin revisión humana** de lo que dice UBERON; la pantalla la rotula así y muestra el original |

Criterio de «humana»: una clase de UBERON es humana si declara un xref FMA, y
sólo entonces. Por eso quedan afuera clases que existen en el cuerpo humano pero
no declaran ese cruce (lo advirtieron los agentes por región: arteria
esfenopalatina, fosa pterigopalatina, hueso frontal, entre otras). Las entradas
de Netter que apuntan a ellas quedan sin cruce, cada una con su motivo en
`netter-mapping-report.json`; la taxonomía (`in_taxon` Homo sapiens) no entra en
el criterio.

Regla: nada que la fuente no diga se completa. No hay inervación, irrigación,
función ni relación que UBERON no declare; una definición de relleno de UBERON
(«Missing definition for term…») cuenta como ausente.

Regenerar:

```bash
python3 -I tools/anatomy-atlas-3d/extract_ontology.py --uberon uberon.obo --bp3d BodyParts3D_data --stl-list stl.txt
python -I tools/anatomy-atlas-3d/build_models.py --bp3d BodyParts3D_data   # venv con trimesh, numpy, fast-simplification
corepack yarn mock:anatomy-ontology
NODE_USE_ENV_PROXY=1 node scripts/validate-anatomy-atlas.mjs
```

Licencias: UBERON y FMA, CC-BY 3.0; BodyParts3D, CC-BY-SA 2.1 JP (las mallas
derivadas, en `public/anatomy-atlas-3d/models/`, heredan esa licencia).
