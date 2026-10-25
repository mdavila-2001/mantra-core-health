import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { MedicalGroupDetail } from './medical-group-detail';
import {
  CATALOG_STUB,
  COLLEAGUE,
  group,
  ME,
  member,
  PROFILES_STUB,
  tokenFor,
} from './medical-groups.testing';

const BASE = '/schedule/medical-groups/g-1';

describe('MedicalGroupDetail', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  function start(hpid: string): void {
    TestBed.inject(SessionStore).start({
      accessToken: tokenFor({ sub: 'u-1', sid: 's-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid }),
      refreshToken: 'r-1',
    });
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'schedule/medical-groups/:groupId', component: MedicalGroupDetail }]),
        { provide: ProfilesClient, useValue: PROFILES_STUB },
        { provide: ServicesCatalogClient, useValue: CATALOG_STUB },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<HTMLElement> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  /** Abre la ficha como `hpid` y responde la lectura con `body`. */
  async function open(hpid: string, body: object, query = ''): Promise<HTMLElement> {
    start(hpid);
    await harness.navigateByUrl(BASE + query, MedicalGroupDetail);
    http.expectOne('/medical-groups/g-1').flush(body);
    return settle();
  }

  const click = (el: HTMLElement, testId: string): void => {
    const target = el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    expect(target, testId).not.toBeNull();
    target!.click();
  };

  it('S6: un grupo que no existe se dice sin mostrar nada de él', async () => {
    start(ME);
    await harness.navigateByUrl(BASE, MedicalGroupDetail);
    http
      .expectOne('/medical-groups/g-1')
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: '', path: '' }, { status: 404, statusText: 'x' });
    const el = await settle();

    expect(el.querySelector('app-card')).toBeNull();
    expect(el.textContent).not.toContain('Quirófano 2');
  });

  it('es UNA tarjeta con las cuatro pestañas', async () => {
    const el = await open(ME, group());

    expect(el.querySelectorAll('app-card')).toHaveLength(1);
    const tabs = Array.from(el.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Resumen', 'Equipo (2)', 'Horario', 'Notas del ejercicio']);
  });

  it('el resumen nombra al servicio, al lugar y los términos', async () => {
    const el = await open(ME, group({ notesText: 'En ayunas.' }));

    const text = el.textContent ?? '';
    expect(text).toContain('Artroscopia');
    expect(text).toContain('Quirófano 2');
    expect(text).toContain('Términos del servicio.');
    expect(text).toContain('En ayunas.');
    expect(el.querySelector('[data-testid="medical-group-status"]')?.textContent).toContain(
      'Esperando al equipo',
    );
  });

  it('`?pestana=equipo` abre el equipo, con el pago de cada cargo y el nombre resuelto', async () => {
    const el = await open(ME, group(), '?pestana=equipo');

    const equipo = el.querySelector('[data-testid="medical-group-tab-equipo"]');
    expect(equipo).not.toBeNull();
    expect(equipo?.textContent).toContain('Dr. Colega');
    expect(equipo?.textContent).toContain('Anestesiólogo');
    expect(equipo?.textContent).toContain('Pago acordado: 500.00');
    expect(equipo?.textContent).toContain('Sin responder');
  });

  describe('responder la invitación', () => {
    const invited = () =>
      group({
        requestingPractitionerId: COLLEAGUE,
        members: [
          member({ id: 'm-c', practitionerProfileId: COLLEAGUE, isCreator: true, invitationStatus: 'ACCEPTED', roleTitle: 'Responsable del grupo' }),
          member({ id: 'm-yo', practitionerProfileId: ME, roleTitle: 'Cardiólogo' }),
        ],
      });

    it('quien tiene el cargo pendiente ve aceptar y rechazar', async () => {
      const el = await open(ME, invited(), '?pestana=equipo');

      expect(el.querySelector('[data-testid="medical-group-respond"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="medical-group-accept"]')).not.toBeNull();
    });

    it('quien no es el invitado no ve la respuesta', async () => {
      const el = await open('otro', invited(), '?pestana=equipo');

      expect(el.querySelector('[data-testid="medical-group-respond"]')).toBeNull();
    });

    it('un grupo cerrado no ofrece responder', async () => {
      const el = await open(ME, { ...invited(), isClosed: true, status: 'CLOSED' }, '?pestana=equipo');

      expect(el.querySelector('[data-testid="medical-group-respond"]')).toBeNull();
    });

    it('aceptar manda `ACCEPTED` al cargo propio y muestra el grupo ya actualizado', async () => {
      const el = await open(ME, invited(), '?pestana=equipo');

      click(el, 'medical-group-accept');
      const req = http.expectOne('/medical-groups/g-1/members/m-yo/respond');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ decision: 'ACCEPTED' });
      req.flush({
        ...invited(),
        status: 'SCHEDULED',
        members: [
          member({ id: 'm-c', practitionerProfileId: COLLEAGUE, isCreator: true, invitationStatus: 'ACCEPTED' }),
          member({ id: 'm-yo', practitionerProfileId: ME, invitationStatus: 'ACCEPTED' }),
        ],
      });
      await settle();

      expect(el.querySelector('[data-testid="medical-group-respond"]')).toBeNull();
      expect(el.querySelector('[data-testid="medical-group-notice"]')?.textContent).toContain(
        'Aceptó su cargo',
      );
      expect(el.querySelector('[data-testid="medical-group-status"]')?.textContent).toContain('Programado');
    });

    it('rechazar pide confirmación antes de mandar nada', async () => {
      const el = await open(ME, invited(), '?pestana=equipo');

      click(el, 'medical-group-reject');
      harness.detectChanges();
      http.expectNone('/medical-groups/g-1/members/m-yo/respond');
      expect(el.textContent).toContain('¿Rechazar el cargo?');

      click(el, 'medical-group-reject-confirm');
      const req = http.expectOne('/medical-groups/g-1/members/m-yo/respond');
      expect(req.request.body).toEqual({ decision: 'REJECTED' });
      req.flush(invited());
    });

    it('si la API rechaza la respuesta, lo dice y deja las acciones a la vista', async () => {
      const el = await open(ME, invited(), '?pestana=equipo');

      click(el, 'medical-group-accept');
      http
        .expectOne('/medical-groups/g-1/members/m-yo/respond')
        .flush(
          { code: 'PRECONDITION_FAILED', message: 'Esta solicitud ya fue respondida', timestamp: '', path: '' },
          { status: 422, statusText: 'x' },
        );
      await settle();

      expect(el.querySelector('[data-testid="medical-group-error"]')?.textContent).toContain(
        'Esta solicitud ya fue respondida',
      );
      expect(el.querySelector('[data-testid="medical-group-accept"]')).not.toBeNull();
    });
  });

  describe('horario', () => {
    it('el creador de un grupo programado cambia la fecha y la API la aplica directo', async () => {
      const el = await open(ME, group({ status: 'SCHEDULED' }), '?pestana=horario');

      expect(el.querySelector('[data-testid="medical-group-propose"]')).not.toBeNull();
      expect(el.textContent).toContain('el cambio se aplica directo');
    });

    it('un grupo ya realizado no admite cambios de horario', async () => {
      const el = await open(ME, group({ status: 'SCHEDULED', isRealized: true }), '?pestana=horario');

      expect(el.querySelector('[data-testid="medical-group-propose"]')).toBeNull();
    });

    it('la propuesta de un integrante la resuelve sólo el creador', async () => {
      const pendiente = group({
        status: 'RESCHEDULE_PENDING',
        proposedRescheduleAt: '2099-11-07T10:00:00.000Z',
        proposedByPractitionerId: COLLEAGUE,
      });
      const creador = await open(ME, pendiente, '?pestana=horario');
      expect(creador.querySelector('[data-testid="medical-group-resolve"]')).not.toBeNull();

      click(creador, 'medical-group-reschedule-accept');
      const req = http.expectOne('/medical-groups/g-1/reschedule-requests/respond');
      expect(req.request.body).toEqual({ decision: 'ACCEPTED' });
      req.flush(group({ status: 'SCHEDULED', scheduledAt: '2099-11-07T10:00:00.000Z' }));
      await settle();
      expect(creador.querySelector('[data-testid="medical-group-resolve"]')).toBeNull();
    });

    it('un integrante que no creó el grupo ve la propuesta pero no puede resolverla', async () => {
      const el = await open(
        COLLEAGUE,
        group({
          status: 'RESCHEDULE_PENDING',
          proposedRescheduleAt: '2099-11-07T10:00:00.000Z',
          members: [
            member({ id: 'm-0', practitionerProfileId: ME, isCreator: true, invitationStatus: 'ACCEPTED' }),
            member({ invitationStatus: 'ACCEPTED' }),
          ],
        }),
        '?pestana=horario',
      );

      expect(el.textContent).toContain('Hay un cambio de horario propuesto');
      expect(el.querySelector('[data-testid="medical-group-resolve"]')).toBeNull();
    });
  });

  describe('notas del ejercicio', () => {
    const realized = () =>
      group({ status: 'SCHEDULED', isRealized: true, canEditExerciseNotes: true, exerciseNotesText: 'Previas.' });

    it('se editan cuando la ficha lo permite y viajan con PATCH', async () => {
      const el = await open(ME, realized(), '?pestana=notas');
      const area = el.querySelector<HTMLTextAreaElement>('[data-testid="medical-group-notes"] textarea');
      expect(area?.value).toBe('Previas.');

      area!.value = 'Sin complicaciones.';
      area!.dispatchEvent(new Event('input', { bubbles: true }));
      click(el, 'medical-group-notes-save');

      const req = http.expectOne('/medical-groups/g-1/exercise-notes');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ notesText: 'Sin complicaciones.' });
      req.flush({ ...realized(), exerciseNotesText: 'Sin complicaciones.' });
      await settle();
      expect(el.querySelector('[data-testid="medical-group-notice"]')?.textContent).toContain('guardadas');
    });

    it('antes de la cita dice que se cargan después', async () => {
      const el = await open(ME, group({ status: 'SCHEDULED' }), '?pestana=notas');

      expect(el.querySelector('[data-testid="medical-group-notes-empty"]')?.textContent).toContain(
        'después de la cita',
      );
      expect(el.querySelector('[data-testid="medical-group-notes-save"]')).toBeNull();
    });

    it('un expediente cerrado muestra las notas de sólo lectura y avisa que no admite cambios', async () => {
      const el = await open(
        ME,
        group({ status: 'CLOSED', isClosed: true, isRealized: true, exerciseNotesText: 'Historia final.' }),
        '?pestana=notas',
      );

      expect(el.querySelector('[data-testid="medical-group-notes-readonly"]')?.textContent).toContain(
        'Historia final.',
      );
      expect(el.querySelector('[data-testid="medical-group-notes-save"]')).toBeNull();
      expect(el.textContent).toContain('ya no admite cambios');
    });
  });
});
