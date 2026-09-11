import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ConversationListItem } from '../../../core/data-access/community/community.types';
import { avatarDeConQuien, conQuien } from '../../../core/messaging/con-quien';
import { ChatPreferencias } from '../../../core/messaging/chat-preferencias';
import { horaDeChat } from '../../../shared/date/hora-de-chat';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';

/** Lo que la fila le pide a la pantalla que haga. */
export interface AccionDeFila {
  readonly tipo: 'favorito' | 'archivar' | 'leer' | 'perfil';
  readonly conversationId: string;
}

/**
 * La lista de conversaciones, con la anatomía que tiene en cualquier chat.
 *
 * ## Qué cambió y por qué
 *
 * Era una lista correcta pero no era una bandeja de chat: decía «hace 2 min» en
 * vez de la hora, no distinguía el último mensaje propio del ajeno, y en un
 * grupo no se sabía quién había escrito sin abrir. Las tres cosas se leen de un
 * vistazo en WhatsApp y son las que hacen que una bandeja sirva para decidir a
 * cuál entrar sin entrar a ninguna.
 *
 * No pide datos ni navega por su cuenta: recibe las conversaciones ya resueltas
 * y cada fila es un `routerLink`. Sí lee las preferencias del navegador
 * —favorito y archivado—, que son estado de vista y no datos del servidor.
 */
@Component({
  selector: 'app-conversation-list',
  imports: [Avatar, RouterLink],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationList {
  private readonly preferencias = inject(ChatPreferencias);

  /** Las conversaciones, en el orden en que las devolvió el servidor. */
  readonly conversaciones = input.required<readonly ConversationListItem[]>();

  /** Cuál está abierta, para marcarla. */
  readonly activaId = input<string | null>(null);

  /** El perfil propio: sin él no se puede decir «Tú:» ni pintar el tilde. */
  readonly perfilPropio = input<string | null>(null);

  /** Lo que se escribió en el buscador, para resaltarlo en el nombre. */
  readonly resaltar = input('');

  readonly accion = output<AccionDeFila>();

  /** Qué fila tiene el menú abierto. Una sola a la vez. */
  protected readonly menuAbierto = signal<string | null>(null);

  protected readonly conQuien = conQuien;
  protected readonly avatarDeConQuien = avatarDeConQuien;

  protected esFavorito(id: string): boolean {
    return this.preferencias.esFavorito(id);
  }

  protected estaArchivado(id: string): boolean {
    return this.preferencias.estaArchivado(id);
  }

  /** `8:00 p.m.`, `Ayer`, `lunes` o `07/09/2026`. */
  protected hora(conversacion: ConversationListItem): string {
    const cuando = conversacion.lastMessageAt;
    return cuando === undefined ? '' : horaDeChat(cuando);
  }

  /** `true` si el último mensaje lo escribió quien mira. */
  protected esPropio(conversacion: ConversationListItem): boolean {
    const propio = this.perfilPropio();
    return (
      propio !== null &&
      conversacion.lastMessage?.senderProfileId === propio
    );
  }

  /**
   * Quién escribió el último mensaje, cuando hace falta decirlo.
   *
   * Sólo en grupos: en una conversación de dos, el nombre ya está arriba y
   * repetirlo en cada fila es ruido. `Tú:` sí aparece en las dos, porque saber
   * si la pelota está en tu cancha es la mitad de para qué se mira una bandeja.
   */
  protected prefijo(conversacion: ConversationListItem): string {
    if (this.esPropio(conversacion)) {
      return '';
    }
    if (conversacion.peers.length <= 1) {
      return '';
    }
    const autor = conversacion.peers.find(
      (peer) => peer.profileId === conversacion.lastMessage?.senderProfileId,
    );
    return autor?.displayName === undefined ? '' : `${autor.displayName}: `;
  }

  /**
   * La vista previa del último mensaje.
   *
   * Un adjunto no tiene texto, así que sin esto la fila queda muda justo
   * cuando lo que pasó fue que te mandaron una foto. El contrato de la lista
   * todavía no dice de qué tipo era —está pedido al backend—, así que un
   * mensaje sin cuerpo se anuncia como archivo, que es lo único que puede ser.
   */
  protected vistaPrevia(conversacion: ConversationListItem): string {
    const cuerpo = conversacion.lastMessage?.bodyText;
    if (cuerpo !== undefined && cuerpo.trim() !== '') {
      return cuerpo;
    }
    return conversacion.lastMessage === undefined ? '' : 'Archivo adjunto';
  }

  /** `true` si el último mensaje es un adjunto sin texto. */
  protected esAdjunto(conversacion: ConversationListItem): boolean {
    const cuerpo = conversacion.lastMessage?.bodyText;
    return (
      conversacion.lastMessage !== undefined &&
      (cuerpo === undefined || cuerpo.trim() === '')
    );
  }

  /** `true` si es una conversación de grupo. */
  protected esGrupo(conversacion: ConversationListItem): boolean {
    return conversacion.groupId !== undefined || conversacion.peers.length > 1;
  }

  protected alternarMenu(id: string, evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.menuAbierto.set(this.menuAbierto() === id ? null : id);
  }

  protected ejecutar(tipo: AccionDeFila['tipo'], conversationId: string, evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.menuAbierto.set(null);
    this.accion.emit({ tipo, conversationId });
  }

  /**
   * El nombre partido en tres para resaltar lo buscado.
   *
   * Se resuelve acá y no en el template porque partir un texto por una
   * coincidencia sin distinguir mayúsculas no se escribe en una interpolación
   * sin volverla ilegible.
   */
  protected readonly partes = computed(() => {
    const consulta = this.resaltar().trim().toLowerCase();
    const mapa = new Map<string, readonly [string, string, string]>();
    for (const conversacion of this.conversaciones()) {
      const nombre = conQuien(conversacion);
      const desde =
        consulta === '' ? -1 : nombre.toLowerCase().indexOf(consulta);
      mapa.set(
        conversacion.id,
        desde === -1
          ? [nombre, '', '']
          : [
              nombre.slice(0, desde),
              nombre.slice(desde, desde + consulta.length),
              nombre.slice(desde + consulta.length),
            ],
      );
    }
    return mapa;
  });

  protected trozos(id: string): readonly [string, string, string] {
    return this.partes().get(id) ?? ['', '', ''];
  }
}
