/** Por qué no se pudo activar, dicho para mostrarlo a la persona. */
export type WebPushOutcome = 'enabled' | 'unsupported' | 'unavailable' | 'denied' | 'service' | 'failed';

/** Qué decirle a la persona cuando no se pudo activar, sin culparla. */
export const WEB_PUSH_NOTICES: Record<Exclude<WebPushOutcome, 'enabled'>, string> = {
  unsupported: 'Este navegador no admite avisos fuera de la página.',
  unavailable: 'Los avisos del navegador todavía no están disponibles en este entorno.',
  // AloVida cannot undo a browser block: say where the person does it.
  denied:
    'El navegador tiene bloqueados los avisos. Para permitirlos, toque el candado junto a la dirección de la página y active «Notificaciones».',
  // Permission granted but the browser's push service refused (Brave ships it off).
  service:
    'El navegador permitió los avisos, pero su servicio de envío no respondió. Si usa Brave: Configuración › Privacidad y seguridad › active «Usar los servicios de Google para la mensajería push» y vuelva a abrir el navegador.',
  failed: 'No pudimos activar los avisos. Intente de nuevo en unos minutos.',
};

/** Thrown when `pushManager.subscribe` rejects: the browser side, not AloVida's API. */
export class PushServiceError extends Error {
  constructor(readonly reason: unknown) {
    super('push subscription rejected by the browser');
  }
}

/**
 * Maps a rejected `pushManager.subscribe` to what the person can do about it.
 * A key the browser cannot use (`InvalidAccessError`, or not even base64:
 * `InvalidCharacterError`) is the server's problem. `AbortError` with the
 * permission granted is the browser's push service being off (Brave's default),
 * which retrying in AloVida never solves. Anything else may be transient.
 */
export function pushServiceOutcome(error: PushServiceError): WebPushOutcome {
  // By name, not `instanceof DOMException`: the error may come from another realm.
  const name = (error.reason as { name?: unknown } | null)?.name;
  if (name === 'InvalidAccessError' || name === 'InvalidCharacterError') return 'unavailable';
  return name === 'AbortError' ? 'service' : 'failed';
}
