/* El interruptor vive en `core/simulator/api-mode.ts` (O3-4): la aplicación lo
   lee sin importar el simulador. Se reexporta para el código del simulador. */
export { forcedRealApi } from '../simulator/api-mode';
