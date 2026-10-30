import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';

import { SessionStore } from '../../../../../core/auth/session.store';
import { AssignRoleDialog } from './assign-role-dialog';

const USER = '00000000-0000-4000-8000-000000000001';
const OWN_TENANT = '00000000-0000-4000-8000-0000000000t1';
const OTHER_TENANT = '00000000-0000-4000-8000-0000000000t2';

interface DialogInternals {
  form: FormGroup;
  save(): void;
  scopeOptions(): readonly { value: string; label: string }[];
}

describe('AssignRoleDialog', () => {
  let fixture: ComponentFixture<AssignRoleDialog>;
  let http: HttpTestingController;
  let assigned: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: { activeTenantId: () => OWN_TENANT, tenantName: (id: string) => id } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssignRoleDialog);
    fixture.componentRef.setInput('userId', USER);
    fixture.componentRef.setInput('userName', 'Elena Quispe');
    assigned = [];
    fixture.componentInstance.assigned.subscribe((m) => assigned.push(m));
    fixture.detectChanges();
    http.expectOne('/authz/roles').flush([{ id: 'r1', code: 'DPO', name: 'Protección de datos', isSystem: true, tenantId: null }]);
    http.expectOne((r) => r.url === '/admin/tenants').flush({
      items: [
        { id: OTHER_TENANT, code: 'B', legalName: 'Clínica B', tenantTypeConceptId: 'x', statusConceptId: 'x', verificationStatusConceptId: 'x', createdAt: '2026-01-01T00:00:00Z' },
        { id: OWN_TENANT, code: 'A', legalName: 'Clínica A', tenantTypeConceptId: 'x', statusConceptId: 'x', verificationStatusConceptId: 'x', createdAt: '2026-01-01T00:00:00Z' },
      ],
      nextCursor: null,
    });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const internals = () => fixture.componentInstance as unknown as DialogInternals;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('ofrece primero toda la plataforma y después la organización de la sesión', () => {
    expect(internals().scopeOptions().map((o) => o.label)).toEqual([
      'Toda la plataforma (sin organización)',
      'Clínica A (la de su sesión)',
      'Clínica B',
    ]);
  });

  it('sin rol elegido no llama a la API', () => {
    internals().save();
    http.expectNone((r) => r.method === 'POST');
  });

  it('en toda la plataforma no manda organización y avisa a quién se le asignó', () => {
    internals().form.setValue({ roleId: 'r1', tenantId: '', validFrom: '', validTo: '' });
    internals().save();
    const req = http.expectOne(`/authz/users/${USER}/role-assignments`);
    expect(req.request.body).toEqual({ roleId: 'r1' });
    req.flush({ id: 'a1', status: 'ACTIVE', createdAt: '2026-10-24T00:00:00Z' }, { status: 201, statusText: 'Created' });
    expect(assigned).toEqual(['Elena Quispe recibió el rol «Protección de datos».']);
  });

  it('un rol global con organización se explica por el motivo de la API, en el formulario', () => {
    internals().form.setValue({ roleId: 'r1', tenantId: OWN_TENANT, validFrom: '2026-11-01', validTo: '' });
    internals().save();
    const req = http.expectOne(`/authz/users/${USER}/role-assignments`);
    expect(req.request.body.tenantId).toBe(OWN_TENANT);
    expect(typeof req.request.body.validFrom).toBe('string');
    req.flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'Un rol de ámbito global se asigna sin tenant, sede ni consultorio',
        reason: 'ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE',
        details: { roleCode: 'DPO' },
        timestamp: '',
        path: '',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="assign-role-error"]')!;
    expect(alert.textContent).toContain('Este rol es de ámbito global');
    expect(alert.textContent).toContain('Toda la plataforma');
    expect(assigned).toEqual([]);
    expect(text()).toContain('Asignar un rol');
  });
});
