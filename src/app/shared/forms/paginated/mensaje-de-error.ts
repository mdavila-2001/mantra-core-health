import type { AbstractControl } from '@angular/forms';

import type { CampoDeFormulario } from './paginated-form.types';

/**
 * El error de un campo, en castellano y en segunda persona.
 *
 * ## Por qué el motor traduce y no cada pantalla
 *
 * Hoy cada formulario escribe su mensaje a mano en la plantilla, con un ternario
 * de tres líneas por campo — el alta de paciente tiene trece. Eso produce dos
 * cosas: mensajes distintos para el mismo error («Ingresá tu nombre.» /
 * «El nombre es obligatorio») y campos que se olvidan de tener mensaje, que es
 * peor: el borde se pone rojo y no dice por qué.
 *
 * El motor traduce por defecto y deja pasar el mensaje propio cuando el campo lo
 * trae. Lo genérico se resuelve una vez; lo específico —«letras, números, punto
 * y guion», que sólo sabe quien declaró el validador— sigue en manos del campo.
 *
 * ## Sólo cuando la persona ya tocó el campo
 *
 * Un formulario que se pinta en rojo antes de que nadie escriba nada acusa de
 * algo que todavía no pasó. Se espera a `touched`, que es lo que ya hace el
 * signup a mano en cada campo.
 */
export function mensajeDeError(
  control: AbstractControl | null,
  campo: Pick<CampoDeFormulario, 'label' | 'mensajeDeError'>,
): string {
  if (control === null || !control.touched || !control.invalid) {
    return '';
  }

  if (campo.mensajeDeError !== undefined) {
    return campo.mensajeDeError;
  }

  const errores = control.errors ?? {};

  if ('required' in errores) {
    return 'Este dato es obligatorio.';
  }
  if ('email' in errores) {
    return 'Revisá el correo: falta el arroba o el dominio.';
  }
  if ('minlength' in errores) {
    const { requiredLength } = errores['minlength'] as { requiredLength: number };
    return `Tiene que tener al menos ${requiredLength} caracteres.`;
  }
  if ('maxlength' in errores) {
    const { requiredLength } = errores['maxlength'] as { requiredLength: number };
    return `No puede pasar de ${requiredLength} caracteres.`;
  }
  if ('min' in errores) {
    const { min } = errores['min'] as { min: number };
    return `Tiene que ser ${min} o más.`;
  }
  if ('max' in errores) {
    const { max } = errores['max'] as { max: number };
    return `No puede pasar de ${max}.`;
  }
  if ('pattern' in errores) {
    return 'Revisá el formato.';
  }
  // Los topes de un campo de varias respuestas: ver `validadoresDeSeleccion`.
  // «Exactamente» va primero porque es el caso en que los otros dos coinciden.
  if ('exactSelections' in errores) {
    const { required } = errores['exactSelections'] as { required: number };
    return `Marcá exactamente ${required} ${required === 1 ? 'opción' : 'opciones'}.`;
  }
  if ('minSelections' in errores) {
    const { min } = errores['minSelections'] as { min: number };
    return `Marcá al menos ${min} ${min === 1 ? 'opción' : 'opciones'}.`;
  }
  if ('maxSelections' in errores) {
    const { max } = errores['maxSelections'] as { max: number };
    return `Marcá como máximo ${max} ${max === 1 ? 'opción' : 'opciones'}.`;
  }

  // Las dos restricciones de una cuadrícula: ver `validadorDeCuadricula`.
  if ('gridColumnRepeated' in errores) {
    const { column } = errores['gridColumnRepeated'] as { column: string };
    return `«${column}» ya está elegida en otra fila: sólo se puede una vez por columna.`;
  }
  if ('gridRowMissing' in errores) {
    const { missing } = errores['gridRowMissing'] as { missing: number };
    return missing === 1
      ? 'Falta responder una fila.'
      : `Faltan responder ${missing} filas.`;
  }

  // Un validador propio sin mensaje declarado. No se calla: un campo en rojo sin
  // explicación deja a la persona probando a ciegas.
  return `Revisá ${campo.label.toLocaleLowerCase('es')}.`;
}
