import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { AgendaSlot } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import type { BloqueoDelMes, EstadoDelDia } from '../month-view/month-view';

/** Un día de la semana, ya resuelto. */
export interface DiaDeLaSemana {
  readonly fecha: Date;
  readonly estado: EstadoDelDia;
  readonly libres: number;
  readonly tomados: number;
  /** Por qué está cerrado, si lo está. */
  readonly motivo: string | null;
}

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * **La semana** — el botón que el pedido original pide junto al del mes.
 *
 * *«Luego un botón para ver la semana y otro para ver el mes, cada uno con su
 * respectiva paginación de adelante y atrás.»*
 *
 * ## Por qué existe teniendo el mes
 *
 * Porque son dos preguntas distintas. El mes responde «¿cuándo tengo hueco?»;
 * la semana responde **«¿cómo viene esto?»**, que es la que uno se hace el
 * lunes a la mañana. Con siete días en pantalla los números caben, y por eso
 * acá se muestran **cuántos turnos libres y cuántos tomados** tiene cada día —
 * en el mes eso no entra sin volverlo ilegible.
 *
 * ## El estado se decide con el mismo criterio que el mes
 *
 * `sin-agenda`, `bloqueado`, `libre`, `con-reservas` y `lleno` son los mismos
 * cinco, y se calculan igual. Dos pantallas que pintan la misma agenda no
 * pueden discrepar sobre si un día está lleno.
 */
@Component({
  selector: 'app-week-view',
  imports: [AppButton, DatePipe],
  templateUrl: './week-view.html',
  styleUrl: './week-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekView {
  /** Cualquier día de la semana que se mira; el lunes se calcula acá. */
  readonly semana = input.required<Date>();
  readonly cupos = input.required<readonly AgendaSlot[]>();
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /** La semana elegida, ya como su lunes. */
  readonly semanaElegida = output<Date>();
  readonly diaElegido = output<Date>();

  /** El lunes de la semana mirada. */
  protected readonly lunes = computed(() => lunesDe(this.semana()));

  protected readonly dias = computed<readonly DiaDeLaSemana[]>(() => {
    const inicio = this.lunes();
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      return this.resolverDia(fecha);
    });
  });

  /** «Del 8 al 14 de septiembre», para el encabezado. */
  protected readonly rotulo = computed(() => {
    const dias = this.dias();
    return { desde: dias[0].fecha, hasta: dias[6].fecha };
  });

  protected readonly totalLibres = computed(() =>
    this.dias().reduce((suma, d) => suma + d.libres, 0),
  );

  protected anterior(): void {
    const l = this.lunes();
    this.semanaElegida.emit(new Date(l.getFullYear(), l.getMonth(), l.getDate() - 7));
  }

  protected siguiente(): void {
    const l = this.lunes();
    this.semanaElegida.emit(new Date(l.getFullYear(), l.getMonth(), l.getDate() + 7));
  }

  private resolverDia(fecha: Date): DiaDeLaSemana {
    const finDelDia = new Date(fecha.getTime() + UN_DIA);

    // Un bloqueo cuenta si PISA el día, aunque empiece antes o termine después:
    // unas vacaciones de dos semanas cierran los catorce, no sólo el primero.
    const bloqueo = this.bloqueos().find(
      (b) => b.desde.getTime() < finDelDia.getTime() && b.hasta.getTime() > fecha.getTime(),
    );

    const delDia = this.cupos().filter(
      (c) => c.startAt.getTime() >= fecha.getTime() && c.startAt.getTime() < finDelDia.getTime(),
    );

    if (delDia.length === 0) {
      return {
        fecha,
        estado: bloqueo !== undefined ? 'bloqueado' : 'sin-agenda',
        libres: 0,
        tomados: 0,
        motivo: bloqueo?.motivo ?? null,
      };
    }

    const libres = delDia.filter((c) => (c.remainingCapacity ?? 0) > 0).length;
    const tomados = delDia.length - libres;

    // El bloqueo manda sobre el conteo: si el día está cerrado, que tenga cupos
    // sin reservar no significa que se pueda pedir turno.
    if (bloqueo !== undefined) {
      return { fecha, estado: 'bloqueado', libres, tomados, motivo: bloqueo.motivo ?? null };
    }

    return {
      fecha,
      estado: libres === 0 ? 'lleno' : tomados > 0 ? 'con-reservas' : 'libre',
      libres,
      tomados,
      motivo: null,
    };
  }
}

/** El lunes de la semana de esa fecha, a medianoche local. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // `getDay()` da 0 para domingo: se corre seis días atrás, no uno adelante.
  const desdeElLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desdeElLunes);
  return d;
}
