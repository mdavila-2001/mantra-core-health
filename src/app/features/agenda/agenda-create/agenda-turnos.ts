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
  /**
   * El respiro entre consultas, en minutos (AG-4).
   *
   * Es un atributo DE LA FRANJA, no una configuración global: el mismo doctor
   * puede querer el lunes «consultas de 45 sin respiro» y el miércoles «de 20
   * con 10 de margen». Opcional y con 0 como ausencia: receso 0 ≡ hoy, y
   * ninguna pantalla que no lo pida nota nada.
   */
  readonly receso?: number;
}

/** Un turno concreto, en hora de pared. */
export interface Turno {
  readonly desde: string;
  readonly hasta: string;
  /**
   * Cuánto dura, en minutos.
   *
   * Es el mismo número que la franja declara, y viaja con el turno porque la
   * vista previa lo dice en palabras («8 turnos de 30 min»): sacarlo del
   * formulario obligaría a cruzar el índice del día con el control, que es
   * justo el cruce que ya se equivocó una vez.
   */
  readonly minutos: number;
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
 * ## El receso entra en la misma aritmética (AG-4)
 *
 * Con respiro, el paso entre turnos es `duración + receso`: franja 9:00–12:00,
 * consulta 20, receso 10 → turnos 9:00, 9:30, 10:00… Seis de 20 minutos con
 * huecos de 10. Cada turno sigue midiendo su duración real —el paciente
 * reserva 20 minutos—; el receso es aire del doctor, no un cupo ni un bloqueo.
 * El último turno no necesita respiro después: entra si su CONSULTA entra.
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

  // Un receso negativo es un estado alcanzable mientras se tipea; se trata
  // como 0 en vez de reventar, igual que el resto de los estados a medias.
  const receso = Math.max(0, franja.receso ?? 0);
  const paso = franja.duracion + receso;

  const turnos: Turno[] = [];
  // El último turno no necesita respiro después: entra si su CONSULTA entra.
  // Por eso el corte es sobre `desde + duración`, no sobre el paso completo.
  for (let desde = inicio; desde + franja.duracion <= fin; desde += paso) {
    turnos.push({
      desde: enTexto(desde),
      hasta: enTexto(desde + franja.duracion),
      minutos: franja.duracion,
    });
  }

  if (turnos.length === 0) {
    return { dia: franja.dia, turnos: [], resto: fin - inicio, restoDesde: enTexto(inicio) };
  }

  // El resto se mide desde el FIN del último turno: el aire de los recesos ya
  // está contado adentro del paso, y lo que sobra al final es lo único que el
  // médico podría querer reacomodar.
  const finUltimo = enMinutos(turnos[turnos.length - 1].hasta) ?? fin;
  const resto = fin - finUltimo;
  return {
    dia: franja.dia,
    turnos,
    resto,
    restoDesde: resto === 0 ? null : enTexto(finUltimo),
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
