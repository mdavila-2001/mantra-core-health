import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { DirectoriesOverview } from './directories-overview';

@Component({ template: '' })
class Vacio {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('DirectoriesOverview', () => {
  let fixture: ComponentFixture<DirectoriesOverview>;
  let session: SessionStore;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function abrirSesion(roles: readonly string[], tenants: readonly string[] = ['t-1']) {
    session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants }), refreshToken: 'r' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });

    session = TestBed.inject(SessionStore);
    session.clear();
    const router = TestBed.inject(Router);
    void router.navigateByUrl('/directories');
  });

  function crear(): void {
    fixture = TestBed.createComponent(DirectoriesOverview);
    fixture.detectChanges();
  }

  it('un paciente ve los cuatro directorios, cada uno con su descripción y su enlace', () => {
    abrirSesion(['PATIENT']);
    crear();

    const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.directories-overview__nodo')];
    expect(enlaces.length).toBe(4);

    const medicos = enlaces.find((enlace) => enlace.getAttribute('href') === '/directory');
    expect(medicos).toBeDefined();
    expect(medicos?.textContent).toContain('Directorio de médicos');
    expect(medicos?.textContent).toContain('agrupados por especialidad');
  });

  it('quien ejerce no ve el nodo de la guía de médicos, exclusiva del paciente', () => {
    abrirSesion(['PRACTITIONER']);
    crear();

    const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.directories-overview__nodo')];
    expect(enlaces.some((enlace) => enlace.getAttribute('href') === '/directory')).toBe(false);
    expect(enlaces.length).toBe(3);
  });

  it('el nodo central es decorativo: no es un enlace ni compite con los cuatro', () => {
    abrirSesion(['PATIENT']);
    crear();

    const centro = root().querySelector('.directories-overview__centro');
    expect(centro?.getAttribute('aria-hidden')).toBe('true');
    expect(centro?.querySelector('a')).toBeNull();
  });
});
