import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AnatomyViewer } from '../anatomy-viewer/anatomy-viewer';
import { BodyRegionPicker } from './body-region-picker';
import type { BodyRegionValue } from './body-region-picker.logic';
import { ARCHIVO, CATALOGO, PARTES } from './body-region-picker.testing';
import { TreeSelect } from '../tree-select/tree-select';

const PARTS_URL = '/anatomy-atlas-3d/catalog/parts.json';
const REGIONS_URL = '/anatomy-atlas-3d/catalog/body-regions.json';

describe('BodyRegionPicker', () => {
  let fixture: ComponentFixture<BodyRegionPicker>;
  let http: HttpTestingController;
  let emisiones: BodyRegionValue[];

  async function montar(platform: 'browser' | 'server' = 'browser'): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BodyRegionPicker],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: platform }],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    await TestBed.compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BodyRegionPicker);
    fixture.componentRef.setInput('regions', CATALOGO);
    emisiones = [];
    fixture.componentInstance.value.subscribe((v) => emisiones.push(v));
    fixture.detectChanges();
  }

  async function cargarAtlas(): Promise<void> {
    http.expectOne(PARTS_URL).flush(PARTES);
    http.expectOne(REGIONS_URL).flush(ARCHIVO);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mostrarVisor(): Promise<void> {
    const [bloque] = await fixture.getDeferBlocks();
    await bloque.render(DeferBlockState.Complete);
    fixture.detectChanges();
  }

  const visor = () => fixture.debugElement.query(By.directive(AnatomyViewer));
  const lista = () => fixture.debugElement.query(By.directive(TreeSelect));
  const viva = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="body-region-viva"]')!.textContent!.trim();
  const html = () => fixture.nativeElement as HTMLElement;

  afterEach(() => TestBed.resetTestingModule());

  it('se renderiza con la lista agrupada, la región viva y la atribución de licencia', async () => {
    await montar();
    await cargarAtlas();
    expect(lista()).not.toBeNull();
    expect(viva()).toBe('Ninguna región elegida.');
    const atribucion = html().querySelector('[data-testid="body-region-atribucion"]')!.textContent!;
    expect(atribucion).toContain('BodyParts3D');
    expect(atribucion).toContain('CC BY-SA');
    expect(atribucion).toContain('UBERON');
    expect(atribucion).toContain('CC BY 3.0');
    const grupos = (lista().componentInstance as TreeSelect<string>).groups().map((g) => g.label);
    expect(grupos).toEqual(['Cabeza', 'Miembro superior', 'Miembro inferior', 'Otras']);
  });

  it('el visor entra con @defer: antes sólo hay una reserva, sin el lienzo', async () => {
    await montar();
    await cargarAtlas();
    expect(visor()).toBeNull();
    expect(html().querySelector('.body-region-picker__reserva')).not.toBeNull();
    await mostrarVisor();
    expect(visor()).not.toBeNull();
  });

  it('3D -> lista: tocar la mano izquierda elige MANO/IZQ con UNA emisión y sin eco', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();

    visor().triggerEventHandler('pickedAt', { meshId: 'HAND_L', point: [0, 0, 0] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(emisiones).toEqual([{ region: 'MANO', laterality: 'IZQ' }]);
    expect((lista().componentInstance as TreeSelect<string>).value()).toBe('MANO');
    expect(html().querySelector('app-segmented-control [aria-checked="true"]')?.getAttribute('data-value')).toBe('IZQ');
    expect(viva()).toBe('Región: Mano, izquierda.');
    // El visor recibe lo derivado del valor, y escribir el valor no vuelve como toque.
    const v = visor().componentInstance as AnatomyViewer;
    expect(v.selected()).toEqual(['HAND_L']);
    expect(v.focus()).toEqual({ mode: 'union', groups: [['HAND_L']] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(emisiones).toHaveLength(1);
  });

  it('lista -> 3D: elegir en la lista resalta y encuadra, con UNA emisión y sin eco', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();

    lista().triggerEventHandler('valueChange', 'RODILLA');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(emisiones).toEqual([{ region: 'RODILLA', laterality: null }]);
    const v = visor().componentInstance as AnatomyViewer;
    expect(v.selected()).toEqual(['FEMUR_L', 'TIBIA_L', 'FEMUR_R', 'TIBIA_R']);
    expect(emisiones).toHaveLength(1);

    // Y editar el lado reencuadra por la intersección de ese lado.
    html().querySelector<HTMLButtonElement>('[data-value="DER"]')!.click();
    fixture.detectChanges();
    expect(emisiones.at(-1)).toEqual({ region: 'RODILLA', laterality: 'DER' });
    expect(v.focus()).toEqual({ mode: 'intersection', groups: [['FEMUR_R'], ['TIBIA_R']] });
    expect(emisiones).toHaveLength(2);
  });

  it('una secuencia 3D, lista, 3D emite exactamente tres veces (no hay bucle)', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();
    visor().triggerEventHandler('pickedAt', { meshId: 'HAND_L', point: [0, 0, 0] });
    fixture.detectChanges();
    lista().triggerEventHandler('valueChange', 'CRANEO');
    fixture.detectChanges();
    visor().triggerEventHandler('pickedAt', { meshId: 'HAND_R', point: [0, 0, 0] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(emisiones).toEqual([
      { region: 'MANO', laterality: 'IZQ' },
      { region: 'CRANEO', laterality: null },
      { region: 'MANO', laterality: 'DER' },
    ]);
  });

  it('un clic en el vacío no borra la región elegida', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();
    fixture.componentRef.setInput('value', { region: 'MANO', laterality: 'DER' });
    fixture.detectChanges();
    visor().triggerEventHandler('pickedAt', null);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toEqual({ region: 'MANO', laterality: 'DER' });
    expect(emisiones).toHaveLength(0);
  });

  it('una región fuera de `allowed` no se ofrece, no se elige tocando y se avisa', async () => {
    await montar();
    fixture.componentRef.setInput('allowed', ['MANO']);
    await cargarAtlas();
    await mostrarVisor();
    expect((lista().componentInstance as TreeSelect<string>).groups().flatMap((g) => g.items.map((i) => i.value))).toEqual(['MANO']);
    visor().triggerEventHandler('pickedAt', { meshId: 'SKULL', point: [0, 0, 0] });
    fixture.detectChanges();
    expect(emisiones).toHaveLength(0);
    expect(viva()).toBe('Este estudio no admite Cráneo.');
  });

  it('una región sin malla propia se elige desde la lista, con aviso accesible, y no se marca como elegida', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();
    const senos = (lista().componentInstance as TreeSelect<string>).groups().flatMap((g) => g.items).find((i) => i.value === 'SENOS_PARANASALES');
    expect(senos?.hint).toBe('sin modelo 3D');

    lista().triggerEventHandler('valueChange', 'SENOS_PARANASALES');
    fixture.detectChanges();
    expect(html().querySelector('[data-testid="body-region-nota"]')?.textContent).toContain('no tiene modelo 3D propio');
    expect(viva()).toContain('no tiene modelo 3D propio');
    const v = visor().componentInstance as AnatomyViewer;
    expect(v.selected()).toEqual([]);
    expect(v.related()).toEqual(['SKULL']);
  });

  it('el control de lado sólo aparece en regiones laterales y se puede editar', async () => {
    await montar();
    await cargarAtlas();
    expect(html().querySelector('app-segmented-control')).toBeNull();
    lista().triggerEventHandler('valueChange', 'MANO');
    fixture.detectChanges();
    expect(html().querySelector('app-segmented-control')).not.toBeNull();
    html().querySelector<HTMLButtonElement>('[data-value="BIL"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toEqual({ region: 'MANO', laterality: 'BIL' });
    lista().triggerEventHandler('valueChange', 'CRANEO');
    fixture.detectChanges();
    expect(html().querySelector('app-segmented-control')).toBeNull();
  });

  it('el rótulo del hover sale en castellano, con el lado', async () => {
    await montar();
    await cargarAtlas();
    await mostrarVisor();
    const rotulo = (visor().componentInstance as AnatomyViewer).hoverLabel()!;
    expect(rotulo('HAND_L')).toBe('Mano · izquierda');
    expect(rotulo('SKULL')).toBe('Cráneo');
    expect(rotulo('NADA')).toBeNull();
  });

  it('si el atlas falla, la lista sigue sirviendo y el visor muestra el estado de error', async () => {
    await montar();
    http.expectOne(PARTS_URL).flush('x', { status: 500, statusText: 'Server Error' });
    http.expectOne(REGIONS_URL).flush(ARCHIVO);
    await fixture.whenStable();
    fixture.detectChanges();
    await mostrarVisor();
    expect(visor()).toBeNull();
    expect(html().querySelector('app-view-state-host')?.textContent?.length).toBeGreaterThan(0);
    lista().triggerEventHandler('valueChange', 'MANO');
    fixture.detectChanges();
    expect(fixture.componentInstance.value().region).toBe('MANO');
  });

  it('bajo SSR queda inerte: no pide nada y no falla', async () => {
    await montar('server');
    expect(() => http.expectNone(PARTS_URL)).not.toThrow();
    expect(() => http.expectNone(REGIONS_URL)).not.toThrow();
    expect(lista()).not.toBeNull();
    expect(visor()).toBeNull();
  });
});
