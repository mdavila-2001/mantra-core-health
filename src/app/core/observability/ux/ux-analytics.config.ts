import { InjectionToken } from '@angular/core';

import { environment } from '../../../../environments/environment';

export interface UxAnalyticsConfig {
  /** Encendida **y** con esquema: las dos cosas, o nada. */
  readonly active: boolean;
  readonly eventSchemaDefinitionId: string;
  readonly sampleRatio: number;
  /** Cada cuánto se manda lo acumulado. */
  readonly flushIntervalMs: number;
  /** Eventos por lote normal. La API admite hasta 500. */
  readonly maxBatch: number;
  /**
   * Eventos por lote con `keepalive`. El navegador corta en 64 KiB el cuerpo
   * de todas las peticiones `keepalive` en vuelo; veinte eventos quedan lejos.
   */
  readonly maxKeepaliveBatch: number;
  /** Tope de lo acumulado sin poder mandar: se descartan los más viejos. */
  readonly maxBuffer: number;
}

/**
 * Configuración de la captura de interacciones.
 *
 * Un token, como `TELEMETRY_CONFIG`, para que las pruebas fijen otra sin tocar
 * el archivo de entorno.
 */
export const UX_ANALYTICS_CONFIG = new InjectionToken<UxAnalyticsConfig>('UX_ANALYTICS_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const { enabled, eventSchemaDefinitionId, sampleRatio } = environment.uxAnalytics;
    return {
      active: enabled && eventSchemaDefinitionId !== '',
      eventSchemaDefinitionId,
      sampleRatio,
      flushIntervalMs: 10_000,
      maxBatch: 50,
      maxKeepaliveBatch: 20,
      maxBuffer: 500,
    };
  },
});
