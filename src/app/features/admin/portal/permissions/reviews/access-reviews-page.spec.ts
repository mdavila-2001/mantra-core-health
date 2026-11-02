import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { DialogConfig, DialogReasonConfig } from '../../../../../shared/components/molecules/dialog/dialog.types';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { AccessReviewsPage } from './access-reviews-page';
import { LifecycleDrawer } from './lifecycle-drawer';
import { ReviewDrawer } from './review-drawer';
import { ReviewsPanel } from './reviews-panel';

const SCREEN = '/superadmin/portal/governance/access-reviews';
const USER = '00000000-0000-4000-8000-00000000c002';
const ACTIVE = '00000000-0000-4000-8000-0000000000a1';

const internalUser = {
  id: USER,
  displayName: 'Marcos Rivero',
  statusConceptId: 'c',
  lastLoginAt: null,
  globalRoles: [],
  assignments: [{ assignmentId: ACTIVE, roleCode: 'DPO', roleName: 'Protección de datos', tenantId: null, validTo: null }],
};

const lifecycle = (state: string, items: unknown[] = [], nextCursor: string | null = null) => ({
  userId: USER,
  state,
  items,
  nextCursor,
  limit: 20,
});
const event = (action: string, reason: string) => ({
  id: `e-${action}-${reason.length}`,
  action,
  reason,
  recordedByUserId: '00000000-0000-4000-8000-00000000c001',
  recordedAt: '2026-10-30T10:00:00.000Z',
});
const done = (state: string, changed = true, revokedSessions = 0) => ({ id: USER, state, changed, revokedSessions });
const failure = (status: number, reason: string, code: string) =>
  [{ statusCode: status, code, message: 'x', reason }, { status, statusText: 'Error' }] as const;

const mapOf = (assignments: unknown[] = []) => ({
  user: { id: USER, displayName: 'Marcos Rivero', accountStatus: 'ACTIVE' },
  globalRoles: ['SECURITY_ADMIN'],
  assignments,
  counts: { directGrants: 1, resourceScopeGrants: 2, restrictedFields: 3 },
  lastReview: null,
});
const mapAssignment = (id: string, effective: boolean) => ({
  id,
  roleId: 'r1',
  roleCode: 'DPO',
  roleName: 'Protección de datos',
  roleScope: 'GLOBAL',
  tenantId: null,
  branchId: null,
  practiceId: null,
  status: effective ? 'ACTIVE' : 'REVOKED',
  validFrom: null,
  validTo: null,
  isEffective: effective,
  appliesGlobally: true,
  assignedByUserId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
});
const reviewRow = (id: string, reviewedAt: string) => ({
  id,
  userId: USER,
  userDisplayName: 'Marcos Rivero',
  reviewerUserId: '00000000-0000-4000-8000-00000000c001',
  reviewerDisplayName: 'Lucía Paredes',
  reviewedAt,
});
const duePage = (items: unknown[], olderThanDays = 90, nextCursor: string | null = null) => ({
  items,
  nextCursor,
  limit: 50,
  olderThanDays,
  lookbackDays: 730,
});

describe('AccessReviewsPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let reasonAnswer: string | null;
  let asked: { config: DialogConfig; reason: DialogReasonConfig } | undefined;

  async function open(url = SCREEN): Promise<void> {
    reasonAnswer = 'Licencia sin goce de sueldo';
    asked = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/access-reviews', component: AccessReviewsPage }]),
        {
          provide: DialogService,
          useValue: {
            confirmWithReason: (config: DialogConfig, reason: DialogReasonConfig) => {
              asked = { config, reason };
              return Promise.resolve(reasonAnswer);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, AccessReviewsPage);
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const drawerText = (testId: string) => document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';
  afterEach(() => http.verify());

  describe('ciclo de vida', () => {
    interface Drawer {
      run(action: 'suspend' | 'reactivate' | 'deactivate'): Promise<void>;
      more(): void;
    }

    async function openDrawer(state = 'ACTIVE', items: unknown[] = [], nextCursor: string | null = null): Promise<Drawer> {
      await open(`${SCREEN}?user=${USER}`);
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      http.expectOne(`/iam/users/${USER}`).flush({ displayName: 'Marcos Rivero' });
      http.expectOne(`/iam/users/${USER}/lifecycle`).flush(lifecycle(state, items, nextCursor));
      harness.detectChanges();
      return harness.routeDebugElement!.query(By.directive(LifecycleDrawer)).componentInstance as unknown as Drawer;
    }

    it('de una cuenta activa ofrece suspender y dar de baja, no reactivar', async () => {
      await openDrawer();
      const drawer = drawerText('portal-lifecycle');
      expect(drawer).toContain('Activa');
      expect(drawer).toContain('Suspender');
      expect(drawer).toContain('Dar de baja');
      expect(drawer).not.toContain('Reactivar');
      expect(drawer).toContain('nunca se suspendió');
    });

    it('de una cuenta dada de baja no ofrece ninguna acción: la baja no se reactiva', async () => {
      await openDrawer('DEACTIVATED', [event('DEACTIVATE', 'Terminó su contrato')]);
      const drawer = drawerText('portal-lifecycle');
      expect(drawer).toContain('Dada de baja');
      expect(drawer).toContain('Desde este estado no hay acciones disponibles');
      expect(drawer).toContain('Terminó su contrato');
    });

    it('suspender pide el motivo (no vacío, hasta 500), lo manda a /iam/users y relee el estado', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      expect(asked!.reason).toEqual(expect.objectContaining({ minLength: 1, maxLength: 500 }));
      expect(asked!.config.destructive).toBe(false);
      const post = http.expectOne((r) => r.method === 'POST' && r.url === `/iam/users/${USER}/suspend`);
      expect(post.request.body).toEqual({ reason: 'Licencia sin goce de sueldo' });
      post.flush(done('SUSPENDED', true, 2));
      http.expectOne(`/iam/users/${USER}/lifecycle`).flush(lifecycle('SUSPENDED', [event('SUSPEND', 'Licencia sin goce de sueldo')]));
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      harness.detectChanges();
      const drawerAfter = drawerText('portal-lifecycle');
      expect(drawerAfter).toContain('Suspendida');
      expect(drawerAfter).toContain('Reactivar');
      expect(drawerAfter).toContain('Licencia sin goce de sueldo');
      expect(drawerAfter).toContain('Se cortaron 2 sesiones');
    });

    it('la baja se marca destructiva, avisa que no se reactiva y usa /deactivate', async () => {
      const drawer = await openDrawer();
      await drawer.run('deactivate');
      expect(asked!.config.destructive).toBe(true);
      expect(asked!.config.message).toContain('no se reactiva');
      http.expectOne((r) => r.url === `/iam/users/${USER}/deactivate`).flush(done('DEACTIVATED', true, 1));
      http.expectOne(`/iam/users/${USER}/lifecycle`).flush(lifecycle('DEACTIVATED', [event('DEACTIVATE', 'Terminó su contrato')]));
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('Dada de baja');
    });

    it('si otra persona ya la dejó así (changed:false) lo dice y no afirma que cambió algo', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      http.expectOne((r) => r.method === 'POST').flush(done('SUSPENDED', false, 0));
      http.expectOne(`/iam/users/${USER}/lifecycle`).flush(lifecycle('SUSPENDED', [event('SUSPEND', 'Otra persona')]));
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('ya estaba así: no se cambió nada');
    });

    it('si se arrepiente no manda nada', async () => {
      const drawer = await openDrawer();
      reasonAnswer = null;
      await drawer.run('suspend');
      http.expectNone((r) => r.method === 'POST');
    });

    it('una transición inválida (otra persona se adelantó) se explica por su reason y el cajón se relee', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      const [body, init] = failure(409, 'USER_LIFECYCLE_TRANSITION_INVALID', 'CONFLICT');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      http.expectOne(`/iam/users/${USER}/lifecycle`).flush(lifecycle('DEACTIVATED', [event('DEACTIVATE', 'Otra persona')]));
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('La cuenta no puede pasar a ese estado');
      expect(drawerText('portal-lifecycle')).toContain('Dada de baja');
    });

    it('nadie se suspende a sí mismo ni deja la plataforma sin quien administre accesos: el rechazo se explica', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      const [self, selfInit] = failure(422, 'USER_SELF_LIFECYCLE_FORBIDDEN', 'PRECONDITION_FAILED');
      http.expectOne((r) => r.method === 'POST').flush(self, selfInit);
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('Nadie puede suspenderse ni darse de baja a sí mismo');
      await drawer.run('suspend');
      const [last, lastInit] = failure(422, 'USER_LAST_SECURITY_ADMIN', 'PRECONDITION_FAILED');
      http.expectOne((r) => r.method === 'POST').flush(last, lastInit);
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('última cuenta que administra accesos');
    });

    it('una administración acotada a una organización recibe un 403 y se le explica por qué', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      const [body, init] = failure(403, 'ROLE_INSUFFICIENT', 'FORBIDDEN');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('administradora de plataforma');
    });

    it('la historia viene paginada: «Ver más antiguos» pide la siguiente página y la suma', async () => {
      const drawer = await openDrawer('SUSPENDED', [event('SUSPEND', 'Primera')], 'c2');
      expect(drawerText('portal-lifecycle')).toContain('Ver más antiguos');
      drawer.more();
      const next = http.expectOne((r) => r.url === `/iam/users/${USER}/lifecycle`);
      expect(next.request.params.get('cursor')).toBe('c2');
      next.flush(lifecycle('SUSPENDED', [event('REACTIVATE', 'Segunda')], null));
      harness.detectChanges();
      const drawerAfter = drawerText('portal-lifecycle');
      expect(drawerAfter).toContain('Primera');
      expect(drawerAfter).toContain('Segunda');
      expect(drawerAfter).not.toContain('Ver más antiguos');
    });
  });

  describe('revisión de accesos', () => {
    async function openReviews(query = ''): Promise<void> {
      await open(`${SCREEN}?view=reviews${query}`);
    }

    it('lista a las cuentas con acceso administrativo y distingue a las nunca revisadas', async () => {
      await openReviews();
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush(
        duePage([
          { userId: USER, displayName: 'Marcos Rivero', accountStatus: 'ACTIVE', lastReviewedAt: null, lastReviewerUserId: null },
          { userId: 'u2', displayName: 'Elena Quispe', accountStatus: 'LOCKED', lastReviewedAt: '2026-08-01T10:00:00.000Z', lastReviewerUserId: 'u3' },
        ]),
      );
      harness.detectChanges();
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-reviews-table"]')!.textContent!;
      expect(table).toContain('Nunca revisada');
      expect(table).toContain('Elena Quispe');
      expect(table).toContain('Bloqueada');
    });

    it('el plazo lo pone quien gobierna: sin plazo no se manda, uno inválido no se manda, uno válido sí', async () => {
      await openReviews();
      const first = http.expectOne((r) => r.url === '/authz/access-reviews/due');
      expect(first.request.params.has('olderThanDays')).toBe(false);
      first.flush(duePage([]));
      harness.detectChanges();
      const panel = harness.routeDebugElement!.query(By.directive(ReviewsPanel)).componentInstance as unknown as {
        daysText: { set(v: string): void };
      };
      panel.daysText.set('0');
      harness.detectChanges();
      http.expectNone((r) => r.url === '/authz/access-reviews/due');
      expect(text()).toContain('número entero de 1 a 3650');
      panel.daysText.set('30');
      harness.detectChanges();
      const second = http.expectOne((r) => r.url === '/authz/access-reviews/due');
      expect(second.request.params.get('olderThanDays')).toBe('30');
      second.flush(duePage([], 30));
      harness.detectChanges();
      expect(text()).toContain('se revisaron en los últimos 30 días');
    });

    it('sin plazo y sin nadie pendiente dice que el plazo por omisión es de 90 días', async () => {
      await openReviews();
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush(duePage([]));
      harness.detectChanges();
      expect(text()).toContain('se revisaron en los últimos 90 días');
    });

    it('una administración acotada a una organización recibe un 403 en la cola', async () => {
      await openReviews();
      const [body, init] = failure(403, 'ROLE_INSUFFICIENT', 'FORBIDDEN');
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush(body, init);
      harness.detectChanges();
      expect(text()).not.toContain('Nunca revisada');
    });

    interface Review {
      record(): void;
    }

    async function openReview(): Promise<Review> {
      await openReviews(`&review=${USER}`);
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush(
        duePage([{ userId: USER, displayName: 'Marcos Rivero', accountStatus: 'ACTIVE', lastReviewedAt: null, lastReviewerUserId: null }]),
      );
      http.expectOne(`/iam/users/${USER}`).flush({ displayName: 'Marcos Rivero' });
      http.expectOne(`/authz/users/${USER}/access-map`).flush(mapOf([mapAssignment('a1', true), mapAssignment('a2', false)]));
      const history = http.expectOne((r) => r.url === '/authz/access-reviews');
      expect(history.request.params.get('userId')).toBe(USER);
      history.flush({ items: [reviewRow('r0', '2026-09-01T10:00:00.000Z')], nextCursor: null, limit: 10 });
      harness.detectChanges();
      return harness.routeDebugElement!.query(By.directive(ReviewDrawer)).componentInstance as unknown as Review;
    }

    it('muestra el mapa de accesos (roles, conteos y asignaciones) y quién revisó antes', async () => {
      await openReview();
      const drawer = drawerText('portal-review');
      expect(document.querySelectorAll('[data-testid="portal-review-assignment"]')).toHaveLength(2);
      expect(drawer).toContain('SECURITY_ADMIN');
      expect(drawer).toContain('1 excepciones por persona');
      expect(drawer).toContain('2 permisos sobre un recurso');
      expect(drawer).toContain('3 campos restringidos');
      expect(drawer).toContain('No vale hoy');
      expect(document.querySelectorAll('[data-testid="portal-review-event"]')).toHaveLength(1);
      expect(drawer).toContain('Lucía Paredes');
    });

    it('registrar la revisión no manda cuerpo, y relee el mapa, la historia y la cola', async () => {
      const review = await openReview();
      review.record();
      const post = http.expectOne((r) => r.method === 'POST' && r.url === `/authz/users/${USER}/access-reviews`);
      expect(post.request.body).toEqual({});
      post.flush(reviewRow('r1', '2026-10-31T10:00:00.000Z'));
      http.expectOne(`/authz/users/${USER}/access-map`).flush(mapOf());
      http.expectOne((r) => r.url === '/authz/access-reviews').flush({ items: [reviewRow('r1', '2026-10-31T10:00:00.000Z')], nextCursor: null, limit: 10 });
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush(duePage([]));
      harness.detectChanges();
      expect(drawerText('portal-review')).toContain('Quedó registrada la revisión');
    });

    it('revisar los propios accesos se rechaza (422) y se explica', async () => {
      const review = await openReview();
      review.record();
      const [body, init] = failure(422, 'ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN', 'PRECONDITION_FAILED');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      harness.detectChanges();
      expect(drawerText('portal-review')).toContain('Nadie revisa sus propios accesos');
      expect(drawerText('portal-review')).not.toContain('Quedó registrada');
    });

    it('si la persona ya no existe se explica y se relee', async () => {
      const review = await openReview();
      review.record();
      const [body, init] = failure(404, 'GOVERNANCE_USER_NOT_FOUND', 'NOT_FOUND');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      harness.detectChanges();
      expect(drawerText('portal-review')).toContain('Esa persona ya no existe');
    });
  });
});
