# Plan — Resolver los PRs en conflicto del frontend (#1903 y #1902)

- Fecha: 2026-11-03 · Repos afectados: mantra-core-health · Predecesor: #1901 (cierre-pendientes-archivo-cabecera)
- Resultado observable: #1903 queda MERGEABLE contra `dev` y el aviso «ya pidió la vinculación» aparece cuando la API manda `CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING`; #1902 queda cerrado por superado.
- Kill-test: `git grep -n CARE_RELATIONSHIP_REQUEST_PENDING -- src` debe devolver vacío; si devuelve algo, el bug sigue.

## Alcance
- IN: merge de `origin/dev` en `feat/aviso-409-pendiente-o-activo`; cambio del string del reason en `request-access.ts` y su spec; cierre de #1902 con comentario.
- OUT: reemplazar la implementación de `dev` por la del PR; los 695 fallos de suite documentados en #1902; el CI caído; dependencias fuera de lo necesario para correr tests.
- Ambigüedades registradas:
  - #1901 (dev) y #1903 mapean strings distintos para «pendiente». Supuesto: manda la API (`origin/master` de mantra-core-health-api, `authz.error-reasons.ts:61`, PR #1294 mergeado). Confirmar con Pablo/Marcelo que el despliegue de `dev` ya tiene #1294; si no, el fallback genérico cubre.
  - #1902: decisión del usuario de cerrarlo por superado (dev ya borró los specs de `adt/` en cb53766c4 y arregló el handler spec en 207a50790).

## H1 — #1903 mergeable con el reason correcto
**CA:** Dado que la API responde 409 con `reason: CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING`, cuando el profesional pide la vinculación, entonces ve «Ya pidió la vinculación» y no el texto genérico; y el PR no tiene conflictos con `dev`.
**DoD:** spec dirigido en verde, `git grep` del string viejo vacío, `gh pr view 1903` con `MERGEABLE`.
**Estado:** EN CURSO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Merge de `origin/dev`, conflictos resueltos con la versión de `dev` | La carpeta request-access es idéntica a dev | `git diff origin/dev --stat -- src/app/features/clinical-record/request-access` → vacío | HECHO |
| H1.S1.M2 | Cambiar el reason en `request-access.ts` (código y comentario) y en `request-access.spec.ts` (2 sitios) | No queda el string viejo | `git grep -n CARE_RELATIONSHIP_REQUEST_PENDING -- src` → vacío | TODO |
| H1.S2.M1 | Spec dirigido | La fila `_ALREADY_PENDING` pasa | `yarn ng test --include …/request-access.spec.ts` → verde | TODO |
| H1.S2.M2 | Lint dirigido | Sin errores | `yarn eslint src/app/features/clinical-record/request-access` → exit 0 | TODO |
| H1.S3.M1 | Push y gate de mergeable | PR sin conflictos, fuera de draft | `gh pr view 1903 --json isDraft,mergeable,mergeStateStatus` → MERGEABLE; `gh pr checks 1903` pegado | TODO |
| H1.S3.M2 | Actualizar el cuerpo del PR al alcance real | El cuerpo dice que corrige el string sobre lo de #1901 y que no se probó contra API real | `gh pr view 1903 --json body` | TODO |

## H2 — Cerrar #1902 como superado
**CA:** Dado que `dev` ya resolvió lo mismo, entonces #1902 queda cerrado con un comentario que apunta a los commits.
**DoD:** `gh pr view 1902 --json state` → `CLOSED`.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Comentar y cerrar #1902 | Comentario con cb53766c4 y 207a50790; PR cerrado | `gh pr view 1902 --json state` → CLOSED | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| `yarn test` no arranca por `ngx-echarts` sin instalar | No hay evidencia de test | `yarn install` (PnP) y anotarlo |
| `mergeable` UNKNOWN tras el push | Gate no demostrable al instante | Reintentar `gh pr view` |
