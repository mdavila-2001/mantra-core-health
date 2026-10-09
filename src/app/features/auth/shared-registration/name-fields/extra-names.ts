import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { controlDeNombreExtra } from './person-name';

/** Casillas opcionales después del tercer nombre, respaldadas por el formulario. */
@Component({
  selector: 'app-extra-names',
  imports: [ReactiveFormsModule, AppButton, AppInput, NavIcon, Tooltip, FormField],
  templateUrl: './extra-names.html',
  styleUrl: './extra-names.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NombresExtra {
  readonly nombres = input.required<FormArray<FormControl<string>>>();
  readonly prefijoTestId = input.required<string>();
  private readonly version = signal(0);
  protected readonly controles = computed(() => {
    this.version();
    return this.nombres().controls;
  });
  protected agregar(): void {
    this.nombres().push(controlDeNombreExtra());
    this.version.update((v) => v + 1);
  }
  protected quitar(indice: number): void {
    this.nombres().removeAt(indice);
    this.version.update((v) => v + 1);
  }
}
