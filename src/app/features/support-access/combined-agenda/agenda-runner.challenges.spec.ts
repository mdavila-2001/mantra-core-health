import { TestBed } from '@angular/core/testing';
import { firstValueFrom, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import { ajustesDeAgenda, SUAREZ } from '../../../core/mock/fixtures/support-hospital';
import { agendaDePartida } from '../../../core/mock/fixtures/support-hospital-agenda';
import { aprobaciones } from '../../../core/mock/fixtures/support-hospital-governance';
import {
  reiniciarElGobiernoDeAccesos,
  reiniciarLaSesionDelSimulador,
} from '../../../core/mock/handlers/mock-reset';
import { negarSiNoPuede } from '../../../core/mock/handlers/support-access.core';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { AccessChallengeService } from '../../access-governance/access-challenge/access-challenge.service';
import { resolverDesafiosEnPrueba } from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { makeOrg, mergeAgendas, type AgendaEvent } from './agenda-model';
import { AgendaActionRunner } from './agenda-runner';

/**
 * Las acciones de la agenda **resuelven los desafíos** de la API: cancelar una cita con menos antelación de la que fija el permiso
 * pide la aprobación del doctor, y el reintento lleva `X-Approval-Id` (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('AgendaActionRunner: desafíos de acceso', () => {
  const marcos = buscarUsuario('marcos')!;
  let runner: AgendaActionRunner;
  const hechas = (): string[] =>
    peticiones.map((p) => `${p.method} ${p.path.replace(/[0-9a-f-]{36}/g, ':id')} ${p.status}`);

  /** Una cita de Suárez en el norte (lo que cubre Marcos) que empieza dentro de la ventana, tal como la agenda se la muestra. */
  async function citaVista(desdeHoras: number, hastaHoras: number): Promise<AgendaEvent> {
    const fila = agendaDePartida().find((f) => {
      const horas = (new Date(f.start).getTime() - Date.now()) / 3_600_000;
      return (
        f.doctorId === SUAREZ.id &&
        horas > desdeHoras &&
        horas < hastaHoras &&
        negarSiNoPuede(marcos, f, 'schedule.cancel') === null
      );
    })!;
    ajustesDeAgenda.agregar({
      id: fila.id,
      status: 'CONFIRMED',
      patientLabel: 'Rosa Mamani · CI ***556',
      reasonLabel: 'Control de rutina',
    });
    const desde = new Date(Date.parse(fila.start) - 60_000).toISOString();
    const hasta = new Date(Date.parse(fila.start) + 60_000).toISOString();
    const agenda = await firstValueFrom(
      TestBed.inject(SupportAccessClient).getSupportAgenda({
        org: TENANT_HOSPITAL_PILOTO,
        from: desde,
        to: hasta,
      }),
    );
    const evento = mergeAgendas([
      { org: makeOrg(TENANT_HOSPITAL_PILOTO, 'Hospital Piloto Mantra', 0), agenda },
    ]).events.find(
      (e) =>
        e.start === fila.start && e.practitionerRoleAssignmentId === SUAREZ.practitionerProfileId,
    )!;
    expect(evento.bookingId).toBeDefined();
    return evento;
  }

  /** La aprobación que el doctor da cuando Marcos la pide: lo que el diálogo de desafío hace con él. */
  const aprobadaPorElDoctor = (): string => {
    const id = aprobaciones
      .todos()
      .find((a) => a.requesterUserId === marcos.id && a.atom === 'agenda.appointment.cancel')!.id;
    aprobaciones.actualizar(id, {
      status: 'APPROVED',
      approvedUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    return id;
  };

  beforeEach(() => {
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
    TestBed.configureTestingModule({
      providers: [AgendaActionRunner, ...provideGovernanceMock('marcos', { desafios: true })],
    });
    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
      'La mamá avisó que no puede venir.',
    );
    runner = TestBed.inject(AgendaActionRunner);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
  });

  it('cancelar con poca antelación: la API pide la aprobación del doctor, se le pide, y el reintento la lleva y libera el horario', async () => {
    const cita = await citaVista(0.2, 20);
    const desafios = resolverDesafiosEnPrueba({ approvalId: aprobadaPorElDoctor });
    const hecho = vi.fn();
    olvidarPeticiones();

    await runner.cancel(cita, hecho);
    await vi.waitFor(() => expect(hecho).toHaveBeenCalledTimes(1));

    expect(hechas()).toEqual([
      'POST /scheduling/bookings/:id/cancel 403',
      'POST /scheduling/bookings/:id/cancel 200',
    ]);
    expect(peticiones[0]!.approvalId).toBeUndefined();
    expect(peticiones[1]!.approvalId).toBe(
      aprobaciones.todos().find((a) => a.status === 'CONSUMED')!.id,
    );
    expect(desafios.preguntados).toEqual([
      expect.objectContaining({
        kind: 'APPROVAL',
        approverKind: 'DOCTOR',
        atom: 'agenda.appointment.cancel',
      }),
    ]);
    // La aprobación se pide **de esta cita**: el permiso, el doctor, el lugar, el servicio y la hora.
    expect(desafios.opciones[0]).toMatchObject({
      reasonField: 'reasonText',
      approval: {
        tenantId: TENANT_HOSPITAL_PILOTO,
        atom: 'agenda.appointment.cancel',
        practitionerRoleAssignmentId: cita.roleAssignmentId,
        careSpaceId: cita.careSpaceId,
        appointmentStartAt: cita.start,
      },
    });
    expect(ajustesDeAgenda.get(cita.bookingId!)?.status).toBe('FREE');
    expect(runner.announcement()).toContain('Cita cancelada');
    expect(runner.failure()).toBeNull();
  });

  it('si la persona cierra el diálogo, no se cancela nada y no es un error', async () => {
    const cita = await citaVista(0.2, 20);
    vi.spyOn(TestBed.inject(AccessChallengeService), 'resolve').mockReturnValue(
      throwError(() => new AccessChallengeCancelledError()),
    );
    const hecho = vi.fn();
    olvidarPeticiones();

    await runner.cancel(cita, hecho);
    await vi.waitFor(() => expect(runner.busy()).toBe(false));

    expect(hechas()).toEqual(['POST /scheduling/bookings/:id/cancel 403']);
    expect(hecho).not.toHaveBeenCalled();
    expect(runner.failure()).toBeNull();
    expect(runner.announcement()).toContain('No se hizo ningún cambio');
    expect(ajustesDeAgenda.get(cita.bookingId!)?.status).toBe('CONFIRMED');
  });

  it('con antelación suficiente no hay desafío: un solo paso', async () => {
    const cita = await citaVista(30, 24 * 8);
    const desafios = resolverDesafiosEnPrueba();
    const hecho = vi.fn();
    olvidarPeticiones();

    await runner.cancel(cita, hecho);
    await vi.waitFor(() => expect(hecho).toHaveBeenCalledTimes(1));

    expect(hechas()).toEqual(['POST /scheduling/bookings/:id/cancel 200']);
    expect(desafios.preguntados).toEqual([]);
  });

  it('un rechazo por permiso queda dicho y ofrece «¿Por qué no puedo?» sobre esa misma acción y esa misma cita', async () => {
    const cita = await citaVista(30, 24 * 8);
    // Marcos puede cancelar; «confirmar» no está en su paquete.
    olvidarPeticiones();

    runner.confirm(cita, vi.fn());
    await vi.waitFor(() => expect(runner.busy()).toBe(false));

    expect(runner.failure()).toBe('Su vínculo de apoyo no le permite esta acción.');
    expect(runner.explainRequest()).toMatchObject({
      tenantId: TENANT_HOSPITAL_PILOTO,
      action: 'agenda.appointment.confirm',
      practitionerRoleAssignmentId: cita.roleAssignmentId,
      careSpaceId: cita.careSpaceId,
      appointmentStartAt: cita.start,
    });
  });
});
