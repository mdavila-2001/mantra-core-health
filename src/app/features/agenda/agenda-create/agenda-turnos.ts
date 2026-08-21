/* ============================================================================
    Cuántos turnos salen de una franja — la aritmética de la vista previa.

    TypeScript puro, sin Angular: los cupos son una división, no una decisión, y
    poder probarla sola es lo que permite afirmar que la pantalla muestra lo
    mismo que el backend va a generar.
    ========================================================================== */

/** Una franja tal como la carga el médico. */
export interface Franja {
  /** El día, ya en palabras: la aritmética no necesita saber su número. */
  readonly dia: string;
  /** Hora de inicio, `HH:MM`. */
  readonly desde: string;
  /** Hora de fin, `HH:MM`. */
  readonly hasta: string;
  /** Duración de cada turno, en minutos. */
  readonly duracion: number;
}

/** Un turno concreto, en hora de pared. */
export interface Turno {
  readonly desde: string;
  readonly hasta: string;
}

/** Lo que sale de un día. */
export interface DiaCalculado {
  readonly dia: string;
  readonly turnos: readonly Turno[];
  /** Minutos que sobran al final y no alcanzan para otro turno. */
  readonly resto: number;
  /** Desde qué hora queda libre ese resto, o `null` si no sobra nada. */
  readonly restoDesde: string | null;
}

/** El cálculo completo. */
export interface Calculo {
  readonly porDia: readonly DiaCalculado[];
  readonly total: number;
}

/**
 * Divide cada franja en turnos.
 *
 * ## Trunca, porque el backend trunca
 *
 * Verificado contra la API viva el 20/08: una franja de 9:00 a 16:00 con turnos
 * de 90 minutos genera **cuatro** cupos —el último de 13:30 a 15:00— y deja
 * libre de 15:00 a 16:00. No cinco: el que terminaría 16:30 no se emite.
 *
 * Esta función tiene que imitar eso **exactamente**. Si redondeara para arriba,
 * la vista previa prometería un turno que después no existe, y una vista previa
 * que miente es peor que no tener ninguna.
 *
 * @param franjas - Las franjas activas.
 * @returns Los turnos por día y el total.
 */
export function calcularTurnos(franjas: readonly Franja[]): Calculo {
  const porDia = franjas.map((franja) => calcularDia(franja));
  return {
    porDia,
    total: porDia.reduce((suma, dia) => suma + dia.turnos.length, 0),
  };
}

function calcularDia(franja: Franja): DiaCalculado {
  const inicio = enMinutos(franja.desde);
  const fin = enMinutos(franja.hasta);

  // Una franja al revés, vacía o con duración absurda no produce turnos. Es un
  // estado alcanzable mientras se escribe la hora, así que se devuelve vacío en
  // vez de reventar: el formulario ya lo señala como inválido por su cuenta.
  if (inicio === null || fin === null || fin <= inicio || franja.duracion <= 0) {
    return { dia: franja.dia, turnos: [], resto: 0, restoDesde: null };
  }

  const disponibles = fin - inicio;
  const cuantos = Math.floor(disponibles / franja.duracion);
  const turnos: Turno[] = [];
  for (let i = 0; i < cuantos; i++) {
    const desde = inicio + i * franja.duracion;
    turnos.push({ desde: enTexto(desde), hasta: enTexto(desde + franja.duracion) });
  }

  const resto = disponibles % franja.duracion;
  return {
    dia: franja.dia,
    turnos,
    resto,
    restoDesde: resto === 0 ? null : enTexto(inicio + cuantos * franja.duracion),
  };
}

/** `09:30` → 570. `null` si no es una hora. */
function enMinutos(hora: string): number | null {
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (partes === null) return null;
  const h = Number(partes[1]);
  const m = Number(partes[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 570 → `09:30`. */
function enTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
