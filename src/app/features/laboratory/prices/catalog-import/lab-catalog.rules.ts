import type {
  LabCatalog,
  LabCatalogImportResult,
  LabCatalogItem,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import type { SpecialtyGroup } from '../../../../shared/components/organisms/specialty-browser/specialty-browser.types';

/** A catalog análisis with the name of the section it belongs to. */
export type CatalogEntry = LabCatalogItem & { readonly sectionName: string };

/**
 * Groups by sample type (blood, urine..., in the API's order), each with every
 * análisis drawn from it, filtered by sample type, section and text (name,
 * code, LOINC or a component's name).
 */
export function catalogGroups(
  catalog: LabCatalog | null,
  filter: { readonly sample: string; readonly section: string; readonly text: string },
): readonly SpecialtyGroup<CatalogEntry>[] {
  const term = filter.text.trim().toLocaleLowerCase('es');
  const hit = (i: LabCatalogItem) =>
    term === '' ||
    [i.name, i.code, i.loinc, ...i.components.map((c) => c.name)].some((t) =>
      (t ?? '').toLocaleLowerCase('es').includes(term),
    );
  const entries = (catalog?.sections ?? [])
    .filter((s) => filter.section === '' || s.code === filter.section)
    .flatMap((s) => s.items.filter(hit).map((i) => ({ ...i, sectionName: s.name })))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return (catalog?.sampleTypes ?? [])
    .filter((t) => filter.sample === '' || t.code === filter.sample)
    .map((t) => ({
      conceptId: t.code,
      label: t.name,
      items: entries.filter((i) => i.sampleType === t.code),
    }))
    .filter((g) => g.items.length > 0);
}

/** How an import went, in one sentence, plus the reason of each rejected análisis. */
export interface ImportSummary {
  readonly added: number;
  readonly text: string;
  readonly rejections: readonly string[];
}

export function importSummary(
  result: LabCatalogImportResult,
  nameOf: (conceptId: string) => string,
): ImportSummary {
  const added = result.created + result.linked + result.republished;
  const parts = [
    added === 0
      ? 'No se agregó ningún análisis'
      : `Se ${added === 1 ? 'agregó 1 análisis' : `agregaron ${added} análisis`} con sus componentes`,
  ];
  if (result.skipped > 0)
    parts.push(`${result.skipped} ya estaba${result.skipped === 1 ? '' : 'n'}`);
  const rejections = result.rows
    .filter((r) => r.outcome === 'REJECTED')
    .map((r) => `${nameOf(r.conceptId)}: ${r.reason ?? 'no se pudo agregar.'}`);
  return { added, text: `${parts.join('; ')}.`, rejections };
}
