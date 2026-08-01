# `data-access/terminology`

Cliente de lectura del catálogo de terminología. Cubre una sola operación, que es
la única que esta aplicación necesita y puede ejercer:

```text
GET /terminology/value-sets/:id/$expand
```

Devuelve las opciones de un conjunto de valores —el `conceptId` que se manda de
vuelta, más `code` y `display` para pintarlas—, paginadas por cursor.

## Por qué sólo lectura

Las operaciones que **materializan** la expansión (`POST ValueSet/:id/$expand`) y
el alta de conjuntos exigen rol `SECURITY_ADMIN`. Ningún usuario de esta
aplicación lo tiene, así que envolverlas sería publicar una API que nadie puede
llamar. El `GET`, en cambio, no pide rol de administración a propósito: un campo
de formulario necesita su lista de opciones válidas.

## Tres cosas que conviene no descubrir a los golpes

**El cursor es opaco.** Se reenvía tal cual en `?cursor=` y no se interpreta. La
API no publica su forma justamente para poder cambiar las columnas de orden sin
romper a ningún cliente. Un cursor inventado a mano vuelve con 400.

**No hay total.** La respuesta trae `count` (lo de esta página) y `nextCursor`,
no un total de la expansión: contarlo exigiría una segunda pasada sobre la tabla
en cada página. Para «¿hay más?», mirar `nextCursor`; para la lista entera,
`readAllOptions`.

**No ramificar por `display`.** El código y el `conceptId` son valores estables
de la API; la etiqueta es metadato de presentación y puede cambiar sin aviso.

## Uso

```ts
private readonly terminology = inject(TerminologyClient);

// Lista completa, para un desplegable.
readonly generos = toSignal(this.terminology.readAllOptions(VS_GENERO), {
  initialValue: [],
});

// Página a página, si la lista es larga y se pagina en pantalla.
this.terminology.readExpansion(VS_GENERO, { limit: 50 }).subscribe((pagina) => {
  this.opciones.set(pagina.items);
  this.cursor.set(pagina.nextCursor);
});
```
