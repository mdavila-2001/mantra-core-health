import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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

import {
  ChatStore,
  editable,
  type MensajeDelHilo,
} from '../../../core/messaging/chat.store';
import { stickerDe } from '../../../core/messaging/sticker-pack.generated';
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
import { ContactPanel } from './contact-panel/contact-panel';
import { FilePreview } from '../../../shared/components/molecules/file-preview/file-preview';
import { formatearTamano } from '../../../core/data-access/files/upload-policy';
import {
  archivoDeDataUrl,
  esPdf,
  metadatosDeDataUrl,
  nombreDelTipo,
  type MetadatosDeAdjunto,
} from '../../../core/messaging/adjunto-metadata';

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

/**
 * Cada cuánto se revisa si algún mensaje salió de la ventana de edición.
 *
 * Treinta segundos: el menú tiene que dejar de ofrecer «Editar» cuando la
 * ventana vence, y sin un tic propio eso sólo pasaría si algo más provocara un
 * redibujo. Preciso al medio minuto alcanza —el servidor es quien decide—, y
 * un tic por segundo sería redibujar el hilo entero sesenta veces de más.
 */
const TIC_DE_EDICION_MS = 30_000;

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
  imports: [Avatar, Composer, ContactPanel, EmptyState, FilePreview, RouterLink],
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

  /** Si está abierta la hoja de «Información del contacto». */
  protected readonly contactoAbierto = signal(false);

  /**
   * El reloj de la ventana de edición.
   *
   * Es una señal y no `Date.now()` suelto porque `puedeEditarse()` se lee desde
   * la plantilla: sin una dependencia que cambie, el menú seguiría ofreciendo
   * «Editar» diez minutos después de mandado.
   */
  private readonly ahora = signal(Date.now());

  /**
   * El perfil del otro lado, cuando hay uno solo.
   *
   * En un grupo no hay «el contacto»: son varios, y el panel de contacto no es
   * la pantalla para eso. Por eso el menú sólo lo ofrece fuera de los grupos.
   */
  protected readonly perfilDelOtro = computed(
    () => this.store.conversacionActiva()?.peers[0]?.profileId ?? null,
  );

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
        this.contactoAbierto.set(false);
        this.store.abrir(id);
      }
    });

    // `?contacto=1` es con lo que llega «Ver perfil» desde la fila de la
    // bandeja: en angosto esa fila no tiene el hilo abierto, así que la acción
    // navega hasta acá y pide la hoja. Mismo patrón que el `?responder=` del
    // composer.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (query.get('contacto') !== null) {
        this.contactoAbierto.set(true);
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

    // El reloj de la ventana de edición. Sólo en el navegador: bajo SSR no hay
    // menú que actualizar y un intervalo dejaría colgada la renderización.
    if (this.isBrowser) {
      const tic = setInterval(() => this.ahora.set(Date.now()), TIC_DE_EDICION_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(tic));
    }
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

  /**
   * `true` si el mensaje es un sticker del pack.
   *
   * Un sticker se dibuja **sin burbuja** y más grande: meterlo en el mismo
   * recuadro que una foto lo convertiría en una estampilla, que es justo lo que
   * un sticker no es. Se sabe por su `fileId`, que está en el pack del
   * producto — no hace falta un tipo de mensaje nuevo en el modelo.
   */
  protected esSticker(mensaje: MensajeDelHilo): boolean {
    return stickerDe(mensaje.attachmentFileId) !== undefined;
  }

  /** Cómo se anuncia el sticker a quien no lo ve. */
  protected nombreDelSticker(mensaje: MensajeDelHilo): string {
    return stickerDe(mensaje.attachmentFileId)?.nombre ?? 'Sticker';
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

  /* --- 5.2 · metadata y vista previa de adjuntos ------------------------- */

  /**
   * La burbuja cuya vista previa de PDF está abierta. Una sola a la vez: dos
   * PDF rasterizando en paralelo es trabajo que nadie pidió.
   */
  protected readonly vistaPreviaAbierta = signal<string | null>(null);

  /**
   * El `File` de cada vista previa, armado una sola vez por contenido.
   *
   * Decodificar un base64 de varios megas en cada ciclo de detección sería
   * caro, y además `app-file-preview` volvería a rasterizar si recibiera un
   * `File` nuevo con el mismo contenido: la identidad del objeto importa.
   */
  private readonly archivosDeVistaPrevia = new Map<string, File | null>();

  /**
   * Tipo y tamaño reales del adjunto, leídos del contenido que ya bajó 5.1.
   *
   * No hay petición nueva: el `data:` URL que guarda el store se armó con el
   * `Content-Type` que sirvió la ruta contextual. `null` para la vista previa
   * local de un envío en curso (`blob:`) o cualquier contenido que no se pueda
   * leer con certeza.
   */
  protected metadatosDelAdjunto(mensaje: MensajeDelHilo): MetadatosDeAdjunto | null {
    return metadatosDeDataUrl(this.urlDelAdjunto(mensaje));
  }

  /** «PDF · 2.1 KB», o `null` si no hay metadata que decir. */
  protected detalleDelAdjunto(mensaje: MensajeDelHilo): string | null {
    const metadatos = this.metadatosDelAdjunto(mensaje);
    return metadatos === null
      ? null
      : `${nombreDelTipo(metadatos.mimeType)} · ${formatearTamano(metadatos.sizeBytes)}`;
  }

  /**
   * `true` si el adjunto es un PDF que se puede previsualizar en el hilo.
   *
   * Sólo PDF: las imágenes ya se ven (5.1) y el resto de documentos no tiene
   * vista previa honesta en el navegador. No se finge una que no existe.
   */
  protected esPdfAdjunto(mensaje: MensajeDelHilo): boolean {
    return !this.esImagen(mensaje) && !this.esAudio(mensaje) && esPdf(this.metadatosDelAdjunto(mensaje));
  }

  protected alternarVistaPrevia(mensaje: MensajeDelHilo): void {
    this.vistaPreviaAbierta.update((abierta) => (abierta === mensaje.id ? null : mensaje.id));
  }

  /**
   * El archivo para `app-file-preview`, o `null` si el contenido no se pudo
   * decodificar — y entonces la burbuja lo dice y sigue ofreciendo la descarga.
   */
  protected archivoParaVistaPrevia(mensaje: MensajeDelHilo): File | null {
    const url = this.urlDelAdjunto(mensaje);
    if (url === null) return null;
    if (!this.archivosDeVistaPrevia.has(url)) {
      this.archivosDeVistaPrevia.set(url, archivoDeDataUrl(url, this.nombreParaDescargar(mensaje)));
    }
    return this.archivosDeVistaPrevia.get(url) ?? null;
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

  /**
   * Abre la hoja del contacto.
   *
   * Antes navegaba a `/public-profile/<profileId>`, **una ruta que no existe**:
   * las fichas públicas son `/p|o|f|l|s/:slug` y se llega por slug, no por id.
   * Así que «Ver perfil» caía en el 404 desde el menú del hilo y desde el de la
   * fila de la bandeja. Ver `ContactPanel` para por qué la respuesta es un
   * panel y no un enlace arreglado.
   */
  protected verPerfil(): void {
    this.menuCabecera.set(false);
    if (this.perfilDelOtro() !== null) {
      this.contactoAbierto.set(true);
    }
  }

  /**
   * Cierra la hoja y borra el `?contacto` de la dirección.
   *
   * Sin borrarlo, volver atrás en el navegador —o recargar— reabriría un panel
   * que ya se había cerrado, y la dirección dejaría de describir lo que se ve.
   */
  /**
   * Baja la conversación entera como JSON.
   *
   * El archivo se arma en el navegador con lo que junta el store y se entrega
   * por un `<a download>` de un `blob:` que se revoca en el acto. Sólo en el
   * navegador: bajo SSR no hay a quién entregarle un archivo.
   */
  protected descargarConversacion(): void {
    this.menuCabecera.set(false);
    if (!this.isBrowser) {
      return;
    }
    this.store.exportarConversacion((json) => {
      if (json === null) {
        return;
      }
      const url = URL.createObjectURL(
        new Blob([json], { type: 'application/json' }),
      );
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreDeArchivo(this.conQuien());
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }

  protected cerrarContacto(): void {
    this.contactoAbierto.set(false);
    if (this.route.snapshot.queryParamMap.get('contacto') !== null) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { contacto: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
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

  /**
   * `true` si el mensaje todavía está dentro de la ventana de cinco minutos.
   *
   * La regla vive en el store —y también en el servidor—; acá sólo se decide si
   * el menú lo ofrece.
   */
  protected puedeEditarse(mensaje: MensajeDelHilo): boolean {
    return editable(mensaje, this.store.perfil(), this.ahora());
  }

  protected editar(mensaje: MensajeDelHilo): void {
    this.menuAbierto.set(null);
    this.store.editar(mensaje);
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

/**
 * Con qué nombre se guarda la conversación descargada.
 *
 * Con el nombre de la otra persona y la fecha: tres conversaciones bajadas el
 * mismo día tienen que distinguirse en la carpeta de descargas sin abrirlas.
 */
function nombreDeArchivo(conQuien: string): string {
  const limpio = conQuien
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40);
  const dia = new Date().toISOString().slice(0, 10);
  return `chat-${limpio === '' ? 'conversacion' : limpio}-${dia}.json`;
}

/** Un tono estable a partir del id, para el nombre del autor en un grupo. */
function tonoDe(profileId: string): number {
  let suma = 0;
  for (let i = 0; i < profileId.length; i += 1) {
    suma = (suma + profileId.charCodeAt(i)) % 997;
  }
  return suma % TONOS;
}
