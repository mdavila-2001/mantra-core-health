import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { CAMPO_TIPO_SOCIETARIO } from '../../../core/data-access/system-context/legal-entity-types.service';
import { DropzonePdf } from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import { UbicacionPicker } from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { RegisterOrganization } from './register-organization';

const RESPUESTA = {
  tenantId: 't-1',
  code: 'ANDINA',
  ownerUserId: 'u-1',
  status: 'c-pendiente',
  emailVerificationSent: false,
};

/** La ruta del catálogo de tipos societarios (subtarea 1.1). */
const RUTA_TIPO_SOCIETARIO = `/system-context/dynamic-enums?target=${CAMPO_TIPO_SOCIETARIO}`;

/** Un recorte del catálogo real, con Bolivia y Brasil, alcanza para estas pruebas. */
const CATALOGO_TIPO_SOCIETARIO = {
  code: 'legal-entity-type',
  name: 'Forma societaria',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'c-unipersonal', code: 'UNIPERSONAL', display: 'Sole proprietorship', ordinal: 0, isDefault: false },
    { conceptId: 'c-srl', code: 'SRL', display: 'Limited liability company (S.R.L.)', ordinal: 1, isDefault: false },
    { conceptId: 'c-br-ltda', code: 'BR_LTDA', display: 'Sociedade Limitada (Brazil)', ordinal: 8, isDefault: false },
    { conceptId: 'c-br-sa', code: 'BR_SA', display: 'Sociedade Anônima (Brazil)', ordinal: 9, isDefault: false },
    { conceptId: 'c-us-llc', code: 'US_LLC', display: 'Limited Liability Company (US)', ordinal: 12, isDefault: false },
    { conceptId: 'c-ar-sas', code: 'AR_SAS', display: 'Sociedad por Acciones Simplificada (Argentina)', ordinal: 16, isDefault: false },
  ],
};

describe('RegisterOrganization', () => {
  let fixture: ComponentFixture<RegisterOrganization>;
  let component: RegisterOrganization;
  let http: HttpTestingController;
  let navegaciones: string[];

  beforeEach(async () => {
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [RegisterOrganization],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        // El mapa de la casa matriz (subtarea 1.3) no debe cargar Leaflet de
        // verdad en jsdom: ver el mismo provider en `design-system-sample.spec.ts`.
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterOrganization);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // El constructor pide el catálogo de tipos societarios: se responde acá
    // para que las pruebas no tengan que repetirlo cada una.
    http.expectOne(RUTA_TIPO_SOCIETARIO).flush(CATALOGO_TIPO_SOCIETARIO);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  /** Los 5 `fileId` que `completar()` usa por defecto (subtarea 1.2). */
  const DOCUMENTOS_DE_PRUEBA = {
    constitutionFileId: 'file-constitution',
    taxIdentifierFileId: 'file-tax',
    commerceRegistryFileId: 'file-commerce',
    operatingLicenseFileId: 'file-license',
    healthAuthorityCertificateFileId: 'file-sedes',
  };

  /** El representante legal que `completar()` usa por defecto (subtarea 1.4 + desglose de nombre). */
  const REPRESENTANTE_DE_PRUEBA = {
    legalRepresentativeIdNumber: '4872190 SC',
    legalRepresentativeEmail: 'legal@andina.test',
    powerOfAttorneyFileId: 'file-poder',
  };

  /** Las cinco partes del nombre del representante legal, por defecto: sólo las obligatorias. */
  const NOMBRE_REPRESENTANTE_DE_PRUEBA = {
    name: 'Mariana',
    middleName: '',
    thirdName: '',
    lastName: 'Siles',
    motherLastName: 'Justiniano',
  };

  /**
   * Las tres gerencias que `completar()` usa por defecto (subtarea 1.4 +
   * desglose de nombre). AC-01: la general trae las cinco partes; AC-02:
   * comercial y marketing sólo las obligatorias.
   */
  const GERENCIAS_DE_PRUEBA = {
    generalManager: {
      name: 'Carlos',
      middleName: 'Eduardo',
      thirdName: 'Andrés',
      lastName: 'Mendoza',
      motherLastName: 'Rivero',
      phone: '+591 70000001',
      email: 'gm@andina.test',
    },
    commercialManager: {
      name: 'Ana',
      middleName: '',
      thirdName: '',
      lastName: 'Paz',
      motherLastName: '',
      phone: '+591 70000002',
      email: 'cm@andina.test',
    },
    marketingManager: {
      name: 'Luis',
      middleName: '',
      thirdName: '',
      lastName: 'Rojas',
      motherLastName: '',
      phone: '+591 70000003',
      email: 'mm@andina.test',
    },
  };

  /** El cuerpo esperado de cada gerencia: el `fullName` compuesto de sus partes. */
  const GERENCIAS_ESPERADAS = {
    generalManager: {
      fullName: 'Carlos Eduardo Andrés Mendoza Rivero',
      phone: '+591 70000001',
      email: 'gm@andina.test',
    },
    commercialManager: { fullName: 'Ana Paz', phone: '+591 70000002', email: 'cm@andina.test' },
    marketingManager: { fullName: 'Luis Rojas', phone: '+591 70000003', email: 'mm@andina.test' },
  };

  function completar(
    extra: Partial<
      Record<
        | 'tradeName'
        | 'timeZone'
        | 'middleName'
        | 'thirdName'
        | 'motherLastName'
        | 'incorporationCountry'
        | 'legalEntityType'
        | 'legalRepresentativePhone'
        | keyof typeof DOCUMENTOS_DE_PRUEBA
        | keyof typeof REPRESENTANTE_DE_PRUEBA,
        string
      >
    > & {
      /** Sobrescribe alguna de las cinco partes del nombre del representante legal. */
      legalRepresentativeNombre?: Partial<typeof NOMBRE_REPRESENTANTE_DE_PRUEBA>;
      /** Sobrescribe las tres gerencias enteras (para probar combinaciones de partes). */
      executives?: typeof GERENCIAS_DE_PRUEBA;
    } = {},
  ): void {
    component.form.setValue({
      legalName: 'Andina Salud S.A.',
      incorporationCountry: extra.incorporationCountry ?? 'BO',
      legalEntityType: extra.legalEntityType ?? 'SRL',
      tradeName: extra.tradeName ?? '',
      // `code`/`carrierCode` derivan de esto: no son controles del form. La
      // sigla necesita al menos 3 caracteres (MIN_SIGLA); 'AS' ya no alcanza.
      sigla: 'ANDINA',
      regulatorIdentifier: 'NIT-123456',
      address: 'Av. Siempre Viva 123',
      // `incorporationCountry` se declara antes que `timeZone` en el form:
      // el valor explícito de acá siempre gana sobre el default que dispara
      // la suscripción al cambiar de país (ver `acomodarPaisYTipoSocietario`).
      timeZone: extra.timeZone ?? 'America/La_Paz',
      ownerName: {
        name: 'Ana',
        middleName: extra.middleName ?? '',
        thirdName: extra.thirdName ?? '',
        lastName: 'Paz',
        motherLastName: extra.motherLastName ?? '',
      },
      email: 'admin@andina.test',
      password: 'secreto12',
      constitutionFileId: extra.constitutionFileId ?? DOCUMENTOS_DE_PRUEBA.constitutionFileId,
      taxIdentifierFileId: extra.taxIdentifierFileId ?? DOCUMENTOS_DE_PRUEBA.taxIdentifierFileId,
      commerceRegistryFileId:
        extra.commerceRegistryFileId ?? DOCUMENTOS_DE_PRUEBA.commerceRegistryFileId,
      operatingLicenseFileId:
        extra.operatingLicenseFileId ?? DOCUMENTOS_DE_PRUEBA.operatingLicenseFileId,
      healthAuthorityCertificateFileId:
        extra.healthAuthorityCertificateFileId ??
        DOCUMENTOS_DE_PRUEBA.healthAuthorityCertificateFileId,
      legalRepresentative: {
        ...NOMBRE_REPRESENTANTE_DE_PRUEBA,
        ...extra.legalRepresentativeNombre,
      },
      legalRepresentativeIdNumber:
        extra.legalRepresentativeIdNumber ??
        REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
      legalRepresentativeEmail:
        extra.legalRepresentativeEmail ?? REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
      legalRepresentativePhone: extra.legalRepresentativePhone ?? '',
      powerOfAttorneyFileId:
        extra.powerOfAttorneyFileId ?? REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
      executives: extra.executives ?? GERENCIAS_DE_PRUEBA,
    });
  }

  /**
   * Avanza el asistente hasta que el título de la página vigente contenga
   * `fragmentoDeTitulo`, tope de 12 pasos (más de los que este alta puede
   * tener desde que sumó el representante legal y el directorio ejecutivo,
   * subtarea 1.4). El motor sólo renderiza la página actual (subtarea 1.2:
   * los `app-dropzone-pdf` de las páginas anteriores/siguientes no están en
   * el DOM), así que las pruebas que verifican ese render tienen que llegar
   * ahí primero — con el formulario ya completo, cada página vigente es
   * válida y `Continuar` no se bloquea.
   */
  function avanzarHasta(fragmentoDeTitulo: string): void {
    for (let paso = 0; paso < 12; paso += 1) {
      const titulo = fixture.nativeElement.querySelector('.paginated-form__titulo')?.textContent ?? '';
      if (titulo.includes(fragmentoDeTitulo)) return;
      const continuar: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '[data-testid="paginated-form-continuar"]',
      );
      continuar?.click();
      fixture.detectChanges();
    }
    throw new Error(`No se alcanzó una página con título que contenga «${fragmentoDeTitulo}»`);
  }

  it('se renderiza y muestra el formulario', () => {
    fixture.detectChanges();

    const form = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="registro-organizacion-form"]',
    );
    expect(form).not.toBeNull();
  });

  it('no envía con el formulario incompleto y marca los campos tocados', () => {
    fixture.detectChanges();
    component.submit();

    expect(component.form.controls.legalName.touched).toBe(true);
    expect(component.form.controls.legalEntityType.touched).toBe(true);
    expect(component.form.controls.sigla.touched).toBe(true);
    expect(component.form.controls.regulatorIdentifier.touched).toBe(true);
    expect(component.form.controls.address.touched).toBe(true);
    // `http.verify()` del afterEach falla si algo hubiera salido a la red.
  });

  it('sin tipo societario elegido, el campo queda inválido', () => {
    fixture.detectChanges();
    completar();
    component.form.controls.legalEntityType.setValue('');

    expect(component.form.controls.legalEntityType.invalid).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('una sigla que no deriva en un código válido queda inválida', () => {
    fixture.detectChanges();
    completar();
    // Tres guiones cumplen el largo mínimo (3) pero derivan en un código sin
    // ningún carácter alfanumérico: lo rechaza `siglaDerivaCodigo`, no `minLength`.
    component.form.controls.sigla.setValue('---');

    expect(component.form.controls.sigla.invalid).toBe(true);
    expect(component.form.controls.sigla.hasError('siglaSinCodigo')).toBe(true);
  });

  it('exige los 8 caracteres de contraseña que pide el backend', () => {
    fixture.detectChanges();
    completar();
    component.form.controls.password.setValue('corta');

    expect(component.form.controls.password.invalid).toBe(true);
  });

  it('llama a iam.registerOrganization con la forma exacta del contrato', () => {
    fixture.detectChanges();
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      organization: {
        code: 'ANDINA',
        legalName: 'Andina Salud S.A.',
        legalEntityType: 'SRL',
        tenantType: 'PAYER',
        // Zona única (Bolivia, país por defecto): viaja siempre, asignada
        // en segundo plano — nadie la eligió en pantalla.
        timeZone: 'America/La_Paz',
        payer: {
          // `code` y `carrierCode` son el mismo valor: los dos se derivan
          // de la sigla con `codigoDesdeSigla`.
          carrierCode: 'ANDINA',
          regulatorIdentifier: 'NIT-123456',
          sigla: 'ANDINA',
          address: 'Av. Siempre Viva 123',
        },
        legalDocuments: DOCUMENTOS_DE_PRUEBA,
        legalRepresentative: {
          fullName: 'Mariana Siles Justiniano',
          idNumber: REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
          email: REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
          powerOfAttorneyFileId: REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
        },
        executives: GERENCIAS_ESPERADAS,
      },
      owner: {
        email: 'admin@andina.test',
        password: 'secreto12',
        name: 'Ana',
        lastName: 'Paz',
      },
    });

    req.flush(RESPUESTA);
  });

  it('manda nombre comercial, zona horaria y los opcionales del owner cuando se completaron', () => {
    fixture.detectChanges();
    completar({
      tradeName: 'Andina',
      timeZone: 'America/La_Paz',
      middleName: 'María',
      thirdName: 'José',
      motherLastName: 'Quiroga',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.body.organization.tradeName).toBe('Andina');
    expect(req.request.body.organization.timeZone).toBe('America/La_Paz');
    // El backend no tiene columna de tercer nombre: se pliega en `middleName`.
    expect(req.request.body.owner.middleName).toBe('María José');
    expect(req.request.body.owner.motherLastName).toBe('Quiroga');
    // El cuerpo nunca lleva `thirdName`: no es una clave del contrato del owner.
    expect('thirdName' in req.request.body.owner).toBe(false);

    req.flush(RESPUESTA);
  });

  it('el owner con sólo tercer nombre lo manda como middleName', () => {
    fixture.detectChanges();
    completar({ thirdName: 'José' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.body.owner.middleName).toBe('José');

    req.flush(RESPUESTA);
  });

  it('el owner sin segundo ni tercer nombre no manda la clave middleName', () => {
    fixture.detectChanges();
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect('middleName' in req.request.body.owner).toBe(false);

    req.flush(RESPUESTA);
  });

  it('el bloque payer siempre viaja, con el tipo fijo en PAYER', () => {
    fixture.detectChanges();
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.body.organization.tenantType).toBe('PAYER');
    expect(req.request.body.organization.payer).toEqual({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'NIT-123456',
      sigla: 'ANDINA',
      address: 'Av. Siempre Viva 123',
    });

    req.flush(RESPUESTA);
  });

  it('tras registrar muestra la confirmación y NO inicia sesión sola', () => {
    fixture.detectChanges();
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-organization').flush(RESPUESTA);

    expect(component.registered()).toBe(true);
    // El backend devuelve identificadores, no tokens: entrar solo exigiría un
    // segundo viaje con las credenciales recién escritas.
    expect(navegaciones).toEqual([]);
  });

  it('cuando el owner tiene verificación de correo pendiente, lo dice', () => {
    fixture.detectChanges();
    completar();
    component.submit();
    http
      .expectOne('/iam/auth/register-organization')
      .flush({ ...RESPUESTA, emailVerificationSent: true });

    expect(component.verificationSent()).toBe(true);
  });

  it('el botón de la confirmación lleva al login', () => {
    fixture.detectChanges();
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-organization').flush(RESPUESTA);

    component.goToLogin();

    expect(navegaciones).toEqual(['/auth']);
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    fixture.detectChanges();
    completar();
    component.submit();
    component.submit();

    // `expectOne` falla si hubo dos.
    http.expectOne('/iam/auth/register-organization').flush(RESPUESTA);
  });

  describe('documentos legales de afiliación (subtarea 1.2)', () => {
    /**
     * Las instancias de `app-dropzone-pdf` renderizadas en la página
     * VIGENTE. El motor sólo pinta la página actual, y con 5 campos
     * `custom` en una sección de tope 4, se parte en «(1 de 2)» (los
     * primeros 4) y «(2 de 2)» (el SEDES) — hay que estar en la página
     * correcta para que aparezcan.
     */
    function dropzonesDeDocumentos(): DropzonePdf[] {
      return fixture.debugElement
        .queryAll(By.directive(DropzonePdf))
        .map((de) => de.componentInstance as DropzonePdf);
    }

    it('la sección de documentos renderiza los 5 controles, todos obligatorios', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Documentación legal obligatoria (PDF) (1 de 2)');
      const primeraTanda = dropzonesDeDocumentos();
      avanzarHasta('Documentación legal obligatoria (PDF) (2 de 2)');
      const segundaTanda = dropzonesDeDocumentos();

      const dropzones = [...primeraTanda, ...segundaTanda];
      expect(dropzones).toHaveLength(5);
      for (const dropzone of dropzones) {
        expect(dropzone.required()).toBe(true);
      }
    });

    it('cada dropzone corresponde a un testId de documento distinto', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Documentación legal obligatoria (PDF) (1 de 2)');
      const primeraTanda = dropzonesDeDocumentos().map((d) => d.testId());
      avanzarHasta('Documentación legal obligatoria (PDF) (2 de 2)');
      const segundaTanda = dropzonesDeDocumentos().map((d) => d.testId());

      const testIds = [...primeraTanda, ...segundaTanda];
      expect(new Set(testIds).size).toBe(5);
      expect(testIds).toContain('registro-organizacion-doc-healthAuthorityCertificateFileId');
    });

    it('sin uno de los cinco documentos, el formulario queda inválido y no se envía', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.healthAuthorityCertificateFileId.setValue('');

      component.submit();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.healthAuthorityCertificateFileId.touched).toBe(true);
      // `http.verify()` del afterEach falla si algo hubiera salido a la red.
    });

    it('cuando una dropzone recuerda un fileId, el control correspondiente lo guarda', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Documentación legal obligatoria (PDF) (2 de 2)');

      const dropzoneSedes = dropzonesDeDocumentos().find(
        (d) => d.testId() === 'registro-organizacion-doc-healthAuthorityCertificateFileId',
      );
      dropzoneSedes?.fileId.set('file-nuevo');
      fixture.detectChanges();

      expect(component.form.controls.healthAuthorityCertificateFileId.value).toBe('file-nuevo');
      expect(component.form.controls.healthAuthorityCertificateFileId.touched).toBe(true);
    });

    it('cuando una dropzone se queda sin archivo, el control vuelve a quedar vacío', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Documentación legal obligatoria (PDF) (1 de 2)');

      const dropzoneConstitucion = dropzonesDeDocumentos().find(
        (d) => d.testId() === 'registro-organizacion-doc-constitutionFileId',
      );
      // `completar()` puso el valor directo en el control, sin pasar por la
      // dropzone: hay que dejarla creer que tiene un archivo antes de que lo
      // pierda, si no `fileId.set(null)` no cambia nada (ya era `null`) y la
      // señal del `model()` no emite.
      dropzoneConstitucion?.fileId.set('file-constitution');
      fixture.detectChanges();
      dropzoneConstitucion?.fileId.set(null);
      fixture.detectChanges();

      expect(component.form.controls.constitutionFileId.value).toBe('');
    });

    it('el cuerpo del alta lleva los 5 fileId bajo legalDocuments', () => {
      fixture.detectChanges();
      completar({
        constitutionFileId: 'f-constitucion',
        taxIdentifierFileId: 'f-nit',
        commerceRegistryFileId: 'f-seprec',
        operatingLicenseFileId: 'f-licencia',
        healthAuthorityCertificateFileId: 'f-sedes',
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalDocuments).toEqual({
        constitutionFileId: 'f-constitucion',
        taxIdentifierFileId: 'f-nit',
        commerceRegistryFileId: 'f-seprec',
        operatingLicenseFileId: 'f-licencia',
        healthAuthorityCertificateFileId: 'f-sedes',
      });

      req.flush(RESPUESTA);
    });
  });

  describe('casa matriz georreferenciada (subtarea 1.3)', () => {
    it('con la casa matriz confirmada, el cuerpo del alta lleva latitude y longitude', () => {
      fixture.detectChanges();
      completar();
      component.gpsCasaMatriz.set({ lat: -17.7833, lng: -63.1821 });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.payer).toEqual({
        carrierCode: 'ANDINA',
        regulatorIdentifier: 'NIT-123456',
        sigla: 'ANDINA',
        address: 'Av. Siempre Viva 123',
        latitude: -17.7833,
        longitude: -63.1821,
      });

      req.flush(RESPUESTA);
    });

    it('la sección "Datos de la aseguradora" ofrece las dos puertas del mapa', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="registro-organizacion-casa-matriz-location-use"]',
        ),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="registro-organizacion-casa-matriz-location-pick"]',
        ),
      ).not.toBeNull();
    });

    it('una casa matriz ya confirmada sobrevive a ir y volver de página', () => {
      fixture.detectChanges();
      completar();
      component.gpsCasaMatriz.set({ lat: -17.7833, lng: -63.1821 });
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');

      // El `effect` de `inicial` en `UbicacionPicker` siembra el punto y lo
      // deja confirmado, aunque esta instancia del picker acaba de nacer: es
      // lo que evita que ir y volver muestre el bloque vacío otra vez (misma
      // lección que `documentoInicial` en `DropzonePdf`, subtarea 1.2).
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="registro-organizacion-casa-matriz-location-confirmed"]',
        ),
      ).not.toBeNull();
    });
  });

  describe('el mapa vacía la dirección de la casa matriz (D-06)', () => {
    /** La dirección escrita y dejada: tocada, como la deja quien la escribió. */
    function direccionEscritaYDejada(): HTMLInputElement {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');
      const campo: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="registro-organizacion-direccion"]',
      );
      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
      return campo;
    }

    function tocarElMapa(): void {
      const mapa = fixture.debugElement.query(By.directive(UbicacionPicker));
      (mapa.componentInstance as UbicacionPicker).puntoElegido.emit({ lat: -17.7833, lng: -63.1821 });
      fixture.detectChanges();
    }

    function errorDe(campo: HTMLElement): string {
      return campo.closest('app-form-field')?.querySelector('.form-field-error')?.textContent?.trim() ?? '';
    }

    const AVISO = '[data-testid="registro-organizacion-direccion-reescribir"]';

    it('la deja vacía sin marcarla en rojo, aunque la persona ya la hubiera tocado', () => {
      const campo = direccionEscritaYDejada();
      expect(component.form.controls.address.touched).toBe(true);

      tocarElMapa();

      expect(campo.value).toBe('');
      expect(errorDe(campo)).toBe('');
      expect(fixture.nativeElement.querySelector(AVISO)).not.toBeNull();
    });

    it('el aviso queda junto a «Dirección»: el mapa es el campo siguiente', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      const siguiente = campo.closest('app-form-field')?.nextElementSibling;
      expect(siguiente?.querySelector(AVISO)).not.toBeNull();
    });

    it('en un país con varias zonas horarias, el mapa también queda pegado a «Dirección»', () => {
      // Con la zona horaria son cinco campos y el motor parte la sección en dos
      // páginas: el mapa tiene que caer en la de «Dirección», justo después.
      fixture.detectChanges();
      completar({ incorporationCountry: 'US', legalEntityType: 'US_LLC' });
      component.form.controls.incorporationCountry.setValue('US');
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');
      // Es el caso de varias zonas: la zona horaria está en esta página.
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-zona"]'),
      ).not.toBeNull();

      const campo: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="registro-organizacion-direccion"]',
      );
      const siguiente = campo.closest('app-form-field')?.nextElementSibling;
      expect(siguiente?.querySelector('app-ubicacion-picker')).not.toBeNull();
    });

    it('tocarla después sí la marca, y el aviso sigue a su lado', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(errorDe(campo)).toBe('Escribí la dirección (hasta 300 caracteres).');
      expect(fixture.nativeElement.querySelector(AVISO)).not.toBeNull();
    });

    it('intentar avanzar sin reescribirla la marca y no deja pasar', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.paginated-form__titulo').textContent).toContain(
        'Datos de la aseguradora',
      );
      expect(errorDe(campo)).toBe('Escribí la dirección (hasta 300 caracteres).');
    });
  });

  describe('representante legal y gerencias (subtarea 1.4)', () => {
    function dropzonePoder(): DropzonePdf | undefined {
      return fixture.debugElement
        .queryAll(By.directive(DropzonePdf))
        .map((de) => de.componentInstance as DropzonePdf)
        .find((d) => d.testId() === 'registro-organizacion-doc-powerOfAttorneyFileId');
    }

    function paneles(): HTMLElement[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('app-accordion-panel'),
      );
    }

    it('el cuerpo del alta lleva legalRepresentative y executives, y ninguno de los dos dentro de payer', () => {
      fixture.detectChanges();
      completar({ legalRepresentativePhone: '+591 70099999' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalRepresentative).toEqual({
        fullName: 'Mariana Siles Justiniano',
        idNumber: REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
        email: REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
        phone: '+591 70099999',
        powerOfAttorneyFileId: REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
      });
      expect(req.request.body.organization.executives).toEqual(GERENCIAS_ESPERADAS);
      expect('legalRepresentative' in req.request.body.organization.payer).toBe(false);
      expect('executives' in req.request.body.organization.payer).toBe(false);

      req.flush(RESPUESTA);
    });

    it('sin el teléfono del representante (opcional), el cuerpo no lleva la clave phone', () => {
      fixture.detectChanges();
      completar();
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect('phone' in req.request.body.organization.legalRepresentative).toBe(false);

      req.flush(RESPUESTA);
    });

    it('sin el poder notariado, «Continuar» no avanza y la dropzone queda marcada', () => {
      fixture.detectChanges();
      completar({ powerOfAttorneyFileId: '' });
      fixture.detectChanges();
      avanzarHasta('Representante legal (1 de 2)');
      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.paginated-form__titulo')
          ?.textContent,
      ).toContain('Representante legal (2 de 2)');
      expect(dropzonePoder()).toBeDefined();
      expect(dropzonePoder()?.required()).toBe(true);
      expect(component.form.controls.powerOfAttorneyFileId.invalid).toBe(true);
    });

    it('«Directorio ejecutivo» muestra los tres paneles, el primero ya desplegado', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Directorio ejecutivo');

      const filas = paneles();
      expect(filas).toHaveLength(3);
      expect(filas[0].classList.contains('is-expanded')).toBe(true);
      expect(filas[1].classList.contains('is-expanded')).toBe(false);
      expect(filas[2].classList.contains('is-expanded')).toBe(false);
    });

    /**
     * Este caso ejercita B0 de punta a punta: el motor bloquea «Siguiente»
     * sobre el `FormGroup` de `executives` (no sobre sus hijos), emite
     * `rechazada`, y `alRechazarPagina` abre el panel y marca sus campos —
     * sin esa salida nueva del motor, esto no tendría cómo pasar.
     */
    it('con la gerencia de marketing incompleta, «Continuar» no avanza y su panel se despliega solo', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.executives.controls.marketingManager.controls.lastName.setValue('');
      fixture.detectChanges();
      avanzarHasta('Directorio ejecutivo');

      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.paginated-form__titulo')
          ?.textContent,
      ).toContain('Directorio ejecutivo');
      expect(paneles()[2].classList.contains('is-expanded')).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Este dato es obligatorio.',
      );
    });

    it('un correo de gerencia mal escrito se marca al salir del campo', () => {
      fixture.detectChanges();
      completar();
      const control = component.form.controls.executives.controls.generalManager.controls.email;
      control.setValue('gerente.general@');
      control.markAsTouched();
      fixture.detectChanges();
      avanzarHasta('Directorio ejecutivo');
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Revisá el correo: falta el arroba o el dominio.',
      );
    });

    it('ir y volver del «Directorio ejecutivo» conserva los valores escritos', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Directorio ejecutivo');
      avanzarHasta('Tu cuenta');
      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-atras"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(
        component.form.controls.executives.controls.generalManager.controls.name.value,
      ).toBe(GERENCIAS_DE_PRUEBA.generalManager.name);
    });

    it('en «Representante legal (1 de 2)» con los nombres vacíos, «Continuar» no avanza y los cinco campos quedan marcados', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Representante legal (1 de 2)');

      const grupo = component.form.controls.legalRepresentative;
      grupo.controls.name.setValue('');
      grupo.controls.lastName.setValue('');
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.paginated-form__titulo')
          ?.textContent,
      ).toContain('Representante legal (1 de 2)');
      for (const testId of [
        'registro-organizacion-representante-nombre',
        'registro-organizacion-representante-segundo-nombre',
        'registro-organizacion-representante-tercer-nombre',
        'registro-organizacion-representante-apellido-paterno',
        'registro-organizacion-representante-apellido-materno',
      ]) {
        expect(
          (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`),
        ).not.toBeNull();
      }
      expect(grupo.touched).toBe(true);
    });
  });

  describe('nombre en cinco partes del representante legal y las gerencias', () => {
    it('el representante legal compone su fullName con las cinco partes', () => {
      fixture.detectChanges();
      completar({
        legalRepresentativeNombre: {
          name: 'Mariana',
          middleName: 'Elena',
          thirdName: 'Sofía',
          lastName: 'Siles',
          motherLastName: 'Justiniano',
        },
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalRepresentative.fullName).toBe(
        'Mariana Elena Sofía Siles Justiniano',
      );

      req.flush(RESPUESTA);
    });

    it('el representante legal sin los opcionales compone sólo nombre y apellido paterno', () => {
      fixture.detectChanges();
      completar({
        legalRepresentativeNombre: {
          name: 'Mariana',
          middleName: '',
          thirdName: '',
          lastName: 'Siles',
          motherLastName: '',
        },
      });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalRepresentative.fullName).toBe('Mariana Siles');

      req.flush(RESPUESTA);
    });

    it('AC-01: la gerencia general compone su fullName con las cinco partes', () => {
      fixture.detectChanges();
      completar();
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.executives.generalManager.fullName).toBe(
        'Carlos Eduardo Andrés Mendoza Rivero',
      );

      req.flush(RESPUESTA);
    });

    it('AC-02: las gerencias comercial y de marketing componen su fullName con los opcionales vacíos', () => {
      fixture.detectChanges();
      completar();
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.executives.commercialManager.fullName).toBe(
        'Ana Paz',
      );
      expect(req.request.body.organization.executives.marketingManager.fullName).toBe(
        'Luis Rojas',
      );

      req.flush(RESPUESTA);
    });

    it('en el representante legal, nombre y apellido paterno vacíos invalidan el grupo; los otros tres no', () => {
      fixture.detectChanges();
      completar();

      const grupo = component.form.controls.legalRepresentative;
      grupo.controls.middleName.setValue('');
      grupo.controls.thirdName.setValue('');
      grupo.controls.motherLastName.setValue('');
      expect(grupo.valid).toBe(true);

      grupo.controls.name.setValue('');
      expect(grupo.invalid).toBe(true);
      grupo.controls.name.setValue('Mariana');
      grupo.controls.lastName.setValue('');
      expect(grupo.invalid).toBe(true);
    });

    it('en cada gerencia, nombre y apellido paterno vacíos invalidan el grupo; los otros tres no', () => {
      fixture.detectChanges();
      completar();

      const grupo = component.form.controls.executives.controls.generalManager;
      grupo.controls.middleName.setValue('');
      grupo.controls.thirdName.setValue('');
      grupo.controls.motherLastName.setValue('');
      expect(grupo.valid).toBe(true);

      grupo.controls.lastName.setValue('');
      expect(grupo.invalid).toBe(true);
      grupo.controls.lastName.setValue('Mendoza');
      grupo.controls.name.setValue('');
      expect(grupo.invalid).toBe(true);
    });

    it('un nombre compuesto de más de 200 caracteres marca el grupo inválido, aunque cada parte cumpla su propio tope', () => {
      fixture.detectChanges();
      completar();

      const grupo = component.form.controls.legalRepresentative;
      grupo.controls.name.setValue('A'.repeat(60));
      grupo.controls.middleName.setValue('B'.repeat(60));
      grupo.controls.thirdName.setValue('C'.repeat(60));
      grupo.controls.lastName.setValue('D'.repeat(60));
      grupo.controls.motherLastName.setValue('');

      // Cada parte, sola, respeta su propio tope de 100.
      expect(grupo.controls.name.valid).toBe(true);
      expect(grupo.controls.lastName.valid).toBe(true);
      // El compuesto (60*4 + 3 espacios = 243) supera el `@MaxLength(200)` de `fullName`.
      expect(grupo.hasError('nombreCompletoLargo')).toBe(true);
      expect(component.form.invalid).toBe(true);
    });
  });

  describe('nombre en cinco partes del owner', () => {
    it('«Tu cuenta» es UNA sola página y trae las cinco partes del nombre juntas', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Tu cuenta');

      // Era la sección que el motor partía en dos, con el apellido materno
      // huérfano al principio de la segunda página. Las cinco casillas —y el
      // correo y la contraseña— tienen que verse a la vez.
      for (const testId of [
        'registro-organizacion-owner-nombre',
        'registro-organizacion-owner-segundo-nombre',
        'registro-organizacion-owner-tercer-nombre',
        'registro-organizacion-owner-apellido-paterno',
        'registro-organizacion-owner-apellido-materno',
        'registro-organizacion-owner-correo',
        'registro-organizacion-owner-password',
      ]) {
        expect(
          fixture.nativeElement.querySelector(`[data-testid="${testId}"]`),
        ).not.toBeNull();
      }

      // Y el título no lleva numeración: «(1 de 2)» era justamente el síntoma.
      const titulo = fixture.nativeElement.querySelector('.paginated-form__titulo')?.textContent;
      expect(titulo).toContain('Tu cuenta');
      expect(titulo).not.toContain('de 2');
    });

    it('los tres nombres ocupan un tercio y los dos apellidos una mitad', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Tu cuenta');

      const grilla: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="registro-organizacion-owner-nombres"]',
      );
      expect(grilla).not.toBeNull();
      expect(grilla.querySelectorAll('.register-org__nombre--tercio').length).toBe(3);
      expect(grilla.querySelectorAll('.register-org__nombre--mitad').length).toBe(2);
    });

    it('con los nombres vacíos, «Continuar» no avanza y las cinco casillas quedan marcadas', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();
      avanzarHasta('Tu cuenta');

      const grupo = component.form.controls.ownerName;
      grupo.reset({ name: '', middleName: '', thirdName: '', lastName: '', motherLastName: '' });
      fixture.detectChanges();

      fixture.nativeElement
        .querySelector('[data-testid="paginated-form-continuar"]')
        ?.click();
      fixture.detectChanges();

      // El motor sólo marca el GRUPO; `alRechazarPagina` es quien alcanza a
      // sus cinco hijos — sin eso las casillas vacías no se pintarían.
      expect(grupo.controls.name.touched).toBe(true);
      expect(grupo.controls.motherLastName.touched).toBe(true);
      expect(
        fixture.nativeElement.querySelector('.paginated-form__titulo')?.textContent,
      ).toContain('Tu cuenta');
    });

    it('el owner compone su nombre en las claves del contrato, sin fullName', () => {
      fixture.detectChanges();
      completar({ middleName: 'María', thirdName: 'José', motherLastName: 'Quiroga' });

      component.submit();
      const req = http.expectOne('/iam/auth/register-organization');

      expect(req.request.body.owner.name).toBe('Ana');
      expect(req.request.body.owner.lastName).toBe('Paz');
      // El backend no tiene columna de tercer nombre: se pliega en `middleName`.
      expect(req.request.body.owner.middleName).toBe('María José');
      expect(req.request.body.owner.motherLastName).toBe('Quiroga');
      // El owner viaja en partes, no compuesto: `fullName` es de los contactos
      // (representante legal y gerencias), no de la cuenta.
      expect('fullName' in req.request.body.owner).toBe(false);
      req.flush(RESPUESTA);
    });

    it('el tope de 200 caracteres del nombre compuesto alcanza también al owner', () => {
      fixture.detectChanges();
      completar();

      const grupo = component.form.controls.ownerName;
      grupo.controls.name.setValue('A'.repeat(60));
      grupo.controls.middleName.setValue('B'.repeat(60));
      grupo.controls.thirdName.setValue('C'.repeat(60));
      grupo.controls.lastName.setValue('D'.repeat(60));

      // Antes no había dónde ponerlo: eran cinco controles sueltos, y el tope
      // depende de las cinco partes juntas. Como grupo, lo hereda de
      // `grupoDeNombre()` igual que el representante legal.
      expect(grupo.hasError('nombreCompletoLargo')).toBe(true);
      expect(component.form.invalid).toBe(true);
    });
  });

  describe('tipo societario y país de constitución (subtarea 1.1)', () => {
    it('Bolivia es el país de constitución por defecto', () => {
      fixture.detectChanges();

      expect(component.form.controls.incorporationCountry.value).toBe('BO');
    });

    it('cambiar el país a Brasil limpia una elección que dejó de pertenecer a la lista', () => {
      fixture.detectChanges();
      completar();

      component.form.controls.incorporationCountry.setValue('BR');

      // SRL no pertenece a Brasil: se limpia, no queda un valor fantasma que
      // el desplegable nuevo ya no ofrece.
      expect(component.form.controls.legalEntityType.value).toBe('');
    });

    it('cambiar el país sin haber elegido tipo societario no rompe nada', () => {
      fixture.detectChanges();

      expect(() => component.form.controls.incorporationCountry.setValue('US')).not.toThrow();
      expect(component.form.controls.legalEntityType.value).toBe('');
    });

    it('mandar un código extranjero viaja tal cual en el contrato', () => {
      fixture.detectChanges();
      completar({ incorporationCountry: 'BR', legalEntityType: 'BR_LTDA' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalEntityType).toBe('BR_LTDA');
      // El país de constitución nunca viaja: PAYER no es territorial y el
      // backend lo deriva del tipo societario.
      expect(req.request.body.organization.countryConceptId).toBeUndefined();

      req.flush(RESPUESTA);
    });
  });

  describe('errores', () => {
    it('CONFLICT muestra el mensaje que manda la API', () => {
      fixture.detectChanges();
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-organization').flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe una organización con ese código',
          timestamp: 't',
          path: '/iam/auth/register-organization',
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect(component.errorMessage()).toBe('Ya existe una organización con ese código');
      expect(component.registered()).toBe(false);
    });

    it('el 409 de código en uso se traduce nombrando la sigla, no el código invisible', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.sigla.setValue('ANDINA');
      component.submit();
      http.expectOne('/iam/auth/register-organization').flush(
        {
          code: 'CONFLICT',
          // Mensaje literal de `iam-organization-self-registration.service.ts`.
          message: 'El código de organización ya existe',
          timestamp: 't',
          path: '/iam/auth/register-organization',
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect(component.errorMessage()).toBe(
        'La sigla «ANDINA» ya está en uso en la plataforma. Elegí otra.',
      );
    });

    it('sin conexión lo dice como tal', () => {
      fixture.detectChanges();
      completar();
      component.submit();
      http
        .expectOne('/iam/auth/register-organization')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.errorMessage()).toContain('conexión');
    });
  });

  describe('códigos desde la sigla y zona horaria por país', () => {
    /** El total de páginas del asistente, leído del anuncio `aria-live` (siempre en el DOM). */
    function totalDePaginas(): number {
      const texto =
        fixture.nativeElement.querySelector('.paginated-form__anuncio')?.textContent ?? '';
      const match = /de (\d+)/.exec(texto);
      if (match === null) {
        throw new Error(`No se pudo leer el total de páginas del anuncio: "${texto}"`);
      }
      return Number(match[1]);
    }

    /** Los títulos de TODAS las páginas del recorrido, sin navegar (los pinta el stepper). */
    function titulosDeLosPasos(): string[] {
      const elementos: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.stepper__label');
      return Array.from(elementos).map((el) => el.textContent?.trim() ?? '');
    }

    it('AC-01: la sigla «APT» autogenera code y carrierCode iguales a «APT»', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.sigla.setValue('APT');
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.code).toBe('APT');
      expect(req.request.body.organization.payer.carrierCode).toBe('APT');

      req.flush(RESPUESTA);
    });

    it('normaliza la sigla de punta a punta: espacios y minúsculas se vuelven guion bajo y mayúsculas', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.sigla.setValue('la vitalicia');
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.code).toBe('LA_VITALICIA');
      expect(req.request.body.organization.payer.carrierCode).toBe('LA_VITALICIA');

      req.flush(RESPUESTA);
    });

    it('una sigla de 2 caracteres queda inválida y el envío no sale a la red', () => {
      fixture.detectChanges();
      completar();
      component.form.controls.sigla.setValue('AS');
      component.submit();

      expect(component.form.controls.sigla.invalid).toBe(true);
      http.expectNone('/iam/auth/register-organization');
    });

    it('AC-02 y AC-04: Bolivia (zona única) queda en 8 páginas, sin «Cómo se la identifica» y sin selector de zona', () => {
      fixture.detectChanges();
      completar();
      fixture.detectChanges();

      // Ocho, no nueve: «Tu cuenta» dejó de partirse en dos cuando los cinco
      // nombres del owner pasaron a viajar como un único campo (`ownerName`),
      // que es lo que los deja en una sola pantalla con su reparto de anchos.
      expect(totalDePaginas()).toBe(8);
      expect(titulosDeLosPasos().some((titulo) => titulo.includes('identifica'))).toBe(false);

      // «La empresa»: nombre, sigla, país, tipo societario — sin código ni
      // código de aseguradora, que ya no son campos.
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-sigla"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-codigo"]'),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-carrier"]'),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-comercial"]'),
      ).toBeNull();

      avanzarHasta('Datos de la aseguradora');
      // El nombre comercial se mudó acá; la zona horaria no se pregunta.
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-comercial"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-organizacion-zona"]'),
      ).toBeNull();

      component.submit();
      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.timeZone).toBe('America/La_Paz');
      req.flush(RESPUESTA);
    });

    it('AC-03: Estados Unidos (multizona) ofrece el selector de zona horaria, preseleccionado en la del Este', () => {
      fixture.detectChanges();
      completar({ incorporationCountry: 'US', legalEntityType: 'US_LLC' });
      // `completar()` fija `timeZone` en 'America/La_Paz' de forma explícita
      // (su valor por defecto para cualquier país, para no tener que
      // repetirlo en cada llamada): eso pisa el default que la suscripción
      // ya había puesto para EE. UU. Un re-disparo del cambio de país dispara
      // el default de nuevo, sin nada después que lo vuelva a pisar — así es
      // como lo vive una persona real, que nunca pasa por `completar()`.
      component.form.controls.incorporationCountry.setValue('US');
      fixture.detectChanges();

      // Una más que Bolivia: el selector de zona horaria es el quinto campo
      // de «Datos de la aseguradora», y el motor parte esa sección en dos.
      expect(totalDePaginas()).toBe(9);

      avanzarHasta('Datos de la aseguradora');
      // `[data-testid]` va en el host `<app-select>`; el `<select>` nativo
      // (donde vive `aria-required`, ver `select.html`) es su descendiente.
      const contenedor: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="registro-organizacion-zona"]',
      );
      const nativo: HTMLSelectElement | null | undefined = contenedor?.querySelector('select');
      expect(contenedor).not.toBeNull();
      expect(nativo?.getAttribute('aria-required')).toBe('true');
      expect(contenedor?.querySelectorAll('option:not([hidden])').length).toBe(7);
      expect(component.form.controls.timeZone.value).toBe('America/New_York');

      // Elegir el Pacífico y enviar: el valor viaja en el cuerpo.
      component.form.controls.timeZone.setValue('America/Los_Angeles');
      component.submit();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.timeZone).toBe('America/Los_Angeles');
      req.flush(RESPUESTA);
    });

    it('AC-03: la zona horaria elegida sobrevive a ir a «La empresa» y volver', () => {
      fixture.detectChanges();
      completar({ incorporationCountry: 'US', legalEntityType: 'US_LLC' });
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');
      component.form.controls.timeZone.setValue('America/Los_Angeles');
      fixture.detectChanges();

      const atras: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '[data-testid="paginated-form-atras"]',
      );
      atras?.click();
      fixture.detectChanges();
      avanzarHasta('Datos de la aseguradora');

      expect(component.form.controls.timeZone.value).toBe('America/Los_Angeles');
    });

    it('cambiar de país reasigna la zona horaria a la del país nuevo', () => {
      fixture.detectChanges();

      component.form.controls.incorporationCountry.setValue('US');
      expect(component.form.controls.timeZone.value).toBe('America/New_York');

      component.form.controls.incorporationCountry.setValue('BR');
      expect(component.form.controls.timeZone.value).toBe('America/Sao_Paulo');

      // Bolivia es zona única: el valor vuelve al de siempre.
      component.form.controls.incorporationCountry.setValue('BO');
      expect(component.form.controls.timeZone.value).toBe('America/La_Paz');

      component.form.controls.incorporationCountry.setValue('AR');
      expect(component.form.controls.timeZone.value).toBe('America/Argentina/Buenos_Aires');
    });
  });
});
