import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccountClinicalAccess } from './clinical-access';

const RELACION = {
  id: 'r-1',
  tenantId: 't-1',
  practitionerProfileId: 'h-1',
  practitionerName: 'Dra. Valeria Rojas',
  state: 'ACTIVE',
  validFrom: '2026-01-01T12:00:00.000Z',
};

const EMERGENCIA = {
  id: 'g-1',
  tenantId: 't-1',
  grantedUserId: 'u-9',
  grantedName: 'Dr. Luis Paz',
  isEmergency: true,
  state: 'ACTIVE',
  validFrom: '2026-09-26T09:00:00.000Z',
  validTo: '2026-09-26T10:00:00.000Z',
};

/**
 * BR-20 · «Quién ve mi historia»: la médica por nombre, desde cuándo y hasta
 * cuándo; los accesos de emergencia marcados; revocar confirma y relee.
 */
describe('AccountClinicalAccess (BR-20)', () => {
  let fixture: ComponentFixture<AccountClinicalAccess>;
  let http: HttpTestingController;
  const avisos: string[] = [];

  beforeEach(() => {
    avisos.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(true) } },
        {
          provide: ToastService,
          useValue: {
            success: (texto: string) => avisos.push(texto),
            warning: (texto: string) => avisos.push(texto),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountClinicalAccess);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Las pestañas montan sólo el panel activo: para ver la otra hay que elegirla. */
  function abrirPestana(indice: number): void {
    const botones = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;
    botones[indice]?.click();
    fixture.detectChanges();
  }

  function responder(body: { careRelationships: readonly unknown[]; grants: readonly unknown[] }): void {
    http.expectOne('/authz/me/access').flush(body);
    fixture.detectChanges();
  }

  it('muestra a la médica por nombre, desde cuándo y hasta cuándo', () => {
    responder({ careRelationships: [RELACION], grants: [] });

    const fila = fixture.nativeElement.querySelector('[data-testid="relacion-r-1"]') as HTMLElement;
    expect(fila.textContent).toContain('Dra. Valeria Rojas');
    expect(fila.textContent).toContain('Desde el 01/01/2026');
    expect(fila.textContent).toContain('Sin fecha de fin');
  });

  it('un acceso de emergencia se marca como tal y avisa arriba', () => {
    responder({ careRelationships: [], grants: [EMERGENCIA] });

    expect(fixture.nativeElement.querySelector('[data-testid="acceso-aviso-emergencia"]')).not.toBeNull();
    // La marca «Emergencia» de cada acceso vive en la pestaña de accesos.
    abrirPestana(1);
    expect(fixture.nativeElement.querySelector('[data-testid="acceso-g-1"]')?.textContent).toContain('Emergencia');
  });

  it('revocar el vínculo confirma, llama a la ruta del titular y relee: ya figura revocado', async () => {
    responder({ careRelationships: [RELACION], grants: [] });

    (fixture.nativeElement.querySelector('[data-testid="relacion-revocar-r-1"]') as HTMLElement).click();
    await fixture.whenStable();

    const revocacion = http.expectOne('/authz/me/care-relationships/r-1/revoke');
    expect(revocacion.request.method).toBe('POST');
    revocacion.flush({ ok: true });

    responder({ careRelationships: [{ ...RELACION, state: 'REVOKED', validTo: '2026-09-26T10:00:00.000Z' }], grants: [] });
    expect(fixture.nativeElement.textContent).toContain('Revocado');
    expect(fixture.nativeElement.querySelector('[data-testid="relacion-revocar-r-1"]')).toBeNull();
  });

  it('revocar un acceso concedido usa la ruta de grants del titular', async () => {
    responder({ careRelationships: [], grants: [EMERGENCIA] });
    abrirPestana(1);

    (fixture.nativeElement.querySelector('[data-testid="acceso-revocar-g-1"]') as HTMLElement).click();
    await fixture.whenStable();

    http.expectOne('/authz/me/clinical-access-grants/g-1/revoke').flush({ ok: true });
    responder({ careRelationships: [], grants: [{ ...EMERGENCIA, state: 'REVOKED' }] });
  });

  it('estado vacío y sin permiso se dicen con palabras', () => {
    responder({ careRelationships: [], grants: [] });
    expect(fixture.nativeElement.textContent).toContain('Ningún profesional está vinculado');
  });

  it('un 403 se dice como «sección para pacientes»', () => {
    http
      .expectOne('/authz/me/access')
      .flush({ code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="acceso-sin-permiso"]')).not.toBeNull();
  });
});
