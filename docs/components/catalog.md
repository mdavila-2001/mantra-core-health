# Catálogo de componentes

49 componentes en `shared/`, más 11 de `features/`, 1 de `core/dev/` y la raíz.
La tabla exhaustiva con selectores, entradas, salidas y estado de prueba se
regenera desde el código:

**→ [Inventario de componentes generado](../reports/generated/component-inventory.md)**

Esta página explica el catálogo; aquélla lo enumera.

---

## Cómo está organizado

| Nivel | Qué es | Cuántos | Ejemplos |
|---|---|---:|---|
| **Átomos** | Un control, sin dominio | 16 | `app-button`, `app-input`, `app-badge`, `app-skeleton` |
| **Moléculas** | Composición con comportamiento propio | 20 | `app-form-field`, `app-dialog`, `app-tabs`, `app-toast` |
| **Organismos** | Estructura de pantalla o control complejo | 16 | `app-shell`, `app-data-table`, `app-view-state-host`, `app-directory-page` |

El nivel **se deduce de la carpeta**, no se declara en el código. Mover una
carpeta es reclasificar.

## Los cinco componentes que hay que conocer

Si solo vas a leer cinco fichas, que sean éstas.

### `button[app-button]` — 25 importadores

Selector de **atributo**: el host *es* el `<button>` nativo, así que la
semántica, el teclado y los formularios vienen gratis.

```html
<button app-button variant="danger" size="sm" (clicked)="borrar()">Eliminar cuenta</button>
<button app-button iconOnly variant="neutral" aria-label="Notificaciones"><svg …></svg></button>
```

| Entrada | Tipo | Por defecto |
|---|---|---|
| `variant` | `ButtonVariant` | `'primary'` |
| `size` | `ButtonSize` | `'md'` |
| `isLoading` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `type` | `ButtonType` | `'button'` |
| `iconOnly` | `boolean` | `false` |

Salida: `clicked: MouseEvent`.

Si la acción **navega**, va sobre un ancla: `a[app-button]` (misma pinta, misma
hoja de estilos, semántica de enlace). Un `<button>` que hace
`router.navigateByUrl` pierde el clic con la rueda, «abrir en pestaña nueva» y
el destino en la barra de estado.

```html
<a app-button variant="primary" routerLink="/pacientes/nuevo">Nuevo paciente</a>
```

**El deshabilitado es `aria-disabled`, no el atributo nativo.** El botón sigue
siendo enfocable —el lector anuncia el estado en vez de hacer desaparecer el
control— y el clic se intercepta:

```ts
if (!this.isInteractive()) {
  event.preventDefault();
  event.stopPropagation();   // para que un type="submit" tampoco dispare el form
  return;
}
```

En modo `iconOnly` **avisa por consola si falta el nombre accesible**, y solo en
desarrollo: en producción no cuesta nada.

### `app-form-field` — 11 importadores

El campo: label, hint y error alrededor de un control. Es quien **genera el `id`
y la lista de `aria-describedby`**; el control solo los consume.

| Entrada | Tipo |
|---|---|
| `label` | `string` |
| `hint` | `string` |
| `errorMessage` | `string` |
| `required` | `boolean` |

Ver [el contrato de formularios](forms.md).

### `app-view-state-host` — el organismo que evita 81 repeticiones

Recibe un `ViewState<T>` y pinta el estado que corresponda. Cada sección envuelve
su contenido y se olvida de qué mostrar cuando el dato no está.

```html
<app-view-state-host [state]="pacientes()" (retry)="recargar()" (refresh)="recargar()">
  <div vsh-skeleton><app-skeleton variant="text" [lines]="5" /></div>
  <tabla [filas]="filas()" />
</app-view-state-host>
```

Ranuras de sustitución, una por estado: `[vsh-auth-pending]`, `[vsh-skeleton]`,
`[vsh-empty]`, `[vsh-validation]`, `[vsh-forbidden]`, `[vsh-not-found]`,
`[vsh-offline]`, `[vsh-error]`, `[vsh-stale]`. Cada una tiene un valor por
defecto sensato.

Ver [su ficha completa](../data-and-state/server-state.md#el-organismo-que-pinta-los-estados).

### `app-shell` — el armazón

Recibe usuario, secciones, organizaciones y el modo de navegación. **No conoce
rutas ni sesión**: los recibe y los reparte. Quien sabe es `ShellLayout`.

Resuelve tres cosas de accesibilidad una sola vez para todas las pantallas:

1. **Enlace de salto** como primer elemento focusable.
2. **Anuncio de cambio de ruta** en un `<output aria-live="polite">` — cambiar
   de ruta sin recargar no dispara ningún anuncio del navegador.
3. **Foco al `<main>`** tras navegar, con `tabindex="-1"` para que sea enfocable
   por script sin entrar en el orden de tabulación.

`drawerMode` **es una entrada**: el shell no mide la ventana. Lo hace
`core/layout/breakpoints.ts` y se lo pasa `ShellLayout`.

### `app-data-table` — el organismo más complejo

| Entrada | Para qué |
|---|---|
| `state` | Un `ViewState` — la tabla pinta sus propios estados |
| `columns` | Definición de columnas |
| `trackBy` | Identidad de fila |
| `caption` | Nombre accesible de la tabla |
| `selectable`, `sort`, `cursor` | Selección, orden y paginación por cursor |

Salidas: `sortChanged`, `cursorChanged`, `selectionChanged`.

Que reciba `cursor` y no `page` es coherente con la API, que pagina por cursor
opaco. Ver [tablas](tables.md).

### `app-directory-page` — la anatomía común de los cuatro directorios

| Entrada | Para qué |
|---|---|
| `titulo`, `subtitulo` | El `page-header`. El subtítulo es **obligatorio**: es donde la sección se explica (K3) |
| `filtros` | Los `FilterDef` de la barra, con chips o desplegables |
| `etiquetaBusqueda` | El rótulo del campo de texto |
| `estado` | Un `ViewState` — la página pinta sus propios estados |
| `grupos` | Los tramos, cada uno con su rótulo y sus resultados |
| `sustantivo` | Singular y plural de lo que lista, para contarlo en castellano |
| `aviso` | Un aviso sobre el listado, si hace falta |
| `textoSinCoincidencias` | Qué decir cuando el filtro no dejó a nadie. `null` = no es ese caso |

Salidas: `filtrosCambiaron`, `reintentar`.

Existe porque el cliente pidió cuatro directorios —médicos, laboratorios,
clínicas, farmacias— con la misma pinta, y había dos escritos a mano que ya
diferían: uno con `filter-bar` y otro con un `search-field` suelto, uno con
contador y el otro con un aviso, los dos con listas planas donde el diseño pedía
grillas. Con cuatro pantallas a mano, la quinta corrección de diseño se aplica a
dos y media.

**No pide datos ni filtra.** Recibe el estado resuelto y los grupos armados;
cada directorio sabe si su filtrado es del servidor o en memoria, y eso no se
puede unificar sin empeorar a alguno.

Las tarjetas son `app-result-card`, que es el hermano vertical de
`app-search-result`: **mismo tipo de dato, distinta forma**. Es un componente
aparte y no una variante porque `search-result` no tiene CSS propio a propósito
—su diseño vive en `redsat.css`, que se recopia entero desde la bóveda— y una
variante escrita ahí desaparecería en la primera recopia.

## Componentes sin prueba propia

Diez, y la mayoría por una razón buena:

| Componente | Motivo |
|---|---|
| `TooltipPanel` | Interno del tooltip: no se declara suelto en una plantilla |
| `AccordionPanel` | Solo existe dentro de `Accordion` |
| `MenuItem` | Solo dentro de `Menu` |
| `Radio` | Solo dentro de `RadioGroup` |
| `Tab` | Solo dentro de `Tabs` |
| `ToastContainer` | Envoltorio de `Toast`, que sí está probado |
| `ToastDevPanel` | Herramienta de desarrollo |
| `OrganismsGallery` | Vitrina, excluida de cobertura a propósito |
| **`Dashboard`** | **La única pantalla autenticada.** Brecha `HIGH` |
| **`ShellLayout`** | **El layout de todo lo autenticado.** Brecha `HIGH` |

Los cinco primeros quedan ejercitados por la prueba de su padre, y por eso la
cobertura de `shared/` es del 94 %. Las dos últimas son otra cosa: ver
[la estrategia de pruebas](../testing/strategy.md).

## Qué NO hay en el catálogo

| Componente esperable | Estado |
|---|---|
| Tooltip enriquecido / popover genérico | Solo `app-tooltip`, de texto |
| Selector de archivos con arrastrar y soltar | `app-file-input` es de clic |
| Editor de texto enriquecido | No |
| Gráficos | No |
| Calendario de eventos | Hay `app-date-picker`, no calendario |
| Árbol / jerarquía | No |
| Carga infinita | No. Hay `app-pagination` y cursor en la tabla |
| Migas de pan automáticas | `app-breadcrumb` existe pero recibe los ítems: no los deduce de la ruta |

## Cómo se mantiene vigente

```bash
node scripts/generate-inventory.mjs --check   # falla si se agregó un componente y el inventario no lo refleja
node scripts/check-doc-coverage.mjs           # falla si un organismo no está documentado
```
