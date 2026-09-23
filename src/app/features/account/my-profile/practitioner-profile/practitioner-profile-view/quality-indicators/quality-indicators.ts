import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { IndicadorDeCalidad } from '../practitioner-profile-view.types';

/** A partir de acá el indicador se pinta como logrado. */
const UMBRAL_BUENO = 0.9;

/**
 * **Los indicadores de calidad de la atención.**
 *
 * ## Qué contesta
 *
 * «¿Cuántas consultas hice?» la contestaban los contadores. Éstos contestan
 * «¿cómo atendí?»: cuánta gente se presentó, cuántas consultas empezaron a
 * horario, cuántos encuentros quedaron documentados el mismo día, cuántos
 * pacientes volvieron, qué opinan y cuánto dura una consulta. Es lo que el
 * cliente pidió el 19/09/2026 al rechazar los cuatro números sueltos.
 *
 * ## Cada indicador lleva su denominador
 *
 * «91 %» solo no distingue 10 de 11 de 910 de 1 000. El par completo va
 * siempre debajo («312 de 341 citas agendadas»), y el cociente lo calcula
 * quien arma el dato, no la plantilla.
 *
 * ## Dos tonos, y ninguno es ámbar ni rojo
 *
 * Verde a partir del 90 %, el color de marca por debajo. No hay un tono de
 * alarma porque el umbral de «mal» no lo fijó nadie: inventarlo acá sería
 * ponerle una nota al trabajo de alguien con un número que este equipo se
 * sacó de la manga. El ámbar, además, es el color de la acción única del
 * sistema y no se usa para etiquetar.
 */
@Component({
  selector: 'app-quality-indicators',
  imports: [],
  templateUrl: './quality-indicators.html',
  styleUrl: './quality-indicators.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityIndicators {
  readonly indicadores = input.required<readonly IndicadorDeCalidad[]>();

  protected readonly filas = computed(() =>
    this.indicadores().map((indicador) => ({
      ...indicador,
      porcentaje: indicador.proporcion === null ? null : Math.round(indicador.proporcion * 100),
      logrado: indicador.proporcion !== null && indicador.proporcion >= UMBRAL_BUENO,
    })),
  );
}
