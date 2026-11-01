import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  PuntoDeOrigen,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';

import { type GraphNode, type PlacedNode, type PlacedTree } from '../../../../glossary/glossary-graph.layout';
import { GraphViewport } from '../../../../glossary/glossary-graph.viewport';
import {
  ramaDesde,
  type EstadoDeRama,
} from '../medication-tree/medication-tree.logic';
import {
  buildMedicationTree,
  layoutMedicationGraph,
  resolveNodeDetail,
} from './medication-graph.tree';
import type {
  MedicationGraphMode,
  SelectedMedicationNodeDetail,
} from './medication-graph.types';

const MODE_OPTIONS: readonly SegmentedOption<MedicationGraphMode>[] = [
  { value: 'graph', label: 'Grafo visual' },
  { value: 'list', label: 'Lista' },
];

/** Cuántos cuadros se espera a que el lienzo tenga medida antes de rendirse. */
const FIT_RETRIES = 30;

/**
 * **Grafo Visual de Medicamentos**
 *
 * Muestra el compuesto químico activo, su indicación terapéutica y ramifica
 * a todas sus marcas comerciales equivalentes y farmacias que las ofrecen hoy.
 *
 * Inspirado directamente en el grafo del glosario médico (`GlossaryGraph`),
 * adaptado a la consulta didáctica y visual para pacientes.
 */
@Component({
  selector: 'app-medication-graph',
  imports: [
    AppButton,
    Badge,
    EmptyState,
    NgTemplateOutlet,
    SegmentedControl,
  ],
  templateUrl: './medication-graph.html',
  styleUrl: './medication-graph.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationGraph {
  /** Medicamentos devueltos por la búsqueda. */
  readonly medications = input.required<readonly TarjetaDeMedicamento[]>();

  /** Origen para calcular distancias a las farmacias. */
  readonly origin = input<PuntoDeOrigen | null>(null);

  /** Término buscado por el paciente (para resaltar coincidencias de marca). */
  readonly searchTerm = input<string>('');

  /** Emite al pedir abrir el modal con el mapa de disponibilidad. */
  readonly pharmaciesRequested = output<TarjetaDeMedicamento>();

  private readonly vitrina = inject(PublicMarketplaceClient);
  private readonly destruir = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild<ElementRef<SVGSVGElement>>('canvas');

  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly mode = signal<MedicationGraphMode>('graph');

  /** Compuesto enfocado actualmente. */
  readonly selectedConceptId = signal<string>('');

  /** Caché de disponibilidad por concepto. */
  protected readonly ramas = signal<ReadonlyMap<string, EstadoDeRama>>(new Map());

  /** Detalle del nodo seleccionado para el panel lateral. */
  readonly selectedNode = signal<SelectedMedicationNodeDetail | null>(null);

  protected readonly viewport = new GraphViewport(() => {
    const el = this.canvas()?.nativeElement;
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });

  /** El medicamento central que se está dibujando en el grafo. */
  readonly currentMedication = computed<TarjetaDeMedicamento | null>(() => {
    const meds = this.medications();
    if (meds.length === 0) return null;
    const targetId = this.selectedConceptId();
    if (targetId !== '') {
      const match = meds.find((m) => m.conceptId === targetId);
      if (match) return match;
    }
    // Si el término coincide con alguna marca de un medicamento, enfocarlo
    const search = this.searchTerm().trim().toLowerCase();
    if (search !== '') {
      const matchBrand = meds.find((m) =>
        m.brands.some((b) => b.toLowerCase().includes(search)),
      );
      if (matchBrand) return matchBrand;
    }
    return meds[0];
  });

  /** El árbol de nodos colocados en el lienzo. */
  readonly placed = computed<PlacedTree | null>(() => {
    const med = this.currentMedication();
    if (!med) return null;
    const rama = this.ramas().get(med.conceptId);
    return layoutMedicationGraph(med, rama, this.searchTerm());
  });

  /** Estructura de árbol sin posicionar para la vista de lista accesible. */
  readonly tree = computed<GraphNode | null>(() => {
    const med = this.currentMedication();
    if (!med) return null;
    const rama = this.ramas().get(med.conceptId);
    return buildMedicationTree(med, rama, this.searchTerm());
  });

  constructor() {
    // Al cambiar de medicamento actual, pedir sus proveedores si no están en caché
    effect(() => {
      const med = this.currentMedication();
      if (!med) {
        this.selectedNode.set(null);
        return;
      }
      untracked(() => {
        // Inicializar la ficha con el compuesto químico
        const rama = this.ramas().get(med.conceptId);
        const rootNode = buildMedicationTree(med, rama, this.searchTerm());
        this.selectedNode.set(resolveNodeDetail(rootNode, med, rama));
        this.cargarDisponibilidad(med);
      });
    });

    // Ajustar el encuadre cuando cambie el árbol
    effect(() => {
      const tree = this.placed();
      if (tree === null) return;
      untracked(() => {
        if (this.viewport.untouched) {
          this.fit();
        }
      });
    });
  }

  /** Selecciona otro compuesto para mostrar en el grafo. */
  selectMedication(conceptId: string): void {
    this.selectedConceptId.set(conceptId);
    this.viewport.markTouched();
  }

  /** Cambia el modo entre dibujo visual y lista semántica. */
  setMode(mode: MedicationGraphMode): void {
    this.mode.set(mode);
    if (mode === 'graph') {
      this.fit();
    }
  }

  /** Al hacer clic en un nodo del grafo. */
  activate(node: GraphNode): void {
    const med = this.currentMedication();
    if (!med) return;
    const rama = this.ramas().get(med.conceptId);
    const detail = resolveNodeDetail(node, med, rama);
    this.selectedNode.set(detail);
  }

  isSelected(node: GraphNode): boolean {
    const sel = this.selectedNode();
    if (!sel) return false;
    if (sel.type === 'compound' && node.key.startsWith('compuesto:')) return true;
    if (sel.type === 'use' && node.key.startsWith('uso:')) return true;
    if (sel.type === 'brand' && node.key === `marca:${this.currentMedication()?.conceptId}:${sel.brandName}`) return true;
    if (sel.type === 'pharmacy' && node.key === `prov:${this.currentMedication()?.conceptId}:${sel.brandName}:${sel.pharmacySlug}`) return true;
    return false;
  }

  centerX(entry: PlacedNode): number {
    return entry.node.kind === 'term' ? entry.x + 14 : entry.x + entry.width / 2;
  }

  ariaLabelOf(node: GraphNode): string {
    return `${node.label}. ${node.sublabel ?? ''}. ${node.definition ?? ''}`;
  }

  /** Carga la disponibilidad y farmacias proveedoras de un compuesto. */
  cargarDisponibilidad(med: TarjetaDeMedicamento): void {
    const previo = this.ramas().get(med.conceptId);
    if (previo?.estado === 'datos' || previo?.estado === 'carga') {
      return;
    }

    const mapaActual = new Map(this.ramas());
    mapaActual.set(med.conceptId, { estado: 'carga' });
    this.ramas.set(mapaActual);

    const origen = this.origin();
    this.vitrina
      .getAvailability(med.conceptId, { origin: origen ?? undefined })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (disp) => {
          const nuevoMapa = new Map(this.ramas());
          nuevoMapa.set(med.conceptId, ramaDesde(disp));
          this.ramas.set(nuevoMapa);
        },
        error: () => {
          const nuevoMapa = new Map(this.ramas());
          nuevoMapa.set(med.conceptId, { estado: 'error' });
          this.ramas.set(nuevoMapa);
        },
      });
  }

  /** Ajusta el zoom y el centro del grafo para que quepa en el lienzo. */
  fit(): void {
    const lienzo = this.canvas()?.nativeElement;
    const tree = this.placed();
    if (!lienzo || !tree) return;

    let retries = FIT_RETRIES;
    const intentar = (): void => {
      const rect = lienzo.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.viewport.fit(tree.width, tree.height);
        return;
      }
      if (--retries > 0) {
        afterNextRender(intentar, { injector: this.injector });
      }
    };
    afterNextRender(intentar, { injector: this.injector });
  }

  verFarmacias(): void {
    const med = this.currentMedication();
    if (med) {
      this.pharmaciesRequested.emit(med);
    }
  }
}
