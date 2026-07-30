import { TestBed } from '@angular/core/testing';

import { Toast } from './toast';
import type { ToastMessage } from './toast.types';
import { ToastContainer } from '../toast-container/toast-container';

const SAMPLE: ToastMessage = {
  id: 'aviso-1',
  type: 'error',
  title: 'No se pudo firmar',
  message: 'El certificado del profesional expiró.',
  duration: 8000,
};

describe('Toast', () => {
  it('pinta el tono, el ícono y el rótulo del tipo', () => {
    const fixture = TestBed.createComponent(Toast);
    fixture.componentRef.setInput('toast', SAMPLE);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toBe('toast toast--error');
    expect(host.getAttribute('role')).toBe('alert');
    expect(host.getAttribute('aria-live')).toBe('assertive');
    expect(host.querySelector('.toast__icon svg')).toBeTruthy();
    expect(host.querySelector('.sr-only')?.textContent?.trim()).toBe('Error:');
    expect(host.querySelector('.toast__title')?.textContent?.trim()).toBe('No se pudo firmar');
  });

  it('emite el id al pulsar la X', () => {
    const fixture = TestBed.createComponent(Toast);
    fixture.componentRef.setInput('toast', SAMPLE);
    fixture.detectChanges();

    let emitted: string | undefined;
    fixture.componentInstance.dismissed.subscribe((id) => (emitted = id));

    const close = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.toast__close',
    );
    close?.click();

    expect(emitted).toBe('aviso-1');
  });

  it('el contenedor apila y reenvía el id', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    fixture.componentRef.setInput('toasts', [
      SAMPLE,
      { ...SAMPLE, id: 'aviso-2', type: 'success' as const },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-toast').length).toBe(2);
    expect(host.getAttribute('aria-label')).toBe('Avisos del sistema');

    let emitted: string | undefined;
    fixture.componentInstance.dismissed.subscribe((id) => (emitted = id));
    host.querySelectorAll<HTMLButtonElement>('.toast__close')[1].click();

    expect(emitted).toBe('aviso-2');
  });
});
