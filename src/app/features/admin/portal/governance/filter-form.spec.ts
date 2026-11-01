import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FilterForm, type FilterField } from './filter-form';

const CAMPOS: readonly FilterField[] = [
  {
    key: 'severity',
    label: 'Severidad',
    kind: 'select',
    options: [
      { value: '', label: 'Cualquier severidad' },
      { value: 'ERROR', label: 'Error' },
    ],
  },
  { key: 'q', label: 'Buscar', kind: 'text' },
  { key: 'from', label: 'Desde', kind: 'date' },
  { key: 'route', label: 'Ruta exacta', kind: 'text', advanced: true },
];

@Component({
  imports: [FilterForm],
  template: `<app-governance-filter-form [fields]="campos" [values]="valores()" />`,
})
class HostComponent {
  readonly campos = CAMPOS;
  readonly valores = signal<Readonly<Record<string, string>>>({});
}

describe('FilterForm', () => {
  let fixture: ComponentFixture<HostComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rotulos(): string[] {
    return [...root().querySelectorAll('.filter-form__fields > app-form-field')].map(
      (campo) => campo.querySelector('label')?.textContent?.trim() ?? '',
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('el buscador principal va primero EN EL DOM (orden de foco = orden visual)', () => {
    expect(rotulos()).toEqual(['Buscar', 'Severidad', 'Desde']);
  });

  it('sólo el buscador principal es ancho; los campos de texto avanzados no', async () => {
    root().querySelector<HTMLButtonElement>('[data-testid="filter-form-more"]')?.click();
    await fixture.whenStable();

    expect(rotulos()).toEqual(['Buscar', 'Severidad', 'Desde', 'Ruta exacta']);
    const anchos = [...root().querySelectorAll('.filter-form__wide')];
    expect(anchos).toHaveLength(1);
    expect(anchos[0].querySelector('label')?.textContent?.trim()).toBe('Buscar');
  });

  it('el CSS no reordena con `order` y separa «Más filtros» de Quitar/Aplicar', () => {
    const estilos = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    expect(estilos).toContain('.filter-form__more');
    expect(estilos).not.toMatch(/\border\s*:/);
  });
});
