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
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatStore, type MensajeDelHilo } from '../../../core/messaging/chat.store';
import type { ConversationListItem } from '../../../core/data-access/community/community.types';
import { ChatPreferencias } from '../../../core/messaging/chat-preferencias';
import {
  avatarDeConQuien as avatarDeConQuienDe,
  conQuien as conQuienDe,
} from '../../../core/messaging/con-quien';
import { etiquetaDeDia, horaDelReloj } from '../../../shared/date/hora-de-chat';
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

/** Un pedazo del texto de una burbuja: texto plano, un enlace o una coincidencia. */
export interface TrozoDeTexto {
  readonly tipo: 'texto' | 'enlace' | 'marca';
  readonly valor: string;
}

/** Lo que se reconoce como enlace dentro de un mensaje. Sólo http(s). */
const ENLACE = /https?:\/\/[^\s<>"'）)\]]+/gu;

/** Quita tildes y baja a minúsculas: «Holter» encuentra «hólter». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

/**
 * Parte el texto de una burbuja en trozos: enlaces clicables y, si se está
 * buscando, las coincidencias resaltadas.
 *
 * Los enlaces se reconocen primero y no se resaltan por dentro: una URL con
 * un `<mark>` en el medio deja de ser un solo enlace para el navegador.
 */
export function trocear(texto: string, termino: string): readonly TrozoDeTexto[] {
  const salida: TrozoDeTexto[] = [];
  let desde = 0;
  for (const enlace of texto.matchAll(ENLACE)) {
    const indice = enlace.index ?? 0;
    if (indice > desde) {
      salida.push(...resaltar(texto.slice(desde, indice), termino));
    }
    salida.push({ tipo: 'enlace', valor: enlace[0] });
    desde = indice + enlace[0].length;
  }
  if (desde < texto.length) {
    salida.push(...resaltar(texto.slice(desde), termino));
  }
  return salida;
}

function resaltar(texto: string, termino: string): readonly TrozoDeTexto[] {
  const aguja = normalizar(termino.trim());
  if (aguja === '') {
    return [{ tipo: 'texto', valor: texto }];
  }
  // Normalizar no cambia el largo mientras sólo se quiten tildes combinadas,
  // así que las posiciones valen para el texto original.
  const pajar = normalizar(texto);
  const salida: TrozoDeTexto[] = [];
  let desde = 0;
  let indice = pajar.indexOf(aguja);
  while (indice !== -1) {
    if (indice > desde) {
      salida.push({ tipo: 'texto', valor: texto.slice(desde, indice) });
    }
    salida.push({ tipo: 'marca', valor: texto.slice(indice, indice + aguja.length) });
    desde = indice + aguja.length;
    indice = pajar.indexOf(aguja, desde);
  }
  if (desde < texto.length) {
    salida.push({ tipo: 'texto', valor: texto.slice(desde) });
  }
  return salida;
}

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
  imports: [Avatar, Composer, EmptyState, RouterLink],
  templateUrl: './thread.html',
  styleUrls: ['./thread.css', './thread-capas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Thread {
  protected readonly store = inject(ChatStore);
  private readonly preferencias = inject(ChatPreferencias);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly marco = viewChild<ElementRef<HTMLElement>>('marco');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  /** Si la vista está al pie. Arranca en `true`: un hilo se abre por el final. */
  private pegadoAbajo = true;

  /** Alto del contenido antes de pedir lo anterior, para no saltar. */
  private altoAntesDeCargar = 0;

  /** Cuántos mensajes nuevos llegaron mientras se leía hacia arriba. */
  protected readonly nuevosAbajo = signal(0);

  /** Qué mensaje tiene el menú abierto. */
  protected readonly menuAbierto = signal<string | null>(null);

  /** Si está abierto el menú de la cabecera. */
  protected readonly menuCabecera = signal(false);

  protected readonly esFavorito = computed(() => {
    const id = this.store.activaId();
    return id !== null && this.preferencias.favoritos().has(id);
  });

  protected readonly estaArchivado = computed(() => {
    const id = this.store.activaId();
    return id !== null && this.preferencias.archivados().has(id);
  });

  /** La imagen que se está mirando a tamaño completo. */
  protected readonly imagenAbierta = signal<string | null>(null);

  /** El mensaje al que saltó una cita, para destellarlo. */
  protected readonly destellando = signal<string | null>(null);

  /** Si está abierta la búsqueda dentro de la conversación. */
  protected readonly buscando = signal(false);

  /** Lo que se busca dentro de la conversación. */
  protected readonly termino = signal('');

  /** El mensaje que se está por reenviar, mientras se elige a quién. */
  protected readonly reenviando = signal<MensajeDelHilo | null>(null);

  /** «Reenviado a …», un momento, después de reenviar. */
  protected readonly avisoReenvio = signal<string | null>(null);

  /** A qué conversaciones se puede reenviar: todas menos ésta. */
  protected readonly destinosDeReenvio = computed(() =>
    this.store.conversaciones().filter((c) => c.id !== this.store.activaId()),
  );

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

  /**
   * El hilo listo para pintar.
   *
   * Con algo escrito en la búsqueda quedan sólo las burbujas que coinciden,
   * con sus separadores de día: es una lista de resultados, no el hilo.
   */
  protected readonly lineas = computed<readonly LineaDelHilo[]>(() => {
    const aguja = normalizar(this.termino().trim());
    if (aguja === '') {
      return this.todasLasLineas();
    }
    const coinciden = this.todasLasLineas().filter(
      (linea) =>
        linea.tipo === 'mensaje' && normalizar(linea.mensaje.bodyText ?? '').includes(aguja),
    );
    // Cada resultado abre bloque: sin el vecino de arriba, la cola y el nombre
    // del autor son lo que dice quién habló.
    return coinciden.map((linea) =>
      linea.tipo === 'mensaje' ? { ...linea, abreBloque: true } : linea,
    );
  });

  /** Cuántas burbujas coinciden con lo buscado, para el rótulo. */
  protected readonly rotuloDeBusqueda = computed(() => {
    if (this.termino().trim() === '') {
      return '';
    }
    const cuantas = this.lineas().filter((l) => l.tipo === 'mensaje').length;
    return cuantas === 0
      ? 'Sin coincidencias'
      : `${cuantas} ${cuantas === 1 ? 'coincidencia' : 'coincidencias'}`;
  });

  private readonly todasLasLineas = computed<readonly LineaDelHilo[]>(() => {
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
        this.menuCabecera.set(false);
        this.cerrarBusqueda();
        this.reenviando.set(null);
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
    if (tipo !== undefined && tipo !== '') {
      return tipo.startsWith('image/');
    }
    // Sin el tipo del archivo —los que llegan del servidor no lo traen— se
    // decide por la URL. No es adivinar: la URL firmada conserva el nombre, y
    // una `data:image/…` dice lo que es en el esquema. La vista previa local
    // (`blob:`) nunca llega acá: viene con su tipo.
    const url = this.urlDelAdjunto(mensaje);
    return (
      url !== null &&
      (/^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url))
    );
  }

  protected esAudio(mensaje: MensajeDelHilo): boolean {
    const tipo = mensaje.pendiente?.adjunto?.tipo;
    if (tipo !== undefined && tipo !== '') {
      return tipo.startsWith('audio/');
    }
    const url = this.urlDelAdjunto(mensaje);
    return (
      url !== null &&
      (/^data:audio\//i.test(url) || /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(url))
    );
  }

  /** El texto de una burbuja, en trozos: enlaces y coincidencias. */
  protected segmentos(texto: string): readonly TrozoDeTexto[] {
    return trocear(texto, this.termino());
  }

  /* --- Buscar en la conversación ------------------------------------------ */

  protected abrirBusqueda(): void {
    this.menuCabecera.set(false);
    this.buscando.set(true);
    if (this.isBrowser) {
      setTimeout(() => this.buscador()?.nativeElement.focus());
    }
  }

  protected alBuscar(valor: string): void {
    this.termino.set(valor);
  }

  protected cerrarBusqueda(): void {
    this.buscando.set(false);
    this.termino.set('');
  }

  /* --- Reenviar ------------------------------------------------------------ */

  protected reenviar(mensaje: MensajeDelHilo): void {
    this.menuAbierto.set(null);
    this.reenviando.set(mensaje);
  }

  protected cancelarReenvio(): void {
    this.reenviando.set(null);
  }

  /**
   * Cierra el reenvío sólo si el clic cayó en el fondo, no en el recuadro.
   *
   * Antes el recuadro paraba la propagación con un `(click)` propio, y un
   * `(click)` sin equivalente de teclado no pasa la regla de accesibilidad
   * —con razón: un recuadro no es un control—. Ponerle un `(keydown)` para
   * callar al linter habría sido peor, porque también habría frenado el
   * `Escape` que cierra desde el fondo. Se decide acá, mirando dónde cayó.
   */
  protected cerrarReenvioSiEsElFondo(evento: Event): void {
    if (evento.target === evento.currentTarget) {
      this.cancelarReenvio();
    }
  }

  protected reenviarA(conversationId: string): void {
    const mensaje = this.reenviando();
    if (mensaje === null) {
      return;
    }
    this.store.reenviar(mensaje, conversationId);
    this.reenviando.set(null);
    const destino = this.store.conversaciones().find((c) => c.id === conversationId);
    this.avisoReenvio.set(`Reenviado a ${destino === undefined ? 'la conversación' : conQuienDe(destino)}`);
    if (this.isBrowser) {
      setTimeout(() => this.avisoReenvio.set(null), 2500);
    }
  }

  protected nombreDeConversacion(conversacion: ConversationListItem): string {
    return conQuienDe(conversacion);
  }

  protected avatarDeConversacion(conversacion: ConversationListItem): string | null {
    return avatarDeConQuienDe(conversacion);
  }

  protected nombreDelAdjunto(mensaje: MensajeDelHilo): string {
    return mensaje.pendiente?.adjunto?.nombre ?? 'Archivo adjunto';
  }

  /**
   * Con qué nombre se guarda un documento al descargarlo.
   *
   * El contrato no trae el nombre original del adjunto, así que se le pone
   * uno con la extensión que dice el tipo de la `data:` URL: un archivo que
   * se llame «Archivo adjunto» a secas no lo abre ningún visor.
   */
  protected nombreParaDescargar(mensaje: MensajeDelHilo): string {
    const propio = mensaje.pendiente?.adjunto?.nombre;
    if (propio !== undefined) {
      return propio;
    }
    const url = this.urlDelAdjunto(mensaje) ?? '';
    const tipo = /^data:([^;,]+)/i.exec(url)?.[1]?.toLowerCase() ?? '';
    const extension =
      { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'audio/webm': '.webm', 'audio/mpeg': '.mp3' }[tipo] ?? '';
    return `adjunto${extension}`;
  }

  protected adjuntoNoDisponible(mensaje: MensajeDelHilo): boolean {
    return (
      mensaje.attachmentFileId !== undefined &&
      this.store.adjuntoNoDisponible(mensaje.attachmentFileId)
    );
  }

  /** La hora de la burbuja, con el mismo formato que la fila de la bandeja. */
  protected hora(fecha: Date | undefined): string {
    return horaDelReloj(fecha);
  }

  /* --- El menú de la cabecera --------------------------------------------- */

  protected alternarMenuCabecera(evento: Event): void {
    evento.stopPropagation();
    this.menuCabecera.update((abierto) => !abierto);
  }

  protected alternarFavorito(): void {
    this.menuCabecera.set(false);
    const id = this.store.activaId();
    if (id !== null) {
      this.preferencias.alternarFavorito(id);
    }
  }

  protected alternarArchivado(): void {
    this.menuCabecera.set(false);
    const id = this.store.activaId();
    if (id !== null) {
      this.preferencias.alternarArchivado(id);
    }
  }

  protected verPerfil(): void {
    this.menuCabecera.set(false);
    const peer = this.store.conversacionActiva()?.peers[0];
    if (peer !== undefined) {
      void this.router.navigate(['/public-profile', peer.profileId]);
    }
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
