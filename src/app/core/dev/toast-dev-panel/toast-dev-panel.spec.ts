import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ToastDevPanel } from './toast-dev-panel';

/**
 * El panel de desarrollo para revisar avisos en pantalla: lanza uno por tipo,
 * uno fijo (sin cierre automático), una ráfaga de cinco y limpia todo. Va
 * plegado en un `<details>` para no estorbar.
 */
describe('ToastDevPanel', () => {
  let fixture: ComponentFixture<ToastDevPanel>;
  let toasts: ToastService;
  const boton = (texto: string): HTMLButtonElement =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)!;

  beforeEach(() => {
    fixture = TestBed.createComponent(ToastDevPanel);
    toasts = TestBed.inject(ToastService);
    toasts.clear();
    fixture.detectChanges();
  });

  afterEach(() => toasts.clear());

  it('va plegado en un details, con un botón por tipo', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('details')?.hasAttribute('open')).toBe(false);
    for (const tipo of ['success', 'info', 'warning', 'error']) expect(boton(tipo)).toBeDefined();
  });

  it('cada tipo lanza un aviso de ese tipo', () => {
    boton('warning').click();
    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0]!.type).toBe('warning');
    expect(toasts.toasts()[0]!.title).toBe('Aviso de prueba (warning)');
  });

  it('«Fijo» lanza un error que no se cierra solo', () => {
    boton('Fijo').click();
    expect(toasts.toasts()[0]).toEqual(expect.objectContaining({ type: 'error', title: 'Aviso fijo' }));
    expect(toasts.toasts()[0]!.durationMs ?? null).toBeNull();
  });

  it('«Ráfaga ×5» lanza cinco y «Limpiar» los quita', () => {
    boton('Ráfaga ×5').click();
    expect(toasts.toasts().length).toBe(5);
    boton('Limpiar').click();
    expect(toasts.toasts()).toHaveLength(0);
  });
});
