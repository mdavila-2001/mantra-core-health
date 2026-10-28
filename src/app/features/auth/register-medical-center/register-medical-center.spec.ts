import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { MEDICAL_ORGANIZATION_TYPES } from '../../../core/data-access/directory/directory.types';
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

  function completar(tenantType = 'HOSPITAL'): void {
    fixture.componentInstance.form.setValue({
      tenantType,
      legalName: 'Centro Médico Norte S.R.L.',
      legalEntityType: 'SRL',
      ...DOCUMENTOS,
      ownerName: 'Marta Rojas',
      email: 'marta@centro.test',
      password: 'secreto12',
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

  it('envía el tipo elegido con país y jurisdicción resueltos por código', () => {
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
      },
      owner: { email: 'marta@centro.test', password: 'secreto12', displayName: 'Marta Rojas' },
    });
    req.flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
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

  it('se sirve de a cuatro campos como tope: la organización, sus documentos y la cuenta', () => {
    const paginas = interno().paginas();

    expect(paginas.map((p) => p.campos.map((c) => c.key))).toEqual([
      ['tenantType', 'legalName', 'legalEntityType'],
      ['constitutionFileId', 'taxIdentifierFileId', 'commerceRegistryFileId', 'operatingLicenseFileId'],
      ['healthAuthorityCertificateFileId'],
      ['ownerName', 'email', 'password'],
    ]);
    expect(paginas[0]!.titulo).toBe('La organización');
    expect(paginas[1]!.titulo).toContain('Documentación legal obligatoria (PDF)');
    expect(paginas[3]!.titulo).toBe('Su cuenta');
    expect(Math.max(...paginas.map((p) => p.campos.length))).toBeLessThanOrEqual(4);
  });

  it('el tipo de institución es un desplegable y las dos páginas van en tres columnas', () => {
    const paginas = interno().paginas();
    const organizacion = paginas[0];
    const cuenta = paginas[paginas.length - 1];
    const tipo = organizacion!.campos.find((c) => c.key === 'tenantType')!;

    expect(tipo.control).toBe('select');
    expect(tipo.opcionesEn).toBeUndefined();
    expect(organizacion!.disposicion).toBe('tres-columnas');
    expect(cuenta!.disposicion).toBe('tres-columnas');
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

  it('al terminar dice que la organización queda pendiente de verificación', () => {
    completar();
    fixture.componentInstance.submit();
    http
      .expectOne(RUTA_ALTA)
      .flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
    fixture.detectChanges();

    expect(interno().registered()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="medical-center-signup-pending"]')?.textContent).toContain(
      'pendiente de verificación',
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
