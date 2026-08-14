import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PractitionerProfile } from './practitioner-profile';

/**
 * El perfil profesional propio.
 *
 * Existe porque «Mi perfil» llamaba a `GET /profiles/patients/me/summary` para
 * todo el mundo, y a un profesional ese endpoint le responde `404` —no tiene
 * perfil de paciente— o `403` si además no verificó su identidad. La pantalla no
 * mostraba nada, y no por un defecto suyo: no existía la lectura que la sirviera.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Ningún uuid llega a la pantalla.** Todo `*ConceptId` se traduce, y lo que
 *    el catálogo no conozca sale como ausencia, no como identificador.
 * 2. **La trayectoria se muestra entera.** Lo vencido y lo que ya no se ejerce
 *    siguen ahí: lo que cambia es el sello, no la presencia.
 * 3. **Un sello no se inventa.** Un estado que el catálogo no resuelve queda en
 *    neutro; afirmar «verificado» sobre lo que no se pudo leer sería inventar la
 *    habilitación de alguien para ejercer.
 * 4. **El catálogo se pide una sola vez**, con todos los conceptos juntos.
 */

const AYER = new Date(Date.now() - 86_400_000).toISOString();
const MANANA = new Date(Date.now() + 86_400_000).toISOString();

const PERFIL = {
  profileId: 'per-1',
  personId: 'per-1',
  practitionerCode: 'MED-7',
  displayName: 'Dra. Lucía Salas',
  professionalTitle: 'Médica cardióloga',
  professionalBio: 'Quince años en cardiología clínica.',
  practitionerCategoryConceptId: 'cat-1',
  verificationStatusConceptId: 'st-verificado',
  practiceStatusConceptId: 'st-ejerciendo',
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [
    {
      id: 'sp-1',
      specialtyConceptId: 'esp-cardio',
      isPrimary: true,
      boardCertified: true,
      verificationStatusConceptId: 'st-verificado',
      validFrom: '2015-03-01T00:00:00.000Z',
    },
  ],
  credentials: [
    {
      id: 'cr-1',
      credentialTypeConceptId: 'cred-titulo',
      number: 'TIT-9',
      issuingInstitutionText: 'UMSA',
      issueDate: '2010-12-01T00:00:00.000Z',
      stateConceptId: 'st-verificado',
      verifiedAt: '2011-01-15T00:00:00.000Z',
    },
  ],
  licenses: [
    {
      id: 'li-1',
      jurisdictionConceptId: 'jur-nacional',
      licenseNumber: 'LIC-3',
      regulatoryAuthority: 'Colegio Médico',
      stateConceptId: 'st-verificado',
    },
  ],
  languages: [{ languageConceptId: 'idi-es', clinicalInterpretationAllowed: true }],
  activity: { encounters: 12, medicationRequests: 30, clinicalNotes: 4, documents: 2 },
  createdAt: '2014-02-01T00:00:00.000Z',
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'st-verificado',
      code: 'CRED_VERIFIED',
      display: 'Verificada',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'st-ejerciendo',
      code: 'PRACTICE_ACTIVE',
      display: 'En ejercicio',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'esp-cardio',
      code: 'CARDIOLOGY',
      display: 'Cardiología',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'cred-titulo',
      code: 'DEGREE',
      display: 'Título de grado',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'jur-nacional',
      code: 'NATIONAL',
      display: 'Nacional',
      codeSystemVersionId: 'csv-1',
    },
    { conceptId: 'idi-es', code: 'ES', display: 'Español', codeSystemVersionId: 'csv-1' },
  ],
  count: 6,
  limit: 200,
};

describe('PractitionerProfile', () => {
  let componente: PractitionerProfile;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(): void {
    componente = TestBed.createComponent(PractitionerProfile).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Responde el perfil y el catálogo, que salen en ese orden. */
  function responder(perfil: object = {}, conceptos: object = CONCEPTOS): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ ...PERFIL, ...perfil });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
  }

  it('pide el perfil propio y el catálogo de sus conceptos', () => {
    montar();
    responder();

    expect(interno<() => { status: string }>('perfil')().status).toBe('ready');
    expect(interno<() => string>('nombre')()).toBe('Dra. Lucía Salas');
  });

  /**
   * Una sola lectura de terminología para las seis colecciones: una por
   * colección multiplicaría por seis las peticiones de la pantalla.
   */
  it('junta todos los conceptos en una sola lectura del catálogo', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush(PERFIL);

    const catalogo = http.expectOne((r) => r.url === '/terminology/concepts');
    // El cliente los manda separados por coma en `ids`, no repitiendo la clave.
    const ids = (catalogo.request.params.get('ids') ?? '').split(',');
    // Los conceptos de las cuatro colecciones más los tres del perfil.
    expect(ids).toContain('esp-cardio');
    expect(ids).toContain('cred-titulo');
    expect(ids).toContain('jur-nacional');
    expect(ids).toContain('idi-es');
    expect(ids).toContain('st-verificado');
    catalogo.flush(CONCEPTOS);
  });

  it('traduce los conceptos: ningún uuid queda en pantalla', () => {
    montar();
    responder();

    expect(interno<() => readonly { nombre: string }[]>('especialidades')()[0].nombre).toBe(
      'Cardiología',
    );
    expect(interno<() => readonly { tipo: string }[]>('formacion')()[0].tipo).toBe(
      'Título de grado',
    );
    expect(interno<() => readonly { jurisdiccion: string }[]>('matriculas')()[0].jurisdiccion).toBe(
      'Nacional',
    );
  });

  it('presenta con la especialidad principal vigente', () => {
    montar();
    responder();

    expect(interno<() => string>('especialidadPrincipal')()).toBe('Cardiología');
  });

  /**
   * Presentar a alguien con una especialidad que dejó de ejercer es decir algo
   * falso, aunque siga siendo la única que tuvo.
   */
  it('no presenta con una especialidad que ya no ejerce', () => {
    montar();
    responder({
      specialties: [{ ...PERFIL.specialties[0], validTo: '2020-01-01T00:00:00.000Z' }],
    });

    expect(interno<() => string>('especialidadPrincipal')()).toBe('');
    // Pero sigue en la lista: es parte de la trayectoria.
    expect(interno<() => readonly unknown[]>('especialidades')()).toHaveLength(1);
  });

  /** Una credencial vencida no habilita, por más verificada que esté. */
  it('el vencimiento manda sobre la verificación en el sello', () => {
    montar();
    responder({
      credentials: [{ ...PERFIL.credentials[0], expiryDate: AYER }],
    });

    const estudio = interno<() => readonly { sello: string; vencida: boolean }[]>('formacion')()[0];
    expect(estudio.vencida).toBe(true);
    expect(estudio.sello).toBe('expired');
  });

  it('una credencial vigente y verificada sale aprobada', () => {
    montar();
    responder({
      credentials: [{ ...PERFIL.credentials[0], expiryDate: MANANA }],
    });

    expect(interno<() => readonly { sello: string }[]>('formacion')()[0].sello).toBe('approved');
  });

  /**
   * Afirmar «verificado» sobre un concepto que no se pudo leer sería inventar la
   * habilitación de alguien para ejercer.
   */
  it('un estado que el catálogo no resuelve queda en neutro', () => {
    montar();
    responder({}, { items: [], count: 0, limit: 200 });

    expect(interno<() => { variant: string } | null>('verificacion')()?.variant).toBe('unknown');
    expect(interno<() => readonly { estado: string }[]>('matriculas')()[0].estado).toBe(
      'Sin registrar',
    );
  });

  /** El catálogo caído degrada las etiquetas; no puede tumbar la trayectoria. */
  it('un fallo del catálogo no tumba el perfil', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush(PERFIL);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    expect(interno<() => { status: string }>('perfil')().status).toBe('ready');
    expect(interno<() => readonly { nombre: string }[]>('especialidades')()[0].nombre).toBe(
      'Sin registrar',
    );
  });

  /** Las cuentas de actividad son de la persona, no un ranking. */
  it('muestra las cuatro cifras de actividad', () => {
    montar();
    responder();

    const actividad = interno<() => readonly { clave: string; valor: number }[]>('actividad')();
    expect(actividad.find((a) => a.clave === 'encuentros')?.valor).toBe(12);
    expect(actividad.find((a) => a.clave === 'documentos')?.valor).toBe(2);
  });

  /**
   * `404` es el caso normal de una cuenta sin perfil profesional. Se propaga
   * como estado de vista, no como excepción sin manejar.
   */
  it('sin perfil profesional cae en el estado de no encontrado', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush(
        { code: 'NOT_FOUND', message: 'Perfil profesional no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(interno<() => { status: string }>('perfil')().status).toBe('not-found');
  });
});
