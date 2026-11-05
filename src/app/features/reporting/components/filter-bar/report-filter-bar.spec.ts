import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReportContextStore } from '../../state/report-context.store';
import { ReportFilterBar } from './report-filter-bar';

async function mount() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const store = TestBed.inject(ReportContextStore);
  store.limpiarFiltros();
  const fixture = TestBed.createComponent(ReportFilterBar);
  await fixture.whenStable();
  return { fixture, store, root: fixture.nativeElement as HTMLElement };
}

describe('ReportFilterBar', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin filtros activos no dibuja chips ni «Limpiar filtros»', async () => {
    const { root } = await mount();
    expect(root.querySelectorAll('[data-testid="filter-chip"]')).toHaveLength(0);
    expect(root.querySelector('[data-testid="filters-clear"]')).toBeNull();
  });

  it('cada filtro activo es un chip que dice qué es y se quita con «Quitar»', async () => {
    const { fixture, store, root } = await mount();
    store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
    store.alternarFiltro({ dimension: 'ciudad', valor: 'Sucre' });
    await fixture.whenStable();

    const chips = Array.from(root.querySelectorAll('[data-testid="filter-chip"]'));
    expect(chips.map((c) => c.querySelector('span')?.textContent)).toEqual(['Plan: Pro', 'Ciudad: Sucre']);
    expect(chips.every((c) => c.querySelector('button')?.textContent?.includes('Quitar'))).toBe(true);
    const remove = chips[0]?.querySelector('button') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Quitar filtro plan: Pro');

    remove.click();
    await fixture.whenStable();
    expect(store.filtros()).toEqual([{ dimension: 'ciudad', valor: 'Sucre' }]);
  });

  it('«Limpiar filtros» los quita todos', async () => {
    const { fixture, store, root } = await mount();
    store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
    store.alternarFiltro({ dimension: 'ciudad', valor: 'Sucre' });
    await fixture.whenStable();
    (root.querySelector('[data-testid="filters-clear"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.filtros()).toEqual([]);
    expect(root.querySelectorAll('[data-testid="filter-chip"]')).toHaveLength(0);
  });

  it('anuncia en una región «polite» cada cambio del contexto', async () => {
    const { fixture, store, root } = await mount();
    const live = root.querySelector('[data-testid="filters-live"]') as HTMLElement;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toContain('sin filtros activos');

    store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
    store.moneda.set('USD');
    await fixture.whenStable();
    expect(live.textContent).toContain('1 filtro activo');
    expect(live.textContent).toContain('USD');
  });

  it('cambiar la moneda desde la barra escribe en el almacén', async () => {
    const { fixture, store, root } = await mount();
    (root.querySelector('[data-value="USD"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.moneda()).toBe('USD');
  });
});
