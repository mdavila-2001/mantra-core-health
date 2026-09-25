# Plan — Cliente y mocks de farmacia, y el contrato real en la API (Carril Marcelo, carriles 42 y 47)

- Fecha: 2026-09-25 · Repos afectados: `alovida/mantra-core-health` (front, H2-H3, H7 parcial), `alovida/mantra-core-health-api` (API, H4-H6, H7 parcial) · Predecesor: ninguno
- Resultado observable: Justin e Itzan pueden importar `getPharmacy()`/`getSitePrices()` desde `origin/mockup` en su primera hora; la API real en `dev` sirve `GET /pharmacy/sites` y filtra `GET /pharmacy/products?pharmacyId`.
- Kill-test: `curl -s localhost:4200/pharmacy/pharmacies/<id de FARMACIAS[0]>` trae `sites[0].latitude`; `curl -s localhost:4200/pharmacy/sites/<siteId>/prices | jq '.items[0].unitAmount'` es el mismo número que el `price` de ese producto en `/pharmacy-inventory/availability?products=<id>`; `yarn test src/modules/pharmacy` incluye un caso que pide `/pharmacy/sites?lat=-17.78` sin `lng` y recibe 400.
- **Corrección factual al kill-test (H2, verificada corriendo `ng serve` + Playwright):** `mockBackend: true` es un interceptor de `HttpClient` de Angular, registrado por inyección de dependencias — **no** es una ruta que el servidor de `ng serve` sirva, así que un `curl`/`fetch` nativo devuelve **500** (el dev-server proxea `/pharmacy/*` a un backend real inexistente, `ECONNREFUSED`). Confirmado navegando la app con Playwright y ejecutando `fetch()` en la página: mismo 500, porque `fetch` nativo tampoco pasa por el interceptor de `HttpClient`. La verificación equivalente real es ejercitar `registrarFarmacia(router)` directo con el arnés de `pharma-lab.handlers.spec.ts` (`router.match()` + `handler()`), que sí corre el código real del mock — hecho en `pharmacy.handlers.spec.ts` (H3.S2).

## Alcance
- IN: baseline de los dos repos · tipos y dos métodos de cliente nuevos (`getPharmacy`, `getSitePrices`) · dos mocks nuevos · fixtures compartidas (`FARMACIA_DETALLE`, `PRECIOS_DE_SEDE`, `SEDES_CERCANAS`) · spec del handler que fija coherencia de precio · `GET /pharmacy/sites` real con Haversine · `pharmacyId` en `GET /pharmacy/products` real · OpenAPI/Postman + nota de pendientes · specs · `PLAN.md`/`REPORTE.md`/`evidencia/` por repo.
- OUT: cualquier archivo fuera de los reservados de la ficha · pantallas de Justin/Itzan · carrito y cabecera (Pablo) · `pharmacy_inventory/**` de la API (solo lectura) · el modelo/DDL/seeds (`mantra-core-health-model/**`) · endpoint de carrito · `availability` (ya existe) · levantar el stack Docker sin permiso · debilitar specs.
- Ambigüedades registradas:
  - Q-M1: ¿`GET /pharmacy/sites` lista sedes de todas las farmacias publicadas o solo con productos? Supuesto: todas las publicadas, `productCount` viaja. A confirmar: Justin.
  - Q-M2: ¿`distanceKm` con un decimal como `availability`? Supuesto: sí, un decimal. A confirmar: Marcelo (self).
  - Q-M3: ¿El mock de `/pharmacies/:id` devuelve una sede por farmacia? Supuesto: sí, límite declarado del doble. A confirmar: Marcelo (self).
  - Q-M4: ¿`requiresPrescription` existe ya en `PharmacySitePriceDto` real? Se verifica en H2.S1.M1 abriendo el DTO.
  - Q-M5: el runner self-hosted del CI de la API puede estar apagado — se corre todo local y se pega la salida.

## H1 — Cortes y baseline de los dos repos
**CA:** Dado cada repo, cuando alguien pregunta contra qué versión trabajaste y qué estaba en rojo antes, entonces hay SHA, salidas y rojos previos clasificados para el front y para la API.
**DoD:** `evidencia/antes/front/` y `evidencia/antes/api/` con salidas y exit codes.
**Estado:** HECHO

### H1.S1 — Corte, ramas y baseline
**CA:** Dado un rojo posterior en cualquiera de los dos, cuando alguien pregunta si lo rompiste vos, entonces la respuesta sale de un archivo.
**DoD:** salidas pegadas; rojos previos clasificados.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar los dos cortes y las dos ramas | Dos SHA y dos ramas | Front `origin/mockup` = `bf2c35452363ede1d367f94c4fd726b2b9a63cb1` · API `origin/dev` = `343795cc2d08745692f491c50e81427215043315` (confirmados iguales al target de la ficha, sin drift) | HECHO |
| H1.S1.M2 | Baseline front: `lint`, `typecheck`, `test --include='src/app/core/data-access/pharmacy/*.spec.ts'` | Salidas y exit codes | → `evidencia/antes/front/{lint,typecheck,pharmacy-spec}.txt` — lint exit 1 (252 rojos preexistentes, ninguno en `pharmacy/`), typecheck exit 0 (requiere `yarn env:generate` primero — no documentado en el `package.json`, `env.generated.ts` está en `.gitignore`), spec exit 0 (6/6) | HECHO |
| H1.S1.M3 | Baseline API: `yarn typecheck` y `yarn test src/modules/pharmacy` | Salidas y exit codes | → `evidencia/antes/api/{typecheck,test}.txt` — ambos exit 0, 16 suites/181 tests | HECHO |
| H1.S1.M4 | Clasificar cada rojo previo | Cada uno con su clase (regla 80.4) | tabla abajo | HECHO |

**Rojos previos clasificados:** front `yarn lint` → **252 errores preexistentes** (`@angular-eslint/prefer-on-push-component-change-detection` en specs de componentes ajenos a `pharmacy/`, ninguno en el alcance de este carril) → clase `PRODUCT_BUG` preexistente, no de este carril, no se toca (regla 00 §3, fuera de alcance). API: sin rojos previos.

## H2 — Tipos, cliente y mocks (Ola 0 del equipo) — BLOQUEANTE, primera hora
**CA:** Dado el plan §4.4, cuando Justin e Itzan llaman `getPharmacy(id)` y `getSitePrices(siteId)` desde `origin/mockup`, entonces compilan, el mock responde y los campos son los del DTO real nombre por nombre.
**DoD:** PR propio mergeado en `mockup` en la primera hora; `pharmacy.client.spec.ts` +4 casos en verde; `curl` pegado; fila PUBLICADO en §4-bis del daily de equipo.
**Estado:** TESTED (código escrito, compila, specs dirigidos en verde; PR **no abierto todavía** — pendiente de confirmación para tocar la rama compartida `mockup`, ver REPORTE.md)

### H2.S1 — Tipos, métodos y mocks
**CA:** Dado `getSitePrices(siteId, productId?)`, cuando `productId` viene, viaja como `?product=`; cuando no, no viaja ninguna clave; `siteId` desconocido → 404.
**DoD:** spec del cliente; verificación equivalente al `curl` contra `yarn start` (ver corrección factual arriba: se hizo con `router.match()`/`handler()` directo, no con HTTP real).
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `pharmacy.types.ts`: `PharmacySiteRead`, `PharmacyDetail`, `PharmacySitePriceItem`, `PharmacySitePrices` — calcados de `read-responses.dto.ts` | Cada campo existe en el DTO con el mismo nombre | `evidencia/h2/campos.md` | HECHO |
| H2.S1.M2 | `PharmacyClient.getPharmacy(id)` → `GET /pharmacy/pharmacies/:id` | Compila; spec | `npx ng test --include='src/app/core/data-access/pharmacy/pharmacy.client.spec.ts' --watch=false` → 9/9 (era 6/9) | HECHO |
| H2.S1.M3 | `PharmacyClient.getSitePrices(siteId, productId?)` → `GET /pharmacy/sites/:siteId/prices?product=` (sin clave si no viene) | Spec fija las dos formas | idem — 2 casos nuevos (`sin product` / `con product`) | HECHO |
| H2.S1.M4 | Mock `GET /pharmacy/pharmacies/:id` desde `FARMACIAS`; 404 si no existe | Devuelve `sites[0].latitude`; 404 con id desconocido | `pharmacy.handlers.spec.ts` (H3.S2.M1-M2, ver abajo) — 7/7 | HECHO |
| H2.S1.M5 | Mock `GET /pharmacy/sites/:siteId/prices` desde `productos` de esa farmacia con `stock > 0` | Devuelve `items[]` con precio; 404 con sede desconocida | idem | HECHO |
| H2.S1.M6 | PR chico a `mockup`, mergeado; fila PUBLICADO en el daily | Justin e Itzan lo pueden importar | `git log origin/mockup -1` | **A MEDIAS** — código listo, PR sin abrir: mergear a la rama compartida `mockup` (de la que dependen sesiones en curso de Justin e Itzan) se dejó pendiente de confirmación explícita antes de tocar ese branch compartido. Ver REPORTE.md |

## H3 — Fixtures y coherencia del mock — ALTA
**CA:** Dado un producto, consultado por `/sites/:siteId/prices`, `/availability` y `POST /orders`, el precio es el mismo número en los tres; fixtures compilan contra los tipos.
**DoD:** `pharmacy.fixtures.ts` con tres constantes nuevas; `pharmacy.handlers.spec.ts` (nuevo) en verde.
**Estado:** A MEDIAS — H3.S2 (coherencia) HECHO; H3.S1 (fixtures `FARMACIA_DETALLE`/`PRECIOS_DE_SEDE`/`SEDES_CERCANAS`) TODO — no se llegó por priorizar H4-H6 (API real) según el orden que fija la propia ficha (§2: "H2 y H3 valen más que H6" — se prioriza H2, luego H4-H6 API por ser "el único trabajo de backend del turno", H3.S1 queda para el cierre)

### H3.S1 — Fixtures compartidas
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `FARMACIA_DETALLE`, `PRECIOS_DE_SEDE`, `SEDES_CERCANAS` | Compilan y coherentes (misma `siteId`) | `corepack yarn typecheck` | TODO |
| H3.S1.M2 | Publicar los nombres en §4-bis del daily | Justin e Itzan los ven | lectura | TODO |

### H3.S2 — Coherencia de precio en el mock
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | Leer arnés de `pharma-lab.handlers.spec.ts` / `community.handlers` | Spec registra `registrarFarmacia` en router de prueba | spec compila | HECHO |
| H3.S2.M2 | Caso: precio igual en `/sites/:siteId/prices`, `/availability`, `POST /orders` | Tres números iguales | `npx ng test --include='src/app/core/mock/handlers/pharmacy.handlers.spec.ts' --watch=false` → 7/7 | HECHO |
| H3.S2.M3 | Caso: `stock 0` no aparece; `requiresPrescription` viaja | Fijado | idem | HECHO |
| H3.S2.M4 | Caso: `/pharmacy/sites` ordena por distancia/nombre; `/products?pharmacyId` filtra | Fijado | idem | HECHO |

## H4 — `GET /pharmacy/sites` en la API real — ALTA (repo API)
Ver PLAN.md espejo en `mantra-core-health-api`. Microtareas H4.S1.M1-M5, criterio: sedes publicadas con Haversine, `lat` sin `lng` = 400, sin `@Roles`.
**Estado:** TODO (se ejecuta y se cierra en el repo API)

## H5 — `pharmacyId` en `GET /pharmacy/products` — ALTA (repo API)
Ver PLAN.md espejo en `mantra-core-health-api`. Microtareas H5.S1.M1-M3.
**Estado:** TODO

## H6 — Contrato cerrado (repo API)
Ver PLAN.md espejo en `mantra-core-health-api`. Microtareas H6.S1.M1-M3.
**Estado:** TODO

## H7 — Regresión y cierre
**CA:** Dado el turno, cuando se cierra, el front y la API están sin rojos nuevos, los PRs mergeables y el `REPORTE.md` tiene el avance en la primera línea.
**DoD:** salidas pegadas por repo; peldaño por área.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H7.S1.M1 | Regresión front: `typecheck`, `lint`, `test` de `core/data-access/pharmacy` y `core/mock` | Sin rojos nuevos | comandos pegados | TODO |
| H7.S1.M2 | Regresión API: `typecheck`, `lint --max-warnings=0`, `test src/modules/pharmacy` | Sin rojos nuevos | comandos pegados (repo API) | TODO |
| H7.S1.M3 | `REPORTE.md` y dailies al día; `git status` limpio en los dos; nada corriendo | Existe y cumple | `git status`; `ps` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Mock y API real no dicen lo mismo | Rompe el contrato de Justin/Itzan | Diff campo por campo en `evidencia/h2/campos.md` y `evidencia/h4/campos.md` antes de cerrar H2/H4 |
| CI self-hosted de la API apagado | H6 no puede demostrar checks verdes | Se corre todo local, se pega, y H6 queda `A MEDIAS` con la causa (Q-M5) |
| Levantar el stack Docker sin permiso | Viola instrucción explícita del propietario | Specs con `EntityManager` mockeado alcanzan; no se levanta Docker |
