# Reporte — CORR-01: retirar «Consulta médica»

- Fecha: 2026-10-13 · Plan: [PLAN.md](../../../../trabajo/2026-10-13-corr-31-borrar-consulta-medica/PLAN.md) · Rama: `justin/mockup-corr-31-borrar-consulta-medica`
- Peldaño de evidencia alcanzado: `TESTED` para navegación y referencias; evidencia visual parcial por falla heredada de CORR-04 en tema oscuro.
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

- Qué anda: se generaron y revisaron las 12 fotos del carril (panel, `/schedule` y `/consultation`, en 375, 768, 1440 claro y 1440 oscuro cuando corresponde). En claro, el panel y la agenda pasan fondo, centrado, ancho, scroll y consola; `/consultation` muestra «No encontramos lo que busca».
- Qué no anda: la medición marca «se perdió la superficie oscura» en `/dashboard` y `/schedule` a 1440 oscuro. La misma falla aparece en la línea base previa, así que no la introdujo esta rama. Es parte del cierre global de CORR-04, que el plan ordena ejecutar al final.
- Qué falta exactamente: corregir el fondo oscuro en CORR-04, actualizar `mockup`, repetir `scripts/corr-evidencia.sh 31` y confirmar 12/12 celdas.
- Dónde quedó: imágenes y matrices en [`docs/progress/evidence/lane-31/`](./); el resultado literal de la última corrida está en la sesión y se resumió en la matriz.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M1 | A MEDIAS | Cierre final de CORR-04 y nueva evidencia visual |
| H1.S2.M2 | TODO | Regresión completa, ruta de salud, `fable-proof-check.py` y PR cuando no haya rojos de CORR-04 |

## Evidencia

- `corepack yarn typecheck` → exit 0.
- `corepack yarn eslint src/app/core/navigation/navigation.map.spec.ts src/app/core/navigation/navigation.subgroups.spec.ts` → exit 0.
- `corepack yarn test --watch=false --include='src/app/core/navigation/**/*.spec.ts'` → `Test Files 9 passed (9)`; `Tests 170 passed (170)`.
- `corepack yarn lint` → exit 1; 269 errores en archivos no modificados de la base.
- Línea base visual → `1 passed`; 12 celdas, 2 rojas de superficie oscura.
- Corrida final visual → 1 test falla porque `/dashboard` y `/schedule` no conservan la superficie oscura. Ambas celdas ya estaban rojas en la línea base.

## No cubierto

- No se corrió aún la suite completa, `corepack yarn build`, `playwright/carril-19-route-health.spec.ts` ni `fable-proof-check.py`.
- No se volvió a implementar la eliminación de la pantalla: ya figura integrada en `origin/mockup` por el commit `9e558a647`.

## Desvíos del plan

- Se cambió la ruta de la captura del panel de `/` a `/dashboard`, que es el destino real con sesión. La primera corrida falló al detectar la redirección de `/` a `/dashboard`; la medición corregida captura el mismo panel sin suprimir la comprobación de URL.
- Se agregaron dos expectativas explícitas de la navegación actual porque los specs heredados fallaban por la incorporación de `psychological-help`. No se quitó ni amplió ninguna aserción.

## Riesgos residuales

- La regla visual global no pasa en tema oscuro para dos rutas y bloquea el cierre hasta CORR-04.
- `corepack yarn lint` global conserva deuda preexistente; el lint de los archivos tocados sí pasó.

## Decisiones y ambigüedades

- La ficha TAREA-31 §3 declara que no hay ambigüedades. La ruta clínica `/medical-records/:profileId/consultation` se preserva y no se confunde con la pantalla antigua `/consultation`.
