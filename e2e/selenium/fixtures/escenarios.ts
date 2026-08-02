/**
 * Catálogo de escenarios de la API simulada.
 *
 * ## Por qué la API va simulada
 *
 * Lo que estas pruebas verifican es **navegación, estado, formularios y
 * persistencia**: que el guard redirija, que la sesión sobreviva a un `F5`, que
 * un error se muestre como un mensaje accionable. Nada de eso depende del
 * contrato de la API — eso es otra capa y otra herramienta (ver
 * `scripts/check-api-contract-drift.mjs`).
 *
 * Con la API simulada no hace falta base de datos, ni datos sembrados, ni un
 * backend levantado, y **el resultado es el mismo en cada corrida**. Una suite
 * E2E que falla al azar se termina ignorando, que es peor que no tenerla.
 *
 * ## Cómo elige una prueba su escenario
 *
 * El arnés expone `GET /__e2e__/escenario?id=…&destino=…`: deja una cookie con
 * el nombre del escenario y redirige al destino. La cookie es **por perfil de
 * navegador**, y cada prueba levanta el suyo, así que dos pruebas en paralelo
 * pueden pedirle a la misma API respuestas distintas sin pisarse.
 */

/** Nombre de la cookie que transporta el escenario elegido. */
export const COOKIE_ESCENARIO = 'e2e_escenario';

/** Ruta del arnés que fija la cookie y redirige. */
export const RUTA_ESCENARIO = '/__e2e__/escenario';

/** Ruta de salud del arnés: responde antes de que la suite arranque. */
export const RUTA_SALUD = '/__e2e__/salud';

export interface Escenario {
  /** Para qué existe. Aparece en el README y en el reporte. */
  readonly descripcion: string;
  /** Claims que lleva el access token que devuelve el login. */
  readonly claims?: Readonly<Record<string, unknown>>;
  /** `false` hace fallar el login con 401 `UNAUTHENTICATED`. */
  readonly loginValido?: boolean;
  /** `false` hace fallar el canje del refresh token con 401. */
  readonly refrescoValido?: boolean;
  /** `false` hace fallar el alta con 409 `CONFLICT`. */
  readonly registroValido?: boolean;
  /** Cuántos registros devuelve el directorio público. */
  readonly registrosDirectorio?: number;
  /** `true` hace fallar el directorio con 503 `DEPENDENCY_UNAVAILABLE`. */
  readonly directorioCaido?: boolean;
  /** `false` hace fallar el canje de un token de correo con 400 `VALIDATION_FAILED`. */
  readonly tokenValido?: boolean;
  /** Sesiones que el cambio de contraseña dice haber cerrado. */
  readonly sesionesRevocadas?: number;
  /**
   * Demora artificial de las respuestas, en milisegundos.
   *
   * Es la **única** pausa de toda la suite y no sincroniza nada: está del lado
   * del servidor para que exista un estado de carga que observar. Las pruebas
   * siguen esperando por condiciones, nunca por tiempo.
   */
  readonly demoraMs?: number;
}

export const ESCENARIOS = {
  'sesion-simple': {
    descripcion: 'Una sola organización: el login entra directo al panel.',
    claims: { tenants: ['t-1'], tenantNames: { 't-1': 'Clínica Norte' } },
  },
  'multi-organizacion': {
    descripcion: 'Dos organizaciones: hay que elegir antes de entrar.',
    claims: {
      tenants: ['t-1', 't-2'],
      tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Centro Sur' },
    },
  },
  'sin-organizacion': {
    descripcion: 'Token sin organizaciones: la pantalla de elección queda vacía.',
    claims: { tenants: [] },
  },
  'credenciales-invalidas': {
    descripcion: 'El login responde 401: credenciales que no sirven.',
    loginValido: false,
  },
  'refresco-vencido': {
    descripcion: 'El refresh token ya no sirve: al recargar se vuelve al login.',
    refrescoValido: false,
  },
  'directorio-poblado': {
    descripcion: 'El directorio público devuelve registros: el panel los cuenta.',
    registrosDirectorio: 3,
  },
  'directorio-caido': {
    descripcion: 'El directorio responde 503: el panel ofrece reintentar.',
    directorioCaido: true,
  },
  'registro-duplicado': {
    descripcion: 'El alta responde 409: ese documento ya tiene cuenta.',
    registroValido: false,
  },
  'token-vencido': {
    descripcion: 'El token del correo ya no sirve: verificar y cambiar la clave fallan.',
    tokenValido: false,
  },
  'clave-cambiada-con-sesiones': {
    descripcion: 'El cambio de contraseña cierra otras dos sesiones abiertas.',
    sesionesRevocadas: 2,
  },
  'api-lenta': {
    descripcion: 'Respuestas demoradas: hay estado de carga que observar.',
    demoraMs: 900,
  },
} as const satisfies Record<string, Escenario>;

export type NombreEscenario = keyof typeof ESCENARIOS;

/** El que se usa cuando una prueba no pide ninguno. */
export const ESCENARIO_POR_DEFECTO: NombreEscenario = 'sesion-simple';

export function resolverEscenario(nombre: string | undefined): Escenario {
  if (nombre !== undefined && nombre in ESCENARIOS) {
    return ESCENARIOS[nombre as NombreEscenario];
  }
  return ESCENARIOS[ESCENARIO_POR_DEFECTO];
}
