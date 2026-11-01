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
import { OrSchedule } from './or-schedule/or-schedule';
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
          { path: 'interventions/operating-rooms', component: OrSchedule },
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

  /*
   * H3: antes estas dos pruebas exigían que la web pintara S5 **sin preguntar**
   * (compuerta por rol global). Era autorización simulada y negaba a un jefe
   * de quirófano asignado por F5g. Ahora la web pide y el S5 sale del 403 de
   * la API; lo que se prueba es eso.
   */
  it('programar: no hay compuerta por rol; facturación pide las salas y ve S5 con el 403 de la API', async () => {
    await setup(facturacion());
    await open('/interventions/new', ScheduleCase);
    expect(root().textContent).not.toContain('Su rol no programa intervenciones');
    expect(root().textContent).toContain('Su rol no consulta los quirófanos de la sede.');
  });

  it('programar: la jefatura ve el formulario con las salas de la sede', async () => {
    await setup(jefe());
    await open('/interventions/new', ScheduleCase);
    expect(root().querySelector('[data-testid=schedule-case]')).not.toBeNull();
  });

  it('bloques: facturación pide la semana y ve S5 con el 403 de la API; la jefatura, los bloques', async () => {
    await setup(facturacion());
    await open('/interventions/blocks', OrBlocks);
    expect(root().querySelector('[data-testid=or-blocks]')).not.toBeNull();
    expect(root().textContent).toContain('Su rol no consulta los bloques de quirófano.');
    expect(root().querySelectorAll('[data-testid^=or-block-release-]')).toHaveLength(0);
  });

  it('bloques: el dueño se nombra con el catálogo (la API manda specialtyConceptId, sin rótulo)', async () => {
    await setup(jefe());
    await open('/interventions/blocks', OrBlocks);
    const owners = Array.from(root().querySelectorAll('.or-blocks__owner')).map((e) => e.textContent?.trim() ?? '');
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.some((o) => o.includes('Traumatología'))).toBe(true);
    expect(owners.some((o) => /undefined|[0-9a-f]{8}-/.test(o))).toBe(false);
  });

  it('agenda de quirófanos: una fila por sala del árbol de F1', async () => {
    await setup(jefe());
    await open('/interventions/operating-rooms', OrSchedule);
    const rows = Array.from(root().querySelectorAll('[data-testid=timeline-row]')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('QX-01 · Quirófano 1');
    expect(root().querySelector('[data-testid=or-schedule-as-of]')).not.toBeNull();
  });

  it('utilización: facturación la lee con sus KPI y la antigüedad del cálculo', async () => {
    await setup(facturacion());
    await open('/interventions/utilization', OrUtilizationPage);
    expect(root().textContent).toContain('Utilización de sala');
    expect(root().textContent).toContain('Utilización de bloque');
    // Sin `asOf` de la API, S7 usa la hora de la respuesta; los totales los suma el cliente.
    expect(root().querySelector('[data-testid=or-utilization-as-of]')?.textContent).toContain('dato de las');
    expect(root().querySelector('[data-testid=or-utilization-room-pct]')?.textContent).toMatch(/\d/);
  });

  /* ---- contra la forma literal de la API (sin los campos que pidió A-F4) ---- */

  describe('con la API de hoy (toSummary, sin roomEvents ni checklist)', () => {
    const SITE = { siteId: 's-1', practiceId: 'p-1', code: 'SL', name: 'San Lucas', timeZone: null, roles: [], globalRoles: [], actions: [], grants: [] };
    const ROOMS = [{ careSpace: { id: 'or-1', code: 'QX-01', name: 'Quirófano 1' }, resourceId: 'r', prepMinutes: 20, cleanupMinutes: 30, cell: {}, todayCases: 1, todayBlocks: 0 }];
    const SUMMARY = { id: 'c-1', caseNumber: 'CX-9', patientProfileId: 'p', primarySurgeonProfileId: 's', operatingRoomId: 'or-1', statusConceptId: 'st', scheduledStartAt: '2026-11-03T12:00:00.000Z', scheduledEndAt: '2026-11-03T14:00:00.000Z' };
    const PHASES = (done: boolean) => ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'].map((phase) => ({ phase, completedAt: done ? '2026-11-03T11:50:00.000Z' : null, items: [] }));

    /** Lo que la pantalla pidió, `MÉTODO ruta`. */
    const seen: string[] = [];

    /** Responde lo pendiente por URL; lo que no está en el mapa se responde vacío. */
    async function answer(routes: Record<string, unknown>): Promise<void> {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        for (const req of http.match(() => true)) {
          seen.push(`${req.request.method} ${req.request.url}`);
          const hit = Object.keys(routes).find((k) => req.request.urlWithParams.startsWith(k) && (k.includes('?') || !req.request.urlWithParams.slice(k.length).startsWith('/')));
          if (hit !== undefined) req.flush(routes[hit] as object);
          else if (!req.cancelled) req.flush([]);
        }
        harness.detectChanges();
      }
    }

    async function setupManual(): Promise<void> {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'interventions', component: Interventions }, { path: 'interventions/:caseId', component: CaseDetail }])],
      });
      const session = TestBed.inject(SessionStore);
      Object.defineProperty(session, 'roles', { value: signal(['PERIOP_NURSE']) });
      Object.defineProperty(session, 'activeTenantId', { value: signal(TENANT_HOSPITAL) });
      Object.defineProperty(session, 'practitionerProfileId', { value: signal('pp-1') });
      http = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create();
    }

    it('H2: la agenda resuelve operatingRoomId contra las salas de la sede', async () => {
      await setupManual();
      await harness.navigateByUrl('/interventions', Interventions);
      await answer({ '/practice/infrastructure-access/me': { userId: 'u', tenantId: 't', sites: [SITE] }, '/sites/s-1/operating-rooms': ROOMS, '/procedure-cases?': { items: [SUMMARY], total: 1 } });
      const room = root().querySelector('[data-testid=interventions-room]');
      expect(room?.textContent?.trim()).toBe('QX-01 · Quirófano 1');
      expect(root().textContent).not.toContain('Sin quirófano');
    });

    it('B1: sin checklist en la cabecera lo lee de su endpoint, y sus fases habilitan la anestesia', async () => {
      await setupManual();
      await harness.navigateByUrl('/interventions/c-1?tab=room', CaseDetail);
      await answer({
        '/practice/infrastructure-access/me': { userId: 'u', tenantId: 't', sites: [SITE] },
        '/sites/s-1/operating-rooms': ROOMS,
        '/procedure-cases/c-1/safety-checklists': { id: 'k-1', version: '2009', phases: PHASES(true) },
        '/procedure-cases/c-1': { case: SUMMARY, team: [], operativeSteps: [], findings: [], implants: [], operativeReports: [] },
      });
      // El check-list se leyó con el alta idempotente (POST), no se dio por inexistente.
      expect(seen).toContain('POST /procedure-cases/c-1/safety-checklists');
      // Sin tiempos informados, se dice y no se deriva el orden de una lista inventada.
      expect(root().querySelector('[data-testid=room-events-unreported]')).not.toBeNull();
      const anesthesia = root().querySelector<HTMLElement>('[data-testid=room-event-ANESTHESIA_START]')!;
      expect(anesthesia.getAttribute('aria-disabled')).not.toBe('true');
      // La sala sale de las salas de la sede, no de un campo que no vino.
      expect(root().textContent).toContain('QX-01 · Quirófano 1');
    });

    it('B1: con las fases sin completar, la incisión explica que falta la Pausa (dato leído, no supuesto)', async () => {
      await setupManual();
      await harness.navigateByUrl('/interventions/c-1?tab=room', CaseDetail);
      await answer({
        '/practice/infrastructure-access/me': { userId: 'u', tenantId: 't', sites: [SITE] },
        '/sites/s-1/operating-rooms': ROOMS,
        '/procedure-cases/c-1/safety-checklists': { id: 'k-1', version: '2009', phases: PHASES(false) },
        '/procedure-cases/c-1': { case: SUMMARY, team: [], operativeSteps: [], findings: [], implants: [], operativeReports: [] },
      });
      const incision = root().querySelector<HTMLElement>('[data-testid=room-event-INCISION]')!;
      expect(incision.getAttribute('aria-disabled')).toBe('true');
      expect(root().textContent).toContain('Pausa quirúrgica');
    });
  });
});
