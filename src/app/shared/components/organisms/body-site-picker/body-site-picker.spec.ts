import { TestBed } from '@angular/core/testing';

import type { AnatomyIndex, AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { BodySitePicker, type BodySiteSelection } from './body-site-picker';

const PARTE = (meshId: string, structureId: string, side: AnatomyPart['side']): AnatomyPart => ({
  meshId, layer: 'skeleton', sex: 'shared', structureId, shard: 0, side, labelEn: `Mesh ${meshId}`, match: 'fma_exact',
});

const PARTES = [PARTE('FEM_R', 'UBERON:0000981', 'right'), PARTE('FEM_L', 'UBERON:0000981', 'left'), PARTE('STERNUM', 'UBERON:0000975', null)];

const INDICE: AnatomyIndex = {
  shards: 1,
  entries: [
    ['UBERON:0000981', 'Fémur', 'femur', 1],
    ['UBERON:0000975', 'Esternón', 'sternum', 1],
    ['UBERON:0002107', 'Hígado', 'liver', 0],
  ],
};

const URLS = { skeleton: '/a', muscles: '/b', vessels: '/c', nervous: '/d', organs: '/e' };

describe('BodySitePicker', () => {
  function crear(entradas: Partial<{ status: 'loading' | 'ready' | 'error'; index: AnatomyIndex | null; indexFailed: boolean; disabled: boolean }> = {}) {
    const fixture = TestBed.createComponent(BodySitePicker);
    fixture.componentRef.setInput('parts', PARTES);
    fixture.componentRef.setInput('modelUrls', URLS);
    fixture.componentRef.setInput('index', entradas.index === undefined ? INDICE : entradas.index);
    fixture.componentRef.setInput('status', entradas.status ?? 'ready');
    fixture.componentRef.setInput('indexFailed', entradas.indexFailed ?? false);
    fixture.componentRef.setInput('disabled', entradas.disabled ?? false);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string): HTMLElement | null => f.nativeElement.querySelector(`[data-testid="${id}"]`);

  it('S2: mientras el catálogo baja lo dice y no monta el visor', () => {
    const f = crear({ status: 'loading' });
    expect(el(f, 'bsp-loading')).not.toBeNull();
    expect(f.nativeElement.querySelector('app-anatomy-viewer')).toBeNull();
  });

  it('S4: si el catálogo falla ofrece reintentar, y reintentar avisa', () => {
    const f = crear({ status: 'error' });
    let pedidos = 0;
    f.componentInstance.retry.subscribe(() => pedidos++);
    expect(el(f, 'bsp-error')).not.toBeNull();
    (f.nativeElement.querySelector('.bsp__reintentar') as HTMLButtonElement).click();
    expect(pedidos).toBe(1);
  });

  it('tocar el cuerpo y elegir por nombre en la lista dan la misma selección', () => {
    const tocada = crear();
    (tocada.componentInstance as unknown as { onPicked(m: string): void }).onPicked('STERNUM');
    const porLista = crear();
    (porLista.componentInstance as unknown as { search(t: string): void }).search('esternon');
    porLista.detectChanges();
    (porLista.nativeElement.querySelector('.bsp__opcion') as HTMLButtonElement).click();
    expect(porLista.componentInstance.value()).toEqual(tocada.componentInstance.value());
    expect(porLista.componentInstance.value()).toMatchObject({ meshId: 'STERNUM', structureId: 'UBERON:0000975' });
  });

  it('la lista se opera con teclado: son botones, el elegido lo dice con aria-pressed y se anuncia', () => {
    const f = crear();
    (f.componentInstance as unknown as { search(t: string): void }).search('femur');
    f.detectChanges();
    const boton = f.nativeElement.querySelector('.bsp__opcion') as HTMLButtonElement;
    expect(boton.tagName).toBe('BUTTON');
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    boton.click();
    f.detectChanges();
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    const anuncio = el(f, 'bsp-selected')!;
    expect(anuncio.getAttribute('role')).toBe('status');
    expect(anuncio.textContent).toContain('Fémur');
  });

  it('un hueso par elegido por nombre queda sin lado (no lo elige por el médico)', () => {
    const f = crear();
    (f.componentInstance as unknown as { chooseStructure(id: string): void }).chooseStructure('UBERON:0000981');
    expect((f.componentInstance.value() as BodySiteSelection).side).toBeNull();
  });

  it('límite: con una sola letra no busca; sin resultados orienta; las piezas sin malla no se ofrecen', () => {
    const f = crear();
    const c = f.componentInstance as unknown as { search(t: string): void };
    c.search('f');
    f.detectChanges();
    expect(el(f, 'bsp-results')).toBeNull();
    c.search('higado');
    f.detectChanges();
    expect(el(f, 'bsp-empty')?.textContent).toContain('No hay una parte');
  });

  it('inválido: sin el índice dice que carga; si falló, que se puede tocar el cuerpo; deshabilitado no elige', () => {
    expect(crear({ index: null }).nativeElement.textContent).toContain('Cargando los nombres');
    expect(el(crear({ index: null, indexFailed: true }), 'bsp-index-error')).not.toBeNull();
    const f = crear({ disabled: true });
    (f.componentInstance as unknown as { onPicked(m: string): void }).onPicked('STERNUM');
    expect(f.componentInstance.value()).toBeNull();
  });

  it('cambiar de cuerpo descarta una pieza que ya no existe en el otro', () => {
    const f = crear();
    f.componentInstance.value.set({ meshId: 'NOEXISTE', structureId: 'X', layer: 'skeleton', side: null });
    (f.componentInstance as unknown as { chooseSex(s: 'female'): void }).chooseSex('female');
    expect(f.componentInstance.value()).toBeNull();
  });
});
