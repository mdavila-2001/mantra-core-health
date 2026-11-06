import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, linkedSignal, output } from '@angular/core';

import type {
  ServiceSurveyRow,
  StandardSurvey,
  SurveyServiceKind,
} from '../../../core/data-access/surveys/surveys-service-assignments.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { SupportCode } from '../../../shared/components/molecules/support-code/support-code';
import { answerFormat, questionCount, sortForService, sourcesLine } from './service-surveys.logic';

/**
 * Standard-catalog picker for one service («Importar» / «Cambiar»). A modal
 * because the action asks to choose on an existing record (composition-rules
 * §6): templates on the left as a radio group, recommended for the service kind
 * first; preview of the chosen one (sources and questions) on the right.
 * Choosing only changes the preview; nothing is sent until «Importar». Only
 * opened with a non-empty catalog (the container shows the empty S3 instead).
 * Presentational: the container does the PUT and passes `saving` and `error`;
 * «Importar» is the retry after a failure.
 */
@Component({
  selector: 'app-survey-catalog-picker',
  imports: [Alert, AppButton, Badge, ContentDialog, SupportCode],
  templateUrl: './survey-catalog-picker.html',
  styleUrl: './survey-catalog-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyCatalogPicker {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly service = input.required<ServiceSurveyRow>();
  readonly kind = input.required<SurveyServiceKind>();
  readonly catalog = input.required<readonly StandardSurvey[]>();
  readonly saving = input(false);
  /** The last failed attempt, drawn with the S9 anatomy; `null` if none. */
  readonly error = input<ViewState<never> | null>(null);

  readonly pick = output<string>();
  readonly closed = output<void>();

  /** The failure in words: title, message, hint and support code (never the server's text). */
  protected readonly failure = computed(() => {
    const state = this.error();
    if (state === null) return null;
    if (state.status === 'error') return { title: state.title ?? 'No se pudo importar la encuesta', message: state.message ?? '', hint: state.hint ?? null, requestId: state.requestId };
    if (state.status === 'forbidden') return { title: 'No se pudo importar la encuesta', message: state.message ?? '', hint: null, requestId: state.requestId ?? null };
    return { title: 'No se pudo importar la encuesta', message: 'No hay conexión con el servidor. Revise su red y vuelva a intentar.', hint: null, requestId: null };
  });

  protected readonly options = computed(() => sortForService(this.catalog(), this.kind()));

  /** The one in use in this service, if any. */
  protected readonly inUse = computed(() => this.service().assignment?.catalogCode ?? null);

  /** Chosen in the list: starts on the one in use, else the first recommended. Reset per mount. */
  protected readonly chosen = linkedSignal<string | null>(() => {
    const current = this.inUse();
    if (current !== null && this.catalog().some((e) => e.code === current)) return current;
    return this.options()[0]?.entry.code ?? null;
  });

  protected readonly preview = computed(() => this.catalog().find((entry) => entry.code === this.chosen()) ?? null);

  /** Short on purpose (it has to fit a phone); the service goes in the description. */
  protected readonly heading = computed(() => (this.service().assignment === null ? 'Importar encuesta' : 'Cambiar encuesta'));
  /** One short line, so the header stays compact on a phone; the explanation goes in the body. */
  protected readonly description = computed(() => `Para «${this.service().serviceName}».`);

  /** Importing the one already in use changes nothing: the button does not offer it. */
  protected readonly canImport = computed(() => {
    const chosen = this.chosen();
    return chosen !== null && chosen !== this.inUse() && !this.saving();
  });

  protected readonly answerFormat = answerFormat;
  protected readonly sourcesLine = sourcesLine;
  protected readonly questionCount = questionCount;

  /** Sources with a link to the original instrument. */
  protected linkedSources(entry: StandardSurvey): readonly { instrument: string; url: string }[] {
    return [entry.source, ...(entry.additionalSources ?? [])].flatMap((source) =>
      source.url ? [{ instrument: source.instrument, url: source.url }] : [],
    );
  }

  protected select(code: string): void {
    this.chosen.set(code);
  }

  /** Radio-group keyboard: arrows move the choice and the focus, wrapping around. */
  protected move(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const options = this.options();
    const next = options[(index + step + options.length) % options.length];
    if (next === undefined) return;
    this.chosen.set(next.entry.code);
    this.host.nativeElement.querySelector<HTMLElement>(`[data-testid="standard-catalog-option-${next.entry.code}"]`)?.focus();
  }

  protected importChosen(): void {
    const chosen = this.chosen();
    if (this.canImport() && chosen !== null) this.pick.emit(chosen);
  }
}
