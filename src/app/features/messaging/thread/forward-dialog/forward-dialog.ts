import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import type { ConversationListItem } from '../../../../core/data-access/community/community.types';
import {
  conversationAvatar,
  conversationLabel,
} from '../../../../core/messaging/conversation-label';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * Choose the chats to forward to: several at once, with a search box.
 *
 * Built on `app-content-dialog` (native modal: focus trap, inert background,
 * Escape). It only chooses: the thread sends.
 */
@Component({
  selector: 'app-forward-dialog',
  imports: [AppButton, Avatar, ContentDialog],
  templateUrl: './forward-dialog.html',
  styleUrl: './forward-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForwardDialog {
  readonly destinos = input.required<readonly ConversationListItem[]>();
  /** How many messages are being forwarded, for the summary line. */
  readonly cantidad = input.required<number>();
  readonly enviar = output<readonly string[]>();
  readonly cerrado = output<void>();

  protected readonly filtro = signal('');
  protected readonly elegidos = signal<ReadonlySet<string>>(new Set());
  protected readonly nombre = conversationLabel;
  protected readonly avatar = conversationAvatar;

  protected readonly visibles = computed(() => {
    const termino = this.filtro().trim().toLocaleLowerCase('es');
    return termino === ''
      ? this.destinos()
      : this.destinos().filter((d) => conversationLabel(d).toLocaleLowerCase('es').includes(termino));
  });

  protected readonly resumen = computed(() =>
    this.cantidad() === 1 ? 'Reenviar 1 mensaje' : `Reenviar ${this.cantidad()} mensajes`,
  );

  protected readonly etiquetaDelBoton = computed(() => {
    const n = this.elegidos().size;
    return n === 0 ? 'Reenviar' : n === 1 ? 'Reenviar a 1 chat' : `Reenviar a ${n} chats`;
  });

  private readonly dialogo = viewChild.required(ContentDialog);

  protected alternar(id: string): void {
    this.elegidos.update((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(id)) nuevo.add(id);
      return nuevo;
    });
  }

  protected confirmar(): void {
    // Inbox order, not click order: predictable for whoever reads the toast.
    const ids = this.destinos().map((d) => d.id).filter((id) => this.elegidos().has(id));
    if (ids.length === 0) return;
    this.enviar.emit(ids);
    this.dialogo().close(true);
  }
}
