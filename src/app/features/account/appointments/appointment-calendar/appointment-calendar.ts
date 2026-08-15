import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import {
  DIAS_DE_LA_SEMANA,
  type CalendarAppointment,
  type CalendarDay,
} from './appointment-calendar.types';

/** Cuántos días entran en una semana dibujada. */
const DIAS_POR_SEMANA = 7;

/**
 * Vista de mes de los turnos — la otra mitad de la vista dual (corrección #10).
 *
 * ## Por qué existe además de la lista
 *
 * Son dos preguntas distintas sobre los mismos datos. La lista responde «qué
 * turnos tengo y qué puedo hacer con cada uno»; el calendario responde «cómo me
 * queda la semana». Con turnos repartidos en el mes, la lista obliga a leer
 * fechas una por una para armar en la cabeza lo que el calendario muestra de un
 * vistazo.
 *
 * **Los datos son exactamente los mismos.** No hay una segunda lectura ni un
 * filtro distinto: la pantalla le pasa la misma colección que pinta en la
 * lista. Si el calendario pidiera lo suyo, las dos vistas podrían discrepar, y
 * discrepar en una agenda es peor que no tener calendario.
 *
 * ## Qué no hace
 *
 * No opera: elegir un turno emite su id y la pantalla abre el mismo detalle que
 * abre la lista. Un calendario que además cancela sería una segunda
 * implementación de las acciones, que es justo lo que la regla 3 del carril
 * prohíbe.
 *
 * Los turnos **sin horario** no se dibujan —no tienen día donde ir— y se
 * cuentan aparte: esconderlos sin decirlo haría creer que no existen.
 */
@Component({
  selector: 'app-appointment-calendar',
  imports: [AppButton, DatePipe],
  templateUrl: './appointment-calendar.html',
  styleUrl: './appointment-calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentCalendar {
  /** Los turnos a pintar. Los mismos que la lista, sin filtrar de nuevo. */
  readonly turnos = input.required<readonly CalendarAppointment[]>();

  /** El turno abierto en el detalle, para marcarlo también acá. */
  readonly seleccionado = input<string | null>(null);

  /** Se eligió un turno: la pantalla abre su detalle. */
  readonly turnoElegido = output<string>();

  protected readonly diasDeLaSemana = DIAS_DE_LA_SEMANA;

  /**
   * El mes que se está mirando, como su día 1.
   *
   * Arranca en el mes de hoy y no en el del primer turno: quien abre el
   * calendario quiere ver dónde está parado, y un calendario que abre en marzo
   * porque ahí cae el turno más viejo obliga a volver.
   */
  protected readonly mes = signal(primerDiaDelMes(new Date()));

  protected readonly titulo = computed(() => this.mes());

  /**
   * Las seis semanas del mes, con sus días.
   *
   * Seis fijas y no las que haga falta: una grilla que cambia de alto al
   * cambiar de mes mueve todo lo que tiene debajo, y el botón de «mes
   * siguiente» se escapa de abajo del dedo.
   */
  protected readonly semanas = computed<readonly (readonly CalendarDay[])[]>(() => {
    const porDia = this.turnosPorDia();
    const hoy = claveDelDia(new Date());
    const mesActual = this.mes();
    const inicio = primerDiaDeLaGrilla(mesActual);

    const semanas: CalendarDay[][] = [];
    for (let semana = 0; semana < 6; semana += 1) {
      const dias: CalendarDay[] = [];
      for (let dia = 0; dia < DIAS_POR_SEMANA; dia += 1) {
        const fecha = new Date(inicio);
        fecha.setDate(inicio.getDate() + semana * DIAS_POR_SEMANA + dia);
        const clave = claveDelDia(fecha);
        const delDia = porDia.get(clave) ?? [];
        dias.push({
          fecha,
          numero: fecha.getDate(),
          delMes: fecha.getMonth() === mesActual.getMonth(),
          esHoy: clave === hoy,
          turnos: delDia,
          etiqueta: etiquetaDelDia(fecha, delDia.length),
        });
      }
      semanas.push(dias);
    }
    return semanas;
  });

  /** Turnos con horario, agrupados por día. */
  private readonly turnosPorDia = computed(() => {
    const porDia = new Map<string, CalendarAppointment[]>();
    for (const turno of this.turnos()) {
      if (turno.cuando === null) continue;
      const clave = claveDelDia(turno.cuando);
      const delDia = porDia.get(clave);
      if (delDia === undefined) {
        porDia.set(clave, [turno]);
        continue;
      }
      delDia.push(turno);
    }
    for (const delDia of porDia.values()) {
      delDia.sort((a, b) => (a.cuando?.getTime() ?? 0) - (b.cuando?.getTime() ?? 0));
    }
    return porDia;
  });

  /** Cuántos turnos no se pueden dibujar porque perdieron su horario. */
  protected readonly sinHorario = computed(
    () => this.turnos().filter((turno) => turno.cuando === null).length,
  );

  /**
   * Lo que dice la leyenda de la tabla, ya con la concordancia resuelta.
   *
   * Se arma acá y no en la plantilla: componer «1 turno» / «3 turnos» con
   * bloques `@if` dentro de un `<caption>` produce una leyenda partida en
   * pedazos que ningún lector de pantalla lee de corrido.
   */
  protected readonly resumenDelMes = computed(() => {
    const cuantos = this.enElMes();
    return cuantos === 1 ? '1 turno' : `${cuantos} turnos`;
  });

  /** Cuántos de los turnos caen en el mes que se está mirando. */
  protected readonly enElMes = computed(() => {
    const mes = this.mes();
    return this.turnos().filter(
      (turno) =>
        turno.cuando !== null &&
        turno.cuando.getMonth() === mes.getMonth() &&
        turno.cuando.getFullYear() === mes.getFullYear(),
    ).length;
  });

  protected mesAnterior(): void {
    this.mes.update((actual) => sumarMeses(actual, -1));
  }

  protected mesSiguiente(): void {
    this.mes.update((actual) => sumarMeses(actual, 1));
  }

  /** Vuelve al mes de hoy. Es la salida de haberse ido lejos navegando. */
  protected volverAHoy(): void {
    this.mes.set(primerDiaDelMes(new Date()));
  }

  protected elegir(turno: CalendarAppointment): void {
    this.turnoElegido.emit(turno.id);
  }
}

/** El día 1 del mes de una fecha, a medianoche. */
function primerDiaDelMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/**
 * El lunes con el que arranca la grilla del mes.
 *
 * La semana empieza el lunes porque así se lee un calendario acá; `getDay()`
 * devuelve 0 para domingo, así que hay que correrlo antes de restar.
 */
function primerDiaDeLaGrilla(mes: Date): Date {
  const primero = primerDiaDelMes(mes);
  const diaDeSemana = (primero.getDay() + 6) % DIAS_POR_SEMANA;
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - diaDeSemana);
  return inicio;
}

/**
 * Suma meses sin el desborde de `setMonth`.
 *
 * `new Date(2026, 0, 31).setMonth(1)` da el 3 de marzo, no el 28 de febrero.
 * Como acá siempre se trabaja sobre el día 1, se construye la fecha entera en
 * vez de mutarla.
 */
function sumarMeses(mes: Date, cuantos: number): Date {
  return new Date(mes.getFullYear(), mes.getMonth() + cuantos, 1);
}

/** Clave de agrupación por día local (no UTC: el turno es a la hora de acá). */
function claveDelDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/**
 * Cómo se anuncia una celda.
 *
 * Con el número solo, un lector de pantalla dice «12» y nada más: hay que decir
 * la fecha y si ese día hay algo, porque el color y la posición —que es como se
 * lee un calendario mirándolo— no llegan por audio.
 */
function etiquetaDelDia(fecha: Date, cuantos: number): string {
  const dia = fecha.toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  if (cuantos === 0) {
    return `${dia}, sin turnos`;
  }
  return `${dia}, ${cuantos} ${cuantos === 1 ? 'turno' : 'turnos'}`;
}
