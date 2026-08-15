# Carril R2-6 · El glosario con etiquetas

**Punto del reclamo, textual:**

> GLOSARIO ESTA PESIMO, NADA DE LO QUE SE PIDIO TIENE, NO HAY ETIQUETAS NO HAY NADA DE NADA DE LO
> QUE SE PIDIO.

**Aclaración del cliente, agregada el mismo día:**

> NECESITO QUE EL GLOSARIO SE TRADUZCA A CASTELLANO. Y QUE RECALQUE QUE DEBE SER COMO SE DESCRIBIÓ
> CON ETIQUETAS, NO UNA TABLA SIMPLONA.

**Repos:** frontend + backend (la traducción y el listado por etiqueta tienen trabajo de API).
**Rama:** `carril-r2-6/glosario-etiquetas`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.

## Por qué rebotó: se entregó la puerta y no el glosario

La ronda anterior (Carril 2, punto 4) leyó el pedido como un problema de **permisos** —el
catálogo de terminología sólo lo veía `SECURITY_ADMIN`— y lo resolvió: abrió la sección a todos
los profesionales y le hizo una pantalla propia sin UUIDs a la vista. Eso está bien y se conserva.

Pero lo que quedó del otro lado de la puerta es **un campo de búsqueda sobre una tabla de dos
columnas**:

```ts
// glossary.ts:98-101
protected readonly columnas = computed(() => [
  { key: 'display',    header: 'Término',      priority: 1, cell: this.celdaTermino() },
  { key: 'definition', header: 'Qué significa', priority: 2 },
]);
```

Y en `glossary.html`: un `app-search-field`, un aviso de recorte a 50, la tabla, y una tarjeta de
ayuda. **Nada más.** El cliente dice «no hay etiquetas» y es literal: no hay ninguna.

Un glosario que exige saber la palabra antes de poder buscarla no es un glosario, es un
autocompletado. **Un glosario se hojea.**

## Las dos cosas que el cliente subrayó, y que definen si el carril está bien o mal

Están arriba de todo el resto. Si el PR no cumple estas dos, no importa lo demás:

1. **NO es una tabla.** El entregable no es `app-data-table` con una columna más ni con chips
   metidos en una celda. La tabla de dos columnas es *exactamente* lo que rebotó. Lo que va es
   una pantalla **navegable por etiquetas**: las categorías son la estructura de la pantalla, no
   un filtro colgado de un costado.
2. **Todo en castellano.** Términos, definiciones y nombres de las etiquetas. Un glosario médico
   que muestra `Hypertensive disorder` no es un glosario para quien atiende acá. Esto tiene
   trabajo de backend y de contenido, y está detallado abajo — **no es un problema de traducir
   los rótulos de la interfaz**, que ya están en castellano; es que los datos vienen en inglés.

## Qué significa «etiquetas» acá, y de dónde salen

De la terminología misma, no de un campo nuevo.

**Lo que el backend ya expone** (`src/modules/terminology/controllers/`):

| Endpoint | Dónde | Qué da |
|---|---|---|
| `GET /terminology/concepts?q=&ids=&codeSystemVersionId=&limit=` | `terminology-concepts.controller.ts:72` | Lo único que el glosario usa hoy. Búsqueda plana |
| `GET /terminology/value-sets` | `terminology-value-sets.controller.ts:90` | **El listado de conjuntos de valores — esto son las etiquetas** |
| `GET /terminology/value-sets/:id/$expand` | `terminology-value-sets.controller.ts:150` | Los conceptos de un conjunto. Ya tiene cliente: `readExpansion` (`terminology.client.ts:49`) |

Un *value set* es «alergias», «diagnósticos», «vías de administración», «unidades de medida»: es
exactamente la categoría bajo la cual un término tiene sentido. **La etiqueta ya existe en el
modelo; el glosario nunca la pidió.**

**El cliente del frontend tiene la mitad:** `readExpansion` (`:49`), `readAllOptions` (`:94`),
`readConceptLabels` (`:126`), `searchConcepts` (`:161`). **Le falta el listado de value sets** —
sin él no hay de dónde sacar la lista de etiquetas.

## El trabajo

### 1 · El método que falta en el cliente de terminología

`src/app/core/data-access/terminology/terminology.client.ts` — se agrega **al final**, sin tocar
los cuatro métodos existentes (archivo compartido, ver el README de carriles):

```
listValueSets()  → GET /terminology/value-sets
```

Tipos nuevos al final de `terminology.types.ts`. `ValueSetOption` (`:11-21`) **no se toca**: es el
shape que devuelve el backend y lo consume medio repo.

### 2 · La pantalla, rehecha

`src/app/features/glossary/glossary.ts` + `.html` + `.css` — se rehace la presentación. La
mecánica que ya está bien —búsqueda publicada en la URL con `replaceUrl` (`:114-122`), el aviso
honesto de recorte a 50 (`:89-96`), los dos vacíos distintos según haya o no filtro (`:148-162`)—
**se conserva entera**. Es correcta y tiene tests.

Lo que cambia — y lo primero es lo que el cliente subrayó:

- **Se va `app-data-table`.** El glosario deja de ser una tabla. Los términos se presentan como
  tarjetas o entradas de glosario —término, definición y sus etiquetas visibles en la propia
  entrada—, agrupadas bajo la categoría. Meter un chip dentro de una celda de la tabla actual
  **no cumple el punto**: sigue siendo la tabla que rebotó.
- **Se entra por las etiquetas, no por el buscador.** Al abrir, la pantalla muestra las
  categorías disponibles con su conteo. Sin escribir nada ya hay algo que mirar y por dónde
  entrar. Si al abrir el glosario sigue haciendo falta tipear para ver un término, el punto no
  está cumplido.
- **Cada término muestra sus etiquetas.** Un chip por categoría a la que pertenece, en su fila.
  `app-chip` ya existe (`shared/components/atoms/chip/`) y lo usa el perfil profesional.
- **La etiqueta filtra al hacerle clic**, y el filtro viaja en la URL junto a `q` — mismo criterio
  que ya tiene la búsqueda: un glosario filtrado por «alergias» se comparte por enlace.
- **El término se abre.** Hoy la definición vive apretada en una celda de tabla. Un panel o una
  ruta hija (`glossary/:conceptId`) con la definición completa, sus etiquetas, y sus sinónimos si
  el backend los publica.
- **Índice alfabético**, que es lo que un glosario tiene y esta pantalla no: saltar a una letra
  sin pasar por el buscador.

### 3 · El glosario en castellano

**El modelo ya contempla la traducción; el glosario no la pide y el catálogo puede no tenerla
cargada.** Los tres hechos, verificados:

- `terminology.concept_designations` (`entities/concept_designations.entity.ts`) guarda las
  denominaciones de un concepto por idioma: `languageConceptId` (`:24`) y
  `designationTypeConceptId` (`:31`).
- El DTO lo declara explícito: `DesignationLanguage = 'ES' | 'EN'` y
  `DesignationType = 'PREFERRED' | 'SYNONYM'` (`dto/create-designation.dto.ts:15-17`). O sea: el
  castellano es un idioma de primera clase del modelo, no un agregado.
- **Hay una lectura, y es una sola:** `GET /terminology/CodeSystem/$lookup?system=&code=`
  (`terminology-fhir.controller.ts:107`, UC-03-11) devuelve `LookupResponseDto` con su arreglo
  `designations[]` (`dto/concept-properties.dto.ts:104,192`). Resuelve **un concepto por
  llamada**.

**Y acá está el problema:** `GET /terminology/concepts?q=` —lo único que el glosario usa— devuelve
`ConceptSearchItemDto` con `conceptId`, `code`, `display`, `definition`, `selectable`,
`codeSystemVersionId` (`dto/search-concepts.dto.ts:4-45`). **No acepta parámetro de idioma y no
devuelve designaciones.** El `display` que se muestra es el del sistema de codificación, y en
SNOMED/LOINC ese texto está en inglés. Por eso el glosario se ve en inglés aunque la interfaz esté
en castellano.

**Las dos mitades del trabajo, y ninguna se puede saltear:**

**a) Que el dato en castellano exista.** Si los conceptos sembrados no tienen designación `ES`,
no hay nada que mostrar y ningún cambio de frontend lo arregla. Se verifica primero, contra la
base real. Si falta, se siembra: `src/common/seed/terminology-seed.service.ts` y
`module-concepts.ts` son el lugar, con el molde y el `README.md` que esa carpeta ya tiene, y con
la misma regla de idempotencia que el resto. **Es trabajo de contenido**, hermano del de R2-5:
alguien tiene que producir las traducciones, y las de terminología clínica no se improvisan —
priorizá las ediciones en español ya publicadas de cada sistema de codificación (SNOMED CT
edición española, LOINC en español, CIE-10-ES) y dejá registrada la fuente.

**b) Que la lectura las devuelva.** La ficha de un término puede resolverse hoy con `$lookup` —
una llamada, ya existe—. **El listado no**: pedir `$lookup` por cada uno de los 50 resultados es
inaceptable. Hace falta que `GET /terminology/concepts` acepte un idioma preferido y devuelva el
`display`/`definition` en esa lengua, cayendo al del sistema cuando no haya designación. Es un
cambio acotado en `terminology-concepts.controller.ts:72` y su service.

**Este carril lo pide y lo implementa** —el módulo `terminology` no lo toca ningún otro carril de
la ronda—, pero **antes de escribirlo se declara en `COORDINACION-AGENTES.md`**: es una lectura
compartida que consume medio frontend (`readConceptLabels` la usan agenda, perfil profesional,
diagnósticos y la ficha clínica), y agregarle un parámetro tiene que ser retrocompatible. **Sin
`lang`, el endpoint devuelve exactamente lo que devuelve hoy.**

### 4 · Lo que hay que verificar antes de prometer las etiquetas por término

Acá está el riesgo real del carril, y conviene resolverlo el primer día:

`GET /terminology/concepts` devuelve `ValueSetOption` y **no trae a qué value sets pertenece el
concepto** — mirá el tipo: `conceptId`, `code`, `display`, `definition`, `selectable`,
`codeSystemVersionId`, `ordinal` (`terminology.types.ts:11-21`). El camino existe pero al revés:
`$expand` va de value set → conceptos, y no hay concepto → value sets.

**Las dos salidas, en orden de preferencia:**

1. **Navegar por etiqueta**, que es lo que el cliente pidió: la pantalla lista los value sets,
   y al elegir uno expande sus conceptos con `readExpansion`, que ya existe. **Esto no necesita
   backend nuevo** y cumple el punto. Es el camino principal del carril.
2. Mostrar además **las etiquetas de cada término** en el resultado de una búsqueda por texto.
   Para eso hace falta el inverso, y hoy no existe. Si se confirma que el cliente lo quiere así,
   se pide `GET /terminology/concepts/:id/value-sets` (o un campo `valueSetIds` en el resultado de
   búsqueda) en el módulo `terminology`, y se declara como bloqueador en
   `COORDINACION-AGENTES.md` antes de comprometerlo.

**No se resuelve expandiendo todos los value sets en el cliente para armar el índice inverso a
mano.** Con un catálogo real eso son cientos de llamadas y una pantalla que tarda; si hace falta
el inverso, se pide bien.

Los conceptos además tienen `designations` (sinónimos), `relationships` y `properties`, pero los
tres endpoints son `@Post` (`terminology-concepts.controller.ts:126`, `:148`, `:170`): **no hay
lectura**. Si el glosario los quiere mostrar, es otro bloqueador de backend — verificalo antes de
diseñar la ficha del término.

## Archivos

**Backend** (`mantra-core-health-redesa-api`) — módulo `terminology`, exclusivo de este carril:

```
src/modules/terminology/controllers/terminology-concepts.controller.ts   (extender: idioma preferido)
src/modules/terminology/services/                                        (extender)
src/modules/terminology/dto/search-concepts.dto.ts                       (extender, retrocompatible)
src/common/seed/terminology-seed.service.ts · module-concepts.ts         (designaciones ES, si faltan)
```

**Frontend nuevos:**

```
src/app/features/glossary/glossary-term.ts + .html + .css + .spec.ts   (la ficha del término)
```

**Que tocás:** `src/app/features/glossary/glossary.ts` · `.html` · `.css` · `.spec.ts`;
`src/app/core/data-access/terminology/terminology.client.ts` y `.types.ts` (adiciones al final);
`src/app/app.routes.ts` sólo si la ficha del término es ruta hija y no panel.

`navigation.map.ts` **no se toca**: la sección `glossary` ya está donde tiene que estar
(`:147-154`, grupo Atención, sin roles) y eso fue justamente lo que sí se acertó la ronda pasada.

**Lo que NO tocás:** `features/admin/terminology/terminology-catalog.ts` —es la pantalla del
admin, sigue siendo suya—, `readExpansion`/`searchConcepts`/`readConceptLabels`, y todo
`features/redsat/`.

## Definición de hecho

Contra la frase del cliente, no contra el diff. Las dos primeras son las que él subrayó:

- **No hay ninguna tabla en el glosario.** `app-data-table` no aparece en `glossary.html`. La
  pantalla se hojea por etiquetas.
- **Todo se lee en castellano** — términos, definiciones y nombres de etiqueta. Se verifica
  entrando y mirando, no revisando que el parámetro se mande.
- Al abrir el glosario **hay etiquetas en pantalla**, con conteo, sin escribir nada.
- Un clic en una etiqueta muestra los términos de esa categoría, y el filtro se puede compartir
  por enlace.
- Cada término se puede abrir y leer completo, con sus etiquetas.
- Hay índice alfabético.
- `GET /terminology/concepts` **sin** parámetro de idioma devuelve exactamente lo que devolvía
  antes: ninguna de las pantallas que usan `readConceptLabels` cambia de comportamiento.
- Si un término no tiene traducción cargada, se muestra el original **y se nota que falta** — no
  se deja en blanco ni se inventa. Los que falten se listan en el PR.
- Si algo del pedido quedó afuera por el bloqueador del inverso concepto → value sets, **está
  dicho en el PR y declarado en `COORDINACION-AGENTES.md`**, no omitido.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend;
  `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
