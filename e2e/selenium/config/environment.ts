/**
 * Configuración de la suite de Selenium, leída del entorno.
 *
 * Un solo lugar donde se decide qué significa cada variable y qué pasa cuando
 * no está. El resto de la suite recibe un objeto ya validado y no vuelve a
 * tocar `process.env`: así una variable mal escrita falla acá, al arrancar, y
 * no a mitad de una prueba con un mensaje que no dice nada.
 *
 * Los valores por defecto describen la ejecución local completa —construir el
 * artefacto, servirlo y probar contra él— porque es la que tiene que funcionar
 * sin configurar nada.
 */

/** Navegadores que la fábrica sabe construir. */
export type NavegadorSoportado = 'chrome' | 'chromium';

export interface Viewport {
  readonly ancho: number;
  readonly alto: number;
}

/** Resoluciones representativas. Las pruebas responsive usan estas tres. */
export const VIEWPORTS = {
  escritorio: { ancho: 1440, alto: 900 },
  tableta: { ancho: 900, alto: 1024 },
  movil: { ancho: 390, alto: 844 },
} as const satisfies Record<string, Viewport>;

export type NombreViewport = keyof typeof VIEWPORTS;

export interface ConfiguracionE2e {
  /** Raíz contra la que navegan las pruebas. Sin barra final. */
  readonly baseUrl: string;
  /** Puerto del arnés. Solo se usa cuando la suite levanta el servidor. */
  readonly puerto: number;
  readonly navegador: NavegadorSoportado;
  readonly headless: boolean;
  /** Techo de las esperas explícitas, en milisegundos. */
  readonly timeoutMs: number;
  readonly viewport: Viewport;
  readonly capturarEnFallo: boolean;
  /** Carpeta raíz de las evidencias de esta corrida. */
  readonly artefactos: string;
  /** Identificador de la corrida: es el nombre de la carpeta de artefactos. */
  readonly runId: string;
  /** Archivos de prueba en paralelo. 1 hace la corrida totalmente secuencial. */
  readonly workers: number;
  /** `true` salta la construcción del artefacto y reutiliza `dist/`. */
  readonly saltarBuild: boolean;
  /** `true` cuando la suite tiene que levantar su propio servidor. */
  readonly levantarServidor: boolean;
}

function texto(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor === undefined || valor.trim() === '' ? porDefecto : valor.trim();
}

function numero(nombre: string, porDefecto: number): number {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === '') {
    return porDefecto;
  }
  const valor = Number(crudo);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} tiene que ser un número positivo; llegó «${crudo}».`);
  }
  return valor;
}

function booleano(nombre: string, porDefecto: boolean): boolean {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === '') {
    return porDefecto;
  }
  const valor = crudo.trim().toLowerCase();
  if (['1', 'true', 'si', 'sí', 'yes'].includes(valor)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(valor)) {
    return false;
  }
  throw new Error(`${nombre} tiene que ser booleano; llegó «${crudo}».`);
}

function navegador(): NavegadorSoportado {
  const valor = texto('E2E_BROWSER', 'chrome').toLowerCase();
  if (valor === 'chrome' || valor === 'chromium') {
    return valor;
  }
  throw new Error(`E2E_BROWSER solo acepta «chrome» o «chromium»; llegó «${valor}».`);
}

/**
 * Identificador de la corrida.
 *
 * Lo estampa `scripts/run-e2e-selenium.mjs` antes de arrancar Vitest para que
 * el proceso principal y todos los trabajadores escriban en la **misma**
 * carpeta. El respaldo es para cuando alguien invoca Vitest a mano.
 */
function runId(): string {
  const heredado = process.env['E2E_RUN_ID'];
  if (heredado !== undefined && heredado.trim() !== '') {
    return heredado.trim();
  }
  return new Date().toISOString().replace(/[:.]/g, '-');
}

let cache: ConfiguracionE2e | null = null;

export function configuracion(): ConfiguracionE2e {
  if (cache !== null) {
    return cache;
  }

  const puerto = numero('E2E_PORT', 4175);
  // Con `E2E_BASE_URL` puesta se prueba contra un servidor de otro —un entorno
  // desplegado, un contenedor— y la suite no levanta nada.
  const baseUrlExterna = texto('E2E_BASE_URL', '');
  const baseUrl = (baseUrlExterna || `http://127.0.0.1:${puerto}`).replace(/\/+$/, '');

  cache = {
    baseUrl,
    puerto,
    navegador: navegador(),
    headless: booleano('E2E_HEADLESS', true),
    timeoutMs: numero('E2E_TIMEOUT', 15_000),
    viewport: {
      ancho: numero('E2E_VIEWPORT_WIDTH', VIEWPORTS.escritorio.ancho),
      alto: numero('E2E_VIEWPORT_HEIGHT', VIEWPORTS.escritorio.alto),
    },
    capturarEnFallo: booleano('E2E_SCREENSHOT_ON_FAILURE', true),
    artefactos: texto('E2E_ARTIFACTS_DIR', 'artifacts/selenium'),
    runId: runId(),
    workers: numero('E2E_WORKERS', 2),
    saltarBuild: booleano('E2E_SKIP_BUILD', false),
    levantarServidor: baseUrlExterna === '',
  };

  return cache;
}

/**
 * Corta la ejecución si la suite apunta a algo que huele a producción.
 *
 * Estas pruebas **escriben**: dan de alta cuentas, cierran sesiones, disparan
 * recuperaciones de contraseña. Contra un entorno real eso es daño, no una
 * prueba. La barrera es doble —`NODE_ENV` y la propia URL— porque cualquiera de
 * las dos puede quedar bien por casualidad.
 *
 * `E2E_ALLOW_REMOTE=true` es la salida deliberada para un entorno de ensayo con
 * dominio propio; hay que escribirla a mano y queda en el historial del shell.
 */
export function verificarEntornoSeguro(config: ConfiguracionE2e = configuracion()): void {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'La suite E2E no corre con NODE_ENV=production: crea y borra datos reales.',
    );
  }

  const local = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?$/i;
  if (local.test(config.baseUrl) || booleano('E2E_ALLOW_REMOTE', false)) {
    return;
  }

  throw new Error(
    `E2E_BASE_URL apunta fuera de la máquina local (${config.baseUrl}). ` +
      'Si es un entorno de ensayo y sabés lo que hacés, exportá E2E_ALLOW_REMOTE=true.',
  );
}
