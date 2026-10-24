import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type {
  EndpointContract,
  FlowBranch,
  FlowBranchKind,
  FlowNode,
  FlowNodeKind,
} from '../../../../core/data-access/admin-portal/flows.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import type { Rotulo } from '../../platform/platform-labels';
import { BRANCH_KIND, CONTRACT, NODE_KIND, veredicto } from '../flows-labels';

/** Una rama con el nodo al que lleva, si ese nodo se dibuja justo debajo de ella. */
interface RamaVista {
  readonly rama: FlowBranch;
  readonly hijo: NodoVista | null;
  /** Cuando el destino ya se dibuja en otro lugar: sólo se nombra. */
  readonly referencia: { readonly tipo: 'continua' | 'vuelve'; readonly titulo: string } | null;
}

interface NodoVista {
  readonly nodo: FlowNode;
  readonly ramas: readonly RamaVista[];
}

/**
 * El árbol de decisión de un flujo. Presentacional: recibe los nodos en orden de
 * recorrido (con `parentId`) y los dibuja anidados. Un nodo al que llegan varias
 * ramas se dibuja una vez, bajo la primera, y las demás lo nombran («continúa
 * en…»); un reintento se nombra («vuelve a…») en vez de dibujarse otra vez.
 *
 * Es un conjunto de listas anidadas con botones de plegado (`aria-expanded`),
 * no un widget `tree`: ese rol exige un modelo de teclado completo (flechas,
 * Inicio, Fin) y uno a medias es peor para quien usa lector de pantalla que
 * listas comunes con controles que ya se manejan con Tab y Enter.
 */
@Component({
  selector: 'app-flow-tree',
  imports: [NgTemplateOutlet, Badge, AppButton],
  templateUrl: './flow-tree.html',
  styleUrl: './flow-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowTree {
  readonly nodes = input.required<readonly FlowNode[]>();
  readonly rootId = input.required<string>();

  // Funciones y no tablas: el contexto de un `ng-template` recursivo es `any` y
  // indexar una tabla con él no compila (tsc no revisa plantillas; el build sí).
  protected readonly rotuloNodo = (kind: FlowNodeKind): Rotulo => NODE_KIND[kind];
  protected readonly rotuloRama = (kind: FlowBranchKind): Rotulo => BRANCH_KIND[kind];
  protected readonly rotuloContrato = (contract: EndpointContract): Rotulo => CONTRACT[contract];
  protected readonly veredicto = veredicto;

  /** Nodos plegados por quien lee; por defecto todo está abierto. */
  protected readonly plegados = signal<ReadonlySet<string>>(new Set());

  protected readonly raiz = computed<NodoVista | null>(() => {
    const nodos = this.nodes();
    const porId = new Map(nodos.map((n) => [n.id, n]));
    const raiz = porId.get(this.rootId());
    if (!raiz) return null;
    const construir = (nodo: FlowNode): NodoVista => ({
      nodo,
      ramas: nodo.branches.map((rama): RamaVista => {
        const destino = rama.next ?? rama.loopsTo;
        const objetivo = destino ? porId.get(destino) : undefined;
        if (!objetivo) return { rama, hijo: null, referencia: null };
        if (rama.next && objetivo.parentId === nodo.id) return { rama, hijo: construir(objetivo), referencia: null };
        return { rama, hijo: null, referencia: { tipo: rama.next ? 'continua' : 'vuelve', titulo: objetivo.title } };
      }),
    });
    return construir(raiz);
  });

  protected readonly conRamas = computed(() => this.nodes().filter((n) => n.branches.length > 0).map((n) => n.id));

  protected abierto(id: string): boolean {
    return !this.plegados().has(id);
  }

  protected alternar(id: string): void {
    this.plegados.update((actual) => {
      const siguiente = new Set(actual);
      if (!siguiente.delete(id)) siguiente.add(id);
      return siguiente;
    });
  }

  protected expandirTodo(): void {
    this.plegados.set(new Set());
  }

  protected contraerTodo(): void {
    this.plegados.set(new Set(this.conRamas()));
  }
}
