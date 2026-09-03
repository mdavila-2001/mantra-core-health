import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { PublishedRule } from '../../../../core/data-access/scheduling/scheduling.types';

/** Una celda de la grilla: un día a una hora. */
export interface CeldaDelHorario {
  readonly dia: number;
  readonly hora: number;
  /** Se atiende en esa hora, aunque sea una parte. */
  readonly atiende: boolean;
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
 * ## Sólo las horas que se usan
 *
 * La grilla arranca en la primera hora que atendés y termina en la última. Un
 * día de 24 filas con dos pintadas obliga a buscar dónde está lo que importa,
 * y las 22 vacías no dicen nada que la ausencia no diga.
 *
 * ## El color no va solo
 *
 * Cada celda atendida lleva su `aria-label` con el día y la hora en palabras.
 * El pedido dice «resaltado con otro color», y el color es la mitad: quien no
 * lo distingue tiene que poder leer lo mismo.
 */
@Component({
  selector: 'app-schedule-grid',
  imports: [],
  templateUrl: './schedule-grid.html',
  styleUrl: './schedule-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleGrid {
  readonly reglas = input.required<readonly PublishedRule[]>();

  /** Los días que se dibujan: de lunes a domingo, sin los que nadie atiende. */
  protected readonly dias = computed(() => {
    const conAtencion = new Set(this.reglas().map((r) => r.dayOfWeek));
    // Si no atiende ninguno, se muestran los cinco de semana para que la
    // grilla no sea un rectángulo vacío sin forma.
    const usados = ORDEN.filter((d) => conAtencion.has(d));
    return (usados.length > 0 ? usados : [1, 2, 3, 4, 5]).map((numero) => ({
      numero,
      corto: CORTO[numero],
      largo: LARGO[numero],
    }));
  });

  /** Las horas que se dibujan: de la primera atendida a la última. */
  protected readonly horas = computed(() => {
    const reglas = this.reglas();
    if (reglas.length === 0) return [] as number[];

    let desde = 23;
    let hasta = 0;
    for (const r of reglas) {
      desde = Math.min(desde, hora(r.startTime));
      // El fin es exclusivo: una franja que termina 13:00 no ocupa la fila de
      // las 13. Se resta un minuto antes de tomar la hora.
      hasta = Math.max(hasta, hora(r.endTime, -1));
    }
    if (hasta < desde) return [] as number[];
    return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  });

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

  protected etiqueta(dia: string, h: number): string {
    return `${dia} a las ${String(h).padStart(2, '0')}:00: atendés`;
  }

  protected rotulo(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }
}

/** La hora de un `HH:MM:SS`, opcionalmente corriendo N minutos. */
function hora(texto: string, ajusteMinutos = 0): number {
  return Math.floor((minutos(texto) + ajusteMinutos) / 60);
}

/** Los minutos desde medianoche de un `HH:MM` o `HH:MM:SS`. */
function minutos(texto: string): number {
  const [h, m] = texto.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}
