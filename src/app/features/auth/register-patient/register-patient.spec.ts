import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { RegisterPatient } from './register-patient';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';

const RESPUESTA = {
  userId: 'u-1',
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  emailVerificationSent: false,
};

const RESPUESTA_PRO = {
  userId: 'u',
  personId: 'p',
  practitionerProfileId: 'pp',
  practitionerCode: 'PRO-1',
};

class AlmacenFalso {
  value: string | null = null;
  read(): string | null {
    return this.value;
  }
  write(token: string): void {
    this.value = token;
  }
  clear(): void {
    this.value = null;
  }
}

/** Un concepto de `VS_BO_DEPARTMENT`: Santa Cruz, tal como lo siembra la API. */
const DEPARTAMENTO_SANTA_CRUZ = '51fcbf8e-b4ea-5ba9-8aec-0df7be617c69';

/** Un concepto de `VS_BO_MUNICIPALITY`: Sacaba, código INE 031001. */
const MUNICIPIO_SACABA = 'ee4f2681-6c58-5f4c-8f83-8d19de56099a';

/** La petición del catálogo de departamentos que dispara el constructor. */
const CATALOGO = '/terminology/value-sets?code=VS_BO_DEPARTMENT';

/** La del catálogo de municipios, que dispara el mismo constructor. */
const CATALOGO_MUNICIPIOS = '/terminology/value-sets?code=VS_BO_MUNICIPALITY';

/** La del catálogo de ocupaciones de Bolivia, que dispara el mismo constructor. */
const CATALOGO_OCUPACIONES = '/terminology/value-sets?code=VS_BO_OCCUPATION';
const CATALOGO_ESPECIALIDADES = '/terminology/value-sets?code=VS_MEDICAL_SPECIALTY';

/** Un concepto de `VS_BO_OCCUPATION`, el que la ocupación manda como uuid. */
const OCUPACION_DOCENTE = 'a2f0b6d1-0f7d-5a2e-9d3b-6f1f0a9c1e42';

describe('RegisterPatient', () => {
  let fixture: ComponentFixture<RegisterPatient>;
  let component: RegisterPatient;
  let http: HttpTestingController;
  let navegaciones: string[];

  /**
   * Monta la pantalla para un tipo de alta.
   *
   * El tipo llega como **dato de la ruta** (`tipoDeCuenta`), no como una
   * pestaña dentro de la pantalla: cada alta tiene su URL desde que la rejilla
   * de `/auth/register` decide cuál es. Por eso una prueba de profesional monta
   * otro componente en vez de llamar a un método que cambie de modo.
   */
  async function montar(tipo: 'paciente' | 'profesional' = 'paciente'): Promise<void> {
    navegaciones = [];
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [RegisterPatient],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { tipoDeCuenta: tipo } } },
        },
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterPatient);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await montar('paciente');
  });

  afterEach(() => {
    // Los catálogos los pide el constructor, así que aparecen en TODAS las
    // pruebas. Las que no hablan de ellos los dan por atendidos acá, para que
    // `verify()` siga vigilando las peticiones que cada prueba sí afirma.
    //
    // Se saltean las canceladas: el árbol de municipios es un `forkJoin` de dos
    // lecturas, así que responder la primera con un catálogo vacío la hace
    // fallar y eso cancela la otra en el acto. Volcar una petición ya cancelada
    // es un error de `HttpTestingController`, no un fallo de la pantalla.
    for (const pendiente of http.match((r) => r.url.startsWith('/terminology/'))) {
      if (pendiente.cancelled) continue;
      pendiente.flush({ items: [] });
    }
    http.verify();
  });

  describe('catálogos', () => {
    it('un 401 no rompe el registro: deja el aviso y el formulario usable', () => {
      http.expectOne(CATALOGO).flush(null, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(component.catalogoDepartamentosCaido()).toBe(true);
      expect(component.opcionesDepartamento()).toEqual([]);
      // El registro sigue en pie: el 401 del catálogo no navega a ningún lado.
      expect(navegaciones).toEqual([]);
    });

    it('«Reintentar» vuelve a la red: el fallo cacheado no dura toda la sesión', () => {
      http.expectOne(CATALOGO).flush(null, { status: 401, statusText: 'Unauthorized' });

      // Acceso por índice: el método es `protected` porque lo llama la
      // plantilla, no una API pública del componente.
      component['reintentarDepartamentos']();

      // Sin `olvidar()`, `shareReplay` replicaría el error sin pedir nada y
      // esta expectativa no encontraría petición alguna.
      http.expectOne(CATALOGO).flush({
        items: [{ id: 'vs-1', internalCode: 'VS_BO_DEPARTMENT', name: 'Departamentos' }],
      });
      http.expectOne('/terminology/value-sets/vs-1/$expand?limit=200').flush({
        items: [{ conceptId: 'c-1', code: 'geo:bo:department:SC', display: 'Santa Cruz' }],
        count: 1,
        limit: 200,
        nextCursor: null,
      });

      expect(component.catalogoDepartamentosCaido()).toBe(false);
      expect(component.opcionesDepartamento()).toEqual([{ value: 'c-1', label: 'Santa Cruz' }]);
    });

    /**
     * El árbol es lo que hace elegible un catálogo de 340 opciones, y sale de
     * cruzar dos lecturas: el código del municipio dice de qué departamento
     * cuelga, porque la expansión de un conjunto no devuelve las propiedades
     * del concepto.
     */
    it('arma el árbol colgando cada municipio del departamento de su código INE', () => {
      http.expectOne(CATALOGO).flush({
        items: [{ id: 'vs-dep', internalCode: 'VS_BO_DEPARTMENT', name: 'Departamentos' }],
      });
      http.expectOne(CATALOGO_MUNICIPIOS).flush({
        items: [{ id: 'vs-mun', internalCode: 'VS_BO_MUNICIPALITY', name: 'Municipios' }],
      });
      http.expectOne('/terminology/value-sets/vs-dep/$expand?limit=200').flush({
        items: [
          { conceptId: 'd-cb', code: 'geo:bo:department:CB', display: 'Cochabamba' },
          { conceptId: 'd-sc', code: 'geo:bo:department:SC', display: 'Santa Cruz' },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });
      http.expectOne('/terminology/value-sets/vs-mun/$expand?limit=200').flush({
        items: [
          { conceptId: 'm-1', code: 'geo:bo:municipality:031001', display: 'Sacaba' },
          {
            conceptId: 'm-2',
            code: 'geo:bo:municipality:070101',
            display: 'Santa Cruz de la Sierra',
          },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });

      expect(component.catalogoMunicipiosCaido()).toBe(false);
      expect(component.arbolMunicipios()).toEqual([
        { label: 'Cochabamba', items: [{ value: 'm-1', label: 'Sacaba' }] },
        {
          label: 'Santa Cruz',
          items: [{ value: 'm-2', label: 'Santa Cruz de la Sierra' }],
        },
      ]);
    });

    /**
     * La ocupación dejó de ser texto libre: es un concepto de
     * `VS_BO_OCCUPATION`, así que lo que el desplegable ofrece sale de la
     * expansión y lo que se manda es el uuid.
     */
    it('ofrece las ocupaciones del catálogo de Bolivia', () => {
      http.expectOne(CATALOGO_OCUPACIONES).flush({
        items: [{ id: 'vs-occ', internalCode: 'VS_BO_OCCUPATION', name: 'Ocupaciones' }],
      });
      http.expectOne('/terminology/value-sets/vs-occ/$expand?limit=200').flush({
        items: [
          { conceptId: 'o-1', code: 'occupation:bo:DOCENTE', display: 'Docente' },
          { conceptId: 'o-2', code: 'occupation:bo:MINERO', display: 'Minero / Minera' },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });

      expect(component.catalogoOcupacionesCaido()).toBe(false);
      expect(component.opcionesOcupacion()).toEqual([
        { value: 'o-1', label: 'Docente' },
        { value: 'o-2', label: 'Minero / Minera' },
      ]);
    });

    it('sin catálogo de ocupaciones el alta sigue: el campo es opcional', () => {
      http
        .expectOne(CATALOGO_OCUPACIONES)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(component.catalogoOcupacionesCaido()).toBe(true);
      expect(component.opcionesOcupacion()).toEqual([]);
      expect(navegaciones).toEqual([]);
    });

    it('un departamento sin municipios no arma una rama vacía', () => {
      http.expectOne(CATALOGO).flush({
        items: [{ id: 'vs-dep', internalCode: 'VS_BO_DEPARTMENT', name: 'Departamentos' }],
      });
      http.expectOne(CATALOGO_MUNICIPIOS).flush({
        items: [{ id: 'vs-mun', internalCode: 'VS_BO_MUNICIPALITY', name: 'Municipios' }],
      });
      http.expectOne('/terminology/value-sets/vs-dep/$expand?limit=200').flush({
        items: [
          { conceptId: 'd-cb', code: 'geo:bo:department:CB', display: 'Cochabamba' },
          { conceptId: 'd-pd', code: 'geo:bo:department:PD', display: 'Pando' },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });
      http.expectOne('/terminology/value-sets/vs-mun/$expand?limit=200').flush({
        items: [{ conceptId: 'm-1', code: 'geo:bo:municipality:031001', display: 'Sacaba' }],
        count: 1,
        limit: 200,
        nextCursor: null,
      });

      // Una rama que solo se puede abrir para descubrir que no hay nada adentro
      // es peor que no estar.
      expect(component.arbolMunicipios().map((rama) => rama.label)).toEqual(['Cochabamba']);
    });
  });

  /**
   * El nombre va en sus cuatro partes, como el documento de identidad. Las dos
   * opcionales se completan acá para que el caso normal las ejerza; el que
   * comprueba que se omiten cuando están vacías es su propia prueba.
   */
  function completar(
    extra: Partial<Record<'email' | 'middleName' | 'motherLastName', string>> = {},
  ): void {
    component.formPaciente.patchValue({
      nationalId: '1234567',
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      password: 'secreto12',
      email: extra.email ?? '',
    });
  }

  function completarProfesional(
    extra: Partial<
      Record<
        | 'professionalTitle'
        | 'phone'
        | 'middleName'
        | 'motherLastName'
        | 'nationalId'
        | 'regulatoryAuthority'
        | 'specialtyPrimary'
        | 'specialtySecond'
        | 'specialtyThird',
        string
      >
    > = {},
  ): void {
    component.formProfesional.setValue({
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      nationalId: extra.nationalId ?? '',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      credentialNumber: 'TIT-6789',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      professionalTitle: extra.professionalTitle ?? '',
      phone: extra.phone ?? '',
      birthDate: null,
      licenseIssueDate: null,
      issuerAdministrativeAreaConceptId: null,
      specialtyPrimary: extra.specialtyPrimary ?? '',
      specialtySecond: extra.specialtySecond ?? '',
      specialtyThird: extra.specialtyThird ?? '',
    });
  }

  /**
   * Las páginas que declara la pantalla.
   *
   * Lo que se comprueba acá es **lo que esta pantalla decide**: qué se pregunta,
   * en qué orden y en cuántas páginas. Cómo se avanza, qué valida cada página,
   * qué hace «Atrás» y adónde lleva un campo inválido al enviar son del motor
   * (`app-paginated-form`) y tienen sus pruebas ahí: repetirlas acá sería fijar
   * dos veces la misma conducta y descubrir la diferencia el día que una de las
   * dos copias cambie.
   */
  describe('las páginas del alta de paciente', () => {
    it('son cuatro, y ninguna pide más de cuatro cosas', () => {
      const paginas = component.paginasPaciente();

      expect(paginas.length).toBe(4);
      for (const pagina of paginas) {
        expect(pagina.campos.length).toBeLessThanOrEqual(4);
      }
    });

    it('empieza por el documento: si ya hay cuenta, el choque salta en la primera', () => {
      const primera = component.paginasPaciente()[0];

      expect(primera.campos[0].key).toBe('nationalId');
      // Y la contraseña va al final: es lo único que no se corrige después
      // desde el perfil.
      const ultima = component.paginasPaciente().at(-1);
      expect(ultima?.campos.map((campo) => campo.key)).toContain('password');
    });

    /**
     * Un campo cuya `key` no existe en el `FormGroup` se ve como un campo que
     * no guarda nada — el peor fallo posible en un formulario. El motor lo avisa
     * por consola en desarrollo; acá se rompe la prueba.
     */
    it('cada campo escribe en un control que existe', () => {
      for (const pagina of component.paginasPaciente()) {
        for (const campo of pagina.campos) {
          if (campo.control === 'custom') continue;
          expect(
            component.formPaciente.get(campo.key),
            `el campo «${campo.key}» no existe en el formulario`,
          ).not.toBeNull();
        }
      }
    });

    /**
     * El árbol de municipios no lo dibuja el motor: es un campo `custom` que
     * proyecta esta pantalla. Si dejara de serlo, el motor le reservaría el
     * sitio y no pondría nada adentro.
     */
    it('el municipio va como campo proyectado', () => {
      const campos = component.paginasPaciente().flatMap((pagina) => pagina.campos);
      const municipio = campos.find((campo) => campo.key === 'municipio');

      expect(municipio?.control).toBe('custom');
    });

    it('el motor está montado y sirve la primera página', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;

      expect(html.querySelector('app-paginated-form')).not.toBeNull();
      // El documento se ve; la contraseña, que vive en la última página, no.
      expect(html.querySelector('[data-testid="registro-documento"]')).not.toBeNull();
      expect(html.querySelector('[data-testid="registro-password"]')).toBeNull();
    });

    /**
     * El departamento emisor es un `select` del motor mientras su catálogo
     * esté, y pasa a proyectado cuando la lectura falla: un desplegable vacío
     * no tiene dónde decir que no cargó.
     */
    it('el departamento cambia de `select` a proyectado si su catálogo se cae', () => {
      const antes = component
        .paginasPaciente()[0]
        .campos.find((campo) => campo.key === 'issuerAdministrativeAreaConceptId');
      expect(antes?.control).toBe('select');

      http.expectOne(CATALOGO).flush(null, { status: 401, statusText: 'Unauthorized' });

      const despues = component
        .paginasPaciente()[0]
        .campos.find((campo) => campo.key === 'issuerAdministrativeAreaConceptId');
      expect(despues?.control).toBe('custom');
    });
  });

  it('manda solo los campos obligatorios cuando no hay correo ni nombres opcionales', () => {
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.method).toBe('POST');
    // Un correo vacío no es lo mismo que no mandar el campo:
    // `forbidNonWhitelisted` rechaza lo que sobra. Mismo criterio para el
    // segundo nombre y el apellido materno, que mucha gente no tiene.
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      lastName: 'Paz',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  /**
   * El backend compone el nombre visible con las cuatro partes: si el frontend
   * mandara una cadena ya armada, la base guardaría una versión y el contrato
   * otra.
   */
  it('manda el segundo nombre y el apellido materno cuando se completaron', () => {
    completar({ middleName: 'María', motherLastName: 'Quiroga' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      middleName: 'María',
      lastName: 'Paz',
      motherLastName: 'Quiroga',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  it('incluye el correo cuando se completó', () => {
    completar({ email: 'ana@mantra.test' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.email).toBe('ana@mantra.test');

    req.flush({ ...RESPUESTA, emailVerificationSent: true });

    expect(component.verificationSent()).toBe(true);
  });

  it('manda los datos clínicos y de contacto que la API acepta, solo si se completaron', () => {
    completar();
    component.formPaciente.patchValue({
      phone: '+591 70012345',
      occupationConceptId: OCUPACION_DOCENTE,
    });
    component.formPaciente.patchValue({
      birthDate: new Date(1990, 4, 17),
      sexAtBirth: 'FEMALE',
      issuerAdministrativeAreaConceptId: DEPARTAMENTO_SANTA_CRUZ,
    });
    // El municipio sigue aparte: es el campo proyectado, el único que el motor
    // no escribe.
    component.municipioPaciente.set(MUNICIPIO_SACABA);
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toMatchObject({
      issuerAdministrativeAreaConceptId: DEPARTAMENTO_SANTA_CRUZ,
      // Sólo el municipio: el departamento de residencia lo deriva el backend
      // del código del INE, para que el par no pueda llegar incoherente.
      residenceMunicipalityConceptId: MUNICIPIO_SACABA,
      // Fecha local, no UTC: `new Date(1990, 4, 17).toISOString()` daría el 16
      // en cualquier huso al oeste de Greenwich, que es donde está Bolivia.
      birthDate: '1990-05-17',
      phone: '+591 70012345',
      sexAtBirth: 'FEMALE',
      occupationConceptId: OCUPACION_DOCENTE,
    });

    req.flush(RESPUESTA);
  });

  /**
   * El género administrativo salió del formulario: se preguntaba al lado del
   * sexo al nacer y la pantalla terminaba pidiendo dos veces algo que la
   * persona lee como lo mismo. El campo del DTO sigue existiendo; esta pantalla
   * no lo manda, y ausente no es lo mismo que vacío.
   */
  it('no manda género: el formulario ya no lo pregunta', () => {
    completar();
    component.formPaciente.controls.sexAtBirth.setValue('FEMALE');
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain('gender');
    expect(req.request.body.sexAtBirth).toBe('FEMALE');

    req.flush(RESPUESTA);
  });

  it('omite los campos nuevos que quedaron vacíos: `forbidNonWhitelisted` rechaza lo que sobra', () => {
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    const enviado = Object.keys(req.request.body as Record<string, unknown>);
    expect(enviado).not.toContain('issuerAdministrativeAreaConceptId');
    expect(enviado).not.toContain('residenceMunicipalityConceptId');
    expect(enviado).not.toContain('birthDate');
    expect(enviado).not.toContain('phone');
    expect(enviado).not.toContain('gender');
    expect(enviado).not.toContain('sexAtBirth');
    expect(enviado).not.toContain('occupationConceptId');
    expect(enviado).not.toContain('occupationFreeText');

    req.flush(RESPUESTA);
  });

  it('tras registrar muestra la confirmación y NO inicia sesión sola', () => {
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);

    expect(component.registered()).toBe(true);
    // El backend devuelve el perfil, no tokens: entrar solo exigiría un segundo
    // viaje con las credenciales recién escritas.
    expect(navegaciones).toEqual([]);
  });

  it('el botón de la confirmación lleva al login', () => {
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);

    component.goToLogin();

    expect(navegaciones).toEqual(['/auth']);
  });

  describe('alta de profesional', () => {
    beforeEach(async () => {
      await montar('profesional');
    });

    it('tiene seis páginas, ninguna de más de cuatro preguntas', () => {
      // Seis y no cinco porque el límite es de campos por página, no de
      // páginas: apretar seis en una para tener una página menos es lo que
      // este motor vino a deshacer. La sexta son las especialidades, que
      // entraron con página propia por esa misma regla.
      const paginas = component.paginasProfesional();

      expect(paginas.length).toBe(6);
      for (const pagina of paginas) {
        expect(pagina.campos.length).toBeLessThanOrEqual(4);
      }
    });

    it('cada campo escribe en un control que existe', () => {
      for (const pagina of component.paginasProfesional()) {
        for (const campo of pagina.campos) {
          if (campo.control === 'custom') continue;
          expect(
            component.formProfesional.get(campo.key),
            `el campo «${campo.key}» no existe en el formulario`,
          ).not.toBeNull();
        }
      }
    });

    /**
     * Las especialidades EN el alta — registro del cliente, módulo Médico §1.4.2
     * y §1.4.4.
     *
     * Lo que fijan: que se ofrecen las de la profesión elegida y no las otras
     * (un odontólogo no es cardiólogo), que el colegio cambia solo sin pisar una
     * elección explícita, y que los conceptos VIAJAN en el cuerpo — el cliente
     * lo arma nombre por nombre y descarta en silencio lo que no nombra.
     */
    describe('las especialidades del alta', () => {
      /** Responde el catálogo con dos médicas y dos odontológicas. */
      function catalogoDeEspecialidades(): void {
        http.expectOne(CATALOGO_ESPECIALIDADES).flush({
          items: [{ id: 'vs-esp', internalCode: 'VS_MEDICAL_SPECIALTY', name: 'Especialidades' }],
        });
        http.expectOne('/terminology/value-sets/vs-esp/$expand?limit=200').flush({
          items: [
            { conceptId: 'e-cardio', code: 'CARDIOLOGIA', display: 'Cardiología' },
            { conceptId: 'e-pedia', code: 'PEDIATRIA', display: 'Pediatría' },
            { conceptId: 'e-endo', code: 'ENDODONCIA', display: 'Endodoncia' },
            { conceptId: 'e-orto', code: 'ORTODONCIA', display: 'Ortodoncia' },
          ],
          count: 4,
          limit: 200,
          nextCursor: null,
        });
      }

      function opcionesDeLaPagina(): readonly { value: string; label: string }[] {
        const pagina = component
          .paginasProfesional()
          .find((p) => p.titulo === 'Tus especialidades');
        return (pagina?.campos[0].options ?? []) as readonly {
          value: string;
          label: string;
        }[];
      }

      it('un odontólogo ve las odontológicas y NO las médicas', () => {
        catalogoDeEspecialidades();
        component.formProfesional.controls.professionalTitle.setValue(
          'Odontólogo / Odontóloga',
        );
        fixture.detectChanges();

        const valores = opcionesDeLaPagina().map((o) => o.value);
        expect(valores).toEqual(['e-endo', 'e-orto']);
      });

      it('un médico ve las médicas y NO las odontológicas', () => {
        catalogoDeEspecialidades();
        component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
        fixture.detectChanges();

        const valores = opcionesDeLaPagina().map((o) => o.value);
        expect(valores).toEqual(['e-cardio', 'e-pedia']);
      });

      it('el colegio cambia solo al elegir la profesión', () => {
        catalogoDeEspecialidades();
        const autoridad = component.formProfesional.controls.regulatoryAuthority;

        component.formProfesional.controls.professionalTitle.setValue(
          'Odontólogo / Odontóloga',
        );
        expect(autoridad.value).toBe('Colegio de Odontólogos de Bolivia');

        component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');
        expect(autoridad.value).toBe('Colegio Médico de Bolivia');
      });

      it('pero NO pisa una autoridad elegida a mano', () => {
        // El automatismo es una ayuda, no una regla: quien eligió SEDES sabe
        // por qué, y verlo cambiar solo sería peor que no tener automatismo.
        catalogoDeEspecialidades();
        const autoridad = component.formProfesional.controls.regulatoryAuthority;
        autoridad.setValue('Servicio Departamental de Salud (SEDES)');

        component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

        expect(autoridad.value).toBe('Servicio Departamental de Salud (SEDES)');
      });

      it('cambiar de profesión limpia una especialidad que ya no corresponde', () => {
        // Un desplegable con un valor que no está entre sus opciones muestra un
        // vacío que miente: parece que no elegiste y el cuerpo lo manda igual.
        catalogoDeEspecialidades();
        component.formProfesional.controls.professionalTitle.setValue(
          'Odontólogo / Odontóloga',
        );
        component.formProfesional.controls.specialtyPrimary.setValue('e-endo');

        component.formProfesional.controls.professionalTitle.setValue('Médico / Médica');

        expect(component.formProfesional.controls.specialtyPrimary.value).toBe('');
      });

      it('las especialidades elegidas VIAJAN en el cuerpo, en orden', () => {
        catalogoDeEspecialidades();
        completarProfesional({
          professionalTitle: 'Médico / Médica',
          specialtyPrimary: 'e-cardio',
          specialtySecond: 'e-pedia',
        });
        component.submit();

        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio', 'e-pedia']);
        req.flush(RESPUESTA_PRO);
      });

      it('sin especialidades el cuerpo no las menciona', () => {
        catalogoDeEspecialidades();
        completarProfesional();
        component.submit();

        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.specialtyConceptIds).toBeUndefined();
        req.flush(RESPUESTA_PRO);
      });

      it('elegir la misma dos veces declara una', () => {
        catalogoDeEspecialidades();
        completarProfesional({
          professionalTitle: 'Médico / Médica',
          specialtyPrimary: 'e-cardio',
          specialtySecond: 'e-cardio',
        });
        component.submit();

        const req = http.expectOne('/iam/auth/register-practitioner');
        expect(req.request.body.specialtyConceptIds).toEqual(['e-cardio']);
        req.flush(RESPUESTA_PRO);
      });
    });

    it('va a otro endpoint y manda los cinco campos obligatorios', () => {
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.method).toBe('POST');
      // El identificador de acceso es el correo, no el documento. El nombre va
      // en partes, igual que en el alta de paciente.
      expect(req.request.body).toEqual({
        name: 'Ana',
        lastName: 'Paz',
        email: 'ana@hospital.test',
        password: 'secreto12',
        licenseNumber: 'MP-12345',
        credentialNumber: 'TIT-6789',
      });

      req.flush(RESPUESTA_PRO);
    });

    it('agrega segundo nombre y apellido materno solo si se completaron', () => {
      completarProfesional({ middleName: 'Lucía', motherLastName: 'Rojas' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.middleName).toBe('Lucía');
      expect(req.request.body.motherLastName).toBe('Rojas');

      req.flush(RESPUESTA_PRO);
    });

    it('agrega título y teléfono solo si se completaron', () => {
      completarProfesional({ professionalTitle: 'Cardiología', phone: '+591 70012345' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.professionalTitle).toBe('Cardiología');
      expect(req.request.body.phone).toBe('+591 70012345');

      req.flush(RESPUESTA_PRO);
    });

    it('manda el municipio de residencia, sin su departamento', () => {
      completarProfesional();
      component.municipioProfesional.set(MUNICIPIO_SACABA);
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.residenceMunicipalityConceptId).toBe(MUNICIPIO_SACABA);
      expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain(
        'residenceAdministrativeAreaConceptId',
      );

      req.flush(RESPUESTA_PRO);
    });

    it('exige matrícula y credencial: sin habilitación no hay alta', () => {
      completarProfesional();
      component.formProfesional.patchValue({ licenseNumber: '', credentialNumber: '' });
      component.submit();

      expect(component.formProfesional.controls.licenseNumber.touched).toBe(true);
      // A qué página lleva un campo inválido lo decide el motor, y lo fija su
      // propia prueba. Acá lo que importa es que no se gastó un viaje a la API:
      // lo confirma el `verify()` del `afterEach`.
    });

    it('la confirmación dice que se entra con el correo, no con el documento', () => {
      completarProfesional();
      component.submit();
      http.expectOne('/iam/auth/register-practitioner').flush(RESPUESTA_PRO);

      expect(component.registered()).toBe(true);
      expect(component.accessHint()).toBe('tu correo');
    });
  });

  describe('validaciones', () => {
    it('no envía con el formulario incompleto', () => {
      component.formPaciente.patchValue({
        nationalId: '',
        name: '',
        middleName: '',
        lastName: '',
        motherLastName: '',
        password: '',
        email: '',
      });
      component.submit();

      expect(component.formPaciente.controls.nationalId.touched).toBe(true);
    });

    it('rechaza un documento con caracteres que el backend no admite', () => {
      component.formPaciente.patchValue({
        nationalId: 'ABC 123',
        name: 'Ana',
        middleName: '',
        lastName: 'Paz',
        motherLastName: '',
        password: 'secreto12',
        email: '',
      });

      // Mismo `@Matches` que el DTO: letras, dígitos, punto y guion.
      expect(component.formPaciente.controls.nationalId.invalid).toBe(true);
    });

    it('exige los 8 caracteres de contraseña que pide el backend', () => {
      component.formPaciente.patchValue({
        nationalId: '1234567',
        name: 'Ana',
        middleName: '',
        lastName: 'Paz',
        motherLastName: '',
        password: 'corta',
        email: '',
      });

      expect(component.formPaciente.controls.password.invalid).toBe(true);
    });

    /**
     * Antes lo limpiaba el «Siguiente» de esta pantalla, que ahora es del
     * motor. Se ata a lo único que de verdad significa «estoy corrigiendo»: que
     * el formulario cambie. Eso cubre además el caso que el avance no cubría —
     * corregir en la misma página donde falló el envío.
     */
    it('corregir algo limpia el error del intento anterior', () => {
      completar();
      component.submit();
      http
        .expectOne('/iam/auth/register-patient')
        .flush(null, { status: 409, statusText: 'Conflict' });
      expect(component.errorMessage()).not.toBeNull();

      component.formPaciente.controls.nationalId.setValue('7654321');

      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('errores', () => {
    it('CONFLICT muestra el mensaje que manda la API', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe una cuenta con ese documento',
          timestamp: 't',
          path: '/iam/auth/register-patient',
        },
        { status: 409, statusText: 'Conflict' },
      );

      // El texto sale del catálogo, no de una redacción nuestra: el backend
      // declara `message` como el mensaje de negocio.
      expect(component.errorMessage()).toBe('Ya existe una cuenta con ese documento');
      expect(component.registered()).toBe(false);
    });

    it('VALIDATION_FAILED expone el primer problema de la lista', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(
        {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: { messages: ['password is too short'] },
          timestamp: 't',
          path: '/iam/auth/register-patient',
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.errorMessage()).toBe('password is too short');
    });

    it('sin conexión lo dice como tal', () => {
      completar();
      component.submit();
      http
        .expectOne('/iam/auth/register-patient')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.errorMessage()).toContain('conexión');
    });
  });
});
