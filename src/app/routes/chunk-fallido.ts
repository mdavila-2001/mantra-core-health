import { recordRouteChunkFailure } from '../core/errors/stale-build-recovery';
import { ErrorRecovery } from '../features/error-recovery/error-recovery';

/**
 * Componente que se muestra cuando un fragmento diferido no se pudo descargar.
 */
export function chunkFallido(error?: unknown): typeof ErrorRecovery {
  // Hand the error to ErrorRecovery: it logs it (support code) and, when the
  // chunk belongs to an older build, reloads once. See stale-build-recovery.ts.
  recordRouteChunkFailure(error);
  return ErrorRecovery;
}
