import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import type { NewSigningKey } from '../../../core/data-access/auth-providers/auth-providers.types';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';

/**
 * Los seis campos de una clave de firma (V40-08). Publicar y rotar piden
 * exactamente la misma clave —rotar solo agrega la gracia—, así que el bloque
 * vive una vez y las dos pantallas lo consultan con `intentarLeer()`: o
 * devuelve la clave lista para el cuerpo, o marca los errores y devuelve
 * `null`.
 *
 * La clave pública y el certificado son textarea, no input: un PEM ocupa
 * varias líneas y recortarlo a una sola lo volvería impegable.
 */
@Component({
  selector: 'app-signing-key-fields',
  imports: [ReactiveFormsModule, DatePicker, FormField, Input, Textarea],
  templateUrl: './signing-key-fields.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SigningKeyFields {
  readonly disabled = input<boolean>(false);

  protected readonly form = new FormGroup({
    keyId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    algorithm: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    publicKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    certificate: new FormControl('', { nonNullable: true }),
  });

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);

  /** La clave lista para el cuerpo, o `null` con los errores marcados. */
  intentarLeer(): NewSigningKey | null {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    const valores = this.form.getRawValue();
    const certificado = valores.certificate.trim();
    const desde = this.validFrom();
    const hasta = this.validTo();

    return {
      keyId: valores.keyId.trim(),
      algorithm: valores.algorithm.trim(),
      publicKey: valores.publicKey.trim(),
      ...(certificado === '' ? {} : { certificate: certificado }),
      ...(desde === null ? {} : { validFrom: desde.toISOString() }),
      ...(hasta === null ? {} : { validTo: hasta.toISOString() }),
    };
  }
}
