import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelatedPersonForm } from './related-person-form';

/**
 * V05-05 · Personas relacionadas. Lo que estas pruebas fijan no es el
 * maquetado: es que **una decisión de la persona no se confunda con una
 * ausencia** —los dos interruptores viajan siempre— y que el tutor único del
 * modelo se avise antes de gastar el viaje.
 */
const RESPUESTA = {
  id: 'rp-1',
  patientProfileId: 'pp-1',
  personId: 'p-9',
  status: 'concepto-activo',
  createdAt: '2026-08-08T03:00:00.000Z',
};

const URL = '/profiles/patients/pp-1/related-persons';

describe('RelatedPersonForm', () => {
  let fixture: ComponentFixture<RelatedPersonForm>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelatedPersonForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RelatedPersonForm);
    fixture.componentRef.setInput('profileId', 'pp-1');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function completar(nombre = 'Juan Salas') {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({ displayName: nombre });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  /**
   * El contrato no exige el nombre, pero la pantalla sí: un contacto de
   * emergencia sin nombre no es un contacto, es una fila.
   */
  it('sin nombre no se registra, aunque el backend lo aceptaría', () => {
    completar('');
    enviar();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('manda el nombre recortado', () => {
    completar('  Juan Salas  ');
    enviar();

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as { displayName: string }).displayName).toBe('Juan Salas');

    req.flush(RESPUESTA);
  });

  /**
   * El contrato los declara con `default: false`, pero omitirlos deja que el
   * valor lo decida el servidor. Acá la persona ya decidió, y «no es tutor» es
   * una decisión, no una ausencia.
   */
  it('los dos interruptores viajan siempre, también en falso', () => {
    completar();
    enviar();

    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({
      displayName: 'Juan Salas',
      isEmergencyContact: false,
      isLegalGuardian: false,
    });

    req.flush(RESPUESTA);
  });

  it('manda los roles que se hayan marcado', () => {
    completar();
    crudo<{ set: (v: boolean) => void }>('esContactoDeEmergencia').set(true);
    crudo<{ set: (v: boolean) => void }>('esTutorLegal').set(true);
    enviar();

    const req = http.expectOne(URL);
    expect(req.request.body).toMatchObject({ isEmergencyContact: true, isLegalGuardian: true });

    req.flush(RESPUESTA);
  });

  it('la fecha de nacimiento viaja en hora local, no convertida a UTC', () => {
    completar();
    crudo<{ set: (v: Date) => void }>('fechaDeNacimiento').set(new Date(1978, 0, 1, 0, 0, 0));
    enviar();

    const req = http.expectOne(URL);
    // `toISOString()` habría mandado 1977-12-31 al oeste de Greenwich.
    expect((req.request.body as { birthDate?: string }).birthDate).toBe('1978-01-01');

    req.flush(RESPUESTA);
  });

  it('sin fecha, la clave no viaja', () => {
    completar();
    enviar();

    const req = http.expectOne(URL);
    expect(Object.keys(req.request.body as object)).not.toContain('birthDate');

    req.flush(RESPUESTA);
  });

  /* ---- el tutor único del modelo ------------------------------------------ */

  it('avisa del tutor duplicado y no deja enviar', () => {
    fixture.componentRef.setInput('yaTieneTutor', true);
    completar();
    crudo<{ set: (v: boolean) => void }>('esTutorLegal').set(true);
    fixture.detectChanges();

    expect(interno<() => boolean>('conflictoDeTutor')()).toBe(true);

    enviar();
    // `http.verify()` comprueba que no salió la petición.
  });

  it('con un tutor ya registrado, un contacto que NO es tutor se registra igual', () => {
    fixture.componentRef.setInput('yaTieneTutor', true);
    completar();
    fixture.detectChanges();

    expect(interno<() => boolean>('conflictoDeTutor')()).toBe(false);

    enviar();
    http.expectOne(URL).flush(RESPUESTA);
  });

  /* ---- después de registrar ----------------------------------------------- */

  it('al registrar avisa hacia afuera y limpia el formulario', () => {
    let avisos = 0;
    fixture.componentInstance.registered.subscribe(() => (avisos += 1));

    completar();
    crudo<{ set: (v: boolean) => void }>('esContactoDeEmergencia').set(true);
    enviar();
    http.expectOne(URL).flush(RESPUESTA);

    expect(avisos).toBe(1);
    // Limpio de verdad: el siguiente contacto no hereda los roles del anterior.
    expect(interno<() => boolean>('esContactoDeEmergencia')()).toBe(false);
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    completar();
    enviar();
    enviar();

    // `expectOne` falla si hubo dos.
    http.expectOne(URL).flush(RESPUESTA);
  });

  it('un fallo de red se traduce a un mensaje, no a un silencio', () => {
    completar();
    enviar();
    http.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(interno<() => string | null>('errorMessage')()).toContain('conectarnos');
  });
});
