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

/** El mismo recorrido, con los pasos convertidos en controles. */
@Component({
  imports: [Stepper],
  template: `<app-stepper
    [steps]="steps()"
    label="Crear agenda"
    interactive
    (stepSelected)="pedidos.push($event)"
  />`,
})
class HostInteractivo {
  readonly steps = signal<readonly StepperStep[]>([]);
  readonly pedidos: number[] = [];
}

const TRES_PASOS: readonly StepperStep[] = [
  { label: 'Recurso', status: 'complete' },
  { label: 'Política', status: 'current' },
  { label: 'Plantilla', status: 'upcoming' },
];

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

  describe('modo interactivo', () => {
    function montar(pasos: readonly StepperStep[] = TRES_PASOS) {
      TestBed.configureTestingModule({ imports: [HostInteractivo] });
      const fixture = TestBed.createComponent(HostInteractivo);
      fixture.componentInstance.steps.set(pasos);
      fixture.detectChanges();
      return fixture;
    }

    it('sin `interactive` los pasos NO son controles: las otras tres pantallas que lo montan no navegan', () => {
      TestBed.configureTestingModule({ imports: [Host] });
      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.steps.set(TRES_PASOS);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.css('button'))).toHaveLength(0);
    });

    it('cada paso es un <button> de verdad, no un <li> con click', () => {
      const fixture = montar();

      const botones = fixture.debugElement.queryAll(By.css('button.stepper__control'));
      expect(botones).toHaveLength(3);
      // `type="button"`: dentro de un formulario, sin esto cada paso enviaría.
      expect(botones[0].nativeElement.getAttribute('type')).toBe('button');
    });

    it('el nombre accesible lleva ordinal, rótulo y estado —y contiene el rótulo visible—', () => {
      const fixture = montar();

      const botones = fixture.debugElement.queryAll(By.css('button.stepper__control'));
      expect(botones[0].nativeElement.getAttribute('aria-label')).toBe(
        'Paso 1 de 3: Recurso, completado',
      );
      expect(botones[1].nativeElement.getAttribute('aria-label')).toBe(
        'Paso 2 de 3: Política, paso actual',
      );
    });

    it('sigue habiendo un solo aria-current, y ahora vive en el control', () => {
      const fixture = montar();

      const actuales = fixture.debugElement.queryAll(By.css('[aria-current="step"]'));
      expect(actuales).toHaveLength(1);
      expect(actuales[0].nativeElement.tagName.toLowerCase()).toBe('button');
    });

    it('pulsar un paso propone su índice; navegar lo decide quien lo monta', () => {
      const fixture = montar();

      fixture.debugElement.queryAll(By.css('button.stepper__control'))[0].nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.pedidos).toEqual([0]);
    });

    it('el paso cerrado dice por qué, sigue enfocable y no propone nada', () => {
      const fixture = montar([
        { label: 'Recurso', status: 'current' },
        {
          label: 'Plantilla',
          status: 'upcoming',
          disabled: true,
          disabledReason: 'Todavía no llegaste acá: completá los pasos anteriores.',
        },
      ]);

      const cerrado = fixture.debugElement.queryAll(By.css('button.stepper__control'))[1]
        .nativeElement as HTMLButtonElement;

      // `aria-disabled` y no el atributo nativo: así se puede llegar con el
      // teclado y escuchar por qué no se abre.
      expect(cerrado.getAttribute('aria-disabled')).toBe('true');
      expect(cerrado.hasAttribute('disabled')).toBe(false);
      expect(cerrado.getAttribute('aria-label')).toContain(
        'Todavía no llegaste acá',
      );

      cerrado.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.pedidos).toEqual([]);
    });

    it('el paso con glifo lo dibuja, y el completado sigue mostrando su ✓', () => {
      const fixture = montar([
        { label: 'Identidad', status: 'complete', icon: 'patients' },
        { label: 'Contacto', status: 'current', icon: 'mail' },
      ]);

      const marcadores = fixture.debugElement.queryAll(By.css('.stepper__marker'));
      // El completado no cambia de seña por tener glifo: el ✓ manda.
      expect(marcadores[0].query(By.css('app-nav-icon'))).toBeNull();
      expect(marcadores[0].query(By.css('svg'))).not.toBeNull();
      expect(marcadores[1].query(By.css('app-nav-icon'))).not.toBeNull();
    });

    it('el estado no se distingue sólo por color: cada uno trae su forma y su texto', () => {
      const fixture = montar();

      const items = fixture.debugElement.queryAll(By.css('.stepper__step'));
      // Forma: ✓ el completado, ordinal el actual, marcador punteado el
      // pendiente (`--upcoming` en el CSS).
      expect(items[0].nativeElement.className).toContain('stepper__step--complete');
      expect(items[2].nativeElement.className).toContain('stepper__step--upcoming');
      // Y texto, que es lo que no depende de ver nada.
      expect(items[2].nativeElement.textContent).toContain('pendiente');
    });
  });
});
