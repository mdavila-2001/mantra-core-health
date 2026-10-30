import type { AbstractControl, ValidationErrors } from '@angular/forms';

import type { ViewState } from '../../core/view-state/view-state.types';

/**
 * Apoyo común de los formularios de los módulos solo-comando (M29, M40, …).
 *
 * Mientras el backend no exponga listados ni búsqueda, las referencias se
 * cargan **pegando el identificador**: este módulo concentra la validación de
 * ese gesto y la traducción de estados a mensajes, para que las pantallas no
 * lo repitan cada una a su manera. Nació en el M29 y subió a `shared/` cuando
 * el M40 lo necesitó igual.
 */

/** Forma de un UUID. Valida lo pegado a mano antes de gastar una petición. */
export const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Mensaje único para todo campo de identificador con formato inválido. */
export const UUID_ERROR = 'Pegue el identificador completo (formato UUID).';

/**
 * Ayuda compartida de los campos de identificador: dice por qué se pide pegado
 * mientras no exista el listado que debería ofrecerlo.
 */
export const UUID_HINT = 'El módulo todavía no expone listados: pegue el identificador (UUID).';

/**
 * Forma de un puntaje que viaja como texto: el backend valida `matchScore` y
 * `confidenceScore` con `@IsNumberString`, no con `@IsNumber`.
 */
export const NUMBER_STRING_PATTERN = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

/** Mensaje único para los puntajes en texto con formato inválido. */
export const NUMBER_STRING_ERROR = 'Ingrese un número, como 0.98.';

/** Mensaje por omisión de un `404` en un envío (S6, sin filtrar existencia). */
export const NOT_FOUND_MESSAGE =
  'No encontramos lo que está modificando: puede que ya no exista. Vuelva al listado y reintente.';

/**
 * Mensaje de error de un `ViewState`, con el mismo criterio que el resto de
 * las pantallas del producto: validación → los detalles de la API; prohibido →
 * el mensaje del backend o el propio de la pantalla; S8/S9, textos comunes con
 * `requestId` para poder reportar.
 */
export function errorMessageOf(
  state: ViewState<unknown>,
  forbiddenFallback: string,
  notFoundMessage: string = NOT_FOUND_MESSAGE,
): string | null {
  if (state.status === 'validation') {
    return state.issues.map((issue) => issue.message).join(' ') || null;
  }
  if (state.status === 'forbidden') {
    // `||` y no `??`: un 403 con `message: ''` también es «sin mensaje».
    return state.message || forbiddenFallback;
  }
  // S6: un 404 sobre un envío no es «no pasó nada». Sin esta rama el
  // formulario volvía a habilitarse sin decir por qué —la organización, la
  // membresía o el recurso al que apuntaba ya no existe—, y la persona
  // reintentaba contra algo que no está. El texto no dice si existe y no se
  // puede ver: S6 no filtra existencia.
  if (state.status === 'not-found') {
    return notFoundMessage;
  }
  if (state.status === 'offline') {
    return 'No pudimos conectarnos. Revise su conexión y reintente.';
  }
  if (state.status === 'error') {
    return `${state.message || 'No pudimos completar la acción. Intente de nuevo en unos segundos.'} (${state.requestId})`;
  }
  return null;
}

/**
 * Estrecha lo que emite un grupo de radios (`unknown`) a una de las opciones
 * declaradas, o `null`. Nada fuera del set entra a una señal tipada.
 */
export function opcionDe<T extends string>(opciones: readonly T[], valor: unknown): T | null {
  return typeof valor === 'string' && (opciones as readonly string[]).includes(valor)
    ? (valor as T)
    : null;
}

/**
 * El campo es opcional, pero si está tiene que ser un **objeto** JSON: el
 * backend valida estos campos con `@IsObject`, que rechaza arrays y
 * primitivos. El modelo no declara su esquema interior, así que inventarle
 * campos sería adivinar: se pide el JSON tal cual y se valida su forma.
 */
export function objetoJson(control: AbstractControl<string>): ValidationErrors | null {
  const texto = control.value.trim();
  if (texto === '') {
    return null;
  }
  try {
    const valor: unknown = JSON.parse(texto);
    const esObjeto = typeof valor === 'object' && valor !== null && !Array.isArray(valor);
    return esObjeto ? null : { objetoJson: true };
  } catch {
    return { objetoJson: true };
  }
}
