import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { mockBackendInterceptor } from './mock-backend.interceptor';
import { buscarUsuario, emitirAccessToken } from './mock-session';

/**
 * H2.S1.M3 (2026-09-22) — los tres niveles del contrato de `latencia()`:
 * prefijo conocido (valor de la tabla), desconocido (valor por omisión) y
 * subida (600, sin cambios). H2.S1.M2 confirma que dos corridas de la misma
 * ruta tardan lo mismo, dentro del margen de jitter real de un `timer()` —ya
 * no hay `Math.random` que pueda hacerlas divergir hasta 179 ms como antes.
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
    const request = new HttpRequest('GET', '/terminology/calentar', undefined).clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await firstValueFrom(mockBackendInterceptor(request, siguiente as any));
    } catch {
      // Lo único que importa acá es forzar la carga perezosa del módulo de
      // manejadores antes de medir (ver el comentario de arriba). Desde
      // H2.S1.M1 una ruta sin manejador es un 501, no un 200 — el mismo
      // criterio que ya documenta `medir()` más abajo.
    }
  });

  async function medir(method: 'GET' | 'POST', path: string): Promise<number> {
    const token = emitirAccessToken(buscarUsuario('paciente')!);
    const request = new HttpRequest(method, path, method === 'POST' ? {} : undefined).clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    const inicio = performance.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await firstValueFrom(mockBackendInterceptor(request, siguiente as any));
    } catch {
      // Lo que importa acá es cuánto tardó en responder, no si la respuesta
      // fue un éxito: un cuerpo vacío en la subida de documentos es un 422
      // válido del manejador real, y también pasó por `timer(latencia(path))`.
    }
    return performance.now() - inicio;
  }

  it('prefijo conocido (/terminology) responde cerca del valor de la tabla (40ms)', async () => {
    const ms = await medir('GET', '/terminology/value-sets/VS_MEDICAL_SPECIALTY');
    expect(ms).toBeGreaterThanOrEqual(35);
    expect(ms).toBeLessThan(80);
  });

  it('prefijo desconocido cae en el valor por omisión (120ms), no en el azar viejo', async () => {
    const ms = await medir('GET', '/tenants/me');
    expect(ms).toBeGreaterThanOrEqual(110);
    expect(ms).toBeLessThan(170);
  });

  it('la subida de documentos sigue en 600ms, sin cambios', async () => {
    const ms = await medir('POST', '/iam/auth/upload-registration-document');
    expect(ms).toBeGreaterThanOrEqual(590);
    expect(ms).toBeLessThan(650);
  }, 2000);

  it('dos corridas de la misma ruta tardan lo mismo (sin Math.random)', async () => {
    const a = await medir('GET', '/scheduling/slots');
    const b = await medir('GET', '/scheduling/slots');
    // El azar viejo (120 + random*180) podía diferir hasta 179ms entre dos
    // corridas cualquiera; con la tabla fija sólo queda el jitter real del
    // event loop, muy por debajo de eso.
    expect(Math.abs(a - b)).toBeLessThan(30);
  });

  it('no queda ningún Math.random en el archivo (H2.S1.M1)', () => {
    // Duplica el comando del DoD (`git grep -c Math.random`) como aserción,
    // para que un regreso al azar rompa la suite y no sólo el grep manual.
    const fuente = readFileSync(join(__dirname, 'mock-backend.interceptor.ts'), 'utf-8');
    expect(fuente).not.toContain('Math.random');
  });
});
