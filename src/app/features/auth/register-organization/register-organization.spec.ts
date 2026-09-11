import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CAMPO_TIPO_SOCIETARIO } from '../../../core/data-access/system-context/legal-entity-types.service';
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

  function completar(
    extra: Partial<
      Record<
        'tradeName' | 'timeZone' | 'middleName' | 'motherLastName' | 'incorporationCountry' | 'legalEntityType',
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
    });
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
