import { provideHttpClient, type HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SupportAccessClient } from './support-access.client';
import type { SupportAgenda } from './support-agenda.types';
import type { SupportInvitationCreated } from './support-invite.types';

/**
 * Lo que fijan estas pruebas es el contrato con la API: verbo, ruta exacta y
 * el cuerpo o los parámetros que viajan. Las rutas son las de `CONTRATO.md`
 * (ronda «personal de apoyo»); las tres marcadas «propuesta» en el cliente se
 * prueban igual, porque la pantalla depende de ellas.
 */
describe('SupportAccessClient', () => {
  let client: SupportAccessClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(SupportAccessClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('persona de apoyo', () => {
    it('lee sus vínculos con GET /me/support-engagements ({ items, count, requests })', () => {
      client.listMyEngagements().subscribe();
      const req = http.expectOne('/me/support-engagements');
      expect(req.request.method).toBe('GET');
      req.flush({ items: [], count: 0, requests: [] });
    });

    it('declara que sigue trabajando aquí con POST …/confirm, sin cuerpo, y lee `reactivated`', () => {
      let r: { reactivated: boolean; status: string } | undefined;
      client.confirmMyEngagement('e-1').subscribe((x) => (r = x));
      const req = http.expectOne('/me/support-engagements/e-1/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({
        id: 'e-1',
        status: 'SUSPENDED',
        roleTemplateCode: 'SECRETARY',
        grants: [],
        reactivated: false,
      });
      expect(r).toMatchObject({ reactivated: false, status: 'SUSPENDED' });
    });

    it('pide acceso con POST /support-engagement-requests y los nombres del DTO de la API', () => {
      client
        .requestEngagement({
          tenantId: 't-1',
          roleTemplate: 'SECRETARY',
          parentEngagementId: 'e-1',
          items: [
            {
              targetKind: 'PRACTITIONER',
              practitionerRoleAssignmentId: 'd-1',
              proposedActions: ['schedule.view'],
            },
          ],
        })
        .subscribe();
      const req = http.expectOne('/support-engagement-requests');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        tenantId: 't-1',
        roleTemplateCode: 'SECRETARY',
        parentAssignmentId: 'e-1',
        items: [
          {
            targetKind: 'PRACTITIONER',
            practitionerRoleAssignmentId: 'd-1',
            actions: ['schedule.view'],
          },
        ],
      });
      req.flush({ id: 'r-1', roleTemplateCode: 'SECRETARY', parentAssignmentId: 'e-1', items: [] });
    });

    it('lo que la API devuelve con roleTemplateCode se lee como roleTemplate', () => {
      let leido: { roleTemplate: string; parentEngagementId?: string } | undefined;
      client
        .requestEngagement({ tenantId: 't', roleTemplate: 'NURSING', items: [] })
        .subscribe((r) => (leido = r));
      http
        .expectOne('/support-engagement-requests')
        .flush({ id: 'r', roleTemplateCode: 'NURSING', parentAssignmentId: 'e-7', items: [] });
      expect(leido).toMatchObject({ roleTemplate: 'NURSING', parentEngagementId: 'e-7' });
    });

    it('canjea un código con POST /affiliation-invitations/redeem', () => {
      // El código se manda tal cual: es base64url y distingue mayúsculas de minúsculas.
      client.redeemInvitation('aB3_x-9Q').subscribe();
      const req = http.expectOne('/affiliation-invitations/redeem');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ code: 'aB3_x-9Q' });
      req.flush({ kind: 'SUPPORT_STAFF', tenantId: 't', membershipId: 'm', engagementId: 'e' });
    });

    it('la agenda combinada manda organización, rango y los filtros como listas separadas por coma', () => {
      client
        .getSupportAgenda({
          org: 't-1',
          from: '2026-11-02T00:00:00Z',
          to: '2026-11-02T23:59:59Z',
          doctors: ['d-1', 'd-2'],
          services: ['s-1'],
          locations: ['l-1'],
        })
        .subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-agenda');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('tenantId')).toBe('t-1');
      expect(req.request.params.has('org')).toBe(false);
      expect(req.request.params.get('doctors')).toBe('d-1,d-2');
      expect(req.request.params.get('services')).toBe('s-1');
      expect(req.request.params.get('locations')).toBe('l-1');
      req.flush({ doctors: [], services: [], locations: [], items: [] });
      // La asignación de rol de cada doctor sale del catálogo de apoyo de esa organización.
      const catalogo = http.expectOne((r) => r.url === '/me/support-catalog');
      expect(catalogo.request.params.get('org')).toBe('t-1');
      catalogo.flush({ tenantId: 't-1', doctors: [], services: [], locations: [] });
    });

    it('sin filtros no manda parámetros vacíos', () => {
      client.getSupportAgenda({ org: 't-1', from: 'a', to: 'b' }).subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-agenda');
      expect(req.request.params.has('doctors')).toBe(false);
      expect(req.request.params.has('services')).toBe(false);
      expect(req.request.params.has('locations')).toBe(false);
      req.flush({ doctors: [], services: [], locations: [], items: [] });
      http
        .expectOne((r) => r.url === '/me/support-catalog')
        .flush({ tenantId: 't-1', doctors: [], services: [], locations: [] });
    });

    it('la agenda se lee con la forma de la API: el estado se resuelve por su concepto y el doctor sale por su perfil', () => {
      let agenda: SupportAgenda | undefined;
      client.getSupportAgenda({ org: 't-1', from: 'a', to: 'b' }).subscribe((a) => (agenda = a));
      http
        .expectOne((r) => r.url === '/me/support-agenda')
        .flush({
          doctors: [{ practitionerProfileId: 'pp-1', displayName: 'Dr. Pérez' }],
          services: [{ id: 'sv-1', name: 'Consulta' }],
          locations: [{ id: 'cs-1', name: 'Consultorio 103', code: '103' }],
          items: [
            {
              bookingId: 'b-1',
              practitionerProfileId: 'pp-1',
              startAt: '2026-11-02T13:00:00.000Z',
              endAt: '2026-11-02T13:30:00.000Z',
              statusConceptId: 'c-conf',
              careSpaceId: 'cs-1',
              healthcareServiceId: 'sv-1',
              patientName: 'Ana',
              allowedActions: ['schedule.view'],
            },
          ],
        });
      // La agenda identifica al doctor por su perfil; su asignación de rol (la de las aprobaciones) sale del catálogo, por el nombre.
      http
        .expectOne((r) => r.url === '/me/support-catalog')
        .flush({
          tenantId: 't-1',
          doctors: [
            { practitionerRoleAssignmentId: 'ra-1', displayName: 'Dr. Pérez', placements: [] },
          ],
          services: [],
          locations: [],
        });
      // Un solo pedido de códigos, con el concepto de estado.
      const conceptos = http.expectOne((r) => r.url === '/terminology/concepts');
      expect(conceptos.request.params.get('ids')).toBe('c-conf');
      conceptos.flush({
        items: [
          {
            conceptId: 'c-conf',
            code: 'BOOKING_CONFIRMED',
            display: 'Confirmada',
            codeSystemVersionId: 'v',
          },
        ],
        count: 1,
      });
      expect(agenda!.items[0]).toMatchObject({
        id: 'b-1',
        status: 'CONFIRMED',
        careSpaceName: 'Consultorio 103',
        serviceName: 'Consulta',
        patientLabel: 'Ana',
      });
      expect(agenda!.doctors[0]).toMatchObject({
        id: 'pp-1',
        name: 'Dr. Pérez',
        roleAssignmentId: 'ra-1',
      });
    });

    it('si la terminología falla, la agenda igual se muestra: las citas quedan como «pedidas»', () => {
      let agenda: SupportAgenda | undefined;
      client.getSupportAgenda({ org: 't-1', from: 'a', to: 'b' }).subscribe((a) => (agenda = a));
      http
        .expectOne((r) => r.url === '/me/support-agenda')
        .flush({
          doctors: [],
          services: [],
          locations: [],
          items: [
            {
              startAt: '2026-11-02T13:00:00.000Z',
              endAt: '2026-11-02T13:30:00.000Z',
              statusConceptId: 'c-x',
              allowedActions: ['schedule.check_in'],
            },
          ],
        });
      // Si el catálogo falla, la agenda se ve igual (sin la asignación de rol).
      http
        .expectOne((r) => r.url === '/me/support-catalog')
        .flush('x', { status: 500, statusText: 'Error' });
      http
        .expectOne((r) => r.url === '/terminology/concepts')
        .flush('x', { status: 500, statusText: 'Error' });
      expect(agenda!.items[0]!.status).toBe('BOOKED');
    });

    it('la bandeja acepta estado y doctor', () => {
      client.getSupportInbox({ status: 'NEW', doctor: 'h-1' }).subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-inbox');
      expect(req.request.params.get('status')).toBe('NEW');
      expect(req.request.params.get('doctor')).toBe('h-1');
      req.flush({ items: [] });
    });

    it('la bandeja acota por organización con ?tenantId (propuesta)', () => {
      client.getSupportInbox({ org: 't-1' }).subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-inbox');
      expect(req.request.params.get('tenantId')).toBe('t-1');
      expect(req.request.params.has('status')).toBe(false);
      req.flush({ items: [], doctors: [] });
    });

    it('una conversación de la bandeja se lee con GET /me/support-inbox/:id?tenantId (propuesta)', () => {
      client.getSupportConversation('c/1', 't-1').subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-inbox/c%2F1');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('tenantId')).toBe('t-1');
      req.flush({});
    });

    it('las plantillas de respuesta se leen con GET /me/support-reply-templates?tenantId (propuesta)', () => {
      client.listReplyTemplates('t-1').subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-reply-templates');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('tenantId')).toBe('t-1');
      req.flush({ items: [] });
    });

    it('pide el catálogo de su organización con ?org (propuesta)', () => {
      client.getMyCatalog('t-1').subscribe();
      const req = http.expectOne((r) => r.url === '/me/support-catalog');
      expect(req.request.params.get('org')).toBe('t-1');
      req.flush({});
    });
  });

  describe('organización', () => {
    it('la bandeja de solicitudes filtra por estado y pide de a 100', () => {
      client.listRequests('PENDING').subscribe();
      const req = http.expectOne((r) => r.url === '/org/support-engagement-requests');
      expect(req.request.params.get('status')).toBe('PENDING');
      expect(req.request.params.get('limit')).toBe('100');
      req.flush({ items: [], count: 0, nextCursor: null });
    });

    it('PARTIAL no se manda como filtro —la API lo rechaza— y se recorta de lo recibido', () => {
      let leidas: readonly { id: string }[] = [];
      client.listRequests('PARTIAL').subscribe((p) => (leidas = p.items));
      const req = http.expectOne((r) => r.url === '/org/support-engagement-requests');
      expect(req.request.params.has('status')).toBe(false);
      req.flush({
        items: [
          { id: 'a', status: 'PARTIAL', roleTemplateCode: 'NURSING', items: [] },
          { id: 'b', status: 'APPROVED', roleTemplateCode: 'NURSING', items: [] },
          { id: 'c', status: 'CANCELLED', roleTemplateCode: 'NURSING', items: [] },
        ],
        count: 3,
        nextCursor: null,
      });
      expect(leidas.map((r) => r.id)).toEqual(['a']);
    });

    it('junta todas las páginas siguiendo el cursor', () => {
      let ids: string[] = [];
      client.listRequests().subscribe((p) => (ids = p.items.map((r) => r.id)));
      http
        .expectOne((r) => r.url === '/org/support-engagement-requests' && !r.params.has('cursor'))
        .flush({
          items: [{ id: 'a', status: 'PENDING', roleTemplateCode: 'NURSING', items: [] }],
          count: 1,
          nextCursor: 'c1',
        });
      const segunda = http.expectOne(
        (r) => r.url === '/org/support-engagement-requests' && r.params.get('cursor') === 'c1',
      );
      segunda.flush({
        items: [{ id: 'b', status: 'EXPIRED', roleTemplateCode: 'NURSING', items: [] }],
        count: 1,
        nextCursor: null,
      });
      expect(ids).toEqual(['a', 'b']);
    });

    it('decide una solicitud ítem por ítem con POST …/decision', () => {
      const decision = {
        items: [
          { itemId: 'i-1', decision: 'ADJUSTED' as const, actions: ['schedule.view' as const] },
          { itemId: 'i-2', decision: 'REJECTED' as const, comment: 'No.' },
        ],
      };
      client.decideRequest('r-1', decision).subscribe();
      const req = http.expectOne('/org/support-engagement-requests/r-1/decision');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(decision);
      req.flush({ requestId: 'r-1', status: 'PARTIAL', engagementId: 'e-1', grantIds: ['g-1'] });
    });

    it('la decisión responde cómo quedó, no la solicitud', () => {
      let resultado: unknown;
      client
        .decideRequest('r-1', { items: [{ itemId: 'i-1', decision: 'APPROVED' }] })
        .subscribe((r) => (resultado = r));
      http
        .expectOne('/org/support-engagement-requests/r-1/decision')
        .flush({ requestId: 'r-1', status: 'APPROVED', engagementId: 'e-1', grantIds: ['g-1'] });
      expect(resultado).toEqual({
        requestId: 'r-1',
        status: 'APPROVED',
        engagementId: 'e-1',
        grantIds: ['g-1'],
      });
    });

    it('los permisos: GET, POST y PATCH sobre la misma ruta del vínculo', () => {
      client.listGrants('e-1').subscribe();
      expect(http.expectOne('/org/support-engagements/e-1/grants').request.method).toBe('GET');

      const nuevo = {
        targetKind: 'SERVICE' as const,
        healthcareServiceId: 's-1',
        expansionMode: 'DYNAMIC' as const,
        actions: ['schedule.view' as const],
      };
      client.createGrant('e-1', nuevo).subscribe();
      const post = http.expectOne('/org/support-engagements/e-1/grants');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual(nuevo);

      client.changeGrant('e-1', { grantId: 'g-1', revoke: true }).subscribe();
      const patch = http.expectOne('/org/support-engagements/e-1/grants');
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({ grantId: 'g-1', revoke: true });
    });

    it('la consulta de acceso manda UN solo parámetro: doctor, servicio o ubicación', () => {
      client.lookupAccess({ kind: 'location', id: 'l-1' }).subscribe();
      const req = http.expectOne((r) => r.url === '/org/access-lookup');
      expect(req.request.params.keys()).toEqual(['location']);
      expect(req.request.params.get('location')).toBe('l-1');
      req.flush({ items: [] });
    });

    it('emite invitaciones con POST /org/affiliation-invitations y lista con GET (propuesta)', () => {
      // La etiqueta del destinatario es de la pantalla: la API no la tiene y rechazaría el cuerpo.
      client
        .createInvitation({
          kind: 'SUPPORT_STAFF',
          targetPersonLabel: 'Dr. Flores',
          maxUses: 1,
          expiresInDays: 14,
          roleTemplate: 'FRONT_DESK',
        })
        .subscribe();
      const post = http.expectOne('/org/affiliation-invitations');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({
        kind: 'SUPPORT_STAFF',
        maxUses: 1,
        expiresInDays: 14,
        roleTemplateCode: 'FRONT_DESK',
      });

      client.listInvitations().subscribe();
      expect(http.expectOne('/org/affiliation-invitations').request.method).toBe('GET');
    });

    it('recertificar y terminar el vínculo', () => {
      client.recertify('e-1', 12).subscribe();
      const a = http.expectOne('/org/support-engagements/e-1/recertify');
      expect(a.request.body).toEqual({ recertifyEveryMonths: 12 });

      // Sin período se repite el del vínculo: el cuerpo va vacío.
      client.recertify('e-1').subscribe();
      expect(http.expectOne('/org/support-engagements/e-1/recertify').request.body).toEqual({});

      client.endEngagement('e-1', 'Renunció').subscribe();
      const b = http.expectOne('/org/support-engagements/e-1/end');
      expect(b.request.method).toBe('POST');
      expect(b.request.body).toEqual({ reason: 'Renunció' });

      // `reason` es obligatorio en la API: sin motivo va vacío, no ausente.
      client.endEngagement('e-2').subscribe();
      expect(http.expectOne('/org/support-engagements/e-2/end').request.body).toEqual({
        reason: '',
      });
    });

    it('la política de sesión se lee con GET y se guarda con PUT', () => {
      client.getSessionPolicies().subscribe();
      expect(http.expectOne('/org/session-policies').request.method).toBe('GET');
      client.putSessionPolicies({ policies: [] }).subscribe();
      const put = http.expectOne('/org/session-policies');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ policies: [] });
    });

    it('la bitácora manda los filtros de la API y devuelve el cursor', () => {
      let pagina:
        | { nextCursor: string | null; items: readonly { personName: string; createdAt: string }[] }
        | undefined;
      client
        .getOrganizationActivity({
          userId: 'u-1',
          person: 'Ana',
          doctor: 'Dr. Pérez',
          action: 'schedule.confirm',
          from: '2026-10-01',
          to: '2026-10-30',
          limit: 50,
          cursor: 'c1',
        })
        .subscribe((p) => (pagina = p));
      const req = http.expectOne((r) => r.url === '/org/support-activity');
      expect(
        Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)])),
      ).toEqual({
        userId: 'u-1',
        person: 'Ana',
        doctor: 'Dr. Pérez',
        action: 'schedule.confirm',
        from: '2026-10-01',
        to: '2026-10-30',
        limit: '50',
        cursor: 'c1',
      });
      req.flush({
        items: [
          {
            id: 'a',
            userId: 'u',
            personName: 'Ana',
            actorName: 'Ana',
            action: 'schedule.confirm',
            auditAction: 'BOOKING_CONFIRMED',
            entity: 'booking',
            summary: 's',
            success: true,
            result: 'SUCCESS',
            createdAt: '2026-10-30T12:00:00Z',
            occurredAt: '2026-10-30T12:00:00Z',
          },
        ],
        count: 1,
        nextCursor: 'c2',
      });
      expect(pagina).toMatchObject({ nextCursor: 'c2' });
      expect(pagina!.items[0]).toMatchObject({
        personName: 'Ana',
        createdAt: '2026-10-30T12:00:00Z',
      });
    });

    it('«Mi actividad» acepta tenantId y la del doctor, los mismos filtros', () => {
      client.getMyActivity({ tenantId: 't-1' }).subscribe();
      expect(
        http.expectOne((r) => r.url === '/me/support-activity').request.params.get('tenantId'),
      ).toBe('t-1');
      client.getMyTeamActivity({ person: 'Ana', limit: 10 }).subscribe();
      const doc = http.expectOne((r) => r.url === '/me/practitioner/support-activity');
      expect(doc.request.params.get('person')).toBe('Ana');
      expect(doc.request.params.get('limit')).toBe('10');
    });

    it('las reglas de red se leen con GET y se REEMPLAZAN con PUT { rules }', () => {
      client.getIpAccessRules().subscribe();
      expect(http.expectOne('/org/ip-access-rules').request.method).toBe('GET');
      const reglas = [{ type: 'ALLOW' as const, cidr: '190.129.0.0/16', description: 'Sede' }];
      client.putIpAccessRules(reglas).subscribe();
      const put = http.expectOne('/org/ip-access-rules');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ rules: reglas });
    });

    it('el equipo (propuesta) es una lectura', () => {
      client.listEngagements().subscribe();
      http.expectOne('/org/support-engagements').flush({ items: [] });
      client.getCatalog().subscribe();
      http.expectOne('/org/support-catalog').flush({});
    });
  });

  describe('doctor', () => {
    it('lee su equipo y su actividad', () => {
      client.getMyTeam().subscribe();
      http.expectOne('/me/practitioner/support-team').flush({ items: [] });
      client.getMyTeamActivity().subscribe();
      http
        .expectOne('/me/practitioner/support-activity')
        .flush({ items: [], count: 0, nextCursor: null });
    });

    it('el equipo llega con el estado para el doctor y la delegación tal cual', () => {
      let miembro: { status: string; delegateStatus: string; roleTemplate: string } | undefined;
      client.getMyTeam().subscribe((t) => (miembro = t.items[0]));
      http.expectOne('/me/practitioner/support-team').flush({
        items: [
          {
            delegateId: 'd',
            personName: 'Ana',
            roleTemplateCode: 'SECRETARY',
            roleTemplate: 'SECRETARY',
            status: 'REVOKED',
            delegateStatus: 'SUSPENDED',
            actions: [],
            pendingClinicalRequests: [],
          },
        ],
        count: 1,
      });
      expect(miembro).toMatchObject({
        status: 'REVOKED',
        delegateStatus: 'SUSPENDED',
        roleTemplate: 'SECRETARY',
      });
    });

    it('acepta con POST …/accept y ajusta con PATCH …/reply-settings', () => {
      client.acceptDelegate('dl-1', { mayReplyOnBehalf: true }).subscribe();
      const accept = http.expectOne('/practitioner-delegates/dl-1/accept');
      expect(accept.request.method).toBe('POST');
      // `AcceptSupportDelegateDto.acceptsSupportClause` es obligatorio y solo vale `true`.
      expect(accept.request.body).toEqual({ acceptsSupportClause: true, mayReplyOnBehalf: true });

      client.setReplySettings('dl-1', { replyDisclosure: 'HIDE' }).subscribe();
      const patch = http.expectOne('/practitioner-delegates/dl-1/reply-settings');
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({ replyDisclosure: 'HIDE' });
    });

    it('invita a una secretaria con POST /me/practitioner/support-invitations y solo las dos claves del DTO', () => {
      let creada: SupportInvitationCreated | undefined;
      client
        .inviteSupportStaff({ nationalId: '7005002', practitionerRoleAssignmentId: 'pra-1' })
        .subscribe((respuesta) => (creada = respuesta));
      const req = http.expectOne('/me/practitioner/support-invitations');
      expect(req.request.method).toBe('POST');
      // `PractitionerInviteSupportDto`: la API rechaza (400) cualquier otra clave.
      expect(req.request.body).toEqual({ nationalId: '7005002', practitionerRoleAssignmentId: 'pra-1' });
      req.flush({
        id: 'link-1',
        tenantId: 't-1',
        items: [{ id: 'link-1', status: 'PENDING', initiatedBy: 'PRACTITIONER', awaiting: 'SUPPORT_STAFF' }],
      });
      // El vínculo nace pendiente y espera a la secretaria: se lee tal cual lo manda la API.
      expect(creada?.id).toBe('link-1');
      expect(creada?.items[0]?.status).toBe('PENDING');
      expect(creada?.items[0]?.awaiting).toBe('SUPPORT_STAFF');
    });

    it('un rechazo de la invitación llega al suscriptor con su `reason`', () => {
      let falla: HttpErrorResponse | undefined;
      client
        .inviteSupportStaff({ nationalId: '7005002', practitionerRoleAssignmentId: 'pra-1' })
        .subscribe({ error: (e: HttpErrorResponse) => (falla = e) });
      http
        .expectOne('/me/practitioner/support-invitations')
        .flush(
          { statusCode: 409, code: 'CONFLICT', reason: 'SUPPORT_LINK_DUPLICATE', message: 'Ya hay un vínculo vivo' },
          { status: 409, statusText: 'Conflict' },
        );
      expect(falla?.status).toBe(409);
      expect((falla?.error as { reason: string }).reason).toBe('SUPPORT_LINK_DUPLICATE');
    });
  });

  describe('chat', () => {
    it('la asignación y las notas internas cuelgan de la conversación', () => {
      client
        .assignConversation('c-1', { practitionerProfileId: 'h-1', status: 'TAKEN' })
        .subscribe();
      const a = http.expectOne('/community/conversations/c-1/assignment');
      expect(a.request.method).toBe('POST');
      expect(a.request.body).toEqual({ practitionerProfileId: 'h-1', status: 'TAKEN' });

      client
        .assignConversation('c-1', {
          practitionerProfileId: 'h-1',
          assignedUserId: 'u-2',
          status: 'TAKEN',
        })
        .subscribe();
      expect(http.expectOne('/community/conversations/c-1/assignment').request.body).toEqual({
        practitionerProfileId: 'h-1',
        assignedUserId: 'u-2',
        status: 'TAKEN',
      });

      client.addInternalNote('c-1', { bodyText: 'Llamar al paciente' }).subscribe();
      const n = http.expectOne('/community/conversations/c-1/internal-notes');
      expect(n.request.body).toEqual({ bodyText: 'Llamar al paciente' });
    });
  });

  it('escapa los identificadores en la ruta', () => {
    client.recertify('a/b', 6).subscribe();
    http.expectOne('/org/support-engagements/a%2Fb/recertify').flush({ ok: true });
  });
});
