import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type ActivatedRouteSnapshot, type RouterStateSnapshot, type UrlTree } from '@angular/router';

import { mfaEnrollmentGuard } from './mfa-enrollment.guard';
import { SessionStore } from './session.store';

function token(extra: object = {}): string {
  const codificar = (valor: object): string => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'HS256' })}.${codificar({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'], ...extra })}.firma`;
}

describe('mfaEnrollmentGuard', () => {
  let store: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  const ir = (url: string): ReturnType<typeof mfaEnrollmentGuard> =>
    TestBed.runInInjectionContext(() => mfaEnrollmentGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const abrirSesion = (extra: object = {}): void => store.start({ accessToken: token(extra), refreshToken: 'r' });
  const comoUrl = (valor: unknown): string => router.serializeUrl(valor as UrlTree);

  it('sin sesión no decide nada: lo hace authGuard', () => {
    expect(ir('/dashboard')).toBe(true);
  });

  it('si el login avisó que falta, manda a dar de alta el segundo paso, con la ruta de la que venía', () => {
    abrirSesion();
    store.mfaEnrollment.set('required');
    const destino = ir('/agenda?dia=hoy');
    expect(comoUrl(destino)).toBe('/my-account/security/mfa?returnUrl=%2Fagenda%3Fdia%3Dhoy');
  });

  it('el código de una invitación (#code=…) NO pasa a la dirección de retorno: no queda en los registros ni en el Referer', () => {
    abrirSesion();
    store.mfaEnrollment.set('required');
    const secreto = 'Zq3-AbC_9xYkLmNoPqRsTuVwXyZ0123456789abcdef';
    for (const url of [`/my-support#code=${secreto}`, `/my-support?code=${secreto}`, `/my-support?x=1#code=${secreto}`]) {
      const resultado = comoUrl(ir(url));
      expect(resultado, url).not.toContain(secreto);
      expect(decodeURIComponent(resultado), url).not.toContain('code=');
      expect(resultado, url).toContain('/my-account/security/mfa?returnUrl=');
    }
    expect(decodeURIComponent(comoUrl(ir(`/my-support#code=${secreto}`)))).toBe('/my-account/security/mfa?returnUrl=/my-support');
    expect(decodeURIComponent(comoUrl(ir(`/my-support?x=1#code=${secreto}`)))).toBe('/my-account/security/mfa?returnUrl=/my-support?x=1');
  });

  it('la propia pantalla de alta queda abierta, con o sin query', () => {
    abrirSesion();
    store.mfaEnrollment.set('required');
    expect(ir('/my-account/security/mfa')).toBe(true);
    expect(ir('/my-account/security/mfa?returnUrl=%2F')).toBe(true);
  });

  it('con el alta hecha, o sin que se exija, deja pasar', () => {
    abrirSesion();
    store.mfaEnrollment.set('done');
    expect(ir('/dashboard')).toBe(true);
  });

  it('el token de alcance limitado (claim mfaEnrollment) deja la sesión restringida desde el primer instante, sin preguntar a la API', () => {
    abrirSesion({ mfaEnrollment: true, roles: [], tenants: [] });
    expect(store.limitedToEnrollment()).toBe(true);
    expect(store.mfaEnrollment()).toBe('required');
    expect(comoUrl(ir('/dashboard'))).toContain('/my-account/security/mfa?returnUrl=');
  });

  it('tras restaurar con el token limitado sigue restringido: el refresco lo conserva', () => {
    abrirSesion({ mfaEnrollment: true, roles: [], tenants: [] });
    store.renew({ accessToken: token({ mfaEnrollment: true, roles: [], tenants: [] }), refreshToken: 'r2' });
    expect(store.mfaEnrollment()).toBe('required');
  });

  it('al confirmar el factor el refresco reemite el token completo y la restricción se levanta', () => {
    abrirSesion({ mfaEnrollment: true, roles: [], tenants: [] });
    expect(store.mfaEnrollment()).toBe('required');
    store.renew({ accessToken: token(), refreshToken: 'r2' });
    expect(store.limitedToEnrollment()).toBe(false);
    expect(store.mfaEnrollment()).toBe('done');
    expect(ir('/dashboard')).toBe(true);
  });

  it('con un token completo no se restringe nada, aunque una organización niegue por falta del factor: solo se avisa', () => {
    abrirSesion({ deniedTenants: { 't-2': 'MFA_ENROLLMENT_REQUIRED' } });
    expect(store.deniedTenants()).toEqual([{ tenantId: 't-2', reason: 'MFA_ENROLLMENT_REQUIRED' }]);
    expect(store.mfaEnrollment()).toBe('unknown');
    expect(ir('/dashboard')).toBe(true);
  });

  it('cerrar la sesión olvida el estado', () => {
    abrirSesion();
    store.mfaEnrollment.set('required');
    store.clear();
    expect(store.mfaEnrollment()).toBe('unknown');
  });
});
