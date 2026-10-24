import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Grafo } from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { operacionSobreTabla, riesgo } from '../portal-labels';
import { EFFECT_ORDER, buildLanes, summarize } from './process-graph.model';

/** Cómo se cuenta cada tipo de nodo en el resumen. */
const NODE_NOUNS: Readonly<Record<string, [string, string]>> = {
  ETAPA: ['etapa', 'etapas'],
  OPERACION: ['operación', 'operaciones'],
  ACTOR: ['actor', 'actores'],
  TABLA: ['tabla', 'tablas'],
  DOMINIO: ['dominio', 'dominios'],
};

/**
 * El diagrama de un proceso como carriles: cada etapa con sus operaciones, quién
 * actúa en cada una y qué tablas escribe, borra o lee. Presentacional: recibe el
 * grafo y las direcciones de las fichas, y no pide nada.
 */
@Component({
  selector: 'app-portal-process-graph',
  imports: [RouterLink, Badge, Link],
  templateUrl: './process-graph.html',
  styleUrl: './process-graph.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessGraph {
  readonly graph = input.required<Grafo>();
  readonly operationUrl = input.required<(id: string) => string>();
  readonly tableUrl = input.required<(schema: string, table: string) => string>();

  protected readonly lanes = computed(() => buildLanes(this.graph()));
  protected readonly summary = computed(() => {
    const { nodes } = summarize(this.graph());
    return Object.entries(nodes)
      .map(([type, n]) => {
        const [one, many] = NODE_NOUNS[type] ?? [type, type];
        return `${n.toLocaleString('es-BO')} ${n === 1 ? one : many}`;
      })
      .join(' · ');
  });

  protected readonly effects = EFFECT_ORDER;
  protected readonly effect = operacionSobreTabla;
  protected readonly risk = riesgo;
}
