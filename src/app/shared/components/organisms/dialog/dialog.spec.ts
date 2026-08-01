import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DialogComponent } from './dialog';

/**
 * Anfitrión de prueba: el diálogo se monta ya abierto dentro de un `@if`, que
 * es exactamente como lo usa un consumidor real.
 */
@Component({
  imports: [DialogComponent],
  template: `
    <button #disparador type="button">Abrir</button>
    @if (abierto()) {
      <app-dialog label="Diálogo de prueba" [restoreFocusTo]="disparador" (closed)="cerrar()">
        <button type="button" class="primero">Primero</button>
        <button type="button" class="medio">Medio</button>
        <button type="button" class="ultimo">Último</button>
      </app-dialog>
    }
  `,
})
class Anfitrion {
  readonly abierto = signal(true);
  readonly cierresPedidos = signal(0);

  cerrar(): void {
    this.cierresPedidos.update((n) => n + 1);
    this.abierto.set(false);
  }
}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;

  function surface(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role=dialog]');
  }
  function overlay(): HTMLElement {
    return fixture.nativeElement.querySelector('.dialog-overlay');
  }
  function disparador(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }
  function boton(clase: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`.${clase}`);
  }
  function teclear(key: string, shiftKey = false): void {
    surface()!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
  });

  describe('semántica de diálogo', () => {
    it('se anuncia como modal y con nombre', () => {
      expect(surface()!.getAttribute('role')).toBe('dialog');
      expect(surface()!.getAttribute('aria-modal')).toBe('true');
      expect(surface()!.getAttribute('aria-label')).toBe('Diálogo de prueba');
    });

    it('proyecta su contenido', () => {
      expect(boton('primero')).not.toBeNull();
      expect(boton('ultimo').textContent?.trim()).toBe('Último');
    });

    it('recibe el foco al abrir sin entrar en el orden de tabulación', () => {
      expect(document.activeElement).toBe(surface());
      expect(surface()!.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('cierre', () => {
    it('Escape pide cerrar', async () => {
      teclear('Escape');
      await fixture.whenStable();

      expect(fixture.componentInstance.cierresPedidos()).toBe(1);
      expect(surface()).toBeNull();
    });

    it('el clic en el fondo pide cerrar', async () => {
      overlay().click();
      await fixture.whenStable();

      expect(fixture.componentInstance.cierresPedidos()).toBe(1);
    });

    it('el clic dentro del diálogo NO cierra', async () => {
      surface()!.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.cierresPedidos()).toBe(0);
      expect(surface()).not.toBeNull();
    });

    it('al cerrar devuelve el foco a donde se le indicó', async () => {
      teclear('Escape');
      await fixture.whenStable();

      expect(document.activeElement).toBe(disparador());
    });
  });

  describe('trampa de foco', () => {
    it('Tab desde el último vuelve al primero', async () => {
      boton('ultimo').focus();
      teclear('Tab');
      await fixture.whenStable();

      expect(document.activeElement).toBe(boton('primero'));
    });

    it('Shift+Tab desde el primero salta al último', async () => {
      boton('primero').focus();
      teclear('Tab', true);
      await fixture.whenStable();

      expect(document.activeElement).toBe(boton('ultimo'));
    });

    it('Shift+Tab desde el diálogo recién abierto salta al último', async () => {
      expect(document.activeElement).toBe(surface());

      teclear('Tab', true);
      await fixture.whenStable();

      expect(document.activeElement).toBe(boton('ultimo'));
    });

    it('en medio no se intercepta: el Tab nativo sabe mejor cuál sigue', async () => {
      boton('medio').focus();
      teclear('Tab');
      await fixture.whenStable();

      expect(document.activeElement).toBe(boton('medio'));
    });
  });
});
