import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import { UbicacionPicker } from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { lastValueFrom, of } from 'rxjs';
import type {
  PdfUploader,
  UploadedDocument,
} from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf.types';
import type { ClaveDeDocumentoDelAlta } from '../registro-compartido/documentos-legales';
import { AltaDeCentroDiagnostico } from '../registro-compartido/alta-de-centro-diagnostico';
import { RegisterLaboratory, TIPOS_DE_SOCIEDAD } from './register-laboratory';

/**
 * Catálogo fijo para el alta: país, jurisdicción, tipo de unidad y modalidad
 * que la API exige como conceptos. Cada id es «concepto-<código>».
 */
const CATALOGOS_DE_PRUEBA = {
  pais: new Map([['BO', 'concepto-BO']]),
  jurisdiccion: new Map([['JURISDICTION_NATIONAL', 'concepto-JURISDICTION_NATIONAL']]),
  tipoDeUnidad: new Map([['DU_TYPE_LAB', 'concepto-DU_TYPE_LAB']]),
  modalidad: new Map([['DU_MODALITY_LAB', 'concepto-DU_MODALITY_LAB']]),
};

/* ============================================================================
    Lo que esta pantalla promete, y por lo tanto lo que se prueba:

    1. Que pregunta los dieciocho puntos del proceso 4.1 y ninguno inventado.
    2. Que frena sólo lo básico para nacer (D2, igual que la farmacia) y NO
       frena el resto: los seis papeles, el mapa, las sucursales y los cargos.
    3. Que el alta sale a `POST /iam/auth/register-organization` con
       `tenantType: 'DIAGNOSTIC_CENTER'` y el bloque `diagnosticUnit`, y que
       ninguna otra petición sale sin que la prueba la espere.

    Los tres son afirmaciones que se rompen solas si alguien cambia una regla
    sin darse cuenta, que es para lo que sirve una prueba.
    ========================================================================== */

const RUTA_ALTA = '/iam/auth/register-organization';

/** Lo que la API responde a un alta aceptada (201). */
const ALTA_ACEPTADA = {
  tenantId: 'tenant-1',
  code: 'LAB-1023456789',
  ownerUserId: 'owner-1',
  status: 'PENDING_VERIFICATION',
  emailVerificationSent: true,
  diagnosticUnitId: 'unidad-1',
};

/** El cuerpo de lo que salió, con la forma que el cliente le dio. */
interface CuerpoDelAlta {
  readonly organization: Record<string, unknown> & {
    readonly diagnosticUnit: {
      readonly name: string;
      readonly primarySite: {
        readonly name: string;
        readonly address: { readonly lines: string[]; readonly latitude?: number; readonly longitude?: number };
      };
      readonly branches?: readonly Record<string, unknown>[];
    };
  };
  readonly owner: Record<string, unknown>;
}

describe('RegisterLaboratory', () => {
  let fixture: ComponentFixture<RegisterLaboratory>;
  let component: RegisterLaboratory;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterLaboratory],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        { provide: AltaDeCentroDiagnostico, useValue: { catalogos: () => of(CATALOGOS_DE_PRUEBA) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterLaboratory);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    // Ninguna petición sin esperar: está en el `afterEach` a propósito, así
    // vale para todas las pruebas y no sólo para la que se acuerde.
    http.verify();
  });

  /** Envía y devuelve la petición del alta, todavía sin responder. */
  function enviarYCapturar() {
    component.submit();
    const peticion = http.expectOne(RUTA_ALTA);
    expect(peticion.request.method).toBe('POST');
    return peticion;
  }

  /** Envía, responde 201 y devuelve el cuerpo que salió. */
  function enviarConExito(): CuerpoDelAlta {
    const peticion = enviarYCapturar();
    const cuerpo = peticion.request.body as CuerpoDelAlta;
    peticion.flush(ALTA_ACEPTADA, { status: 201, statusText: 'Created' });
    return cuerpo;
  }

  /** Deja el formulario en el mínimo con el que se puede enviar. */
  function completarLoObligatorio(): void {
    component.form.patchValue({
      legalName: 'Laboratorio Clínico del Sur S.R.L.',
      companyType: 'SRL',
      taxId: '1023456789',
      addressLines: 'Av. Cañoto esq. Ballivián 234',
      legalRepName: { name: 'Ana', lastName: 'Paz', motherLastName: 'Rojas' },
      legalRepIdNumber: '4872190',
      legalRepEmail: 'ana.paz@labsur.test',
      // Una S.R.L. no puede omitir el poder (BR-09): la API responde 422.
      powerOfAttorneyFileId: 'file-poder',
      password: 'secreto12',
    });
  }

  /* --- lo que pregunta --------------------------------------------------- */

  it('ofrece los ocho tipos de sociedad del proceso, para elegir y no para escribir', () => {
    // 4.1.1.1 los enumera y dice para qué: poder contar cuántos proveedores hay
    // de cada tipo. Con un campo de texto libre ese conteo no existe.
    expect(TIPOS_DE_SOCIEDAD.map((t) => t.value)).toEqual([
      'UNIPERSONAL',
      'SRL',
      'LTDA',
      'SA',
      'SOCIEDAD_COLECTIVA',
      'COMANDITA_SIMPLE',
      'COMANDITA_ACCIONES',
      'SUCURSAL_EXTRANJERA',
    ]);
  });

  it('pregunta los seis papeles del proceso, ni uno más', () => {
    const papeles = Object.keys(component.form.controls).filter((clave) =>
      clave.endsWith('FileId'),
    );

    expect(papeles.sort()).toEqual([
      'commerceRegistryFileId',
      'constitutionFileId',
      'healthAuthorityCertificateFileId',
      'operatingLicenseFileId',
      'powerOfAttorneyFileId',
      'taxIdentifierFileId',
    ]);
  });

  it('ninguna página supera el tope de campos del motor', () => {
    // La invariante del formulario por partes. Se comprueba acá además de en el
    // motor porque una página de cinco campos no rompe nada: sólo se ve como
    // una pared, que es lo que hace abandonar un alta a la mitad.
    for (const pagina of component.paginas()) {
      expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
    }
  });

  /* --- qué frena y qué no ------------------------------------------------ */

  it('no se envía vacío: no sale ninguna petición', () => {
    component.submit();

    // `http.verify()` del `afterEach` prueba que no salió nada.
    expect(component.registered()).toBe(false);
    expect(component.form.touched).toBe(true);
  });

  it('se envía con lo básico y nada más, como DIAGNOSTIC_CENTER', () => {
    completarLoObligatorio();
    expect(component.form.valid).toBe(true);

    const cuerpo = enviarConExito();

    expect(cuerpo.organization).toMatchObject({
      code: 'LAB-1023456789',
      legalName: 'Laboratorio Clínico del Sur S.R.L.',
      legalEntityType: 'SRL',
      tenantType: 'DIAGNOSTIC_CENTER',
      // País y jurisdicción: sin ellos la API responde 422 «exige país y jurisdicción».
      countryConceptId: 'concepto-BO',
      jurisdictionConceptId: 'concepto-JURISDICTION_NATIONAL',
      legalRepresentative: {
        fullName: 'Ana Paz Rojas',
        idNumber: '4872190',
        email: 'ana.paz@labsur.test',
        powerOfAttorneyFileId: 'file-poder',
      },
    });
    expect(cuerpo.organization.diagnosticUnit).toEqual({
      name: 'Laboratorio Clínico del Sur S.R.L.',
      diagnosticUnitTypeConceptId: 'concepto-DU_TYPE_LAB',
      modalityConceptIds: ['concepto-DU_MODALITY_LAB'],
      primarySite: { name: 'Casa central', address: { lines: ['Av. Cañoto esq. Ballivián 234'] } },
    });
    expect(cuerpo.owner).toEqual({
      email: 'ana.paz@labsur.test',
      password: 'secreto12',
      displayName: 'Ana Paz Rojas',
    });
    // Lo opcional que no se completó no viaja: ni papeles ni cargos. El poder sí:
    // una S.R.L. no puede omitirlo (BR-09).
    expect(cuerpo.organization).not.toHaveProperty('legalDocuments');
    expect(cuerpo.organization).not.toHaveProperty('executives');
    expect(component.registered()).toBe(true);
  });

  it('el tipo de sociedad viaja como código de la lista, nunca como rótulo (B6)', () => {
    completarLoObligatorio();
    component.form.controls.companyType.setValue('COMANDITA_ACCIONES');

    const cuerpo = enviarConExito();

    expect(cuerpo.organization['legalEntityType']).toBe('COMANDITA_ACCIONES');
  });

  it.each([
    'legalName',
    'companyType',
    'taxId',
    'addressLines',
    'legalRepName',
    'legalRepIdNumber',
    'legalRepEmail',
    'password',
  ] as const)('sin %s no se envía', (clave) => {
    completarLoObligatorio();
    // `patchValue` y no `controls[clave].setValue`: el tipo de sociedad se
    // vacía con `null`, el nombre del representante vaciando su primer nombre,
    // y los demás con la cadena vacía.
    const vacio = clave === 'companyType' ? null : clave === 'legalRepName' ? { name: '' } : '';
    component.form.patchValue({ [clave]: vacio });

    component.submit();

    expect(component.registered()).toBe(false);
  });

  it('los seis papeles viajan cuando están todos: cinco de la empresa y el poder', () => {
    completarLoObligatorio();
    component.registrarDocumento('constitutionFileId', 'f-const');
    component.registrarDocumento('taxIdentifierFileId', 'f-nit');
    component.registrarDocumento('commerceRegistryFileId', 'f-seprec');
    component.registrarDocumento('operatingLicenseFileId', 'f-licencia');
    component.registrarDocumento('healthAuthorityCertificateFileId', 'f-sedes');
    component.registrarDocumento('powerOfAttorneyFileId', 'f-poder');

    const cuerpo = enviarConExito();

    expect(cuerpo.organization['legalDocuments']).toEqual({
      constitutionFileId: 'f-const',
      taxIdentifierFileId: 'f-nit',
      commerceRegistryFileId: 'f-seprec',
      operatingLicenseFileId: 'f-licencia',
      healthAuthorityCertificateFileId: 'f-sedes',
    });
    expect(cuerpo.organization['legalRepresentative']).toMatchObject({
      powerOfAttorneyFileId: 'f-poder',
    });
  });

  it('el poder se pide en la página del representante, no con los papeles de la empresa', () => {
    const pagina = (clave: string) => component.paginas().find((p) => p.clave === clave);

    expect(pagina('representante')?.campos.map((c) => c.key)).toEqual([
      'legalRepName',
      'legalRepIdNumber',
      'legalRepEmail',
      'powerOfAttorneyFileId',
    ]);
    expect(pagina('documentos')?.campos.map((c) => c.key)).not.toContain('powerOfAttorneyFileId');
  });

  it('con papeles a medias no viaja el bloque: el DTO lo pide todo o nada', () => {
    completarLoObligatorio();
    component.registrarDocumento('healthAuthorityCertificateFileId', 'f-sedes');

    const cuerpo = enviarConExito();

    expect(cuerpo.organization).not.toHaveProperty('legalDocuments');
  });

  it('los datos de los tres cargos son opcionales', () => {
    completarLoObligatorio();

    enviarConExito();

    // Ninguno de los nueve campos de gerencia se tocó, y el alta sale igual.
    expect(component.form.controls.generalManagerName.value.name).toBe('');
    expect(component.form.controls.salesManagerEmail.value).toBe('');
    expect(component.form.controls.marketingManagerPhone.value).toBe('');
    expect(component.registered()).toBe(true);
  });

  it('los tres cargos completos viajan como executives, con la comercial en commercialManager', () => {
    completarLoObligatorio();
    component.form.patchValue({
      generalManagerName: { name: 'Luis', lastName: 'Vaca' },
      generalManagerPhone: '+591 70000001',
      generalManagerEmail: 'general@labsur.test',
      salesManagerName: { name: 'Rosa', lastName: 'Justiniano' },
      salesManagerPhone: '+591 70000002',
      salesManagerEmail: 'ventas@labsur.test',
      marketingManagerName: { name: 'Iván', lastName: 'Suárez' },
      marketingManagerPhone: '+591 70000003',
      marketingManagerEmail: 'marketing@labsur.test',
    });

    const cuerpo = enviarConExito();

    expect(cuerpo.organization['executives']).toEqual({
      generalManager: { fullName: 'Luis Vaca', phone: '+591 70000001', email: 'general@labsur.test' },
      commercialManager: {
        fullName: 'Rosa Justiniano',
        phone: '+591 70000002',
        email: 'ventas@labsur.test',
      },
      marketingManager: {
        fullName: 'Iván Suárez',
        phone: '+591 70000003',
        email: 'marketing@labsur.test',
      },
    });
  });

  it('opcional no es «cualquier cosa»: un correo de gerente mal escrito frena', () => {
    completarLoObligatorio();
    component.form.controls.salesManagerEmail.setValue('esto-no-es-un-correo');

    component.submit();

    expect(component.registered()).toBe(false);
  });

  it('el NIT sólo acepta números', () => {
    completarLoObligatorio();
    component.form.controls.taxId.setValue('NIT-ABC');

    component.submit();

    expect(component.registered()).toBe(false);
  });

  it('el punto de la central y las sucursales con nombre viajan en diagnosticUnit', () => {
    completarLoObligatorio();
    component.gpsCentral.set({ lat: -17.7833, lng: -63.1821 });
    component.agregarSucursal();
    component.agregarSucursal();
    const [conMapa, sinNombre] = component.sucursales();
    component.escribirNombreDeSucursal(conMapa!.id, 'Equipetrol');
    component.escribirDireccionDeSucursal(conMapa!.id, 'Av. San Martín 456');
    component.fijarGpsDeSucursal(conMapa!.id, { lat: -17.76, lng: -63.19 });
    component.escribirDireccionDeSucursal(sinNombre!.id, 'Calle sin nombre de sucursal');

    const cuerpo = enviarConExito();

    expect(cuerpo.organization.diagnosticUnit.primarySite.address).toEqual({
      lines: ['Av. Cañoto esq. Ballivián 234'],
      latitude: -17.7833,
      longitude: -63.1821,
    });
    // La fila sin nombre todavía no es una sucursal: no viaja.
    expect(cuerpo.organization.diagnosticUnit.branches).toEqual([
      { name: 'Equipetrol', addressLines: ['Av. San Martín 456'], latitude: -17.76, longitude: -63.19 },
    ]);
  });

  it('las sucursales subidas en lote viajan con descripción, enlace y el punto que traía el enlace', () => {
    completarLoObligatorio();
    component.agregarSucursalesEnLote([
      {
        name: 'Norte',
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.76,-63.19',
        address: 'Av. Banzer 100',
        code: '',
        coordinates: { latitude: -17.76, longitude: -63.19 },
      },
      {
        name: 'Sur',
        description: '',
        locationUrl: 'https://maps.app.goo.gl/abc',
        address: '',
        code: '',
        coordinates: null,
      },
    ]);

    expect(component.nombresDeSucursales()).toEqual(['Norte', 'Sur']);
    const cuerpo = enviarConExito();

    expect(cuerpo.organization.diagnosticUnit.branches).toEqual([
      {
        name: 'Norte',
        addressLines: ['Av. Banzer 100'],
        latitude: -17.76,
        longitude: -63.19,
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.76,-63.19',
      },
      { name: 'Sur', addressLines: [], locationUrl: 'https://maps.app.goo.gl/abc' },
    ]);
  });

  it('mientras se envía, un segundo clic no duplica el alta', () => {
    completarLoObligatorio();

    const peticion = enviarYCapturar();
    component.submit();

    expect(component.isSubmitting()).toBe(true);
    peticion.flush(ALTA_ACEPTADA, { status: 201, statusText: 'Created' });
    expect(component.isSubmitting()).toBe(false);
  });

  it('un 409 por correo repetido se muestra y no da la cuenta por creada', async () => {
    completarLoObligatorio();

    enviarYCapturar().flush(
      {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Ya existe una cuenta con ese correo',
        requestId: 'req-409',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.registered()).toBe(false);
    expect(component.errorMessage()).toContain('Ya existe una cuenta con ese correo');
    const alerta = fixture.debugElement.query(By.css('[data-testid="registro-lab-error"]'));
    expect(alerta).not.toBeNull();
  });

  /* --- sucursales -------------------------------------------------------- */

  it('las sucursales se agregan, se editan y se quitan', () => {
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();

    component.escribirNombreDeSucursal(primera!.id, 'Equipetrol');
    component.escribirDireccionDeSucursal(primera!.id, 'Av. San Martín 456');
    component.fijarGpsDeSucursal(primera!.id, { lat: -17.78, lng: -63.18 });
    component.quitarSucursal(segunda!.id);

    expect(component.sucursales()).toEqual([
      {
        id: primera!.id,
        nombre: 'Equipetrol',
        descripcion: '',
        urlUbicacion: '',
        direccion: 'Av. San Martín 456',
        gps: { lat: -17.78, lng: -63.18 },
      },
    ]);
  });

  it('cada sucursal lleva su propio pin: confirmar una no confirma otra', () => {
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();

    expect(component.idsDeSucursal(primera!.id).mapa).not.toBe(
      component.idsDeSucursal(segunda!.id).mapa,
    );
  });

  it('quitar una sucursal no renumera las demás por dentro', () => {
    // El identificador es la atadura entre la fila y su pin en el mapa: si se
    // reasignara al borrar, el punto confirmado de una sucursal aparecería en
    // otra.
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();
    component.quitarSucursal(primera!.id);
    component.agregarSucursal();

    const ids = component.sucursales().map((s) => s.id);
    expect(ids[0]).toBe(segunda!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* --- la pantalla ------------------------------------------------------- */

  it('con el 201 muestra la cuenta creada y pide revisar el correo', async () => {
    completarLoObligatorio();

    enviarConExito();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const exito = fixture.debugElement.query(By.css('[data-testid="registro-lab-exito"]'));
    expect(exito).not.toBeNull();
    expect((exito.nativeElement as HTMLElement).textContent).toContain('Tu cuenta está lista');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('revisá tu bandeja de entrada');
    expect(texto).toContain('pendiente de aprobación');
  });

  it('mientras no se envía, el formulario está a la vista', () => {
    const form = fixture.debugElement.query(
      By.css('[data-testid="registro-form-laboratorio"]'),
    );

    expect(form).not.toBeNull();
  });

  /* --- el mapa vacía la dirección de la central (D-06) ------------------- */

  describe('el mapa vacía la dirección de la central', () => {
    /** Avanza el asistente hasta la página cuyo título contiene `fragmento`. */
    function avanzarHasta(fragmento: string): void {
      for (let paso = 0; paso < 12; paso += 1) {
        const titulo =
          fixture.nativeElement.querySelector('.paginated-form__titulo')?.textContent ?? '';
        if (titulo.includes(fragmento)) return;
        fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]')?.click();
        fixture.detectChanges();
      }
      throw new Error(`No se alcanzó una página con título que contenga «${fragmento}»`);
    }

    /** La dirección escrita y dejada: tocada, como la deja quien la escribió. */
    function direccionEscritaYDejada(): HTMLInputElement {
      fixture.detectChanges();
      completarLoObligatorio();
      fixture.detectChanges();
      avanzarHasta('Dónde está la central');
      const campo: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="registro-lab-direccion"]',
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

    it('la deja vacía sin marcarla en rojo, aunque la persona ya la hubiera tocado', () => {
      const campo = direccionEscritaYDejada();
      expect(component.form.controls.addressLines.touched).toBe(true);

      tocarElMapa();

      expect(campo.value).toBe('');
      expect(errorDe(campo)).toBe('');
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-lab-direccion-reescribir"]'),
      ).not.toBeNull();
    });

    it('tocarla después sí la marca, y el aviso sigue a su lado', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(errorDe(campo)).toBe('Escribí la dirección legal de la central.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-lab-direccion-reescribir"]'),
      ).not.toBeNull();
    });

    it('intentar avanzar sin reescribirla la marca y no deja pasar', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.paginated-form__titulo').textContent).toContain(
        'Dónde está la central',
      );
      expect(errorDe(campo)).toBe('Escribí la dirección legal de la central.');
    });
  });

  // D2 replaces mandatory papers in the older test branch. Upload and retry
  // remain covered through the shared pre-upload contract used by this screen.
  describe('document uploads with optional D2 registration', () => {
    const documentKeys: readonly ClaveDeDocumentoDelAlta[] = [
      'constitutionFileId',
      'taxIdentifierFileId',
      'commerceRegistryFileId',
      'operatingLicenseFileId',
      'healthAuthorityCertificateFileId',
      'powerOfAttorneyFileId',
    ];

    function uploads() {
      return component as unknown as {
        subirDocumento: PdfUploader;
        recordarDocumento(key: ClaveDeDocumentoDelAlta, document: UploadedDocument): void;
        documentoInicialDe(key: ClaveDeDocumentoDelAlta): UploadedDocument | null;
      };
    }

    const uploaded: UploadedDocument = {
      fileId: 'file-nit',
      originalName: 'nit.pdf',
      sizeBytes: 3,
      mimeType: 'application/pdf',
    };

    it('keeps all six papers optional for UNIPERSONAL', () => {
      completarLoObligatorio();
      component.form.controls.companyType.setValue('UNIPERSONAL');
      component.form.controls.powerOfAttorneyFileId.setValue('');
      for (const key of documentKeys) {
        expect(component.form.controls[key].value).toBe('');
        expect(component.form.controls[key].valid).toBe(true);
      }
      expect(component.form.valid).toBe(true);
      const body = enviarConExito();
      expect(body.organization).not.toHaveProperty('legalDocuments');
      expect(body.organization['legalRepresentative']).not.toHaveProperty('powerOfAttorneyFileId');
      // La API exige el documento del representante en toda alta de organización.
      expect(body.organization['legalRepresentative']).toHaveProperty('idNumber', '4872190');
    });

    // BR-09: la API rechaza con 422 una S.R.L. sin poder notariado.
    it('requires the power of attorney for SRL, as the API does', () => {
      completarLoObligatorio();
      component.form.controls.companyType.setValue('SRL');
      component.form.controls.powerOfAttorneyFileId.setValue('');
      expect(component.form.controls.powerOfAttorneyFileId.valid).toBe(false);
      expect(component.form.valid).toBe(false);
    });

    it('uploads the PDF before registration and preserves its response', async () => {
      const file = new File(['pdf'], 'nit.pdf', { type: 'application/pdf' });
      const result = lastValueFrom(uploads().subirDocumento(file));
      const request = http.expectOne('/iam/auth/upload-registration-document');
      expect(request.request.method).toBe('POST');
      expect((request.request.body as FormData).get('file')).toBe(file);
      request.flush(uploaded);
      expect(await result).toMatchObject({ body: uploaded });
      http.expectNone(RUTA_ALTA);
      expect(component.registered()).toBe(false);
    });

    it('keeps confirmed metadata when another upload fails and is retried', async () => {
      uploads().recordarDocumento('taxIdentifierFileId', uploaded);
      component.registrarDocumento('taxIdentifierFileId', uploaded.fileId);
      const file = new File(['pdf'], 'sedes.pdf', { type: 'application/pdf' });
      const first = lastValueFrom(uploads().subirDocumento(file));
      const failure = expect(first).rejects.toMatchObject({ status: 422 });
      http.expectOne('/iam/auth/upload-registration-document').flush(null, {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
      await failure;
      expect(component.form.controls.taxIdentifierFileId.value).toBe(uploaded.fileId);
      expect(uploads().documentoInicialDe('taxIdentifierFileId')).toEqual(uploaded);
      expect(component.form.controls.healthAuthorityCertificateFileId.value).toBe('');
      http.expectNone(RUTA_ALTA);
      const retry = lastValueFrom(uploads().subirDocumento(file));
      const request = http.expectOne('/iam/auth/upload-registration-document');
      expect((request.request.body as FormData).get('file')).toBe(file);
      request.flush({ ...uploaded, fileId: 'file-sedes', originalName: file.name });
      await retry;
      expect(uploads().documentoInicialDe('taxIdentifierFileId')).toEqual(uploaded);
    });

    it('remembers name and size and clears only the removed paper', () => {
      uploads().recordarDocumento('taxIdentifierFileId', uploaded);
      component.registrarDocumento('taxIdentifierFileId', uploaded.fileId);
      const other = { ...uploaded, fileId: 'file-sedes', originalName: 'sedes.pdf' };
      uploads().recordarDocumento('healthAuthorityCertificateFileId', other);
      component.registrarDocumento('healthAuthorityCertificateFileId', other.fileId);
      expect(uploads().documentoInicialDe('taxIdentifierFileId')).toEqual(uploaded);
      component.registrarDocumento('taxIdentifierFileId', null);
      expect(component.form.controls.taxIdentifierFileId.value).toBe('');
      expect(uploads().documentoInicialDe('taxIdentifierFileId')).toBeNull();
      expect(uploads().documentoInicialDe('healthAuthorityCertificateFileId')).toEqual(other);
    });

    it('allows registration to be retried after a rejection without re-uploading papers', () => {
      completarLoObligatorio();
      uploads().recordarDocumento('taxIdentifierFileId', uploaded);
      component.registrarDocumento('taxIdentifierFileId', uploaded.fileId);
      enviarYCapturar().flush({ message: 'Rejected', requestId: 'test-retry' }, {
        status: 409,
        statusText: 'Conflict',
      });
      expect(component.registered()).toBe(false);
      expect(component.isSubmitting()).toBe(false);
      enviarConExito();
      expect(component.registered()).toBe(true);
      expect(uploads().documentoInicialDe('taxIdentifierFileId')).toEqual(uploaded);
      http.expectNone('/iam/auth/upload-registration-document');
    });
  });

});
