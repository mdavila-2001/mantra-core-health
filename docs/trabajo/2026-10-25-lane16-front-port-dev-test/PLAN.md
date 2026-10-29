# Plan — Port del front del carril 16 (PR #1227) de mockup a dev y a test

- Fecha: 2026-10-25 · Repos afectados: mantra-core-health · Predecesor: PR #1227 (solo en `mockup`)
- Resultado observable: en `dev` y en `test`, el bloque «Pagos» de la consulta cotiza el cobro con seguro,
  «Mis solicitudes» muestra el desglose al paciente y permite objetarlo, contra la API ya presente en ambas ramas.
- Kill-test: `git grep -c ClaimQuote origin/dev -- src/app/features/clinical-record` da 0 hoy; debe dar >0 tras el port.

## Alcance
- IN: los archivos `src/` y `playwright/` del commit `14495e3a4` (feat del #1227), sus specs, y este PLAN/REPORTE.
- OUT: `PENDIENTES-BACKEND.md` (dev lo retiró en `c640451ca`); las 27 capturas de `docs/progress/evidence/lane-16/`
  y la carpeta `docs/trabajo/2026-10-24-marcelo-lane16-front/` (quedan en `mockup`, son el rastro del original);
  cualquier otra cosa.
- Ambigüedades registradas:
  - Dev y test divergen de mockup (927 y 965 commits): el cherry-pick puede chocar. Supuesto: se resuelve
    entendiendo ambos lados y sin tocar la semántica del carril. Confirmar con quien revise el PR.
  - Dos PRs, `[dev]` y `[test]`, como el resto del trabajo de estos dos días.

## H1 — Port a dev
**CA:** Dado `origin/dev`, cuando se aplica el feat del #1227, entonces la UI de cotización, desglose y objeción
existe en dev y sus pruebas pasan.
**DoD:** typecheck, specs de seguros, lint de los archivos tocados, `gh pr view`/`gh pr checks`.
**Estado:** A MEDIAS (falta el PR mergeable; ver REPORTE)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Aplicar el feat `14495e3a4` sin los docs retirados | `git diff --stat` solo muestra `src/` y `playwright/` | `git diff --stat origin/dev` | HECHO |
| H1.M2 | Resolver conflictos (7 archivos) | sin marcadores `<<<<<<<` | `grep -rn '^<<<<<<<' src playwright` → vacío | HECHO |
| H1.M3 | Typecheck | exit 0 | `yarn typecheck` | HECHO |
| H1.M4 | Specs de seguros y bloque de pagos | en verde | `yarn test --include=…` dirigido | HECHO |
| H1.M5 | Lint de lo tocado | exit 0 | `yarn eslint <archivos>` | HECHO |
| H1.M6 | PR a `dev` mergeable | MERGEABLE | `gh pr view` + `gh pr checks` | EN CURSO |
| H1.M7 | Alinear 4 specs a las convenciones de dev (maqueta apagada, 422/400, cobro con cobertura) | sin tocar aserciones de comportamiento | `yarn test` completo → 0 fallos | HECHO |
| H1.M8 | `objectionReason` deja de ser «solo simulador»: el contrato de dev ya lo declara | el cliente lo manda a la API real | `yarn test` + lectura del contrato | HECHO |
| H1.M9 | Playwright del cobro contra la maqueta + doble revisión de capturas | 25/25 y notas por pantalla | `yarn pw playwright/carril-16-cobro-con-seguro.spec.ts` | HECHO |

## H2 — Port a test
**CA:** Igual que H1 sobre `origin/test`.
**DoD:** igual que H1. **Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.M1 | Rama desde `origin/test` y aplicar el mismo feat | diff solo `src/` y `playwright/` | `git diff --stat origin/test` | TODO |
| H2.M2 | Typecheck + specs dirigidos + lint | exit 0 / verde | mismos comandos | TODO |
| H2.M3 | PR a `test` mergeable | MERGEABLE | `gh pr view` + `gh pr checks` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Conflictos por la divergencia con mockup | Cambia el comportamiento sin querer | Leer ambos lados; correr los specs del carril |
| `Could not resolve "three"` en el pre-push | Push bloqueado | `yarn install --immutable` en el checkout principal; nunca `--no-verify` |
| El CI propio está caído (CLAUDE.md del repo) | `gh pr checks` sin checks | Se pega la salida tal cual y se declara |
| Merge a dev exige revisión humana | El flujo termina en abrir el PR | Se declara en el reporte |
