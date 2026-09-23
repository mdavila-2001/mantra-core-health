/**
 * Parte las citas del paciente en «próximas» y «anteriores».
 *
 * El servidor las devuelve en orden ascendente por inicio. Mostrado tal cual,
 * el historial entero encabeza la lista y la cita que la persona vino a mirar
 * —la próxima— queda enterrada debajo de las ya atendidas (hallazgo H-04 del
 * refactor UX, `docs/refactor-profesional/trabajo/HALLAZGOS.md`).
 *
 * Reglas:
 * - **Próxima** es la que todavía no terminó: fin (o inicio, si no tiene fin)
 *   igual o posterior a `now`. Una consulta en curso sigue siendo próxima.
 * - Una cita **sin horario** —perdió su cupo— va con las próximas: todavía hay
 *   algo que resolver con ella, y al final del grupo para no desplazar a las
 *   que sí tienen hora.
 * - Próximas de la más cercana a la más lejana; anteriores de la más reciente a
 *   la más vieja. Empates: se respeta el orden de llegada (el sort es estable).
 *
 * Pura y sin reloj propio: `now` entra por parámetro para que las pruebas no
 * dependan de la hora en que corren.
 */
export interface TimedItem {
  readonly cuando: Date | null;
  readonly hasta: Date | null;
}

export interface UpcomingAndPast<T extends TimedItem> {
  readonly upcoming: readonly T[];
  readonly past: readonly T[];
}

export function splitUpcomingAndPast<T extends TimedItem>(
  items: readonly T[],
  now: Date,
): UpcomingAndPast<T> {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items) {
    if (isUpcoming(item, now)) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }
  upcoming.sort((a, b) => startOrInfinity(a) - startOrInfinity(b));
  past.sort((a, b) => startOrInfinity(b) - startOrInfinity(a));
  return { upcoming, past };
}

function isUpcoming(item: TimedItem, now: Date): boolean {
  const end = item.hasta ?? item.cuando;
  return end === null || end.getTime() >= now.getTime();
}

function startOrInfinity(item: TimedItem): number {
  return item.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
}
