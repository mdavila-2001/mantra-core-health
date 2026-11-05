import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import { NavigationService } from '@core/navigation/navigation.service';
import { ObservabilitySistema } from './sistema';

describe('ObservabilitySistema', () => {
  let http: HttpTestingController;

  async function montar(roles: readonly string[]) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: { roles: signal(roles) } },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ObservabilitySistema);
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('una sola tarjeta con las seis pestañas para quien puede leer', async () => {
    const f = await montar(['SRE']);
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-card')).toHaveLength(1);
    const nombres = Array.from(root.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(nombres).toEqual(['Resumen', 'Errores', 'Latencia', 'Consultas SQL', 'Endpoints', 'No medido']);
    // Cada widget pide por su cuenta: el resumen pide dos lecturas.
    expect(http.match((r) => r.url.includes('/admin/observability/')).length).toBeGreaterThanOrEqual(2);
  });

  it('un rol que ningún permiso de lectura alcanza no dibuja ninguna pestaña (la API igual lo negaría)', async () => {
    const f = await montar(['PRACTITIONER']);
    expect((f.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it('SUPERADMIN pasa por comodín', async () => {
    const f = await montar(['SUPERADMIN']);
    expect((f.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).toHaveLength(6);
  });
});
