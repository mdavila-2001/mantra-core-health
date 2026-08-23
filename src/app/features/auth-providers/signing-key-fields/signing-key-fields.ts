import { FormControl, Validators } from '@angular/forms';

import type { NewSigningKey } from '../../../core/data-access/auth-providers/auth-providers.types';
import type { SeccionDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/**
 * Los campos de una clave de firma, compartidos por las dos pantallas que la
 * piden: publicarla y rotarla.
 *
 * ## Por qué dejó de ser un componente
 *
 * Era `<app-signing-key-fields>`, un bloque con `FormGroup` propio que el
 * formulario padre proyectaba y leía por `viewChild`. Funcionaba, y tenía dos
 * costos: el padre no podía **validar de a una página** porque la mitad de sus
 * campos vivían en otro grupo, y las seis preguntas de la clave llegaban juntas
 * a la pantalla — que es exactamente lo que el motor de formularios existe para
 * evitar.
 *
 * Ahora son tres piezas sueltas que el padre compone: los controles se mezclan
 * en **su** grupo, la sección se agrega a **sus** páginas, y el lector arma el
 * cuerpo. La reutilización es la misma; lo que se va es el grupo aparte.
 */

/** Los controles de la clave, para mezclar en el `FormGroup` de la pantalla. */
export function controlesDeClaveDeFirma() {
  return {
    keyId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    algorithm: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    publicKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    certificate: new FormControl('', { nonNullable: true }),
    keyValidFrom: new FormControl<Date | null>(null),
    keyValidTo: new FormControl<Date | null>(null),
  };
}

/**
 * La sección de la clave, para agregar a las páginas de la pantalla.
 *
 * Son seis campos, así que el motor los parte en dos páginas conservando el
 * nombre: «La clave (1 de 2)» y «(2 de 2)».
 */
export const SECCION_CLAVE_DE_FIRMA: SeccionDeFormulario = {
  titulo: 'La clave',
  hint: 'Tal como el proveedor la publica.',
  campos: [
    {
      key: 'keyId',
      label: 'Identificador de la clave',
      hint: 'El `kid` con el que el proveedor la publica en su JWKS.',
      control: 'text',
      required: true,
      mensajeDeError: 'Ingresá el identificador (hasta 200 caracteres).',
    },
    {
      key: 'algorithm',
      label: 'Algoritmo de firma',
      hint: 'Por ejemplo RS256 o ES256.',
      control: 'text',
      required: true,
      mensajeDeError: 'Ingresá el algoritmo (hasta 50 caracteres).',
    },
    {
      key: 'publicKey',
      label: 'Clave pública',
      hint: 'El material público, en PEM o JWK.',
      control: 'textarea',
      required: true,
      mensajeDeError: 'Pegá la clave pública.',
    },
    {
      key: 'certificate',
      label: 'Certificado',
      hint: 'Opcional: el certificado X.509 asociado, si el proveedor lo publica.',
      control: 'textarea',
    },
    {
      key: 'keyValidFrom',
      label: 'Vigente desde',
      hint: 'Sin fecha, rige desde que se publica.',
      control: 'datetime',
    },
    {
      key: 'keyValidTo',
      label: 'Vigente hasta',
      hint: 'Sin fecha, no vence sola.',
      control: 'datetime',
    },
  ],
};

/** Los valores de la clave dentro del formulario de la pantalla. */
export interface ValoresDeClaveDeFirma {
  readonly keyId: string;
  readonly algorithm: string;
  readonly publicKey: string;
  readonly certificate: string;
  readonly keyValidFrom: Date | null;
  readonly keyValidTo: Date | null;
}

/**
 * El cuerpo de la clave, a partir de los valores del formulario.
 *
 * Los opcionales vacíos no viajan: el backend valida con `forbidNonWhitelisted`
 * y una cadena vacía no es lo mismo que la ausencia del campo.
 *
 * @param valores - Los valores del `FormGroup` de la pantalla.
 * @returns La clave lista para el cuerpo de la petición.
 */
export function leerClaveDeFirma(valores: ValoresDeClaveDeFirma): NewSigningKey {
  const certificado = valores.certificate.trim();

  return {
    keyId: valores.keyId.trim(),
    algorithm: valores.algorithm.trim(),
    publicKey: valores.publicKey.trim(),
    ...(certificado === '' ? {} : { certificate: certificado }),
    ...(valores.keyValidFrom === null
      ? {}
      : { validFrom: valores.keyValidFrom.toISOString() }),
    ...(valores.keyValidTo === null ? {} : { validTo: valores.keyValidTo.toISOString() }),
  };
}
