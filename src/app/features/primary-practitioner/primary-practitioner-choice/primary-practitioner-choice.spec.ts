import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrimaryPractitionerChoice } from './primary-practitioner-choice';

const URL = '/profiles/patients/me/primary-practitioner';
const ESTE = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

const eleccion = (id: string, nombre: string) => ({
  current: { practitionerProfileId: id, displayName: nombre, since: '2026-10-28T12:00:00.000Z' },
});

describe('PrimaryPractitionerChoice', () => {
  let fixture: ComponentFixture<PrimaryPractitionerChoice>;
  let http: HttpTestingController;

  function montar(acepta: boolean | undefined = true): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PrimaryPractitionerChoice);
    fixture.componentRef.setInput('practitionerProfileId', ESTE);
    fixture.componentRef.setInput('acceptsNewPatients', acepta);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const host = () => fixture.nativeElement as HTMLElement;
  const porId = (id: string) => host().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const pulsar = (id: string) => {
    porId(id)!.click();
    fixture.detectChanges();
  };

  it('sin médico de cabecera ofrece un único botón para elegirlo, con la explicación', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush({ current: null });
    fixture.detectChanges();

    expect(porId('medico-cabecera-elegir')?.textContent).toContain('Elegir como mi médico de cabecera');
    expect(host().textContent).toContain('profesional de confianza');
    expect(porId('medico-cabecera-quitar')).toBeNull();
  });

  it('al elegir manda el PUT y pinta lo que la API devolvió', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush({ current: null });
    fixture.detectChanges();

    pulsar('medico-cabecera-elegir');
    const put = http.expectOne({ method: 'PUT', url: URL });
    expect(put.request.body).toEqual({ practitionerProfileId: ESTE });
    put.flush(eleccion(ESTE, 'Carla Gutiérrez'));
    fixture.detectChanges();

    expect(porId('medico-cabecera-es-este')?.textContent).toContain('Es su médico de cabecera');
    expect(porId('medico-cabecera-aviso')?.textContent).toContain('Carla Gutiérrez es ahora su médico de cabecera');
    expect(porId('medico-cabecera-quitar')).not.toBeNull();
  });

  it('si ya es éste, ofrece dejar de tenerlo y al quitarlo manda el DELETE', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush(eleccion(ESTE, 'Carla Gutiérrez'));
    fixture.detectChanges();

    pulsar('medico-cabecera-quitar');
    http.expectOne({ method: 'DELETE', url: URL }).flush({ current: null });
    fixture.detectChanges();

    expect(porId('medico-cabecera-elegir')).not.toBeNull();
    expect(porId('medico-cabecera-aviso')?.textContent).toContain('ya no tiene médico de cabecera');
  });

  it('si tiene otro, dice quién es y que elegir a éste lo reemplaza', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush(eleccion(OTRO, 'Jorge Vargas'));
    fixture.detectChanges();

    expect(porId('medico-cabecera-actual')?.textContent).toContain('Jorge Vargas');
    expect(porId('medico-cabecera-actual')?.textContent).toContain('lo reemplaza');
    expect(porId('medico-cabecera-elegir')).not.toBeNull();
  });

  it('si el profesional no recibe pacientes nuevos, el botón se apaga y lo dice', () => {
    montar(false);
    http.expectOne({ method: 'GET', url: URL }).flush({ current: null });
    fixture.detectChanges();

    expect(porId('medico-cabecera-no-acepta')).not.toBeNull();
    // El sistema de diseño deshabilita por `aria-disabled` y corta el click.
    expect(porId('medico-cabecera-elegir')?.getAttribute('aria-disabled')).toBe('true');
    pulsar('medico-cabecera-elegir');
    http.expectNone({ method: 'PUT', url: URL });
  });

  it('un rechazo de la API se muestra con su motivo y no cambia la elección', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush({ current: null });
    fixture.detectChanges();

    pulsar('medico-cabecera-elegir');
    http
      .expectOne({ method: 'PUT', url: URL })
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'Este profesional no está aceptando pacientes nuevos.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(porId('medico-cabecera-fallo')?.textContent).toContain('no está aceptando pacientes nuevos');
    expect(porId('medico-cabecera-es-este')).toBeNull();
  });

  it('una cuenta que no es de paciente no ve el bloque', () => {
    montar();
    http
      .expectOne({ method: 'GET', url: URL })
      .flush({ code: 'NOT_FOUND', message: 'Paciente no encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(porId('medico-cabecera')).toBeNull();
  });

  it('un fallo de red ofrece reintentar', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(porId('medico-cabecera-error')).not.toBeNull();
    pulsar('medico-cabecera-reintentar');
    http.expectOne({ method: 'GET', url: URL }).flush({ current: null });
    fixture.detectChanges();
    expect(porId('medico-cabecera-elegir')).not.toBeNull();
  });
});
