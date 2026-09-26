import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PractitionerProfile } from './practitioner-profile';
import type {
  FormacionVisible,
  PerfilProfesionalVisible,
} from './practitioner-profile-view/practitioner-profile-view.types';

/**
 * El contenedor del perfil profesional propio.
 *
 * Desde el carril R2-4 este componente no dibuja: carga `me/summary`, resuelve
 * etiquetas y foto, y arma el `PerfilProfesionalVisible` que consume la vista
 * compartida con la guía de profesionales. Estas pruebas fijan la RESOLUCIÓN —
 * el dibujo lo fija el spec de `practitioner-profile-view`, con datos fijos.
 *
 * Lo que se fija:
 *
 * 1. **Ningún uuid llega al contrato de la vista.** Todo `*ConceptId` se
 *    traduce, y lo que el catálogo no conozca sale como ausencia.
 * 2. **La trayectoria se muestra entera.** Lo vencido y lo que ya no se ejerce
 *    siguen ahí: lo que cambia es el sello, no la presencia.
 * 3. **Un sello no se inventa.** Un estado que el catálogo no resuelve queda en
 *    neutro.
 * 4. **El catálogo se pide una sola vez**, con todos los conceptos juntos.
 * 5. **La foto se resuelve a URL, y su fallo degrada** al avatar de iniciales.
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
  affiliations: [
    {
      id: 'af-1',
      practitionerProfileId: 'per-1',
      organizationName: 'Hospital Obrero N.º 1',
      roleTitle: 'Médica de planta',
      departmentText: null,
      practiceSiteId: null,
      affiliationTypeConceptId: null,
      startDate: '2012-01-01',
      endDate: '2016-01-01',
      current: false,
      status: 'c-activo',
      createdAt: '2012-01-02T00:00:00.000Z',
    },
    {
      id: 'af-2',
      practitionerProfileId: 'per-1',
      organizationName: 'Sede Central Sopocachi',
      roleTitle: 'Médica cardióloga',
      departmentText: null,
      practiceSiteId: null,
      affiliationTypeConceptId: null,
      startDate: '2019-04-01',
      endDate: null,
      current: true,
      status: 'c-activo',
      createdAt: '2019-04-02T00:00:00.000Z',
    },
  ],
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
      // `provideRouter([])` no es adorno: estas pruebas leen el contrato
      // resuelto y nunca llaman a `detectChanges()`, pero la plantilla del
      // componente usa `RouterLink`, y cuando la foto resuelve **después** de
      // terminar la prueba, la detección de cambios que dispara ese cambio de
      // señal alcanza a renderizarla y pide `ActivatedRoute`. Sin el router,
      // eso salía como `NG0201` no capturado: la suite quedaba en verde y el
      // proceso terminaba en 1, una de cada tres corridas.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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

  /** El contrato ya armado para la vista, o el porqué de que no esté. */
  function visible(): PerfilProfesionalVisible {
    const valor = interno<() => PerfilProfesionalVisible | null>('visible')();
    if (valor === null) {
      throw new Error(
        `el perfil no está listo: ${JSON.stringify(interno<() => unknown>('perfil')())}`,
      );
    }
    return valor;
  }

  /** Responde el perfil y el catálogo, que salen en ese orden. */
  function responder(perfil: object = {}, conceptos: object = CONCEPTOS): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ ...PERFIL, ...perfil });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
  }

  it('pide el perfil propio y arma el contrato de la vista', () => {
    montar();
    responder();

    expect(visible().nombre).toBe('Dra. Lucía Salas');
    expect(visible().codigo).toBe('MED-7');
    expect(visible().bio).toBe('Quince años en cardiología clínica.');
  });

  /**
   * Una sola lectura de terminología para las seis colecciones: una por
   * colección multiplicaría por seis las peticiones de la pantalla.
   */
  it('junta todos los conceptos en una sola lectura del catálogo', () => {
    montar();
    http.expectOne((r) => r.url === '/profiles/practitioners/me/summary').flush(PERFIL);

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

  /**
   * El departamento que emitió el documento, al lado del número.
   *
   * La ficha lo dibuja como SUFIJO del documento —«5414404 Santa Cruz»— desde
   * que existe el bloque, y el alta lo pregunta. Pero nadie pedía su etiqueta:
   * el `Map` de terminología llegaba sin él, `etiquetaOpcional` devolvía cadena
   * vacía y el renglón se leía como si el médico no lo hubiera declarado. Lo
   * mismo con la localidad de residencia.
   */
  describe('la filiación: documento y dónde vive', () => {
    const FILIACION = {
      nationalId: '5414404',
      issuerAdministrativeAreaConceptId: 'dep-sc',
      residenceMunicipalityConceptId: 'mun-scz',
    };

    const CON_FILIACION = {
      ...CONCEPTOS,
      items: [
        ...CONCEPTOS.items,
        { conceptId: 'dep-sc', code: 'SC', display: 'Santa Cruz', codeSystemVersionId: 'csv-1' },
        {
          conceptId: 'mun-scz',
          code: 'SC-SCZ',
          display: 'Santa Cruz de la Sierra',
          codeSystemVersionId: 'csv-1',
        },
      ],
    };

    it('pide la etiqueta del departamento emisor junto con el resto', () => {
      montar();
      http
        .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
        .flush({ ...PERFIL, ...FILIACION });

      const catalogo = http.expectOne((r) => r.url === '/terminology/concepts');
      const ids = (catalogo.request.params.get('ids') ?? '').split(',');
      expect(ids).toContain('dep-sc');
      expect(ids).toContain('mun-scz');
      catalogo.flush(CON_FILIACION);
    });

    it('el departamento acompaña al número del documento', () => {
      montar();
      responder(FILIACION, CON_FILIACION);

      expect(visible().datosPersonales?.documento).toBe('5414404');
      expect(visible().datosPersonales?.departamento).toBe('Santa Cruz');
      expect(visible().datosPersonales?.domicilio).toBe('Santa Cruz de la Sierra');
    });

    /**
     * Vacío, y no «Sin registrar»: es un sufijo del número, así que sin
     * etiqueta el renglón tiene que leerse «5414404» y no «5414404 Sin
     * registrar», que diría que falta algo cuando el dato está.
     */
    it('sin el concepto en el catálogo, el sufijo queda vacío y el número sigue', () => {
      montar();
      responder(FILIACION);

      expect(visible().datosPersonales?.documento).toBe('5414404');
      expect(visible().datosPersonales?.departamento).toBe('');
    });

    /**
     * Facturación (propietario, 19/09/2026): el contenedor propio es el único
     * que la arma. El de la guía la deja en `null` — el NIT de un colega no es
     * de quien mira su ficha.
     */
    it('lleva el NIT y la razón social del contrato a la ficha propia', () => {
      montar();
      responder({ taxId: '5414404011', taxHolderName: 'Consultorio Dra. Rojas S.R.L.' });

      expect(visible().facturacion).toEqual({
        nit: '5414404011',
        razonSocial: 'Consultorio Dra. Rojas S.R.L.',
      });
    });

    it('sin facturación declarada los dos quedan vacíos, no ausentes', () => {
      // Vacío y no `null`: `null` es «esta ficha no es tuya», que es otra cosa
      // que la ficha dibuja distinto (ni siquiera muestra la pestaña).
      montar();
      responder({});

      expect(visible().facturacion).toEqual({ nit: '', razonSocial: '' });
    });

    it('un perfil sin departamento declarado no mete «undefined» en la petición', () => {
      montar();
      http.expectOne((r) => r.url === '/profiles/practitioners/me/summary').flush(PERFIL);

      const catalogo = http.expectOne((r) => r.url === '/terminology/concepts');
      const ids = (catalogo.request.params.get('ids') ?? '').split(',');
      expect(ids).not.toContain('undefined');
      catalogo.flush(CONCEPTOS);
    });
  });

  it('traduce los conceptos: ningún uuid queda en el contrato', () => {
    montar();
    responder();

    expect(visible().especialidades[0].nombre).toBe('Cardiología');
    expect(visible().formacion[0].tipo).toBe('Título de grado');
    expect(visible().matriculas[0].jurisdiccion).toBe('Nacional');
    expect(visible().idiomas[0].nombre).toBe('Español');
  });

  it('presenta con la primera especialidad vigente, sin mirar cuál es la principal (D-01)', () => {
    montar();
    responder(
      {
        specialties: [
          { ...PERFIL.specialties[0], id: 'sp-0', specialtyConceptId: 'esp-pedia', isPrimary: false },
          { ...PERFIL.specialties[0], isPrimary: true },
        ],
      },
      {
        items: [
          ...CONCEPTOS.items,
          { conceptId: 'esp-pedia', code: 'PEDIATRICS', display: 'Pediatría', codeSystemVersionId: 'csv-1' },
        ],
      },
    );

    expect(visible().especialidadPrincipal).toBe('Pediatría');
    expect(visible().especialidades.map((e) => e.nombre)).toEqual(['Pediatría', 'Cardiología']);
    for (const especialidad of visible().especialidades) {
      expect(especialidad).not.toHaveProperty('principal');
    }
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

    expect(visible().especialidadPrincipal).toBe('');
    // Pero sigue en la lista: es parte de la trayectoria.
    expect(visible().especialidades).toHaveLength(1);
  });

  /** Una credencial vencida no habilita, por más verificada que esté. */
  it('el vencimiento manda sobre la verificación en el sello', () => {
    montar();
    responder({
      credentials: [{ ...PERFIL.credentials[0], expiryDate: AYER }],
    });

    expect(visible().formacion[0].vencida).toBe(true);
    expect(visible().formacion[0].sello).toBe('expired');
  });

  it('una credencial vigente y verificada sale aprobada', () => {
    montar();
    responder({
      credentials: [{ ...PERFIL.credentials[0], expiryDate: MANANA }],
    });

    expect(visible().formacion[0].sello).toBe('approved');
  });

  /**
   * Afirmar «verificado» sobre un concepto que no se pudo leer sería inventar la
   * habilitación de alguien para ejercer.
   */
  it('un estado que el catálogo no resuelve queda en neutro', () => {
    montar();
    responder({}, { items: [], count: 0, limit: 200 });

    expect(visible().verificacion?.variant).toBe('unknown');
    expect(visible().matriculas[0].estado).toBe('Sin registrar');
  });

  /** El catálogo caído degrada las etiquetas; no puede tumbar la trayectoria. */
  it('un fallo del catálogo no tumba el perfil', () => {
    montar();
    http.expectOne((r) => r.url === '/profiles/practitioners/me/summary').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    expect(visible().especialidades[0].nombre).toBe('Sin registrar');
  });

  /** Las cuentas de actividad son de la persona, no un ranking. */
  it('muestra las cuatro cifras de actividad', () => {
    montar();
    responder();

    const actividad = visible().actividad;
    expect(actividad.find((a) => a.clave === 'encuentros')?.valor).toBe(12);
    expect(actividad.find((a) => a.clave === 'documentos')?.valor).toBe(2);
  });

  /* -- El historial laboral, en fases (carril 05) --------------------------- */

  it('separa el historial laboral en actividad actual y experiencia histórica', () => {
    montar();
    responder();

    expect(visible().actividadActual).toHaveLength(1);
    expect(visible().actividadActual[0]).toMatchObject({
      organizacion: 'Sede Central Sopocachi',
      actual: true,
    });
    expect(visible().experienciaHistorica).toHaveLength(1);
    expect(visible().experienciaHistorica[0]).toMatchObject({
      organizacion: 'Hospital Obrero N.º 1',
      actual: false,
    });
  });

  it('sin historial laboral, ambas fases quedan vacías', () => {
    montar();
    responder({ affiliations: [] });

    expect(visible().actividadActual).toHaveLength(0);
    expect(visible().experienciaHistorica).toHaveLength(0);
  });

  /* -- La foto (carril R2-4) ---------------------------------------------- */

  /** Sin `photoFileId` no se pide nada: el avatar de iniciales es el diseño. */
  it('sin foto registrada no pide ninguna URL de descarga', () => {
    montar();
    responder();

    expect(visible().fotoUrl).toBeNull();
  });

  it('con foto registrada baja la imagen y la pinta como data: URL', async () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ ...PERFIL, photoFileId: 'foto-1' });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    // Por `/content` y no por `download-url`: esa firma apunta a
    // `file://local/<sha>`, que ningún `<img>` carga. Era el defecto por el que
    // la foto se subía bien y el avatar seguía mostrando iniciales.
    http.expectOne((r) => r.url === '/common/files/foto-1/content').flush(pngFalso());
    await esperarLaFoto(() => visible().fotoUrl !== null);

    expect(visible().fotoUrl).toMatch(/^data:image\/png;base64,/);
  });

  /** La foto es un adorno: su fallo degrada al avatar, no tumba el perfil. */
  it('una foto que no se puede resolver degrada al avatar de iniciales', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ ...PERFIL, photoFileId: 'foto-1' });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne((r) => r.url === '/common/files/foto-1/content')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    expect(visible().fotoUrl).toBeNull();
    expect(visible().nombre).toBe('Dra. Lucía Salas');
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

/**
 * Un PNG mínimo, como Blob.
 *
 * La foto se resuelve bajando los bytes por `/content` y codificándolos a
 * `data:`: lo que importa no es el contenido sino que el Blob traiga tipo.
 */
function pngFalso(): Blob {
  return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
}

/**
 * Espera a que `FileReader` termine de codificar.
 *
 * Es asíncrono y **no** pasa por los temporizadores de `fakeAsync`, así que se
 * sondea en vez de ceder un turno fijo, que resultaba intermitente.
 */
async function esperarLaFoto(hayFoto: () => boolean): Promise<void> {
  // El predicado puede reventar mientras la pantalla todavía no está lista
  // —la foto forma parte del `forkJoin` de la carga—, y eso es justo lo que se
  // está esperando, no un fallo.
  const listo = (): boolean => {
    try {
      return hayFoto();
    } catch {
      return false;
    }
  };
  for (let intento = 0; intento < 50 && !listo(); intento++) {
    await new Promise((sigue) => setTimeout(sigue, 0));
  }
}

/**
 * Las tres operaciones que la ficha propia pide y este contenedor hace.
 *
 * Antes vivían dentro de `practitioner-profile-view`, que recibía el perfil por
 * `input()` y a la vez escribía en el servidor. La vista ahora sólo avisa —qué
 * foto se eligió, qué título se quiere retirar, qué pestaña se abrió— y estas
 * pruebas son las de aquel archivo, en el sitio donde el comportamiento vive.
 */
describe('PractitionerProfile · las operaciones que la vista pide', () => {
  let componente: PractitionerProfile;
  let http: HttpTestingController;
  /** `confirm()` resuelve a `true` salvo que una prueba lo cambie. */
  let confirmar = true;
  const dialogs = { confirm: vi.fn(async () => confirmar) };

  const FORMACION_PENDIENTE: FormacionVisible = {
    id: 'cr-2',
    tipo: 'Diplomado',
    numero: 'DIP-1',
    institucion: '',
    desde: null,
    hasta: null,
    estado: 'Pendiente',
    sello: 'in-review',
    vencida: false,
  };

  /** PNG mínimo: el tipo es lo único que hace falta para elegirlo. */
  function archivoFoto(): File {
    return new File(['x'], 'foto.png', { type: 'image/png' });
  }

  /**
   * Respuesta mínima válida de `PUT /profiles/practitioners/:id/photo`.
   *
   * La traducción llama `.map()` sobre `specialties`, `credentials`, `licenses`
   * y `affiliations`: sin esos cuatro arreglos —aunque sea vacíos— revienta
   * antes de que el flujo llegue a la propagación, y el pedido a
   * `/community/profiles/me` nunca sale.
   */
  function respuestaFoto(photoFileId: string) {
    return {
      profileId: 'prac-1',
      photoFileId,
      createdAt: new Date().toISOString(),
      specialties: [],
      credentials: [],
      licenses: [],
      affiliations: [],
    };
  }

  /**
   * Monta el contenedor y resuelve su carga inicial.
   *
   * @param profileId - El perfil profesional de la sesión. `null` es una cuenta
   *   que existe: una persona duplicada cuya cuenta quedó atada al registro sin
   *   perfil no lleva el claim `hpid`.
   */
  function montar(profileId: string | null = 'prac-1'): void {
    // El módulo se arma DENTRO de cada prueba, porque la sesión cambia entre
    // ellas y un proveedor no se puede reemplazar una vez instanciado. El reset
    // es lo que permite configurarlo acá en vez de en el `beforeEach`.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal(profileId), userId: signal('u-1') },
        },
        { provide: DialogService, useValue: dialogs },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    componente = TestBed.createComponent(PractitionerProfile).componentInstance;
    responderLaCarga(profileId);
  }

  /** La lectura que dispara el constructor. Acá se prueban las operaciones. */
  function responderLaCarga(profileId: string | null): void {
    http.expectOne((r) => r.url === '/profiles/practitioners/me/summary').flush(PERFIL);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    if (profileId !== null) {
      http
        .expectOne((r) => r.url === `/practitioners/${profileId}/sites`)
        .flush({ items: [], count: 0 });
    }
  }

  /** Una operación o señal protegida del contenedor, atada a su instancia. */
  function operacion<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Los avisos encolados, sin pasar por el contenedor que los pinta. */
  function avisos(): readonly { readonly title?: string; readonly message: string }[] {
    return TestBed.inject(ToastService).toasts();
  }

  /**
   * Cierra lo que pidió la ficha al dibujarse.
   *
   * Esperar a que `FileReader` codifique la foto cede turnos, y en esos turnos
   * la pantalla se renderiza: el bloque de trayectoria embebido lee su historial
   * y sus consultorios. No es lo que estas pruebas miden, pero queda colgando de
   * `verify()`, así que se responde en vez de aflojar la comprobación.
   */
  function responderLoQueDibujoLaFicha(): void {
    for (const peticion of http.match(() => true)) {
      peticion.flush({ items: [], count: 0 });
    }
  }

  beforeEach(() => {
    // Qué ayudas se cerraron vive en `localStorage`, que jsdom comparte entre
    // las pruebas del archivo: sin limpiarlo, la primera que abre
    // «Credenciales» deja el aviso marcado como visto y no vuelve a salir.
    localStorage.clear();
    confirmar = true;
    dialogs.confirm.mockClear();
  });

  afterEach(() => http.verify());

  /* -- La foto ------------------------------------------------------------ */

  /**
   * El caso que rompía en producción: la cuenta entra, ve su perfil y el botón
   * de la foto, elige un PNG… y no pasa nada. Se salía en silencio cuando la
   * sesión no traía perfil profesional, y desde afuera se lee como «no acepta
   * PNG».
   */
  it('sin perfil profesional en la sesión lo DICE, en vez de no hacer nada', () => {
    montar(null);

    operacion<(archivo: File) => void>('subirFoto')(archivoFoto());

    // Ni una petición: no hay dónde guardarla. Pero la persona se entera.
    http.expectNone((r) => r.url === '/common/files/upload');
    expect(operacion<() => string>('errorDeFoto')()).toContain(
      'no está asociada a un perfil profesional',
    );
  });

  it('sube, fija la foto profesional y la deja lista para pintar', async () => {
    montar();

    operacion<(archivo: File) => void>('subirFoto')(archivoFoto());

    http.expectOne('/common/files/upload').flush({ id: 'file-1' });
    http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
    // Sin vitrina: la propagación no dispara ningún pedido más.
    http.expectOne('/community/profiles/me').flush(null);
    http.expectOne('/common/files/file-1/content').flush(pngFalso());
    await esperarLaFoto(() => operacion<() => string | null>('fotoRecien')() !== null);

    // `data:` y no una ruta: la URL firmada del backend apunta a
    // `file://local/<sha>` y ningún navegador la carga. Ése era el defecto.
    expect(operacion<() => string | null>('fotoRecien')()).toMatch(/^data:image\/png;base64,/);
    expect(operacion<() => boolean>('fotoSubiendo')()).toBe(false);
    responderLoQueDibujoLaFicha();
  });

  it('con vitrina existente, repite la foto como avatar sin perder lo ya declarado', async () => {
    montar();

    operacion<(archivo: File) => void>('subirFoto')(archivoFoto());

    http.expectOne('/common/files/upload').flush({ id: 'file-1' });
    http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));

    http.expectOne('/community/profiles/me').flush({
      id: 'vit-1',
      tenantId: 'ten-1',
      targetId: 'prac-1',
      slug: 'dra-lucia-salas',
      displayName: 'Dra. Lucía Salas',
      headline: 'Cardióloga',
      biography: 'Bio',
      acceptsReviews: true,
      visibility: 'PUBLIC',
      statusConceptId: 'st-1',
    });

    const puesta = http.expectOne('/community/profiles/me');
    expect(puesta.request.method).toBe('PUT');
    // El `PUT` es completo, no un `PATCH`: mandar sólo `{ avatarFileId }`
    // borraría lo que la persona declaró en otra pantalla.
    expect(puesta.request.body).toEqual({
      tenantId: 'ten-1',
      slug: 'dra-lucia-salas',
      displayName: 'Dra. Lucía Salas',
      headline: 'Cardióloga',
      biography: 'Bio',
      acceptsReviews: true,
      avatarFileId: 'file-1',
    });
    puesta.flush({
      id: 'vit-1',
      tenantId: 'ten-1',
      targetId: 'prac-1',
      slug: 'dra-lucia-salas',
      displayName: 'Dra. Lucía Salas',
      visibility: 'PUBLIC',
      statusConceptId: 'st-1',
      avatarFileId: 'file-1',
    });

    http.expectOne('/common/files/file-1/content').flush(pngFalso());
    await esperarLaFoto(() => operacion<() => string | null>('fotoRecien')() !== null);

    expect(operacion<() => string | null>('fotoRecien')()).toMatch(/^data:image\/png;base64,/);
    responderLoQueDibujoLaFicha();
  });

  it('si falla la propagación a la vitrina, la foto profesional igual se fija', async () => {
    // Best-effort: lo que ya se guardó arriba no debe perderse por un error
    // accesorio.
    montar();

    operacion<(archivo: File) => void>('subirFoto')(archivoFoto());

    http.expectOne('/common/files/upload').flush({ id: 'file-1' });
    http.expectOne('/profiles/practitioners/prac-1/photo').flush(respuestaFoto('file-1'));
    http.expectOne('/community/profiles/me').flush('boom', { status: 500, statusText: 'Error' });

    http.expectOne('/common/files/file-1/content').flush(pngFalso());
    await esperarLaFoto(() => operacion<() => string | null>('fotoRecien')() !== null);

    expect(operacion<() => string | null>('fotoRecien')()).toMatch(/^data:image\/png;base64,/);
    // El fallo fue accesorio: no queda como mensaje de error de la subida, que
    // sí funcionó.
    expect(operacion<() => string>('errorDeFoto')()).toBe('');
    responderLoQueDibujoLaFicha();
  });

  /* -- Retirar un título -------------------------------------------------- */

  it('retirar confirma y hace un DELETE del título', async () => {
    montar();

    await operacion<(e: FormacionVisible) => Promise<void>>('retirarCredencial')(
      FORMACION_PENDIENTE,
    );

    expect(dialogs.confirm).toHaveBeenCalled();
    const req = http.expectOne('/profiles/practitioners/me/credentials/cr-2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    // Retirado, el perfil se relee: la trayectoria que se está mirando cambió.
    responderLaCarga('prac-1');
  });

  it('sin confirmar, no se manda ningún DELETE', async () => {
    confirmar = false;
    montar();

    await operacion<(e: FormacionVisible) => Promise<void>>('retirarCredencial')(
      FORMACION_PENDIENTE,
    );

    expect(dialogs.confirm).toHaveBeenCalled();
    http.expectNone('/profiles/practitioners/me/credentials/cr-2');
  });

  /* -- El aviso único de «Credenciales» (19/09/2026) ---------------------- */

  it('el aviso sale al abrir «Credenciales», y con ninguna otra pestaña', () => {
    montar();

    operacion<(pestana: string) => void>('alVerPestana')('Datos personales');
    expect(avisos()).toHaveLength(0);

    operacion<(pestana: string) => void>('alVerPestana')('Credenciales');
    expect(avisos()).toHaveLength(1);
    expect(avisos()[0]?.title).toBe('Credenciales');
    expect(avisos()[0]?.message).toContain('verificado contra una fuente');
  });

  it('no se repite al volver a la pestaña', () => {
    montar();

    operacion<(pestana: string) => void>('alVerPestana')('Credenciales');
    operacion<(pestana: string) => void>('alVerPestana')('Actividad');
    operacion<(pestana: string) => void>('alVerPestana')('Credenciales');

    expect(avisos()).toHaveLength(1);
  });

  /* -- El aviso de «Trayectoria» (24/09/2026) ----------------------------- */

  it('«Trayectoria» avisa cada vez que se abre, y dura 3 s', () => {
    montar();

    operacion<(pestana: string) => void>('alVerPestana')('Trayectoria');
    operacion<(pestana: string) => void>('alVerPestana')('Actividad');
    operacion<(pestana: string) => void>('alVerPestana')('Trayectoria');

    expect(avisos()).toHaveLength(2);
    expect(avisos()[0]?.title).toBe('Trayectoria');
    expect(TestBed.inject(ToastService).toasts()[0]?.durationMs).toBe(3000);
  });
});
