/**
 * El dispositivo desde el que se abrió esta sesión, cuando la API no lo conocía
 * y la política de sesión de la organización pide avisarlo (`newDeviceAlert`).
 *
 * **Propuesta al contrato**: `POST /iam/auth/login` agrega `newDevice` a su
 * respuesta solo en ese caso. Es un aviso de presentación; no autoriza nada ni
 * cambia la sesión.
 */
export interface NewDeviceNotice {
  /** Identificador del dispositivo, para confirmarlo con «Fui yo». */
  readonly deviceId: string;
  /** Cómo se lo nombra a la persona: «Chrome en Windows». */
  readonly label: string;
  readonly ip?: string;
  /** Cuándo se abrió la sesión. */
  readonly occurredAt: Date;
}

/** Cómo viaja `newDevice` en la respuesta del inicio de sesión. */
export interface NewDeviceBody {
  readonly deviceId: string;
  readonly label: string;
  readonly ip?: string | null;
  readonly occurredAt: string;
}

/** El aviso ya con fecha, o nada cuando la API no lo mandó. */
export function newDeviceOf(body: NewDeviceBody | undefined): { readonly newDevice?: NewDeviceNotice } {
  if (body === undefined) return {};
  return {
    newDevice: {
      deviceId: body.deviceId,
      label: body.label,
      ...(body.ip === undefined || body.ip === null ? {} : { ip: body.ip }),
      occurredAt: new Date(body.occurredAt),
    },
  };
}

/** `POST /iam/me/devices/:id/confirm` («Fui yo»). */
export interface DeviceConfirmed {
  /** Siempre `true`: el dispositivo quedó de confianza. */
  readonly confirmed: boolean;
  readonly deviceId: string;
}

/** `POST /iam/me/devices/:id/confirm-code`: el código salió hacia el correo verificado. */
export interface DeviceCodeRequested {
  /** `false` si el dispositivo ya era de confianza y no hizo falta mandar nada. */
  readonly sent: boolean;
  /** La dirección con lo central tapado: `j***@correo.com`. Nunca la completa. */
  readonly sentTo?: string;
}

/** `POST /iam/me/devices/:id/not-me` («No fui yo»). */
export interface DeviceReportedNotMe {
  /** Cuántas sesiones distintas de la actual cerró la API. */
  readonly revokedSessions: number;
  readonly deviceId: string;
}

/**
 * `GET /iam/me/network` — lo que la API ve de la conexión de quien pregunta. Es contra **esta** dirección contra la
 * que se evalúan las reglas de red, así que se muestra antes de guardarlas: detrás de un proxy mal configurado la
 * API ve la dirección del proxy y no la de la sede.
 */
export interface MyNetwork {
  /** La dirección que ve el servidor, normalizada; `null` si no la pudo leer. */
  readonly ip: string | null;
  readonly family: 'ipv4' | 'ipv6' | null;
  /** Cuántos saltos de proxy de confianza tiene configurados el servidor (`TRUST_PROXY_HOPS`). */
  readonly trustProxyHops: number;
}
