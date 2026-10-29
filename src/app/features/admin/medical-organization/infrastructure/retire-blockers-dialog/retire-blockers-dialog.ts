import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { RetireBlocker } from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { antiguedadEnPalabras, minutosDesde, rutaDeEspacio, tituloDeBloqueo } from '../infrastructure.view';

/**
 * **Lo que impide clausurar**, con la próxima acción de cada bloqueo (S3).
 *
 * Una clausura no se hace con dependencias vivas (INV-11): hijos vigentes,
 * pacientes internados, cirugías futuras, citas, recursos agendables, stock,
 * equipos. La API los enumera con `count`, algunos `sampleIds` y un
 * `nextAction`; este diálogo los muestra **sin ocultar ninguno** y con la salida
 * de cada uno. Los que son espacios hijos enlazan a su ficha; los demás ids
 * pertenecen a otros módulos y se muestran como referencia.
 *
 * «Clausurar» no se ofrece acá: mientras haya un bloqueo no hay nada que
 * confirmar. Se resuelve lo pendiente —en esta u otra pantalla— y «Volver a
 * comprobar» pide la lista otra vez. Esa lista es informativa: la API revalida
 * dentro de la transacción de clausura (puede aparecer un bloqueo nuevo entre
 * una y otra), por eso lleva su antigüedad visible (S7).
 */
@Component({
  selector: 'app-retire-blockers-dialog',
  imports: [AppButton, Badge, ContentDialog, RouterLink],
  templateUrl: './retire-blockers-dialog.html',
  styleUrl: './retire-blockers-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetireBlockersDialog {
  readonly spaceName = input.required<string>();
  readonly spaceCode = input.required<string>();
  readonly blockers = input.required<readonly RetireBlocker[]>();
  /** Momento de la comprobación, para decir cuán vieja es la lista. */
  readonly asOf = input<string | null>(null);
  /** Hay una nueva comprobación en curso. */
  readonly checking = input(false);

  readonly recheck = output<void>();
  readonly closed = output<void>();

  protected readonly titulo = tituloDeBloqueo;
  protected readonly rutaDeEspacio = rutaDeEspacio;

  protected readonly antiguedad = computed(() => {
    const a = this.asOf();
    return a === null ? null : antiguedadEnPalabras(minutosDesde(a));
  });

  protected readonly total = computed(() => this.blockers().reduce((n, b) => n + b.count, 0));

  protected esEspacio(b: RetireBlocker): boolean {
    return b.kind === 'ACTIVE_CHILDREN';
  }
}
