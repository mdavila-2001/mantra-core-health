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

---

# Segunda integración — #837 #840 #841 #843 #844 #845

Lo que `mockup` sumó después de #838. Entran 51 archivos (fichas v2, #845, ya estaba en `dev` por #846).
El merge salió sin conflictos y `mockup` queda como ancestro de la rama.

## Navegador, modo demo, Chromium, un worker, sin reintentos

| Cambio | Prueba | Resultado |
|---|---|---|
| #843 horarios de otros servicios (médica y paciente) | `playwright/horarios-otros-servicios.spec.ts` | 2 de 2 |
| #840 alta profesional: país y universidad en árbol | `playwright/registro-doctor-universidad-y-profesiones.spec.ts` | 5 de 5 |
| #841 idiomas del médico: elegir, guardar, recargar, ver en la ficha | `sync-mockup-dev-2026-10-02.spec.ts` | 1 de 1 · `idiomas-*.png` |
| #837 mapa al final del directorio de laboratorios, también a 375 px | `sync-mockup-dev-2026-10-02.spec.ts` | 1 de 1 · `laboratorios-mapa-al-final-*.png` |

Sin cobertura de navegador propia: #844 (plan 05 de farmacia, sólo documento) y #845 (fichas v2, ya
en `dev` por #846).

## Chequeos

| Chequeo | Resultado |
|---|---|
| `yarn typecheck`, `yarn lint` | 0 |
| `yarn build` y `ng build --configuration=production-api`, presupuesto del paquete | 0, inicial 1,37 MB |
| `check-real-api-config`, `check-mock-vs-client`, `check-form-pages`, `check-route-prefixes`, `check-api-prefixes` | 0, idéntico a `dev` |
| `check-architecture`, `check-css-tokens`, `check-client-prefixes`, `check-api-contract-drift` | 1, **idéntico a `dev` limpio**. Cero operaciones de API nuevas sin documentar |
| `check-english-identifiers` (base `dev`) | 1: 39 nombres en castellano que ya traen estos PR en `mockup` |
| `yarn test` | 10 536 de 10 537. Falla sólo la prueba que lee el repo hermano de la API. Error de Leaflet no manejado en `practitioner-profile.spec.ts`: **también aparece en `dev` limpio** (esa corrida además falló `pdf-logo`) |

## Riesgo contra la API real

P60 en `PENDIENTES-BACKEND.md`: el editor de idiomas manda `languages` en el `PATCH /profiles/practitioners/me`
con un contrato que el repo no puede verificar. Contra la API real puede devolver 400 o ignorarlo.
