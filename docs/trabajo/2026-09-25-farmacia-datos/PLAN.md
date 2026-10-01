# PLAN — Carril A: Farmacia, datos y contrato real (front)

> Ficha: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Marcelo/Noche-Farmacia.DatosYContratoReal/ClienteMocksYEndpointsRealesDeFarmacia.md`
> Repo: `mantra-core-health` · Rama: `marcelo/feat-farmacia-cliente-y-mocks-2026-09-25` · Base: `origin/mockup @ bf2c35452363ede1d367f94c4fd726b2b9a63cb1`
> Plan aprobado por el usuario (turno noche 2026-09-25): `C:\Users\Usuario\.claude\plans\pasted-content-id-d35c-eres-el-hashed-sonnet.md`

## Decisiones que se apartan de la ficha (con evidencia)

1. **`curl` no puede llegar al mock**: es un `HttpInterceptorFn` (`mock-backend.interceptor.ts:44-55`); `ng serve` proxea `/pharmacy` a `localhost:3000` (`proxy.conf.json:79,104`) y el SSR sólo sirve estáticos. La evidencia sustituta es la salida impresa del spec del handler (`JSON.stringify`), capturada en `evidencia/h2/`.
2. **`GET /pharmacy/pharmacies/:id` en el mock devuelve TODAS las sedes de ese id**, no una: las 50 sucursales del corpus comparten `tenantId` por cadena (`bolivia-eje-central.ts:374-375`, 35 Farmacorp con el mismo id) — `FARMACIAS.filter`, no `.find`.
3. `PharmacyDetail` como interfaz de datos convive con la clase visual `features/public-directories/pharmacy-detail/PharmacyDetail`; son módulos distintos, no se renombra (el nombre lo fija el plan maestro §4.4), se avisa en el daily.

## H1 — Baseline (front)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar el corte y la rama | Un SHA y una rama en este PLAN.md | `git rev-parse HEAD` | HECHO — `bf2c35452363ede1d367f94c4fd726b2b9a63cb1` |
| H1.S1.M2 | Baseline: lint, typecheck, test de `pharmacy` | Salidas y exit codes en `evidencia/antes/front/` | `yarn lint`, `yarn typecheck`, `yarn test --watch=false --include='src/app/core/data-access/pharmacy/*.spec.ts'` | TODO |
| H1.S1.M4 | Clasificar cada rojo previo | Cada uno con su clase (`PRODUCT_BUG`/`TEST_BUG`/`ENVIRONMENT`/`DATA`/`EXTERNAL`) | Tabla abajo | TODO |

### Rojos previos clasificados
(se llena tras correr H1.S1.M2)

## H2 — Ola 0: tipos, cliente y mocks (BLOQUEANTE, primera hora)

**CA (hito):** Dado el plan §4.4, cuando Justin e Itzan llaman `getPharmacy(id)` y `getSitePrices(siteId)` desde `origin/mockup`, compilan, el mock responde y los campos son los del DTO real nombre por nombre.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | 4 tipos nuevos en `pharmacy.types.ts` calcados de `read-responses.dto.ts` | Cada campo existe en el DTO real con el mismo nombre | diff en `evidencia/h2/campos.md` | HECHO |
| H2.S1.M2 | `PharmacyClient.getPharmacy(id)` | Compila; spec | `yarn test --watch=false --include='.../pharmacy.client.spec.ts'` | HECHO — 10/10 |
| H2.S1.M3 | `PharmacyClient.getSitePrices(siteId, productId?)` sin clave `product` si no viene | Spec fija las dos formas | idem | HECHO |
| H2.S1.M4 | Mock `GET /pharmacy/pharmacies/:id` desde `FARMACIAS` (todas las sedes de ese id); 404 si no existe | Salida impresa trae `sites[0].latitude` | spec + `evidencia/h3/handlers-spec-11-11.txt` | HECHO — verificado vía pharmacy.handlers.spec.ts en vez del JSON planeado |
| H2.S1.M5 | Mock `GET /pharmacy/sites/:siteId/prices` desde `productos` con `stock>0` | Salida impresa trae `items[]` con precio real | spec + `evidencia/h3/handlers-spec-11-11.txt` | HECHO |
| H2.S1.M6 | PR a `mockup`, mergeado; fila PUBLICADO en el daily de equipo | Justin/Itzan lo pueden importar | PR #676, merge `963b7283` | HECHO — PR mergeado; fila del daily de equipo pendiente (no soy dueño de ese archivo, ver REPORTE) |

## H3 — Fixtures y coherencia del mock (ALTA)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `FARMACIA_DETALLE`, `PRECIOS_DE_SEDE`, `SEDES_CERCANAS` en `pharmacy.fixtures.ts` | Compilan y son coherentes (misma `siteId`) | `yarn typecheck` | HECHO |
| H3.S1.M2 | Publicar los 3 nombres en el daily | Justin/Itzan los ven | lectura | A MEDIAS — nombres documentados en este PLAN.md y en el PR #676; no se editó el daily de equipo (archivo de otra persona, ver REPORTE) |
| H3.S2.M1 | `pharmacy.handlers.spec.ts` nuevo, calcado de `pharma-lab.handlers.spec.ts` | Registra `registrarFarmacia` en `crearRouterSimulado()` | spec compila | HECHO |
| H3.S2.M2 | Precio igual en `/sites/:siteId/prices`, `/availability`, `POST /orders` → `lines[].unitPriceAmount` | 3 números iguales | `yarn test --watch=false --include='.../pharmacy.handlers.spec.ts'` | HECHO — los tres dan '30.50' |
| H3.S2.M3 | `stock 0` no aparece en `/prices` ni `/availability`; `requiresPrescription` viaja en `/prices` | Fijado | idem | HECHO |
| H3.S2.M4 | `/pharmacy/sites` ordena por distancia/nombre; `/products?pharmacyId` filtra | Fijado | idem | HECHO |

## H7 — Regresión y cierre (front)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H7.S1.M1 | Regresión: `typecheck`, `lint`, `test` de `core/data-access/pharmacy` y `core/mock` | Sin rojos nuevos | TODO |
| H7.S1.M3 | `REPORTE.md` al día; `git status` limpio; nada corriendo | — | TODO |

## Alcance

**IN:** los 4 tipos, 2 métodos de cliente, 2 mocks, 3 fixtures, `pharmacy.handlers.spec.ts`.
**OUT:** cualquier archivo fuera de los reservados de la ficha; pantallas (Justin/Itzan); carrito/cabecera (Pablo); `app.routes.ts`; el modelo/DDL/seeds.
