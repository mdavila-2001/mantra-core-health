import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProfilesClient } from './profiles.client';

describe('ProfilesClient', () => {
  let client: ProfilesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ProfilesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('createPatient no manda las claves opcionales ausentes', () => {
    client.createPatient({ patientCode: 'PAC-1' }).subscribe();

    const req = http.expectOne('/profiles/patients');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ patientCode: 'PAC-1' });

    req.flush({
      profileId: 'pp',
      personId: 'p',
      patientCode: 'PAC-1',
      recordLinkageStatus: 'UNLINKED',
      createdAt: '2026-07-31T12:00:00.000Z',
    });
  });

  it('createPatient convierte createdAt en fecha', () => {
    let creado: Date | undefined;
    client
      .createPatient({ patientCode: 'PAC-1', displayName: 'Ana' })
      .subscribe((perfil) => (creado = perfil.createdAt));

    http.expectOne('/profiles/patients').flush({
      profileId: 'pp',
      personId: 'p',
      patientCode: 'PAC-1',
      recordLinkageStatus: 'UNLINKED',
      createdAt: '2026-07-31T12:00:00.000Z',
    });

    expect(creado).toBeInstanceOf(Date);
    expect(creado?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
  });

  it('createPractitioner manda matricula y credencial, que son obligatorias', () => {
    client
      .createPractitioner({
        practitionerCode: 'PRO-1',
        licenseNumber: 'MAT-9',
        credentialNumber: 'CRED-9',
      })
      .subscribe();

    const req = http.expectOne('/profiles/practitioners');
    expect(req.request.body).toEqual({
      practitionerCode: 'PRO-1',
      licenseNumber: 'MAT-9',
      credentialNumber: 'CRED-9',
    });

    req.flush({
      profileId: 'pp',
      personId: 'p',
      practitionerCode: 'PRO-1',
      verificationStatus: 'PENDING',
      practiceStatus: 'ACTIVE',
      licenseId: 'l',
      credentialId: 'c',
      createdAt: '2026-07-31T12:00:00.000Z',
    });
  });

  /* ---- lecturas (UC-05-13 y UC-05-14) ------------------------------------ */

  it('searchPatients no manda los parámetros que no se pidieron', () => {
    client.searchPatients().subscribe();

    const req = http.expectOne((r) => r.url === '/profiles/patients');
    expect(req.request.method).toBe('GET');
    // El backend valida con `forbidNonWhitelisted`: una clave vacía vuelve 400.
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  it('searchPatients manda el texto como `q`, con su cursor y su tope', () => {
    client.searchPatients({ query: 'salas', cursor: 'cur-2', limit: 25 }).subscribe();

    const req = http.expectOne((r) => r.url === '/profiles/patients');
    expect(req.request.params.get('q')).toBe('salas');
    expect(req.request.params.get('cursor')).toBe('cur-2');
    expect(req.request.params.get('limit')).toBe('25');

    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  it('searchPatients con texto vacío no filtra: no es lo mismo que buscar nada', () => {
    client.searchPatients({ query: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/profiles/patients');
    expect(req.request.params.has('q')).toBe(false);

    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  it('searchPatients convierte la fecha de nacimiento y deja pasar la ausente', () => {
    let filas: readonly { birthDate?: Date }[] = [];
    client.searchPatients().subscribe((pagina) => (filas = pagina.items));

    http.expectOne((r) => r.url === '/profiles/patients').flush({
      items: [
        {
          profileId: 'pp-1',
          personId: 'p-1',
          patientCode: 'PAC-1',
          birthDate: '1985-03-14',
          deceased: false,
        },
        { profileId: 'pp-2', personId: 'p-2', patientCode: 'PAC-2', deceased: true },
      ],
      count: 2,
      limit: 50,
      nextCursor: 'cur-3',
    });

    expect(filas[0]?.birthDate).toBeInstanceOf(Date);
    // Sin fecha se devuelve `undefined`, no una `Invalid Date`: quien la
    // muestre tiene que poder distinguir «no hay dato» de «hay un dato roto».
    expect(filas[1]?.birthDate).toBeUndefined();
  });

  it('getPatient convierte las cuatro fechas de la ficha', () => {
    let ficha: { birthDate?: Date; deceasedAt?: Date; createdAt: Date; updatedAt: Date } | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      birthDate: '1985-03-14',
      deceasedAt: '2026-01-02T10:00:00.000Z',
      relatedPersons: [],
      createdAt: '2026-07-31T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z',
    });

    expect(ficha?.birthDate).toBeInstanceOf(Date);
    expect(ficha?.deceasedAt).toBeInstanceOf(Date);
    expect(ficha?.createdAt).toBeInstanceOf(Date);
    expect(ficha?.updatedAt).toBeInstanceOf(Date);
  });

  it('getPatient escapa el identificador en la ruta', () => {
    client.getPatient('pp/1').subscribe();

    // Sin escapar, la barra abriría un segmento nuevo y la petición iría a otra
    // ruta del backend.
    const req = http.expectOne('/profiles/patients/pp%2F1');
    req.flush({
      profileId: 'pp/1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      relatedPersons: [],
      createdAt: '2026-07-31T12:00:00.000Z',
      updatedAt: '2026-07-31T12:00:00.000Z',
    });
  });

  it('getOwnSummary no lleva ningún identificador: el sujeto sale de la sesión', () => {
    client.getOwnSummary().subscribe();

    const req = http.expectOne('/profiles/patients/me/summary');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({
      personId: 'p-1',
      patientProfileId: 'pp-1',
      patientCode: 'PAC-1',
      personStatus: 'concepto-activo',
    });
  });

  it('linkAccount pone el id de la persona en la ruta y el usuario en el cuerpo', () => {
    client.linkAccount('persona-1', 'usuario-1').subscribe();

    const req = http.expectOne('/profiles/persons/persona-1/account-links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'usuario-1' });

    req.flush({
      id: 'al-1',
      personId: 'persona-1',
      userId: 'usuario-1',
      status: 'ACTIVE',
      validFrom: '2026-07-31T12:00:00.000Z',
    });
  });
});
