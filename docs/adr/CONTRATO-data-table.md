# Contrato — `DataTable<Row>` (`app-data-table`)

> Escrito el 2026-09-22, carril `pablo/refactor-tabla-canonica`, sobre el corte
> `5a0776c66b005ad4d2d6722321e933cd7adea621`. No es una propuesta: **documenta el organismo tal
> como existe hoy**, leído completo (`data-table.ts` 315 líneas, `data-table.html` 170,
> `data-table.types.ts` 59, `data-table.spec.ts`). Sigue la tabla del §10 del documento maestro
> de refactorización frontend. Todo lo que sigue está citado con archivo y línea.

## Identidad

| Campo | Valor |
|---|---|
| Ruta | `src/app/shared/components/organisms/data-table/` |
| Símbolo exportado | `DataTable<Row>` |
| Selector | `app-data-table` (elemento) |
| Responsabilidad | Renderizar un listado de dominio: filas tipadas, columnas declaradas por el consumidor, orden, selección de página visible, expansión de detalle en móvil y paginación por cursor |
| Nivel atómico | Organismo |
| Ámbito | UI genérica — no conoce entidades, sesión ni políticas de negocio. El único acoplamiento a dominio es el genérico `Row` |
| Consumidores reales (medidos) | **29**, listados en la sección Compatibilidad |

## Entradas

| Nombre | Tipo | Obligatorio | Default | Línea |
|---|---|---|---|---|
| `state` | `ViewState<readonly Row[]>` | **sí** | — | `data-table.ts:95` |
| `columns` | `readonly ColumnDef<Row>[]` | **sí** | — | `data-table.ts:96` |
| `trackBy` | `(row: Row) => string` | **sí** | — | `data-table.ts:99` |
| `caption` | `string` | no | `''` | `data-table.ts:102` |
| `rowLabel` | `((row: Row) => string) \| null` | no | `null` | `data-table.ts:109` |
| `selectable` | `boolean` (`booleanAttribute`) | no | `false` | `data-table.ts:111` |
| `sort` | `SortState \| null` | no | `null` | `data-table.ts:112` |
| `cursor` | `CursorState` | no | `{}` | `data-table.ts:113` |
| `rowNavigable` | `boolean` (`booleanAttribute`) | no | `false` | `data-table.ts:132` |

**Sobre `state`**: es el mecanismo de estado del organismo. `DataTable` **no usa `ViewStateHost` como
envoltorio externo que el consumidor arma**: lo monta internamente (`data-table.html:2`,
`imports: [..., ViewStateHost]` en `data-table.ts:59`) y le delega el dibujo de los 9 estados del
M34. Un consumidor que pasa `[state]` a `DataTable` **ya está usando `ViewStateHost` por dentro** —
no hace falta envolver la tabla en un segundo host. Ésta es la corrección a una afirmación anterior
de este mismo carril, que en un borrador de reporte llegó a sugerir que a `admin/patients/patient-list`
"le faltaba `ViewStateHost`"; no le falta nada, usa el mecanismo correcto.

**Sobre `trackBy` como función**: es la identidad de fila del §12.3 del documento maestro. Sin ella,
`@for` no puede rastrear (`data-table.ts:98`). No hay valor por defecto ni fallback al índice: es
obligatorio a propósito.

**Sobre `rowLabel`**: el nombre accesible de la fila para lector de pantalla, nunca el id técnico
(`trackBy`), porque un uuid se deletrea entero (`data-table.ts:104-107`, probado en
`data-table.spec.ts:117-145`, incluido el caso límite de `rowLabel` que devuelve cadena vacía).

## Salidas

| Nombre | Payload | Se emite cuando | Se omite cuando | Línea |
|---|---|---|---|---|
| `sortChanged` | `SortState` | se hace clic en un encabezado ordenable | la columna no es `sortable` (`toggleSort` corta antes) | `data-table.ts:115,283-294` |
| `cursorChanged` | `string` (el cursor recibido, nunca un número de página) | se pulsa Anterior/Siguiente y ese cursor existe | el cursor correspondiente es `null`/`undefined` | `data-table.ts:116,296-308` |
| `selectionChanged` | `readonly Row[]` (las filas de **la página visible**) | se alterna una fila o «seleccionar todo» | — | `data-table.ts:117,251-264` |
| `rowActivated` | `Row` | se hace clic en la fila y `rowNavigable` está encendido | el clic nació en un control interactivo (`a, button, input, select, textarea, label, [role="button"]`) o fue el final de un arrastre de selección de texto | `data-table.ts:137,216-230` |
| `retry` | `void` | la persona pide reintentar desde el estado de error (S9) | — | `data-table.ts:148` — **reemitido desde `ViewStateHost`**, la tabla no dibuja su propio botón |
| `refresh` | `void` | la persona pide datos frescos desde el estado obsoleto (S7) | — | `data-table.ts:151` — ídem |

**Ninguna de estas seis emite una intención de negocio.** `sortChanged`/`cursorChanged` piden al
consumidor volver a pedir datos con otros parámetros; `selectionChanged` informa un estado de UI;
`rowActivated` es navegación, no persistencia; `retry`/`refresh` son reintentos de lectura. El
organismo nunca decide guardar, borrar ni mutar nada — coherente con el §3.1 del documento maestro.

## Funciones de entrada

| Función | Firma | Pureza | Estabilidad exigida |
|---|---|---|---|
| `trackBy` | `(row: Row) => string` | Pura: sólo lee la fila | **Debe ser estable entre renders** para la misma entidad — es la identidad de `@for` (`data-table.html:66`, `track rowKey(row)`) |
| `rowLabel` | `(row: Row) => string` | Pura | No necesita ser estable entre renders, sólo determinista para la misma fila |
| `ColumnDef.cell` (por columna) | `TemplateRef<{ $implicit: Row }>` | Se resuelve fuera del organismo | El organismo la usa vía `NgTemplateOutlet` (`data-table.html:87,121`); no le exige pureza porque no la invoca como función, la proyecta |

Ninguna es un callback de persistencia disfrazado de prop: las tres son funciones puras sobre una
fila, no operaciones de negocio.

## Composición

| Elemento | Obligatorio | Cardinalidad | Propiedad |
|---|---|---|---|
| `<thead>` con una fila de encabezados | Siempre, generado internamente | Una fila | El organismo la crea a partir de `columns()` |
| Columna de selección (`<th>`/`<td>` con `app-checkbox`) | Sólo si `selectable()` | 0 o 1 | El organismo la crea; el consumidor sólo enciende la bandera |
| `<tbody>` con una fila por elemento de `state().data` | Siempre | 0..N | El organismo la crea |
| Fila de detalle (`data-table__detail-row`) | Sólo si hay columnas secundarias (`priority >= MOBILE_DETAIL_PRIORITY`) y la fila está expandida | 0 o 1 por fila de datos | El organismo la crea |
| Celda de columna | Por cada `ColumnDef` declarado | 1 por columna por fila | **El consumidor aporta el contenido** vía `column.cell` (plantilla con contexto tipado `{ $implicit: Row }`) o, si no hay plantilla, el organismo muestra el valor crudo de `column.key` (`cellValue`, `data-table.ts:311-314`) |
| `<nav>` de paginación | Sólo si `hasPrevious() \|\| hasNext()` | 0 o 1 | El organismo la crea; **no se dibuja siempre** — un listado de una sola página no muestra botones muertos (`data-table.html:137-145`, decisión documentada en el propio comentario) |
| `ViewStateHost` | Siempre, envolviendo todo | 1 | El organismo lo monta; el consumidor no lo ve |

**Extensión**: por plantilla de celda tipada (`ColumnDef.cell`), la única vía que el organismo ofrece
para contenido dependiente de fila. No hay proyección libre (`ng-content`) de regiones internas del
organismo — coherente con el §8 del documento maestro: «no expongas todos los nodos internos como
slots».

## Estado

| Estado | Dueño | Transiciones | Se destruye |
|---|---|---|---|
| `overflowing` (signal privado) | El organismo | Lo actualiza un `ResizeObserver` sobre la caja de scroll y la tabla (`data-table.ts:76-92`) | Al destruir el componente (`onCleanup` del `effect`, línea 91) |
| `selectedRows` (signal privado) | El organismo, **acotado a la página visible** | `toggleRow`, `toggleAllVisible`; se emite por `selectionChanged` en cada cambio | No persiste entre páginas — con cursor no existe «todas las filas»; documentado en el propio código (`data-table.ts:153,260`) |
| `expandedRows` (signal privado, `Set<string>` por `trackBy`) | El organismo | `toggleDetail` agrega/quita la clave de fila | Se pierde al recrear el componente; no viaja entre páginas |
| `state`, `columns`, `sort`, `cursor` | **El consumidor**, vía inputs | El organismo sólo lee | El consumidor decide cuándo cambian |

**Ningún estado del organismo se sincroniza manualmente con una copia externa.** `selectedRows` se
deriva de la interacción, no de una prop; `overflowing` se deriva del DOM medido, no de un cálculo
duplicado en el consumidor. Coherente con el §5.1 del documento maestro.

## Apariencia

| Qué | Cómo |
|---|---|
| Estructura de tabla | `<table>` semántica real, con `<caption>` (oculto a la vista, accesible), `<thead>` y `scope="col"` — **no** `div role="table"` (`data-table.ts:41-43`) |
| Columna fija | `sticky: 'end'` en `ColumnDef`; sólo pinta fondo/sombra cuando algo pasa por debajo, para no dejar un rectángulo de otro tono en tema oscuro con una tabla que entra entera (`data-table.ts:69-75`) |
| Columnas de baja prioridad en móvil | **Se pliegan a una fila de detalle, nunca se ocultan** — el M34 prohíbe esconder información clínica (`data-table.ts:50-51`, probado en `data-table.spec.ts:354-369`) |
| Variantes | Ninguna variante visual con nombre de pantalla. El único parámetro visual por columna es `align` (`start`/`center`/`end`) y `sticky` |
| Tokens | El CSS del organismo (`data-table.css`, no auditado en este contrato) — fuera del alcance de esta lectura |

## Errores

| Caso | Cómo se distingue |
|---|---|
| Contrato inválido (p. ej. `trackBy` ausente) | Falla en compilación: son `input.required` (TypeScript lo exige) |
| El consumidor no declara `cell` para una columna | No es un error: se muestra el valor crudo con `String()` (`data-table.ts:311-314`) |
| Resultado remoto en error | Lo resuelve `ViewState` (S9), dibujado por `ViewStateHost`; la tabla no interpreta el error, sólo reemite `retry` |

## Compatibilidad

**29 consumidores reales**, medidos con `git grep -l '<app-data-table' HEAD -- 'src/app/**/*.html'`:

```
account/my-profile/practitioner-profile-edit · accounting · admin/clinical-forms ·
admin/medical-laboratory · admin/medical-organization · admin/organizations/organization-detail ·
admin/organizations/organization-list · admin/patients/patient-list · admin/services-catalog ·
admin/terminology/terminology-catalog · agenda · clinical-record · clinical-record/patient-chart ·
design-system-sample/organisms-gallery · diagnostics · health-context/context-resolve ·
identity-assurance/case-queue · identity-assurance/verification-cases · insurance/broker-detail ·
insurance/insurance-analytics · insurance/insurance-claims · interventions ·
organizations/my-organizations · pharma-lab/doctor-visits · pharma-lab/pharma-lab-home ·
pharma-lab/visitor-visits · progress-notes · quotations/quotation-form · quotations/quotation-list
```

Adopción de las entradas **opcionales**, medida (no todos los 29 las usan):

| Entrada opcional | Consumidores que la usan |
|---|---|
| `selectable` | 8 |
| `rowNavigable` | 3 |
| `sortable` en alguna columna (`sortChanged` escuchado) | 1 |
| `sticky: 'end'` en alguna columna | 1 |

**Veredicto:** el contrato de hoy sirve a los 29 sin extensión. No hay ningún caso medido que pida
algo que el organismo no ofrezca — no hace falta un adaptador temporal ni una versión nueva.

## Contrato de selección (§10.2)

- **Identidad**: por igualdad de referencia de `Row` (`Array.includes`, `data-table.ts:233,253-254`),
  no por `trackBy`. Esto es una limitación real: **dos objetos distintos que representan la misma
  fila (por ejemplo, tras recargar la página) no se reconocen como la misma selección.** No está
  documentado en el código como decisión consciente; se registra acá como hallazgo, no se corrige
  porque está fuera del alcance de este carril.
- **Alcance de la selección**: **por página visible**, nunca global — con cursor no existe «todas las
  filas» (el propio comentario de `data-table.ts:153` lo dice). «Seleccionar todo» selecciona sólo lo
  que está pintado (`toggleAllVisible`, línea 261-264).
- **Elementos deshabilitados**: el contrato **no tiene** un campo `disabled` por fila en `ColumnDef`
  ni en la selección. Cualquier fila visible es seleccionable.
- **Pérdida de un elemento seleccionado**: si `rows()` cambia (nueva página, nuevo filtro), la
  selección **no se recalcula contra las nuevas filas** — queda con las referencias viejas hasta que
  el consumidor la resetee. No hay lógica de limpieza automática en el organismo.
- **Cambio de filtro / respuesta atrasada**: el organismo no tiene noción de «filtro»: sólo pinta
  `state().data`. Si dos peticiones se resuelven fuera de orden, es responsabilidad del consumidor
  (con `httpResource`, `switchMap` u otro mecanismo) entregar sólo la vigente.

## Contrato de paginación (§10.2)

- **Por cursor, no por índice** — decisión explícita y documentada dos veces: en el comentario de
  cabecera del organismo (`data-table.ts:46-47`) y en el propio archivo de tipos
  (`data-table.types.ts:1-6`): *"un cursor no conoce el total, así que no hay números de página ni
  'última'"*. `CursorState` no tiene `total` a propósito (`data-table.types.ts:49-56`).
- Los botones **no se dibujan si no hay a dónde ir** (`data-table.html:146`), para no dejar controles
  muertos — probado en `data-table.spec.ts:286-291`.
- El cursor que se emite es **el que llegó del backend**, nunca un número inventado por el
  organismo (`data-table.ts:296-308`, probado en `data-table.spec.ts:302-321`).

## Verificación

| Qué detecta | Mecanismo |
|---|---|
| `trackBy`/`columns`/`state` ausentes | `typecheck` (son `input.required`) |
| Identidad rota / índice usado como clave | Revisión de código — no hay chequeo automático |
| Los 9 estados no se reimplementan | `data-table.spec.ts:174-221` |
| `rowLabel` vacío cae a la posición | `data-table.spec.ts:137-145` |
| Ordenar emite el código, no la etiqueta | `data-table.spec.ts:241-248` |
| Selección acotada a la página visible | `data-table.spec.ts:322-329` |
| Columnas secundarias van al detalle, no se ocultan | `data-table.spec.ts:354-369` |
| Paginación sin cursores no se dibuja | `data-table.spec.ts:286-291` |

## Lo que este contrato NO cubre

1. **El CSS** (`data-table.css`) no se auditó — queda fuera de esta lectura.
2. **La limitación de identidad por referencia** en la selección (arriba) es un hallazgo, no una
   corrección: ningún consumidor medido la sufre hoy, así que no se prioriza tocarla sin evidencia de
   impacto real.
3. **No se probaron los 29 consumidores uno por uno** contra este contrato — se citó el organismo tal
   como está escrito y probado en su propio spec, no se re-verificó cada integración.
