import { buildInfo } from '../../../../environments/env.generated';
import { environment } from '../../../../environments/environment';
import { checkTelemetryConfig, describeProblems } from './telemetry-config.validator';
import type {
  BuildInfo,
  RenderingMode,
  TelemetryConfig,
  TelemetryEnvironment,
} from './telemetry.types';

/**
 * La configuración efectiva de la telemetría, ya validada.
 *
 * Se lee directamente de `environment` y de `buildInfo` en vez de inyectarse
 * porque el primer consumidor es `src/main.ts`, que corre **antes** de que
 * exista un inyector. El token de la fase 5
 * (`observability/config/telemetry.token.ts`) sigue existiendo para lo que sí
 * vive dentro de Angular, y se alimenta de acá: una sola fuente.
 *
 * Los parámetros existen para las pruebas. En producción nadie los pasa.
 */
export function telemetryConfig(
  env: TelemetryEnvironment = environment.telemetry,
  build: BuildInfo = buildInfo,
  renderingMode: RenderingMode = detectRenderingMode(),
): TelemetryConfig {
  const { config, problems } = checkTelemetryConfig({
    enabled: env.enabled,
    serviceName: env.serviceName,
    namespace: env.namespace,
    environment: env.environment,
    tracesEndpoint: env.tracesEndpoint,
    sampleRatio: env.sampleRatio,
    version: build.version,
    buildId: build.commit,
    renderingMode,
  });

  if (problems.length > 0) {
    console.warn(describeProblems(problems));
  }

  return config;
}

/**
 * Con qué modo de renderizado arrancó esta carga.
 *
 * `app.routes.server.ts` mezcla los tres, así que no se puede fijar en el
 * build. La señal es el estado que Angular deja en la página para hidratar
 * (`ngh` en el marcado, `__nghData__` en un script): si está, el HTML lo generó
 * el servidor; si no, lo pintó el navegador.
 *
 * No distingue el prerenderizado del SSR por petición —los dos dejan la misma
 * huella en el cliente— y por eso quien necesita esa diferencia la busca en el
 * span del servidor, que sí la sabe. Acá se informa `ssr` para ambos.
 */
export function detectRenderingMode(): RenderingMode {
  if (typeof document === 'undefined') {
    // Se está ejecutando en el servidor: el modo lo declara el propio servidor.
    return 'ssr';
  }

  return document.querySelector('[ngh]') !== null ? 'ssr' : 'csr';
}

/**
 * Si hay que arrancar la telemetría en esta carga.
 *
 * Tres condiciones, y las tres importan:
 *
 *   1. Que esté habilitada por configuración.
 *   2. Que haya un navegador. Este arranque es solo del cliente; el servidor
 *      tiene el suyo, con otro SDK y otro `service.name` (fase 25).
 *   3. Que exista `fetch`. Es lo que usa el exportador, y comprobarlo evita
 *      cargar el fragmento del SDK en un entorno donde no serviría de nada
 *      —jsdom sin polyfills, por ejemplo—.
 */
export function shouldStartBrowserTelemetry(config: TelemetryConfig): boolean {
  return config.enabled && typeof window !== 'undefined' && typeof fetch === 'function';
}
