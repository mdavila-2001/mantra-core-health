import { InjectionToken } from '@angular/core';

import { environment } from '../../../../environments/environment';

/**
 * Ids deterministas del catálogo de telemetría (iguales en todos los entornos;
 * `CONTRATO-ingesta-ux.md` §2). El esquema con consentimiento sí se configura
 * (`PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID`); estos dos son constantes.
 */
export const ESQUEMA_VISTA_ANONIMA_ID = 'df630ae0-3bf4-567d-97f3-5b75ea77bc94';
/** Propósito `PORTAL_UX_HEATMAP`: el que pide consentimiento. */
export const PROPOSITO_UX_HEATMAP_ID = '9889b3b6-4293-5266-bba2-b27fa26bec2e';
/** Versión del texto del aviso que la persona aceptó; viaja con el consentimiento. */
export const VERSION_CONSENTIMIENTO_UX = 'ux-heatmap-2026-10';

export interface UxAnalyticsConfig {
  /** Encendida **y** con esquema: las dos cosas, o nada. */
  readonly active: boolean;
  /** Esquema `ux_interaccion` v2: exige consentimiento `GRANTED`. */
  readonly eventSchemaDefinitionId: string;
  /** Esquema `pagina_vista_anonima`: solo `pagina_vista`, sin identidad ni propiedades. */
  readonly anonymousSchemaDefinitionId: string;
  /** Propósito cuyo consentimiento decide si se mandan clics. */
  readonly consentPurposeDefinitionId: string;
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
      anonymousSchemaDefinitionId: ESQUEMA_VISTA_ANONIMA_ID,
      consentPurposeDefinitionId: PROPOSITO_UX_HEATMAP_ID,
      sampleRatio,
      flushIntervalMs: 10_000,
      maxBatch: 50,
      maxKeepaliveBatch: 20,
      maxBuffer: 500,
    };
  },
});
