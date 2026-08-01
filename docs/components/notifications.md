# Notificaciones

Dos mecanismos distintos, y elegir mal entre ellos es el error más común.

| | `app-alert` | `app-toast` |
|---|---|---|
| Dónde vive | Dentro del contenido, junto a lo que describe | Superpuesto, esquina de la pantalla |
| Cuánto dura | Hasta que el estado cambie | Se desvanece solo |
| Para qué | El **estado** de algo que está en pantalla | El **resultado** de una acción que ya terminó |
| Ejemplo | «Revisá lo ingresado» sobre un formulario | «Perfil guardado» |

**Regla:** si la persona necesita el mensaje para decidir qué hacer ahora, es un
`alert`. Si es la confirmación de algo ya hecho, es un `toast`.

---

## `app-alert`

| Entrada | Tipo |
|---|---|
| `tone` | `success` · `warning` · `error` · `info` |
| `title` | `string` |
| `dismissible` | `boolean` |
| `icon` | `boolean` |

Salida: `dismissed`.

Ranura `[alert-actions]` para los controles, que es como `ViewStateHost` mete el
botón «Reintentar» dentro del aviso de S9.

**Es el mecanismo que usan las seis pantallas de autenticación** para mostrar
S4, S8 y S9 sin reemplazar el formulario. Ver
[el estado del login](../routes/auth-login.md#4--estados-de-interfaz).

## `app-toast` y `ToastService`

```ts
private readonly toasts = inject(ToastService);
this.toasts.show({ tone: 'success', message: 'Perfil guardado' });
```

| Pieza | Qué hace |
|---|---|
| `ToastService` | La cola. `providedIn: 'root'`, con prueba |
| `ToastContainer` | El ancla. Montado una vez en `app.html`, fuera del outlet |
| `Toast` | Un aviso |

### El ancla va fuera del `router-outlet`

```html
<router-outlet />
<app-toast-container />
```

> *«va una sola vez, fuera del outlet, para que sobreviva a los cambios de ruta y
> exista como región viva desde el primer render.»*

Dos razones, ambas necesarias:

1. **Sobrevive a la navegación.** Un aviso disparado justo antes de cambiar de
   ruta no debe desaparecer con la pantalla.
2. **La región viva existe antes del mensaje.** Una región viva creada *después*
   de que llegue el contenido no lo anuncia: los lectores de pantalla observan
   regiones que ya existían.

### El disparador de desarrollo está desmontado

`core/dev/toast-dev-panel/` existe pero **no está en ninguna plantilla**.
`app.html` explica por qué:

> *«se quitó de acá: aparecía encima de TODAS las pantallas en desarrollo,
> incluida una demostración. La vitrina ya tiene su sección de avisos (05), que
> es donde uno va a probarlos.»*

Sigue disponible para quien lo quiera montar. Es la causa de las 4 aristas de
`core/dev/ → shared/` que
[check-architecture](../architecture/frontend-layers.md#la-única-excepción-medida)
trata como excepción declarada.

## Accesibilidad de los avisos

| Aspecto | `alert` | `toast` |
|---|---|---|
| Región viva | Depende del contexto | Sí, en el contenedor |
| Urgencia | El de S4/S9 actúa como alerta | `polite` |
| Descartable con teclado | Sí, si `dismissible` | Sí |
| No depende solo del color | Sí: tono + ícono + título | Sí |

El `host` de `ViewStateHost` declara `aria-live="polite"` y el comentario matiza:
*«la urgencia la decide cada estado en su propio bloque (S4/S9 son assertive por
su rol de alerta)».*

### S4 mueve el foco al mensaje

```ts
effect(() => {
  const status = this.status();
  if (status !== 'validation' || !this.isBrowser) return;
  untracked(() => this.focusValidationMessage());
});
```

Con el motivo escrito: *«S4 mueve el foco al mensaje: la persona tiene que
corregir y el error puede haber aparecido lejos de donde estaba mirando. S2/S7 NO
lo mueven — robar el foco durante una carga es perder el lugar en la página.»*

**Las seis pantallas de autenticación NO hacen esto**, porque no usan
`ViewStateHost`: muestran un `app-alert` propio y el foco se queda donde estaba.
Es la inconsistencia de accesibilidad más repetida del proyecto, y está en
[la auditoría](../accessibility/audit-report.md).

## El identificador de soporte

S9 muestra el `requestId` **visible y copiable**:

```html
<p class="view-state-host__request-id">
  Código de soporte: <code class="tabular-nums">{{ fallo.requestId }}</code>
</p>
<button app-button size="sm" variant="outline" (clicked)="copyRequestId()">Copiar código</button>
```

Si el navegador no deja copiar (contexto no seguro), el id sigue visible y
seleccionable: *«copiar es comodidad, verlo es el requisito».*

## Lo que no hay

| Elemento | Estado |
|---|---|
| Centro de notificaciones persistente | No existe |
| Notificaciones push del navegador | No existe |
| Avisos con acción de deshacer | No existe |
| Agrupación de avisos repetidos | No existe |
| Sonido | No existe |
