import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChildren } from '@angular/core';

import type { InboxTab } from './inbox-model';

/** Una pestaña de la bandeja: su rótulo y cuántas conversaciones tiene. */
export interface InboxTabOption {
  readonly value: InboxTab;
  readonly label: string;
  readonly count: number;
}

/**
 * Las pestañas de la bandeja (**Nuevos / Míos / Del equipo / Esperando al
 * doctor / Resueltos**), cada una con su cuenta.
 *
 * Es una lista de pestañas de verdad (`tablist` + `tab`): flechas, Inicio y Fin
 * mueven y eligen, y solo la elegida entra en el orden de tabulación. Las
 * pestañas **se parten en líneas** en lugar de recortar su rótulo: «Esperando al
 * doctor» tiene que leerse entero aun en la columna angosta de la lista.
 */
@Component({
  selector: 'app-inbox-tabs',
  templateUrl: './inbox-tabs.html',
  styleUrl: './inbox-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxTabs {
  readonly tabs = input.required<readonly InboxTabOption[]>();
  readonly value = input.required<InboxTab>();
  /** El `id` del panel que controlan las pestañas. */
  readonly panelId = input.required<string>();
  readonly ariaLabel = input('Estado de las conversaciones');

  readonly valueChange = output<InboxTab>();

  private readonly botones = viewChildren<ElementRef<HTMLButtonElement>>('boton');

  protected elegir(valor: InboxTab): void {
    if (valor !== this.value()) this.valueChange.emit(valor);
  }

  protected alTeclado(event: KeyboardEvent, desde: number): void {
    const total = this.tabs().length;
    let destino: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        destino = (desde + 1) % total;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        destino = (desde - 1 + total) % total;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = total - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.botones()[destino]?.nativeElement.focus({ preventScroll: true });
    this.elegir(this.tabs()[destino]!.value);
  }
}
