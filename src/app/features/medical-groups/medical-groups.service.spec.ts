import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionStore } from '../../core/auth/session.store';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { COLLEAGUE, group, listItem, ME, member, tokenFor } from './medical-groups.testing';
import { MedicalGroupsService } from './medical-groups.service';

/** Cuerpo de error con la forma del contrato de la API. */
const apiError = (code: string, message = 'x', correlationId?: string) => ({
  code,
  message,
  timestamp: '2026-10-24T10:00:00.000Z',
  path: '/medical-groups',
  ...(correlationId === undefined ? {} : { correlationId }),
});

describe('MedicalGroupsService', () => {
  let service: MedicalGroupsService;
  let http: HttpTestingController;

  const profiles = {
    getPatient: vi.fn(),
    getPractitionerProfile: vi.fn(),
    searchPatients: vi.fn(),
    listPractitioners: vi.fn(),
  };
  const catalog = { listPractices: vi.fn(), search: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    profiles.getPatient.mockReturnValue(of({ displayName: 'Ana Paz', patientCode: 'P-1' }));
    profiles.getPractitionerProfile.mockImplementation((id: string) =>
      of({ displayName: id === ME ? 'Dra. Yo' : 'Dr. Colega', practitionerCode: 'D-1' }),
    );
    catalog.listPractices.mockReturnValue(of([{ id: 'pr-1', code: 'X', name: 'Práctica' }]));
    catalog.search.mockReturnValue(
      of({ items: [{ id: 'svc-1', name: 'Artroscopia' }], count: 1, limit: 100, nextCursor: null }),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfilesClient, useValue: profiles },
        { provide: ServicesCatalogClient, useValue: catalog },
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: tokenFor({ sub: 'u-1', sid: 's-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: ME }),
      refreshToken: 'r-1',
    });
    service = TestBed.inject(MedicalGroupsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const listUrl = (tab: string) => (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === '/medical-groups' && r.params.get('tab') === tab;

  describe('listado', () => {
    it('S2 mientras carga y S-ready con las filas y el cursor cuando llega', () => {
      service.loadList('historico');
      expect(service.listing().status).toBe('loading');

      http.expectOne(listUrl('historico')).flush({ items: [listItem()], nextCursor: 'sig' });

      const state = service.listing();
      expect(state.status).toBe('ready');
      if (state.status === 'ready') {
        expect(state.data.items).toHaveLength(1);
        expect(state.data.nextCursor).toBe('sig');
      }
      expect(service.tab()).toBe('historico');
    });

    it('resuelve el nombre del servicio, sin pedir uno por uno cada fila repetida', () => {
      service.loadList('historico');
      http
        .expectOne(listUrl('historico'))
        .flush({ items: [listItem({ id: 'a' }), listItem({ id: 'b' })], nextCursor: null });

      expect(service.labelOf('svc-1', 'Servicio del catálogo')).toBe('Artroscopia');
      expect(catalog.listPractices).toHaveBeenCalledTimes(1);
    });

    it('S3: un listado vacío ofrece crear un grupo y explica la pestaña', () => {
      service.loadList('recibidas');
      http.expectOne(listUrl('recibidas')).flush({ items: [], nextCursor: null });

      const state = service.listing();
      expect(state.status).toBe('empty');
      if (state.status === 'empty') {
        expect(state.nextAction.route).toBe('/schedule/medical-groups/new');
        expect(state.message).toContain('invitaciones');
      }
    });

    it('S9: un error del servidor trae el ID de la petición', () => {
      service.loadList('historico');
      http
        .expectOne(listUrl('historico'))
        .flush(apiError('INTERNAL', 'boom', 'req-77'), { status: 500, statusText: 'x' });

      const state = service.listing();
      expect(state.status).toBe('error');
      if (state.status === 'error') {
        expect(state.requestId).toBe('req-77');
      }
    });

    it('S8: sin conexión se dice sin conexión', () => {
      service.loadList('historico');
      http.expectOne(listUrl('historico')).error(new ProgressEvent('error'), { status: 0 });

      expect(service.listing().status).toBe('offline');
    });

    it('S7: si una recarga falla con datos a la vista, los conserva y marca su antigüedad', () => {
      service.loadList('historico');
      http.expectOne(listUrl('historico')).flush({ items: [listItem()], nextCursor: null });

      service.loadList('historico');
      http.expectOne(listUrl('historico')).error(new ProgressEvent('error'), { status: 0 });

      const state = service.listing();
      expect(state.status).toBe('stale');
      if (state.status === 'stale') {
        expect(state.data.items).toHaveLength(1);
        expect(state.asOf).toBeInstanceOf(Date);
      }
    });

    it('al cambiar de pestaña no muestra las filas de la anterior', () => {
      service.loadList('historico');
      http.expectOne(listUrl('historico')).flush({ items: [listItem()], nextCursor: null });

      service.loadList('enviadas');

      expect(service.listing().status).toBe('loading');
      http.expectOne(listUrl('enviadas')).flush({ items: [], nextCursor: null });
    });

    it('«ver más» pide con el cursor y agrega al final', () => {
      service.loadList('historico');
      http.expectOne(listUrl('historico')).flush({ items: [listItem({ id: 'a' })], nextCursor: 'c1' });

      service.loadMore();
      const req = http.expectOne((r) => r.url === '/medical-groups' && r.params.get('cursor') === 'c1');
      req.flush({ items: [listItem({ id: 'b' })], nextCursor: null });

      const state = service.listing();
      if (state.status !== 'ready') throw new Error('se esperaba ready');
      expect(state.data.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(state.data.nextCursor).toBeNull();
      expect(service.loadingMore()).toBe(false);
    });

    it('«ver más» sin cursor no pide nada', () => {
      service.loadList('historico');
      http.expectOne(listUrl('historico')).flush({ items: [listItem()], nextCursor: null });

      service.loadMore();

      http.expectNone((r) => r.url === '/medical-groups');
    });
  });

  describe('ficha', () => {
    it('carga la ficha y resuelve paciente, profesionales y diagnóstico', () => {
      service.loadDetail('g-1');
      expect(service.detail().status).toBe('loading');

      http
        .expectOne('/medical-groups/g-1')
        .flush(group({ patientProfileId: 'pat-1', conditionId: 'c-1' }));
      http
        .expectOne('/medical-groups/patients/pat-1/conditions')
        .flush([{ id: 'c-1', code: 'I10', display: 'Hipertensión', isMostRecent: true }]);

      expect(service.detail().status).toBe('ready');
      expect(service.labelOf('pat-1', 'Paciente')).toBe('Ana Paz');
      expect(service.labelOf(COLLEAGUE, 'Profesional')).toBe('Dr. Colega');
      expect(service.labelOf('c-1', 'Diagnóstico')).toBe('I10 · Hipertensión');
    });

    it('S6: un 404 no transporta ningún dato del recurso', () => {
      service.loadDetail('g-x');
      http
        .expectOne('/medical-groups/g-x')
        .flush(apiError('NOT_FOUND'), { status: 404, statusText: 'x' });

      expect(service.detail()).toEqual({ status: 'not-found' });
    });

    it('S5: un 403 es prohibido', () => {
      service.loadDetail('g-1');
      http
        .expectOne('/medical-groups/g-1')
        .flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'x' });

      expect(service.detail().status).toBe('forbidden');
    });

    it('si un nombre no llega, la ficha sigue en pie con el rótulo genérico', () => {
      profiles.getPractitionerProfile.mockReturnValue(throwError(() => new Error('x')));
      service.loadDetail('g-1');
      http.expectOne('/medical-groups/g-1').flush(group());

      expect(service.detail().status).toBe('ready');
      expect(service.labelOf(COLLEAGUE, 'Profesional invitado')).toBe('Profesional invitado');
    });
  });

  describe('escrituras', () => {
    it('responder una invitación reemplaza la ficha abierta con la que devuelve la API', () => {
      service.loadDetail('g-1');
      http.expectOne('/medical-groups/g-1').flush(group());

      let result: string | undefined;
      service
        .respondToInvitation('g-1', member(), 'ACCEPTED')
        .subscribe((g) => (result = g.status));
      expect(service.saving()).toBe(true);

      const req = http.expectOne('/medical-groups/g-1/members/m-1/respond');
      expect(req.request.body).toEqual({ decision: 'ACCEPTED' });
      req.flush(group({ status: 'SCHEDULED' }));

      expect(result).toBe('SCHEDULED');
      expect(service.saving()).toBe(false);
      const state = service.detail();
      expect(state.status === 'ready' && state.data.status).toBe('SCHEDULED');
    });

    it('un rechazo de la API queda en writeError, no emite y no toca la ficha', () => {
      service.loadDetail('g-1');
      http.expectOne('/medical-groups/g-1').flush(group());

      const emitted = vi.fn();
      service.requestReschedule('g-1', '2099-11-06T10:00:00.000Z').subscribe(emitted);
      http
        .expectOne('/medical-groups/g-1/reschedule-requests')
        .flush(apiError('PRECONDITION_FAILED', 'Sólo se puede solicitar cambio sobre una cita programada'), {
          status: 422,
          statusText: 'x',
        });

      expect(emitted).not.toHaveBeenCalled();
      expect(service.saving()).toBe(false);
      const error = service.writeError();
      expect(error?.status).toBe('validation');
      if (error?.status === 'validation') {
        expect(error.issues[0]?.message).toContain('cita programada');
      }
      expect(service.detail().status).toBe('ready');
    });

    it('la escritura siguiente limpia el fallo anterior', () => {
      service.create({ serviceCatalogId: 's', scheduledAt: 'x', locationText: 'l', members: [] }).subscribe();
      http.expectOne('/medical-groups').flush(apiError('INTERNAL', 'x', 'r-1'), { status: 500, statusText: 'x' });
      expect(service.writeError()?.status).toBe('error');

      service.saveExerciseNotes('g-1', 'ok').subscribe();
      expect(service.writeError()).toBeNull();
      http.expectOne('/medical-groups/g-1/exercise-notes').flush(group());
    });

    it('crear devuelve la ficha creada', () => {
      let id: string | undefined;
      service
        .create({ serviceCatalogId: 'svc-1', scheduledAt: '2099-01-01T00:00:00.000Z', locationText: 'Sala', members: [] })
        .subscribe((g) => (id = g.id));

      const req = http.expectOne('/medical-groups');
      expect(req.request.method).toBe('POST');
      req.flush(group({ id: 'nuevo' }));

      expect(id).toBe('nuevo');
    });
  });

  describe('diagnósticos y directorio', () => {
    it('el paciente sin diagnósticos da un vacío con salida', () => {
      service.loadConditions('pat-1');
      http.expectOne('/medical-groups/patients/pat-1/conditions').flush([]);

      expect(service.conditions()?.status).toBe('empty');
    });

    it('quitar al paciente borra el selector', () => {
      service.loadConditions('pat-1');
      http.expectOne('/medical-groups/patients/pat-1/conditions').flush([]);
      service.loadConditions(null);

      expect(service.conditions()).toBeNull();
    });

    it('el directorio no ofrece a quien crea el grupo ni repite a nadie', () => {
      profiles.listPractitioners.mockReturnValue(
        of({
          items: [
            { profileId: ME, practitionerCode: 'A', displayName: 'Yo' },
            { profileId: COLLEAGUE, practitionerCode: 'B', displayName: 'Zeta', professionalTitle: 'Anestesiólogo' },
            { profileId: COLLEAGUE, practitionerCode: 'B', displayName: 'Zeta' },
            { profileId: 'pr-3', practitionerCode: 'C', displayName: 'Alfa' },
          ],
          nextCursor: null,
        }),
      );

      service.loadDirectory();

      const state = service.directory();
      if (state.status !== 'ready') throw new Error('se esperaba ready');
      expect(state.data.map((p) => p.name)).toEqual(['Alfa', 'Zeta']);
      expect(state.data[1]?.title).toBe('Anestesiólogo');
    });

    it('recorre las páginas del directorio hasta agotarlas', () => {
      profiles.listPractitioners
        .mockReturnValueOnce(of({ items: [{ profileId: 'a', practitionerCode: 'A' }], nextCursor: 'c2' }))
        .mockReturnValueOnce(of({ items: [{ profileId: 'b', practitionerCode: 'B' }], nextCursor: null }));

      service.loadDirectory();

      const state = service.directory();
      if (state.status !== 'ready') throw new Error('se esperaba ready');
      expect(state.data.map((p) => p.profileId)).toEqual(['a', 'b']);
      expect(profiles.listPractitioners).toHaveBeenLastCalledWith({ limit: 50, cursor: 'c2' });
    });
  });

  it('myProfileId sale del claim `hpid` de la sesión', () => {
    expect(service.myProfileId()).toBe(ME);
  });
});
