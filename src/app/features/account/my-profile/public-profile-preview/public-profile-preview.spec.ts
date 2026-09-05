import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { PublicProfilePreview } from './public-profile-preview';

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

/** Una vitrina guardada, tal como llega por el cable. */
const VITRINA = {
  id: 'pp-1',
  tenantId: 't-1',
  targetId: 'prac-1',
  slug: 'dra-lucia-salas',
  displayName: 'Dra. Lucía Salas',
  headline: 'Cardióloga',
  biography: 'Atiendo en La Paz.',
  acceptsReviews: true,
  visibility: 'PUBLIC',
  avatarFileId: null,
  coverFileId: null,
};

/**
 * ALV-004: esta ruta dejó de ser el segundo lugar donde se configura el
 * perfil. Lo que estas pruebas fijan es justamente eso: muestra, no edita.
 */
describe('PublicProfilePreview (sólo lectura)', () => {
  let fixture: ComponentFixture<PublicProfilePreview>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(PublicProfilePreview);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('con vitrina guardada dibuja la MISMA tarjeta que /p/:slug, sin ningún formulario', () => {
    http.expectOne('/community/profiles/me').flush(VITRINA);
    fixture.detectChanges();

    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('app-public-profile-card')).not.toBeNull();
    expect(raiz.textContent).toContain('alovida.app/p/dra-lucia-salas');
    // Ni un input, ni un form: se configura desde el perfil.
    expect(raiz.querySelector('form')).toBeNull();
    expect(raiz.querySelector('input')).toBeNull();
  });

  it('sin vitrina lo dice y manda a configurar el perfil, no ofrece crearla acá', () => {
    http.expectOne('/community/profiles/me').flush(null as never);
    fixture.detectChanges();

    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('app-public-profile-card')).toBeNull();
    expect(raiz.textContent).toContain('Lo que ven los demás');
    expect(raiz.querySelector('[data-testid="previa-configurar"]')?.getAttribute('href')).toBe(
      '/my-account/edit',
    );
  });
});
