import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { PortalSelector } from './portal-selector';

describe('PortalSelector', () => {
  let roles: ReturnType<typeof signal<readonly string[]>>;
  let sessionName: ReturnType<typeof signal<string | null>>;
  let navegaciones: { url: string; extras: unknown }[];

  async function montar(rolesDeLaSesion: readonly string[], name: string | null = null) {
    roles = signal(rolesDeLaSesion);
    sessionName = signal(name);
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [PortalSelector],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roles, displayName: sessionName } },
      ],
    }).compileComponents();

    TestBed.inject(Router).navigateByUrl = ((url: string, extras?: unknown) => {
      navegaciones.push({ url: String(url), extras });
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    const fixture: ComponentFixture<PortalSelector> = TestBed.createComponent(PortalSelector);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const root = (f: ComponentFixture<PortalSelector>) => f.nativeElement as HTMLElement;

  describe('con acceso a los dos portales', () => {
    it('ofrece dos tarjetas: administración (a «/») y reportería (a «/reports»)', async () => {
      const f = await montar(['SECURITY_ADMIN', 'REPORTING_ADMIN']);

      const admin = root(f).querySelector<HTMLAnchorElement>('[data-testid="portal-administracion"]');
      const reporteria = root(f).querySelector<HTMLAnchorElement>('[data-testid="portal-reporteria"]');

      expect(admin?.getAttribute('href')).toBe('/');
      expect(reporteria?.getAttribute('href')).toBe('/reports');
      expect(admin?.querySelector('h2')?.textContent).toContain('Portal de administración');
      expect(reporteria?.querySelector('h2')?.textContent).toContain('Portal de reportería');
      expect(root(f).querySelectorAll('a.opcion').length).toBe(2);
    });

    it('cada tarjeta dice qué se encuentra ahí', async () => {
      const f = await montar(['SECURITY_ADMIN', 'REPORTING_ADMIN']);

      expect(root(f).querySelector('[data-testid="portal-administracion"]')?.textContent).toContain(
        'contabilidad',
      );
      expect(root(f).querySelector('[data-testid="portal-reporteria"]')?.textContent).toContain(
        'suscripciones de doctores',
      );
    });

    it('no redirige: hay que elegir', async () => {
      await montar(['SECURITY_ADMIN', 'REPORTING_ADMIN']);

      expect(navegaciones).toEqual([]);
    });

    it('saluda por el primer nombre cuando la sesión lo trae', async () => {
      const f = await montar(['SUPERADMIN'], 'Marcelo Dávila Arce');

      expect(root(f).querySelector('h1')?.textContent).toContain('Hola, Marcelo.');
    });

    it('sin nombre, el título es genérico', async () => {
      const f = await montar(['SUPERADMIN'], null);

      expect(root(f).querySelector('h1')?.textContent?.trim()).toBe('¿A qué portal desea entrar?');
    });
  });

  describe('con acceso a uno solo', () => {
    it('solo administración: va directo a «/», sin mostrar tarjetas, y reemplaza el historial', async () => {
      const f = await montar(['SECURITY_ADMIN']);

      expect(navegaciones).toEqual([{ url: '/', extras: { replaceUrl: true } }]);
      expect(root(f).querySelectorAll('a.opcion').length).toBe(0);
    });

    it('solo reportería: va directo a «/reports»', async () => {
      const f = await montar(['REPORT_VIEWER']);

      expect(navegaciones).toEqual([{ url: '/reports', extras: { replaceUrl: true } }]);
      expect(root(f).querySelectorAll('a.opcion').length).toBe(0);
    });
  });

  describe('sin acceso a ninguno', () => {
    it('dice que falta un rol y a quién pedirlo, sin redirigir', async () => {
      const f = await montar(['PATIENT']);

      const noAccess = root(f).querySelector('[data-testid="portal-no-access"]');
      expect(noAccess?.textContent).toContain('no tiene acceso a ningún portal');
      expect(noAccess?.textContent).toContain('administra su organización');
      expect(navegaciones).toEqual([]);
      expect(root(f).querySelectorAll('a.opcion').length).toBe(0);
    });

    it('una sesión sin roles también cae en «sin permiso»', async () => {
      const f = await montar([]);

      expect(root(f).querySelector('[data-testid="portal-no-access"]')).not.toBeNull();
    });
  });

  it('si los roles cambian en caliente, la pantalla sigue a la sesión', async () => {
    const f = await montar(['PATIENT']);
    expect(root(f).querySelector('[data-testid="portal-no-access"]')).not.toBeNull();

    roles.set(['SECURITY_ADMIN', 'BUSINESS_ADMIN']);
    f.detectChanges();

    expect(root(f).querySelectorAll('a.opcion').length).toBe(2);
  });
});

describe('PortalSelector · tercera tarjeta (AloVida Insights)', () => {
  async function montarCon(roles: readonly string[]) {
    await TestBed.configureTestingModule({
      imports: [PortalSelector],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roles: signal(roles), displayName: signal(null) } },
      ],
    }).compileComponents();
    TestBed.inject(Router).navigateByUrl = (() => Promise.resolve(true)) as Router['navigateByUrl'];
    const fixture = TestBed.createComponent(PortalSelector);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('PLATFORM_ADMIN ve tres tarjetas, y la de Insights lleva a su módulo', async () => {
    const el = await montarCon(['PLATFORM_ADMIN']);

    const insights = el.querySelector<HTMLAnchorElement>('[data-testid="portal-insights"]');
    expect(el.querySelectorAll('a.opcion').length).toBe(3);
    expect(insights?.getAttribute('href')).toBe('/insights');
    expect(insights?.querySelector('h2')?.textContent).toContain('AloVida Insights');
    expect(insights?.textContent).toContain('Datos de ejemplo');
    expect(el.querySelector('.selector__ayuda')?.textContent).toContain('a los tres');
  });

  it('NEGATIVO: BUSINESS_ADMIN no ve la tarjeta de Insights (es de plataforma)', async () => {
    const el = await montarCon(['BUSINESS_ADMIN']);

    expect(el.querySelector('[data-testid="portal-insights"]')).toBeNull();
  });

  it('administración e Insights sin reportería: dos tarjetas, sin la de reportería', async () => {
    const el = await montarCon(['DATA_PLATFORM_ADMIN']);

    expect(el.querySelector('[data-testid="portal-reporteria"]')).toBeNull();
    expect(el.querySelector('[data-testid="portal-insights"]')).not.toBeNull();
    expect(el.querySelectorAll('a.opcion').length).toBe(2);
  });

  it('SUPERADMIN también la ve', async () => {
    const el = await montarCon(['SUPERADMIN']);

    expect(el.querySelector('[data-testid="portal-insights"]')).not.toBeNull();
  });

  it('NEGATIVO: quien elige entre administración y reportería pero no tiene rol de marketing no ve la tarjeta', async () => {
    const el = await montarCon(['SECURITY_ADMIN', 'REPORTING_ADMIN']);

    expect(el.querySelector('[data-testid="portal-insights"]')).toBeNull();
    expect(el.querySelectorAll('a.opcion').length).toBe(2);
    expect(el.querySelector('.selector__ayuda')?.textContent).toContain('a los dos');
  });
});
