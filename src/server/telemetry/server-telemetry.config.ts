/**
 * Configuración de la telemetría **del servidor**.
 *
 * No comparte nada con la del navegador, y es a propósito:
 *
 *   - La del navegador se compila dentro del paquete y es pública. Ésta se lee
 *     del entorno del proceso y **no se empaqueta**, así que no pasa por
 *     `scripts/generate-env.mjs` ni lleva el prefijo `PUBLIC_`. Es la razón por
 *     la que `OTEL_EXPORTER_OTLP_ENDPOINT` puede apuntar a una dirección
 *     interna que el navegador nunca ve.
 *   - El `service.name` es distinto. Con el mismo, Jaeger mezclaría un render
 *     de 30 ms con una sesión de navegador de veinte minutos en la misma
 *     estadística.
 */

export interface ServerTelemetryConfig {
  readonly enabled: boolean;
  readonly serviceName: string;
  readonly namespace: string;
  readonly environment: string;
  /** Raíz del Collector, sin `/v1/traces`. */
  readonly collectorUrl: string;
  readonly sampleRatio: number;
  readonly version: string;
}

/**
 * Lee el entorno del proceso, con valores por defecto seguros.
 *
 * Apagada salvo que se diga lo contrario, igual que en el navegador: un
 * despliegue que todavía no tiene Collector no empieza a mandar trazas a un
 * puerto cerrado solo por actualizar.
 */
export function serverTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env,
  version = '0.0.0',
): ServerTelemetryConfig {
  return {
    enabled: env['OTEL_SSR_ENABLED'] === 'true',
    serviceName: env['OTEL_SSR_SERVICE_NAME'] ?? 'mantra-angular-ssr',
    namespace: env['OTEL_SSR_NAMESPACE'] ?? 'mantra',
    environment: env['DEPLOY_ENV'] ?? env['NODE_ENV'] ?? 'development',
    collectorUrl: normalizeCollectorUrl(env['OTEL_EXPORTER_OTLP_ENDPOINT']),
    sampleRatio: parseRatio(env['OTEL_SSR_SAMPLE_RATIO']),
    version,
  };
}

/**
 * La raíz del Collector, sin barra final y sin `/v1/traces`.
 *
 * Se normaliza porque las dos formas circulan —la variable estándar de
 * OpenTelemetry es la raíz, pero mucha documentación escribe la ruta completa—
 * y concatenar sin mirar produciría `/v1/traces/v1/traces`, que devuelve 404 y
 * no se parece a un problema de configuración cuando se mira el registro.
 */
function normalizeCollectorUrl(raw: string | undefined): string {
  const value = (raw ?? 'http://localhost:4318').trim().replace(/\/+$/, '');
  return value.endsWith('/v1/traces') ? value.slice(0, -'/v1/traces'.length) : value;
}

/**
 * El ratio del servidor.
 *
 * Por defecto **0.1**, no 1: el servidor ve todas las peticiones, incluidas las
 * de los robots de indexación y las comprobaciones de salud. Con el 100 % el
 * volumen del SSR enterraría al del navegador, que es donde está la información
 * que no se puede obtener de otro modo.
 *
 * Un valor inválido cae al defecto en vez de abortar: un servidor que no
 * arranca por una variable de telemetría mal escrita es peor que uno que
 * arranca muestreando distinto.
 */
function parseRatio(raw: string | undefined): number {
  const ratio = Number(raw);
  return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 0.1;
}
