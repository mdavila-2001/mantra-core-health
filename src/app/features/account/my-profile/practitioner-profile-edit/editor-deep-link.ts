import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';
import { ActivatedRoute, type ParamMap } from '@angular/router';

import { EDITOR_DOCTOR_TABS, TAB_EDITOR } from '../doctor-profile-tabs';

/* ============================================================================
    Deep links into «Editar perfil» (`/my-account/edit`).

    The editor draws only the open tab, so a link names two things: the tab,
    in `?pestana=`, and the section inside it, in the fragment. Whoever writes
    the link (`editorLink`) and whoever reads it (`requestedTab`, the section
    anchor) live here, so the parameter and the section ids cannot drift apart.
    ========================================================================== */

/** The sections another screen can point at; each one is also its element id. */
export type EditorSection = 'specialties' | 'licenses' | 'credentials';

const EDITOR_ROUTE = '/my-account/edit';
const TAB_PARAM = 'pestana';

const SECTION_TAB: Readonly<Record<EditorSection, number>> = {
  specialties: TAB_EDITOR.personales,
  licenses: TAB_EDITOR.credenciales,
  credentials: TAB_EDITOR.credenciales,
};

/** A link to one section of the editor: its route, its tab and the section. */
export interface EditorLink {
  readonly route: string;
  readonly queryParams: Readonly<Record<string, number>>;
  readonly fragment: EditorSection;
}

export function editorLink(section: EditorSection): EditorLink {
  return {
    route: EDITOR_ROUTE,
    queryParams: { [TAB_PARAM]: SECTION_TAB[section] },
    fragment: section,
  };
}

/**
 * The tab the editor opens with, from `?pestana=`; `null` keeps the first one.
 *
 * Read from the snapshot, not from the observable: it is the tab the person
 * ENTERS with, not one the URL keeps imposing — otherwise their own change of
 * tab would fight the URL. No number, an unreadable one or one out of range
 * gives `null`: a hand-written `?pestana=99` cannot leave the editor without
 * an open panel.
 */
export function requestedTab(params: ParamMap): number | null {
  const raw = params.get(TAB_PARAM);
  const tab = Number(raw);
  return raw !== null && Number.isInteger(tab) && tab >= 0 && tab < EDITOR_DOCTOR_TABS.length
    ? tab
    : null;
}

/**
 * Marks a section a link can point at: gives it its id and, when the URL's
 * fragment names it, brings it into view once it is drawn.
 *
 * The router's `anchorScrolling` jumps as soon as the navigation ends, and the
 * editor draws its sections only after the profile arrives: the jump fell into
 * the void (same story as «Sedes y horarios» in the public profile). Coming
 * back to the tab lands on the section again — it is where the link pointed.
 * Only after render: on the server there is nothing to scroll.
 */
@Directive({
  selector: '[appEditorSection]',
  host: { '[id]': 'appEditorSection()' },
})
export class EditorSectionAnchor {
  readonly appEditorSection = input.required<EditorSection>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const route = inject(ActivatedRoute);
    afterNextRender(() => {
      if (route.snapshot.fragment === this.appEditorSection()) {
        host.nativeElement.scrollIntoView({ block: 'start' });
      }
    });
  }
}
