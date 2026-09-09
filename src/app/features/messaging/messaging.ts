import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { debounceTime, filter, map, Subject } from 'rxjs';

import { ChatStore } from '../../core/messaging/chat.store';
import { ChatPreferencias } from '../../core/messaging/chat-preferencias';
import { conQuien } from '../../core/messaging/con-quien';
import type { ConversationListItem } from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { ConversationList, type AccionDeFila } from './conversation-list/conversation-list';

/** Los cuatro filtros de la bandeja, en el orden en que se muestran. */
const FILTROS = ['todos', 'no-leidos', 'favoritos', 'grupos'] as const;

type Filtro = (typeof FILTROS)[number];

/** Cuánto se espera antes de preguntarle al directorio, al tipear. */
const ESPERA_DE_BUSQUEDA_MS = 300;

/**
 * El marco de la mensajería — carril P2.
 *
 * ## Una sola pantalla
 *
 * La bandeja y el hilo eran dos pantallas hermanas: abrir una conversación
 * destruía la lista y la volvía a pedir. Ahora esto es el marco —lista a la
 * izquierda, `router-outlet` a la derecha— y el hilo es una ruta **hija**: al
 * cambiar de conversación la lista no se entera, que es lo primero que separa
 * esto de un chat de verdad.
 *
 * El estado no vive acá sino en `ChatStore`, que es de la aplicación y no de la
 * pantalla: el hilo lee del mismo store y por eso no necesita volver a pedir
 * nada para saber con quién está hablando.
 *
 * ## El buscador busca dos cosas
 *
 * Lo que se escribe filtra **las conversaciones que ya tenés** y, en paralelo,
 * busca **gente a la que todavía no le escribiste**. Son las dos razones por
 * las que alguien abre un buscador de chat, y separarlas en dos cajas —una
 * arriba y otra detrás de un botón— obligaba a saber de antemano cuál de las
 * dos cosas estabas por hacer.
 */
@Component({
  selector: 'app-messaging',
  imports: [
    Alert,
    AppButton,
    ConversationList,
    EmptyState,
    FormsModule,
    RouterOutlet,
  ],
  templateUrl: './messaging.html',
  styleUrl: './messaging.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El chat ocupa la ventana entera: el marco de la aplicación le saca su
    // relleno sólo a esta pantalla. Sin esto el hilo quedaría con 40 px de aire
    // alrededor y el composer flotando lejos del borde.
    class: 'pantalla-a-sangre',
  },
})
export class Messaging {
  protected readonly store = inject(ChatStore);
  private readonly preferencias = inject(ChatPreferencias);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly titulo = inject(Title);

  protected readonly filtros = FILTROS;

  protected readonly consulta = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly verArchivados = signal(false);

  private readonly tecleado = new Subject<string>();

  /**
   * La dirección actual, para saber si hay un hilo abierto.
   *
   * Hace falta en angosto, donde la lista y la conversación no caben juntas:
   * con hilo abierto se ve sólo el hilo, y sin él sólo la lista.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly hayHiloAbierto = computed(() =>
    /\/messaging\/[^/?#]+/.test(this.url()),
  );

  /** Las archivadas, que no se mezclan con el resto. */
  protected readonly archivadas = computed(() =>
    this.store
      .conversaciones()
      .filter((c) => this.preferencias.estaArchivado(c.id)),
  );

  /**
   * Lo que se ve en la lista: el filtro elegido, menos lo archivado, y
   * recortado por lo que se haya escrito en el buscador.
   */
  protected readonly visibles = computed<readonly ConversationListItem[]>(() => {
    const consulta = this.consulta().trim().toLowerCase();
    const filtro = this.filtro();
    const enArchivados = this.verArchivados();

    return this.store.conversaciones().filter((conversacion) => {
      if (this.preferencias.estaArchivado(conversacion.id) !== enArchivados) {
        return false;
      }
      if (filtro === 'no-leidos' && conversacion.unreadCount === 0) {
        return false;
      }
      if (filtro === 'favoritos' && !this.preferencias.esFavorito(conversacion.id)) {
        return false;
      }
      if (
        filtro === 'grupos' &&
        conversacion.groupId === undefined &&
        conversacion.peers.length <= 1
      ) {
        return false;
      }
      if (consulta === '') {
        return true;
      }
      const nombre = conQuien(conversacion).toLowerCase();
      const ultimo = (conversacion.lastMessage?.bodyText ?? '').toLowerCase();
      return nombre.includes(consulta) || ultimo.includes(consulta);
    });
  });

  /** Cuántas sin leer hay, para el chip. */
  protected readonly noLeidas = computed(
    () => this.store.conversaciones().filter((c) => c.unreadCount > 0).length,
  );

  protected readonly vacio = computed(
    () => this.store.bandejaCargada() && this.visibles().length === 0,
  );

  /** `true` si hay algo escrito pero ninguna conversación propia casa. */
  protected readonly sinCoincidencias = computed(
    () => this.consulta().trim() !== '' && this.visibles().length === 0,
  );

  constructor() {
    this.store.iniciar();
    inject(DestroyRef).onDestroy(() => this.store.detener());

    // Al directorio se le pregunta cuando la persona dejó de escribir: una
    // petición por tecla contra un buscador que atraviesa todos los tenants es
    // ruido para el servidor y resultados que parpadean para quien mira.
    this.tecleado
      .pipe(debounceTime(ESPERA_DE_BUSQUEDA_MS), takeUntilDestroyed())
      .subscribe((texto) => this.store.buscarGente(texto));

    // El `?escribirA=<slug>` con el que llega el botón «Enviar mensaje» de una
    // ficha pública. Se atiende cuando el perfil propio ya está resuelto: sin
    // eso no hay con qué abrir el hilo.
    this.ruta.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const slug = query.get('escribirA');
      if (slug !== null && slug !== '') {
        this.abrirConSlug(slug);
      }
    });

    // «(3) AloVida - Chats» en la pestaña mientras haya sin leer, como
    // cualquier chat: es lo que avisa desde otra pestaña sin abrir ésta. La
    // `TitleStrategy` vuelve a estampar el título en cada navegación —el hilo
    // es una ruta hija—, así que se aplica también tras cada `NavigationEnd`.
    effect(() => {
      this.store.sinLeer();
      this.estamparTitulo();
    });
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => queueMicrotask(() => this.estamparTitulo()));
    inject(DestroyRef).onDestroy(() => this.titulo.setTitle(sinContador(this.titulo.getTitle())));
  }

  protected alEscribir(texto: string): void {
    this.consulta.set(texto);
    if (texto.trim() === '') {
      this.store.limpiarBusqueda();
    } else {
      this.tecleado.next(texto);
    }
  }

  protected limpiarBusqueda(): void {
    this.consulta.set('');
    this.store.limpiarBusqueda();
  }

  protected elegirFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
    this.verArchivados.set(false);
  }

  protected rotulo(filtro: Filtro): string {
    switch (filtro) {
      case 'todos':
        return 'Todos';
      case 'no-leidos':
        return 'No leídos';
      case 'favoritos':
        return 'Favoritos';
      case 'grupos':
        return 'Grupos';
    }
  }

  protected alternarArchivados(): void {
    this.verArchivados.set(!this.verArchivados());
    this.filtro.set('todos');
  }

  private estamparTitulo(): void {
    const base = sinContador(this.titulo.getTitle());
    const cuantos = this.store.sinLeer();
    this.titulo.setTitle(cuantos > 0 ? `(${cuantos}) ${base}` : base);
  }

  /** Lo que pide el menú de una fila. */
  protected atender(accion: AccionDeFila): void {
    switch (accion.tipo) {
      case 'favorito':
        this.preferencias.alternarFavorito(accion.conversationId);
        break;
      case 'fijar':
        this.preferencias.alternarFijado(accion.conversationId);
        break;
      case 'archivar':
        this.preferencias.alternarArchivado(accion.conversationId);
        break;
      case 'leer':
        this.store.marcarFilaLeida(accion.conversationId);
        break;
      case 'perfil':
        this.verPerfil(accion.conversationId);
        break;
    }
  }

  private verPerfil(conversationId: string): void {
    const conversacion = this.store
      .conversaciones()
      .find((c) => c.id === conversationId);
    const peer = conversacion?.peers[0];
    if (peer !== undefined) {
      void this.router.navigate(['/public-profile', peer.profileId]);
    }
  }

  /** Abre el hilo con alguien del directorio. */
  protected escribirA(slug: string): void {
    this.abrirConSlug(slug);
  }

  private abrirConSlug(slug: string): void {
    this.store.escribirA(slug, (conversationId) => {
      this.limpiarBusqueda();
      void this.router.navigate(['/messaging', conversationId]);
    });
  }
}

/** Quita el «(3) » del frente de un título, si lo tiene. */
function sinContador(titulo: string): string {
  return titulo.replace(/^\(\d+\)\s+/u, '');
}
