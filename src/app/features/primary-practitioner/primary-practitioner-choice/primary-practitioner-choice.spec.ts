import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrimaryPractitionerChoice } from './primary-practitioner-choice';

const URL = '/profiles/patients/me/primary-practitioner';
const ESTE = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

const eleccion = (id: string, name: string) => ({
  current: { practitionerProfileId: id, displayName: name, since: '2026-10-28T12:00:00.000Z' },
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
  const byTestId = (id: string) => host().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const pulsar = (id: string) => {
    byTestId(id)!.click();
    fixture.detectChanges();
  };
  const botonConTexto = (texto: string) =>
    Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    );
  const leer = (cuerpo: object | string | null, opciones?: { status: number; statusText: string }) => {
    http.expectOne({ method: 'GET', url: URL }).flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  it('sin médico de cabecera ofrece un único botón para elegirlo, con la explicación', () => {
    montar();
    leer({ current: null });

    expect(byTestId('primary-doctor-elegir')?.textContent).toContain('Elegir como mi médico de cabecera');
    expect(host().textContent).toContain('profesional de confianza');
    expect(byTestId('primary-doctor-quitar')).toBeNull();
  });

  it('al elegir manda el PUT, pinta lo que la API devolvió y deja el foco en el botón nuevo', async () => {
    montar();
    leer({ current: null });

    pulsar('primary-doctor-elegir');
    const put = http.expectOne({ method: 'PUT', url: URL });
    expect(put.request.body).toEqual({ practitionerProfileId: ESTE });
    put.flush(eleccion(ESTE, 'Carla Gutiérrez'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(byTestId('primary-doctor-es-este')?.textContent).toContain('Es su médico de cabecera');
    expect(byTestId('primary-doctor-aviso')?.textContent).toContain('Carla Gutiérrez es ahora su médico de cabecera');
    expect(document.activeElement).toBe(byTestId('primary-doctor-quitar'));
  });

  it('si ya es éste, ofrece dejar de tenerlo y al quitarlo manda el DELETE', () => {
    montar();
    leer(eleccion(ESTE, 'Carla Gutiérrez'));

    pulsar('primary-doctor-quitar');
    http.expectOne({ method: 'DELETE', url: URL }).flush({ current: null });
    fixture.detectChanges();

    expect(byTestId('primary-doctor-elegir')).not.toBeNull();
    expect(byTestId('primary-doctor-aviso')?.textContent).toContain('ya no tiene médico de cabecera');
  });

  it('si tiene otro, dice quién es y que elegir a éste lo reemplaza', () => {
    montar();
    leer(eleccion(OTRO, 'Jorge Vargas'));

    expect(byTestId('primary-doctor-actual')?.textContent).toContain('Jorge Vargas');
    expect(byTestId('primary-doctor-actual')?.textContent).toContain('lo reemplaza');
    expect(byTestId('primary-doctor-elegir')).not.toBeNull();
  });

  it('si el profesional no recibe pacientes nuevos, el botón se apaga y lo dice', () => {
    montar(false);
    leer({ current: null });

    expect(byTestId('primary-doctor-no-acepta')).not.toBeNull();
    // El sistema de diseño deshabilita por `aria-disabled` y corta el click.
    expect(byTestId('primary-doctor-elegir')?.getAttribute('aria-disabled')).toBe('true');
    pulsar('primary-doctor-elegir');
    http.expectNone({ method: 'PUT', url: URL });
  });

  it('un 422 de la API se muestra con su motivo y no cambia la elección', () => {
    montar();
    leer({ current: null });

    pulsar('primary-doctor-elegir');
    http
      .expectOne({ method: 'PUT', url: URL })
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'Este profesional no está aceptando pacientes nuevos.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(byTestId('primary-doctor-fallo')?.textContent).toContain('no está aceptando pacientes nuevos');
    expect(byTestId('primary-doctor-es-este')).toBeNull();
  });

  it('un 409 (la elección cambió en otra pestaña) avisa y relee para no quedar con datos viejos', () => {
    montar();
    leer({ current: null });

    pulsar('primary-doctor-elegir');
    http
      .expectOne({ method: 'PUT', url: URL })
      .flush(
        { code: 'CONFLICT', message: 'Su médico de cabecera cambió mientras lo elegía. Vuelva a intentarlo.' },
        { status: 409, statusText: 'Conflict' },
      );
    leer(eleccion(OTRO, 'Jorge Vargas'));

    expect(byTestId('primary-doctor-fallo')).not.toBeNull();
    expect(byTestId('primary-doctor-actual')?.textContent).toContain('Jorge Vargas');
  });

  it('un 404 al elegir dice que el profesional ya no está disponible y relee', () => {
    montar();
    leer({ current: null });

    pulsar('primary-doctor-elegir');
    http
      .expectOne({ method: 'PUT', url: URL })
      .flush(
        { code: 'NOT_FOUND', message: 'Profesional no encontrado', reason: 'PRACTITIONER_PROFILE_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );
    leer({ current: null });

    expect(byTestId('primary-doctor-fallo')?.textContent).toContain('ya no está disponible');
  });

  it('una cuenta que no es de paciente (por su reason) no ve el bloque', () => {
    montar();
    leer(
      { code: 'NOT_FOUND', message: 'Paciente no encontrado', reason: 'PATIENT_PROFILE_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(byTestId('primary-doctor')).toBeNull();
  });

  it('un 404 sin ese reason (proxy, ruta inexistente) NO esconde la función: muestra el error', () => {
    montar();
    leer('<html>Not Found</html>', { status: 404, statusText: 'Not Found' });

    expect(byTestId('primary-doctor')).not.toBeNull();
    expect(host().textContent).toContain('Algo salió mal');
  });

  it('un error inesperado muestra el código de soporte y reintenta', () => {
    montar();
    leer(
      { code: 'INTERNAL', message: 'Error interno', correlationId: 'req-123' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(host().textContent).toContain('req-123');
    botonConTexto('Reintentar')!.click();
    fixture.detectChanges();
    leer({ current: null });
    expect(byTestId('primary-doctor-elegir')).not.toBeNull();
  });

  it('sin conexión lo dice como tal (S8)', () => {
    montar();
    http.expectOne({ method: 'GET', url: URL }).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(host().textContent).toContain('Sin conexión');
  });
});
