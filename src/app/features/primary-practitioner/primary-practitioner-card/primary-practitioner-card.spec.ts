import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrimaryPractitionerCard } from './primary-practitioner-card';

const URL = '/profiles/patients/me/primary-practitioner';
const PRACTITIONER_ID = '11111111-1111-4111-8111-111111111111';

describe('PrimaryPractitionerCard', () => {
  let fixture: ComponentFixture<PrimaryPractitionerCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PrimaryPractitionerCard);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const host = () => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string) => host().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const leer = (cuerpo: object | string | null, opciones?: { status: number; statusText: string }) => {
    http.expectOne(URL).flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  it('con médico de cabecera muestra nombre, título, fecha y el enlace a su ficha', () => {
    leer({
      current: {
        practitionerProfileId: PRACTITIONER_ID,
        displayName: 'Carla Gutiérrez',
        professionalTitle: 'Médica general',
        since: '2026-10-28T12:00:00.000Z',
      },
    });

    expect(byTestId('mi-salud-cabecera-name')?.textContent).toContain('Carla Gutiérrez');
    expect(byTestId('mi-salud-cabecera-name')?.textContent).toContain('Médica general');
    // El nombre del mes depende del locale del TestBed; el día y el año, no.
    expect(host().textContent).toMatch(/Desde el 28 .* 2026/);
    expect(byTestId('mi-salud-cabecera-ficha')?.getAttribute('href')).toBe(`/directory/${PRACTITIONER_ID}`);
  });

  it('sin médico explica qué es y ofrece buscarlo en la guía (S3 con próxima acción)', () => {
    leer({ current: null });

    expect(byTestId('mi-salud-cabecera-vacio')).not.toBeNull();
    expect(host().textContent).toContain('profesional de confianza');
    expect(byTestId('mi-salud-cabecera-buscar')?.getAttribute('href')).toBe('/directory');
  });

  it('una cuenta sin perfil de paciente (reason de la API) no ve la tarjeta', () => {
    leer(
      { code: 'PRECONDITION_FAILED', message: 'Sin persona', reason: 'ACCOUNT_WITHOUT_LINKED_PERSON' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(byTestId('mi-salud-cabecera')).toBeNull();
  });

  it('un error muestra el código de soporte y el reintento relee', () => {
    leer({ code: 'INTERNAL', message: 'Error interno', correlationId: 'req-9' }, { status: 500, statusText: 'Error' });

    expect(host().textContent).toContain('req-9');
    Array.from(host().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    fixture.detectChanges();
    leer({ current: null });
    expect(byTestId('mi-salud-cabecera-vacio')).not.toBeNull();
  });
});
