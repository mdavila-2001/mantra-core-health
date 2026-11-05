# Plan — CORR-01: retirar la pantalla antigua «Consulta médica»

- Fecha: 2026-10-13 · Repos afectados: `mantra-core-health` · Predecesor: ninguno
- Rama: `justin/mockup-corr-31-borrar-consulta-medica` sobre `origin/mockup`
- Resultado observable: la pantalla antigua y sus accesos desaparecen; `/schedule` conserva la agenda y `/consultation` muestra no encontrado.
- Kill-test: `corepack yarn pw playwright/corr-evidencia.spec.ts --workers=1` muestra la tarjeta vieja en «Tus accesos» o sigue resolviendo `/consultation`.

## Alcance

- IN: retirar la ruta y referencias exclusivas a la pantalla vieja; actualizar tests afectados; regenerar el índice de componentes; conservar el encuentro clínico bajo `clinical-record` y la agenda `/schedule`.
- OUT: cambios de API, modelo, seeds, `proxy.conf.json` o `.env`; rediseño de «Tus accesos»; cambios al encuentro clínico.
- Decisión durante la línea base: el navegador confirma que `/` redirige a `/dashboard` con sesión. La matriz apuntaba a `/`, por eso rechazaba fotos de la misma pantalla del panel. Se actualiza sólo el destino de evidencia de este carril a `/dashboard`; no se cambia ningún test de producto ni se oculta una aserción.
- Bloqueo de regresión descubierto antes de cambios de producto: dos specs de navegación fallan en `origin/mockup` porque PR #1052 añadió `psychological-help` pero dejó obsoletas las listas cerradas. Se añadirá la nueva ruta a las expectativas explícitas, sin quitar ni ampliar aserciones, para que la regresión dirigida sea ejecutable.
- Ambigüedades registradas: ninguna, según `tareas/TAREA-31-borrar-consulta-medica.md` §3.

## H1 — Retirar «Consulta médica» de la maqueta

**CA:** Dada la sesión de doctora demo, cuando abre el panel, el menú y la ruta vieja, entonces sólo aparece «Consultas médicas», la agenda sigue funcionando y `/consultation` no existe.
**DoD:** línea base y evidencia final con `scripts/corr-evidencia.sh 31 [--antes]`; por cada microtarea, `corepack yarn typecheck`, `corepack yarn lint` y specs dirigidos; cierre con regresión solicitada por TAREA-31, fotos revisadas, reporte, `fable-proof-check.py --lane 31` y PR a `mockup`.
**Estado:** EN CURSO

### H1.S1 — Inventariar y retirar las referencias exclusivas

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M0 | Alinear la ruta de captura del panel con `homeGuard` | El navegador captura el panel en su ruta efectiva `/dashboard` | Línea base de `scripts/corr-evidencia.sh 31 --antes` → PASS, 12 celdas | HECHO |
| H1.S1.M1 | Clasificar todas las referencias de la pantalla vieja | Cada hit de la búsqueda queda clasificado con motivo | `INVENTARIO.md` documenta los 40 hits y la búsqueda devuelve 40 líneas | HECHO |
| H1.S1.M2 | Retirar navegación, árbol de accesos y ruta; borrar componente; regenerar stock | No quedan rutas ni accesos a la pantalla vieja y el encuentro clínico se conserva | Estado ya integrado en `origin/mockup` por `9e558a647`; carpeta y ruta ausentes; typecheck genera el stock; specs dirigidos pasan | HECHO |
| H1.S1.M3 | Corregir enlaces y expectativas afectadas | Ningún enlace apunta a `/consultation`; los tests mantienen sus aserciones | Búsqueda de rutas y specs dirigidos → PASS | HECHO |
| H1.S1.M4 | Actualizar las listas cerradas afectadas por la ruta nueva de ayuda psicológica | Las pruebas de navegación fijan todas las rutas exclusivas y sueltas actuales | 9 archivos / 170 pruebas → PASS; lint dirigido → PASS | HECHO |

### H1.S2 — Verificar y documentar el resultado

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Capturar fotos posteriores y revisar todas las vistas | Vistas solicitadas medidas en claro/oscuro y 375/768/1440 | 12 fotos generadas y revisadas; permanece rojo en superficie oscura de `/dashboard` y `/schedule`, también en línea base; queda para CORR-04 final | A MEDIAS |
| H1.S2.M2 | Ejecutar regresiones y guard de evidencia | Sin nuevos rojos; DoD de la ficha demostrado | `corepack yarn test --watch=false`, Playwright carril 19 y `python3 -S scripts/atlas/fable-proof-check.py --lane 31` | TODO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir la ruta de la pantalla con rutas de encuentros clínicos | Regresión clínica | Clasificar cada referencia antes de editar y conservar `clinical-record/**/consultation`. |
| La matriz visual pueda reflejar una app distinta | Evidencia inválida | Correr desde este worktree `mockup` y registrar URL/commit en el reporte. |
