import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { UiVisibilityService } from './ui-visibility.service';
import { AppVisible } from './visible.directive';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

@Component({
  selector: 'app-anfitrion',
  imports: [AppVisible],
  template: `
    <section *appVisible="clave()" data-testid="bloque">Contenido</section>
    <p *appVisible="'dashboard.otro'; else alternativa" data-testid="con-else">Con alternativa</p>
    <ng-template #alternativa><em data-testid="alternativa">No disponible</em></ng-template>
  `,
})
class Anfitrion {
  readonly clave = signal('dashboard.today-agenda');
}

describe('AppVisible (*appVisible)', () => {
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    TestBed.inject(UiVisibilityService).start();
  });

  afterEach(() => http.verify());

  async function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    return fixture;
  }
  const el = (f: { nativeElement: unknown }, id: string): Element | null =>
    (f.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function abrirSesion(): void {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'] }), refreshToken: 'r' });
  }

  it('sin sesión (sin reglas) muestra el contenido: se falla abierto', async () => {
    const fixture = await montar();
    expect(el(fixture, 'bloque')).not.toBeNull();
    expect(el(fixture, 'con-else')).not.toBeNull();
    expect(el(fixture, 'alternativa')).toBeNull();
  });

  it('una clave oculta NO se crea en el DOM (no es un display:none)', async () => {
    const fixture = await montar();
    abrirSesion();
    await fixture.whenStable();
    http.expectOne('/me/ui-visibility').flush({
      hiddenKeys: ['dashboard.today-agenda'],
      version: 'v1',
      generatedAt: '2026-10-31T10:00:00Z',
    });
    await fixture.whenStable();

    expect(el(fixture, 'bloque')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Contenido');
  });

  it('dibuja la alternativa (else) cuando la clave está oculta, y nada si no hay else', async () => {
    const fixture = await montar();
    abrirSesion();
    await fixture.whenStable();
    http.expectOne('/me/ui-visibility').flush({
      hiddenKeys: ['dashboard.otro', 'dashboard.today-agenda'],
      version: 'v1',
      generatedAt: '2026-10-31T10:00:00Z',
    });
    await fixture.whenStable();

    expect(el(fixture, 'con-else')).toBeNull();
    expect(el(fixture, 'alternativa')).not.toBeNull();
    expect(el(fixture, 'bloque')).toBeNull();
  });

  it('es reactivo: al cambiar la clave o las reglas, aparece o desaparece', async () => {
    const fixture = await montar();
    abrirSesion();
    await fixture.whenStable();
    http.expectOne('/me/ui-visibility').flush({
      hiddenKeys: ['dashboard.today-agenda'],
      version: 'v1',
      generatedAt: '2026-10-31T10:00:00Z',
    });
    await fixture.whenStable();
    expect(el(fixture, 'bloque')).toBeNull();

    fixture.componentInstance.clave.set('dashboard.consultations-summary');
    await fixture.whenStable();
    expect(el(fixture, 'bloque')).not.toBeNull();
  });

  it('si el pedido falla no oculta nada', async () => {
    const fixture = await montar();
    abrirSesion();
    await fixture.whenStable();
    http.expectOne('/me/ui-visibility').flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });
    await fixture.whenStable();
    expect(el(fixture, 'bloque')).not.toBeNull();
  });
});
