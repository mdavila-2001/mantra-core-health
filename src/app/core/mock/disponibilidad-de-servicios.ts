/**
 * El motor de horarios de los servicios con duración dinámica, **en la maqueta**.
 *
 * Es el espejo del `service-availability.ts` de la API (v4.2.40) y existe por la
 * misma razón que el resto del simulador: la rama `mockup` no tiene backend, y una
 * pantalla que reserva servicios tiene que poder recorrerse entera contra algo que
 * responda como la API. Si el motor de la API cambia, **éste cambia con él**: una
 * maqueta que ofrece un horario que la API rechaza es peor que no tener maqueta.
 *
 * Todo trabaja en milisegundos desde la época: la maqueta no necesita más, y evita
 * mezclar `Date` mutables con intervalos que sólo se comparan.
 *
 * ## Qué ocupa un turno de servicio
 *
 * `[inicio − preparación, inicio + duración máxima + limpieza]`. Se reserva el
 * **máximo** para que dos pacientes nunca se pisen; si la atención termina antes, el
 * sobrante se libera al completarla.
 */

/** Un rato de tiempo. */
export interface Tramo {
  readonly desde: number;
  readonly hasta: number;
}

/** Lo que hace falta saber de una oferta para encontrarle lugar. */
export interface DuracionDeServicio {
  readonly min: number;
  readonly max: number;
  readonly preparacion: number;
  readonly limpieza: number;
}

/** Un inicio posible, con lo que el turno reserva. */
export interface InicioPosible {
  readonly inicio: number;
  /** `inicio + máximo`: lo que se reserva. */
  readonly finMaximo: number;
  /** `inicio + mínimo`: cuándo podría terminar como pronto. */
  readonly finMinimo: number;
}

const MS_POR_MINUTO = 60_000;

/** Cada cuántos minutos se ofrece un inicio dentro de un hueco. */
export const PASO_DE_INICIOS_MINUTOS = 15;

/** Tope de horarios que se devuelven por consulta. */
export const MAX_HORARIOS = 200;

/** Une los tramos que se tocan o se pisan; descarta los de largo cero. */
export function unir(tramos: readonly Tramo[]): Tramo[] {
  const ordenados = tramos.filter((t) => t.hasta > t.desde).sort((a, b) => a.desde - b.desde);
  const unidos: Tramo[] = [];
  for (const actual of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo !== undefined && actual.desde <= ultimo.hasta) {
      if (actual.hasta > ultimo.hasta) unidos[unidos.length - 1] = { desde: ultimo.desde, hasta: actual.hasta };
      continue;
    }
    unidos.push(actual);
  }
  return unidos;
}

/** Lo que queda de las franjas al quitarles lo ocupado. */
export function restar(franjas: readonly Tramo[], ocupado: readonly Tramo[]): Tramo[] {
  const bloqueos = unir(ocupado);
  const libres: Tramo[] = [];
  for (const franja of unir(franjas)) {
    let cursor = franja.desde;
    for (const bloqueo of bloqueos) {
      if (bloqueo.hasta <= cursor) continue;
      if (bloqueo.desde >= franja.hasta) break;
      if (bloqueo.desde > cursor) libres.push({ desde: cursor, hasta: bloqueo.desde });
      cursor = Math.max(cursor, bloqueo.hasta);
      if (cursor >= franja.hasta) break;
    }
    if (cursor < franja.hasta) libres.push({ desde: cursor, hasta: franja.hasta });
  }
  return libres;
}

/** El tramo que un turno acordado ocupa, con sus colchones. */
export function tramoOcupado(inicio: number, finMaximo: number, d: Pick<DuracionDeServicio, 'preparacion' | 'limpieza'>): Tramo {
  return { desde: inicio - d.preparacion * MS_POR_MINUTO, hasta: finMaximo + d.limpieza * MS_POR_MINUTO };
}

/**
 * Los inicios donde cabe el servicio.
 *
 * En cada hueco el primer inicio es **justo después del compromiso anterior** (más
 * la preparación) y de ahí se avanza cada `paso`: anclar al hueco y no al reloj evita
 * los huecos muertos.
 */
export function proponerInicios(entrada: {
  readonly franjas: readonly Tramo[];
  readonly ocupado: readonly Tramo[];
  readonly duracion: DuracionDeServicio;
  readonly noAntesDe: number;
  readonly noDespuesDe: number;
  readonly pasoMinutos?: number;
  readonly limite?: number;
}): InicioPosible[] {
  const d = entrada.duracion;
  const paso = (entrada.pasoMinutos ?? PASO_DE_INICIOS_MINUTOS) * MS_POR_MINUTO;
  const limite = entrada.limite ?? MAX_HORARIOS;
  const ocupa = (d.preparacion + d.max + d.limpieza) * MS_POR_MINUTO;
  const inicios: InicioPosible[] = [];
  for (const hueco of restar(entrada.franjas, entrada.ocupado)) {
    for (let desde = hueco.desde; desde + ocupa <= hueco.hasta; desde += paso) {
      const inicio = desde + d.preparacion * MS_POR_MINUTO;
      if (inicio < entrada.noAntesDe) continue;
      if (inicio > entrada.noDespuesDe) break;
      inicios.push({
        inicio,
        finMaximo: inicio + d.max * MS_POR_MINUTO,
        finMinimo: inicio + d.min * MS_POR_MINUTO,
      });
      if (inicios.length >= limite) return inicios;
    }
  }
  return inicios;
}

/** Si el turno cabe en ese inicio, ahora mismo. Es lo que repite el servidor al retener. */
export function cabe(franjas: readonly Tramo[], ocupado: readonly Tramo[], d: DuracionDeServicio, inicio: number): boolean {
  const desde = inicio - d.preparacion * MS_POR_MINUTO;
  const hasta = inicio + (d.max + d.limpieza) * MS_POR_MINUTO;
  return restar(franjas, ocupado).some((libre) => libre.desde <= desde && libre.hasta >= hasta);
}

/** Los ids de los cupos retraídos que ya no chocan con nada. */
export function sePuedenReabrir(retraidos: readonly (Tramo & { readonly id: string })[], ocupado: readonly Tramo[]): string[] {
  const bloqueos = unir(ocupado);
  return retraidos.filter((c) => !bloqueos.some((b) => b.desde < c.hasta && b.hasta > c.desde)).map((c) => c.id);
}
