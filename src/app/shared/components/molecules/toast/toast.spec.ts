import { TestBed } from '@angular/core/testing';

import { Toast } from './toast';
import { ToastService } from './toast.service';
import type { ToastMessage } from './toast.types';
import { ToastContainer } from '../toast-container/toast-container';

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
    // `role="alert"` ya implica aria-live assertive: no hace falta declararlo.
    expect(host.getAttribute('role')).toBe('alert');
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
    // los que no son error se anuncian sin interrumpir
    expect(host.querySelectorAll('[role="status"]').length).toBe(1);

    host.querySelectorAll<HTMLButtonElement>('.toast__close')[1].click();
    fixture.detectChanges();

    expect(service.toasts().some((toast) => toast.id === segundo)).toBe(false);
    expect(host.querySelectorAll('app-toast').length).toBe(1);
  });
});
