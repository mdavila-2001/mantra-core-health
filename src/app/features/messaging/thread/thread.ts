import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatStore, type MensajeDelHilo } from '../../../core/messaging/chat.store';
import {
  avatarDeConQuien as avatarDeConQuienDe,
  conQuien as conQuienDe,
} from '../../../core/messaging/con-quien';
import { etiquetaDeDia } from '../../../shared/date/hora-de-chat';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Composer } from './composer/composer';

/**
 * Una línea del hilo: un separador —de día o de «no leídos»— o un mensaje con
 * lo que la vista necesita saber de sus vecinos.
 *
 * Los separadores se calculan acá y no en el template porque el template no
 * puede mirar el mensaje anterior sin volverse ilegible, y **agrupar** —quitarle
 * la cola y el nombre al mensaje que sigue al mismo autor dentro de los cinco
 * minutos— es lo que hace que una ráfaga de tres mensajes se lea como una y no
 * como tres fichas.
 */
export type LineaDelHilo =
  | { readonly tipo: 'fecha'; readonly clave: string; readonly etiqueta: string }
  | { readonly tipo: 'no-leidos'; readonly clave: string; readonly cuantos: number }
  | {
      readonly tipo: 'mensaje';
      readonly clave: string;
      readonly mensaje: MensajeDelHilo;
      readonly propio: boolean;
      /** Si arranca un bloque de quien escribe: lleva la cola de la burbuja. */
      readonly abreBloque: boolean;
      /** El nombre del autor, sólo en grupos y sólo al abrir bloque. */
      readonly autor: string;
      /** Un tono estable por perfil, para el nombre del autor en un grupo. */
      readonly tono: number;
    };

/** Cuántos tonos rotan los nombres de autor en un grupo. */
const TONOS = 8;

/** A cuántos píxeles del tope se pide la página anterior. */
const MARGEN_DE_CARGA = 220;

/** Cuánto margen cuenta como «está al pie» para arrastrar el scroll. */
const MARGEN_DEL_PIE = 90;

/**
 * El hilo de una conversación — carril P2.
 *
 * ## Es el panel derecho, no una pantalla
 *
 * Se pinta dentro del `router-outlet` de `Messaging`, que es quien tiene la
 * lista. Por eso acá no hay carril de conversaciones ni se vuelve a pedir la
 * bandeja: el marco ya la tiene, y todo el estado sale del `ChatStore`.
 *
 * ## Lo único que hace por su cuenta es el scroll
 *
 * Y es lo más delicado del chat: hay que quedarse pegado abajo cuando llega un
 * mensaje, **no** moverse cuando alguien está leyendo hacia arriba, y al traer
 * la página anterior conservar exactamente el punto donde estaba la vista —si
 * no, cargar historia te expulsa de donde estabas leyendo—.
 */
@Component({
  selector: 'app-thread',
  imports: [Avatar, Composer, DatePipe, EmptyState, RouterLink],
  templateUrl: './thread.html',
  styleUrl: './thread.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Thread {
  protected readonly store = inject(ChatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly marco = viewChild<ElementRef<HTMLElement>>('marco');

  /** Si la vista está al pie. Arranca en `true`: un hilo se abre por el final. */
  private pegadoAbajo = true;

  /** Alto del contenido antes de pedir lo anterior, para no saltar. */
  private altoAntesDeCargar = 0;

  /** Cuántos mensajes nuevos llegaron mientras se leía hacia arriba. */
  protected readonly nuevosAbajo = signal(0);

  /** Qué mensaje tiene el menú abierto. */
  protected readonly menuAbierto = signal<string | null>(null);

  /** La imagen que se está mirando a tamaño completo. */
  protected readonly imagenAbierta = signal<string | null>(null);

  /** El mensaje al que saltó una cita, para destellarlo. */
  protected readonly destellando = signal<string | null>(null);

  /** Con quién es la conversación. */
  protected readonly conQuien = computed(() => {
    const activa = this.store.conversacionActiva();
    return activa === undefined ? 'Conversación' : conQuienDe(activa);
  });

  protected readonly avatar = computed(() => {
    const activa = this.store.conversacionActiva();
    return activa === undefined ? null : avatarDeConQuienDe(activa);
  });

  /** Los participantes, como subtítulo de un grupo. */
  protected readonly subtitulo = computed(() => {
    const activa = this.store.conversacionActiva();
    if (activa === undefined) {
      return '';
    }
    if (activa.peers.length <= 1) {
      return 'Conversación directa';
    }
    const nombres = activa.peers
      .map((peer) => peer.displayName)
      .filter((nombre): nombre is string => nombre !== undefined && nombre !== null);
    return [...nombres, 'Tú'].join(', ');
  });

  protected readonly esGrupo = computed(() => {
    const activa = this.store.conversacionActiva();
    return activa !== undefined && activa.peers.length > 1;
  });

  protected readonly vacio = computed(
    () => this.store.hiloCargado() && this.store.enOrden().length === 0,
  );

  /** El hilo listo para pintar. */
  protected readonly lineas = computed<readonly LineaDelHilo[]>(() => {
    const salida: LineaDelHilo[] = [];
    const propio = this.store.perfil();
    const mensajes = this.store.enOrden();
    const sinLeer = this.store.noLeidosAlAbrir();
    // El separador de no leídos va delante del primero que no habías visto:
    // los últimos `sinLeer` del hilo, contando desde el final.
    const desdeNoLeidos =
      sinLeer > 0 && sinLeer <= mensajes.length ? mensajes.length - sinLeer : -1;

    let diaAnterior = '';
    let autorAnterior: string | null = null;
    let cuandoAnterior = 0;

    mensajes.forEach((mensaje, indice) => {
      const cuando = mensaje.sentAt ? new Date(mensaje.sentAt).getTime() : 0;
      const dia = mensaje.sentAt ? new Date(mensaje.sentAt).toDateString() : '';

      if (dia !== diaAnterior) {
        salida.push({
          tipo: 'fecha',
          clave: `f-${dia || mensaje.clave}`,
          etiqueta: etiquetaDeDia(mensaje.sentAt),
        });
        diaAnterior = dia;
        // Un día nuevo siempre abre bloque, aunque escriba el mismo.
        autorAnterior = null;
      }

      if (indice === desdeNoLeidos) {
        salida.push({
          tipo: 'no-leidos',
          clave: 'no-leidos',
          cuantos: sinLeer,
        });
        autorAnterior = null;
      }

      const esPropio = mensaje.senderProfileId === propio;
      const abreBloque =
        mensaje.senderProfileId !== autorAnterior ||
        cuando - cuandoAnterior > 5 * 60 * 1000;

      salida.push({
        tipo: 'mensaje',
        clave: mensaje.clave,
        mensaje,
        propio: esPropio,
        abreBloque,
        autor: this.nombreDe(mensaje.senderProfileId),
        tono: tonoDe(mensaje.senderProfileId),
      });
      autorAnterior = mensaje.senderProfileId;
      cuandoAnterior = cuando;
    });

    return salida;
  });

  constructor() {
    // Por `paramMap` y no por `snapshot`: al ir de un hilo a otro el router
    // reutiliza el componente, y con el snapshot quedaría mostrando el
    // anterior.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('conversationId');
      if (id !== null) {
        this.pegadoAbajo = true;
        this.nuevosAbajo.set(0);
        this.menuAbierto.set(null);
        this.store.abrir(id);
      }
    });

    // Cada vez que cambia lo que se pinta hay que decidir el scroll. Se hace
    // con un efecto y no dentro de cada carga porque los mensajes llegan por
    // tres caminos —la primera página, el sondeo y el socket— y los tres
    // terminan en la misma decisión.
    effect(() => {
      const total = this.store.enOrden().length;
      this.alCambiarElHilo(total);
    });
  }

  /** El nombre de quien escribió, para el rótulo de un grupo. */
  private nombreDe(profileId: string): string {
    if (profileId === this.store.perfil()) {
      return 'Tú';
    }
    const activa = this.store.conversacionActiva();
    const peer = activa?.peers.find((p) => p.profileId === profileId);
    return peer?.displayName ?? 'Alguien';
  }

  /** `true` si un mensaje propio ya lo leyó el otro lado — ✓✓ en vez de ✓. */
  protected leido(mensaje: MensajeDelHilo): boolean {
    const hasta = this.store.peerReadUpTo();
    if (
      mensaje.senderProfileId !== this.store.perfil() ||
      hasta === null ||
      !mensaje.sentAt
    ) {
      return false;
    }
    return mensaje.sentAt.getTime() <= hasta.getTime();
  }

  /** El mensaje al que responde otro, si está cargado. */
  protected citado(mensaje: MensajeDelHilo): MensajeDelHilo | null {
    const id = mensaje.replyToMessageId;
    if (id === undefined) {
      return null;
    }
    return this.store.enOrden().find((m) => m.id === id) ?? null;
  }

  protected autorDeLaCita(mensaje: MensajeDelHilo): string {
    const citado = this.citado(mensaje);
    return citado === null ? 'Mensaje anterior' : this.nombreDe(citado.senderProfileId);
  }

  /** La URL de un adjunto ya resuelta, o la vista previa local si sube ahora. */
  protected urlDelAdjunto(mensaje: MensajeDelHilo): string | null {
    const local = mensaje.pendiente?.adjunto?.vistaPrevia;
    if (local !== undefined) {
      return local;
    }
    return mensaje.attachmentFileId === undefined
      ? null
      : this.store.urlDe(mensaje.attachmentFileId);
  }

  protected esImagen(mensaje: MensajeDelHilo): boolean {
    const tipo = mensaje.pendiente?.adjunto?.tipo;
    if (tipo !== undefined) {
      return tipo.startsWith('image/');
    }
    // Sin el tipo del archivo —los que llegan del servidor no lo traen— se
    // decide por la URL. No es adivinar: la URL firmada conserva el nombre.
    const url = this.urlDelAdjunto(mensaje);
    return url !== null && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
  }

  protected esAudio(mensaje: MensajeDelHilo): boolean {
    const tipo = mensaje.pendiente?.adjunto?.tipo;
    if (tipo !== undefined) {
      return tipo.startsWith('audio/');
    }
    const url = this.urlDelAdjunto(mensaje);
    return url !== null && /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(url);
  }

  protected nombreDelAdjunto(mensaje: MensajeDelHilo): string {
    return mensaje.pendiente?.adjunto?.nombre ?? 'Archivo adjunto';
  }

  /* --- Acciones sobre un mensaje ------------------------------------------ */

  protected alternarMenu(clave: string, evento: Event): void {
    evento.stopPropagation();
    this.menuAbierto.set(this.menuAbierto() === clave ? null : clave);
  }

  protected responder(mensaje: MensajeDelHilo): void {
    this.menuAbierto.set(null);
    this.store.responder(mensaje);
  }

  protected copiar(mensaje: MensajeDelHilo): void {
    this.menuAbierto.set(null);
    if (this.isBrowser && mensaje.bodyText) {
      void navigator.clipboard?.writeText(mensaje.bodyText);
    }
  }

  protected reintentar(mensaje: MensajeDelHilo): void {
    if (mensaje.pendiente) {
      this.store.reintentar(mensaje.pendiente);
    }
  }

  protected descartar(mensaje: MensajeDelHilo): void {
    if (mensaje.pendiente) {
      this.store.descartar(mensaje.pendiente);
    }
  }

  protected abrirImagen(url: string): void {
    this.imagenAbierta.set(url);
  }

  protected cerrarImagen(): void {
    this.imagenAbierta.set(null);
  }

  /**
   * Salta al mensaje citado y lo destella.
   *
   * Si no está cargado no hace nada: traerlo obligaría a paginar hacia atrás
   * hasta encontrarlo, y quedarse esperando sin decir nada es peor que no
   * moverse.
   */
  protected irACitado(mensaje: MensajeDelHilo): void {
    const citado = this.citado(mensaje);
    if (citado === null || !this.isBrowser) {
      return;
    }
    const nodo = this.marco()?.nativeElement.querySelector<HTMLElement>(
      `[data-clave="${citado.clave}"]`,
    );
    if (nodo) {
      nodo.scrollIntoView({ block: 'center', behavior: 'smooth' });
      this.destellando.set(citado.clave);
      setTimeout(() => this.destellando.set(null), 1600);
    }
  }

  /* --- Scroll -------------------------------------------------------------- */

  /**
   * Decide el scroll después de que cambió el hilo.
   *
   * Tres casos y una regla cada uno: si se estaba al pie, se sigue al pie; si
   * se acababa de pedir historia, se conserva el punto de lectura; si se
   * estaba leyendo arriba y llegó algo nuevo, no se mueve nada y se avisa con
   * el botón flotante.
   */
  private alCambiarElHilo(total: number): void {
    if (!this.isBrowser || total === 0) {
      return;
    }
    setTimeout(() => {
      const marco = this.marco()?.nativeElement;
      if (!marco) {
        return;
      }
      if (this.altoAntesDeCargar > 0) {
        // Historia: el contenido creció por arriba, así que se compensa
        // exactamente lo que creció. Sin esto, pedir lo anterior te deja
        // mirando mensajes de hace dos meses.
        marco.scrollTop = marco.scrollHeight - this.altoAntesDeCargar;
        this.altoAntesDeCargar = 0;
        return;
      }
      if (this.pegadoAbajo) {
        marco.scrollTop = marco.scrollHeight;
        this.nuevosAbajo.set(0);
      } else {
        this.nuevosAbajo.update((n) => n + 1);
      }
    });
  }

  protected alScrollear(evento: Event): void {
    const marco = evento.target as HTMLElement;
    this.pegadoAbajo =
      marco.scrollHeight - marco.scrollTop - marco.clientHeight < MARGEN_DEL_PIE;
    if (this.pegadoAbajo) {
      this.nuevosAbajo.set(0);
    }

    // Scroll infinito hacia arriba: se pide sola la página anterior, sin
    // botón. El botón obligaba a apuntarle para leer una conversación vieja,
    // que es justo cuando uno viene bajando rápido.
    if (
      marco.scrollTop < MARGEN_DE_CARGA &&
      this.store.hayAnteriores() &&
      !this.store.cargandoHilo()
    ) {
      this.altoAntesDeCargar = marco.scrollHeight;
      this.store.cargarAnteriores();
    }
  }

  protected bajarDelTodo(): void {
    const marco = this.marco()?.nativeElement;
    if (marco) {
      this.pegadoAbajo = true;
      this.nuevosAbajo.set(0);
      marco.scrollTo({ top: marco.scrollHeight, behavior: 'smooth' });
    }
  }

  /** Al enviar siempre se baja: escribiste vos. */
  protected alEnviar(): void {
    this.pegadoAbajo = true;
  }
}

/** Un tono estable a partir del id, para el nombre del autor en un grupo. */
function tonoDe(profileId: string): number {
  let suma = 0;
  for (let i = 0; i < profileId.length; i += 1) {
    suma = (suma + profileId.charCodeAt(i)) % 997;
  }
  return suma % TONOS;
}
