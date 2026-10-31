import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import type { BodyRegionCatalogEntry, Laterality } from '../../../../../core/data-access/anatomy-atlas/body-regions.types';
import { ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { BodyRegionPicker } from '../../../../../shared/components/organisms/body-region-picker/body-region-picker';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  allowedContrastKinds,
  allowedRegionsOf,
  buildStudyIndex,
  CONTRAST_FALLBACK_LABEL,
  CONTRAST_KINDS,
  contrastKindOfConcept,
  describeSelection,
  filterStudies,
  findStudy,
  initialSelection,
  ISSUE_MESSAGE,
  LATERALITY_NAME,
  modalityControl,
  needsOwnLaterality,
  selectionIssues,
  serializeImaging,
  withContrast,
  withLaterality,
  withRegion,
  type ContrastKind,
  type ContrastOption,
  type ImagingModalityOption,
  type ImagingRequestLine,
  type ImagingSelection,
  type ImagingStudyOption,
  type RegionValue,
} from './imaging-study-picker.logic';

/** Valor de la opción «todas» del select de modalidad. */
export const ALL_MODALITIES = '*';

const OWN_LATERALITY_OPTIONS: readonly SegmentedOption<Laterality>[] = (['IZQ', 'DER', 'BIL'] as const).map((value) => ({
  value,
  label: LATERALITY_NAME[value],
}));

/**
 * **Selector de estudio de imagenología**: modalidad, estudio, región del
 * cuerpo (3D + lista), lado y contraste.
 *
 * Es de presentación: recibe los catálogos ya cargados y devuelve la elección
 * por `selection`. No habla con la API; los conceptId de región y lado los
 * traduce `serializeImaging` con las tablas `regionConceptIds` y
 * `lateralityConceptIds` (el padre las arma con el catálogo).
 *
 * ## Por qué un `app-select` para la modalidad
 *
 * El catálogo tiene 14 modalidades con nombres largos («Radiología con
 * contraste / fluoroscopia»). Un control segmentado de 14 opciones no cabe a
 * 390 px y los chips obligan a leer todo para elegir; el select se abre en un
 * diálogo con buscador, funciona con teclado y dice cuántos estudios hay en
 * cada una. Con 6 o menos opciones (catálogos reducidos) se usa el segmentado
 * (`modalityControl`).
 *
 * ## Una sola fuente de verdad
 *
 * `selection` es el único estado de la elección. La región y el lado que ve el
 * selector de región se DERIVAN de él (`computed`) y sólo lo escriben por un
 * gesto de la persona; no hay `effect` de sincronía. La modalidad que filtra
 * la lista es un estado propio del filtro (se puede filtrar sin haber elegido
 * estudio) y se alinea con el estudio al elegirlo.
 *
 * `valid` y `request` se exponen como señales públicas para el padre
 * (`viewChild`); la lógica pura está en `imaging-study-picker.logic.ts`.
 */
@Component({
  selector: 'app-imaging-study-picker',
  imports: [
    Alert,
    BodyRegionPicker,
    Chip,
    EmptyState,
    FormField,
    SearchField,
    SegmentedControl,
    Select,
    ViewStateHost,
  ],
  templateUrl: './imaging-study-picker.html',
  styleUrl: './imaging-study-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagingStudyPicker {
  readonly modalities = input.required<readonly ImagingModalityOption[]>();
  readonly studies = input.required<readonly ImagingStudyOption[]>();
  /** Catálogo de regiones (`imagenologia.json › regiones`), para el selector de región. */
  readonly regions = input.required<readonly BodyRegionCatalogEntry[]>();
  readonly contrastOptions = input<readonly ContrastOption[]>([]);
  /** código de región -> conceptId (lo arma el padre con el catálogo). */
  readonly regionConceptIds = input<Readonly<Record<string, string>>>({});
  /** `IZQ`/`DER`/`BIL`/`UNI` -> conceptId. */
  readonly lateralityConceptIds = input<Readonly<Record<string, string>>>({});
  /** Estado del catálogo: carga, vacío, error con reintento. */
  readonly state = input<ViewState<null>>(ready(null));
  readonly disabled = input(false);

  readonly selection = model<ImagingSelection | null>(null);
  /** La persona pide reintentar la carga del catálogo (S8/S9). */
  readonly retry = output<void>();

  protected readonly rawQuery = signal('');
  protected readonly query = signal('');
  /** Modalidad del filtro; `null` = todas. */
  protected readonly modalityFilter = signal<string | null>(null);

  protected readonly ownLateralityOptions = OWN_LATERALITY_OPTIONS;
  protected readonly allModalities = ALL_MODALITIES;

  private readonly index = computed(() => buildStudyIndex(this.studies()));
  protected readonly modalityKind = computed(() => modalityControl(this.modalities().length));
  protected readonly activeModality = computed(() => this.selection()?.modalityCode ?? this.modalityFilter());

  protected readonly study = computed(() => findStudy(this.studies(), this.selection()));
  private readonly regionName = computed(() => new Map(this.regions().map((r) => [r.codigo, r.nombre])));

  protected readonly hits = computed(() =>
    filterStudies(this.studies(), this.index(), this.query(), this.activeModality()),
  );
  protected readonly resultsLabel = computed(() => {
    const n = this.hits().length;
    return n === 1 ? '1 estudio encontrado' : `${n} estudios encontrados`;
  });

  protected readonly segmentedModalities = computed<readonly SegmentedOption<string>[]>(() =>
    this.modalities().map((m) => ({ value: m.codigo, label: m.nombre })),
  );
  protected readonly selectModalities = computed<readonly SelectOption<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const s of this.studies()) counts.set(s.modalidad, (counts.get(s.modalidad) ?? 0) + 1);
    return [
      { value: ALL_MODALITIES, label: 'Todas las modalidades', description: `${this.studies().length} estudios` },
      ...this.modalities().map((m) => ({
        value: m.codigo,
        label: m.nombre,
        description: `${m.codigo} · ${counts.get(m.codigo) ?? 0} estudios`,
      })),
    ];
  });

  /** Las opciones del select de estudio; el elegido siempre está, aunque la búsqueda lo excluya. */
  protected readonly studyOptions = computed<readonly SelectOption<string>[]>(() => {
    const names = this.regionName();
    const toOption = (s: ImagingStudyOption): SelectOption<string> => ({
      value: s.conceptId,
      label: s.nombre,
      description: `${s.modalidad} · ${names.get(s.region) ?? s.region}`,
    });
    const options = this.hits().map(toOption);
    const chosen = this.study();
    return chosen === null || options.some((o) => o.value === chosen.conceptId) ? options : [toOption(chosen), ...options];
  });

  protected readonly allowed = computed(() => {
    const s = this.study();
    return s === null ? [] : allowedRegionsOf(s, this.regions());
  });
  protected readonly regionValue = computed<RegionValue>(() => ({
    region: this.selection()?.region ?? null,
    laterality: this.selection()?.laterality ?? null,
  }));
  protected readonly ownLaterality = computed(() => {
    const s = this.study();
    return s !== null && needsOwnLaterality(s, this.selection()?.region ?? null, this.regions());
  });

  protected readonly contrastSegments = computed<readonly SegmentedOption<ContrastKind>[]>(() => {
    const s = this.study();
    const options = this.contrastOptions();
    const allowed = s === null ? CONTRAST_KINDS : allowedContrastKinds(s);
    return CONTRAST_KINDS.map((kind) => ({
      value: kind,
      label: options.find((o) => contrastKindOfConcept(o.conceptId, options) === kind)?.label ?? CONTRAST_FALLBACK_LABEL[kind],
      disabled: !allowed.includes(kind),
    }));
  });
  protected readonly contrastValue = computed<ContrastKind>(() => {
    const kind = contrastKindOfConcept(this.selection()?.contrastConceptId ?? null, this.contrastOptions());
    const fixed = this.study()?.contraste;
    return kind ?? (fixed === undefined || fixed === 'opcional' ? 'sin' : fixed);
  });
  protected readonly contrastFixed = computed(() => this.study()?.contraste !== 'opcional');

  /** Qué falta o está mal; vacío = la elección se puede pedir. */
  readonly issues = computed(() =>
    selectionIssues(this.selection(), this.study(), { regions: this.regions(), contrastOptions: this.contrastOptions() }),
  );
  protected readonly issueMessages = computed(() => this.issues().map((i) => ISSUE_MESSAGE[i]));
  /** ¿La elección está completa? (el padre habilita «Pedir» con esto). */
  readonly valid = computed(() => this.study() !== null && this.issues().length === 0);
  /** El renglón de la requisición, o `null` si no hay elección válida. */
  readonly request = computed<ImagingRequestLine | null>(() => {
    const sel = this.selection();
    if (sel === null || !this.valid()) return null;
    return serializeImaging(sel, {
      modalities: this.modalities(),
      regionConceptIds: this.regionConceptIds(),
      lateralityConceptIds: this.lateralityConceptIds(),
    });
  });

  protected readonly summary = computed(() => {
    const sel = this.selection();
    const s = this.study();
    if (sel === null || s === null) return 'Todavía no eligió ningún estudio';
    return `${s.nombre}: ${describeSelection(sel, this.regions(), this.contrastOptions())}`;
  });

  protected search(value: string): void {
    this.query.set(value);
  }

  protected pickModality(code: string | null): void {
    const next = code === ALL_MODALITIES || code === '' ? null : code;
    this.modalityFilter.set(next);
    const current = this.selection();
    if (next !== null && current !== null && current.modalityCode !== next) this.selection.set(null);
  }

  protected pickStudy(conceptId: string | null): void {
    if (conceptId === null || conceptId === this.selection()?.studyConceptId) return;
    const study = this.studies().find((s) => s.conceptId === conceptId);
    if (study === undefined) return;
    this.modalityFilter.set(study.modalidad);
    this.selection.set(initialSelection(study, this.contrastOptions()));
  }

  protected onRegion(value: RegionValue): void {
    const sel = this.selection();
    const study = this.study();
    if (sel === null || study === null) return;
    this.selection.set(withRegion(sel, value, study, this.regions()));
  }

  protected onOwnLaterality(laterality: Laterality): void {
    const sel = this.selection();
    if (sel !== null) this.selection.set(withLaterality(sel, laterality));
  }

  protected onContrast(kind: ContrastKind): void {
    const sel = this.selection();
    const study = this.study();
    if (sel === null || study === null) return;
    this.selection.set(withContrast(sel, kind, study, this.contrastOptions()));
  }
}
