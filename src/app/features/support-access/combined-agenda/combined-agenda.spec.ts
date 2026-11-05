import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportAgenda, SupportAgendaItem, SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { CombinedAgenda } from './combined-agenda';

/* Un día cualquiera de la semana que viene: la agenda se pide a esa fecha, no a «hoy», para que la prueba no dependa del reloj. */
const DIA_CLAVE = '2030-01-15';
const en = (dia: number, hora: number, minuto = 0): string => new Date(2030, 0, dia, hora, minuto).toISOString();

const ANA = ['schedule.view', 'schedule.create', 'schedule.reschedule', 'schedule.cancel', 'schedule.confirm', 'schedule.check_in', 'schedule.walk_in', 'schedule.waitlist', 'patient.register'] as const;
const LUCIA = ['schedule.view', 'schedule.check_in', 'schedule.walk_in'] as const;

const vinculo = (tenantId: string, organizationName: string): SupportEngagement => ({ id: `e-${tenantId}`, tenantId, organizationName, status: 'ACTIVE', roleTemplate: 'SECRETARY', grants: [] }) as unknown as SupportEngagement;

function item(id: string, parcial: Partial<SupportAgendaItem> = {}): SupportAgendaItem {
  return {
    id,
    kind: 'SLOT',
    start: en(15, 9),
    end: en(15, 9, 30),
    practitionerRoleAssignmentId: 'd-1',
    careSpaceId: 'c-103',
    careSpaceName: 'Consultorio 103',
    healthcareServiceId: 's-1',
    serviceName: 'Consulta',
    resourceId: 'r-1',
    status: 'FREE',
    allowedActions: [...ANA],
    ...parcial,
  };
}

const ITEMS: readonly SupportAgendaItem[] = [
  item('libre', { start: en(15, 9), end: en(15, 9, 30) }),
  item('cita', { kind: 'BOOKING', status: 'CONFIRMED', start: en(15, 10), end: en(15, 10, 30), patientLabel: 'Rosa M.', reasonLabel: 'Control' }),
  item('por-confirmar', { kind: 'BOOKING', status: 'BOOKED', start: en(15, 11), end: en(15, 11, 30), patientLabel: 'Pedro S.' }),
  item('de-rojas', { practitionerRoleAssignmentId: 'd-2', careSpaceId: 'c-b201', careSpaceName: 'Consultorio B201', start: en(15, 9), end: en(15, 9, 30) }),
  item('sin-permiso', { careSpaceId: 'c-401', careSpaceName: 'Cama 401', start: en(15, 14), end: en(15, 14, 30), allowedActions: [], denialReason: 'No tiene permiso sobre esta agenda.' }),
  item('destino', { start: en(16, 9), end: en(16, 9, 30) }),
];

const AGENDA: SupportAgenda = {
  doctors: [
    { id: 'd-1', name: 'Dr. Pérez', specialty: 'Cardiología' },
    { id: 'd-2', name: 'Dra. Rojas', specialty: 'Ginecología' },
  ],
  services: [{ id: 's-1', name: 'Consulta' }],
  locations: [
    { id: 'sede', kind: 'SITE', name: 'Sede Central', parentId: null, path: '/sede/' },
    { id: 'c-103', kind: 'CONSULTING_ROOM', name: 'Consultorio 103', parentId: 'sede', path: '/sede/103/' },
    { id: 'c-b201', kind: 'CONSULTING_ROOM', name: 'Consultorio B201', parentId: 'sede', path: '/sede/b201/' },
  ],
  items: ITEMS,
};

interface Opciones {
  readonly engagements?: readonly SupportEngagement[];
  readonly agendas?: Readonly<Record<string, SupportAgenda>>;
  readonly consulta?: string;
  readonly motivo?: string | null;
}

describe('CombinedAgenda', () => {
  let fixture: ComponentFixture<CombinedAgenda>;
  let router: Router;
  let getSupportAgenda: ReturnType<typeof vi.fn>;
  let checkInBooking: ReturnType<typeof vi.fn>;
  let acceptBooking: ReturnType<typeof vi.fn>;
  let cancelBooking: ReturnType<typeof vi.fn>;
  let rescheduleBooking: ReturnType<typeof vi.fn>;
  let placeHold: ReturnType<typeof vi.fn>;
  let confirmHold: ReturnType<typeof vi.fn>;
  let createDirectAppointment: ReturnType<typeof vi.fn>;
  let enrollWaitlist: ReturnType<typeof vi.fn>;
  let searchExact: ReturnType<typeof vi.fn>;
  let confirmWithReason: ReturnType<typeof vi.fn>;
  let explainMine: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 3; i += 1) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  const clic = async (el: Element | null): Promise<void> => {
    expect(el, 'el elemento a tocar no existe').not.toBeNull();
    (el as HTMLElement).click();
    await settle();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const input = byId(id)!.querySelector('input')!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const tecla = async (key: string, target: EventTarget = document.body): Promise<void> => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
  };
  const consultas = (): { org: string; from: string; to: string }[] => getSupportAgenda.mock.calls.map((c) => c[0] as { org: string; from: string; to: string });

  async function montar(opciones: Opciones = {}): Promise<void> {
    // Varias pruebas montan dos veces (con y sin algo): cada montaje parte de un módulo limpio.
    TestBed.resetTestingModule();
    const engagements = opciones.engagements ?? [vinculo('t-1', 'Hospital Piloto')];
    getSupportAgenda = vi.fn((q: { org: string }) => of(opciones.agendas?.[q.org] ?? AGENDA));
    checkInBooking = vi.fn(() => of({ bookingId: 'x', checkedInAt: new Date() }));
    acceptBooking = vi.fn(() => of({ bookingId: 'x' }));
    cancelBooking = vi.fn(() => of({ bookingId: 'x', capacityReleased: true }));
    rescheduleBooking = vi.fn(() => of({ bookingId: 'x', fromSlotId: 'a', toSlotId: 'b' }));
    placeHold = vi.fn(() => of({ holdToken: 'tok' }));
    confirmHold = vi.fn(() => of({ id: 'b-1' }));
    createDirectAppointment = vi.fn(() => of({ bookingId: 'b-2' }));
    enrollWaitlist = vi.fn(() => of({ id: 'w-1' }));
    searchExact = vi.fn(() => of({ items: [{ profileId: 'p-1', displayName: 'Juan Pérez Rojas', documentMasked: '***456', ageYears: 36, isMinor: false }] }));
    confirmWithReason = vi.fn(async () => (opciones.motivo === undefined ? 'Porque sí, con motivo' : opciones.motivo));
    explainMine = vi.fn(() => of({ decision: { effect: 'DENY' }, summary: 'La cita es de un paciente que usted no puede ver.', missing: [{ kind: 'APPROVAL', message: 'Pida la autorización del doctor.', fix: { type: 'REQUEST_APPROVAL' } }], askAdmin: 'Pida a su administrador que le dé acceso.', reasons: [], obligations: {}, visibleFields: {}, evaluatedAt: '' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { listMyEngagements: () => of({ engagements, requests: [] }), getSupportAgenda } },
        { provide: SchedulingClient, useValue: { checkInBooking, acceptBooking, cancelBooking, rescheduleBooking, placeHold, confirmHold, createDirectAppointment, enrollWaitlist } },
        { provide: SupportPatientsClient, useValue: { searchExact, register: vi.fn() } },
        { provide: DialogService, useValue: { confirmWithReason } },
        { provide: AccessExplainClient, useValue: { explainMine } },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl(opciones.consulta ?? `/?fecha=${DIA_CLAVE}`);
    fixture = TestBed.createComponent(CombinedAgenda);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('qué pide y qué muestra', () => {
    it('pide la agenda de la organización con el rango del día elegido', async () => {
      await montar();
      const [consulta] = consultas();
      expect(consulta!.org).toBe('t-1');
      expect(new Date(consulta!.from).getTime()).toBe(new Date(2030, 0, 15, 0, 0, 0, 0).getTime());
      expect(new Date(consulta!.to).getTime()).toBe(new Date(2030, 0, 15, 23, 59, 59, 999).getTime());
      expect(byId('agenda-titulo')!.textContent).toContain('15 de enero de 2030');
    });

    it('la vista de semana pide los siete días, de lunes a domingo', async () => {
      await montar({ consulta: `/?fecha=${DIA_CLAVE}&vista=semana` });
      const [consulta] = consultas();
      expect(new Date(consulta!.from).getDate()).toBe(14);
      expect(new Date(consulta!.to).getDate()).toBe(20);
      expect(host().querySelectorAll('[role="columnheader"], .grid__titulo')).toHaveLength(7);
    });

    it('muestra un horario por evento y el de otro día no entra en la vista del día', async () => {
      await montar();
      expect(byId('item-libre')).not.toBeNull();
      expect(byId('item-cita')).not.toBeNull();
      expect(byId('item-destino')).toBeNull();
    });

    it('«Mis doctores» apaga y prende un doctor sin volver a pedir la agenda, y queda en la URL', async () => {
      await montar();
      expect(byId('item-de-rojas')).not.toBeNull();
      await clic(byId('doctor-visible-d-2'));
      expect(byId('item-de-rojas')).toBeNull();
      expect(getSupportAgenda).toHaveBeenCalledTimes(1);
      expect(router.url).toContain('ocultos=d-2');
      await clic(byId('doctor-visible-d-2'));
      expect(byId('item-de-rojas')).not.toBeNull();
      expect(router.url).not.toContain('ocultos');
    });

    it('«Ninguno» apaga a todos y «Todos» los prende', async () => {
      await montar();
      await clic(byId('doctores-ninguno'));
      expect(byId('item-libre')).toBeNull();
      expect(byId('agenda-sin-horarios')).not.toBeNull();
      await clic(byId('doctores-todos'));
      expect(byId('item-libre')).not.toBeNull();
    });

    it('un filtro de ubicación aparece como chip, filtra y «Limpiar todo» los quita', async () => {
      await montar();
      await clic(byId('ubicacion-c-103'));
      expect(byId('item-de-rojas')).toBeNull();
      expect(byId('agenda-chips')!.textContent).toContain('Ubicación: Consultorio 103');
      expect(router.url).toContain('ubicacion=c-103');
      await clic(byId('agenda-limpiar'));
      expect(byId('agenda-chips')).toBeNull();
      expect(byId('item-de-rojas')).not.toBeNull();
      expect(router.url).not.toContain('ubicacion');
    });

    it('leer la URL al abrir: vista, agrupación y filtros vuelven como se dejaron', async () => {
      await montar({ consulta: `/?fecha=${DIA_CLAVE}&agrupar=consultorio&ocultos=d-2&libres=0` });
      const encabezados = Array.from(host().querySelectorAll('.grid__rotulo')).map((e) => e.textContent!.trim());
      expect(encabezados).toEqual(['Cama 401', 'Consultorio 103']);
      expect(byId('item-libre')).toBeNull();
      expect(byId('agenda-chips')!.textContent).toContain('Sin horarios libres');
    });

    it('cambia a la línea de tiempo: una fila por consultorio, con su ocupación', async () => {
      await montar({ consulta: `/?fecha=${DIA_CLAVE}&vista=linea&agrupar=consultorio` });
      const filas = host().querySelectorAll('.linea__fila');
      expect(filas.length).toBe(3);
      const fila103 = Array.from(filas).find((f) => f.textContent!.includes('Consultorio 103'))!;
      expect(fila103.querySelector('[role="meter"]')!.getAttribute('aria-valuenow')).toBe('67');
      expect(byId('item-cita')).not.toBeNull();
    });

    it('elegir una vista escribe en la URL y la semana vuelve a pedir el rango', async () => {
      await montar();
      await clic(host().querySelector('[data-testid="agenda-vista"] [data-value="WEEK"]'));
      expect(router.url).toContain('vista=semana');
      expect(getSupportAgenda).toHaveBeenCalledTimes(2);
    });
  });

  describe('navegar por las fechas', () => {
    it('«Hoy», anterior y siguiente mueven el período; en la semana, de a siete días', async () => {
      await montar();
      await clic(byId('agenda-dia-siguiente'));
      expect(router.url).toContain('fecha=2030-01-16');
      await clic(byId('agenda-dia-anterior'));
      await clic(byId('agenda-dia-anterior'));
      expect(router.url).toContain('fecha=2030-01-14');
      await clic(host().querySelector('[data-testid="agenda-vista"] [data-value="WEEK"]'));
      await clic(byId('agenda-dia-siguiente'));
      expect(router.url).toContain('fecha=2030-01-21');
      await clic(byId('agenda-hoy'));
      expect(router.url).not.toContain('fecha=2030');
    });

    it('el selector de fecha lleva la agenda a ese día', async () => {
      await montar();
      const campo = byId('agenda-fecha') as HTMLInputElement;
      campo.value = '2030-02-03';
      campo.dispatchEvent(new Event('change'));
      await settle();
      expect(router.url).toContain('fecha=2030-02-03');
    });

    it('los atajos: T lleva a hoy y las flechas mueven un día; escribiendo en un campo no hacen nada', async () => {
      await montar();
      await tecla('ArrowRight');
      expect(router.url).toContain('fecha=2030-01-16');
      await tecla('ArrowLeft');
      await tecla('ArrowLeft');
      expect(router.url).toContain('fecha=2030-01-14');
      await tecla('t');
      expect(router.url).not.toContain('fecha=2030');

      await montar();
      const campo = byId('agenda-fecha') as HTMLInputElement;
      await tecla('ArrowRight', campo);
      expect(router.url).toContain('fecha=2030-01-15');
    });

    it('N abre «Nueva cita», / abre la búsqueda, y Escape los cierra', async () => {
      await montar();
      await tecla('n');
      expect(byId('agenda-buscador')!.textContent).toContain('Nueva cita');
      await tecla('Escape');
      expect(byId('agenda-buscador')).toBeNull();
      await tecla('/');
      expect(byId('agenda-buscador')!.textContent).toContain('Buscar a un paciente');
    });
  });

  describe('permisos: lo que no está permitido no se ofrece', () => {
    it('el horario sin permiso sale atenuado, no abre el panel y su etiqueta dice el motivo', async () => {
      await montar();
      const celda = byId('item-sin-permiso')!;
      expect(celda.classList).toContain('celda--atenuada');
      expect(celda.getAttribute('aria-disabled')).toBe('true');
      expect(celda.getAttribute('aria-label')).toContain('Sin permiso: No tiene permiso sobre esta agenda.');
      await clic(celda);
      expect(byId('agenda-panel')).toBeNull();
      expect(byId('agenda-anuncio')!.textContent).toContain('No tiene permiso sobre esta agenda.');
    });

    it('los horarios sin permiso se pueden ocultar con el interruptor', async () => {
      await montar();
      await clic(byId('agenda-ver-sin-permiso'));
      expect(byId('item-sin-permiso')).toBeNull();
      expect(router.url).toContain('sinpermiso=0');
    });

    it('Lucía (recepción) en un horario libre: el botón «Crear cita» NO EXISTE y la nota lo explica', async () => {
      const agenda = { ...AGENDA, items: [item('libre', { allowedActions: [...LUCIA] })] };
      await montar({ agendas: { 't-1': agenda } });
      await clic(byId('item-libre'));
      expect(byId('agenda-panel')).not.toBeNull();
      expect(byId('agenda-crear-cita')).toBeNull();
      expect(byId('agenda-accion-waitlist')).toBeNull();
      expect(byId('agenda-accion-walk_in')).not.toBeNull();
      expect(byId('agenda-sin-crear')!.textContent).toContain('no incluye crear citas');
    });

    it('sin registrar la llegada en el permiso, el botón no existe', async () => {
      const agenda = { ...AGENDA, items: [item('cita', { kind: 'BOOKING', status: 'CONFIRMED', patientLabel: 'Rosa M.', allowedActions: ['schedule.view'] })] };
      await montar({ agendas: { 't-1': agenda } });
      await clic(byId('item-cita'));
      expect(byId('agenda-registrar-llegada')).toBeNull();
      expect(byId('agenda-accion-reschedule')).toBeNull();
      expect(byId('agenda-accion-cancel')).toBeNull();
    });

    it('Ana ve las cuatro acciones sobre una cita reservada, y «Confirmar» solo ahí', async () => {
      await montar();
      await clic(byId('item-por-confirmar'));
      for (const accion of ['agenda-accion-confirm', 'agenda-registrar-llegada', 'agenda-accion-reschedule', 'agenda-accion-cancel']) expect(byId(accion), accion).not.toBeNull();
      await clic(byId('item-cita'));
      expect(byId('agenda-accion-confirm')).toBeNull();
    });
  });

  describe('una agenda vacía no es un error', () => {
    const SIN_CITAS: SupportAgenda = { ...AGENDA, items: [] };
    const conGrants = (actions: readonly string[]): SupportEngagement => ({ ...vinculo('t-1', 'Hospital Piloto'), grants: [{ status: 'ACTIVE', actions }] }) as unknown as SupportEngagement;

    it('con el vínculo vivo pero sin ninguna acción de agenda, la lista llega vacía y la pantalla dice por qué', async () => {
      await montar({ engagements: [conGrants(['patient.register'])], agendas: { 't-1': SIN_CITAS } });
      expect(byId('agenda-sin-horarios')).not.toBeNull();
      expect(byId('agenda-sin-permiso-de-agenda')!.textContent).toContain('no incluye permisos de agenda');
      expect(byId('agenda-sin-permiso-de-agenda')!.textContent).toContain('Hospital Piloto');
      expect(byId('agenda-sin-permiso-de-agenda')!.textContent).toContain('no como un error');
      expect(byId('agenda-sin-permiso-de-agenda')!.textContent).not.toContain('403');
    });

    it('con permisos de agenda y sin citas en el rango, solo explica que se muestra lo que el vínculo permite ver', async () => {
      await montar({ engagements: [conGrants(['schedule.view'])], agendas: { 't-1': SIN_CITAS } });
      expect(byId('agenda-sin-permiso-de-agenda')).toBeNull();
      expect(byId('agenda-vacia-explicacion')!.textContent).toContain('solo muestra las citas y los horarios que su vínculo permite ver');
    });
  });

  describe('acciones sobre una cita', () => {
    it('registrar la llegada llama a la API y vuelve a leer la agenda', async () => {
      await montar();
      await clic(byId('item-cita'));
      await clic(byId('agenda-registrar-llegada'));
      expect(checkInBooking).toHaveBeenCalledWith('cita', expect.objectContaining({ context: expect.anything() }));
      expect(getSupportAgenda).toHaveBeenCalledTimes(2);
      expect(byId('agenda-panel')).toBeNull();
    });

    it('confirmar una cita reservada', async () => {
      await montar();
      await clic(byId('item-por-confirmar'));
      await clic(byId('agenda-accion-confirm'));
      expect(acceptBooking).toHaveBeenCalledWith('por-confirmar', undefined, expect.objectContaining({ context: expect.anything() }));
    });

    it('cancelar pide el motivo y lo manda; si se arrepiente, no cancela nada', async () => {
      await montar();
      await clic(byId('item-cita'));
      await clic(byId('agenda-accion-cancel'));
      expect(confirmWithReason).toHaveBeenCalledOnce();
      const [config] = confirmWithReason.mock.calls[0]!;
      expect(config.details).toContainEqual({ label: 'Organización', value: 'Hospital Piloto' });
      expect(cancelBooking).toHaveBeenCalledWith('cita', { cancelledBy: 'PROVIDER', reasonText: 'Porque sí, con motivo' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('si se cierra el diálogo de cancelar, la cita queda como estaba', async () => {
      await montar({ motivo: null });
      await clic(byId('item-cita'));
      await clic(byId('agenda-accion-cancel'));
      expect(cancelBooking).not.toHaveBeenCalled();
      expect(byId('agenda-panel')).not.toBeNull();
    });

    it('reprogramar desde el panel: ofrece solo horarios que sirven, muestra la vista previa y manda el motivo', async () => {
      await montar({ consulta: `/?fecha=${DIA_CLAVE}&vista=semana` });
      await clic(byId('item-cita'));
      await clic(byId('agenda-accion-reschedule'));
      const destinos = Array.from(host().querySelectorAll('[data-testid^="destino-"]')).map((d) => d.getAttribute('data-testid'));
      expect(destinos).toContain('destino-destino');
      expect(destinos).not.toContain('destino-sin-permiso');
      // Pasado: el 15 de enero de 2030 está en el futuro de cualquier reloj de hoy, así que los del mismo día también sirven.
      await clic(byId('destino-destino'));
      const [config] = confirmWithReason.mock.calls[0]!;
      expect(config.title).toBe('Reprogramar la cita');
      expect(config.details.map((d: { label: string }) => d.label)).toEqual(['Organización', 'Paciente', 'Ahora', 'Pasa a']);
      expect(rescheduleBooking).toHaveBeenCalledWith('cita', { toSlotId: 'destino', reasonText: 'Porque sí, con motivo' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('un error de la API se dice en el panel, con las palabras de la API, y no cierra nada', async () => {
      await montar();
      checkInBooking.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { statusCode: 409, code: 'CONFLICT', message: 'Ese horario ya no está libre.', error: 'Conflict' } })));
      await clic(byId('item-cita'));
      await clic(byId('agenda-registrar-llegada'));
      expect(byId('agenda-error')!.textContent).toContain('Ese horario ya no está libre.');
      expect(byId('agenda-panel')).not.toBeNull();
    });
  });

  describe('arrastrar y soltar', () => {
    function puntero(tipo: string, x: number, y: number): Event {
      const e = new Event(tipo, { bubbles: true });
      Object.assign(e, { clientX: x, clientY: y, button: 0, pointerType: 'mouse' });
      return e;
    }

    beforeEach(() => {
      (document as unknown as { elementFromPoint: unknown }).elementFromPoint = vi.fn();
    });

    it('arrastrar una cita sobre un horario libre pide confirmación con vista previa y reprograma', async () => {
      await montar({ consulta: `/?fecha=${DIA_CLAVE}&vista=semana` });
      (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(byId('item-destino'));
      byId('item-cita')!.dispatchEvent(puntero('pointerdown', 10, 10));
      document.dispatchEvent(puntero('pointermove', 200, 200));
      await settle();
      expect(byId('item-destino')!.classList).toContain('celda--destino-ok');
      expect(byId('agenda-fantasma')!.textContent).toContain('Suelte aquí para reprogramar');
      document.dispatchEvent(puntero('pointerup', 200, 200));
      await settle();
      expect(confirmWithReason).toHaveBeenCalledOnce();
      expect(rescheduleBooking).toHaveBeenCalledWith('cita', { toSlotId: 'destino', reasonText: 'Porque sí, con motivo' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('soltarla sobre un horario sin permiso no mueve nada y explica por qué', async () => {
      await montar();
      (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(byId('item-sin-permiso'));
      byId('item-cita')!.dispatchEvent(puntero('pointerdown', 10, 10));
      document.dispatchEvent(puntero('pointermove', 200, 200));
      await settle();
      expect(byId('item-sin-permiso')!.classList).toContain('celda--destino-no');
      expect(byId('agenda-fantasma')!.textContent).toContain('No tiene permiso sobre esta agenda.');
      document.dispatchEvent(puntero('pointerup', 200, 200));
      await settle();
      expect(rescheduleBooking).not.toHaveBeenCalled();
      expect(confirmWithReason).not.toHaveBeenCalled();
    });

    it('un horario libre no se arrastra', async () => {
      await montar();
      byId('item-libre')!.dispatchEvent(puntero('pointerdown', 10, 10));
      document.dispatchEvent(puntero('pointermove', 200, 200));
      await settle();
      expect(byId('agenda-fantasma')).toBeNull();
    });
  });

  describe('crear una cita con búsqueda exacta', () => {
    it('«Juan» no es una búsqueda: ni siquiera sale la petición y el aviso dice cómo buscar', async () => {
      await montar();
      await clic(byId('item-libre'));
      await clic(byId('agenda-crear-cita'));
      await escribir('buscador-texto', 'Juan');
      await clic(byId('buscador-buscar'));
      expect(searchExact).not.toHaveBeenCalled();
      expect(byId('buscador-aviso')!.textContent).toContain('«Juan» no alcanza');
      expect(byId('buscador-aviso')!.textContent).toContain('documento de identidad completo');
    });

    it('con el documento completo busca, elige, y crea la cita en la organización correcta', async () => {
      await montar();
      await clic(byId('item-libre'));
      await clic(byId('agenda-crear-cita'));
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      expect(searchExact).toHaveBeenCalledWith('t-1', { kind: 'DOCUMENT', document: '4123456' }, expect.objectContaining({ context: expect.anything() }));
      await clic(byId('elegir-p-1'));
      expect(byId('agenda-paciente-encontrado')!.textContent).toContain('Juan Pérez Rojas');
      await clic(byId('agenda-confirmar-cita'));
      expect(placeHold).toHaveBeenCalledWith('libre', { patientProfileId: 'p-1' });
      expect(confirmHold).toHaveBeenCalledWith('tok', expect.objectContaining({ tenantId: 't-1', patientProfileId: 'p-1', channel: 'DESK', reasonText: 'Consulta' }), expect.objectContaining({ context: expect.anything() }));
      expect(getSupportAgenda).toHaveBeenCalledTimes(2);
    });

    it('atender sin cita manda la llegada en una sola llamada, con el recurso y la organización', async () => {
      await montar();
      await clic(byId('item-libre'));
      await clic(byId('agenda-accion-walk_in'));
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      await clic(byId('agenda-confirmar-cita'));
      expect(createDirectAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ patientProfileId: 'p-1', resourceId: 'r-1', startAt: en(15, 9), durationMinutes: 30, walkIn: true }),
        { tenantId: 't-1' },
        expect.objectContaining({ context: expect.anything() }),
      );
    });

    it('«El doctor no presta ese servicio.» (403): lo dice, ofrece elegir otro horario o doctor y la agenda sigue abierta', async () => {
      await montar();
      confirmHold.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { statusCode: 403, code: 'FORBIDDEN', message: 'El doctor no presta ese servicio.', timestamp: '', path: '/' } })));
      await clic(byId('item-libre'));
      await clic(byId('agenda-crear-cita'));
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      await clic(byId('agenda-confirmar-cita'));
      expect(byId('agenda-error')!.textContent).toContain('El doctor no presta ese servicio.');
      expect(byId('agenda-elegir-otro-texto')!.textContent).toContain('otro doctor u otro servicio');
      await clic(byId('agenda-elegir-otro'));
      // El panel se cierra y la agenda sigue ahí.
      expect(byId('agenda-panel')).toBeNull();
      expect(byId('item-libre')).not.toBeNull();
    });

    it('un 403 distinto no ofrece «elegir otro»: no es un rechazo de lugar o servicio', async () => {
      await montar();
      confirmHold.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { statusCode: 403, code: 'FORBIDDEN', message: 'Su vínculo de apoyo no le permite esta acción.', timestamp: '', path: '/' } })));
      await clic(byId('item-libre'));
      await clic(byId('agenda-crear-cita'));
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      await clic(byId('agenda-confirmar-cita'));
      expect(byId('agenda-error')).not.toBeNull();
      expect(byId('agenda-elegir-otro')).toBeNull();
    });

    it('lista de espera: anota al paciente en ese horario', async () => {
      await montar();
      await clic(byId('item-libre'));
      await clic(byId('agenda-accion-waitlist'));
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      await clic(byId('agenda-confirmar-cita'));
      expect(enrollWaitlist).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't-1', patientProfileId: 'p-1', bookableSlotId: 'libre' }), expect.objectContaining({ context: expect.anything() }));
    });

    it('un menor no se elige sin decir quién actúa por él', async () => {
      await montar();
      searchExact.mockReturnValueOnce(
        of({ items: [{ profileId: 'p-9', displayName: 'Martín Rocha', documentMasked: '***613', ageYears: 11, isMinor: true, representatives: [{ id: 'r-1', name: 'Sandra Antelo', relationship: 'Madre' }] }] }),
      );
      await clic(byId('item-libre'));
      await clic(byId('agenda-crear-cita'));
      await escribir('buscador-texto', '5029613');
      await clic(byId('buscador-buscar'));
      expect(byId('elegir-p-9')!.getAttribute('aria-disabled')).toBe('true');
      await clic(byId('representante-r-1'));
      await clic(byId('elegir-p-9'));
      await clic(byId('agenda-confirmar-cita'));
      expect(confirmHold).toHaveBeenCalledWith('tok', expect.objectContaining({ reasonText: 'Consulta · Representante: Sandra Antelo (Madre)' }), expect.objectContaining({ context: expect.anything() }));
    });
  });

  describe('nueva cita con el paciente en mano', () => {
    it('N: se busca al paciente, se elige un horario libre y el panel ya trae al paciente', async () => {
      await montar();
      await tecla('n');
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      expect(byId('agenda-nueva-cita-banner')!.textContent).toContain('Juan Pérez Rojas');
      expect(byId('agenda-buscador')).toBeNull();
      await clic(byId('item-libre'));
      expect(byId('panel-paciente-en-mano')).not.toBeNull();
      await clic(byId('agenda-crear-cita'));
      expect(byId('agenda-paciente-encontrado')!.textContent).toContain('Juan Pérez Rojas');
      await clic(byId('agenda-confirmar-cita'));
      expect(placeHold).toHaveBeenCalledWith('libre', { patientProfileId: 'p-1' });
    });

    it('cancelar el banner suelta al paciente', async () => {
      await montar();
      await tecla('n');
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      await clic(byId('elegir-p-1'));
      await clic(byId('agenda-nueva-cita-cancelar'));
      expect(byId('agenda-nueva-cita-banner')).toBeNull();
    });
  });

  describe('varias organizaciones en una sola agenda', () => {
    const CESPEDES: SupportAgenda = {
      doctors: [{ id: 'd-9', name: 'Dra. Céspedes', specialty: 'Dermatología' }],
      services: [{ id: 's-9', name: 'Dermatología' }],
      locations: [],
      items: [item('de-cespedes', { practitionerRoleAssignmentId: 'd-9', careSpaceId: 'c-1', careSpaceName: 'Consultorio principal', healthcareServiceId: 's-9', start: en(15, 9), end: en(15, 9, 30) })],
    };
    const dos = { engagements: [vinculo('t-1', 'Hospital Piloto'), vinculo('t-2', 'Consultorio Dra. Paola Céspedes')], agendas: { 't-1': AGENDA, 't-2': CESPEDES } };

    it('por omisión muestra todas, pide una agenda por organización y marca cada evento con su sigla', async () => {
      await montar(dos);
      expect(consultas().map((c) => c.org).sort()).toEqual(['t-1', 't-2']);
      const opciones = host().querySelector('[data-testid="agenda-organizacion"]');
      expect(opciones).not.toBeNull();
      expect(byId('item-de-cespedes')!.querySelector('.celda__org')!.textContent).toContain('CPC');
      expect(byId('item-libre')!.querySelector('.celda__org')!.textContent).toContain('HP');
      expect(byId('item-de-cespedes')!.getAttribute('aria-label')).toContain('Consultorio Dra. Paola Céspedes');
    });

    it('el panel dice siempre en qué organización se actúa', async () => {
      await montar(dos);
      await clic(byId('item-de-cespedes'));
      expect(byId('panel-organizacion')!.textContent).toContain('Consultorio Dra. Paola Céspedes');
      await clic(byId('agenda-crear-cita'));
      expect(byId('agenda-confirmar-cita')).toBeNull();
      await escribir('buscador-texto', '4123456');
      await clic(byId('buscador-buscar'));
      expect(searchExact).toHaveBeenCalledWith('t-2', expect.anything(), expect.anything());
      await clic(byId('elegir-p-1'));
      expect(byId('agenda-confirmar-cita')!.textContent).toContain('Consultorio Dra. Paola Céspedes');
    });

    it('elegir una organización deja solo la suya y lo escribe en la URL', async () => {
      await montar({ ...dos, consulta: `/?fecha=${DIA_CLAVE}&org=t-2` });
      expect(consultas().map((c) => c.org)).toEqual(['t-2']);
      expect(byId('item-libre')).toBeNull();
      expect(byId('item-de-cespedes')).not.toBeNull();
      expect(byId('item-de-cespedes')!.querySelector('.celda__org')).toBeNull();
    });

    it('si una organización falla, se ve el resto y se avisa cuál faltó', async () => {
      await montar(dos);
      getSupportAgenda.mockImplementation((q: { org: string }) => (q.org === 't-2' ? throwError(() => ({ status: 500 })) : of(AGENDA)));
      await clic(byId('agenda-hoy'));
      await clic(host().querySelector('[data-testid="agenda-vista"] [data-value="WEEK"]'));
      expect(byId('agenda-fallo-parcial')!.textContent).toContain('Consultorio Dra. Paola Céspedes');
    });
  });

  describe('bloques «Reservado»', () => {
    const reservado = item('reservado', { kind: 'BOOKING', status: 'CONFIRMED', start: en(15, 12), end: en(15, 12, 30), allowedActions: [], denialReason: 'RESERVED', healthcareServiceId: undefined, serviceName: '' });
    const conReservado = { agendas: { 't-1': { ...AGENDA, items: [...ITEMS, reservado] } } };

    it('se dibuja como «Reservado», sin paciente, y la etiqueta accesible lo dice sin revelar por qué', async () => {
      await montar(conReservado);
      const bloque = byId('item-reservado')!;
      expect(bloque.textContent).toContain('Reservado');
      expect(bloque.textContent).not.toContain('Sin permiso');
      expect(bloque.getAttribute('aria-label')).toContain('Reservado: no puede ver el detalle de esta cita');
      expect(bloque.getAttribute('aria-disabled')).toBeNull();
    });

    it('al activarlo abre su panel, que no ofrece acciones sobre la cita, y «¿Por qué no puedo?» pregunta por esa cita', async () => {
      await montar(conReservado);
      await clic(byId('item-reservado'));

      const panel = byId('agenda-reservado')!;
      expect(panel.textContent).toContain('Este horario está ocupado, pero el detalle de la cita no está disponible para usted.');
      expect(panel.textContent).toContain('Dr. Pérez');
      expect(byId('agenda-panel')).toBeNull();
      expect(byId('agenda-registrar-llegada')).toBeNull();
      expect(explainMine).not.toHaveBeenCalled();

      await clic(byId('agenda-por-que-boton'));

      expect(explainMine).toHaveBeenCalledWith({ tenantId: 't-1', action: 'agenda.appointment.view', practitionerRoleAssignmentId: 'd-1', careSpaceId: 'c-103', appointmentStartAt: en(15, 12) });
      expect(byId('agenda-por-que-resumen')!.textContent).toContain('La cita es de un paciente que usted no puede ver.');
      expect(byId('agenda-por-que-pasos')!.textContent).toContain('Pida la autorización del doctor.');
      expect(byId('agenda-por-que-admin')!.textContent).toContain('Pida a su administrador que le dé acceso.');
      // Lo que se muestra nunca es un código técnico.
      expect(byId('agenda-reservado')!.textContent).not.toMatch(/EXPLICIT_DENY|RESERVED|agenda\.appointment/);
    });

    it('un bloque sin permiso (no reservado) sigue siendo «Sin permiso» y no abre panel', async () => {
      await montar(conReservado);
      await clic(byId('item-sin-permiso'));
      expect(byId('agenda-reservado')).toBeNull();
      expect(byId('agenda-panel')).toBeNull();
      expect(byId('item-sin-permiso')!.textContent).toContain('Sin permiso');
      expect(byId('agenda-anuncio')!.textContent).toContain('Sin permiso.');
    });
  });

  it('sin vínculo de apoyo activo, dice qué hacer', async () => {
    await montar({ engagements: [] });
    expect(host().textContent).toContain('No tiene un vínculo de apoyo activo');
    expect(getSupportAgenda).not.toHaveBeenCalled();
  });
});
