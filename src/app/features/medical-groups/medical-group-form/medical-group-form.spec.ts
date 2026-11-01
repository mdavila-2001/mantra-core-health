import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { MedicalGroupDetail } from '../medical-group-detail/medical-group-detail';
import { MedicalGroupForm } from './medical-group-form';

/** Lo que las pruebas tocan del formulario: sus señales y sus manejadores. */
interface FormApi {
  selectedService: { set(value: unknown): void };
  selectedPatient: { set(value: unknown): void };
  selectedCondition: { set(value: string | null): void };
  scheduledAt: { set(value: Date | null): void };
  locationText: { set(value: string): void };
  notesText: { set(value: string): void };
  team: () => readonly { key: number }[];
  updateMember(key: number, change: Record<string, unknown>): void;
  addMember(): void;
  missing(): string | null;
  save(): void;
  tab: { (): number; set(value: number): void };
}

/**
 * El alta de un grupo médico. Lo que se fija es el contrato con
 * `CreateMedicalGroupDto` (la API rechaza con 400 cualquier clave de más) y las
 * reglas del formulario que evitan mandar lo que se sabe que se rechaza: lo
 * obligatorio, el cargo completo, el importe con hasta dos decimales y que un
 * profesional no ocupe dos cargos.
 */
describe('MedicalGroupForm', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let form: FormApi;
  let el: HTMLElement;

  const SERVICE = { id: 'svc-1', practiceId: 'p-1', code: 'COL', name: 'Colecistectomía', defaultPrice: '1.00', isActive: true };
  const FUTURE = new Date('2099-11-05T14:00:00.000Z');

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-medical-groups/new', component: MedicalGroupForm },
          { path: 'my-medical-groups/:id', component: MedicalGroupDetail },
        ]),
        { provide: ProfilesClient, useValue: { searchPatients: () => of({ items: [], count: 0, limit: 25, nextCursor: null }) } },
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([{ id: 'p-1', code: 'P1', name: 'Clínica' }]), search: () => of({ items: [SERVICE], count: 1, limit: 25, nextCursor: null }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    form = (await harness.navigateByUrl('/my-medical-groups/new', MedicalGroupForm)) as unknown as FormApi;
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Lo mínimo que la API exige. */
  function fillRequired(): void {
    form.selectedService.set(SERVICE);
    form.scheduledAt.set(FUTURE);
    form.locationText.set('  Quirófano 2  ');
  }

  const wireGroup = (id = 'g-1') => ({
    id,
    serviceCatalogId: 'svc-1',
    serviceName: 'Colecistectomía',
    requestingPractitionerId: 'me',
    patientName: null,
    scheduledAt: FUTURE.toISOString(),
    locationText: 'Quirófano 2',
    termsText: 'Términos.',
    status: 'SCHEDULED',
    isRealized: false,
    canEditExerciseNotes: false,
    isClosed: false,
    createdAt: '2026-10-25T10:00:00.000Z',
    members: [],
  });

  /** Abre una pestaña por su rótulo: `app-tab` no dibuja el panel cerrado. */
  function pestana(rotulo: string): void {
    const boton = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (b) => b.textContent?.trim() === rotulo,
    );
    if (boton === undefined) throw new Error(`No hay una pestaña «${rotulo}»`);
    boton.click();
    harness.detectChanges();
  }

  it('es UNA tarjeta con tres pestañas y el botón de crear fuera de ellas', () => {
    expect(el.querySelectorAll('app-card')).toHaveLength(1);
    const rotulos = Array.from(el.querySelectorAll('[role="tab"]')).map((b) => b.textContent?.trim());
    expect(rotulos).toEqual(['Servicio y paciente', 'Fecha y lugar', 'Equipo']);

    for (const rotulo of rotulos) {
      pestana(rotulo!);
      expect(el.querySelector('[data-testid="medical-group-form-save"]')).not.toBeNull();
    }
  });

  it('lista el catálogo de la práctica al abrir, sin pedir que se escriba antes', async () => {
    await settle();

    expect(el.textContent).toContain('Colecistectomía');
    // Ese texto vacío es el del catálogo; el del paciente (opcional) sigue pidiendo buscar.
    expect(el.textContent).not.toContain('Busque el servicio de salud por código o nombre.');
    const elegir = Array.from(el.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Elegir',
    );
    expect(elegir.length).toBeGreaterThan(0);
  });

  it('cada pestaña dibuja sus campos y los valores sobreviven a cerrarla', () => {
    pestana('Fecha y lugar');
    const lugar = () => el.querySelector<HTMLInputElement>('[data-testid="medical-group-form-location"]');
    lugar()!.value = 'Sala 3';
    lugar()!.dispatchEvent(new Event('input'));
    harness.detectChanges();

    pestana('Equipo');
    expect(el.querySelector('[data-testid="medical-group-form-member-0"]')).not.toBeNull();
    expect(lugar()).toBeNull();

    pestana('Fecha y lugar');
    expect(lugar()!.value).toBe('Sala 3');
  });

  it('al guardar con un pendiente en otra pestaña, lleva hasta ella', async () => {
    pestana('Equipo');
    form.save();
    await settle();
    expect(form.tab()).toBe(0);

    form.selectedService.set(SERVICE);
    pestana('Equipo');
    form.save();
    await settle();
    expect(form.tab()).toBe(1);
    expect(el.querySelector('[data-testid="medical-group-form-error"]')?.textContent).toContain(
      'fecha y la hora',
    );

    form.scheduledAt.set(FUTURE);
    form.locationText.set('Sala 3');
    form.updateMember(form.team()[0]!.key, { roleTitle: 'Anestesiólogo' });
    form.tab.set(0);
    form.save();
    await settle();
    expect(form.tab()).toBe(2);
    expect(el.querySelector('[data-testid="medical-group-form-error"]')?.textContent).toContain(
      'Elija al profesional de cada cargo.',
    );
    http.expectNone('/medical-groups');
  });

  it('sin lo obligatorio no manda nada y dice qué falta', async () => {
    form.save();
    await settle();

    http.expectNone('/medical-groups');
    expect(el.querySelector('[data-testid="medical-group-form-error"]')?.textContent).toContain(
      'Elija el servicio de salud.',
    );
  });

  it.each([
    ['la fecha', () => form.selectedService.set(SERVICE), 'fecha y la hora'],
    ['el lugar', () => { form.selectedService.set(SERVICE); form.scheduledAt.set(FUTURE); }, 'lugar de realización'],
  ])('falta %s', (_que, preparar, mensaje) => {
    preparar();
    expect(form.missing()).toContain(mensaje);
  });

  it('manda sólo las claves que el DTO declara y recorta los textos', async () => {
    fillRequired();
    form.notesText.set('   ');
    form.save();

    const req = http.expectOne('/medical-groups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      serviceCatalogId: 'svc-1',
      scheduledAt: FUTURE.toISOString(),
      locationText: 'Quirófano 2',
      members: [],
    });
    req.flush(wireGroup());
    await settle();
    http.expectOne('/medical-groups/g-1').flush(wireGroup());
    expect(TestBed.inject(Router).url).toBe('/my-medical-groups/g-1');
  });

  it('el cargo en blanco que viene de entrada no cuenta; el cargo escrito viaja entero', async () => {
    fillRequired();
    const [first] = form.team();
    form.updateMember(first!.key, {
      practitionerProfileId: 'pr-2',
      roleTitle: ' Anestesiólogo ',
      agreedPaymentAmount: '500.50',
      additionalTermsText: '',
    });
    form.addMember();
    form.save();

    const req = http.expectOne('/medical-groups');
    expect(req.request.body).toMatchObject({
      members: [{ practitionerProfileId: 'pr-2', roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500.50' }],
    });
    expect((req.request.body as { members: object[] }).members[0]).not.toHaveProperty('additionalTermsText');
    req.flush(wireGroup('g-2'));
    await settle();
    http.expectOne('/medical-groups/g-2').flush(wireGroup('g-2'));
  });

  it('un cargo a medias bloquea el envío', async () => {
    fillRequired();
    const [first] = form.team();
    form.updateMember(first!.key, { roleTitle: 'Anestesiólogo' });
    form.save();
    await settle();

    http.expectNone('/medical-groups');
    expect(form.missing()).toBe('Elija al profesional de cada cargo.');
  });

  it.each(['-5', '1.234', 'abc', '500,5'])('el pago «%s» no es un importe válido', (monto) => {
    fillRequired();
    const [first] = form.team();
    form.updateMember(first!.key, { practitionerProfileId: 'pr-2', roleTitle: 'X', agreedPaymentAmount: monto });

    expect(form.missing()).toContain('monto positivo');
  });

  it('un mismo profesional no ocupa dos cargos', () => {
    fillRequired();
    form.addMember();
    const [a, b] = form.team();
    form.updateMember(a!.key, { practitionerProfileId: 'pr-2', roleTitle: 'X', agreedPaymentAmount: '1' });
    form.updateMember(b!.key, { practitionerProfileId: 'pr-2', roleTitle: 'Y', agreedPaymentAmount: '2' });

    expect(form.missing()).toBe('Un mismo profesional no puede ocupar dos cargos.');
  });

  it('el diagnóstico sólo viaja si hay paciente', async () => {
    fillRequired();
    form.selectedCondition.set('c-1');
    form.save();
    const sin = http.expectOne('/medical-groups');
    expect(sin.request.body).not.toHaveProperty('conditionId');
    expect(sin.request.body).not.toHaveProperty('patientProfileId');
    sin.flush(wireGroup('g-3'));
    await settle();
    http.expectOne('/medical-groups/g-3').flush(wireGroup('g-3'));
  });

  it('con paciente viaja el paciente y su diagnóstico', async () => {
    fillRequired();
    form.selectedPatient.set({ profileId: 'pat-1', patientCode: 'P-1', displayName: 'Ana' });
    form.selectedCondition.set('c-1');
    form.save();

    const req = http.expectOne('/medical-groups');
    expect(req.request.body).toMatchObject({ patientProfileId: 'pat-1', conditionId: 'c-1' });
    req.flush(wireGroup('g-4'));
    await settle();
    http.expectOne('/medical-groups/g-4').flush(wireGroup('g-4'));
  });

  it('si la API rechaza el alta, muestra su mensaje y conserva lo escrito', async () => {
    fillRequired();
    form.save();
    http.expectOne('/medical-groups').flush(
      { code: 'NOT_FOUND', message: 'Servicio médico no encontrado', timestamp: '', path: '' },
      { status: 404, statusText: 'x' },
    );
    await settle();

    expect(el.querySelector('[data-testid="medical-group-form-error"]')?.textContent).toContain(
      'Servicio médico no encontrado',
    );
    expect(TestBed.inject(Router).url).toBe('/my-medical-groups/new');
    expect(form.missing()).toBeNull();
  });
});
