import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { WebPushClient } from '../data-access/notifications/web-push.client';

/** Dónde vive el service worker (raíz de `public/`, alcance completo). */
export const PUSH_WORKER_URL = '/push-sw.js';
/** Marca local: ya le ofrecimos el permiso una vez, no se vuelve a pedir solo. */
const OFFERED_KEY = 'alovida.webpush.offered';

/** Por qué no se pudo activar, dicho para mostrarlo a la persona. */
export type WebPushOutcome = 'enabled' | 'unsupported' | 'unavailable' | 'denied' | 'failed';

/**
 * Avisos push del navegador.
 *
 * - **Se pide el permiso al reservar la primera cita** (`offerAfterFirstBooking`),
 *   una sola vez; si la persona lo rechaza, no se insiste. El interruptor de
 *   Ajustes sigue disponible para activarlo cuando quiera.
 * - Todo es inerte bajo SSR y en navegadores sin `PushManager`.
 * - Un fallo nunca interrumpe a quien llama: devuelve un `WebPushOutcome`.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly client = inject(WebPushClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Si este navegador está suscrito ahora. */
  readonly subscribed = signal(false);
  /** Hay una activación o desactivación en curso. */
  readonly busy = signal(false);

  /** El navegador sabe de service workers, push y notificaciones. */
  get supported(): boolean {
    return (
      this.isBrowser &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /** Estado del permiso: `default`, `granted` o `denied`. */
  get permission(): NotificationPermission {
    return this.supported ? Notification.permission : 'denied';
  }

  /** Lee si ya hay una suscripción viva en este navegador. */
  async refresh(): Promise<void> {
    if (!this.supported) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL);
      const existing = await registration?.pushManager.getSubscription();
      this.subscribed.set(existing != null && this.permission === 'granted');
    } catch {
      this.subscribed.set(false);
    }
  }

  /** Pide el permiso y suscribe este navegador. Debe llamarse desde un gesto. */
  async enable(): Promise<WebPushOutcome> {
    if (!this.supported) return 'unsupported';
    this.busy.set(true);
    try {
      const config = await firstValueFrom(this.client.config());
      if (!config.enabled || config.publicKey === null) return 'unavailable';

      const permission =
        this.permission === 'default' ? await Notification.requestPermission() : this.permission;
      if (permission !== 'granted') return 'denied';

      const registration = await navigator.serviceWorker.register(PUSH_WORKER_URL);
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(config.publicKey),
        }));

      const json = subscription.toJSON();
      const p256dh = json.keys?.['p256dh'];
      const auth = json.keys?.['auth'];
      if (!json.endpoint || !p256dh || !auth) return 'failed';
      await firstValueFrom(
        this.client.subscribe({ endpoint: json.endpoint, keys: { p256dh, auth } }),
      );
      this.subscribed.set(true);
      return 'enabled';
    } catch {
      return 'failed';
    } finally {
      this.busy.set(false);
    }
  }

  /** Quita la suscripción de este navegador, en el servidor y en el navegador. */
  async disable(): Promise<void> {
    if (!this.supported) return;
    this.busy.set(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL);
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await firstValueFrom(this.client.unsubscribe(subscription.endpoint)).catch(() => undefined);
        await subscription.unsubscribe();
      }
      this.subscribed.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Da de baja la suscripción **sólo en el navegador**, sin llamar a la API.
   *
   * Es lo que corre al cerrar sesión: en ese momento el token ya se descartó y
   * un `DELETE` respondería 401. No hace falta: con la suscripción dada de baja
   * el servicio de push contesta 410 al siguiente envío y la API retira la fila
   * sola. Así, en un dispositivo compartido, la persona siguiente no recibe los
   * avisos de la anterior.
   */
  async forgetBrowser(): Promise<void> {
    if (!this.supported) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL);
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    } catch {
      /* cerrar sesión no puede fallar por esto */
    }
    this.subscribed.set(false);
  }

  /**
   * Ofrece el permiso al reservar la primera cita. Sólo si el navegador lo
   * soporta, el servidor lo tiene activo, el permiso sigue sin decidir y no se
   * ofreció antes. Nunca lanza.
   */
  async offerAfterFirstBooking(): Promise<WebPushOutcome | 'skipped'> {
    if (!this.supported || this.permission !== 'default' || this.alreadyOffered()) {
      return 'skipped';
    }
    this.markOffered();
    return this.enable();
  }

  private alreadyOffered(): boolean {
    try {
      return localStorage.getItem(OFFERED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markOffered(): void {
    try {
      localStorage.setItem(OFFERED_KEY, '1');
    } catch {
      /* sin almacenamiento: se vuelve a ofrecer, no se rompe nada */
    }
  }
}

/** Decodifica la clave pública VAPID (base64url) al formato que pide `subscribe`. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
