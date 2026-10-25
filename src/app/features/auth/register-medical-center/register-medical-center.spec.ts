import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { mensajeDelAlta, RegisterMedicalCenter } from './register-medical-center';

const RUTA_ALTA = '/iam/auth/register-organization';

const CATALOGOS: Record<string, { code: string; conceptId: string }[]> = {
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

  /** Acceso al estado protegido, que la plantilla usa y el spec necesita escribir. */
  type Interno = {
    set(campo: string, valor: string): void;
    registered: () => boolean;
    errorMessage: () => string | null;
    submitted: () => boolean;
  };
  const interno = (): Interno => fixture.componentInstance as unknown as Interno;

  beforeEach(async () => {
    navegaciones = [];
    catalogoCaido = false;

    await TestBed.configureTestingModule({
      imports: [RegisterMedicalCenter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: SystemContextClient,
          useValue: {
            dynamicEnum: (destino: string) =>
              of({ options: catalogoCaido ? [] : (CATALOGOS[destino] ?? []) }),
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

  function completar(): void {
    interno().set('legalName', 'Centro Médico Norte S.R.L.');
    interno().set('legalEntityType', 'SRL');
    interno().set('ownerName', 'Marta Rojas');
    interno().set('email', 'marta@centro.test');
    interno().set('password', 'secreto12');
  }

  it('envía el tipo de salud existente con país y jurisdicción resueltos por código', () => {
    completar();
    fixture.componentInstance.submit();

    const req = http.expectOne(RUTA_ALTA);
    expect(req.request.body).toEqual({
      organization: {
        code: 'CM-CENTRO-MEDICO-NORTE-S-R-L',
        legalName: 'Centro Médico Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'HOSPITAL',
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
      },
      owner: { email: 'marta@centro.test', password: 'secreto12', displayName: 'Marta Rojas' },
    });
    req.flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
  });

  it('con campos obligatorios vacíos no sale a la red y muestra los errores', async () => {
    fixture.componentInstance.submit();
    fixture.detectChanges();

    http.expectNone(RUTA_ALTA);
    expect(interno().submitted()).toBe(true);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Escriba la razón social del centro.');
    expect(texto).toContain('La contraseña necesita al menos 8 caracteres.');
  });

  it('una contraseña corta no se envía', () => {
    completar();
    interno().set('password', 'corta');
    fixture.componentInstance.submit();

    http.expectNone(RUTA_ALTA);
  });

  it('al terminar dice que el centro queda pendiente de verificación', () => {
    completar();
    fixture.componentInstance.submit();
    http
      .expectOne(RUTA_ALTA)
      .flush({ tenantId: 't-1', code: 'X', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
    fixture.detectChanges();

    expect(interno().registered()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="registro-centro-medico-pendiente"]')?.textContent).toContain(
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

describe('mensajeDelAlta', () => {
  it.each([
    [0, 'No pudimos conectarnos'],
    [409, 'Ya existe una cuenta con ese correo'],
    [500, 'No pudimos completar el registro'],
  ])('el estado %s dice «%s»', (status, fragmento) => {
    expect(mensajeDelAlta(new HttpErrorResponse({ status }))).toContain(fragmento);
  });
});
