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

    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({
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
    let ficha:
      { birthDate?: Date; deceasedAt?: Date; createdAt: Date; updatedAt: Date } | undefined;
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

  /* ---- el `null` del transporte -----------------------------------------
     Verificado contra la API viva el 2026-08-08: los opcionales vacíos vienen
     como `null`, **no se omiten**. Las pruebas de arriba fabricaban el cuerpo
     con la clave ausente —que es como yo suponía que venía— y por eso no veían
     nada. Éstas usan la forma real. */

  it('una fecha en `null` es ausencia, no el 1 de enero de 1970', () => {
    let filas: readonly { birthDate?: Date }[] = [];
    client.searchPatients().subscribe((pagina) => (filas = pagina.items));

    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({
        items: [
          {
            profileId: 'pp-1',
            personId: 'p-1',
            patientCode: 'PAC-1',
            displayName: 'Ana Paz',
            // Tal cual lo devuelve el servidor.
            birthDate: null,
            personStatusConceptId: 'c-1',
            deceased: false,
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });

    // `new Date(null)` es 1970-01-01, no una fecha inválida: sin esto, un
    // paciente sin fecha de nacimiento figuraba nacido en 1969.
    expect(filas[0]?.birthDate).toBeUndefined();
  });

  /**
   * El peor de los tres: `deceasedAt !== undefined` es **verdadero** cuando
   * vale `null`, así que la ficha marcaba fallecida a toda persona viva.
   */
  it('`deceasedAt: null` no convierte en fallecida a una persona viva', () => {
    let ficha: { deceasedAt?: Date } | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      masterPatientIndexCode: null,
      displayName: 'Ana Paz',
      birthDate: null,
      deceasedAt: null,
      relatedPersons: [],
      createdAt: '2026-08-01T09:41:16.574Z',
      updatedAt: '2026-08-01T09:41:16.574Z',
    });

    // La clave sigue presente porque la conversión la reasigna; lo que importa
    // es el **valor**, que es lo que la ficha compara con `undefined` para
    // decidir si pinta el sello de defunción.
    expect(ficha?.deceasedAt).toBeUndefined();
    expect(ficha?.deceasedAt !== undefined).toBe(false);
  });

  it('los `*ConceptId` en `null` quedan ausentes, no como clave vacía', () => {
    let ficha: Record<string, unknown> | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f as unknown as Record<string, unknown>));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      administrativeGenderConceptId: null,
      personStatusConceptId: 'c-activo',
      relatedPersons: [],
      createdAt: '2026-08-01T09:41:16.574Z',
      updatedAt: '2026-08-01T09:41:16.574Z',
    });

    // Sin esto se colaba una entrada vacía en el `?ids=` del catálogo.
    expect('administrativeGenderConceptId' in (ficha ?? {})).toBe(false);
    expect(ficha?.['personStatusConceptId']).toBe('c-activo');
  });

  it('los contactos también se limpian: su vínculo puede venir en `null`', () => {
    let ficha: { relatedPersons: readonly Record<string, unknown>[] } | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f as unknown as typeof ficha));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      relatedPersons: [
        {
          id: 'rp-1',
          displayName: 'Juan Paz',
          relationshipConceptId: null,
          isEmergencyContact: true,
          isLegalGuardian: false,
        },
      ],
      createdAt: '2026-08-01T09:41:16.574Z',
      updatedAt: '2026-08-01T09:41:16.574Z',
    });

    expect('relationshipConceptId' in (ficha?.relatedPersons[0] ?? {})).toBe(false);
    expect(ficha?.relatedPersons[0]?.['isEmergencyContact']).toBe(true);
  });

  it('el resumen propio también normaliza su fecha', () => {
    let resumen: { birthDate?: Date } | undefined;
    client.getOwnSummary().subscribe((r) => (resumen = r));

    http.expectOne('/profiles/patients/me/summary').flush({
      personId: 'p-1',
      patientProfileId: 'pp-1',
      patientCode: 'PAC-1',
      displayName: null,
      birthDate: null,
      personStatus: 'c-activo',
      identityVerified: true,
    });

    expect(resumen?.birthDate).toBeUndefined();
  });

  /* ---- F-34: el resumen llega verificado o no, y el código es lo único que
     depende de eso ---------------------------------------------------------- */

  it('sin identidad verificada el resumen llega igual, y sin código de paciente', () => {
    let resumen: { identityVerified: boolean; patientCode?: string } | undefined;
    client.getOwnSummary().subscribe((r) => (resumen = r));

    // Lo que responde el backend desde F-34: la clave `patientCode` no viene.
    http.expectOne('/profiles/patients/me/summary').flush({
      personId: 'p-1',
      patientProfileId: 'pp-1',
      displayName: 'Ana Salas',
      birthDate: null,
      personStatus: 'c-activo',
      identityVerified: false,
    });

    expect(resumen?.identityVerified).toBe(false);
    expect(resumen?.patientCode).toBeUndefined();
  });

  /**
   * La API anterior a F-34 sólo respondía `200` a quien ya estaba verificado, y
   * no emite la marca. Tomarla como `false` mostraría «Pendiente de
   * verificación» al lado del código que esa misma respuesta trae.
   */
  it('una respuesta sin la marca se resuelve por la presencia del código', () => {
    let resumen: { identityVerified: boolean } | undefined;
    client.getOwnSummary().subscribe((r) => (resumen = r));

    http.expectOne('/profiles/patients/me/summary').flush({
      personId: 'p-1',
      patientProfileId: 'pp-1',
      patientCode: 'PAC-1',
      displayName: 'Ana Salas',
      birthDate: null,
      personStatus: 'c-activo',
    });

    expect(resumen?.identityVerified).toBe(true);
  });

  /* ---- los datos propios del paciente: leerlos y corregirlos --------------
     Es un contrato distinto del resumen: trae las CUATRO partes del nombre,
     que es lo único con lo que se puede corregir un apellido sin adivinar
     dónde cortar el compuesto. -------------------------------------------- */

  const DATOS_WIRE = {
    personId: 'p-1',
    patientProfileId: 'pp-1',
    name: 'Ana',
    middleName: 'Lucía',
    lastName: 'Quispe',
    motherLastName: 'Mamani',
    displayName: 'Ana Lucía Quispe Mamani',
    birthDate: '1985-03-14',
    sexAtBirth: 'FEMALE',
    occupationFreeText: 'Docente',
    phone: '+591 70055555',
    residenceMunicipalityConceptId: 'mun-1',
    identityVerified: false,
  };

  it('getOwnPatientProfile no manda ningún identificador: el sujeto sale de la sesión', () => {
    client.getOwnPatientProfile().subscribe();

    const req = http.expectOne('/profiles/patients/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush(DATOS_WIRE);
  });

  /**
   * La fecha es `format: 'date'`: se ancla a medianoche **local**. Con
   * `new Date()` a secas retrocedería un día en cualquier huso al oeste de
   * Greenwich, y la persona vería mal justo el dato que vino a corregir.
   */
  it('getOwnPatientProfile ancla la fecha de nacimiento al día local', () => {
    let perfil: { birthDate?: Date } | undefined;
    client.getOwnPatientProfile().subscribe((p) => (perfil = p));

    http.expectOne('/profiles/patients/me').flush(DATOS_WIRE);

    expect(perfil?.birthDate?.getFullYear()).toBe(1985);
    expect(perfil?.birthDate?.getMonth()).toBe(2);
    expect(perfil?.birthDate?.getDate()).toBe(14);
  });

  /**
   * El contrato dice que los opcionales llegan **ausentes**. Se traduce igual
   * con `sinNulos` —como el resumen— porque una API que mande `null` no puede
   * hacer que `'phone' in perfil` diga lo contrario que el tipo.
   */
  it('getOwnPatientProfile deja fuera los opcionales ausentes y los nulos', () => {
    let perfil: Record<string, unknown> | undefined;
    client
      .getOwnPatientProfile()
      .subscribe((p) => (perfil = p as unknown as Record<string, unknown>));

    http.expectOne('/profiles/patients/me').flush({
      personId: 'p-1',
      patientProfileId: 'pp-1',
      name: 'Ana',
      lastName: 'Quispe',
      middleName: null,
      birthDate: null,
      identityVerified: false,
    });

    expect(perfil?.['birthDate']).toBeUndefined();
    expect('middleName' in (perfil ?? {})).toBe(false);
    expect('phone' in (perfil ?? {})).toBe(false);
  });

  /**
   * La ocupación pasó a ser un concepto de `VS_BO_OCCUPATION`, y llega **junto**
   * al texto libre de las altas anteriores: a lo sumo uno de los dos trae valor,
   * así que los dos tienen que sobrevivir al mapeo sin pisarse.
   */
  it('getOwnPatientProfile trae la ocupación como concepto del catálogo', () => {
    let perfil: { occupationConceptId?: string; occupationFreeText?: string } | undefined;
    client.getOwnPatientProfile().subscribe((p) => (perfil = p));

    http.expectOne('/profiles/patients/me').flush({
      ...DATOS_WIRE,
      occupationFreeText: null,
      occupationConceptId: 'oc-docente',
    });

    expect(perfil?.occupationConceptId).toBe('oc-docente');
    expect('occupationFreeText' in (perfil ?? {})).toBe(false);
  });

  it('updateOwnPatientProfile manda sólo lo que se le pasa, y la fecha como YYYY-MM-DD', () => {
    client
      .updateOwnPatientProfile({ name: 'Ana María', birthDate: new Date(1990, 10, 2) })
      .subscribe();

    const req = http.expectOne('/profiles/patients/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Ana María', birthDate: '1990-11-02' });

    req.flush(DATOS_WIRE);
  });

  /**
   * `''` borra el dato y `undefined` lo deja como estaba: son cosas distintas
   * en el contrato del backend, así que la clave sin valor **no se manda** —
   * `forbidNonWhitelisted` la tomaría como una clave declarada.
   */
  it('updateOwnPatientProfile manda el vacío que borra, y no las claves sin valor', () => {
    client
      .updateOwnPatientProfile({ middleName: '', motherLastName: '', phone: undefined })
      .subscribe();

    const req = http.expectOne('/profiles/patients/me');
    expect(req.request.body).toEqual({ middleName: '', motherLastName: '' });

    req.flush(DATOS_WIRE);
  });

  /**
   * El concepto viaja **tal cual**, sin traducción y sin etiqueta: el uuid es el
   * dato. Y `''` lo vacía, igual que en cualquier otro campo de este contrato —
   * si se degradara a `undefined`, quien quita su ocupación no la quitaría.
   */
  it('updateOwnPatientProfile serializa la ocupación tal cual, y el vacío que la borra', () => {
    client.updateOwnPatientProfile({ occupationConceptId: 'oc-docente' }).subscribe();
    const asigna = http.expectOne('/profiles/patients/me');
    expect(asigna.request.body).toEqual({ occupationConceptId: 'oc-docente' });
    asigna.flush(DATOS_WIRE);

    client.updateOwnPatientProfile({ occupationConceptId: '' }).subscribe();
    const vacia = http.expectOne('/profiles/patients/me');
    expect(vacia.request.body).toEqual({ occupationConceptId: '' });
    vacia.flush(DATOS_WIRE);
  });

  it('updateOwnPatientProfile devuelve el perfil releído, ya traducido', () => {
    let perfil: { name?: string; birthDate?: Date } | undefined;
    client.updateOwnPatientProfile({ name: 'Ana María' }).subscribe((p) => (perfil = p));

    http
      .expectOne('/profiles/patients/me')
      .flush({ ...DATOS_WIRE, name: 'Ana María', birthDate: '1990-11-02' });

    expect(perfil?.name).toBe('Ana María');
    expect(perfil?.birthDate).toBeInstanceOf(Date);
    expect(perfil?.birthDate?.getDate()).toBe(2);
  });

  /* ---- el perfil profesional propio --------------------------------------- */

  const PERFIL_WIRE = {
    profileId: 'per-1',
    personId: 'per-1',
    practitionerCode: 'MED-7',
    displayName: 'Dra. Salas',
    professionalTitle: 'Cardióloga',
    professionalBio: null,
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

  it('getOwnPractitionerProfile lee GET /profiles/practitioners/me/summary', () => {
    let perfil: { professionalTitle?: string; createdAt: Date } | undefined;
    client.getOwnPractitionerProfile().subscribe((p) => (perfil = p));

    const req = http.expectOne('/profiles/practitioners/me/summary');
    expect(req.request.method).toBe('GET');
    req.flush(PERFIL_WIRE);

    expect(perfil?.professionalTitle).toBe('Cardióloga');
    expect(perfil?.createdAt).toBeInstanceOf(Date);
  });

  it('getOwnPractitionerProfile trae el historial laboral con sus fechas convertidas', () => {
    let perfil:
      | { affiliations: readonly { organizationName: string; current: boolean; startDate: Date }[] }
      | undefined;
    client.getOwnPractitionerProfile().subscribe((p) => (perfil = p));

    http.expectOne('/profiles/practitioners/me/summary').flush({
      ...PERFIL_WIRE,
      affiliations: [
        {
          id: 'aff-1',
          practitionerProfileId: 'per-1',
          organizationName: 'Hospital Obrero N.º 1',
          roleTitle: 'Médica de planta',
          departmentText: null,
          practiceSiteId: null,
          affiliationTypeConceptId: null,
          startDate: '2018-01-01',
          endDate: null,
          current: true,
          status: 'c-activo',
          createdAt: '2018-01-02T00:00:00.000Z',
        },
      ],
    });

    expect(perfil?.affiliations).toHaveLength(1);
    expect(perfil?.affiliations[0]).toMatchObject({
      organizationName: 'Hospital Obrero N.º 1',
      current: true,
    });
    expect(perfil?.affiliations[0].startDate).toBeInstanceOf(Date);
  });

  it('updateOwnPractitionerProfile manda un PATCH con sólo lo que cambió', () => {
    client.updateOwnPractitionerProfile({ professionalTitle: 'Nuevo título' }).subscribe();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ professionalTitle: 'Nuevo título' });
    req.flush(PERFIL_WIRE);
  });

  /** Un `''` es una decisión de quien edita: no se filtra antes de mandarlo. */
  it('updateOwnPractitionerProfile deja pasar una cadena vacía para borrar un campo', () => {
    client.updateOwnPractitionerProfile({ professionalBio: '' }).subscribe();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ professionalBio: '' });
    req.flush(PERFIL_WIRE);
  });

  it('updateOwnPractitionerProfile traduce la respuesta igual que la lectura', () => {
    let perfil: { professionalTitle?: string; createdAt: Date } | undefined;
    client
      .updateOwnPractitionerProfile({ professionalTitle: 'Nuevo título' })
      .subscribe((p) => (perfil = p));

    http
      .expectOne('/profiles/practitioners/me')
      .flush({ ...PERFIL_WIRE, professionalTitle: 'Nuevo título' });

    expect(perfil?.professionalTitle).toBe('Nuevo título');
    expect(perfil?.createdAt).toBeInstanceOf(Date);
  });

  /* ---- la fecha de nacimiento no puede correrse un día -------------------
     Verificado contra la API viva el 2026-08-08 desde `America/La_Paz` (UTC−4):
     se guardó `1985-03-14`, el servidor devolvió `1985-03-14T00:00:00.000Z` y
     la pantalla mostraba **13/03/1985**. */

  it('una fecha de nacimiento en UTC no retrocede un día al mostrarse', () => {
    let filas: readonly { birthDate?: Date }[] = [];
    client.searchPatients().subscribe((pagina) => (filas = pagina.items));

    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({
        items: [
          {
            profileId: 'pp-1',
            personId: 'p-1',
            patientCode: 'PAC-1',
            // Tal cual lo serializa el servidor para un `format: 'date'`.
            birthDate: '1985-03-14T00:00:00.000Z',
            deceased: false,
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });

    const fecha = filas[0]?.birthDate;
    // Se comprueban los componentes **locales**, que es lo que se pinta.
    expect(fecha?.getFullYear()).toBe(1985);
    expect(fecha?.getMonth()).toBe(2);
    expect(fecha?.getDate()).toBe(14);
  });

  it('acepta también la forma sin hora, que es la que el contrato declara', () => {
    let ficha: { birthDate?: Date } | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      birthDate: '1985-03-14',
      relatedPersons: [],
      createdAt: '2026-08-01T09:41:16.574Z',
      updatedAt: '2026-08-01T09:41:16.574Z',
    });

    expect(ficha?.birthDate?.getDate()).toBe(14);
  });

  /**
   * `deceasedAt` sí es un instante: ahí la hora **es** el dato, y anclarlo a
   * medianoche local lo rompería.
   */
  it('una marca de tiempo conserva su instante, no se ancla a medianoche', () => {
    let ficha: { deceasedAt?: Date } | undefined;
    client.getPatient('pp-1').subscribe((f) => (ficha = f));

    http.expectOne('/profiles/patients/pp-1').flush({
      profileId: 'pp-1',
      personId: 'p-1',
      patientCode: 'PAC-1',
      deceasedAt: '2026-01-02T10:30:00.000Z',
      relatedPersons: [],
      createdAt: '2026-08-01T09:41:16.574Z',
      updatedAt: '2026-08-01T09:41:16.574Z',
    });

    expect(ficha?.deceasedAt?.toISOString()).toBe('2026-01-02T10:30:00.000Z');
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
      identityVerified: true,
    });
  });

  /* ---- fusión de duplicados (UC-05-08 y UC-05-09) ------------------------ */

  it('mergePatients manda los dos perfiles con su papel y sin el motivo ausente', () => {
    client
      .mergePatients({ survivingPatientProfileId: 'pp-A', mergedPatientProfileId: 'pp-B' })
      .subscribe();

    const req = http.expectOne('/profiles/patients/merge');
    expect(req.request.method).toBe('POST');
    // El orden no es simétrico: el que sobrevive conserva su historia.
    expect(req.request.body).toEqual({
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
    });

    req.flush({
      id: 'ev-1',
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
      decisionStatus: 'c-1',
      recordedAt: '2026-08-08T02:00:00.000Z',
    });
  });

  it('mergePatients convierte la marca de tiempo del evento', () => {
    let evento: { recordedAt: Date } | undefined;
    client
      .mergePatients({ survivingPatientProfileId: 'pp-A', mergedPatientProfileId: 'pp-B' })
      .subscribe((e) => (evento = e));

    http.expectOne('/profiles/patients/merge').flush({
      id: 'ev-1',
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
      decisionStatus: 'c-1',
      recordedAt: '2026-08-08T02:00:00.000Z',
    });

    expect(evento?.recordedAt).toBeInstanceOf(Date);
  });

  /**
   * La lectura que hace reversible una fusión más allá de la pantalla que la
   * hizo: sin ella, el `eventId` moría con la respuesta del POST.
   */
  it('listMergeEvents sin filtros no manda ningún parámetro', () => {
    client.listMergeEvents().subscribe();

    const req = http.expectOne((r) => r.url === '/profiles/patients/merge-events');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0, limit: 50 });
  });

  it('listMergeEvents manda el paciente y el tope cuando se piden', () => {
    client.listMergeEvents({ patientProfileId: 'pp-A', limit: 10 }).subscribe();

    const req = http.expectOne((r) => r.url === '/profiles/patients/merge-events');
    expect(req.request.params.get('patientProfileId')).toBe('pp-A');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush({ items: [], count: 0, limit: 10 });
  });

  it('listMergeEvents convierte la marca de tiempo de cada evento', () => {
    let pagina: { items: readonly { recordedAt: Date }[] } | undefined;
    client.listMergeEvents().subscribe((p) => (pagina = p));

    http
      .expectOne((r) => r.url === '/profiles/patients/merge-events')
      .flush({
        items: [
          {
            id: 'ev-1',
            survivingPatientProfileId: 'pp-A',
            mergedPatientProfileId: 'pp-B',
            decisionStatus: 'c-1',
            recordedAt: '2026-08-08T02:05:00.000Z',
          },
        ],
        count: 1,
        limit: 50,
      });

    expect(pagina?.items[0]?.recordedAt).toBeInstanceOf(Date);
  });

  it('reverseMerge pone el evento en la ruta y manda cuerpo vacío sin motivo', () => {
    client.reverseMerge('ev-1').subscribe();

    const req = http.expectOne('/profiles/patients/merge/ev-1/reverse');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      id: 'ev-2',
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
      decisionStatus: 'c-1',
      reversalOfEventId: 'ev-1',
      recordedAt: '2026-08-08T02:05:00.000Z',
    });
  });

  it('reverseMerge escapa el identificador del evento', () => {
    client.reverseMerge('ev/1').subscribe();

    const req = http.expectOne('/profiles/patients/merge/ev%2F1/reverse');
    req.flush({
      id: 'ev-2',
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
      decisionStatus: 'c-1',
      recordedAt: '2026-08-08T02:05:00.000Z',
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

  /* -- historial laboral del profesional (UC-05-16) ----------------------- */

  /** Una afiliación tal como llega por el cable. */
  const afiliacionEnCable = (over: Record<string, unknown> = {}) => ({
    id: 'af-1',
    practitionerProfileId: 'pp-1',
    organizationName: 'Hospital Obrero N.º 1',
    roleTitle: 'Médico de planta',
    departmentText: 'Cardiología',
    practiceSiteId: null,
    affiliationTypeConceptId: 'c-1',
    startDate: '2020-03-01',
    endDate: null,
    current: true,
    status: 'c-activo',
    createdAt: '2026-08-14T12:00:00.000Z',
    ...over,
  });

  it('listAffiliations pide el propio y no admite pasar otro perfil', () => {
    client.listAffiliations().subscribe();

    const req = http.expectOne('/profiles/practitioners/me/affiliations');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0 });
  });

  /**
   * `startDate` es `format: 'date'`: pasarla por `new Date()` la anclaría a
   * medianoche UTC y en cualquier huso al oeste de Greenwich retrocedería un
   * día. Un vínculo que empieza el 1 de marzo no puede leerse como del 28 de
   * febrero.
   */
  it('listAffiliations ancla las fechas sin hora a medianoche local', () => {
    let items: readonly { startDate: Date; endDate: Date | null }[] = [];
    client.listAffiliations().subscribe((p) => (items = p.items));

    http.expectOne('/profiles/practitioners/me/affiliations').flush({
      items: [afiliacionEnCable()],
      count: 1,
    });

    expect(items[0].startDate.getFullYear()).toBe(2020);
    expect(items[0].startDate.getMonth()).toBe(2);
    expect(items[0].startDate.getDate()).toBe(1);
  });

  /** Sin fin declarado el vínculo sigue vigente; `null` lo dice y no se pierde. */
  it('listAffiliations conserva el fin ausente como null', () => {
    let items: readonly { endDate: Date | null; current: boolean }[] = [];
    client.listAffiliations().subscribe((p) => (items = p.items));

    http.expectOne('/profiles/practitioners/me/affiliations').flush({
      items: [
        afiliacionEnCable(),
        afiliacionEnCable({ id: 'af-2', endDate: '2023-12-31', current: false }),
      ],
      count: 2,
    });

    expect(items[0].endDate).toBeNull();
    expect(items[0].current).toBe(true);
    expect(items[1].endDate).toBeInstanceOf(Date);
    expect(items[1].current).toBe(false);
  });

  it('addAffiliation no manda las claves opcionales ausentes', () => {
    client
      .addAffiliation({
        organizationName: 'Hospital Obrero N.º 1',
        roleTitle: 'Médico de planta',
        startDate: '2020-03-01',
      })
      .subscribe();

    const req = http.expectOne('/profiles/practitioners/me/affiliations');
    expect(req.request.method).toBe('POST');
    // El backend valida con `forbidNonWhitelisted`: un opcional en `undefined`
    // viajaría como clave declarada y volvería 400.
    expect(req.request.body).toEqual({
      organizationName: 'Hospital Obrero N.º 1',
      roleTitle: 'Médico de planta',
      startDate: '2020-03-01',
    });

    req.flush(afiliacionEnCable());
  });
});
