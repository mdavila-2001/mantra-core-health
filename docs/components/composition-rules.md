# Reglas de composición

Cómo se combinan los componentes, y las cuatro reglas que el proyecto hace
cumplir.

---

## 1 · La dirección de las capas

```text
features/  →  shared/  →  core/
```

Nunca al revés. `shared/index.ts` lo declara sin matices:

> *«Regla inviolable: `shared/` NUNCA importa de `features/`. Si algo en shared
> necesita saber de un dominio, es que no pertenece a shared.»*

Y dentro de `shared/`, el atomic design impone su propia dirección:

```text
organismos  →  moléculas  →  átomos
```

Un átomo que importara una molécula ya no sería un átomo.

### La única excepción a las fronteras

`core/dev/` importa de `shared/` — 4 aristas sobre 587:

```text
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/button
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/toast.service
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/toast.types
core/dev/toast-samples.ts                   → shared/…/toast.types
```

Es una herramienta de desarrollo, está diferida y **no está montada en ninguna
pantalla**: `app.html` documenta que se desmontó porque *«aparecía encima de
TODAS las pantallas en desarrollo, incluida una demostración»*.

`scripts/check-architecture.mjs` la trata como excepción declarada y **falla si
aparece una violación fuera de `core/dev/`**.

## 2 · El contrato campo ↔ control

El defecto de accesibilidad más caro de un sistema de componentes es un
`<label for>` sin `id` al que apuntar: deja el control sin nombre accesible. Acá
se resuelve con un token de inyección.

```ts
export interface FormControlContext {
  readonly controlLabelable: WritableSignal<boolean>;  // el control lo declara
  readonly controlId: Signal<string>;                  // el campo lo genera
  readonly labelId: Signal<string>;
  readonly describedBy: Signal<string | null>;         // hint + error
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
}
```

**El campo conoce label, hint y error, así que es quien genera el `id` y el
`aria-describedby`. El control solo los consume.**

Diecinueve archivos lo importan: es el nodo de mayor centralidad después del
botón.

### Un control sin campo alrededor sigue funcionando

```ts
inject(FORM_CONTROL_CONTEXT, { optional: true })
```

Cae en su propio id. La composición es una mejora, no un requisito.

### `controlLabelable` — la sutileza que casi nadie ve

Un grupo de radios **no es «etiquetable»** en el sentido del HTML: el `for` de un
`<label>` no puede apuntarle. El control lo declara y el campo decide con eso si
emite `for` o si nombra el grupo con `aria-labelledby`.

### Los ids son estables entre servidor y cliente

```ts
let sequence = 0;
export function nextControlId(prefix: string): string {
  sequence += 1;
  return `mch-${prefix}-${sequence}`;
}
```

Servidor y cliente arrancan en 0 y avanzan en el mismo orden, así que los ids
coinciden y **la hidratación no rompe**. Un generador aleatorio los rompería.

## 3 · Los organismos reciben, no averiguan

`app-shell` es el caso canónico:

```html
<app-shell
  [user]="user()"
  [sections]="sections()"
  [tenants]="tenants()"
  [activeTenantId]="activeTenantId()"
  [drawerMode]="isDrawer()"
  (logoutRequested)="logout()"
  (tenantChanged)="changeTenant($event)"
/>
```

No inyecta `AuthService`, no inyecta `Router`, no mide la ventana. **Quien sabe
es `ShellLayout`**, que vive en `features/`. Así el organismo es probable sin
montar media aplicación, y el conocimiento del dominio vive en un solo lugar.

`drawerMode` es el ejemplo más claro: la decisión de si el nav es cajón o columna
depende del ancho, pero el shell no lo mide. Lo mide
`core/layout/breakpoints.ts` y se lo pasa el feature.

## 4 · La ranura por defecto solo puede existir una vez

Una restricción real de Angular con una consecuencia visible en
`ViewStateHost`: `ready` (camino feliz) y `stale` (S7) **comparten la rama
`@default`** de su `@switch`, y S7 no tiene su propio `@case`.

```html
@default {
  @if (staleState(); as viejo) {
    <app-alert tone="info" title="Estás viendo datos que pueden estar atrasados">…</app-alert>
  }
  <ng-content />
}
```

El comentario del código lo explica: *«el slot por defecto solo puede existir UNA
vez en toda la plantilla — con dos, Angular asigna el contenido a uno solo y el
otro queda vacío».*

Es el tipo de restricción que hay que saber antes de refactorizar ese archivo.

## 5 · Una ficha o un formulario que es lo único de su pantalla va centrado, a lo ancho y en UNA tarjeta con pestañas

**Regla de la casa, pedida por el cliente el 09/09/2026 a raíz de «Mi perfil»
del paciente.** Vale para toda pantalla nueva o retocada a partir de esa
fecha, y no admite «por ahora lo dejo así».

Lo que se vio: la ficha del paciente medía 762 px en un área de 1176 px,
pegada a la izquierda con 40 px de margen y **374 px en blanco a la
derecha**. El editor, además, estaba acotado a `44rem` y dibujaba tres
tarjetas apiladas. Dos causas, las dos comunes en el repositorio:

1. una rejilla de dos columnas —principal y lateral— que **reserva la columna
   lateral aunque no haya nada que poner en ella**;
2. un `max-inline-size` de «medida de formulario» sin `margin-inline: auto`,
   que en una pantalla ancha deja el formulario en la esquina.

La regla, en tres partes:

- **Centrado.** El bloque principal lleva `inline-size: 100%` y
  `margin-inline: auto`. Si una rejilla tiene un lateral condicional, la
  columna se quita con una clase cuando el lateral no se dibuja
  (`.mi-perfil--sin-lateral` es el ejemplo canónico). Nunca una columna vacía.
- **A lo ancho del área de contenido.** Sin topes propios de ancho: el tope lo
  pone `.app-main__inner` (1440 px) y nadie más. Lo que evita las casillas
  kilométricas no es acotar el formulario sino **repartir los campos en
  columnas** según el ancho: una en móvil, dos desde 780 px, tres desde
  1120 px.
- **Una tarjeta con pestañas.** Una ficha con varias secciones va en UNA
  `app-card` con `app-tabs`, no en tres tarjetas apiladas. Lectura y edición
  comparten las mismas pestañas, en el mismo orden y con el índice compartido:
  el lápiz abre el formulario en la pestaña que se estaba mirando
  (`PESTANAS_DEL_PERFIL`). Como `app-tab` no dibuja el panel cerrado, los
  valores del formulario viven en señales del componente, no en los controles.

Cómo se comprueba, con navegador y no a ojo: la holgura izquierda y la derecha
del bloque respecto de `.app-main__inner` difieren en ≤ 2 px, y el bloque
mide ≥ 85 % del área. `playwright/mi-perfil-paciente.mjs` lo mide así.

## El barril y las rutas profundas

`shared/index.ts` declara que **es** la API pública de `shared/`. En la práctica:

| Forma de importar | Archivos |
|---|---:|
| `from '@shared'` (el barril) | **0** |
| `from '@shared/…'` (alias, ruta profunda) | 21 |
| `from '../../shared/…'` (ruta relativa) | el resto |

**El contrato existe y no se está ejerciendo.** Hoy nada impide importar algo
interno de `shared/`, porque casi nadie pasa por la puerta que lo declararía.

No es un error —las rutas profundas compilan y funcionan— pero le quita al barril
su razón de ser. Tres opciones, ninguna ejecutada acá porque son cambios de
producto:

1. **Adoptarlo**: migrar los imports de features a `@shared` y añadir una regla
   de ESLint que prohíba `@shared/*` desde `features/`. Es lo que el barril pide.
2. **Reducirlo**: dejarlo solo para lo que de verdad es API pública y aceptar las
   rutas profundas para lo interno.
3. **Quitarlo**: si nadie lo usa, mantenerlo es deuda documental.

Registrado como brecha `MEDIUM` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

## Detección de cambios

**Todos los componentes son `OnPush`**, con una sola excepción: `App` (la raíz),
que usa la estrategia por defecto. No tiene entradas ni estado propio, así que la
diferencia es teórica.

Con señales en todas partes, `OnPush` es lo correcto y no exige disciplina extra:
las señales notifican al marcar.

## Cómo se verifica

```bash
node scripts/check-architecture.mjs
```

Tres comprobaciones sobre el grafo real:

1. **Ciclos** — debe haber cero.
2. **Dirección de las capas** — salvo las cuatro aristas de `core/dev/`.
3. **Superficie de red** — ningún `this.http` fuera de `core/data-access/`.
