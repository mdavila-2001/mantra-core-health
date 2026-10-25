# Validador del atlas anatómico 3D — 2026-10-25T02:06:44.681Z

Resultado: **FALLIDO** (27 irresolubles bloqueantes; 27 en total). Grupos de esta parte: doi, pmid.

| Grupo | Bloquea | Validadas | Resueltas | Irresolubles |
|---|---|---|---|---|
| doi | sí | 2731 | 2723 | 8 |
| pmid | sí | 3120 | 3120 | 0 |
| pmidDoi | sí | 2697 | 2678 | 19 |

## Conteos en el catálogo

- doi: 2731
- pmid: 3120
- wikipedia: 2032
- isbn: 30
- url: 489
- uberon: 6085
- fma: 6384
- images: 1066
- ta2: 2357
- literatureStructures: 884
- literatureSentences: 4220
- literaturePmidDoiPairs: 2697

## Motivos de fallo (agrupados)

- 18 × pmidDoi: PubMed asocia ningún DOI
- 6 × doi: crossref HTTP 404, doi.org HTTP 404
- 2 × doi: crossref HTTP 429, doi.org HTTP 404
- 1 × pmidDoi: PubMed asocia 10.1002/(SICI)1097-0193(1998)6:4&#x0003c;316::AID-HBM9&#x0003e;3.0.CO;2-6

## Comprobaciones sin red (no reemplazan la resolución en línea)

- ✔ cada id UBERON del catálogo está en el extracto de la release — 6085/6085

Detalle por cita: `validator-2026-10-25T02-06-44-doi+pmid.json`.
