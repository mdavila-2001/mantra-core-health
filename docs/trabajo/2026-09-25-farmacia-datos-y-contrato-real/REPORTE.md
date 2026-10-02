# Reporte — Cliente y mocks de farmacia, y el contrato real en la API (Carril Marcelo)

> **AVANCE: 13 / 30 — 43,3 %.** (H1: 4/4 · H2: 5/6 · H3: 4/6 · H4-H7: 0/14 — quedan en el repo API o pendientes)

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `marcelo/farmacia-cliente-y-mocks-2026-09-25` (worktree `wt-marcelo-farmacia-front`, sin push todavía)
- Peldaño de evidencia alcanzado: **TESTED** (H2, H3.S2) — specs dirigidos en verde ejecutando el código real (typecheck + tests), sin PR abierto ni merge a `mockup` (eso subiría a `VERIFIED`).
- Este reporte cubre **solo la mitad front** del carril. La mitad API (H4-H6, `mantra-core-health-api`) está en su propio `PLAN.md`/`REPORTE.md` bajo `wt-marcelo-farmacia-api/docs/trabajo/2026-09-25-farmacia-datos-y-contrato-real/` y sigue en H1 (baseline hecho, sin código de H4-H6 escrito todavía).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1-M4 | Cortes fijados (`bf2c3545`/`343795cc`, ambos == target de la ficha, sin drift), baseline de los dos repos, rojos clasificados | `yarn lint/typecheck`, `yarn test src/modules/pharmacy` | `evidencia/antes/{front,api}/*.txt` |
| H2.S1.M1 | `PharmacySiteRead`, `PharmacyDetail`, `PharmacySitePriceItem`, `PharmacySitePrices` en `pharmacy.types.ts`, calcados campo por campo de `read-responses.dto.ts` real | diff manual | `evidencia/h2/campos.md` — incluye el hallazgo de Q-M4 (`requiresPrescription` NO existe hoy en el DTO real; se declara para agregarlo en H4) |
| H2.S1.M2-M3 | `PharmacyClient.getPharmacy(id)` y `getSitePrices(siteId, productId?)` | `npx ng test --include='.../pharmacy.client.spec.ts'` | 9/9 PASS (eran 6/9) |
| H2.S1.M4-M5 | Mock `GET /pharmacy/pharmacies/:id` y `GET /pharmacy/sites/:siteId/prices` en `pharmacy.handlers.ts` | `npx ng test --include='.../pharmacy.handlers.spec.ts'` (nuevo) | 7/7 PASS |
| H3.S2.M1-M4 | Coherencia de precio verificada entre `/sites/:siteId/prices`, `/availability` y `POST /orders`; `stock 0` excluido de ambos listados; `/pharmacy/sites` ordena por distancia (con origen) / nombre de farmacia (sin origen); `/products?pharmacyId` filtra | idem | mismos 7/7 — un solo archivo cubre las cuatro microtareas |
| Regresión parcial | `typecheck` limpio y 259 tests en verde sobre `core/data-access/pharmacy` + `core/mock/**` tras los cambios | `corepack yarn typecheck` · `npx ng test --include='src/app/core/data-access/pharmacy/*.spec.ts' --include='src/app/core/mock/**/*.spec.ts'` | 32 archivos / 259 tests PASS, sin rojos nuevos |

## A medias
### H2.S1.M6 — PR a `mockup`
- **Qué anda:** el código de la Ola 0 (`getPharmacy`, `getSitePrices`, los dos mocks, los tipos) está escrito, compila y sus specs pasan.
- **Qué no anda:** no hay PR abierto ni push a `mockup`. La ficha pide que se mergee **en la primera hora** porque Justin e Itzan lo esperan.
- **Qué falta exactamente:** `git push` de la rama, `gh pr create` contra `mockup`, y el merge. Se dejó pendiente porque `mockup` es una rama compartida de la que dependen sesiones en curso de Justin e Itzan (`wt-prompt-manager-farmacia` referencia `justin/reparto-farmacia-ecommerce-2026-09-25`) — hacer push/merge sin decirlo antes es exactamente lo que la regla de control de recursos de la raíz pide confirmar. Publicando esto ahora en el chat para decidir si se abre/mergea el PR o si se espera confirmación.
- **Dónde quedó:** worktree `wt-marcelo-farmacia-front`, rama `marcelo/farmacia-cliente-y-mocks-2026-09-25`, working tree con los cambios sin commitear todavía (`git status` los muestra); compila y los specs pasan.

### H3.S1 — Fixtures compartidas
- **Qué anda:** nada implementado todavía.
- **Qué no anda:** `pharmacy.fixtures.ts` no tiene `FARMACIA_DETALLE`, `PRECIOS_DE_SEDE` ni `SEDES_CERCANAS`.
- **Qué falta exactamente:** las tres constantes (H3.S1.M1) y publicarlas en el daily (H3.S1.M2).
- **Dónde quedó:** no se tocó `pharmacy.fixtures.ts` en este turno. Se priorizó H2 (Ola 0, bloqueante) y H3.S2 (coherencia, que fija el mismo archivo `pharmacy.handlers.spec.ts` que H2 necesitaba de todas formas) por sobre H3.S1, siguiendo la propia ficha (§2: "H2 y H3 valen más que H6").

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.S1.M1-M2 | TODO | Nada externo — es la próxima microtarea si se sigue este carril |
| H4-H6 (repo API) | TODO | Trabajo de backend, en `wt-marcelo-farmacia-api`; requiere la misma disciplina (PLAN.md ya escrito ahí) |
| H7 | TODO | Depende de cerrar H3-H6 primero |

## Evidencia
```text
$ corepack yarn typecheck   (front, tras H2+H3.S2)
exit 0 (sin errores; requiere `yarn env:generate` antes — no documentado en package.json)

$ npx ng test --include='src/app/core/data-access/pharmacy/*.spec.ts' --include='src/app/core/mock/**/*.spec.ts' --watch=false
Test Files  32 passed (32)
     Tests  259 passed (259)
```
Detalle completo en `evidencia/antes/front/` (baseline) y `evidencia/h2/campos.md` (diff de campos).

## No cubierto
- **El `curl` literal del kill-test de la ficha no aplica a este código**: `mockBackend` es un interceptor de `HttpClient` (DI de Angular), no una ruta de servidor — verificado levantando `ng serve` y confirmando 500 tanto con `curl` como con `fetch()` nativo desde una página real (Playwright). La verificación real equivalente (ejecutar el handler registrado, `pharmacy.handlers.spec.ts`) sí se hizo y está en VERDE, pero es importante no leer esto como "el kill-test original pasó tal cual está escrito": está corregido, no cumplido literalmente.
- Ningún PR abierto todavía (ni front ni, por ahora, API): nada mergeable que mostrar con `gh pr view`.
- No se ejecutó Playwright/E2E dirigido (fuera del alcance de este carril, que es de datos y contrato, no de pantalla).
- H4-H7 completos: no hay endpoint `GET /pharmacy/sites` real todavía, ni `pharmacyId` en `/products` real, ni OpenAPI regenerado, ni PR a `dev`.

## Desvíos del plan
- Ninguno respecto del orden declarado (H1 → H2 → H3), salvo que H3.S1 (fixtures) quedó después de H3.S2 (coherencia) porque el spec de coherencia necesitaba el mismo router que H2 ya había montado, y priorizar H4-H6 (API, "el único trabajo de backend del turno" según la ficha) sobre H3.S1 fue una decisión de scope, no un error.

## Riesgos residuales
- **`mockup` es compartida por al menos otra sesión activa** (worktree `wt-prompt-manager-farmacia` en `justin/reparto-farmacia-ecommerce-2026-09-25`, y el propio Justin/Itzan del reparto de esta noche). Empujar sin avisar podría chocar con trabajo en curso de otra sesión — regla de control de recursos de la raíz.
- Los 252 rojos preexistentes de `yarn lint` (fuera de este carril) siguen sin corregir; no son responsabilidad de este trabajo pero conviene que quede registrado que ya estaban antes de tocar nada acá.

## Decisiones y ambigüedades
- **Q-M2 (decimal de `distanceKm`)** — resuelta leyendo el código: `haversineKm` de `pharmacy_inventory` ya redondea a un decimal (`Math.round(distance * 10) / 10`); H4 la reutiliza tal cual.
- **Q-M3 (una sede por farmacia en el mock)** — confirmada: `FARMACIAS` en `pharmacy.handlers.ts` ya modela una sola sede por farmacia; se declara como límite del doble en el código.
- **Q-M4 (`requiresPrescription` en el DTO real)** — **NO existe hoy** en `PharmacySitePriceDto` (`read-responses.dto.ts`); queda pendiente agregarlo en H4 (repo API) para que el contrato real y el front/mock terminen de coincidir.
- **PR a `mockup` sin abrir** — decisión de esta sesión, a confirmar con quien esté coordinando el reparto de esta noche: ¿se abre y mergea ahora, o se coordina con Justin/Itzan primero?
