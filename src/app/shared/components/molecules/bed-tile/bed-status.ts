import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HYGIENE_LABEL, V2_LABEL } from '../../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type { HygieneCode, V2Code } from '../../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { Badge } from '../../atoms/badge/badge';
import type { BadgeSize, BadgeVariant } from '../../atoms/badge/badge.types';

/* ============================================================================
    Cómo se ve cada estado de una cama: **texto + glifo + patrón + tono**.

    El color nunca es el único canal (WCAG 1.4.1): el texto dice el estado, el
    glifo lo dibuja y el patrón del borde lo distingue en blanco y negro o para
    quien no ve el color. La misma tabla la usan el recuadro de la cama, la
    leyenda, la lista y el panel, así que un estado se ve igual en todos lados.
    ========================================================================== */

export type StatusGlyph = 'check' | 'person' | 'clock' | 'droplet' | 'hazard' | 'shield' | 'ban';

/** Patrón del borde y de la banda del recuadro. */
export type StatusPattern = 'solid' | 'dashed' | 'dots' | 'cross' | 'double' | 'hatch';

export interface StatusLook {
  readonly label: string;
  readonly tone: BadgeVariant;
  readonly glyph: StatusGlyph;
  readonly pattern: StatusPattern;
}

const V2_LOOK: Readonly<Record<V2Code, Omit<StatusLook, 'label'>>> = {
  U: { tone: 'success', glyph: 'check', pattern: 'solid' },
  O: { tone: 'primary', glyph: 'person', pattern: 'solid' },
  R: { tone: 'primary', glyph: 'clock', pattern: 'dashed' },
  H: { tone: 'warning', glyph: 'droplet', pattern: 'dots' },
  K: { tone: 'error', glyph: 'hazard', pattern: 'cross' },
  I: { tone: 'info', glyph: 'shield', pattern: 'double' },
  C: { tone: 'secondary', glyph: 'ban', pattern: 'hatch' },
};

/**
 * Los aspectos se calculan una sola vez: las plantillas los pasan a `[look]` en
 * cada ciclo de detección, y un objeto nuevo por llamada sería un cambio por ciclo.
 */
const V2_LOOKS: Readonly<Record<V2Code, StatusLook>> = Object.fromEntries(
  (Object.keys(V2_LOOK) as V2Code[]).map((code) => [code, { label: V2_LABEL[code], ...V2_LOOK[code] }]),
) as Record<V2Code, StatusLook>;

export const lookOfV2 = (code: V2Code): StatusLook => V2_LOOKS[code];

const HYGIENE_LOOK: Readonly<Record<HygieneCode, Omit<StatusLook, 'label'>>> = {
  HYG_INSPECTED: { tone: 'success', glyph: 'check', pattern: 'solid' },
  HYG_CLEAN: { tone: 'info', glyph: 'check', pattern: 'dots' },
  HYG_DIRTY: { tone: 'warning', glyph: 'droplet', pattern: 'dots' },
  HYG_CLEANING: { tone: 'warning', glyph: 'clock', pattern: 'dashed' },
  HYG_CONTAMINATED: { tone: 'error', glyph: 'hazard', pattern: 'cross' },
};

/** La vista reducida de Limpieza: solo el eje de higiene. */
const HYGIENE_LOOKS: Readonly<Record<string, StatusLook>> = Object.fromEntries(
  (Object.keys(HYGIENE_LOOK) as HygieneCode[]).flatMap((code) => [
    [code, { label: HYGIENE_LABEL[code], ...HYGIENE_LOOK[code] }],
    [`${code}:awaiting`, { label: code === 'HYG_CLEAN' ? 'Limpia, falta inspección' : HYGIENE_LABEL[code], ...HYGIENE_LOOK[code] }],
  ]),
);

export function lookOfHygiene(code: HygieneCode, awaitingInspection = false): StatusLook {
  return HYGIENE_LOOKS[awaitingInspection ? `${code}:awaiting` : code]!;
}

/**
 * El badge de estado de una cama: glifo y texto dentro del `app-badge` de la
 * casa. Presentacional puro.
 */
@Component({
  selector: 'app-bed-status-badge',
  imports: [Badge],
  template: `
    <app-badge [variant]="look().tone" [size]="size()">
      <svg class="glyph" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (look().glyph) {
          @case ('check') { <path d="M5 12.5l4.5 4.5L19 7" /> }
          @case ('person') { <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /> }
          @case ('clock') { <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /> }
          @case ('droplet') { <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" /> }
          @case ('hazard') { <path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5" /><path d="M12 17.4v.2" /> }
          @case ('shield') { <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /> }
          @case ('ban') { <circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /> }
        }
      </svg>
      {{ look().label }}
    </app-badge>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .glyph {
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedStatusBadge {
  readonly look = input.required<StatusLook>();
  readonly size = input<BadgeSize>('sm');
}
