import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { recordRouteChunkFailure, StaleBuildRecovery, takeRouteChunkFailure } from '../../core/errors/stale-build-recovery';
import { ErrorRecovery } from './error-recovery';

/**
 * `ErrorRecovery` es a donde `chunkFallido` manda una ruta cuyo trozo no bajó.
 * Al crearse recoge ese fallo: lo registra (código de soporte) y, como es una
 * navegación, intenta la recarga única por construcción.
 */
describe('ErrorRecovery', () => {
  let handleError: ReturnType<typeof vi.fn>;
  let recoverFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    takeRouteChunkFailure();
    handleError = vi.fn();
    recoverFrom = vi.fn().mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [ErrorRecovery],
      providers: [
        { provide: ErrorHandler, useValue: { handleError } },
        { provide: StaleBuildRecovery, useValue: { recoverFrom } },
      ],
    });
  });

  it('con un fallo de ruta pendiente, lo registra y lo pasa a la recuperación', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /chunk-A.js');
    recordRouteChunkFailure(error);

    TestBed.createComponent(ErrorRecovery);

    expect(handleError).toHaveBeenCalledWith(error);
    expect(recoverFrom).toHaveBeenCalledWith(error);
  });

  it('abierta directamente (/error), no registra ni recarga nada', () => {
    const fixture = TestBed.createComponent(ErrorRecovery);
    fixture.detectChanges();

    expect(handleError).not.toHaveBeenCalled();
    expect(recoverFrom).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Algo salió mal');
  });
});
