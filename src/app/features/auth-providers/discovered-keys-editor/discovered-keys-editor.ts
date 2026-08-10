import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import type { DiscoveredKey } from '../../../core/data-access/auth-providers/auth-providers.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

type FilaDeClave = FormGroup<{
  keyId: FormControl<string>;
  algorithm: FormControl<string>;
  publicKey: FormControl<string>;
  certificate: FormControl<string>;
}>;

function nuevaFila(): FilaDeClave {
  return new FormGroup({
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
}

/**
 * Repetidor de claves descubiertas en el JWKS del proveedor (V40-06).
 *
 * A diferencia del editor de ítems del M29, acá la lista es **opcional**: el
 * editor nace vacío y sin filas no viaja nada — el JWKS se puede importar en
 * otra reconfiguración. La pantalla lo consulta con `intentarEnvio()`: o
 * devuelve las claves listas para el cuerpo (vacío incluido), o marca los
 * errores y devuelve `null`.
 */
@Component({
  selector: 'app-discovered-keys-editor',
  imports: [ReactiveFormsModule, AppButton, Card, FormField, Input, Textarea],
  templateUrl: './discovered-keys-editor.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveredKeysEditor {
  readonly disabled = input<boolean>(false);

  protected readonly filas = new FormArray<FilaDeClave>([]);

  /**
   * El `FormArray` muta por dentro sin que ninguna señal lo note; este
   * contador es el latido que le avisa a la vista `OnPush` que la lista de
   * filas cambió de tamaño.
   */
  protected readonly version = signal(0);

  /** Las filas que pinta la vista; leer `version` la engancha al latido. */
  protected readonly filasVisibles = computed(() => {
    this.version();
    return this.filas.controls;
  });

  protected agregarFila(): void {
    this.filas.push(nuevaFila());
    this.version.update((v) => v + 1);
  }

  protected quitarFila(indice: number): void {
    this.filas.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  /** Las claves listas para el cuerpo, o `null` con los errores marcados. */
  intentarEnvio(): readonly DiscoveredKey[] | null {
    if (this.filas.invalid) {
      this.filas.markAllAsTouched();
      this.version.update((v) => v + 1);
      return null;
    }

    return this.filas.controls.map((fila) => {
      const valores = fila.getRawValue();
      const certificado = valores.certificate.trim();
      return {
        keyId: valores.keyId.trim(),
        algorithm: valores.algorithm.trim(),
        publicKey: valores.publicKey.trim(),
        ...(certificado === '' ? {} : { certificate: certificado }),
      };
    });
  }
}
