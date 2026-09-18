# Estado

**Última tarea verificada:** candidato `36104a9d` + documentación · 2026-09-18.
**Fases:** 00–11 recorridas para el alcance declarado (piloto «Mis citas» + 3 familias
transversales). R03, R07, R09 y R10 quedan **parciales** (ver `QA_FINAL.md`).

## Bloqueos

Ninguno técnico. Pendiente una decisión de producto: D-05 (panel de la médica).

## Para continuar

1. `git -C mantra-core-health worktree add ../wt-<tuyo> -b justin/<tuyo> origin/mockup`
   (o partir de esta rama si el PR sigue abierto).
2. `corepack yarn install --immutable && corepack yarn start --port <libre>`.
3. Leer `PLAN_SITUADO.md` § «Siguiente»; empezar por **N-01** (confirmar H-14 en build SSR).
4. Registrar cada incremento aquí, en `EVIDENCIAS.md` y, si decide algo, en `DECISIONES.md`.
