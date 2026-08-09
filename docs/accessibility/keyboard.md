# Teclado

La estrategia es una sola: **usar el elemento nativo**. Casi todo el
comportamiento de teclado del proyecto viene de ahí y no de código propio.

---

## Los hosts nativos

Tres componentes usan selector de atributo para que el host **sea** el elemento
nativo:

| Selector | Host | Qué viene gratis |
|---|---|---|
| `button[app-button]` | `<button>` | Enter, Espacio, foco, participación en el `<form>` |
| `a[app-link]` | `<a>` | Enter, menú contextual, abrir en pestaña nueva |
| `header[app-header]` | `<header>` | Rol de banner |

> *«el host ES el `<button>` nativo, así la semántica, el teclado y los
> formularios vienen gratis.»*

Un `<div role="button">` exige reimplementar Enter, Espacio, el foco y la
participación en el formulario — y casi siempre se implementan solo dos de las
cuatro.

## `app-dialog` usa `<dialog>` nativo

```ts
/**
 * `showModal()` trae gratis el fondo, la inertización de lo que queda atrás,
 * la trampa de foco y el cierre con `Escape` — cuatro cosas que una capa
 * propia tendría que reimplementar.
 */
```

Y `Escape` **no se bloquea**:

> *«`Escape` lo maneja el navegador y dispara `cancel`: se lo escucha en vez de
> bloquearlo. Cerrar con Escape es cancelar, nunca confirmar.»*

El foco inicial depende de la destructividad:

```html
[attr.autofocus]="isDestructive() ? null : true"
```

En un diálogo destructivo el foco **no** cae sobre la acción destructiva: una
pulsación de Enter de más la ejecutaría.

## El deshabilitado sigue siendo enfocable

```ts
host: { '[attr.aria-disabled]': 'disabled()' }
```

`AppButton` usa `aria-disabled` y **no** el atributo nativo `disabled`:

> *«el botón sigue siendo enfocable —el lector de pantalla anuncia el estado en
> vez de hacer desaparecer el control— y el click se intercepta en
> `handleClick`.»*

Un botón con `disabled` nativo desaparece del orden de tabulación, y quien navega
con teclado no se entera de que existe ni de por qué no puede usarlo.

La intercepción es completa:

```ts
if (!this.isInteractive()) {
  event.preventDefault();
  event.stopPropagation();   // para que un type="submit" tampoco dispare el form
  return;
}
```

## El enlace de salto

Primer elemento focusable de la página, invisible hasta que recibe foco:

```html
<a class="shell__skip-link" [href]="'#' + mainContentId" (click)="skipToContent($event)">
  Saltar al contenido
</a>
```

> *«Sin esto, quien navega con teclado tabula por todo el menú en cada vista.»*

## El botón de menú se quita del árbol, no se oculta

Es el detalle de teclado más importante del proyecto y el menos evidente.

`app-shell` recibe `drawerMode` como **entrada**; quien mide es
`core/layout/breakpoints.ts`:

```ts
export const NAV_DRAWER_MAX_WIDTH = 780;
```

> *«el CSS decide cómo se ve el panel y esto decide si el encabezado ofrece el
> botón de hamburguesa. Son dos preguntas distintas sobre el mismo umbral, y una
> de las dos no se puede responder desde una hoja de estilos.»*

**Un botón oculto con `display: none` no está en el orden de tabulación, pero uno
oculto con `opacity: 0` o `visibility` mal usada sí.** Quitarlo del árbol es la
única forma que no depende de qué propiedad se eligió para esconderlo.

## Los menús no atrapan el foco

`app-menu` **no** usa `<dialog>`, a propósito: tabular fuera de un menú abierto es
un comportamiento legítimo. Atrapar el foco en un menú es un error frecuente que
acá no está.

## Interacciones de teclado por componente

| Componente | Teclas |
|---|---|
| `AppButton` | Enter, Espacio (nativas) |
| `Link` | Enter (nativa) |
| `Dialog` | Escape (nativa, = cancelar), Tab atrapado (nativo) |
| `Menu` | Escape cierra |
| `Chip` | `CHIP_REMOVE_KEYS` — las teclas de eliminación están **exportadas como constante**, así que la prueba usa la misma lista que el componente |
| `Tabs` | Flechas entre pestañas |
| `Accordion` | Enter/Espacio sobre el encabezado |
| `RadioGroup` | Flechas dentro del grupo (nativas del `<input type=radio>`) |
| `Tooltip` | Escape cierra; aparece con foco además de con hover |
| `DataTable` | Encabezados ordenables como `<button>` |

## Foco visible

```css
:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-ring);
}
```

Dos cosas bien hechas:

- **`:focus-visible`, no `:focus`.** El anillo aparece con teclado y no con clic
  de ratón, que es lo que la gente espera.
- **`outline: 2px solid transparent`.** Parece inútil y no lo es: en **modo de
  contraste forzado** (Windows) los colores se sustituyen y el `box-shadow`
  desaparece, pero el `outline` reaparece con el color del sistema. Sin esa línea,
  el foco sería invisible para quien más lo necesita.

El anillo mide 4 px y usa aguamarina en claro, menta en oscuro.

## Lo que no está verificado

| Comprobación | Estado |
|---|---|
| Recorrido completo con teclado en un navegador | **No ejecutado** |
| Orden de tabulación en las 8 pantallas | No verificado |
| Que no haya trampas de foco no intencionadas | No verificado |
| Atajos de teclado propios | No existen — nada que verificar |
| `accesskey` | No se usa |

**El comportamiento se deduce del código, no de la ejecución.** Es una limitación
declarada de esta auditoría.

## Guion de prueba manual

Sin herramienta automatizada, esto es lo que hay que hacer a mano:

```text
1. Tab desde la carga → el primer foco es «Saltar al contenido»
2. Enter en él → el foco cae en <main>
3. Tab por el formulario de login → identificador, contraseña, MFA, Entrar,
   «¿Olvidaste tu contraseña?», «Creá una con tu documento»
4. Enviar con Enter desde cualquier campo → envía
5. Con ancho < 780 px: Tab → el botón de menú aparece en el recorrido
   Con ancho ≥ 780 px: Tab → NO aparece (debe estar fuera del árbol)
6. Abrir un diálogo → el foco entra; Tab no sale; Escape cancela;
   al cerrar, el foco vuelve al disparador
7. Abrir un menú → Escape cierra; Tab SÍ sale (no debe atrapar)
8. Provocar un error de validación → el foco va al mensaje (solo con ViewStateHost)
```

El paso 8 revela la inconsistencia principal: **`ViewStateHost` mueve el foco al
mensaje en S4, y las seis pantallas de `auth/` no**, porque usan un `app-alert`
propio. Ver [gestión del foco](focus-management.md).
