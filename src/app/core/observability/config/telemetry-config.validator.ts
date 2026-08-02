import type {
  TelemetryConfig,
  TelemetryConfigCheck,
  TelemetryConfigProblem,
} from './telemetry.types';

/**
 * Segunda revisión de la configuración, ya en el navegador.
 *
 * `scripts/generate-env.mjs` valida lo mismo al construir y falla ahí, que es
 * donde alguien está mirando. Esto existe igual por dos casos que el generador
 * no puede cubrir:
 *
 *   1. **Un despliegue que no pasó por el generador.** Un artefacto servido
 *      desde otro pipeline, o un `env.generated.ts` editado a mano contra la
 *      advertencia de su propio encabezado.
 *   2. **Un valor por defecto que se rompa al editarlo.** Los archivos de
 *      entorno son código: alguien puede escribir `sampleRatio: 10` sin que
 *      ningún verificador lo mire.
 *
 * La reacción es siempre la misma: **apagar la telemetría y decirlo**. Nunca
 * lanzar. Una excepción acá dejaría la aplicación sin arrancar por un problema
 * de observabilidad, que es exactamente al revés de lo que la observabilidad
 * está para conseguir.
 */
export function checkTelemetryConfig(config: TelemetryConfig): TelemetryConfigCheck {
  const problems: TelemetryConfigProblem[] = [];

  if (!Number.isFinite(config.sampleRatio) || config.sampleRatio < 0 || config.sampleRatio > 1) {
    problems.push({
      field: 'sampleRatio',
      message: `debe ser un número entre 0 y 1; se recibió ${String(config.sampleRatio)}`,
    });
  }

  if (!isUsableEndpoint(config.tracesEndpoint)) {
    problems.push({
      field: 'tracesEndpoint',
      message:
        `debe ser una ruta absoluta del mismo origen (/otel/v1/traces) o una URL ` +
        `http/https; se recibió «${config.tracesEndpoint}»`,
    });
  }

  if (config.serviceName.trim() === '') {
    problems.push({
      field: 'serviceName',
      message: 'no puede estar vacío: Jaeger agrupa por este campo',
    });
  }

  return {
    problems,
    // Un solo problema apaga todo. No hay «telemetría degradada»: media
    // configuración produce trazas que mienten, y una traza que miente cuesta
    // más que ninguna traza.
    config: problems.length === 0 ? config : { ...config, enabled: false },
  };
}

/**
 * Una ruta del mismo origen, o una URL absoluta con esquema web.
 *
 * Se rechaza cualquier otra cosa —`javascript:`, `data:`, una ruta relativa sin
 * barra inicial— porque el endpoint acaba en un `fetch` y una ruta relativa se
 * resolvería contra la ruta actual: la telemetría de `/auth/verificar` iría a
 * un sitio distinto que la de `/panel`, y ninguna de las dos existiría.
 */
function isUsableEndpoint(endpoint: string): boolean {
  if (endpoint.startsWith('/')) {
    return endpoint.length > 1;
  }

  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * El aviso, en una línea, para cuando la configuración venga mal.
 *
 * Se escribe en consola porque es el único canal que queda: si la
 * configuración de la telemetría está rota, mandar el problema **por**
 * telemetría no funcionaría.
 */
export function describeProblems(problems: readonly TelemetryConfigProblem[]): string {
  return (
    'Telemetría desactivada por configuración inválida: ' +
    problems.map(({ field, message }) => `${field} ${message}`).join(' · ')
  );
}
