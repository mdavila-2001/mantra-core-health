import type { AbstractControl, ValidationErrors } from '@angular/forms';

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
 * - **Sólo dígitos**, de {@link CEDULA_MIN_DIGITOS} a {@link CEDULA_MAX_DIGITOS}.
 *   Las cédulas actuales traen siete u ocho; las antiguas, seis o cinco. Sin
 *   letras, puntos, guiones ni espacios: el departamento que la emitió («SC»,
 *   «LP»…) y el complemento tienen su propia casilla y pegarlos al número
 *   rompía el cruce con quien ya tenía la cuenta.
 * - **Que no sea un relleno**: «0000000» y «1111111» son lo que se escribe para
 *   salir del paso, y ninguna cédula emitida es un solo dígito repetido.
 *
 * Es validación de **forma**: no consulta al SEGIP. Un número con forma válida
 * puede no existir, y eso sólo lo confirma quien lo emitió.
 */
export const CEDULA_MIN_DIGITOS = 5;
export const CEDULA_MAX_DIGITOS = 9;

/** Lo que ve la persona cuando la cédula no pasa; el mismo texto en las dos altas. */
export const MENSAJE_CEDULA_INVALIDA = `Ingrese su cédula: sólo números, de ${CEDULA_MIN_DIGITOS} a ${CEDULA_MAX_DIGITOS} dígitos, sin letras, puntos ni espacios. El departamento va en la casilla de al lado.`;

/** Por qué una cédula no pasa, para las pruebas y para quien necesite distinguir. */
export type ErrorDeCedula = 'caracteres' | 'longitud' | 'repetida';

const SOLO_DIGITOS = /^\d+$/;
const UN_SOLO_DIGITO_REPETIDO = /^(\d)\1+$/;

/**
 * Por qué no pasa el texto dado, o `null` si es una cédula con forma válida.
 *
 * Evalúa el texto **tal como llega**: un espacio o un punto dentro del número
 * no es un dígito. Quien llama decide si recorta los extremos antes —el
 * validador de formulario sí, porque el envío también los recorta—.
 */
export function errorDeCedula(valor: string): ErrorDeCedula | null {
  if (!SOLO_DIGITOS.test(valor)) return 'caracteres';
  if (valor.length < CEDULA_MIN_DIGITOS || valor.length > CEDULA_MAX_DIGITOS) return 'longitud';
  if (UN_SOLO_DIGITO_REPETIDO.test(valor)) return 'repetida';
  return null;
}

/**
 * Validador de formulario para un control con la cédula.
 *
 * El vacío **no** es su asunto —eso es `Validators.required`, que cada alta
 * declara según si la pide obligatoria—: un campo opcional vacío pasa, uno
 * obligatorio vacío lo frena el otro validador con su propio mensaje.
 *
 * El error se llama `cedula` y trae el motivo: `{ cedula: 'longitud' }`.
 */
export function validarCedulaBoliviana(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (typeof valor !== 'string' || valor === '') return null;
  const motivo = errorDeCedula(valor.trim());
  return motivo === null ? null : { cedula: motivo };
}
