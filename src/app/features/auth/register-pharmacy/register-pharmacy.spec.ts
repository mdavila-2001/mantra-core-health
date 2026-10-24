import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import { AltaDeCentroDiagnostico } from '../registro-compartido/alta-de-centro-diagnostico';
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
        { provide: AltaDeCentroDiagnostico, useValue: { catalogos: () => of(CATALOGOS_DE_PRUEBA) } },
        // El mapa (GPS de la central/sucursales) no debe cargar Leaflet de
        // verdad en jsdom: ver el mismo provider en `register-organization.spec.ts`.
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
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

  /** Sólo lo obligatorio de D2: razón social, tipo, NIT, dirección, representante, acceso. */
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
    // Nada de lo opcional viaja si no se cargó: ni documentos, ni gerencias, ni central.
    expect('legalDocuments' in cuerpo.organization).toBe(false);
    expect('executives' in cuerpo.organization).toBe(false);
    expect('pharmacy' in cuerpo.organization).toBe(false);

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
    component.gpsCentral.set({ lat: -17.78, lng: -63.18 });
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect((req.request.body as CuerpoDelAlta).organization.pharmacy).toEqual({
      latitude: -17.78,
      longitude: -63.18,
    });
    req.flush(RESPUESTA_201);
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

  it('una sucursal sin punto confirmado no viaja: incompleta se descarta, no se manda a medias', () => {
    completarObligatorio();
    component.agregarSucursal();
    const [sucursal] = component.sucursales();
    component.escribirNombreDeSucursal(sucursal!.id, 'Sucursal sin mapa');
    component.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect('pharmacy' in (req.request.body as CuerpoDelAlta).organization).toBe(false);
    req.flush(RESPUESTA_201);
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
});
