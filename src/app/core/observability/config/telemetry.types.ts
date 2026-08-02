import type { BuildInfo, TelemetryEnvironment } from '../../../../environments/environment.types';

export type { TelemetryEnvironment };

/**
 * Modo de renderizado con el que arrancó **esta** carga.
 *
 * No es una propiedad del artefacto: la misma compilación sirve rutas
 * prerenderizadas, rutas renderizadas en el servidor y rutas que se pintan
 * enteras en el cliente (`app.routes.server.ts`). Se resuelve en ejecución
 * mirando si Angular dejó estado que hidratar.
 */
export type RenderingMode = 'csr' | 'ssr' | 'prerender';

/**
 * Todo lo que la telemetría necesita saber, ya resuelto.
 *
 * Junta tres fuentes que hasta acá viajaban por separado: la configuración
 * pública del entorno, la identidad del artefacto (`BuildInfo`) y lo que solo
 * se sabe al ejecutar (el modo de renderizado). Se arma una sola vez, en
 * {@link telemetryConfig}, para que ningún punto de instrumentación tenga que
 * volver a componerlo —y para que no aparezcan dos versiones distintas de la
 * misma verdad—.
 */
export interface TelemetryConfig {
  readonly enabled: boolean;
  readonly serviceName: string;
  readonly namespace: string;
  readonly environment: string;
  readonly tracesEndpoint: string;
  readonly sampleRatio: number;
  /** De `package.json`, vía `BuildInfo`. */
  readonly version: string;
  /** El commit corto. Es lo que responde «qué código está corriendo». */
  readonly buildId: string;
  readonly renderingMode: RenderingMode;
}

/** Un problema de configuración, en términos que se puedan leer en consola. */
export interface TelemetryConfigProblem {
  readonly field: keyof TelemetryEnvironment;
  readonly message: string;
}

/**
 * Resultado de validar la configuración.
 *
 * `enabled` puede salir en `false` aunque el entorno dijera que sí: una
 * configuración inválida apaga la telemetría en vez de arrancar a medias. Es la
 * única reacción aceptable en un frontend — lanzar dejaría la aplicación sin
 * arrancar por un problema que no es de la aplicación.
 */
export interface TelemetryConfigCheck {
  readonly config: TelemetryConfig;
  readonly problems: readonly TelemetryConfigProblem[];
}

export type { BuildInfo };
