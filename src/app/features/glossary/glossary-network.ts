import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryGraph,
  GlossaryGraphEdge,
  GlossaryGraphNode,
  GlossaryRelationType,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

const RELATION_LABELS: Readonly<Record<GlossaryRelationType, string>> = {
  DISEASE: 'Enfermedad o síntoma asociado',
  SYMPTOM: 'Síntoma asociado',
  TREATMENT: 'Tratamiento',
  PROCEDURE: 'Procedimiento',
  ANATOMY: 'Anatomía',
  DIAGNOSTIC_TEST: 'Prueba diagnóstica',
  RELATED_TERM: 'Término relacionado',
  SPECIALTY: 'Especialidad médica',
  INCLUDES: 'Incluye',
  PERFORMS: 'Realiza',
  SENDS_DATA_TO: 'Envía datos a',
};

const RELATION_COLORS: Readonly<Record<GlossaryRelationType, string>> = {
  DISEASE: '#9b3f70',
  SYMPTOM: '#b54708',
  TREATMENT: '#26816c',
  PROCEDURE: '#7654a4',
  ANATOMY: '#bd7627',
  DIAGNOSTIC_TEST: '#3977a8',
  RELATED_TERM: '#667085',
  SPECIALTY: '#6b5dd3',
  INCLUDES: '#2f6f8f',
  PERFORMS: '#8a5a12',
  SENDS_DATA_TO: '#1d7a52',
};

interface PuntoDeGrafo {
  readonly node: GlossaryGraphNode;
  readonly x: number;
  readonly y: number;
}

interface ConexionVisible {
  readonly edge: GlossaryGraphEdge;
  readonly node: GlossaryGraphNode;
  readonly direction: 'saliente' | 'entrante';
}

@Component({
  selector: 'app-glossary-network',
  imports: [Card, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './glossary-network.html',
  styleUrl: './glossary-network.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryNetwork {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly graph = signal<ViewState<GlossaryGraph>>(loading());
  protected readonly focusFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('focus') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('focus') ?? '' },
  );

  protected readonly data = computed(() => {
    const state = this.graph();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly nodes = computed(() => this.data()?.nodes ?? []);
  protected readonly titleNode = computed(() => {
    const nodes = this.nodes();
    const wanted = this.focusFromUrl();
    return (
      nodes.find((node) => node.slug === wanted) ??
      nodes.find((node) => node.category?.internalCode === 'glossary-category-disease') ??
      nodes[0] ??
      null
    );
  });
  protected readonly connections = computed<readonly ConexionVisible[]>(() => {
    const focus = this.titleNode();
    const data = this.data();
    if (focus === null || data === null) return [];
    const nodeById = new Map(data.nodes.map((node) => [node.conceptId, node]));
    return data.edges.flatMap((edge) => {
      const outgoing = edge.sourceConceptId === focus.conceptId;
      const incoming = edge.targetConceptId === focus.conceptId;
      if (!outgoing && !incoming) return [];
      const otherId = outgoing ? edge.targetConceptId : edge.sourceConceptId;
      const node = nodeById.get(otherId);
      return node === undefined
        ? []
        : [{ edge, node, direction: outgoing ? 'saliente' as const : 'entrante' as const }];
    }).sort((a, b) =>
      (RELATION_LABELS[a.edge.type] + a.node.display).localeCompare(
        RELATION_LABELS[b.edge.type] + b.node.display,
        'es',
      ),
    );
  });
  protected readonly points = computed<readonly PuntoDeGrafo[]>(() => {
    const focus = this.titleNode();
    const neighbors = [
      ...new Map<string, GlossaryGraphNode>(
        this.connections().map((connection) => [
          connection.node.conceptId,
          connection.node,
        ]),
      ).values(),
    ];
    if (focus === null) return [];
    const count = neighbors.length;
    return [
      { node: focus, x: 500, y: 320 },
      ...neighbors.map((node, index) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1);
        return {
          node,
          x: 500 + Math.cos(angle) * 285,
          y: 320 + Math.sin(angle) * 235,
        };
      }),
    ];
  });
  protected readonly positionById = computed(
    () => new Map(this.points().map((point) => [point.node.conceptId, point])),
  );

  constructor() {
    this.cargar();
  }

  protected cambiarFoco(event: Event): void {
    const slug = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focus: slug || null },
      queryParamsHandling: 'merge',
    });
  }

  protected seleccionarNodo(node: GlossaryGraphNode): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focus: node.slug },
      queryParamsHandling: 'merge',
    });
  }

  protected etiquetaRelacion(type: GlossaryRelationType): string {
    return RELATION_LABELS[type];
  }

  protected etiquetaConexion(connection: ConexionVisible): string {
    if (
      connection.edge.type === 'DISEASE' &&
      connection.node.category?.internalCode === 'glossary-category-signs-symptoms'
    ) {
      return 'Síntoma asociado';
    }
    if (
      connection.edge.type === 'DISEASE' &&
      connection.node.category?.internalCode === 'glossary-category-disease'
    ) {
      return 'Enfermedad relacionada';
    }
    return this.etiquetaRelacion(connection.edge.type);
  }

  protected colorRelacion(type: GlossaryRelationType): string {
    return RELATION_COLORS[type];
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.graph.set(loading());
    this.terminology.readGlossaryGraph().subscribe({
      next: (graph) => this.graph.set(ready(graph)),
      error: (error: unknown) => this.graph.set(errorToViewState<GlossaryGraph>(error)),
    });
  }
}
