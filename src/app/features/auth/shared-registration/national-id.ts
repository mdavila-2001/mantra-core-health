import { Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';

/**
 * La cédula de identidad boliviana, validada de verdad.
 *
 * ## Por qué existe
 *
 * El alta de paciente y la del médico aceptaban `^[A-Za-z0-9.-]+$` —«letras,
 * números, punto y guion», copiado del `@Matches` del backend—, que deja pasar
 * «QA-123», «H1-» o «...». Esa expresión es el piso que el servidor tolera para
 * cualquier documento, no lo que es una cédula. El propietario pidió que se
 * valide **antes de pasar al paso siguiente**: la cédula es el dato que ata una
 * cuenta a una persona (en el paciente es además con lo que entra), y un valor
 * inventado se descubre meses después, cuando ya no hay a quién preguntarle.
 *
 * ## Qué se exige
 *
 * - **Sólo dígitos**, de {@link NATIONAL_ID_MIN_DIGITS} a {@link NATIONAL_ID_MAX_DIGITS}.
 *   Las cédulas actuales traen siete u ocho; las antiguas, seis o cinco. Sin
 *   letras, puntos, guiones ni espacios: el departamento que la emitió («SC»,
 *   «LP»…) tiene su propia casilla y pegarlo al número rompía el cruce con quien
 *   ya tenía la cuenta.
 * - **Que no sea un relleno**: «0000000» y «1111111» son lo que se escribe para
 *   salir del paso, y ninguna cédula emitida es un solo dígito repetido.
 *
 * Es validación de **forma**: no consulta al SEGIP. Un número con forma válida
 * puede no existir, y eso sólo lo confirma quien lo emitió.
 */
export const NATIONAL_ID_MIN_DIGITS = 5;
export const NATIONAL_ID_MAX_DIGITS = 9;

/** Lo que ve la persona cuando la cédula no pasa; el mismo texto en las dos altas. */
export const INVALID_NATIONAL_ID_MESSAGE = `Ingrese su cédula: sólo números, de ${NATIONAL_ID_MIN_DIGITS} a ${NATIONAL_ID_MAX_DIGITS} dígitos, sin letras, puntos ni espacios. El departamento va en la casilla de al lado.`;

/** Por qué una cédula no pasa, para las pruebas y para quien necesite distinguir. */
export type NationalIdError = 'characters' | 'length' | 'repeated';

const ONLY_DIGITS = /^\d+$/;
const ONE_REPEATED_DIGIT = /^(\d)\1+$/;

/**
 * Por qué no pasa el texto dado, o `null` si es una cédula con forma válida.
 *
 * Evalúa el texto **tal como llega**: un espacio o un punto dentro del número
 * no es un dígito. Quien llama decide si recorta los extremos antes —el
 * validador de formulario sí, porque el envío también los recorta—.
 */
export function nationalIdError(value: string): NationalIdError | null {
  if (!ONLY_DIGITS.test(value)) return 'characters';
  if (value.length < NATIONAL_ID_MIN_DIGITS || value.length > NATIONAL_ID_MAX_DIGITS) {
    return 'length';
  }
  if (ONE_REPEATED_DIGIT.test(value)) return 'repeated';
  return null;
}

/**
 * Validador de formulario para un control con la cédula.
 *
 * El vacío **no** es su asunto —eso es `Validators.required`, que cada alta
 * declara según si la pide obligatoria—: un campo opcional vacío pasa, uno
 * obligatorio vacío lo frena el otro validador con su propio mensaje.
 *
 * El error se llama `nationalId` y trae el motivo: `{ nationalId: 'length' }`.
 */
export function validateBolivianNationalId(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value === '') return null;
  const reason = nationalIdError(value.trim());
  return reason === null ? null : { nationalId: reason };
}

/**
 * Validación vigente del documento de identidad en las altas de paciente y de
 * médico: el piso que tolera el backend (`@Matches` letras, dígitos, punto y
 * guion, mínimo 4). Se mantiene así —y no la de {@link validateBolivianNationalId}—
 * porque el documento también puede ser un pasaporte o un documento extranjero,
 * y porque los recorridos E2E de las altas escriben `CI-…`. La cédula estricta
 * queda disponible arriba, a la espera de la decisión de producto.
 */
export const MIN_IDENTITY_DOCUMENT = 4;
export const IDENTITY_DOCUMENT_PATTERN = /^[A-Za-z0-9.-]+$/;
export const INVALID_IDENTITY_DOCUMENT_MESSAGE =
  'Ingrese su documento: letras, números, punto y guion.';
export const identityDocumentValidators: readonly ValidatorFn[] = [
  Validators.required,
  Validators.minLength(MIN_IDENTITY_DOCUMENT),
  Validators.pattern(IDENTITY_DOCUMENT_PATTERN),
];
