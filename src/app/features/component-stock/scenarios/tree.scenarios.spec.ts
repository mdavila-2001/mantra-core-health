import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ScenarioTree, TREE_SCENARIOS } from './tree.scenarios';

describe('escenarios de app-tree', () => {
  function montar(variante: string): ComponentFixture<ScenarioTree> {
    const fixture = TestBed.createComponent(ScenarioTree);
    fixture.componentRef.setInput('variante', variante);
    fixture.detectChanges();
    return fixture;
  }

  const filas = (f: ComponentFixture<unknown>): HTMLElement[] =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="treeitem"]'));

  it('registra las cuatro variantes con sus ids y su fuente', () => {
    expect(TREE_SCENARIOS.map((e) => e.variante)).toEqual(['cerrado', 'abierto', 'seleccion', 'un-nodo']);
    for (const e of TREE_SCENARIOS) expect(e.id).toBe(`${e.clave}#${e.variante}`);
  });

  it.each(TREE_SCENARIOS.map((e) => [e.variante] as const))('monta «%s» sin fallar', async (variante) => {
    const fixture = montar(variante);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(filas(fixture).length).toBeGreaterThan(0);
  });

  it('«cerrado» muestra sólo las raíces y «abierto» los cinco niveles', async () => {
    const cerrado = montar('cerrado');
    await cerrado.whenStable();
    expect(filas(cerrado)).toHaveLength(2);

    const abierto = montar('abierto');
    await abierto.whenStable();
    abierto.detectChanges();
    const niveles = new Set(filas(abierto).map((f) => f.getAttribute('aria-level')));
    expect([...niveles].sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('«seleccion» deja elegida la cama 301-B con sus ancestros abiertos', async () => {
    const f = montar('seleccion');
    await f.whenStable();
    f.detectChanges();
    const elegida = filas(f).find((fila) => fila.getAttribute('aria-selected') === 'true');
    expect(elegida?.dataset['nodeId']).toBe('301-b');
  });
});
