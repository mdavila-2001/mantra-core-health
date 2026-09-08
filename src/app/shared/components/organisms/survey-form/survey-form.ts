import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';

import type { SurveyQuestion } from '@core/data-access/surveys/surveys.types';
import { Checkbox } from '../../atoms/checkbox/checkbox';
import { Textarea } from '../../atoms/textarea/textarea';
import { Card } from '../../molecules/card/card';
import { FormField } from '../../molecules/form-field/form-field';
import { Radio } from '../../molecules/radio/radio';
import { RadioGroup } from '../../molecules/radio-group/radio-group';

/** Lo que una pregunta lleva contestado. */
export type ValorDeRespuesta = string | number | boolean | readonly string[] | null;

/** Las respuestas de un cuestionario, por identificador de pregunta. */
export type RespuestasDelCuestionario = ReadonlyMap<string, ValorDeRespuesta>;

/**
 * El cuestionario, renderizado con el control que le toca a cada tipo.
 *
 * ```html
 * <app-survey-form [preguntas]="q()" [(respuestas)]="r" [faltantes]="faltan()" />
 * <app-survey-form [preguntas]="q()" [soloLectura]="true" />
 * ```
 *
 * ## Por qué es un organismo compartido y no la pantalla de responder
 *
 * Porque lo dibujan **dos** pantallas con propósitos opuestos: el paciente lo
 * completa, y la profesional lo mira en la vista previa antes de publicar.
 *
 * Copiarlo habría sido peor que extraerlo: una vista previa que reimplementa
 * el render es una vista previa que **miente en cuanto alguna de las dos
 * cambia**, y lo que la profesional necesita saber es exactamente cómo lo va a
 * ver quien responde. Siendo el mismo componente, no puede desviarse.
 *
 * ## `soloLectura` no es «deshabilitado»
 *
 * En la vista previa los controles se ven y se pueden tocar —así se comprueba
 * que una escala de 0 a 10 entra en la pantalla, o que las opciones no se
 * cortan—, pero lo tecleado no se guarda en ninguna parte: es una maqueta viva.
 * Deshabilitarlos habría mostrado todo en gris, que es justo lo que no se
 * quiere revisar.
 *
 * Lo que `soloLectura` sí hace es **no marcar faltantes**: en una previa nada
 * es obligatorio porque no se está enviando nada.
 */
@Component({
  selector: 'app-survey-form',
  imports: [Card, Checkbox, FormField, Radio, RadioGroup, Textarea],
  templateUrl: './survey-form.html',
  styleUrl: './survey-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cuestionario' },
})
export class SurveyForm {
  readonly preguntas = input.required<readonly SurveyQuestion[]>();

  /** Lo contestado. Dos vías: la pantalla lee y escribe. */
  readonly respuestas = model<RespuestasDelCuestionario>(new Map());

  /** Las obligatorias sin responder, ya marcadas tras un intento de envío. */
  readonly faltantes = input<ReadonlySet<string>>(new Set());

  /** Vista previa: se puede tocar, pero nada es obligatorio. */
  readonly soloLectura = input(false, { transform: booleanAttribute });

  /** Se emite cuando cambia una respuesta, para que la pantalla despeje avisos. */
  readonly respondido = output<{ questionId: string; valor: ValorDeRespuesta }>();

  /** El prefijo del `data-testid` de cada control. */
  readonly testIdPrefijo = input('q');

  protected readonly hayPreguntas = computed(() => this.preguntas().length > 0);

  protected falta(questionId: string): boolean {
    return !this.soloLectura() && this.faltantes().has(questionId);
  }

  protected textoDe(questionId: string): string {
    const valor = this.respuestas().get(questionId);
    return typeof valor === 'string' ? valor : '';
  }

  protected seleccionDe(questionId: string): string | number | boolean | null {
    const valor = this.respuestas().get(questionId);
    if (valor === undefined || valor === null || Array.isArray(valor)) return null;
    return valor as string | number | boolean;
  }

  protected marcada(questionId: string, opcion: string): boolean {
    const valor = this.respuestas().get(questionId);
    return Array.isArray(valor) && valor.includes(opcion);
  }

  /**
   * Los puntos de una escala.
   *
   * Con tope: una escala de 0 a 500 —que el backend acepta— dibujaría
   * quinientos radios y colgaría la pantalla. Por encima del tope se muestran
   * los extremos, que es lo que la vista previa necesita para avisar que la
   * escala es impracticable.
   */
  protected escalaDe(pregunta: SurveyQuestion): readonly number[] {
    const min = pregunta.scaleMin ?? 1;
    const max = pregunta.scaleMax ?? 5;
    const cuantos = max - min + 1;
    if (cuantos < 1) return [];
    if (cuantos > MAXIMO_PUNTOS_DE_ESCALA) return [min, max];
    return Array.from({ length: cuantos }, (_, i) => min + i);
  }

  /** Si la escala se recortó a sus extremos por ser impracticable. */
  protected escalaRecortada(pregunta: SurveyQuestion): boolean {
    const min = pregunta.scaleMin ?? 1;
    const max = pregunta.scaleMax ?? 5;
    return max - min + 1 > MAXIMO_PUNTOS_DE_ESCALA;
  }

  protected responder(questionId: string, valor: ValorDeRespuesta): void {
    const siguiente = new Map(this.respuestas());
    siguiente.set(questionId, valor);
    this.respuestas.set(siguiente);
    this.respondido.emit({ questionId, valor });
  }

  protected alternar(questionId: string, opcion: string, marcada: boolean): void {
    const actual = this.respuestas().get(questionId);
    const previas = Array.isArray(actual) ? [...(actual as readonly string[])] : [];
    const siguientes = marcada
      ? [...previas.filter((o) => o !== opcion), opcion]
      : previas.filter((o) => o !== opcion);
    this.responder(questionId, siguientes);
  }
}

/**
 * Cuántos puntos de escala se dibujan como radios.
 *
 * Once es 0–10, la escala más larga que se usa en la práctica (dolor, NPS). Por
 * encima, una fila de radios deja de ser elegible con el dedo y la pregunta se
 * responde mal — ver `escalaDe`.
 */
const MAXIMO_PUNTOS_DE_ESCALA = 11;
