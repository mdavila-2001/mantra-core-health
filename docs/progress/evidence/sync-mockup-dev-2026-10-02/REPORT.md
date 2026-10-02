# Integración mockup → dev — 02/10/2026

Qué entra: #828, #829, #830, #832 y #833 de `mockup`, posteriores al squash de #831.
Qué no entra: los 54 archivos donde `dev` va adelante a propósito (criterio de #831).

## Navegador (`playwright/sync-mockup-dev-2026-10-02.spec.ts`, 2 de 2 en verde)

Contra `ng serve --configuration development,demo`, Chromium, un worker, sin reintentos.
Sin errores de página ni respuestas >= 400 del mismo origen (salvo `/glossary-data/`, que se
genera con `yarn mock:glossary:shards`, está en `.gitignore` y no existe en un checkout limpio).

| Qué | Prueba | Captura |
|---|---|---|
| #832 · elegir «Quincenal» en Facturación, guardar, recargar, la ficha lo muestra | UI → guardar → recarga → ficha | `editar-facturacion-1440.png`, `ficha-facturacion-1440.png`, `ficha-facturacion-375.png` |
| #828 · «Quincenal» entero en la cotización a 375 px, sin desborde horizontal | medición de `scrollWidth` por rótulo | `cotizacion-frecuencia-375.png` |

Límite de la prueba: en demo el simulador contesta dentro del navegador, así que no hay petición
de red que observar. La persistencia se prueba por la recarga. Contra la API real este guardado
devuelve 400 (ver P59 en `PENDIENTES-BACKEND.md`).

## Chequeos

| Chequeo | Resultado |
|---|---|
| `yarn typecheck`, `yarn lint` | 0 |
| `yarn build` (production) y `ng build --configuration=production-api` | 0 |
| `check-bundle-budget`, `check-real-api-config`, `check-mock-vs-client`, `check-form-pages`, `check-route-prefixes`, `check-api-prefixes` | 0 |
| `check-architecture`, `check-css-tokens`, `check-client-prefixes`, `check-api-contract-drift` | 1, **idéntico a `dev` sin este cambio** |
| `check-english-identifiers` (base `origin/dev`) | 1: 6 nombres en castellano que ya traen #832 y #833 en `mockup` (3 `data-testid`, 2 archivos de docs) |
| `yarn test` | 10 469 de 10 470; dos corridas. La que falla necesita el repo hermano `mantra-core-health-api`, que no está en este entorno. Una corrida mostró además un rechazo no manejado de Leaflet en `practitioner-profile.spec.ts`; el spec solo pasa 2 de 2 y la segunda corrida completa no lo repitió |
| Cypress | no se corrió: su binario no se puede bajar desde este entorno |
