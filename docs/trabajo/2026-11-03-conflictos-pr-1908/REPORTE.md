# Reporte — Resolver los conflictos de #1908

- Fecha: 2026-11-03 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `feat/pruebas-organizaciones-1899`
- Peldaño de evidencia alcanzado: `TESTED` (specs dirigidos en verde). No `VERIFIED`.
- Avance: 4 de 5 microtareas HECHO (80 %); falta H1.S3.M1 (push y gate de mergeable), que se demuestra con la salida de `gh` tras el push.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Merge de `origin/dev`; los dos conflictos resueltos con la versión de `dev` | `git diff --name-only --diff-filter=U` | vacío |
| H1.S1.M2 | El diff contra `dev` es sólo el spec nuevo | `git diff --stat origin/dev -- . ':!docs/trabajo'` | `appointments.organizaciones.spec.ts \| 300 +++` · 1 file changed |
| H1.S2.M1 | Specs dirigidos en verde | `node scripts/with-heap.mjs yarn ng test --include …organizaciones.spec.ts --include …appointments.spec.ts --watch=false` | `Test Files 2 passed (2)` · `Tests 136 passed (136)` |
| H1.S2.M2 | Lint dirigido | `yarn eslint src/app/features/account/appointments` | exit 0 |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S3.M1 | EN CURSO | Push y `gh pr view 1908` tras el último push |

## Evidencia
- Los conflictos eran `appointments.spec.ts` y `support-access.provisioning.handlers.spec.ts`; venían de los commits de #1902 y #1905, ambos cerrados por superados porque su contenido ya está en `dev`.

## No cubierto
- No se corrió la suite completa de `ng test`, ni `yarn build`/`yarn typecheck` completos.
- No se repitieron las mutaciones que el PR declara haber hecho sobre el componente.
- Las pruebas usan el cliente simulado: no se probó contra la API real ni en navegador.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- Si alguien reaplica #1902/#1905 por separado, volvería a chocar con `dev`.

## Decisiones y ambigüedades
- Se descartaron los commits apilados de #1902 y #1905 (supuesto registrado en el plan): su contenido ya está en `dev`.
