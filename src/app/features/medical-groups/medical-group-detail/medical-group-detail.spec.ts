import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
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
    const filas = host.querySelectorAll('[data-testid="medical-group-team"] tbody tr');
    expect(filas).toHaveLength(2);
    expect(host.textContent).toContain('Bs 1.500,00');
    expect(testId(host, 'medical-group-total')?.textContent).toContain('Bs 1.500,00');
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

  describe('CRUD del creador', () => {
    const miembros = [
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
    ];

    /** Escribe en un `app-input` por su testId. */
    function escribir(host: HTMLElement, id: string, valor: string): void {
      const input = host.querySelector(`[data-testid="${id}"] input, input[data-testid="${id}"]`);
      const campo = (input ?? testId(host, id)) as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('el creador de un grupo sin realizar ve agregar, modificar, quitar, editar y eliminar', async () => {
      const host = await open('creator', wire());

      expect(testId(host, 'medical-group-edit')).not.toBeNull();
      expect(testId(host, 'medical-group-delete')).not.toBeNull();
      pestana(host, 'Equipo');
      expect(testId(host, 'medical-group-add-member')).not.toBeNull();
      const modificar = host.querySelectorAll('[data-testid="medical-group-member-edit"]');
      const quitar = host.querySelectorAll('[data-testid="medical-group-member-remove"]');
      // Quien creó el grupo no se modifica ni se quita: una sola fila con acciones.
      expect(modificar).toHaveLength(1);
      expect(quitar).toHaveLength(1);
    });

    it('un integrante que no creó el grupo no ve ninguna acción de gestión', async () => {
      const host = await open('guest', wire());

      expect(testId(host, 'medical-group-edit')).toBeNull();
      expect(testId(host, 'medical-group-delete')).toBeNull();
      pestana(host, 'Equipo');
      expect(testId(host, 'medical-group-add-member')).toBeNull();
      expect(testId(host, 'medical-group-member-edit')).toBeNull();
    });

    it('un grupo realizado o cerrado ya no se gestiona', async () => {
      const host = await open('creator', wire({ scheduledAt: past, isRealized: true }));

      expect(testId(host, 'medical-group-edit')).toBeNull();
      expect(testId(host, 'medical-group-delete')).toBeNull();
      pestana(host, 'Equipo');
      expect(testId(host, 'medical-group-add-member')).toBeNull();
      expect(host.textContent).toContain('El equipo ya no se puede modificar');
    });

    it('modificar el pago de un cargo manda sólo ese cambio y muestra lo que devuelve la API', async () => {
      const host = await open('creator', wire());
      pestana(host, 'Equipo');

      (testId(host, 'medical-group-member-edit') as HTMLButtonElement).click();
      fixture.detectChanges();
      escribir(host, 'medical-group-member-amount', '2000.00');
      (testId(host, 'medical-group-member-save') as HTMLButtonElement).click();

      const request = http.expectOne('/medical-groups/g-1/members/m-guest');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({
        roleTitle: 'Anestesiólogo',
        agreedPaymentAmount: '2000.00',
        additionalTermsText: '',
      });
      request.flush(
        wire({ status: 'PENDING_TEAM' }, [
          miembros[0]!,
          { ...miembros[1]!, agreedPaymentAmount: '2000.00', invitationStatus: 'PENDING' },
        ]),
      );
      fixture.detectChanges();
      expect(host.textContent).toContain('Bs 2.000,00');
      expect(testId(host, 'medical-group-status')?.textContent).toContain('Esperando al equipo');
    });

    it('un pago mal escrito no deja guardar el cargo', async () => {
      const host = await open('creator', wire());
      pestana(host, 'Equipo');

      (testId(host, 'medical-group-member-edit') as HTMLButtonElement).click();
      fixture.detectChanges();
      escribir(host, 'medical-group-member-amount', '10.999');

      expect(
        (testId(host, 'medical-group-member-save') as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(host.textContent).toContain('hasta dos decimales');
    });

    it('agregar trae a los colegas que todavía no están en el equipo', async () => {
      const host = await open('creator', wire());
      pestana(host, 'Equipo');

      (testId(host, 'medical-group-add-member') as HTMLButtonElement).click();
      const colleagues = http.expectOne('/medical-groups/eligible-members?serviceCatalogId=s-1');
      colleagues.flush([
        { practitionerProfileId: 'guest', name: 'Luis Rojas' },
        { practitionerProfileId: 'nuevo', name: 'Ana Pinto' },
      ]);
      fixture.detectChanges();

      expect(
        (testId(host, 'medical-group-member-save') as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(host.querySelector('app-content-dialog')).not.toBeNull();
    });

    it('quitar un cargo pide confirmación y luego llama a la API', async () => {
      const host = await open('creator', wire());
      pestana(host, 'Equipo');
      const component = fixture.debugElement.query((d) => d.componentInstance instanceof MedicalGroupDetail)
        ?.componentInstance as MedicalGroupDetail | undefined;
      expect(component).toBeDefined();
      const dialogs = TestBed.inject(DialogService);
      vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);

      (testId(host, 'medical-group-member-remove') as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve));

      const request = http.expectOne('/medical-groups/g-1/members/m-guest');
      expect(request.request.method).toBe('DELETE');
      request.flush(wire({}, [miembros[0]!]));
      fixture.detectChanges();
      expect(host.querySelectorAll('[data-testid="medical-group-team"] tbody tr')).toHaveLength(1);
    });

    it('editar el grupo manda el lugar y las notas', async () => {
      const host = await open('creator', wire());

      (testId(host, 'medical-group-edit') as HTMLButtonElement).click();
      fixture.detectChanges();
      escribir(host, 'medical-group-edit-location', 'Quirófano 5');
      (testId(host, 'medical-group-edit-save') as HTMLButtonElement).click();

      const request = http.expectOne('/medical-groups/g-1');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ locationText: 'Quirófano 5', notesText: '' });
      request.flush(wire({ locationText: 'Quirófano 5' }));
      fixture.detectChanges();
      pestana(host, 'Horario');
      expect(host.textContent).toContain('Quirófano 5');
    });

    it('eliminar el grupo pide confirmación y vuelve al listado', async () => {
      const host = await open('creator', wire());
      const dialogs = TestBed.inject(DialogService);
      vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      (testId(host, 'medical-group-delete') as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve));

      const request = http.expectOne('/medical-groups/g-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      expect(navigate).toHaveBeenCalledWith('/my-medical-groups');
    });

    it('si el creador cancela la confirmación no se elimina nada', async () => {
      const host = await open('creator', wire());
      const dialogs = TestBed.inject(DialogService);
      vi.spyOn(dialogs, 'confirm').mockResolvedValue(false);

      (testId(host, 'medical-group-delete') as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve));

      http.expectNone('/medical-groups/g-1');
    });
  });

  describe('pestaña Horario', () => {
    it('resume cuándo, dónde, el estado y el cierre del expediente', async () => {
      const host = await open('creator', wire());

      pestana(host, 'Horario');
      const panel = testId(host, 'medical-group-tab-horario')!;
      expect(panel.textContent).toContain('Fecha y hora');
      expect(panel.textContent).toContain('Clínica Foianini, quirófano 2');
      expect(panel.textContent).toContain('Estado de la cita');
      expect(panel.textContent).toContain('El expediente se cierra');
    });

    it('si no se puede pedir el cambio, dice por qué', async () => {
      const host = await open('creator', wire({ status: 'PENDING_TEAM' }));

      pestana(host, 'Horario');
      expect(testId(host, 'medical-group-reschedule-blocked')?.textContent).toContain(
        'todo el equipo haya respondido',
      );
    });
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
