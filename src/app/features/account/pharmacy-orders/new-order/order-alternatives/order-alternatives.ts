import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { NOTA_DE_DATOS_DE_EJEMPLO, type AlternativaDeEjemplo } from '../new-order.fixtures';
import { displayCurrency } from '../../../../../core/money/display-currency';

/**
 * **Las alternativas de un renglón** (T-E1 · F2.1.5). Presentacional: recibe
 * las opciones y emite la elección; la confirmación decide qué hacer con ella.
 *
 * Las opciones son de ejemplo y el panel lo dice. Elegir una no toca el
 * pedido real: la sustitución que la farmacia propone después sigue siendo la
 * del detalle del pedido.
 */
@Component({
  selector: 'app-order-alternatives',
  imports: [AppButton, Badge],
  templateUrl: './order-alternatives.html',
  styleUrl: './order-alternatives.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderAlternatives {
  /** El nombre del medicamento recetado, para decir contra qué se compara. */
  readonly recetada = input.required<string>();
  readonly alternativas = input.required<readonly AlternativaDeEjemplo[]>();
  readonly moneda = input<string | null>(null);

  /** Cómo se escribe esa moneda en pantalla: «Bs». Ver `display-currency.ts`. */
  protected readonly monedaVisible = computed(() => displayCurrency(this.moneda()));
  /** La alternativa ya elegida en este renglón, o `null`. */
  readonly elegidaId = input<string | null>(null);

  readonly elegir = output<AlternativaDeEjemplo>();
  /** Volver a la recetada. */
  readonly restaurar = output<void>();

  protected readonly nota = NOTA_DE_DATOS_DE_EJEMPLO;
}
