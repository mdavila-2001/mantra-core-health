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

describe('NearbyPlaces — FT-19', () => {
  let fixture: ComponentFixture<NearbyPlaces>;
  let http: HttpTestingController;
  let session: SessionStore;

  function abrirSesionPaciente(pid = 'patient-1'): void {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], pid }), refreshToken: 'r' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NearbyPlaces],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(NearbyPlaces);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  it('sin sesión de paciente, no pide el resumen clínico', () => {
    fixture.detectChanges();
    // http.verify() confirma que no salió ningún GET a /clinical/patients/*.
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
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Todavía no tenés recetas emitidas');
  });
});
