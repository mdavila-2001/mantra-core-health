import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SurveysClient } from '../../../../core/data-access/surveys/surveys.client';
import type {
  PatientQuestionnaire,
  SurveyAnswerInput,
  SurveyQuestion,
} from '../../../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SurveyForm } from '../../../../shared/components/organisms/survey-form/survey-form';
import type {
  RespuestasDelCuestionario,
  ValorDeRespuesta,
} from '../../../../shared/components/organisms/survey-form/survey-form';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MIS_CUESTIONARIOS_ROUTE } from '../questionnaires.routes';

/**
 * Responder un cuestionario.
 *
 * ## Por qué el formulario se arma solo
 *
 * Las preguntas y sus tipos los decide el profesional al publicar la encuesta,
 * así que la pantalla no puede tener campos escritos a mano: recorre las
 * preguntas de la versión y pinta el control que corresponde a cada tipo. Es la
 * contracara directa del editor del otro lado.
 *
 * ## Por qué se valida acá además de en el servidor
 *
 * El backend rechaza un envío incompleto o con un valor fuera de rango, y esa
 * es la palabra final. Pero un 422 después de contestar quince preguntas es una
 * mala forma de enterarse de que faltaba la tercera: la comprobación local
 * existe para señalar **cuál** falta antes de mandar, no para reemplazar la del
 * servidor.
 *
 * ## El envío es único
 *
 * No hay guardado parcial. El backend acepta una respuesta por invitación y
 * nada más, así que la pantalla no ofrece un «guardar borrador» que no podría
 * cumplir.
 */
@Component({
  selector: 'app-questionnaire-answer',
  imports: [Alert, AppButton, BackLink, PageHeader, Skeleton, SurveyForm, ViewStateHost],
  templateUrl: './answer.html',
  styleUrl: './answer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionnaireAnswer {
  private readonly surveys = inject(SurveysClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  /** A dónde vuelve quien entró a responder: al listado del que salió. */
  protected readonly rutaDeMisCuestionarios = MIS_CUESTIONARIOS_ROUTE;

  private readonly invitationId = this.route.snapshot.paramMap.get('invitationId') ?? '';

  private readonly estado = signal<ViewState<PatientQuestionnaire>>(loading());
  protected readonly vista = this.estado.asReadonly();

  /**
   * Lo contestado hasta ahora, por pregunta.
   *
   * `protected` y ya no privado: lo escribe `app-survey-form`, que es quien
   * dibuja los controles. Esta pantalla conserva lo que el organismo no sabe
   * hacer —validar lo obligatorio y armar el envío—, que es su trabajo real.
   */
  protected readonly respuestas = signal<RespuestasDelCuestionario>(new Map());

  /** Las obligatorias que todavía faltan, marcadas tras un intento de envío. */
  protected readonly faltantes = signal<ReadonlySet<string>>(new Set());

  protected readonly enviando = signal(false);

  /** Aviso general del intento fallido, si lo hubo. */
  protected readonly avisoFaltantes = computed(() => {
    const cuantas = this.faltantes().size;
    if (cuantas === 0) return '';
    return cuantas === 1
      ? 'Falta responder una pregunta obligatoria.'
      : `Faltan responder ${cuantas} preguntas obligatorias.`;
  });

  constructor() {
    this.cargar();
  }

  /** Trae el cuestionario a responder. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.getMyQuestionnaire(this.invitationId).subscribe({
      next: (cuestionario) => this.estado.set(ready(cuestionario)),
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /**
   * Una respuesta cambió: se despeja su marca de faltante.
   *
   * El organismo ya guardó el valor —`respuestas` es de dos vías— y avisa acá
   * sólo para que el aviso de «falta responder» se apague en cuanto la pregunta
   * queda contestada, sin esperar a otro intento de envío.
   */
  protected despejar(evento: { questionId: string; valor: ValorDeRespuesta }): void {
    this.despejarFaltante(evento.questionId, evento.valor);
  }

  /** Envía el cuestionario completo. */
  protected enviar(): void {
    const actual = this.estado();
    if (actual.status !== 'ready' || this.enviando()) return;

    const cuestionario = actual.data;
    const sinResponder = cuestionario.questions
      .filter((q) => q.required && !this.tieneValor(q.id))
      .map((q) => q.id);

    if (sinResponder.length > 0) {
      this.faltantes.set(new Set(sinResponder));
      return;
    }
    this.faltantes.set(new Set());

    const answers = cuestionario.questions
      .map((q) => this.aRespuesta(q))
      .filter((r): r is SurveyAnswerInput => r !== null);

    this.enviando.set(true);
    this.surveys.submitAnswers(this.invitationId, answers).subscribe({
      next: () => {
        this.enviando.set(false);
        this.toast.success('Gracias por responder el cuestionario.');
        void this.router.navigateByUrl(MIS_CUESTIONARIOS_ROUTE);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        // El servidor sigue teniendo la última palabra: un plazo vencido o una
        // invitación ya respondida se conocen recién acá.
        this.estado.set(errorToViewState(error));
      },
    });
  }

  /** Si la pregunta tiene un valor utilizable. */
  private tieneValor(questionId: string): boolean {
    const valor = this.respuestas().get(questionId);
    if (valor === undefined || valor === null) return false;
    if (typeof valor === 'string') return valor.trim() !== '';
    if (Array.isArray(valor)) return valor.length > 0;
    return true;
  }

  /** Quita la marca de faltante en cuanto la pregunta queda contestada. */
  private despejarFaltante(questionId: string, valor: ValorDeRespuesta): void {
    if (!this.faltantes().has(questionId)) return;
    const utilizable =
      typeof valor === 'string'
        ? valor.trim() !== ''
        : Array.isArray(valor)
          ? valor.length > 0
          : valor !== null && valor !== undefined;
    if (!utilizable) return;

    const siguiente = new Set(this.faltantes());
    siguiente.delete(questionId);
    this.faltantes.set(siguiente);
  }

  /**
   * Arma la respuesta con **la sola clave** que el tipo de la pregunta admite.
   *
   * Mandar las cuatro con tres en `undefined` haría que el backend —que valida
   * con `forbidNonWhitelisted`— las viera declaradas y devolviera 400. Es el
   * mismo cuidado que tienen los otros clientes al construir `HttpParams`.
   */
  private aRespuesta(question: SurveyQuestion): SurveyAnswerInput | null {
    const valor = this.respuestas().get(question.id);
    if (valor === undefined || valor === null) return null;

    switch (question.answerType) {
      case 'TEXT': {
        const texto = String(valor).trim();
        return texto === '' ? null : { questionId: question.id, valueText: texto };
      }
      case 'SCALE':
        return { questionId: question.id, valueNumber: Number(valor) };
      case 'BOOLEAN':
        return { questionId: question.id, valueBoolean: valor === true || valor === 'true' };
      case 'SINGLE_CHOICE':
        return { questionId: question.id, valueChoices: [String(valor)] };
      case 'MULTIPLE_CHOICE': {
        const elegidas = Array.isArray(valor) ? (valor as readonly string[]) : [];
        return elegidas.length === 0
          ? null
          : { questionId: question.id, valueChoices: elegidas };
      }
      default:
        return null;
    }
  }
}
