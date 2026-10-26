import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, type Subscription } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { GlossaryNeighborhood } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { RelationEvidence } from '../../shared/components/molecules/relation-evidence/relation-evidence';
import { hasNoEvidence } from '../../shared/components/molecules/relation-evidence/relation-evidence.logic';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { RelationGroups } from '../../shared/components/organisms/relation-groups/relation-groups';
import type { RelationColumnView } from '../../shared/components/organisms/relation-groups/relation-groups.types';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { compareNeighborhoods, type SplitNeighbors } from './glossary-compare.logic';
import { GlossaryTermSearch } from './glossary-term-search';

/**
 * Cuántos vecinos se piden por grupo para comparar: el máximo que acepta el
 * contrato de `glossary-neighborhood`. Con la muestra de 8 del mapa, dos
 * enfermedades parecerían no compartir casi nada.
 */
const COMPARE_PER_GROUP = 50;

interface ComparedPair {
  readonly a: GlossaryNeighborhood;
  readonly b: GlossaryNeighborhood;
}

type Side = 'a' | 'b';

/**
 * Comparador diferencial del glosario (TAREA-41 F5.3):
 * `/glossary/compare?a=<id>&b=<id>`.
 *
 * Pone dos términos —típicamente dos enfermedades— lado a lado: los hallazgos
 * que comparten, los que distinguen a cada uno y los estudios que sólo pide
 * uno de los dos. Lee los dos vecindarios y compara del lado del cliente; los
 * vecinos se pintan con el mismo organismo y los mismos sellos que el mapa.
 */
@Component({
  selector: 'app-glossary-compare',
  imports: [
    Card,
    EmptyState,
    FormField,
    PageHeader,
    ReferenceCombobox,
    RelationEvidence,
    RelationGroups,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './glossary-compare.html',
  styleUrl: './glossary-compare.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryCompare {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly perGroupLimit = COMPARE_PER_GROUP;
  protected readonly hasNoEvidence = hasNoEvidence;
  protected readonly searchA = new GlossaryTermSearch(this.terminology);
  protected readonly searchB = new GlossaryTermSearch(this.terminology);

  private readonly ids = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({ a: params.get('a') ?? '', b: params.get('b') ?? '' })),
    ),
    {
      initialValue: {
        a: this.route.snapshot.queryParamMap.get('a') ?? '',
        b: this.route.snapshot.queryParamMap.get('b') ?? '',
      },
    },
  );
  protected readonly aId = computed(() => this.ids().a);
  protected readonly bId = computed(() => this.ids().b);
  protected readonly missingTerm = computed(() => this.aId() === '' || this.bId() === '');
  protected readonly sameTerm = computed(() => !this.missingTerm() && this.aId() === this.bId());

  protected readonly pair = signal<ViewState<ComparedPair>>(loading());
  protected readonly data = computed(() => {
    const state = this.pair();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly comparison = computed(() => {
    const data = this.data();
    return data === null ? null : compareNeighborhoods(data.a, data.b);
  });

  protected readonly findingColumns = computed(() => this.columnsOf('findings', 'Sólo en'));
  protected readonly studyColumns = computed(() => this.columnsOf('studies', 'Sólo para'));

  protected readonly selectedA = computed(() => this.optionOf('a'));
  protected readonly selectedB = computed(() => this.optionOf('b'));

  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const ids = this.ids();
      untracked(() => this.load(ids.a, ids.b));
    });
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.searchA.dispose();
      this.searchB.dispose();
    });
  }

  protected choose(side: Side, option: ReferenceOption | null): void {
    if (option === null || option.value === this.ids()[side]) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [side]: option.value },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    this.load(this.aId(), this.bId());
  }

  /** Las dos columnas «sólo en A» / «sólo en B» para el organismo de relaciones. */
  private columnsOf(part: 'findings' | 'studies', prefix: string): readonly RelationColumnView[] {
    const pair = this.data();
    const comparison = this.comparison();
    if (pair === null || comparison === null) return [];
    const split = comparison[part];
    return [
      { key: 'only-a', title: `${prefix} ${pair.a.focus.display}`, items: split.onlyA, count: split.onlyA.length },
      { key: 'only-b', title: `${prefix} ${pair.b.focus.display}`, items: split.onlyB, count: split.onlyB.length },
    ];
  }

  protected sharedNames(split: SplitNeighbors): string {
    return split.shared.map((item) => item.display).join(', ');
  }

  private optionOf(side: Side): ReferenceOption | null {
    const focus = this.data()?.[side].focus;
    if (focus === undefined || focus.conceptId !== this.ids()[side]) return null;
    return { value: focus.conceptId, label: focus.display, ...(focus.category ? { hint: focus.category.name } : {}) };
  }

  private load(a: string, b: string): void {
    this.request?.unsubscribe();
    this.pair.set(loading());
    if (a === '' || b === '' || a === b) return;
    this.request = forkJoin({
      a: this.terminology.readGlossaryNeighborhood(a, { perGroup: COMPARE_PER_GROUP }),
      b: this.terminology.readGlossaryNeighborhood(b, { perGroup: COMPARE_PER_GROUP }),
    }).subscribe({
      next: (pair) => this.pair.set(ready(pair)),
      error: (error: unknown) => this.pair.set(errorToViewState<ComparedPair>(error)),
    });
  }
}
