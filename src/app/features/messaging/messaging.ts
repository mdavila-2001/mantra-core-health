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
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { CommunityClient } from '../../core/data-access/community/community.client';
import { ChatSocketService } from '../../core/messaging/chat-socket.service';
import { conQuien } from '../../core/messaging/con-quien';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ConversationListItem,
  PublicDirectoryResult,
} from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { ConversationList } from './conversation-list/conversation-list';

/** Cada cuánto se relee la bandeja, en milisegundos. */
const SONDEO_MS = 60_000;

/**
 * Un slug legible a partir del nombre, con una cola al azar.
 *
 * La cola no es decoración: el slug es único en toda la plataforma y hay más de
 * una «María López». Sin ella, la segunda que entra a los chats se choca con un
 * 409 en el peor momento —al pulsar «crear mi perfil»— y no tiene forma de
 * arreglarlo desde esa pantalla.
 */
function slugDe(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const cola = Math.random().toString(36).slice(2, 8);
  return `${base === '' ? 'perfil' : base}-${cola}`;
}

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
  imports: [Alert, AppButton, ConversationList, EmptyState, FormsModule],
  templateUrl: './messaging.html',
  styleUrl: './messaging.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Messaging {
  private readonly community = inject(CommunityClient);
  private readonly chatSocket = inject(ChatSocketService);
  private readonly sesion = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
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

  /** Mientras se crea la vitrina desde el estado vacío. */
  protected readonly creandoPerfil = signal(false);

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
          this.atenderEscribirA();
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

  /** Con quién es cada conversación. Lo dibuja `app-conversation-list`. */
  protected readonly conQuien = conQuien;

  /**
   * Crea la vitrina pública que la mensajería necesita, sin salir de acá.
   *
   * Antes esto era un cartel que mandaba a «Mi perfil» a buscar un formulario:
   * quien entra a los chats quiere chatear, y hacerle recorrer otra sección
   * para volver es exactamente la fricción que dejaba la pantalla muerta para
   * cualquiera recién registrado.
   *
   * Se crea con lo mínimo —nombre y slug— y **sin publicarla en el directorio**:
   * `visibility` va omitido a propósito, porque aparecer en la guía pública es
   * una decisión aparte que se toma en «Mi perfil», no un efecto secundario de
   * querer escribirle a alguien.
   */
  protected crearPerfil(): void {
    const tenantId = this.sesion.activeTenantId();
    if (tenantId === null || this.creandoPerfil()) {
      this.error.set(
        tenantId === null ? 'No pudimos saber en qué organización estás.' : '',
      );
      return;
    }

    const nombre = this.sesion.displayName() ?? 'Mi perfil';
    this.creandoPerfil.set(true);
    this.community
      .upsertOwnProfile({ tenantId, slug: slugDe(nombre), displayName: nombre })
      .subscribe({
        next: (propio) => {
          this.creandoPerfil.set(false);
          this.perfil.set(propio.id);
          this.cargar();
          this.agendar();
          this.chatSocket.joinInbox(propio.id);
        },
        error: () => {
          this.creandoPerfil.set(false);
          this.error.set('No pudimos crear tu perfil. Probá de nuevo.');
        },
      });
  }

  /**
   * Atiende el `?escribirA=<slug>` con el que llega el botón «Enviar mensaje»
   * de una ficha pública.
   *
   * Se ejecuta recién cuando se sabe cuál es el perfil propio: sin eso no hay
   * con qué abrir el hilo. Si a quien llega le falta el perfil, no pasa nada
   * malo —ve el estado vacío que se lo ofrece crear— y basta con volver a
   * entrar desde la ficha.
   */
  private atenderEscribirA(): void {
    const slug = this.ruta.snapshot.queryParamMap.get('escribirA');
    if (slug !== null && slug !== '') {
      this.abrirConSlug(slug);
    }
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
    this.abrirConSlug(resultado.slug);
  }

  /**
   * Abre —o crea— el hilo con quien tenga ese slug.
   *
   * Son dos llamadas y no una porque la superficie pública devuelve `slug` y no
   * `profileId`: no publica identificadores internos. La segunda es idempotente
   * desde este carril: si el hilo ya existe, el backend devuelve ése.
   *
   * Lo usan dos caminos: el buscador de acá y el botón «Enviar mensaje» de la
   * ficha pública, que llega por `?escribirA=<slug>`.
   */
  private abrirConSlug(slug: string): void {
    const propio = this.perfil();
    if (propio === null || this.abriendo()) {
      return;
    }
    this.abriendo.set(true);

    this.community.readProfileBySlug(slug).subscribe({
      next: (ficha) => {
        // Uno no se escribe a sí mismo. Sin esto, «Enviar mensaje» en la propia
        // ficha pública pedía una conversación con un solo participante
        // repetido y el backend devolvía **otra** conversación cualquiera de
        // las suyas: se abría un hilo ajeno al que se pidió.
        if (ficha.id === propio) {
          this.abriendo.set(false);
          this.error.set('Ese es tu propio perfil: no podés escribirte.');
          return;
        }

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
