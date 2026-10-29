import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { Tree } from '../../../shared/components/organisms/tree/tree';
import { treeAncestorIds } from '../../../shared/components/organisms/tree/tree.logic';
import type { TreeNode } from '../../../shared/components/organisms/tree/tree.types';

import { outputsRecord } from './exit-log';
import type { ComponentScenario, ScenarioHost } from './scenario.types';

/* ============================================================================
    Escenarios de `app-tree` — el árbol de N niveles de la infraestructura.

    El generador de valores no puede adivinar un árbol de nodos anidados ni sus
    dos enlaces bidireccionales (`selectedId`, `expandedIds`). El anfitrión lo
    monta con un contrato válido —un hospital de cinco niveles— y anota lo que
    el árbol emite.
    ========================================================================== */

const KEY = 'shared/components/organisms/tree/tree';
const SOURCE = 'src/app/features/component-stock/scenarios/tree.scenarios.ts';

const HOSPITAL: readonly TreeNode[] = [
  {
    id: 'ed-a',
    label: 'Edificio A · Hospitalización',
    hint: 'ED-A',
    children: [
      {
        id: 'p3',
        label: 'Piso 3 · Internación',
        hint: 'P3',
        children: [
          {
            id: 'sala-3b',
            label: 'Sala 3B',
            hint: 'SALA-3B',
            children: [
              {
                id: 'h301',
                label: 'Habitación 301',
                hint: 'HAB-301',
                children: [
                  { id: '301-a', label: 'Cama 301-A', hint: '301-A' },
                  { id: '301-b', label: 'Cama 301-B', hint: '301-B' },
                ],
              },
              { id: 'h399', label: 'Habitación 399', hint: 'HAB-399', muted: true },
            ],
          },
        ],
      },
      { id: 'qx', label: 'Quirófano 3 · en obra', hint: 'QX-3', disabled: true },
    ],
  },
  { id: 'ed-b', label: 'Edificio B · Consultorios externos', hint: 'ED-B' },
];

export const TREE_VARIANTS = ['cerrado', 'abierto', 'seleccion', 'un-nodo'] as const;
export type TreeVariant = (typeof TREE_VARIANTS)[number];

@Component({
  selector: 'app-scenario-tree',
  imports: [Tree],
  template: `
    <app-tree
      label="Espacios del establecimiento"
      [nodes]="nodes()"
      [(selectedId)]="selectedId"
      [(expandedIds)]="expandedIds"
      (nodeActivated)="record.anotar('nodeActivated', $event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioTree implements ScenarioHost {
  readonly variante = input<TreeVariant>('cerrado');

  protected readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  protected readonly selectedId = signal<string | null>(null);
  protected readonly expandedIds = signal<readonly string[]>([]);

  protected nodes(): readonly TreeNode[] {
    return this.variante() === 'un-nodo' ? HOSPITAL.slice(1) : HOSPITAL;
  }

  constructor() {
    queueMicrotask(() => this.aplicar());
  }

  private aplicar(): void {
    const variante = this.variante();
    if (variante === 'abierto') this.expandedIds.set(['ed-a', 'p3', 'sala-3b', 'h301']);
    if (variante === 'seleccion') {
      this.expandedIds.set(treeAncestorIds(HOSPITAL, '301-b'));
      this.selectedId.set('301-b');
    }
  }
}

const FICHAS: Readonly<Record<TreeVariant, { titulo: string; seVe: string }>> = {
  cerrado: {
    titulo: 'Cerrado',
    seVe: 'Dos raíces con su triángulo; nada abierto. Un solo Tab entra a la primera fila.',
  },
  abierto: {
    titulo: 'Cinco niveles abiertos',
    seVe: 'Edificio → piso → sala → habitación → cama con sangría por nivel; la habitación 399 atenuada y tachada, el quirófano en obra deshabilitado.',
  },
  seleccion: {
    titulo: 'Con una cama elegida',
    seVe: 'Los ancestros de la cama 301-B abiertos y la fila resaltada con barra lateral.',
  },
  'un-nodo': {
    titulo: 'Una sola raíz sin hijos',
    seVe: 'Una fila sin triángulo (hoja): el árbol no inventa expansión.',
  },
};

export const TREE_SCENARIOS: readonly ComponentScenario[] = TREE_VARIANTS.map((variante) => ({
  id: `${KEY}#${variante}`,
  clave: KEY,
  variante,
  titulo: FICHAS[variante].titulo,
  seVe: FICHAS[variante].seVe,
  interacciones: [
    'Flechas ↓ ↑ mueven el foco; → abre o baja al primer hijo; ← cierra o sube al padre.',
    'Enter sobre una fila la elige y emite nodeActivated; Espacio sólo la elige.',
  ],
  salidasEsperadas: ['nodeActivated'],
  host: ScenarioTree,
  fuente: SOURCE,
}));
