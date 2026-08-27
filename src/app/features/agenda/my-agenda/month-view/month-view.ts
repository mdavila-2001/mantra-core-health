import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { AgendaSlot } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
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
  imports: [AppButton],
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

  /** Tocaron un día: el contenedor decide si abre el día o el bloqueo. */
  readonly diaElegido = output<Date>();

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
        const bloqueo = this.bloqueoDe(fecha);

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

  /** El bloqueo que cubre esa fecha, si hay alguno. */
  private bloqueoDe(fecha: Date): BloqueoDelMes | null {
    const inicio = medianoche(fecha).getTime();
    const fin = inicio + 24 * 60 * 60 * 1000;
    return (
      this.bloqueos().find((b) => b.desde.getTime() < fin && b.hasta.getTime() > inicio) ?? null
    );
  }

  protected mesAnterior(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  protected mesSiguiente(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  protected elegir(celda: CeldaDelMes): void {
    this.diaElegido.emit(celda.fecha);
  }
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
