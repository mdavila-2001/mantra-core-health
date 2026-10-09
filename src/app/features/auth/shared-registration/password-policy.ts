import { Validators } from '@angular/forms';

/**
 * La contraseña con la que se crea una cuenta.
 *
 * El mínimo no lo decide el frontend: lo exige la API en los DTO del alta
 * (`@MinLength(8)` en `register-practitioner.dto.ts`, `register-patient.dto.ts`
 * y `register-organization.dto.ts`, entre otros). Acá vive una sola vez lo que
 * cada alta repetía por su cuenta: el mínimo, los validadores y el texto que se
 * le muestra a la persona.
 *
 * Si la política cambia, se cambia acá y en la API, no en cada pantalla.
 */
export const MIN_CARACTERES_CONTRASENA = 8;

/** Lo que lee quien escribe una contraseña demasiado corta. */
export const MENSAJE_CONTRASENA_CORTA = 'La contraseña necesita al menos 8 caracteres.';

/**
 * Los validadores del control de contraseña.
 *
 * Se declara como lista de sólo lectura y cada formulario la copia al armar su
 * control (`[...validadoresDeContrasena]`): Angular guarda el arreglo que
 * recibe, y compartir la misma instancia entre formularios haría que el estado
 * de uno pudiera alcanzar al otro.
 */
export const validadoresDeContrasena = [
  Validators.required,
  Validators.minLength(MIN_CARACTERES_CONTRASENA),
] as const;
