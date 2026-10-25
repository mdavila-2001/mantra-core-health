import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ViewState } from '../../core/view-state/view-state.types';
import { Alert } from '../../shared/components/molecules/alert/alert';

/**
 * El fallo de una escritura de grupos médicos, dicho con palabras.
 *
 * Es un aviso dentro de la pantalla y no un estado de página: un rechazo de la
 * API (S4 con sus motivos, S5, S6, S8 o S9 con el ID de la petición) no borra lo
 * que la persona escribió. Lo comparten la ficha y el alta.
 */
@Component({
  selector: 'app-medical-group-write-error',
  imports: [Alert],
  template: `
    @if (state(); as fallo) {
      <app-alert tone="error" title="No se pudo guardar" data-testid="medical-group-error">
        @switch (fallo.status) {
          @case ('validation') {
            @for (motivo of fallo.issues; track $index) {
              <span class="motivo">{{ motivo.message }}</span>
            }
            @if (fallo.requestId) {
              <span class="motivo">ID de petición: {{ fallo.requestId }}</span>
            }
          }
          @case ('forbidden') {
            {{ fallo.message ?? 'No tiene permiso para esta operación.' }}
          }
          @case ('not-found') {
            El grupo, el cargo o un dato elegido ya no existe.
          }
          @case ('offline') {
            Sin conexión: revise su red y vuelva a intentarlo.
          }
          @case ('error') {
            {{ fallo.message ?? 'Ocurrió un error inesperado.' }}
            (ID de petición: {{ fallo.requestId }})
          }
        }
      </app-alert>
    }
  `,
  styles: `
    .motivo {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupWriteError {
  readonly state = input<ViewState<never> | null>(null);
}
