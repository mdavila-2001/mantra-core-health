import { TestBed } from '@angular/core/testing';

import { Toast } from './toast';
import { ToastService } from './toast.service';
import type { ToastMessage } from './toast.types';
import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';

const SAMPLE: ToastMessage = {
  id: 'aviso-1',
  type: 'error',
  title: 'No se pudo firmar',
  message: 'El certificado del profesional expiró.',
  durationMs: null,
};

describe('Toast', () => {
  it('pinta el tono, el ícono y el rótulo del tipo', () => {
    const fixture = TestBed.createComponent(Toast);
    fixture.componentRef.setInput('toast', SAMPLE);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toBe('toast toast--error');
    // Sin rol propio: la región viva es el contenedor (ver más abajo).
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.querySelector('.toast__icon svg')).toBeTruthy();
    expect(host.querySelector('.sr-only')?.textContent?.trim()).toBe('Error:');
    expect(host.querySelector('.toast__title')?.textContent?.trim()).toBe('No se pudo firmar');
  });

  it('emite el id al pulsar la X', () => {
    const fixture = TestBed.createComponent(Toast);
    fixture.componentRef.setInput('toast', SAMPLE);
    fixture.detectChanges();

    let emitted: string | undefined;
    fixture.componentInstance.dismissed.subscribe((id: string) => (emitted = id));

    const close = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.toast__close',
    );
    close?.click();

    expect(emitted).toBe('aviso-1');
  });

  /**
   * El contenedor ya no recibe la cola por input: lee la del `ToastService`.
   * La prueba encola por el servicio y cierra por el DOM, que es el circuito
   * completo que recorre un aviso real.
   */
  it('el contenedor apila desde el servicio y la X saca el aviso de la cola', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);

    service.show({ type: 'error', title: 'No se pudo firmar', message: 'a', durationMs: null });
    const segundo = service.show({ type: 'success', message: 'b', durationMs: null });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-toast').length).toBe(2);
    // los que no son error se anuncian sin interrumpir; el error, interrumpiendo
    expect(host.querySelectorAll('[aria-live="polite"] app-toast').length).toBe(1);
    expect(host.querySelectorAll('[aria-live="assertive"] app-toast').length).toBe(1);

    // el de éxito vive en la región cortés: su X es la de ahí
    host.querySelector<HTMLButtonElement>('[aria-live="polite"] .toast__close')?.click();
    fixture.detectChanges();

    expect(service.toasts().some((toast) => toast.id === segundo)).toBe(false);
    expect(host.querySelectorAll('app-toast').length).toBe(1);
  });

  /**
   * Un lector de pantalla sólo anuncia cambios en una región que ya conocía.
   * Si la región nace junto con el aviso, el anuncio se pierde: por eso las dos
   * tienen que estar en el DOM desde el primer render, vacías.
   */
  describe('región viva del contenedor', () => {
    function regiones(host: HTMLElement) {
      return {
        cortes: host.querySelector('[aria-live="polite"]'),
        urgente: host.querySelector('[aria-live="assertive"]'),
      };
    }

    it('existe vacía antes del primer aviso, cortés y urgente', () => {
      const fixture = TestBed.createComponent(ToastContainer);
      fixture.detectChanges();

      const { cortes, urgente } = regiones(fixture.nativeElement as HTMLElement);
      expect(cortes?.getAttribute('role')).toBe('status');
      expect(urgente?.getAttribute('role')).toBe('alert');
      expect(cortes?.children.length).toBe(0);
      expect(urgente?.children.length).toBe(0);
    });

    it('el aviso se inserta DENTRO de la región que ya estaba, no la reemplaza', () => {
      const fixture = TestBed.createComponent(ToastContainer);
      const service = TestBed.inject(ToastService);
      fixture.detectChanges();
      const antes = regiones(fixture.nativeElement as HTMLElement);

      service.show({ type: 'success', message: 'Guardado', durationMs: null });
      service.show({ type: 'error', message: 'No se pudo firmar', durationMs: null });
      fixture.detectChanges();

      const despues = regiones(fixture.nativeElement as HTMLElement);
      expect(despues.cortes).toBe(antes.cortes);
      expect(despues.urgente).toBe(antes.urgente);
      expect(despues.cortes?.textContent).toContain('Guardado');
      expect(despues.urgente?.textContent).toContain('No se pudo firmar');
    });

    it('al vaciarse la cola las regiones se quedan: el próximo aviso también se anuncia', () => {
      const fixture = TestBed.createComponent(ToastContainer);
      const service = TestBed.inject(ToastService);
      const id = service.show({ type: 'warning', message: 'a', durationMs: null });
      fixture.detectChanges();

      service.dismiss(id);
      fixture.detectChanges();

      const { cortes, urgente } = regiones(fixture.nativeElement as HTMLElement);
      expect(cortes).not.toBeNull();
      expect(urgente).not.toBeNull();
      expect(cortes?.querySelector('app-toast')).toBeNull();
    });

    it('ningún aviso lleva rol propio: no hay regiones anidadas', () => {
      const fixture = TestBed.createComponent(ToastContainer);
      const service = TestBed.inject(ToastService);
      service.show({ type: 'info', message: 'a', durationMs: null });
      service.show({ type: 'error', message: 'b', durationMs: null });
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelectorAll('app-toast[role]').length).toBe(0);
      expect(host.querySelectorAll('[aria-live]').length).toBe(2);
    });
  });
});
