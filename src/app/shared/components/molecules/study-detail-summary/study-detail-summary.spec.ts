import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { ServiceRequestImaging } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { StudyDetailSummary } from './study-detail-summary';
import { FULL_STUDY_TEXT, studyDetailRows } from './study-detail-summary.logic';

const IMAGING: ServiceRequestImaging = {
  modalityConceptId: 'm',
  modalityDisplay: 'Rayos X',
  bodySiteConceptId: 'b',
  bodySiteDisplay: 'Mano',
  lateralityConceptId: 'l',
  lateralityDisplay: 'Izquierda',
  contrastConceptId: 'c',
  contrastDisplay: 'Sin contraste',
};

describe('studyDetailRows', () => {
  it('laboratorio: muestra y componentes en el orden marcado', () => {
    const rows = studyDetailRows({
      specimen: 'Sangre venosa',
      components: [
        { conceptId: 'b', display: 'Plaquetas', ordinal: 2 },
        { conceptId: 'a', display: 'Hemoglobina', ordinal: 1 },
      ],
      componentsSpecified: true,
    });
    expect(rows).toEqual([
      { label: 'Muestra', value: 'Sangre venosa' },
      { label: 'Componentes pedidos (2)', value: 'Hemoglobina, Plaquetas' },
    ]);
  });

  it('sin componentes marcados dice «estudio completo, sin detalle»', () => {
    expect(studyDetailRows({ components: [], componentsSpecified: false })).toEqual([
      { label: 'Componentes', value: FULL_STUDY_TEXT },
    ]);
  });

  it('imagenología: modalidad, región, lateralidad y contraste; sin filas vacías', () => {
    expect(studyDetailRows({ imaging: { ...IMAGING, contrastDisplay: null } })).toEqual([
      { label: 'Modalidad', value: 'Rayos X' },
      { label: 'Región', value: 'Mano' },
      { label: 'Lateralidad', value: 'Izquierda' },
    ]);
  });

  it('sin nada que mostrar no hay filas', () => {
    expect(studyDetailRows({})).toEqual([]);
  });
});

@Component({
  imports: [StudyDetailSummary],
  template: `<app-study-detail-summary
    heading="RX de mano"
    [summary]="summary"
    [imaging]="imaging"
  />`,
})
class Host {
  summary: string | null = 'Mano · Izquierda';
  imaging: ServiceRequestImaging | null = IMAGING;
}

describe('StudyDetailSummary', () => {
  it('dibuja la línea y el botón del panel con el detalle', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="study-summary-line"]')?.textContent).toContain(
      'Mano · Izquierda',
    );
    const trigger = el.querySelector<HTMLElement>('[data-testid="card-detail-trigger"]');
    expect(trigger?.getAttribute('aria-label')).toBe('Ver el detalle del estudio');
    const panel = el.querySelector('[data-testid="card-detail-panel"]');
    expect(panel?.textContent).toContain('Rayos X');
    expect(panel?.textContent).toContain('Sin contraste');
  });

  it('sin detalle ni resumen no dibuja nada', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.summary = null;
    fixture.componentInstance.imaging = null;
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="study-summary-line"]')).toBeNull();
    expect(el.querySelector('[data-testid="card-detail-trigger"]')).toBeNull();
  });
});
