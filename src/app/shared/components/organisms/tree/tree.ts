import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  type TemplateRef,
} from '@angular/core';

import { nextControlId } from '../../../forms/form-control.context';
import { flattenTree, moveFor, typeAheadTarget, type TreeMove } from './tree.logic';
import type { TreeNode, TreeRow, TreeRowContext } from './tree.types';

/** Tiempo sin teclear tras el cual la escritura anticipada empieza de cero. */
const REINICIO_ESCRITURA_MS = 600;

/**
 * **Árbol de N niveles** — una jerarquía navegable, con selección y apertura.
 *
 * ```html
 * <app-tree
 *   label="Espacios del establecimiento"
 *   [nodes]="raices()"
 *   [(selectedId)]="elegido"
 *   [(expandedIds)]="abiertos"
 *   [trailing]="insignia"
 * />
 * ```
 *
 * ## Por qué existe, y qué no es
 *
 * `app-tree-select` es un **campo**: abre un diálogo para elegir una hoja y su
 * árbol tiene un solo nivel de anidamiento a propósito. Esto es una **vista** de
 * árbol, de profundidad libre, que se queda en la página: edificio → piso →
 * sala → habitación → cama. `medication-tree` usa `<details>` anidados porque su
 * contenido se carga al abrir; este necesita selección y teclado propios.
 *
 * ## Accesibilidad (patrón «Tree View» de ARIA)
 *
 * - `role="tree"` con filas `role="treeitem"` y `aria-level`, `aria-setsize`,
 *   `aria-posinset`; `aria-expanded` sólo en las que tienen hijos;
 *   `aria-selected` en la elegida.
 * - **Un solo tabulador** (foco itinerante): entra la fila elegida, o la primera.
 * - ↓ ↑ mueven el foco; → abre o baja al primer hijo; ← cierra o sube al padre;
 *   Inicio/Fin van a los extremos; `*` abre a los hermanos; Enter y Espacio
 *   eligen (Enter además emite `nodeActivated`); teclear una letra salta a la
 *   próxima fila que empieza así.
 * - El nombre accesible de cada fila es **su rótulo**, no el de todo lo que
 *   contiene: la fila apunta con `aria-labelledby` a su propio nombre.
 * - La lista es **plana** (con `aria-level`), no anidada: así el foco y las
 *   flechas recorren exactamente lo que se ve, sin grupos que se monten y se
 *   desmonten.
 *
 * ## Lo que no hace
 *
 * No carga hijos bajo demanda, no arrastra y no edita: recibe el árbol entero y
 * dice qué se eligió. Quien lo monta decide qué significa elegir.
 */
@Component({
  selector: 'app-tree',
  imports: [NgTemplateOutlet],
  templateUrl: './tree.html',
  styleUrl: './tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tree<T = unknown> {
  /** Las raíces, con sus hijos anidados. */
  readonly nodes = input.required<readonly TreeNode<T>[]>();

  /** Nombre accesible del árbol entero. */
  readonly label = input.required<string>();

  /** El nodo elegido. Enlazable en dos sentidos. */
  readonly selectedId = model<string | null>(null);

  /** Los nodos abiertos. Enlazable en dos sentidos. */
  readonly expandedIds = model<readonly string[]>([]);

  /**
   * Contenido extra al final de cada fila —una insignia de estado, un
   * recuento—. El nombre y el aviso (`hint`) los dibuja el árbol.
   */
  readonly trailing = input<TemplateRef<TreeRowContext<T>> | null>(null);

  /** Enter sobre una fila: «abrir» el nodo, a diferencia de sólo elegirlo. */
  readonly nodeActivated = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly baseId = nextControlId('tree');

  protected readonly rows = computed<readonly TreeRow<T>[]>(() =>
    flattenTree(this.nodes(), new Set(this.expandedIds())),
  );

  /** La fila que tuvo el foco por última vez. */
  private readonly focusedId = signal<string | null>(null);

  /** La única fila alcanzable con Tab: la enfocada, la elegida o la primera. */
  protected readonly tabbableId = computed<string | null>(() => {
    const filas = this.rows();
    const existe = (id: string | null): id is string => id !== null && filas.some((f) => f.node.id === id);
    const enfocada = this.focusedId();
    if (existe(enfocada)) return enfocada;
    const elegida = this.selectedId();
    if (existe(elegida)) return elegida;
    return filas[0]?.node.id ?? null;
  });

  private escrito = '';
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  protected itemId(id: string): string {
    return `${this.baseId}-${id}`;
  }

  protected nameId(id: string): string {
    return `${this.baseId}-${id}-name`;
  }

  protected contextOf(fila: TreeRow<T>): TreeRowContext<T> {
    return {
      $implicit: fila.node,
      level: fila.level,
      expanded: fila.expanded,
      selected: this.selectedId() === fila.node.id,
    };
  }

  protected onFocus(id: string): void {
    this.focusedId.set(id);
  }

  protected onRowClick(fila: TreeRow<T>): void {
    this.focusedId.set(fila.node.id);
    if (!fila.node.disabled) this.selectedId.set(fila.node.id);
  }

  protected onToggleClick(event: Event, fila: TreeRow<T>): void {
    event.stopPropagation();
    this.focusedId.set(fila.node.id);
    this.setExpanded(fila.node.id, !fila.expanded);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const destino = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const id = destino?.dataset['nodeId'];
    if (id === undefined) return;

    const movimiento = moveFor(event.key, this.rows(), id);
    if (movimiento.kind !== 'none') {
      event.preventDefault();
      this.apply(movimiento);
      return;
    }

    if (event.key.length === 1 && event.key !== ' ') {
      this.escrito += event.key;
      if (this.temporizador !== null) clearTimeout(this.temporizador);
      this.temporizador = setTimeout(() => (this.escrito = ''), REINICIO_ESCRITURA_MS);
      const objetivo = typeAheadTarget(this.escrito, this.rows(), id);
      if (objetivo !== null) {
        event.preventDefault();
        this.focusRow(objetivo);
      }
    }
  }

  private apply(movimiento: TreeMove): void {
    switch (movimiento.kind) {
      case 'focus':
        this.focusRow(movimiento.id);
        break;
      case 'expand':
        this.setExpanded(movimiento.id, true);
        break;
      case 'collapse':
        this.setExpanded(movimiento.id, false);
        break;
      case 'expand-siblings': {
        const fila = this.rows().find((f) => f.node.id === movimiento.id);
        const hermanos = this.rows().filter((f) => f.parentId === fila?.parentId && f.expandable);
        this.expandedIds.set([...new Set([...this.expandedIds(), ...hermanos.map((f) => f.node.id)])]);
        break;
      }
      case 'select': {
        const fila = this.rows().find((f) => f.node.id === movimiento.id);
        if (fila === undefined || fila.node.disabled) break;
        this.selectedId.set(movimiento.id);
        if (movimiento.activate) this.nodeActivated.emit(movimiento.id);
        break;
      }
      case 'none':
        break;
    }
  }

  private setExpanded(id: string, abrir: boolean): void {
    const actuales = new Set(this.expandedIds());
    if (abrir) actuales.add(id);
    else actuales.delete(id);
    this.expandedIds.set([...actuales]);
  }

  private focusRow(id: string): void {
    this.focusedId.set(id);
    // El foco real viaja después del render: la fila puede no existir todavía.
    queueMicrotask(() => {
      // Se compara el atributo en vez de armar un selector con el id: no hay que escapar nada.
      const filas = this.host.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]');
      Array.from(filas)
        .find((f) => f.dataset['nodeId'] === id)
        ?.focus();
    });
  }
}
