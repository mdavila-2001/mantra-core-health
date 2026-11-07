import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { ASPECTO_DE_LA_CLASE } from '../red-clinica.model';
import type { NodoDeLaRed } from '../red-clinica.geometria.types';
import type { FechaPropia } from '../recorrido-clinico.textos';

/**
 * The inside of a clinical network node. It sits on the positioned `<button>`
 * the network draws (same element, no wrapper): the network keeps the
 * position, the state classes and the events; this draws what the node says.
 */
@Component({
  selector: 'button[app-red-nodo]',
  imports: [DatePipe, NavIcon],
  templateUrl: './red-nodo.html',
  styleUrls: ['../red-clinica-tonos.css', './red-nodo.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'recorrido-nodo',
    '[attr.aria-expanded]': 'expandido()',
    '[attr.title]': "nodo().forma === 'grupo' ? null : nodo().registro?.titulo",
    '[attr.data-clase]': "nodo().registro?.clase ?? 'grupo'",
    '[attr.data-forma]': 'nodo().forma',
    '[attr.data-id]': 'nodo().id',
  },
})
export class RedNodo {
  readonly nodo = input.required<NodoDeLaRed>();
  /** The record's own date when it is not its column's. */
  readonly propia = input<FechaPropia | null>(null);
  /** Vertical layout: the links are said in text under the record. */
  readonly vertical = input(false);
  readonly relaciones = input<readonly string[]>([]);
  /** The other episodes this record also belongs to. */
  readonly compartidoCon = input<readonly string[]>([]);

  protected readonly aspecto = ASPECTO_DE_LA_CLASE;

  protected expandido(): boolean | null {
    const nodo = this.nodo();
    return nodo.forma === 'grupo'
      ? nodo.grupo?.accion === 'contraer'
      : nodo.forma === 'descartado'
        ? false
        : nodo.forma === 'plegar'
          ? true
          : null;
  }

  protected titulosDe(nodo: NodoDeLaRed): string {
    return (nodo.grupo?.ocultos ?? []).map((r) => r.titulo).join(', ');
  }
}
