import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { NEVER, of } from 'rxjs';

import { ReverseGeocodingClient } from '../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../core/data-access/terminology/bo-municipalities.service';
import {
  MapLocationPicker,
  type LocalityFromPoint,
} from '../shared-registration/map-location-picker/map-location-picker';

import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import { DiagnosisCenterEnrollment } from '../shared-registration/diagnostic-center-enrollment';
import { RegisterPharmacy } from './register-pharmacy';

/** La forma que espera `IamClient.registerPharmacyOrganization`, según lo arma el cliente. */
interface CuerpoDelAlta {
  readonly organization: {
    readonly code: string;
    readonly legalName: string;
    readonly legalEntityType: string;
    readonly tenantType: string;
    readonly legalRepresentative: {
      readonly fullName: string;
      readonly email: string;
      readonly idNumber?: string;
      readonly powerOfAttorneyFileId?: string;
    };
    readonly legalDocuments?: Record<string, string>;
    readonly executives?: Record<string, { fullName: string; phone: string; email: string }>;
    readonly pharmacy?: {
      readonly address?: string;
      readonly latitude?: number;
      readonly longitude?: number;
      readonly branches?: readonly { name: string; latitude: number; longitude: number }[];
    };
  };
  readonly owner: { readonly email: string; readonly password: string; readonly displayName: string };
}

const RUTA_ALTA = '/iam/auth/register-organization';

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

const RESPUESTA_201 = {
  tenantId: 'tenant-1',
  code: 'FARM-123',
  ownerUserId: 'owner-1',
  status: 'PENDING_VERIFICATION',
  emailVerificationSent: true,
};

describe('RegisterPharmacy', () => {
  let fixture: ComponentFixture<RegisterPharmacy>;
  let component: RegisterPharmacy;
  let http: HttpTestingController;
  let navegaciones: string[];

  beforeEach(async () => {
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [RegisterPharmacy],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DiagnosisCenterEnrollment, useValue: { catalogs: () => of(CATALOGOS_DE_PRUEBA) } },
        // El mapa (GPS de la central/sucursales) no debe cargar Leaflet de
        // verdad en jsdom: ver el mismo provider en `register-organization.spec.ts`.
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
        // El selector pide la calle y el catálogo de municipios; acá no
        // responden: lo deducido se emite a mano por `localidad`.
        { provide: ReverseGeocodingClient, useValue: { streetAt: () => NEVER } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterPharmacy);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  /** Sólo lo obligatorio de D2: razón social, tipo, NIT, punto y dirección, representante, acceso. */
  function completarObligatorio(): void {
    component.form.controls.legalName.setValue('Farmacia San Martín S.R.L.');
    component.form.controls.companyType.setValue('SRL');
    component.form.controls.taxId.setValue('1023456789');
    component.form.controls.addressLines.setValue('Av. Cañoto esq. Ballivián 234');
    component.form.controls.legalRepName.patchValue({ name: 'Mariana', lastName: 'Siles' });
    component.form.controls.legalRepIdNumber.setValue('4872190');
    component.form.controls.legalRepEmail.setValue('legal@farmacia-sanmartin.test');
    // Una S.R.L. no puede omitir el poder (BR-09): la API responde 422.
    component.form.controls.powerOfAttorneyFileId.setValue('file-poder');
    component.form.controls.password.setValue('secreto12');
    // El punto de la central es obligatorio (pedido del cliente del 26/10/2026).
    component.fijarGpsCentral({ lat: -17.78, lng: -63.18 });
  }

  it('sólo con lo obligatorio: el cuerpo trae PHARMACY y ninguna clave opcional vacía', () => {
    completarObligatorio();
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    const cuerpo = req.request.body as CuerpoDelAlta;

    expect(cuerpo.organization.tenantType).toBe('PHARMACY');
    expect(cuerpo.organization.legalName).toBe('Farmacia San Martín S.R.L.');
    expect(cuerpo.organization.legalEntityType).toBe('SRL');
    expect(cuerpo.organization.legalRepresentative).toEqual({
      fullName: 'Mariana Siles',
      idNumber: '4872190',
      email: 'legal@farmacia-sanmartin.test',
      powerOfAttorneyFileId: 'file-poder',
    });
    // País y jurisdicción: sin ellos la API responde 422 «exige país y jurisdicción».
    expect(cuerpo.organization['countryConceptId' as keyof typeof cuerpo.organization]).toBe('concepto-BO');
    expect(cuerpo.organization['jurisdictionConceptId' as keyof typeof cuerpo.organization]).toBe(
      'concepto-JURISDICTION_NATIONAL',
    );
    expect(cuerpo.owner).toEqual({
      email: 'legal@farmacia-sanmartin.test',
      password: 'secreto12',
      displayName: 'Mariana Siles',
    });
    // Nada de lo opcional viaja si no se cargó: ni documentos ni gerencias.
    // La dirección legal y el punto de la central sí: son de la casa central,
    // que la API crea en toda alta de farmacia (P50), y el punto es obligatorio.
    expect('legalDocuments' in cuerpo.organization).toBe(false);
    expect('executives' in cuerpo.organization).toBe(false);
    expect(cuerpo.organization.pharmacy).toEqual({
      address: 'Av. Cañoto esq. Ballivián 234',
      latitude: -17.78,
      longitude: -63.18,
    });

    req.flush(RESPUESTA_201);
  });

  it('el NIT deriva el código de la organización', () => {
    completarObligatorio();
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.code).toBe('FARM-1023456789');
    req.flush(RESPUESTA_201);
  });

  it('no deja avanzar sin lo obligatorio: el submit no sale a la red', () => {
    component.submit();

    http.expectNone(RUTA_ALTA);
    expect(component.form.invalid).toBe(true);
    expect(component.form.controls.legalName.touched).toBe(true);
  });

  it('la contraseña corta bloquea el envío', () => {
    completarObligatorio();
    component.form.controls.password.setValue('123');
    component.submit();

    http.expectNone(RUTA_ALTA);
  });

  it('el punto de la central viaja como pharmacy.latitude/longitude', () => {
    completarObligatorio();
    component.fijarGpsCentral({ lat: -17.7, lng: -63.1 });
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy).toEqual({
      address: 'Av. Cañoto esq. Ballivián 234',
      latitude: -17.7,
      longitude: -63.1,
    });
    req.flush(RESPUESTA_201);
  });

  it('sin el punto de la central no sale a la red', () => {
    completarObligatorio();
    component.fijarGpsCentral(null);

    component.submit();

    http.expectNone(RUTA_ALTA);
    expect(component.form.controls.gpsCentral.invalid).toBe(true);
  });

  describe('la ubicación de la central sale del punto (26/10/2026)', () => {
    const PUNTO = { lat: -17.7833, lng: -63.1821 };

    function localidad(calle: string | null, zona: string | null = null): LocalityFromPoint {
      return { punto: PUNTO, calle, calleSola: calle, zona, municipioConceptId: null };
    }

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

    function irALaUbicacion(): void {
      fixture.detectChanges();
      completarObligatorio();
      component.fijarGpsCentral(null);
      fixture.detectChanges();
      avanzarHasta('Dónde está la central');
    }

    function selector(): MapLocationPicker {
      return fixture.debugElement.query(By.directive(MapLocationPicker))
        .componentInstance as MapLocationPicker;
    }

    it('el mapa es el primer campo de su página, obligatorio, y la dirección ya no se escribe', () => {
      const pagina = component.paginas().find((p) => p.clave === 'ubicacion')!;
      expect(pagina.campos[0]).toMatchObject({ key: 'gpsCentral', control: 'custom', required: true });
      expect(pagina.campos.map((c) => c.key)).not.toContain('addressLines');

      irALaUbicacion();
      expect(fixture.nativeElement.querySelector('[data-testid="registro-farmacia-direccion"]')).toBeNull();
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

    it('confirmar el punto en el mapa llena el control obligatorio', () => {
      irALaUbicacion();

      selector().confirmado.emit(PUNTO);

      expect(component.form.controls.gpsCentral.value).toEqual(PUNTO);
      expect(component.gpsCentral()).toEqual(PUNTO);
    });

    it('lo deducido del punto escribe la dirección legal; sin calle, la zona o el punto', () => {
      irALaUbicacion();

      selector().localidad.emit(localidad('Calle Guapay 3861, Equipetrol', 'Equipetrol'));
      expect(component.form.controls.addressLines.value).toBe('Calle Guapay 3861, Equipetrol');

      selector().localidad.emit(localidad(null, 'Equipetrol'));
      expect(component.form.controls.addressLines.value).toBe('Equipetrol');

      selector().localidad.emit(localidad(null));
      expect(component.form.controls.addressLines.value).toBe('Punto GPS -17.78330, -63.18210');
    });

    it('la dirección de una sucursal también sale de su punto', () => {
      component.agregarSucursal();
      const [sucursal] = component.sucursales();

      component.escribirLocalidadDeSucursal(sucursal!.id, localidad('Av. San Martín 456, Equipetrol'));

      expect(component.sucursales()[0]!.direccion).toBe('Av. San Martín 456, Equipetrol');
    });
  });

  it('una sucursal con nombre y punto confirmado viaja en pharmacy.branches', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Sucursal Equipetrol');
    component.fijarGpsDeSucursal(sucursal!.id, { lat: -17.75, lng: -63.15 });
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy?.branches).toEqual([
      { name: 'Sucursal Equipetrol', latitude: -17.75, longitude: -63.15 },
    ]);
    req.flush(RESPUESTA_201);
  });

  it('pegar un enlace de mapa con el punto escrito ya ubica la sucursal', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Sucursal Norte');
    component.escribirUrlDeSucursal(sucursal!.id, 'https://www.google.com/maps?q=-17.7480,-63.1750');
    component.ubicarSucursalPorEnlace(sucursal!.id);
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy?.branches).toEqual([
      expect.objectContaining({ name: 'Sucursal Norte', latitude: -17.748, longitude: -63.175 }),
    ]);
    req.flush(RESPUESTA_201);
  });

  it('enviar sin salir del campo del enlace (Enter) también ubica la sucursal', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Sucursal Norte');
    component.escribirUrlDeSucursal(sucursal!.id, 'https://www.google.com/maps?q=-17.7480,-63.1750');
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy?.branches).toEqual([
      expect.objectContaining({ name: 'Sucursal Norte', latitude: -17.748, longitude: -63.175 }),
    ]);
    req.flush(RESPUESTA_201);
  });

  it('mientras se escribe el enlace no aparece ningún pin; al salir del campo, el del enlace completo', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    const enlace = 'https://www.google.com/maps?q=-17.7480,-63.1750';
    for (let i = 1; i <= enlace.length; i++) {
      component.escribirUrlDeSucursal(sucursal!.id, enlace.slice(0, i));
    }
    expect(component.sucursales()[0]!.gps).toBeNull();

    component.ubicarSucursalPorEnlace(sucursal!.id);
    expect(component.sucursales()[0]!.gps).toEqual({ lat: -17.748, lng: -63.175 });

    // Corregir el enlace mueve el pin que vino de él.
    component.escribirUrlDeSucursal(sucursal!.id, 'https://www.google.com/maps?q=-17.7000,-63.1000');
    component.ubicarSucursalPorEnlace(sucursal!.id);
    expect(component.sucursales()[0]!.gps).toEqual({ lat: -17.7, lng: -63.1 });
  });

  it('una sucursal sin punto NO se descarta en silencio: el envío espera y la nombra', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Sucursal sin mapa');

    expect(component.sucursalesIncompletas().map((s) => s.rotulo)).toEqual(['Sucursal sin mapa']);
    expect(component.avisoDeSucursalesIncompletas()).toContain('«Sucursal sin mapa»');

    component.submit();
    http.expectNone(RUTA_ALTA);
    expect(component.errorMessage()).toContain('«Sucursal sin mapa»');

    // Completarla (aquí con el enlace con el punto escrito) desbloquea el envío.
    component.escribirUrlDeSucursal(
      sucursal!.id,
      'https://www.google.com/maps/@-17.7833,-63.1821,17z',
    );
    component.ubicarSucursalPorEnlace(sucursal!.id);
    expect(component.sucursalesIncompletas()).toEqual([]);
    component.submit();
    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy?.branches?.[0]).toMatchObject({
      name: 'Sucursal sin mapa',
      latitude: -17.7833,
      longitude: -63.1821,
    });
    req.flush(RESPUESTA_201);
  });

  it('un enlace con punto no pisa un pin ya marcado a mano', () => {
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.fijarGpsDeSucursal(sucursal!.id, { lat: -17.75, lng: -63.15 });
    component.escribirUrlDeSucursal(sucursal!.id, 'https://www.google.com/maps/@-10.1,-60.2,17z');
    component.ubicarSucursalPorEnlace(sucursal!.id);
    expect(component.sucursales()[0]!.gps).toEqual({ lat: -17.75, lng: -63.15 });
  });

  it('los cinco documentos legales viajan sólo si los cinco están cargados', () => {
    completarObligatorio();
    component.form.controls.constitutionFileId.setValue('file-1');
    component.form.controls.taxIdentifierFileId.setValue('file-2');
    component.submit();

    let req = http.expectOne(RUTA_ALTA);
    expect('legalDocuments' in (req.request.body as CuerpoDelAlta).organization).toBe(false);
    req.flush(RESPUESTA_201);

    fixture = TestBed.createComponent(RegisterPharmacy);
    component = fixture.componentInstance;
    completarObligatorio();
    component.form.controls.constitutionFileId.setValue('file-1');
    component.form.controls.taxIdentifierFileId.setValue('file-2');
    component.form.controls.commerceRegistryFileId.setValue('file-3');
    component.form.controls.operatingLicenseFileId.setValue('file-4');
    component.form.controls.healthAuthorityCertificateFileId.setValue('file-5');
    component.submit();

    req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.legalDocuments).toEqual({
      constitutionFileId: 'file-1',
      taxIdentifierFileId: 'file-2',
      commerceRegistryFileId: 'file-3',
      operatingLicenseFileId: 'file-4',
      healthAuthorityCertificateFileId: 'file-5',
    });
    req.flush(RESPUESTA_201);
  });

  it('el poder se pide en la página del representante, no con los papeles de la farmacia', () => {
    // `paginarCampos` puede partir una sección en «(1 de 2)»; los dos trozos llevan la misma clave.
    const camposDe = (clave: string) =>
      component
        .paginas()
        .filter((p) => p.clave === clave)
        .flatMap((p) => p.campos.map((c) => c.key));

    expect(camposDe('representante')).toEqual([
      'legalRepName',
      'legalRepIdNumber',
      'legalRepEmail',
      'powerOfAttorneyFileId',
    ]);
    expect(camposDe('documentos')).not.toContain('powerOfAttorneyFileId');
  });

  it('el poder del representante viaja aparte, dentro de legalRepresentative', () => {
    completarObligatorio();
    component.form.controls.powerOfAttorneyFileId.setValue('file-poder');
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.legalRepresentative).toEqual({
      fullName: 'Mariana Siles',
      idNumber: '4872190',
      email: 'legal@farmacia-sanmartin.test',
      powerOfAttorneyFileId: 'file-poder',
    });
    req.flush(RESPUESTA_201);
  });

  it('una S.R.L. sin poder notariado no se envía; una unipersonal sí (BR-09)', () => {
    completarObligatorio();
    component.form.controls.powerOfAttorneyFileId.setValue('');
    component.submit();
    http.expectNone(RUTA_ALTA);

    component.form.controls.companyType.setValue('UNIPERSONAL');
    component.submit();
    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.legalRepresentative).not.toHaveProperty(
      'powerOfAttorneyFileId',
    );
    req.flush(RESPUESTA_201);
  });

  it('una gerencia a medias no viaja: las tres o ninguna', () => {
    completarObligatorio();
    component.form.controls.generalManagerName.patchValue({ name: 'Carlos', lastName: 'Mendoza' });
    // Falta celular y correo: la gerencia general queda incompleta.
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect('executives' in (req.request.body as CuerpoDelAlta).organization).toBe(false);
    req.flush(RESPUESTA_201);
  });

  it('con las tres gerencias completas, executives viaja entero', () => {
    completarObligatorio();
    component.form.controls.generalManagerName.patchValue({ name: 'Carlos', lastName: 'Mendoza' });
    component.form.controls.generalManagerPhone.setValue('+591 70000001');
    component.form.controls.generalManagerEmail.setValue('gm@farmacia.test');
    component.form.controls.commercialManagerName.patchValue({ name: 'Ana', lastName: 'Paz' });
    component.form.controls.commercialManagerPhone.setValue('+591 70000002');
    component.form.controls.commercialManagerEmail.setValue('cm@farmacia.test');
    component.form.controls.marketingManagerName.patchValue({ name: 'Luis', lastName: 'Rojas' });
    component.form.controls.marketingManagerPhone.setValue('+591 70000003');
    component.form.controls.marketingManagerEmail.setValue('mm@farmacia.test');
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.executives).toEqual({
      generalManager: { fullName: 'Carlos Mendoza', phone: '+591 70000001', email: 'gm@farmacia.test' },
      commercialManager: { fullName: 'Ana Paz', phone: '+591 70000002', email: 'cm@farmacia.test' },
      marketingManager: { fullName: 'Luis Rojas', phone: '+591 70000003', email: 'mm@farmacia.test' },
    });
    req.flush(RESPUESTA_201);
  });

  it('los cinco nombres y los agregados viajan compuestos, en orden, en fullName y displayName', () => {
    completarObligatorio();
    const nombre = component.form.controls.legalRepName;
    nombre.patchValue({
      name: 'Mariana',
      middleName: 'Isabel',
      thirdName: 'Lucía',
      lastName: 'Siles',
      motherLastName: 'Paz',
    });
    nombre.controls.extraNames.push(new FormControl('Carola', { nonNullable: true }));
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    const cuerpo = req.request.body as CuerpoDelAlta;
    expect(cuerpo.organization.legalRepresentative.fullName).toBe(
      'Mariana Isabel Lucía Carola Siles Paz',
    );
    expect(cuerpo.owner.displayName).toBe('Mariana Isabel Lucía Carola Siles Paz');
    req.flush(RESPUESTA_201);
  });

  it('el apellido paterno del representante es obligatorio: sin él no sale a la red', () => {
    completarObligatorio();
    component.form.controls.legalRepName.patchValue({ lastName: '' });
    component.submit();

    http.expectNone(RUTA_ALTA);
    expect(component.form.controls.legalRepName.controls.lastName.touched).toBe(true);
  });

  it('el segundo y tercer nombre y el apellido materno son opcionales', () => {
    completarObligatorio();
    const nombre = component.form.controls.legalRepName.controls;
    expect(nombre.middleName.valid && nombre.thirdName.valid && nombre.motherLastName.valid).toBe(true);
  });

  it('«Siguiente» bloqueado en el representante marca cada casilla para que muestre su error', () => {
    component.alRechazarPagina({
      titulo: 'Representante legal',
      clave: 'representante',
      campos: [{ key: 'legalRepName', label: '', control: 'custom' }],
    });

    const nombre = component.form.controls.legalRepName.controls;
    expect(nombre.name.touched && nombre.lastName.touched).toBe(true);
  });

  it('201: pasa a la pantalla de "revise su correo" y el botón vuelve a /auth', () => {
    completarObligatorio();
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    req.flush(RESPUESTA_201);
    fixture.detectChanges();

    expect(component.registered()).toBe(true);
    expect(component.verificationSent()).toBe(true);

    component.goToLogin();
    expect(navegaciones).toEqual(['/auth']);
  });

  it('400: se muestra en pantalla, no en consola', () => {
    completarObligatorio();
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    req.flush(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: { messages: ['organization.legalEntityType must be one of the following values: SRL'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(component.errorMessage()).toContain('Tipo de sociedad');
    expect(component.errorMessage()).not.toContain('legalEntityType');
    expect(component.registered()).toBe(false);
  });

  it('409: correo repetido se muestra en pantalla', () => {
    completarObligatorio();
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    req.flush(
      { statusCode: 409, code: 'CONFLICT', message: 'Ya existe una cuenta con ese correo', error: 'Conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(component.errorMessage()).toContain('correo');
    expect(component.registered()).toBe(false);
  });

  describe('persistencia de borrador (onboarding draft)', () => {
    afterEach(() => {
      localStorage.removeItem('alovida.onboarding.draft.pharmacy');
    });

    it('guarda el avance en localStorage al cambiar de paso', () => {
      component.form.patchValue({
        legalName: 'Farmacia San Antonio SRL',
        taxId: '1023456789',
      });
      component.guardarBorrador();
      const raw = localStorage.getItem('alovida.onboarding.draft.pharmacy');
      expect(raw).not.toBeNull();
      const draft = JSON.parse(raw!);
      expect(draft.data.legalName).toBe('Farmacia San Antonio SRL');
      expect(draft.data.taxId).toBe('1023456789');
    });

    it('restaura el borrador guardado', () => {
      const mockDraft = {
        id: 'draft-pharm-1',
        formType: 'pharmacy',
        stepIndex: 1,
        stepKey: 'ubicacion',
        stepTitle: 'Ubicación de la central',
        totalSteps: 6,
        data: {
          legalName: 'Farmacia Central',
          taxId: '987654321',
        },
        extraData: {
          gpsCentral: { lat: -17.8, lng: -63.15 },
        },
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem('alovida.onboarding.draft.pharmacy', JSON.stringify(mockDraft));

      component.restaurarBorrador();

      expect(component.form.controls.legalName.value).toBe('Farmacia Central');
      expect(component.form.controls.taxId.value).toBe('987654321');
      expect(component.gpsCentral()).toEqual({ lat: -17.8, lng: -63.15 });
      expect(component.form.controls.gpsCentral.value).toEqual({ lat: -17.8, lng: -63.15 });
      expect(component.pasoGuardado()).toBe(1);
    });

    it('limpia el borrador al descartarlo', () => {
      localStorage.setItem('alovida.onboarding.draft.pharmacy', '{"id":"draft-1"}');
      component.descartarBorrador();
      expect(localStorage.getItem('alovida.onboarding.draft.pharmacy')).toBeNull();
    });
  });
});
