import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { SurveysCatalogClient, type SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';
import { SurveysServiceAssignmentsClient } from '../../../core/data-access/surveys/surveys-service-assignments.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
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

/** Diacritics left loose by `normalize('NFD')`. */
const DIACRITICS = /[̀-ͯ]/g;

export const CURRENT_LABEL = 'Se envía';
export const PAST_LABEL = 'Encuesta anterior (ya no se envía)';

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
 * filters, no drafts. A practitioner survey is «current» only when it is the
 * catalog survey imported for one of their services (its template is in
 * `GET /surveys/service-assignments`); any other hand-made survey is shown as
 * a past one («ya no se envía»), never as active. Unsent drafts have no
 * answers and are not listed. Search stays client-side (no `?q=` in the API).
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

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    // Which templates are sent today. If it fails, the inbox still shows (all as readable).
    const currentTemplates = this.assignments.list().pipe(
      map((data) => new Set(data.services.flatMap((row) => (row.assignment ? [row.assignment.templateId] : [])))),
      catchError(() => of(null)),
    );
    forkJoin([this.catalog.list(), currentTemplates]).subscribe({
      next: ([entries, current]) => {
        const shown = entries.map((entry) => this.toInbox(entry, current)).filter((s) => s.current || s.status !== 'DRAFT');
        this.state.set(
          shown.length === 0
            ? empty(
                { label: 'Importar una encuesta para un servicio' },
                'Todavía no tiene encuestas con respuestas. Para usar una estándar en un servicio, impórtela desde «Encuestas por servicio».',
              )
            : ready(shown),
        );
      },
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected clearSearch(): void {
    this.query.set('');
  }

  private toInbox(entry: SurveyCatalogEntry, currentTemplates: ReadonlySet<string> | null): InboxSurvey {
    const current =
      entry.origin === 'SYSTEM' ||
      (currentTemplates === null
        ? entry.assignments.some((a) => a.targetType === 'SERVICE')
        : currentTemplates.has(entry.id));
    return {
      ...entry,
      current,
      label: current ? CURRENT_LABEL : PAST_LABEL,
      tone: current ? 'success' : 'secondary',
      route: encuestaRoute(entry.id),
      searchable: normalize(`${entry.title} ${entry.description ?? ''}`),
    };
  }
}
