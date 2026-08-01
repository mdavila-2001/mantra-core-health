# Formularios y errores accesibles

El punto más fuerte del proyecto y su hueco más repetido, en la misma página.

---

## Lo que el contrato garantiza

`FORM_CONTROL_CONTEXT` — 19 importadores. Todo control envuelto en un
`app-form-field` recibe:

```ts
export interface FormControlContext {
  readonly controlLabelable: WritableSignal<boolean>;  // ¿admite <label for>?
  readonly controlId: Signal<string>;                  // el id del control
  readonly labelId: Signal<string>;                    // el id del <label>
  readonly describedBy: Signal<string | null>;         // hint + error
  readonly invalid: Signal<boolean>;                   // → aria-invalid
  readonly required: Signal<boolean>;                  // → aria-required
}
```

**El campo genera, el control consume.** Es lo que hace imposible el defecto más
común: un `<label>` que no apunta a nada.

### Los tres casos que resuelve

| Caso | Cómo |
|---|---|
| `<input>`, `<select>`, `<textarea>` | `<label for="controlId">` |
| Grupo de radios | `aria-labelledby="labelId"` — el `for` no puede apuntarle |
| Control sin campo alrededor | `inject(…, { optional: true })` → cae en su propio id |

### Los ids no rompen la hidratación

Contador incremental compartido entre servidor y cliente. Con ids aleatorios, el
`for` apuntaría a un id inexistente tras hidratar.

## Mensajes de error

```html
<app-form-field
  label="Correo o documento"
  [required]="true"
  [errorMessage]="
    form.controls.identifier.touched && form.controls.identifier.invalid
      ? 'Ingresá tu correo o tu documento.'
      : ''
  "
>
```

| Propiedad | Estado |
|---|---|
| El error entra en `aria-describedby` | ✅ vía `describedBy` |
| El control se marca `aria-invalid` | ✅ vía `invalid` |
| El error se muestra **junto al campo** | ✅ |
| El error **no depende solo del color** | ✅ hay texto |
| El error aparece solo si `touched` | ✅ no acusa antes de tiempo |
| `markAllAsTouched()` al enviar | ✅ revela todos de una vez |
| `novalidate` en el `<form>` | ✅ la validación es de la aplicación |

Siete de siete. Es una implementación correcta de WCAG 3.3.1 y 3.3.2.

## `autocomplete`

| Campo | Valor |
|---|---|
| Identificador de login | `username` |
| Contraseña de login | `current-password` |
| Código MFA | `one-time-code` |
| Contraseña nueva | `new-password` |

**Los cuatro correctos.** Es WCAG 2.2 §3.3.7 (Entrada redundante) y de las cosas
que más se olvidan.

`username` sirve para correo y para documento: *«es el campo con el que se entra,
sea cual sea su forma»*.

## El hueco: el error general no se anuncia

Las seis pantallas de `auth/` muestran el error de servidor con un `app-alert`
propio:

```html
@if (errorMessage(); as mensaje) {
  <app-alert tone="error" class="login__alert">{{ mensaje }}</app-alert>
}
```

Y ahí faltan **las dos cosas que `ViewStateHost` sí hace**:

| | `ViewStateHost` | Pantallas de `auth/` |
|---|---|---|
| Región viva alrededor | `aria-live="polite"` en el host | **No** |
| Foco al mensaje en S4 | Sí, con `queueMicrotask` | **No** |

**Consecuencia concreta:** alguien escribe mal su contraseña, pulsa «Entrar», y
con un lector de pantalla **no se entera de que apareció un mensaje**. El foco
sigue en el botón y nada lo anuncia.

Lo mismo con las confirmaciones que reemplazan el formulario:

| Pantalla | Lo que no se anuncia |
|---|---|
| `/auth/recuperar` | **El acuse** — la respuesta completa |
| `/auth/registro` | «Tu cuenta se creó, entrá con tu documento» |
| `/auth/nueva-clave` | La confirmación y cuántas sesiones se cerraron |

### Severidad

`HIGH` para `/auth/recuperar` (el acuse es toda la respuesta) y `MEDIUM` para las
demás. Ver [el informe de auditoría](audit-report.md).

### La propuesta

No hay que reescribir nada: `ViewStateHost` ya sabe hacerlo. Extraer sus dos
reglas —región viva y foco en S4— a una directiva reutilizable y aplicarla al
`app-alert` de esas pantallas.

Es un cambio de producto (toca comportamiento observable en seis componentes) y
por eso no se ejecuta acá.

## Los errores del servidor no se anclan al campo

`ViewStateIssue` admite un `field`, y `ViewStateHost` lo pinta:

```html
@if (issue.field) { <strong>{{ issue.field }}:</strong> }
{{ issue.message }}
```

Pero **`issuesOf` no lo rellena**: mapea `details.messages` a una lista de
mensajes sueltos.

Consecuencia: un error de validación del servidor se muestra como una lista
general, no junto al campo que lo causó. Para quien usa lector de pantalla, la
diferencia entre «el documento es inválido» flotando arriba y ese mismo mensaje
en el `aria-describedby` del campo es grande.

**El soporte existe en el tipo y en la plantilla; falta el mapeo.** Brecha
`MEDIUM`.

## Comprobaciones que faltan

| Comprobación | Estado |
|---|---|
| Prueba automatizada de nombres accesibles | **No existe** |
| Prueba de que el error entra en `aria-describedby` | Las pruebas de `form-field` cubren la lógica; no hay aserción sobre el atributo final |
| Prueba con lector de pantalla | No ejecutada |
| Regla de lint que exija `app-form-field` alrededor de un control | No existe |

La última sería barata y valiosa: hoy nada impide poner un `app-input` suelto, y
en ese caso cae en su propio id **sin nombre accesible**.
