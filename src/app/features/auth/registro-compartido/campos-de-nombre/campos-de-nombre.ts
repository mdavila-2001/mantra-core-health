import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { CampoPersonalizado } from '../../../../shared/components/organisms/paginated-form/campo-personalizado';
import { paginarCampos } from '../../../../shared/forms/paginated/paginar-campos';
import type { CampoDeFormulario } from '../../../../shared/forms/paginated/paginated-form.types';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { mensajeDeError } from '../../../../shared/forms/paginated/mensaje-de-error';
import { controlDeNombreExtra, type GrupoDeNombre } from './nombre-de-persona';

/**
 * Los campos del nombre de una persona: primer, segundo y tercer nombre, tantos
 * más como haga falta, apellido paterno y apellido materno.
 *
 * Es el desglose que ya usan paciente, médico y aseguradora. Hay gente con
 * cuatro y cinco nombres: en vez de casillas fijas que casi nadie usa, se
 * agregan las que hagan falta.
 */
@Component({
  selector: 'app-campos-de-nombre',
  imports: [PaginatedForm, CampoPersonalizado, ReactiveFormsModule, AppButton, AppInput, NavIcon, Tooltip, FormField],
  templateUrl: './campos-de-nombre.html',
  styleUrl: './campos-de-nombre.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CamposDeNombre {
  /** El grupo que gobierna estos campos (ver `grupoDeNombre`). */
  readonly grupo = input.required<GrupoDeNombre>();

  /** Prefijo de los `data-testid`: `<prefijo>-nombre`, `-segundo-nombre`, … */
  readonly prefijoTestId = input.required<string>();

  /** Marca primer nombre y apellido paterno como obligatorios (debe coincidir con `grupoDeNombre`). */
  readonly obligatorio = input(false);

  /** Un cambio en el `FormArray` no avisa a `OnPush`: este contador sí. */
  private readonly version = signal(0);

  protected readonly extras = computed(() => {
    this.version();
    return this.grupo().controls.extraNames.controls;
  });

  protected readonly namePages = computed(() => {
    const field = (key: string): CampoDeFormulario => ({ key, label: '', control: 'custom' });
    return paginarCampos([
      { titulo: 'Nombres', campos: ['name', 'middleName', 'thirdName'].map(field) },
      { titulo: 'Apellidos', campos: ['lastName', 'motherLastName'].map(field) },
    ]);
  });

  protected agregarNombre(): void {
    this.grupo().controls.extraNames.push(controlDeNombreExtra());
    this.version.update((v) => v + 1);
  }

  protected quitarNombre(indice: number): void {
    this.grupo().controls.extraNames.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  protected errorDe(clave: 'name' | 'lastName'): string {
    const esNombre = clave === 'name';
    const propio = mensajeDeError(this.grupo().controls[clave], {
      label: esNombre ? 'Primer nombre' : 'Apellido paterno',
      mensajeDeError: esNombre ? 'Escribí el primer nombre.' : 'Escribí el apellido paterno.',
    });
    if (propio !== '' || esNombre) return propio;
    const grupo = this.grupo();
    return grupo.touched && grupo.hasError('nombreCompletoLargo')
      ? 'El nombre completo no puede pasar de 200 caracteres.'
      : '';
  }
}
