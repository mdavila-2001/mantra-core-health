import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AppButton } from '../../../../shared/components/atoms/button/button';

/**
 * Takes the composer's place while messages are selected: how many, cancel,
 * and forward them.
 */
@Component({
  selector: 'app-selection-bar',
  imports: [AppButton],
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionBar {
  readonly cantidad = input.required<number>();
  readonly reenviar = output<void>();
  readonly cancelar = output<void>();

  protected readonly texto = computed(() =>
    this.cantidad() === 1 ? '1 seleccionado' : `${this.cantidad()} seleccionados`,
  );
}
