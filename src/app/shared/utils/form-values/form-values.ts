/* ============================================================================
    El valor capturado de un formulario dinámico, en palabras.

    Lo comparten las dos pantallas que re-pintan respuestas: el bloque de
    especialidad dentro del encuentro (quien atiende) y el archivo del paciente
    (quien fue atendido). Si cada una convirtiera por su lado, el mismo valor
    persistido se leería distinto según quién lo mire.
    ========================================================================== */

/** Cómo se imprime una fecha con hora. Local, no ISO: lo lee gente. */
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Cómo se imprime una fecha sin hora. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/**
 * El valor de un campo, en palabras.
 *
 * Los valores llegan como los serializó JSON: fechas en ISO, `integer` como
 * string (la columna es bigint). Lo no representable cae a `String(...)` antes
 * que a un hueco.
 */
export function textoDeValor(valor: unknown, dataType: string | undefined): string {
  if (valor === undefined || valor === null) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (dataType === 'date' || dataType === 'datetime') {
    const fecha = new Date(String(valor));
    if (!Number.isNaN(fecha.getTime())) {
      return dataType === 'date' ? FORMATO_FECHA.format(fecha) : FORMATO_FECHA_HORA.format(fecha);
    }
  }
  return String(valor);
}
