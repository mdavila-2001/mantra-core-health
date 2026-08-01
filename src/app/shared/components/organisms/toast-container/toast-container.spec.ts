import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ToastContainer } from './toast-container';
import { ToastService } from '../../molecules/toast/toast.service';

describe('ToastContainer', () => {
  let fixture: ComponentFixture<ToastContainer>;
  let service: ToastService;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function avisos(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('app-toast')];
  }

  /**
   * Avisos fijos a propósito: el autocierre ya se prueba en `toast.service.spec`.
   * Acá se mide el pintado, así que no se programa ni un temporizador — sin
   * relojes falsos, que no conviven con `compileComponents()`.
   */
  function encolar(message: string): number {
    return service.info(message, { duration: null });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToastContainer] }).compileComponents();
    service = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastContainer);
    await fixture.whenStable();
  });

  describe('región viva', () => {
    it('existe desde el primer render, aunque no haya avisos', () => {
      // Un `aria-live` que aparece junto con el primer aviso no se anuncia:
      // el lector solo reporta cambios de regiones que ya estaban.
      expect(host().getAttribute('role')).toBe('region');
      expect(host().getAttribute('aria-live')).toBe('polite');
      expect(avisos()).toHaveLength(0);
    });

    it('tiene nombre accesible', () => {
      expect(host().getAttribute('aria-label')).toBe('Avisos');
    });

    it('solo anuncia lo que entra', () => {
      expect(host().getAttribute('aria-relevant')).toBe('additions');
    });
  });

  describe('pintado de la cola', () => {
    it('pinta un aviso por cada uno encolado', async () => {
      encolar('uno');
      encolar('dos');
      await fixture.whenStable();

      expect(avisos()).toHaveLength(2);
    });

    it('el aviso desaparece cuando el servicio lo descarta', async () => {
      const id = encolar('uno');
      await fixture.whenStable();

      service.dismiss(id);
      await fixture.whenStable();

      expect(avisos()).toHaveLength(0);
    });
  });

  describe('cierre desde el aviso', () => {
    it('el botón de cierre saca el aviso de la cola del servicio', async () => {
      encolar('uno');
      await fixture.whenStable();

      host().querySelector<HTMLButtonElement>('.toast__close')!.click();
      await fixture.whenStable();

      expect(service.toasts()).toEqual([]);
      expect(avisos()).toHaveLength(0);
    });

    it('cierra el aviso pulsado, no el primero de la lista', async () => {
      encolar('uno');
      const segundo = encolar('dos');
      await fixture.whenStable();

      const botones = host().querySelectorAll<HTMLButtonElement>('.toast__close');
      botones[1].click();
      await fixture.whenStable();

      expect(service.toasts().map((toast) => toast.id)).not.toContain(segundo);
      expect(service.toasts().map((toast) => toast.message)).toEqual(['uno']);
    });
  });
});
