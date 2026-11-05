import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TeamAdminClient } from '../../../core/data-access/access-governance/team-admin.client';
import { solicitudes } from '../../../core/mock/fixtures/support-hospital';
import { TENANT_HOSPITAL_PILOTO } from '../../../core/mock/mock-session';
import { iso, uuid } from '../../../core/mock/mock-store';
import {
  abrirElSimulador,
  escribirEn,
  esperarHasta,
  porId,
  textoDe,
  tocar,
} from '../../../../testing/gobierno-simulador';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { TeamManagement } from './team-management';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const REQUEST_ID = uuid('b6e-request-julia');
const ITEM_IN_SCOPE = uuid('b6e-item-eco');
const ITEM_OUT_OF_SCOPE = uuid('b6e-item-otro');

describe('TeamManagement', () => {
  const sim = abrirElSimulador('sofia');
  let fixture: ComponentFixture<TeamManagement>;

  const configurar = (): void => {
    TestBed.configureTestingModule({ providers: [...sim.providers, provideRouter([])] });
    sim.iniciarSesion();
  };
  const abrir = async (
    esperar: () => boolean = () => porId('team-banner') !== null,
  ): Promise<void> => {
    fixture = TestBed.createComponent(TeamManagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(fixture, esperar);
  };
  const pestana = async (nombre: string): Promise<void> => {
    const boton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((b) => b.textContent!.includes(nombre))!;
    boton.click();
    await esperarHasta(fixture, () => boton.getAttribute('aria-selected') === 'true');
  };
  const sembrarSolicitud = (): void => {
    solicitudes.agregar({
      id: REQUEST_ID,
      tenantId: TENANT_HOSPITAL_PILOTO,
      requesterUserId: uuid('user-julia-mamani'),
      requesterName: 'Julia Mamani',
      direction: 'REQUEST',
      roleTemplate: 'NURSING',
      message: 'Necesito ver la agenda de ecografía y la del laboratorio.',
      status: 'PENDING',
      expiresAt: iso(10),
      createdAt: iso(-1),
      items: [
        {
          id: ITEM_IN_SCOPE,
          targetKind: 'SERVICE',
          healthcareServiceId: uuid('hp-svc-ecografia'),
          proposedActions: ['schedule.view'],
          decision: 'PENDING',
        },
        {
          id: ITEM_OUT_OF_SCOPE,
          targetKind: 'SERVICE',
          healthcareServiceId: uuid('hp-svc-otro'),
          proposedActions: ['schedule.view'],
          decision: 'PENDING',
        },
      ],
    });
  };
  const segment = (itemId: string, value: string): HTMLElement =>
    document.body.querySelector<HTMLElement>(
      `[data-testid="decision-${itemId}"] [data-value="${value}"]`,
    )!;

  beforeEach(() => {
    TestBed.resetTestingModule();
    sim.reiniciar();
  });
  afterEach(() => {
    solicitudes.borrar(REQUEST_ID);
    fixture?.nativeElement.remove();
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('S1: mientras comprueba qué puede hacer la persona no pide ningún dato', async () => {
    configurar();
    const team = TestBed.inject(TeamAdminClient);
    vi.spyOn(team, 'getCapabilities').mockReturnValue(NEVER);
    const members = vi.spyOn(team, 'listMembers');
    await abrir(() => document.body.textContent!.includes('Verificando permisos'));
    expect(members).not.toHaveBeenCalled();
  });

  it('S5: sin permiso de administración lo dice, sin ofrecer una salida falsa', async () => {
    configurar();
    vi.spyOn(TestBed.inject(TeamAdminClient), 'getCapabilities').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              statusCode: 403,
              code: 'FORBIDDEN',
              message: 'No tiene permiso para esta operación.',
              correlationId: 'req-403',
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await abrir(() => document.body.textContent!.includes('No tiene acceso a esta sección'));
    expect(document.body.textContent).toContain('req-403');
  });

  it('muestra qué administra la jefa de servicio, qué puede dar y solo su población, con «otras funciones» sin detalle', async () => {
    configurar();
    await abrir(() => porId('team-banner') !== null && porId('team-table') !== null);
    expect(textoDe('team-scope')).toBe('Usted administra: Ecografía.');
    const techo = textoDe('team-ceiling');
    expect(techo).toContain('todo lo de agenda');
    expect(techo).toContain('todo lo de mensajería');
    expect(techo).toContain('Cada permiso vale hasta 180 días.');
    expect(document.body.querySelectorAll('[data-testid^="member-name-"]').length).toBeGreaterThan(
      0,
    );
    // Nadie ve su propia cuenta ni la de otro jefe fuera de su alcance.
    expect(document.body.textContent).not.toContain('Hospital Piloto Mantra');
  });

  it('decide por ítem lo que está dentro de su alcance: lo demás queda pendiente para el administrador de seguridad', async () => {
    sembrarSolicitud();
    configurar();
    const decide = vi.spyOn(TestBed.inject(TeamAdminClient), 'decideRequest');
    await abrir();
    await pestana('Solicitudes (1)');
    expect(textoDe(`request-${REQUEST_ID}`)).toContain('Julia Mamani');
    expect(porId(`item-${ITEM_IN_SCOPE}`)).not.toBeNull();
    expect(porId(`item-${ITEM_OUT_OF_SCOPE}`)).toBeNull();
    expect(textoDe(`request-other-${REQUEST_ID}`)).toContain(
      'Además hay 1 ítem fuera de lo que usted administra',
    );

    await tocar(fixture, `save-decision-${REQUEST_ID}`);
    expect(decide).not.toHaveBeenCalled();
    expect(textoDe(`problems-${REQUEST_ID}`)).toContain('Falta decidir');

    segment(ITEM_IN_SCOPE, 'REJECTED').click();
    await fixture.whenStable();
    fixture.detectChanges();
    await tocar(fixture, `save-decision-${REQUEST_ID}`);
    expect(textoDe(`problems-${REQUEST_ID}`)).toContain('Escriba el motivo del rechazo');
    await escribirEn(
      fixture,
      `reject-reason-${ITEM_IN_SCOPE}`,
      'Ese servicio ya tiene a su personal',
    );
    await tocar(fixture, `save-decision-${REQUEST_ID}`);
    await esperarHasta(fixture, () => textoDe('team-notice') !== '');

    expect(decide).toHaveBeenCalledWith(REQUEST_ID, {
      items: [
        {
          itemId: ITEM_IN_SCOPE,
          decision: 'REJECTED',
          comment: 'Ese servicio ya tiene a su personal',
        },
      ],
    });
    expect(textoDe('team-notice')).toContain(
      'Decidió 1 ítem de la solicitud de Julia Mamani. Quedan 1 pendientes para el administrador de seguridad',
    );
    // La recarga trae lo guardado: lo suyo ya no aparece y el ítem de afuera sigue pendiente.
    const guardada = solicitudes.get(REQUEST_ID)!;
    expect(guardada.items.find((i) => i.id === ITEM_IN_SCOPE)!.decision).toBe('REJECTED');
    expect(guardada.items.find((i) => i.id === ITEM_OUT_OF_SCOPE)!.decision).toBe('PENDING');
    await esperarHasta(fixture, () => document.body.textContent!.includes('Solicitudes (0)'));
    expect(guardada.status).toBe('PENDING');
  });

  it('aprueba todo lo suyo como se pidió con un solo gesto', async () => {
    sembrarSolicitud();
    configurar();
    const decide = vi.spyOn(TestBed.inject(TeamAdminClient), 'decideRequest');
    await abrir();
    await pestana('Solicitudes (1)');
    await tocar(fixture, `approve-all-${REQUEST_ID}`);
    await tocar(fixture, `save-decision-${REQUEST_ID}`);
    await esperarHasta(fixture, () => textoDe('team-notice') !== '');
    expect(decide.mock.calls[0]![1].items).toEqual([
      { itemId: ITEM_IN_SCOPE, decision: 'APPROVED' },
    ]);
    expect(solicitudes.get(REQUEST_ID)!.items.find((i) => i.id === ITEM_IN_SCOPE)!.decision).toBe(
      'APPROVED',
    );
  });

  it('invita solo con los roles de su techo y muestra el código para entregarlo', async () => {
    configurar();
    const invite = vi.spyOn(TestBed.inject(TeamAdminClient), 'invite');
    await abrir();
    await pestana('Invitar');
    expect(await selectOptionLabels(fixture, porId('invite-template')!)).toEqual([
      'Secretaria',
      'Asistente médico',
      'Enfermería',
      'Recepción',
      'Call center',
    ]);
    await chooseSelectOption(fixture, porId('invite-template')!, 'Enfermería');
    await escribirEn(fixture, 'invite-days', '14');
    await tocar(fixture, 'invite-submit');
    await esperarHasta(fixture, () => porId('invite-result') !== null);
    expect(invite).toHaveBeenCalledWith({
      kind: 'SUPPORT_STAFF',
      maxUses: 1,
      expiresInDays: 14,
      roleTemplate: 'NURSING',
    });
    expect(textoDe('invite-code')).toMatch(/\S{6,}/);
    expect(textoDe('invite-result')).toContain('Entréguele este código a la persona');
  });

  it('una invitación que pasa del techo se explica en lenguaje simple y sin ofrecer una aprobación que no existe', async () => {
    configurar();
    const error = new HttpErrorResponse({
      status: 403,
      error: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'x',
        reason: 'ADMIN_CEILING_EXCEEDED',
        details: { reason: 'ADMIN_CEILING_EXCEEDED' },
        timestamp: '',
        path: '/x',
      },
    });
    vi.spyOn(TestBed.inject(TeamAdminClient), 'invite').mockReturnValue(throwError(() => error));
    await abrir();
    await pestana('Invitar');
    await tocar(fixture, 'invite-submit');
    await esperarHasta(fixture, () => porId('invite-failure') !== null);
    expect(textoDe('invite-failure')).toContain('Eso pasa de lo que usted puede dar');
    expect(textoDe('invite-failure')).toContain(
      'Eso excede lo que usted puede dar. Pídaselo al administrador de seguridad.',
    );
  });

  it('S3: sin personas a su cargo explica por qué y ofrece invitar', async () => {
    configurar();
    vi.spyOn(TestBed.inject(TeamAdminClient), 'listMembers').mockReturnValue(
      (await import('rxjs')).of({ items: [], count: 0 }),
    );
    await abrir(() =>
      document.body.textContent!.includes('Todavía no hay personas en lo que usted administra.'),
    );
    expect(document.body.textContent).toContain('Invitar a alguien');
  });
});
