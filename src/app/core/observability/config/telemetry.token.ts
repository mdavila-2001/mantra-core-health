import { InjectionToken } from '@angular/core';

import { telemetryConfig } from './telemetry.config';
import type { TelemetryConfig } from './telemetry.types';

/**
 * La configuración de telemetría, para lo que vive dentro del inyector.
 *
 * Es un token por la misma razón que `API_BASE_URL` y `BUILD_INFO`: una prueba
 * puede fijar otra sin tocar el archivo de entorno, y quien lo consume no
 * depende de dónde salió el valor.
 *
 * `telemetryConfig()` ya validó y ya avisó de lo que estuviera mal, así que
 * quien inyecta esto recibe algo utilizable o algo con `enabled: false`. Nunca
 * a medias.
 */
export const TELEMETRY_CONFIG = new InjectionToken<TelemetryConfig>('TELEMETRY_CONFIG', {
  providedIn: 'root',
  factory: () => telemetryConfig(),
});
