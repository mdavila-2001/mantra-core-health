import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Card } from '../../../../../../shared/components/molecules/card/card';
import { ActivityChart } from '../activity-chart/activity-chart';
import { QualityIndicators } from '../quality-indicators/quality-indicators';
import type {
  ActividadVisible,
  IndicadorDeCalidad,
  PuntoDeSerie,
} from '../practitioner-profile-view.types';

/**
 * La pestaña «Actividad» de la ficha del médico.
 *
 * ## Qué dibuja, y por qué esto y no cuatro números
 *
 * Tres bloques, de lo más grueso a lo más fino:
 *
 * 1. **Cifras de tu práctica** — los cuatro contadores de siempre, ahora con
 *    una línea que dice **qué cuenta cada uno**. «275» no significa nada;
 *    «275 · evoluciones asentadas en el expediente» sí.
 * 2. **Consultas mes a mes** ({@link ActivityChart}) — un total acumulado no
 *    distingue una práctica que crece de una que se apagó hace medio año.
 * 3. **Calidad de la atención** ({@link QualityIndicators}) — asistencia,
 *    puntualidad, documentación al día, pacientes que vuelven, valoración y
 *    duración media.
 *
 * Los cuatro contadores solos fueron lo que el cliente rechazó el 19/09/2026.
 * Lo que faltaba no era formato: era la serie y los indicadores, que son las
 * dos preguntas que un profesional se hace de su propia práctica —«¿voy para
 * arriba?» y «¿cómo estoy atendiendo?»— y que un acumulado no contesta.
 *
 * ## Los bloques que no tienen dato no se dibujan
 *
 * `mensual` y `calidad` son opcionales: una instalación que todavía no los
 * calcula muestra los contadores y nada más. Un gráfico de doce meses en cero
 * o un «0 % de asistencia» sobre cero citas dicen menos que el silencio, y
 * encima mienten.
 *
 * ## Por qué es un componente y no unas reglas más en la ficha
 *
 * Porque `practitioner-profile-view.css` está a un pelo del techo que
 * `angular.json` pone por hoja de componente. Por lo mismo el gráfico y los
 * indicadores son componentes propios: cada uno trae su presupuesto.
 */
@Component({
  selector: 'app-practitioner-activity',
  imports: [ActivityChart, Card, QualityIndicators],
  templateUrl: './practitioner-activity.html',
  styleUrl: './practitioner-activity.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerActivity {
  /** Las cuentas a mostrar, en el orden en que vienen. */
  readonly actividad = input.required<readonly ActividadVisible[]>();

  /** Las consultas mes a mes. Vacío: no se dibuja el gráfico. */
  readonly mensual = input<readonly PuntoDeSerie[]>([]);

  /** Los indicadores de calidad. Vacío: no se dibuja el bloque. */
  readonly calidad = input<readonly IndicadorDeCalidad[]>([]);
}
