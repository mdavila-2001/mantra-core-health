import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PatientNew } from './patient-new';

/**
 * El alta es una sola petición contra `POST /profiles/patients`: el backend crea
 * persona, perfil de persona y perfil de paciente en la misma transacción.
 *
 * Lo que estas pruebas fijan es lo que se rompe callado: los opcionales vacíos
 * que viajan como dato vacío, y la fecha que se corre un día al convertirse a
 * UTC.
 */
const RESPUESTA = {
  profileId: 'pp-9',
  personId: 'p-9',
  patientCode: 'PAC-9',
  recordLinkageStatus: 'UNLINKED',
  createdAt: '2026-08-07T12:00:00.000Z',
};

describe('PatientNew', () => {
  let fixture: ComponentFixture<PatientNew>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientNew],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Comodín: al crear el paciente la pantalla navega a su ficha, y un
        // router sin rutas convierte esa navegación en un rechazo sin atrapar
        // que ensucia la corrida entera.
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientNew);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  /**
   * Igual que {@link interno}, pero **sin enlazar**. Un signal es una función,
   * así que `bind` devuelve una copia que ya no tiene `.set`.
   */
  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function completar(valores: {
    patientCode?: string;
    displayName?: string;
    masterPatientIndexCode?: string;
  }) {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      patientCode: valores.patientCode ?? 'PAC-9',
      displayName: valores.displayName ?? '',
      masterPatientIndexCode: valores.masterPatientIndexCode ?? '',
    });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('sin código de paciente no se envía nada: es el único obligatorio', () => {
    completar({ patientCode: '' });
    enviar();

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('los opcionales vacíos no viajan: una cadena vacía no es «sin dato»', () => {
    completar({});
    enviar();

    const req = http.expectOne('/profiles/patients');
    // El backend valida con `forbidNonWhitelisted`; un opcional en blanco es un
    // dato vacío guardado, no un campo sin completar.
    expect(req.request.body).toEqual({ patientCode: 'PAC-9' });

    req.flush(RESPUESTA);
  });

  it('recorta los espacios de lo que se escribe', () => {
    completar({ patientCode: '  PAC-9  ', displayName: '  Ana Salas  ' });
    enviar();

    const req = http.expectOne('/profiles/patients');
    expect(req.request.body).toEqual({ patientCode: 'PAC-9', displayName: 'Ana Salas' });

    req.flush(RESPUESTA);
  });

  /**
   * `toISOString()` pasa por UTC antes de recortar: al oeste de Greenwich, un
   * 1 de enero elegido en el calendario se enviaría como 31 de diciembre. En
   * una fecha de nacimiento eso es un día de diferencia en el registro civil
   * de alguien.
   */
  it('la fecha de nacimiento viaja en hora local, no convertida a UTC', () => {
    completar({});
    crudo<{ set: (v: Date) => void }>('fechaDeNacimiento').set(new Date(1985, 2, 14, 0, 0, 0));
    enviar();

    const req = http.expectOne('/profiles/patients');
    expect((req.request.body as { birthDate?: string }).birthDate).toBe('1985-03-14');

    req.flush(RESPUESTA);
  });

  it('al crearlo va a su ficha, no de vuelta al listado', () => {
    const navegado: string[] = [];
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url) => {
      navegado.push(String(url));
      return Promise.resolve(true);
    });

    completar({});
    enviar();
    http.expectOne('/profiles/patients').flush(RESPUESTA);

    expect(navegado).toEqual(['/administracion/pacientes/pp-9']);
  });

  /**
   * `patientCode` es el único campo con clave única del formulario, así que un
   * conflicto sólo puede venir de él. La ficha de la vista lo pide con estas
   * palabras: «señalar el campo en conflicto, no un error genérico».
   */
  it('un 409 señala el código de paciente, no un error suelto', () => {
    completar({});
    enviar();

    http
      .expectOne('/profiles/patients')
      .flush(
        { code: 'CONFLICT', message: 'Ya existe un paciente con ese código' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(interno<() => boolean>('codigoEnConflicto')()).toBe(true);
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    completar({});
    enviar();
    enviar();

    // `expectOne` falla si hubo dos.
    http.expectOne('/profiles/patients').flush(RESPUESTA);
  });
});
