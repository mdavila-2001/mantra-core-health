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
