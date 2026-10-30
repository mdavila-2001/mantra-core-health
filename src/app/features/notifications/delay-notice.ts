import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

/* ============================================================================
    «El médico se demora», levantado como push.

    Una demora sirve mientras la persona todavía está por salir o en camino:
    enterarse al abrir la campana una hora después no sirve de nada. Por eso,
    apenas el servidor deja el aviso (`PRACTITIONER_DELAY`, módulo 35), acá se
    levanta como una notificación emergente con su botón «Ver mi cita» y, si
    la persona ya dio permiso de notificaciones del navegador, también como
    notificación del sistema — la que se ve aunque la pestaña esté de fondo.

    A diferencia del aviso de cupo libre, corre también contra la API real: la
    demora la emite el servidor y llega a la bandeja de cualquier paciente.

    Permiso: no se pide desde acá. Pedirlo sin que la persona haya tocado nada
    es lo que los navegadores castigan; se pide desde «Permisos del
    navegador» (`BrowserPermissionsService`). Sin permiso, queda el toast.
    ========================================================================== */

/** Cada cuánto se mira la bandeja. Una demora se mide en minutos. */
const CADA_MS = 20_000;

/** Un push que se va solo mientras alguien no miraba es un push perdido. */
const NO_SE_VA_SOLO = null;

/** La clase de aviso que levanta este anunciador. */
const CLASE_DE_AVISO = 'PRACTITIONER_DELAY';

/**
 * Hasta qué antigüedad todavía vale avisar. Una demora de ayer, sin leer, no
 * es noticia: es historia, y para eso está la campana.
 */
const VIGENCIA_MS = 6 * 60 * 60_000;

/** A dónde lleva el botón cuando el aviso no trae su propia ruta. */
const MIS_CITAS = '/my-account/appointments';

@Injectable({ providedIn: 'root' })
export class DelayNotice {
  private readonly auth = inject(AuthService);
  private readonly notificaciones = inject(NotificationsClient);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Lo ya anunciado. La notificación sigue sin leer hasta que alguien la abra,
   * así que «no leída» no alcanza como criterio de novedad.
   */
  private readonly yaMostrados = new Set<string>();

  private reloj: ReturnType<typeof setInterval> | null = null;

  /** Arranca el sondeo. Idempotente, y mudo en el servidor (SSR). */
  start(): void {
    if (!this.isBrowser || this.reloj !== null) return;
    this.reloj = setInterval(() => this.look(), CADA_MS);
    this.destroyRef.onDestroy(() => this.stop());
    this.look();
  }

  stop(): void {
    if (this.reloj === null) return;
    clearInterval(this.reloj);
    this.reloj = null;
  }

  private look(): void {
    if (!this.auth.isAuthenticated()) return;
    this.notificaciones.listMine({ unread: true, limit: 20 }).subscribe({
      next: (pagina) =>
        pagina.items
          .filter((aviso) => isActiveDelay(aviso, Date.now()))
          .forEach((aviso) => this.mostrar(aviso)),
      // Un sondeo que falla no dice nada: la campana sigue mostrando lo que
      // haya cuando se la abra, y el próximo tic lo vuelve a intentar.
      error: () => undefined,
    });
  }

  private mostrar(aviso: InAppNotification): void {
    if (this.yaMostrados.has(aviso.id)) return;
    this.yaMostrados.add(aviso.id);

    const titulo = `⏳ ${aviso.subject ?? 'Su cita viene con demora'}`;
    const mensaje = aviso.bodyText ?? 'Su profesional avisó que se va a demorar.';
    const url = noticeRoute(aviso);

    this.toasts.show({
      type: 'warning',
      title: titulo,
      message: mensaje,
      durationMs: NO_SE_VA_SOLO,
      action: { label: '📅 Ver mi cita', url },
    });
    this.notificarAlSistema(aviso.id, titulo, mensaje);
  }

  /**
   * La notificación del sistema operativo, sólo con permiso ya concedido.
   *
   * `tag` con el id del aviso: si dos pestañas la levantan, el sistema muestra
   * una sola. Cualquier fallo (Safari viejo, iframe sin permiso) se traga: el
   * toast ya salió.
   */
  private notificarAlSistema(id: string, titulo: string, mensaje: string): void {
    try {
      const Aviso = globalThis.Notification;
      if (Aviso === undefined || Aviso.permission !== 'granted') return;
      const sistema = new Aviso(titulo, { body: mensaje, tag: `demora-${id}` });
      sistema.onclick = () => {
        globalThis.focus();
        sistema.close();
      };
    } catch {
      // Sin notificación del sistema: el toast ya está en pantalla.
    }
  }
}

/** Si el aviso es una demora y todavía vale la pena levantarlo. */
export function isActiveDelay(aviso: InAppNotification, ahora: number): boolean {
  const payload = aviso.payloadJson;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === CLASE_DE_AVISO &&
    ahora - new Date(aviso.availableAt).getTime() <= VIGENCIA_MS
  );
}

/** La ruta que el servidor declaró para el aviso, o «Mis citas». */
export function noticeRoute(aviso: InAppNotification): string {
  const payload = aviso.payloadJson as { route?: unknown } | null | undefined;
  const ruta = payload?.route;
  // Sólo rutas internas: un `//otro.sitio` llevaría fuera de la app.
  return typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//')
    ? ruta
    : MIS_CITAS;
}
