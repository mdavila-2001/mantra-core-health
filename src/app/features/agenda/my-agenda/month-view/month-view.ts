import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import type { AgendaSlot } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import {
  claveDelDia,
  DIAS_DE_LA_SEMANA,
  fechaLarga,
  fechasDeLaGrilla,
  medianoche,
} from '../../../../shared/date/calendario-mes';

/** Un bloqueo declarado por el profesional, ya resuelto para el calendario. */
export interface BloqueoDelMes {
  /** El id de la excepción, para poder quitarla desde el día. */
  readonly id?: string;
  readonly desde: Date;
  readonly hasta: Date;
  /** Por qué, si se declaró. Es lo que distingue «bloqueado» de «sin agenda». */
  readonly motivo: string | null;
}

/** El estado de un día, decidido una sola vez. */
export type EstadoDelDia = 'sin-agenda' | 'bloqueado' | 'libre' | 'con-reservas' | 'lleno';

/** Una celda del mes, lista para pintar. */
export interface CeldaDelMes {
  readonly fecha: Date;
  readonly numero: number;
  readonly delMes: boolean;
  readonly esHoy: boolean;
  readonly pasado: boolean;
  readonly estado: EstadoDelDia;
  /** Turnos tomados. */
  readonly reservados: number;
  /** Turnos publicados ese día. */
  readonly total: number;
  /** El motivo del bloqueo, cuando lo hay. */
  readonly motivo: string | null;
  /** Cómo se anuncia la celda entera a un lector de pantalla. */
  readonly etiqueta: string;
  /** El globo del día: a qué horas atiende y qué tiene bloqueado. */
  readonly resumen: string;
}

/**
 * El mes del profesional — «¿cómo viene mi carga?».
 *
 * ## Qué muestra, y qué no
 *
 * **Ocupación, jamás los turnos.** La celda dice «6/8», no quién viene: los
 * nombres son la vista del día (MAC-6), y un mes con nombres es ilegible antes
 * de la segunda semana. Acá la pregunta es de un vistazo: ¿qué días tengo
 * llenos y cuáles vacíos?
 *
 * ## Por qué no reusa el calendario del paciente como componente
 *
 * Porque pinta otra cosa. Lo que sí comparten —y es lo que cuesta— es la
 * aritmética de la grilla, que vive en `shared/date/calendario-mes`. Meter las
 * dos formas en un componente con un `modo` habría sido una bandera que cambia
 * el comportamiento: dos componentes son más simples que uno con dos
 * personalidades.
 *
 * ## El color nunca solo
 *
 * Cada celda lleva su número visible y una etiqueta accesible completa
 * («martes 8: seis de ocho turnos reservados»). Un mes que sólo se entienda por
 * el tono no lo entiende nadie con baja visión — ni nadie mirando el teléfono
 * al sol.
 */
@Component({
  selector: 'app-month-view',
  imports: [AppButton, NgTemplateOutlet, Tooltip],
  templateUrl: './month-view.html',
  styleUrl: './month-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthView {
  /** El mes que se está mirando; cualquier fecha de ese mes sirve. */
  readonly mes = input.required<Date>();

  /** Los cupos publicados del mes, tal como los devuelve la API. */
  readonly cupos = input.required<readonly AgendaSlot[]>();

  /** Los bloqueos del mes. */
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /** Pidieron ver otro mes. */
  readonly mesElegido = output<Date>();

  /**
   * Si cada día se puede abrir. En «Cómo viene el mes» no (es un vistazo, con
   * el globo como único detalle); en la agenda de `/schedule`, sí: tocar un
   * día lleva a ese día.
   */
  readonly selectable = input(false);

  /** Tocaron un día, con `selectable` puesto. */
  readonly dayPicked = output<Date>();

  protected readonly encabezados = DIAS_DE_LA_SEMANA;

  protected readonly titulo = computed(() =>
    this.mes().toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }),
  );

  /** Las seis semanas, con el estado de cada día ya resuelto. */
  protected readonly semanas = computed<readonly (readonly CeldaDelMes[])[]>(() => {
    const porDia = this.cuposPorDia();
    const hoy = claveDelDia(new Date());
    const desdeHoy = medianoche(new Date()).getTime();
    const mesActual = this.mes();

    return fechasDeLaGrilla(mesActual).map((semana) =>
      semana.map((fecha) => {
        const clave = claveDelDia(fecha);
        const cuenta = porDia.get(clave) ?? { total: 0, reservados: 0 };
        const bloqueos = this.bloqueosDe(fecha);
        const bloqueo = bloqueos[0] ?? null;

        const estado = decidirEstado(cuenta, bloqueo !== null);
        return {
          fecha,
          numero: fecha.getDate(),
          delMes: fecha.getMonth() === mesActual.getMonth(),
          esHoy: clave === hoy,
          pasado: fecha.getTime() < desdeHoy,
          estado,
          reservados: cuenta.reservados,
          total: cuenta.total,
          motivo: bloqueo?.motivo ?? null,
          etiqueta: etiquetaDeLaCelda(fecha, estado, cuenta, bloqueo?.motivo ?? null),
          resumen: resumenDelDia(fecha, this.franjasPorDia().get(clave) ?? [], bloqueos),
        };
      }),
    );
  });

  /**
   * Cupos agrupados por día, con lo tomado ya sumado.
   *
   * `reservados = capacity − remainingCapacity` sumado sobre los cupos del día:
   * es la única cuenta que la API no da hecha, y hacerla acá evita una llamada
   * por día.
   */
  private readonly cuposPorDia = computed(() => {
    const porDia = new Map<string, { total: number; reservados: number }>();
    for (const cupo of this.cupos()) {
      const clave = claveDelDia(cupo.startAt);
      const actual = porDia.get(clave) ?? { total: 0, reservados: 0 };
      porDia.set(clave, {
        total: actual.total + cupo.capacity,
        reservados: actual.reservados + (cupo.capacity - cupo.remainingCapacity),
      });
    }
    return porDia;
  });

  /**
   * Las horas de atención de cada día, sacadas de los cupos publicados.
   *
   * Los cupos y no la plantilla: la plantilla dice qué rige «los martes», los
   * cupos dicen qué se publicó ESTE martes —con la vigencia y los cambios ya
   * aplicados—. Cupos pegados se funden en una sola franja: «08:00–12:00», no
   * dieciséis turnos de quince minutos.
   */
  private readonly franjasPorDia = computed(() => {
    const porDia = new Map<string, Franja[]>();
    const ordenados = [...this.cupos()].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    for (const cupo of ordenados) {
      const clave = claveDelDia(cupo.startAt);
      const franjas = porDia.get(clave) ?? [];
      const ultima = franjas.at(-1);
      if (ultima !== undefined && cupo.startAt.getTime() <= ultima.hasta.getTime()) {
        if (cupo.endAt.getTime() > ultima.hasta.getTime()) {
          franjas[franjas.length - 1] = { desde: ultima.desde, hasta: cupo.endAt };
        }
      } else {
        franjas.push({ desde: cupo.startAt, hasta: cupo.endAt });
      }
      porDia.set(clave, franjas);
    }
    return porDia;
  });

  /** Los bloqueos que tocan esa fecha, en orden. */
  private bloqueosDe(fecha: Date): readonly BloqueoDelMes[] {
    const inicio = medianoche(fecha).getTime();
    const fin = inicio + UN_DIA_MS;
    return this.bloqueos()
      .filter((b) => b.desde.getTime() < fin && b.hasta.getTime() > inicio)
      .sort((a, b) => a.desde.getTime() - b.desde.getTime());
  }

  protected mesAnterior(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  protected mesSiguiente(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Un rato continuo del día. */
interface Franja {
  readonly desde: Date;
  readonly hasta: Date;
}

/** «08:00». */
function hora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** «08:00–12:00 y 14:00–18:00». */
function listaDeFranjas(franjas: readonly Franja[]): string {
  const textos = franjas.map((f) => `${hora(f.desde)}–${hora(f.hasta)}`);
  if (textos.length <= 1) return textos.join('');
  return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1)}`;
}

/**
 * El globo de un día del mes: el horario de atención y lo bloqueado.
 *
 * Un bloqueo se recorta al día que se mira: el de unas vacaciones de dos
 * semanas no dice «del 3 al 17» en cada celda, dice «todo el día». Y el que
 * cubre sólo una parte dice qué parte, que es justo lo que no se ve en la
 * celda.
 */
function resumenDelDia(
  fecha: Date,
  franjas: readonly Franja[],
  bloqueos: readonly BloqueoDelMes[],
): string {
  const partes = [fechaLarga(fecha)];
  partes.push(franjas.length === 0 ? 'No atendés.' : `Atendés ${listaDeFranjas(franjas)}.`);

  const inicio = medianoche(fecha).getTime();
  const fin = inicio + UN_DIA_MS;
  for (const bloqueo of bloqueos) {
    const desde = Math.max(bloqueo.desde.getTime(), inicio);
    const hasta = Math.min(bloqueo.hasta.getTime(), fin);
    const cuando =
      desde === inicio && hasta === fin
        ? 'todo el día'
        : listaDeFranjas([{ desde: new Date(desde), hasta: new Date(hasta) }]);
    const motivo = bloqueo.motivo === null ? '' : ` (${bloqueo.motivo})`;
    partes.push(`Bloqueado ${cuando}${motivo}.`);
  }
  return partes.join(' · ');
}

/**
 * Qué es este día.
 *
 * El orden importa: un día bloqueado se dice bloqueado aunque tenga cupos
 * publicados —el bloqueo es justamente lo que hay que ver—, y un día sin cupos
 * no es «libre» sino «sin agenda»: no es que nadie reservó, es que no atiende.
 */
function decidirEstado(
  cuenta: { total: number; reservados: number },
  bloqueado: boolean,
): EstadoDelDia {
  if (bloqueado) return 'bloqueado';
  if (cuenta.total === 0) return 'sin-agenda';
  if (cuenta.reservados === 0) return 'libre';
  if (cuenta.reservados >= cuenta.total) return 'lleno';
  return 'con-reservas';
}

/**
 * Cómo se anuncia una celda.
 *
 * Con el número solo, un lector de pantalla dice «12» y nada más. Acá dice el
 * día, y después qué pasa ese día, en palabras.
 */
function etiquetaDeLaCelda(
  fecha: Date,
  estado: EstadoDelDia,
  cuenta: { total: number; reservados: number },
  motivo: string | null,
): string {
  const cuando = fechaLarga(fecha);
  switch (estado) {
    case 'sin-agenda':
      return `${cuando}: no atendés`;
    case 'bloqueado':
      return motivo === null ? `${cuando}: bloqueado` : `${cuando}: bloqueado — ${motivo}`;
    case 'libre':
      return `${cuando}: ${cuenta.total} turnos publicados, ninguno reservado`;
    case 'lleno':
      return `${cuando}: completo, ${cuenta.total} de ${cuenta.total} turnos reservados`;
    case 'con-reservas':
      return `${cuando}: ${cuenta.reservados} de ${cuenta.total} turnos reservados`;
  }
}
