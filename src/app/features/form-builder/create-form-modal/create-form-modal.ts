import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { sugerirCodigoFormulario } from '../form-builder-storage';

export interface OpcionEspecialidadFormulario {
  readonly id: string;
  readonly label: string;
}

export interface NuevoFormularioDatos {
  readonly name: string;
  readonly code: string;
  readonly specialtyConceptId: string;
}

@Component({
  selector: 'app-create-form-modal',
  standalone: true,
  imports: [AppButton, AppInput, ContentDialog, FormField, Select],
  templateUrl: './create-form-modal.html',
  styleUrl: './create-form-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateFormModal {
  readonly especialidades = input.required<readonly OpcionEspecialidadFormulario[]>();
  readonly creando = input(false);

  readonly crear = output<NuevoFormularioDatos>();
  readonly cerrar = output<void>();

  protected readonly nombre = signal('');
  protected readonly codigo = signal('');
  protected readonly especialidadId = signal('');
  protected readonly codigoTocado = signal(false);

  constructor() {
    effect(() => {
      const opciones = this.especialidades();
      if (opciones.length > 0 && !this.especialidadId()) {
        this.especialidadId.set(opciones[0].id);
      }
    });
  }

  protected readonly opcionesSelect = computed(() =>
    this.especialidades().map((esp) => ({ value: esp.id, label: esp.label })),
  );

  protected readonly puedeCrear = computed(() => {
    return (
      this.nombre().trim().length >= 2 &&
      this.codigo().trim().length >= 2 &&
      this.especialidadId().trim().length > 0
    );
  });

  protected onNombreInput(valor: string | number | null): void {
    const nombre = valor === null ? '' : String(valor);
    this.nombre.set(nombre);
    if (!this.codigoTocado()) {
      this.codigo.set(sugerirCodigoFormulario(nombre));
    }
  }

  protected onCodigoInput(valor: string | number | null): void {
    this.codigoTocado.set(true);
    this.codigo.set(valor === null ? '' : String(valor));
  }

  protected onEspecialidadChange(valor: string | null): void {
    if (valor !== null) this.especialidadId.set(valor);
  }

  protected enviar(): void {
    if (!this.puedeCrear() || this.creando()) return;
    this.crear.emit({
      name: this.nombre().trim(),
      code: this.codigo().trim(),
      specialtyConceptId: this.especialidadId().trim(),
    });
  }

  protected onClosed(): void {
    if (!this.creando()) {
      this.cerrar.emit();
    }
  }
}
