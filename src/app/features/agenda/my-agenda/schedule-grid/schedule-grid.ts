import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

import type { PublishedRule } from '../../../../core/data-access/scheduling/scheduling.types';
import type { BloqueoDelMes } from '../month-view/month-view';
import { lunesDe } from '../week-view/week-view';

/** Una columna de la grilla: un día de la semana en curso. */
export interface DiaDelHorario {
  /** Como lo numera la API: 0 = domingo. */
  readonly numero: number;
  readonly corto: string;
  readonly largo: string;
  /** La fecha que le toca en la semana que se mira. */
  readonly fecha: Date;
  readonly esHoy: boolean;
}

/** Una franja de atención, ya medida para dibujarse dentro de su columna. */
export interface BloqueDelHorario {
  readonly id: string;
  readonly dia: number;
  readonly desde: string;
  readonly hasta: string;
  /** Porcentaje del alto de la grilla desde arriba. */
  readonly top: number;
  /** Porcentaje del alto de la grilla que ocupa. */
  readonly alto: number;
  readonly etiqueta: string;
  /** «consultas de 30 min», o «tamaño libre» cuando la franja es dinámica. */
  readonly detalle: string;
  /** Lo que se cuenta al pasar el mouse: rótulo y valor, en orden. */
  readonly datos: readonly { readonly rotulo: string; readonly valor: string }[];
}

/** Un bloqueo de agenda recortado al día en que se dibuja. */
export interface BloqueoDelHorario {
  readonly id: string;
  readonly dia: number;
  readonly desde: string;
  readonly hasta: string;
  readonly top: number;
  readonly alto: number;
  readonly motivo: string | null;
  readonly etiqueta: string;
}

/** El bloque bajo el puntero y dónde dibujar su globo. */
interface Globo {
  readonly bloque: BloqueDelHorario;
  readonly dia: DiaDelHorario;
  readonly left: number;
  readonly top: number;
}

/** Los días como los nombra la API: 0 = domingo. Se muestran de lunes a domingo. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0] as const;
const CORTO: Readonly<Record<number, string>> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};
const LARGO: Readonly<Record<number, string>> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
};
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Ancho con el que se dibuja el globo, para decidir de qué lado cabe. */
const ANCHO_GLOBO = 280;
const SEPARACION_GLOBO = 8;

/**
 * **El horario, por horas** — punto 1 del carril 10.
 *
 * *«Nos muestra una vista de los días de la semana por horas, resaltado con
 * otro color los que corresponden atención.»*
 *
 * ## Por qué una grilla y no la lista que había
 *
 * Antes esto eran fichas de día y una lista de franjas en texto: «lunes de 9 a
 * 13, miércoles de 14 a 18». Se lee, pero **no se compara**. Con una grilla se
 * ve de un golpe que los miércoles empezás cuatro horas más tarde, y eso es lo
 * que uno mira cuando decide si cambiar el horario.
 *
 * ## Como un calendario, no como una planilla
 *
 * La primera versión era una tabla de celdas teñidas: cada hora un cuadradito.
 * Se pidió que se viera como Google Calendar, y la diferencia no es cosmética:
 * en un calendario la franja es UN bloque continuo, con su hora de inicio y
 * de fin escritas adentro, y su alto es proporcional a lo que dura. «De 8:30
 * a 12:30» se dibuja arrancando a mitad de la fila de las 8, no pintando la
 * fila entera. Las líneas de hora quedan detrás, finas, como guía.
 *
 * ## La semana en curso, con sus fechas
 *
 * El horario es un patrón semanal, pero se mira desde un día concreto: la
 * cabecera lleva las fechas de esta semana y el día de hoy marcado, para que
 * «atendés los martes de 9 a 13» se lea como «mañana a las 9». Se muestran
 * de lunes al último día que se atiende, con viernes como mínimo — un fin de
 * semana vacío no dice nada que la ausencia no diga.
 *
 * ## El detalle, al pasar el mouse
 *
 * El bloque escribe lo justo para reconocerlo: sus horas. Lo demás —cuántos
 * turnos entran, de cuánto, con qué respiro, cuántos pacientes por turno, la
 * vigencia— aparece en un globo al pasar el puntero o al enfocarlo con el
 * teclado. Escribirlo todo adentro del bloque lo volvería ilegible en una
 * franja de una hora.
 *
 * ## Las 24 horas, abierta donde atendés
 *
 * La grilla dibuja el día entero, como un calendario, y no sólo el rango que
 * se atiende: un bloqueo a las 19:00 o una consulta fuera de hora también
 * tienen que tener dónde verse. Para no obligar a buscar lo que importa, la
 * caja scrollea por dentro con la cabecera fija y abre en la primera hora
 * atendida.
 *
 * ## Los bloqueos, en rojo
 *
 * En la semana en curso se pintan los bloqueos de agenda por encima de las
 * franjas, en el rojo que ya usa el mes. Un horario retirado (sin fechas) no
 * los lleva: no es de ninguna semana.
 *
 * ## El color no va solo
 *
 * Cada bloque escribe sus horas y lleva su `aria-label` con el día en
 * palabras. El pedido dice «resaltado con otro color», y el color es la
 * mitad: quien no lo distingue tiene que poder leer lo mismo.
 */
@Component({
  selector: 'app-schedule-grid',
  imports: [],
  templateUrl: './schedule-grid.html',
  styleUrl: './schedule-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarGlobo()',
  },
})
export class ScheduleGrid {
  readonly reglas = input.required<readonly PublishedRule[]>();

  /**
   * Cualquier día de la semana que se mira; el lunes se calcula acá. Por
   * defecto, hoy: el pedido es ver «mis horarios de esta semana vigente».
   */
  readonly semana = input<Date>(new Date());

  /**
   * Si la cabecera lleva las fechas de la semana. Un horario retirado que se
   * mira en el diálogo de «así era» no es de esta semana ni de ninguna: ahí
   * sólo van los nombres de los días.
   */
  readonly conFechas = input<boolean>(true);

  /** Cómo se llama el horario, para el globo. Opcional. */
  readonly nombre = input<string | null>(null);

  /** Hasta cuándo rige, ya en palabras («Rige hasta el 30 de junio»). Opcional. */
  readonly vigencia = input<string | null>(null);

  /**
   * El tamaño de turno de la plantilla, para las franjas que no declaran el
   * suyo. Sin ninguno de los dos la franja es dinámica: «tamaño libre».
   */
  readonly slotMinutes = input<number | null>(null);

  /** Los bloqueos de agenda; sólo se dibujan en la semana con fechas. */
  readonly bloqueos = input<readonly BloqueoDelMes[]>([]);

  private readonly caja = viewChild<ElementRef<HTMLElement>>('caja');

  constructor() {
    // Abre en la primera hora atendida. Corre cuando cambian las reglas, no en
    // cada dibujo: si el médico scrollea, no se le devuelve la caja a su lugar.
    afterRenderEffect(() => {
      const caja = this.caja()?.nativeElement;
      const reglas = this.reglas();
      if (!caja || reglas.length === 0) return;
      const primera = Math.min(...reglas.map((r) => hora(r.startTime)));
      const fila = caja.querySelectorAll<HTMLElement>('.grilla__hora')[primera];
      const cabecera = caja.querySelector<HTMLElement>('.grilla__esquina');
      if (!fila || !cabecera) return;
      caja.scrollTop = Math.max(0, fila.offsetTop - cabecera.offsetHeight - 12);
    });
  }

  /** El lunes de la semana mirada. */
  protected readonly lunes = computed(() => lunesDe(this.semana()));

  /** Los días que se dibujan: de lunes al último atendido, viernes como mínimo. */
  protected readonly dias = computed<readonly DiaDelHorario[]>(() => {
    const conAtencion = new Set(this.reglas().map((r) => r.dayOfWeek));
    let ultimo = 4; // viernes, en posiciones de ORDEN
    ORDEN.forEach((d, i) => {
      if (conAtencion.has(d)) ultimo = Math.max(ultimo, i);
    });
    const lunes = this.lunes();
    const hoy = medianoche(this.semana());
    return ORDEN.slice(0, ultimo + 1).map((numero, i) => {
      const fecha = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
      return {
        numero,
        corto: CORTO[numero],
        largo: LARGO[numero],
        fecha,
        esHoy: this.conFechas() && fecha.getTime() === hoy.getTime(),
      };
    });
  });

  /** Las horas que se dibujan: el día entero, de 00 a 23. */
  protected readonly horas = computed(() =>
    this.reglas().length === 0 ? ([] as number[]) : Array.from({ length: 24 }, (_, i) => i),
  );

  /** «Semana del 7 al 13 de septiembre», para la cabecera. */
  protected readonly rotuloDeSemana = computed(() => {
    const dias = this.dias();
    const desde = dias[0].fecha;
    const hasta = dias[dias.length - 1].fecha;
    const mismoMes = desde.getMonth() === hasta.getMonth();
    return mismoMes
      ? `Semana del ${desde.getDate()} al ${hasta.getDate()} de ${MESES[hasta.getMonth()]}`
      : `Semana del ${desde.getDate()} de ${MESES[desde.getMonth()]} al ${hasta.getDate()} de ${MESES[hasta.getMonth()]}`;
  });

  /** Las franjas, medidas contra el rango de horas visible. */
  protected readonly bloques = computed<readonly BloqueDelHorario[]>(() => {
    const horas = this.horas();
    if (horas.length === 0) return [];
    const arranque = horas[0] * 60;
    const total = horas.length * 60;
    return this.reglas()
      .map((r) => {
        const inicio = minutos(r.startTime);
        const fin = minutos(r.endTime);
        const tamano = r.slotMinutes ?? this.slotMinutes();
        return {
          id: `${r.dayOfWeek}-${r.startTime}`,
          dia: r.dayOfWeek,
          desde: hhmm(r.startTime),
          hasta: hhmm(r.endTime),
          top: ((inicio - arranque) / total) * 100,
          alto: ((fin - inicio) / total) * 100,
          etiqueta: `${LARGO[r.dayOfWeek]} de ${hhmm(r.startTime)} a ${hhmm(r.endTime)}: atendés`,
          detalle: tamano ? `consultas de ${tamano} min` : 'tamaño libre',
          datos: datosDe(r, fin - inicio, tamano),
        };
      })
      .sort((a, b) => a.top - b.top);
  });

  /**
   * Los bloqueos que pisan la semana visible, partidos por día y medidos
   * contra las 24 horas. Uno de varios días se dibuja entero en los del medio.
   */
  protected readonly bloqueosPintados = computed<readonly BloqueoDelHorario[]>(() => {
    if (!this.conFechas() || this.reglas().length === 0) return [];
    const pintados: BloqueoDelHorario[] = [];
    for (const dia of this.dias()) {
      const inicioDia = dia.fecha.getTime();
      const finDia = new Date(
        dia.fecha.getFullYear(),
        dia.fecha.getMonth(),
        dia.fecha.getDate() + 1,
      ).getTime();
      this.bloqueos().forEach((b, i) => {
        const desde = Math.max(b.desde.getTime(), inicioDia);
        const hasta = Math.min(b.hasta.getTime(), finDia);
        if (hasta <= desde) return;
        const minDesde = (desde - inicioDia) / 60_000;
        const minHasta = (hasta - inicioDia) / 60_000;
        const textoDesde = reloj(minDesde);
        const textoHasta = reloj(minHasta);
        pintados.push({
          id: `${b.id ?? i}-${dia.numero}`,
          dia: dia.numero,
          desde: textoDesde,
          hasta: textoHasta,
          top: (minDesde / MINUTOS_DEL_DIA) * 100,
          alto: ((minHasta - minDesde) / MINUTOS_DEL_DIA) * 100,
          motivo: b.motivo,
          etiqueta:
            `${LARGO[dia.numero]} de ${textoDesde} a ${textoHasta}: bloqueado` +
            (b.motivo ? ` (${b.motivo})` : ''),
        });
      });
    }
    return pintados;
  });

  /**
   * Dónde va la línea de «ahora», en porcentaje del alto — o `null` si hoy no
   * está en la grilla o la hora actual queda fuera del rango visible. Se
   * calcula una vez al dibujar: no vale la pena un reloj para una línea que
   * se mira de reojo.
   */
  protected readonly ahora = computed(() => {
    if (!this.dias().some((d) => d.esHoy)) return null;
    const horas = this.horas();
    if (horas.length === 0) return null;
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const arranque = horas[0] * 60;
    const total = horas.length * 60;
    if (min < arranque || min > arranque + total) return null;
    return ((min - arranque) / total) * 100;
  });

  /** El globo abierto, si hay uno. */
  protected readonly globo = signal<Globo | null>(null);

  /** Los bloques de un día, para pintarlos dentro de su columna. */
  protected bloquesDe(dia: number): readonly BloqueDelHorario[] {
    return this.bloques().filter((b) => b.dia === dia);
  }

  /** Los bloqueos de un día, para pintarlos en rojo dentro de su columna. */
  protected bloqueosDe(dia: number): readonly BloqueoDelHorario[] {
    return this.bloqueosPintados().filter((b) => b.dia === dia);
  }

  /** Si en ese día y esa hora se atiende, aunque sea una parte de la hora. */
  protected atiende(dia: number, h: number): boolean {
    return this.reglas().some((r) => {
      if (r.dayOfWeek !== dia) return false;
      const inicio = minutos(r.startTime);
      const fin = minutos(r.endTime);
      // La hora `h` va de h:00 a h:59. Se pinta si la franja pisa ese rato.
      return inicio < (h + 1) * 60 && fin > h * 60;
    });
  }

  protected rotulo(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  /**
   * Abre el globo del bloque bajo el puntero (o con foco).
   *
   * Va en `position: fixed` desde el rectángulo del bloque, como el tooltip
   * del sistema: la grilla scrollea de costado dentro de su caja, y un globo
   * absoluto adentro quedaría recortado por ese `overflow`. Se pone a la
   * derecha del bloque; si no entra en la ventana, a la izquierda.
   */
  protected abrirGlobo(evento: Event, bloque: BloqueDelHorario, dia: DiaDelHorario): void {
    const objetivo = evento.currentTarget as HTMLElement | null;
    if (!objetivo || typeof objetivo.getBoundingClientRect !== 'function') return;
    const caja = objetivo.getBoundingClientRect();
    const anchoVentana = typeof window === 'undefined' ? Infinity : window.innerWidth;
    const cabeDerecha = caja.right + SEPARACION_GLOBO + ANCHO_GLOBO <= anchoVentana;
    const left = cabeDerecha
      ? caja.right + SEPARACION_GLOBO
      : Math.max(SEPARACION_GLOBO, caja.left - SEPARACION_GLOBO - ANCHO_GLOBO);
    this.globo.set({ bloque, dia, left, top: caja.top });
  }

  protected cerrarGlobo(): void {
    this.globo.set(null);
  }

  /** «Martes 8 de septiembre», el título del globo en la semana en curso. */
  protected tituloDelGlobo(g: Globo): string {
    const nombre = g.dia.largo.charAt(0).toUpperCase() + g.dia.largo.slice(1);
    if (!this.conFechas()) return `${nombre}s`;
    return `${nombre} ${g.dia.fecha.getDate()} de ${MESES[g.dia.fecha.getMonth()]}`;
  }
}

/** Lo que el globo cuenta de una franja, en el orden en que se lee. */
function datosDe(
  r: PublishedRule,
  duracion: number,
  tamano: number | null,
): readonly { readonly rotulo: string; readonly valor: string }[] {
  const datos: { rotulo: string; valor: string }[] = [
    { rotulo: 'Horario', valor: `${hhmm(r.startTime)} – ${hhmm(r.endTime)}` },
    { rotulo: 'Duración', valor: enPalabras(duracion) },
  ];
  if (tamano) {
    const respiro = r.gapMinutes ?? 0;
    const turnos = Math.floor((duracion + respiro) / (tamano + respiro));
    datos.push({ rotulo: 'Cada consulta', valor: `${tamano} min` });
    if (respiro > 0) datos.push({ rotulo: 'Respiro entre consultas', valor: `${respiro} min` });
    datos.push({ rotulo: 'Turnos en la franja', valor: String(turnos) });
  } else {
    datos.push({ rotulo: 'Cada consulta', valor: 'Tamaño libre' });
  }
  if (r.capacityPerSlot && r.capacityPerSlot > 1) {
    datos.push({ rotulo: 'Pacientes por turno', valor: String(r.capacityPerSlot) });
  }
  return datos;
}

/** «4 h», «1 h 30 min», «45 min». */
function enPalabras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const MINUTOS_DEL_DIA = 24 * 60;

/** La hora de un `HH:MM:SS`. */
function hora(texto: string): number {
  return Math.floor(minutos(texto) / 60);
}

/** `HH:MM` de unos minutos desde medianoche; el fin del día se escribe 24:00. */
function reloj(min: number): string {
  const redondo = Math.round(min);
  return `${String(Math.floor(redondo / 60)).padStart(2, '0')}:${String(redondo % 60).padStart(2, '0')}`;
}

/** Los minutos desde medianoche de un `HH:MM` o `HH:MM:SS`. */
function minutos(texto: string): number {
  const [h, m] = texto.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

/** `HH:MM` de un `HH:MM:SS`. */
function hhmm(texto: string): string {
  const [h, m] = texto.split(':');
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

function medianoche(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}
