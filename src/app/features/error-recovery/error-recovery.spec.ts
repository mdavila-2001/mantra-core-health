import { ErrorHandler, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { BUILD_INFO } from '../../core/build/build-info';
import { ErrorReporter } from '../../core/errors/error-reporter';
import {
  recordRouteChunkFailure,
  StaleBuildRecovery,
  takeRouteChunkFailure,
} from '../../core/errors/stale-build-recovery';
import { ErrorRecovery } from './error-recovery';

/**
 * La pantalla que reemplaza a otra que falló. Se anuncia como alerta, ofrece
 * recargar y, si el error quedó registrado, el código de soporte con la
 * versión para copiar. Sin código no ofrece copiar nada.
 */
describe('ErrorRecovery', () => {
  let fixture: ComponentFixture<ErrorRecovery>;
  const ultimo = signal<{ id: string } | null>(null);
  let writeText: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boton = (texto: string): HTMLButtonElement | undefined =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);

  beforeEach(() => {
    ultimo.set(null);
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorReporter, useValue: { ultimo } },
        { provide: BUILD_INFO, useValue: { version: '0.1.0', commit: 'abc1234' } },
      ],
    });
  });

  function pintar(): void {
    fixture = TestBed.createComponent(ErrorRecovery);
    fixture.detectChanges();
  }

  it('se anuncia como alerta, con la versión y «Recargar»', () => {
    pintar();
    expect(root().querySelector('.recuperacion')?.getAttribute('role')).toBe('alert');
    expect(root().textContent).toContain('0.1.0 · abc1234');
    expect(boton('Recargar')).toBeDefined();
  });

  it('sin error registrado no hay código ni «Copiar código»', () => {
    pintar();
    expect(root().textContent).not.toContain('Código de soporte');
    expect(boton('Copiar código')).toBeUndefined();
  });

  it('con error registrado muestra su código y copia código y versión', async () => {
    ultimo.set({ id: 'ERR-42' });
    pintar();
    expect(root().textContent).toContain('Código de soporte: ERR-42');
    boton('Copiar código')!.click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('ERR-42 · 0.1.0 · abc1234');
  });

  it('si el portapapeles falla no rompe la pantalla', async () => {
    writeText.mockRejectedValue(new Error('denegado'));
    ultimo.set({ id: 'ERR-42' });
    pintar();
    boton('Copiar código')!.click();
    await fixture.whenStable();
    expect(root().querySelector('.recuperacion')).not.toBeNull();
  });
});

/** Reached through `chunkFallido`: the pending route failure is logged and recovered. */
describe('ErrorRecovery · fallo de ruta pendiente', () => {
  let handleError: ReturnType<typeof vi.fn>;
  let recoverFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    takeRouteChunkFailure();
    handleError = vi.fn();
    recoverFrom = vi.fn().mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError } },
        { provide: StaleBuildRecovery, useValue: { recoverFrom } },
        { provide: BUILD_INFO, useValue: { version: '0.1.0', commit: 'abc1234' } },
      ],
    });
  });

  it('lo registra y lo pasa a la recuperación', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /chunk-A.js');
    recordRouteChunkFailure(error);

    TestBed.createComponent(ErrorRecovery);

    expect(handleError).toHaveBeenCalledWith(error);
    expect(recoverFrom).toHaveBeenCalledWith(error);
  });

  it('abierta directamente (/error), no registra ni recarga nada', () => {
    TestBed.createComponent(ErrorRecovery).detectChanges();

    expect(handleError).not.toHaveBeenCalled();
    expect(recoverFrom).not.toHaveBeenCalled();
  });
});
