import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { regionConceptCode, regionOfPart } from '../../../../../core/data-access/anatomy-atlas/anatomy-atlas.logic';
import { LATERALITY_CODE_BY_SIDE, STUDY_DETAIL_TARGETS, type StudyDetailFields } from '../../../../../core/data-access/diagnostics/study-detail.types';
import { SystemContextClient } from '../../../../../core/data-access/system-context/system-context.client';
import { ConceptSelect } from '../../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { BodySitePicker, type BodySiteSelection } from '../../../../../shared/components/organisms/body-site-picker/body-site-picker';
import type { StudyFamily } from '../study-category';
import type { BodyRegionsData } from '../../../../../core/data-access/anatomy-atlas/anatomy-atlas.logic';
import { createBodyAtlasState } from './body-atlas-state';
import { studyDetailErrorOf, type StudyDetailField } from './study-detail-errors';

/** La lateralidad en palabras: el catálogo trae su `display` en inglés técnico. */
const LATERALITY_LABELS: Readonly<Record<string, string>> = {
  COND_LAT_LEFT: 'Izquierda',
  COND_LAT_RIGHT: 'Derecha',
  COND_LAT_BILATERAL: 'Bilateral',
};

/**
 * **Detalle del estudio** que se pide: la muestra de un laboratorio o la parte
 * del cuerpo de una imagen.
 *
 * Es el hijo inteligente de {@link AnalysisOrderBlock} (mismo patrón que el
 * punto de toma): no envía nada, ofrece `fields()` para el cuerpo del alta,
 * `canSubmit()` para habilitar el botón, `reset()` y `absorbError()` para ubicar
 * un 422 en su campo.
 *
 * - **Laboratorio**: la muestra es obligatoria (la elige el médico del catálogo
 *   `specimen-type`; no se deduce del análisis: no hay fuente aprobada).
 * - **Imagen**: la región del catálogo es obligatoria (la API la exige); el
 *   cuerpo 3D marca la estructura exacta y propone el lado; la modalidad es
 *   opcional (el catálogo del estudio puede fijarla); el tipo de hueso lo elige
 *   el médico sólo si lo marcado es un hueso.
 * - Laboratorio e imagen son excluyentes: `fields()` nunca mezcla las dos.
 */
@Component({
  selector: 'app-study-detail-section',
  imports: [BodySitePicker, ConceptSelect, FormField],
  templateUrl: './study-detail-section.html',
  styleUrl: './study-detail-section.css',
  host: { '[hidden]': '!isLab() && !isImaging()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyDetailSection {
  private readonly systemContext = inject(SystemContextClient);

  /** La familia del estudio elegido, o `null` sin estudio. */
  readonly family = input<StudyFamily | null>(null);

  protected readonly targets = STUDY_DETAIL_TARGETS;
  protected readonly lateralityLabels = LATERALITY_LABELS;
  protected readonly atlas = createBodyAtlasState();

  protected readonly specimen = signal<string | null>(null);
  protected readonly bodySite = signal<string | null>(null);
  protected readonly modality = signal<string | null>(null);
  protected readonly laterality = signal<string | null>(null);
  protected readonly boneType = signal<string | null>(null);
  protected readonly selection = signal<BodySiteSelection | null>(null);
  protected readonly errors = signal<Readonly<Partial<Record<StudyDetailField, string>>>>({});

  /** Sólo tiene sentido pedir el tipo de hueso cuando lo marcado es del esqueleto. */
  protected readonly isBone = computed(() => this.selection()?.layer === 'skeleton');
  protected readonly isLab = computed(() => this.family() === 'LAB');
  protected readonly isImaging = computed(() => this.family() === 'IMAGING');
  private readonly lateralityByCode = signal<ReadonlyMap<string, string>>(new Map());
  private readonly bodySiteByCode = signal<ReadonlyMap<string, string>>(new Map());
  /** La parte marcada no tiene región equivalente en el catálogo (o el catálogo no bajó): se avisa y se elige a mano. */
  protected readonly regionNote = signal<string | null>(null);

  constructor() {
    // El catálogo del cuerpo (y el de lados, para proponer el lado) baja cuando el estudio es de imagen.
    effect(() => {
      if (!this.isImaging()) return;
      untracked(() => {
        this.atlas.load();
        this.systemContext.dynamicEnum(STUDY_DETAIL_TARGETS.laterality).subscribe({
          next: (e) => this.lateralityByCode.set(new Map(e.options.map((o) => [o.code, o.conceptId]))),
          error: () => this.lateralityByCode.set(new Map()),
        });
        this.systemContext.dynamicEnum(STUDY_DETAIL_TARGETS.bodySite).subscribe({
          next: (e) => this.bodySiteByCode.set(new Map(e.options.map((o) => [o.code, o.conceptId]))),
          error: () => this.bodySiteByCode.set(new Map()),
        });
      });
    });

    // La pieza marcada propone la región del catálogo (cruce de la API: región ↔ UBERON ↔ mallas) y, si la región
    // tiene lado, el lado de la pieza. Se vuelve a calcular al marcar otra pieza o cuando bajan las tablas; lo que el
    // médico cambie a mano después se respeta hasta la próxima pieza.
    effect(() => {
      const selection = this.selection();
      const regions = this.atlas.regions();
      const sites = this.bodySiteByCode();
      untracked(() => this.proposeRegion(selection, regions, sites));
    });

    // Cambiar de familia (laboratorio ↔ imagen) no arrastra lo del otro: son excluyentes.
    effect(() => {
      this.family();
      untracked(() => this.reset());
    });
  }

  /** Marcar o quitar la parte del cuerpo; el tipo de hueso sólo vale para el esqueleto. */
  protected pick(selection: BodySiteSelection | null): void {
    this.selection.set(selection);
    this.errors.update((e) => ({ ...e, structure: undefined }));
    if (selection === null || selection.layer !== 'skeleton') this.boneType.set(null);
  }

  private proposeRegion(
    selection: BodySiteSelection | null,
    regions: BodyRegionsData | null,
    sites: ReadonlyMap<string, string>,
  ): void {
    this.regionNote.set(null);
    if (selection === null || regions === null || sites.size === 0) return;
    const region = regionOfPart(selection, regions);
    const conceptId = region === null ? undefined : sites.get(regionConceptCode(region));
    if (region === null || conceptId === undefined) {
      this.regionNote.set('La parte marcada no tiene una región equivalente en el catálogo: elija la región de la lista.');
      return;
    }
    this.bodySite.set(conceptId);
    this.clearError('bodySite');
    // El lado sólo se propone si la región lo admite (una estructura única da 422 `LATERALITY_NOT_APPLICABLE`).
    if (!regions.regions[region]?.lateral) {
      this.laterality.set(null);
    } else if (selection.side !== null) {
      const side = this.lateralityByCode().get(LATERALITY_CODE_BY_SIDE[selection.side]);
      if (side !== undefined) this.laterality.set(side);
    }
  }

  /** Lo que suma al cuerpo del alta; nada si el estudio no es de laboratorio ni de imagen. */
  fields(): StudyDetailFields {
    if (this.isLab()) {
      const specimen = this.specimen();
      return specimen === null ? {} : { specimenTypeConceptId: specimen };
    }
    if (!this.isImaging()) return {};
    const selection = this.selection();
    const entries: [keyof StudyDetailFields, string | null | undefined][] = [
      ['bodySiteConceptId', this.bodySite()],
      ['modalityConceptId', this.modality()],
      ['lateralityConceptId', this.laterality()],
      ['bodyStructureUberon', selection?.structureId],
      ['bodyMeshId', selection?.meshId],
      ['boneTypeConceptId', this.isBone() ? this.boneType() : null],
    ];
    return Object.fromEntries(entries.filter(([, v]) => v !== null && v !== undefined && v !== '')) as StudyDetailFields;
  }

  /** Laboratorio exige la muestra; imagen, la región del catálogo. */
  canSubmit(): boolean {
    if (this.isLab()) return this.specimen() !== null;
    if (this.isImaging()) return this.bodySite() !== null;
    return true;
  }

  reset(): void {
    for (const s of [this.specimen, this.bodySite, this.modality, this.laterality, this.boneType]) s.set(null);
    this.selection.set(null);
    this.regionNote.set(null);
    this.errors.set({});
  }

  /** Ubica un 422 de la orden en su campo. Devuelve `true` si lo atendió (el pedido no repite el mensaje). */
  absorbError(error: unknown): boolean {
    const found = studyDetailErrorOf(error);
    if (found === null) return false;
    this.errors.set({ [found.field]: found.message });
    return true;
  }

  /** Al cambiar un campo se retira su error: ya no es lo que se mandó. */
  protected clearError(field: StudyDetailField): void {
    if (this.errors()[field] !== undefined) this.errors.update((e) => ({ ...e, [field]: undefined }));
  }
}
