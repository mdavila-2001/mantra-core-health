import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccountPrivacy } from './privacy';

const ACTIVO = {
  id: 'c-activo',
  state: 'ACTIVE',
  purpose: { id: 'p-1', name: 'Tratamiento y atención médica' },
  validFrom: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const RETIRADO = {
  id: 'c-retirado',
  state: 'WITHDRAWN',
  purpose: { id: 'p-2', name: 'Investigación' },
  validFrom: '2025-01-01T00:00:00.000Z',
  validTo: '2025-06-01T00:00:00.000Z',
  withdrawnAt: '2025-06-01T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
};

/**
 * BR-20 · «Mi privacidad»: UI → request → response → persistencia → recarga → UI.
 * Retirar relee la lista y el registro figura «Retirado»; no se borra.
 */
describe('AccountPrivacy (BR-20)', () => {
  let fixture: ComponentFixture<AccountPrivacy>;
  let http: HttpTestingController;
  let confirmar: boolean;
  const avisos: string[] = [];

  beforeEach(() => {
    confirmar = true;
    avisos.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmar) } },
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
    fixture = TestBed.createComponent(AccountPrivacy);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responderLecturas(consentimientos: readonly unknown[]): void {
    http.expectOne('/consent/me/consents').flush({ items: consentimientos });
    http.expectOne('/consent/me/hipaa-authorizations').flush({ items: [] });
    http.expectOne('/consent/me/objections').flush({ items: [] });
    http.expectOne('/consent/me/treatment-informed-consents').flush({ items: [] });
    fixture.detectChanges();
  }

  it('muestra el consentimiento vigente y el retirado, cada uno con su estado y su propósito', () => {
    responderLecturas([ACTIVO, RETIRADO]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Tratamiento y atención médica');
    expect(texto).toContain('Vigente');
    expect(texto).toContain('Investigación');
    expect(texto).toContain('Retirado');
    // Sólo el vigente ofrece «Retirar».
    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-retirar-c-activo"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-retirar-c-retirado"]')).toBeNull();
  });

  it('retirar confirma, llama a la ruta del titular y RELEE la lista (el registro queda «Retirado»)', async () => {
    responderLecturas([ACTIVO]);

    (fixture.nativeElement.querySelector('[data-testid="consentimiento-retirar-c-activo"]') as HTMLElement).click();
    await fixture.whenStable();

    const retiro = http.expectOne('/consent/me/consents/c-activo/withdraw');
    expect(retiro.request.method).toBe('POST');
    retiro.flush({ ok: true });

    // Se relee: lo que prueba el retiro es la fila releída.
    responderLecturas([{ ...ACTIVO, state: 'WITHDRAWN', withdrawnAt: '2026-09-26T10:00:00.000Z' }]);
    expect(fixture.nativeElement.textContent).toContain('Retirado');
    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-retirar-c-activo"]')).toBeNull();
    expect(avisos).toContain('Retiraste el consentimiento.');
  });

  it('si se cancela la confirmación no se llama a la API', async () => {
    confirmar = false;
    responderLecturas([ACTIVO]);

    (fixture.nativeElement.querySelector('[data-testid="consentimiento-retirar-c-activo"]') as HTMLElement).click();
    await fixture.whenStable();

    http.expectNone('/consent/me/consents/c-activo/withdraw');
  });

  it('estado vacío: dice qué pasa en vez de una lista en blanco', () => {
    responderLecturas([]);

    expect(fixture.nativeElement.textContent).toContain('Todavía no diste ningún consentimiento');
  });

  it('un 403 (cuenta sin perfil de paciente) se dice como tal', () => {
    http
      .expectOne('/consent/me/consents')
      .flush({ code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    // El primer error cancela las otras lecturas del `forkJoin`.
    for (const pedido of http.match(() => true)) {
      if (!pedido.cancelled) pedido.flush({ items: [] });
    }
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esta sección es para pacientes');
  });

  it('un error de servidor ofrece reintentar y muestra el ID de la petición', () => {
    http
      .expectOne('/consent/me/consents')
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-77' },
        { status: 500, statusText: 'Server Error' },
      );
    // El primer error cancela las otras lecturas del `forkJoin`.
    for (const pedido of http.match(() => true)) {
      if (!pedido.cancelled) pedido.flush({ items: [] });
    }
    fixture.detectChanges();

    const alerta = fixture.nativeElement.querySelector('[data-testid="privacidad-error"]') as HTMLElement;
    expect(alerta.textContent).toContain('Reintentar');
    expect(alerta.textContent).toContain('req-77');
  });
});
