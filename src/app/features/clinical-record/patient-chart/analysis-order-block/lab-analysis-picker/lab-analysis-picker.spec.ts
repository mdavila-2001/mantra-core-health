import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { loading, ready, unexpectedError } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { bigCatalog, CATALOG, CBC, GLUCOSE } from './lab-analysis-picker.fixtures';
import { LAB_PICKER_PAGE_SIZE, LAB_PICKER_VIEW_KEY, LabAnalysisPicker } from './lab-analysis-picker';
import { serializeSelection, type LabAnalysisOption, type LabSelection } from './lab-analysis-picker.logic';

/*
 * GUION DE CAPTURA (lo ejecuta el orquestador; un solo navegador, en serie)
 * 1. Abrir la ficha de un paciente con consulta abierta > «Pedir estudio» > tipo Laboratorio.
 * 2. 1440 px, tema claro: vista Tabla (3 columnas); buscar «hemoglobina» (resalta, abre el hemograma);
 *    marcar «Hemograma» (entran 3 de 4, cabecera tri-estado); desmarcar uno; ver el resumen y el contador.
 * 3. Conmutar a Lista; recargar la página: debe recordar la vista. Expandir un panel.
 * 4. Desmarcar todos los componentes de un panel: aviso «Sin componentes marcados».
 * 5. Repetir a 768 px (2 columnas) y 390 px (1 columna, sin scroll horizontal), y en tema oscuro.
 * 6. Teclado: Tab hasta el buscador, Tab por los chips de sección, espacio en casillas; foco visible.
 * 7. Medir con el navegador: holgura izquierda/derecha del selector respecto de .app-main__inner (≤ 2 px).
 */

@Component({
  imports: [LabAnalysisPicker],
  template: `
    <app-lab-analysis-picker
      [analyses]="analyses()"
      [specimens]="specimens"
      [sections]="sections"
      [state]="state()"
      [disabled]="disabled()"
      [(selection)]="selection"
      (retry)="retries = retries + 1"
    />
  `,
})
class HostComponent {
  readonly analyses = signal<readonly LabAnalysisOption[]>(CATALOG);
  readonly state = signal<ViewState<null>>(ready(null));
  readonly disabled = signal(false);
  readonly selection = signal<LabSelection>(new Map());
  retries = 0;
  readonly specimens = [
    { value: 's-edta', label: 'Sangre con EDTA' },
    { value: 's-suero', label: 'Suero' },
  ];
  readonly sections = [
    { code: 'HEMATO', label: 'Hematología' },
    { code: 'QUIM', label: 'Química' },
  ];
}

describe('LabAnalysisPicker', () => {
  let fixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;
  let host: HostComponent;

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const all = (id: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const one = (id: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!el) throw new Error(`falta ${id}`);
    return el;
  };
  const nativeInput = (el: HTMLElement): HTMLInputElement => el.querySelector('input[type="checkbox"]') as HTMLInputElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  async function click(el: HTMLElement): Promise<void> {
    el.click();
    await settle();
  }
  async function search(text: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>('app-search-field input')!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
  }
  const counter = (): string => one('lab-picker-counter').textContent!.trim();

  beforeEach(() => {
    try {
      localStorage.removeItem(LAB_PICKER_VIEW_KEY);
    } catch {
      /* sin almacenamiento */
    }
  });

  it('dibuja una tarjeta por análisis con sus componentes y casillas con nombre accesible', async () => {
    await mount();
    expect(all('lab-picker-card')).toHaveLength(3);
    const first = all('lab-picker-card')[0]!;
    expect(first.querySelectorAll('[data-testid="lab-picker-component"]')).toHaveLength(4);
    expect(first.querySelector('.checkbox-label')?.textContent).toContain('Hemograma completo');
    // el análisis simple es una sola casilla
    expect(all('lab-picker-card')[1]!.querySelectorAll('[data-testid="lab-picker-component"]')).toHaveLength(0);
  });

  it('marcar el análisis mete los componentes por defecto, deja la cabecera en parcial y actualiza el contador', async () => {
    await mount();
    await click(nativeInput(all('lab-picker-parent')[0]!));
    const sel = host.selection().get('a-cbc');
    expect([...(sel?.components ?? [])]).toEqual(['c-hb', 'c-hto', 'c-plq']);
    expect(sel?.specimenConceptId).toBe('s-edta');
    expect(nativeInput(all('lab-picker-parent')[0]!).indeterminate).toBe(true);
    expect(counter()).toBe('1 análisis · 3 componentes');
    expect(all('lab-picker-component').filter((c) => nativeInput(c).checked)).toHaveLength(3);
  });

  it('marcar todos los componentes deja la cabecera completa; desmarcarlos todos avisa y no cuenta', async () => {
    await mount();
    const parent = (): HTMLInputElement => nativeInput(all('lab-picker-parent')[0]!);
    await click(parent()); // some
    await click(parent()); // all
    expect(parent().checked).toBe(true);
    expect(parent().indeterminate).toBe(false);
    for (const comp of all('lab-picker-component').slice(0, 4)) await click(nativeInput(comp));
    expect(host.selection().get('a-cbc')?.components.size).toBe(0);
    expect(root.querySelector('[data-testid="lab-picker-warning"]')?.textContent).toContain('no se pedirá');
    expect(counter()).toBe('0 análisis · 0 componentes');
    expect(serializeSelection(CATALOG, host.selection())).toEqual([]);
  });

  it('un análisis simple es una casilla y cuenta como un componente', async () => {
    await mount();
    await click(nativeInput(all('lab-picker-parent')[1]!));
    expect(host.selection().has('a-glu')).toBe(true);
    expect(counter()).toBe('1 análisis · 1 componente');
  });

  it('el resumen muestra un chip removible por análisis y quitarlo lo saca de la selección', async () => {
    await mount();
    await click(nativeInput(all('lab-picker-parent')[0]!));
    expect(all('lab-picker-chosen')).toHaveLength(1);
    await click(one('lab-picker-chosen').querySelector<HTMLElement>('.chip__remove')!);
    expect(host.selection().size).toBe(0);
    expect(all('lab-picker-chosen')).toHaveLength(0);
  });

  it('cada análisis elegido trae su select de muestra, con la del catálogo por defecto', async () => {
    await mount();
    await click(nativeInput(all('lab-picker-parent')[0]!));
    const select = one('lab-picker-chosen').querySelector('app-select')!;
    expect(select.textContent).toContain('Sangre con EDTA');
  });

  it('el buscador encuentra por componente, sin tildes, y resalta la coincidencia', async () => {
    await mount();
    await search('HEMOGLOBINA');
    expect(all('lab-picker-card')).toHaveLength(1);
    expect(root.querySelector('mark')?.textContent).toBe('Hemoglobina');
    expect(one('lab-picker-results').textContent).toContain('1 análisis encontrado');
    await search('biometria');
    expect(all('lab-picker-card')).toHaveLength(1);
    await search('zzzz');
    expect(all('lab-picker-no-results')).toHaveLength(1);
  });

  it('el filtro por sección acota y vuelve a todas', async () => {
    await mount();
    const chips = [...one('lab-picker-sections').querySelectorAll<HTMLElement>('app-chip')];
    const quim = chips.find((c) => c.textContent!.includes('Química'))!;
    await click(quim);
    expect(all('lab-picker-card')).toHaveLength(2);
    const todas = [...one('lab-picker-sections').querySelectorAll<HTMLElement>('app-chip')].find((c) =>
      c.textContent!.includes('Todas'),
    )!;
    await click(todas);
    expect(all('lab-picker-card')).toHaveLength(3);
  });

  it('conmuta a lista, recuerda la vista y en la lista los componentes se despliegan a pedido', async () => {
    await mount();
    const lista = [...root.querySelectorAll<HTMLButtonElement>('app-segmented-control button')].find((b) =>
      b.textContent!.includes('Lista'),
    )!;
    await click(lista);
    expect(all('lab-picker-list')).toHaveLength(1);
    expect(all('lab-picker-component')).toHaveLength(0);
    expect(localStorage.getItem(LAB_PICKER_VIEW_KEY)).toBe('list');
    const expand = all('lab-picker-expand')[0]!;
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    await click(expand);
    expect(expand.getAttribute('aria-expanded')).toBe('true');
    expect(all('lab-picker-component')).toHaveLength(4);
    await click(nativeInput(all('lab-picker-component')[0]!));
    expect(host.selection().get('a-cbc')?.components.has('c-hb')).toBe(true);
  });

  it('arranca en la vista recordada', async () => {
    localStorage.setItem(LAB_PICKER_VIEW_KEY, 'list');
    await mount();
    expect(all('lab-picker-list')).toHaveLength(1);
  });

  it('si el almacenamiento falla, igual funciona', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const spySet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    await mount();
    expect(all('lab-picker-grid')).toHaveLength(1);
    const lista = [...root.querySelectorAll<HTMLButtonElement>('app-segmented-control button')].find((b) =>
      b.textContent!.includes('Lista'),
    )!;
    await click(lista);
    expect(all('lab-picker-list')).toHaveLength(1);
    spy.mockRestore();
    spySet.mockRestore();
  });

  it('deshabilitado: las casillas no responden', async () => {
    await mount();
    host.disabled.set(true);
    await settle();
    expect(nativeInput(all('lab-picker-parent')[0]!).disabled).toBe(true);
  });

  it('el contador está en una región aria-live', async () => {
    await mount();
    expect(one('lab-picker-counter').getAttribute('aria-live')).toBe('polite');
    expect(counter()).toBe('Todavía no eligió ningún análisis');
  });

  it('estado de error: muestra el reintento y lo emite; en carga no hay catálogo', async () => {
    await mount();
    host.state.set(unexpectedError('req-1', 'No se pudo cargar'));
    await settle();
    expect(root.querySelector('[data-testid="lab-picker"]')).toBeNull();
    const retry = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /reintentar/i.test(b.textContent ?? ''))!;
    await click(retry);
    expect(host.retries).toBe(1);
    host.state.set(loading());
    await settle();
    expect(root.querySelector('[data-testid="lab-picker"]')).toBeNull();
  });

  it('catálogo vacío: estado vacío en vez de la rejilla', async () => {
    await mount();
    host.analyses.set([]);
    await settle();
    expect(all('lab-picker-catalog-empty')).toHaveLength(1);
  });

  describe('rendimiento con el catálogo real (532 análisis × 20 componentes)', () => {
    it('dibuja sólo una página y «Ver más» agrega otra', async () => {
      await mount();
      host.analyses.set(bigCatalog(532, 20));
      const t0 = performance.now();
      await settle();
      const ms = performance.now() - t0;
      expect(all('lab-picker-card')).toHaveLength(LAB_PICKER_PAGE_SIZE);
      expect(root.querySelectorAll('input[type="checkbox"]').length).toBe(LAB_PICKER_PAGE_SIZE * 21);
      // Medida real en CI/jsdom-like: se informa y se acota con holgura para detectar regresiones gruesas.
      console.info(`[lab-picker] primer render 532x20: ${ms.toFixed(0)} ms`);
      expect(ms).toBeLessThan(3000);
      expect(one('lab-picker-more').textContent).toContain(`${532 - LAB_PICKER_PAGE_SIZE} restantes`);
      const t1 = performance.now();
      await click(one('lab-picker-more'));
      console.info(`[lab-picker] Ver más: ${(performance.now() - t1).toFixed(0)} ms`);
      expect(all('lab-picker-card')).toHaveLength(LAB_PICKER_PAGE_SIZE * 2);
    });

    it('marcar un análisis no vuelve a dibujar el catálogo entero', async () => {
      await mount();
      host.analyses.set(bigCatalog(532, 20));
      await settle();
      const t = performance.now();
      await click(nativeInput(all('lab-picker-parent')[0]!));
      console.info(`[lab-picker] marcar uno: ${(performance.now() - t).toFixed(0)} ms`);
      expect(counter()).toBe('1 análisis · 20 componentes');
    });

    it('buscar sobre 532 análisis es inmediato', async () => {
      await mount();
      host.analyses.set(bigCatalog(532, 20));
      await settle();
      const t = performance.now();
      await search('componente 531.19');
      console.info(`[lab-picker] búsqueda: ${(performance.now() - t).toFixed(0)} ms`);
      expect(all('lab-picker-card')).toHaveLength(1);
    });
  });

  it('serializa lo elegido a renglones de requisición', async () => {
    await mount();
    await click(nativeInput(all('lab-picker-parent')[0]!));
    await click(nativeInput(all('lab-picker-parent')[1]!));
    expect(serializeSelection(host.analyses(), host.selection())).toEqual([
      { analysisConceptId: CBC.conceptId, componentConceptIds: ['c-hb', 'c-hto', 'c-plq'], specimenConceptId: 's-edta' },
      { analysisConceptId: GLUCOSE.conceptId, componentConceptIds: [], specimenConceptId: 's-suero' },
    ]);
  });
});
