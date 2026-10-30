import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnatomyViewer, type AnatomyViewerStatus } from './anatomy-viewer';

/**
 * El visor sin WebGL: en el entorno de pruebas no hay contexto 3D, que es
 * exactamente el caso de un navegador sin WebGL 2. Lo que se prueba es que lo
 * dice y que el lienzo sigue siendo accesible; el dibujo se prueba con
 * navegador real en `playwright/atlas-anatomico-3d.spec.ts`.
 */
describe('AnatomyViewer', () => {
  let fixture: ComponentFixture<AnatomyViewer>;
  const estados: AnatomyViewerStatus[] = [];

  beforeEach(async () => {
    estados.length = 0;
    await TestBed.configureTestingModule({ imports: [AnatomyViewer] }).compileComponents();
    fixture = TestBed.createComponent(AnatomyViewer);
    fixture.componentRef.setInput('parts', []);
    fixture.componentRef.setInput('modelUrls', {
      skeleton: '/s.glb',
      muscles: '/m.glb',
      vessels: '/v.glb',
      nervous: '/n.glb',
      organs: '/o.glb',
    });
    fixture.componentRef.setInput('layers', ['skeleton']);
    fixture.componentRef.setInput('label', 'Modelo anatómico 3D');
    fixture.componentInstance.statusChange.subscribe((e) => estados.push(e));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('sin WebGL 2 lo avisa y ofrece la lista como camino', () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(estados).toEqual(['unsupported']);
    expect(html.querySelector('[role="status"]')?.textContent).toContain('no puede dibujar el modelo');
  });

  it('el lienzo toma foco y explica cómo se maneja con el teclado', () => {
    const lienzo = (fixture.nativeElement as HTMLElement).querySelector('canvas');
    expect(lienzo?.getAttribute('tabindex')).toBe('0');
    expect(lienzo?.getAttribute('role')).toBe('application');
    expect(lienzo?.getAttribute('aria-roledescription')).toBe('modelo 3D');
    expect(lienzo?.getAttribute('aria-label')).toContain('Use las flechas para girar');
  });
});
