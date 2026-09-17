import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { NearbyPlaces } from './nearby-places';

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

/** El mínimo que pide `OwnPatientProfile`: los campos requeridos, nada más. */
function perfilCon(homeAddress?: unknown, workAddress?: unknown) {
  return {
    personId: 'person-1',
    patientProfileId: 'patient-1',
    identityVerified: false,
    homeAddress,
    workAddress,
  };
}

describe('NearbyPlaces — FT-19', () => {
  let fixture: ComponentFixture<NearbyPlaces>;
  let http: HttpTestingController;
  let session: SessionStore;
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  function abrirSesionPaciente(pid = 'patient-1'): void {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], pid }), refreshToken: 'r' });
  }

  /** Selecciona la pestaña por índice, como haría un clic sobre `role="tab"`. */
  function elegirPestana(indice: number): void {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLButtonElement>('[role="tab"]')[indice].click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    TestBed.configureTestingModule({
      imports: [NearbyPlaces],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(NearbyPlaces);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  it('sin sesión de paciente, no pide el resumen clínico ni el perfil', () => {
    fixture.detectChanges();
    // http.verify() confirma que no salió ningún GET a /clinical/patients/* ni
    // a /profiles/patients/me.
  });

  it('con receta emitida, lista el medicamento y enlaza a WhereToBuy', () => {
    abrirSesionPaciente();
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/clinical/patients/patient-1/summary');
    req.flush({
      conditions: [],
      allergies: [],
      medicationRequests: [
        {
          id: 'med-1',
          medicationConceptId: 'concept-1',
          statusConceptId: 'active',
          issuedAt: '2026-09-01T00:00:00.000Z',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      observations: [],
      encounters: [],
    });

    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [{ conceptId: 'concept-1', display: 'Amoxicilina 500mg' }],
      total: 1,
    });
    http.expectOne('/profiles/patients/me').flush(perfilCon());

    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const enlace = root.querySelector<HTMLAnchorElement>(
      'a[href="/my-account/medical-record/where-to-buy/med-1"]',
    );
    expect(enlace?.textContent).toContain('Ver farmacias cercanas');
    expect(root.textContent).toContain('Amoxicilina 500mg');
  });

  it('sin recetas emitidas, ofrece ir a la historia clínica', () => {
    abrirSesionPaciente();
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/clinical/patients/patient-1/summary').flush({
      conditions: [],
      allergies: [],
      medicationRequests: [],
      observations: [],
      encounters: [],
    });
    http.expectOne('/profiles/patients/me').flush(perfilCon());
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Todavía no tenés recetas emitidas');
  });

  /**
   * FT-19 · B.2 — el domicilio guardado alimenta la búsqueda de proximidad
   * sin pasar por el GPS del navegador.
   */
  describe('el origen ya no depende sólo del GPS', () => {
    function abrirEnImagenologia(perfil: ReturnType<typeof perfilCon>): void {
      abrirSesionPaciente();
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/clinical/patients/patient-1/summary').flush({
        conditions: [],
        allergies: [],
        medicationRequests: [],
        observations: [],
        encounters: [],
      });
      http.expectOne('/profiles/patients/me').flush(perfil);
      fixture.detectChanges();
      elegirPestana(1);
    }

    it('con casa guardada, Imagenología consulta con sus coordenadas sin pedir el GPS', () => {
      abrirEnImagenologia(perfilCon({ lines: 'Casa', latitude: -17.78, longitude: -63.18 }));

      const req = http.expectOne(
        (r) => r.url === '/public/nearby' && r.params.get('kind') === 'DIAGNOSTIC_UNIT',
      );
      expect(req.request.params.get('lat')).toBe('-17.78');
      expect(req.request.params.get('lng')).toBe('-63.18');
      expect(getCurrentPosition).not.toHaveBeenCalled();
      req.flush({ items: [], nextCursor: null, totalHint: 0, generatedAt: '2026-09-16T00:00:00.000Z' });
    });

    it('sin lugares guardados, no consulta hasta elegir «Ubicación actual»', () => {
      abrirEnImagenologia(perfilCon());

      http.expectNone((r) => r.url === '/public/nearby');
      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('Elegí desde dónde buscar');
      expect(root.querySelector('[data-testid="search-origin-current-only"]')).not.toBeNull();
    });

    it('el perfil en error deja sólo «Ubicación actual», sin romper la pantalla', () => {
      abrirSesionPaciente();
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/clinical/patients/patient-1/summary').flush({
        conditions: [],
        allergies: [],
        medicationRequests: [],
        observations: [],
        encounters: [],
      });
      http.expectOne('/profiles/patients/me').error(new ProgressEvent('error'), { status: 500 });
      fixture.detectChanges();
      elegirPestana(1);

      http.expectNone((r) => r.url === '/public/nearby');
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-testid="search-origin-current-only"]')).not.toBeNull();
    });
  });
});
