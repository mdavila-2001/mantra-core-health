import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  MAX_PAGE_SLOTS,
  PAGE_GAP,
  type PageSlot,
} from './pagination.types';

/**
 * Paginador de una tabla. `page` es **1-based**, como lo dice la interfaz:
 * el usuario lee «página 1», no «página 0».
 *
 * ```html
 * <app-pagination [totalItems]="340" [(page)]="pagina" [(pageSize)]="tamano" />
 * ```
 *
 * Cambiar el tamaño de página **vuelve a la 1**: quedarse en la página 12 tras
 * pasar de 100 a 10 por página deja al usuario en un lugar que no eligió.
 *
 * `page` fuera de rango no explota ni se queda pegado: lo que se dibuja y se
 * emite es siempre un valor válido.
 */
@Component({
  selector: 'app-pagination',
  imports: [AppButton, Select],
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pagination',
  },
})
export class Pagination {
  readonly totalItems = input.required<number>();
  readonly page = model<number>(1);
  readonly pageSize = model<number>(DEFAULT_PAGE_SIZE);
  readonly pageSizeOptions = input<readonly number[]>(DEFAULT_PAGE_SIZE_OPTIONS);
  readonly showPageSize = input(true, { transform: booleanAttribute });
  /**
   * El select para saltar directo a una página (ADR-0015, regla 7: «elegir de
   * una lista → select», ADR-0013). Complementa los botones numerados —no los
   * reemplaza—, porque con muchas páginas la ventana de botones deja huecos
   * («…») que el select sí cubre entero.
   */
  readonly showPageJump = input(true, { transform: booleanAttribute });

  protected readonly gap = PAGE_GAP;

  private readonly pagesList = viewChild<ElementRef<HTMLUListElement>>('pages');

  /** Dónde está el número de la página actual, medido en el DOM. */
  private readonly markerBox = signal<{ x: number; y: number; width: number; height: number } | null>(null);

  protected readonly markerTransform = computed(() => {
    const caja = this.markerBox();
    return caja === null ? 'scale(0)' : `translate(${caja.x}px, ${caja.y}px)`;
  });

  protected readonly markerWidth = computed(() => this.markerBox()?.width ?? 0);
  protected readonly markerHeight = computed(() => this.markerBox()?.height ?? 0);

  /**
   * La marca sólo se desliza a partir de la segunda posición: en la primera
   * aparece ya en su lugar, en vez de cruzar la fila desde la izquierda.
   */
  protected readonly markerReady = signal(false);

  protected readonly rangeLabel = computed(
    () => `${this.rangeStart()}–${this.rangeEnd()} de ${this.totalItems()}`,
  );

  constructor() {
    // Se mide después de pintar: la posición depende del ancho real de cada
    // número («1» y «120» no miden lo mismo) y de si la fila partió en dos.
    afterRenderEffect({
      read: () => {
        this.currentPage();
        this.pageSlots();
        const lista = this.pagesList()?.nativeElement;
        const actual = lista?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!actual) {
          this.markerBox.set(null);
          return;
        }
        const previa = this.markerBox();
        const caja = {
          x: actual.offsetLeft,
          y: actual.offsetTop,
          width: actual.offsetWidth,
          height: actual.offsetHeight,
        };
        if (
          previa?.x !== caja.x ||
          previa?.y !== caja.y ||
          previa?.width !== caja.width ||
          previa?.height !== caja.height
        ) {
          this.markerBox.set(caja);
          if (previa !== null) {
            this.markerReady.set(true);
          }
        }
      },
    });
  }

  readonly totalPages = computed(() => {
    const porPagina = Math.max(1, Math.trunc(this.pageSize()));
    return Math.max(1, Math.ceil(Math.max(0, this.totalItems()) / porPagina));
  });

  /** La página que realmente se dibuja: la pedida, recortada al rango real. */
  readonly currentPage = computed(() =>
    Math.min(this.totalPages(), Math.max(1, Math.trunc(this.page()) || 1)),
  );

  protected readonly isFirstPage = computed(() => this.currentPage() <= 1);
  protected readonly isLastPage = computed(() => this.currentPage() >= this.totalPages());

  /** Índice del primer ítem de la página, 1-based; 0 cuando no hay nada. */
  protected readonly rangeStart = computed(() =>
    this.totalItems() <= 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  protected readonly rangeEnd = computed(() =>
    Math.min(this.totalItems(), this.currentPage() * this.pageSize()),
  );

  protected readonly pageSizeChoices = computed<SelectOption<number>[]>(() =>
    this.pageSizeOptions().map((size) => ({ value: size, label: `${size} por página` })),
  );

  /** Una opción por página, `1..totalPages`. Con una sola página, una sola opción. */
  readonly pageJumpChoices = computed<SelectOption<number>[]>(() =>
    Array.from({ length: this.totalPages() }, (_, index) => {
      const numero = index + 1;
      return { value: numero, label: `Página ${numero}` };
    }),
  );

  /**
   * Los botones a dibujar. Con pocas páginas van todas; con muchas, siempre la
   * primera y la última —para saber dónde termina— más la actual con sus dos
   * vecinas, y saltos donde se corta la secuencia.
   */
  readonly pageSlots = computed<readonly PageSlot[]>(() => {
    const total = this.totalPages();
    if (total <= MAX_PAGE_SLOTS) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const actual = this.currentPage();
    const CERCA_DEL_BORDE = 4;

    if (actual <= CERCA_DEL_BORDE) {
      return [1, 2, 3, 4, 5, PAGE_GAP, total];
    }
    if (actual >= total - CERCA_DEL_BORDE + 1) {
      return [1, PAGE_GAP, total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, PAGE_GAP, actual - 1, actual, actual + 1, PAGE_GAP, total];
  });

  protected goTo(page: number): void {
    const destino = Math.min(this.totalPages(), Math.max(1, page));
    if (destino !== this.currentPage()) {
      this.page.set(destino);
      return;
    }
    // La página pedida podía venir fuera de rango: se corrige igual.
    if (destino !== this.page()) {
      this.page.set(destino);
    }
  }

  protected goToPrevious(): void {
    this.goTo(this.currentPage() - 1);
  }

  protected goToNext(): void {
    this.goTo(this.currentPage() + 1);
  }

  protected goToFromSelect(page: number | null): void {
    if (page !== null) {
      this.goTo(page);
    }
  }

  protected changePageSize(size: number | null): void {
    if (size === null || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
    // Volver al principio: el ítem que se estaba mirando ya no está en esta página.
    this.page.set(1);
  }
}
