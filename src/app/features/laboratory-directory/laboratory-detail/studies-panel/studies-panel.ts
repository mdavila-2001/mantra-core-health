import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, linkedSignal, model,
} from '@angular/core';

import type { DiagnosticStudy } from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { LabAreaFilter } from '../area-filter/area-filter';
import { filterStudies, studyAreas } from '../study-filter';
import { LabStudyCard } from '../study-card/study-card';

/**
 * From how many studies the search box shows up. With fewer, they all fit on
 * screen and a search over what is already visible suggests something hidden.
 */
const SEARCH_THRESHOLD = 7;

/** Cards drawn per batch: a 252-study catalogue is otherwise one endless wall. */
const BATCH = 24;

/**
 * The Studies tab: what the centre offers, narrowed by text and by area, drawn
 * in batches. The search term and the area belong to the parent sheet, which
 * resets them when it opens another centre.
 */
@Component({
  selector: 'app-lab-studies-panel',
  imports: [AppButton, AppButtonLink, LabAreaFilter, RouterLink, LabStudyCard, SearchField, SectionHeading],
  templateUrl: './studies-panel.html',
  styleUrls: [
    '../../../../shared/styles/card-grid.css',
    '../../../../shared/styles/public-sheet.css',
    './studies-panel.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabStudiesPanel {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly studies = input.required<readonly DiagnosticStudy[]>();
  readonly term = model('');
  readonly area = model<string | null>(null);

  protected readonly SEARCH_THRESHOLD = SEARCH_THRESHOLD;
  protected readonly areas = computed(() => studyAreas(this.studies()));
  protected readonly matches = computed(() => filterStudies(this.studies(), this.area(), this.term()));

  /** How many matches are drawn; back to one batch whenever the filter changes. */
  protected readonly limit = linkedSignal({ source: this.matches, computation: () => BATCH });
  protected readonly shown = computed(() => this.matches().slice(0, this.limit()));
  protected readonly remaining = computed(() => this.matches().length - this.shown().length);
  protected readonly nextBatch = computed(() => Math.min(BATCH, this.remaining()));

  /** «2 de 11 estudios» while a filter is on; empty (and hidden) otherwise. */
  protected readonly countText = computed(() =>
    (this.area() !== null || this.term() !== '') && this.matches().length > 0
      ? `${this.matches().length} de ${this.studies().length} estudios`
      : '',
  );

  /** Draws the next batch and moves focus to its first card, not to `body`. */
  protected showMore(): void {
    const first = this.shown().length;
    this.limit.update((value) => value + BATCH);
    afterNextRender(
      () => this.host.nativeElement.querySelectorAll<HTMLElement>('[data-testid="unit-studies"] > li')[first]?.focus(),
      { injector: this.injector },
    );
  }
}
