import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ReporteCatalogo } from '@core/data-access/reporting/reporting.types';
import { ReportCard } from './report-card';

/**
 * Una tarjeta del catálogo de reportes: vertical, certificación, si sigue en
 * diseño, si abre una pantalla existente, responsable y frescura. «Favorito»
 * no guarda nada: avisa y quien contiene la tarjeta decide.
 */

const REPORTE: ReporteCatalogo = {
  id: 'r-1',
  nombre: 'Suscripciones activas',
  vertical: 'suscripciones',
  descripcion: 'Doctores con plan vigente.',
  responsable: 'Comercial',
  certificado: true,
  frescuraMin: 90,
  ruta: '/reports/suscripciones',
};

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Destino {}

describe('ReportCard', () => {
  let fixture: ComponentFixture<ReportCard>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(report: ReporteCatalogo, favorite = false): void {
    fixture = TestBed.createComponent(ReportCard);
    fixture.componentRef.setInput('report', report);
    fixture.componentRef.setInput('favorite', favorite);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Destino }])] }));

  it('se rotula por su nombre y muestra vertical, responsable y frescura', () => {
    pintar(REPORTE);
    const articulo = root().querySelector('[data-testid="report-card-r-1"]')!;
    expect(root().querySelector(`#${articulo.getAttribute('aria-labelledby')}`)?.textContent).toBe('Suscripciones activas');
    expect(root().querySelector('.rc__vertical')?.textContent).toBe('Suscripciones de doctores');
    expect(root().textContent).toContain('Comercial');
    expect(root().querySelector('[data-testid="report-freshness"]')?.textContent).toBe('Actualizado hace 2 h');
  });

  it('recién cargado dice «Actualizado ahora»', () => {
    pintar({ ...REPORTE, frescuraMin: 0 });
    expect(root().querySelector('[data-testid="report-freshness"]')?.textContent).toBe('Actualizado ahora');
  });

  it('las insignias dicen certificación, diseño y si es una pantalla existente', () => {
    pintar(REPORTE);
    expect(root().querySelector('.rc__badges')?.textContent).toContain('Certificado');
    expect(root().querySelector('.rc__badges')?.textContent).not.toContain('Pantalla existente');

    pintar({ ...REPORTE, certificado: false, enDiseno: true, ruta: '/agenda/estadisticas' });
    const badges = root().querySelector('.rc__badges')!.textContent!;
    expect(badges).toContain('Sin certificar');
    expect(badges).toContain('En diseño');
    expect(badges).toContain('Pantalla existente');
  });

  it('favorito se anuncia presionado y emite el reporte, sin guardar nada', () => {
    pintar(REPORTE, true);
    const fav = root().querySelector<HTMLButtonElement>('[data-testid="report-favorite"]')!;
    expect(fav.getAttribute('aria-pressed')).toBe('true');
    expect(fav.textContent).toContain('★');
    const emitidos: ReporteCatalogo[] = [];
    fixture.componentInstance.favoriteToggled.subscribe((r) => emitidos.push(r));
    fav.click();
    expect(emitidos).toEqual([REPORTE]);
  });

  it('abrir enlaza a su ruta y avisa', async () => {
    pintar(REPORTE);
    const abrir = root().querySelector<HTMLAnchorElement>('[data-testid="report-open"]')!;
    expect(abrir.getAttribute('href')).toBe('/reports/suscripciones');
    let abiertos = 0;
    fixture.componentInstance.opened.subscribe(() => (abiertos += 1));
    abrir.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(abiertos).toBe(1);
    // Se deja terminar la navegación que dispara el enlace antes de cerrar la prueba.
    await fixture.whenStable();
  });
});
