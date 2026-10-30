import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import {
  MapLocationPicker,
  type LocalityFromPoint,
} from '../shared-registration/map-location-picker/map-location-picker';
import { ReverseGeocodingClient } from '../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../core/data-access/terminology/bo-municipalities.service';
import { NEVER, lastValueFrom, of } from 'rxjs';
import type {
  PdfUploader,
  UploadedDocument,
} from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf.types';
import type { EnrollmentDocumentKey } from '../shared-registration/legal-documents';
import { DiagnosisCenterEnrollment } from '../shared-registration/diagnostic-center-enrollment';
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
    2. Que frena sólo lo básico para nacer (D2, igual que la farmacia) —con el
       punto de la central, obligatorio desde el 26/10/2026— y NO frena el
       resto: los seis papeles, las sucursales y los cargos.
    3. Que el alta sale a `POST /iam/auth/register-organization` con
       `tenantType: 'DIAGNOSTIC_CENTER'` y el bloque `diagnosticUnit`, y que
       ninguna otra petición sale sin que la prueba la espere.

    Los tres son afirmaciones que se rompen solas si alguien cambia una regla
    sin darse cuenta, que es para lo que sirve una prueba.
    ========================================================================== */

const RUTA_ALTA = '/iam/auth/register-organization';

/** El punto confirmado de la central en las pruebas. */
const PUNTO_CENTRAL = { lat: -17.7833, lng: -63.1821 };

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
        { provide: DiagnosisCenterEnrollment, useValue: { catalogs: () => of(CATALOGOS_DE_PRUEBA) } },
        // El selector de ubicación pide la calle y el catálogo de municipios;
        // acá no responden: lo deducido se emite a mano por `localidad`.
        { provide: ReverseGeocodingClient, useValue: { streetAt: () => NEVER } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } },
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
    // El punto de la central es obligatorio (pedido del cliente del 26/10/2026).
    component.fijarGpsCentral(PUNTO_CENTRAL);
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
    // Salvo los papeles, que el cliente pidió en UNA sola vista (28/10/2026).
    for (const pagina of component.paginas().filter((p) => !p.sinPartir)) {
      expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
    }
  });

  it('los papeles de la empresa van en una sola página, sin «(1 de 2)»', () => {
    const papeles = component.paginas().filter((p) => p.clave === 'documentos');

    expect(papeles).toHaveLength(1);
    expect(papeles[0].titulo).toBe('Los papeles de la empresa');
    expect(papeles[0].sinPartir).toBe(true);
    expect(papeles[0].campos).toHaveLength(5);
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
      primarySite: {
        name: 'Casa central',
        address: { lines: ['Av. Cañoto esq. Ballivián 234'], latitude: -17.7833, longitude: -63.1821 },
      },
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
    'gpsCentral',
    'legalRepName',
    'legalRepIdNumber',
    'legalRepEmail',
    'password',
  ] as const)('sin %s no se envía', (clave) => {
    completarLoObligatorio();
    // `patchValue` y no `controls[clave].setValue`: el tipo de sociedad se
    // vacía con `null`, el nombre del representante vaciando su primer nombre,
    // y los demás con la cadena vacía.
    const vacio =
      clave === 'companyType' || clave === 'gpsCentral'
        ? null
        : clave === 'legalRepName'
          ? { name: '' }
          : '';
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
    component.agregarSucursal();
    component.agregarSucursal();
    const [conMapa, sinNombre] = component.sucursales();
    component.escribirNombreDeSucursal(conMapa!.id, 'Equipetrol');
    component.escribirLocalidadDeSucursal(conMapa!.id, localidad({ lat: -17.76, lng: -63.19 }, 'Av. San Martín 456'));
    component.fijarGpsDeSucursal(conMapa!.id, { lat: -17.76, lng: -63.19 });
    component.escribirLocalidadDeSucursal(sinNombre!.id, localidad({ lat: -17.7, lng: -63.1 }, 'Calle sin sucursal'));

    const cuerpo = enviarConExito();

    expect(cuerpo.organization.diagnosticUnit.primarySite.address).toEqual({
      lines: ['Av. Cañoto esq. Ballivián 234'],
      latitude: -17.7833,
      longitude: -63.1821,
    });
    // La fila sin nombre todavía no es una sucursal: no viaja.
    expect(cuerpo.organization.diagnosticUnit.branches).toEqual([
      {
        name: 'Equipetrol',
        address: { lines: ['Av. San Martín 456'], latitude: -17.76, longitude: -63.19 },
      },
    ]);
  });

  it('las sucursales subidas en lote viajan con su dirección, su punto, su descripción y su enlace (P51)', () => {
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
    // «Sur» vino sin punto: hasta que se marque en el mapa, no se envía.
    component.submit();
    expect(component.errorMessage()).toContain('«Sur»');
    const sur = component.sucursales()[1]!;
    component.fijarGpsDeSucursal(sur.id, { lat: -17.8, lng: -63.2 });
    const cuerpo = enviarConExito();

    // `DiagnosticUnitBranchDto` declara `description` y `locationUrl` (P51,
    // D-4): viajan contra la API real. Una descripción vacía no viaja.
    expect(cuerpo.organization.diagnosticUnit.branches).toEqual([
      {
        name: 'Norte',
        address: { lines: ['Av. Banzer 100'], latitude: -17.76, longitude: -63.19 },
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.76,-63.19',
      },
      {
        name: 'Sur',
        address: { lines: [], latitude: -17.8, longitude: -63.2 },
        locationUrl: 'https://maps.app.goo.gl/abc',
      },
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
    // El catálogo explica de quién es el correo y qué hacer, sin repetir la API.
    expect(component.errorMessage()).toContain('Ya hay una cuenta registrada con el correo del representante legal');
    expect(component.errorMessage()).toContain('¿Olvidó su contraseña?');
    const alerta = fixture.debugElement.query(By.css('[data-testid="registro-lab-error"]'));
    expect(alerta).not.toBeNull();
  });

  /* --- sucursales -------------------------------------------------------- */

  it('las sucursales se agregan, se editan y se quitan', () => {
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();

    component.escribirNombreDeSucursal(primera!.id, 'Equipetrol');
    component.escribirLocalidadDeSucursal(primera!.id, localidad({ lat: -17.78, lng: -63.18 }, 'Av. San Martín 456'));
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
    expect((exito.nativeElement as HTMLElement).textContent).toContain('¡Bienvenido a AloVida!');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Le enviamos un correo para confirmar su dirección');
    expect(texto).toContain('está en revisión');
  });

  it('mientras no se envía, el formulario está a la vista', () => {
    const form = fixture.debugElement.query(
      By.css('[data-testid="registro-form-laboratorio"]'),
    );

    expect(form).not.toBeNull();
  });

  it('una sucursal con nombre y sin punto confirmado frena el envío y se nombra', () => {
    completarLoObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Equipetrol');

    component.submit();

    // `http.verify()` del `afterEach` prueba que no salió nada.
    expect(component.registered()).toBe(false);
    expect(component.avisoDeSucursalesSinPunto()).toContain('«Equipetrol»');
    expect(component.errorMessage()).toContain('Confirmar dirección actual');
  });

  /* --- la ubicación de la central: sólo el punto (26/10/2026) ------------ */

  describe('la ubicación de la central sale del punto', () => {
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

    function selector(): MapLocationPicker {
      return fixture.debugElement.query(By.directive(MapLocationPicker))
        .componentInstance as MapLocationPicker;
    }

    function irALaUbicacion(): void {
      fixture.detectChanges();
      completarLoObligatorio();
      component.form.controls.gpsCentral.setValue(null);
      fixture.detectChanges();
      avanzarHasta('Dónde está la central');
    }

    it('el mapa es el primer campo de su página, obligatorio, y la dirección ya no se escribe', () => {
      const pagina = component.paginas().find((p) => p.clave === 'ubicacion')!;
      expect(pagina.campos[0]).toMatchObject({ key: 'gpsCentral', control: 'custom', required: true });
      expect(pagina.campos.map((c) => c.key)).not.toContain('addressLines');

      irALaUbicacion();
      expect(fixture.nativeElement.querySelector('[data-testid="registro-lab-direccion"]')).toBeNull();
      expect(fixture.debugElement.query(By.directive(MapLocationPicker))).not.toBeNull();
    });

    it('sin el punto confirmado no deja pasar, y lo dice', () => {
      irALaUbicacion();

      fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.paginated-form__titulo').textContent).toContain(
        'Dónde está la central',
      );
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
      );
    });

    it('confirmar el punto lo guarda en el control obligatorio, y quitarlo lo vacía', () => {
      irALaUbicacion();

      selector().confirmado.emit(PUNTO_CENTRAL);
      expect(component.form.controls.gpsCentral.value).toEqual(PUNTO_CENTRAL);
      expect(component.gpsCentral()).toEqual(PUNTO_CENTRAL);

      selector().confirmado.emit(null);
      expect(component.form.controls.gpsCentral.valid).toBe(false);
    });

    it('lo deducido del punto escribe la dirección legal', () => {
      irALaUbicacion();

      selector().localidad.emit(localidad(PUNTO_CENTRAL, 'Calle Guapay 3861, Equipetrol', 'Equipetrol'));

      expect(component.form.controls.addressLines.value).toBe('Calle Guapay 3861, Equipetrol');
    });

    it('sin calle, la dirección dice la zona o el punto, nunca una calle inventada', () => {
      irALaUbicacion();

      selector().localidad.emit(localidad(PUNTO_CENTRAL, null, 'Equipetrol'));
      expect(component.form.controls.addressLines.value).toBe('Equipetrol');

      selector().localidad.emit(localidad(PUNTO_CENTRAL, null, null));
      expect(component.form.controls.addressLines.value).toBe('Punto GPS -17.78330, -63.18210');
    });

    it('un punto restaurado sin dirección no deja un obligatorio invisible vacío', () => {
      component.form.controls.addressLines.setValue('');
      component.fijarGpsCentral(PUNTO_CENTRAL);

      expect(component.form.controls.addressLines.value).toBe('Punto GPS -17.78330, -63.18210');
      expect(component.form.controls.addressLines.valid).toBe(true);
    });
  });

  // D2 replaces mandatory papers in the older test branch. Upload and retry
  // remain covered through the shared pre-upload contract used by this screen.
  describe('document uploads with optional D2 registration', () => {
    const documentKeys: readonly EnrollmentDocumentKey[] = [
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
        recordarDocumento(key: EnrollmentDocumentKey, document: UploadedDocument): void;
        documentoInicialDe(key: EnrollmentDocumentKey): UploadedDocument | null;
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

  describe('persistencia de borrador (onboarding draft)', () => {
    afterEach(() => {
      localStorage.removeItem('alovida.onboarding.draft.laboratory');
    });

    it('guarda el avance en localStorage al cambiar de paso', () => {
      component.form.patchValue({
        legalName: 'Laboratorio Santa Cruz SRL',
        taxId: '1023456789',
      });
      component.guardarBorrador();
      const raw = localStorage.getItem('alovida.onboarding.draft.laboratory');
      expect(raw).not.toBeNull();
      const draft = JSON.parse(raw!);
      expect(draft.data.legalName).toBe('Laboratorio Santa Cruz SRL');
      expect(draft.data.taxId).toBe('1023456789');
    });

    it('restaura el borrador guardado', () => {
      const mockDraft = {
        id: 'draft-lab-1',
        formType: 'laboratory',
        stepIndex: 2,
        stepKey: 'ubicacion',
        stepTitle: 'Ubicación de la central',
        totalSteps: 7,
        data: {
          legalName: 'BioLab Central',
          taxId: '987654321',
        },
        extraData: {
          gpsCentral: { lat: -17.78, lng: -63.18 },
        },
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem('alovida.onboarding.draft.laboratory', JSON.stringify(mockDraft));

      component.restaurarBorrador();

      expect(component.form.controls.legalName.value).toBe('BioLab Central');
      expect(component.form.controls.taxId.value).toBe('987654321');
      expect(component.gpsCentral()).toEqual({ lat: -17.78, lng: -63.18 });
      expect(component.form.controls.gpsCentral.value).toEqual({ lat: -17.78, lng: -63.18 });
      expect(component.pasoGuardado()).toBe(2);
    });

    it('limpia el borrador al descartarlo', () => {
      localStorage.setItem('alovida.onboarding.draft.laboratory', '{"id":"draft-1"}');
      component.descartarBorrador();
      expect(localStorage.getItem('alovida.onboarding.draft.laboratory')).toBeNull();
    });
  });
});

/** Lo que `app-map-location-picker` emite por `localidad`. */
function localidad(
  punto: { lat: number; lng: number },
  calle: string | null,
  zona: string | null = null,
): LocalityFromPoint {
  return { punto, calle, calleSola: calle, zona, municipioConceptId: null };
}
