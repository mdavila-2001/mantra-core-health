import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { catchError, forkJoin, of, type Subscription } from 'rxjs';

import { SurveysCatalogClient, type SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';
import { SurveysServiceAssignmentsClient } from '../../../core/data-access/surveys/surveys-service-assignments.client';
import type { ServiceSurveyAssignments } from '../../../core/data-access/surveys/surveys-service-assignments.types';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { SurveyInsightsPanel } from '../insights/survey-insights';
import { SurveyCard, type SurveyCardData } from '../survey-card/survey-card';
import { encuestaRoute } from '../questionnaires.routes';
import { readFailureState } from '../service-surveys/service-surveys.logic';
import { PAST_SURVEY_LABEL, sendingStatusOf } from '../survey-detail/survey-detail.logic';

/** Diacritics left loose by `normalize('NFD')`. */
const DIACRITICS = /[̀-ͯ]/g;

const SENDING_ORDER = { yes: 0, unknown: 1, no: 2 } as const;

const LABELS = {
  yes: { label: 'Se envía', tone: 'success' },
  no: { label: PAST_SURVEY_LABEL, tone: 'warning' },
  unknown: { label: 'Envío sin confirmar', tone: 'secondary' },
} as const;

/** Comparable text: no case, no accents, no extra spaces («satisfaccion» finds «Satisfacción»). */
function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A survey ready to show, with its searchable text computed once. */
interface InboxSurvey extends SurveyCardData {
  readonly searchable: string;
}

/**
 * «Buzón» (06/11/2026): the first sub-tab of «Encuestas», READ-ONLY. The «Cómo
 * le va» summary on top and, below, the surveys whose answers can be read
 * (`GET /surveys/catalog`). Nothing is managed here: no editing, no status
 * filters, no drafts. A practitioner survey is sent only when it is the
 * catalog survey imported for one of their services (its template is in
 * `GET /surveys/service-assignments`); any other hand-made survey is a past one
 * («ya no se envía»), and without the service list it is «sin confirmar». Sent
 * ones come first. Unsent drafts have no answers and are not listed. Search
 * stays client-side (no `?q=` in the API).
 */
@Component({
  selector: 'app-surveys-inbox',
  imports: [AppButton, EmptyState, SearchField, Skeleton, SurveyCard, SurveyInsightsPanel, ViewStateHost],
  templateUrl: './surveys-inbox.html',
  styleUrl: './surveys-inbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveysInbox {
  /** The S3 asks to go to «Encuestas por servicio»; the host switches the tab. */
  readonly goToServices = output<void>();

  private readonly catalog = inject(SurveysCatalogClient);
  private readonly assignments = inject(SurveysServiceAssignmentsClient);
  private readonly state = signal<ViewState<readonly InboxSurvey[]>>(loading());
  protected readonly view = this.state.asReadonly();

  /** What was typed in the search box, as is. Normalized when comparing. */
  protected readonly query = signal('');

  protected readonly loaded = computed<readonly InboxSurvey[]>(() => dataOf(this.view()) ?? []);

  protected readonly visible = computed<readonly InboxSurvey[]>(() => {
    const term = normalize(this.query());
    return term === '' ? this.loaded() : this.loaded().filter((survey) => survey.searchable.includes(term));
  });

  /** There are surveys but none matches: NOT the domain S3. */
  protected readonly noResults = computed(() => this.loaded().length > 0 && this.visible().length === 0);

  /** The S3 explanation, unwrapped here: the projected empty node has no control block to narrow the type. */
  protected readonly emptyMessage = computed(() => {
    const state = this.view();
    return state.status === 'empty' ? (state.message ?? '') : '';
  });

  /** The read in flight: a new load cancels it (no stale overwrite). */
  private read?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.read?.unsubscribe());
    this.load();
  }

  protected load(): void {
    this.read?.unsubscribe();
    this.state.set(loading());
    // Which templates services send today. If it fails, the inbox still shows (nothing claimed).
    const assignments = this.assignments.list().pipe(catchError(() => of(null)));
    this.read = forkJoin([this.catalog.list(), assignments]).subscribe({
      next: ([entries, sent]) => {
        // What is sent today first, then what cannot be confirmed, then past surveys; server order within each.
        const shown = entries
          .map((entry) => this.toInbox(entry, entries, sent))
          .filter((s) => s.sending === 'yes' || s.status !== 'DRAFT')
          .sort((a, b) => SENDING_ORDER[a.sending] - SENDING_ORDER[b.sending]);
        this.state.set(
          shown.length === 0
            ? empty(
                { label: 'Importar una encuesta para un servicio' },
                'Todavía no tiene encuestas con respuestas. Para usar una estándar en un servicio, impórtela desde «Encuestas por servicio».',
              )
            : ready(shown),
        );
      },
      error: (error: unknown) =>
        this.state.set(readFailureState(error, 'No pudimos cargar sus encuestas', 'El servidor tuvo un problema al leer la lista de sus encuestas.')),
    });
  }

  protected clearSearch(): void {
    this.query.set('');
  }

  /** Sent today or not: the single rule of `sendingStatusOf`, shared with the survey sheet. */
  private toInbox(entry: SurveyCatalogEntry, catalog: readonly SurveyCatalogEntry[], sent: ServiceSurveyAssignments | null): InboxSurvey {
    const sending = sendingStatusOf(entry.id, catalog, sent);
    return {
      ...entry,
      sending,
      ...LABELS[sending],
      route: encuestaRoute(entry.id),
      searchable: normalize(`${entry.title} ${entry.description ?? ''}`),
    };
  }
}
