import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';

import { Badge } from '../../atoms/badge/badge';
import type { FilaVisible, TreeItem } from './tree.types';

/** Cuánto dura el búfer del type-ahead, en milisegundos (WAI-ARIA APG). */
export const TREE_TYPEAHEAD_MS = 500;

/**
 * **Árbol de N niveles**, accesible — `role="tree"` del patrón WAI-ARIA.
 *
 * ```html
 * <app-tree
 *   label="Infraestructura del establecimiento"
 *   [items]="nodos()"
 *   [(selectedId)]="elegido"
 *   [(expandedIds)]="abiertos"
 * />
 * ```
 *
 * ## Por qué existe junto a `app-tree-select`
 *
 * `tree-select` es un **campo**: abre un diálogo, tiene un solo nivel de ramas
 * a propósito y termina eligiendo una hoja. La infraestructura de un hospital
 * es edificio > pabellón > piso > sala > habitación > cama: seis niveles que
 * se **navegan**, no un valor que se elige. Estirar `tree-select` a N niveles
 * cambiaría el contrato de las pantallas que lo usan; esto es otra pieza.
 *
 * ## Teclado (APG «Tree View»)
 *
 * - Flecha abajo / arriba: siguiente / anterior fila visible.
 * - Flecha derecha: abre la rama cerrada; si ya está abierta, baja al primer hijo.
 * - Flecha izquierda: cierra la rama abierta; si está cerrada o es hoja, sube al padre.
 * - Inicio / Fin: primera / última fila visible.
 * - Enter / Espacio: elige la fila.
 * - `*`: abre todas las ramas hermanas.
 * - Letras: type-ahead por el comienzo del rótulo.
 *
 * Un solo punto de tabulación (tabindex itinerante): Tab entra al árbol y lo
 * vuelve a dejar, no recorre cada fila.
 */
@Component({
  selector: 'app-tree',
  imports: [NgTemplateOutlet, Badge],
  templateUrl: './tree.html',
  styleUrl: './tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tree {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Los nodos raíz, con sus hijos. */
  readonly items = input.required<readonly TreeItem[]>();
  /** Nombre accesible del árbol. Obligatorio: un `role=tree` sin nombre no se entiende. */
  readonly label = input.required<string>();
  /** La fila elegida. */
  readonly selectedId = model<string | null>(null);
  /** Las ramas abiertas. */
  readonly expandedIds = model<readonly string[]>([]);

  /** La fila con el foco itinerante; cae en la elegida o en la primera. */
  private readonly enfocada = signal<string | null>(null);

  private busqueda = '';
  private ultimaTecla = 0;

  private readonly abiertas = computed(() => new Set(this.expandedIds()));

  /** Las filas visibles en orden de lectura: lo que recorre el teclado. */
  readonly visibles = computed<readonly FilaVisible[]>(() => {
    const abiertas = this.abiertas();
    const filas: FilaVisible[] = [];
    const recorrer = (nodos: readonly TreeItem[], level: number, parentId: string | null): void => {
      nodos.forEach((item, i) => {
        const hasChildren = (item.children?.length ?? 0) > 0;
        filas.push({ item, level, parentId, posInSet: i + 1, setSize: nodos.length, hasChildren });
        if (hasChildren && abiertas.has(item.id)) recorrer(item.children!, level + 1, item.id);
      });
    };
    recorrer(this.items(), 1, null);
    return filas;
  });

  /** El id que lleva `tabindex=0`. */
  readonly tabulable = computed<string | null>(() => {
    const visibles = this.visibles();
    const candidatos = [this.enfocada(), this.selectedId()];
    for (const id of candidatos) {
      if (id !== null && visibles.some((f) => f.item.id === id)) return id;
    }
    return visibles[0]?.item.id ?? null;
  });

  protected estaAbierta(id: string): boolean {
    return this.abiertas().has(id);
  }

  protected alternar(id: string, evento?: Event): void {
    evento?.stopPropagation();
    const abiertas = new Set(this.expandedIds());
    if (abiertas.has(id)) abiertas.delete(id);
    else abiertas.add(id);
    this.expandedIds.set([...abiertas]);
  }

  protected elegir(id: string): void {
    this.enfocada.set(id);
    this.selectedId.set(id);
  }

  protected alEnfocar(id: string): void {
    this.enfocada.set(id);
  }

  /** El manejador de teclado del árbol entero (un solo `keydown` en el `ul`). */
  protected alPresionar(evento: KeyboardEvent): void {
    const filas = this.visibles();
    const actualId = this.tabulable();
    const indice = filas.findIndex((f) => f.item.id === actualId);
    if (indice === -1) return;
    const actual = filas[indice]!;

    switch (evento.key) {
      case 'ArrowDown':
        this.mover(filas[indice + 1]?.item.id);
        break;
      case 'ArrowUp':
        this.mover(filas[indice - 1]?.item.id);
        break;
      case 'Home':
        this.mover(filas[0]?.item.id);
        break;
      case 'End':
        this.mover(filas[filas.length - 1]?.item.id);
        break;
      case 'ArrowRight':
        if (actual.hasChildren && !this.estaAbierta(actual.item.id)) this.alternar(actual.item.id);
        else if (actual.hasChildren) this.mover(actual.item.children![0]!.id);
        break;
      case 'ArrowLeft':
        if (actual.hasChildren && this.estaAbierta(actual.item.id)) this.alternar(actual.item.id);
        else if (actual.parentId !== null) this.mover(actual.parentId);
        break;
      case 'Enter':
      case ' ':
        this.elegir(actual.item.id);
        break;
      case '*': {
        const hermanas = filas.filter((f) => f.parentId === actual.parentId && f.hasChildren);
        this.expandedIds.set([...new Set([...this.expandedIds(), ...hermanas.map((f) => f.item.id)])]);
        break;
      }
      default:
        if (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
          this.buscar(evento.key, indice);
          break;
        }
        return;
    }
    evento.preventDefault();
  }

  /** Expande todo el camino hasta un id (lo usa quien abre el árbol en un nodo). */
  revelar(id: string): void {
    const camino: string[] = [];
    const buscar = (nodos: readonly TreeItem[], padres: string[]): boolean =>
      nodos.some((n) => {
        if (n.id === id) {
          camino.push(...padres);
          return true;
        }
        return buscar(n.children ?? [], [...padres, n.id]);
      });
    if (buscar(this.items(), [])) {
      this.expandedIds.set([...new Set([...this.expandedIds(), ...camino])]);
    }
  }

  private buscar(tecla: string, desde: number): void {
    const ahora = Date.now();
    this.busqueda = ahora - this.ultimaTecla > TREE_TYPEAHEAD_MS ? tecla : this.busqueda + tecla;
    this.ultimaTecla = ahora;
    const filas = this.visibles();
    const termino = this.busqueda.toLocaleLowerCase('es');
    // Con una sola letra se busca desde la siguiente: apretar «C» dos veces
    // pasa de «Cama A» a «Cama B». Con más letras se refina en el lugar.
    const inicio = this.busqueda.length === 1 ? desde + 1 : desde;
    for (let paso = 0; paso < filas.length; paso++) {
      const fila = filas[(inicio + paso) % filas.length]!;
      if (fila.item.label.toLocaleLowerCase('es').startsWith(termino)) {
        this.mover(fila.item.id);
        return;
      }
    }
  }

  private mover(id: string | undefined): void {
    if (id === undefined) return;
    this.enfocada.set(id);
    // Se compara el atributo en vez de armar un selector: un id con comillas
    // o corchetes rompería `querySelector`, y `CSS.escape` no existe en SSR.
    const filas = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-tree-id]');
    for (const fila of Array.from(filas)) {
      if (fila.dataset['treeId'] === id) {
        fila.focus();
        return;
      }
    }
  }
}
