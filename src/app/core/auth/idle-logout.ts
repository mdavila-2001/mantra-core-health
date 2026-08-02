import {
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  NgZone,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

/**
 * Cuánto se espera sin actividad antes de cerrar la sesión.
 *
 * Quince minutos es el valor habitual en aplicaciones clínicas: largo como para
 * no molestar a quien lee una historia, corto como para que un consultorio
 * vacío no quede con la sesión abierta.
 */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Cuánto antes se avisa. Dos minutos alcanzan para volver y moverse. */
export const IDLE_WARNING_MS = 2 * 60 * 1000;

/**
 * Los eventos que cuentan como «la persona sigue ahí».
 *
 * `scroll` y `keydown` cubren leer y escribir; `pointerdown` cubre el ratón y
 * el táctil con un solo oyente. `mousemove` **no** está a propósito: dispara
 * cientos de veces por segundo y un ratón apoyado en una mesa que vibra
 * mantendría la sesión abierta para siempre.
 */
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'focus'] as const;

/**
 * Cierra la sesión tras un rato sin actividad.
 *
 * ## Por qué hace falta
 *
 * La sesión duraba lo que durara el refresh token. En un dispositivo compartido
 * —una recepción, un consultorio, una tablet de planta— eso es bastante más de
 * lo deseable: quien se va sin cerrar sesión deja la siguiente historia clínica
 * al alcance de quien se siente después.
 *
 * ## Avisa antes de cerrar
 *
 * Cerrar sin avisar es perder lo que se estaba escribiendo. `warning` se pone en
 * `true` dos minutos antes, y cualquier actividad lo cancela: la pantalla que
 * quiera puede mostrarlo, y el simple hecho de moverse lo resuelve.
 *
 * ## Fuera de la zona de Angular
 *
 * Los oyentes se registran con `runOutsideAngular`: son eventos de alta
 * frecuencia y cada uno dispararía una detección de cambios completa. Lo único
 * que vuelve a la zona es el cierre, que sí tiene que repintar.
 */
@Injectable({
  providedIn: 'root',
})
export class IdleLogout {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionStore);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** `true` cuando quedan menos de {@link IDLE_WARNING_MS} para el cierre. */
  private readonly porVencer = signal(false);
  readonly warning = this.porVencer.asReadonly();

  private temporizadorCierre: ReturnType<typeof setTimeout> | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  private desconectar: (() => void) | null = null;

  constructor() {
    // El reloj solo corre con sesión abierta: sin ella no hay nada que cerrar,
    // y mantener oyentes en el login sería trabajo por nada.
    effect(() => {
      if (this.session.isAuthenticated()) {
        this.arrancar();
      } else {
        this.detener();
      }
    });

    this.destroyRef.onDestroy(() => this.detener());
  }

  /** Reinicia la cuenta. Público para que una acción de «seguir acá» lo llame. */
  reiniciar(): void {
    if (!this.isBrowser || !this.session.isAuthenticated()) {
      return;
    }

    this.limpiarTemporizadores();
    if (this.porVencer()) {
      this.zone.run(() => this.porVencer.set(false));
    }

    this.temporizadorAviso = setTimeout(
      () => this.zone.run(() => this.porVencer.set(true)),
      IDLE_TIMEOUT_MS - IDLE_WARNING_MS,
    );

    this.temporizadorCierre = setTimeout(
      () =>
        this.zone.run(() => {
          this.porVencer.set(false);
          // `logout()` avisa al servidor y limpia local pase lo que pase, que
          // es lo que corresponde: la sesión se cierra aunque la red falle.
          this.auth.logout();
        }),
      IDLE_TIMEOUT_MS,
    );
  }

  private arrancar(): void {
    if (!this.isBrowser || this.desconectar !== null) {
      return;
    }

    const escuchar = () => this.reiniciar();

    this.zone.runOutsideAngular(() => {
      for (const evento of EVENTOS) {
        this.document.addEventListener(evento, escuchar, { passive: true, capture: true });
      }
    });

    this.desconectar = () => {
      for (const evento of EVENTOS) {
        this.document.removeEventListener(evento, escuchar, { capture: true });
      }
    };

    this.reiniciar();
  }

  private detener(): void {
    this.limpiarTemporizadores();
    this.desconectar?.();
    this.desconectar = null;
    if (this.porVencer()) {
      this.porVencer.set(false);
    }
  }

  private limpiarTemporizadores(): void {
    if (this.temporizadorCierre !== null) {
      clearTimeout(this.temporizadorCierre);
      this.temporizadorCierre = null;
    }
    if (this.temporizadorAviso !== null) {
      clearTimeout(this.temporizadorAviso);
      this.temporizadorAviso = null;
    }
  }
}
