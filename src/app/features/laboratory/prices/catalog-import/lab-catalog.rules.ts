import type {
  LabCatalog,
  LabCatalogImportResult,
  LabCatalogItem,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import type { SpecialtyGroup } from '../../../../shared/components/organisms/specialty-browser/specialty-browser.types';

/** Sections filtered by section code and text (name, code, LOINC or a component's name). */
export function catalogGroups(
  catalog: LabCatalog | null,
  section: string,
  text: string,
): readonly SpecialtyGroup<LabCatalogItem>[] {
  const term = text.trim().toLocaleLowerCase('es');
  const hit = (i: LabCatalogItem) =>
    term === '' ||
    [i.name, i.code, i.loinc, ...i.components.map((c) => c.name)].some((t) =>
      (t ?? '').toLocaleLowerCase('es').includes(term),
    );
  return (catalog?.sections ?? [])
    .filter((s) => section === '' || s.code === section)
    .map((s) => ({ conceptId: s.code, label: s.name, items: s.items.filter(hit) }))
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
