import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { MedicalGroupDetail } from './medical-group-detail';
import { MedicalGroupForm } from './medical-group-form';
import { CATALOG_STUB, COLLEAGUE, group, ME, PROFILES_STUB, tokenFor } from './medical-groups.testing';

const RUTA = '/schedule/medical-groups/new';

/** Lo que las pruebas llaman del formulario: los manejadores de sus controles. */
interface FormApi {
  chooseService(option: { value: string; label: string } | null): void;
  choosePatient(option: { value: string; label: string } | null): void;
  addMember(): void;
  patchMember(key: number, change: Record<string, unknown>): void;
  scheduledAt: { set(value: Date | null): void };
  location: { set(value: string): void };
  members(): readonly { key: number }[];
  problems(): readonly string[];
}

describe('MedicalGroupForm', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let form: FormApi;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'schedule/medical-groups/new', component: MedicalGroupForm },
          { path: 'schedule/medical-groups/:groupId', component: MedicalGroupDetail },
        ]),
        { provide: ProfilesClient, useValue: PROFILES_STUB },
        { provide: ServicesCatalogClient, useValue: CATALOG_STUB },
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: tokenFor({ sub: 'u-1', sid: 's-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: ME }),
      refreshToken: 'r-1',
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(RUTA, MedicalGroupForm);
    form = component as unknown as FormApi;
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Completa lo mínimo que la API exige. */
  function fillRequired(): void {
    form.chooseService({ value: 'svc-1', label: 'Artroscopia (ART)' });
    form.scheduledAt.set(new Date('2099-11-05T14:00:00.000Z'));
    form.location.set('  Quirófano 2  ');
  }

  const submit = () => el.querySelector<HTMLButtonElement>('[data-testid="medical-group-submit"]')!;

  it('es UNA tarjeta con tres pestañas y no apila tarjetas', async () => {
    await settle();

    expect(el.querySelectorAll('app-card')).toHaveLength(1);
    expect(Array.from(el.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim())).toEqual([
      'Servicio y paciente',
      'Fecha y lugar',
      'Equipo (0)',
    ]);
  });

  it('sin lo obligatorio no se puede crear, y dice qué falta', async () => {
    await settle();

    expect(submit().getAttribute('aria-disabled')).toBe('true');
    const faltan = el.querySelector('[data-testid="medical-group-problems"]')?.textContent ?? '';
    expect(faltan).toContain('Elija el servicio del grupo.');
    expect(faltan).toContain('fecha y hora');
    expect(faltan).toContain('lugar');
  });

  it('con lo obligatorio habilita el botón y manda sólo las claves que el DTO admite', async () => {
    fillRequired();
    await settle();
    expect(submit().getAttribute('aria-disabled')).toBe('false');

    submit().click();
    const req = http.expectOne('/medical-groups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      serviceCatalogId: 'svc-1',
      scheduledAt: '2099-11-05T14:00:00.000Z',
      locationText: 'Quirófano 2',
      members: [],
    });
    req.flush(group({ id: 'nuevo' }));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/schedule/medical-groups/nuevo');
    http.expectOne('/medical-groups/nuevo').flush(group({ id: 'nuevo' }));
  });

  it('un cargo incompleto o con un pago mal escrito bloquea el envío', async () => {
    fillRequired();
    form.addMember();
    const key = form.members()[0]!.key;
    form.patchMember(key, { practitionerProfileId: COLLEAGUE, roleTitle: 'Anestesiólogo', amount: '-5' });
    await settle();

    expect(submit().getAttribute('aria-disabled')).toBe('true');
    expect(form.problems().join(' ')).toContain('el pago debe ser un número sin signo');

    form.patchMember(key, { amount: '500.505' });
    expect(form.problems().join(' ')).toContain('el pago');
    form.patchMember(key, { amount: '500.50' });
    expect(form.problems()).toEqual([]);
  });

  it('el equipo viaja con función, pago y adicionales, y los vacíos se omiten', async () => {
    fillRequired();
    form.addMember();
    form.addMember();
    const [a, b] = form.members();
    form.patchMember(a!.key, { practitionerProfileId: COLLEAGUE, roleTitle: ' Anestesiólogo ', amount: '500', terms: '' });
    form.patchMember(b!.key, { practitionerProfileId: 'pr-3', roleTitle: 'Instrumentista', amount: '300.00', terms: 'Turno noche' });
    await settle();

    submit().click();
    const req = http.expectOne('/medical-groups');
    expect(req.request.body).toMatchObject({
      members: [
        { practitionerProfileId: COLLEAGUE, roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500' },
        { practitionerProfileId: 'pr-3', roleTitle: 'Instrumentista', agreedPaymentAmount: '300.00', additionalTermsText: 'Turno noche' },
      ],
    });
    const miembros = (req.request.body as { members: object[] }).members;
    expect(miembros[0]).not.toHaveProperty('additionalTermsText');
    req.flush(group({ id: 'n2' }));
    await settle();
    http.expectOne('/medical-groups/n2').flush(group({ id: 'n2' }));
  });

  it('al elegir paciente pide sus diagnósticos y preselecciona el más reciente', async () => {
    form.choosePatient({ value: 'pat-1', label: 'Ana Paz (P-1)' });
    http.expectOne('/medical-groups/patients/pat-1/conditions').flush([
      { id: 'c-new', code: 'I10', display: 'Hipertensión', isMostRecent: true },
      { id: 'c-old', code: 'E11', display: 'Diabetes', isMostRecent: false },
    ]);
    fillRequired();
    await settle();

    submit().click();
    const req = http.expectOne('/medical-groups');
    expect(req.request.body).toMatchObject({ patientProfileId: 'pat-1', conditionId: 'c-new' });
    req.flush(group({ id: 'n3' }));
    await settle();
    http.expectOne('/medical-groups/n3').flush(group({ id: 'n3' }));
  });

  it('quitar al paciente quita también el diagnóstico', async () => {
    form.choosePatient({ value: 'pat-1', label: 'Ana Paz (P-1)' });
    http
      .expectOne('/medical-groups/patients/pat-1/conditions')
      .flush([{ id: 'c-new', code: 'I10', display: 'Hipertensión', isMostRecent: true }]);
    await settle();
    form.choosePatient(null);
    fillRequired();
    await settle();

    submit().click();
    const req = http.expectOne('/medical-groups');
    expect(req.request.body).not.toHaveProperty('patientProfileId');
    expect(req.request.body).not.toHaveProperty('conditionId');
    req.flush(group({ id: 'n4' }));
    await settle();
    http.expectOne('/medical-groups/n4').flush(group({ id: 'n4' }));
  });

  it('S4: si la API rechaza el alta, muestra el motivo y conserva lo escrito', async () => {
    fillRequired();
    await settle();

    submit().click();
    http.expectOne('/medical-groups').flush(
      { code: 'NOT_FOUND', message: 'Servicio médico no encontrado', timestamp: '', path: '' },
      { status: 404, statusText: 'x' },
    );
    await settle();

    expect(el.querySelector('[data-testid="medical-group-error"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe(RUTA);
    expect(submit().getAttribute('aria-disabled')).toBe('false');
  });

  it('un 400 de validación muestra cada motivo', async () => {
    fillRequired();
    await settle();

    submit().click();
    http.expectOne('/medical-groups').flush(
      {
        code: 'VALIDATION_FAILED',
        message: 'x',
        timestamp: '',
        path: '',
        details: { fields: [{ field: 'locationText', constraints: ['maxLength'], messages: ['locationText es demasiado largo'] }] },
      },
      { status: 400, statusText: 'x' },
    );
    await settle();

    expect(el.querySelector('[data-testid="medical-group-error"]')?.textContent).toContain(
      'demasiado largo',
    );
  });
});
