import { HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { writeFileSync } from 'node:fs';

import { mockBackendInterceptor } from './mock-backend.interceptor';
import { buscarUsuario, emitirAccessToken } from './mock-session';

/**
 * H1.S2.M1 del carril de Ender (2026-09-22) — la mitad «observada» de la
 * latencia. La red del navegador no sirve para esto: `mockBackendInterceptor`
 * nunca llama a `next(request)` para una ruta simulada, así que no hay
 * `XMLHttpRequest` ni `fetch` real que el DevTools Protocol pueda ver (ver
 * `evidencia/antes/latencia.md`). Se cronometra la propia suscripción con
 * `performance.now()`, contra el interceptor real — el mismo camino que
 * recorre cualquier pantalla.
 */
describe('latencia observada — GET /scheduling/slots × 10', () => {
  it('mide 10 respuestas reales del interceptor y escribe min/max/avg', async () => {
    const token = emitirAccessToken(buscarUsuario('paciente')!);
    const siguiente = () => {
      throw new Error('no debería caer al passthrough: la ruta es simulada');
    };

    const tiempos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const request = new HttpRequest('GET', '/scheduling/slots', {
        headers: undefined,
        params: undefined,
      }).clone({ setHeaders: { Authorization: `Bearer ${token}` } });

      const inicio = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await firstValueFrom(mockBackendInterceptor(request, siguiente as any));
      tiempos.push(performance.now() - inicio);
    }

    const min = Math.min(...tiempos);
    const max = Math.max(...tiempos);
    const avg = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    const resumen =
      `[H1.S2.M1] GET /scheduling/slots × 10 — min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms ` +
      `avg=${avg.toFixed(1)}ms — valores=${tiempos.map((t) => t.toFixed(1)).join(',')}\n`;
    console.log(resumen);
    try {
      writeFileSync('docs/trabajo/2026-09-22-ender-simulador-cabecera/evidencia/antes/latencia-observada-raw.txt', resumen);
    } catch {
      /* si el cwd no es la raiz del repo, el resumen sigue en la consola */
    }

    expect(tiempos).toHaveLength(10);
    expect(min).toBeGreaterThanOrEqual(0);
  }, 15000); // 10 × hasta 299ms más la carga perezosa de `routerSimulado()`: 5s de por omisión queda corto
});
