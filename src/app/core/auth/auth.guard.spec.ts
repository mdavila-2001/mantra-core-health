import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { provideRouter } from '@angular/router';

import {
  authGuard,
  guestGuard,
  HOME_PATH,
  LOGIN_PATH,
  RETURN_URL_PARAM,
  roleGuard,
  TENANT_SELECTION_PATH,
  tenantSelectedGuard,
} from './auth.guard';
import { AuthService } from './auth.service';
import { LOGIN_ROUTE } from '../http/auth.interceptor';

/**
 * `AuthService` de mentira. Interesa **cuándo** el guard mira el estado, no cómo se llegó a él: la
 * restauración se controla a mano para poder comprobar que ningún guard decide antes de tiempo.
 */
class AuthFalso {
  autenticado = false;
  tenantActivo: string | null = null;
  necesitaElegir = false;
  rolesActuales: readonly string[] = [];

  /** Cuántas veces se preguntó por el estado antes de que la restauración terminara. */
  consultasAntesDeRestaurar = 0;
  private restaurado = false;

  private resolver: (() => void) | null = null;
  private readonly pendiente = new Promise<void>((resolve) => {
    this.resolver = resolve;
  });

  /** Suelta la restauración, como haría la respuesta del refresco. */
  terminarRestauracion(): void {
    this.restaurado = true;
    this.resolver?.();
  }

  ensureRestored(): Promise<void> {
    return this.pendiente;
  }

  isAuthenticated = (): boolean => {
    this.contar();
    return this.autenticado;
  };

  activeTenantId = (): string | null => {
    this.contar();
    return this.tenantActivo;
  };

  needsTenantSelection = (): boolean => {
    this.contar();
    return this.necesitaElegir;
  };

  hasAnyRole(required: readonly string[]): boolean {
    this.contar();
    return required.some((role) => this.rolesActuales.includes(role));
  }

  private contar(): void {
    if (!this.restaurado) {
      this.consultasAntesDeRestaurar += 1;
    }
  }
}

function ejecutar(
  guard: CanActivateFn,
  injector: Injector,
  url = '/panel',
): Promise<boolean | UrlTree> {
  return runInInjectionContext(injector, () =>
    Promise.resolve(
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>,
  );
}

describe('guards de sesión', () => {
  let auth: AuthFalso;
  let injector: Injector;
  let router: Router;

  beforeEach(() => {
    auth = new AuthFalso();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    injector = TestBed.inject(Injector);
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('no decide nada hasta que la sesión terminó de restaurarse', async () => {
      auth.autenticado = true;

      const decision = ejecutar(authGuard, injector);
      // La promesa del guard sigue pendiente: sin esto, un F5 con sesión válida terminaría en el
      // login porque el estado todavía no había llegado.
      expect(auth.consultasAntesDeRestaurar).toBe(0);

      auth.terminarRestauracion();
      expect(await decision).toBe(true);
    });

    it('deja pasar con sesión', async () => {
      auth.autenticado = true;
      auth.terminarRestauracion();

      expect(await ejecutar(authGuard, injector)).toBe(true);
    });

    it('sin sesión manda al login recordando adónde se quería ir', async () => {
      auth.terminarRestauracion();

      const decision = await ejecutar(authGuard, injector, '/panel/pacientes/42');

      expect(router.serializeUrl(decision as UrlTree)).toBe(
        `${LOGIN_PATH}?${RETURN_URL_PARAM}=%2Fpanel%2Fpacientes%2F42`,
      );
    });
  });

  describe('guestGuard', () => {
    it('deja ver el login a quien no tiene sesión', async () => {
      auth.terminarRestauracion();

      expect(await ejecutar(guestGuard, injector, LOGIN_PATH)).toBe(true);
    });

    it('con sesión resuelta manda al panel', async () => {
      auth.autenticado = true;
      auth.terminarRestauracion();

      expect(router.serializeUrl((await ejecutar(guestGuard, injector)) as UrlTree)).toBe(HOME_PATH);
    });

    it('con sesión pero sin organización elegida manda a elegirla, no al panel', async () => {
      auth.autenticado = true;
      auth.necesitaElegir = true;
      auth.terminarRestauracion();

      expect(router.serializeUrl((await ejecutar(guestGuard, injector)) as UrlTree)).toBe(
        TENANT_SELECTION_PATH,
      );
    });
  });

  describe('tenantSelectedGuard', () => {
    it('deja pasar con organización activa', async () => {
      auth.tenantActivo = 't-1';
      auth.terminarRestauracion();

      expect(await ejecutar(tenantSelectedGuard, injector)).toBe(true);
    });

    it('sin organización activa obliga a elegir antes de mostrar dato alguno', async () => {
      auth.terminarRestauracion();

      const decision = await ejecutar(tenantSelectedGuard, injector, '/panel');

      // `authInterceptor` no manda `X-Tenant-Id` sin organización resuelta: entrar igual mostraría
      // lo que la API devuelva sin contexto de organización.
      expect(router.serializeUrl(decision as UrlTree)).toBe(
        `${TENANT_SELECTION_PATH}?${RETURN_URL_PARAM}=%2Fpanel`,
      );
    });
  });

  describe('roleGuard', () => {
    it('deja pasar con alguno de los roles pedidos', async () => {
      auth.rolesActuales = ['SECURITY_ADMIN'];
      auth.terminarRestauracion();

      expect(await ejecutar(roleGuard(['SECURITY_ADMIN']), injector)).toBe(true);
    });

    it('cancela la navegación en vez de rebotar a la portada', async () => {
      auth.rolesActuales = ['USER'];
      auth.terminarRestauracion();

      // `false` y no un `UrlTree`: rebotar deja la impresión de que la ruta no existe.
      expect(await ejecutar(roleGuard(['SECURITY_ADMIN']), injector)).toBe(false);
    });
  });
});

describe('la ruta de login es una sola', () => {
  it('el interceptor y los guards mandan al mismo lugar', () => {
    // Son dos constantes en capas distintas a propósito (ver `LOGIN_ROUTE`); esta prueba es lo que
    // impide que se separen sin que nadie se entere.
    expect(LOGIN_ROUTE).toBe(LOGIN_PATH);
  });
});
