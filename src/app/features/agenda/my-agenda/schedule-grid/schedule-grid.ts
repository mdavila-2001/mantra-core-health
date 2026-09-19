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

/**
 * Cuánto día se dibuja (AC-C3-01).
 *
 * `atencion` recorta la grilla a las horas que el horario publicado usa —lo
 * que se mira noventa y nueve veces de cada cien—; `completo` la abre de 00:00
 * a 23:59, que es lo que hace falta para ver una guardia de madrugada, un
 * bloqueo de día entero o un turno de mostrador fuera de hora.
 *
 * Es un rango y no un booleano `veinticuatroHoras` porque el nombre de lo que
 * se ve importa: quien elige está eligiendo «mi horario» o «el día», no
 * activando una opción.
 */
export type RangoDeGrilla = 'atencion' | 'completo';

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
 * «atendés los martes de 9 a 13» se lea como «mañana a las 9». Se muestra la
 * semana entera, de lunes a domingo (pedido del cliente: faltaban sábado y
 * domingo); un día sin nada asignado va en una columna angosta, al mínimo,
 * para que no le robe ancho a los que se atienden.
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
 * Quien prefiera la versión apretada la pide con `rango = 'atencion'`
 * (AC-C3-01): la grilla se recorta entonces a las horas del horario publicado.
 * Es una preferencia de lectura y no dos vistas distintas — las mismas franjas,
 * los mismos bloqueos, medidos contra menos horas.
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

  /**
   * Cuánto día se dibuja (AC-C3-01).
   *
   * Por omisión `completo`, que es el comportamiento que trae la maqueta y el
   * que responde la pregunta difícil: un bloqueo a las 22:00 no tiene dónde
   * verse en una grilla recortada a las horas de consulta. Quien quiera la
   * versión apretada la pide, y la caja abre igual en la primera hora
   * atendida, así que abrir el día no cuesta buscar nada.
   */
  readonly rango = input<RangoDeGrilla>('completo');

  private readonly caja = viewChild<ElementRef<HTMLElement>>('caja');

  constructor() {
    // Abre en la primera hora atendida. Corre cuando cambian las reglas o el
    // rango, no en cada dibujo: si el médico scrollea, no se le devuelve la
    // caja a su lugar.
    afterRenderEffect(() => {
      const caja = this.caja()?.nativeElement;
      const reglas = this.reglas();
      const horas = this.horas();
      if (!caja || reglas.length === 0 || horas.length === 0) return;
      const primera = Math.min(...reglas.map((r) => hora(r.startTime)));
      // Índice DENTRO de las horas dibujadas, no la hora absoluta: con el rango
      // recortado la grilla arranca en la primera atendida, así que la hora 8
      // es la fila 0 y buscar la fila 8 dejaría la caja ocho horas más abajo.
      const fila = caja.querySelectorAll<HTMLElement>('.grilla__hora')[primera - horas[0]];
      const cabecera = caja.querySelector<HTMLElement>('.grilla__esquina');
      if (!fila || !cabecera) return;
      caja.scrollTop = Math.max(0, fila.offsetTop - cabecera.offsetHeight - 12);
    });
  }

  /** El lunes de la semana mirada. */
  protected readonly lunes = computed(() => lunesDe(this.semana()));

  /** Los días que se dibujan: la semana entera, de lunes a domingo. */
  protected readonly dias = computed<readonly DiaDelHorario[]>(() => {
    const lunes = this.lunes();
    const hoy = medianoche(this.semana());
    return ORDEN.map((numero, i) => {
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

  /**
   * Las columnas de la cuadrícula: el carril de horas y un día cada una. Un
   * día sin nada asignado queda angosto, al mínimo; los que se atienden se
   * reparten el resto del ancho.
   */
  protected readonly columnas = computed(() => {
    const conAtencion = new Set(this.reglas().map((r) => r.dayOfWeek));
    const anchos = this.dias().map((d) =>
      conAtencion.has(d.numero) ? 'minmax(var(--ancho-dia), 1fr)' : 'var(--ancho-dia-vacio)',
    );
    return {
      plantilla: `var(--carril) ${anchos.join(' ')}`,
      conAtencion: anchos.filter((a) => a.startsWith('minmax')).length,
      vacios: anchos.filter((a) => !a.startsWith('minmax')).length,
    };
  });

  /** Si un día no tiene nada asignado: su columna va angosta. */
  protected diaVacio(dia: number): boolean {
    return !this.reglas().some((r) => r.dayOfWeek === dia);
  }

  /**
   * Las horas que se dibujan (AC-C3-01).
   *
   * En `completo`, el día entero: de 00 a 23. En `atencion`, de la primera
   * hora atendida a la última — el fin de la franja es exclusivo, así que un
   * horario que termina 13:00 **no** ocupa la fila de las 13.
   *
   * Sin reglas no se dibuja ninguna hora, en los dos rangos: una grilla de 24
   * filas vacías no dice nada que el estado vacío no diga mejor.
   */
  protected readonly horas = computed(() => {
    const reglas = this.reglas();
    if (reglas.length === 0) return [] as number[];
    if (this.rango() === 'completo') return Array.from({ length: 24 }, (_, i) => i);

    let desde = 23;
    let hasta = 0;
    for (const r of reglas) {
      desde = Math.min(desde, hora(r.startTime));
      hasta = Math.max(hasta, horaDelFin(r.endTime));
    }
    if (hasta < desde) return [] as number[];
    return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  });

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
   * contra **las horas que se están dibujando**. Uno de varios días se dibuja
   * entero en los del medio.
   *
   * Se mide contra `horas()` y no contra las 24 fijas porque con el rango
   * `atencion` la grilla arranca a las 08:00: un bloqueo medido desde
   * medianoche se dibujaría un tercio más arriba de donde va. Lo que cae
   * enteramente fuera del rango visible no se dibuja — pero **sus horas
   * siguen diciendo la verdad**: el rótulo dice «14:00 – 22:00» aunque la
   * grilla recorte a las 20:00, porque el bloqueo dura eso.
   */
  protected readonly bloqueosPintados = computed<readonly BloqueoDelHorario[]>(() => {
    if (!this.conFechas() || this.reglas().length === 0) return [];
    const horas = this.horas();
    if (horas.length === 0) return [];
    const arranque = horas[0] * 60;
    const total = horas.length * 60;

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
        // Recortado a la ventana visible para medirlo; el texto conserva las
        // horas reales del bloqueo, que es el dato que la persona necesita.
        const visibleDesde = Math.max(minDesde, arranque);
        const visibleHasta = Math.min(minHasta, arranque + total);
        if (visibleHasta <= visibleDesde) return;
        const textoDesde = reloj(minDesde);
        const textoHasta = reloj(minHasta);
        pintados.push({
          id: `${b.id ?? i}-${dia.numero}`,
          dia: dia.numero,
          desde: textoDesde,
          hasta: textoHasta,
          top: ((visibleDesde - arranque) / total) * 100,
          alto: ((visibleHasta - visibleDesde) / total) * 100,
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

/** La hora de un `HH:MM:SS`. */
function hora(texto: string): number {
  return Math.floor(minutos(texto) / 60);
}

/**
 * La última hora que ocupa una franja que termina en `texto`.
 *
 * El fin es exclusivo: «hasta las 13:00» no ocupa la fila de las 13. Se resta
 * un minuto antes de tomar la hora, que es como lo hacía la grilla recortada
 * antes de que existiera el día completo.
 */
function horaDelFin(texto: string): number {
  return Math.floor((minutos(texto) - 1) / 60);
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
