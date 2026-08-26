import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type { ConversationListItem } from '../../../core/data-access/community/community.types';
import { avatarDeConQuien, conQuien } from '../../../core/messaging/con-quien';
import { tiempoRelativo } from '../../../shared/date/tiempo-relativo';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../shared/components/atoms/badge/badge';

/**
 * La lista de conversaciones, dibujada UNA sola vez.
 *
 * ## Por qué se extrajo
 *
 * La bandeja la dibujaba dentro de su propio template. Cuando el hilo pasó a
 * mostrar las conversaciones **al costado** —que es como se usa un chat: sin
 * perder de vista con quién más estás hablando— había dos salidas: copiar el
 * marcado, o extraerlo. Copiarlo deja dos listas que se separan en cuanto
 * alguien retoca una, y son la misma lista vista desde dos pantallas.
 *
 * No pide datos ni navega por su cuenta: recibe las conversaciones ya
 * resueltas y cada fila es un `routerLink`. Quién las carga es cosa de la
 * pantalla, que es la que sabe si además sondea.
 */
@Component({
  selector: 'app-conversation-list',
  imports: [Avatar, Badge, DatePipe, RouterLink],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationList {
  /** Las conversaciones, en el orden en que las devolvió el servidor. */
  readonly conversaciones = input.required<readonly ConversationListItem[]>();

  /**
   * Cuál está abierta, para marcarla. `null` en la bandeja, donde no hay
   * ninguna abierta todavía.
   */
  readonly activaId = input<string | null>(null);

  /**
   * Modo angosto, para el carril del hilo: se va la vista previa del último
   * mensaje y queda el nombre. En una columna de 18rem la vista previa se
   * corta a media palabra y no orienta a nadie.
   */
  readonly compacta = input(false);

  protected readonly conQuien = conQuien;
  protected readonly avatarDeConQuien = avatarDeConQuien;

  /** «hace 2 min», o `null` si ya pasó una semana (cae al `date` del template). */
  protected relativo(fecha: Date): string | null {
    return tiempoRelativo(fecha);
  }
}
