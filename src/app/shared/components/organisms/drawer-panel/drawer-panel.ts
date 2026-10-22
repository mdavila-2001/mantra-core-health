import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { nextControlId } from '@shared/forms/form-control.context';

/**
 * Cajón lateral derecho para ver o decidir sobre una fila sin dejar la lista.
 *
 * Es un `<dialog>` modal: el navegador atrapa el foco, cierra con `Escape` y
 * devuelve el foco a quien lo abrió. Cerrar con el velo o con `Escape` es
 * descartar, nunca confirmar — igual que el diálogo de confirmación.
 */
@Component({
  selector: 'app-drawer-panel',
  imports: [AppButton],
  templateUrl: './drawer-panel.html',
  styleUrl: './drawer-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerPanel {
  private readonly nativo = viewChild.required<ElementRef<HTMLDialogElement>>('nativeDrawer');

  /** Abierto o cerrado; el padre lo controla y el cajón lo apaga al cerrarse. */
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly subheading = input('');
  /** Etiqueta del botón de cerrar (nombre accesible). */
  readonly closeLabel = input('Cerrar panel');

  readonly closed = output<void>();

  protected readonly titleId = nextControlId('drawer-title');

  constructor() {
    effect(() => {
      const abierto = this.open();
      const dialogo = this.nativo().nativeElement;
      if (abierto && !dialogo.open) {
        if (typeof dialogo.showModal === 'function') dialogo.showModal();
        else dialogo.setAttribute('open', '');
      } else if (!abierto && dialogo.open) {
        if (typeof dialogo.close === 'function') dialogo.close();
        else dialogo.removeAttribute('open');
      }
    });
  }

  protected cerrar(): void {
    if (this.open()) {
      this.open.set(false);
      this.closed.emit();
    }
  }

  /** `Escape` llega como `cancel`: se lo escucha para que el estado del padre no quede abierto. */
  protected alCancelar(event: Event): void {
    event.preventDefault();
    this.cerrar();
  }

  protected alHacerClicEnElVelo(event: MouseEvent): void {
    const panel = this.nativo().nativeElement.querySelector('.drawer__panel');
    if (panel !== null && event.target instanceof Node && !panel.contains(event.target)) {
      this.cerrar();
    }
  }
}
