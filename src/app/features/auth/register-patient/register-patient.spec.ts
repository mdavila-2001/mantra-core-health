import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { RegisterPatient } from './register-patient';
import { CODIGO_OCUPACION_OTRA } from '../../../core/data-access/terminology/bo-occupations.service';
import { CODIGO_EMPRESA_OTRA } from '../../../core/data-access/terminology/bo-employers.service';
import { EMPLEADOR, OCUPACION } from '../../../core/mock/fixtures/conceptos';
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

/** Otro del mismo departamento, para poder corregir la localidad elegida. */
const MUNICIPIO_QUILLACOLLO = '3b90e5c7-1a44-5f2d-8c76-9e0b4d17af52';

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

/**
 * La lectura del catálogo de parentescos, que dispara el mismo constructor.
 *
 * Es la única de esta pantalla que va por **campo destino** y no por código de
 * conjunto de valores: `profiles.related_persons.relationship_concept_id`
 * declara enumeración dinámica, así que la API la sirve desde `system_context`.
 */
const CATALOGO_PARENTESCOS =
  '/system-context/dynamic-enums?target=profiles.related_persons.relationship_concept_id';

/** Un concepto de `related-person-relationship`: madre. */
const PARENTESCO_MADRE = 'd7c1a94e-5b32-5d68-9f11-3ac52e8b6d40';

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
        r.url.startsWith('/insurance-carrier-catalog') ||
        // Y el de parentescos del contacto de emergencia, que es el único que
        // se lee por campo destino en vez de por código de conjunto: su columna
        // declara enumeración dinámica.
        r.url.startsWith('/system-context/dynamic-enums'),
    )) {
      if (pendiente.cancelled) continue;
      // Cada catálogo tiene su forma; el cuerpo lleva las tres claves para que
      // ninguno de los lectores encuentre `undefined`.
      pendiente.flush({ items: [], carriers: [], options: [] });
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
    it('arma el árbol con los códigos canónicos y los legados de la base reconstruida', () => {
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
          { conceptId: 'd-pd', code: 'geo:bo:department:PD', display: 'Pando' },
        ],
        count: 3,
        limit: 200,
        nextCursor: null,
      });
      http.expectOne('/terminology/value-sets/vs-mun/$expand?limit=200').flush({
        items: [
          { conceptId: 'm-1', code: 'geo:bo:municipality:031001', display: 'Sacaba' },
          // Códigos legados: la base reconstruida los conserva y el resolver
          // tiene que aceptarlos, o esas filas desaparecen del selector aunque
          // los 340 municipios estén publicados. Cobija además ejercita la
          // equivalencia `PA` → `PD` del catálogo viejo para Pando.
          {
            conceptId: 'm-2',
            code: 'SC-SANTA-CRUZ',
            display: 'Santa Cruz de la Sierra',
          },
          { conceptId: 'm-3', code: 'PA-COBIJA', display: 'Cobija' },
        ],
        count: 3,
        limit: 200,
        nextCursor: null,
      });

      expect(component.catalogoMunicipiosCaido()).toBe(false);
      // Lo que se guarda ahora son las ramas del catálogo tal cual, sin
      // traducir a los grupos de `app-tree-select`: quien las dibuja es
      // `app-location-picker`, que necesita la rama entera —con la sigla del
      // departamento— para acotar el select de ciudad al departamento pulsado
      // en el mapa (AC-03-7).
      expect(
        component.ramasMunicipios().map((rama) => ({
          sigla: rama.sigla,
          nombre: rama.nombre,
          municipios: rama.municipios.map((municipio) => municipio.nombre),
        })),
      ).toEqual([
        { sigla: 'CB', nombre: 'Cochabamba', municipios: ['Sacaba'] },
        { sigla: 'SC', nombre: 'Santa Cruz', municipios: ['Santa Cruz de la Sierra'] },
        { sigla: 'PD', nombre: 'Pando', municipios: ['Cobija'] },
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
      expect(component.ramasMunicipios().map((rama) => rama.nombre)).toEqual(['Cochabamba']);
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
        | 'phone'
        | 'middleName'
        | 'thirdName'
        | 'motherLastName'
        | 'homeAddressLines'
        | 'workAddressLines'
        | 'workEmployerFreeText'
        | 'guardianName'
        | 'guardianPhone'
        | 'billingTaxId'
        | 'billingLegalName',
        string
      >
    > = {},
  ): void {
    completarDatosPersonales(extra);
    // La localidad de residencia pasa por su método: escribe el control **y**
    // el signal que lo espeja, y es el único que escribe los dos.
    component.elegirMunicipio(MUNICIPIO_SACABA);
  }

  /**
   * Todo lo de {@link completar} **menos la localidad**, para las pruebas que
   * la eligen en pantalla —mapa y select— y no por el método.
   */
  function completarDatosPersonales(extra: Parameters<typeof completar>[0] = {}): void {
    component.formPaciente.patchValue({
      nationalId: '1234567',
      name: 'Ana',
      middleName: extra.middleName ?? '',
      thirdName: extra.thirdName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      password: 'secreto12',
      // Los cinco que AC-03-3 volvió obligatorios se completan acá: sin ellos
      // el formulario es inválido y `submit()` no llega a salir, así que toda
      // prueba de envío los necesita. El que comprueba que cada uno frena el
      // alta es su propia prueba, más abajo.
      email: extra.email ?? 'ana@ejemplo.test',
      phone: extra.phone ?? '+591 70012345',
      birthDate: new Date(1990, 4, 17),
      sexAtBirth: 'FEMALE',
      // El departamento que expidió la cédula es la otra mitad del documento
      // y también es obligatorio: sin él el formulario no pasa de su página.
      issuerAdministrativeAreaConceptId: DEPARTAMENTO_SANTA_CRUZ,
      homeAddressLines: extra.homeAddressLines ?? '',
      workAddressLines: extra.workAddressLines ?? '',
      workEmployerFreeText: extra.workEmployerFreeText ?? '',
      guardianName: extra.guardianName ?? '',
      guardianPhone: extra.guardianPhone ?? '',
      billingTaxId: extra.billingTaxId ?? '',
      billingLegalName: extra.billingLegalName ?? '',
    });
  }

  /**
   * Lleva el formulario hasta la página que se le pida, pulsando «Siguiente».
   *
   * Se navega **por el motor** y no fijando un índice a mano: es él quien decide
   * qué página se dibuja, y sólo deja avanzar con la actual válida. Por eso hace
   * falta {@link completar} antes: sin los obligatorios, el primer «Siguiente»
   * no mueve nada y la prueba miraría una página que no es.
   *
   * @param clave - La `clave` de la página buscada, no su título.
   */
  function avanzarHasta(clave: string): void {
    const destino = component.paginasPaciente().findIndex((p) => p.clave === clave);
    expect(destino, `no existe la página «${clave}»`).toBeGreaterThan(-1);

    fixture.detectChanges();
    for (let paso = 0; paso < destino; paso += 1) {
      const siguiente = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-testid="paginated-form-continuar"]',
      );
      siguiente?.click();
      fixture.detectChanges();
    }

    expect(component.claveVisible(), 'el motor no llegó a la página pedida').toBe(clave);
  }

  /**
   * Lo que **siempre** viaja desde que AC-03-3 fijó los obligatorios.
   *
   * Existe para que cada prueba de envío diga sólo lo suyo: sin esto, las nueve
   * que comprueban un campo concreto tendrían que repetir los nueve
   * obligatorios, y agregar un obligatorio décimo sería tocar las nueve.
   */
  const OBLIGATORIOS_ENVIADOS = {
    nationalId: '1234567',
    name: 'Ana',
    lastName: 'Paz',
    password: 'secreto12',
    email: 'ana@ejemplo.test',
    phone: '+591 70012345',
    // Fecha local, no UTC: `new Date(1990, 4, 17).toISOString()` daría el 16 en
    // cualquier huso al oeste de Greenwich, que es donde está Bolivia.
    birthDate: '1990-05-17',
    sexAtBirth: 'FEMALE',
    // La otra mitad del documento, obligatoria desde que la cédula y su
    // expedición dejaron de poder llegar separadas.
    issuerAdministrativeAreaConceptId: DEPARTAMENTO_SANTA_CRUZ,
    residenceMunicipalityConceptId: MUNICIPIO_SACABA,
  };

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
    /**
     * AC-03-2, el tope que no se relaja. Diez páginas: el tope es de **campos
     * por página**, no de páginas, y apretar el orden pedido en menos pasos es
     * exactamente lo que este motor vino a deshacer. Los tres nombres siguen
     * yendo en un campo proyectado para que los apellidos entren en la misma.
     */
    it('ninguna página pide más de cuatro cosas', () => {
      const paginas = component.paginasPaciente();

      expect(paginas.length).toBe(10);
      for (const pagina of paginas) {
        expect(
          pagina.campos.length,
          `«${pagina.titulo}» pide ${pagina.campos.length}`,
        ).toBeLessThanOrEqual(4);
      }
    });

    /**
     * Diez páginas pasan el tope de rótulos del indicador, así que hasta ahora
     * el alta se recorría con un «Paso 1 de 10» y nada más. Con el recorrido
     * compacto vuelven los diez marcadores: dónde está la persona, cuánto lleva
     * hecho y a qué paso puede volver, que un contador no dice.
     */
    it('el recorrido se ve entero, en su forma compacta', () => {
      const html = fixture.nativeElement as HTMLElement;

      expect(html.querySelector('app-stepper .stepper--compact')).not.toBeNull();
      expect(html.querySelectorAll('[data-testid^="stepper-paso-"]')).toHaveLength(10);
      expect(html.querySelector('.paginated-form__contador')).toBeNull();
    });

    /**
     * AC-03-1, el orden que pidió el propietario: nombres y apellidos → CI +
     * expedición → fecha de nacimiento → sexo → ocupación → celular → contacto
     * de emergencia → residencia → trabajo → correo → seguros → facturación.
     *
     * Se comprueba por `clave` y no por título: el título es prosa que se
     * reescribe cuando se lee mal, y `paginarCampos` además le agrega «(1 de
     * 2)» al partir una sección larga.
     */
    it('presenta los bloques en el orden pedido (AC-03-1)', () => {
      expect(component.paginasPaciente().map((pagina) => pagina.clave)).toEqual([
        'name',
        'document',
        'profile',
        'contact',
        'residence',
        'work',
        'work-location',
        'access',
        'insurance',
        'billing',
      ]);
    });

    /**
     * Dentro del bloque de perfil, el orden también es el pedido: fecha de
     * nacimiento, después sexo, después ocupación. Es la mitad de AC-03-1 que
     * un recuento de páginas no ve.
     */
    it('dentro de cada bloque, los campos van en el orden pedido', () => {
      const porClave = (clave: string) =>
        component
          .paginasPaciente()
          .find((pagina) => pagina.clave === clave)
          ?.campos.map((campo) => campo.key);

      expect(porClave('profile')).toEqual([
        'birthDate',
        'sexAtBirth',
        'occupationConceptId',
      ]);
      // La relación va la última del contacto y completa el tope de cuatro:
      // primero a quién llamamos, después qué es tuyo.
      expect(porClave('contact')).toEqual([
        'phone',
        'guardianName',
        'guardianPhone',
        'guardianRelationshipConceptId',
      ]);
      expect(porClave('residence')).toEqual([
        'residenceMunicipalityConceptId',
        'homeAddressLines',
        'gpsDomicilio',
      ]);
      expect(porClave('access')).toEqual(['email', 'password']);
      expect(porClave('billing')).toEqual(['billingTaxId', 'billingLegalName']);
    });

    /**
     * Lo que el pedido incluye y esta pantalla NO pregunta, porque no tiene
     * dónde guardarse: la zona en residencia y en trabajo (AC-03-10). La prueba
     * está para que aparezca **con su columna**, no de contrabando: el día que
     * alguien agregue el campo sin el destino, esto se pone rojo.
     *
     * La relación del contacto (AC-03-11) **salió** de esta lista: su columna
     * `profiles.related_persons.relationship_concept_id` existe, su conjunto de
     * valores también, y desde esta entrega se pregunta. Su prueba es la de más
     * abajo.
     */
    it('no pregunta la zona, que no tiene dónde guardarse', () => {
      const claves = component
        .paginasPaciente()
        .flatMap((pagina) => pagina.campos.map((campo) => campo.key));

      expect(claves).not.toContain('homeZone');
      expect(claves).not.toContain('workZone');
    });

    it('empieza por el nombre y termina por la facturación', () => {
      const primera = component.paginasPaciente()[0];
      expect(primera.campos[0].key).toBe('name');

      const ultima = component.paginasPaciente().at(-1);
      expect(ultima?.campos.map((campo) => campo.key)).toEqual([
        'billingTaxId',
        'billingLegalName',
      ]);
    });

    /** Cada página lleva su glifo del set cerrado del nav (AC-04-3). */
    it('cada página declara su ícono', () => {
      for (const pagina of component.paginasPaciente()) {
        expect(pagina.icon, `«${pagina.titulo}» no declara ícono`).toBeDefined();
      }
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
     * El mapa de departamentos y el select de ciudad no los dibuja el motor:
     * son un campo `custom` que proyecta esta pantalla. Si dejaran de serlo, el
     * motor le reservaría el sitio y no pondría nada adentro.
     *
     * Y son **un** campo, no dos: son un solo dato —la localidad— con dos
     * formas de llegar a él. Contarlos como dos habría hecho que la página de
     * residencia pasara el tope de cuatro.
     */
    it('la localidad va como un único campo proyectado', () => {
      const campos = component.paginasPaciente().flatMap((pagina) => pagina.campos);

      expect(
        campos.find((campo) => campo.key === 'residenceMunicipalityConceptId')?.control,
      ).toBe('custom');
      expect(
        campos.find((campo) => campo.key === 'workMunicipalityConceptId')?.control,
      ).toBe('custom');
    });

    it('el motor está montado y sirve la primera página', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;

      expect(html.querySelector('app-paginated-form')).not.toBeNull();
      // El nombre se ve; el documento, que vive en la segunda página, no.
      expect(html.querySelector('[data-testid="registro-nombre"]')).not.toBeNull();
      expect(html.querySelector('[data-testid="registro-documento"]')).toBeNull();
      expect(html.querySelector('[data-testid="registro-password"]')).toBeNull();
    });

    /**
     * AC-04-5: «Siguiente» y «Atrás» son botones de ícono en esta pantalla. El
     * interruptor entra apagado en el motor —lo montan 53 plantillas— y se
     * enciende acá, que es donde el propietario lo pidió.
     */
    it('la navegación del motor va en modo ícono', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const siguiente = html.querySelector('[data-testid="paginated-form-continuar"]');

      // El nombre accesible sigue en castellano: lo que cambia es el dibujo, no
      // lo que anuncia un lector de pantalla.
      expect(siguiente?.getAttribute('aria-label')).toBe('Siguiente');
      expect(siguiente?.querySelector('app-nav-icon')).not.toBeNull();
    });

    /**
     * AC-04-6 y AC-04-7: el botón que quita una casilla de nombre es de ícono,
     * y su nombre accesible dice **qué** quita. «Quitar» a secas, repetido
     * cuatro veces en la misma página, deja cuatro botones idénticos.
     */
    it('«Quitar» es un botón de ícono que dice qué quita', () => {
      component.agregarNombre();
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const quitar = html.querySelector('[data-testid="registro-quitar-nombre-0"]');

      expect(quitar?.getAttribute('aria-label')).toBe('Quitar el nombre 4');
      expect(quitar?.querySelector('app-nav-icon')).not.toBeNull();
    });

    /**
     * El departamento emisor es un `select` del motor mientras su catálogo
     * esté, y pasa a proyectado cuando la lectura falla: un desplegable vacío
     * no tiene dónde decir que no cargó.
     */
    it('el departamento cambia de `select` a proyectado si su catálogo se cae', () => {
      const antes = component
        .paginasPaciente()[1]
        .campos.find((campo) => campo.key === 'issuerAdministrativeAreaConceptId');
      expect(antes?.control).toBe('select');

      http.expectOne(CATALOGO).flush(null, { status: 401, statusText: 'Unauthorized' });

      const despues = component
        .paginasPaciente()[1]
        .campos.find((campo) => campo.key === 'issuerAdministrativeAreaConceptId');
      expect(despues?.control).toBe('custom');
    });
  });

  /**
   * El glifo dentro del campo y la explicación al apuntarlo: las dos cosas que
   * dejan recorrer una página de cuatro preguntas sin leerla entera.
   */
  describe('el glifo y la explicación de cada campo', () => {
    /**
     * Las ramas del motor que dibujan el glifo declarado, y las que no.
     *
     * Las que no, no es por olvido: en `tel` el hueco lo ocupa la bandera del
     * país —que además se puede cambiar—, en `date` y `datetime` el almanaque
     * que abre el calendario, y en `custom` lo que proyecte la pantalla. Ver
     * `icono` en el contrato del motor.
     */
    const CON_GLIFO = ['text', 'email', 'password', 'number', 'select'];
    const SIN_GLIFO = ['tel', 'date', 'datetime', 'textarea', 'radio', 'switch', 'checkbox'];

    /**
     * Los campos de todas las páginas, con los dos que sólo existen al elegir
     * «Otra…» ya presentes: si no, ninguna prueba los miraría nunca.
     */
    function todosLosCampos() {
      component.opcionesOcupacion.set([
        { value: 'o-otra', label: 'Otra ocupación', code: 'occupation:bo:OTRA' },
      ]);
      component.elegirOcupacion({ value: 'o-otra', label: 'Otra ocupación' });
      responderEmpresas();
      component.elegirEmpresa({ value: EMPRESA_OTRA, label: 'Otra empresa (la escribo)' });
      fixture.detectChanges();

      const campos = component.paginasPaciente().flatMap((pagina) => pagina.campos);
      expect(campos.map((campo) => campo.key)).toContain('occupationFreeText');
      expect(campos.map((campo) => campo.key)).toContain('workEmployerFreeText');
      return campos;
    }

    it('todo campo que pueda dibujar su glifo lo declara', () => {
      const sinGlifo = todosLosCampos()
        .filter((campo) => CON_GLIFO.includes(campo.control) && campo.icono === undefined)
        .map((campo) => campo.key);

      expect(sinGlifo).toEqual([]);
    });

    it('ninguno lo declara en una rama que no lo dibuja', () => {
      // Un `icono` ahí no se ve en ningún lado: es contrato muerto que hace
      // creer que el campo tiene glifo.
      const glifoMuerto = todosLosCampos()
        .filter((campo) => SIN_GLIFO.includes(campo.control) && campo.icono !== undefined)
        .map((campo) => `${campo.key} (${campo.control})`);

      expect(glifoMuerto).toEqual([]);
    });

    it('todo campo del motor explica qué se le pide', () => {
      // Los `custom` no: su explicación la pone la pantalla en el campo que
      // proyecta, y se comprueba abajo, en el DOM.
      const sinExplicacion = todosLosCampos()
        .filter(
          (campo) =>
            campo.control !== 'custom' &&
            (campo.description === undefined || campo.description.trim() === ''),
        )
        .map((campo) => campo.key);

      expect(sinExplicacion).toEqual([]);
    });

    it('las tres casillas de nombre y las agregadas traen su glifo y su explicación', () => {
      component.agregarNombre();
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;

      for (const testId of [
        'registro-nombre',
        'registro-segundo-nombre',
        'registro-tercer-nombre',
        'registro-nombre-extra-0',
      ]) {
        const campo = html.querySelector(`[data-testid="${testId}"]`);
        expect(campo, `falta el campo ${testId}`).not.toBeNull();
        expect(
          campo?.parentElement?.querySelector('app-nav-icon'),
          `el campo ${testId} no tiene glifo`,
        ).not.toBeNull();
      }

      // Y la explicación, que en un campo proyectado la pone la pantalla.
      const explicaciones = [...html.querySelectorAll('.registro__nombre .form-field-description')]
        .map((el) => el.textContent!.trim())
        .filter((texto) => texto !== '');
      expect(explicaciones).toHaveLength(4);
    });

    it('la lupa de ocupación trae su glifo', () => {
      completar();
      avanzarHasta('profile');

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '[data-testid="registro-ocupacion"] app-nav-icon',
        ),
      ).not.toBeNull();
    });

    it('la lupa de empresa trae el suyo', () => {
      completar();
      avanzarHasta('work');

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '[data-testid="registro-empresa"] app-nav-icon',
        ),
      ).not.toBeNull();
    });

    /**
     * El árbol de municipios, sin el cual el select de ciudad no llega a
     * dibujarse: mientras no hay departamento resuelto, el control dice qué
     * falta y no ofrece nada.
     */
    function cargarMunicipios(): void {
      http.expectOne(CATALOGO).flush({
        items: [{ id: 'vs-dep', internalCode: 'VS_BO_DEPARTMENT', name: 'Departamentos' }],
      });
      http.expectOne(CATALOGO_MUNICIPIOS).flush({
        items: [{ id: 'vs-mun', internalCode: 'VS_BO_MUNICIPALITY', name: 'Municipios' }],
      });
      http.expectOne('/terminology/value-sets/vs-dep/$expand?limit=200').flush({
        items: [{ conceptId: 'd-cb', code: 'geo:bo:department:CB', display: 'Cochabamba' }],
        count: 1,
        limit: 200,
        nextCursor: null,
      });
      http.expectOne('/terminology/value-sets/vs-mun/$expand?limit=200').flush({
        items: [
          { conceptId: MUNICIPIO_SACABA, code: 'geo:bo:municipality:031001', display: 'Sacaba' },
        ],
        count: 1,
        limit: 200,
        nextCursor: null,
      });
    }

    it('el mapa de residencia trae su glifo y su explicación', () => {
      cargarMunicipios();
      completar();
      avanzarHasta('residence');

      const picker = (fixture.nativeElement as HTMLElement).querySelector('app-location-picker');
      expect(picker?.querySelector('app-nav-icon')).not.toBeNull();
      expect(picker?.querySelector('.form-field-description')?.textContent?.trim()).toBeTruthy();
    });

    it('el mapa del lugar de trabajo, también', () => {
      cargarMunicipios();
      completar();
      component.elegirMunicipioDeTrabajo(MUNICIPIO_SACABA);
      avanzarHasta('work-location');

      const picker = (fixture.nativeElement as HTMLElement).querySelector('app-location-picker');
      expect(picker?.querySelector('app-nav-icon')).not.toBeNull();
      expect(picker?.querySelector('.form-field-description')?.textContent?.trim()).toBeTruthy();
    });
  });

  it('manda sólo los obligatorios cuando lo opcional quedó vacío', () => {
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.method).toBe('POST');
    // Un campo vacío no es lo mismo que no mandar el campo:
    // `forbidNonWhitelisted` rechaza lo que sobra. Mismo criterio para el
    // segundo nombre y el apellido materno, que mucha gente no tiene.
    expect(req.request.body).toEqual(OBLIGATORIOS_ENVIADOS);

    req.flush(RESPUESTA);
  });

  /* ---- AC-03-3 / AC-03-4: qué es obligatorio, y qué no ---- */

  /**
   * Los seis que el propietario listó (TAREA 03 §1.2), más los tres que el
   * servidor exige por contrato y que su lista no nombra: nombre, apellido
   * paterno y contraseña. AC-03-4 los contempla explícitamente («más lo que el
   * servidor exija por contrato, ver P-03-2»); un alta que crea una persona sin
   * nombre no es un alta, y sin contraseña no hay con qué entrar.
   */
  describe('obligatoriedad (AC-03-3, AC-03-4)', () => {
    const OBLIGATORIOS = [
      'nationalId',
      'email',
      'sexAtBirth',
      'phone',
      'birthDate',
      'residenceMunicipalityConceptId',
      // Los tres del contrato del servidor. Ver P-03-2.
      'name',
      'lastName',
      'password',
    ] as const;

    const OPCIONALES = [
      'middleName',
      'thirdName',
      'motherLastName',
      'issuerAdministrativeAreaConceptId',
      'occupationConceptId',
      'occupationFreeText',
      'homeAddressLines',
      'workMunicipalityConceptId',
      'workAddressLines',
      'workEmployerFreeText',
      'guardianName',
      'guardianPhone',
      'privateInsurancePlanId',
      'publicInsurancePlanId',
      'billingTaxId',
    ] as const;

    it('cada obligatorio, vacío, deja el formulario inválido y frena el envío', () => {
      for (const clave of OBLIGATORIOS) {
        completar();
        if (clave === 'residenceMunicipalityConceptId') {
          component.elegirMunicipio(null);
        } else {
          component.formPaciente.get(clave)?.setValue(
            clave === 'birthDate' || clave === 'sexAtBirth' ? null : '',
          );
        }

        expect(
          component.formPaciente.get(clave)?.invalid,
          `«${clave}» tendría que ser obligatorio`,
        ).toBe(true);

        component.submit();
        http.expectNone('/iam/auth/register-patient');
      }
    });

    it('nada más es obligatorio: con los nueve completos el alta sale', () => {
      completar();
      for (const clave of OPCIONALES) {
        expect(
          component.formPaciente.get(clave)?.invalid,
          `«${clave}» no tendría que ser obligatorio`,
        ).toBe(false);
      }

      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);
      expect(component.registered()).toBe(true);
    });

    /**
     * Es la inversión de contrato de AC-03-3, y la que más cuesta: el correo
     * era opcional **a propósito** —«podés entrar sin él, con tu documento»— y
     * la ayuda del paso lo decía con esas palabras. Sigue sin ser el
     * identificador de acceso; lo que cambió es que ahora hace falta igual.
     */
    it('sin correo el alta no sale, aunque el documento siga siendo el usuario', () => {
      completar({ email: '' });

      expect(component.formPaciente.controls.email.hasError('required')).toBe(true);
      component.submit();
      http.expectNone('/iam/auth/register-patient');
    });

    /**
     * AG49-FT03-R04-001: el `BLOCKER` no era que `name`/`lastName` sean
     * obligatorios —eso ya lo fija la prueba de arriba, a propósito—, sino que
     * ningún artefacto decía POR QUÉ, dejando la lista de la fuente literal
     * (seis campos) contradicha en silencio. Esta prueba fija el excedente
     * exacto y documentado: si mañana alguien agrega un décimo obligatorio sin
     * la misma justificación explícita (ver el comentario en
     * `register-patient.ts` junto a `name`/`lastName`), esta prueba falla acá,
     * antes de que vuelva a ser un finding.
     */
    it('el excedente sobre los seis obligatorios de la fuente literal (TAREA 03 §1.2) es exactamente name/lastName/password, documentado por contrato (AC-03-4/P-03-2)', () => {
      const SEIS_DE_LA_FUENTE_LITERAL = [
        'nationalId',
        'email',
        'sexAtBirth',
        'phone',
        'birthDate',
        'residenceMunicipalityConceptId',
      ] as const;
      const EXCEDENTE_JUSTIFICADO_POR_CONTRATO = ['name', 'lastName', 'password'] as const;

      expect(new Set(OBLIGATORIOS)).toEqual(
        new Set([...SEIS_DE_LA_FUENTE_LITERAL, ...EXCEDENTE_JUSTIFICADO_POR_CONTRATO]),
      );
    });
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
      ...OBLIGATORIOS_ENVIADOS,
      middleName: 'María',
      motherLastName: 'Quiroga',
    });

    req.flush(RESPUESTA);
  });

  it('manda el tercer nombre concatenado en middleName cuando se completó', () => {
    completar({ middleName: 'María', thirdName: 'Eugenia', motherLastName: 'Quiroga' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      ...OBLIGATORIOS_ENVIADOS,
      middleName: 'María Eugenia',
      motherLastName: 'Quiroga',
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
      ...OBLIGATORIOS_ENVIADOS,
      middleName: 'María Eugenia Fernanda Belén',
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
      ...OBLIGATORIOS_ENVIADOS,
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
      ...OBLIGATORIOS_ENVIADOS,
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
    expect(enviado).not.toContain('gender');
    expect(enviado).not.toContain('occupationConceptId');
    expect(enviado).not.toContain('occupationFreeText');
    // Y los del alta completa: calle, coordenadas, trabajo, tutor, seguros, NIT.
    expect(enviado).not.toContain('homeAddressLines');
    expect(enviado).not.toContain('homeLatitude');
    expect(enviado).not.toContain('workEmployerConceptId');
    expect(enviado).not.toContain('workEmployerFreeText');
    expect(enviado).not.toContain('workMunicipalityConceptId');
    expect(enviado).not.toContain('workAddressLines');
    expect(enviado).not.toContain('workLatitude');
    expect(enviado).not.toContain('guardianName');
    expect(enviado).not.toContain('guardianPhone');
    expect(enviado).not.toContain('privateInsurancePlanId');
    expect(enviado).not.toContain('publicInsurancePlanId');
    expect(enviado).not.toContain('billingTaxId');
    expect(enviado).not.toContain('billingLegalName');

    req.flush(RESPUESTA);
  });

  it('manda la calle y el NIT cuando se completaron', () => {
    completar({
      homeAddressLines: '  Av. Banzer #42  ',
      billingTaxId: ' 1023456789 ',
      billingLegalName: '  Empresa SRL  ',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    // Recortados: un espacio de más no es parte de la dirección ni del NIT.
    expect(req.request.body.homeAddressLines).toBe('Av. Banzer #42');
    expect(req.request.body.billingTaxId).toBe('1023456789');
    expect(req.request.body.billingLegalName).toBe('Empresa SRL');

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

  it('el punto capturado y sin confirmar no viaja, y no frena el envío', () => {
    completar();
    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain(
      'homeLatitude',
    );
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

  /* ---- El pin también se pone a mano sobre el mapa ---------------------------
     La casa casi nunca se declara desde la casa, y quien negó el permiso del
     navegador también tiene que poder poner su pin. Así que el mapa se abre
     vacío y se toca; y con un pin puesto, tocarlo lo corre. */

  it('«Marcar en el mapa» abre el mapa vacío sin pedir nada al navegador', () => {
    expect(component.mapaDomicilioAbierto()).toBe(false);

    component.marcarDomicilioEnMapa();

    expect(component.marcandoDomicilio()).toBe(true);
    expect(component.mapaDomicilioAbierto()).toBe(true);
    expect(component.gpsDomicilio()).toBeNull();
    expect(component.pinesDomicilio()).toEqual([]);
  });

  it('tocar el mapa pone el pin del domicilio sin confirmarlo, y no viaja hasta que se confirme', () => {
    completar();
    component.marcarDomicilioEnMapa();

    component.fijarPuntoDomicilio({ lat: -16.5, lng: -68.15 });

    expect(component.gpsDomicilio()).toEqual({ lat: -16.5, lng: -68.15 });
    expect(component.marcandoDomicilio()).toBe(false);
    expect(component.direccionConfirmada()).toBe(false);
    // El pin puesto a mano no se llama «Acá te encontramos»: eso sería mentir.
    expect(component.pinesDomicilio()[0].titulo).toBe('El punto que marcaste');

    component.submit();
    const sinConfirmar = http.expectOne('/iam/auth/register-patient');
    expect(Object.keys(sinConfirmar.request.body as Record<string, unknown>)).not.toContain(
      'homeLatitude',
    );
    sinConfirmar.flush(RESPUESTA);
  });

  it('el punto marcado a mano viaja igual que el del navegador una vez confirmado', () => {
    completar();
    component.fijarPuntoDomicilio({ lat: -16.5, lng: -68.15 });
    component.confirmarDireccionActual();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.homeLatitude).toBe(-16.5);
    expect(req.request.body.homeLongitude).toBe(-68.15);
    req.flush(RESPUESTA);
  });

  it('tocar el mapa con un punto ya confirmado lo corre y suelta la confirmación', () => {
    component.gpsDomicilio.set({ lat: -17.7833, lng: -63.1821 });
    component.confirmarDireccionActual();
    expect(component.direccionConfirmada()).toBe(true);

    component.fijarPuntoDomicilio({ lat: -17.79, lng: -63.19 });

    expect(component.gpsDomicilio()).toEqual({ lat: -17.79, lng: -63.19 });
    expect(component.direccionConfirmada()).toBe(false);
  });

  /**
   * D-06: tocar el mapa deja «Línea de dirección 1» en blanco, porque el
   * punto nuevo ya no es esa calle; y el aviso se va al volver a escribir.
   */
  it('tocar el mapa vacía la dirección escrita del domicilio, y sólo esa', () => {
    const domicilio = component.formPaciente.controls.homeAddressLines;
    const trabajo = component.formPaciente.controls.workAddressLines;
    domicilio.setValue('Av. Banzer #42');
    trabajo.setValue('Calle Libertad #120');

    component.fijarPuntoDomicilio({ lat: -16.5, lng: -68.15 });

    expect(domicilio.value).toBe('');
    expect(component.domicilioPorReescribir()).toBe(true);
    expect(trabajo.value).toBe('Calle Libertad #120');
    expect(component.trabajoPorReescribir()).toBe(false);
    // Vaciar no es teclear: el campo no queda como tocado por la persona.
    expect(domicilio.dirty).toBe(false);

    domicilio.setValue('Av. Banzer #42, 3er anillo');
    expect(component.domicilioPorReescribir()).toBe(false);
  });

  it('tocar el mapa del trabajo vacía la dirección del trabajo', () => {
    const trabajo = component.formPaciente.controls.workAddressLines;
    trabajo.setValue('Calle Libertad #120');

    component.fijarPuntoDeTrabajo({ lat: -17.4, lng: -66.1 });

    expect(trabajo.value).toBe('');
    expect(component.trabajoPorReescribir()).toBe(true);
  });

  it('quitar la ubicación con el mapa vacío abierto lo cierra', () => {
    component.marcarDomicilioEnMapa();
    component.quitarUbicacion();

    expect(component.marcandoDomicilio()).toBe(false);
    expect(component.mapaDomicilioAbierto()).toBe(false);
  });

  it('el trabajo tiene su propio mapa a mano, independiente del domicilio', () => {
    component.marcarTrabajoEnMapa();
    expect(component.mapaTrabajoAbierto()).toBe(true);
    expect(component.mapaDomicilioAbierto()).toBe(false);

    component.fijarPuntoDeTrabajo({ lat: -17.4, lng: -66.1 });
    expect(component.gpsTrabajo()).toEqual({ lat: -17.4, lng: -66.1 });
    expect(component.direccionTrabajoConfirmada()).toBe(false);
    expect(component.pinesTrabajo()[0].titulo).toBe('El punto que marcaste');
    expect(component.gpsDomicilio()).toBeNull();

    component.quitarUbicacionDeTrabajo();
    expect(component.mapaTrabajoAbierto()).toBe(false);
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
    expect(req.request.body).toMatchObject({ workEmployerConceptId: EMPRESA_ENTEL });
    // La empresa **ya no** reemplaza a la dirección del trabajo (AC-03-1
    // devolvió los cuatro campos al alta), pero lo que no se completó sigue sin
    // viajar: vacío no es lo mismo que ausente.
    const enviado = Object.keys(req.request.body as Record<string, unknown>);
    expect(enviado).not.toContain('workAddressLines');
    expect(enviado).not.toContain('workMunicipalityConceptId');
    expect(enviado).not.toContain('workLatitude');

    req.flush(RESPUESTA);
  });

  /* ---- El lugar de trabajo, que vuelve al alta (AC-03-1, P-03-4) ---- */

  /**
   * Revierte una decisión escrita: el alta había dejado de preguntar municipio,
   * calle y coordenadas del trabajo porque «casi nadie las completaba». El
   * propietario las volvió a pedir y el DTO nunca dejó de aceptarlas. Siguen
   * siendo opcionales: lo que no se completa, no viaja.
   */
  it('manda los cuatro campos del lugar de trabajo cuando se completaron', () => {
    completar({ workAddressLines: '  Calle Libertad #120  ' });
    component.elegirMunicipioDeTrabajo(MUNICIPIO_SACABA);
    component.gpsTrabajo.set({ lat: -17.4, lng: -66.1 });
    component.confirmarDireccionDeTrabajo();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toMatchObject({
      workMunicipalityConceptId: MUNICIPIO_SACABA,
      // Recortada, como la calle del domicilio.
      workAddressLines: 'Calle Libertad #120',
      workLatitude: -17.4,
      workLongitude: -66.1,
    });

    req.flush(RESPUESTA);
  });

  /** Mismo criterio que el domicilio: un punto no mirado no es una dirección. */
  it('no manda el punto del trabajo mientras no se confirme en el mapa', () => {
    completar();
    component.gpsTrabajo.set({ lat: -17.4, lng: -66.1 });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    const enviado = Object.keys(req.request.body as Record<string, unknown>);
    expect(enviado).not.toContain('workLatitude');
    expect(enviado).not.toContain('workLongitude');

    req.flush(RESPUESTA);
  });

  it('quitar el punto del trabajo se lleva también su confirmación', () => {
    component.gpsTrabajo.set({ lat: -17.4, lng: -66.1 });
    component.confirmarDireccionDeTrabajo();
    expect(component.direccionTrabajoConfirmada()).toBe(true);

    component.quitarUbicacionDeTrabajo();

    expect(component.gpsTrabajo()).toBeNull();
    expect(component.direccionTrabajoConfirmada()).toBe(false);
  });

  it('el mapa del trabajo recibe su propio pin, distinto del de casa', () => {
    expect(component.pinesTrabajo()).toEqual([]);

    component.gpsTrabajo.set({ lat: -17.4, lng: -66.1 });

    expect(component.pinesTrabajo()).toHaveLength(1);
    // Y no contagia al del domicilio: son dos puntos distintos.
    expect(component.pinesDomicilio()).toEqual([]);
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

  /**
   * El número de la cédula y el departamento que la expidió son UN documento
   * escrito en dos casillas. Con el número obligatorio y la expedición no, la
   * cédula quedaba a medias — y es lo único que distingue dos documentos con
   * el mismo número. Mismo criterio que el alta de profesional.
   */
  it('sin departamento de emisión el formulario no se puede enviar', () => {
    completar();
    component.formPaciente.controls.issuerAdministrativeAreaConceptId.setValue(null);

    expect(component.formPaciente.controls.issuerAdministrativeAreaConceptId.invalid).toBe(
      true,
    );

    component.submit();
    http.expectNone('/iam/auth/register-patient');
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

  /**
   * La relación del contacto de emergencia (AC-03-11).
   *
   * Es el único catálogo de esta pantalla que se lee **por campo destino** y no
   * por código de conjunto de valores: su columna declara enumeración dinámica,
   * así que la API la sirve en `/system-context/dynamic-enums?target=…`.
   */
  describe('relación del contacto de emergencia (P1)', () => {
    /** Lo que devuelve el catálogo, con los códigos que siembra la API. */
    function responderCatalogo(): void {
      http.expectOne(CATALOGO_PARENTESCOS).flush({
        code: 'related-person-relationship',
        name: 'Parentesco de la persona relacionada',
        definitionId: 'def-1',
        valueSetId: 'vs-1',
        allowCustomValue: false,
        options: [
          {
            conceptId: PARENTESCO_MADRE,
            code: 'RELATIONSHIP_MOTHER',
            display: 'Mother relationship',
            ordinal: 1,
            isDefault: false,
          },
          {
            conceptId: 'c-otra',
            // Un código sin palabra propia: tiene que caer al `display` del
            // catálogo, nunca quedarse en blanco ni mostrar el uuid.
            code: 'RELATIONSHIP_NEW_ONE',
            display: 'Brand new relationship',
            ordinal: 2,
            isDefault: false,
          },
        ],
      });
    }

    it('ofrece el campo como `select` opcional con las palabras en castellano', () => {
      responderCatalogo();

      const campo = component
        .paginasPaciente()
        .find((pagina) => pagina.clave === 'contact')
        ?.campos.find((c) => c.key === 'guardianRelationshipConceptId');

      expect(campo?.control).toBe('select');
      // Opcional: el contacto entero lo es.
      expect(campo?.required).toBeUndefined();
      expect(campo?.options).toEqual([
        { value: PARENTESCO_MADRE, label: 'Madre' },
        // Sin entrada propia se muestra el rótulo del catálogo: feo, pero dice
        // algo — a diferencia de una opción vacía.
        { value: 'c-otra', label: 'Brand new relationship' },
      ]);
      expect(component.formPaciente.controls.guardianRelationshipConceptId.invalid).toBe(
        false,
      );
    });

    it('se dibuja en la página del contacto', () => {
      responderCatalogo();
      completar();
      avanzarHasta('contact');

      const html = fixture.nativeElement as HTMLElement;
      expect(html.querySelector('[data-testid="registro-tutor-relacion"]')).not.toBeNull();
    });

    /**
     * Sin catálogo el campo pasa a proyectado, para que la pantalla pueda poner
     * ahí el aviso con su «Reintentar»: un desplegable vacío no tiene dónde
     * decir que no cargó. El alta sigue en pie — el campo es opcional.
     */
    it('cambia de `select` a proyectado si su catálogo se cae', () => {
      http
        .expectOne(CATALOGO_PARENTESCOS)
        .flush(null, { status: 500, statusText: 'Server Error' });

      const campo = component
        .paginasPaciente()
        .find((pagina) => pagina.clave === 'contact')
        ?.campos.find((c) => c.key === 'guardianRelationshipConceptId');

      expect(component.catalogoParentescosCaido()).toBe(true);
      expect(campo?.control).toBe('custom');
    });

    it('«Reintentar» vuelve a la red: el fallo cacheado no dura toda la sesión', () => {
      http
        .expectOne(CATALOGO_PARENTESCOS)
        .flush(null, { status: 500, statusText: 'Server Error' });

      component['reintentarParentescos']();

      // Sin `olvidar()`, el `shareReplay` del cliente replicaría el error sin
      // pedir nada y esta expectativa no encontraría petición alguna.
      responderCatalogo();
      expect(component.catalogoParentescosCaido()).toBe(false);
    });

    it('manda el parentesco elegido junto al contacto', () => {
      responderCatalogo();
      completar({ guardianName: 'Rosa Quispe' });
      component.formPaciente.controls.guardianRelationshipConceptId.setValue(
        PARENTESCO_MADRE,
      );
      component.submit();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.body.guardianRelationshipConceptId).toBe(PARENTESCO_MADRE);
      req.flush(RESPUESTA);
    });

    /**
     * Sin elección no viaja el campo: la API escribe su valor por defecto
     * —«tutor o representante legal»—, que es lo que escribía antes de que este
     * campo existiera. Mandar una cadena vacía sería un 400.
     */
    it('no manda el parentesco si no se eligió ninguno', () => {
      responderCatalogo();
      completar({ guardianName: 'Rosa Quispe' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain(
        'guardianRelationshipConceptId',
      );
      req.flush(RESPUESTA);
    });

    /**
     * Un parentesco sin contacto no describe a nadie, así que no viaja: es la
     * misma regla que ya cumple el teléfono del tutor.
     */
    it('no manda el parentesco si no hay contacto de emergencia', () => {
      responderCatalogo();
      completar();
      component.formPaciente.controls.guardianRelationshipConceptId.setValue(
        PARENTESCO_MADRE,
      );
      component.submit();

      const req = http.expectOne('/iam/auth/register-patient');
      const enviado = Object.keys(req.request.body as Record<string, unknown>);
      expect(enviado).not.toContain('guardianRelationshipConceptId');
      expect(enviado).not.toContain('guardianName');
      req.flush(RESPUESTA);
    });
  });

  /**
   * Copiar el nombre de la localidad a «dirección 1» (P4 / AC-03-8).
   *
   * No es geocodificación —convertir el pin en «Av. Banzer 3er anillo» exige un
   * proveedor externo que la política de seguridad no permite—: es copiar lo
   * único que el sistema sí sabe del lugar elegido, que es cómo se llama.
   */
  describe('prellenado de la dirección con la localidad (P4)', () => {
    /** Responde el árbol de municipios, que es de donde sale el nombre. */
    function cargarArbol(): void {
      http.expectOne(CATALOGO).flush({
        items: [{ id: 'vs-dep', internalCode: 'VS_BO_DEPARTMENT', name: 'Departamentos' }],
      });
      http.expectOne(CATALOGO_MUNICIPIOS).flush({
        items: [{ id: 'vs-mun', internalCode: 'VS_BO_MUNICIPALITY', name: 'Municipios' }],
      });
      http.expectOne('/terminology/value-sets/vs-dep/$expand?limit=200').flush({
        items: [{ conceptId: 'd-cb', code: 'geo:bo:department:CB', display: 'Cochabamba' }],
        count: 1,
        limit: 200,
        nextCursor: null,
      });
      http.expectOne('/terminology/value-sets/vs-mun/$expand?limit=200').flush({
        items: [
          {
            conceptId: MUNICIPIO_SACABA,
            code: 'geo:bo:municipality:031001',
            display: 'Sacaba',
          },
          // El segundo municipio existe para poder corregir la elección, que es
          // el caso donde el prellenado se vuelve peligroso: ver más abajo.
          {
            conceptId: MUNICIPIO_QUILLACOLLO,
            code: 'geo:bo:municipality:030301',
            display: 'Quillacollo',
          },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });
    }

    it('copia el nombre de la localidad de residencia si la dirección está vacía', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('Sacaba');
    });

    /**
     * Pisar lo que alguien escribió es el defecto clásico de los prellenados, y
     * acá borraría una dirección real por elegir la ciudad después.
     */
    it('no pisa la dirección que la persona ya escribió', () => {
      cargarArbol();
      component.formPaciente.controls.homeAddressLines.setValue('Av. Banzer #42');
      component.elegirMunicipio(MUNICIPIO_SACABA);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe(
        'Av. Banzer #42',
      );
    });

    /** Una dirección de puros espacios está vacía a todos los efectos. */
    it('trata los espacios en blanco como campo vacío', () => {
      cargarArbol();
      component.formPaciente.controls.homeAddressLines.setValue('   ');
      component.elegirMunicipio(MUNICIPIO_SACABA);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('Sacaba');
    });

    it('hace lo mismo con la localidad del trabajo', () => {
      cargarArbol();
      component.elegirMunicipioDeTrabajo(MUNICIPIO_SACABA);

      expect(component.formPaciente.controls.workAddressLines.value).toBe('Sacaba');
    });

    /**
     * El campo queda editable y **sin marcar**: no lo escribió la persona, así
     * que marcarlo dispararía la validación y los mensajes de un campo que nadie
     * tocó.
     */
    it('deja el campo editable y sin marcar como tocado', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      const control = component.formPaciente.controls.homeAddressLines;

      expect(control.touched).toBe(false);
      expect(control.disabled).toBe(false);

      control.setValue('Sacaba, calle Junín #12');
      expect(control.value).toBe('Sacaba, calle Junín #12');
    });

    /**
     * Sin árbol cargado no hay nombre que copiar, y **nunca** se escribe un
     * identificador ni un texto inventado: el campo queda como estaba.
     */
    it('no escribe nada si el catálogo todavía no trajo el nombre', () => {
      component.elegirMunicipio(MUNICIPIO_SACABA);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('');
    });

    it('soltar la localidad no toca la dirección', () => {
      cargarArbol();
      component.elegirMunicipio(null);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('');
    });

    /* ---- Corregir la localidad después de haberla elegido -----------------
       Es donde un prellenado se vuelve peligroso: «solo si está vacío» ya no
       alcanza, porque el campo lo llenó el propio formulario. Sin distinguir lo
       sembrado de lo escrito, corregir la ciudad dejaba viajar el municipio
       nuevo con el nombre del anterior — un domicilio que no existe. */

    it('re-siembra al corregir la localidad: no deja el nombre del anterior', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      expect(component.formPaciente.controls.homeAddressLines.value).toBe('Sacaba');

      component.elegirMunicipio(MUNICIPIO_QUILLACOLLO);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('Quillacollo');
    });

    it('lo mismo al corregir la localidad del trabajo', () => {
      cargarArbol();
      component.elegirMunicipioDeTrabajo(MUNICIPIO_SACABA);
      component.elegirMunicipioDeTrabajo(MUNICIPIO_QUILLACOLLO);

      expect(component.formPaciente.controls.workAddressLines.value).toBe('Quillacollo');
    });

    /**
     * Lo que la persona escribió sobre lo sembrado es suyo, y manda: corregir
     * la ciudad no puede borrar una dirección que alguien completó a mano.
     */
    it('no pisa lo que la persona escribió sobre lo sembrado', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      component.formPaciente.controls.homeAddressLines.setValue('Sacaba, calle Junín #12');

      component.elegirMunicipio(MUNICIPIO_QUILLACOLLO);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe(
        'Sacaba, calle Junín #12',
      );
    });

    /**
     * Soltar la localidad se lleva lo que el formulario había sembrado: el
     * nombre de una localidad que ya no está elegida no describe a nadie.
     */
    /* El mapa de departamentos es un grupo de dos estados: volver a pulsar el
       que ya estaba elegido lo suelta, y ése es justo el gesto de quien va a
       cambiar de ciudad. Si soltar limpiara, ese gesto borraría la dirección
       que la persona tiene delante. */
    it('soltar la localidad conserva lo que se había sembrado', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);

      component.elegirMunicipio(null);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe('Sacaba');
    });

    it('tras soltar, elegir otra localidad reescribe el nombre igual', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      component.elegirMunicipio(null);

      component.elegirMunicipio(MUNICIPIO_QUILLACOLLO);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe(
        'Quillacollo',
      );
    });

    it('soltar la localidad NO borra lo que la persona escribió', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      component.formPaciente.controls.homeAddressLines.setValue('Av. Banzer #42');

      component.elegirMunicipio(null);

      expect(component.formPaciente.controls.homeAddressLines.value).toBe(
        'Av. Banzer #42',
      );
    });

    /** Re-sembrar tampoco marca el campo: sigue sin escribirlo la persona. */
    it('re-sembrar deja el campo sin marcar como tocado', () => {
      cargarArbol();
      component.elegirMunicipio(MUNICIPIO_SACABA);
      component.elegirMunicipio(MUNICIPIO_QUILLACOLLO);

      expect(component.formPaciente.controls.homeAddressLines.touched).toBe(false);
    });
  });

  /**
   * La localidad elegida **en pantalla**: mapa + select, no el método a mano.
   *
   * Las pruebas de arriba llaman a `elegirMunicipio()` directo y no ven el
   * camino que recorre la persona: pulsar el departamento en
   * `app-department-map`, que `app-location-picker` traduce, y elegir la ciudad
   * en su `app-select`, que vuelve a traducir. Cada tramo emite, y un `null` de
   * más en cualquiera alcanza para borrar lo recién sembrado. Es lo que se vio
   * en pantalla: «al elegir Warnes, en vez de sembrar la dirección la borra».
   */
  describe('la localidad elegida en pantalla: mapa + select (P4)', () => {
    /** Un municipio de Santa Cruz, código INE 070105. */
    const MUNICIPIO_EL_TORNO = '7d3f5a1c-2b6e-5c4d-9a8f-1e2d3c4b5a60';

    /** Otro de Santa Cruz, para corregir dentro del mismo departamento. */
    const MUNICIPIO_WARNES = '8e4a6b2d-3c7f-5d5e-8b9a-2f3e4d5c6b71';

    /** El árbol con dos departamentos: se corrige DENTRO de uno y ENTRE dos. */
    function cargarArbolDeDosDepartamentos(): void {
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
          { conceptId: MUNICIPIO_SACABA, code: 'geo:bo:municipality:031001', display: 'Sacaba' },
          {
            conceptId: MUNICIPIO_QUILLACOLLO,
            code: 'geo:bo:municipality:030301',
            display: 'Quillacollo',
          },
          {
            conceptId: MUNICIPIO_EL_TORNO,
            code: 'geo:bo:municipality:070105',
            display: 'El Torno',
          },
          { conceptId: MUNICIPIO_WARNES, code: 'geo:bo:municipality:070201', display: 'Warnes' },
        ],
        count: 4,
        limit: 200,
        nextCursor: null,
      });
    }

    function pantalla(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    /** Pulsa un departamento en el mapa de residencia, como con el ratón. */
    function pulsarDepartamento(sigla: string): void {
      const forma = pantalla().querySelector(
        `[data-testid="registration-residence-mapa-${sigla}"]`,
      );
      expect(forma, `no está dibujado el departamento «${sigla}»`).not.toBeNull();
      forma?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
    }

    /** Elige una ciudad en el select de residencia, como lo haría la persona. */
    function elegirCiudad(nombre: string): void {
      const select = pantalla().querySelector<HTMLSelectElement>(
        '[data-testid="registration-residence-municipio"] select',
      );
      expect(select, 'el select de ciudad no está en pantalla').not.toBeNull();
      const opcion = [...(select?.options ?? [])].find(
        (candidata) => candidata.textContent?.trim() === nombre,
      );
      expect(opcion, `«${nombre}» no está entre las ciudades ofrecidas`).toBeDefined();
      if (select === null || opcion === undefined) return;
      select.value = opcion.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
    }

    function direccion(): string {
      return component.formPaciente.controls.homeAddressLines.value;
    }

    beforeEach(() => {
      cargarArbolDeDosDepartamentos();
      completarDatosPersonales();
      avanzarHasta('residence');
    });

    it('(A) departamento en el mapa y ciudad en el select siembran el nombre', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      expect(component.formPaciente.controls.residenceMunicipalityConceptId.value).toBe(
        MUNICIPIO_EL_TORNO,
      );
      expect(direccion()).toBe('El Torno');
    });

    it('(B) corregir a otra ciudad del MISMO departamento deja el nombre nuevo', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      elegirCiudad('Warnes');

      expect(component.formPaciente.controls.residenceMunicipalityConceptId.value).toBe(
        MUNICIPIO_WARNES,
      );
      expect(direccion()).toBe('Warnes');
    });

    it('(C) cambiar de departamento en el mapa y elegir una ciudad deja el nombre nuevo', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      pulsarDepartamento('CB');
      elegirCiudad('Sacaba');

      expect(component.formPaciente.controls.residenceMunicipalityConceptId.value).toBe(
        MUNICIPIO_SACABA,
      );
      expect(direccion()).toBe('Sacaba');
    });

    /**
     * (D) Lo que llega desde el selector, en orden y con la dirección tal como
     * quedó tras cada llegada. Un `null` DESPUÉS de la ciudad elegida sería una
     * emisión espuria —del select al redibujar sus opciones, o del mapa— y
     * borraría lo recién sembrado.
     */
    it('(D) ninguna emisión del selector llega después de la ciudad elegida', () => {
      const llegadas: { conceptId: string | null; direccion: string }[] = [];
      const original = component.elegirMunicipio.bind(component);
      vi.spyOn(component, 'elegirMunicipio').mockImplementation((conceptId) => {
        original(conceptId);
        llegadas.push({ conceptId, direccion: direccion() });
      });

      pulsarDepartamento('SC');
      elegirCiudad('El Torno');
      elegirCiudad('Warnes');
      pulsarDepartamento('CB');
      elegirCiudad('Sacaba');

      expect(llegadas).toEqual([
        { conceptId: MUNICIPIO_EL_TORNO, direccion: 'El Torno' },
        { conceptId: MUNICIPIO_WARNES, direccion: 'Warnes' },
        // Cambiar de departamento suelta Warnes: ese `null` es a propósito.
        // La dirección se conserva hasta que haya una localidad nueva.
        { conceptId: null, direccion: 'Warnes' },
        { conceptId: MUNICIPIO_SACABA, direccion: 'Sacaba' },
      ]);
    });

    /**
     * (E) Volver a pulsar el departamento ya elegido lo DES-elige (el mapa es
     * de dos estados) y suelta la ciudad, pero la dirección **se conserva**:
     * es el gesto de quien va a cambiar de ciudad, y una navegación no puede
     * costar lo que la persona tiene delante. Elegir la ciudad nueva tiene que
     * terminar con su nombre.
     */
    it('(E) des-elegir y re-elegir el departamento en el mapa y luego la ciudad', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      pulsarDepartamento('SC');
      expect(direccion(), 'soltar el departamento no borra lo sembrado').toBe(
        'El Torno',
      );
      pulsarDepartamento('SC');
      elegirCiudad('Warnes');

      expect(direccion()).toBe('Warnes');
    });

    /**
     * (F) Ir a la página siguiente y volver destruye y recrea el selector y el
     * campo de dirección: lo elegido y lo sembrado tienen que sobrevivir, y
     * corregir la ciudad después tiene que seguir re-sembrando.
     */
    it('(F) corregir la ciudad después de avanzar y volver re-siembra', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      pantalla().querySelector<HTMLElement>('[data-testid="paginated-form-continuar"]')?.click();
      fixture.detectChanges();
      expect(component.claveVisible()).toBe('work');
      pantalla().querySelector<HTMLElement>('[data-testid="paginated-form-atras"]')?.click();
      fixture.detectChanges();
      expect(component.claveVisible()).toBe('residence');
      expect(direccion(), 'lo sembrado sobrevive a ir y volver').toBe('El Torno');

      elegirCiudad('Warnes');

      expect(direccion()).toBe('Warnes');
    });

    /** (G) Igual que (F), pero cambiando de departamento al volver. */
    it('(G) cambiar de departamento después de avanzar y volver re-siembra', () => {
      pulsarDepartamento('SC');
      elegirCiudad('El Torno');

      pantalla().querySelector<HTMLElement>('[data-testid="paginated-form-continuar"]')?.click();
      fixture.detectChanges();
      pantalla().querySelector<HTMLElement>('[data-testid="paginated-form-atras"]')?.click();
      fixture.detectChanges();

      pulsarDepartamento('CB');
      elegirCiudad('Quillacollo');

      expect(direccion()).toBe('Quillacollo');
    });
  });

  /* ==========================================================================
     Las dos salidas escritas a mano.

     «Otra ocupación» y «Otra empresa» destraban un campo de texto libre, y quién
     decide que la opción elegida es «otra» **compara por código**. Un filtro por
     código es mudo cuando los dos lados hablan vocabularios distintos: no falla,
     no avisa, sencillamente nunca da verdadero — y el campo escrito a mano deja
     de aparecer, con la función construida y entera del otro lado.

     Pasó en la rama `mockup` hasta el 09/09/2026: el simulador nombraba sus
     ocupaciones `OCC-OTRA` y sus empleadores `EMP-INDEP`, y estas dos constantes
     valen `occupation:bo:OTRA` y `employer:bo:OTRA`. Es la tercera vez que este
     defecto muerde en el mismo fixture —antes fueron los departamentos
     (`BO-SC`, que dejaba el mapa vacío) y las especialidades odontológicas—, así
     que acá queda atado.

     Se comprueba contra el catálogo del simulador porque es el único de los dos
     que este repositorio puede leer, y es el que sirve la maqueta donde el
     hueco apareció.
     ========================================================================== */
  describe('las salidas escritas a mano existen en el catálogo', () => {
    it('«Otra ocupación» tiene el código que la pantalla busca', () => {
      expect(OCUPACION[CODIGO_OCUPACION_OTRA], CODIGO_OCUPACION_OTRA).toBeDefined();
    });

    it('«Otra empresa» también', () => {
      expect(EMPLEADOR[CODIGO_EMPRESA_OTRA], CODIGO_EMPRESA_OTRA).toBeDefined();
    });

    it('y no son las únicas: quedan opciones de verdad antes de la salida', () => {
      // Si el catálogo fuera sólo «Otra», la lista no ofrecería nada y todo el
      // mundo terminaría escribiendo a mano lo que el catálogo ya tiene.
      expect(Object.keys(OCUPACION).length).toBeGreaterThan(10);
      expect(Object.keys(EMPLEADOR).length).toBeGreaterThan(3);
    });
  });
});
