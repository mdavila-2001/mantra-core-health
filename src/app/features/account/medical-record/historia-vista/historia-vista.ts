import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';

/** How the history is being read. */
export type VistaDeLaHistoria = 'fecha' | 'recorrido';

/**
 * «Por fecha» is the usual view and the one shown when entering with nothing
 * in the URL; «Mi recorrido» groups it by health problem. Both read the same
 * data: the tour requests nothing the by-date view does not already request.
 */
const VISTAS: readonly SegmentedOption<VistaDeLaHistoria>[] = [
  { value: 'fecha', label: 'Por fecha' },
  { value: 'recorrido', label: 'Mi recorrido' },
];

/**
 * Strip 5a · the view selector heads the history card and sets it apart from
 * what it shows. It sits on the card's wrapper (same element, no extra box).
 */
@Component({
  selector: 'div[app-historia-vista]',
  imports: [SegmentedControl],
  templateUrl: './historia-vista.html',
  styleUrl: './historia-vista.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoriaVista {
  readonly vista = input.required<VistaDeLaHistoria>();
  readonly vistaChange = output<VistaDeLaHistoria>();

  protected readonly vistas = VISTAS;
}
