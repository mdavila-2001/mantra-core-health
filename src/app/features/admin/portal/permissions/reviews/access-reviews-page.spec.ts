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
const REVOKED = '00000000-0000-4000-8000-0000000000a2';

const internalUser = {
  id: USER,
  displayName: 'Marcos Rivero',
  statusConceptId: 'c',
  lastLoginAt: null,
  globalRoles: [],
  assignments: [{ assignmentId: ACTIVE, roleCode: 'DPO', roleName: 'Protección de datos', tenantId: null, validTo: null }],
};

const assignment = (id: string, status: string) => ({
  id,
  roleId: 'r1',
  roleCode: 'DPO',
  roleName: 'Protección de datos',
  roleScope: 'GLOBAL',
  tenantId: null,
  branchId: null,
  practiceId: null,
  status,
  validFrom: null,
  validTo: null,
  isEffective: status === 'ACTIVE',
  appliesGlobally: true,
  assignedByUserId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
});

const lifecycle = (state: string, history: unknown[] = []) => ({ userId: USER, state, history });
const event = (kind: string, reason: string) => ({ id: `e-${kind}`, kind, reason, actorUserId: '00000000-0000-4000-8000-00000000c001', recordedAt: '2026-10-30T10:00:00.000Z' });
const failure = (status: number, reason: string, code: string) =>
  [{ statusCode: status, code, message: 'x', reason }, { status, statusText: 'Error' }] as const;

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
      run(action: 'suspend' | 'reactivate' | 'offboard'): Promise<void>;
    }

    async function openDrawer(state = 'ACTIVE', history: unknown[] = []): Promise<Drawer> {
      await open(`${SCREEN}?user=${USER}`);
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      http.expectOne(`/iam/users/${USER}`).flush({ displayName: 'Marcos Rivero' });
      http.expectOne(`/authz/users/${USER}/lifecycle`).flush(lifecycle(state, history));
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

    it('suspender pide el motivo (con el mínimo de la API), lo manda y relee el estado', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      expect(asked!.reason).toEqual(expect.objectContaining({ minLength: 10, maxLength: 500 }));
      expect(asked!.config.destructive).toBe(false);
      const post = http.expectOne((r) => r.method === 'POST' && r.url === `/authz/users/${USER}/lifecycle/suspend`);
      expect(post.request.body).toEqual({ reason: 'Licencia sin goce de sueldo' });
      post.flush({ userId: USER, state: 'SUSPENDED', revokedAssignments: 0, note: '' });
      http.expectOne(`/authz/users/${USER}/lifecycle`).flush(lifecycle('SUSPENDED', [event('SUSPENDED', 'Licencia sin goce de sueldo')]));
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      harness.detectChanges();
      const drawerAfter = drawerText('portal-lifecycle');
      expect(drawerAfter).toContain('Suspendida');
      expect(drawerAfter).toContain('Reactivar');
      expect(drawerAfter).toContain('Licencia sin goce de sueldo');
    });

    it('la baja se marca destructiva y cuenta cuántos roles revocó', async () => {
      const drawer = await openDrawer();
      await drawer.run('offboard');
      expect(asked!.config.destructive).toBe(true);
      expect(asked!.config.message).toContain('revocan todos sus roles');
      http
        .expectOne((r) => r.url === `/authz/users/${USER}/lifecycle/offboard`)
        .flush({ userId: USER, state: 'OFFBOARDED', revokedAssignments: 3, note: '' });
      http.expectOne(`/authz/users/${USER}/lifecycle`).flush(lifecycle('OFFBOARDED', [event('OFFBOARDED', 'Terminó su contrato')]));
      http.expectOne((r) => r.url === '/authz/internal-users').flush({ items: [internalUser], nextCursor: null, limit: 50 });
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('Se revocaron 3 roles.');
      expect(drawerText('portal-lifecycle')).toContain('Dada de baja');
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
      const [body, init] = failure(409, 'USER_LIFECYCLE_NOT_ACTIVE', 'CONFLICT');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      http.expectOne(`/authz/users/${USER}/lifecycle`).flush(lifecycle('SUSPENDED', [event('SUSPENDED', 'Otra persona')]));
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('La cuenta ya no estaba activa');
      expect(drawerText('portal-lifecycle')).toContain('Suspendida');
    });

    it('nadie se suspende a sí mismo: el rechazo se explica', async () => {
      const drawer = await openDrawer();
      await drawer.run('suspend');
      const [body, init] = failure(422, 'USER_LIFECYCLE_SELF_ACTION', 'PRECONDITION_FAILED');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      harness.detectChanges();
      expect(drawerText('portal-lifecycle')).toContain('Nadie puede suspenderse ni darse de baja a sí mismo');
    });
  });

  describe('revisión de accesos', () => {
    async function openReviews(query = ''): Promise<void> {
      await open(`${SCREEN}?view=reviews${query}`);
    }

    it('lista a quienes tienen accesos y distingue a los nunca revisados', async () => {
      await openReviews();
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush({
        items: [
          { userId: USER, displayName: 'Marcos Rivero', activeAssignments: 2, lastReviewedAt: null },
          { userId: 'u2', displayName: 'Elena Quispe', activeAssignments: 1, lastReviewedAt: '2026-08-01T10:00:00.000Z' },
        ],
        olderThanDays: null,
      });
      harness.detectChanges();
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-reviews-table"]')!.textContent!;
      expect(table).toContain('Nunca revisada');
      expect(table).toContain('Elena Quispe');
    });

    it('el plazo lo pone quien gobierna: sin plazo no se manda, uno inválido no se manda, uno válido sí', async () => {
      await openReviews();
      const first = http.expectOne((r) => r.url === '/authz/access-reviews/due');
      expect(first.request.params.has('olderThanDays')).toBe(false);
      first.flush({ items: [], olderThanDays: null });
      harness.detectChanges();
      const panel = harness.routeDebugElement!.query(By.directive(ReviewsPanel)).componentInstance as unknown as {
        daysText: { set(v: string): void };
      };
      panel.daysText.set('0');
      harness.detectChanges();
      http.expectNone((r) => r.url === '/authz/access-reviews/due');
      expect(text()).toContain('número entero de 1 a 3650');
      panel.daysText.set('90');
      harness.detectChanges();
      const second = http.expectOne((r) => r.url === '/authz/access-reviews/due');
      expect(second.request.params.get('olderThanDays')).toBe('90');
      second.flush({ items: [], olderThanDays: 90 });
      harness.detectChanges();
      expect(text()).toContain('se revisaron en los últimos 90 días');
    });

    interface Review {
      decision: { set(v: string): void };
      reason: { (): string; set(v: string): void };
      record(): void;
    }

    async function openReview(): Promise<Review> {
      await openReviews(`&review=${USER}`);
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush({
        items: [{ userId: USER, displayName: 'Marcos Rivero', activeAssignments: 1, lastReviewedAt: null }],
        olderThanDays: null,
      });
      http.expectOne(`/iam/users/${USER}`).flush({ displayName: 'Marcos Rivero' });
      http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment(ACTIVE, 'ACTIVE'), assignment(REVOKED, 'REVOKED')] });
      http.expectOne(`/authz/users/${USER}/access-reviews`).flush({
        userId: USER,
        items: [
          {
            id: 'r0',
            userId: USER,
            decision: 'CHANGES_REQUIRED',
            reason: 'Sobraba un rol de recepción',
            assignmentIds: [ACTIVE],
            reviewerUserId: '00000000-0000-4000-8000-00000000c001',
            reviewedAt: '2026-09-01T10:00:00.000Z',
          },
        ],
      });
      harness.detectChanges();
      return harness.routeDebugElement!.query(By.directive(ReviewDrawer)).componentInstance as unknown as Review;
    }

    it('muestra sólo las asignaciones activas y el historial de revisiones anteriores', async () => {
      await openReview();
      const drawer = drawerText('portal-review');
      expect(document.querySelectorAll('[data-testid="portal-review-assignment"]')).toHaveLength(1);
      expect(drawer).toContain('Pidió cambios');
      expect(drawer).toContain('Sobraba un rol de recepción');
      expect(drawer).toContain('1 asignación revisada');
    });

    it('no registra con un motivo corto; con uno válido manda las asignaciones activas y relee', async () => {
      const review = await openReview();
      review.reason.set('corto');
      review.record();
      harness.detectChanges();
      http.expectNone((r) => r.method === 'POST');
      expect(drawerText('portal-review')).toContain('Escriba al menos 10 caracteres');
      review.reason.set('Sus roles siguen vigentes');
      review.record();
      const post = http.expectOne((r) => r.method === 'POST' && r.url === `/authz/users/${USER}/access-reviews`);
      expect(post.request.body).toEqual({ decision: 'CERTIFIED', reason: 'Sus roles siguen vigentes', assignmentIds: [ACTIVE] });
      post.flush({ id: 'r1', userId: USER, decision: 'CERTIFIED', reason: 'x', assignmentIds: [ACTIVE], reviewerUserId: null, reviewedAt: '2026-10-31T10:00:00.000Z' });
      http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment(ACTIVE, 'ACTIVE')] });
      http.expectOne(`/authz/users/${USER}/access-reviews`).flush({ userId: USER, items: [] });
      http.expectOne((r) => r.url === '/authz/access-reviews/due').flush({ items: [], olderThanDays: null });
      harness.detectChanges();
      expect(drawerText('portal-review')).toContain('Quedó registrada la revisión');
    });

    it('revisar los propios accesos se rechaza y lo escrito se conserva', async () => {
      const review = await openReview();
      review.reason.set('Me apruebo a mí mismo');
      review.record();
      const [body, init] = failure(422, 'ACCESS_REVIEW_SELF_REVIEW', 'PRECONDITION_FAILED');
      http.expectOne((r) => r.method === 'POST').flush(body, init);
      harness.detectChanges();
      expect(drawerText('portal-review')).toContain('Nadie revisa sus propios accesos');
      expect(review.reason()).toBe('Me apruebo a mí mismo');
    });
  });
});
