import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PractitionerProfileEdit } from './practitioner-profile-edit';

/**
 * Configurar el perfil profesional.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Sólo se manda lo que cambió.** Un `PATCH` con los cuatro campos siempre
 *    funcionaría, pero mandar sólo el cambio es lo que hace que el registro de
 *    auditoría del backend diga qué tocó la persona, no que reescribió todo.
 * 2. **Especialidad y matrícula se agregan, nunca se editan.** Cada envío es un
 *    `POST` independiente del `PATCH` de presentación.
 * 3. **Sin nada que agregar, el botón queda deshabilitado.**
 */

const PERFIL_BASE = {
  profileId: 'per-1',
  personId: 'per-1',
  practitionerCode: 'MED-7',
  displayName: 'Dra. Salas',
  professionalTitle: 'Cardióloga',
  professionalBio: 'Bio actual.',
  photoFileId: null,
  practitionerCategoryConceptId: 'cat-1',
  verificationStatusConceptId: 'st-1',
  practiceStatusConceptId: 'st-2',
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [],
  credentials: [],
  licenses: [],
  languages: [],
  affiliations: [],
  activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
  createdAt: '2024-02-01T00:00:00.000Z',
};

describe('PractitionerProfileEdit', () => {
  let componente: PractitionerProfileEdit;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montarYCargar(perfil: object = {}): void {
    componente = TestBed.createComponent(PractitionerProfileEdit).componentInstance;
    http
      .expectOne('/profiles/practitioners/me/summary')
      .flush({ ...PERFIL_BASE, ...perfil });
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**.
   *
   * `interno` liga las funciones al componente, y `bind` devuelve una función
   * nueva que no conserva las propiedades de la original: la señal ligada se
   * puede leer pero pierde su `.set`.
   */
  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  it('siembra el formulario con lo ya guardado', () => {
    montarYCargar();

    expect(interno<() => string>('titulo')()).toBe('Cardióloga');
    expect(interno<() => string>('bio')()).toBe('Bio actual.');
    expect(interno<() => boolean>('aceptaNuevos')()).toBe(true);
  });

  /**
   * Un `PATCH` con los cuatro campos siempre funcionaría; mandar sólo el
   * cambio es lo que hace que el registro de auditoría diga qué se tocó.
   */
  it('guardarPresentacion manda sólo el campo que cambió', () => {
    montarYCargar();

    señal<string>('titulo').set('Cardióloga intervencionista');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ professionalTitle: 'Cardióloga intervencionista' });
    req.flush({ ...PERFIL_BASE, professionalTitle: 'Cardióloga intervencionista' });
  });

  it('sin cambios, guardarPresentacion no manda ninguna petición', () => {
    montarYCargar();

    interno<() => void>('guardarPresentacion')();

    http.expectNone('/profiles/practitioners/me');
  });

  it('un booleano que vuelve a false también se detecta como cambio', () => {
    montarYCargar({ acceptsNewPatients: true });

    señal<boolean>('aceptaNuevos').set(false);
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ acceptsNewPatients: false });
    req.flush(PERFIL_BASE);
  });

  /* ---- especialidades: sólo se agregan ------------------------------------- */

  it('el botón de agregar especialidad exige haber elegido una', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(false);

    señal<string>('nuevaEspecialidad').set('esp-cardio');
    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(true);
  });

  it('agregarEspecialidad hace un POST y recarga el perfil', () => {
    montarYCargar();
    señal<string>('nuevaEspecialidad').set('esp-cardio');
    señal<boolean>('nuevaEspecialidadPrincipal').set(true);

    interno<() => void>('agregarEspecialidad')();

    const req = http.expectOne('/profiles/practitioners/per-1/specialties');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      specialtyConceptId: 'esp-cardio',
      isPrimary: true,
      boardCertified: false,
    });
    req.flush({ id: 'sp-1' });

    // Recarga: el perfil se vuelve a pedir entero.
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  /* ---- matrículas: sólo se agregan ------------------------------------------ */

  it('el botón de agregar matrícula exige un número', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarMatricula')()).toBe(false);

    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    expect(interno<() => boolean>('puedeAgregarMatricula')()).toBe(true);
  });

  it('agregarMatricula hace un POST y recarga el perfil', () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<string>('nuevaAutoridad').set('Colegio Médico');

    interno<() => void>('agregarMatricula')();

    const req = http.expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      licenseNumber: 'LIC-9',
      regulatoryAuthority: 'Colegio Médico',
    });
    req.flush({ id: 'ja-1' });

    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });
});
