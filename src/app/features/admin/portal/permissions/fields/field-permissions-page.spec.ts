import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { FieldPermission } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { FieldPermissionsPage } from './field-permissions-page';
import { FieldRuleDialog } from './field-rule-dialog';
import { ScopeGrantsPanel } from './scope-grants-panel';

const SCREEN = '/superadmin/portal/governance/field-permissions';
const ROLE = 'role-dpo';
const UUID_A = '00000000-0000-4000-8000-00000000a001';
const UUID_B = '00000000-0000-4000-8000-00000000b001';

const grant = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  subjectId: UUID_A,
  permissionId: 'p-read',
  resourceId: UUID_B,
  tenantId: null,
  subjectType: 'USER',
  resourceType: 'PATIENT',
  effect: 'DENY',
  validFrom: null,
  validTo: null,
  isEffective: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('FieldPermissionsPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;

  async function open(url = SCREEN): Promise<void> {
    confirmed = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/field-permissions', component: FieldPermissionsPage }]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmed) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, FieldPermissionsPage);
    for (const req of http.match('/authz/roles')) {
      req.flush([{ id: ROLE, code: 'DPO', name: 'Protección de datos', isSystem: true, tenantId: null }]);
    }
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  afterEach(() => http.verify());

  describe('por campo', () => {
    it('sin rol elegido no pide reglas y deja agregar una sólo con rol', async () => {
      await open();
      harness.detectChanges();
      http.expectNone((r) => r.url.endsWith('/field-permissions'));
      expect(text()).toContain('Elija un rol');
      const add = harness.routeNativeElement!.querySelector('[data-testid="portal-role-fields-add"]')!;
      expect(add.getAttribute('aria-disabled')).toBe('true');
    });

    it('lista las reglas del rol con su enmascaramiento y avisa que la API no quita reglas', async () => {
      await open(`${SCREEN}?role=${ROLE}`);
      http.expectOne(`/authz/roles/${ROLE}/field-permissions`).flush({
        roleId: ROLE,
        items: [
          { entity: 'patient_profile', columnName: 'national_id', canRead: true, canWrite: false, maskStrategy: 'PARTIAL', conditionJson: null },
          { entity: 'patient_profile', columnName: 'phone', canRead: false, canWrite: false, maskStrategy: null, conditionJson: { ip: 'x' } },
        ],
      });
      harness.detectChanges();
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-role-fields-table"]')!.textContent!;
      expect(table).toContain('national_id');
      expect(table).toContain('Parcial');
      expect(table).toContain('No lee');
      expect(table).toContain('Con condición');
      expect(text()).toContain('quitar una regla no está expuesto');
    });

    it('un rol sin reglas orienta en vez de quedar mudo', async () => {
      await open(`${SCREEN}?role=${ROLE}`);
      http.expectOne(`/authz/roles/${ROLE}/field-permissions`).flush({ roleId: ROLE, items: [] });
      harness.detectChanges();
      expect(text()).toContain('no tiene reglas de campo');
    });
  });

  describe('diálogo de regla', () => {
    @Component({
      imports: [FieldRuleDialog],
      template: `<app-portal-field-rule-dialog [roleId]="role" roleName="Protección de datos" [rule]="rule()" />`,
    })
    class Host {
      readonly role = ROLE;
      readonly rule = signal<FieldPermission | null>(null);
    }

    function dialog() {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const instance = fixture.debugElement.query(By.directive(FieldRuleDialog)).componentInstance as unknown as {
        entity: { set(v: string): void };
        column: { set(v: string): void };
        canRead: { set(v: boolean): void };
        canWrite: { set(v: boolean): void };
        mask: { set(v: string): void };
        save(): void;
        problem(field: string): string;
      };
      return { fixture, instance };
    }

    it('escribir sin poder leer se avisa antes de mandar y no envía nada', () => {
      const { instance, fixture } = dialog();
      instance.entity.set('patient_profile');
      instance.column.set('phone');
      instance.canRead.set(false);
      instance.canWrite.set(true);
      instance.save();
      fixture.detectChanges();
      http.expectNone((r) => r.method === 'PUT');
      expect(instance.problem('canWrite')).toContain('tiene que poder leerlo');
    });

    it('manda el upsert con la entidad, la columna y el enmascaramiento elegidos', () => {
      const { instance } = dialog();
      instance.entity.set(' patient_profile ');
      instance.column.set('national_id');
      instance.mask.set('HASH');
      instance.save();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === `/authz/roles/${ROLE}/field-permissions`);
      expect(put.request.body).toEqual({
        fields: [{ entity: 'patient_profile', columnName: 'national_id', canRead: true, canWrite: false, maskStrategy: 'HASH' }],
      });
      put.flush({ ok: true });
    });

    it('un rechazo de la API se explica por su motivo y conserva lo escrito', () => {
      const { instance, fixture } = dialog();
      instance.entity.set('patient_profile');
      instance.column.set('phone');
      instance.save();
      http
        .expectOne((r) => r.method === 'PUT')
        .flush(
          { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', reason: 'ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      fixture.detectChanges();
      expect(document.body.textContent).toContain('tiene que poder leerse');
    });
  });

  describe('por alcance de recurso', () => {
    const catalog = {
      items: [{ id: 'p-read', code: 'AUDIT.READ', name: 'Leer la bitácora', resource: 'audit', categoryId: null, isDangerous: false, isFieldLevel: false, isRoleRestricted: false }],
      nextCursor: null,
      limit: 200,
    };

    async function openScope(): Promise<void> {
      await open(`${SCREEN}?view=scope`);
      http.expectOne((r) => r.url === '/authz/permissions').flush(catalog);
      http.expectOne((r) => r.url === '/authz/resource-scope-grants').flush({ items: [grant()], nextCursor: null, limit: 50 });
      harness.detectChanges();
    }

    const panel = () =>
      harness.routeDebugElement!.query(By.directive(ScopeGrantsPanel)).componentInstance as unknown as {
        end(g: ReturnType<typeof grant>): Promise<void>;
        subjectId: { set(v: string): void };
      };

    it('lista los permisos con el nombre del permiso, sin mostrar el UUID entero, y avisa lo de IP y horario', async () => {
      await openScope();
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-scope-table"]')!.textContent!;
      expect(table).toContain('Leer la bitácora');
      expect(table).toContain('Niega');
      expect(table).toContain('Vigente');
      expect(table).not.toContain(UUID_A);
      expect(text()).toContain('dirección IP y por horario');
    });

    it('terminar la vigencia pide confirmación, llama a DELETE y relee la lista', async () => {
      await openScope();
      await panel().end(grant());
      http.expectOne((r) => r.method === 'DELETE' && r.url === '/authz/resource-scope-grants/g1').flush({ id: 'g1', validTo: '2026-10-31T10:00:00.000Z' });
      http.expectOne((r) => r.url === '/authz/resource-scope-grants').flush({ items: [grant({ validTo: '2026-10-31T10:00:00.000Z', isEffective: false })], nextCursor: null, limit: 50 });
      harness.detectChanges();
      expect(text()).toContain('Terminó la vigencia');
    });

    it('si no se confirma no se borra nada; si otro ya la terminó, se explica y se relee', async () => {
      await openScope();
      confirmed = false;
      await panel().end(grant());
      http.expectNone((r) => r.method === 'DELETE');
      confirmed = true;
      await panel().end(grant());
      http
        .expectOne((r) => r.method === 'DELETE')
        .flush({ statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'RESOURCE_SCOPE_GRANT_ALREADY_ENDED' }, { status: 409, statusText: 'Conflict' });
      http.expectOne((r) => r.url === '/authz/resource-scope-grants').flush({ items: [], nextCursor: null, limit: 50 });
      harness.detectChanges();
      expect(text()).toContain('ya había terminado su vigencia');
    });

    it('un UUID a medias no se manda como filtro (la API respondería 400)', async () => {
      await openScope();
      panel().subjectId.set('no-es-un-uuid');
      harness.detectChanges();
      http.expectNone((r) => r.url === '/authz/resource-scope-grants');
      panel().subjectId.set(UUID_A);
      harness.detectChanges();
      const req = http.expectOne((r) => r.url === '/authz/resource-scope-grants');
      expect(req.request.params.get('subjectId')).toBe(UUID_A);
      req.flush({ items: [], nextCursor: null, limit: 50 });
    });
  });
});
