import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Stepper } from './stepper';
import type { StepperStep } from './stepper.types';

@Component({
  imports: [Stepper],
  template: `<app-stepper [steps]="steps()" label="Crear agenda" />`,
})
class Host {
  readonly steps = signal<readonly StepperStep[]>([]);
}

describe('Stepper', () => {
  it('pinta un ítem por paso, en orden', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.stepper__label'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(labels).toEqual(['Recurso', 'Política', 'Plantilla']);
  });

  it('marca sólo el paso actual con aria-current="step"', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const current = fixture.debugElement.queryAll(By.css('[aria-current="step"]'));
    expect(current).toHaveLength(1);
    expect(current[0].nativeElement.textContent).toContain('Política');
  });

  it('el paso completado muestra un check y no su número', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
    ]);
    fixture.detectChanges();

    const marcadores = fixture.debugElement.queryAll(By.css('.stepper__marker'));
    // El primero (completado) trae el ✓ svg y ningún dígito.
    expect(marcadores[0].query(By.css('svg'))).not.toBeNull();
    expect(marcadores[0].nativeElement.textContent.trim()).toBe('');
    // El actual muestra su ordinal.
    expect(marcadores[1].nativeElement.textContent.trim()).toBe('2');
  });

  it('resume el avance como «Crear agenda: paso 2 de 3» en el aria-label', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const ol = fixture.debugElement.query(By.css('.stepper'));
    expect(ol.attributes['aria-label']).toBe('Crear agenda: paso 2 de 3');
  });
});
