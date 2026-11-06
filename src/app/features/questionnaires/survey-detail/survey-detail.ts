import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import { SurveysCatalogClient } from '../../../core/data-access/surveys/surveys-catalog.client';
import { SurveysServiceAssignmentsClient } from '../../../core/data-access/surveys/surveys-service-assignments.client';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import type {
  SurveyDetail,
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
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { SurveyForm } from '../../../shared/components/organisms/survey-form/survey-form';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { QuestionView } from './question-view/question-view';
import { celdaCsv, resumirPregunta, sendingLabelOf, sendingStatusOf, SHEET_TABS, slugify, submissionDay, type QuestionSummary, type SendingStatus } from './survey-detail.logic';
import { ENCUESTAS_ROUTE, SERVICE_SURVEYS_QUERY } from '../questionnaires.routes';

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

/**
 * A survey's sheet, READ-ONLY (06/11/2026), in ONE card with tabs
 * (composition-rules §5): identity, status and the read-only notice on top,
 * then Preguntas · Resumen · Respuestas. Hand-made surveys are no longer edited, published,
 * attached or deactivated — the API rejects new non-catalog assignments
 * (`SURVEY_ASSIGNMENT_REQUIRES_CATALOG_TEMPLATE`) — so the sheet points to
 * «Encuestas por servicio», where each service's standard survey is chosen.
 */
@Component({
  selector: 'app-survey-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    BackLink,
    Badge,
    Card,
    DatePipe,
    DecimalPipe,
    EmptyState,
    PageHeader,
    QuestionView,
    RouterLink,
    Skeleton,
    SurveyForm,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyDetailScreen {
  private readonly surveys = inject(SurveysClient);
  private readonly serviceAssignments = inject(SurveysServiceAssignmentsClient);
  private readonly catalog = inject(SurveysCatalogClient);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  /** A dónde vuelve quien entró a una encuesta: al listado del que salió. */
  protected readonly rutaDeLasEncuestas = ENCUESTAS_ROUTE;
  protected readonly serviceSurveysQuery = SERVICE_SURVEYS_QUERY;

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

  /** The 403 reason for the answers, as S5: never read as «nadie respondió». */
  protected readonly motivoRespuestasProhibidas = computed(() => {
    const actual = this.estadoRespuestas();
    return actual.status === 'forbidden'
      ? (actual.message ?? 'Su rol o el propósito de uso declarado no alcanzan para ver este contenido.')
      : '';
  });

  /** Si ya hay respuestas suficientes para un agregado o un CSV sin poner en riesgo el anonimato (D-13). */
  protected readonly suficientesRespuestas = computed(() => this.respuestas().length >= UMBRAL_MINIMO_RESPUESTAS);

  /** One bar chart per question, built from the answers already loaded; empty below the threshold. */
  protected readonly resumenPorPregunta = computed<readonly QuestionSummary[]>(() => {
    const encuesta = this.encuesta();
    if (!encuesta || !this.suficientesRespuestas()) return [];
    return encuesta.questions.map((pregunta) => resumirPregunta(pregunta, this.respuestas()));
  });

  /** Whether the questionnaire tab shows it as the patient sees it. */
  protected readonly enPrevia = signal(false);

  /** El texto de cada pregunta por id, para rotular las respuestas recibidas. */
  protected readonly textoDePregunta = computed(
    () => new Map((this.encuesta()?.questions ?? []).map((p) => [p.id, p.questionText])),
  );

  /** Whether this survey is sent today; `null` while it is being checked. */
  protected readonly sending = signal<SendingStatus | null>(null);
  protected readonly sendingLabel = computed(() => sendingLabelOf(this.encuesta()?.published ?? false, this.sending()));

  /** The open tab: Preguntas · Resumen · Respuestas. `#resumen` / `#respuestas` deep-link to theirs. */
  protected readonly selectedTab = signal(SHEET_TABS.indexOf(this.route.snapshot.fragment as (typeof SHEET_TABS)[number]) + 1 || 0);

  /** The section's crumbs, then the survey itself (the section becomes a link back). */
  protected readonly crumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const title = this.encuesta()?.title;
    if (title === undefined || base.length === 0) return base;
    return [...base.slice(0, -1), { ...base[base.length - 1]!, routerLink: ENCUESTAS_ROUTE }, { label: title }];
  });

  /** Published: there may be responses to read. */
  protected readonly publicada = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' && actual.data.published;
  });

  constructor() {
    this.cargar();
    // Sent today = a system base survey, or the template a service uses now. Either read may fail on its own.
    forkJoin([
      this.catalog.list().pipe(catchError(() => of(null))),
      this.serviceAssignments.list().pipe(catchError(() => of(null))),
    ]).subscribe(([catalog, assignments]) => this.sending.set(sendingStatusOf(this.surveyId, catalog, assignments)));
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
        submissionDay(respuesta.submittedAt),
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
