import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Checkbox } from '../../../../../shared/components/atoms/checkbox/checkbox';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { EmptyState } from '../../../../../shared/components/molecules/empty-state/empty-state';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  buildSearchIndex,
  chosenAnalyses,
  countBySection,
  filterAnalyses,
  highlightSegments,
  parentState,
  queryTokens,
  removeAnalysis,
  isSimpleAnalysis,
  setSpecimen,
  summarize,
  summaryText,
  toggleAnalysis,
  toggleComponent,
  type HighlightSegment,
  type LabAnalysisOption,
  type LabFilterHit,
  type LabSectionOption,
  type LabSelection,
} from './lab-analysis-picker.logic';

export type LabPickerView = 'grid' | 'list';

/** Cuántos análisis se dibujan de entrada y por cada «Ver más». */
export const LAB_PICKER_PAGE_SIZE = 24;
export const LAB_PICKER_VIEW_KEY = 'alovida.lab-analysis-picker.view';

const VIEW_OPTIONS: readonly SegmentedOption<LabPickerView>[] = [
  { value: 'grid', label: 'Tabla', description: 'Ver los análisis en tarjetas con sus componentes' },
  { value: 'list', label: 'Lista', description: 'Ver los análisis en una lista, una fila por análisis' },
];

function savedView(): LabPickerView | null {
  try {
    const saved = globalThis.localStorage?.getItem(LAB_PICKER_VIEW_KEY);
    return saved === 'grid' || saved === 'list' ? saved : null;
  } catch {
    // Almacenamiento bloqueado o SSR: vale la vista por defecto.
    return null;
  }
}

/**
 * **Selector de análisis de laboratorio** con sus componentes.
 *
 * Es de presentación: recibe el catálogo ya cargado y devuelve la selección por
 * `selection`. No habla con la API. Dos vistas conmutables (tabla de tarjetas y
 * lista), buscador sin tildes que mira análisis, sinónimos y componentes,
 * filtro por sección y un resumen con lo elegido.
 *
 * Rendimiento: con 532 análisis sólo se dibuja una página (24) y «Ver más»
 * agrega otra; las tarjetas usan `content-visibility`. En la lista, los
 * componentes de un análisis sólo existen en el DOM si está expandido.
 *
 * Guion de captura (lo ejecuta el orquestador, un solo navegador): ver el
 * comentario al final de `lab-analysis-picker.spec.ts`.
 */
@Component({
  selector: 'app-lab-analysis-picker',
  imports: [Checkbox, Chip, EmptyState, NgTemplateOutlet, SearchField, SegmentedControl, Select, ViewStateHost],
  templateUrl: './lab-analysis-picker.html',
  styleUrl: './lab-analysis-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabAnalysisPicker {
  readonly analyses = input.required<readonly LabAnalysisOption[]>();
  /** Opciones del select de muestra (tipos de muestra del catálogo). */
  readonly specimens = input<readonly SelectOption<string>[]>([]);
  /** Rótulos de las secciones; sin ellos se muestra el código. */
  readonly sections = input<readonly LabSectionOption[]>([]);
  /** Estado del catálogo: carga, vacío, error con reintento. */
  readonly state = input<ViewState<null>>(ready(null));
  readonly disabled = input(false);
  /**
   * Análisis que el servidor encontró para la búsqueda actual (ver `filterAnalyses`).
   * `null` = sin búsqueda en el servidor: sólo cuenta el índice local.
   */
  readonly serverMatches = input<ReadonlySet<string> | null>(null);

  readonly selection = model<LabSelection>(new Map());
  /** El médico pide reintentar la carga del catálogo (S8/S9). */
  readonly retry = output<void>();
  /** El texto de la búsqueda ya sin rebote: quien tiene el catálogo puede preguntarle al servidor. */
  readonly queryChange = output<string>();

  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly view = signal<LabPickerView>(savedView() ?? 'grid');
  protected readonly rawQuery = signal('');
  protected readonly query = signal('');
  protected readonly section = signal<string | null>(null);
  protected readonly limit = signal(LAB_PICKER_PAGE_SIZE);
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  private readonly index = computed(() => buildSearchIndex(this.analyses()));
  protected readonly tokens = computed(() => queryTokens(this.query()));

  protected readonly hits = computed<readonly LabFilterHit[]>(() =>
    filterAnalyses(this.analyses(), this.index(), this.query(), this.section(), this.serverMatches()),
  );
  protected readonly shown = computed(() => this.hits().slice(0, this.limit()));
  protected readonly remaining = computed(() => Math.max(0, this.hits().length - this.limit()));

  protected readonly sectionChips = computed(() => {
    const counts = countBySection(this.analyses());
    const labels = new Map(this.sections().map((s) => [s.code, s.label]));
    const codes = this.sections().length > 0 ? this.sections().map((s) => s.code) : [...counts.keys()];
    return codes
      .filter((code) => (counts.get(code) ?? 0) > 0)
      .map((code) => ({ code, label: labels.get(code) ?? code, count: counts.get(code) ?? 0 }));
  });

  protected readonly summary = computed(() => summarize(this.analyses(), this.selection()));
  protected readonly summaryLabel = computed(() => summaryText(this.summary()));
  protected readonly chosen = computed(() => chosenAnalyses(this.analyses(), this.selection()));
  protected readonly incomplete = computed(() => new Set(this.summary().incompleteAnalysisIds));
  protected readonly resultsLabel = computed(() => {
    const n = this.hits().length;
    return n === 1 ? '1 análisis encontrado' : `${n} análisis encontrados`;
  });

  /** Opciones de muestra por análisis elegido: las generales más la sugerida si faltara. */
  protected readonly specimenOptions = computed(() => {
    const base = this.specimens();
    const byAnalysis = new Map<string, readonly SelectOption<string>[]>();
    for (const analysis of this.chosen()) {
      const suggested = analysis.specimen;
      byAnalysis.set(
        analysis.conceptId,
        suggested === undefined || base.some((o) => o.value === suggested.conceptId)
          ? base
          : [{ value: suggested.conceptId, label: suggested.label }, ...base],
      );
    }
    return byAnalysis;
  });

  protected parentState(analysis: LabAnalysisOption): 'none' | 'some' | 'all' {
    return parentState(analysis, this.selection().get(analysis.conceptId));
  }

  protected isSimple(analysis: LabAnalysisOption): boolean {
    return isSimpleAnalysis(analysis);
  }

  protected componentChecked(analysis: LabAnalysisOption, componentId: string): boolean {
    return this.selection().get(analysis.conceptId)?.components.has(componentId) ?? false;
  }

  protected specimenOf(analysisId: string): string | null {
    return this.selection().get(analysisId)?.specimenConceptId ?? null;
  }

  protected segments(text: string): readonly HighlightSegment[] {
    return highlightSegments(text, this.tokens());
  }

  protected markedCount(analysis: LabAnalysisOption): number {
    const entry = this.selection().get(analysis.conceptId);
    return analysis.components.reduce((n, c) => n + (entry?.components.has(c.conceptId) ? 1 : 0), 0);
  }

  protected isExpanded(hit: LabFilterHit): boolean {
    return this.expanded().has(hit.analysis.conceptId) || hit.matchedComponentIds.size > 0;
  }

  protected trackHit(_: number, hit: LabFilterHit): string {
    return hit.analysis.conceptId;
  }

  protected sectionLabel(code: string): string {
    return this.sections().find((s) => s.code === code)?.label ?? code;
  }

  protected setView(view: LabPickerView): void {
    this.view.set(view);
    try {
      globalThis.localStorage?.setItem(LAB_PICKER_VIEW_KEY, view);
    } catch {
      // Sin almacenamiento la vista vale sólo para esta pantalla.
    }
  }

  protected search(value: string): void {
    this.query.set(value);
    this.limit.set(LAB_PICKER_PAGE_SIZE);
    this.queryChange.emit(value);
  }

  protected pickSection(code: string | null): void {
    this.section.set(code);
    this.limit.set(LAB_PICKER_PAGE_SIZE);
  }

  protected showMore(): void {
    this.limit.update((n) => n + LAB_PICKER_PAGE_SIZE);
  }

  protected toggleExpanded(analysisId: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(analysisId)) next.add(analysisId);
      return next;
    });
  }

  /**
   * La casilla del padre es tri-estado: el clic nativo la alterna, pero el
   * estado correcto lo dicta la selección (parcial → todos sigue «marcada»).
   * Como el binding no cambia en ese caso, Angular no reescribe el DOM: hay
   * que devolverle el valor correcto al modelo de la casilla Y a su `<input>`.
   */
  protected onParent(analysis: LabAnalysisOption, event: Event, box: Checkbox): void {
    this.selection.set(toggleAnalysis(this.selection(), analysis));
    const checked = this.parentState(analysis) !== 'none';
    box.checked.set(checked);
    if (event.target instanceof HTMLInputElement) {
      event.target.checked = checked;
    }
  }

  /** Clic en el texto de una fila: lo traslada a la casilla de al lado (mismo camino que el teclado). */
  protected clickBox(event: Event): void {
    const text = event.currentTarget;
    if (text instanceof HTMLElement) {
      text.previousElementSibling?.querySelector('input')?.click();
    }
  }

  protected onComponent(analysis: LabAnalysisOption, componentId: string, checked: boolean): void {
    this.selection.set(toggleComponent(this.selection(), analysis, componentId, checked));
  }

  protected onRemove(analysisId: string): void {
    this.selection.set(removeAnalysis(this.selection(), analysisId));
  }

  protected onSpecimen(analysisId: string, specimen: string | null): void {
    this.selection.set(setSpecimen(this.selection(), analysisId, specimen));
  }
}
