import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { RegisterPatient } from './register-patient';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';

const RESPUESTA = {
  userId: 'u-1',
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  emailVerificationSent: false,
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

/** La del catálogo de empresas de Bolivia, que dispara el mismo constructor. */
const CATALOGO_EMPRESAS = '/terminology/value-sets?code=VS_BO_EMPLOYER';

/** Dos conceptos de `VS_BO_EMPLOYER`: una empresa de la lista, y la salida. */
const EMPRESA_ENTEL = 'b31c7e4a-2d55-5e91-8a4c-1c7f2b9d3e07';
const EMPRESA_OTRA = 'c47d8f5b-3e66-5fa2-9b5d-2d8f3cae4f18';

/** Un concepto de `VS_BO_OCCUPATION`, el que la ocupación manda como uuid. */
const OCUPACION_DOCENTE = 'a2f0b6d1-0f7d-5a2e-9d3b-6f1f0a9c1e42';

describe('RegisterPatient', () => {
  let fixture: ComponentFixture<RegisterPatient>;
  let component: RegisterPatient;
  let http: HttpTestingController;
  let navegaciones: string[];

  /**
   * Monta la pantalla.
   *
   * Sin `ActivatedRoute` falso: cada alta tiene su URL y su componente desde
   * que el alta de profesional se separó a `register-practitioner`, así que el
   * tipo de cuenta ya no viaja como dato de ruta ni se lee desde acá.
   */
  async function montar(): Promise<void> {
    navegaciones = [];
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [RegisterPatient],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
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
    await montar();
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
    for (const pendiente of http.match(
      (r) =>
        r.url.startsWith('/terminology/') ||
        // El catálogo de aseguradoras lo pide el mismo constructor, para los
        // dos campos de seguro declarado.
        r.url.startsWith('/insurance-carrier-catalog'),
    )) {
      if (pendiente.cancelled) continue;
      // Cada catálogo tiene su forma; el cuerpo lleva las dos claves para que
      // ninguno de los dos lectores encuentre `undefined`.
      pendiente.flush({ items: [], carriers: [] });
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
      // El `code` viaja además del uuid: es lo que distingue a «Otra ocupación»
      // —la salida que abre el campo escrito a mano— del resto de la lista.
      expect(component.opcionesOcupacion()).toEqual([
        { value: 'o-1', label: 'Docente', code: 'occupation:bo:DOCENTE' },
        { value: 'o-2', label: 'Minero / Minera', code: 'occupation:bo:MINERO' },
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
    extra: Partial<
      Record<
        | 'email'
        | 'middleName'
        | 'thirdName'
        | 'motherLastName'
        | 'homeAddressLines'
        | 'workEmployerFreeText'
        | 'guardianName'
        | 'guardianPhone'
        | 'billingTaxId',
        string
      >
    > = {},
  ): void {
    component.formPaciente.patchValue({
      nationalId: '1234567',
      name: 'Ana',
      middleName: extra.middleName ?? '',
      thirdName: extra.thirdName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      password: 'secreto12',
      email: extra.email ?? '',
      homeAddressLines: extra.homeAddressLines ?? '',
      workEmployerFreeText: extra.workEmployerFreeText ?? '',
      guardianName: extra.guardianName ?? '',
      guardianPhone: extra.guardianPhone ?? '',
      billingTaxId: extra.billingTaxId ?? '',
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
    it('son nueve, y ninguna pide más de cuatro cosas', () => {
      const paginas = component.paginasPaciente();

      // Ocho desde que el alta cubre los campos mínimos del registro del
      // cliente: domicilio, trabajo, seguros y tutor son cuatro páginas más.
      // El tope es de campos por página, no de páginas: los tres nombres van
      // en un campo proyectado para que los apellidos entren en la misma.
      expect(paginas.length).toBe(8);
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

  it('manda el tercer nombre concatenado en middleName cuando se completó', () => {
    completar({ middleName: 'María', thirdName: 'Eugenia', motherLastName: 'Quiroga' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      middleName: 'María Eugenia',
      lastName: 'Paz',
      motherLastName: 'Quiroga',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  /**
   * Las casillas que se agregan con el botón viven sólo en la pantalla: la base
   * no tiene una columna por nombre. Todas terminan en `middleName`, separadas
   * por espacio y sin las que quedaron vacías.
   */
  it('manda los nombres agregados dentro de middleName', () => {
    completar({ middleName: 'María', thirdName: 'Eugenia' });
    component.agregarNombre();
    component.agregarNombre();
    component.agregarNombre();
    component.escribirNombreExtra(0, 'Fernanda');
    // La del medio queda vacía a propósito: no debe dejar un doble espacio.
    component.escribirNombreExtra(2, 'Belén');
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      middleName: 'María Eugenia Fernanda Belén',
      lastName: 'Paz',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  /**
   * «Dejar uno al final libre para que él pueda detallar la ocupación que no
   * encontró» (registro del cliente, módulo Paciente §1.4.1). Con «Otra
   * ocupación» elegida viaja el oficio escrito y NO el concepto: el backend
   * descarta el texto libre en cuanto recibe un concepto, y de los dos datos el
   * que describe un oficio es el que la persona escribió.
   */
  it('con «Otra ocupación» manda el oficio escrito en vez del concepto', () => {
    component.opcionesOcupacion.set([
      { value: 'o-otra', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
    ]);
    completar({});
    component.elegirOcupacion({ value: 'o-otra', label: 'Otra ocupación' });
    component.formPaciente.controls.occupationFreeText.setValue('Apicultor');
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      lastName: 'Paz',
      password: 'secreto12',
      occupationFreeText: 'Apicultor',
    });

    req.flush(RESPUESTA);
  });

  it('con una ocupación de la lista manda el concepto y ningún texto libre', () => {
    component.opcionesOcupacion.set([
      { value: 'o-1', label: 'Docente', code: 'occupation:bo:DOCENTE' },
    ]);
    completar({});
    component.elegirOcupacion({ value: 'o-1', label: 'Docente' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      lastName: 'Paz',
      password: 'secreto12',
      occupationConceptId: 'o-1',
    });

    req.flush(RESPUESTA);
  });

  /**
   * La edad sale sola de la fecha (registro del cliente, módulo Paciente §1.5).
   * Se cuenta por cumpleaños: el día anterior al cumpleaños todavía se tiene un
   * año menos.
   */
  describe('la edad que sale de la fecha de nacimiento', () => {
    it('sin fecha no dice nada', () => {
      expect(component.edadEnPalabras()).toBeNull();
    });

    it('cuenta los años cumplidos', () => {
      const hoy = new Date();
      const fecha = new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate());
      component.formPaciente.controls.birthDate.setValue(fecha);

      expect(component.edadEnPalabras()).toBe('Tenés 30 años.');
    });

    it('el día antes del cumpleaños todavía es un año menos', () => {
      const hoy = new Date();
      // Mañana, treinta años atrás: el cumpleaños aún no llegó.
      const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
      const fecha = new Date(hoy.getFullYear() - 30, manana.getMonth(), manana.getDate());
      component.formPaciente.controls.birthDate.setValue(fecha);

      expect(component.edadEnPalabras()).toBe(
        manana.getFullYear() === hoy.getFullYear() ? 'Tenés 29 años.' : 'Tenés 30 años.',
      );
    });

    it('el primer año va en singular', () => {
      const hoy = new Date();
      const fecha = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
      component.formPaciente.controls.birthDate.setValue(fecha);

      expect(component.edadEnPalabras()).toBe('Tenés 1 año.');
    });
  });

  it('quitar una casilla agregada saca ese nombre y deja los otros', () => {
    component.agregarNombre();
    component.agregarNombre();
    component.escribirNombreExtra(0, 'Fernanda');
    component.escribirNombreExtra(1, 'Belén');

    component.quitarNombre(0);

    expect(component.nombresExtra()).toEqual(['Belén']);
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
    // Y los del alta completa: calle, coordenadas, trabajo, tutor, seguros, NIT.
    expect(enviado).not.toContain('homeAddressLines');
    expect(enviado).not.toContain('homeLatitude');
    expect(enviado).not.toContain('workEmployerConceptId');
    expect(enviado).not.toContain('workEmployerFreeText');
    expect(enviado).not.toContain('guardianName');
    expect(enviado).not.toContain('guardianPhone');
    expect(enviado).not.toContain('privateInsurancePlanId');
    expect(enviado).not.toContain('publicInsurancePlanId');
    expect(enviado).not.toContain('billingTaxId');

    req.flush(RESPUESTA);
  });

  it('manda la calle y el NIT cuando se completaron', () => {
    completar({ homeAddressLines: '  Av. Banzer #42  ', billingTaxId: ' 1023456789 ' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    // Recortados: un espacio de más no es parte de la dirección ni del NIT.
    expect(req.request.body.homeAddressLines).toBe('Av. Banzer #42');
    expect(req.request.body.billingTaxId).toBe('1023456789');

    req.flush(RESPUESTA);
  });

  /**
   * El punto capturado **no** es todavía una dirección: el navegador acierta la
   * manzana, no la puerta, y lo que se muestra es el mapa para que alguien lo
   * mire. Hasta que lo confirma, no viaja — que es justamente lo que el par de
   * coordenadas en pantalla no permitía comprobar.
   */
  it('no manda la ubicación capturada mientras no se confirme en el mapa', () => {
    completar();
    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    const enviado = Object.keys(req.request.body as Record<string, unknown>);
    expect(enviado).not.toContain('homeLatitude');
    expect(enviado).not.toContain('homeLongitude');

    req.flush(RESPUESTA);
  });

  it('manda la ubicación como par de coordenadas una vez confirmada', () => {
    completar();
    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    component.confirmarDireccionActual();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.homeLatitude).toBe(-17.7833);
    expect(req.request.body.homeLongitude).toBe(-63.1821);

    req.flush(RESPUESTA);
  });

  it('sin punto capturado no hay nada que confirmar', () => {
    completar();
    component.confirmarDireccionActual();
    expect(component.direccionConfirmada()).toBe(false);

    component.submit();
    const req = http.expectOne('/iam/auth/register-patient');
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain('homeLatitude');
    req.flush(RESPUESTA);
  });

  /**
   * Volver a ubicarse invalida lo confirmado: lo que se dio por bueno era el
   * punto anterior, y el que está por llegar todavía no lo miró nadie.
   */
  it('quitar la ubicación se lleva también su confirmación', () => {
    completar();
    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    component.confirmarDireccionActual();
    expect(component.direccionConfirmada()).toBe(true);

    component.quitarUbicacion();
    expect(component.gpsDomicilio()).toBeNull();
    expect(component.direccionConfirmada()).toBe(false);

    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);
  });

  /**
   * El pin es lo único que el mapa necesita, y lo que reemplazó al par de
   * números: sin punto no hay pin, con punto hay uno solo.
   */
  it('el mapa recibe un pin, y ninguno mientras no haya punto', () => {
    expect(component.pinesDomicilio()).toEqual([]);

    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    const pines = component.pinesDomicilio();
    expect(pines).toHaveLength(1);
    expect(pines[0].lat).toBe(-17.7833);
    expect(pines[0].lng).toBe(-63.1821);
  });

  /* ---- La empresa, que reemplazó a la ubicación del trabajo ---- */

  /**
   * Deja el catálogo de empresas atendido y sus opciones cargadas.
   *
   * Es el mismo baile que el de ocupaciones: la lectura la dispara el
   * constructor, así que la prueba responde la que ya está esperando.
   */
  function responderEmpresas(): void {
    http.expectOne(CATALOGO_EMPRESAS).flush({
      items: [{ id: 'vs-emp', internalCode: 'VS_BO_EMPLOYER', name: 'Empresas' }],
    });
    http.expectOne('/terminology/value-sets/vs-emp/$expand?limit=200').flush({
      items: [
        {
          conceptId: EMPRESA_ENTEL,
          code: 'employer:bo:ENTEL',
          display: 'Entel',
          codeSystemVersionId: 'csv-1',
        },
        {
          conceptId: EMPRESA_OTRA,
          code: 'employer:bo:OTRA',
          display: 'Otra empresa (la escribo)',
          codeSystemVersionId: 'csv-1',
        },
      ],
      count: 2,
      limit: 200,
      nextCursor: null,
    });
  }

  it('manda la empresa elegida como concepto del catálogo', () => {
    responderEmpresas();
    completar();
    component.elegirEmpresa({ value: EMPRESA_ENTEL, label: 'Entel' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.workEmployerConceptId).toBe(EMPRESA_ENTEL);
    // La empresa reemplazó a la dirección del trabajo: nada de eso viaja ya.
    const enviado = Object.keys(req.request.body as Record<string, unknown>);
    expect(enviado).not.toContain('workAddressLines');
    expect(enviado).not.toContain('workMunicipalityConceptId');
    expect(enviado).not.toContain('workLatitude');

    req.flush(RESPUESTA);
  });

  /**
   * El texto libre es la salida de «no está en la lista», y sólo acompaña al
   * concepto que la representa: con cualquier otra empresa elegida sería un
   * nombre que contradice al catálogo.
   */
  it('«Otra empresa» habilita el nombre escrito a mano y lo manda', () => {
    responderEmpresas();
    completar({ workEmployerFreeText: '  Ferretería San Martín  ' });
    component.elegirEmpresa({ value: EMPRESA_OTRA, label: 'Otra empresa (la escribo)' });
    expect(component.empresaEsOtra()).toBe(true);

    component.submit();
    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.workEmployerConceptId).toBe(EMPRESA_OTRA);
    // Recortado, como la calle y el NIT.
    expect(req.request.body.workEmployerFreeText).toBe('Ferretería San Martín');

    req.flush(RESPUESTA);
  });

  it('cambiar de «Otra empresa» a una del catálogo borra el nombre escrito', () => {
    responderEmpresas();
    completar({ workEmployerFreeText: 'Ferretería San Martín' });
    component.elegirEmpresa({ value: EMPRESA_OTRA, label: 'Otra empresa (la escribo)' });
    component.elegirEmpresa({ value: EMPRESA_ENTEL, label: 'Entel' });

    expect(component.formPaciente.controls.workEmployerFreeText.value).toBe('');
    expect(component.empresaEsOtra()).toBe(false);

    component.submit();
    const req = http.expectOne('/iam/auth/register-patient');
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain(
      'workEmployerFreeText',
    );
    req.flush(RESPUESTA);
  });

  /** Un catálogo caído no frena el alta: el campo es opcional. */
  it('si el catálogo de empresas no carga, el alta sigue', () => {
    http.expectOne(CATALOGO_EMPRESAS).flush('vacío', { status: 500, statusText: 'Server Error' });
    expect(component.catalogoEmpresasCaido()).toBe(true);

    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);
  });

  it('no deja enviar un teléfono de tutor sin su nombre', () => {
    completar({ guardianPhone: '+591 71234567' });
    component.submit();

    // Sería un contacto sin dueño: el formulario no llega ni a salir.
    http.expectNone('/iam/auth/register-patient');
  });

  it('manda al tutor completo cuando tiene nombre y teléfono', () => {
    completar({ guardianName: 'Rosa Quispe', guardianPhone: '+591 71234567' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.guardianName).toBe('Rosa Quispe');
    expect(req.request.body.guardianPhone).toBe('+591 71234567');

    req.flush(RESPUESTA);
  });

  it('marca el teléfono del tutor como inválido si falta el nombre', () => {
    completar({ guardianPhone: '+591 71234567' });

    expect(
      component.formPaciente.controls.guardianPhone.hasError('tutorSinNombre'),
    ).toBe(true);

    // Y el error se va en cuanto se escribe el nombre.
    component.formPaciente.controls.guardianName.setValue('Rosa Quispe');
    expect(
      component.formPaciente.controls.guardianPhone.hasError('tutorSinNombre'),
    ).toBe(false);
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
