import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';

import { GroupDetail } from './group-detail';

/**
 * Lo que estas pruebas fijan.
 *
 * Cuatro reglas del carril que no se ven leyendo la plantilla:
 *
 * 1. **`viewer` decide qué se ofrece.** Publicar, unirse y administrar salen de
 *    la misma respuesta; deducirlos del padrón haría parpadear el botón
 *    «unirme» delante de quien ya entró.
 * 2. **403 en un grupo privado no es una falla.** Es la respuesta correcta, y
 *    se muestra como «pedí entrar».
 * 3. **404 en un grupo secreto tampoco.** Para quien mira, ese grupo no existe.
 * 4. **Responder cuelga del padre.** La respuesta viaja con `parentCommentId`;
 *    sin eso queda como publicación suelta y el hilo se pierde.
 */
describe('GroupDetail', () => {
  let fixture: ComponentFixture<GroupDetail>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const paginaVacia = { items: [], count: 0, limit: 20, nextCursor: null };

  const perfilPropio = {
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'hp-1',
    slug: 'marisol',
    displayName: 'Dra. Marisol',
    headline: null,
    biography: null,
    acceptsReviews: null,
  };

  const ficha = (viewer: Record<string, unknown>) => ({
    id: 'g-1',
    tenantId: 't-1',
    slug: 'cardio',
    name: 'Cardiología clínica',
    description: 'Casos y ateneos',
    visibilityConceptId: 'c-publico',
    groupTypeConceptId: 'c-general',
    topicId: null,
    ownerProfileId: 'pp-9',
    coverFileId: null,
    memberCount: 4,
    postCount: 2,
    pendingCount: null,
    statusConceptId: 'c-activo',
    viewer: {
      isMember: false,
      canAdminister: false,
      canPost: false,
      membershipId: null,
      memberRoleConceptId: null,
      joinStatusConceptId: null,
      ...viewer,
    },
  });

  const publicacion = (id: string, cuerpo: string) => ({
    id,
    authorProfileId: 'abcdef01-2345-6789-abcd-ef0123456789',
    bodyText: cuerpo,
    parentCommentId: null,
    threadDepth: 0,
    replyCount: 0,
    createdAt: '2026-08-18T10:00:00.000Z',
    replies: null,
  });

  const montar = (): void => {
    fixture = TestBed.createComponent(GroupDetail);
    fixture.detectChanges();
  };

  /** Contesta la ficha y, si el muro se pide, también el muro y el padrón. */
  const responderFicha = (viewer: Record<string, unknown>): void => {
    http.expectOne((r) => r.url === '/community/groups/g-1').flush(ficha(viewer));
    fixture.detectChanges();
  };

  const responderMuro = (items: object[] = []): void => {
    http
      .expectOne((r) => r.url === '/community/groups/g-1/posts' && r.method === 'GET')
      .flush({ ...paginaVacia, items, count: items.length });
    fixture.detectChanges();
  };

  const responderPadron = (): void => {
    http
      .match((r) => r.url === '/community/groups/g-1/members' && r.method === 'GET')
      .forEach((req) => req.flush(paginaVacia));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ groupId: 'g-1' }) } },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('a quien no es integrante le ofrece unirse, no publicar', () => {
    montar();
    responderFicha({});
    responderMuro([publicacion('c-1', 'Hola grupo')]);
    responderPadron();

    expect(texto()).toContain('Unirme al grupo');
    expect(texto()).toContain('Hola grupo');
    expect(texto()).not.toContain('Salir del grupo');
  });

  it('al integrante le ofrece publicar y salir', () => {
    montar();
    responderFicha({ isMember: true, canPost: true, membershipId: 'm-1' });
    responderMuro();
    responderPadron();

    expect(texto()).toContain('Salir del grupo');
    expect(texto()).toContain('No escribas datos personales');
  });

  it('quien ya pidió entrar ve que su ingreso está en revisión', () => {
    montar();
    responderFicha({ membershipId: 'm-1', joinStatusConceptId: 'c-pendiente' });
    responderMuro();
    responderPadron();

    expect(texto()).toContain('Tu ingreso está en revisión');
    expect(texto()).not.toContain('Unirme al grupo');
  });

  it('un muro privado responde 403 y eso se lee como invitación, no como falla', () => {
    montar();
    responderFicha({});
    http
      .expectOne((r) => r.url === '/community/groups/g-1/posts')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    responderPadron();

    expect(texto()).toContain('Este grupo es privado');
    expect(texto()).not.toContain('No pudimos cargar el muro');
  });

  it('un grupo secreto contesta 404 y para quien mira no existe', () => {
    montar();
    http
      .expectOne((r) => r.url === '/community/groups/g-1')
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(texto()).toContain('No encontramos ese grupo');
    expect(texto()).not.toContain('No pudimos cargar el grupo');
  });

  it('la respuesta viaja colgada de su publicación', () => {
    montar();
    responderFicha({ isMember: true, canPost: true, membershipId: 'm-1' });
    responderMuro([publicacion('c-1', 'Hola grupo')]);
    responderPadron();

    const componente = fixture.componentInstance as unknown as {
      alternarRespuesta(id: string): void;
      publicar(t: string): void;
    };
    componente.alternarRespuesta('c-1');
    componente.publicar('te respondo');
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();

    const req = http.expectOne(
      (r) => r.url === '/community/groups/g-1/posts' && r.method === 'POST',
    );
    expect(req.request.body).toEqual({
      authorProfileId: 'pp-1',
      bodyText: 'te respondo',
      parentCommentId: 'c-1',
    });
    req.flush(publicacion('c-2', 'te respondo'));
    fixture.detectChanges();

    // Publicar recarga el muro en vez de parchear el árbol en memoria.
    responderMuro([publicacion('c-1', 'Hola grupo')]);
  });

  it('quien administra resuelve las solicitudes pendientes', () => {
    montar();
    responderFicha({
      isMember: true,
      canPost: true,
      canAdminister: true,
      membershipId: 'm-1',
    });
    responderMuro();

    const padron = http.match(
      (r) => r.url === '/community/groups/g-1/members' && r.method === 'GET',
    );
    // Dos lecturas: el padrón activo y la cola de pendientes, que sólo pide
    // quien administra.
    expect(padron.length).toBe(2);
    padron[0].flush(paginaVacia);
    padron[1].flush({
      ...paginaVacia,
      items: [
        {
          id: 'm-9',
          memberProfileId: 'pp-9',
          memberRoleConceptId: 'c-miembro',
          joinStatusConceptId: 'c-pendiente',
          joinedAt: null,
          invitedByProfileId: null,
        },
      ],
      count: 1,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Solicitudes de ingreso');

    (fixture.componentInstance as unknown as { aprobar(m: object): void }).aprobar({
      id: 'm-9',
      memberProfileId: 'pp-9',
      memberRoleConceptId: 'c-miembro',
      joinStatusConceptId: 'c-pendiente',
    });
    fixture.detectChanges();

    const patch = http.expectOne(
      (r) => r.url === '/community/groups/g-1/members/m-9' && r.method === 'PATCH',
    );
    expect(patch.request.body).toEqual({ decision: 'APPROVE' });
    patch.flush({ id: 'm-9', memberRoleConceptId: 'c-miembro', joinStatusConceptId: 'c-activo' });
    fixture.detectChanges();

    // Resolver el alta recarga la ficha: el conteo de integrantes cambió.
    responderFicha({ isMember: true, canPost: true, canAdminister: true, membershipId: 'm-1' });
    responderMuro();
    http
      .match((r) => r.url === '/community/groups/g-1/members' && r.method === 'GET')
      .forEach((req) => req.flush(paginaVacia));
    fixture.detectChanges();
  });
});
