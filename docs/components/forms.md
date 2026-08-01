# Formularios

Reactive Forms de Angular, con un contrato propio que resuelve la accesibilidad
del par campo ↔ control.

---

## El contrato campo ↔ control

`shared/forms/form-control.context.ts` — 19 importadores, el segundo nodo de
mayor centralidad del proyecto.

**El problema que resuelve**, dicho en su propio comentario:

> *«Existe para cerrar el defecto de accesibilidad más caro del sistema: un
> `<label for>` sin `id` al que apuntar deja el control sin nombre accesible.»*

```ts
export interface FormControlContext {
  readonly controlLabelable: WritableSignal<boolean>;
  readonly controlId: Signal<string>;
  readonly labelId: Signal<string>;
  readonly describedBy: Signal<string | null>;
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
}
```

| Quién | Aporta |
|---|---|
| `app-form-field` | Provee el contexto. Genera `controlId`, `labelId` y `describedBy` a partir de label, hint y error |
| El control | Consume `controlId` (lo pone en su elemento nativo), `describedBy`, `invalid` → `aria-invalid`, `required` → `aria-required`. Y **declara** `controlLabelable` |

### `controlLabelable`

Un grupo de radios **no es «etiquetable»** en el sentido del HTML: el `for` de un
`<label>` no puede apuntarle. El control lo declara y el campo decide:

| `controlLabelable` | El campo emite |
|---|---|
| `true` (input, select, textarea) | `<label for="controlId">` |
| `false` (radio-group) | El grupo se nombra con `aria-labelledby="labelId"` |

### El control funciona sin campo

```ts
inject(FORM_CONTROL_CONTEXT, { optional: true })
```

Cae en su propio id. Componer es una mejora, no un requisito.

## Los ids no rompen la hidratación

```ts
let sequence = 0;
export function nextControlId(prefix: string): string {
  sequence += 1;
  return `mch-${prefix}-${sequence}`;
}
```

> *«Server y cliente arrancan en 0 y avanzan en el mismo orden, así que los ids
> coinciden y la hidratación no rompe.»*

Un generador aleatorio produciría ids distintos en cada lado y Angular
descartaría el DOM del servidor.

## El puente a `ControlValueAccessor`

`shared/forms/value-accessor.ts` conecta los controles de señales con Reactive
Forms. Es lo que permite:

```html
<app-input formControlName="identifier" type="text" autocomplete="username" />
```

sin que `Input` implemente `ControlValueAccessor` a mano.

`value-accessor-groups.spec.ts` cubre aparte el caso de los grupos (radios),
donde la escritura del valor no va al control sino al grupo.

## Las seis pantallas con formulario

| Pantalla | Campos | Validación de cliente |
|---|---|---|
| Login | identificador, contraseña, código MFA | `required` en los dos primeros |
| Registro (paciente) | documento, nombre, contraseña, correo | `required`, `minLength(4)`, patrón `[A-Za-z0-9.-]+`, `minLength(8)`, `email` |
| Registro (profesional) | nombre, correo, contraseña, matrícula, nº de colegio, título, teléfono | `required`, `email`, `minLength(8)` |
| Recuperar | identificador | `required` |
| Nueva contraseña | contraseña nueva | `required`, `minLength(8)` |
| Elegir organización | — | (no es un formulario) |

Todas usan `FormGroup` + `FormControl` con `nonNullable: true`, así que
`getRawValue()` devuelve tipos no nulos y no hace falta comprobarlos.

### Las validaciones de cliente espejan las del backend

```ts
const MIN_PASSWORD = 8;                       // ResetPasswordDto, RegisterDto
const MIN_DOCUMENTO = 4;
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.-]+$/;  // el mismo @Matches del backend
```

Son una **comodidad, no la autoridad**: el backend valida igual y su respuesta se
traduce a S4. Duplicar la regla evita un viaje; no evita el viaje del atacante.

## El patrón de envío

Idéntico en las cinco pantallas que envían:

```ts
submit(): void {
  if (this.form.invalid || this.isSubmitting()) {
    this.form.markAllAsTouched();      // ← revela los errores de una vez
    return;
  }

  this.state.set(loading());

  this.cliente.operacion(datos).subscribe({
    next: (resultado) => { this.state.set(ready(null)); /* … */ },
    error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
  });
}
```

Tres cosas que hace bien:

1. **`isSubmitting()` bloquea el reenvío.** Es la prevención de envío duplicado, y
   deriva del estado: `computed(() => this.state().status === 'loading')`.
2. **`markAllAsTouched()`** revela todos los errores a la vez en vez de dejar que
   la persona los descubra de a uno.
3. **El error nunca se maneja a mano**: va a `errorToViewState`.

## Errores por campo

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
  <app-input formControlName="identifier" type="text" autocomplete="username" />
</app-form-field>
```

La condición `touched && invalid` evita marcar en rojo un campo que la persona
todavía no tocó.

**Los mensajes están escritos en la plantilla, no en un catálogo.** Con seis
formularios es manejable; con más, la repetición se notará. Anotado como brecha
`LOW`.

## Los campos que se omiten, no se mandan vacíos

```ts
...(correo === '' ? {} : { email: correo })
```

Con el motivo en el código: *«`forbidNonWhitelisted` rechaza lo que sobra, y una
cadena vacía no es lo mismo que la ausencia del campo.»*

`ProfilesClient` generaliza la idea con `stripUndefined()`.

## `autocomplete`

| Campo | Valor | Correcto |
|---|---|---|
| Identificador de login | `username` | Sí — sirve para correo y para documento |
| Contraseña de login | `current-password` | Sí |
| Código MFA | `one-time-code` | Sí |
| Contraseña nueva | `new-password` | Sí — el gestor ofrece generar una |

Los cuatro están bien puestos. Es de las cosas que más se olvidan y acá no.

## Lo que los formularios no hacen

| Elemento | Estado |
|---|---|
| Aviso al salir con cambios sin guardar | **No existe.** No hay `canDeactivate` |
| Guardado automático de borradores | No existe |
| Validación asíncrona (p. ej. «¿este correo ya existe?») | No existe — y no debería: revelaría qué cuentas existen |
| Validadores cruzados (confirmar contraseña) | No existe: ningún formulario pide confirmación |
| Catálogo centralizado de mensajes | No existe |
| Envío con Enter en un formulario de un solo campo | Funciona: es el `<form>` nativo |

La primera es la más costosa a medida que aparezcan formularios largos.
Registrada en [el análisis de brechas](../reports/documentation-gap-analysis.md).
