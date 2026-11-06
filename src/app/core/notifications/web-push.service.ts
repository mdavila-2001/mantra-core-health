import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../auth/session.store';
import { WebPushClient } from '../data-access/notifications/web-push.client';
import { endpointHash, migrateLegacyOffered, readFlag, readOwner, writeFlag, writeOwner } from './web-push-local';

/** Dónde vive el service worker (raíz de `public/`, alcance completo). */
export const PUSH_WORKER_URL = '/push-sw.js';
/** Message the service worker posts when the push service rotated the subscription. */
export const SUBSCRIPTION_CHANGED_MESSAGE = 'alovida-push-subscription-changed';

/** Por qué no se pudo activar, dicho para mostrarlo a la persona. */
export type WebPushOutcome = 'enabled' | 'unsupported' | 'unavailable' | 'denied' | 'failed';

/** Qué decirle a la persona cuando no se pudo activar, sin culparla. */
export const WEB_PUSH_NOTICES: Record<Exclude<WebPushOutcome, 'enabled'>, string> = {
  unsupported: 'Este navegador no admite avisos fuera de la página.',
  unavailable: 'Los avisos del navegador todavía no están disponibles en este entorno.',
  denied:
    'El navegador tiene bloqueados los avisos. Puede permitirlos desde la configuración del sitio.',
  failed: 'No pudimos activar los avisos. Intente de nuevo en unos minutos.',
};

/**
 * Avisos push del navegador.
 *
 * - **Offered once per person**: after the first booking (`offerAfterFirstBooking`)
 *   or through the private-area notice (`canOffer`). A refusal is not insisted on;
 *   Settings stays available.
 * - **A subscription belongs to one person** (`web-push-local.ts`): logout unsubscribes
 *   the browser (`forgetBrowser`), and `resync` never adopts a live subscription saved
 *   for someone else or for nobody known (a logout whose cleanup did not run): it
 *   removes it. The opt-in of **this person** is kept, so on their next login `resync`
 *   creates a fresh subscription without asking (permission already granted).
 * - The API is only told again when the endpoint changed (rotation) or on an explicit
 *   activation: reloads and other tabs do not repeat the audited PUT.
 * - Every await re-checks that the signed-in person did not change (logout race).
 * - Todo es inerte bajo SSR y en navegadores sin `PushManager`.
 * - Un fallo nunca interrumpe a quien llama: devuelve un `WebPushOutcome`.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly client = inject(WebPushClient);
  private readonly session = inject(SessionStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pendingEnable: Promise<WebPushOutcome> | null = null;
  private pendingResync: Promise<void> | null = null;

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

  /** Pide el permiso y suscribe este navegador, desde un gesto. Concurrent calls share one run. */
  enable(): Promise<WebPushOutcome> {
    this.pendingEnable ??= this.runEnable().finally(() => (this.pendingEnable = null));
    return this.pendingEnable;
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
      writeOwner(null);
      writeFlag('optin', this.currentUser(), false);
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * On every login, restore and worker message: removes a live subscription that is
   * not this person's, and restores push for a person who opted in here. Without a
   * prompt (only with the permission already granted). Never throws; concurrent calls
   * share one run.
   */
  resync(): Promise<void> {
    this.pendingResync ??= this.runResync().finally(() => (this.pendingResync = null));
    return this.pendingResync;
  }

  /** Resyncs on the worker's `pushsubscriptionchange` message (it has no token). Returns the disposer. */
  watchWorker(): () => void {
    if (!this.supported) return () => undefined;
    const onMessage = (event: MessageEvent): void => {
      if (event.data?.type === SUBSCRIPTION_CHANGED_MESSAGE) void this.resync();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }

  /**
   * Whether the one-time offer makes sense for the signed-in person: push is
   * supported, not blocked, not already on, and never offered to them here.
   * The server side (`config().enabled`) is checked by whoever shows the offer.
   */
  canOffer(): boolean {
    const userId = this.session.userId();
    return (
      this.supported &&
      userId !== null &&
      this.permission !== 'denied' &&
      !this.subscribed() &&
      !readFlag('offered', userId)
    );
  }

  /** Remembers that the offer was shown to this person (accepted or not). */
  markOffered(): void {
    writeFlag('offered', this.currentUser(), true);
  }

  /**
   * Da de baja la suscripción **sólo en el navegador**, sin llamar a la API.
   *
   * Es lo que corre al cerrar sesión: en ese momento el token ya se descartó y
   * un `DELETE` respondería 401. No hace falta: con la suscripción dada de baja
   * el servicio de push contesta 410 al siguiente envío y la API retira la fila
   * sola. Así, en un dispositivo compartido, la persona siguiente no recibe los
   * avisos de la anterior. If it never runs, `resync` removes the orphan on the
   * next login. The per-user opt-in is kept on purpose (see `resync`).
   */
  async forgetBrowser(): Promise<void> {
    if (!this.supported) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL);
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      writeOwner(null);
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
    if (!this.supported || this.permission !== 'default' || readFlag('offered', this.currentUser())) {
      return 'skipped';
    }
    this.markOffered();
    return this.enable();
  }

  private async runEnable(): Promise<WebPushOutcome> {
    if (!this.supported) return 'unsupported';
    const userId = this.currentUser();
    this.busy.set(true);
    try {
      // Asked first, while the click's user activation is still fresh (Firefox and
      // Safari drop it after a network round trip). Harmless if push turns out off.
      const permission =
        this.permission === 'default' ? await Notification.requestPermission() : this.permission;
      if (permission !== 'granted') return 'denied';

      const config = await firstValueFrom(this.client.config());
      if (!config.enabled || config.publicKey === null) return 'unavailable';
      return (await this.save(config.publicKey, userId, true)) ? 'enabled' : 'failed';
    } catch {
      return 'failed';
    } finally {
      this.busy.set(false);
    }
  }

  private async runResync(): Promise<void> {
    const userId = this.session.userId();
    if (!this.supported || userId === null) return;
    migrateLegacyOffered(userId);
    if (this.permission !== 'granted') return;
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL);
      const live = await registration?.pushManager.getSubscription();
      if (!this.still(userId)) return;
      const owner = readOwner();
      if (live && owner?.user !== userId) {
        // Another account's subscription, or one nobody can vouch for: never adopt it.
        await live.unsubscribe();
        writeOwner(null);
        this.subscribed.set(false);
        // Unknown owner = saved before ownership existed: offer again rather than lose it.
        if (owner === null) writeFlag('offered', userId, false);
      } else if (live && owner?.endpoint === endpointHash(live.endpoint)) {
        this.subscribed.set(true);
        return;
      }
      if (!(live && owner?.user === userId) && !readFlag('optin', userId)) return;

      const config = await firstValueFrom(this.client.config());
      if (!this.still(userId) || !config.enabled || config.publicKey === null) return;
      await this.save(config.publicKey, userId, false);
    } catch {
      /* a failed resync leaves things as they were; the next login retries */
    }
  }

  /**
   * Registers the worker, reuses this person's subscription (or creates one) and
   * tells the API when it is new, rotated or `force`d. Aborts if the person changed.
   */
  private async save(publicKey: string, userId: string, force: boolean): Promise<boolean> {
    const registration = await navigator.serviceWorker.register(PUSH_WORKER_URL);
    await navigator.serviceWorker.ready;
    const owner = readOwner();
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && owner?.user !== userId) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!this.still(userId)) return false;
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(publicKey),
    });

    const json = subscription.toJSON();
    const p256dh = json.keys?.['p256dh'];
    const auth = json.keys?.['auth'];
    if (!json.endpoint || !p256dh || !auth) return false;
    const hash = endpointHash(json.endpoint);
    if (force || owner?.user !== userId || owner.endpoint !== hash) {
      if (!this.still(userId)) return false;
      await firstValueFrom(this.client.subscribe({ endpoint: json.endpoint, keys: { p256dh, auth } }));
      writeOwner({ user: userId, endpoint: hash });
    }
    writeFlag('optin', userId, true);
    writeFlag('offered', userId, true);
    if (this.still(userId)) this.subscribed.set(true);
    return true;
  }

  /** The signed-in person (or '' with no session, as in the booking flow's tests). */
  private currentUser(): string {
    return this.session.userId() ?? '';
  }

  private still(userId: string): boolean {
    return this.currentUser() === userId;
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
