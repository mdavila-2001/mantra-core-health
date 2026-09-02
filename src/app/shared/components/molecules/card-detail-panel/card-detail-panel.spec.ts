import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { CardDetailPanel } from './card-detail-panel';
import type { CardDetailRow } from './card-detail-panel.types';

const DATOS: readonly CardDetailRow[] = [
  { label: 'Qué es', value: 'Hospital de tercer nivel' },
  { label: 'Dirección', value: 'Av. Irala 468' },
];

@Component({
  imports: [CardDetailPanel],
  template: `
    <ul>
      <li data-card-root data-testid="tarjeta-uno">
        <app-card-detail-panel heading="Hospital Japonés" [rows]="filas()" />
      </li>
      <li data-card-root data-testid="tarjeta-dos">vecina</li>
    </ul>
  `,
})
class HostComponent {
  readonly filas = signal<readonly CardDetailRow[]>(DATOS);
}

describe('CardDetailPanel', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(): HTMLButtonElement {
    const element = root().querySelector('[data-testid="card-detail-trigger"]');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el botón-ícono no está en el DOM');
    }
    return element;
  }

  function panel(): HTMLElement {
    const element = document.querySelector('[data-testid="card-detail-panel"]');
    if (!(element instanceof HTMLElement)) {
      throw new Error('el panel no está en el DOM');
    }
    return element;
  }

  async function abrir(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  async function teclear(key: string): Promise<void> {
    panel().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('contrato ARIA del botón (AC-06-5)', () => {
    it('tiene nombre accesible y declara a qué panel controla', () => {
      expect(trigger().getAttribute('aria-label')).toBe('Ver más información');
      expect(trigger().getAttribute('aria-controls')).toBe(panel().id);
    });

    it('aria-expanded sigue al estado real', async () => {
      expect(trigger().getAttribute('aria-expanded')).toBe('false');

      await abrir();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      await abrir();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('el panel se superpone (AC-06-6, AC-06-7)', () => {
    it('cerrado queda dentro de la tarjeta e inerte', () => {
      expect(panel().parentElement).not.toBe(document.body);
      expect(panel().getAttribute('aria-hidden')).toBe('true');
      expect(panel().hasAttribute('inert')).toBe(true);
    });

    it('abierto se muda al <body>: ningún overflow de la grilla lo recorta', async () => {
      await abrir();

      expect(panel().parentElement).toBe(document.body);
      expect(panel().hasAttribute('inert')).toBe(false);
    });

    it('la tarjeta vecina no se mueve ni un píxel al abrir', async () => {
      const vecina = root().querySelector('[data-testid="tarjeta-dos"]');
      if (!(vecina instanceof HTMLElement)) {
        throw new Error('falta la tarjeta vecina');
      }
      const antes = vecina.getBoundingClientRect().top;

      await abrir();

      expect(vecina.getBoundingClientRect().top).toBe(antes);
    });

    it('al cerrar vuelve exactamente a donde estaba', async () => {
      const casa = panel().parentElement;

      await abrir();
      await teclear('Escape');

      expect(panel().parentElement).toBe(casa);
    });
  });

  describe('cierre y foco (AC-06-7)', () => {
    it('Escape cierra y devuelve el foco al botón', async () => {
      await abrir();
      await teclear('Escape');

      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger());
    });

    it('Tab cierra: el panel cuelga del <body> y tabular afuera lo dejaría huérfano', async () => {
      await abrir();
      await teclear('Tab');

      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('un clic afuera cierra, y no le roba el foco a lo que se tocó', async () => {
      await abrir();

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();

      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).not.toBe(trigger());
    });

    it('un clic adentro del panel no lo cierra', async () => {
      await abrir();

      panel().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();

      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('contenido', () => {
    it('pinta un renglón por dato, con su rótulo y su valor', async () => {
      await abrir();

      const rotulos = [...panel().querySelectorAll('dt')].map((dt) => dt.textContent?.trim());
      const valores = [...panel().querySelectorAll('dd')].map((dd) => dd.textContent?.trim());

      expect(rotulos).toEqual(['Qué es', 'Dirección']);
      expect(valores).toEqual(['Hospital de tercer nivel', 'Av. Irala 468']);
    });

    it('sin datos publicados lo dice, en vez de rellenar (AC-06-19)', async () => {
      host.filas.set([]);
      await fixture.whenStable();
      await abrir();

      expect(panel().querySelectorAll('dt')).toHaveLength(0);
      expect(panel().textContent).toContain('no publicó más datos');
    });
  });
});
