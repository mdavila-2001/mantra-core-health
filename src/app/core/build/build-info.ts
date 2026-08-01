import { InjectionToken } from '@angular/core';

import { buildInfo } from '../../../environments/env.generated';
import type { BuildInfo } from '../../../environments/environment.types';

export type { BuildInfo };

/**
 * Identidad del artefacto en ejecución.
 *
 * Es un token y no una lectura directa del archivo generado por la misma razón
 * que {@link API_BASE_URL}: las pruebas pueden fijar otra sin tocar el
 * generador, y quien lo consuma no depende de dónde salió el valor.
 *
 * Responde la primera pregunta de cualquier incidente —**qué código está
 * corriendo**— y es lo que hace posible revertir: sin identificar la versión no
 * se puede volver «a la anterior».
 */
export const BUILD_INFO = new InjectionToken<BuildInfo>('BUILD_INFO', {
  providedIn: 'root',
  factory: () => buildInfo,
});

/** `0.1.0 · ced38e8`, para mostrar junto a un código de soporte. */
export function buildLabel(info: BuildInfo): string {
  return `${info.version} · ${info.commit}`;
}
