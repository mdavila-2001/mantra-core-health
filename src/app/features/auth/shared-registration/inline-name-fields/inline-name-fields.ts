import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { mensajeDeError } from '../../../../shared/forms/paginated/error-message';
import { nameExtraControl, type NameGroup } from '../name-fields/person-name';

/**
 * Los campos del nombre de una persona, todos en la misma página: primer,
 * segundo y tercer nombre, tantos más como haga falta, apellido paterno y
 * apellido materno.
 *
 * Es el mismo comportamiento del alta de médico. Hay gente con cuatro y cinco
 * nombres: en vez de casillas fijas que casi nadie usa, se agregan las que
 * hagan falta.
 *
 * Existe aparte de `CamposDeNombre` porque ése reparte los nombres en dos
 * sub-páginas embebidas (farmacia, laboratorio, centro de imagen): dentro de
 * una página que ya forma parte de un formulario paginado —representante legal,
 * gerencias, owner— eso anidaría un «Siguiente» dentro de otro.
 */
@Component({
  selector: 'app-inline-name-fields',
  imports: [ReactiveFormsModule, AppButton, AppInput, NavIcon, Tooltip, FormField],
  templateUrl: './inline-name-fields.html',
  styleUrl: './inline-name-fields.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineNameFields {
  /** El grupo que gobierna estos campos (ver `grupoDeNombre`). */
  readonly grupo = input.required<NameGroup>();

  /** Prefijo de los `data-testid`: `<prefijo>-nombre`, `-segundo-nombre`, … */
  readonly prefijoTestId = input.required<string>();

  /** Marca primer nombre y apellido paterno como obligatorios (debe coincidir con `grupoDeNombre`). */
  readonly obligatorio = input(false);

  /** Un cambio en el `FormArray` no avisa a `OnPush`: este contador sí. */
  private readonly version = signal(0);

  protected readonly extra = computed(() => {
    this.version();
    return this.grupo().controls.extraNames.controls;
  });

  protected addName(): void {
    this.grupo().controls.extraNames.push(nameExtraControl());
    this.version.update((v) => v + 1);
  }

  protected removeName(indice: number): void {
    this.grupo().controls.extraNames.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  protected errorOf(clave: 'name' | 'lastName'): string {
    const esNombre = clave === 'name';
    const propio = mensajeDeError(this.grupo().controls[clave], {
      label: esNombre ? 'Primer nombre' : 'Apellido paterno',
      mensajeDeError: esNombre ? 'Escriba el primer nombre.' : 'Escriba el apellido paterno.',
    });
    if (propio !== '' || esNombre) return propio;
    const grupo = this.grupo();
    if (grupo.touched && grupo.hasError('nombresAdicionalesLargos')) {
      return 'El segundo, tercer y demás nombres juntos no pueden pasar de 100 caracteres.';
    }
    return grupo.touched && grupo.hasError('nombreCompletoLargo')
      ? 'El nombre completo no puede pasar de 200 caracteres.'
      : '';
  }
}
