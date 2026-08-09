# Diálogos, menús y capas flotantes

Cuatro componentes se superponen al contenido, y cada uno resuelve el foco de una
manera distinta según lo que sea.

| Componente | Elemento base | Trampa de foco | Cierra con `Escape` |
|---|---|---|---|
| `app-dialog` | `<dialog>` nativo con `showModal()` | **Sí, del navegador** | Sí, del navegador |
| `app-menu` | Capa propia | No (es un menú, no un modal) | Sí, propio |
| `app-tooltip` | `app-tooltip-panel` | No | Sí, propio |
| `app-toast` | Región viva en `app-toast-container` | No | — |

---

## `app-dialog` — el nativo, y por qué

Usa `<dialog>` con `showModal()`, y el motivo está escrito en el componente:

> *«`showModal()` trae gratis el fondo, la inertización de lo que queda atrás, la
> trampa de foco y el cierre con `Escape` — cuatro cosas que una capa propia
> tendría que reimplementar.»*

Reimplementar una trampa de foco correcta es de las cosas más difíciles de un
sistema de componentes: hay que recorrer los elementos enfocables, respetar
`tabindex`, manejar el ciclo, restaurar el foco al cerrar y volver inerte el
resto de la página. El navegador ya lo hace.

### `Escape` es cancelar, nunca confirmar

```ts
// Escape lo maneja el navegador y dispara `cancel`: se lo escucha en vez
// de bloquearlo. Cerrar con Escape es cancelar, nunca confirmar.
```

Y la salida lo refleja:

```ts
/** `true` confirmó; `false` canceló, cerró con Escape o clickeó el fondo. */
readonly resolved = output<boolean>();
```

Los tres caminos de salida no confirmada devuelven lo mismo. Es la respuesta
correcta: pulsar `Escape` no debe borrar nada.

### El foco inicial depende de la destructividad

```html
[attr.autofocus]="isDestructive() ? null : true"
```

En un diálogo normal, el foco arranca en la acción principal. **En uno
destructivo, no**: el foco no debe caer sobre «Eliminar», porque una pulsación de
Enter de más lo ejecutaría.

Es la clase de detalle que separa un diálogo correcto de uno peligroso.

### `DialogService`

Abre diálogos por código, sin declararlos en la plantilla. **No tiene prueba
propia** (`dialog-service.ts`), aunque `dialog.spec.ts` cubre el componente.

## `app-menu` — no es un modal

Un menú **no debe atrapar el foco**: tabular fuera de un menú abierto es un
comportamiento legítimo y esperado. Por eso `app-menu` no usa `<dialog>`.

Componentes: `app-menu`, `app-menu-trigger`, `app-menu-item`.

| Salida | Cuándo |
|---|---|
| `Menu.closed` | Ya se cerró |
| `MenuItem.selected` | Se eligió el ítem |

`MenuItem` tiene una entrada `destructive`, para que la acción peligrosa se
distinga visualmente dentro del menú.

## `app-tooltip`

`Tooltip` (la directiva de comportamiento) + `TooltipPanel` (la capa). El panel
**no se declara suelto en una plantilla**: es interno, y el barril de átomos lo
dice explícitamente.

Constantes exportadas, que son las que la vitrina y las pruebas recorren:

| Constante | Para qué |
|---|---|
| `TOOLTIP_POSITIONS` | Las posiciones válidas |
| `TOOLTIP_OPPOSITE` | La posición contraria, para el volteo cuando no entra |
| `TOOLTIP_GAP_PX` | Separación del ancla |
| `TOOLTIP_HOVER_DELAY_MS` | Retardo antes de aparecer |

Un tooltip que aparece al instante convierte cualquier paseo del ratón en una
sucesión de globos; el retardo es un requisito de usabilidad, no un adorno.

## `app-toast` — ver [notificaciones](notifications.md)

## El ancla de las capas

`app.html` monta `app-toast-container` **una sola vez, fuera del
`router-outlet`**:

```html
<router-outlet />
<app-toast-container />
```

> *«va una sola vez, fuera del outlet, para que sobreviva a los cambios de ruta y
> exista como región viva desde el primer render.»*

Una región viva que se crea *después* de que el mensaje llegue no lo anuncia:
tiene que existir antes.

## Reglas al añadir una capa nueva

1. **¿Es modal?** Usá `<dialog>` con `showModal()`. No reimplementes la trampa de
   foco.
2. **¿No es modal?** No atrapes el foco.
3. **`Escape` siempre cierra**, y cerrar nunca confirma.
4. **Al cerrar, el foco vuelve al disparador.** Es lo que `<dialog>` hace solo.
5. **Si anuncia algo**, la región viva tiene que existir antes del mensaje.
6. **Si es destructivo**, el foco inicial no va sobre la acción destructiva.

## Lo que no hay

| Elemento | Estado |
|---|---|
| CDK Overlay de Angular Material | No. No hay Material en el proyecto |
| Popover genérico (`popover` nativo) | No se usa |
| Hoja inferior (bottom sheet) | No existe |
| Panel lateral (drawer) de contenido | Solo el de navegación, dentro de `app-shell` |
| Apilamiento de diálogos | No contemplado |
