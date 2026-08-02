import type { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

/**
 * Vaciar la cola antes de que la pestaña desaparezca.
 *
 * Sin esto se pierde el último lote, que es justo el que importa: el error que
 * hizo que la persona cerrara la pestaña, o el formulario que no llegó a
 * enviarse. Con un intervalo de cinco segundos, la ventana de pérdida es de
 * hasta cinco segundos de actividad — y son los cinco últimos.
 *
 * ## Por qué `pagehide` y `visibilitychange`, y no `beforeunload`
 *
 * `beforeunload` no se dispara de forma fiable en móviles: el sistema puede
 * descartar una pestaña en segundo plano sin avisar. `pagehide` sí llega en
 * esos casos, y `visibilitychange` a `hidden` es la última señal garantizada
 * antes de que el sistema pueda congelar la página — en un teléfono, cambiar de
 * aplicación pasa por ahí y puede no volver nunca.
 *
 * Además `beforeunload` rompe la caché de retroceso/avance del navegador, que
 * es un coste de rendimiento real a cambio de nada.
 *
 * ## Por qué no se espera al vaciado
 *
 * `forceFlush` devuelve una promesa que nadie espera, y es deliberado: la
 * página se está yendo. Esperar retrasaría el cierre —que la persona sí nota—
 * a cambio de una traza. El exportador manda la petición; si llega, llega.
 */
export function registerFlushOnPageHide(provider: WebTracerProvider): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  const flush = (): void => {
    void provider.forceFlush().catch(() => {
      // El Collector puede no estar. No es asunto de la aplicación.
    });
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  };

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibilityChange);

  /**
   * La baja existe para las pruebas y para la recarga en caliente, que
   * arrancan la telemetría varias veces en la misma página. Sin ella, cada
   * recarga dejaría un oyente más apuntando a un proveedor ya cerrado.
   */
  return () => {
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
