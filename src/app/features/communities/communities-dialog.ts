import { ChangeDetectionStrategy, Component, computed, output, viewChild } from '@angular/core';

import { AppButton } from '../../shared/components/atoms/button/button';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import { Communities } from './communities';

/**
 * **Comunidades** en un modal amplio.
 *
 * Es lo que abre la tarjeta «Grupos y foros» de «Tus accesos» (corrección del
 * 10/09/2026): el acceso conserva su nombre —renombrarlo no se pidió— y lo que
 * cambia es lo que abre, que ya no es una rejilla plana de grupos.
 *
 * ## El «Volver» del pie es el de la navegación interna
 *
 * Y no el que cierra: dentro del modal se baja de comunidades a una comunidad y
 * de ahí a un grupo, y el gesto de volver tiene que deshacer **ese** paso. Con
 * un solo botón que cerrara, salir de un grupo costaba cerrar el modal y volver
 * a entrar desde el principio.
 *
 * ## `size="xl"` porque adentro hay dos columnas
 *
 * La lista de comunidades más el panel de la comunidad o la conversación de un
 * grupo. En un ancho de formulario, la conversación quedaba en una columna de
 * 20rem con el nombre de cada quien partido en dos renglones.
 */
@Component({
  selector: 'app-communities-dialog',
  imports: [AppButton, Communities, ContentDialog],
  template: `
    <app-content-dialog
      heading="Comunidades"
      [description]="comunidades()?.rastro() ?? null"
      size="xl"
      (closed)="closed.emit()"
    >
      <app-communities />

      @if (comunidades(); as vista) {
        @if (vista.nivel() !== 'comunidades') {
          <button
            dialog-actions
            app-button
            type="button"
            variant="outline"
            data-testid="comunidades-volver"
            (clicked)="vista.volver()"
          >
            Volver
          </button>
        }
      }
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunitiesDialog {
  /** Se cerró. Quien lo escucha baja la bandera que lo montó. */
  readonly closed = output<void>();

  /**
   * Sin `required`: la plantilla lo consulta en el mismo pase en el que se
   * crea, y un `viewChild.required` ahí revienta antes de que exista.
   */
  protected readonly comunidades = viewChild(Communities);

  /** El nivel de la navegación interna, para quien quiera saberlo. */
  readonly nivel = computed(() => this.comunidades()?.nivel() ?? 'comunidades');
}
