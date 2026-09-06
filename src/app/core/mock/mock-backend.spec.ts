import { HttpHeaders } from '@angular/common/http';

import { PACIENTE, PACIENTES, PROFESIONALES } from './fixtures/personas';
import { reservas } from './fixtures/agenda';
import { publicaciones, vitrinas } from './fixtures/comunidad';
import { crearRouterSimulado } from './handlers';
import { isMockReply, type MockMethod, type MockRequest } from './mock-router';
import { buscarUsuario, emitirAccessToken, MOCK_USERS, type MockUser } from './mock-session';

/* ============================================================================
    El backend simulado, recorrido entero.

    Cada ruta registrada se llama con identificadores reales de los fixtures y
    con cada una de las cuentas de prueba. Lo que se comprueba es lo mínimo que
    hace falta para que la aplicación no se caiga: que ningún manejador lance,
    y que las lecturas no devuelvan 500. La forma de cada respuesta la valida
    la propia pantalla al usarla — esto es la red de seguridad de abajo.
    ========================================================================== */

const router = crearRouterSimulado();

/** Un valor plausible para cada parámetro de ruta, según su nombre. */
function valorDe(nombre: string, patron: string): string {
  if (nombre === 'code') return patron.includes('value-sets') ? 'VS_MEDICAL_SPECIALTY' : 'demo';
  if (nombre === 'slug') return vitrinas.todos()[0]!.slug;
  if (nombre === 'target') return 'profiles.persons.sex_at_birth_concept_id';
  if (/patient/i.test(nombre) || patron.includes('/patients/')) return PACIENTE.id;
  if (/practitioner/i.test(nombre) || patron.includes('/practitioners/')) return PROFESIONALES[0]!.id;
  if (patron.includes('/bookings/')) return reservas.todos()[0]!.id;
  if (patron.includes('/posts/')) return publicaciones.todos()[0]!.id;
  if (patron.includes('/community/profiles/')) return vitrinas.todos()[0]!.id;
  return PACIENTES[1]!.id;
}

function peticion(method: MockMethod, patron: string, user: MockUser | null): MockRequest {
  const params: Record<string, string> = {};
  const path = patron
    .split('/')
    .map((segmento) => {
      if (segmento.startsWith(':')) {
        const valor = valorDe(segmento.slice(1), patron);
        params[segmento.slice(1)] = valor;
        return valor;
      }
      return segmento === '*' ? 'x' : segmento;
    })
    .join('/');
  const token = user === null ? null : emitirAccessToken(user);
  return {
    method,
    path,
    params,
    query: new URLSearchParams({ limit: '5', q: 'a', lang: 'ES', ids: PACIENTE.id, code: 'VS_MEDICAL_SPECIALTY', target: 'profiles.persons.sex_at_birth_concept_id' }),
    body: {},
    headers: new HttpHeaders(token === null ? {} : { Authorization: `Bearer ${token}` }),
    user,
  };
}

function estadoDe(resultado: unknown): number {
  return isMockReply(resultado) ? resultado.status : 200;
}

describe('backend simulado', () => {
  const lecturas = router.rutas().filter((r) => r.method === 'GET');
  const escrituras = router.rutas().filter((r) => r.method !== 'GET');

  it('registra rutas de todos los dominios', () => {
    const patrones = router.rutas().map((r) => r.pattern);
    for (const raiz of ['/iam/auth/login', '/terminology/concepts', '/profiles/patients/me', '/scheduling/bookings', '/clinical/patients/:id/summary', '/community/feed', '/public/posts', '/notifications/me', '/insurance-claims', '/accounting/journal', '/pharmacy/orders', '/diagnostic-results/me', '/procedure-cases', '/pharma-labs', '/system-context/dynamic-enums', '/authz/care-relationships']) {
      expect(patrones.some((p) => p.startsWith(raiz)), `falta ${raiz}`).toBe(true);
    }
  });

  it('cada cuenta de prueba entra y su token vuelve a ella', () => {
    for (const user of MOCK_USERS) {
      const login = router.match('POST', '/iam/auth/login')!;
      const respuesta = login.handler({ ...peticion('POST', '/iam/auth/login', null), body: { email: user.email, password: 'x' } }) as { accessToken: string };
      expect(respuesta.accessToken).toBeTypeOf('string');
      expect(buscarUsuario(user.email)?.id).toBe(user.id);
    }
  });

  for (const user of [null, ...MOCK_USERS]) {
    const nombre = user?.key ?? 'sin sesión';

    it(`${nombre}: ninguna lectura lanza ni devuelve 500 (${lecturas.length} rutas)`, () => {
      const fallos: string[] = [];
      for (const ruta of lecturas) {
        const req = peticion('GET', ruta.pattern, user);
        try {
          const estado = estadoDe(router.match('GET', req.path)!.handler(req));
          if (estado >= 500) fallos.push(`${estado} GET ${ruta.pattern}`);
        } catch (error) {
          fallos.push(`lanzó GET ${ruta.pattern}: ${(error as Error).message}`);
        }
      }
      expect(fallos).toEqual([]);
    });

    it(`${nombre}: ninguna escritura lanza con cuerpo vacío (${escrituras.length} rutas)`, () => {
      const fallos: string[] = [];
      for (const ruta of escrituras) {
        const req = peticion(ruta.method, ruta.pattern, user);
        try {
          const estado = estadoDe(router.match(ruta.method, req.path)!.handler(req));
          if (estado >= 500) fallos.push(`${estado} ${ruta.method} ${ruta.pattern}`);
        } catch (error) {
          fallos.push(`lanzó ${ruta.method} ${ruta.pattern}: ${(error as Error).message}`);
        }
      }
      expect(fallos).toEqual([]);
    });
  }
});
