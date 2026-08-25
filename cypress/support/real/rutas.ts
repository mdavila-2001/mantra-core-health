/**
 * El mapa de rutas de los recorridos contra la API viva.
 *
 * ## Por qué existe
 *
 * El PR #55 renombró todas las rutas de la aplicación al inglés (mergeado el
 * 2026-08-12; las direcciones viejas quedan como redirects de transición en
 * `RUTAS_HEREDADAS`). Escribir las rutas sueltas en cada spec habría regado ese
 * renombre por toda la suite; con el mapa costó **este archivo y una
 * re-corrida** — que es exactamente lo que pasó. La regla que lo sostiene:
 * ningún spec de `e2e/real/` escribe una ruta como string — la importa de acá.
 *
 * Las rutas son las canónicas de `src/app/app.routes.ts` (inglés), no las
 * heredadas: los redirects existen para favoritos y correos viejos, y se van a
 * retirar.
 *
 * Los query params (`rango`, `recurso`) siguen en castellano: #55 renombró
 * las direcciones, no los parámetros.
 */
export const RUTAS = {
  /** La pantalla de ingreso. */
  ingreso: '/auth',
  /** La rejilla de tipos de cuenta. */
  registro: '/auth/register',
  /** El alta pública de pacientes, que es una pantalla propia desde la rejilla. */
  registroPaciente: '/auth/register/patient',
  /** El destino del login. */
  panel: '/dashboard',
  /** El portal de turnos del paciente: los suyos y los horarios pedibles. */
  misTurnos: '/my-account/appointments',
  /** Donde el titular sube su evidencia de identidad. */
  verificarIdentidad: '/my-account/identity/verify',
  /** «Mis verificaciones»: los casos del titular. */
  misCasos: '/my-account/identity/cases',
  /** La agenda de la organización, con su ventana por defecto (semana). */
  agenda: '/schedule',
  /**
   * La agenda acotada a hoy. `rango` es la clave que la pantalla lee de la
   * URL; `hoy` es una de sus ventanas declaradas.
   */
  agendaDeHoy: '/schedule?rango=hoy',
  /** El archivo clínico: la pantalla que elige a quién se mira. */
  archivoClinico: '/medical-records',
} as const;

/** El detalle de un caso de verificación, visto por su titular. */
export function rutaDeCaso(caseId: string): string {
  return `${RUTAS.misCasos}/${caseId}`;
}

/** El expediente de una persona concreta. */
export function rutaDeExpediente(profileId: string): string {
  return `${RUTAS.archivoClinico}/${profileId}`;
}

/** La reserva de un horario entrando por el portal del paciente. */
export function rutaDeReservaDelPortal(slotId: string): string {
  return `${RUTAS.misTurnos}/book/${slotId}`;
}
