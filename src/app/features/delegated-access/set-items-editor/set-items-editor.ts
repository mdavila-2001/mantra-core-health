import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import type { PermissionSetItem } from '../../../core/data-access/delegated-access/delegated-access.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { objetoJson, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/** Techo generoso para una restricción declarativa; el DDL no fija uno. */
const MAX_CONSTRAINT = 2000;

type FilaDeItem = FormGroup<{
  permissionId: FormControl<string>;
  constraintJson: FormControl<string>;
  requiresStepUpAuthentication: FormControl<boolean>;
}>;

function nuevaFila(): FilaDeItem {
  return new FormGroup({
    permissionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    constraintJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CONSTRAINT), objetoJson],
    }),
    requiresStepUpAuthentication: new FormControl(false, { nonNullable: true }),
  });
}

/**
 * Repetidor de ítems de un set de permisos delegados (V29-08/09).
 *
 * El contrato exige **al menos un ítem** (`ArrayMinSize(1)`), así que el
 * editor nace con una fila y la última no se puede quitar. La ficha imagina la
 * restricción como sub-formulario estructurado, pero el modelo no declara su
 * esquema — es un objeto libre —, así que inventarle campos sería adivinar:
 * se pide el JSON tal cual y se valida su forma antes de gastar la petición.
 *
 * Las dos pantallas que lo usan lo consultan con `intentarEnvio()`: o devuelve
 * los ítems listos para el cuerpo, o marca los errores y devuelve `null`.
 */
@Component({
  selector: 'app-set-items-editor',
  imports: [ReactiveFormsModule, AppButton, Card, FormField, Input, Switch, Textarea],
  templateUrl: './set-items-editor.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetItemsEditor {
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxConstraint = MAX_CONSTRAINT;

  readonly disabled = input<boolean>(false);

  protected readonly filas = new FormArray<FilaDeItem>([nuevaFila()]);

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

  /** Los ítems listos para el cuerpo, o `null` con los errores marcados. */
  intentarEnvio(): readonly PermissionSetItem[] | null {
    if (this.filas.invalid) {
      this.filas.markAllAsTouched();
      this.version.update((v) => v + 1);
      return null;
    }

    return this.filas.controls.map((fila) => {
      const valores = fila.getRawValue();
      const restriccion = valores.constraintJson.trim();
      return {
        permissionId: valores.permissionId.trim(),
        // La restricción vacía no viaja; el switch sí, apagado o prendido: es
        // una decisión explícita («valor por defecto explícito», dice la ficha).
        ...(restriccion === ''
          ? {}
          : { constraintJson: JSON.parse(restriccion) as Record<string, unknown> }),
        requiresStepUpAuthentication: valores.requiresStepUpAuthentication,
      };
    });
  }

}
