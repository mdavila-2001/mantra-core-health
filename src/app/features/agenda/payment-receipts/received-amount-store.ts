import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/** El monto que el médico anotó al recibir un pago. */
export interface ReceivedAmount {
  readonly amount: number;
  readonly currency: 'BOB';
  /** Cuándo se anotó, en ISO 8601. */
  readonly savedAt: string;
}

const KEY_PREFIX = 'alovida.receivedAmount.v1.';

/** «150,00»: dos decimales, coma decimal y punto de miles (es-BO). */
export function formatBolivianos(amount: number): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * El monto recibido de cada cita, guardado **solo en este navegador**.
 *
 * TODO(pago-monto-api): reemplazar este almacén por el campo `amountReceived`
 * del estado de pago cuando la API lo tenga. Hoy `SetPaymentStateDto` solo
 * recibe `state` e `insuranceUsed`, así que el monto no puede viajar al
 * servidor; mientras tanto vive en `localStorage` y la pantalla lo avisa.
 *
 * Todo acceso al almacenamiento va protegido: en el servidor (SSR) no existe, y
 * en el navegador puede estar bloqueado o lleno. Si falla, el monto simplemente
 * no se guarda ni se lee, y `set` lo informa devolviendo `false`.
 */
@Injectable({ providedIn: 'root' })
export class ReceivedAmountStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sube con cada cambio, para que las vistas que lo leen se recalculen. */
  private readonly version = signal(0);

  get(bookingId: string): ReceivedAmount | null {
    this.version();
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(KEY_PREFIX + bookingId);
      return raw === null ? null : parse(raw);
    } catch {
      return null;
    }
  }

  /** @returns `false` si el navegador no dejó guardarlo. */
  set(bookingId: string, amount: number): boolean {
    if (!this.isBrowser) return false;
    const value: ReceivedAmount = { amount, currency: 'BOB', savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(KEY_PREFIX + bookingId, JSON.stringify(value));
    } catch {
      return false;
    }
    this.version.update((v) => v + 1);
    return true;
  }

  clear(bookingId: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(KEY_PREFIX + bookingId);
    } catch {
      return;
    }
    this.version.update((v) => v + 1);
  }
}

/** Lo guardado puede estar viejo o alterado: solo se acepta con la forma esperada. */
function parse(raw: string): ReceivedAmount | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { amount, currency, savedAt } = value as Record<string, unknown>;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
    if (currency !== 'BOB' || typeof savedAt !== 'string') return null;
    return { amount, currency, savedAt };
  } catch {
    return null;
  }
}
