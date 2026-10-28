import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MyPrimaryPatients, PAGE_SIZE } from './my-primary-patients';

const URL = '/profiles/practitioners/me/primary-patients';

describe('MyPrimaryPatients', () => {
  let fixture: ComponentFixture<MyPrimaryPatients>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyPrimaryPatients);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const request = () => http.expectOne((r) => r.url === URL);

  it('lista a los pacientes que lo eligieron, con el total', () => {
    const req = request();
    expect(req.request.params.get('limit')).toBe(String(PAGE_SIZE));
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({
      items: [
        { patientProfileId: 'p1', displayName: 'Ana Pérez', patientCode: 'PAT-1', since: '2026-10-28T12:00:00Z' },
        { patientProfileId: 'p2', displayName: null, patientCode: 'PAT-2', since: '2026-10-01T12:00:00Z' },
      ],
      total: 2,
      limit: PAGE_SIZE,
      offset: 0,
    });
    fixture.detectChanges();

    expect(texto()).toContain('2 pacientes lo tienen como médico de cabecera.');
    expect(texto()).toContain('Ana Pérez');
    expect(texto()).toContain('Paciente sin nombre registrado');
    expect(texto()).toContain('no le da acceso a su historia clínica');
  });

  it('sin pacientes muestra el vacío con una próxima acción', () => {
    request().flush({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
    fixture.detectChanges();

    expect(texto()).toContain('Todavía ningún paciente lo eligió');
    expect(texto()).toContain('Revisar mi perfil');
  });

  it('con más de una página ofrece la siguiente', () => {
    request().flush({
      items: [{ patientProfileId: 'p1', displayName: 'Ana', since: '2026-10-28T12:00:00Z' }],
      total: PAGE_SIZE + 1,
      limit: PAGE_SIZE,
      offset: 0,
    });
    fixture.detectChanges();

    const siguiente = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((b) => b.textContent?.includes('Siguientes'))!;
    siguiente.click();
    fixture.detectChanges();
    expect(request().request.params.get('offset')).toBe(String(PAGE_SIZE));
  });

  it('al pasar de página la tabla sigue a la vista y «Anteriores» vuelve atrás', () => {
    const pageAt = (offset: number) => ({
      items: [{ patientProfileId: `p${offset}`, displayName: `Paciente ${offset}`, since: '2026-10-28T12:00:00Z' }],
      total: PAGE_SIZE + 1,
      limit: PAGE_SIZE,
      offset,
    });
    request().flush(pageAt(0));
    fixture.detectChanges();
    const boton = (texto: string) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('nav button')).find((b) =>
        b.textContent?.includes(texto),
      )!;

    boton('Siguientes').click();
    fixture.detectChanges();
    // Mientras carga, la navegación sigue en el DOM (no se pierde el foco).
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).not.toBeNull();
    request().flush(pageAt(PAGE_SIZE));
    fixture.detectChanges();
    expect(texto()).toContain(`Paciente ${PAGE_SIZE}`);

    boton('Anteriores').click();
    fixture.detectChanges();
    expect(request().request.params.get('offset')).toBe('0');
  });

  it('una cuenta sin perfil profesional ve la validación de la API, no una lista vacía', () => {
    request().flush(
      { code: 'PRECONDITION_FAILED', message: 'La cuenta no tiene perfil profesional' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(texto()).not.toContain('Todavía ningún paciente');
    expect(texto()).toContain('La cuenta no tiene perfil profesional');
  });

  it('un error inesperado muestra el código de soporte y reintenta', () => {
    request().flush({ code: 'INTERNAL', message: 'Error', correlationId: 'req-77' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('req-77');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    fixture.detectChanges();
    request().flush({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
  });
});
