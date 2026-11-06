import { Coleccion } from '../mock-store';

/**
 * Las derivaciones de una orden a un centro (06/11/2026): el médico la dirige
 * a un laboratorio o centro de imagenología y **el paciente decide**. Recién
 * al aceptar la orden entra a la bandeja del centro; sugerir un centro no le
 * da acceso a nada (CONTRATO §3). Sólo existe en el simulador.
 *
 * Archivo aparte, sin importar los manejadores, para que `diagnostics.handlers`
 * pueda leerlo sin un ciclo con `referral.handlers`.
 */
export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface DerivacionSimulada {
  /** El id de la orden: una fila por orden. */
  readonly id: string;
  readonly performerTenantId: string;
  readonly performerName: string;
  readonly requestedByName: string;
  readonly status: ReferralStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
}

export const derivaciones = new Coleccion<DerivacionSimulada>([]);
derivaciones.persistirEn('mock.diagnostico.derivaciones');

/** Lo que el paciente ve de la derivación de una orden suya; nada si no la hay. */
export function referralFieldsOf(orderId: string): {
  readonly referral?: {
    readonly status: ReferralStatus;
    readonly performerName: string;
    readonly performerTenantId: string;
    readonly requestedByName: string;
  };
} {
  const d = derivaciones.get(orderId);
  return d === undefined
    ? {}
    : {
        referral: {
          status: d.status,
          performerName: d.performerName,
          performerTenantId: d.performerTenantId,
          requestedByName: d.requestedByName,
        },
      };
}
