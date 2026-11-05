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
import {
  conversationAvatar,
  conversationLabel,
  conversationVerification,
} from '../../../core/messaging/conversation-label';
import { ChatPreferences } from '../../../core/messaging/chat-preferences';
import { chatTime } from '../../../shared/date/chat-time';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';
import { VerificationBadge } from '../../../shared/components/atoms/verification-badge/verification-badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { vistaPreviaDe, type VistaPrevia } from './preview';

/**
 * Qué muestra la bandeja: un `ViewState` del M34 (ADR-0005), el mismo que
 * calcula `ChatStore.bandeja`.
 *
 * - `loading` (S2) — esqueletos con la forma de las filas.
 * - `empty` (S3) — todavía no hay chats, con la próxima acción a la vista.
 * - `offline` (S8) — no hubo respuesta: «Sin conexión» y reintentar.
 * - `forbidden` (S5) — con este perfil no se leen estos chats.
 * - `error` (S9) — inesperado, con el código de la petición para soporte.
 * - `ready` y `stale` (S7) — las filas; en S7, además, de cuándo son.
 */
export type EstadoDeBandeja = ViewState<unknown>;

/** Cuántas filas fantasma se pintan mientras carga: lo que entra en un teléfono. */
const FILAS_FANTASMA = 7;

/** Lo que la fila le pide a la pantalla que haga. */
export interface AccionDeFila {
  readonly tipo: 'favorito' | 'archivar' | 'leer' | 'perfil' | 'bloquear' | 'desbloquear';
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
  imports: [AppButton, AppButtonLink, Avatar, EmptyState, RouterLink, Skeleton, VerificationBadge, ViewStateHost],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationList {
  private readonly preferencias = inject(ChatPreferences);

  /** Las conversaciones, en el orden en que las devolvió el servidor. */
  readonly conversaciones = input.required<readonly ConversationListItem[]>();

  /** Cuál está abierta, para marcarla. */
  readonly activaId = input<string | null>(null);

  /** El perfil propio: sin él no se puede decir «Enviado por usted» ni pintar el tilde. */
  readonly perfilPropio = input<string | null>(null);

  /** A quiénes bloqueó la persona: sus filas lo dicen y el menú ofrece desbloquear. */
  readonly bloqueados = input<ReadonlySet<string>>(new Set());

  /** Lo que se escribió en el buscador, para resaltarlo en el nombre. */
  readonly resaltar = input('');

  /** Qué pintar: las filas, o el estado que las reemplaza. */
  readonly estado = input<EstadoDeBandeja>(ready(null));

  /** El motivo de S5 o S9, dicho una sola vez (no en título y descripción). */
  protected readonly motivo = computed(() => {
    const estado = this.estado();
    if (estado.status === 'forbidden') {
      return estado.message ?? 'Con este perfil no puede leer estos chats.';
    }
    if (estado.status === 'error') {
      return estado.message ?? 'No pudimos leer su bandeja.';
    }
    return '';
  });

  /** El id de la petición de S9, para que soporte la encuentre. */
  protected readonly requestId = computed(() => {
    const estado = this.estado();
    return estado.status === 'error' ? estado.requestId : '';
  });

  readonly accion = output<AccionDeFila>();

  /** Quien mira pidió volver a leer la bandeja después de un error. */
  readonly reintentar = output<void>();

  protected readonly fantasmas = Array.from({ length: FILAS_FANTASMA }, (_, i) => i);

  /** Qué fila tiene el menú abierto. Una sola a la vez. */
  protected readonly menuAbierto = signal<string | null>(null);

  protected readonly conQuien = conversationLabel;
  protected readonly verificacionDe = conversationVerification;
  protected readonly avatarDeConQuien = conversationAvatar;

  protected esFavorito(id: string): boolean {
    return this.preferencias.isFavorite(id);
  }

  protected estaArchivado(id: string): boolean {
    return this.preferencias.isArchived(id);
  }

  /** `8:00 p.m.`, `Ayer`, `lunes` o `07/09/2026`. */
  protected hora(conversacion: ConversationListItem): string {
    const cuando = conversacion.lastMessageAt;
    return cuando === undefined ? '' : chatTime(cuando);
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
   * repetirlo en cada fila es ruido. El tilde propio sí aparece en las dos, porque saber
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
   * La vista previa de cada fila, resuelta una vez por lista.
   *
   * Qué tipo de mensaje fue —texto, tarjeta del pedido, sticker, archivo— lo
   * decide {@link vistaPreviaDe}; acá sólo se indexa por conversación para no
   * volver a leer la tarjeta en cada ciclo de detección.
   */
  private readonly vistasPrevias = computed(() => {
    const mapa = new Map<string, VistaPrevia>();
    for (const conversacion of this.conversaciones()) {
      mapa.set(conversacion.id, vistaPreviaDe(conversacion.lastMessage));
    }
    return mapa;
  });

  protected vistaPrevia(conversacion: ConversationListItem): VistaPrevia {
    return this.vistasPrevias().get(conversacion.id) ?? vistaPreviaDe(conversacion.lastMessage);
  }

  /** `true` si es una conversación de grupo. */
  protected esGrupo(conversacion: ConversationListItem): boolean {
    return conversacion.groupId !== undefined || conversacion.peers.length > 1;
  }

  /** `true` si es una conversación directa con alguien que se bloqueó. */
  protected estaBloqueada(conversacion: ConversationListItem): boolean {
    return (
      conversacion.peers.length === 1 &&
      this.bloqueados().has(conversacion.peers[0].profileId)
    );
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(null);
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
      const nombre = conversationLabel(conversacion);
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
