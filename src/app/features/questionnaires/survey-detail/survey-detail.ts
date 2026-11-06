import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, type Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { BackLink } from '../../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { releaseObjectUrlLater } from '../../../shared/utils/file-download/release-object-url';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { SurveyForm } from '../../../shared/components/organisms/survey-form/survey-form';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { QuestionView } from './question-view/question-view';
import { celdaCsv, MIN_COHORT, resumirPregunta, sendingLabelOf, sendingStatusOf, SHEET_TABS, slugify, submissionDay, tabOfFragment, type QuestionSummary, type SendingStatus } from './survey-detail.logic';
import { ENCUESTAS_ROUTE, SERVICE_SURVEYS_QUERY } from '../questionnaires.routes';
import { readFailureState } from '../service-surveys/service-surveys.logic';


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
    AppButton,
    AppButtonLink,
    BackLink,
    Badge,
    Card,
    DatePipe,
    DecimalPipe,
    EmptyState,
    Link,
    NgTemplateOutlet,
    PageHeader,
    QuestionView,
    RouterLink,
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
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  /** Where the sheet goes back to: the list it came from. */
  protected readonly rutaDeLasEncuestas = ENCUESTAS_ROUTE;
  protected readonly serviceSurveysQuery = SERVICE_SURVEYS_QUERY;

  private readonly surveyId = this.route.snapshot.paramMap.get('surveyId') ?? '';

  private readonly estado = signal<ViewState<SurveyDetail>>(loading());
  protected readonly vista = this.estado.asReadonly();

  /** The data when there is some (the template cannot index the state union). */
  protected readonly encuesta = computed(() => dataOf(this.estado()));

  /**
   * The answers received, as a VIEW STATE, not a bare list: reading answers is
   * a permission of its own, so `GET …/responses` can be 403 on a survey the
   * session may open. A refusal or a failure is never «nadie respondió».
   */
  protected readonly estadoRespuestas = signal<ViewState<readonly SurveyResponse[]>>(loading());

  /** The answers when there are some; empty in any state without data. */
  protected readonly respuestas = computed(() => dataOf(this.estadoRespuestas()) ?? []);

  /**
   * The answers as ONE view state, drawn by `app-view-state-host` in both the
   * Resumen and the Respuestas tabs: none yet is S3 with a next action; a refusal
   * S5, missing S6, offline S8, anything else S9 with retry — never «nadie respondió».
   */
  protected readonly answersView = computed<ViewState<readonly SurveyResponse[]>>(() => {
    const state = this.estadoRespuestas();
    if (state.status !== 'ready' || state.data.length > 0) return state;
    return empty(
      { label: 'Ver qué encuesta recibe cada servicio', route: ENCUESTAS_ROUTE, queryParams: SERVICE_SURVEYS_QUERY },
      'Las respuestas llegan cuando sus pacientes completan la encuesta después de una atención.',
      'Todavía no respondió nadie',
    );
  });

  /** The same state in «Resumen»: a failed read says the SUMMARY could not be loaded. */
  protected readonly summaryView = computed<ViewState<readonly SurveyResponse[]>>(() => {
    const state = this.answersView();
    return state.status === 'error' ? { ...state, title: 'No pudimos cargar el resumen' } : state;
  });

  protected readonly minCohort = MIN_COHORT;
  protected readonly belowMinimumMessage = computed(
    () =>
      `Todavía no hay suficientes respuestas para mostrar el resumen: se necesitan al menos ${MIN_COHORT} para proteger la privacidad de sus pacientes; llevan ${this.respuestas().length}.`,
  );

  /** Enough answers for an aggregate or a CSV without risking anonymity (D-13). */
  protected readonly suficientesRespuestas = computed(() => this.respuestas().length >= MIN_COHORT);

  /** One bar chart per question, built from the answers already loaded; empty below the threshold. */
  protected readonly resumenPorPregunta = computed<readonly QuestionSummary[]>(() => {
    const encuesta = this.encuesta();
    if (!encuesta || !this.suficientesRespuestas()) return [];
    return encuesta.questions.map((pregunta) => resumirPregunta(pregunta, this.respuestas()));
  });

  /** Whether the questionnaire tab shows it as the patient sees it. */
  protected readonly enPrevia = signal(false);

  /** Each question's text by id, to label the answers received. */
  protected readonly textoDePregunta = computed(
    () => new Map((this.encuesta()?.questions ?? []).map((p) => [p.id, p.questionText])),
  );

  /** Whether this survey is sent today; `null` while it is being checked. */
  protected readonly sending = signal<SendingStatus | null>(null);
  protected readonly sendingLabel = computed(() => sendingLabelOf(this.encuesta()?.published ?? false, this.sending()));

  /** The asked tab: Preguntas · Resumen · Respuestas. `#resumen` / `#respuestas` deep-link to theirs. */
  private readonly selectedTab = signal(tabOfFragment(this.route.snapshot.fragment));
  /** The tab actually shown: an unpublished survey only has «Preguntas», whatever the link asked. */
  protected readonly activeTab = computed(() => Math.min(this.selectedTab(), this.publicada() ? SHEET_TABS.length : 0));

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

  private answersRead?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.answersRead?.unsubscribe());
    // A link that changes only the fragment (#resumen, #respuestas) also opens its tab.
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => this.selectedTab.set(tabOfFragment(fragment)));
    this.cargar();
    // Sent today = a system base survey, or the template a service uses now. Either read may fail on its own.
    forkJoin([
      this.catalog.list().pipe(catchError(() => of(null))),
      this.serviceAssignments.list().pipe(catchError(() => of(null))),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([catalog, assignments]) => this.sending.set(sendingStatusOf(this.surveyId, catalog, assignments)));
  }

  /** Opens a tab and writes it to the URL fragment, so the link can be shared and reloaded. */
  protected selectTab(index: number): void {
    this.selectedTab.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: index === 0 ? undefined : SHEET_TABS[index - 1],
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  /** Loads the survey with its questions. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.getSurvey(this.surveyId).subscribe({
      next: (encuesta) => {
        this.estado.set(ready(encuesta));
        // Unpublished: no answers to ask for (and no stale 403 left behind).
        if (encuesta.published) this.cargarRespuestas();
        else this.estadoRespuestas.set(ready([]));
        // A link to a tab this survey does not have: the URL says what is shown.
        if (!encuesta.published && this.selectedTab() > 0) this.selectTab(0);
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /**
   * Loads the answers into their OWN state: the questionnaire stays readable if
   * they fail (403 → S5, 404 → S6, offline → S8, else S9). A new load cancels the
   * one in flight; leaving the screen cancels it too.
   */
  protected cargarRespuestas(): void {
    this.answersRead?.unsubscribe();
    this.estadoRespuestas.set(loading());
    this.answersRead = this.surveys.listResponses(this.surveyId).subscribe({
      next: (recibidas) => this.estadoRespuestas.set(ready(recibidas)),
      error: (error: unknown) => {
        const state = readFailureState<readonly SurveyResponse[]>(error, 'No pudimos cargar las respuestas', 'El servidor tuvo un problema al leer las respuestas de esta encuesta.');
        // A refusal says what was refused, not «esta sección».
        this.estadoRespuestas.set(
          state.status === 'forbidden'
            ? { ...state, title: 'No tiene acceso a las respuestas', message: 'Su rol o permiso no alcanza para leer las respuestas de esta encuesta.' }
            : state,
        );
      },
    });
  }

  /** Toggles between the question list and the preview. */
  protected alternarPrevia(): void {
    this.enPrevia.update((activa) => !activa);
  }

  /** An answer as readable text, whatever its type. */
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
