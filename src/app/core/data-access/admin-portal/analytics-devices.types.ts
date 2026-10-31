/* ============================================================================
    Dispositivos desde donde se usa la plataforma
    (`GET /admin/analytics/devices`, módulo telemetry).

    Sólo agregados: no hay personas, ni identificadores, ni direcciones. Cada
    desglose cuenta «contextos de cliente» que no son bots; los bots se cuentan
    aparte y no entran en ningún desglose. El código `UNSPECIFIED` es un
    contexto que no informó esa dimensión.
    ========================================================================== */

export type DevicesPortal = 'WEB' | 'MOBILE';

export interface DevicesQuery {
  readonly from?: string;
  readonly to?: string;
  readonly portal?: DevicesPortal;
}

export interface DevicesWindow {
  readonly from: string;
  readonly to: string;
  readonly interval?: 'hour' | 'day';
  readonly timezone?: 'UTC';
  readonly portal?: DevicesPortal | null;
}

export interface DevicesTotals {
  /** Contextos no-bot de la ventana. Cada desglose suma como máximo esto. */
  readonly contexts: number;
  /** Contextos marcados como bot: no entran en ningún desglose. */
  readonly bots: number;
}

export interface DeviceBreakdownItem {
  /** Código del catálogo, la versión tal cual, o `UNSPECIFIED`. */
  readonly code: string;
  /** Etiqueta del catálogo; igual a `code` si no resuelve a un concepto. */
  readonly label: string;
  readonly contexts: number;
}

export interface DevicesNotMeasured {
  readonly metric: string;
  readonly reason: string;
}

export interface DevicesBreakdown {
  readonly window: DevicesWindow;
  readonly totals: DevicesTotals;
  readonly byDeviceType: readonly DeviceBreakdownItem[];
  readonly byOsFamily: readonly DeviceBreakdownItem[];
  readonly byBrowserFamily: readonly DeviceBreakdownItem[];
  readonly byAppVersion: readonly DeviceBreakdownItem[];
  /** Último contexto recibido; `null` si la ventana no tiene datos. */
  readonly lastContextAt: string | null;
  readonly notMeasured: readonly DevicesNotMeasured[];
}
