# Tablas

Un solo componente: `app-data-table`. Es el organismo más complejo del sistema y
el único preparado para listados grandes.

---

## `app-data-table`

`shared/components/organisms/data-table/` — con prueba.

| Entrada | Tipo | Para qué |
|---|---|---|
| `state` | `ViewState<T>` | La tabla pinta **sus propios estados**: carga, vacío, error |
| `columns` | definición de columnas | Qué se muestra y cómo |
| `trackBy` | función de identidad | Reconciliación de filas |
| `caption` | `string` | Nombre accesible de la tabla |
| `selectable` | `boolean` | Selección de filas |
| `sort` | estado de orden | Columna y dirección actuales |
| `cursor` | cursor de paginación | Posición en el listado |

| Salida | Cuándo |
|---|---|
| `sortChanged` | La persona cambia la columna o la dirección |
| `cursorChanged` | Pide la página siguiente o la anterior |
| `selectionChanged` | Cambia la selección |

## Recibe un `ViewState`, no un array

Es la decisión de diseño de este componente. En vez de recibir `rows: T[]` y
dejar que cada pantalla resuelva qué mostrar mientras no hay filas, recibe el
estado completo:

```html
<app-data-table [state]="pacientes()" [columns]="columnas" caption="Pacientes" />
```

Así la tabla vacía, la tabla cargando y la tabla en error se ven igual en todo el
proyecto, y ninguna pantalla los reimplementa.

## Pagina por cursor, no por número de página

```ts
readonly cursor = input<…>();
readonly cursorChanged = output<…>();
```

Es coherente con la API, que pagina por **cursor opaco**. El README de
`data-access/terminology` lo explica para su caso, y vale igual acá:

> *«No hay total. La respuesta trae `count` (lo de esta página) y `nextCursor`,
> no un total de la expansión: contarlo exigiría una segunda pasada sobre la
> tabla en cada página. Para "¿hay más?", mirar `nextCursor`.»*

**Consecuencia de producto:** no se puede mostrar «página 3 de 47» ni saltar a
una página concreta. Es una limitación del contrato, no del componente.

`app-pagination` sí trabaja con `totalItems` y números de página, y existe para
listados donde el total se conoce. Hoy **ninguna pantalla usa ninguno de los
dos**: no hay listados todavía.

## Accesibilidad

| Aspecto | Cómo |
|---|---|
| Nombre de la tabla | La entrada `caption` → `<caption>`, que es el elemento correcto |
| Encabezados de columna | `<th scope="col">` |
| Orden anunciado | `aria-sort` en el encabezado activo |
| Selección | Casillas con nombre accesible por fila |
| Datos numéricos alineados | La clase `.tabular-nums` de `styles.css` |

### `tabular-nums` importa más de lo que parece

```css
.cifras-tabulares, .tabular-nums { font-variant-numeric: tabular-nums; }
```

El comentario de `styles.css` dice para qué: *«datos clínicos: columnas de
resultados, dosis y rangos alinean por cifra».* Sin cifras tabulares, una columna
de dosis no alinea y comparar dos valores exige leerlos, no mirarlos. En un
sistema de salud eso es un riesgo de lectura, no una preferencia tipográfica.

## Cuándo NO usar `app-data-table`

| Caso | Qué usar |
|---|---|
| Pares clave–valor de un registro | `<dl>/<dt>/<dd>`, como hace el panel |
| Menos de cinco filas sin orden ni selección | Una lista o tarjetas |
| Contenido tabular de solo lectura sin estados | Una `<table>` con los estilos base |

Una tabla de datos trae orden, selección, cursor y estados. Si nada de eso hace
falta, es peso sin beneficio.

## Estado actual

**Ninguna pantalla monta una tabla de datos todavía.** El componente existe, está
probado y se exhibe en la vitrina, pero su primer consumidor real será la primera
sección de listado que se escriba.

Es el mismo patrón que en `core/data-access`: la infraestructura va por delante
de la interfaz. Ver
[el mapa de integraciones §3](../architecture/integration-map.md#3--operaciones-sin-consumidor).
