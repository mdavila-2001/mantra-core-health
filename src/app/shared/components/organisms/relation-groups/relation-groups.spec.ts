import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RelationGroups } from './relation-groups';
import type { RelationColumnView, RelationNavigation } from './relation-groups.types';

const COLUMNAS: readonly RelationColumnView[] = [
  {
    key: 'symptoms',
    title: 'Síntomas y signos',
    count: 2,
    items: [
      { conceptId: 'c-1', slug: 'tos', display: 'Tos', category: null, frequency: 'VERY_FREQUENT', evidenceTier: 'CURATED_REFERENCE' },
      { conceptId: 'c-2', slug: 'fiebre', display: 'Fiebre', category: null },
    ],
  },
  { key: 'tests', title: 'Estudios', count: null, items: [] },
];

@Component({
  imports: [RelationGroups],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-relation-groups
      heading="Lo que se observa"
      headingId="zona"
      tone="findings"
      [columns]="columnas"
      [navigation]="navegacion()"
      emptyColumnText="Sin estudios."
      (neighborSelected)="elegidos.push($event)"
    />
  `,
})
class Anfitrion {
  readonly columnas = COLUMNAS;
  readonly navegacion = signal<RelationNavigation>('link');
  readonly elegidos: string[] = [];
}

function montar(navegacion: RelationNavigation) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.componentInstance.navegacion.set(navegacion);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('RelationGroups', () => {
  it('titula el bloque y cada columna, enlazados por id para el lector de pantalla', () => {
    const { host } = montar('link');

    expect(host.querySelector('h3#zona')?.textContent?.trim()).toBe('Lo que se observa');
    const columna = host.querySelector('section[aria-labelledby="zona-symptoms"]');
    expect(columna?.querySelector('h4#zona-symptoms')?.textContent).toContain('Síntomas y signos');
    expect(columna?.querySelector('.relation-groups__count')?.textContent?.trim()).toBe('2');
  });

  it('en modo enlace, cada vecino abre su ficha', () => {
    const { host } = montar('link');

    const enlaces = [...host.querySelectorAll('a.relation-groups__neighbor')].map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/glossary/c-1', '/glossary/c-2']);
  });

  it('en modo selección, emite el concepto y nombra la acción', () => {
    const { fixture, host } = montar('select');

    const boton = host.querySelector<HTMLButtonElement>('button.relation-groups__neighbor')!;
    expect(boton.getAttribute('aria-label')).toBe('Ver el mapa de Tos');
    boton.click();
    expect(fixture.componentInstance.elegidos).toEqual(['c-1']);
  });

  it('pinta la evidencia de cada vecino con la molécula compartida', () => {
    const { host } = montar('link');

    const evidencias = host.querySelectorAll('app-relation-evidence');
    expect(evidencias).toHaveLength(2);
    expect(evidencias[0].textContent).toContain('Muy frecuente');
    expect(evidencias[0].textContent).toContain('Referencia curada');
    expect(evidencias[1].textContent?.trim()).toBe('');
  });

  it('una columna vacía lo dice en vez de quedar en blanco, y el tono marca la zona', () => {
    const { host } = montar('link');

    expect(host.querySelector('section[aria-labelledby="zona-tests"]')?.textContent).toContain('Sin estudios.');
    expect(host.querySelector('app-relation-groups')?.classList).toContain('relation-groups--findings');
  });
});
