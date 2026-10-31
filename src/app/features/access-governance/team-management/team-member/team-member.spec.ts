import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import { TeamAdminClient } from '../../../../core/data-access/access-governance/team-admin.client';
import { aprobaciones, GENTE } from '../../../../core/mock/fixtures/support-hospital-governance';
import { permisos, vinculos } from '../../../../core/mock/fixtures/support-hospital';
import { uuid } from '../../../../core/mock/mock-store';
import {
  abrirElSimulador,
  escribirEn,
  esperarHasta,
  marcar,
  porId,
  textoDe,
  tocar,
} from '../../../../../testing/gobierno-simulador';
import { chooseSelectOption, selectOptionLabels } from '../../../../../testing/select';
import { TeamMember } from './team-member';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const ECO = uuid('hp-svc-ecografia');
const OTHER = uuid('hp-svc-otro');
const GRANT_IN = uuid('b6e-grant-in');
const GRANT_OUT = uuid('b6e-grant-out');

describe('TeamMember', () => {
  const sim = abrirElSimulador('sofia');
  let fixture: ComponentFixture<TeamMember>;
  let memberId = GENTE.lucia.engagementId;

  /** Lucía con un permiso en Ecografía y otro afuera (otra función que la jefa no ve). */
  const sembrar = (conOtraFuncion = true): void => {
    for (const p of permisos.filtrar((x) => x.engagementId === memberId))
      permisos.actualizar(p.id, { status: 'REVOKED' });
    permisos.agregar({
      id: GRANT_IN,
      engagementId: memberId,
      targetKind: 'SERVICE',
      healthcareServiceId: ECO,
      expansionMode: 'DYNAMIC',
      actions: [],
      atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'],
      status: 'ACTIVE',
    });
    if (conOtraFuncion)
      permisos.agregar({
        id: GRANT_OUT,
        engagementId: memberId,
        targetKind: 'SERVICE',
        healthcareServiceId: OTHER,
        expansionMode: 'DYNAMIC',
        actions: [],
        atoms: ['billing.invoice.view'],
        status: 'ACTIVE',
      });
  };
  let configured = false;
  const configurar = (): void => {
    if (configured) return;
    configured = true;
    TestBed.configureTestingModule({
      providers: [
        ...sim.providers,
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => memberId } } } },
      ],
    });
    sim.iniciarSesion();
  };
  const abrir = async (
    esperar: () => boolean = () => porId('member-status') !== null,
  ): Promise<void> => {
    configurar();
    fixture = TestBed.createComponent(TeamMember);
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
  const abrirCategoria = async (nombre: string): Promise<void> => {
    const boton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.accordion-panel__trigger'),
    ).find((b) => b.textContent!.includes(nombre))!;
    boton.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    configured = false;
    sim.reiniciar();
    memberId = GENTE.lucia.engagementId;
    sim.conPasoExtra();
    configurar();
  });
  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('muestra solo los permisos dentro de su alcance y cuenta las otras funciones sin detallarlas', async () => {
    sembrar();
    await abrir();
    expect(document.body.querySelector('h1')!.textContent).toContain('Lucía Paz');
    expect(textoDe('member-other')).toContain('Otras funciones de esta persona: 1');
    expect(porId(`grant-${GRANT_IN}`)).not.toBeNull();
    expect(porId(`grant-${GRANT_OUT}`)).toBeNull();
    expect(textoDe(`grant-${GRANT_IN}`)).toContain('Servicio · Ecografía');
    expect(textoDe(`grant-atoms-${GRANT_IN}`)).toContain(
      'Ver la agenda (horarios y estado de las citas)',
    );
    expect(document.body.textContent).not.toContain('invoice');
  });

  it('otorga un permiso dentro de su techo de punta a punta: lo fuera del techo está deshabilitado con su explicación, se simula, se guarda y se ve', async () => {
    sembrar();
    const simulate = vi.spyOn(TestBed.inject(AccessExplainClient), 'simulate');
    const create = vi.spyOn(TestBed.inject(TeamAdminClient), 'createGrant');
    await abrir();
    await tocar(fixture, 'member-add-grant');
    expect(await selectOptionLabels(fixture, porId('member-grant-target')!)).toEqual([
      'Servicio · Ecografía',
    ]);

    await abrirCategoria('Facturación y caja');
    const cobrar = porId('member-grant-atom-billing.payment.collect')!;
    expect(cobrar.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
    expect(cobrar.textContent).toContain('Solo el administrador de seguridad puede dar esto.');

    await chooseSelectOption(fixture, porId('member-grant-target')!, 'Servicio · Ecografía');
    await abrirCategoria('Agenda');
    await marcar(fixture, 'member-grant-atom-agenda.appointment.reschedule', true);
    expect(porId('member-save')!.getAttribute('aria-disabled')).toBe('true');
    await tocar(fixture, 'member-simulate');
    await esperarHasta(fixture, () => porId('member-preview') !== null);
    expect(simulate.mock.calls[0]![0]).toMatchObject({
      engagementId: memberId,
      draft: { mode: 'PATCH' },
    });
    expect(textoDe('member-preview-valid')).toContain('El cambio es válido');

    await tocar(fixture, 'member-save');
    await esperarHasta(fixture, () => textoDe('member-notice').includes('tiene un permiso nuevo'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1]).toMatchObject({
      targetKind: 'SERVICE',
      healthcareServiceId: ECO,
      actions: ['agenda.appointment.reschedule'],
      effect: 'ALLOW',
      expansionMode: 'DYNAMIC',
    });
    expect(create.mock.calls[0]![1].simulationToken).toMatch(/^sim_/);
    // La recarga trae lo guardado: hay un permiso nuevo en su lista.
    expect(
      permisos.filtrar(
        (p) =>
          p.engagementId === memberId &&
          p.status === 'ACTIVE' &&
          (p.atoms ?? []).includes('agenda.appointment.reschedule'),
      ),
    ).toHaveLength(1);
    await esperarHasta(
      fixture,
      () => document.body.querySelectorAll('[data-testid^="grant-atoms-"]').length === 2,
    );
    expect(porId('grant-editor')).toBeNull();
  });

  it('el 403 ADMIN_CEILING_EXCEEDED de la API se explica en lenguaje simple y no cambia nada', async () => {
    sembrar();
    await abrir();
    await tocar(fixture, 'member-add-grant');
    await chooseSelectOption(fixture, porId('member-grant-target')!, 'Servicio · Ecografía');
    await abrirCategoria('Agenda');
    await marcar(fixture, 'member-grant-atom-agenda.appointment.reschedule', true);
    // Una vigencia de más de 180 días pasa de su techo: el aviso lo dice antes y la API lo confirma al guardar.
    await escribirEn(fixture, 'member-grant-valid-to', '2099-01-01');
    expect(document.body.textContent).toContain('Como máximo hasta el');
    await tocar(fixture, 'member-simulate');
    await esperarHasta(fixture, () => porId('member-preview') !== null);
    await tocar(fixture, 'member-save');
    await esperarHasta(fixture, () => porId('member-failure') !== null);
    expect(porId('member-failure')!.getAttribute('data-reason')).toBe('ADMIN_CEILING_EXCEEDED');
    expect(textoDe('member-failure')).toContain('Eso pasa de lo que usted puede dar');
    expect(textoDe('member-failure')).toContain(
      'Eso excede lo que usted puede dar. Pídaselo al administrador de seguridad.',
    );
    expect(textoDe('member-failure')).toContain('no hay una aprobación que lo salte');
    expect(
      permisos.filtrar((p) => p.engagementId === memberId && p.status === 'ACTIVE'),
    ).toHaveLength(2);
  });

  it('cambia un permiso (el objetivo queda fijo) y lo quita con una confirmación, y la lista muestra lo guardado', async () => {
    sembrar();
    const change = vi.spyOn(TestBed.inject(TeamAdminClient), 'changeGrant');
    await abrir();
    await tocar(fixture, `grant-edit-${GRANT_IN}`);
    expect(textoDe('member-grant-target')).toBe('Servicio · Ecografía');
    expect(
      porId('member-grant-atom-agenda.appointment.cancel')!.querySelector<HTMLInputElement>(
        'input',
      )!.checked,
    ).toBe(true);
    await marcar(fixture, 'member-grant-atom-agenda.appointment.cancel', false);
    await tocar(fixture, 'member-simulate');
    await esperarHasta(fixture, () => porId('member-preview') !== null);
    await tocar(fixture, 'member-save');
    await esperarHasta(fixture, () => textoDe('member-notice').includes('quedó cambiado'));
    expect(change).toHaveBeenCalledWith(
      memberId,
      expect.objectContaining({ grantId: GRANT_IN, actions: ['agenda.appointment.view'] }),
    );
    expect(permisos.get(GRANT_IN)!.atoms).toEqual(['agenda.appointment.view']);
    await esperarHasta(
      fixture,
      () => textoDe(`grant-atoms-${GRANT_IN}`) === 'Ver la agenda (horarios y estado de las citas)',
    );

    await tocar(fixture, `grant-remove-${GRANT_IN}`);
    expect(change).toHaveBeenCalledTimes(1);
    await tocar(fixture, `grant-remove-cancel-${GRANT_IN}`);
    expect(porId(`grant-remove-${GRANT_IN}`)).not.toBeNull();
    await tocar(fixture, `grant-remove-${GRANT_IN}`);
    await tocar(fixture, `grant-remove-confirm-${GRANT_IN}`);
    // Era su último permiso dentro de su alcance: la persona sale de su equipo y la pantalla lo dice (S3 con próxima acción).
    await esperarHasta(fixture, () =>
      document.body.textContent!.includes('esta persona salió de su equipo'),
    );
    expect(change).toHaveBeenLastCalledWith(memberId, { grantId: GRANT_IN, revoke: true });
    expect(permisos.get(GRANT_IN)!.status).toBe('REVOKED');
    expect(permisos.get(GRANT_OUT)!.status).toBe('ACTIVE');
    expect(document.body.querySelector('a[href="/administration/team-management"]')).not.toBeNull();
  });

  it('suspender a quien también trabaja fuera de su alcance es un 403 ADMIN_SCOPE_EXCEEDED: se explica y se propone quitarle solo lo suyo', async () => {
    sembrar();
    await abrir();
    await pestana('Vínculo y baja');
    expect(textoDe('account-scope-warning')).toContain('Tiene 1 función en otros lugares');
    await tocar(fixture, 'suspend-submit');
    await esperarHasta(fixture, () => porId('account-failure') !== null);
    expect(textoDe('account-failure')).toContain('Fuera de lo que usted administra');
    expect(textoDe('account-failure')).toContain(
      'Esa persona o ese permiso está fuera de lo que usted administra.',
    );
    expect(textoDe('account-failure')).toContain('«Quitar»');
    expect(vinculos.get(memberId)!.status).toBe('ACTIVE');
  });

  it('recertifica, suspende en el acto y pide la reactivación con cuatro ojos a quien está solo dentro de su alcance', async () => {
    sembrar(false);
    await abrir();
    await pestana('Vínculo y baja');
    expect(porId('account-scope-warning')).toBeNull();

    await tocar(fixture, 'recertify-submit');
    await esperarHasta(fixture, () => textoDe('account-notice').includes('sigue trabajando aquí'));
    expect(vinculos.get(memberId)!.lastConfirmedBy).toBe('ORGANIZATION');

    await chooseSelectOption(fixture, porId('suspend-reason-code')!, 'Licencia o ausencia');
    await tocar(fixture, 'suspend-submit');
    await esperarHasta(fixture, () => porId('reactivate-form') !== null);
    expect(vinculos.get(memberId)!.status).toBe('SUSPENDED');
    expect(textoDe('member-status')).toBe('Suspendido');
    expect(porId('suspend-form')).toBeNull();

    await tocar(fixture, 'reactivate-submit');
    expect(document.body.textContent).toContain('Escriba al menos 5 caracteres');
    await escribirEn(fixture, 'reactivate-reason', 'Volvió de su licencia');
    await tocar(fixture, 'reactivate-submit');
    await esperarHasta(fixture, () => porId('reactivate-result') !== null);
    expect(textoDe('reactivate-result')).toContain('Otra persona debe aprobarla');
    expect(vinculos.get(memberId)!.status).toBe('SUSPENDED');
    expect(
      aprobaciones.filtrar((a) => a.kind === 'REACTIVATION' && a.status === 'PENDING'),
    ).toHaveLength(1);
  });

  it('da de baja con traspaso a quien está solo dentro de su alcance: el acceso termina ahora y los permisos quedan revocados', async () => {
    sembrar(false);
    const offboard = vi.spyOn(TestBed.inject(TeamAdminClient), 'offboard');
    await abrir();
    await pestana('Vínculo y baja');
    expect(textoDe('offboard-form')).toContain('No tiene trabajo en las manos');
    await tocar(fixture, 'offboard-confirm');
    expect(offboard).not.toHaveBeenCalled();
    await escribirEn(fixture, 'offboard-reason', 'Terminó su contrato');
    await tocar(fixture, 'offboard-confirm');
    await esperarHasta(fixture, () => porId('offboard-result') !== null);
    expect(offboard).toHaveBeenCalledWith(memberId, {
      reason: 'Terminó su contrato',
      handover: {},
    });
    expect(vinculos.get(memberId)!.status).toBe('ENDED');
    expect(porId('offboard-back-link')!.getAttribute('href')).toBe(
      '/administration/team-management',
    );
    await esperarHasta(fixture, () => porId('account-ended') !== null);
    expect(porId('offboard-form')).toBeNull();
  });

  it('S6: una persona fuera de su alcance (o que no existe) se ve igual: no encontrada, sin pistas', async () => {
    memberId = uuid('persona-que-no-existe');
    await abrir(() => document.body.textContent!.includes('No encontramos lo que busca'));
    expect(document.body.querySelector('h1')!.textContent).toContain('Persona de mi equipo');
  });

  it('S9: un error inesperado trae el código de soporte', async () => {
    vi.spyOn(TestBed.inject(TeamAdminClient), 'getMember').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              statusCode: 500,
              code: 'INTERNAL',
              message: 'x',
              correlationId: 'req-909',
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    fixture = TestBed.createComponent(TeamMember);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(fixture, () => document.body.textContent!.includes('req-909'));
  });
});
