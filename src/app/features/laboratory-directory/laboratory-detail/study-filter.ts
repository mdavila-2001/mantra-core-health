import type { DiagnosticStudy } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { normalize } from './study-format';

/** One study area (modality) with how many studies it holds. */
export interface StudyArea {
  readonly name: string;
  readonly count: number;
}

/** Study areas by size, only when there are two or more to choose from. */
export function studyAreas(studies: readonly DiagnosticStudy[]): readonly StudyArea[] {
  const counts = new Map<string, number>();
  for (const study of studies) {
    const area = study.modality?.display;
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  if (counts.size < 2) return [];
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

/**
 * Studies in `area` (or all, when `null`) that match `term` on name, code,
 * modality, description or preparation: whoever types «ayuno» looks for a
 * preparation and whoever types «TAC» for a code.
 */
export function filterStudies(
  studies: readonly DiagnosticStudy[],
  area: string | null,
  term: string,
): readonly DiagnosticStudy[] {
  const wanted = normalize(term);
  return studies.filter(
    (study) =>
      (area === null || study.modality?.display === area) &&
      (wanted === '' ||
        normalize(
          [
            study.name,
            study.code,
            study.modality?.display ?? '',
            study.description ?? '',
            study.preparationInstructions ?? '',
          ].join(' '),
        ).includes(wanted)),
  );
}
