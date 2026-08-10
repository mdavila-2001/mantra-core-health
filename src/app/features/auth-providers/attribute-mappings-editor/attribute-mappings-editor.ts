import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import type { AttributeMapping } from '../../../core/data-access/auth-providers/auth-providers.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { objetoJson } from '../../../shared/forms/form-support';

/** Techo generoso para la transformación declarativa; el DDL no fija uno. */
const MAX_TRANSFORM = 2000;

type FilaDeMapeo = FormGroup<{
  sourceClaim: FormControl<string>;
  targetAttribute: FormControl<string>;
  isIdentifier: FormControl<boolean>;
  required: FormControl<boolean>;
  transformJson: FormControl<string>;
}>;

function nuevaFila(): FilaDeMapeo {
  return new FormGroup({
    sourceClaim: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    targetAttribute: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    isIdentifier: new FormControl(false, { nonNullable: true }),
    required: new FormControl(false, { nonNullable: true }),
    transformJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_TRANSFORM), objetoJson],
    }),
  });
}

/**
 * Repetidor de mapeos de atributo de un proveedor (V40-04).
 *
 * El contrato exige **al menos un mapeo** (`ArrayMinSize(1)`), así que el
 * editor nace con una fila y la última no se puede quitar. La transformación
 * es un objeto libre del modelo — inventarle campos sería adivinar —: se pide
 * el JSON tal cual y se valida su forma antes de gastar la petición.
 *
 * La pantalla lo consulta con `intentarEnvio()`: o devuelve los mapeos listos
 * para el cuerpo, o marca los errores y devuelve `null`.
 */
@Component({
  selector: 'app-attribute-mappings-editor',
  imports: [ReactiveFormsModule, AppButton, Card, FormField, Input, Switch, Textarea],
  templateUrl: './attribute-mappings-editor.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttributeMappingsEditor {
  protected readonly maxTransform = MAX_TRANSFORM;

  readonly disabled = input<boolean>(false);

  protected readonly filas = new FormArray<FilaDeMapeo>([nuevaFila()]);

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
    if (this.filas.length <= 1) {
      return;
    }
    this.filas.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  /** Los mapeos listos para el cuerpo, o `null` con los errores marcados. */
  intentarEnvio(): readonly AttributeMapping[] | null {
    if (this.filas.invalid) {
      this.filas.markAllAsTouched();
      this.version.update((v) => v + 1);
      return null;
    }

    return this.filas.controls.map((fila) => {
      const valores = fila.getRawValue();
      const transformacion = valores.transformJson.trim();
      return {
        sourceClaim: valores.sourceClaim.trim(),
        targetAttribute: valores.targetAttribute.trim(),
        // Los interruptores viajan siempre, apagados o prendidos: son una
        // decisión explícita («valor por defecto explícito», dice la ficha).
        isIdentifier: valores.isIdentifier,
        required: valores.required,
        ...(transformacion === ''
          ? {}
          : { transformJson: JSON.parse(transformacion) as Record<string, unknown> }),
      };
    });
  }
}
