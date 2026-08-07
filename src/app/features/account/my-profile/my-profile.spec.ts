import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MyProfile } from './my-profile';

/**
 * El resumen propio es la única pantalla de este lote que **no** pide rol: pide
 * identidad verificada. Por eso lo que más importa acá es el 403 — que tiene
 * que llegar como una puerta con salida, no como un muro.
 */
const ESTADO = '22222222-2222-4222-8222-222222222222';

const RESUMEN = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
};

describe('MyProfile', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function estado() {
    return interno<() => { status: string; nextAction?: { route?: string; label: string } }>(
      'resumen',
    )();
  }

  it('no manda ningún identificador: el sujeto lo resuelve la sesión', () => {
    const req = http.expectOne('/profiles/patients/me/summary');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [],
      count: 0,
      limit: 50,
    });
  });

  /**
   * La ficha del vault lo pide con estas palabras: «la vista debe ofrecer el
   * camino para verificarse, no un error seco». La pantalla no escribe una sola
   * línea sobre este caso — lo resuelve la traducción de errores, y esta prueba
   * es la que verifica que de verdad llega.
   */
  it('sin identidad verificada, el 403 llega con la puerta a verificarse', () => {
    http.expectOne('/profiles/patients/me/summary').flush(
      {
        code: 'IDENTITY_VERIFICATION_REQUIRED',
        message: 'Necesitás verificar tu identidad para continuar.',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    const actual = estado();
    expect(actual.status).toBe('forbidden');
    expect(actual.nextAction?.route).toBe('/identidad/verificar');
  });

  it('un 403 corriente NO ofrece salida: no hay nada que la persona pueda hacer', () => {
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'FORBIDDEN', message: 'No tenés acceso a este recurso.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    const actual = estado();
    expect(actual.status).toBe('forbidden');
    // Inventar una acción sería mandarla a un lugar donde tampoco va a poder.
    expect(actual.nextAction).toBeUndefined();
  });

  it('traduce el estado de la persona a palabras', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [{ conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' }],
      count: 1,
      limit: 50,
    });
    fixture.detectChanges();

    expect(interno<() => string>('estado')()).toBe('Activa');
  });

  it('si el catálogo falla, el resumen se muestra igual y sin uuid a la vista', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(estado().status).toBe('ready');
    expect(interno<() => string>('estado')()).toBe('Sin determinar');
  });
});
