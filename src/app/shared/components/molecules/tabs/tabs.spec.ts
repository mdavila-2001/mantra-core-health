import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Tab } from './tab/tab';
import { Tabs } from './tabs';

@Component({
  imports: [Tabs, Tab],
  template: `
    <app-tabs [(selectedIndex)]="seccion">
      <app-tab label="Evolución">Dolor torácico de 2 horas</app-tab>
      <app-tab label="Laboratorio" [disabled]="sinLaboratorio()">Hemograma completo</app-tab>
      <app-tab label="Órdenes">Radiografía de tórax</app-tab>
    </app-tabs>
  `,
})
class HostComponent {
  readonly seccion = signal(0);
  readonly sinLaboratorio = signal(true);
}

describe('Tabs', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  /** `fixture.nativeElement` es `any`: se tipa acá una sola vez. */
  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botones(): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  function paneles(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  }

  async function teclear(boton: HTMLButtonElement, key: string): Promise<KeyboardEvent> {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    boton.dispatchEvent(evento);
    await fixture.whenStable();
    return evento;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('ARIA cruzada', () => {
    it('la lista y las pestañas declaran sus roles', () => {
      expect(root().querySelector('[role="tablist"]')).not.toBeNull();
      expect(botones()).toHaveLength(3);
      expect(paneles()).toHaveLength(3);
    });

    it('cada pestaña apunta a su panel y cada panel a su pestaña', () => {
      botones().forEach((boton, indice) => {
        const panel = paneles()[indice];
        expect(boton.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.getAttribute('aria-labelledby')).toBe(boton.id);
        expect(boton.id).toBeTruthy();
        expect(panel.id).toBeTruthy();
      });
    });

    it('solo una pestaña está seleccionada', () => {
      const seleccionadas = botones().filter(
        (boton) => boton.getAttribute('aria-selected') === 'true',
      );

      expect(seleccionadas).toHaveLength(1);
      expect(seleccionadas[0].textContent?.trim()).toBe('Evolución');
    });
  });

  describe('roving tabindex', () => {
    it('solo la seleccionada entra en el orden de tabulación', () => {
      expect(botones().map((boton) => boton.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('el tabindex sigue a la selección', async () => {
      host.seccion.set(2);
      await fixture.whenStable();

      expect(botones().map((boton) => boton.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
    });
  });

  describe('activación manual', () => {
    it('la flecha mueve el foco pero NO selecciona', async () => {
      botones()[0].focus();
      await teclear(botones()[0], 'ArrowRight');

      // saltea la deshabilitada y aterriza en la tercera
      expect(document.activeElement).toBe(botones()[2]);
      expect(host.seccion()).toBe(0);
      expect(botones()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('Enter selecciona la pestaña enfocada', async () => {
      await teclear(botones()[2], 'Enter');

      expect(host.seccion()).toBe(2);
      expect(botones()[2].getAttribute('aria-selected')).toBe('true');
    });

    it('Espacio selecciona y no desplaza la página', async () => {
      const evento = await teclear(botones()[2], ' ');

      expect(host.seccion()).toBe(2);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('las flechas dan la vuelta en los extremos', async () => {
      botones()[0].focus();
      await teclear(botones()[0], 'ArrowLeft');

      expect(document.activeElement).toBe(botones()[2]);
    });

    it('Home y End van a los extremos utilizables', async () => {
      await teclear(botones()[2], 'Home');
      expect(document.activeElement).toBe(botones()[0]);

      await teclear(botones()[0], 'End');
      expect(document.activeElement).toBe(botones()[2]);
    });

    it('la navegación saltea las deshabilitadas', async () => {
      botones()[2].focus();
      await teclear(botones()[2], 'ArrowLeft');

      // de la 3.ª a la 1.ª: la 2.ª está deshabilitada
      expect(document.activeElement).toBe(botones()[0]);
    });
  });

  describe('pestaña deshabilitada', () => {
    it('se anuncia deshabilitada y no se puede seleccionar con click', async () => {
      expect(botones()[1].disabled).toBe(true);

      botones()[1].click();
      await fixture.whenStable();

      expect(host.seccion()).toBe(0);
    });

    it('si la seleccionada se deshabilita, cae en la primera utilizable', async () => {
      host.seccion.set(1);
      await fixture.whenStable();

      expect(fixture.componentInstance.seccion()).toBe(1);
      // la 2.ª está deshabilitada: se pinta la 1.ª
      expect(botones()[0].getAttribute('aria-selected')).toBe('true');
      expect(botones()[1].getAttribute('aria-selected')).toBe('false');
    });

    it('habilitada, se puede seleccionar', async () => {
      host.sinLaboratorio.set(false);
      await fixture.whenStable();

      botones()[1].click();
      await fixture.whenStable();

      expect(host.seccion()).toBe(1);
      expect(botones()[1].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('render diferido de paneles', () => {
    it('solo el panel activo tiene contenido en el DOM', () => {
      expect(paneles()[0].textContent?.trim()).toBe('Dolor torácico de 2 horas');
      expect(paneles()[1].textContent?.trim()).toBe('');
      expect(paneles()[2].textContent?.trim()).toBe('');
    });

    it('cambiar de pestaña mueve el contenido, no lo acumula', async () => {
      host.seccion.set(2);
      await fixture.whenStable();

      expect(paneles()[0].textContent?.trim()).toBe('');
      expect(paneles()[2].textContent?.trim()).toBe('Radiografía de tórax');
    });

    it('los paneles inactivos quedan ocultos para el lector de pantalla', async () => {
      expect(paneles()[0].hasAttribute('hidden')).toBe(false);
      expect(paneles()[1].hasAttribute('hidden')).toBe(true);
      expect(paneles()[2].hasAttribute('hidden')).toBe(true);
    });
  });

  describe('índice fuera de rango', () => {
    it('se recorta al rango real en vez de dejar todo sin seleccionar', async () => {
      host.seccion.set(99);
      await fixture.whenStable();

      expect(botones()[2].getAttribute('aria-selected')).toBe('true');
    });
  });
});
