/**
 * P34 · cómo se dice «abierta 24 h» y «de turno» en la pantalla, en un solo
 * lugar.
 *
 * ## La hora es la de Bolivia, siempre
 *
 * Bolivia tiene un único huso, UTC−4 todo el año (sin horario de verano):
 * `America/La_Paz`. La API manda instantes UTC; esta capa los escribe en esa
 * hora **sin mirar el huso del navegador**. Quien mira desde Buenos Aires o
 * Madrid la farmacia de turno de su madre en Cochabamba tiene que ver la hora
 * del cartel de la puerta, no la de su teléfono.
 *
 * ## Lo que esta capa no hace
 *
 * Decidir si una sede está abierta. Eso lo decide el servidor con su reloj
 * (`onCallUntil` sólo viaja si el turno está vigente; `open24h` sólo es `true`
 * si la sede lo declaró). Aquí sólo se pone en palabras.
 */

/** El huso de Bolivia. */
export const HUSO_DE_BOLIVIA = 'America/La_Paz';

/** El desplazamiento fijo de Bolivia, para escribir lo que se tipea en un `datetime-local`. */
export const DESPLAZAMIENTO_DE_BOLIVIA = '-04:00';

const HORA = new Intl.DateTimeFormat('es-BO', {
  timeZone: HUSO_DE_BOLIVIA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DIA = new Intl.DateTimeFormat('es-BO', {
  timeZone: HUSO_DE_BOLIVIA,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const FECHA_CLAVE = new Intl.DateTimeFormat('en-CA', {
  timeZone: HUSO_DE_BOLIVIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** «08:00» en la hora de Bolivia. */
export function horaDeBolivia(instante: string | Date): string {
  return HORA.format(new Date(instante));
}

/** «lun, 27 oct» en la hora de Bolivia. */
export function diaDeBolivia(instante: string | Date): string {
  return DIA.format(new Date(instante));
}

/** «lun, 27 oct · 08:00» en la hora de Bolivia. */
export function momentoDeBolivia(instante: string | Date): string {
  return `${diaDeBolivia(instante)} · ${horaDeBolivia(instante)}`;
}

/** Si dos instantes caen el mismo día del calendario boliviano. */
function mismoDiaEnBolivia(a: Date, b: Date): boolean {
  return FECHA_CLAVE.format(a) === FECHA_CLAVE.format(b);
}

/** Cómo se muestra la apertura de una sede: texto y tono de la insignia. */
export interface Apertura {
  readonly texto: string;
  readonly tono: 'success' | 'info';
}

/**
 * La insignia de apertura de una sede, o `null` si no declaró nada que mostrar.
 *
 * `open24h: false` y `null` no muestran nada: «no abre 24 h» no informa a
 * quien busca una farmacia abierta, y «no declarado» no se puede afirmar.
 *
 * @param sede - Lo que la API dijo de la sede.
 * @param ahora - Para decir «hasta las 08:00» u «hasta el mar, 28 oct · 08:00».
 */
export function aperturaDe(
  sede: { readonly open24h?: boolean | null; readonly onCallUntil?: string | null },
  ahora: Date = new Date(),
): Apertura | null {
  if (sede.open24h === true) {
    return { texto: 'Abierta 24 h', tono: 'success' };
  }
  if (sede.onCallUntil) {
    const fin = new Date(sede.onCallUntil);
    const hasta = mismoDiaEnBolivia(fin, ahora)
      ? `hasta las ${horaDeBolivia(fin)}`
      : `hasta el ${momentoDeBolivia(fin)}`;
    return { texto: `De turno ${hasta}`, tono: 'info' };
  }
  return null;
}

/**
 * Una fecha (`2026-10-26`) y una hora (`20:00`) tipeadas, leídas como hora de
 * Bolivia y escritas con su desplazamiento explícito, que es lo que la API
 * exige (`2026-10-26T20:00:00-04:00`).
 *
 * @returns El instante con desplazamiento, o `null` si falta o no es válida.
 */
export function deHoraLocalDeBolivia(fecha: string, hora: string): string | null {
  const dia = fecha.trim();
  const reloj = hora.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(reloj)) {
    return null;
  }
  const iso = `${dia}T${reloj}:00${DESPLAZAMIENTO_DE_BOLIVIA}`;
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) {
    return null;
  }
  // El motor acepta «31 de febrero» y lo corre al 3 de marzo: se rechaza lo que
  // no vuelve igual al escribirlo en la hora de Bolivia (UTC−4).
  const deVuelta = new Date(instante - 4 * 3_600_000).toISOString().slice(0, 16);
  return deVuelta === `${dia}T${reloj}` ? iso : null;
}
