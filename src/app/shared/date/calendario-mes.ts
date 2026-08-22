/* ============================================================================
    La aritmética de una grilla mensual.

    Salió del calendario de turnos del paciente para que la use también el mes
    del profesional (MAC-5). Lo que se comparte es SÓLO el cálculo de fechas:
    cada calendario pinta sus propias celdas, porque uno muestra citas y el otro
    ocupación, y meter las dos formas en un componente con un `modo` sería una
    bandera que cambia el comportamiento — dos componentes son más simples que
    uno con dos personalidades.
    ========================================================================== */

/** Cuántos días entran en una semana dibujada. */
export const DIAS_POR_SEMANA = 7;

/**
 * Cuántas semanas se dibujan, siempre.
 *
 * Seis fijas y no las que haga falta: una grilla que cambia de alto al cambiar
 * de mes mueve todo lo que tiene debajo, y el botón de «mes siguiente» se
 * escapa de abajo del dedo.
 */
export const SEMANAS_POR_GRILLA = 6;

/** La misma fecha a medianoche local: para comparar días y no instantes. */
export function medianoche(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** El día 1 del mes de una fecha, a medianoche. */
export function primerDiaDelMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/**
 * El lunes con el que arranca la grilla del mes.
 *
 * La semana empieza el lunes, como el calendario local; el domingo cierra.
 */
export function primerDiaDeLaGrilla(mes: Date): Date {
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
export function sumarMeses(mes: Date, cuantos: number): Date {
  return new Date(mes.getFullYear(), mes.getMonth() + cuantos, 1);
}

/**
 * Clave de agrupación por día.
 *
 * **No sirve para ordenar**: comparadas como texto, `2026-7-9` y `2026-7-18`
 * dicen que el 9 es posterior.
 */
export function claveDelDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/** La fecha dicha en palabras: «martes 19 de agosto». */
export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Las seis por siete fechas de la grilla de un mes, en orden.
 *
 * Devuelve fechas y nada más: qué se pinta en cada una es problema de quien
 * llama.
 *
 * @param mes - Cualquier fecha del mes que se quiere dibujar.
 * @returns Seis semanas de siete días.
 */
export function fechasDeLaGrilla(mes: Date): readonly (readonly Date[])[] {
  const inicio = primerDiaDeLaGrilla(mes);
  const semanas: Date[][] = [];

  for (let semana = 0; semana < SEMANAS_POR_GRILLA; semana += 1) {
    const dias: Date[] = [];
    for (let dia = 0; dia < DIAS_POR_SEMANA; dia += 1) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + semana * DIAS_POR_SEMANA + dia);
      dias.push(fecha);
    }
    semanas.push(dias);
  }

  return semanas;
}

/** Los días de la semana, empezando el lunes como el calendario local. */
export const DIAS_DE_LA_SEMANA: readonly { corto: string; largo: string }[] = [
  { corto: 'Lun', largo: 'lunes' },
  { corto: 'Mar', largo: 'martes' },
  { corto: 'Mié', largo: 'miércoles' },
  { corto: 'Jue', largo: 'jueves' },
  { corto: 'Vie', largo: 'viernes' },
  { corto: 'Sáb', largo: 'sábado' },
  { corto: 'Dom', largo: 'domingo' },
];
