import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  NUMEROS_CONSULTADOS_EL,
  NUMEROS_DE_EMERGENCIA,
  enlaceDeLlamada,
} from '@core/emergency/emergency-numbers';
import { TrustedAmbulanceStore } from '@core/emergency/trusted-ambulance.store';
import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { PhoneInput, telefonoCompleto } from '@shared/components/molecules/phone-input/phone-input';

/**
 * Los números para pedir ayuda, a un toque cada uno, y la ambulancia de confianza.
 *
 * Lo usan el botón de emergencia del encabezado (dentro de su diálogo) y el aviso de urgencia de
 * «¿A qué especialista consultar?». Cada número es un enlace `tel:`: en el celular llama al tocarlo.
 * Las fuentes oficiales y la fecha de consulta están en `emergency-numbers.ts` y se muestran abajo.
 */
@Component({
  selector: 'app-emergency-panel',
  imports: [ReactiveFormsModule, AppButton, Input, FormField, PhoneInput],
  templateUrl: './emergency-panel.html',
  styleUrl: './emergency-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyPanel {
  private readonly confianza = inject(TrustedAmbulanceStore);

  /** Si se ofrece cargar o cambiar la ambulancia de confianza. */
  readonly configurable = input(true);
  /** Se tocó un número: quien contiene el panel puede cerrarse. */
  readonly llamando = output<string>();

  protected readonly numeros = NUMEROS_DE_EMERGENCIA;
  protected readonly consultadoEl = new Date(`${NUMEROS_CONSULTADOS_EL}T12:00:00`).toLocaleDateString('es-BO', {
    dateStyle: 'long',
  });
  protected readonly ambulancia = this.confianza.ambulancia;
  protected readonly enlace = enlaceDeLlamada;

  protected readonly editando = signal(false);
  protected readonly aviso = signal('');

  protected readonly formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true }),
    telefono: new FormControl('', { nonNullable: true, validators: [telefonoCompleto] }),
  });

  protected editar(): void {
    const actual = this.ambulancia();
    this.formulario.setValue({ nombre: actual?.nombre ?? '', telefono: actual?.telefono ?? '' });
    this.aviso.set('');
    this.editando.set(true);
  }

  protected guardar(): void {
    const { nombre, telefono } = this.formulario.getRawValue();
    if (this.formulario.invalid || telefono.trim() === '') {
      this.formulario.markAllAsTouched();
      return;
    }
    this.confianza.guardar(nombre, telefono);
    this.editando.set(false);
    this.aviso.set('Guardamos su ambulancia de confianza en este dispositivo. El botón de emergencia la llamará directamente.');
  }

  protected quitar(): void {
    this.confianza.quitar();
    this.editando.set(false);
    this.aviso.set('Quitamos su ambulancia de confianza. El botón de emergencia volverá a mostrar los números oficiales.');
  }

  protected errorDelTelefono(): string {
    const control = this.formulario.controls.telefono;
    return control.touched && (control.invalid || control.value.trim() === '')
      ? 'Ingrese el número completo de la ambulancia, con el país si no es de Bolivia.'
      : '';
  }
}
