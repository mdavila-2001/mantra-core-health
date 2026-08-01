import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Pagination } from './pagination';
import { MAX_PAGE_SLOTS, PAGE_GAP } from './pagination.types';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botonesDePagina(): HTMLButtonElement[] {
    return [...host().querySelectorAll<HTMLButtonElement>('.pagination__pages button')];
  }

  function etiquetasVisibles(): string[] {
    return [...host().querySelectorAll<HTMLElement>('.pagination__pages li')].map((item) =>
      (item.textContent ?? '').trim(),
    );
  }

  function boton(aria: string): HTMLButtonElement {
    const element = host().querySelector<HTMLButtonElement>(`button[aria-label="${aria}"]`);
    if (element === null) {
      throw new Error(`no hay botón «${aria}»`);
    }
    return element;
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Pagination] }).compileComponents();
    fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('totalItems', 340);
    await fixture.whenStable();
  });

  describe('cálculo de páginas', () => {
    it('340 ítems de a 20 son 17 páginas', () => {
      expect(fixture.componentInstance.totalPages()).toBe(17);
    });

    it('una lista vacía sigue siendo una página, no cero', async () => {
      await setInputs({ totalItems: 0 });

      expect(fixture.componentInstance.totalPages()).toBe(1);
      expect(etiquetasVisibles()).toEqual(['1']);
    });

    it('el último ítem suelto ocupa su propia página', async () => {
      await setInputs({ totalItems: 41, pageSize: 20 });

      expect(fixture.componentInstance.totalPages()).toBe(3);
    });
  });

  describe('ventana de páginas', () => {
    it('con pocas páginas las muestra todas, sin saltos', async () => {
      await setInputs({ totalItems: 100, pageSize: 20 });

      expect(etiquetasVisibles()).toEqual(['1', '2', '3', '4', '5']);
    });

    it('cerca del inicio el salto va al final', async () => {
      await setInputs({ page: 2 });

      expect(etiquetasVisibles()).toEqual(['1', '2', '3', '4', '5', '…', '17']);
      expect(fixture.componentInstance.pageSlots()).toContain(PAGE_GAP);
    });

    it('en el medio hay salto de los dos lados', async () => {
      await setInputs({ page: 9 });

      expect(etiquetasVisibles()).toEqual(['1', '…', '8', '9', '10', '…', '17']);
    });

    it('cerca del final el salto va al principio', async () => {
      await setInputs({ page: 16 });

      expect(etiquetasVisibles()).toEqual(['1', '…', '13', '14', '15', '16', '17']);
    });

    it('nunca dibuja más botones que el tope', async () => {
      for (const page of [1, 3, 5, 9, 14, 17]) {
        await setInputs({ page });
        expect(fixture.componentInstance.pageSlots().length).toBeLessThanOrEqual(MAX_PAGE_SLOTS);
      }
    });

    it('el salto no se puede pulsar ni se anuncia', async () => {
      await setInputs({ page: 9 });

      const salto = host().querySelector('.pagination__gap');
      expect(salto?.getAttribute('aria-hidden')).toBe('true');
      expect(salto?.tagName).not.toBe('BUTTON');
    });
  });

  describe('navegación', () => {
    it('marca la página actual con aria-current', async () => {
      await setInputs({ page: 3 });

      const actual = botonesDePagina().filter(
        (candidato) => candidato.getAttribute('aria-current') === 'page',
      );
      expect(actual).toHaveLength(1);
      expect(actual[0].textContent?.trim()).toBe('3');
    });

    it('cada botón numérico dice qué página es', async () => {
      await setInputs({ page: 1 });

      expect(boton('Página 2').textContent?.trim()).toBe('2');
    });

    it('pulsar un número cambia la página', async () => {
      await setInputs({ page: 1 });

      boton('Página 3').click();
      await fixture.whenStable();

      expect(fixture.componentInstance.page()).toBe(3);
    });

    it('anterior y siguiente se mueven de a una', async () => {
      await setInputs({ page: 5 });

      boton('Página siguiente').click();
      await fixture.whenStable();
      expect(fixture.componentInstance.page()).toBe(6);

      boton('Página anterior').click();
      await fixture.whenStable();
      expect(fixture.componentInstance.page()).toBe(5);
    });

    it('en la primera, «anterior» está deshabilitado', async () => {
      await setInputs({ page: 1 });

      expect(boton('Página anterior').getAttribute('aria-disabled')).toBe('true');
      expect(boton('Página siguiente').getAttribute('aria-disabled')).toBe('false');
    });

    it('en la última, «siguiente» está deshabilitado', async () => {
      await setInputs({ page: 17 });

      expect(boton('Página siguiente').getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('clampeo defensivo', () => {
    it('una página mayor al total se dibuja como la última', async () => {
      await setInputs({ page: 999 });

      expect(fixture.componentInstance.currentPage()).toBe(17);
      const actual = botonesDePagina().find(
        (candidato) => candidato.getAttribute('aria-current') === 'page',
      );
      expect(actual?.textContent?.trim()).toBe('17');
    });

    it('cero o negativo se dibuja como la primera', async () => {
      for (const page of [0, -5]) {
        await setInputs({ page });
        expect(fixture.componentInstance.currentPage()).toBe(1);
      }
    });

    it('desde una página fuera de rango, navegar corrige el valor', async () => {
      await setInputs({ page: 999 });

      boton('Página anterior').click();
      await fixture.whenStable();

      expect(fixture.componentInstance.page()).toBe(16);
    });
  });

  describe('tamaño de página', () => {
    it('cambiarlo vuelve a la página 1', async () => {
      await setInputs({ page: 12 });

      const select = host().querySelector('select');
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error('el select de tamaño no está en el DOM');
      }
      // el `<option>` lleva el índice: 10 · 20 · 50 · 100 → el 50 es el índice 2
      select.value = '2';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(fixture.componentInstance.pageSize()).toBe(50);
      expect(fixture.componentInstance.page()).toBe(1);
    });

    it('se puede ocultar', async () => {
      expect(host().querySelector('app-select')).not.toBeNull();

      await setInputs({ showPageSize: false });
      expect(host().querySelector('app-select')).toBeNull();
    });
  });

  describe('rango informado', () => {
    it('dice qué ítems se están viendo, y se anuncia sin interrumpir', async () => {
      await setInputs({ page: 2 });

      const rango = host().querySelector('.pagination__range');
      expect(rango?.textContent?.replace(/\s+/g, ' ').trim()).toBe('21–40 de 340');
      expect(rango?.getAttribute('aria-live')).toBe('polite');
    });

    it('la última página informa el total real, no el múltiplo', async () => {
      await setInputs({ page: 17 });

      expect(host().querySelector('.pagination__range')?.textContent).toContain('321–340 de 340');
    });

    it('sin ítems el rango arranca en 0', async () => {
      await setInputs({ totalItems: 0 });

      expect(host().querySelector('.pagination__range')?.textContent).toContain('0–0 de 0');
    });
  });
});
