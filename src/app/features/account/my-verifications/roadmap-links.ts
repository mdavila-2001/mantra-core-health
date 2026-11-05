import { editorLink } from '../my-profile/practitioner-profile-edit/editor-deep-link';

/** Where a roadmap step sends the person; editor links also name the tab and the section. */
export interface RoadmapLink {
  readonly label: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, number>>;
  readonly fragment?: string;
}

/**
 * Each step's way out. The ones into «Editar perfil» land on the exact section
 * (matrículas, títulos, especialidades), not on the editor's first tab.
 */
export const ROADMAP_LINKS = {
  profile: { label: 'Completar mi perfil', route: '/onboarding' },
  licenses: { label: 'Revisar mis habilitaciones', ...editorLink('licenses') },
  firstCredential: { label: 'Cargar un título', ...editorLink('credentials') },
  credentials: { label: 'Revisar mis títulos', ...editorLink('credentials') },
  specialties: { label: 'Revisar mis especialidades', ...editorLink('specialties') },
} as const satisfies Readonly<Record<string, RoadmapLink>>;

/**
 * A step offers its way out until it is approved. Takes the step's state as
 * plain text so this file does not import the model that imports it.
 */
export function untilApproved(
  state: string,
  link: RoadmapLink,
): { readonly action?: RoadmapLink } {
  return state === 'approved' ? {} : { action: link };
}
