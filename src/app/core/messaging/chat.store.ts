import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, EMPTY, from, map, Subscription, type Observable } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { describeApiFailure } from '../http/api-failure';
import { FilesClient } from '../data-access/files/files.client';
import { SessionStore } from '../auth/session.store';
import { ChatSocketService } from './chat-socket.service';
import { ChatAutoReply } from './chat-auto-reply';
import { stickerDe, type Sticker } from './sticker-pack.generated';
import {
  contextoDelTexto,
  normalizarContexto,
  textoDeContexto,
  type ContextoDeChat,
} from './contexto-de-chat';
import { errorToViewState } from '../http/error-to-view-state';
import {
  empty,
  forbidden,
  loading,
  offline,
  ready,
  stale,
  unexpectedError,
} from '../view-state/view-state';
import type {
  ForbiddenViewState,
  OfflineViewState,
  UnexpectedErrorViewState,
  ViewState,
} from '../view-state/view-state.types';
import type {
  ConversationListItem,
  ChatContact,
  DirectMessage,
  MessageReaction,
  MessageReceipt,
} from '../data-access/community/community.types';

/** Cada cuánto se relee la bandeja, en milisegundos. */
const SONDEO_BANDEJA_MS = 60_000;

/** Cada cuánto se relee el hilo abierto. */
const SONDEO_HILO_MS = 30_000;

/** Cuánto se espera, tras enviar, para releer los recibos del mensaje. */
const ESPERA_DE_RECIBOS_MS = 2_000;

/** Cuántos mensajes trae cada página del hilo. */
export const PAGINA_DE_MENSAJES = 30;

/** Cuántas conversaciones trae la bandeja. */
const LIMITE_DE_BANDEJA = 50;

/**
 * Dónde se recuerda, **por pestaña**, con qué perfil se está escribiendo.
 *
 * `sessionStorage` y no `localStorage`: «estoy atendiendo como la farmacia» es
 * de este rato y de esta pestaña. Lo que se guarda es el id público de la
 * vitrina y su nombre —lo mismo que muestra la ficha pública—, atado al
 * usuario que lo eligió: otra cuenta que entre en la misma pestaña no lo
 * hereda. Y no autoriza nada: si la API ya no deja actuar con ese perfil,
 * responde 403 y el store vuelve al propio.
 */
const CLAVE_DE_ACTUACION = 'alovida.chat.actuar-como';

/** Rol del token que, con membresía activa, deja escribir como la farmacia. */
export const ROL_PERSONAL_DE_FARMACIA = 'PHARMACY_STAFF';

/** La vitrina de una organización con la que esta sesión puede escribir. */
export interface VitrinaParaActuar {
  readonly profileId: string;
  readonly nombre: string;
}

/** Lo que se guarda en {@link CLAVE_DE_ACTUACION}. */
interface ActuacionGuardada extends VitrinaParaActuar {
  readonly userId: string;
}

/** Las generaciones con que se suscribió un paso de la apertura de un chat. */
interface MarcaDeApertura {
  readonly identidad: number;
  readonly usuario: number;
}

/** El aviso que se da al perder el permiso de escribir como la organización. */
export const AVISO_SIN_PERMISO_DE_ORGANIZACION =
  'Ya no puede escribir como la farmacia: volvió a su perfil.';

/**
 * El aviso al abrir un chat nuevo mientras se escribía como la organización.
 *
 * Como la vitrina sólo se responde: la API no deja iniciar conversaciones ni
 * buscar contactos con ella (403). Quien tocó «Chatear» o eligió un contacto
 * quiere escribir **él**, así que el chat se abre con el perfil propio y se
 * dice, para que no crea que le escribió como la farmacia.
 */
export const AVISO_CHAT_NUEVO_CON_PERFIL_PROPIO =
  'Los chats nuevos se inician con su perfil: como la farmacia sólo se responde. Volvió a «Yo».';

/**
 * El error al abrir un chat nuevo como la organización sin perfil propio al
 * que volver.
 */
export const ERROR_CHAT_NUEVO_COMO_ORGANIZACION =
  'Como la farmacia sólo se responde a quien escribe o desde un pedido. Para iniciar un chat nuevo necesita su perfil propio.';

/**
 * Lo que se le dice al botón que pidió abrir un chat mientras ya se estaba
 * abriendo otro: sin esto volvía en silencio y el botón quedaba girando.
 */
export const CHAT_YA_ABRIENDO = 'Ya se está abriendo otro chat. Pruebe de nuevo en un momento.';

/** El error que recibe `alFallar` cuando el store ya estaba abriendo otro chat. */
export class ChatOcupadoError extends Error {
  constructor() {
    super(CHAT_YA_ABRIENDO);
    this.name = 'ChatOcupadoError';
  }
}

/** El aviso cuando un 403 fue de esa conversación y no de la vitrina. */
export const ERROR_SIN_PERMISO_EN_LA_CONVERSACION =
  'No tiene permiso para ver esta conversación con este perfil.';

/**
 * Un adjunto listo para mandar: el archivo y, si quien lo eligió ya la leyó,
 * su miniatura `data:`. Con la miniatura puesta el store no vuelve a leer el
 * archivo: una foto de 8 MB leída tres veces a `data:` era lo que trababa el
 * envío en un teléfono.
 */
export interface AdjuntoParaEnviar {
  readonly archivo: File;
  readonly vistaPrevia?: string | null;
}

/** Los estados de error de la bandeja: S5, S8 y S9 del M34. */
export type FalloDeBandeja = ForbiddenViewState | OfflineViewState | UnexpectedErrorViewState;

/** La próxima acción del vacío de la bandeja (S3): ir a buscar con quién hablar. */
export const PROXIMA_ACCION_DE_BANDEJA = {
  label: 'Buscar medicamentos',
  route: '/search/medications',
} as const;

/** El texto de S9 de la bandeja; el título lo pone quien lo pinta. */
const MENSAJE_DE_FALLO_DE_BANDEJA =
  'No pudimos leer su bandeja. Si vuelve a pasar, avísenos con este código.';

/** El texto de S5 de la bandeja. */
const MENSAJE_DE_BANDEJA_PROHIBIDA = 'Con este perfil no puede leer estos chats.';

/**
 * Traduce el fallo de la lectura de la bandeja a S5, S8 o S9.
 *
 * - **S8** si la petición no llegó (`status 0`) o el navegador dice que no hay
 *   red: reintentar es la salida.
 * - **S5** si la API dijo 403: con este perfil no se leen estos chats.
 * - **S9** todo lo demás, con el id de la petición (`correlationId` del cuerpo
 *   o la cabecera `X-Request-Id`, como `errorToViewState`) para soporte.
 */
export function falloDeBandeja(error: unknown, ahora: Date = new Date()): FalloDeBandeja {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return offline(ahora);
  }
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return forbidden({ message: MENSAJE_DE_BANDEJA_PROHIBIDA });
  }
  const traducido = errorToViewState<never>(error);
  switch (traducido.status) {
    case 'offline':
      return offline(ahora);
    case 'forbidden':
      return forbidden({ message: MENSAJE_DE_BANDEJA_PROHIBIDA });
    case 'error':
      return unexpectedError(traducido.requestId, MENSAJE_DE_FALLO_DE_BANDEJA);
    default:
      // Un 404, un 409 o un 422 al leer una lista no tienen otra salida que la
      // de un error inesperado: igual se conserva el id para encontrarlo.
      return unexpectedError(requestIdDe(error), MENSAJE_DE_FALLO_DE_BANDEJA);
  }
}

/** El id de la petición de un fallo, por las mismas vías que `errorToViewState`. */
function requestIdDe(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'sin-id';
  }
  const cuerpo = error.error as { correlationId?: unknown } | null;
  if (cuerpo !== null && typeof cuerpo === 'object' && typeof cuerpo.correlationId === 'string') {
    return cuerpo.correlationId;
  }
  return error.headers?.get('x-request-id') ?? 'sin-id';
}

/**
 * Cuánto tiempo se puede editar un mensaje después de mandarlo.
 *
 * Cinco minutos, contados contra `sentAt` — la hora del servidor, no la del
 * navegador de quien edita: el reloj local se puede atrasar, y la ventana sería
 * la que quisiera cada máquina.
 *
 * **La regla también vive en el servidor.** Acá se aplica para que el menú no
 * ofrezca algo que va a fallar; ocultar el botón no es la barrera. La maqueta
 * responde 422 fuera de la ventana, igual que la API.
 */
export const VENTANA_DE_EDICION_MS = 5 * 60_000;

/**
 * `true` si el mensaje todavía se puede editar.
 *
 * Se pide `ahora` en vez de leer el reloj adentro para que la vista pueda
 * recalcular con un tic propio —y para que una prueba pueda pararlo.
 *
 * @param mensaje - El mensaje a mirar.
 * @param propio - El perfil de quien está mirando.
 * @param ahora - En qué instante se pregunta.
 */
export function editable(
  mensaje: MensajeDelHilo,
  propio: string | null,
  ahora: number,
): boolean {
  return (
    mensaje.estado === 'enviado' &&
    mensaje.id !== null &&
    propio !== null &&
    mensaje.senderProfileId === propio &&
    // Sin texto no hay nada que editar: una foto sola se borra, no se corrige.
    (mensaje.bodyText ?? '').trim() !== '' &&
    mensaje.sentAt !== undefined &&
    ahora - mensaje.sentAt.getTime() <= VENTANA_DE_EDICION_MS
  );
}

/**
 * Un mensaje que ya se ve en el hilo pero que el servidor todavía no acusó.
 *
 * Existe para que enviar sea instantáneo: la burbuja aparece con el reloj en el
 * mismo gesto de apretar Enter, y recién después se cambia por la que devuelve
 * el `POST`. Antes de esto el hilo se recargaba entero después de cada envío —
 * la pantalla parpadeaba y el mensaje propio tardaba lo que tardara la red en
 * aparecer, que es exactamente lo que ningún chat hace.
 */
export interface MensajePendiente {
  /** Identidad mientras no tenga la del servidor. Nunca sale de acá. */
  readonly claveTemporal: string;
  readonly conversationId: string;
  /**
   * Con qué perfil se escribió, fijado **al encolar**. Despachar con el perfil
   * del momento de despachar mandaba como la farmacia un mensaje escrito como
   * uno mismo, si en el medio se cambiaba de identidad.
   */
  readonly profileId: string;
  readonly bodyText: string;
  readonly replyToMessageId?: string;
  /** Si es un adjunto, lo que hace falta para pintarlo antes de que suba. */
  readonly adjunto?: {
    readonly fileId?: string;
    readonly nombre: string;
    readonly tipo: string;
    /** `blob:` local, para ver la foto sin esperar al servidor. */
    readonly vistaPrevia?: string;
  };
  readonly creadoEn: Date;
  readonly estado: 'enviando' | 'fallado';
  /** Un sticker que subió la persona: viaja marcado (`contentType: 'STICKER'`). */
  readonly comoSticker?: boolean;
}

/**
 * Un mensaje del hilo tal como lo mira la pantalla: el del servidor, o uno
 * todavía en vuelo. Se unifican acá para que la vista no tenga dos listas ni
 * dos formas de dibujar la misma burbuja.
 */
export interface MensajeDelHilo {
  readonly clave: string;
  readonly id: string | null;
  readonly senderProfileId: string;
  readonly bodyText?: string;
  readonly replyToMessageId?: string;
  readonly attachmentFileId?: string;
  readonly sentAt?: Date;
  readonly estado: 'enviando' | 'fallado' | 'enviado';
  /** Si su texto se cambió después de mandarlo — se dice en la burbuja. */
  readonly isEdited?: boolean;
  /** `STICKER` si es uno propio de quien lo mandó; ver `DirectMessage`. */
  readonly contentType?: 'TEXT' | 'MEDIA' | 'STICKER';
  readonly reactions?: readonly MessageReaction[];
  readonly receipts?: readonly MessageReceipt[];
  /** Sólo en los pendientes: con qué reintentar. */
  readonly pendiente?: MensajePendiente;
}

/**
 * El estado de la mensajería, una sola vez para toda la aplicación.
 *
 * ## Por qué un store y no dos pantallas con lo suyo
 *
 * La bandeja y el hilo eran dos componentes con **dos copias de la misma
 * lista**, dos sondeos y dos suscripciones al socket. Cambiar de conversación
 * destruía uno y creaba el otro: la lista se volvía a pedir, el scroll se
 * perdía y durante un instante no había nada dibujado. En un chat cambiar de
 * conversación no puede costar una recarga de la bandeja — es lo primero que
 * separa esto de WhatsApp.
 *
 * Ahora las dos pantallas leen de acá. `Messaging` monta el marco y la lista;
 * `Thread` se pinta en su `router-outlet` y sólo cambia el panel derecho.
 *
 * ## Root, pero con `iniciar()` y `detener()`
 *
 * Es `providedIn: 'root'` para sobrevivir a la navegación entre hilos, pero no
 * sondea desde que arranca la aplicación: `Messaging` lo enciende al entrar y
 * lo apaga al salir. Quien está en la agenda no tiene por qué estar pidiendo
 * conversaciones cada minuto.
 *
 * El armazón sí necesita saber cuántos chats hay sin leer desde cualquier
 * pantalla (N-01, 23/09/2026): para eso está `prepararContador()`, que lee la
 * bandeja una vez y se une al socket, **sin** sondear y **sin** contar como
 * «estar en Chats». El número sigue siendo uno solo: `sinLeer`.
 *
 * ## El socket empuja, el sondeo confirma
 *
 * El socket es la entrega normal; el sondeo (60 s la bandeja, 30 s el hilo) es
 * la red de seguridad si el socket se cayó. Un mensaje que llega por el socket
 * se **aplica en el acto** sobre la fila de la bandeja —último mensaje, hora y
 * un no-leído más— y además dispara una relectura: la fila local alcanza para
 * que la pantalla reaccione ya, y el servidor sigue siendo quien decide el
 * orden y los contadores definitivos.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly community = inject(CommunityClient);
  private readonly archivos = inject(FilesClient);
  private readonly socket = inject(ChatSocketService);
  private readonly autoReply = inject(ChatAutoReply);
  private readonly sesion = inject(SessionStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /* --- Identidad ---------------------------------------------------------- */

  /** El perfil público propio: quién soy dentro de la mensajería. */
  readonly perfil = signal<string | null>(null);
  readonly perfilResuelto = signal(false);
  readonly creandoPerfil = signal(false);

  /**
   * Lo último que salió mal, para que la pantalla lo diga.
   *
   * Se escribe sólo con {@link fallar}: el motivo lo pone la API cuando lo
   * explica (el plazo de edición vencido, un bloqueo que ya existía) y el
   * código de soporte va siempre que lo haya.
   */
  readonly error = signal('');

  /**
   * El perfil propio de la sesión, aunque se esté escribiendo como la
   * farmacia. `perfil` es **con quién se actúa**: todo lo que habla con la API
   * (bandeja, hilo, envío, leído, socket) usa ése.
   */
  readonly perfilPropio = signal<string | null>(null);

  /**
   * Las vitrinas de organización con las que esta persona puede escribir: las
   * devolvió `GET /community/profiles/organization-showcases/me`
   * (`descubrirVitrina()`) o el `POST /pharmacy/orders/:id/conversation`.
   *
   * Que estén acá **no** es un permiso: es la puerta que se ofrece. Quien
   * decide es la API en cada llamada, y un 403 devuelve al perfil propio.
   */
  readonly vitrinasDeOrganizacion = signal<readonly VitrinaParaActuar[]>([]);

  /**
   * La vitrina con la que se está escribiendo o, si se escribe como uno
   * mismo, la primera que se ofrece. `null` si no hay ninguna.
   */
  readonly vitrinaDeOrganizacion = computed<VitrinaParaActuar | null>(() => {
    const vitrinas = this.vitrinasDeOrganizacion();
    const perfil = this.perfil();
    return vitrinas.find((v) => v.profileId === perfil) ?? vitrinas[0] ?? null;
  });

  /** `true` si se está escribiendo como una organización. */
  readonly actuandoComoOrganizacion = computed(() => {
    const perfil = this.perfil();
    return this.vitrinasDeOrganizacion().some((v) => v.profileId === perfil);
  });

  /** Lo que se le avisa a quien perdió el permiso de escribir como la farmacia. */
  readonly avisoDePerfil = signal('');

  /* --- Bandeja ------------------------------------------------------------ */

  readonly conversaciones = signal<readonly ConversationListItem[]>([]);
  readonly cargandoBandeja = signal(false);
  readonly bandejaCargada = signal(false);

  /**
   * Por qué falló la última lectura de la bandeja, si falló. Vive aparte de
   * `error`: la bandeja tiene su estado propio y no pinta encima de la
   * pantalla un problema que es de la lista.
   */
  private readonly falloDeLaBandeja = signal<FalloDeBandeja | null>(null);

  /** Cuándo se leyó bien la bandeja por última vez: la antigüedad de S7. */
  private readonly bandejaLeidaEn = signal<Date | null>(null);

  /**
   * El texto que puso en `error` el último tic fallido en S7, para quitarlo
   * —y sólo ése— cuando la bandeja se vuelve a leer bien. Público porque la
   * pantalla lo pinta junto a la bandeja (con su antigüedad) y no en el aviso
   * global: S7 tiene su propio estado.
   */
  readonly motivoDeBandejaAtrasada = signal<string | null>(null);

  /**
   * La bandeja como uno de los estados del M34 (ADR-0005):
   *
   * - S2 `loading` hasta la primera lectura.
   * - S5 si la API dijo 403, **haya o no filas**: mostrarle las filas a
   *   quien ya no tiene permiso de leerlas no es «datos atrasados».
   * - S8/S9 si falló **y no hay nada que mostrar**.
   * - S7 `stale` si falló (sin ser un 403) pero había filas: se conservan
   *   —un tic fallido no borra lo que se estaba mirando— y se dice de cuándo
   *   son.
   * - S3 `empty` con próxima acción si se leyó y no hay chats.
   * - `ready` con las filas.
   */
  readonly bandeja = computed<ViewState<readonly ConversationListItem[]>>(() => {
    if (!this.bandejaCargada()) {
      return loading();
    }
    const filas = this.conversaciones();
    const fallo = this.falloDeLaBandeja();
    if (fallo !== null) {
      return filas.length === 0 || fallo.status === 'forbidden'
        ? fallo
        : stale(filas, this.bandejaLeidaEn() ?? new Date(0));
    }
    return filas.length === 0
      ? empty(
          PROXIMA_ACCION_DE_BANDEJA,
          'Consulte a una farmacia desde un producto o desde su pedido, o escríbale a un profesional.',
        )
      : ready(filas);
  });

  /* --- Hilo abierto ------------------------------------------------------- */

  readonly activaId = signal<string | null>(null);
  /** Del más reciente al más antiguo, como los devuelve el contrato. */
  readonly mensajes = signal<readonly DirectMessage[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly peerReadUpTo = signal<Date | null>(null);
  readonly cargandoHilo = signal(false);
  readonly hiloCargado = signal(false);
  readonly enviando = signal(false);

  /** Los que todavía no acusó el servidor, de todas las conversaciones. */
  readonly pendientes = signal<readonly MensajePendiente[]>([]);

  /**
   * El borrador de cada conversación.
   *
   * Cambiar de chat y volver conserva lo que se había escrito, como WhatsApp.
   * Vive en memoria y no en `localStorage`: un borrador a medias es del rato,
   * no de la cuenta.
   */
  private readonly borradores = new Map<string, string>();

  /** A qué mensaje se está respondiendo, si a alguno. */
  readonly respondiendoA = signal<MensajeDelHilo | null>(null);

  /**
   * Qué mensaje propio se está editando, si alguno.
   *
   * Responder y editar son excluyentes: el composer es uno solo, y las dos
   * cosas quieren el mismo campo con distinto significado.
   */
  readonly editando = signal<MensajeDelHilo | null>(null);

  /**
   * Cuántos sin leer tenía la conversación al abrirla.
   *
   * Se guarda porque abrir el hilo apaga el contador en el acto, y el
   * separador «N mensajes no leídos» —lo que le dice a alguien dónde retomar
   * después de dos días sin entrar— necesita saber cuántos eran **antes** de
   * apagarlo.
   */
  readonly noLeidosAlAbrir = signal(0);

  /* --- Bloqueados ---------------------------------------------------------- */

  /**
   * A quién bloqueó la persona, con su nombre.
   *
   * La API sólo dice el `profileId` bloqueado; el nombre se le pregunta a la
   * ficha pública, y si no se puede leer se cae al de la conversación —o a
   * «Perfil bloqueado»—: una lista de identificadores no le sirve a nadie.
   */
  readonly bloqueados = signal<readonly PerfilBloqueado[]>([]);
  readonly bloqueadosCargados = signal(false);
  /**
   * La lectura de bloqueos falló: la lista vacía NO significa «no bloqueó a
   * nadie». Distinto de `bloqueadosCargados`, que sólo dice que ya contestó.
   */
  readonly bloqueosFallaron = signal(false);

  private readonly idsBloqueados = computed(
    () => new Set(this.bloqueados().map((b) => b.profileId)),
  );

  /**
   * `true` si la conversación abierta es directa con alguien bloqueado.
   *
   * En un grupo no hay «el otro»: bloquear a un integrante no cierra el grupo.
   */
  readonly hiloBloqueado = computed(() => {
    const peers = this.conversacionActiva()?.peers ?? [];
    return peers.length === 1 && this.idsBloqueados().has(peers[0].profileId);
  });

  /* --- Buscador de gente nueva -------------------------------------------- */

  readonly resultados = signal<readonly ChatContact[]>([]);
  readonly buscandoAhora = signal(false);
  readonly abriendo = signal(false);

  private versionBusqueda = 0;
  private temporizadorBandeja: ReturnType<typeof setTimeout> | null = null;
  private temporizadorHilo: ReturnType<typeof setTimeout> | null = null;
  private encendido = false;
  private contadorPreparado = false;
  /** Quién espera a que se resuelva el perfil propio, pedido una sola vez. */
  private esperandoPerfil: (() => void)[] | null = null;
  /** Para qué usuario se resolvió la identidad: otro usuario la vuelve a pedir. */
  private usuarioDeLaIdentidad: string | null = null;
  private actuacionRestaurada = false;
  /** Para qué usuario se pidieron ya las vitrinas: una vez por cuenta. */
  private vitrinaBuscada: string | null = null;
  private hiloMarcado = new Set<string>();

  /**
   * Sube con cada cambio de identidad (`actuarComo`, `olvidarIdentidad`). Una
   * respuesta de bandeja o de hilo pedida con otra generación es de la
   * identidad anterior y se descarta: volcarla mostraría los chats de la
   * farmacia en «Yo», o los de la cuenta que acaba de salir.
   */
  private generacionDeIdentidad = 0;

  /**
   * Sube con cada `olvidarIdentidad`. El perfil propio que llega pedido con
   * otra generación es de la cuenta anterior. Aparte de la de identidad porque
   * cambiar a la farmacia mientras viaja `/community/profiles/me` no lo
   * invalida: es la misma persona.
   */
  private generacionDeUsuario = 0;

  /** La vitrina que se está revalidando tras un 403, para no preguntar dos veces. */
  private revalidando: string | null = null;

  /**
   * Lo que se quiso abrir sin perfil propio todavía (M4): se retoma cuando
   * `crearPerfil()` termina bien, con el destino y la tarjeta que traía.
   */
  private intencionPendiente: (() => void) | null = null;

  /** Las subidas en cola (`concatMap`), para cortarlas al cambiar de identidad. */
  private subidas = new Subscription();

  /**
   * Las peticiones de la apertura de un chat en curso (`escribirA`,
   * `abrirConversacion`, `abrirComoOrganizacion` y lo que encadenan), para
   * cortarlas al cambiar de identidad, como {@link subidas}.
   *
   * Sin esto, una apertura que contestaba después de `olvidarIdentidad` o de
   * `actuarComo` ofrecía la vitrina de la cuenta anterior, la guardaba en la
   * pestaña con el `userId` nuevo, mandaba la tarjeta con el perfil viejo y
   * navegaba. Cada paso, además, mira {@link aperturaVigente}: lo que ya
   * estaba emitiendo cuando se cortó no sigue.
   */
  private apertura = new Subscription();

  /**
   * Cuándo se le mandó la última respuesta automática a cada conversación.
   *
   * En memoria y no en el navegador a propósito: el descanso entre avisos
   * protege a la otra persona de recibir cinco carteles seguidos, y una sesión
   * nueva es un momento razonable para volver a empezar. Persistirlo sería
   * guardar un dato de comportamiento ajeno sin necesidad.
   */
  private readonly ultimoAvisoPorConversacion = new Map<string, number>();

  /**
   * Los adjuntos ya resueltos, por id de archivo: la `data:` URL lista para un
   * `src` o un `href`, `''` mientras se pide, `null` si no se pudo leer.
   */
  private readonly urlesDeArchivo = signal<ReadonlyMap<string, string | null>>(new Map());

  /**
   * El hilo listo para leer: del más viejo al más nuevo, con los pendientes de
   * esta conversación al final.
   */
  readonly enOrden = computed<readonly MensajeDelHilo[]>(() => {
    const activa = this.activaId();
    const delServidor = [...this.mensajes()]
      .reverse()
      .map<MensajeDelHilo>((mensaje) => ({
        clave: mensaje.id,
        id: mensaje.id,
        senderProfileId: mensaje.senderProfileId,
        bodyText: mensaje.bodyText,
        replyToMessageId: mensaje.replyToMessageId,
        attachmentFileId: mensaje.attachmentFileId,
        sentAt: mensaje.sentAt,
        estado: 'enviado',
        isEdited: mensaje.isEdited,
        contentType: mensaje.contentType,
        reactions: mensaje.reactions,
        receipts: mensaje.receipts,
      }));

    const perfil = this.perfil();
    const enVuelo = this.pendientes()
      .filter((p) => p.conversationId === activa && p.profileId === perfil)
      .map<MensajeDelHilo>((pendiente) => ({
        clave: pendiente.claveTemporal,
        id: null,
        senderProfileId: pendiente.profileId,
        bodyText: pendiente.bodyText,
        replyToMessageId: pendiente.replyToMessageId,
        attachmentFileId: pendiente.adjunto?.fileId,
        sentAt: pendiente.creadoEn,
        estado: pendiente.estado,
        contentType: pendiente.comoSticker ? 'STICKER' : undefined,
        pendiente,
      }));

    return [...delServidor, ...enVuelo];
  });

  /** La conversación abierta, si está en la bandeja. */
  readonly conversacionActiva = computed(() =>
    this.conversaciones().find((c) => c.id === this.activaId()),
  );

  /** Cuántos mensajes sin leer hay en total, para el título de la pestaña. */
  readonly sinLeer = computed(() =>
    this.conversaciones().reduce((total, c) => total + c.unreadCount, 0),
  );

  constructor() {
    // Mensaje nuevo: se aplica sobre lo que ya hay —el hilo abierto y la fila
    // de la bandeja— y se confirma releyendo. Aplicar y releer no es
    // redundante: lo primero hace que la pantalla reaccione en el acto, lo
    // segundo es lo único que garantiza que el orden y los contadores queden
    // como los pintaría un refresco.
    this.socket.onMessage.pipe(takeUntilDestroyed()).subscribe((mensaje) => {
      if (mensaje.conversationId === this.activaId()) {
        this.absorber([mensaje]);
        this.marcarLeido();
      }
      this.aplicarEnLaFila(mensaje);
      this.recargarBandeja();
      this.quizasResponderSolo(mensaje);
    });

    // Edición ajena: se aplica sobre la burbuja que ya está en pantalla. Sin
    // esto, el otro lado corregiría su mensaje y acá seguiría el texto viejo
    // hasta el próximo tic de sondeo.
    this.socket.onMessageUpdated
      .pipe(takeUntilDestroyed())
      .subscribe((mensaje) => {
        if (mensaje.conversationId === this.activaId()) {
          this.aplicarTexto(mensaje.id, mensaje.bodyText, mensaje.isEdited ?? true);
        }
        this.recargarBandeja();
      });

    this.socket.onRead.pipe(takeUntilDestroyed()).subscribe((evento) => {
      if (evento.conversationId !== this.activaId()) {
        return;
      }
      const leido = this.mensajes().find((m) => m.id === evento.lastReadMessageId);
      if (leido?.sentAt) {
        this.peerReadUpTo.set(leido.sentAt);
      }
    });

    this.socket.onNewConversation
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.recargarBandeja());

    // El gateway no deja actuar con el perfil pedido: o nunca pudo (una
    // pestaña que recordaba la farmacia de otra sesión) o dejó de poder en vivo
    // (`membership:recheck`). Si el que falló es la vitrina con la que se está
    // escribiendo, se vuelve al perfil propio.
    //
    // `membership:recheck` es la pérdida en vivo y se acepta tal cual; otro
    // `NOT_OWN_PROFILE` (un `join` rechazado) se confirma preguntándole a la
    // API por las vitrinas, igual que un 403 de la REST.
    this.socket.onError.pipe(takeUntilDestroyed()).subscribe((error) => {
      const perfil = this.perfil();
      if (error.code !== 'NOT_OWN_PROFILE' || !this.actuandoComoOrganizacion() || perfil === null) {
        return;
      }
      if (error.profileId !== undefined && error.profileId !== perfil) {
        return;
      }
      if (error.event === 'membership:recheck') {
        this.perderPermisoDeOrganizacion(perfil);
      } else {
        this.revalidarVitrina(perfil);
      }
    });

    // Otra cuenta en la misma pestaña (cerrar sesión no recarga la página): la
    // identidad de la anterior no puede quedar puesta —sería leer su bandeja,
    // o escribir como su farmacia—.
    // `untracked`: olvidar escribe y lee una docena de señales, y ninguna de
    // ellas tiene que volver a disparar este efecto.
    effect(() => {
      const usuario = this.sesion.userId();
      untracked(() => {
        if (this.usuarioDeLaIdentidad !== null && usuario !== this.usuarioDeLaIdentidad) {
          this.olvidarIdentidad();
        }
      });
    });

    // Las fotos y documentos que aparecen en el hilo necesitan una URL
    // firmada, y pedirla desde el template sería pedirla en cada ciclo de
    // detección de cambios. Se resuelven acá, una vez por archivo.
    effect(() => this.resolverAdjuntos(this.enOrden()));
  }

  /* --- Encendido ---------------------------------------------------------- */

  /**
   * Enciende la mensajería: resuelve el perfil propio, carga la bandeja y se
   * une al socket. Idempotente — `Messaging` la llama al entrar y volver a
   * entrar no vuelve a pedir el perfil.
   */
  iniciar(): void {
    // Entrar a la mensajería cuenta como estar: es lo primero que desactiva la
    // respuesta automática.
    this.autoReply.marcarActividad();
    if (this.encendido) {
      this.recargarBandeja();
      return;
    }
    this.encendido = true;
    this.conPerfil(() => this.arrancarConPerfil());
    this.descubrirVitrina();
  }

  /* --- Con qué perfil se escribe ------------------------------------------- */

  /**
   * Pide las vitrinas de organización con las que esta sesión puede atender
   * el chat, para ofrecer «Escribiendo como: Farmacia X».
   *
   * Las da `GET /community/profiles/organization-showcases/me`, con la misma
   * regla que autoriza escribir como ellas (`canAttend`: membresía activa
   * OWNER/ADMIN/STAFF y, para una farmacia, `PHARMACY_STAFF`). Antes se
   * adivinaba el slug `organization-<tenantId>`, que no es el de las farmacias
   * sembradas (`farmacia-*`) ni resuelve una vitrina privada.
   *
   * Sólo si el token trae el rol de personal de farmacia: el selector es de
   * ese mostrador. Fallar acá no es un error que se muestre: simplemente no
   * hay selector.
   */
  descubrirVitrina(): void {
    const usuario = this.sesion.userId();
    if (
      usuario === null ||
      !this.sesion.roles().includes(ROL_PERSONAL_DE_FARMACIA) ||
      this.vitrinaBuscada === usuario
    ) {
      return;
    }
    this.vitrinaBuscada = usuario;
    this.community.listOwnOrganizationShowcases().subscribe({
      next: (items) => {
        if (this.sesion.userId() !== usuario) {
          return;
        }
        // La que está en uso (restaurada de la pestaña o abierta desde un
        // pedido) se queda aunque no venga: si la API ya no la deja, lo dirá
        // con un 403 al usarla, y eso la revalida.
        this.aplicarVitrinas(items);
      },
      error: () => undefined,
    });
  }

  /**
   * Pone las vitrinas que devolvió la API, sin la propia. La que está en uso
   * se conserva aunque no venga: la decisión de quitarla es de
   * {@link perderPermisoDeOrganizacion}, que además avisa.
   */
  private aplicarVitrinas(
    items: readonly { readonly profileId: string; readonly displayName: string }[],
  ): void {
    const ofrecidas = items
      .filter((item) => item.profileId !== this.perfilPropio())
      .map((item) => ({ profileId: item.profileId, nombre: item.displayName }));
    const enUso = this.vitrinasDeOrganizacion().find((v) => v.profileId === this.perfil());
    this.vitrinasDeOrganizacion.set(
      enUso === undefined || ofrecidas.some((v) => v.profileId === enUso.profileId)
        ? ofrecidas
        : [enUso, ...ofrecidas],
    );
  }

  /** Suma una vitrina a las ofrecidas, o le actualiza el nombre. */
  private ofrecerVitrina(vitrina: VitrinaParaActuar): void {
    this.vitrinasDeOrganizacion.update((vitrinas) =>
      vitrinas.some((v) => v.profileId === vitrina.profileId)
        ? vitrinas.map((v) => (v.profileId === vitrina.profileId ? vitrina : v))
        : [...vitrinas, vitrina],
    );
  }

  /**
   * Cambia el perfil con el que se escribe: el propio (`null`) o la vitrina de
   * la organización.
   *
   * Cambiar es otra bandeja: se cierra el hilo abierto —es de la otra
   * identidad—, se vacía la lista, se corta el socket y se vuelve a unir con
   * el perfil nuevo, y se relee. La elección se recuerda en la pestaña.
   */
  actuarComo(profileId: string | null): void {
    const destino = profileId === null ? this.perfilPropio() : profileId;
    if (
      profileId !== null &&
      !this.vitrinasDeOrganizacion().some((v) => v.profileId === profileId)
    ) {
      return;
    }
    this.avisoDePerfil.set('');
    if (destino === this.perfil()) {
      this.guardarActuacion();
      return;
    }
    this.cerrar();
    this.generacionDeIdentidad++;
    // Lo que todavía subía era de la otra identidad: se corta y no se manda.
    this.cancelarSubidas();
    // Lo mismo la apertura de un chat: era para la otra identidad.
    this.cancelarApertura();
    this.cargandoHilo.set(false);
    this.perfil.set(destino);
    this.conversaciones.set([]);
    this.bandejaCargada.set(false);
    this.cargandoBandeja.set(false);
    this.falloDeLaBandeja.set(null);
    this.bandejaLeidaEn.set(null);
    // Los contactos buscados eran para iniciar chats con la otra identidad.
    this.resultados.set([]);
    this.limpiarBloqueos();
    this.error.set('');
    this.guardarActuacion();
    this.socket.reiniciar();
    if (destino !== null && (this.encendido || this.contadorPreparado)) {
      this.socket.joinInbox(destino);
      this.recargarBandeja();
    }
    // Los bloqueos son de cada perfil: los de la farmacia no son los propios.
    if (destino !== null && this.encendido) {
      this.cargarBloqueos();
    }
  }

  /**
   * Se perdió el permiso de escribir como esa vitrina: confirmado por la API
   * (ya no la lista) o por el socket (`membership:recheck`).
   *
   * Si es la que está en uso, se vuelve a «Yo» con aviso; si no —se cambió de
   * identidad mientras se confirmaba—, sólo deja de ofrecerse.
   */
  private perderPermisoDeOrganizacion(perdida: string): void {
    const enUso = this.perfil() === perdida;
    if (enUso) {
      this.actuarComo(null);
    }
    // Ya no se ofrece una puerta que la API acaba de cerrar; las otras, sí.
    this.vitrinasDeOrganizacion.update((vitrinas) =>
      vitrinas.filter((v) => v.profileId !== perdida),
    );
    if (enUso) {
      this.avisoDePerfil.set(AVISO_SIN_PERMISO_DE_ORGANIZACION);
    }
  }

  /**
   * Ante un 403 escribiendo como la organización, pregunta si se sigue
   * pudiendo: no todo 403 es perder la farmacia.
   *
   * Un 403 en `cargarHilo` o en un envío puede ser **de esa conversación**
   * (un hilo en el que la vitrina no participa), y apagar el modo farmacia por
   * eso lo dejaba apagado para siempre: las vitrinas se buscan una vez por
   * cuenta. Así que se le pregunta a la misma API que las ofrece
   * (`GET /community/profiles/organization-showcases/me`):
   *
   * - si la vitrina sigue en la lista, el 403 era de la conversación — el
   *   error ya lo mostró quien llamó y la identidad no cambia;
   * - si ya no está, se quita y se vuelve a «Yo» con aviso.
   *
   * Si la pregunta falla no se decide nada: el error ya está a la vista.
   */
  private siPerdioElPermiso(error: unknown, profileId: string | null): void {
    if (profileId !== null && this.revalidaLaVitrina(error, profileId)) {
      this.revalidarVitrina(profileId);
    }
  }

  /** `true` si es un 403 con una vitrina de organización: lo decide la revalidación. */
  private revalidaLaVitrina(error: unknown, profileId: string): boolean {
    return (
      error instanceof HttpErrorResponse &&
      error.status === 403 &&
      this.vitrinasDeOrganizacion().some((v) => v.profileId === profileId)
    );
  }

  private revalidarVitrina(profileId: string): void {
    if (this.revalidando === profileId) {
      return;
    }
    this.revalidando = profileId;
    const generacion = this.generacionDeUsuario;
    this.community.listOwnOrganizationShowcases().subscribe({
      next: (items) => {
        this.revalidando = null;
        if (generacion !== this.generacionDeUsuario) {
          return;
        }
        if (!items.some((item) => item.profileId === profileId)) {
          this.perderPermisoDeOrganizacion(profileId);
        }
        // De paso, la lista y los nombres quedan al día.
        this.aplicarVitrinas(items);
      },
      error: () => {
        this.revalidando = null;
      },
    });
  }

  private guardarActuacion(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      const perfil = this.perfil();
      const vitrina = this.vitrinasDeOrganizacion().find((v) => v.profileId === perfil);
      const usuario = this.sesion.userId();
      if (vitrina !== undefined && usuario !== null) {
        const guardada: ActuacionGuardada = { userId: usuario, ...vitrina };
        sessionStorage.setItem(CLAVE_DE_ACTUACION, JSON.stringify(guardada));
      } else {
        sessionStorage.removeItem(CLAVE_DE_ACTUACION);
      }
    } catch {
      // Sin almacenamiento la elección dura lo que la página: no es un error.
    }
  }

  /** Recupera la elección de la pestaña, si es de este mismo usuario. */
  private restaurarActuacion(): void {
    if (this.actuacionRestaurada || !this.isBrowser) {
      return;
    }
    this.actuacionRestaurada = true;
    try {
      const crudo = sessionStorage.getItem(CLAVE_DE_ACTUACION);
      if (crudo === null) {
        return;
      }
      const guardada = JSON.parse(crudo) as Partial<ActuacionGuardada>;
      if (
        typeof guardada.profileId !== 'string' ||
        typeof guardada.nombre !== 'string' ||
        guardada.userId !== this.sesion.userId()
      ) {
        sessionStorage.removeItem(CLAVE_DE_ACTUACION);
        return;
      }
      this.ofrecerVitrina({ profileId: guardada.profileId, nombre: guardada.nombre });
      this.perfil.set(guardada.profileId);
    } catch {
      // Ilegible o bloqueado: se arranca con el perfil propio.
    }
  }

  /** Lo de la cuenta anterior fuera: perfil, vitrina, bandeja e hilo. */
  private olvidarIdentidad(): void {
    this.cerrar();
    this.generacionDeIdentidad++;
    this.generacionDeUsuario++;
    this.cancelarSubidas();
    this.cancelarApertura();
    this.intencionPendiente = null;
    this.revalidando = null;
    this.cargandoHilo.set(false);
    this.cargandoBandeja.set(false);
    this.falloDeLaBandeja.set(null);
    this.bandejaLeidaEn.set(null);
    this.resultados.set([]);
    this.limpiarBloqueos();
    this.perfil.set(null);
    this.perfilPropio.set(null);
    this.perfilResuelto.set(false);
    this.vitrinasDeOrganizacion.set([]);
    this.avisoDePerfil.set('');
    this.conversaciones.set([]);
    this.bandejaCargada.set(false);
    this.pendientes.set([]);
    this.error.set('');
    this.usuarioDeLaIdentidad = null;
    this.actuacionRestaurada = false;
    this.vitrinaBuscada = null;
    this.contadorPreparado = false;
    this.esperandoPerfil = null;
    this.urlesDeArchivo.set(new Map());
    this.socket.reiniciar();
    if (this.encendido) {
      this.encendido = false;
      this.pararTemporizadores();
    }
  }

  /**
   * Deja `sinLeer` al día **sin entrar a Chats**: resuelve el perfil, lee la
   * bandeja una vez y se une al socket, que desde ahí la mantiene (cada mensaje
   * nuevo se aplica sobre su fila y relee). Lo llama el armazón para el número
   * del ícono de Chats (N-01).
   *
   * No es `iniciar()` a medias, y la diferencia es el motivo de que exista:
   * **no** marca actividad —quien está en la agenda no está leyendo chats, y
   * marcarlo apagaría la respuesta automática— y **no** sondea cada minuto.
   * Idempotente. Si `Messaging` ya encendió el store, no hace nada: la bandeja
   * y el socket ya están.
   */
  prepararContador(): void {
    if (this.contadorPreparado) {
      return;
    }
    this.contadorPreparado = true;
    this.conPerfil(() => {
      const propio = this.perfil();
      if (propio === null || this.encendido) {
        return;
      }
      this.socket.joinInbox(propio);
      this.recargarBandeja();
    });
  }

  /**
   * Corre `despues` con el perfil propio resuelto, pidiéndolo **una sola vez**
   * aunque lo necesiten dos a la vez —el armazón con `prepararContador()` y
   * `Messaging` con `iniciar()`, que montan casi juntos—: el segundo espera la
   * respuesta del primero en vez de preguntar de nuevo.
   */
  private conPerfil(despues: () => void): void {
    if (this.perfilResuelto()) {
      despues();
      return;
    }
    if (this.esperandoPerfil !== null) {
      this.esperandoPerfil.push(despues);
      return;
    }
    this.esperandoPerfil = [despues];
    this.usuarioDeLaIdentidad = this.sesion.userId();
    this.restaurarActuacion();
    const generacion = this.generacionDeUsuario;
    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        // De la cuenta anterior: llegó después de `olvidarIdentidad`.
        if (generacion !== this.generacionDeUsuario) {
          return;
        }
        this.perfilPropio.set(propio?.id ?? null);
        // Si se está escribiendo como la farmacia, eso manda: el perfil propio
        // queda a mano para volver.
        if (!this.actuandoComoOrganizacion()) {
          this.perfil.set(propio?.id ?? null);
        }
        this.perfilResuelto.set(true);
        const esperan = this.esperandoPerfil ?? [];
        this.esperandoPerfil = null;
        // Sin perfil no hay bandeja que leer: cada espera lo comprueba.
        esperan.forEach((correr) => correr());
      },
      error: (error: unknown) => {
        if (generacion !== this.generacionDeUsuario) {
          return;
        }
        this.perfilResuelto.set(true);
        this.esperandoPerfil = null;
        this.fallar(error, 'No pudimos saber si tiene perfil público.');
      },
    });
  }

  /** Apaga los sondeos. El perfil y lo cargado se conservan. */
  detener(): void {
    this.encendido = false;
    this.pararTemporizadores();
  }

  private arrancarConPerfil(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.socket.joinInbox(propio);
    this.recargarBandeja();
    this.cargarBloqueos();
    this.agendarBandeja();
    // Si el hilo ya estaba elegido —se entró por `/messaging/<id>` directo— hay
    // que cargarlo ahora, que es cuando recién se sabe con qué perfil leerlo.
    // El hilo se marca activo antes de que el perfil esté resuelto: el marco y
    // el panel se construyen en el mismo ciclo, y el `abrir()` del panel llega
    // primero.
    const activa = this.activaId();
    if (activa !== null) {
      this.socket.joinConversation(activa, propio);
      this.cargarHilo(true);
    }
  }

  /**
   * Crea la vitrina pública que la mensajería necesita, sin salir de la
   * pantalla.
   *
   * Se crea con lo mínimo —nombre y slug— y **sin publicarla en el
   * directorio**: `visibility` va omitido a propósito, porque aparecer en la
   * guía pública es una decisión aparte que se toma en «Mi perfil».
   */
  crearPerfil(): void {
    const tenantId = this.sesion.activeTenantId();
    if (tenantId === null || this.creandoPerfil()) {
      if (tenantId === null) {
        this.error.set('No pudimos saber en qué organización está.');
      }
      return;
    }

    const nombre = this.sesion.displayName() ?? 'Mi perfil';
    this.creandoPerfil.set(true);
    const generacion = this.generacionDeUsuario;
    this.community
      .upsertOwnProfile({ tenantId, slug: slugDe(nombre), displayName: nombre })
      .subscribe({
        next: (propio) => {
          this.creandoPerfil.set(false);
          if (generacion !== this.generacionDeUsuario) {
            return;
          }
          this.perfilPropio.set(propio.id);
          this.perfil.set(propio.id);
          this.perfilResuelto.set(true);
          this.error.set('');
          this.arrancarConPerfil();
          // Quien llegó con «Chatear» y tuvo que crear el perfil sigue donde
          // iba: el hilo con esa farmacia, con su tarjeta.
          const pendiente = this.intencionPendiente;
          this.intencionPendiente = null;
          pendiente?.();
        },
        error: (error: unknown) => {
          this.creandoPerfil.set(false);
          this.fallar(error, 'No pudimos crear su perfil. Intente de nuevo.');
        },
      });
  }

  /* --- Bloquear ------------------------------------------------------------ */

  /** `true` si ese perfil está bloqueado. */
  estaBloqueado(profileId: string): boolean {
    return this.idsBloqueados().has(profileId);
  }

  /** Lee los bloqueos propios y les busca el nombre. */
  cargarBloqueos(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    // Los bloqueos son del perfil con que se actúa: una respuesta pedida con
    // otra identidad no se vuelca.
    const generacion = this.generacionDeIdentidad;
    const vigente = (): boolean =>
      generacion === this.generacionDeIdentidad && this.perfil() === propio;
    this.community.listBlocks({ profileId: propio, limit: 100 }).subscribe({
      next: (pagina) => {
        if (!vigente()) {
          return;
        }
        const conocidos = new Map(this.bloqueados().map((b) => [b.profileId, b]));
        this.bloqueados.set(
          pagina.items.map((item) => ({
            profileId: item.blockedProfileId,
            displayName:
              conocidos.get(item.blockedProfileId)?.displayName ??
              this.nombreConocido(item.blockedProfileId),
            desde: item.createdAt,
          })),
        );
        this.bloqueadosCargados.set(true);
        this.bloqueosFallaron.set(false);
        // Los que aún no tienen nombre se le piden a su ficha, uno por uno: es
        // una lista corta y cada ficha se pide una sola vez.
        for (const bloqueado of this.bloqueados()) {
          if (bloqueado.displayName === SIN_NOMBRE) {
            this.resolverNombre(bloqueado.profileId);
          }
        }
      },
      error: (error: unknown) => {
        if (!vigente()) {
          return;
        }
        this.bloqueadosCargados.set(true);
        this.bloqueosFallaron.set(true);
        this.fallar(error, 'No pudimos leer las personas que bloqueó.');
      },
    });
  }

  /**
   * Bloquea a alguien. Se refleja en el acto y se revierte si el servidor dice
   * que no: mostrar bloqueado a quien no lo está sería una promesa falsa de
   * que no te va a poder escribir.
   */
  bloquear(profileId: string, nombre?: string): void {
    const propio = this.perfil();
    if (propio === null || this.estaBloqueado(profileId)) {
      return;
    }
    const entrada: PerfilBloqueado = {
      profileId,
      displayName: nombre ?? this.nombreConocido(profileId),
      desde: new Date(),
    };
    this.bloqueados.update((lista) => [entrada, ...lista]);
    this.community
      .block({ blockerProfileId: propio, blockedProfileId: profileId })
      .subscribe({
        next: () => undefined,
        error: (error: unknown) => {
          this.bloqueados.update((lista) => lista.filter((b) => b.profileId !== profileId));
          this.fallar(error, 'No pudimos bloquear a esa persona. Intente de nuevo.');
        },
      });
  }

  /** Levanta un bloqueo. Mismo criterio que {@link bloquear}: primero se ve. */
  desbloquear(profileId: string): void {
    const propio = this.perfil();
    const previo = this.bloqueados().find((b) => b.profileId === profileId);
    if (propio === null || previo === undefined) {
      return;
    }
    this.bloqueados.update((lista) => lista.filter((b) => b.profileId !== profileId));
    this.community
      .unblock({ blockerProfileId: propio, blockedProfileId: profileId })
      .subscribe({
        next: () => undefined,
        error: (error: unknown) => {
          this.bloqueados.update((lista) => [previo, ...lista]);
          this.fallar(error, 'No pudimos desbloquear a esa persona. Intente de nuevo.');
        },
      });
  }

  /** Olvida los bloqueos leídos: eran de la identidad anterior. */
  private limpiarBloqueos(): void {
    this.bloqueados.set([]);
    this.bloqueadosCargados.set(false);
    this.bloqueosFallaron.set(false);
  }

  /** El nombre que ya se sabe de un perfil, por sus conversaciones. */
  private nombreConocido(profileId: string): string {
    for (const conversacion of this.conversaciones()) {
      const peer = conversacion.peers.find((p) => p.profileId === profileId);
      if (peer?.displayName) {
        return peer.displayName;
      }
    }
    return SIN_NOMBRE;
  }

  private resolverNombre(profileId: string): void {
    this.community.readProfile(profileId).subscribe({
      next: (ficha) =>
        this.bloqueados.update((lista) =>
          lista.map((b) =>
            b.profileId === profileId ? { ...b, displayName: ficha.displayName } : b,
          ),
        ),
      // Sin ficha se queda «Perfil bloqueado»: no vale un cartel por un nombre.
      error: () => undefined,
    });
  }

  /* --- Bandeja ------------------------------------------------------------ */

  recargarBandeja(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.cargandoBandeja.set(true);
    const generacion = this.generacionDeIdentidad;
    // La respuesta sirve sólo si sigue siendo la misma identidad: otra
    // generación es la bandeja de quien se era antes de `actuarComo`.
    const vigente = (): boolean =>
      generacion === this.generacionDeIdentidad && this.perfil() === propio;
    this.community
      .listConversations({ profileId: propio, limit: LIMITE_DE_BANDEJA })
      .subscribe({
        next: (pagina) => {
          if (!vigente()) {
            return;
          }
          this.conversaciones.set(pagina.items);
          this.bandejaCargada.set(true);
          this.cargandoBandeja.set(false);
          this.falloDeLaBandeja.set(null);
          this.bandejaLeidaEn.set(new Date());
          // El aviso que dejó un tic fallido se va con la lectura buena; uno
          // de otra cosa (un envío, una edición) no es de la bandeja y queda.
          const motivo = this.motivoDeBandejaAtrasada();
          if (motivo !== null && this.error() === motivo) {
            this.error.set('');
          }
          this.motivoDeBandejaAtrasada.set(null);
        },
        error: (error: unknown) => {
          if (!vigente()) {
            return;
          }
          this.cargandoBandeja.set(false);
          this.bandejaCargada.set(true);
          // No se vacía lo que ya había: un tic fallido no es motivo para
          // borrarle a alguien la bandeja que estaba mirando (queda en S7).
          // Salvo un 403: ahí la API dijo que con este perfil no se leen, y
          // las filas —y sus no leídos en el ícono— se van con el permiso.
          const fallo = falloDeBandeja(error);
          if (fallo.status === 'forbidden') {
            this.conversaciones.set([]);
          }
          this.falloDeLaBandeja.set(fallo);
          // S5, S8 y S9 ocupan el lugar de la lista y ya dicen qué pasó (S9 con
          // su código): un aviso encima lo repetiría. En S7, en cambio, las
          // filas siguen a la vista y nada dice por qué no se actualizaron: eso
          // lo dice el aviso, con el motivo de la API y el código de soporte.
          if (this.bandeja().status === 'stale') {
            this.fallar(error, 'No pudimos cargar sus conversaciones.');
            this.motivoDeBandejaAtrasada.set(this.error());
          }
          this.siPerdioElPermiso(error, propio);
        },
      });
  }

  /**
   * Aplica un mensaje recién llegado sobre su fila de la bandeja, sin esperar
   * la relectura: la vista previa cambia, la hora sube y el no-leído aumenta
   * si el hilo no está abierto. La fila también salta al tope, que es donde la
   * pone el servidor.
   */
  private aplicarEnLaFila(mensaje: DirectMessage): void {
    const propio = this.perfil();
    this.conversaciones.update((lista) => {
      const indice = lista.findIndex((c) => c.id === mensaje.conversationId);
      if (indice === -1) {
        return lista;
      }
      const fila = lista[indice];
      const esMio = mensaje.senderProfileId === propio;
      const abierta = mensaje.conversationId === this.activaId();
      const actualizada: ConversationListItem = {
        ...fila,
        lastMessageAt: mensaje.sentAt ?? fila.lastMessageAt,
        lastMessage: {
          id: mensaje.id,
          senderProfileId: mensaje.senderProfileId,
          bodyText: mensaje.bodyText,
          sentAt: mensaje.sentAt,
        },
        unreadCount:
          esMio || abierta ? fila.unreadCount : fila.unreadCount + 1,
      };
      return [actualizada, ...lista.filter((_, i) => i !== indice)];
    });
  }

  /** Pone en cero el contador de una fila, al abrirla. */
  private apagarNoLeidos(conversationId: string): void {
    this.conversaciones.update((lista) =>
      lista.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }

  /** Marca la conversación como leída sin abrirla (menú de la fila). */
  marcarFilaLeida(conversationId: string): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.apagarNoLeidos(conversationId);
    this.community.markConversationRead(conversationId, propio).subscribe({
      next: () => this.recargarBandeja(),
      error: () => undefined,
    });
  }

  /* --- Hilo --------------------------------------------------------------- */

  /**
   * Abre una conversación. Vaciar lo del hilo anterior es obligatorio: sin eso
   * se ven por un instante los mensajes del chat que se acaba de dejar, con el
   * nombre del nuevo en la cabecera.
   */
  abrir(conversationId: string): void {
    // Abrir un chat es la prueba más clara de que estás mirando: le corre el
    // reloj a la respuesta automática.
    this.autoReply.marcarActividad();
    if (this.activaId() === conversationId) {
      return;
    }
    const anterior = this.activaId();
    if (anterior !== null) {
      this.socket.leaveConversation(anterior);
    }

    this.activaId.set(conversationId);
    this.mensajes.set([]);
    this.cursor.set(null);
    this.peerReadUpTo.set(null);
    this.hiloCargado.set(false);
    this.respondiendoA.set(null);
    this.editando.set(null);
    this.noLeidosAlAbrir.set(
      this.conversaciones().find((c) => c.id === conversationId)?.unreadCount ?? 0,
    );
    this.apagarNoLeidos(conversationId);

    const propio = this.perfil();
    if (propio !== null) {
      this.socket.joinConversation(conversationId, propio);
      this.cargarHilo(true);
    }
  }

  /** Cierra el hilo — se volvió a la bandeja sin ninguno abierto. */
  cerrar(): void {
    const activa = this.activaId();
    if (activa !== null) {
      this.socket.leaveConversation(activa);
    }
    this.activaId.set(null);
    this.mensajes.set([]);
    this.cursor.set(null);
    this.hiloCargado.set(false);
    this.respondiendoA.set(null);
    this.editando.set(null);
    if (this.temporizadorHilo !== null) {
      clearTimeout(this.temporizadorHilo);
      this.temporizadorHilo = null;
    }
  }

  /**
   * Trae una página del hilo.
   *
   * @param primera - Si es la apertura (arranca el sondeo y marca leído) o el
   *   «traeme lo anterior» del scroll.
   */
  private cargarHilo(primera: boolean): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null || this.cargandoHilo()) {
      return;
    }
    this.cargandoHilo.set(true);

    const cursor = primera ? null : this.cursor();
    const generacion = this.generacionDeIdentidad;
    this.community
      .listMessages(conversationId, {
        profileId: propio,
        limit: PAGINA_DE_MENSAJES,
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          // De otra identidad: `actuarComo` ya cerró ese hilo y liberó la
          // carga; no se toca nada.
          if (generacion !== this.generacionDeIdentidad) {
            return;
          }
          // Sólo si sigue siendo el hilo abierto: entre el pedido y la
          // respuesta se pudo haber cambiado de conversación, y volcar acá lo
          // que llegó tarde mostraría los mensajes de un chat en otro.
          if (this.activaId() !== conversationId) {
            this.descartarYPedirElActual();
            return;
          }
          if (primera) {
            this.mensajes.set(pagina.items);
          } else {
            this.mensajes.update((lista) => [...lista, ...pagina.items]);
          }
          this.cursor.set(pagina.nextCursor);
          this.hiloCargado.set(true);
          this.cargandoHilo.set(false);
          this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
          this.error.set('');
          if (primera) {
            this.agendarHilo();
            this.marcarLeido();
          }
        },
        error: (error: unknown) => {
          if (generacion !== this.generacionDeIdentidad) {
            return;
          }
          if (this.activaId() !== conversationId) {
            this.descartarYPedirElActual();
            return;
          }
          this.cargandoHilo.set(false);
          this.hiloCargado.set(true);
          // Un 403 acá puede ser de la conversación y no de la vitrina: se dice
          // eso, y `siPerdioElPermiso` revalida la identidad aparte. Lo demás,
          // con el motivo de la API y el código de soporte.
          if (error instanceof HttpErrorResponse && error.status === 403) {
            this.error.set(ERROR_SIN_PERMISO_EN_LA_CONVERSACION);
          } else {
            this.fallar(error, 'No pudimos cargar la conversación.');
          }
          this.siPerdioElPermiso(error, propio);
        },
      });
  }

  /**
   * Descarta una respuesta que llegó tarde y pide la conversación que **sí**
   * está abierta ahora.
   *
   * ## El defecto que cierra
   *
   * `cargarHilo()` sale temprano si ya hay una carga en vuelo. Cambiando de
   * chat rápido —o volviendo al anterior antes de que conteste el servidor—
   * pasaba esto: el segundo `abrir()` vaciaba los mensajes y llamaba a
   * `cargarHilo()`, que se iba sin pedir nada porque el primero seguía viajando;
   * y cuando el primero llegaba, se descartaba por ser de otra conversación.
   * Resultado: **el hilo quedaba en blanco** —con la cabecera y la bandeja
   * correctas— hasta que el sondeo lo rescatara treinta segundos después.
   *
   * Lo encontró el navegador, no las unitarias: hace falta una respuesta que
   * tarde entre dos clics para que la carrera exista.
   */
  private descartarYPedirElActual(): void {
    this.cargandoHilo.set(false);
    if (this.activaId() !== null && !this.hiloCargado()) {
      this.cargarHilo(true);
    }
  }

  /** Trae la página anterior — lo que se llama al llegar arriba de todo. */
  cargarAnteriores(): void {
    if (this.cursor() !== null && !this.cargandoHilo()) {
      this.cargarHilo(false);
    }
  }

  /** `true` si todavía queda historia hacia atrás. */
  readonly hayAnteriores = computed(() => this.cursor() !== null);

  /**
   * Suma mensajes que no se tenían, sin duplicar, y descarta el eco de los
   * propios que ya estaban en vuelo: el `POST` devuelve el id y el socket
   * empuja el mismo mensaje, y sin esto la burbuja aparecería dos veces.
   */
  private absorber(items: readonly DirectMessage[], delServidor = false): void {
    const conocidos = new Map(this.mensajes().map((m) => [m.id, m]));
    const nuevos = items.filter((m) => !conocidos.has(m.id));
    // Lo que ya estaba también cambia con el tiempo —reacciones, recibos—, y el
    // sondeo es quien se entera si el socket no llegó. Sólo una página **leída
    // del servidor** es autoritativa: un mensaje armado del acuse de envío no
    // trae recibos, y no por eso los tiene que borrar.
    const cambios = new Map<string, DirectMessage>();
    if (delServidor) {
      for (const entrante of items) {
        const previo = conocidos.get(entrante.id);
        if (previo === undefined) {
          continue;
        }
        const reactions = entrante.reactions ?? [];
        const receipts = entrante.receipts ?? previo.receipts;
        if (
          JSON.stringify(reactions) !== JSON.stringify(previo.reactions ?? []) ||
          JSON.stringify(receipts) !== JSON.stringify(previo.receipts)
        ) {
          cambios.set(entrante.id, { ...previo, reactions, receipts });
        }
      }
    }
    if (nuevos.length > 0 || cambios.size > 0) {
      this.mensajes.update((lista) => [
        ...nuevos,
        ...lista.map((m) => cambios.get(m.id) ?? m),
      ]);
    }
  }

  /** Una vez por apertura del hilo, no una por tic de sondeo. */
  private marcarLeido(): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null) {
      return;
    }
    const marca = `${conversationId}:${this.mensajes()[0]?.id ?? ''}`;
    if (this.hiloMarcado.has(marca)) {
      return;
    }
    this.hiloMarcado.add(marca);
    this.apagarNoLeidos(conversationId);
    this.community.markConversationRead(conversationId, propio).subscribe({
      next: () => this.recargarBandeja(),
      // Que el acuse falle no vale un cartel: no cambia lo que se lee.
      error: () => undefined,
    });
  }

  /* --- Envío -------------------------------------------------------------- */

  /** Lo escrito en la conversación abierta. */
  borrador(): string {
    const activa = this.activaId();
    return activa === null ? '' : (this.borradores.get(activa) ?? '');
  }

  guardarBorrador(texto: string): void {
    const activa = this.activaId();
    if (activa !== null) {
      if (texto === '') {
        this.borradores.delete(activa);
      } else {
        this.borradores.set(activa, texto);
      }
    }
  }

  responder(mensaje: MensajeDelHilo | null): void {
    this.respondiendoA.set(mensaje);
    if (mensaje !== null) {
      this.editando.set(null);
    }
  }

  /* --- Editar un mensaje propio (F4.5) ------------------------------------ */

  /**
   * Entra —o sale— del modo edición.
   *
   * Rechaza en silencio el mensaje que ya no se puede editar: entre que se
   * abrió el menú y se eligió «Editar» pudo vencer la ventana, y abrir el
   * composer para que el servidor conteste 422 es peor que no abrirlo.
   */
  editar(mensaje: MensajeDelHilo | null): void {
    if (mensaje === null) {
      this.editando.set(null);
      return;
    }
    if (!editable(mensaje, this.perfil(), Date.now())) {
      return;
    }
    this.respondiendoA.set(null);
    this.editando.set(mensaje);
  }

  /**
   * Guarda el texto nuevo del mensaje que se está editando.
   *
   * Se pinta antes de que el servidor conteste, igual que un envío, y **se
   * revierte** si falla: dejar el texto nuevo en pantalla después de un 422
   * sería mostrar como guardado algo que no se guardó.
   */
  confirmarEdicion(texto: string): void {
    const mensaje = this.editando();
    const propio = this.perfil();
    const conversationId = this.activaId();
    const cuerpo = texto.trim();
    if (
      mensaje === null ||
      mensaje.id === null ||
      propio === null ||
      conversationId === null
    ) {
      return;
    }
    // Sin cambios no se toca nada: un PATCH que deja el texto igual marcaría el
    // mensaje como editado sin que nadie lo haya editado.
    if (cuerpo === '' || cuerpo === (mensaje.bodyText ?? '')) {
      this.editando.set(null);
      return;
    }

    const messageId = mensaje.id;
    const anterior = mensaje.bodyText;
    this.editando.set(null);
    this.aplicarTexto(messageId, cuerpo, true);

    this.community
      .editMessage(conversationId, messageId, {
        senderProfileId: propio,
        bodyText: cuerpo,
      })
      .subscribe({
        next: (editado) => {
          this.aplicarTexto(messageId, editado.bodyText ?? cuerpo, true);
          this.recargarBandeja();
        },
        // El plazo de cinco minutos lo explica la API cuando es eso
        // (`PRECONDITION_FAILED`); un corte de red no es un plazo vencido.
        error: (error: unknown) => {
          this.aplicarTexto(messageId, anterior, mensaje.isEdited ?? false);
          this.fallar(error, 'No pudimos editar el mensaje. Intente de nuevo.');
        },
      });
  }

  /** Cambia el texto de un mensaje ya cargado, y su marca de editado. */
  private aplicarTexto(
    messageId: string,
    bodyText: string | undefined,
    isEdited: boolean,
  ): void {
    this.mensajes.update((lista) =>
      lista.map((m) =>
        m.id === messageId ? { ...m, bodyText, isEdited } : m,
      ),
    );
  }

  /* --- Reaccionar ---------------------------------------------------------- */

  /**
   * Reacciona a un mensaje con un emoji; volver a tocar el mismo lo quita.
   *
   * Un perfil tiene **una** reacción por mensaje —elegir otra reemplaza la
   * anterior—. Se pinta antes de que el servidor conteste y se revierte si
   * falla.
   */
  reaccionar(mensaje: MensajeDelHilo, emoji: string): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null || mensaje.id === null) {
      return;
    }
    const messageId = mensaje.id;
    const anteriores = mensaje.reactions;
    const yaReaccioné = (anteriores ?? []).find((r) => r.profileIds.includes(propio))?.emoji;
    const elegido = yaReaccioné === emoji ? null : emoji;

    this.aplicarReacciones(messageId, reaccionesConMia(anteriores, propio, elegido));
    this.community
      .reactToMessage(conversationId, messageId, { profileId: propio, emoji: elegido })
      .subscribe({
        next: (actualizado) => this.aplicarReacciones(messageId, actualizado.reactions ?? []),
        error: (error: unknown) => {
          this.aplicarReacciones(messageId, anteriores ?? []);
          this.fallar(error, 'No pudimos guardar su reacción.');
        },
      });
  }

  private aplicarReacciones(messageId: string, reactions: readonly MessageReaction[]): void {
    this.mensajes.update((lista) =>
      lista.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
    );
  }

  /**
   * Manda un mensaje y lo pinta antes de que el servidor conteste.
   *
   * El pendiente se saca de la lista recién cuando el mensaje real ya está en
   * `mensajes`: quitarlo antes deja un hueco de un cuadro en el que la burbuja
   * desaparece y vuelve.
   */
  enviar(texto: string): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const cuerpo = texto.trim();
    if (propio === null || conversationId === null || cuerpo === '' || this.hiloBloqueado()) {
      return;
    }
    this.autoReply.marcarActividad();

    const responde = this.respondiendoA();
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      profileId: propio,
      bodyText: cuerpo,
      ...(responde?.id ? { replyToMessageId: responde.id } : {}),
      creadoEn: new Date(),
      estado: 'enviando',
    };

    this.pendientes.update((lista) => [...lista, pendiente]);
    this.guardarBorrador('');
    this.respondiendoA.set(null);
    this.despachar(pendiente);
  }

  /**
   * Reenvía un mensaje —su texto y su adjunto— a otra conversación.
   *
   * Va por el mismo camino que un envío normal: si la conversación destino no
   * es la abierta, la burbuja no se pinta acá pero la fila de la bandeja se
   * actualiza en cuanto el servidor acusa. El adjunto se manda por su
   * `fileId`: es el mismo archivo, no una copia.
   */
  reenviar(mensaje: MensajeDelHilo, conversationId: string): void {
    const propio = this.perfil();
    if (propio === null || mensaje.estado !== 'enviado') {
      return;
    }
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      profileId: propio,
      bodyText: mensaje.bodyText ?? '',
      ...(mensaje.attachmentFileId
        ? { adjunto: { fileId: mensaje.attachmentFileId, nombre: 'Archivo adjunto', tipo: '' } }
        : {}),
      creadoEn: new Date(),
      estado: 'enviando',
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.despachar(pendiente);
  }

  /**
   * Manda un sticker del pack.
   *
   * Viaja como cualquier adjunto —`MEDIA` con su `attachmentFileId`—, así que
   * no hace falta ningún tipo de mensaje nuevo en el modelo. Lo que lo
   * distingue de una foto es que su id está en el pack, que es del producto y
   * el cliente ya tiene: por eso no se sube nada y no se le piden los bytes al
   * servidor.
   */
  enviarSticker(sticker: Sticker): void {
    const conversationId = this.activaId();
    const propio = this.perfil();
    if (propio === null || conversationId === null || this.hiloBloqueado()) {
      return;
    }
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      profileId: propio,
      bodyText: '',
      adjunto: {
        fileId: sticker.id,
        nombre: sticker.nombre,
        tipo: 'image/svg+xml',
        vistaPrevia: sticker.url,
      },
      creadoEn: new Date(),
      estado: 'enviando',
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.despachar(pendiente);
  }

  /** Reintenta uno que falló. */
  reintentar(pendiente: MensajePendiente): void {
    this.pendientes.update((lista) =>
      lista.map((p) =>
        p.claveTemporal === pendiente.claveTemporal
          ? { ...p, estado: 'enviando' as const }
          : p,
      ),
    );
    // La persona ya está actuando sobre el fallo: el aviso anterior sobra.
    this.error.set('');
    // Un adjunto que falló AL SUBIR no tiene `fileId`: despacharlo así mandaba
    // la leyenda sola —o un mensaje vacío— y la foto se perdía. Se vuelve a
    // subir el mismo archivo, que el store guardó para esto, y vuelve a la
    // fila de salida de los adjuntos, al final.
    const archivo = this.archivosSinSubir.get(pendiente.claveTemporal);
    if (pendiente.adjunto !== undefined && !pendiente.adjunto.fileId && archivo) {
      this.filaDeAdjuntos.push({ clave: pendiente.claveTemporal, listo: null });
      this.subidas.add(this.subirYDespachar(pendiente, archivo).subscribe());
      return;
    }
    this.despachar(pendiente);
  }

  /**
   * Corta las subidas en curso y olvida sus archivos. Los pendientes que no
   * llegaron a subir se quitan: sin el `File` no hay qué reintentar, y una
   * burbuja «enviando» que nunca va a salir es peor que ninguna.
   */
  private cancelarSubidas(): void {
    this.subidas.unsubscribe();
    this.subidas = new Subscription();
    // También los que ya subieron y esperaban su turno: eran de la otra
    // identidad y no salen.
    const cortadas = new Set([
      ...this.archivosSinSubir.keys(),
      ...this.filaDeAdjuntos.map((t) => t.clave),
    ]);
    this.archivosSinSubir.clear();
    this.filaDeAdjuntos = [];
    this.adjuntoSaliendo = null;
    if (cortadas.size > 0) {
      this.pendientes.update((lista) => lista.filter((p) => !cortadas.has(p.claveTemporal)));
    }
  }

  /** Descarta uno que falló y no se va a reintentar. */
  descartar(pendiente: MensajePendiente): void {
    this.archivosSinSubir.delete(pendiente.claveTemporal);
    this.pendientes.update((lista) =>
      lista.filter((p) => p.claveTemporal !== pendiente.claveTemporal),
    );
  }

  /**
   * Manda el pendiente **con el perfil y la conversación que tenía al
   * encolarse**, no con los del momento: entre una cosa y otra se pudo haber
   * cambiado de identidad.
   *
   * @param alTerminar - Corre cuando el envío terminó, bien o mal: es lo que
   *   libera el turno del siguiente adjunto (ver {@link despacharAdjuntos}).
   */
  private despachar(pendiente: MensajePendiente, alTerminar?: () => void): void {
    const propio = pendiente.profileId;
    this.enviando.set(true);

    this.community
      .sendMessage(pendiente.conversationId, {
        senderProfileId: propio,
        bodyText: pendiente.bodyText,
        ...(pendiente.replyToMessageId
          ? { replyToMessageId: pendiente.replyToMessageId }
          : {}),
        ...(pendiente.adjunto?.fileId
          ? {
              contentType: pendiente.comoSticker ? ('STICKER' as const) : ('MEDIA' as const),
              attachmentFileId: pendiente.adjunto.fileId,
            }
          : {}),
      })
      .subscribe({
        next: (acuse) => {
          this.enviando.set(false);
          alTerminar?.();
          // El mensaje real entra en la lista y el pendiente sale en el mismo
          // paso, así la burbuja no parpadea. Sólo si se sigue mirando ese
          // hilo con esa identidad.
          if (pendiente.conversationId === this.activaId() && propio === this.perfil()) {
            this.absorber([
              {
                id: acuse.id,
                conversationId: pendiente.conversationId,
                senderProfileId: propio,
                contentTypeConceptId: '',
                bodyText: pendiente.bodyText,
                ...(pendiente.replyToMessageId
                  ? { replyToMessageId: pendiente.replyToMessageId }
                  : {}),
                ...(pendiente.adjunto?.fileId
                  ? { attachmentFileId: pendiente.adjunto.fileId }
                  : {}),
                ...(pendiente.comoSticker ? { contentType: 'STICKER' as const } : {}),
                sentAt: acuse.sentAt ?? pendiente.creadoEn,
              },
            ]);
          }
          this.pendientes.update((lista) =>
            lista.filter((p) => p.claveTemporal !== pendiente.claveTemporal),
          );
          this.recargarBandeja();
          // El acuse no trae recibos: se relee poco después para que el ✓ pase
          // a ✓✓ cuando llegue, sin esperar al sondeo de treinta segundos.
          if (this.isBrowser && pendiente.conversationId === this.activaId()) {
            setTimeout(() => this.refrescarHilo(), ESPERA_DE_RECIBOS_MS);
          }
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          alTerminar?.();
          this.pendientes.update((lista) =>
            lista.map((p) =>
              p.claveTemporal === pendiente.claveTemporal
                ? { ...p, estado: 'fallado' as const }
                : p,
            ),
          );
          // La burbuja dice que no salió; el aviso dice por qué. Salvo un 403
          // escribiendo como la organización: ahí todavía no se sabe si es de
          // la conversación o de la vitrina, y lo que corresponda decir lo dice
          // la revalidación (`avisoDePerfil`); un aviso que culpe al mensaje
          // sería falso, y por cada burbuja en cola se repetiría.
          if (!this.revalidaLaVitrina(error, propio)) {
            this.fallar(error, 'No pudimos enviar el mensaje. Puede reintentarlo desde la conversación.');
          }
          this.siPerdioElPermiso(error, propio);
        },
      });
  }

  /**
   * Sube un archivo y lo manda como adjunto.
   *
   * La burbuja aparece antes de que empiece a subir, con la miniatura local
   * (`data:`) si es una imagen: esperar a que termine la subida para recién
   * mostrar algo es lo que hace que mandar una foto se sienta lento.
   */
  enviarAdjunto(archivo: File | AdjuntoParaEnviar, leyenda: string, comoSticker = false): void {
    this.enviarAdjuntos([archivo], leyenda, comoSticker);
  }

  /**
   * Varios adjuntos de una vez: **un mensaje por archivo**, como en cualquier
   * chat — el contrato lleva un `attachmentFileId` por mensaje y el endpoint de
   * archivos acepta uno por petición (`upload-policy.ts`).
   *
   * La leyenda viaja con el **primero**: es el que se lee primero y el texto
   * dice de qué son las fotos que siguen. Todas las burbujas aparecen en el
   * acto y en orden; las subidas de un mismo lote van **una detrás de otra**,
   * y una que falla no frena a las demás.
   *
   * Los mensajes salen **en el orden en que se eligieron**, también entre
   * lotes distintos (dos `enviarAdjunto` seguidos): cada uno espera su turno
   * en {@link filaDeAdjuntos}, que se libera cuando el anterior terminó de
   * salir, bien o mal. Sin esto, de varias fotos mandadas juntas llegaba
   * primero la que menos pesaba.
   *
   * Cada adjunto puede traer su miniatura ya leída (`vistaPrevia`): el
   * composer la tiene para la tira, y volver a leer el archivo acá era la
   * tercera lectura a `data:` de la misma foto. Sólo se lee si no viene.
   *
   * @param comoSticker - Un sticker propio que sube la persona: viaja marcado
   *   (`contentType: 'STICKER'`).
   */
  enviarAdjuntos(
    adjuntos: readonly (File | AdjuntoParaEnviar)[],
    leyenda: string,
    comoSticker = false,
  ): void {
    const conversationId = this.activaId();
    const propio = this.perfil();
    if (
      conversationId === null ||
      propio === null ||
      adjuntos.length === 0 ||
      this.hiloBloqueado()
    ) {
      return;
    }

    const lote = adjuntos.map((adjunto, indice) => {
      const { archivo, vistaPrevia } =
        adjunto instanceof File ? { archivo: adjunto, vistaPrevia: null } : adjunto;
      const esImagen = archivo.type.startsWith('image/');
      const yaLeida = esImagen && typeof vistaPrevia === 'string' && vistaPrevia.startsWith('data:');
      const pendiente: MensajePendiente = {
        claveTemporal: claveTemporal(),
        conversationId,
        profileId: propio,
        bodyText: indice === 0 ? leyenda.trim() : '',
        creadoEn: new Date(),
        estado: 'enviando',
        ...(comoSticker ? { comoSticker: true } : {}),
        adjunto: {
          nombre: archivo.name,
          tipo: archivo.type,
          ...(yaLeida ? { vistaPrevia } : {}),
        },
      };
      this.archivosSinSubir.set(pendiente.claveTemporal, archivo);
      this.filaDeAdjuntos.push({ clave: pendiente.claveTemporal, listo: null });
      if (esImagen && !yaLeida) {
        this.ponerVistaPrevia(pendiente.claveTemporal, archivo);
      }
      return { pendiente, archivo };
    });
    this.pendientes.update((lista) => [...lista, ...lote.map((l) => l.pendiente)]);

    // Guardada para poder cortarla: cambiar de identidad con fotos en cola no
    // puede terminar mandándolas con la otra.
    this.subidas.add(
      from(lote)
        .pipe(concatMap(({ pendiente, archivo }) => this.subirYDespachar(pendiente, archivo)))
        .subscribe(),
    );
  }

  /**
   * Los archivos de los adjuntos que todavía no subieron, por clave temporal.
   *
   * Existe para el «Reintentar» de una subida fallida: el pendiente sólo guarda
   * nombre, tipo y vista previa, y sin el `File` no hay qué volver a subir.
   */
  private readonly archivosSinSubir = new Map<string, File>();

  /**
   * Los adjuntos en fila para salir, en el orden en que se eligieron. `listo`
   * es el pendiente ya subido (con `fileId`); mientras sea `null`, el turno
   * espera aunque los de atrás ya hayan subido.
   */
  private filaDeAdjuntos: { readonly clave: string; listo: MensajePendiente | null }[] = [];

  /** La clave del adjunto que está saliendo ahora; `null` si ninguno. */
  private adjuntoSaliendo: string | null = null;

  /** Un adjunto ya subido: espera su turno y, si le toca, sale. */
  private adjuntoSubido(conFileId: MensajePendiente): void {
    const turno = this.filaDeAdjuntos.find((t) => t.clave === conFileId.claveTemporal);
    if (turno === undefined) {
      // Sin turno (no debería pasar): sale ya antes que quedar colgado.
      this.despachar(conFileId);
      return;
    }
    turno.listo = conFileId;
    this.despacharAdjuntos();
  }

  /**
   * El que falló al subir cede su turno: el siguiente no puede quedar
   * esperando a un mensaje que no va a salir. Si se reintenta, vuelve a la
   * fila al final.
   */
  private cederTurno(clave: string): void {
    this.filaDeAdjuntos = this.filaDeAdjuntos.filter((t) => t.clave !== clave);
    this.despacharAdjuntos();
  }

  /** Manda el primero de la fila si ya subió y no hay otro saliendo. */
  private despacharAdjuntos(): void {
    const primero = this.filaDeAdjuntos[0];
    if (this.adjuntoSaliendo !== null || primero?.listo == null) {
      return;
    }
    this.filaDeAdjuntos.shift();
    const clave = primero.clave;
    this.adjuntoSaliendo = clave;
    this.despachar(primero.listo, () => {
      // Un cambio de identidad en el medio ya vació la fila y soltó el turno.
      if (this.adjuntoSaliendo === clave) {
        this.adjuntoSaliendo = null;
        this.despacharAdjuntos();
      }
    });
  }

  /**
   * La miniatura local del pendiente, como `data:` y no `blob:`.
   *
   * La CSP declara `img-src 'self' data:` (`src/server/security-headers.ts`):
   * un `blob:` se bloqueaba en silencio y la burbuja «enviando» salía sin la
   * foto. Ampliar la CSP es una decisión de arquitectura que no se toma acá.
   * Se lee aparte porque `FileReader` es asíncrono; la burbuja aparece igual
   * en el acto y la foto se suma un instante después.
   */
  private ponerVistaPrevia(clave: string, archivo: File): void {
    if (!this.isBrowser || typeof FileReader === 'undefined') {
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const vistaPrevia = lector.result;
      if (typeof vistaPrevia !== 'string') {
        return;
      }
      const conVista = (p: MensajePendiente): MensajePendiente =>
        p.claveTemporal === clave && p.adjunto
          ? { ...p, adjunto: { ...p.adjunto, vistaPrevia } }
          : p;
      this.pendientes.update((lista) => lista.map(conVista));
    };
    lector.readAsDataURL(archivo);
  }

  /** Sube uno y, si sube, lo pone en la fila de salida. Nunca falla: el error queda en el pendiente. */
  private subirYDespachar(pendiente: MensajePendiente, archivo: File): Observable<void> {
    const esImagen = archivo.type.startsWith('image/');
    // `PHI` y no `NORMAL`: lo que se adjunta en un chat entre paciente y
    // profesional es, con toda probabilidad, la foto de un análisis o de una
    // receta. La sensibilidad cambia cómo se guarda y quién puede descargarlo,
    // así que el defecto tiene que ser el que protege, no el que conviene.
    return this.archivos.upload(archivo, esImagen ? 'IMAGE' : 'DOCUMENT', 'PHI').pipe(
      map((subido) => {
        this.archivosSinSubir.delete(pendiente.claveTemporal);
        // Se parte del pendiente **actual** de la lista y no del capturado al
        // empezar: en el medio pudo llegar la miniatura, y volver a la copia
        // vieja la borraría.
        const actual =
          this.pendientes().find((p) => p.claveTemporal === pendiente.claveTemporal) ?? pendiente;
        const conFileId: MensajePendiente = {
          ...actual,
          estado: 'enviando',
          adjunto: { ...actual.adjunto!, fileId: subido.id },
        };
        this.pendientes.update((lista) =>
          lista.map((p) =>
            p.claveTemporal === pendiente.claveTemporal ? conFileId : p,
          ),
        );
        this.adjuntoSubido(conFileId);
      }),
      catchError(() => {
        this.pendientes.update((lista) =>
          lista.map((p) =>
            p.claveTemporal === pendiente.claveTemporal
              ? { ...p, estado: 'fallado' as const }
              : p,
          ),
        );
        // Sólo en la burbuja, que ya ofrece reintentar y descartar. Un aviso
        // global encima de todo empujaba la pantalla por un fallo de un mensaje.
        this.cederTurno(pendiente.claveTemporal);
        return EMPTY;
      }),
    );
  }

  /* --- Adjuntos ----------------------------------------------------------- */

  /**
   * El adjunto como `data:` URL, si ya se leyó; `null` si todavía no o falló.
   *
   * Un sticker se resuelve en el acto y sin red: es un archivo del producto,
   * servido con la aplicación, no algo que subió alguien.
   */
  urlDe(fileId: string): string | null {
    const key = this.attachmentKey(fileId);
    return stickerDe(fileId)?.url ?? this.urlesDeArchivo().get(key) ?? null;
  }

  /** `true` si el archivo se pidió y no se pudo leer. */
  adjuntoNoDisponible(fileId: string): boolean {
    return this.urlesDeArchivo().get(this.attachmentKey(fileId)) === null;
  }

  /**
   * Lee los adjuntos que se van a pintar y todavía no están. Una vez por
   * archivo, por sesión de la pantalla.
   *
   * Se usa la ruta contextual de community, con conversación y perfil propio.
   * La ruta genérica de archivos sólo autoriza dueño/revisor y no puede probar
   * que un receptor participa del hilo; usarla acá volvería el UUID la única
   * relación entre la burbuja y sus bytes.
   */
  private resolverAdjuntos(mensajes: readonly MensajeDelHilo[]): void {
    if (!this.isBrowser) {
      return;
    }
    const conversationId = this.activaId();
    const profileId = this.perfil();
    if (conversationId === null || profileId === null) return;
    const yaResueltos = this.urlesDeArchivo();
    for (const mensaje of mensajes) {
      // Uno en vuelo ya tiene su vista local y su archivo todavía no viaja en
      // ningún mensaje: pedirlo daría 404 y ese «no disponible» quedaría
      // anotado para cuando el mensaje sí exista.
      if (mensaje.pendiente !== undefined) {
        continue;
      }
      const fileId = mensaje.attachmentFileId;
      const key = fileId ? `${conversationId}:${fileId}` : '';
      // Un sticker no se pide: su URL sale del pack, que viene con la
      // aplicación. Pedirlo sería un 404 por cada sticker de la conversación.
      if (
        fileId === undefined ||
        yaResueltos.has(key) ||
        stickerDe(fileId) !== undefined
      ) {
        continue;
      }
      // Se reserva el lugar antes de pedir, para no pedir dos veces el mismo
      // archivo mientras la primera petición está en vuelo.
      this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, ''));
      this.community
        .conversationAttachmentDataUrl(conversationId, profileId, fileId)
        .subscribe({
          next: (url) =>
            this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, url)),
          error: () =>
            this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, null)),
        });
    }
  }

  /** La caché en memoria no cruza conversaciones. */
  private attachmentKey(fileId: string): string {
    return `${this.activaId() ?? 'sin-conversacion'}:${fileId}`;
  }

  /* --- Respuesta automática por inactividad -------------------------------- */

  /**
   * Contesta sola, si corresponde, al mensaje que acaba de llegar.
   *
   * La regla entera —«hace N minutos que no aparezco, y a esta persona no le
   * avisé en las últimas M horas, y estamos fuera de mi horario»— la decide
   * `ChatAutoReply`; acá sólo se descarta lo que no es un mensaje ajeno y se
   * manda el texto.
   *
   * **Sólo funciona con la aplicación abierta.** Una respuesta automática de
   * verdad la manda el servidor aunque el navegador esté cerrado; eso exige la
   * tabla que el modelo todavía no declara. Está dicho en `ChatAutoReply` y en
   * la pantalla que la configura, para que nadie la confunda con un contestador
   * del servidor.
   */
  private quizasResponderSolo(mensaje: DirectMessage): void {
    // La configuración de `ChatAutoReply` es **de la persona** («estoy de
    // vacaciones»): mandarla escribiendo como la farmacia la firmaría en
    // nombre de la farmacia. La de la vitrina se configura aparte en la API
    // (`/community/profiles/:profileId/auto-reply`) y la manda el servidor.
    if (this.actuandoComoOrganizacion()) {
      return;
    }
    const propio = this.perfil();
    if (propio === null || mensaje.senderProfileId === propio) {
      return;
    }
    const ahora = Date.now();
    const ultimo = this.ultimoAvisoPorConversacion.get(mensaje.conversationId) ?? null;
    if (!this.autoReply.corresponde(ahora, ultimo)) {
      return;
    }

    this.ultimoAvisoPorConversacion.set(mensaje.conversationId, ahora);
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId: mensaje.conversationId,
      profileId: propio,
      bodyText: this.autoReply.configuracion().texto,
      creadoEn: new Date(),
      estado: 'enviando',
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.despachar(pendiente);
  }

  /* --- Descargar la conversación ------------------------------------------ */

  /** `true` mientras se junta la conversación para bajarla. */
  readonly exportando = signal(false);

  /**
   * Junta la conversación entera y la entrega como JSON.
   *
   * ## Por qué recorre todas las páginas
   *
   * Porque bajar «la conversación» y entregar los últimos treinta mensajes
   * sería mentir en el nombre del archivo. Se pide página por página con el
   * mismo cursor del hilo, hasta que el servidor deja de dar más.
   *
   * ## Qué lleva y qué no
   *
   * Lleva el texto, quién lo escribió, cuándo, si fue editado, a qué mensaje
   * respondía y **la referencia** de cada adjunto. No lleva los bytes de los
   * adjuntos: un chat con tres radiografías daría un archivo de decenas de
   * megas que nadie puede abrir en un editor de texto, y las referencias
   * alcanzan para volver a pedirlos.
   *
   * @param alTerminar - Recibe el JSON ya armado, o `null` si algo falló.
   */
  exportarConversacion(alTerminar: (json: string | null) => void): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const conversacion = this.conversacionActiva();
    if (propio === null || conversationId === null || this.exportando()) {
      alTerminar(null);
      return;
    }

    this.exportando.set(true);
    const juntados: DirectMessage[] = [];

    const pedir = (cursor: string | null): void => {
      this.community
        .listMessages(conversationId, {
          profileId: propio,
          limit: PAGINA_DE_MENSAJES,
          ...(cursor === null ? {} : { cursor }),
        })
        .subscribe({
          next: (pagina) => {
            juntados.push(...pagina.items);
            if (pagina.nextCursor !== null) {
              pedir(pagina.nextCursor);
              return;
            }
            this.exportando.set(false);
            alTerminar(
              JSON.stringify(
                armarExportacion(conversationId, propio, conversacion, juntados),
                null,
                2,
              ),
            );
          },
          error: (error: unknown) => {
            this.exportando.set(false);
            this.fallar(error, 'No pudimos descargar la conversación.');
            alTerminar(null);
          },
        });
    };

    pedir(null);
  }

  /* --- Escribirle a alguien nuevo ----------------------------------------- */

  /** Las generaciones de ahora, para que un paso de la apertura sepa si sigue valiendo. */
  private marcaDeApertura(): MarcaDeApertura {
    return { identidad: this.generacionDeIdentidad, usuario: this.generacionDeUsuario };
  }

  /** `false` si desde `marca` se cambió de identidad o de cuenta: se descarta. */
  private aperturaVigente(marca: MarcaDeApertura): boolean {
    return (
      marca.identidad === this.generacionDeIdentidad && marca.usuario === this.generacionDeUsuario
    );
  }

  /**
   * Suscribe un paso de la apertura: queda en {@link apertura} para poder
   * cortarlo, y su `next` y su `error` no corren si la identidad cambió.
   */
  private pasoDeApertura<T>(
    peticion: Observable<T>,
    next: (valor: T) => void,
    error: (fallo: unknown) => void,
  ): void {
    const marca = this.marcaDeApertura();
    let emitio = false;
    this.apertura.add(
      peticion.subscribe({
        next: (valor) => {
          emitio = true;
          if (this.aperturaVigente(marca)) {
            next(valor);
          }
        },
        error: (fallo: unknown) => {
          if (this.aperturaVigente(marca)) {
            error(fallo);
          }
        },
        // Una petición que termina sin traer nada no puede dejar `abriendo`
        // encendido: bloquearía toda apertura de chat de la app.
        complete: () => {
          if (!emitio && this.aperturaVigente(marca)) {
            error(new Error('La apertura terminó sin respuesta.'));
          }
        },
      }),
    );
  }

  /** Corta la apertura en curso, si hay, y libera `abriendo`. */
  private cancelarApertura(): void {
    this.apertura.unsubscribe();
    this.apertura = new Subscription();
    this.abriendo.set(false);
  }

  /**
   * Busca gente a la que todavía no se le escribió.
   *
   * No mientras se escribe como la organización: la API no deja buscar
   * contactos ni iniciar chats con la vitrina (403), que sólo responde. En ese
   * modo el buscador de la bandeja filtra los chats que ya hay y nada más.
   */
  buscarGente(consulta: string): void {
    const q = consulta.trim();
    const propio = this.perfil();
    const version = ++this.versionBusqueda;
    if (q.length < 2 || propio === null || this.actuandoComoOrganizacion()) {
      this.resultados.set([]);
      this.buscandoAhora.set(false);
      return;
    }
    this.buscandoAhora.set(true);
    this.community.searchChatContacts(propio, q, 10).subscribe({
      next: (items) => {
        if (version !== this.versionBusqueda) return;
        this.resultados.set(items);
        this.buscandoAhora.set(false);
      },
      error: (error: unknown) => {
        if (version !== this.versionBusqueda) return;
        this.buscandoAhora.set(false);
        this.fallar(error, 'No pudimos buscar personas.');
      },
    });
  }

  limpiarBusqueda(): void {
    this.versionBusqueda += 1;
    this.resultados.set([]);
    this.buscandoAhora.set(false);
  }

  /**
   * Abre —o reutiliza— una conversación con el perfil elegido en el chat.
   *
   * Como {@link escribirA}: un chat nuevo no se inicia como la organización
   * (la API no lo deja), así que se vuelve antes al perfil propio y se avisa.
   */
  escribirAPerfil(profileId: string, alAbrir: (conversationId: string) => void): void {
    if (this.abriendo()) return;
    if (this.actuandoComoOrganizacion()) {
      if (this.perfilPropio() === null) {
        this.error.set(ERROR_CHAT_NUEVO_COMO_ORGANIZACION);
        return;
      }
      this.actuarComo(null);
      this.avisoDePerfil.set(AVISO_CHAT_NUEVO_CON_PERFIL_PROPIO);
    }
    const propio = this.perfil();
    if (propio === null || profileId === propio) return;

    this.abriendo.set(true);
    this.pasoDeApertura(
      this.community.createConversation({ participantProfileIds: [propio, profileId] }),
      ({ id }) => this.entrarAlHilo(propio, id, alAbrir, undefined),
      () => {
        this.abriendo.set(false);
        this.error.set('No pudimos abrir la conversación.');
      },
    );
  }

  /**
   * Abre —o crea— el hilo con quien tenga ese slug, y devuelve su id por el
   * callback.
   *
   * Son dos llamadas y no una porque la superficie pública devuelve `slug` y no
   * `profileId`: no publica identificadores internos. La segunda es idempotente
   * desde este carril: si el hilo ya existe, el backend devuelve ése.
   *
   * Espera al perfil propio en vez de rendirse si todavía no está: quien llega
   * desde un botón del marketplace entra a `/messaging` en frío, y el
   * `?escribirA=` se lee antes de que `/community/profiles/me` conteste. Antes
   * ese caso volvía sin hacer nada y el botón parecía muerto.
   *
   * Con `contexto`, antes de abrir el hilo manda **una** tarjeta de contexto
   * (ver `contexto-de-chat.ts`) — salvo que la última tarjeta del hilo ya sea
   * la misma (tipo, título y ruta): volver a tocar «Chatear» desde el mismo
   * pedido no tiene que repetirla.
   */
  escribirA(
    slug: string,
    alAbrir: (conversationId: string) => void,
    contexto?: ContextoDeChat,
  ): void {
    // `abriendo` se mira y se enciende ya con el perfil resuelto: si se
    // encendiera antes y `/community/profiles/me` fallara, quedaría prendido
    // para siempre. Dos pedidos encolados a la vez abren uno solo igual.
    this.conPerfil(() => {
      if (this.abriendo()) {
        return;
      }
      // Como la organización sólo se responde: la API no deja iniciar chats
      // con la vitrina. Quien llega acá —un contacto del buscador, «Chatear»
      // desde el marketplace— quiere escribir él, así que se vuelve antes al
      // perfil propio y se avisa; sin perfil propio, se explica por qué no.
      if (this.actuandoComoOrganizacion()) {
        if (this.perfilPropio() === null) {
          this.error.set(ERROR_CHAT_NUEVO_COMO_ORGANIZACION);
          return;
        }
        this.actuarComo(null);
        this.avisoDePerfil.set(AVISO_CHAT_NUEVO_CON_PERFIL_PROPIO);
      }
      const propio = this.perfil();
      // Sin perfil público no hay con qué abrir el hilo: la pantalla ya ofrece
      // crearlo, y eso no es un error. Lo que se quería abrir se guarda y se
      // retoma cuando `crearPerfil()` termine bien.
      if (propio === null) {
        this.intencionPendiente = () => this.escribirA(slug, alAbrir, contexto);
        return;
      }
      this.abriendo.set(true);
      this.abrirConFicha(propio, slug, alAbrir, contexto);
    });
  }

  private abrirConFicha(
    propio: string,
    slug: string,
    alAbrir: (conversationId: string) => void,
    contexto: ContextoDeChat | undefined,
  ): void {
    this.pasoDeApertura(
      this.community.readProfileBySlug(slug),
      (ficha) => {
        // Uno no se escribe a sí mismo. Sin esto, «Enviar mensaje» en la propia
        // ficha pública pedía una conversación con un solo participante
        // repetido y el backend devolvía **otra** conversación cualquiera.
        if (ficha.id === propio) {
          this.abriendo.set(false);
          this.error.set('Ese es su propio perfil: no puede escribirle.');
          return;
        }

        this.pasoDeApertura(
          this.community.createConversation({ participantProfileIds: [propio, ficha.id] }),
          ({ id }) => this.entrarAlHilo(propio, id, alAbrir, contexto),
          (error: unknown) => {
            this.abriendo.set(false);
            this.fallar(error, 'No pudimos abrir la conversación.');
          },
        );
      },
      (error: unknown) => {
        this.abriendo.set(false);
        this.fallar(error, 'No pudimos encontrar a esa persona.');
      },
    );
  }

  /**
   * Abre un hilo que **otro** resuelve —hoy, el chat de un pedido:
   * `POST /pharmacy/orders/:id/conversation`— con la misma tarjeta y la misma
   * regla de no repetirla que {@link escribirA}.
   *
   * El store no sabe de pedidos: recibe la petición que devuelve el id de la
   * conversación. Quién puede abrirla lo decide esa petición en la API.
   */
  abrirConversacion(
    resolver: Observable<string>,
    alAbrir: (conversationId: string) => void,
    contexto?: ContextoDeChat,
  ): void {
    this.conPerfil(() => {
      if (this.abriendo()) {
        return;
      }
      const propio = this.perfil();
      if (propio === null) {
        // Igual que `escribirA`: se retoma al crear el perfil.
        this.intencionPendiente = () => this.abrirConversacion(resolver, alAbrir, contexto);
        return;
      }
      this.abriendo.set(true);
      this.pasoDeApertura(
        resolver,
        (id) => this.entrarAlHilo(propio, id, alAbrir, contexto),
        (error: unknown) => {
          this.abriendo.set(false);
          this.fallar(error, 'No pudimos abrir la conversación.');
        },
      );
    });
  }

  /**
   * El chat de un pedido **del lado de la farmacia**: lo abre la API con el
   * `POST` del pedido, que devuelve también la vitrina con la que se habla;
   * desde ahí se escribe como esa vitrina, con la tarjeta del pedido y la
   * misma regla de no repetirla.
   *
   * No espera al perfil propio: el personal de una farmacia puede no tener
   * vitrina personal, y no la necesita para atender como la farmacia.
   *
   * @param alFallar - Recibe el error del `POST` (los 422 traen su `reason`),
   *   para que lo diga la pantalla que tiene el botón.
   */
  abrirComoOrganizacion(
    resolver: Observable<{ readonly conversationId: string; readonly profileId: string }>,
    nombre: string,
    alAbrir: (conversationId: string) => void,
    contexto?: ContextoDeChat,
    alFallar?: (error: unknown) => void,
  ): void {
    if (this.abriendo()) {
      // Sin esto volvía en silencio y el botón que lo pidió quedaba girando.
      alFallar?.(new ChatOcupadoError());
      return;
    }
    this.abriendo.set(true);
    this.pasoDeApertura(
      resolver,
      ({ conversationId, profileId }) => {
        this.ofrecerVitrina({ profileId, nombre });
        // `actuarComo` corta la apertura en curso —que es ésta— y libera
        // `abriendo`; lo que sigue ya es de la identidad nueva y se vuelve a
        // marcar ocupado hasta entrar al hilo.
        this.actuarComo(profileId);
        this.abriendo.set(true);
        this.entrarAlHilo(profileId, conversationId, alAbrir, contexto);
      },
      (error: unknown) => {
        this.abriendo.set(false);
        alFallar?.(error);
      },
    );
  }

  /** Lo común a los dos caminos: la tarjeta, si hay, y después el hilo. */
  private entrarAlHilo(
    propio: string,
    id: string,
    alAbrir: (conversationId: string) => void,
    contexto: ContextoDeChat | undefined,
  ): void {
    const terminar = (): void => {
      this.abriendo.set(false);
      this.recargarBandeja();
      alAbrir(id);
    };
    // Validado **antes** de pedir nada: `textoDeContexto` lanza con un
    // contexto inválido, y lanzar dentro del `next` de una suscripción dejaba
    // `abriendo` prendido para siempre. Inválido es «sin tarjeta».
    const valido = contexto === undefined ? null : normalizarContexto(contexto);
    if (valido === null) {
      terminar();
    } else {
      this.ponerContexto(propio, id, valido, terminar);
    }
  }

  /**
   * Manda la tarjeta de contexto si la última del hilo no es ya la misma.
   *
   * Se mira la primera página —la más reciente— y no el hilo entero: si la
   * última tarjeta sobre ese pedido quedó treinta mensajes atrás, repetirla
   * arriba es justamente lo útil. Si leer falla no se manda nada: una tarjeta
   * duplicada es peor que una que falta, y el hilo se abre igual.
   */
  private ponerContexto(
    propio: string,
    conversationId: string,
    contexto: ContextoDeChat,
    despues: () => void,
  ): void {
    const fallar = (): void => {
      this.error.set('Abrimos el chat, pero no pudimos agregar de qué se trata.');
      despues();
    };
    this.pasoDeApertura(
      this.community.listMessages(conversationId, {
        profileId: propio,
        limit: PAGINA_DE_MENSAJES,
      }),
      (pagina) => {
        if (mismaTarjeta(ultimaTarjeta(pagina.items), contexto)) {
          despues();
          return;
        }
        const bodyText = textoDeContexto(contexto);
        this.pasoDeApertura(
          this.community.sendMessage(conversationId, { senderProfileId: propio, bodyText }),
          () => despues(),
          // Falló el envío de la tarjeta: queda como un mensaje fallado del
          // hilo, con reintentar y descartar, igual que cualquier otro. No va
          // a `error`.
          () => {
            const fallada: MensajePendiente = {
              claveTemporal: claveTemporal(),
              conversationId,
              profileId: propio,
              bodyText,
              creadoEn: new Date(),
              estado: 'fallado',
            };
            this.pendientes.update((lista) => [...lista, fallada]);
            despues();
          },
        );
      },
      fallar,
    );
  }

  /* --- Sondeo ------------------------------------------------------------- */

  private agendarBandeja(): void {
    if (!this.isBrowser || this.temporizadorBandeja !== null) {
      return;
    }
    this.temporizadorBandeja = setTimeout(() => {
      this.temporizadorBandeja = null;
      if (this.encendido) {
        this.recargarBandeja();
        this.agendarBandeja();
      }
    }, SONDEO_BANDEJA_MS);
  }

  /**
   * Relee **la primera página** del hilo abierto.
   *
   * Releer sólo la primera y no todo lo paginado es deliberado: lo nuevo llega
   * arriba, y volver a pedir las cinco páginas que alguien fue abriendo hacia
   * atrás sería releer una conversación entera cada 30 segundos.
   */
  private agendarHilo(): void {
    if (!this.isBrowser || this.temporizadorHilo !== null) {
      return;
    }
    this.temporizadorHilo = setTimeout(() => {
      this.temporizadorHilo = null;
      if (!this.encendido || this.perfil() === null || this.activaId() === null) {
        return;
      }
      this.refrescarHilo();
      this.agendarHilo();
    }, SONDEO_HILO_MS);
  }

  /**
   * Relee la primera página del hilo abierto y aplica lo que cambió: mensajes
   * nuevos, reacciones, recibos y hasta dónde leyó el otro lado.
   */
  private refrescarHilo(): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null) {
      return;
    }
    const generacion = this.generacionDeIdentidad;
    this.community
      .listMessages(conversationId, {
        profileId: propio,
        limit: PAGINA_DE_MENSAJES,
      })
      .subscribe({
        next: (pagina) => {
          // De otra identidad: ese hilo ya se cerró con `actuarComo`.
          if (generacion === this.generacionDeIdentidad && this.activaId() === conversationId) {
            this.absorber(pagina.items, true);
            this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
          }
        },
        error: () => undefined,
      });
  }

  /**
   * El único punto por donde un fallo de la API llega a `error`: el motivo de
   * la API si lo explica, si no el texto de quien llama, y el código de
   * soporte siempre que lo haya.
   */
  private fallar(error: unknown, queNoSePudo: string): void {
    this.error.set(describeApiFailure(error, queNoSePudo));
  }

  private pararTemporizadores(): void {
    if (this.temporizadorBandeja !== null) {
      clearTimeout(this.temporizadorBandeja);
      this.temporizadorBandeja = null;
    }
    if (this.temporizadorHilo !== null) {
      clearTimeout(this.temporizadorHilo);
      this.temporizadorHilo = null;
    }
  }
}

/**
 * La conversación lista para escribirse en un archivo.
 *
 * Es el formato del archivo que baja la persona, así que se declara acá y no se
 * arma al vuelo: alguien lo va a abrir, y los nombres de sus claves son parte
 * de lo que entregamos.
 */
export interface ConversacionExportada {
  /** Qué es este archivo, para quien lo abra sin contexto. */
  readonly formato: 'alovida.conversacion';
  readonly version: 1;
  readonly exportadoEn: string;
  readonly conversacion: {
    readonly id: string;
    readonly esGrupo: boolean;
    readonly participantes: readonly {
      readonly profileId: string;
      readonly nombre: string;
      readonly soyYo: boolean;
    }[];
  };
  readonly mensajes: readonly {
    readonly id: string;
    readonly autorProfileId: string;
    readonly autor: string;
    readonly propio: boolean;
    readonly texto: string | null;
    readonly enviadoEn: string | null;
    readonly editado: boolean;
    readonly respondeA: string | null;
    readonly adjunto: { readonly fileId: string; readonly sticker: string | null } | null;
  }[];
}

function armarExportacion(
  conversationId: string,
  propio: string,
  conversacion: ConversationListItem | undefined,
  mensajes: readonly DirectMessage[],
): ConversacionExportada {
  const nombrePorPerfil = new Map<string, string>(
    (conversacion?.peers ?? []).map((peer) => [
      peer.profileId,
      peer.displayName ?? 'Alguien',
    ]),
  );

  return {
    formato: 'alovida.conversacion',
    version: 1,
    exportadoEn: new Date().toISOString(),
    conversacion: {
      id: conversationId,
      esGrupo: (conversacion?.peers.length ?? 0) > 1,
      participantes: [
        { profileId: propio, nombre: 'Yo', soyYo: true },
        ...(conversacion?.peers ?? []).map((peer) => ({
          profileId: peer.profileId,
          nombre: peer.displayName ?? 'Alguien',
          soyYo: false,
        })),
      ],
    },
    // Del más viejo al más nuevo: se lee como la conversación, no como la
    // devuelve el contrato —que pagina hacia atrás—.
    mensajes: [...mensajes]
      .sort((a, b) => (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0))
      .map((mensaje) => ({
        id: mensaje.id,
        autorProfileId: mensaje.senderProfileId,
        autor:
          mensaje.senderProfileId === propio
            ? 'Yo'
            : (nombrePorPerfil.get(mensaje.senderProfileId) ?? 'Alguien'),
        propio: mensaje.senderProfileId === propio,
        texto: mensaje.bodyText ?? null,
        enviadoEn: mensaje.sentAt?.toISOString() ?? null,
        editado: mensaje.isEdited === true,
        respondeA: mensaje.replyToMessageId ?? null,
        adjunto:
          mensaje.attachmentFileId === undefined
            ? null
            : {
                fileId: mensaje.attachmentFileId,
                sticker: stickerDe(mensaje.attachmentFileId)?.nombre ?? null,
              },
      })),
  };
}

/** Identidad de un mensaje mientras no tenga la del servidor. */
function claveTemporal(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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
 * La tarjeta de contexto más reciente de una página de mensajes, o `null`.
 *
 * Por `sentAt` y no por la posición: el orden de la página es del servidor, y
 * esta decisión —mandar o no la tarjeta— no puede depender de él.
 */
function ultimaTarjeta(mensajes: readonly DirectMessage[]): ContextoDeChat | null {
  let ultima: { readonly cuando: number; readonly contexto: ContextoDeChat } | null = null;
  for (const mensaje of mensajes) {
    const contexto = contextoDelTexto(mensaje.bodyText);
    if (contexto === null) {
      continue;
    }
    const cuando = mensaje.sentAt?.getTime() ?? 0;
    if (ultima === null || cuando > ultima.cuando) {
      ultima = { cuando, contexto };
    }
  }
  return ultima?.contexto ?? null;
}

/**
 * `true` si dos tarjetas hablan de lo mismo: tipo, título y ruta.
 *
 * La ruta sola no alcanza: un producto apunta a la ficha de su farmacia, así
 * que «Producto: Enalapril» y «Farmacia: Farmacia Vida» comparten ruta y son
 * dos consultas distintas. El detalle no cuenta: que cambie el precio no hace
 * de la misma consulta otra.
 */
function mismaTarjeta(a: ContextoDeChat | null, b: ContextoDeChat): boolean {
  // Los dos lados normalizados igual: la del hilo ya pasó por `linea()` al
  // escribirse, y comparar contra el título crudo («Farmacia  Vida», uno de
  // 200 caracteres) la mandaba otra vez cada vez.
  const x = a === null ? null : normalizarContexto(a);
  const y = normalizarContexto(b);
  return x !== null && y !== null && x.tipo === y.tipo && x.titulo === y.titulo && x.ruta === y.ruta;
}

/** Lo que dice la lista de bloqueados mientras no se sabe el nombre. */
export const SIN_NOMBRE = 'Perfil bloqueado';

/** Alguien que la persona bloqueó, con lo que la pantalla necesita. */
export interface PerfilBloqueado {
  readonly profileId: string;
  readonly displayName: string;
  readonly desde: Date;
}

/**
 * Las reacciones de un mensaje después de que `propio` elija `emoji`.
 *
 * `null` quita la suya. Una persona aparece en un solo emoji, y un emoji sin
 * nadie desaparece del listado.
 */
export function reaccionesConMia(
  actuales: readonly MessageReaction[] | undefined,
  propio: string,
  emoji: string | null,
): readonly MessageReaction[] {
  const sinMia = (actuales ?? [])
    .map((r) => ({ emoji: r.emoji, profileIds: r.profileIds.filter((p) => p !== propio) }))
    .filter((r) => r.profileIds.length > 0);
  if (emoji === null) {
    return sinMia;
  }
  return sinMia.some((r) => r.emoji === emoji)
    ? sinMia.map((r) => (r.emoji === emoji ? { ...r, profileIds: [...r.profileIds, propio] } : r))
    : [...sinMia, { emoji, profileIds: [propio] }];
}
