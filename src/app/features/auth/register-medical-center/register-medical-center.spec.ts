import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { MEDICAL_ORGANIZATION_TYPES } from '../../../core/data-access/directory/directory.types';
import { OnboardingDraftService } from '../../../core/onboarding/onboarding-draft.service';
import { mensajeDeError } from '../../../shared/forms/paginated/error-message';
import { signupErrorMessage, RegisterMedicalCenter } from './register-medical-center';

const RUTA_ALTA = '/iam/auth/register-organization';

/** Los `fileId` que devolvería la pre-carga de cada documento. */
const DOCUMENTOS = {
  constitutionFileId: 'f-constitucion',
  taxIdentifierFileId: 'f-nit',
  commerceRegistryFileId: 'f-matricula',
  operatingLicenseFileId: 'f-licencia',
  healthAuthorityCertificateFileId: 'f-sedes',
};

/** El poder del representante, subido por la misma pre-carga. */
const PODER = 'f-poder';

/** El punto confirmado de la casa central en las pruebas. */
const PUNTO_CENTRAL = { lat: -17.7833, lng: -63.1821 };

const RESPUESTA_ALTA = {
  tenantId: 't-1',
  code: 'X',
  ownerUserId: 'u-1',
  status: 'p',
  emailVerificationSent: true,
};

const DESTINO_TIPO = 'directory.tenants.tenant_type_concept_id';

/** El catálogo `tenant-type` como lo publica la API, con tipos que no son médicos. */
const TIPOS_PUBLICADOS = ['PROVIDER', 'HOSPITAL', 'CLINIC', 'MEDICAL_OFFICE', 'NURSING', 'PHARMACY', 'PAYER', 'HEALTH_OTHER'];

const CATALOGOS: Record<string, { code: string; conceptId: string }[]> = {
  [DESTINO_TIPO]: TIPOS_PUBLICADOS.map((code) => ({ code, conceptId: `tt-${code}` })),
  'directory.tenants.country_concept_id': [{ code: 'BO', conceptId: 'c-bo' }],
  'profiles.jurisdiction_authorizations.jurisdiction_concept_id': [
    { code: 'JURISDICTION_NATIONAL', conceptId: 'j-nac' },
  ],
};

describe('RegisterMedicalCenter', () => {
  let fixture: ComponentFixture<RegisterMedicalCenter>;
  let http: HttpTestingController;
  let navegaciones: string[];
  let catalogoCaido: boolean;
  /** Los códigos del catálogo de tipos; `null` hace fallar su lectura. */
  let tiposDelCatalogo: readonly string[] | null;

  /** Acceso al estado protegido, que la plantilla usa y el spec necesita leer. */
  interface Interno {
    registered: () => boolean;
    errorMessage: () => string | null;
    paginas: () => readonly {
      titulo: string;
      clave?: string;
      sinPartir?: boolean;
      disposicion?: string;
      campos: readonly {
        key: string;
        label?: string;
        required?: boolean;
        control?: string;
        ancho?: string;
        opcionesEn?: string;
        hint?: string;
        options?: readonly { value: string; label: string }[];
      }[];
    }[];
  }
  const interno = (): Interno => fixture.componentInstance as unknown as Interno;

  beforeEach(async () => {
    navegaciones = [];
    catalogoCaido = false;
    tiposDelCatalogo = TIPOS_PUBLICADOS;

    await TestBed.configureTestingModule({
      imports: [RegisterMedicalCenter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: SystemContextClient,
          useValue: {
            dynamicEnum: (destino: string) => {
              if (destino === DESTINO_TIPO) {
                return tiposDelCatalogo === null
                  ? throwError(() => new Error('catálogo caído'))
                  : of({ options: tiposDelCatalogo.map((code) => ({ code, conceptId: `tt-${code}` })) });
              }
              return of({ options: catalogoCaido ? [] : (CATALOGOS[destino] ?? []) });
            },
          },
        },
        {
          provide: LegalEntityTypesCatalog,
          useValue: {
            listar: () => of([]),
            opcionesPorPais: () => [{ value: 'SRL', label: 'S.R.L.' }],
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(Router).navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterMedicalCenter);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  /** Deja el formulario en lo mínimo con lo que se puede enviar (sin gerencias ni sucursales). */
  function completar(tenantType = 'HOSPITAL'): void {
    fixture.componentInstance.form.patchValue({
      tenantType,
      legalName: 'Centro Médico Norte S.R.L.',
      legalEntityType: 'SRL',
      taxId: '1023456789',
      healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
      medicalDirectorName: { name: 'Ana', middleName: 'Lucía', lastName: 'Rojas', motherLastName: 'Paz' },
      medicalDirectorLicense: 'MAT-12345',
      medicalDirectorEmail: 'dir@centro.test',
      medicalDirectorPhone: '+591 70012345',
      ...DOCUMENTOS,
      powerOfAttorneyFileId: PODER,
      legalRepName: { name: 'Marta', lastName: 'Rojas' },
      legalRepIdNumber: '4872190',
      legalRepEmail: 'marta@centro.test',
      password: 'secreto12',
    });
    fixture.componentInstance.fijarGpsCentral(PUNTO_CENTRAL);
    fixture.componentInstance.escribirLocalidadCentral({
      punto: PUNTO_CENTRAL,
      calle: 'Av. San Martín 123',
      calleSola: 'Av. San Martín 123',
      zona: null,
      municipioConceptId: null,
    });
  }

  /** Completa las tres gerencias (nombre, celular y correo). */
  function completarGerencias(): void {
    fixture.componentInstance.form.patchValue({
      generalManagerName: { name: 'Gabriel', lastName: 'Gómez' },
      generalManagerPhone: '+591 70011111',
      generalManagerEmail: 'general@centro.test',
      salesManagerName: { name: 'Carla', lastName: 'Cruz' },
      salesManagerPhone: '+591 70022222',
      salesManagerEmail: 'comercial@centro.test',
      marketingManagerName: { name: 'Mario', lastName: 'Mena' },
      marketingManagerPhone: '+591 70033333',
      marketingManagerEmail: 'marketing@centro.test',
    });
  }

  /** Las opciones del tipo de institución que la pantalla ofrece. */
  const opcionesDeTipo = () =>
    interno().paginas()[0]!.campos.find((campo) => campo.key === 'tenantType')?.options ?? [];

  /** Vuelve a armar la pantalla, para que lea el catálogo con otro estado. */
  async function rearmar(): Promise<void> {
    fixture = TestBed.createComponent(RegisterMedicalCenter);
    await fixture.whenStable();
  }

  it('envía el tipo elegido con país y jurisdicción resueltos por código, y el bloque del establecimiento', () => {
    completar();
    fixture.componentInstance.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect(req.request.body).toEqual({
      organization: {
        code: 'CM-CENTRO-MEDICO-NORTE-S-R-L',
        legalName: 'Centro Médico Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'HOSPITAL',
        legalDocuments: DOCUMENTOS,
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
        timeZone: 'America/La_Paz',
        legalRepresentative: {
          fullName: 'Marta Rojas',
          idNumber: '4872190',
          email: 'marta@centro.test',
          powerOfAttorneyFileId: PODER,
        },
        medicalFacility: {
          taxIdentifierNumber: '1023456789',
          healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
          medicalDirector: {
            name: 'Ana',
            middleName: 'Lucía',
            lastName: 'Rojas',
            motherLastName: 'Paz',
            professionalLicenseNumber: 'MAT-12345',
            email: 'dir@centro.test',
            phone: '+591 70012345',
          },
          headquarters: {
            name: 'Casa central',
            addressLines: ['Av. San Martín 123'],
            latitude: -17.7833,
            longitude: -63.1821,
          },
        },
      },
      owner: { email: 'marta@centro.test', password: 'secreto12', name: 'Marta', lastName: 'Rojas' },
    });
    req.flush(RESPUESTA_ALTA);
  });

  it.each([
    ['HOSPITAL', 'Hospital'],
    ['CLINIC', 'Clínica'],
    ['MEDICAL_OFFICE', 'Consultorio médico'],
    ['NURSING', 'Centro de enfermería'],
    ['HEALTH_OTHER', 'Otra institución de salud'],
  ])('«%s» viaja con su código en tenantType y se rotula «%s»', (codigo, rotulo) => {
    expect(opcionesDeTipo()).toContainEqual({ value: codigo, label: rotulo });

    completar(codigo);
    fixture.componentInstance.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect(req.request.body.organization.tenantType).toBe(codigo);
    req.flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: false });
  });

  it('ofrece los cinco tipos médicos del catálogo, en orden, y ninguno ajeno', () => {
    expect(opcionesDeTipo().map((o) => o.value)).toEqual([...MEDICAL_ORGANIZATION_TYPES]);
  });

  it('un tipo que la API no publica en su catálogo no se ofrece', async () => {
    tiposDelCatalogo = ['HOSPITAL', 'MEDICAL_OFFICE', 'NURSING', 'HEALTH_OTHER', 'PHARMACY'];
    await rearmar();

    expect(opcionesDeTipo().map((o) => o.value)).toEqual([
      'HOSPITAL',
      'MEDICAL_OFFICE',
      'NURSING',
      'HEALTH_OTHER',
    ]);
  });

  it('si el catálogo de tipos no se puede leer, ofrece la lista tipada entera', async () => {
    tiposDelCatalogo = null;
    await rearmar();

    expect(opcionesDeTipo().map((o) => o.value)).toEqual([...MEDICAL_ORGANIZATION_TYPES]);
  });

  it('mientras el catálogo no responde ofrece la lista de respaldo, y su fallo la conserva sin romper', async () => {
    // C2 de la segunda revisión: con un catálogo lento el grupo no puede quedar
    // vacío. El fallo tiene que estar manejado: un error sin `error` en la
    // suscripción sale como excepción no capturada y la prueba cae.
    const pendiente = new Subject<{ options: { code: string; conceptId: string }[] }>();
    const contexto = TestBed.inject(SystemContextClient) as unknown as {
      dynamicEnum: (destino: string) => unknown;
    };
    const original = contexto.dynamicEnum;
    contexto.dynamicEnum = (destino: string) =>
      destino === DESTINO_TIPO ? pendiente.asObservable() : original(destino);
    await rearmar();

    expect(opcionesDeTipo().map((o) => o.value)).toEqual([...MEDICAL_ORGANIZATION_TYPES]);

    expect(() => pendiente.error(new Error('catálogo caído'))).not.toThrow();
    expect(opcionesDeTipo().map((o) => o.value)).toEqual([...MEDICAL_ORGANIZATION_TYPES]);
  });

  it('un catálogo que responde sin ninguno de los cinco ofrece la lista tipada entera', async () => {
    tiposDelCatalogo = ['PROVIDER', 'PHARMACY', 'PAYER'];
    await rearmar();

    expect(opcionesDeTipo().map((o) => o.value)).toEqual([...MEDICAL_ORGANIZATION_TYPES]);
  });

  it('un tipo ya marcado que el catálogo deja de ofrecer se vacía y no sale a la red', async () => {
    const pendiente = new Subject<{ options: { code: string; conceptId: string }[] }>();
    const contexto = TestBed.inject(SystemContextClient) as unknown as {
      dynamicEnum: (destino: string) => unknown;
    };
    const original = contexto.dynamicEnum;
    contexto.dynamicEnum = (destino: string) =>
      destino === DESTINO_TIPO ? pendiente.asObservable() : original(destino);
    await rearmar();

    // La persona eligió «Clínica» (p. ej. con la lista de respaldo) y después
    // llega un catálogo que no la publica.
    completar('CLINIC');
    fixture.componentInstance.form.controls.tenantType.markAsTouched();
    pendiente.next({
      options: ['HOSPITAL', 'MEDICAL_OFFICE'].map((code) => ({ code, conceptId: `tt-${code}` })),
    });

    const tipo = fixture.componentInstance.form.controls.tenantType;
    expect(opcionesDeTipo().map((o) => o.value)).toEqual(['HOSPITAL', 'MEDICAL_OFFICE']);
    expect(tipo.value).toBe('');
    expect(tipo.hasError('required')).toBe(true);
    expect(fixture.componentInstance.form.invalid).toBe(true);

    fixture.componentInstance.submit();
    http.expectNone(RUTA_ALTA);
  });

  it('un valor que no está entre las opciones vigentes es inválido aunque no esté vacío', async () => {
    tiposDelCatalogo = ['HOSPITAL', 'MEDICAL_OFFICE'];
    await rearmar();

    const tipo = fixture.componentInstance.form.controls.tenantType;
    tipo.setValue('CLINIC');
    expect(tipo.hasError('notOffered')).toBe(true);
    tipo.setValue('HOSPITAL');
    expect(tipo.valid).toBe(true);
  });

  it('sin tipo de institución no sale a la red y lo marca', () => {
    completar('');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(fixture.componentInstance.form.controls.tenantType.touched).toBe(true);
    expect(fixture.componentInstance.form.controls.tenantType.hasError('required')).toBe(true);
  });

  it('un código que no es de organización médica no se envía', () => {
    completar('PHARMACY');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
  });

  it('con campos obligatorios vacíos no sale a la red y los marca', () => {
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(fixture.componentInstance.form.controls.tenantType.touched).toBe(true);
    expect(fixture.componentInstance.form.controls.legalName.touched).toBe(true);
    expect(fixture.componentInstance.form.controls.password.touched).toBe(true);
  });

  it('pide lo mismo que imagenología, sin estudios, más el registro del SEDES y el director médico', () => {
    const paginas = interno().paginas();

    expect(paginas.map((p) => p.titulo)).toEqual([
      'La organización',
      'Datos del establecimiento',
      'Director médico',
      'Documentación legal obligatoria (PDF)',
      'Dónde está la casa central',
      'Sus sucursales',
      'Representante legal',
      'Poder del representante legal',
      'Gerencia general',
      'Gerencia comercial',
      'Gerencia de marketing',
      'Su acceso',
    ]);
    expect(paginas.map((p) => p.campos.map((c) => c.key))).toEqual([
      ['tenantType', 'legalName', 'legalEntityType'],
      ['taxId', 'healthFacilityRegistrationNumber'],
      ['medicalDirectorName', 'medicalDirectorLicense', 'medicalDirectorEmail', 'medicalDirectorPhone'],
      [
        'constitutionFileId',
        'taxIdentifierFileId',
        'commerceRegistryFileId',
        'operatingLicenseFileId',
        'healthAuthorityCertificateFileId',
      ],
      ['gpsCentral'],
      ['sucursales'],
      ['legalRepName', 'legalRepIdNumber', 'legalRepPhone'],
      ['powerOfAttorneyFileId'],
      ['generalManagerName', 'generalManagerPhone', 'generalManagerEmail'],
      ['salesManagerName', 'salesManagerPhone', 'salesManagerEmail'],
      ['marketingManagerName', 'marketingManagerPhone', 'marketingManagerEmail'],
      ['legalRepEmail', 'password'],
    ]);
    // Los papeles van todos en una vista (pedido del cliente del 28/10/2026); el resto, de a cuatro como tope.
    const documentos = paginas.find((p) => p.clave === 'documentos-legales')!;
    expect(documentos.sinPartir).toBe(true);
    expect(Math.max(...paginas.filter((p) => !p.sinPartir).map((p) => p.campos.length))).toBeLessThanOrEqual(4);
  });

  it('el tipo de institución es un desplegable y la primera página reparte sus tres campos en columnas', () => {
    const organizacion = interno().paginas()[0]!;
    const tipo = organizacion.campos.find((c) => c.key === 'tenantType')!;

    expect(tipo.control).toBe('select');
    expect(tipo.opcionesEn).toBeUndefined();
    expect(organizacion.disposicion).toBe('tres-columnas');
  });

  it('cada página con varios campos cortos declara sus columnas (regla 6 del cliente: sin casillas kilométricas)', () => {
    const paginas = interno().paginas();
    const disposicion = Object.fromEntries(paginas.map((p) => [p.clave, p.disposicion]));

    // La disposición de TODAS las páginas, no sólo de la primera.
    expect(disposicion).toStrictEqual({
      organizacion: 'tres-columnas',
      establecimiento: 'dos-columnas',
      director: 'tres-columnas',
      'documentos-legales': undefined,
      ubicacion: undefined,
      sucursales: undefined,
      representante: 'dos-columnas',
      poder: undefined,
      'gerencia-general': 'dos-columnas',
      'gerencia-comercial': 'dos-columnas',
      'gerencia-marketing': 'dos-columnas',
      acceso: 'dos-columnas',
    });

    // Y la regla de fondo: una página con dos o más campos (salvo los papeles, que son zonas de carga)
    // nunca queda en una sola columna a todo el ancho.
    for (const pagina of paginas.filter((p) => !p.sinPartir && p.campos.length >= 2)) {
      expect(pagina.disposicion, `${pagina.clave}: tiene ${pagina.campos.length} campos`).toBeDefined();
    }
  });

  it('en las páginas que empiezan por el nombre, éste ocupa su renglón entero y lo demás va junto', () => {
    const paginas = interno().paginas();
    for (const clave of ['director', 'representante']) {
      const [nombre, ...resto] = paginas.find((p) => p.clave === clave)!.campos;
      expect(nombre!.control, clave).toBe('custom');
      expect(nombre!.ancho, clave).toBe('completo');
      expect(resto.every((c) => c.ancho === undefined), clave).toBe(true);
    }
    for (const clave of ['gerencia-general', 'gerencia-comercial', 'gerencia-marketing']) {
      expect(paginas.find((p) => p.clave === clave)!.campos[0]!.ancho, clave).toBe('completo');
    }
  });

  it('si el catálogo de tipos societarios falla, pide al servicio su respaldo en vez de dejarlo vacío', async () => {
    const catalogo = TestBed.inject(LegalEntityTypesCatalog);
    const pedidos: unknown[][] = [];
    catalogo.listar = () => throwError(() => new Error('catálogo caído'));
    catalogo.opcionesPorPais = (...args: unknown[]) => {
      pedidos.push(args);
      return [{ value: 'SRL', label: 'S.R.L.' }];
    };
    await rearmar();

    const societario = interno().paginas()[0]!.campos.find((c) => c.key === 'legalEntityType')!;
    expect(pedidos).toEqual([[[], 'BO']]);
    expect(societario.options).toEqual([{ value: 'SRL', label: 'S.R.L.' }]);
  });

  it('sin uno de los cinco documentos no sale a la red y lo marca', () => {
    completar();
    fixture.componentInstance.form.controls.operatingLicenseFileId.setValue('');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(fixture.componentInstance.form.controls.operatingLicenseFileId.touched).toBe(true);
    expect(fixture.componentInstance.form.controls.operatingLicenseFileId.invalid).toBe(true);
  });

  it('un profesional independiente se registra sin escritura ni matrícula, y no las envía', () => {
    completar();
    const form = fixture.componentInstance.form;
    form.controls.legalEntityType.setValue('PROFESIONAL_INDEPENDIENTE');
    form.controls.constitutionFileId.setValue('');
    form.controls.commerceRegistryFileId.setValue('');
    fixture.componentInstance.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect(req.request.body.organization.legalDocuments).toEqual({
      taxIdentifierFileId: 'f-nit',
      operatingLicenseFileId: 'f-licencia',
      healthAuthorityCertificateFileId: 'f-sedes',
    });
    req.flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: false });
  });

  it('una unipersonal puede omitir la escritura pero no la matrícula', () => {
    completar();
    const form = fixture.componentInstance.form;
    form.controls.legalEntityType.setValue('UNIPERSONAL');
    form.controls.constitutionFileId.setValue('');
    form.controls.commerceRegistryFileId.setValue('');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(form.controls.constitutionFileId.valid).toBe(true);
    expect(form.controls.commerceRegistryFileId.invalid).toBe(true);
  });

  it('una S.R.L. sigue exigiendo los cinco documentos', () => {
    completar();
    const form = fixture.componentInstance.form;
    form.controls.constitutionFileId.setValue('');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(form.controls.constitutionFileId.invalid).toBe(true);
  });

  it('los documentos que el tipo societario permite omitir se rotulan «(opcional)» y vuelven a ser obligatorios al cambiar de tipo', () => {
    const form = fixture.componentInstance.form;
    const campo = (clave: string) =>
      interno()
        .paginas()
        .flatMap((p) => p.campos)
        .find((c) => c.key === clave)!;

    form.controls.legalEntityType.setValue('PROFESIONAL_INDEPENDIENTE');
    expect(campo('constitutionFileId').label).toMatch(/\(opcional\)$/);
    expect(campo('commerceRegistryFileId').label).toMatch(/\(opcional\)$/);
    expect(campo('commerceRegistryFileId').required).toBeUndefined();
    expect(campo('taxIdentifierFileId').label).not.toMatch(/opcional/);

    form.controls.legalEntityType.setValue('SRL');
    expect(campo('constitutionFileId').label).not.toMatch(/opcional/);
    expect(campo('constitutionFileId').required).toBe(true);
    expect(form.controls.commerceRegistryFileId.hasValidator(Validators.required)).toBe(true);
  });

  it('quitar un documento ya subido vacía su control', () => {
    completar();
    fixture.componentInstance.registrarDocumento('constitutionFileId', null);

    expect(fixture.componentInstance.form.controls.constitutionFileId.value).toBe('');
    expect(fixture.componentInstance.form.valid).toBe(false);
  });

  it('la contraseña avisa su mínimo antes de equivocarse, como el alta de usuarios', () => {
    const clave = interno().paginas().at(-1)!.campos.find((c) => c.key === 'password')!;
    expect(clave.hint).toBe('Mínimo 8 caracteres.');
  });

  it('la razón social vacía tiene su propio mensaje', () => {
    const razonSocial = fixture.componentInstance.form.controls.legalName;
    razonSocial.markAsTouched();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Escriba la razón social de la organización.',
    );
  });

  it('la razón social admite 300 caracteres y rechaza 301, como la API', () => {
    const razonSocial = fixture.componentInstance.form.controls.legalName;
    razonSocial.setValue('A'.repeat(300));
    expect(razonSocial.valid).toBe(true);
    razonSocial.setValue('A'.repeat(301));
    expect(razonSocial.hasError('maxlength')).toBe(true);

    // El mensaje dice el tope, no «escriba la razón social»: el campo no está vacío.
    razonSocial.markAsTouched();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No puede pasar de 300 caracteres.');
  });

  it('una contraseña corta no se envía', () => {
    completar();
    fixture.componentInstance.form.controls.password.setValue('corta');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
  });

  it('al terminar dice que la organización queda en revisión', () => {
    completar();
    fixture.componentInstance.submit();
    http
      .expectOne(RUTA_ALTA)
      .flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
    fixture.detectChanges();

    expect(interno().registered()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="medical-center-signup-pending"]')?.textContent).toContain(
      'está en revisión',
    );
  });

  it('un 409 se explica en castellano y deja volver a intentar', () => {
    completar();
    fixture.componentInstance.submit();
    http.expectOne(RUTA_ALTA).flush({}, { status: 409, statusText: 'Conflict' });

    expect(interno().errorMessage()).toContain('Ya existe una cuenta con ese correo');
    expect(interno().registered()).toBe(false);
  });

  it('si el catálogo no trae el país o la jurisdicción frena y lo dice, sin enviar', () => {
    catalogoCaido = true;
    completar();
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
    expect(interno().errorMessage()).toContain('No pudimos cargar los catálogos del alta');
  });

  describe('el alta ampliada (paridad con imagenología)', () => {
    const control = () => fixture.componentInstance.form.controls;
    const enviar = () => fixture.componentInstance.submit();

    it('las tres gerencias completas viajan como bloque, con el nombre completo', () => {
      completar();
      completarGerencias();
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.executives).toEqual({
        generalManager: { fullName: 'Gabriel Gómez', phone: '+591 70011111', email: 'general@centro.test' },
        commercialManager: { fullName: 'Carla Cruz', phone: '+591 70022222', email: 'comercial@centro.test' },
        marketingManager: { fullName: 'Mario Mena', phone: '+591 70033333', email: 'marketing@centro.test' },
      });
      req.flush(RESPUESTA_ALTA);
    });

    it('sin gerencias el alta sale igual y no manda la clave', () => {
      completar();
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect('executives' in req.request.body.organization).toBe(false);
      req.flush(RESPUESTA_ALTA);
    });

    it('gerencias a medias (todo o nada): no sale a la red y pide completarlas o vaciarlas', () => {
      completar();
      completarGerencias();
      fixture.componentInstance.form.patchValue({ salesManagerEmail: '' });
      enviar();

      http.expectNone(RUTA_ALTA);
      expect(interno().errorMessage()).toContain('Complete las tres gerencias');
      expect(interno().registered()).toBe(false);

      // Vaciadas las tres, el alta sale sin ellas.
      fixture.componentInstance.form.patchValue({
        generalManagerName: { name: '', lastName: '' },
        generalManagerPhone: '',
        generalManagerEmail: '',
        salesManagerName: { name: '', lastName: '' },
        salesManagerPhone: '',
        marketingManagerName: { name: '', lastName: '' },
        marketingManagerPhone: '',
        marketingManagerEmail: '',
      });
      enviar();
      http.expectOne(RUTA_ALTA).flush(RESPUESTA_ALTA);
    });

    it('un correo de gerencia escrito a medias frena, aunque las gerencias sean opcionales', () => {
      completar();
      control().generalManagerEmail.setValue('no-es-un-correo');
      enviar();

      http.expectNone(RUTA_ALTA);
      expect(control().generalManagerEmail.invalid).toBe(true);
    });

    it('una unipersonal se registra sin constitución ni poder, y no los envía', () => {
      completar();
      control().legalEntityType.setValue('UNIPERSONAL');
      control().constitutionFileId.setValue('');
      control().powerOfAttorneyFileId.setValue('');
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.legalDocuments).toEqual({
        taxIdentifierFileId: 'f-nit',
        commerceRegistryFileId: 'f-matricula',
        operatingLicenseFileId: 'f-licencia',
        healthAuthorityCertificateFileId: 'f-sedes',
      });
      expect('powerOfAttorneyFileId' in req.request.body.organization.legalRepresentative).toBe(false);
      req.flush(RESPUESTA_ALTA);
    });

    it('una S.R.L. sin el poder del representante no sale a la red', () => {
      completar();
      control().powerOfAttorneyFileId.setValue('');
      enviar();

      http.expectNone(RUTA_ALTA);
      expect(control().powerOfAttorneyFileId.invalid).toBe(true);
    });

    it('un profesional independiente sigue necesitando el poder (sólo una unipersonal lo omite)', () => {
      completar();
      control().legalEntityType.setValue('PROFESIONAL_INDEPENDIENTE');
      control().powerOfAttorneyFileId.setValue('');
      expect(control().powerOfAttorneyFileId.invalid).toBe(true);
    });

    it('el poder se rotula «(opcional)» sólo para una unipersonal', () => {
      const poder = () =>
        interno()
          .paginas()
          .flatMap((p) => p.campos)
          .find((c) => c.key === 'powerOfAttorneyFileId')!;

      expect(poder().label).not.toMatch(/opcional/);
      expect(poder().required).toBe(true);
      control().legalEntityType.setValue('UNIPERSONAL');
      expect(poder().label).toMatch(/\(opcional\)$/);
      expect(poder().required).toBeUndefined();
    });

    it.each([
      ['', false],
      ['abc', false],
      ['123', false],
      ['1023456789', true],
      ['1023-456-789', true],
      [' 1023456789 ', true],
      ['-1023456789', false],
      ['1'.repeat(21), false],
    ])('el NIT «%s» es válido: %s', (nit, valido) => {
      control().taxId.setValue(nit);
      expect(control().taxId.valid).toBe(valido);
    });

    it.each([
      ['', false],
      ['ab', false],
      ['abc', true],
      ['SEDES-SC-2020-0412', true],
      ['SC/2020.04', true],
      ['  SEDES-1  ', true],
      ['SEDES SC 2020', false],
      ['SEDES_SC', false],
      ['A'.repeat(50), true],
      ['A'.repeat(51), false],
    ])('el número de registro del SEDES «%s» es válido: %s', (registro, valido) => {
      control().healthFacilityRegistrationNumber.setValue(registro);
      expect(control().healthFacilityRegistrationNumber.valid).toBe(valido);
    });

    it('el número de registro viaja recortado', () => {
      completar();
      control().healthFacilityRegistrationNumber.setValue('  SEDES-1  ');
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.medicalFacility.healthFacilityRegistrationNumber).toBe('SEDES-1');
      req.flush(RESPUESTA_ALTA);
    });

    it.each([
      ['', false],
      ['ab', false],
      ['MAT', true],
      ['M'.repeat(50), true],
      ['M'.repeat(51), false],
    ])('la matrícula del director «%s» es válida: %s', (matricula, valida) => {
      control().medicalDirectorLicense.setValue(matricula);
      expect(control().medicalDirectorLicense.valid).toBe(valida);
    });

    it('el director médico pide primer nombre, apellido paterno, matrícula y correo', () => {
      completar();
      control().medicalDirectorName.patchValue({ name: '', lastName: '' });
      enviar();
      http.expectNone(RUTA_ALTA);
      expect(control().medicalDirectorName.invalid).toBe(true);

      completar();
      control().medicalDirectorEmail.setValue('no-es-un-correo');
      enviar();
      http.expectNone(RUTA_ALTA);
      expect(control().medicalDirectorEmail.invalid).toBe(true);
    });

    it('el teléfono del director es opcional y, sin él, no viaja', () => {
      completar();
      control().medicalDirectorPhone.setValue('');
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect('phone' in req.request.body.organization.medicalFacility.medicalDirector).toBe(false);
      req.flush(RESPUESTA_ALTA);
    });

    it('el segundo y tercer nombre del representante se pliegan en middleName del owner', () => {
      completar();
      control().legalRepName.patchValue({
        name: 'Marta',
        middleName: 'Elena',
        thirdName: 'Sofía',
        lastName: 'Rojas',
        motherLastName: 'Peña',
      });
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.owner).toEqual({
        email: 'marta@centro.test',
        password: 'secreto12',
        name: 'Marta',
        middleName: 'Elena Sofía',
        lastName: 'Rojas',
        motherLastName: 'Peña',
      });
      expect(req.request.body.organization.legalRepresentative.fullName).toBe('Marta Elena Sofía Rojas Peña');
      req.flush(RESPUESTA_ALTA);
    });

    it('el teléfono del representante viaja sólo si se escribió', () => {
      completar();
      control().legalRepPhone.setValue('+591 70055555');
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.legalRepresentative.phone).toBe('+591 70055555');
      req.flush(RESPUESTA_ALTA);
    });

    it('sin el punto de la casa central no sale a la red', () => {
      completar();
      fixture.componentInstance.fijarGpsCentral(null);
      enviar();

      http.expectNone(RUTA_ALTA);
      expect(control().gpsCentral.invalid).toBe(true);
    });

    it('la dirección de la casa central sale del punto', () => {
      completar();
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.medicalFacility.headquarters.addressLines).toEqual([
        'Av. San Martín 123',
      ]);
      req.flush(RESPUESTA_ALTA);
    });

    it('las sucursales completas viajan en medicalFacility.branches', () => {
      completar();
      fixture.componentInstance.fijarSucursales([
        { id: 'sucursal-1', nombre: 'Sucursal Equipetrol', direccion: 'Av. Equipetrol 1', gps: { lat: -17.76, lng: -63.2 } },
        { id: 'sucursal-2', nombre: 'Sucursal Norte', direccion: 'Av. Banzer 2', gps: { lat: -17.7, lng: -63.17 } },
      ]);
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect(req.request.body.organization.medicalFacility.branches).toEqual([
        { name: 'Sucursal Equipetrol', addressLines: ['Av. Equipetrol 1'], latitude: -17.76, longitude: -63.2 },
        { name: 'Sucursal Norte', addressLines: ['Av. Banzer 2'], latitude: -17.7, longitude: -63.17 },
      ]);
      req.flush(RESPUESTA_ALTA);
    });

    it('una sucursal agregada y a medias (sin nombre o sin punto) frena el alta', () => {
      completar();
      fixture.componentInstance.fijarSucursales([
        { id: 'sucursal-1', nombre: '', direccion: '', gps: null },
      ]);
      enviar();
      http.expectNone(RUTA_ALTA);
      expect(control().sucursales.hasError('sucursalIncompleta')).toBe(true);

      fixture.componentInstance.fijarSucursales([
        { id: 'sucursal-1', nombre: 'Sucursal Norte', direccion: '', gps: null },
      ]);
      enviar();
      http.expectNone(RUTA_ALTA);
      expect(control().sucursales.invalid).toBe(true);
    });

    it('más de 50 sucursales no se aceptan', () => {
      const lista = Array.from({ length: 51 }, (_, i) => ({
        id: `sucursal-${i}`,
        nombre: `S${i}`,
        direccion: 'x',
        gps: { lat: -17.7, lng: -63.1 },
      }));
      fixture.componentInstance.fijarSucursales(lista);
      expect(control().sucursales.hasError('demasiadasSucursales')).toBe(true);
    });

    it('sin sucursales no manda la clave branches', () => {
      completar();
      enviar();

      const req = http.expectOne(RUTA_ALTA);
      expect('branches' in req.request.body.organization.medicalFacility).toBe(false);
      req.flush(RESPUESTA_ALTA);
    });

    it('un 422 de la API se muestra con su motivo y deja volver a intentar', () => {
      completar();
      enviar();
      http.expectOne(RUTA_ALTA).flush(
        {
          statusCode: 422,
          code: 'PRECONDITION_FAILED',
          message: 'El bloque medicalFacility sólo corresponde a una organización médica',
          error: 'Unprocessable Entity',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      expect(interno().errorMessage()).toContain('medicalFacility');
      expect(interno().registered()).toBe(false);
      // Se puede reintentar: el envío no quedó trabado.
      enviar();
      http.expectOne(RUTA_ALTA).flush(RESPUESTA_ALTA);
      expect(interno().registered()).toBe(true);
    });

    it('un 400 de validación no se traga el motivo', () => {
      completar();
      enviar();
      http.expectOne(RUTA_ALTA).flush(
        { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Validation failed', error: 'Bad Request' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(interno().errorMessage()).toBeTruthy();
      expect(interno().registered()).toBe(false);
    });

    it('la pantalla de éxito dice que queda en revisión y adónde llegó el aviso de verificación', () => {
      completar();
      enviar();
      http.expectOne(RUTA_ALTA).flush(RESPUESTA_ALTA);
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const texto = (id: string) => raiz.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
      expect(texto('medical-center-signup-success')).toContain('Su organización médica ya tiene cuenta');
      expect(texto('medical-center-signup-pending')).toContain('está en revisión');
      expect(texto('medical-center-signup-pending')).toContain('pendiente de verificación');
      expect(texto('medical-center-signup-verification')).toContain('marta@centro.test');
    });

    it('si no se mandó correo de verificación, la pantalla de éxito no lo promete', () => {
      completar();
      enviar();
      http.expectOne(RUTA_ALTA).flush({ ...RESPUESTA_ALTA, emailVerificationSent: false });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="medical-center-signup-verification"]')).toBeNull();
      expect(raiz.querySelector('[data-testid="medical-center-signup-pending"]')).not.toBeNull();
    });

    it('el borrador guardado no lleva la contraseña ni los papeles subidos', () => {
      const guardar = vi
        .spyOn(TestBed.inject(OnboardingDraftService), 'saveProgress')
        .mockImplementation((...args) => ({ draftId: 'd', formType: args[0] }) as never);
      completar();
      fixture.componentInstance.guardarBorrador();

      const llamada = guardar.mock.calls.at(-1)!;
      const datos = llamada[4] as Record<string, unknown>;
      expect(llamada[0]).toBe('medical-center');
      expect(datos['legalName']).toBe('Centro Médico Norte S.R.L.');
      // La defensa es de esta pantalla, no sólo de `OnboardingDraftService`: ni la clave ni los papeles
      // llegan a `saveProgress`, ni en los datos ni en ningún otro argumento.
      expect(datos).not.toHaveProperty('password');
      for (const papel of Object.keys(DOCUMENTOS).concat('powerOfAttorneyFileId')) {
        expect(datos).not.toHaveProperty(papel);
      }
      const todo = JSON.stringify(llamada);
      expect(todo).not.toContain('secreto12');
      for (const fileId of [...Object.values(DOCUMENTOS), PODER]) expect(todo).not.toContain(fileId);
    });

    describe('un valor de solo espacios cuenta como un dato que falta (sale recortado y vacío)', () => {
      const ESPACIOS = '   ';
      /** El mensaje que el motor pinta para ese campo, con el control ya tocado. */
      const mensajeDe = (clave: string): string => {
        const campo = interno()
          .paginas()
          .flatMap((p) => p.campos)
          .find((c) => c.key === clave)!;
        const ctrl = fixture.componentInstance.form.get(clave)!;
        ctrl.markAsTouched();
        return mensajeDeError(ctrl, campo as never);
      };

      it.each([
        ['taxId', 'Escriba el NIT'],
        ['healthFacilityRegistrationNumber', 'Escriba el número de registro del SEDES'],
        ['medicalDirectorLicense', 'Escriba la matrícula profesional del director'],
        ['legalRepIdNumber', 'Escriba el documento del representante'],
        ['legalName', 'Escriba la razón social'],
      ])('%s con «   » es inválido, es «falta» y dice el mensaje de falta del campo', (clave, mensaje) => {
        const ctrl = fixture.componentInstance.form.get(clave)!;
        ctrl.setValue(ESPACIOS);

        expect(ctrl.invalid).toBe(true);
        expect(ctrl.hasError('required')).toBe(true);
        expect(mensajeDe(clave)).toContain(mensaje);
      });

      it.each([
        ['medicalDirectorName', 'name'],
        ['medicalDirectorName', 'lastName'],
        ['legalRepName', 'name'],
        ['legalRepName', 'lastName'],
      ] as const)('%s.%s con «   » es inválido y no sale a la red', (grupo, parte) => {
        completar();
        control()[grupo].controls[parte].setValue(ESPACIOS);

        expect(control()[grupo].controls[parte].hasError('required')).toBe(true);
        enviar();
        http.expectNone(RUTA_ALTA);
      });

      it('la matrícula y el documento se miden recortados, como viajan', () => {
        control().medicalDirectorLicense.setValue(' ab ');
        control().legalRepIdNumber.setValue(' 123 ');

        expect(control().medicalDirectorLicense.hasError('minlength')).toBe(true);
        expect(control().legalRepIdNumber.hasError('minlength')).toBe(true);
        control().medicalDirectorLicense.setValue(' MAT ');
        control().legalRepIdNumber.setValue(' 1234 ');
        expect(control().medicalDirectorLicense.valid).toBe(true);
        expect(control().legalRepIdNumber.valid).toBe(true);
      });
    });

    describe('el correo exige un dominio con terminación, como el @IsEmail de la API', () => {
      it.each([
        ['medicalDirectorEmail'],
        ['legalRepEmail'],
        ['generalManagerEmail'],
        ['salesManagerEmail'],
        ['marketingManagerEmail'],
      ] as const)('%s rechaza «dir@clinica» y «a@b», y acepta «dir@clinica.bo»', (clave) => {
        for (const malo of ['dir@clinica', 'a@b', 'dir@clinica.', '@clinica.bo']) {
          control()[clave].setValue(malo);
          expect(control()[clave].invalid, malo).toBe(true);
        }
        control()[clave].setValue('dir@clinica.bo');
        expect(control()[clave].errors?.['pattern']).toBeUndefined();
        expect(control()[clave].errors?.['email']).toBeUndefined();
      });

      it('un correo de director sin terminación no sale a la red', () => {
        completar();
        control().medicalDirectorEmail.setValue('dir@clinica');
        enviar();

        http.expectNone(RUTA_ALTA);
        expect(control().medicalDirectorEmail.invalid).toBe(true);
      });
    });

    describe('el segundo nombre plegado cabe en los 100 caracteres de middleName', () => {
      it.each(['medicalDirectorName', 'legalRepName'] as const)(
        '%s: 60 + 1 + 59 caracteres pasan de 100 y no se deja enviar, con un mensaje claro',
        (grupo) => {
          completar();
          control()[grupo].patchValue({ middleName: 'a'.repeat(60), thirdName: 'b'.repeat(59) });

          expect(control()[grupo].hasError('nombresAdicionalesLargos')).toBe(true);
          expect(control()[grupo].controls.middleName.valid).toBe(true);
          expect(control()[grupo].controls.thirdName.valid).toBe(true);
          enviar();
          http.expectNone(RUTA_ALTA);
        },
      );

      it('49 + 1 + 50 caracteres son exactamente 100 y salen', () => {
        completar();
        control().legalRepName.patchValue({ middleName: 'a'.repeat(49), thirdName: 'b'.repeat(50) });
        expect(control().legalRepName.hasError('nombresAdicionalesLargos')).toBe(false);
        enviar();

        const req = http.expectOne(RUTA_ALTA);
        expect(req.request.body.owner.middleName).toHaveLength(100);
        req.flush(RESPUESTA_ALTA);
      });

      it('las casillas agregadas también suman', () => {
        completar();
        const extra = new FormControl('c'.repeat(30), { nonNullable: true });
        control().medicalDirectorName.patchValue({ middleName: 'a'.repeat(40), thirdName: 'b'.repeat(40) });
        control().medicalDirectorName.controls.extraNames.push(extra);
        control().medicalDirectorName.updateValueAndValidity();

        expect(control().medicalDirectorName.hasError('nombresAdicionalesLargos')).toBe(true);
      });
    });

    describe('las gerencias son todo o nada, dicho en la página de la gerencia que falta', () => {
      /** La primera página con algo mal, que es adonde el motor lleva a la persona al intentar avanzar o enviar. */
      const primeraPaginaConError = () =>
        interno()
          .paginas()
          .find((p) => p.campos.some((c) => fixture.componentInstance.form.get(c.key)?.invalid === true))?.clave;

      it('vacías las tres, ninguna página de gerencias bloquea', () => {
        completar();

        expect(fixture.componentInstance.form.valid).toBe(true);
        expect(primeraPaginaConError()).toBeUndefined();
      });

      it('con solo la general completa, la comercial pide celular, correo y nombre; lo mismo la de marketing', () => {
        completar();
        fixture.componentInstance.form.patchValue({
          generalManagerName: { name: 'Gabriel', lastName: 'Gómez' },
          generalManagerPhone: '+591 70011111',
          generalManagerEmail: 'general@centro.test',
        });

        expect(control().salesManagerPhone.hasError('required')).toBe(true);
        expect(control().salesManagerEmail.hasError('required')).toBe(true);
        expect(control().salesManagerName.controls.name.hasError('required')).toBe(true);
        expect(control().marketingManagerPhone.hasError('required')).toBe(true);
        expect(control().generalManagerPhone.valid).toBe(true);
        expect(primeraPaginaConError()).toBe('gerencia-comercial');
      });

      it('con la general a medias, el motor llevaría a la persona a la general, con el mensaje junto al campo', () => {
        completar();
        fixture.componentInstance.form.patchValue({ generalManagerPhone: '+591 70011111' });

        expect(primeraPaginaConError()).toBe('gerencia-general');
        expect(control().generalManagerEmail.hasError('required')).toBe(true);
        const mensaje = interno()
          .paginas()
          .flatMap((p) => p.campos)
          .find((c) => c.key === 'generalManagerEmail')!;
        control().generalManagerEmail.markAsTouched();
        expect(mensajeDeError(control().generalManagerEmail, mensaje as never)).toContain(
          'deje las tres gerencias vacías',
        );
      });

      it('vaciar lo escrito levanta el bloqueo de las demás: se revalidan unas a otras', () => {
        completar();
        fixture.componentInstance.form.patchValue({ salesManagerPhone: '+591 70022222' });
        expect(control().marketingManagerEmail.invalid).toBe(true);

        fixture.componentInstance.form.patchValue({ salesManagerPhone: '' });
        expect(control().marketingManagerEmail.valid).toBe(true);
        expect(control().generalManagerName.controls.name.valid).toBe(true);
        expect(fixture.componentInstance.form.valid).toBe(true);
      });

      it('un apellido solo cuenta como nombre escrito, igual que al armar el bloque', () => {
        completar();
        completarGerencias();
        fixture.componentInstance.form.patchValue({ salesManagerName: { name: '', lastName: 'Cruz' } });

        expect(control().salesManagerName.controls.name.valid).toBe(true);
        enviar();
        http.expectOne(RUTA_ALTA).flush(RESPUESTA_ALTA);
      });

      it('al enviar con el bloque a medias no sale a la red y marca todo para que se vea', () => {
        completar();
        completarGerencias();
        fixture.componentInstance.form.patchValue({ salesManagerEmail: '' });
        enviar();

        http.expectNone(RUTA_ALTA);
        expect(control().salesManagerEmail.touched).toBe(true);
        expect(primeraPaginaConError()).toBe('gerencia-comercial');
      });

      it('al bloquear una página, el grupo del nombre marca sus casillas para que muestren el error', () => {
        const componente = fixture.componentInstance as unknown as {
          alRechazarPagina(p: { campos: readonly { key: string }[] }): void;
        };
        completar();
        fixture.componentInstance.form.patchValue({ generalManagerPhone: '+591 70011111' });
        expect(control().generalManagerName.controls.name.touched).toBe(false);

        componente.alRechazarPagina({ campos: [{ key: 'generalManagerName' }, { key: 'generalManagerEmail' }] });

        expect(control().generalManagerName.controls.name.touched).toBe(true);
        expect(control().generalManagerEmail.touched).toBe(true);
      });
    });
  });

  it('«Ir a iniciar sesión» navega al acceso', () => {
    fixture.componentInstance.goToLogin();

    expect(navegaciones).toEqual(['/auth']);
  });
});

describe('signupErrorMessage', () => {
  it.each([
    [0, 'No pudimos conectarnos'],
    [409, 'Ya existe una cuenta con ese correo'],
    [500, 'No pudimos completar el registro'],
  ])('el estado %s dice «%s»', (status, fragmento) => {
    expect(signupErrorMessage(new HttpErrorResponse({ status }))).toContain(fragmento);
  });
});
