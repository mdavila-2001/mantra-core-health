import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CommunityClient } from '../../core/data-access/community/community.client';
import { ChatSocketService } from '../../core/messaging/chat-socket.service';
import type {
  ConversationListItem,
  PublicDirectoryResult,
} from '../../core/data-access/community/community.types';
import { tiempoRelativo } from '../../shared/date/tiempo-relativo';
import { Avatar } from '../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Cada cuánto se relee la bandeja, en milisegundos. */
const SONDEO_MS = 60_000;

/**
 * La bandeja de mensajería directa — carril P2.
 *
 * ## Sobre `community.conversations`, no sobre el módulo 35
 *
 * Decisión tomada y no reabierta: el backend de mensajes directos ya existe
 * completo en `community` (conversaciones, participantes, mensajes, recibos).
 * El módulo 35 es el canal de **notificaciones** —la campana de P1—, y duplicar
 * el chat ahí sería tener dos mensajerías que se contradicen.
 *
 * ## Quién es «yo» acá
 *
 * El perfil público de `community`, que **no** es el perfil de paciente que
 * trae el token: son entidades distintas y hay que preguntarle al backend cuál
 * es el propio. Quien todavía no lo creó ve una puerta —cómo crearlo—, no una
 * pantalla rota.
 *
 * ## Sondeo cada 60 s, y ahora también WebSocket
 *
 * La decisión D2 original rechazaba WebSockets; se reabre a pedido explícito
 * para que la bandeja se entere en vivo de un mensaje nuevo. El socket es
 * **aditivo**: el sondeo de 60 s sigue igual, como red de seguridad si el
 * socket se cae — el minuto sigue siendo cuánto puede tardar en notarse un
 * mensaje si el WS falló, no el mecanismo normal de entrega. Bajo SSR ninguno
 * de los dos corre — el servidor pinta la lista que ya tiene.
 */
@Component({
  selector: 'app-messaging',
  imports: [
    Alert,
    AppButton,
    Avatar,
    Badge,
    DatePipe,
    EmptyState,
    FormsModule,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './messaging.html',
  styleUrl: './messaging.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Messaging {
  private readonly community = inject(CommunityClient);
  private readonly chatSocket = inject(ChatSocketService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  protected readonly conversaciones = signal<readonly ConversationListItem[]>(
    [],
  );
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly cargoAlgunaVez = signal(false);

  /** Perfil público propio, o `null` si todavía no lo creó. */
  protected readonly perfil = signal<string | null>(null);
  protected readonly perfilResuelto = signal(false);

  /** Si está abierto el buscador de «escribirle a alguien». */
  protected readonly buscando = signal(false);
  protected readonly consulta = signal('');
  protected readonly resultados = signal<readonly PublicDirectoryResult[]>([]);
  protected readonly buscandoAhora = signal(false);
  protected readonly abriendo = signal(false);

  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.conversaciones().length === 0,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());

    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        this.perfil.set(propio?.id ?? null);
        this.perfilResuelto.set(true);
        if (propio) {
          this.cargar();
          this.agendar();
          this.chatSocket.joinInbox(propio.id);
        }
      },
      error: () => {
        this.perfilResuelto.set(true);
        this.error.set('No pudimos saber si tenés perfil público.');
      },
    });

    // Mensaje nuevo o conversación nueva: releer la bandeja. No se inserta a
    // mano — el servidor decide unread/lastMessage/orden, releer es lo único
    // que garantiza que la fila quede consistente con lo que pintaría un
    // refresco de página.
    this.chatSocket.onMessage
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cargar());
    this.chatSocket.onNewConversation
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cargar());
  }

  /** «hace 2 min», o `null` si ya pasó más de una semana (cae al `date:'short'` del template). */
  protected relativo(fecha: Date): string | null {
    return tiempoRelativo(fecha);
  }

  /** Con quién es la conversación, en una línea. */
  protected conQuien(conversacion: ConversationListItem): string {
    const nombres = conversacion.peers
      .map((peer) => peer.displayName)
      .filter((nombre): nombre is string => nombre !== undefined);
    // Sin nombre resuelto se dice «Conversación» y no el uuid: un
    // identificador en la bandeja no le dice nada a nadie.
    return nombres.length === 0 ? 'Conversación' : nombres.join(', ');
  }

  protected alternarBusqueda(): void {
    this.buscando.set(!this.buscando());
    if (!this.buscando()) {
      this.resultados.set([]);
      this.consulta.set('');
    }
  }

  /** Busca profesionales en el directorio público. */
  protected buscar(): void {
    const q = this.consulta().trim();
    this.buscandoAhora.set(true);
    this.community.searchPractitioners(q, 10).subscribe({
      next: (items) => {
        this.resultados.set(items);
        this.buscandoAhora.set(false);
      },
      error: () => {
        this.buscandoAhora.set(false);
        this.error.set('No pudimos buscar profesionales.');
      },
    });
  }

  /**
   * Abre el hilo con alguien del directorio.
   *
   * Son dos llamadas y no una porque el buscador público devuelve `slug` y no
   * `profileId` —la superficie sin sesión no publica identificadores
   * internos—, así que primero se resuelve la ficha y después se abre la
   * conversación. La segunda es idempotente desde este carril: si el hilo ya
   * existe, el backend devuelve ése.
   */
  protected escribirA(resultado: PublicDirectoryResult): void {
    const propio = this.perfil();
    if (propio === null || this.abriendo()) {
      return;
    }
    this.abriendo.set(true);

    this.community.readProfileBySlug(resultado.slug).subscribe({
      next: (ficha) => {
        this.community
          .createConversation({
            participantProfileIds: [propio, ficha.id],
          })
          .subscribe({
            next: ({ id }) => {
              this.abriendo.set(false);
              void this.router.navigate(['/messaging', id]);
            },
            error: () => {
              this.abriendo.set(false);
              this.error.set('No pudimos abrir la conversación.');
            },
          });
      },
      error: () => {
        this.abriendo.set(false);
        this.error.set('No pudimos encontrar a esa persona.');
      },
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.cargando.set(true);
    this.community.listConversations({ profileId: propio, limit: 50 }).subscribe({
      next: (pagina) => {
        this.conversaciones.set(pagina.items);
        this.cargoAlgunaVez.set(true);
        this.cargando.set(false);
        this.error.set('');
      },
      error: () => {
        this.cargando.set(false);
        this.cargoAlgunaVez.set(true);
        // No se vacía lo que ya había: un tic fallido no es motivo para
        // borrarle a alguien la bandeja que estaba mirando.
        this.error.set('No pudimos cargar tus conversaciones.');
      },
    });
  }

  /** Encadena el próximo tic. Nunca hay dos vivos a la vez. */
  private agendar(): void {
    if (!this.isBrowser) {
      return;
    }
    this.temporizador = setTimeout(() => {
      this.cargar();
      this.agendar();
    }, SONDEO_MS);
  }

  private detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}
