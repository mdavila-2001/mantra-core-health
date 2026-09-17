import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { CAMPO_TIPO_SOCIETARIO } from '../../../core/data-access/system-context/legal-entity-types.service';
import { DropzonePdf } from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
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

  /** El representante legal que `completar()` usa por defecto (subtarea 1.4). */
  const REPRESENTANTE_DE_PRUEBA = {
    legalRepresentativeFullName: 'Mariana Siles Justiniano',
    legalRepresentativeIdNumber: '4872190 SC',
    legalRepresentativeEmail: 'legal@andina.test',
    powerOfAttorneyFileId: 'file-poder',
  };

  /** Las tres gerencias que `completar()` usa por defecto (subtarea 1.4). */
  const GERENCIAS_DE_PRUEBA = {
    generalManager: {
      fullName: 'Carlos Mendoza',
      phone: '+591 70000001',
      email: 'gm@andina.test',
    },
    commercialManager: { fullName: 'Ana Paz', phone: '+591 70000002', email: 'cm@andina.test' },
    marketingManager: {
      fullName: 'Luis Rojas',
      phone: '+591 70000003',
      email: 'mm@andina.test',
    },
  };

  function completar(
    extra: Partial<
      Record<
        | 'tradeName'
        | 'timeZone'
        | 'middleName'
        | 'motherLastName'
        | 'incorporationCountry'
        | 'legalEntityType'
        | 'legalRepresentativePhone'
        | keyof typeof DOCUMENTOS_DE_PRUEBA
        | keyof typeof REPRESENTANTE_DE_PRUEBA,
        string
      >
    > = {},
  ): void {
    component.form.setValue({
      code: 'ANDINA-SALUD',
      legalName: 'Andina Salud S.A.',
      incorporationCountry: extra.incorporationCountry ?? 'BO',
      legalEntityType: extra.legalEntityType ?? 'SRL',
      tradeName: extra.tradeName ?? '',
      sigla: 'AS',
      regulatorIdentifier: 'NIT-123456',
      address: 'Av. Siempre Viva 123',
      carrierCode: 'CARRIER-AS',
      timeZone: extra.timeZone ?? '',
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
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
      legalRepresentativeFullName:
        extra.legalRepresentativeFullName ?? REPRESENTANTE_DE_PRUEBA.legalRepresentativeFullName,
      legalRepresentativeIdNumber:
        extra.legalRepresentativeIdNumber ??
        REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
      legalRepresentativeEmail:
        extra.legalRepresentativeEmail ?? REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
      legalRepresentativePhone: extra.legalRepresentativePhone ?? '',
      powerOfAttorneyFileId:
        extra.powerOfAttorneyFileId ?? REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
      executives: GERENCIAS_DE_PRUEBA,
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
    expect(component.form.controls.carrierCode.touched).toBe(true);
    // `http.verify()` del afterEach falla si algo hubiera salido a la red.
  });

  it('sin tipo societario elegido, el campo queda inválido', () => {
    fixture.detectChanges();
    completar();
    component.form.controls.legalEntityType.setValue('');

    expect(component.form.controls.legalEntityType.invalid).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('rechaza un código con caracteres que el backend no admite', () => {
    fixture.detectChanges();
    completar();
    component.form.controls.code.setValue('ANDINA SALUD*');

    expect(component.form.controls.code.invalid).toBe(true);
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
        code: 'ANDINA-SALUD',
        legalName: 'Andina Salud S.A.',
        legalEntityType: 'SRL',
        tenantType: 'PAYER',
        payer: {
          carrierCode: 'CARRIER-AS',
          regulatorIdentifier: 'NIT-123456',
          sigla: 'AS',
          address: 'Av. Siempre Viva 123',
        },
        legalDocuments: DOCUMENTOS_DE_PRUEBA,
        legalRepresentative: {
          fullName: REPRESENTANTE_DE_PRUEBA.legalRepresentativeFullName,
          idNumber: REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
          email: REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
          powerOfAttorneyFileId: REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
        },
        executives: GERENCIAS_DE_PRUEBA,
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
      motherLastName: 'Quiroga',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.body.organization.tradeName).toBe('Andina');
    expect(req.request.body.organization.timeZone).toBe('America/La_Paz');
    expect(req.request.body.owner.middleName).toBe('María');
    expect(req.request.body.owner.motherLastName).toBe('Quiroga');

    req.flush(RESPUESTA);
  });

  it('el bloque payer siempre viaja, con el tipo fijo en PAYER', () => {
    fixture.detectChanges();
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-organization');
    expect(req.request.body.organization.tenantType).toBe('PAYER');
    expect(req.request.body.organization.payer).toEqual({
      carrierCode: 'CARRIER-AS',
      regulatorIdentifier: 'NIT-123456',
      sigla: 'AS',
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
        carrierCode: 'CARRIER-AS',
        regulatorIdentifier: 'NIT-123456',
        sigla: 'AS',
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
        fullName: REPRESENTANTE_DE_PRUEBA.legalRepresentativeFullName,
        idNumber: REPRESENTANTE_DE_PRUEBA.legalRepresentativeIdNumber,
        email: REPRESENTANTE_DE_PRUEBA.legalRepresentativeEmail,
        phone: '+591 70099999',
        powerOfAttorneyFileId: REPRESENTANTE_DE_PRUEBA.powerOfAttorneyFileId,
      });
      expect(req.request.body.organization.executives).toEqual(GERENCIAS_DE_PRUEBA);
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
      component.form.controls.executives.controls.marketingManager.controls.fullName.setValue('');
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
      avanzarHasta('Tu cuenta (1 de 2)');
      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-atras"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(
        component.form.controls.executives.controls.generalManager.controls.fullName.value,
      ).toBe(GERENCIAS_DE_PRUEBA.generalManager.fullName);
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
});
