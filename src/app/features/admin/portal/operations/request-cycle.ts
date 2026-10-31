import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  Arbol,
  OperacionDetalle,
} from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { cycleApplicability } from '../portal-labels';
import { assessCycle, countApplicability } from './request-cycle.model';

/**
 * El ciclo de la petición —las 21 etapas globales de la API, por fases— con
 * el veredicto para esta operación en cada una: aplica, no aplica o no se
 * puede determinar desde el inventario. Es una lista ordenada con conectores
 * en CSS, no un dibujo: se lee con lector de pantalla, se imprime y no
 * depende del color (cada veredicto lleva su texto). Sin animación, así que
 * `prefers-reduced-motion` no tiene nada que apagar. Presentacional.
 */
@Component({
  selector: 'app-portal-request-cycle',
  imports: [RouterLink, Badge, Link],
  templateUrl: './request-cycle.html',
  styleUrl: './request-cycle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestCycle {
  readonly operation = input.required<OperacionDetalle>();
  /** El árbol de decisión si ya llegó; `null` si no está o no existe. */
  readonly tree = input<Arbol | null>(null);
  /** Adónde lleva «ver el árbol de decisión»; lo decide quien conoce las rutas. */
  readonly treeQuery = input<Readonly<Record<string, string>>>({ vista: 'arbol' });

  protected readonly verdict = cycleApplicability;
  protected readonly phases = computed(() => assessCycle(this.operation(), this.tree()));
  protected readonly counts = computed(() => countApplicability(this.phases()));
  protected readonly headline = computed(() => {
    const c = this.counts();
    return `${c.APLICA} etapas aplican · ${c.NO_APLICA} no aplican · ${c.NO_DETERMINABLE} no determinables desde el inventario`;
  });
}
