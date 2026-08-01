import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Toast } from './toast';
import type { ToastMessage } from './toast.types';

describe('Toast', () => {
  let fixture: ComponentFixture<Toast>;

  const BASE: ToastMessage = {
    id: 1,
    type: 'info',
    message: 'Hay cambios sin guardar.',
    duration: 5000,
  };

  /** El selector es de elemento: el host ES el aviso. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setToast(toast: Partial<ToastMessage> = {}): Promise<void> {
    fixture.componentRef.setInput('toast', { ...BASE, ...toast });
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toast] }).compileComponents();
    fixture = TestBed.createComponent(Toast);
    await setToast();
  });

  describe('render', () => {
    it('lleva la clase del tono para que el tema resuelva el color', async () => {
      await setToast({ type: 'error' });
      expect([...host().classList].sort()).toEqual(['toast', 'toast--error']);
    });

    it('muestra el mensaje', () => {
      expect(host().querySelector('.toast__message')?.textContent?.trim()).toBe(BASE.message);
    });

    it('sin título no dibuja el encabezado', () => {
      expect(host().querySelector('.toast__title')).toBeNull();
    });

    it('con título lo dibuja', async () => {
      await setToast({ title: 'Atención' });
      expect(host().querySelector('.toast__title')?.textContent?.trim()).toBe('Atención');
    });
  });

  describe('accesibilidad', () => {
    it('el tipo se dice con palabras, no solo con color e ícono', async () => {
      await setToast({ type: 'error' });
      expect(host().querySelector('.sr-only')?.textContent?.trim()).toBe('Error:');
    });

    it('cada tipo tiene su palabra', async () => {
      const esperado: Record<string, string> = {
        success: 'Éxito:',
        warning: 'Advertencia:',
        error: 'Error:',
        info: 'Información:',
      };

      for (const [type, palabra] of Object.entries(esperado)) {
        await setToast({ type: type as ToastMessage['type'] });
        expect(host().querySelector('.sr-only')?.textContent?.trim()).toBe(palabra);
      }
    });

    it('el ícono queda oculto para el lector: ya está dicho con palabras', () => {
      expect(host().querySelector('.toast__icon')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('el botón de cierre tiene nombre accesible', () => {
      expect(host().querySelector('.toast__close')?.getAttribute('aria-label')).toBe(
        'Cerrar aviso',
      );
    });

    it('no es una región viva propia: la región es el contenedor', () => {
      // Dos regiones vivas anidadas anuncian el mismo aviso dos veces.
      expect(host().getAttribute('aria-live')).toBeNull();
      expect(host().getAttribute('role')).toBeNull();
    });
  });

  describe('cierre', () => {
    it('emite el id del aviso, no un evento sin datos', async () => {
      await setToast({ id: 42 });
      const emitidos: number[] = [];
      fixture.componentInstance.dismissed.subscribe((id) => emitidos.push(id));

      host().querySelector<HTMLButtonElement>('.toast__close')!.click();
      await fixture.whenStable();

      expect(emitidos).toEqual([42]);
    });

    it('no se cierra solo: no conoce su duración', async () => {
      const emitidos: number[] = [];
      fixture.componentInstance.dismissed.subscribe((id) => emitidos.push(id));

      await fixture.whenStable();

      expect(emitidos).toEqual([]);
    });
  });
});
