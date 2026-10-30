import { HttpErrorResponse } from '@angular/common/http';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import {
  HEALTH_FACILITY_REGISTRATION_MAX,
  HEALTH_FACILITY_REGISTRATION_MIN,
  HEALTH_FACILITY_REGISTRATION_PATTERN,
  NIT_PATTERN,
} from '../../../core/data-access/iam/medical-facility.rules';
import { readApiError } from '../../../core/http/api-error';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { EnrollmentDocumentKey } from '../shared-registration/legal-documents';
import { noSoloEspacios } from '../shared-registration/trimmed-text';

/** Lo que dice la pantalla cuando un catálogo no sirve. */
export const AVISO_CATALOGO =
  'No pudimos cargar los catálogos del alta. Revise su conexión y vuelva a enviar.';

/**
 * Los documentos que un tipo societario puede omitir: las personas naturales
 * no tienen escritura de constitución, y el profesional independiente ejerce
 * con su NIT personal, sin matrícula de comercio. Es la misma regla que aplica
 * la API (`assertLegalDocumentsForEntityType`, 422 nombrando el documento);
 * decisión del propietario del 28/10/2026. El resto de los tipos sube los cinco.
 *
 * El poder del representante lo omite sólo una **unipersonal** (el titular se
 * representa a sí mismo): la API lo exige a todo el resto, profesional
 * independiente incluido.
 */
export const DOCUMENTOS_OPCIONALES_POR_TIPO: Readonly<
  Record<string, readonly EnrollmentDocumentKey[]>
> = {
  UNIPERSONAL: ['constitutionFileId', 'powerOfAttorneyFileId'],
  PROFESIONAL_INDEPENDIENTE: ['constitutionFileId', 'commerceRegistryFileId'],
};

/** Los documentos que el tipo societario elegido puede omitir; ninguno si no hay tipo. */
export function documentosOpcionales(tipoSocietario: string): readonly EnrollmentDocumentKey[] {
  return DOCUMENTOS_OPCIONALES_POR_TIPO[tipoSocietario] ?? [];
}

/**
 * El valor del control tiene que ser una de las opciones que la pantalla
 * ofrece **ahora**.
 *
 * Las opciones llegan del catálogo después de pintar: si traen menos tipos que
 * los que había —una API sin `CLINIC`—, un valor ya elegido quedaría puesto
 * en el formulario sin una opción que lo muestre, y saldría igual a la red para
 * volver con un 400. Vacío no es asunto de este validador: lo dice `required`.
 *
 * @param opciones - Lee las opciones vigentes; se consulta en cada validación.
 */
export function entreLasOpciones(opciones: () => readonly SelectOption<string>[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    if (valor === '' || valor === null) return null;
    return opciones().some((opcion) => opcion.value === valor) ? null : { notOffered: true };
  };
}

/**
 * El NIT, recortado, con la forma que acepta la API (`^[0-9][0-9-]{3,19}$`).
 * Vacío de verdad es asunto de `required`; solo espacios es un NIT que falta
 * (sale recortado y vacío), no uno que pasa.
 */
export const nitValido: ValidatorFn = (control) => {
  const faltante = noSoloEspacios(control);
  if (faltante !== null) return faltante;
  const valor = String(control.value ?? '').trim();
  return valor === '' || NIT_PATTERN.test(valor) ? null : { pattern: true };
};

/**
 * El número de registro del establecimiento ante la autoridad sanitaria:
 * de 3 a 50 caracteres de `[A-Za-z0-9./-]`, recortado. Vacío de verdad es asunto
 * de `required`; solo espacios es un número que falta.
 */
export const registroDeEstablecimientoValido: ValidatorFn = (control) => {
  const faltante = noSoloEspacios(control);
  if (faltante !== null) return faltante;
  const valor = String(control.value ?? '').trim();
  if (valor === '') return null;
  if (valor.length < HEALTH_FACILITY_REGISTRATION_MIN) {
    return { minlength: { requiredLength: HEALTH_FACILITY_REGISTRATION_MIN, actualLength: valor.length } };
  }
  if (valor.length > HEALTH_FACILITY_REGISTRATION_MAX) {
    return { maxlength: { requiredLength: HEALTH_FACILITY_REGISTRATION_MAX, actualLength: valor.length } };
  }
  return HEALTH_FACILITY_REGISTRATION_PATTERN.test(valor) ? null : { pattern: true };
};

/** Un error de la API, en castellano y sin tecnicismos. */
export function signupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === AVISO_CATALOGO) {
    return AVISO_CATALOGO;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No pudimos conectarnos. Revise su conexión e intente de nuevo.';
    }
    if (error.status === 409) {
      return 'Ya existe una cuenta con ese correo o una organización con ese nombre. Pruebe con otros datos.';
    }
    if (error.status === 400 || error.status === 422) {
      return readApiError(error)?.message ?? 'Revise los datos del formulario.';
    }
  }
  return 'No pudimos completar el registro. Intente de nuevo en unos segundos.';
}
