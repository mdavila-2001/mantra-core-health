# Reporte — P37: las sucursales de una farmacia y la receta entre ellas

> **AVANCE: 8 / 9 — 88,9 %.** La microtarea que falta (H2.S2.M1) tiene el código y sus pruebas de componente en verde; lo que le falta es la captura de navegador.

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (API y front)
- Peldaño de evidencia: API en `TESTED` (unitarios + HTTP + integración contra Postgres real); front en `TESTED`
  (Vitest dirigido). No se levantaron ni la API ni el front, así que no hay `VERIFIED` de punta a punta.
- Modelo: **sin cambios**. Toda la cadena ya estaba en el esquema (D-1).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `findPublicSites`: sólo sedes activas de la farmacia activa y verificada del tenant; una sucursal suspendida esconde su sede; el punto sale de la sucursal o, si no tiene, de la dirección | integración real | PASS — `evidencia/integracion-p37.txt` |
| H1.S1.M2 | `findInStockMatches`: sólo stock > 0 de ubicaciones activas, sin cruzar a otro tenant; un `%` se busca literal | integración real | PASS — ídem |
| H1.S2.M1 | Dominio puro: renglones limpios, coincidencia sin tildes, gana el más barato, total exacto o `null`, orden | `yarn test src/modules/public` | PASS — `evidencia/unit-public.txt` |
| H1.S2.M2 | `GET …/branches` y `POST …/branch-availability` con `@Public()`; responde 200 (no 201), 400 ante un cuerpo inválido y 404 ante una ficha de otro tipo; el `GET ?items=` ya no existe | `public-catalog.http.spec.ts` | PASS — ídem |
| H1.S3.M1 | Integración contra `mantra_p37` con datos sintéticos, incluidos los negativos: ficha oculta, de otro tipo o inexistente → 404; farmacia sin verificar → lista vacía | `yarn test:integration test/integration/p37-public-pharmacy-branches.int-spec.ts` | PASS 6/6 |
| H1.S3.M2 | README del módulo, `openapi.json/yaml`, `ENDPOINTS.md` y `endpoints/*.md` regenerados con las herramientas del repo | `yarn docs:openapi:generate` · `node tools/docs/generate-endpoint-markdown.mjs` | exit 0 — `evidencia/openapi-generate.txt` |
| H2.S1.M1 | Cliente por `POST` con cuerpo; la URL va sin parámetros | `public-catalog.client.spec.ts` | PASS |
| H2.S1.M2 | Simulador por `POST` con el mismo cuerpo y los mismos 400; suma exacta (antes era `Number` + `toFixed`); contrato del simulador regenerado desde el `openapi.json` | `catalogo-publico.spec.ts` | PASS |

## A medias

### H2.S2.M1 — La ficha con la forma de la API real
- Qué anda: la tarjeta no enlaza a la misma ficha cuando las sedes comparten slug; se ven la descripción y el
  enlace «Cómo llegar» (`enlace-chip`, `target=_blank`, `rel=noopener noreferrer`, `aria-label`), y el estado vacío
  trae una próxima acción («Ver otras farmacias»). Spec de componente en verde (`evidencia/front-vitest.txt`).
- Qué no anda: nada observado en rojo.
- Qué falta exactamente: capturas de `/pharmacies-directory/:slug` en tres viewports y dos temas, con la API real y
  con el simulador (`visual-quality-gate`), y la revisión independiente (`NO_SELF_APPROVAL`).
- Dónde quedó: `features/public-directories/pharmacy-detail/` del front, commit `86c9742a0`. Compila: el build de
  Vitest compila las plantillas.

## Pendiente

ninguna

## Evidencia

```text
$ yarn test src/modules/public src/architecture
Test Suites: 7 passed, 7 total
Tests:       73 passed, 73 total

$ DB_NAME=mantra_p37 … yarn test:integration test/integration/p37-public-pharmacy-branches.int-spec.ts
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total

$ yarn typecheck   (API)
TC_EXIT=0

$ npx eslint src/modules/public test/integration/p37-public-pharmacy-branches.int-spec.ts
LINT_OK

$ yarn docs:openapi:generate
OpenAPI generado: 1421 paths, 1567 operaciones, 1456 esquemas.

$ yarn ng test --include pharmacy-detail.spec.ts --include public-catalog.client.spec.ts --include catalogo-publico.spec.ts
 Test Files  3 passed (3)
      Tests  37 passed (37)

$ yarn eslint (archivos del front tocados)
EXIT=0

$ psql mantra_p37: residuo de la integración (tenants P37-*, perfiles p37-*)
0|0
```

Archivos: `evidencia/unit-public.txt`, `evidencia/integracion-p37.txt`, `evidencia/typecheck-api.txt`,
`evidencia/openapi-generate.txt`, `evidencia/front-vitest.txt`, `evidencia/residuo.txt`.

## No cubierto

- **Navegador**: no hay ninguna captura ni recorrido real de la ficha, ni con la API ni con el simulador. Por eso
  H2.S2.M1 queda `A MEDIAS`.
- **API levantada**: no se arrancó Nest contra la base. El HTTP se probó con la app de Nest real y una base doble;
  el SQL, contra la base real a través del servicio. El `@Throttle` de 60/min no se ejercitó.
- La integración corrió **antes** del `eslint --fix` del archivo de prueba (un cambio que sólo toca el formato), y no
  se volvió a correr después.
- No se corrieron las suites completas del front ni de la API: sólo lo dirigido y `src/architecture`.
- El `yarn typecheck` del front no se corrió aparte. Sí se corrió `yarn build` de producción (`BUILD_EXIT=0`) antes de
  empujar, por eso el empuje del front lleva `SALTAR_BUILD=1`: el gancho repetía la misma construcción sin el
  semáforo de memoria y se caía.
- No se midió el rendimiento con catálogos grandes (el filtro por renglón va en SQL, con un tope de 5000 filas
  producto×sede).

## Desvíos del plan

- En la integración, la farmacia sin verificar pasó a un tenant propio: `pharmacy.pharmacies` tiene
  `uq_pharmacies_tenant_id` (una farmacia por tenant), lo que de paso confirma D-1 (cadena = tenant).
- Se agregó una prueba del simulador (`catalogo-publico.spec.ts`) que no estaba prevista, para fijar el `POST` y sus 400.
- Los informes generados del front (`docs/reports/generated/*`) arrastraban deriva de otros trabajos (51 operaciones);
  no se regeneraron para no mezclar cambios. Sólo se tocó la fila correspondiente en `backend-api.md`.

## Riesgos residuales

- Al regenerar, también cambiaron `openapi/endpoints/practice.md` y `terminology.md`; es deriva previa del generador,
  no de P37.
- Una sede física cargada **sin** sucursal y sin dirección se lista igual, pero sin pin ni distancia.
- `isCurrent` sólo vale `true` cuando hay una única sucursal; el front ya no lo usa para decidir si enlaza.

## Decisiones y ambigüedades

Se tomaron sin consulta, como pide el brief: en cada caso, la opción más conservadora y reversible. Hay que
confirmarlas con el dueño de producto.

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| D-1 | Cadena = tenant dueño de la ficha; sucursales = `pharmacy_sites` activas de su farmacia verificada | El esquema ya lo modela (una farmacia por tenant; sede → sede física → `directory.branches`), y la cadena ya lo gestiona con `/tenants/:id/branches`, las sedes físicas y las sedes de farmacia | Seguir `parent_tenant_id`: publicaría sedes que la ficha no administra |
| D-2 | La receta viaja por `POST` en el cuerpo y no se guarda nada | Un renglón de receta es dato de salud; la URL queda en historiales, proxies y en el log de acceso (pino no registra el cuerpo) | `GET ?items=` (el del simulador y el que pedía el P), o un id de receta guardada (obliga a persistir datos de salud de un anónimo) |
| D-3 | Un renglón casa si el genérico, la marca, el medicamento, la concentración o la presentación lo **contienen**, sin tildes; si casan varios, gana el más barato con precio | Es lo que hacía el simulador y lo que espera quien escribe «paracetamol» | Coincidencia exacta o por id de producto (una receta de papel no los trae) |
| D-4 | Sin foto de la receta: se escribe a mano | Subir la imagen de una receta como anónimo es guardar datos de salud sin consentimiento ni dueño; además no hay OCR | Subida de imagen |
| D-5 | El punto sale primero de `directory.branches` y, si no hay, de `common.addresses`; `phone`, `openingHours` y `locationAccuracy` quedan en `null`; se agregan `description` y `locationUrl` (P54) | No hay columnas para esos tres datos, y no se inventan | Derivar el horario de la descripción |
| D-6 | El `slug` de cada sede es el de la ficha; `isCurrent` sólo con una sede; el front enlaza únicamente a otra ficha | Las sedes no tienen ficha propia | Crear una ficha pública por sede (cambio de modelo y de producto) |
| D-7 | `totalAmount` exacto; `null` si no hay nada, falta un precio o se mezclan monedas | Un total parcial sería un precio que miente (regla 91) | Sumar sólo lo que tenga precio |
| D-8 | Topes: 20 renglones de hasta 120 caracteres; 200 sedes; los repetidos se colapsan | Acota el abuso de una ruta pública sin sesión | Sin topes |
| D-9 | Sin sedes publicadas: lista vacía (no 404), y la pantalla lo dice con una próxima acción | La ficha existe; un 404 la confundiría con «no existe» | Devolver una sucursal ficticia armada con los datos del perfil |

P54 (descripción y enlace de ubicación) ya estaba en `dev`; P37 sólo lo lee. No se tocó el registro de farmacia (P50).
