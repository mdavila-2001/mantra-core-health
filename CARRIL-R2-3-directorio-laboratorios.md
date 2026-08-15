# Carril R2-3 · Laboratorios: pestaña propia, perfil detallado, categorías y datos de prueba

**Punto del reclamo, textual:**

> Datos de prueba de los laboratorios. Debe haber una pestaña de laboratorios detalladísimo su
> perfil de cada uno y a parte debe estar agrupado por CATEGORIAS.

**Repos:** backend + frontend. **Rama:** `carril-r2-3/directorio-laboratorios`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.
**Es el carril más grande de la ronda.** Si hay que priorizar, arranca por acá.

## Son tres pedidos en una frase

1. **Datos de prueba** — hoy no hay laboratorios cargados, así que cualquier pantalla que se
   construya se ve vacía.
2. **Pestaña de laboratorios con el perfil de cada uno «detalladísimo»** — el directorio de
   unidades diagnósticas: quién es, dónde está, qué equipos tiene, qué estudios ofrece, a qué
   precio, con qué acreditaciones.
3. **Agrupado por categorías** — la vista de entrada agrupa, no filtra.

Los tres son cosas distintas y las tres se entregan. Ninguna reemplaza a la otra.

## Lo que hay hoy, y el bloqueador de fondo

**El módulo existe y está modelado en serio.** `src/modules/diagnostic_units/entities/` tiene
diez entidades: `diagnostic_units`, `diagnostic_unit_sites`, `diagnostic_equipment`,
`diagnostic_study_offerings`, `diagnostic_study_components`, `diagnostic_price_schedules`,
`diagnostic_study_prices`, `diagnostic_unit_accreditations`, `diagnostic_unit_specialties`,
`diagnostic_unit_practitioner_assignments`. Eso es exactamente el «perfil detalladísimo» que el
cliente pide — está en la base, no en la pantalla.

**El bloqueador:**

```
grep -rn "@Get(" src/modules/diagnostic_units/controllers/    →  0 resultados
```

Los cinco controllers del módulo son **enteramente de escritura**:
`diagnostic-units.controller.ts` tiene nueve endpoints y los nueve son `@Post`/`@Put`
(`:59`, `:73`, `:86`, `:98`, `:111`, `:126`, `:139`, `:152`, `:165`);
`diagnostic-unit-sites.controller.ts` tiene un `@Patch` y un `@Post`;
`diagnostic-pricing.controller.ts`, dos `@Post` y un `@Delete`.

Se puede dar de alta un laboratorio entero —con sedes, equipos, ofertas, precios y
acreditaciones— y **no hay una sola lectura que lo devuelva**. Es el mismo defecto que ya tuvieron
agenda y diagnostics, documentado en `navigation.map.ts:127-132`: «veinte endpoints construidos,
ninguna lectura que dijera qué se le pidió a una persona ni qué volvió».

**Y no lo suple nada:** `core/data-access/diagnostics/diagnostics.client.ts` es de **órdenes**
—`getPatientDiagnostics` (`:68`), `listImagingStudies` (`:97`), `listWorkOrders` (`:119`),
`requestStudy` (`:138`)—, o sea los estudios pedidos a un paciente. No sabe nada de qué
laboratorios existen. La sección «Laboratorio e imagen» (`navigation.map.ts:119-136`) es esa cola
de trabajo, no un directorio.

## Backend · las lecturas que faltan

Módulo `diagnostic_units`, **exclusivo de este carril** — ningún otro carril de la ronda lo toca.

```
src/modules/diagnostic_units/controllers/diagnostic-units.controller.ts   (extender)
src/modules/diagnostic_units/services/                                    (extender)
src/modules/diagnostic_units/dto/                                         (DTOs de lectura nuevos)
```

- `GET /diagnostic-units` — listado paginado, filtrable por
  `diagnosticUnitTypeConceptId` (la categoría) y por especialidad. Devuelve lo que va en la fila:
  nombre, tipo, ciudad, estado de publicación.
- `GET /diagnostic-units/:id` — **el perfil detallado**. Es el endpoint central del carril y tiene
  que traer el agregado completo: sedes, equipos con su modalidad, especialidades, estudios
  ofrecidos, la lista de precios vigente y las acreditaciones. Un `GET` por hijo obligaría a la
  pantalla a hacer siete llamadas para dibujar una ficha; el pedido es «detalladísimo», así que la
  lectura viene armada.
- `GET /diagnostic-units/categories` — las categorías con su conteo, para que la pantalla agrupe
  sin traerse el catálogo entero.

**Roles:** el módulo exige `SECURITY_ADMIN` para toda la escritura. Las lecturas no deberían: un
clínico que pide un estudio necesita saber a qué laboratorio mandarlo. Seguí el criterio que
`billing.service_catalog` ya sentó en la ronda anterior (lectura abierta, escritura con rol) y
dejalo escrito en el PR.

### De dónde sale «categoría»

De la terminología, no de un enum nuevo. `diagnostic_units.entity.ts:53` tiene
`diagnosticUnitTypeConceptId` (obligatorio, FK → `terminology.catalog_concepts`) — **esa es la
categoría**. Los equipos y las ofertas de estudio tienen además `modalityConceptId`
(`diagnostic_equipment.entity.ts:53`, `diagnostic_study_offerings.entity.ts:47`), que es la
subdivisión de segundo nivel dentro de una unidad.

Los rótulos se resuelven contra terminología, igual que en el resto del repo: `readConceptLabels`
de `terminology.client.ts:179` en el frontend. **No hardcodees los nombres de categoría**, ni en
el front ni en el back.

Si el catálogo de conceptos no tiene todavía los tipos de unidad diagnóstica, se siembran (abajo)
— no se inventan como constantes.

## Backend · los datos de prueba

**Archivo nuevo:** `src/common/seed/diagnostic-units-seed.service.ts`, registrado en
`src/common/seed/seed.module.ts` (una línea al final del arreglo de providers, en el último
commit de la rama).

La infraestructura ya existe y tiene su propio `README.md` en `src/common/seed/`; seguí el molde
de `terminology-seed.service.ts` y `messaging-seed.service.ts`. **Ningún `INSERT` suelto, ningún
patch en `SQL/`** — ver la advertencia del README de carriles.

Qué sembrar, mínimo, para que las tres pantallas se vean con contenido real:

- Los **conceptos de tipo de unidad diagnóstica** en terminología, si no están: laboratorio
  clínico, diagnóstico por imagen, anatomía patológica, genética molecular, banco de sangre. Son
  las categorías que el cliente va a ver como encabezados.
- **Al menos tres unidades por categoría**, con nombre y ciudad verosímiles.
- Para **una unidad de cada categoría, el perfil completo**: dos sedes, equipos con modalidad,
  especialidades, media docena de estudios ofrecidos, una lista de precios vigente con sus
  precios, y una acreditación. Es la que se va a usar para demostrar el «detalladísimo».
- Las demás pueden quedar con el alta básica: sirven para que el agrupado por categorías tenga
  volumen.

El seed tiene que ser **idempotente** —correrlo dos veces no duplica— como los que ya están.

## Frontend

**Archivos nuevos:**

```
src/app/core/data-access/diagnostic-units/diagnostic-units.client.ts + .types.ts + .spec.ts
src/app/features/labs/labs-directory.ts   + .html + .css + .spec.ts
src/app/features/labs/lab-detail.ts       + .html + .css + .spec.ts
```

- `labs-directory` — la pestaña. **Agrupada por categoría de entrada**, con la categoría como
  encabezado y su conteo al lado. El buscador filtra sobre eso; no es la puerta de entrada.
- `lab-detail` — el perfil. «Detalladísimo» quiere decir que las seis dimensiones que el modelo
  tiene están en pantalla, cada una con su bloque: **identificación** (nombre, tipo, estado de
  verificación), **sedes** (con dirección y horario), **equipamiento** (con modalidad),
  **estudios ofrecidos** (agrupados por modalidad), **precios** (la lista vigente, con su fecha),
  **acreditaciones** (con vigencia). Cada bloque que el backend devuelva vacío se dice —«sin
  equipamiento registrado»—, no se esconde: un bloque ausente se lee como un dato que no cargó.
- Usá `app-tabs` (`shared/components/molecules/tabs/`) para las dimensiones del detalle si son
  muchas para una sola columna — ya lo hace `agenda.html:137`.

**Archivos existentes que tocás:**

| Archivo | Qué le agregás |
|---|---|
| `src/app/core/navigation/navigation.map.ts` | Una fila nueva al final del grupo **Atención**: `path: 'labs'`, label «Laboratorios», `module: 'M20 diagnostic_units'`. **Sin `roles`** si la lectura del backend quedó abierta — coherente con lo que decidas allá |
| `src/app/app.routes.ts` | La ruta de la sección y su hija `labs/:unitId` |
| `src/app/core/data-access/terminology/terminology.client.ts` | Sólo si necesitás un método nuevo para rótulos de categoría. Lo agregás al final; `readConceptLabels` y `searchConcepts` no se tocan |

**Es una sección aparte de «Laboratorio e imagen», no un tab adentro.** Aquélla responde «qué le
pedí a este paciente y qué volvió»; ésta, «qué laboratorios existen y qué hacen». Meterlas juntas
mezcla una cola de trabajo con un directorio, y es lo que hace tres rondas que el cliente no
encuentra lo que busca.

**Lo que NO tocás:** `features/diagnostics/` y `diagnostics.client.ts` (la cola de trabajo, está
bien y es de otro dominio), `src/modules/clinical/**` del backend, y ningún otro módulo.

## Definición de hecho

- Hay una **pestaña de laboratorios** en el menú, y al abrirla se ven laboratorios reales
  —sembrados— **agrupados por categoría**, sin escribir nada.
- Un clic abre un perfil donde están las **seis dimensiones**: sedes, equipamiento, estudios,
  precios, acreditaciones, identificación. Ninguna escondida.
- `yarn seed` (o el arranque con seed, según el molde de `src/common/seed/README.md`) deja la base
  con laboratorios en las cinco categorías, y correrlo dos veces no duplica nada.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend;
  `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration` en backend;
  `node scripts/check-route-prefixes.mjs` porque tocaste `navigation.map.ts` — y prestale
  atención: el prefijo `/diagnostic-units` de la API y una sección llamada `labs` no colisionan,
  pero si le cambiás el nombre a la sección, verificá.
