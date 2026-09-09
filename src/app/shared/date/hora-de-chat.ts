/**
 * La hora de una fila de la bandeja, como la escribe un chat.
 *
 * Hoy → `8:00 p.m.` · ayer → `Ayer` · esta semana → `lunes` · antes →
 * `07/09/2026`.
 *
 * No es lo mismo que `tiempoRelativo`, que dice «hace 2 min» y sirve para un
 * aviso suelto. En una bandeja de veinte filas «hace 2 min», «hace 3 h», «hace
 * 5 d» obliga a hacer la cuenta en cada una para ordenarlas mentalmente; la
 * hora del reloj se lee de un vistazo y es lo que la gente ya sabe leer de
 * cualquier chat que usa. Por eso conviven las dos.
 *
 * Función plana y no un `@Pipe`, como el resto de `shared/date`.
 *
 * @param fecha - Cuándo fue el último mensaje.
 * @param ahora - Con qué momento comparar. Parámetro para poder fijarlo en los
 *   tests sin tocar el reloj del sistema.
 */
export function horaDeChat(fecha: Date, ahora = new Date()): string {
  const dia = new Date(fecha);
  if (Number.isNaN(dia.getTime())) {
    return '';
  }

  if (mismoDia(dia, ahora)) {
    return horaDelReloj(dia);
  }

  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(dia, ayer)) {
    return 'Ayer';
  }

  // Dentro de la semana, el día de la semana: «lunes» ubica mejor que
  // «02/09» cuando todavía está fresco.
  const haceUnaSemana = new Date(ahora);
  haceUnaSemana.setDate(ahora.getDate() - 6);
  if (dia.getTime() >= haceUnaSemana.setHours(0, 0, 0, 0)) {
    return dia.toLocaleDateString('es', { weekday: 'long' });
  }

  return dia.toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * La hora del reloj a secas, como va en la burbuja y en la fila de hoy:
 * `9:12`, `16:05`.
 *
 * Una sola función para las dos porque antes la fila decía `9:12` y la
 * burbuja `09:12`: el mismo mensaje con dos horas distintas según dónde se
 * mirara, y el cero de adelante es justo lo que ningún chat escribe.
 */
export function horaDelReloj(fecha: Date | string | undefined): string {
  if (fecha === undefined) {
    return '';
  }
  const dia = new Date(fecha);
  if (Number.isNaN(dia.getTime())) {
    return '';
  }
  return dia
    .toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();
}

/**
 * El rótulo del separador de día dentro del hilo: «Hoy», «Ayer» o la fecha
 * larga.
 *
 * «Hoy» y «Ayer» no son adorno: son las dos fechas que alguien mira en un
 * chat, y leer «24/08/2026» para decir «hoy» obliga a comparar con el
 * calendario.
 */
export function etiquetaDeDia(fecha: Date | undefined, ahora = new Date()): string {
  if (!fecha) {
    return '';
  }
  const dia = new Date(fecha);
  if (Number.isNaN(dia.getTime())) {
    return '';
  }

  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);

  if (mismoDia(dia, ahora)) {
    return 'Hoy';
  }
  if (mismoDia(dia, ayer)) {
    return 'Ayer';
  }
  return dia.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    ...(dia.getFullYear() === ahora.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
