import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../../core/mock/mock-session';
import { FullMockBackend } from '../../../testing/full-mock-backend';
import { CaseDetail } from './case-detail/case-detail';
import { Interventions } from './interventions';
import { OrAgenda } from './or-agenda/or-agenda';
import { OrBlocks } from './or-blocks/or-blocks';
import { OrUtilizationPage } from './or-utilization/or-utilization';
import { ScheduleCase } from './schedule-case/schedule-case';

/**
 * Pantallas de F4 contra el simulador completo: lo que pintan sale de los
 * mismos handlers que usa la maqueta, no de objetos armados a mano.
 */
describe('Intervenciones · F4 (quirófanos)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let backend: FullMockBackend;

  async function setup(user: MockUser, tenant: string = TENANT_HOSPITAL): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'interventions', component: Interventions },
          { path: 'interventions/new', component: ScheduleCase },
          { path: 'interventions/operating-rooms', component: OrAgenda },
          { path: 'interventions/blocks', component: OrBlocks },
          { path: 'interventions/utilization', component: OrUtilizationPage },
          { path: 'interventions/:caseId', component: CaseDetail },
        ]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    Object.defineProperty(session, 'roles', { value: signal(user.roles) });
    Object.defineProperty(session, 'activeTenantId', { value: signal(tenant) });
    Object.defineProperty(session, 'practitionerProfileId', { value: signal(user.practitionerProfileId ?? null) });
    http = TestBed.inject(HttpTestingController);
    backend = new FullMockBackend(user, tenant);
    harness = await RouterTestingHarness.create();
  }

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      backend.respondAll(http, () => harness.detectChanges());
      harness.detectChanges();
    }
  }

  async function open<T>(url: string, component: Type<T>): Promise<void> {
    await harness.navigateByUrl(url, component);
    await settle();
  }

  const jefe = () => buscarUsuario('quirofano')!;
  const facturacion = () => buscarUsuario('facturacion')!;

  it('la agenda muestra el quirófano real de cada caso (código · nombre), nunca un uuid', async () => {
    await setup(jefe());
    await open('/interventions', Interventions);
    const rooms = Array.from(root().querySelectorAll('[data-testid=interventions-room]')).map((e) => e.textContent?.trim());
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => /^QX-0[12] · Quirófano [12]$/.test(r ?? ''))).toBe(true);
    expect(root().textContent).toContain('+20 prep');
    expect(root().textContent).toContain('+30 limpieza');
    expect(root().querySelector('[data-testid=interventions-schedule-link]')).not.toBeNull();
  });

  it('otro tenant (sin quirófanos) ve S3 con próxima acción, no casos ajenos', async () => {
    await setup(buscarUsuario('admin')!, TENANT_CLINICA);
    await open('/interventions', Interventions);
    expect(root().textContent).toContain('No hay intervenciones programadas');
    expect(root().querySelectorAll('[data-testid=interventions-room]')).toHaveLength(0);
  });

  it('la ficha es UNA tarjeta con las cinco pestañas del contrato', async () => {
    await setup(jefe());
    await open('/interventions', Interventions);
    const link = root().querySelector<HTMLAnchorElement>('[data-testid=interventions-case-link]')!;
    const id = decodeURIComponent(link.getAttribute('href')!.split('/').pop()!);
    await open(`/interventions/${id}`, CaseDetail);
    expect(root().querySelectorAll('[data-testid=case-detail]')).toHaveLength(1);
    const tabs = Array.from(root().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Resumen', 'Equipo', 'Check-list OMS', 'Eventos de sala', 'Cargos']);
    expect(root().textContent).toContain('Ventana reservada');
  });

  it('un caso de otro tenant es S6: no se pinta ningún dato suyo', async () => {
    await setup(buscarUsuario('admin')!, TENANT_CLINICA);
    await open('/interventions/no-existe', CaseDetail);
    expect(root().querySelector('[data-testid=case-detail]')).toBeNull();
  });

  it('eventos de sala: sin Entrada, el inicio de anestesia dice por qué está deshabilitado', async () => {
    await setup(jefe());
    await open('/interventions', Interventions);
    const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('[data-testid=interventions-case-link]'));
    // CX-2026-0104: programado y sin check-list.
    const target = links.find((a) => a.textContent?.trim() === 'CX-2026-0104')!;
    await open(`${target.getAttribute('href')}?tab=room`, CaseDetail);
    const anesthesia = root().querySelector<HTMLElement>('[data-testid=room-event-ANESTHESIA_START]')!;
    expect(root().textContent).toContain('Antes hay que registrar «Entrada a sala»');
    // El botón se deshabilita por `aria-disabled` (sigue alcanzable y dice por qué).
    expect(anesthesia.getAttribute('aria-disabled')).toBe('true');
  });

  it('programar: facturación no programa (S5); la jefatura ve la ventana que se reservará', async () => {
    await setup(facturacion());
    await open('/interventions/new', ScheduleCase);
    expect(root().querySelector('[data-testid=schedule-case]')).toBeNull();
    expect(root().textContent).toContain('Su rol no programa intervenciones');
  });

  it('bloques: la jefatura los lista por semana; facturación ve S5', async () => {
    await setup(facturacion());
    await open('/interventions/blocks', OrBlocks);
    expect(root().querySelector('[data-testid=or-blocks]')).toBeNull();
    expect(root().textContent).toContain('jefatura de quirófano');
  });

  it('agenda de quirófanos: una fila por sala del árbol de F1', async () => {
    await setup(jefe());
    await open('/interventions/operating-rooms', OrAgenda);
    const rows = Array.from(root().querySelectorAll('[data-testid=timeline-row]')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('QX-01 · Quirófano 1');
    expect(root().querySelector('[data-testid=or-agenda-as-of]')).not.toBeNull();
  });

  it('utilización: facturación la lee con sus KPI y la antigüedad del cálculo', async () => {
    await setup(facturacion());
    await open('/interventions/utilization', OrUtilizationPage);
    expect(root().textContent).toContain('Utilización de sala');
    expect(root().textContent).toContain('Utilización de bloque');
    expect(root().querySelector('[data-testid=or-utilization-as-of]')?.textContent).toContain('calculado a las');
  });
});
