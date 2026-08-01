# Gestión del foco

Cuatro mecanismos correctos, y una inconsistencia que se repite en seis
pantallas.

---

## 1 · Foco tras navegar

`app-shell` lo resuelve para todas las rutas hijas:

```html
<main #main class="shell__main" [id]="mainContentId" tabindex="-1">
  <router-outlet />
</main>
```

```ts
private focusMain(): void {
  const main = …;
  main?.focus();
}
```

`tabindex="-1"` *«lo hace enfocable por script tras navegar sin meterlo en el
orden de tabulación»*.

Sin esto, al cambiar de ruta el foco se queda donde estaba —a veces en un enlace
del menú— y quien usa teclado tiene que volver a recorrer todo.

**Solo aplica a las rutas bajo `/`.** Las pantallas de `auth/` no están dentro del
shell y no tienen equivalente: al navegar del login al registro, el foco no se
mueve.

## 2 · Enlace de salto

Primer elemento focusable de la página, invisible hasta que recibe foco. Lleva el
foco al `<main>` con el mismo `focusMain()`.

## 3 · Trampa de foco en el diálogo

La del navegador, vía `<dialog>` con `showModal()`. Incluye la **restauración**:
al cerrar, el foco vuelve al elemento que lo abrió, sin una línea de código.

Y el foco inicial evita la acción destructiva:

```html
[attr.autofocus]="isDestructive() ? null : true"
```

## 4 · Foco al mensaje de validación

`ViewStateHost`, y solo él:

```ts
effect(() => {
  const status = this.status();
  if (status !== 'validation' || !this.isBrowser) return;
  untracked(() => this.focusValidationMessage());
});

private focusValidationMessage(): void {
  queueMicrotask(() => {
    const alerta = this.hostElement.nativeElement.querySelector<HTMLElement>('.view-state-host__validation');
    alerta?.setAttribute('tabindex', '-1');
    alerta?.focus();
  });
}
```

Tres decisiones correctas en diez líneas:

| Decisión | Por qué |
|---|---|
| **Solo S4** | *«S2/S7 NO lo mueven — robar el foco durante una carga es perder el lugar en la página.»* |
| `queueMicrotask` | *«El alert de S4 todavía no está pintado cuando el effect corre: el microtask alcanza porque el render síncrono ya pasó.»* |
| `untracked` | Evita que la lectura del DOM se registre como dependencia del efecto |
| `isBrowser` | El servidor no tiene foco que mover |

El motivo de mover el foco en S4: *«la persona tiene que corregir y el error puede
haber aparecido lejos de donde estaba mirando».*

---

## La inconsistencia

**Las seis pantallas de `auth/` no usan `ViewStateHost`.** Muestran un `app-alert`
propio, porque el formulario tiene que seguir visible y utilizable — lo cual es
correcto — pero eso significa que **no heredan nada de la gestión de foco**.

| Situación | `ViewStateHost` | Pantallas de `auth/` |
|---|---|---|
| Aparece un error de validación | Foco al mensaje | **El foco no se mueve** |
| Cambia el estado | `aria-live="polite"` en el host | **No hay región viva** |
| Aparece una confirmación que reemplaza el formulario | — | **El foco no se mueve** |

Las tres afectan a las mismas pantallas:

| Pantalla | Qué se pierde |
|---|---|
| Login | El error de credenciales puede no anunciarse |
| Registro | El error y **la confirmación de alta** |
| Recuperar | **El acuse**, que es toda la respuesta que recibe la persona |
| Nueva contraseña | El error y la confirmación con `revokedSessions` |
| Verificar correo | La transición de «verificando» a «verificado» |
| Elegir organización | El estado vacío no se anuncia |

**El caso más grave es `/auth/recuperar`**: el acuse *es* la respuesta completa, y
quien use lector de pantalla puede quedarse esperando algo que ya pasó.

### Por qué no se corrige acá

Es un cambio de producto: toca seis componentes y su comportamiento observable.
Registrado como brecha `MEDIUM` (una `HIGH` para el acuse de recuperación) en
[el informe de auditoría](audit-report.md) y en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

**La propuesta**, para cuando se autorice: un componente pequeño —o una directiva—
que envuelva el `app-alert` de esas pantallas y replique las dos reglas que
`ViewStateHost` ya tiene (región viva + foco en S4). No hay que reescribirlas: hay
que extraer lo que el organismo ya sabe hacer.

---

## Ids estables, o el foco no sobrevive a la hidratación

```ts
let sequence = 0;
export function nextControlId(prefix: string): string {
  sequence += 1;
  return `mch-${prefix}-${sequence}`;
}
```

> *«Server y cliente arrancan en 0 y avanzan en el mismo orden, así que los ids
> coinciden y la hidratación no rompe.»*

Con ids aleatorios, el `for` del label apuntaría a un id que ya no existe tras
hidratar, y `aria-describedby` quedaría colgado.

## Lo que no hay

| Elemento | Estado |
|---|---|
| Restauración de foco al volver atrás en el historial | No |
| Foco tras eliminar un elemento de una lista | No aplica: no hay listas |
| Anillo de foco propio por componente | No: el global de `:focus-visible` |
| Verificación automática del orden de tabulación | No existe |
| `inert` en secciones desactivadas | Solo el que `<dialog>` aplica solo |
