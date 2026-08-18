/**
 * Configuración de la suite de extremo a extremo, leída del entorno.
 *
 * Un solo lugar donde se decide qué significa cada variable y qué pasa cuando
 * no está. El resto de la suite recibe un objeto ya validado y no vuelve a
 * tocar `process.env`: así una variable mal escrita falla acá, al arrancar, y
 * no a mitad de una prueba con un mensaje que no dice nada.
 *
 * Los valores por defecto describen la ejecución local completa —construir el
 * artefacto, servirlo y probar contra él— porque es la que tiene que funcionar
 * sin configurar nada.
 *
 * ## Dónde corre esto
 *
 * **Solo en Node**: lo importan `cypress.config.ts` y el arnés. Dentro del
 * navegador no hay `process.env`, así que lo que las pruebas necesitan saber
 * viaja por el bloque `expose` de Cypress y se lee con `Cypress.expose()`.
 */

import { VIEWPORTS, type Viewport } from './viewports';

export { VIEWPORTS, type Viewport, type NombreViewport } from './viewports';

export interface ConfiguracionE2e {
  /** Raíz contra la que navegan las pruebas. Sin barra final. */
  readonly baseUrl: string;
  /** Puerto del arnés. Solo se usa cuando la suite levanta su propio servidor. */
  readonly puerto: number;
  /** Techo de las esperas de Cypress, en milisegundos. */
  readonly timeoutMs: number;
  readonly viewport: Viewport;
  /** Carpeta raíz de las evidencias de esta corrida. */
  readonly artefactos: string;
  /** Identificador de la corrida: es el nombre de la carpeta de artefactos. */
  readonly runId: string;
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

/**
 * Identificador de la corrida.
 *
 * Lo estampa `scripts/run-e2e.mjs` antes de arrancar Cypress para que el
 * proceso de las pruebas y el del arnés escriban en la **misma** carpeta. El
 * respaldo es para cuando alguien invoca `cypress` a mano.
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
    timeoutMs: numero('E2E_TIMEOUT', 15_000),
    viewport: {
      ancho: numero('E2E_VIEWPORT_WIDTH', VIEWPORTS.escritorio.ancho),
      alto: numero('E2E_VIEWPORT_HEIGHT', VIEWPORTS.escritorio.alto),
    },
    artefactos: texto('E2E_ARTIFACTS_DIR', 'artifacts/cypress'),
    runId: runId(),
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

/**
 * Flags de los tramos de los recorridos del viernes (`e2e/real/09` y `10`).
 *
 * Cada uno cubre un pedazo del guion que espera un merge ajeno; la ausencia de
 * la variable es «apagado». Se leen acá —el único lugar que toca
 * `process.env`— y viajan al navegador por el bloque `expose`, donde
 * `cypress/support/real/tramos.ts` los interpreta.
 */
export function tramos(): Record<string, string> {
  return {
    TRAMO_REGISTRO: texto('TRAMO_REGISTRO', ''),
    TRAMO_E1_CANCELAR: texto('TRAMO_E1_CANCELAR', ''),
    TRAMO_M1_CLINICA: texto('TRAMO_M1_CLINICA', ''),
    TRAMO_P1_RECETA: texto('TRAMO_P1_RECETA', ''),
    TRAMO_N4_ACCESO: texto('TRAMO_N4_ACCESO', ''),
  };
}

/**
 * Credenciales de prueba, leídas del entorno.
 *
 * Ninguna abre nada: la API de la suite está simulada y acepta cualquier
 * credencial cuando el escenario dice que el login es válido. Se leen del
 * entorno igual porque la misma suite puede apuntarse a un entorno de ensayo
 * con `E2E_BASE_URL`, y ahí sí importan y **no pueden estar en el repositorio**.
 */
export function credenciales(): Record<string, string> {
  return {
    E2E_TEST_USER_EMAIL: texto('E2E_TEST_USER_EMAIL', 'ana@mantra.test'),
    E2E_TEST_USER_PASSWORD: texto('E2E_TEST_USER_PASSWORD', 'secreto-de-prueba'),
    E2E_TEST_USER_NATIONAL_ID: texto('E2E_TEST_USER_NATIONAL_ID', '1234567'),

    // Solo las usa la suite contra la API real (`cypress/e2e/real/`), que no
    // corre por defecto. Acá no son secretos: apuntan a un backend local y a la
    // cuenta que siembra `BOOTSTRAP_ADMIN_*` al arrancar la API.
    E2E_API_URL: texto('E2E_API_URL', 'http://localhost:3000'),
    // Buzón real por defecto: el mismo con el que siembra la API
    // (`tools/redesa/correos-reales.mjs`). Con `@redesa.test` el correo de
    // verificación no llegaba a ninguna parte y no había forma de comprobar
    // que el envío funciona ni cómo se lee la plantilla.
    E2E_ADMIN_EMAIL: texto(
      'E2E_ADMIN_EMAIL',
      'cpacentropreparacionacademica@gmail.com',
    ),
    E2E_ADMIN_PASSWORD: texto('E2E_ADMIN_PASSWORD', 'S3cret-passw0rd'),
  };
}
