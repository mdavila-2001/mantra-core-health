import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { mockBackendInterceptor } from './mock-backend.interceptor';
import { buscarUsuario, emitirAccessToken } from './mock-session';

const originalMockBackend = environment.mockBackend;
beforeAll(() => Object.assign(environment, { mockBackend: true }));
afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

/**
 * H2.S1.M3 (2026-09-22) — los tres niveles del contrato de `latencia()`:
 * prefijo conocido (valor de la tabla), desconocido (valor por omisión) y
 * subida (600, sin cambios). El reloj virtual comprueba el instante exacto
 * de emision sin atribuir al interceptor el retraso del event loop cuando
 * Vitest ejecuta otras suites en paralelo.
 */
describe('latencia del interceptor — tabla por prefijo, sin azar', () => {
  const siguiente = () => {
    throw new Error('no debería caer al passthrough: la ruta es simulada');
  };

  // `routerSimulado()` carga el módulo de manejadores perezosamente en la
  // primera llamada del proceso (mock-backend.interceptor.ts:35-39): sin
  // esta entrada en caliente, la primera medición del `describe` incluiría
  // ese costo único y no la latencia decidida.
  beforeAll(async () => {
    const token = emitirAccessToken(buscarUsuario('paciente')!);
    const request = new HttpRequest('GET', '/terminology/code-systems', undefined).clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await firstValueFrom(TestBed.runInInjectionContext(() => mockBackendInterceptor(request, siguiente as any)));
    } catch {
      // Lo único que importa acá es forzar la carga perezosa del módulo de
      // manejadores antes de medir (ver el comentario de arriba). Desde
      // H2.S1.M1 una ruta sin manejador es un 501, no un 200 — el mismo
      // criterio que ya documenta `medir()` más abajo.
    }
  });

  async function verificarLatencia(method: 'GET' | 'POST', path: string, delayMs: number): Promise<void> {
    const token = emitirAccessToken(buscarUsuario('paciente')!);
    const request = new HttpRequest(method, path, method === 'POST' ? {} : undefined).clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    vi.useFakeTimers();
    try {
      let completed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = firstValueFrom(TestBed.runInInjectionContext(() => mockBackendInterceptor(request, siguiente as any)))
        .then(() => { completed = true; }, () => { completed = true; });
      // `from(routerSimulado())` entrega el router en una microtarea antes de
      // que `atender()` programe el timer. El avance de 0 ms la resuelve.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(delayMs - 1);
      expect(completed).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await response;
      expect(completed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  }

  it('prefijo conocido (/terminology) responde a los 40ms de la tabla', async () => {
    await verificarLatencia('GET', '/terminology/code-systems', 40);
  });

  it('prefijo desconocido cae en el valor por omisión de 120ms', async () => {
    await verificarLatencia('GET', '/tenants/me', 120);
  });

  it('la subida de documentos sigue en 600ms, sin cambios', async () => {
    await verificarLatencia('POST', '/iam/auth/upload-registration-document', 600);
  });

  it('dos corridas de la misma ruta tardan lo mismo (sin Math.random)', async () => {
    await verificarLatencia('GET', '/terminology/code-systems', 40);
    await verificarLatencia('GET', '/terminology/code-systems', 40);
  });

  it('no queda ningún Math.random en el archivo (H2.S1.M1)', () => {
    // Duplica el comando del DoD (`git grep -c Math.random`) como aserción,
    // para que un regreso al azar rompa la suite y no sólo el grep manual.
    const fuente = readFileSync(join(process.cwd(), 'src/app/core/mock/mock-backend.interceptor.ts'), 'utf-8');
    expect(fuente).not.toContain('Math.random');
  });
});
