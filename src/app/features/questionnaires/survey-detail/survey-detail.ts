import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import type {
  AnswerType,
  SurveyDetail,
  SurveyQuestion,
  SurveyResponse,
} from '../../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { BackLink } from '../../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { releaseObjectUrlLater } from '../../../shared/utils/file-download/release-object-url';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { SurveyForm } from '../../../shared/components/organisms/survey-form/survey-form';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { QuestionEditor, ETIQUETA_TIPO as ETIQUETAS } from './question-editor/question-editor';
import { ENCUESTAS_ROUTE } from '../questionnaires.routes';

/**
 * Piso de respuestas para mostrar un agregado o habilitar el CSV.
 *
 * El README de `surveys` (backend) documenta la decisión **D-13** —cuál es el
 * umbral mínimo de participantes para publicar un agregado— como abierta, y
 * dice literalmente que congela "indicadores agregados y exportación
 * anonimizada" hasta que se resuelva. Con menos respuestas que este número, un
 * gráfico de barras o un CSV equivalen a señalar la respuesta de una persona
 * puntual, que es justo lo que la encuesta promete no hacer.
 *
 * 5 es el piso convencional de control de divulgación estadística (la misma
 * cifra que usa, por ejemplo, el criterio de tamaño de celda mínimo de HIPAA
 * Safe Harbor para reportes públicos de salud) — un valor conservador para no
 * bloquear la función mientras D-13 se resuelve formalmente, no la resolución
 * de D-13 en sí. Cuando el equipo fije el número real, este es el único lugar
 * que hay que tocar.
 */
const UMBRAL_MINIMO_RESPUESTAS = 5;

/** Una barra del gráfico de una pregunta: cuántos eligieron esta opción, y qué porcentaje del total es. */
export interface BarraDeResumen {
  readonly etiqueta: string;
  readonly cantidad: number;
  /** 0 a 100, sobre quienes respondieron *esta* pregunta (no sobre toda la encuesta). */
  readonly porcentaje: number;
}

/**
 * El resumen de una pregunta: sus barras (vacío en texto libre, donde un
 * gráfico no dice nada) y, para escala, el promedio.
 */
export interface ResumenDePregunta {
  readonly questionId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly totalRespondida: number;
  readonly promedio: number | null;
  readonly barras: readonly BarraDeResumen[];
}

/**
 * A survey's sheet, READ-ONLY (06/11/2026): its questionnaire, the summary and
 * the responses received. Hand-made surveys are no longer edited, published,
 * attached or deactivated — the API rejects new non-catalog assignments
 * (`SURVEY_ASSIGNMENT_REQUIRES_CATALOG_TEMPLATE`) — so the sheet points to
 * «Encuestas por servicio», where each service's standard survey is chosen.
 */
@Component({
  selector: 'app-survey-detail',
  imports: [
    Alert,
    AppButton,
    BackLink,
    Badge,
    Card,
    DatePipe,
    DecimalPipe,
    PageHeader,
    QuestionEditor,
    RouterLink,
    Skeleton,
    SurveyForm,
    ViewStateHost,
  ],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyDetailScreen {
  private readonly surveys = inject(SurveysClient);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  /** A dónde vuelve quien entró a una encuesta: al listado del que salió. */
  protected readonly rutaDeLasEncuestas = ENCUESTAS_ROUTE;
  /** Query params of the «Encuestas por servicio» sub-tab. */
  protected readonly porServicio = { encuestas: 'servicios' } as const;
  /** Etiqueta legible de un tipo de respuesta. La usa el resumen de abajo. */
  protected etiquetaDe(tipo: AnswerType): string {
    return ETIQUETAS[tipo];
  }

  private readonly surveyId = this.route.snapshot.paramMap.get('surveyId') ?? '';

  private readonly estado = signal<ViewState<SurveyDetail>>(loading());
  protected readonly vista = this.estado.asReadonly();

  /** Los datos cuando los hay. La unión de estados no se indexa desde la plantilla. */
  protected readonly encuesta = computed(() => dataOf(this.estado()));

  /**
   * Lo recogido, **como estado de vista y no como una lista suelta**.
   *
   * Leer respuestas es un permiso aparte de componer la encuesta y de
   * publicarla (`surveys-forms.handlers.ts`, las tres capacidades), así que
   * `GET /surveys/templates/:id/responses` puede volver 403 sobre una encuesta
   * que la sesión sí puede abrir y corregir. Antes ese 403 se tragaba en
   * silencio y la lista quedaba vacía: la pantalla decía «todavía no respondió
   * nadie» —que es una afirmación sobre los datos— cuando lo cierto era que no
   * había permiso para saberlo. Son dos cosas distintas y ahora se distinguen
   * por `status`, con la misma traducción que el resto de la aplicación
   * (`errorToViewState`).
   */
  protected readonly estadoRespuestas = signal<ViewState<readonly SurveyResponse[]>>(ready([]));

  /** Las respuestas cuando las hay. Vacío en todo estado que no las transporta. */
  protected readonly respuestas = computed(() => dataOf(this.estadoRespuestas()) ?? []);

  protected readonly cargandoRespuestas = computed(
    () => this.estadoRespuestas().status === 'loading',
  );

  /** S5 sobre lo recogido: hay encuesta, pero este rol no puede leer respuestas. */
  protected readonly respuestasProhibidas = computed(
    () => this.estadoRespuestas().status === 'forbidden',
  );

  /**
   * El motivo del 403, tal como lo dio el servidor, para pintarlo en el muro.
   *
   * El respaldo es el mismo texto que usa `app-view-state-host` para S5: un 403
   * sin mensaje no puede quedar como un bloque en blanco, que se leería como
   * «no hay nada» —justo la confusión que esta pantalla evita—.
   */
  protected readonly motivoRespuestasProhibidas = computed(() => {
    const actual = this.estadoRespuestas();
    return actual.status === 'forbidden'
      ? (actual.message ??
          'Su rol o el propósito de uso declarado no alcanzan para ver este contenido.')
      : '';
  });

  /** Si ya hay respuestas suficientes para un agregado o un CSV sin poner en riesgo el anonimato (D-13). */
  protected readonly suficientesRespuestas = computed(
    () => this.respuestas().length >= UMBRAL_MINIMO_RESPUESTAS,
  );

  /**
   * El dashboard que pide FT-29: un gráfico de barras por pregunta.
   *
   * Se arma en el cliente a partir de `respuestas()`, ya cargadas para la
   * lista de abajo — no hace falta un endpoint de agregación nuevo. Vacío
   * mientras no haya respuestas suficientes: ver {@link UMBRAL_MINIMO_RESPUESTAS}.
   */
  protected readonly resumenPorPregunta = computed<readonly ResumenDePregunta[]>(() => {
    const encuesta = this.encuesta();
    if (!encuesta || !this.suficientesRespuestas()) return [];
    return encuesta.questions.map((pregunta) => resumirPregunta(pregunta, this.respuestas()));
  });

  /** Si la pantalla está mostrando la vista previa en vez de la lista de preguntas. */
  protected readonly enPrevia = signal(false);

  /** El texto de cada pregunta por id, para rotular las respuestas recibidas. */
  protected readonly textoDePregunta = computed(
    () => new Map((this.encuesta()?.questions ?? []).map((p) => [p.id, p.questionText])),
  );

  /** Published: there may be responses to read. */
  protected readonly publicada = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' && actual.data.published;
  });

  constructor() {
    this.cargar();
  }

  /** Trae la encuesta con su cuestionario. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.getSurvey(this.surveyId).subscribe({
      next: (encuesta) => {
        this.estado.set(ready(encuesta));
        // Sin publicar no hay nada recogido que pedir, y el estado vuelve a
        // cero: un 403 de una lectura anterior no puede quedar pegado a una
        // encuesta que ya no consulta respuestas.
        if (encuesta.published) this.cargarRespuestas();
        else this.estadoRespuestas.set(ready([]));
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /**
   * Trae las respuestas recibidas.
   *
   * El fallo se guarda **en su propio estado** y no en el de la ficha: el
   * cuestionario sigue siendo legible aunque lo recogido no haya
   * llegado, y volcar un 403 de respuestas sobre `estado` convertiría la
   * pantalla entera en un muro. Lo que ya no
   * pasa es que el fallo se pierda: un 403 queda como S5, un 404 como S6 y
   * cualquier otro como S9, y ninguno de los tres se confunde con «no hay
   * respuestas».
   */
  protected cargarRespuestas(): void {
    this.estadoRespuestas.set(loading());
    this.surveys.listResponses(this.surveyId).subscribe({
      next: (recibidas) => this.estadoRespuestas.set(ready(recibidas)),
      error: (error: unknown) => this.estadoRespuestas.set(errorToViewState(error)),
    });
  }

  /** Toggles between the question list and the preview. */
  protected alternarPrevia(): void {
    this.enPrevia.update((activa) => !activa);
  }

  /** Texto legible de una respuesta, sea del tipo que sea. */
  protected valorDe(answer: SurveyResponse['answers'][number]): string {
    if (answer.valueText !== undefined) return answer.valueText;
    if (answer.valueNumber !== undefined) return String(answer.valueNumber);
    if (answer.valueBoolean !== undefined) return answer.valueBoolean ? 'Sí' : 'No';
    if (answer.valueChoices !== undefined) return answer.valueChoices.join(', ');
    return '—';
  }

  /**
   * Descarga las respuestas en CSV: una fila por respuesta, una columna por
   * pregunta. Se arma en el cliente porque los mismos datos ya están acá
   * (`respuestas()`) — no hace falta ida y vuelta al servidor.
   *
   * **Anónimo a propósito** (FT-29): ninguna columna identifica al paciente,
   * porque el contrato del servidor tampoco lo manda. Por lo mismo la fecha es
   * sólo el día (`AAAA-MM-DD`): sin hora ni reserva, una fila no se atribuye a
   * una cita concreta.
   */
  protected descargarCsv(): void {
    const encuesta = this.encuesta();
    // Defensa en profundidad: el botón ya está oculto por debajo del umbral,
    // pero esta función no debería exportar un CSV identificable ni aunque
    // alguien la invoque de otra forma.
    if (!encuesta || !this.suficientesRespuestas()) return;

    const encabezado = ['Fecha de envío', ...encuesta.questions.map((p) => p.questionText)];
    const filas = this.respuestas().map((respuesta) => {
      const porPregunta = new Map(respuesta.answers.map((a) => [a.questionId, this.valorDe(a)]));
      return [
        diaDeEnvio(respuesta.submittedAt),
        ...encuesta.questions.map((p) => porPregunta.get(p.id) ?? ''),
      ];
    });

    const csv = [encabezado, ...filas]
      .map((fila) => fila.map(celdaCsv).join(','))
      .join('\r\n');
    // BOM al frente: sin él, Excel en Windows adivina Latin-1 y descompone
    // toda tilde y «ñ» de las preguntas y respuestas.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${slugify(encuesta.title)}-respuestas.csv`;
    enlace.click();
    releaseObjectUrlLater(url);
  }
}

/**
 * Una barra por etiqueta, con su porcentaje sobre `total`.
 *
 * Es la parte de `resumirPregunta` que no depende de cómo llegaron las
 * respuestas: la reutiliza el resumen general del profesional
 * (`insights/survey-insights.logic.ts`), que recibe los conteos ya agregados por
 * el servidor en vez de respuestas sueltas.
 */
export function armarBarras(
  total: number,
  etiquetas: readonly string[],
  cantidadDe: (etiqueta: string) => number,
): readonly BarraDeResumen[] {
  return etiquetas.map((etiqueta) => {
    const cantidad = cantidadDe(etiqueta);
    return { etiqueta, cantidad, porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 100) };
  });
}

/**
 * El día de envío de una respuesta, `AAAA-MM-DD`, en UTC (el servidor lo manda
 * redondeado al día a medianoche UTC). Sin fecha, vacío. Nunca la hora.
 */
export function diaDeEnvio(fecha: Date | null): string {
  return fecha === null || Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}

/** Arma el resumen (barras + promedio) de una pregunta a partir de las respuestas recibidas. */
export function resumirPregunta(
  pregunta: SurveyQuestion,
  respuestas: readonly SurveyResponse[],
): ResumenDePregunta {
  const respondidas = respuestas
    .map((r) => r.answers.find((a) => a.questionId === pregunta.id))
    .filter((a): a is SurveyResponse['answers'][number] => a !== undefined);
  const total = respondidas.length;

  const conBarras = (etiquetas: readonly string[], cantidadDe: (etiqueta: string) => number) =>
    armarBarras(total, etiquetas, cantidadDe);

  let barras: readonly BarraDeResumen[] = [];
  let promedio: number | null = null;

  switch (pregunta.answerType) {
    case 'BOOLEAN':
      barras = conBarras(
        ['Sí', 'No'],
        (etiqueta) => respondidas.filter((a) => a.valueBoolean === (etiqueta === 'Sí')).length,
      );
      break;
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      barras = conBarras(
        pregunta.options ?? [],
        (opcion) => respondidas.filter((a) => a.valueChoices?.includes(opcion)).length,
      );
      break;
    case 'SCALE': {
      const min = pregunta.scaleMin ?? 1;
      const max = pregunta.scaleMax ?? 5;
      const valores = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
      barras = conBarras(
        valores.map(String),
        (etiqueta) => respondidas.filter((a) => a.valueNumber === Number(etiqueta)).length,
      );
      const numeros = respondidas
        .map((a) => a.valueNumber)
        .filter((n): n is number => n !== undefined);
      promedio = numeros.length === 0 ? null : numeros.reduce((a, b) => a + b, 0) / numeros.length;
      break;
    }
    case 'TEXT':
      // Texto libre no se resume en barras: cada respuesta es distinta y
      // agruparlas no diría nada. La lista de respuestas de abajo ya las
      // muestra completas.
      break;
  }

  return {
    questionId: pregunta.id,
    questionText: pregunta.questionText,
    answerType: pregunta.answerType,
    totalRespondida: total,
    promedio,
    barras,
  };
}

/** Encierra en comillas sólo si hace falta, duplicando las internas (RFC 4180). */
export function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Nombre de archivo seguro a partir del título de la encuesta. */
export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'encuesta'
  );
}
