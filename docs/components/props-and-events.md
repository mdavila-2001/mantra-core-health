# Entradas, salidas y modelos

Convenciones de API de los componentes. La lista exhaustiva está en
[el inventario generado](../reports/generated/component-inventory.md).

---

## Todo es señal

Ni un solo `@Input()` ni `@Output()` con decorador en el proyecto. Las tres
formas que se usan:

| Forma | Para qué | Ejemplo |
|---|---|---|
| `input<T>(valorPorDefecto)` | Entrada opcional | `readonly variant = input<ButtonVariant>('primary')` |
| `input.required<T>()` | Entrada obligatoria | `readonly state = input.required<ViewState<T>>()` |
| `output<T>()` | Salida | `readonly clicked = output<MouseEvent>()` |
| `model<T>(valor)` | Vínculo bidireccional | `readonly value = model('')` |

`model()` se usa **solo** donde el vínculo bidireccional es la semántica natural
del control: `Input.value`, `Checkbox.checked`, `Switch.checked`,
`Select.value`, `Textarea.value`, `Chip.selected`, `RadioGroup.value`,
`Tabs.selectedIndex`, `Pagination.page`/`pageSize`, `FileInput.files`,
`DatePicker.value`, `FormSection.expanded`, `AccordionPanel.expanded`,
`SearchField.value`.

## Nomenclatura

| Regla | Ejemplos | Contraejemplo |
|---|---|---|
| Entrada booleana en positivo | `disabled`, `removable`, `selectable`, `interactive` | `notDisabled` |
| Entrada booleana de estado en curso con `is` | `isLoading` | |
| Salida en **participio pasado**: el hecho ya ocurrió | `clicked`, `dismissed`, `removed`, `searched`, `resolved`, `activated` | `onClick` |
| Salida de petición con `Requested` | `closeRequested`, `logoutRequested` | |
| Salida de cambio con `Changed` | `sortChanged`, `tenantChanged`, `filtersChanged`, `cursorChanged`, `selectionChanged` | |

La distinción entre `closeRequested` y `closed` no es estética: **`Requested`
significa que el componente no lo hizo, lo pidió.** `app-side-nav` no se cierra
solo; avisa y el dueño decide. `app-menu`, en cambio, emite `closed` porque ya se
cerró.

Lo mismo en `ViewStateHost`:

> *«El organismo no reintenta solo: emite `retry`/`refresh` y el dueño de los
> datos decide.»*

## Transformaciones de entrada

Las entradas booleanas usan `booleanAttribute`, para que el atributo sin valor
funcione:

```ts
readonly disabled = input(false, { transform: booleanAttribute });
```

```html
<button app-button disabled>…</button>          <!-- funciona -->
<button app-button [disabled]="true">…</button> <!-- también -->
```

## Los tipos viven junto al componente

Cada componente con variantes tiene su `*.types.ts` al lado, y el barril del
nivel lo reexporta:

```ts
// atoms/index.ts
export { AppButton } from './button/button';
export { BUTTON_SIZES, BUTTON_VARIANTS } from './button/button.types';
export type { ButtonSize, ButtonType, ButtonVariant } from './button/button.types';
```

**Se exportan las constantes además de los tipos**, y eso importa: `BUTTON_SIZES`
es un array en tiempo de ejecución que la vitrina itera para exhibir todas las
variantes, y que una prueba puede recorrer para comprobarlas todas. Un tipo solo
no sirve para eso.

Consecuencia: **agregar una variante es agregarla en un solo lugar** y la vitrina
y las pruebas la recogen solas.

## Selectores de atributo cuando el host debe ser nativo

Tres componentes usan selector de atributo en vez de elemento:

| Selector | Host |
|---|---|
| `button[app-button]` | `<button>` nativo |
| `a[app-link]` | `<a>` nativo |
| `header[app-header]` | `<header>` nativo |

El motivo, escrito en `button.ts`: *«el host ES el `<button>` nativo, así la
semántica, el teclado y los formularios vienen gratis.»* Un `<div role="button">`
exige reimplementar Enter, Espacio, el foco y la participación en el formulario.

## `computed` para las clases

Ningún componente arma clases en la plantilla:

```ts
readonly buttonClasses = computed(() => {
  const classes = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];
  if (this.iconOnly()) classes.push('btn--icon-only');
  if (this.isLoading()) classes.push('btn--loading');
  if (this.disabled()) classes.push('btn--disabled');
  return classes.join(' ');
});
```

Y se aplica en el `host`, no en un elemento envolvente:

```ts
host: {
  '[class]': 'buttonClasses()',
  '[attr.type]': 'type()',
  '[attr.aria-disabled]': 'disabled()',
  '[attr.aria-busy]': 'isLoading()',
  '(click)': 'handleClick($event)',
}
```

Así no hay un `<span>` de más entre el `<button>` y su contenido.

## Cambios que rompen

Una entrada, una salida o un valor de una unión de variantes son **API pública**.
Cambiarlos exige el procedimiento de
[control de cambios](../governance/change-management.md), y con más razón en los
cuatro componentes de mayor centralidad:

| Componente | Importadores |
|---|---:|
| `AppButton` | 25 |
| `FORM_CONTROL_CONTEXT` | 19 |
| `Input` | 11 |
| `FormField` | 11 |

`node scripts/generate-inventory.mjs --check` falla si cambia la firma de
cualquier componente y el inventario no se regenera: el cambio se vuelve visible
en la revisión.

## Deprecación

**No hay ningún componente marcado como obsoleto hoy.** El procedimiento para
cuando lo haya está en [deprecación](deprecation.md).
