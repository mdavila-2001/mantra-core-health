import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';
import { esperarSinViolaciones } from '../../../../testing/a11y';
import { nameExtraControl } from '../../auth/shared-registration/name-fields/person-name';
import { PractitionerAssistedRegistration } from './practitioner-assisted-registration';

/**
 * Acá se crea una cuenta **a nombre de otro médico**: las pruebas cubren lo que
 * eso obliga —que no viaje contraseña, que el motivo sea obligatorio, que el
 * código se muestre una sola vez y que la matrícula se anuncie pendiente—.
 */
const URL = '/iam/users/assisted-practitioner-registration';

const opcion = (conceptId: string, display: string): ValueSetOption =>
  ({ conceptId, code: display.toUpperCase(), display, codeSystemVersionId: 'v1' }) as ValueSetOption;

const RESPUESTA = {
  userId: 'u-9',
  personId: 'p-9',
  practitionerProfileId: 'pp-9',
  practitionerCode: 'DOC-0001',
  licenseId: 'l-9',
  verificationStatus: 'PENDING',
  activationToken: 'tok-doc-123',
  activationExpiresAt: '2026-08-05T14:30:00Z',
  clinicalRoles: ['CLINICIAN'],
};

describe('PractitionerAssistedRegistration', () => {
  let fixture: ComponentFixture<PractitionerAssistedRegistration>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PractitionerAssistedRegistration],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BoDepartmentsCatalog, useValue: { listar: () => of([opcion('d-lp', 'La Paz')]) } },
        {
          provide: MedicalSpecialtiesCatalog,
          useValue: { listar: () => of([opcion('s-1', 'Cardiología'), opcion('s-2', 'Pediatría')]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PractitionerAssistedRegistration);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function completar(reason = 'Está de viaje y no puede registrarse por sí mismo') {
    interno<{ patchValue: (v: unknown) => void }>('form').patchValue({
      doctorName: { name: 'Luis', lastName: 'Rojas' },
      email: 'luis@mantra.test',
      nationalId: '1234567',
      issuerDepartment: 'd-lp',
      licenseNumber: 'MP-998',
      reason,
    });
  }

  const enviar = () => interno<() => void>('submit')();
  const estado = () => interno<() => { status: string }>('state')().status;

  it('sin motivo no se registra a nadie y se lleva a quien lee a la pestaña del error', () => {
    completar('');
    enviar();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(estado()).toBe('ready');
    expect(interno<() => number>('pestana')()).toBe(2);
  });

  it('con la matrícula vacía la pestaña del error es «Documento y matrícula»', () => {
    completar();
    interno<{ patchValue: (v: unknown) => void }>('form').patchValue({ licenseNumber: '' });
    enviar();

    expect(interno<() => number>('pestana')()).toBe(1);
  });

  it('el cuerpo lleva el motivo y el rol por defecto, y NO lleva contraseña', () => {
    completar();
    enviar();

    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({
      email: 'luis@mantra.test',
      name: 'Luis',
      lastName: 'Rojas',
      licenseNumber: 'MP-998',
      nationalId: '1234567',
      issuerAdministrativeAreaConceptId: 'd-lp',
      clinicalRoles: ['CLINICIAN'],
      reason: 'Está de viaje y no puede registrarse por sí mismo',
    });
    expect(req.request.body).not.toHaveProperty('password');
    req.flush(RESPUESTA);
  });

  it('las especialidades elegidas viajan sin vacías ni repetidas y los nombres agregados se pliegan en middleName', () => {
    completar();
    // Una casilla vacía y una repetida no viajan: el contrato las toma como conceptos distintos.
    fixture.componentInstance['especialidades'].set(['s-1', '', 's-2', 's-1']);
    const nombre = fixture.componentInstance['form'].controls.doctorName;
    nombre.controls.middleName.setValue('Andrés');
    nombre.controls.extraNames.push(nameExtraControl());
    nombre.controls.extraNames.at(0).setValue('Pablo');
    enviar();

    const req = http.expectOne(URL);
    expect(req.request.body.specialtyConceptIds).toEqual(['s-1', 's-2']);
    expect(req.request.body.middleName).toBe('Andrés Pablo');
    req.flush(RESPUESTA);
  });

  it('un segundo envío en vuelo no crea un segundo médico', () => {
    completar();
    enviar();
    enviar();

    http.expectOne(URL).flush(RESPUESTA);
  });

  it('muestra el código una vez, su caducidad local y que la matrícula queda pendiente', () => {
    completar();
    enviar();
    http.expectOne(URL).flush(RESPUESTA);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const texto = el.textContent ?? '';
    expect(el.querySelector('[data-testid="alta-medico-token"]')?.textContent).toContain('tok-doc-123');
    expect(el.querySelector('[data-testid="alta-medico-form"]')).toBeNull();
    expect(texto).toContain('una sola vez');
    expect(texto).toContain('No es una contraseña ni la reemplaza');
    expect(texto).toContain('05/08/2026');
    expect(el.querySelector('[data-testid="alta-medico-matricula"]')?.textContent).toContain('PENDING');
    expect(texto).toContain('no habilita al médico a recetar');
  });

  it('un 409 por correo repetido se señala en el campo y conserva lo escrito', () => {
    completar();
    enviar();
    http
      .expectOne(URL)
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'Ya existe una cuenta con ese correo' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(estado()).not.toBe('ready');
    expect(fixture.nativeElement.textContent as string).toContain('Ya existe una cuenta con ese correo');
    expect(interno<{ getRawValue: () => { email: string } }>('form').getRawValue().email).toBe(
      'luis@mantra.test',
    );
  });

  it('«Registrar otro médico» vacía el formulario y saca el código de la vista', () => {
    completar();
    enviar();
    http.expectOne(URL).flush(RESPUESTA);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="alta-medico-otra"]') as HTMLElement).click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="alta-medico-token"]')).toBeNull();
    expect(el.querySelector('[data-testid="alta-medico-form"]')).not.toBeNull();
    expect(interno<{ getRawValue: () => { email: string } }>('form').getRawValue().email).toBe('');
  });

  it('el formulario no tiene violaciones mecánicas de accesibilidad', async () => {
    await esperarSinViolaciones(fixture.nativeElement as HTMLElement);
    // axe sobre la tarjeta completa pasa de los 5 s por defecto con la suite entera en paralelo.
  }, 30_000);

  it('el resultado, con el código, no tiene violaciones mecánicas de accesibilidad', async () => {
    completar();
    enviar();
    http.expectOne(URL).flush(RESPUESTA);
    fixture.detectChanges();

    await esperarSinViolaciones(fixture.nativeElement as HTMLElement);
  }, 30_000);
});

describe('PractitionerAssistedRegistration · especialidades', () => {
  it('no deja pasar de cuatro casillas', async () => {
    await TestBed.configureTestingModule({
      imports: [PractitionerAssistedRegistration],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BoDepartmentsCatalog, useValue: { listar: () => of([]) } },
        { provide: MedicalSpecialtiesCatalog, useValue: { listar: () => of([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PractitionerAssistedRegistration);
    const c = fixture.componentInstance as unknown as {
      agregarEspecialidad: () => void;
      especialidades: () => readonly string[];
    };
    for (let i = 0; i < 6; i += 1) c.agregarEspecialidad();
    expect(c.especialidades()).toHaveLength(4);
  });
});
