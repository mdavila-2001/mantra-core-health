/* ============================================================================
    «Ir a la cita» dentro de un mensaje del chat.

    Los avisos de agenda que la API deja en el chat (la confirmación del
    profesional, los de «AloVida · Soporte», la demora) terminan con una línea
    «👉 Ver la cita: https://…?turno=<id>». El hilo no la muestra como URL
    cruda: la quita del texto y en su lugar pinta un botón.

    A dónde lleva el botón depende de quién lo mira, no del enlace:

    - el **paciente** va a «Mis citas» (`/my-account/appointments?turno=<id>`);
    - el **profesional** va a su agenda, en la solapa de citas
      (`/schedule?vista=citas&turno=<id>`).

    Quién es quién se lee del propio enlace y de quién mandó el mensaje, no del
    rol de la cuenta: un médico también puede ser paciente de otro médico, y la
    confirmación de *su* turno tiene que llevarlo a «Mis citas».

    - El enlace del aviso apunta a `/schedule` → lo recibe el profesional.
    - La confirmación del hilo directo la firma el profesional: si el mensaje es
      **propio**, quien lo mira es quien atiende.
    ========================================================================== */

/** Un mensaje que apunta a una cita. */
export interface CitaDelMensaje {
  /** El texto sin la línea del enlace. */
  readonly texto: string;
  /** La ruta del router, sin parámetros. */
  readonly ruta: string;
  /** Los parámetros de la ruta. */
  readonly parametros: Readonly<Record<string, string>>;
}

/**
 * La línea que deja la API: «👉 Ver la cita: <url>» —o la URL sola—, con una
 * ruta de la app y `turno=<id>`. Se exige `turno=` para no convertir en botón
 * cualquier enlace a la agenda que alguien pegue en el chat.
 */
const LINEA_DE_CITA =
  /(?:^|\n)[^\S\n]*(?:👉[^\S\n]*)?(?:Ver la cita:[^\S\n]*)?https?:\/\/[^\s/]+(\/my-account\/appointments|\/schedule)\?[^\s]*?\bturno=([A-Za-z0-9-]+)[^\s]*[^\S\n]*(?=\n|$)/u;

/** Ruta del paciente. */
const MIS_CITAS = '/my-account/appointments';

/** Ruta del profesional. */
const AGENDA = '/schedule';

/**
 * Reconoce el enlace a una cita en el texto de un mensaje.
 *
 * @param texto - El cuerpo del mensaje.
 * @param propio - Si el mensaje lo mandó quien lo está mirando.
 * @returns La cita y el texto sin el enlace, o `null` si el mensaje no apunta
 *   a ninguna.
 */
export function citaDelMensaje(
  texto: string | undefined | null,
  propio: boolean,
): CitaDelMensaje | null {
  if (!texto) return null;
  const encontrada = LINEA_DE_CITA.exec(texto);
  if (encontrada === null) return null;

  const [linea, camino, turno] = encontrada;
  if (camino === undefined || turno === undefined) return null;
  const limpio = (texto.slice(0, encontrada.index) + texto.slice(encontrada.index + linea.length))
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

  const esDelProfesional = camino === AGENDA || propio;
  return esDelProfesional
    ? { texto: limpio, ruta: AGENDA, parametros: { vista: 'citas', turno } }
    : { texto: limpio, ruta: MIS_CITAS, parametros: { turno } };
}
