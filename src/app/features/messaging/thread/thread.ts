import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import { MessageTemplates } from '../../../core/messaging/message-templates';
import { ChatSocketService } from '../../../core/messaging/chat-socket.service';
import type { DirectMessage } from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Cada cuánto se relee el hilo abierto, en milisegundos. */
const SONDEO_MS = 30_000;

/** Cuántos mensajes trae cada página. */
const PAGE_SIZE = 30;

/**
 * El hilo de una conversación — carril P2.
 *
 * ## El orden se invierte acá, no en el backend
 *
 * El contrato devuelve los mensajes **del más reciente al más antiguo** —es lo
 * correcto para paginar hacia atrás con un cursor— y una conversación se lee al
 * revés. La inversión es de la vista: pedirle al backend el orden de lectura
 * rompería la paginación, que es lo que hace que un hilo largo se pueda
 * recorrer.
 *
 * ## Marcar leído al abrir
 *
 * Abrir el hilo es haberlo leído. Se marca una vez al entrar y no en cada tic
 * de sondeo: marcar en cada tic escribiría un recibo por minuto por hilo
 * abierto, y el recibo es una fila, no un contador.
 *
 * ## Enter envía
 *
 * Y `Shift+Enter` hace salto de línea, que es lo que espera cualquiera que
 * haya usado un chat. Un botón «Enviar» sigue existiendo para quien navega con
 * teclado sin atajos y para quien usa lector de pantalla.
 */
@Component({
  selector: 'app-thread',
  imports: [Alert, AppButton, DatePipe, EmptyState, FormsModule, PageHeader],
  templateUrl: './thread.html',
  styleUrl: './thread.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Thread {
  private readonly community = inject(CommunityClient);
  private readonly route = inject(ActivatedRoute);
  private readonly plantillas = inject(MessageTemplates);
  private readonly chatSocket = inject(ChatSocketService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** El textarea, para poder darle el foco al llegar desde una notificación. */
  private readonly composer =
    viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private conversationId: string | null = null;
  private yaMarcado = false;

  protected readonly mensajes = signal<readonly DirectMessage[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly cargoAlgunaVez = signal(false);
  protected readonly borrador = signal('');

  /** Perfil público propio: es quién soy dentro del hilo. */
  protected readonly perfil = signal<string | null>(null);
  protected readonly perfilResuelto = signal(false);

  /** Con quién es la conversación, cuando se pudo resolver. */
  protected readonly conQuien = signal('Conversación');

  /**
   * Hasta qué `sentAt` leyó el otro lado — el doble check ✓✓. `null` si
   * todavía no leyó nada, o si el hilo es de grupo (no hay «el otro lado»).
   */
  protected readonly peerReadUpTo = signal<Date | null>(null);

  protected readonly hayMas = computed(() => this.cursor() !== null);
  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.mensajes().length === 0,
  );

  /** Los mensajes en orden de lectura: del más viejo al más nuevo. */
  protected readonly enOrden = computed(() => [...this.mensajes()].reverse());

  protected readonly puedeEnviar = computed(
    () => this.borrador().trim() !== '' && !this.enviando(),
  );

  /* --- Carril P9 · plantillas del profesional ---------------------------- */

  /** Si está abierta la lista de plantillas. */
  protected readonly plantillasAbiertas = signal(false);

  /** Las de fábrica más las propias. */
  protected readonly plantillasDisponibles = this.plantillas.todas;

  /** El texto de una plantilla nueva que se está escribiendo. */
  protected readonly plantillaNueva = signal('');

  protected alternarPlantillas(): void {
    this.plantillasAbiertas.set(!this.plantillasAbiertas());
  }

  /**
   * Pega una plantilla en el composer.
   *
   * **Reemplaza el borrador vacío y se agrega al que no lo está**: quien ya
   * escribió media frase y elige una plantilla la está agregando, no
   * descartando lo que escribió.
   */
  protected usarPlantilla(texto: string): void {
    const actual = this.borrador().trim();
    this.borrador.set(actual === '' ? texto : `${actual} ${texto}`);
    this.plantillasAbiertas.set(false);
    this.enfocarComposer();
  }

  /** Guarda la plantilla propia que se está escribiendo. */
  protected guardarPlantilla(): void {
    this.plantillas.agregar(this.plantillaNueva());
    this.plantillaNueva.set('');
  }

  /** Olvida una plantilla propia. Las de fábrica no se tocan. */
  protected olvidarPlantilla(texto: string): void {
    this.plantillas.quitar(texto);
  }

  /** `true` si la plantilla la agregó la persona y se puede quitar. */
  protected esPropia(texto: string): boolean {
    return this.plantillas.mias().includes(texto);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());

    // Por `paramMap` y no por `snapshot`: al ir de un hilo a otro el router
    // reutiliza el componente, y con el snapshot quedaría mostrando el
    // anterior.
    // Carril P9 · responder desde la notificación. La in-app de «mensaje
    // nuevo» navega con `?responder=1`, y entonces el hilo abre con el foco en
    // el textarea: es la mitad que faltaba de la ida y vuelta, porque llegar al
    // hilo y tener que buscar dónde escribir rompe el gesto.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (query.get('responder') !== null) {
        this.enfocarComposer();
      }
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const anterior = this.conversationId;
      if (anterior !== null) {
        this.chatSocket.leaveConversation(anterior);
      }
      this.conversationId = params.get('conversationId');
      this.yaMarcado = false;
      this.mensajes.set([]);
      this.cursor.set(null);
      this.cargoAlgunaVez.set(false);
      this.peerReadUpTo.set(null);
      this.resolverPerfil();
    });

    // Mensaje nuevo por WS: se agrega igual que un tic de sondeo, filtrado a
    // este hilo — la bandeja y otros hilos abiertos en otras pestañas también
    // reciben el evento, y no es asunto de este componente.
    this.chatSocket.onMessage.pipe(takeUntilDestroyed()).subscribe((mensaje) => {
      if (mensaje.conversationId === this.conversationId) {
        this.mergeNuevos([mensaje]);
      }
    });

    // Acuse de lectura por WS: mueve el doble check sin esperar el próximo tic.
    this.chatSocket.onRead.pipe(takeUntilDestroyed()).subscribe((evento) => {
      if (evento.conversationId !== this.conversationId) {
        return;
      }
      const leido = this.mensajes().find((m) => m.id === evento.lastReadMessageId);
      if (leido?.sentAt) {
        this.peerReadUpTo.set(leido.sentAt);
      }
    });
  }

  /**
   * Suma mensajes nuevos a los ya cargados, sin duplicar. Compartido por el
   * tic de sondeo y por el empuje del socket: es la misma operación, «me
   * enteré de mensajes que no tenía», sin importar por dónde llegó la noticia.
   */
  private mergeNuevos(items: readonly DirectMessage[]): void {
    const conocidos = new Set(this.mensajes().map((m) => m.id));
    const nuevos = items.filter((m) => !conocidos.has(m.id));
    if (nuevos.length > 0) {
      this.mensajes.update((lista) => [...nuevos, ...lista]);
    }
  }

  /** `true` si el mensaje lo escribió quien mira. */
  protected esPropio(mensaje: DirectMessage): boolean {
    return mensaje.senderProfileId === this.perfil();
  }

  /** `true` si un mensaje propio ya lo leyó el otro lado — pinta ✓✓ en vez de ✓. */
  protected leido(mensaje: DirectMessage): boolean {
    const hasta = this.peerReadUpTo();
    if (!this.esPropio(mensaje) || hasta === null || !mensaje.sentAt) {
      return false;
    }
    return mensaje.sentAt.getTime() <= hasta.getTime();
  }

  protected verMas(): void {
    this.cargar();
  }

  /** Enter envía; Shift+Enter hace salto de línea. */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
  }

  protected enviar(): void {
    const propio = this.perfil();
    const conversationId = this.conversationId;
    const texto = this.borrador().trim();
    if (propio === null || conversationId === null || texto === '') {
      return;
    }
    this.enviando.set(true);

    this.community
      .sendMessage(conversationId, { senderProfileId: propio, bodyText: texto })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.borrador.set('');
          // Se recarga en vez de insertar el mensaje a mano: el servidor le
          // pone la marca de envío y su id, y fabricarlos acá haría que la
          // burbuja cambiara de identidad en el próximo tic.
          this.recargar();
        },
        error: () => {
          this.enviando.set(false);
          this.error.set('No pudimos enviar tu mensaje.');
        },
      });
  }

  protected recargar(): void {
    this.mensajes.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.cargar();
  }

  /**
   * Resuelve el perfil propio y, de paso, con quién es el hilo.
   *
   * El nombre sale de la bandeja —que desde el carril P2 dice con quién es cada
   * conversación— y no de un endpoint nuevo: es una llamada que la pantalla
   * hace una vez, contra una lectura que ya existe.
   */
  private resolverPerfil(): void {
    if (this.perfil() !== null) {
      this.cargar();
      this.nombrarHilo(this.perfil()!);
      this.unirseAlHilo(this.perfil()!);
      return;
    }
    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        this.perfil.set(propio?.id ?? null);
        this.perfilResuelto.set(true);
        if (propio) {
          this.cargar();
          this.agendar();
          this.nombrarHilo(propio.id);
          this.unirseAlHilo(propio.id);
        }
      },
      error: () => {
        this.perfilResuelto.set(true);
        this.error.set('No pudimos saber si tenés perfil público.');
      },
    });
  }

  private unirseAlHilo(profileId: string): void {
    if (this.conversationId !== null) {
      this.chatSocket.joinConversation(this.conversationId, profileId);
    }
  }

  private nombrarHilo(profileId: string): void {
    this.community.listConversations({ profileId, limit: 50 }).subscribe({
      next: (pagina) => {
        const hilo = pagina.items.find(
          (item) => item.id === this.conversationId,
        );
        const nombres = (hilo?.peers ?? [])
          .map((peer) => peer.displayName)
          .filter((nombre): nombre is string => nombre !== undefined);
        if (nombres.length > 0) {
          this.conQuien.set(nombres.join(', '));
        }
      },
      // Sin nombre el hilo sigue siendo usable: se queda con «Conversación».
      error: () => undefined,
    });
  }

  private cargar(): void {
    const propio = this.perfil();
    const conversationId = this.conversationId;
    if (propio === null || conversationId === null || this.cargando()) {
      return;
    }
    this.cargando.set(true);

    const cursor = this.cursor();
    this.community
      .listMessages(conversationId, {
        profileId: propio,
        limit: PAGE_SIZE,
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.mensajes.update((lista) => [...lista, ...pagina.items]);
          this.cursor.set(pagina.nextCursor);
          this.cargoAlgunaVez.set(true);
          this.cargando.set(false);
          this.error.set('');
          this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
          this.marcarLeido(conversationId, propio);
        },
        error: () => {
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
          this.error.set('No pudimos cargar la conversación.');
        },
      });
  }

  /** Una vez por apertura del hilo, no una por tic. */
  private marcarLeido(conversationId: string, profileId: string): void {
    if (this.yaMarcado) {
      return;
    }
    this.yaMarcado = true;
    this.community.markConversationRead(conversationId, profileId).subscribe({
      // El acuse no cambia nada de la pantalla; que falle no vale un cartel.
      error: () => undefined,
    });
  }

  /**
   * Encadena el próximo tic, que relee **la primera página**.
   *
   * Releer sólo la primera y no todo lo paginado es deliberado: lo nuevo llega
   * arriba, y volver a pedir las cinco páginas que alguien fue abriendo hacia
   * atrás sería releer una conversación entera cada 30 segundos.
   */
  private agendar(): void {
    if (!this.isBrowser) {
      return;
    }
    this.temporizador = setTimeout(() => {
      const propio = this.perfil();
      const conversationId = this.conversationId;
      if (propio !== null && conversationId !== null && !this.cargando()) {
        this.community
          .listMessages(conversationId, { profileId: propio, limit: PAGE_SIZE })
          .subscribe({
            next: (pagina) => {
              this.mergeNuevos(pagina.items);
              this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
            },
            error: () => undefined,
          });
      }
      this.agendar();
    }, SONDEO_MS);
  }

  /**
   * Mueve el foco al composer.
   *
   * En el próximo cuadro y no en el acto: al llegar por navegación el textarea
   * todavía no existe —la rama que lo pinta depende del perfil resuelto—, y un
   * foco sobre `null` no falla pero tampoco hace nada.
   */
  private enfocarComposer(): void {
    if (!this.isBrowser) {
      return;
    }
    setTimeout(() => this.composer()?.nativeElement.focus(), 0);
  }

  private detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    if (this.conversationId !== null) {
      this.chatSocket.leaveConversation(this.conversationId);
    }
  }
}
