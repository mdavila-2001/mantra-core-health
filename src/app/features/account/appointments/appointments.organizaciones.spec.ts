import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { FilesClient } from '../../../core/data-access/files/files.client';
import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { BookableOrganization } from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { Appointments } from './appointments';

/**
 * Which organization a patient books with (#1899): the one their practitioner
 * works in, whether or not it is the session's. Pins how the screen picks it and
 * that every later read and write talks to it, not to the session's.
 */

const MOTIVO = 'Me surgió un viaje esa semana';

const org = (tenantId: string, name: string): BookableOrganization => ({
  tenantId,
  name,
  practitionerCount: 1,
  roomCount: 0,
});
const OLIVOS = org('t-1', 'Clínica Los Olivos');
const SAN_LUCAS = org('t-2', 'Hospital San Lucas');
const NORTE = org('t-3', 'Centro Norte');

const pagina = <T>(items: readonly T[]) => ({ items, count: items.length, limit: 50, truncated: false });

/** A mapped booking; `tenantId` is the organization of its agenda. */
const cita = (id: string, tenantId?: string) => ({
  id,
  patientProfileId: 'p-1',
  resourceId: 'r-1',
  statusConceptId: 's1',
  startAt: new Date('2026-08-12T12:00:00.000Z'),
  endAt: new Date('2026-08-12T12:30:00.000Z'),
  reasonText: '',
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  ...(tenantId === undefined ? {} : { tenantId }),
});

interface Montaje {
  /** The session's active organization. */
  readonly activa: string | null;
  /** What `GET /scheduling/bookable-organizations` answers; `'falla'` makes it fail. */
  readonly organizaciones: readonly BookableOrganization[] | 'falla';
  /** Agenda resources by organization. */
  readonly recursos?: Readonly<Record<string, readonly { id: string; name: string; capacity: number }[]>>;
  readonly bookings?: readonly ReturnType<typeof cita>[];
}

/** The members the screen keeps protected and these cases exercise. */
interface Interno {
  organizacion(): string | null;
  preguntaPorOrganizacion(): boolean;
  opcionesDeOrganizacion(): readonly { value: string; label: string }[];
  elegirOrganizacion(tenantId: string | null): void;
  elegirAgenda(clave: string | null): void;
  elegirSeccion(seccion: string): void;
  agendaElegida(): string | null;
  recursos(): readonly { id: string }[];
  paramsDeReserva(horario: object): Record<string, string>;
  turnosListos(): readonly unknown[];
  cancelarTurno(turno: unknown): Promise<void>;
}

function montar(m: Montaje) {
  const respuesta = m.organizaciones === 'falla' ? throwError(() => new Error('500')) : of(m.organizaciones);
  const listBookableOrganizations = vi.fn().mockReturnValue(respuesta);
  const listResources = vi.fn((q: { tenantId: string }) => of(pagina(m.recursos?.[q.tenantId] ?? [])));
  const listSlots = vi.fn().mockReturnValue(of(pagina([])));
  const cancelBooking = vi.fn().mockReturnValue(of({ bookingId: 'x', capacityReleased: true }));
  const confirmWithReason = vi.fn().mockResolvedValue(MOTIVO);

  TestBed.configureTestingModule({
    imports: [Appointments],
    providers: [
      {
        provide: SchedulingClient,
        useValue: {
          listBookableOrganizations,
          searchBookings: vi.fn().mockReturnValue(of(pagina(m.bookings ?? []))),
          listResources,
          listSlots,
          listServiceOfferings: vi.fn().mockReturnValue(of([])),
          getFlexibleAvailability: vi.fn().mockReturnValue(of({ resourceId: '', stepMinutes: 15, items: [] })),
          cancelBooking,
          listWaitlist: vi.fn().mockReturnValue(of({ items: [] })),
          getBooking: vi.fn((id: string) => of({ id })),
        },
      },
      {
        provide: TerminologyClient,
        useValue: {
          readConceptLabels: vi.fn().mockReturnValue(
            of(new Map([['s1', { conceptId: 's1', code: 'BOOKING_CONFIRMED', display: 'x', codeSystemVersionId: 'v' }]])),
          ),
        },
      },
      { provide: PaymentReceiptsClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
      { provide: FilesClient, useValue: { upload: vi.fn() } },
      {
        provide: AuthService,
        useValue: {
          userId: () => 'u-1',
          displayName: () => 'Ana Quispe',
          patientProfileId: () => 'p-1',
          activeTenantId: () => m.activa,
        },
      },
      { provide: DialogService, useValue: { confirm: vi.fn().mockResolvedValue(true), confirmWithReason } },
      { provide: ToastService, useValue: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() } },
      provideRouter([]),
    ],
  });

  const fixture: ComponentFixture<Appointments> = TestBed.createComponent(Appointments);
  fixture.detectChanges();
  const comp = fixture.componentInstance as unknown as Interno;
  return { fixture, comp, listBookableOrganizations, listResources, listSlots, cancelBooking };
}

/** The first argument of the n-th `listResources` call, and the scope it travelled with. */
const lectura = (listResources: ReturnType<typeof vi.fn>, n = 0) => ({
  consulta: listResources.mock.calls[n]?.[0],
  alcance: listResources.mock.calls[n]?.[1],
});

describe('Appointments · con qué organización se pide cita (#1899)', () => {
  it('pide las organizaciones una sola vez, y las agendas de la de la sesión si está en la lista', () => {
    const { listBookableOrganizations, listResources, comp } = montar({
      activa: 't-1',
      organizaciones: [OLIVOS, SAN_LUCAS],
    });

    expect(listBookableOrganizations).toHaveBeenCalledTimes(1);
    expect(listResources).toHaveBeenCalledTimes(1);
    expect(lectura(listResources)).toEqual({
      consulta: { tenantId: 't-1', resourceType: 'PRACTITIONER' },
      alcance: { tenantId: 't-1' },
    });
    expect(comp.organizacion()).toBe('t-1');
  });

  it('si la organización de la sesión no tiene cupos, elige la primera de la lista', () => {
    const { listResources, comp } = montar({ activa: 't-1', organizaciones: [SAN_LUCAS, NORTE] });

    // The session's agendas have no openings: don't leave the patient with «no professionals».
    expect(listResources).toHaveBeenCalledTimes(1);
    expect(lectura(listResources)).toEqual({
      consulta: { tenantId: 't-2', resourceType: 'PRACTITIONER' },
      alcance: { tenantId: 't-2' },
    });
    expect(comp.organizacion()).toBe('t-2');
  });

  it('una cuenta sin organización activa también cae en la primera de la lista', () => {
    const { listResources, comp } = montar({ activa: null, organizaciones: [SAN_LUCAS] });

    expect(comp.organizacion()).toBe('t-2');
    expect(lectura(listResources).alcance).toEqual({ tenantId: 't-2' });
  });

  it('con la lista vacía sigue con la de la sesión y no pregunta cuál', () => {
    const { listResources, comp } = montar({ activa: 't-1', organizaciones: [] });

    expect(comp.organizacion()).toBe('t-1');
    expect(comp.preguntaPorOrganizacion()).toBe(false);
    expect(lectura(listResources).alcance).toEqual({ tenantId: 't-1' });
  });

  it('si leer la lista falla, igual se puede pedir cita en la organización de la sesión', () => {
    const { listResources, comp } = montar({ activa: 't-1', organizaciones: 'falla' });

    expect(listResources).toHaveBeenCalledTimes(1);
    expect(lectura(listResources).alcance).toEqual({ tenantId: 't-1' });
    expect(comp.preguntaPorOrganizacion()).toBe(false);
  });

  it('sin lista ni organización de la sesión no hay agendas que pedir', () => {
    const { listResources, comp } = montar({ activa: null, organizaciones: [] });

    expect(comp.organizacion()).toBeNull();
    expect(listResources).not.toHaveBeenCalled();
  });

  it('con varias organizaciones pregunta en cuál, con sus nombres', async () => {
    const { fixture, comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS] });

    expect(comp.preguntaPorOrganizacion()).toBe(true);
    expect(comp.opcionesDeOrganizacion()).toEqual([
      { value: 't-1', label: 'Clínica Los Olivos' },
      { value: 't-2', label: 'Hospital San Lucas' },
    ]);

    comp.elegirSeccion('pedir');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="turnos-organizacion"]')).not.toBeNull();
  });
});

describe('Appointments · cambiar de organización (#1899)', () => {
  const RECURSOS = {
    't-1': [{ id: 'r-1', name: 'Dra. Rojas', capacity: 1 }],
    't-2': [{ id: 'r-9', name: 'Dr. Vargas', capacity: 1 }],
  };

  it('relee las agendas de la elegida, con su alcance, y se queda solo con las suyas', () => {
    const { listResources, comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS], recursos: RECURSOS });
    expect(comp.recursos().map((r) => r.id)).toEqual(['r-1']);

    comp.elegirOrganizacion('t-2');

    expect(listResources).toHaveBeenCalledTimes(2);
    expect(lectura(listResources, 1)).toEqual({
      consulta: { tenantId: 't-2', resourceType: 'PRACTITIONER' },
      alcance: { tenantId: 't-2' },
    });
    expect(comp.organizacion()).toBe('t-2');
    expect(comp.recursos().map((r) => r.id)).toEqual(['r-9']);
  });

  it('suelta el profesional que estaba elegido: era de la otra organización', () => {
    const { comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS], recursos: RECURSOS });
    comp.elegirAgenda('recurso:r-1');
    expect(comp.agendaElegida()).toBe('recurso:r-1');

    comp.elegirOrganizacion('t-2');

    expect(comp.agendaElegida()).toBeNull();
  });

  it('elegir la que ya está, o volver al placeholder, no relee nada', () => {
    const { listResources, comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS], recursos: RECURSOS });

    comp.elegirOrganizacion('t-1');
    comp.elegirOrganizacion(null);

    expect(listResources).toHaveBeenCalledTimes(1);
    expect(comp.organizacion()).toBe('t-1');
  });

  it('los horarios del profesional se piden a la organización elegida', () => {
    const { listSlots, comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS], recursos: RECURSOS });
    comp.elegirOrganizacion('t-2');

    comp.elegirAgenda('recurso:r-9');

    expect(listSlots).toHaveBeenCalledTimes(1);
    expect(listSlots.mock.calls[0]?.[0]).toMatchObject({ resourceId: 'r-9' });
    expect(listSlots.mock.calls[0]?.[1]).toEqual({ tenantId: 't-2' });
  });

  it('el enlace de reserva lleva la organización elegida y no la de la sesión', () => {
    const { comp } = montar({ activa: 't-1', organizaciones: [OLIVOS, SAN_LUCAS], recursos: RECURSOS });
    comp.elegirOrganizacion('t-2');

    const params = comp.paramsDeReserva({
      resourceId: 'r-9',
      desde: new Date('2026-09-02T09:00:00.000Z'),
      hasta: new Date('2026-09-02T09:30:00.000Z'),
    });

    expect(params).toEqual({
      recurso: 'r-9',
      desde: '2026-09-02T09:00:00.000Z',
      hasta: '2026-09-02T09:30:00.000Z',
      org: 't-2',
    });
  });
});

describe('Appointments · una cita de otra organización (#1899)', () => {
  // Bookings span organizations: cancelling one talks to its own, not the picked one.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('cancelarla le habla a la organización de la cita', async () => {
    const { comp, cancelBooking } = montar({ activa: 't-1', organizaciones: [], bookings: [cita('b1', 't-2')] });

    await comp.cancelarTurno(comp.turnosListos()[0]);

    expect(cancelBooking).toHaveBeenCalledWith(
      'b1',
      { cancelledBy: 'PATIENT', reasonText: MOTIVO },
      undefined,
      { tenantId: 't-2' },
    );
  });
});
