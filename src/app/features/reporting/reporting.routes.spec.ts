import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';

import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';
import { SessionStore } from '../../core/auth/session.store';
import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { ROLES_ROUTE_DATA } from '../../core/navigation/navigation.types';
import { ROLES_ADMINISTRACION, ROLES_REPORTERIA } from './reporting-access';
import { SectionPlaceholder } from '../section-placeholder/section-placeholder';
import { rutasDeLaMaqueta } from './reporting-mock.routes';
import { DEFAULT_TAB, validTabGuard, REPORTING_ROUTES } from './reporting.routes';

function token(roles: readonly string[]): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'u-1',
    sid: 's-1',
    roles,
    tenants: ['t-1'],
  })}.firma`;
}

describe('cableado de los portales en app.routes', () => {
  // Las rutas reales con la bandera ENCENDIDA (apagada son sólo redirecciones: ver `app.routes.spec.ts`).
  const encendidas = rutasDeLaMaqueta(() => SectionPlaceholder, true);
  const selector = encendidas.find((r) => r.path === 'portal-selector');
  const reporting = encendidas.find((r) => r.path === 'reports');
  // Las de `routes` (bandera apagada por defecto) conservan el lugar: delante del armazón.
  const enRoutes = (path: string) => routes.find((r) => r.path === path);

  it('el selector y la reportería existen como rutas de primer nivel, fuera del armazón', () => {
    expect(selector).toBeDefined();
    expect(reporting).toBeDefined();
  });

  it('las dos pasan por authGuard y por el guard de rol, y declaran sus roles', () => {
    for (const ruta of [selector, reporting]) {
      expect(ruta?.canActivate).toEqual([authGuard, seccionRolesGuard]);
      expect(ruta?.data?.[ROLES_ROUTE_DATA]).toBeDefined();
    }
  });

  it('reportería declara exactamente ROLES_REPORTERIA', () => {
    expect(reporting?.data?.[ROLES_ROUTE_DATA]).toEqual(ROLES_REPORTERIA);
  });

  it('el selector declara la unión de ambos portales (nadie queda fuera de uno que sí tiene)', () => {
    const roles = selector?.data?.[ROLES_ROUTE_DATA] as readonly string[];
    for (const rol of [...ROLES_ADMINISTRACION, ...ROLES_REPORTERIA]) {
      expect(roles).toContain(rol);
    }
  });

  it('van delante del armazón comodín de administración', () => {
    const armazon = routes.findIndex((r) => r.path === '' && r.component !== undefined);
    expect(routes.indexOf(enRoutes('portal-selector')!)).toBeLessThan(armazon);
    expect(routes.indexOf(enRoutes('reports')!)).toBeLessThan(armazon);
  });
});

describe('guard de rol aplicado a los portales (pruebas de acceso negativas)', () => {
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  function entrar(roles: readonly string[], rolesDeLaRuta: readonly string[]): string {
    session.start({ accessToken: token(roles), refreshToken: 'r-1' });
    const ruta = { data: { [ROLES_ROUTE_DATA]: rolesDeLaRuta } } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      seccionRolesGuard(ruta, { url: '/reports' } as RouterStateSnapshot),
    ) as boolean | UrlTree;
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : 'pasó';
  }

  it.each(['REPORT_VIEWER', 'REPORT_AUTHOR', 'REPORTING_ADMIN', 'BUSINESS_ADMIN', 'PLATFORM_ADMIN'])(
    '%s entra a /reporting',
    (rol) => {
      expect(entrar([rol], ROLES_REPORTERIA)).toBe('pasó');
    },
  );

  it('SUPERADMIN entra siempre', () => {
    expect(entrar(['SUPERADMIN'], ROLES_REPORTERIA)).toBe('pasó');
  });

  it.each(['PATIENT', 'PRACTITIONER', 'MEDICAL_VISITOR', 'SECURITY_ADMIN', 'USER'])(
    'NEGATIVO: %s es devuelto al panel',
    (rol) => {
      expect(entrar([rol], ROLES_REPORTERIA)).toBe('/dashboard');
    },
  );

  it('NEGATIVO: ni el selector se abre a quien no tiene ningún portal', () => {
    expect(entrar(['PATIENT'], [...ROLES_ADMINISTRACION, ...ROLES_REPORTERIA])).toBe('/dashboard');
  });

  it('el selector se abre a quien solo tiene reportería (lo redirige él mismo)', () => {
    expect(entrar(['REPORT_VIEWER'], [...ROLES_ADMINISTRACION, ...ROLES_REPORTERIA])).toBe('pasó');
  });
});

describe('REPORTING_ROUTES', () => {
  const armazon = REPORTING_ROUTES[0];
  const hijas = armazon.children ?? [];

  it('todo cuelga de un único armazón propio', () => {
    expect(REPORTING_ROUTES).toHaveLength(1);
    expect(armazon.path).toBe('');
    expect(armazon.loadComponent).toBeDefined();
  });

  it('el inicio (grid) es la ruta vacía, y se carga diferido', () => {
    const inicio = hijas.find((r) => r.path === '');
    expect(inicio?.pathMatch).toBe('full');
    expect(inicio?.loadComponent).toBeDefined();
  });

  it('«commercial» a secas redirige a la primera pestaña', () => {
    const comercial = hijas.find((r) => r.path === 'commercial');
    expect(comercial?.redirectTo).toBe(`commercial/${DEFAULT_TAB}`);
    expect(comercial?.pathMatch).toBe('full');
  });

  it('«commercial/:pestana» valida el parámetro con validTabGuard', () => {
    const pestana = hijas.find((r) => r.path === 'commercial/:pestana');
    expect(pestana?.canActivate).toEqual([validTabGuard]);
    expect(pestana?.loadComponent).toBeDefined();
  });
});

describe('validTabGuard', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  function evaluar(pestana: string | null): boolean | string {
    const ruta = { paramMap: { get: () => pestana } } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      validTabGuard(ruta, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
  }

  it.each([
    'resumen',
    'suscripciones',
    'publicidad',
    'comisiones',
    'cobros',
    'adquisicion',
    'calidad',
  ])('«%s» pasa', (pestana) => {
    expect(evaluar(pestana)).toBe(true);
  });

  it.each(['ventas', 'RESUMEN', '', '../administration', 'constructor'])(
    '«%s» no existe: va a la primera pestaña',
    (pestana) => {
      expect(evaluar(pestana)).toBe('/reports/commercial/resumen');
    },
  );

  it('sin parámetro también va a la primera pestaña', () => {
    expect(evaluar(null)).toBe('/reports/commercial/resumen');
  });
});
