import { ErrorRecovery } from '../features/error-recovery/error-recovery';

/**
 * Componente que se muestra cuando un fragmento diferido no se pudo descargar.
 */
export function chunkFallido(): typeof ErrorRecovery {
  return ErrorRecovery;
}
