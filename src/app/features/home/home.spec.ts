import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Home } from './home';
import { RefreshTokenStorage } from '../../core/auth/refresh-token.storage';
import { SessionStore } from '../../core/auth/session.store';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

class AlmacenFalso {
  value: string | null = 'r-1';
  read(): string | null {
    return this.value;
  }
  write(token: string): void {
    this.value = token;
  }
  clear(): void {
    this.value = null;
  }
}

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let session: SessionStore;
  let http: HttpTestingController;
  let almacen: AlmacenFalso;
  let navegaciones: string[];

  beforeEach(async () => {
    navegaciones = [];
    almacen = new AlmacenFalso();

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RefreshTokenStorage, useValue: almacen },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  async function montarCon(claims: Record<string, unknown>): Promise<HTMLElement> {
    session.start({ accessToken: makeToken(claims), refreshToken: 'r-1' });
    fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('saluda con el nombre que trae el token', async () => {
    const el = await montarCon({
      sub: 'u-1',
      name: 'Administrador Postman',
      roles: ['SECURITY_ADMIN'],
      tenants: ['t-1'],
    });

    expect(el.querySelector('h1')?.textContent).toContain('Administrador Postman');
  });

  it('sin nombre en el token cae al identificador, no a una pantalla vacía', async () => {
    const el = await montarCon({ sub: 'u-1', roles: [], tenants: [] });

    expect(el.querySelector('h1')?.textContent).toContain('u-1');
  });

  it('muestra la organización con su nombre legible, no el uuid', async () => {
    const el = await montarCon({
      sub: 'u-1',
      name: 'Ana',
      roles: [],
      tenants: ['1befcfea-44c0-563a-81cd-337ec6acc840'],
      tenantNames: { '1befcfea-44c0-563a-81cd-337ec6acc840': 'Hospital Central' },
    });

    expect(el.textContent).toContain('Hospital Central');
    expect(el.textContent).not.toContain('1befcfea');
  });

  it('avisa cuando la cuenta no tiene organización', async () => {
    const el = await montarCon({ sub: 'u-1', name: 'Ana', roles: [], tenants: [] });

    // Es el caso del admin recién sembrado: no es un error, pero se nota.
    expect(el.textContent).toContain('todavía no tiene una organización');
  });

  it('lista los roles del token', async () => {
    const el = await montarCon({
      sub: 'u-1',
      name: 'Ana',
      roles: ['SECURITY_ADMIN', 'SUPERADMIN'],
      tenants: [],
    });

    expect(el.textContent).toContain('SECURITY_ADMIN');
    expect(el.textContent).toContain('SUPERADMIN');
  });

  describe('cerrar sesión', () => {
    it('avisa al servidor, limpia y vuelve al login', async () => {
      await montarCon({ sub: 'u-1', name: 'Ana', roles: [], tenants: [] });

      fixture.componentInstance.salir();
      http.expectOne('/iam/auth/logout').flush({});
      await fixture.whenStable();

      expect(session.isAuthenticated()).toBe(false);
      expect(almacen.value).toBeNull();
      expect(navegaciones).toEqual(['/auth']);
    });

    it('si el servidor falla, igual cierra localmente', async () => {
      await montarCon({ sub: 'u-1', name: 'Ana', roles: [], tenants: [] });

      fixture.componentInstance.salir();
      http.expectOne('/iam/auth/logout').error(new ProgressEvent('error'), { status: 0 });
      await fixture.whenStable();

      // Dejarla adentro por un error de red seria lo peor de los dos mundos.
      expect(session.isAuthenticated()).toBe(false);
      expect(almacen.value).toBeNull();
    });
  });
});
