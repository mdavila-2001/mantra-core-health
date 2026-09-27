import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from '../auth/auth.service';
import { CommunityClient } from '../data-access/community/community.client';
import { NotificationsClient } from '../data-access/notifications/notifications.client';
import type {
  InAppNotification,
  NotificationCategory,
} from '../data-access/notifications/notifications.types';
import { rutaDeNotificacion } from './notification-routes';

/** Cada cuánto se vuelve a preguntar, en milisegundos. */
export const INTERVALO_MS = 45_000;

/** Cuántas trae el panel de la campana. El centro pide su propia página. */
const TOPE_PANEL = 8;

/**
 * Un aviso ya normalizado, venga del módulo 35 o de `community`.
 *
 * Es el tipo que ven las pantallas: la campana no tiene por qué saber de qué
 * backend salió cada línea.
 */
export interface AvisoUnificado {
  /** Identificador dentro de su fuente. */
  readonly id: string;
  /** De qué bandeja salió, que es lo que decide cómo se marca leída. */
  readonly fuente: 'messaging' | 'community';
  /** Familia del aviso; las sociales llegan siempre como `SOCIAL`. */
  readonly categoria: NotificationCategory;
  /** Título corto. */
  readonly titulo: string;
  /** Cuerpo de una o dos líneas, si lo hay. */
  readonly detalle?: string;
  /** Ruta a la que navega, o `null` si no navega a ninguna. */
  readonly ruta: string | null;
  /** `true` mientras siga sin leer. */
  readonly sinLeer: boolean;
  /** Cuándo llegó. */
  readonly fecha: Date;
}

/**
 * La fuente única de la campana — carril P1.
 *
 * ## Dos bandejas, una campana
 *
 * El producto tiene dos: `messaging.in_app_notifications` (receta, consulta,
 * mensaje, turno) y `community.social_notifications` (te siguieron, comentaron).
 * Las dos existen en `dev` y las dos funcionan. **La fusión se hace acá, en el
 * cliente**, y no unificando los backends: unificarlos habría sido reescribir
 * dos módulos que andan para ahorrarle una llamada a una campanita, y el
 * carril tiene una deuda funcional que cerrar antes que una arquitectura que
 * embellecer. El total sin leer es la suma de los dos `unreadCount`, que es lo
 * que cada backend ya calcula.
 *
 * Si una de las dos lecturas falla, la campana muestra la otra. Un error de lo
 * social no puede tapar «tu receta está lista».
 *
 * ## Sondeo, no WebSockets (decisión D2)
 *
 * `setTimeout` encadenado y no `setInterval`: con `setInterval`, una respuesta
 * lenta encola tics y el navegador termina disparando varias llamadas juntas
 * apenas la red se recupera. Encadenando, el próximo tic se agenda cuando el
 * anterior terminó, y nunca hay dos vivos.
 *
 * ## Bajo SSR no sondea
 *
 * El servidor renderiza la campana vacía y el navegador la llena. Un
 * `setTimeout` en el servidor mantendría vivo el render y retrasaría la
 * respuesta de cada página — el modo clásico en que el SSR de una aplicación
 * con sondeo se vuelve lento sin que nadie entienda por qué.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationsStore {
  private readonly notifications = inject(NotificationsClient);
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Perfil público propio, o `null` si todavía no lo creó. */
  private readonly perfilSocial = signal<string | null>(null);
  private readonly perfilResuelto = signal(false);

  private readonly avisosMessaging = signal<readonly AvisoUnificado[]>([]);
  private readonly avisosSociales = signal<readonly AvisoUnificado[]>([]);
  private readonly sinLeerMessaging = signal(0);
  private readonly sinLeerSociales = signal(0);

  /** Si alguna de las dos lecturas está en vuelo. */
  readonly cargando = signal(false);

  /** El último error, o cadena vacía. */
  readonly error = signal('');

  /** El número del badge: la suma de las dos bandejas. */
  readonly sinLeer = computed(
    () => this.sinLeerMessaging() + this.sinLeerSociales(),
  );

  /**
   * Las últimas N de las dos fuentes, de la más reciente a la más vieja.
   *
   * Se ordena por fecha y no por fuente: quien mira la campana quiere lo
   * último que pasó, no lo último de cada módulo.
   */
  readonly avisos = computed<readonly AvisoUnificado[]>(() =>
    [...this.avisosMessaging(), ...this.avisosSociales()]
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, TOPE_PANEL),
  );

  constructor() {
    // Detener el sondeo al destruirse el inyector raíz importa en las pruebas
    // y en el SSR: un temporizador vivo después del render mantiene el proceso
    // despierto.
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /**
   * Empieza a sondear. Idempotente: llamarlo dos veces no duplica el tic.
   *
   * Lo llama la campana al montarse, que es el único lugar donde se sabe que
   * hay una sesión con interfaz. Arrancarlo desde un proveedor de arranque lo
   * pondría a sondear también en las pantallas públicas, donde no hay bandeja
   * que leer.
   */
  iniciar(): void {
    if (!this.isBrowser || this.temporizador !== null) {
      return;
    }
    this.resolverPerfilSocial();
    this.refrescar();
    this.agendar();
  }

  /** Detiene el sondeo. */
  detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  /**
   * Vuelve a leer las dos bandejas.
   *
   * Es público porque el centro de notificaciones lo llama tras marcar algo:
   * el badge del header y la lista de la pantalla tienen que contar lo mismo,
   * y el modo honesto de lograrlo es que los dos lean del mismo lugar.
   */
  refrescar(): void {
    if (!this.isBrowser || !this.auth.isAuthenticated()) {
      return;
    }
    this.cargando.set(true);

    this.notifications.listMine({ limit: TOPE_PANEL }).subscribe({
      next: (pagina) => {
        this.avisosMessaging.set(pagina.items.map(deMessaging));
        this.sinLeerMessaging.set(pagina.unreadCount);
        this.cargando.set(false);
        this.error.set('');
      },
      error: () => {
        this.cargando.set(false);
        // No se vacía lo que ya había: un tic fallido no es motivo para
        // borrarle a alguien los avisos que estaba leyendo.
        this.error.set('No pudimos actualizar tus notificaciones.');
      },
    });

    const perfil = this.perfilSocial();
    if (perfil !== null) {
      this.community
        .listNotifications({ profileId: perfil, limit: TOPE_PANEL })
        .subscribe({
          next: (pagina) => {
            this.avisosSociales.set(pagina.items.map(deCommunity));
            this.sinLeerSociales.set(pagina.unreadCount);
          },
          // Silencio deliberado: que lo social falle no puede tapar «tu receta
          // está lista», que es lo que la otra lectura sí trajo.
          error: () => undefined,
        });
    }
  }

  /**
   * Marca una notificación como leída y refresca.
   *
   * Sólo las de `messaging` se marcan: `community` no expone escritura de
   * lectura de notificaciones —lo verificó el relevamiento de P1— y fingir que
   * se marcó bajaría el badge en pantalla para que el próximo tic lo volviera
   * a subir. Se documenta como hueco en el reporte, no se simula.
   *
   * @param aviso - El aviso que se abrió.
   */
  marcarLeida(aviso: AvisoUnificado): void {
    if (aviso.fuente !== 'messaging' || !aviso.sinLeer) {
      return;
    }
    this.notifications.markRead(aviso.id).subscribe({
      next: () => this.refrescar(),
      error: () => this.error.set('No pudimos marcar la notificación.'),
    });
  }

  /** Marca toda la bandeja de `messaging` y refresca. */
  marcarTodasLeidas(): void {
    this.notifications.markAllRead().subscribe({
      next: () => this.refrescar(),
      error: () => this.error.set('No pudimos marcar tus notificaciones.'),
    });
  }

  /**
   * Encadena el próximo tic. Nunca hay dos vivos a la vez.
   *
   * TX-18: con la pestaña oculta (`document.hidden`) el tic se saltea la
   * llamada de red y sólo se reagenda — preguntarle a la API cada 45 s por una
   * pantalla que nadie está mirando es gasto puro, y con muchas pestañas
   * abiertas es gasto multiplicado. La cadena sigue viva a propósito: en
   * cuanto la pestaña vuelve a estar visible, el próximo tic (o
   * `refrescarSiVisible`, más abajo) retoma sin que nadie tenga que
   * reiniciar nada.
   */
  private agendar(): void {
    this.temporizador = setTimeout(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        this.refrescar();
      }
      this.agendar();
    }, INTERVALO_MS);
  }

  /**
   * Resuelve el perfil público propio, una sola vez.
   *
   * No sale de la sesión: el perfil de `community` es una entidad aparte del
   * perfil de paciente que el token trae en `pid`. `null` —«todavía no lo
   * creó»— es un estado legítimo, y en ese caso la campana muestra sólo la
   * bandeja del módulo 35, que es la que tiene lo clínico.
   */
  private resolverPerfilSocial(): void {
    if (this.perfilResuelto()) {
      return;
    }
    this.perfilResuelto.set(true);
    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        this.perfilSocial.set(propio?.id ?? null);
        if (propio) {
          this.refrescar();
        }
      },
      error: () => this.perfilSocial.set(null),
    });
  }
}

/** Normaliza un aviso del módulo 35. */
function deMessaging(aviso: InAppNotification): AvisoUnificado {
  return {
    id: aviso.id,
    fuente: 'messaging',
    categoria: aviso.category ?? 'CLINICAL',
    titulo: aviso.subject ?? 'Novedad',
    ...(aviso.bodyText === undefined ? {} : { detalle: aviso.bodyText }),
    ruta: rutaDeNotificacion(aviso.destination),
    sinLeer: aviso.unread,
    fecha: aviso.availableAt,
  };
}

/**
 * Normaliza un aviso social.
 *
 * El texto sale de `previewText`, que es lo único legible que trae el
 * contrato: el tipo de notificación viaja como concept id, y traducir uuids a
 * frases desde el navegador sería mantener acá una tabla que se desincroniza
 * con el seed. Sin `previewText` se dice «Novedad en tu perfil», que es cierto
 * y no inventa qué pasó.
 */
function deCommunity(aviso: {
  readonly id: string;
  readonly previewText?: string;
  readonly isRead: boolean;
  readonly createdAt: Date;
}): AvisoUnificado {
  return {
    id: aviso.id,
    fuente: 'community',
    categoria: 'SOCIAL',
    titulo: aviso.previewText ?? 'Novedad en tu perfil',
    // Al muro, que es donde vive lo social. No al objeto concreto: el aviso
    // trae `sourceRefId` con el id de una publicación o un comentario, y el
    // muro no tiene todavía pantalla de publicación suelta.
    ruta: '/feed',
    sinLeer: !aviso.isRead,
    fecha: aviso.createdAt,
  };
}
