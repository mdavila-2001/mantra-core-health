import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AccordionPanel } from './accordion-panel/accordion-panel';
import { Accordion } from './accordion';

@Component({
  imports: [Accordion, AccordionPanel],
  template: `
    <app-accordion [multi]="multi()">
      <app-accordion-panel heading="Antecedentes">Diabetes tipo 2</app-accordion-panel>
      <app-accordion-panel heading="Medicación habitual">Metformina 850 mg</app-accordion-panel>
      <app-accordion-panel heading="Alergias" [disabled]="sinAlergias()">
        Sin alergias conocidas
      </app-accordion-panel>
    </app-accordion>
  `,
})
class HostComponent {
  readonly multi = signal(false);
  readonly sinAlergias = signal(true);
}

describe('Accordion', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function cabeceras(): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>('.accordion-panel__trigger')];
  }

  function regiones(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('[role="region"]')];
  }

  async function pulsar(indice: number): Promise<void> {
    cabeceras()[indice].click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('estructura accesible', () => {
    it('cada cabecera es un <button> dentro de un encabezado real', () => {
      const encabezados = root().querySelectorAll('h3.accordion-panel__heading');

      expect(encabezados).toHaveLength(3);
      for (const encabezado of encabezados) {
        expect(encabezado.querySelector('button')).not.toBeNull();
      }
      // nada de div con role=button
      expect(root().querySelector('div[role="button"]')).toBeNull();
    });

    it('aria-expanded arranca en false en todos', () => {
      expect(cabeceras().map((boton) => boton.getAttribute('aria-expanded'))).toEqual([
        'false',
        'false',
        'false',
      ]);
    });

    it('la cabecera apunta a su región y la región a su cabecera', async () => {
      await pulsar(0);

      const region = regiones()[0];
      expect(cabeceras()[0].getAttribute('aria-controls')).toBe(region.id);
      expect(region.getAttribute('aria-labelledby')).toBe(cabeceras()[0].id);
    });
  });

  describe('contenido plegado', () => {
    it('no está en el DOM, no solo oculto', () => {
      expect(regiones()).toHaveLength(0);
      expect(root().textContent).not.toContain('Diabetes tipo 2');
    });

    it('al abrir aparece, y al cerrar se va', async () => {
      await pulsar(0);
      expect(root().textContent).toContain('Diabetes tipo 2');
      expect(regiones()).toHaveLength(1);

      await pulsar(0);
      expect(root().textContent).not.toContain('Diabetes tipo 2');
      expect(regiones()).toHaveLength(0);
    });
  });

  describe('exclusividad (multi = false)', () => {
    it('abrir uno cierra el anterior', async () => {
      await pulsar(0);
      await pulsar(1);

      expect(cabeceras().map((boton) => boton.getAttribute('aria-expanded'))).toEqual([
        'false',
        'true',
        'false',
      ]);
      expect(regiones()).toHaveLength(1);
      expect(root().textContent).toContain('Metformina 850 mg');
    });
  });

  describe('varias secciones a la vez (multi = true)', () => {
    it('las abiertas conviven', async () => {
      host.multi.set(true);
      await fixture.whenStable();

      await pulsar(0);
      await pulsar(1);

      expect(cabeceras().map((boton) => boton.getAttribute('aria-expanded'))).toEqual([
        'true',
        'true',
        'false',
      ]);
      expect(regiones()).toHaveLength(2);
    });
  });

  describe('panel deshabilitado', () => {
    it('no se abre al pulsar', async () => {
      await pulsar(2);

      expect(cabeceras()[2].getAttribute('aria-expanded')).toBe('false');
      expect(root().textContent).not.toContain('Sin alergias conocidas');
    });

    it('el botón nativo también lo declara', () => {
      expect(cabeceras()[2].disabled).toBe(true);
    });

    it('habilitado, se abre normalmente', async () => {
      host.sinAlergias.set(false);
      await fixture.whenStable();

      await pulsar(2);

      expect(cabeceras()[2].getAttribute('aria-expanded')).toBe('true');
      expect(root().textContent).toContain('Sin alergias conocidas');
    });
  });

  describe('panel suelto, sin acordeón alrededor', () => {
    it('se abre y se cierra por su cuenta', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [AccordionPanel] }).compileComponents();

      const suelto = TestBed.createComponent(AccordionPanel);
      suelto.componentRef.setInput('heading', 'Notas');
      await suelto.whenStable();

      const boton = (suelto.nativeElement as HTMLElement).querySelector('button');
      boton?.click();
      await suelto.whenStable();

      expect(suelto.componentInstance.expanded()).toBe(true);
      suelto.destroy();
    });
  });
});
