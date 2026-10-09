import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { CampoPersonalizado } from '../../../../shared/components/organisms/paginated-form/custom-field';
import { paginarCampos } from '../../../../shared/forms/paginated/paginate-fields';
import type { CampoDeFormulario } from '../../../../shared/forms/paginated/paginated-form.types';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { mensajeDeError } from '../../../../shared/forms/paginated/error-message';
import { type GrupoDeNombre } from './person-name';

import { NombresExtra } from './extra-names';

/**
 * Los campos del nombre de una persona: primer, segundo y tercer nombre, tantos
 * más como haga falta, apellido paterno y apellido materno.
 *
 * Es el desglose que ya usan paciente, médico y aseguradora. Hay gente con
 * cuatro y cinco nombres: en vez de casillas fijas que casi nadie usa, se
 * agregan las que hagan falta.
 */
@Component({
  selector: 'app-name-fields',
  imports: [
    PaginatedForm,
    CampoPersonalizado,
    ReactiveFormsModule,
    AppInput,
    FormField,
    NombresExtra,
  ],
  templateUrl: './name-fields.html',
  styleUrl: './name-fields.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CamposDeNombre {
  /** El grupo que gobierna estos campos (ver `grupoDeNombre`). */
  readonly grupo = input.required<GrupoDeNombre>();

  /** Prefijo de los `data-testid`: `<prefijo>-nombre`, `-segundo-nombre`, … */
  readonly prefijoTestId = input.required<string>();

  /** Marca primer nombre y apellido paterno como obligatorios (debe coincidir con `grupoDeNombre`). */
  readonly obligatorio = input(false);

  protected readonly namePages = computed(() => {
    const field = (key: string): CampoDeFormulario => ({ key, label: '', control: 'custom' });
    return paginarCampos([
      { titulo: 'Nombres', campos: ['name', 'middleName', 'thirdName', 'extraNames'].map(field) },
      { titulo: 'Apellidos', campos: ['lastName', 'motherLastName'].map(field) },
    ]);
  });

  protected errorDe(clave: 'name' | 'lastName'): string {
    const esNombre = clave === 'name';
    const propio = mensajeDeError(this.grupo().controls[clave], {
      label: esNombre ? 'Primer nombre' : 'Apellido paterno',
      mensajeDeError: esNombre ? 'Escriba el primer nombre.' : 'Escriba el apellido paterno.',
    });
    if (propio !== '' || esNombre) return propio;
    const grupo = this.grupo();
    return grupo.touched && grupo.hasError('nombreCompletoLargo')
      ? 'El nombre completo no puede pasar de 200 caracteres.'
      : '';
  }
}
