import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { MedicalGroupDetail } from './medical-group-detail';

/**
 * La consulta de un grupo médico. Lo que se fija:
 *
 * 1. Una sola tarjeta con pestañas —Resumen, Equipo, Horario y Notas del
 *    ejercicio—; el estado y lo que pide respuesta se ven desde cualquiera.
 * 2. Cada acción aparece sólo en el estado en que la API la aceptaría:
 *    invitación pendiente → aceptar/rechazar; programado y no realizado →
 *    solicitar cambio; cambio propuesto por otro → el creador lo resuelve;
 *    realizado y abierto → cargar notas; cerrado → nada se edita.
 * 3. Una acción reemplaza el grupo por el que devuelve la API.
 */
describe('MedicalGroupDetail', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<unknown>;

  const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

  function wire(overrides: Record<string, unknown> = {}, members?: object[]): object {
    return {
      id: 'g-1',
      serviceCatalogId: 's-1',
      serviceName: 'Colecistectomía laparoscópica',
      requestingPractitionerId: 'creator',
      patientProfileId: 'pat-1',
      patientName: 'Rosa Quispe',
      scheduledAt: future,
      locationText: 'Clínica Foianini, quirófano 2',
      termsText: 'Términos por defecto del servicio.',
      status: 'SCHEDULED',
      isRealized: false,
      canEditExerciseNotes: false,
      isClosed: false,
      createdAt: past,
      members: members ?? [
        {
          id: 'm-creator',
          practitionerProfileId: 'creator',
          practitionerName: 'Paula Arce',
          roleTitle: 'Cirujana',
          agreedPaymentAmount: '0.00',
          isCreator: true,
          invitationStatus: 'ACCEPTED',
        },
        {
          id: 'm-guest',
          practitionerProfileId: 'guest',
          practitionerName: 'Luis Rojas',
          roleTitle: 'Anestesiólogo',
          agreedPaymentAmount: '1500.00',
          isCreator: false,
          invitationStatus: 'ACCEPTED',
        },
      ],
      ...overrides,
    };
  }

  async function open(me: string, body: object): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-medical-groups/:id', component: MedicalGroupDetail }]),
        { provide: AuthService, useValue: { practitionerProfileId: signal<string | null>(me) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const pending = harness.navigateByUrl('/my-medical-groups/g-1');
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/medical-groups/g-1').flush(body);
    await pending;
    harness.detectChanges();
    fixture = harness.fixture;
    return harness.routeNativeElement as HTMLElement;
  }

  function testId(host: HTMLElement, id: string): HTMLElement | null {
    return host.querySelector(`[data-testid="${id}"]`);
  }

  /** Abre una pestaña por su rótulo: `app-tab` no dibuja el panel cerrado. */
  function pestana(host: HTMLElement, rotulo: string): void {
    const boton = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) =>
      b.textContent?.trim().startsWith(rotulo),
    );
    if (boton === undefined) throw new Error(`No hay una pestaña «${rotulo}»`);
    boton.click();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('es UNA tarjeta con cuatro pestañas, y el estado se ve desde cualquiera', async () => {
    const host = await open('creator', wire());

    expect(host.querySelectorAll('app-card')).toHaveLength(1);
    const rotulos = Array.from(host.querySelectorAll('[role="tab"]')).map((b) =>
      b.textContent?.trim(),
    );
    expect(rotulos).toEqual(['Resumen', 'Equipo (2)', 'Horario', 'Notas del ejercicio']);

    for (const rotulo of ['Equipo', 'Horario', 'Notas del ejercicio']) {
      pestana(host, rotulo);
      expect(testId(host, 'medical-group-status')?.textContent).toContain('Programado');
    }
  });

  it('muestra el estado, el equipo con su pago y los términos', async () => {
    const host = await open('creator', wire());

    expect(testId(host, 'medical-group-status')?.textContent).toContain('Programado');
    expect(host.textContent).toContain('Rosa Quispe');
    expect(testId(host, 'medical-group-terms')?.textContent).toContain('Términos por defecto');

    pestana(host, 'Equipo');
    expect(host.querySelectorAll('[data-testid="medical-group-member"]')).toHaveLength(2);
    expect(host.textContent).toContain('Bs 1.500,00');
  });

  it('programado y no realizado: ofrece solicitar cambio de horario, no notas', async () => {
    const host = await open('guest', wire());

    pestana(host, 'Horario');
    expect(testId(host, 'medical-group-request-reschedule')).not.toBeNull();
    pestana(host, 'Notas del ejercicio');
    expect(testId(host, 'medical-group-save-notes')).toBeNull();
    expect(testId(host, 'medical-group-accept')).toBeNull();
  });

  it('invitación pendiente: aceptar o rechazar, sin cambio de horario ni nombre del paciente', async () => {
    const host = await open(
      'guest',
      wire({ status: 'PENDING_TEAM', patientName: null }, [
        {
          id: 'm-creator',
          practitionerProfileId: 'creator',
          practitionerName: 'Paula Arce',
          roleTitle: 'Cirujana',
          agreedPaymentAmount: '0.00',
          isCreator: true,
          invitationStatus: 'ACCEPTED',
        },
        {
          id: 'm-guest',
          practitionerProfileId: 'guest',
          practitionerName: 'Luis Rojas',
          roleTitle: 'Anestesiólogo',
          agreedPaymentAmount: '1500.00',
          isCreator: false,
          invitationStatus: 'PENDING',
        },
      ]),
    );

    expect(testId(host, 'medical-group-accept')).not.toBeNull();
    expect(testId(host, 'medical-group-reject')).not.toBeNull();
    expect(host.textContent).toContain('Se muestra cuando acepte la invitación');
    pestana(host, 'Horario');
    expect(testId(host, 'medical-group-request-reschedule')).toBeNull();
    pestana(host, 'Resumen');

    testId(host, 'medical-group-accept')!.click();
    const respond = http.expectOne('/medical-groups/g-1/members/m-guest/respond');
    expect(respond.request.body).toEqual({ decision: 'ACCEPTED' });
    respond.flush(wire());
    fixture.detectChanges();
    expect(testId(host, 'medical-group-accept')).toBeNull();
    expect(host.textContent).toContain('Rosa Quispe');
  });

  it('cambio propuesto por otro: sólo el creador lo resuelve', async () => {
    const pendingChange = wire({
      status: 'RESCHEDULE_PENDING',
      proposedRescheduleAt: future,
      proposedByPractitionerId: 'guest',
    });

    const asCreator = await open('creator', pendingChange);
    expect(testId(asCreator, 'medical-group-accept-reschedule')).not.toBeNull();

    const asGuest = await open('guest', pendingChange);
    expect(testId(asGuest, 'medical-group-accept-reschedule')).toBeNull();
  });

  it('cambio propuesto: la pestaña Horario lo dice y aclara quién lo resuelve', async () => {
    const pendingChange = wire({
      status: 'RESCHEDULE_PENDING',
      proposedRescheduleAt: future,
      proposedByPractitionerId: 'guest',
    });

    const asGuest = await open('guest', pendingChange);
    expect(asGuest.textContent).toContain('Horario propuesto');
    pestana(asGuest, 'Horario');
    expect(asGuest.textContent).toContain('Hay un cambio propuesto');
    expect(asGuest.textContent).toContain('Lo resuelve quien creó el grupo.');
    expect(testId(asGuest, 'medical-group-request-reschedule')).toBeNull();

    const asCreator = await open('creator', pendingChange);
    pestana(asCreator, 'Horario');
    expect(asCreator.textContent).toContain('Hay un cambio propuesto');
    expect(asCreator.textContent).not.toContain('Lo resuelve quien creó el grupo.');
  });

  it('realizado y dentro de la semana: carga notas y la API devuelve el grupo actualizado', async () => {
    const host = await open(
      'creator',
      wire({ scheduledAt: past, isRealized: true, canEditExerciseNotes: true }),
    );

    pestana(host, 'Notas del ejercicio');
    const textarea = host.querySelector('app-textarea textarea') as HTMLTextAreaElement;
    textarea.value = 'Procedimiento sin complicaciones.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    testId(host, 'medical-group-save-notes')!.click();

    const save = http.expectOne('/medical-groups/g-1/exercise-notes');
    expect(save.request.body).toEqual({ notesText: 'Procedimiento sin complicaciones.' });
    save.flush(
      wire({
        scheduledAt: past,
        isRealized: true,
        canEditExerciseNotes: true,
        exerciseNotesText: 'Procedimiento sin complicaciones.',
      }),
    );
  });

  it('cerrado: dice que el expediente es inmutable y no ofrece ninguna edición', async () => {
    const host = await open(
      'creator',
      wire({
        status: 'CLOSED',
        scheduledAt: past,
        isRealized: true,
        isClosed: true,
        exerciseNotesText: 'Notas finales.',
      }),
    );

    expect(testId(host, 'medical-group-closed')).not.toBeNull();
    pestana(host, 'Horario');
    expect(testId(host, 'medical-group-request-reschedule')).toBeNull();
    pestana(host, 'Notas del ejercicio');
    expect(testId(host, 'medical-group-save-notes')).toBeNull();
    expect(testId(host, 'medical-group-notes')?.textContent).toContain('Notas finales.');
  });
});
