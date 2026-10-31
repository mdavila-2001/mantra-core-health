import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DischargeForm } from './discharge-form';

/**
 * Egreso desde el tablero: el mismo `DischargeForm` de la ficha (M7) dentro
 * de un `ContentDialog`. El error de la API se ve en el formulario.
 */
@Component({
  selector: 'app-discharge-dialog',
  imports: [ContentDialog, DischargeForm],
  template: `
    <app-content-dialog heading="Dar de alta" [description]="'Paciente de la cama ' + bedCode() + '.'" [dismissible]="!busy()" (closed)="closed.emit()">
      <app-discharge-form
        [encounterId]="encounterId()"
        [rowVersion]="rowVersion()"
        [isolated]="isolated()"
        [cancellable]="true"
        (busy)="busy.set($event)"
        (saved)="saved.emit($event)"
        (cancelled)="closed.emit()"
      />
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DischargeDialog {
  readonly encounterId = input.required<string>();
  readonly rowVersion = input.required<number>();
  readonly bedCode = input('');
  readonly isolated = input(false);
  readonly saved = output<string>();
  readonly closed = output<void>();
  protected readonly busy = signal(false);
}
