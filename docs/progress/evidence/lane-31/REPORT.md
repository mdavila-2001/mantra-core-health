# Reporte — CORR-01: retirar «Consulta médica»

- Fecha: 2026-10-13 · Plan: [PLAN.md](../../../../trabajo/2026-10-13-corr-31-borrar-consulta-medica/PLAN.md) · Rama: `justin/mockup-corr-31-borrar-consulta-medica`
- Peldaño de evidencia alcanzado: `VERIFIED` para la verificación visual en `origin/mockup` (`bac6a1931`, 2026-10-15); la regresión integral y el cierre Fable siguen pendientes.
- Avance del plan de esta rama: 5/7 microtareas = **71 %**. El carril no se declara cerrado.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M0 | La matriz captura el panel en la ruta efectiva que decide `homeGuard` | `E2E_BASE_URL=http://localhost:4200 CORR_USUARIO=medica scripts/corr-evidencia.sh 31 --antes` | `1 passed`; 12 celdas, 2 rojas de superficie oscura ya presentes en la base |
| H1.S1.M1 | Se clasificaron las referencias restantes de `consultation` | `rg -n "'consultation'\|/consultation\|Consulta médica" src --glob '*.ts' --glob '*.html'` | 40 hits inventariados en [INVENTARIO.md](./INVENTARIO.md); ninguno corresponde a la pantalla antigua |
| H1.S1.M2 | La pantalla vieja ya estaba retirada en `origin/mockup`; se confirmó ausencia de componente, ruta y acceso, manteniendo el encuentro clínico | `test -d src/app/features/consultation` + búsqueda en rutas/navegación + `corepack yarn typecheck` | Carpeta de pantalla ausente; typecheck exit 0; `clinical-record/**/consultation` sigue presente |
| H1.S1.M3 | La búsqueda no encuentra enlaces a la ruta vieja fuera de coincidencias de API/contabilidad y del encuentro clínico | `rg` dirigido en navegación, rutas y enlaces | Sin destino `/consultation` de la pantalla antigua |
| H1.S1.M4 | Se actualizaron expectativas cerradas de navegación para `psychological-help`, incorporada recientemente en la base | `corepack yarn test --watch=false --include='src/app/core/navigation/**/*.spec.ts'` | 9 archivos, 170 pruebas aprobadas; lint dirigido de los dos specs exit 0 |

## A medias

### H1.S2.M1 — Fotos posteriores y regla visual CORR-04

- Rechequeo: `scripts/corr-evidencia.sh 31` sobre `origin/mockup` (`bac6a1931`) el 2026-10-15 generó 12 celdas PASS. Las cuatro capturas oscuras fueron inspeccionadas; `/dashboard` y `/schedule` conservan la superficie oscura y `/consultation` muestra el estado de ruta retirada.
- La matriz histórica del 2026-10-13 conserva los dos rojos de ese momento; la matriz actual está en [`MATRIZ-visual.md`](./MATRIZ-visual.md) y las capturas actuales en [`fotos/despues/`](./fotos/despues/).

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M1 | COMPLETADO | Rechequeo actual: 12 celdas PASS en `origin/mockup` |
| H1.S2.M2 | PENDIENTE | Suite completa y route-health; `scripts/atlas/fable-proof-check.py` no existe en esta punta |

## Evidencia

- `corepack yarn typecheck` → exit 0.
- `corepack yarn eslint src/app/core/navigation/navigation.map.spec.ts src/app/core/navigation/navigation.subgroups.spec.ts` → exit 0.
- `corepack yarn test --watch=false --include='src/app/core/navigation/**/*.spec.ts'` → `Test Files 9 passed (9)`; `Tests 170 passed (170)`.
- `corepack yarn lint` → exit 1; 269 errores en archivos no modificados de la base.
- Corrida histórica visual del 2026-10-13 → 12 celdas, 2 rojas de superficie oscura.
- `scripts/corr-evidencia.sh 31` en `origin/mockup` (`bac6a1931`), 2026-10-15 → `1 passed`; 12 celdas, 0 rojas. Las fotos nuevas se inspeccionaron una por una.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 31` → no disponible: el archivo no existe en esta punta `mockup`.

## No cubierto

- No se corrió aún la suite completa, `corepack yarn build`, `playwright/carril-19-route-health.spec.ts` ni `fable-proof-check.py`.
- No se volvió a implementar la eliminación de la pantalla: ya figura integrada en `origin/mockup` por el commit `9e558a647`.

## Desvíos del plan

- Se cambió la ruta de la captura del panel de `/` a `/dashboard`, que es el destino real con sesión. La primera corrida falló al detectar la redirección de `/` a `/dashboard`; la medición corregida captura el mismo panel sin suprimir la comprobación de URL.
- Se agregaron dos expectativas explícitas de la navegación actual porque los specs heredados fallaban por la incorporación de `psychological-help`. No se quitó ni amplió ninguna aserción.

## Riesgos residuales

- La medición visual actual pasa; las matrices históricas mantienen el registro de sus resultados de entonces.
- La suite completa, route-health y Fable proof siguen sin ejecutarse en este follow-up.
- `corepack yarn lint` global conserva deuda preexistente; el lint de los archivos tocados sí pasó.

## Decisiones y ambigüedades

- La ficha TAREA-31 §3 declara que no hay ambigüedades. La ruta clínica `/medical-records/:profileId/consultation` se preserva y no se confunde con la pantalla antigua `/consultation`.
