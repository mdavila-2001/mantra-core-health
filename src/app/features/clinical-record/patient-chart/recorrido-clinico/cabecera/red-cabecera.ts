import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { HiloDeLaRed } from '../red-clinica.geometria.types';
import { conteosDe, nombreDelEpisodio } from '../recorrido-clinico.textos';

/**
 * A thread header: the button that folds and unfolds the episode, with its
 * summary (level 1) in view. It sits on the sticky wrapper the network
 * positions (same element, no extra wrapper).
 */
@Component({
  selector: 'div[app-red-cabecera]',
  imports: [DatePipe],
  templateUrl: './red-cabecera.html',
  styleUrls: ['../red-clinica-tonos.css', './red-cabecera.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedCabecera {
  readonly hilo = input.required<HiloDeLaRed>();
  readonly alternar = output<string>();

  protected readonly conteos = computed(() => conteosDe(this.hilo().episodio));
  /** The button's accessible name: the whole summary. */
  protected readonly nombre = computed(() => nombreDelEpisodio(this.hilo()));
}
