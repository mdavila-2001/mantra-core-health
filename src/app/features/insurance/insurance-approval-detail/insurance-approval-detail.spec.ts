import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { InsuranceApprovalDetail } from './insurance-approval-detail';

const ID = '11111111-1111-4111-8111-111111111111';
const URL = `/prior-authorization-requests/${ID}`;

function item(sequence: number, over: Record<string, unknown> = {}) {
  return {
    id: `i-${sequence}`,
    sequence,
    description: sequence === 1 ? 'Amoxicilina 500 mg' : 'Colágeno hidrolizado',
    requestedQuantity: '1',
    requestedAmount: sequence === 1 ? '84.00' : '210.00',
    decision: null,
    ...over,
  };
}

function detalleWire(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    origin: 'PHARMACY',
    status: 'SUBMITTED',
    decision: null,
    patient: { id: 'p-1', displayName: 'Rosa Quispe', patientCode: 'P-1', memberIdentifier: 'AF-1' },
    planName: 'Plan Oro',
    currencyCode: 'BOB',
    itemCount: 2,
    totalRequestedAmount: '294.00',
    submittedAt: '2026-09-20T12:00:00.000Z',
    decidedAt: null,
    items: [item(1), item(2)],
    ...over,
  };
}

describe('InsuranceApprovalDetail', () => {
  let fixture: ComponentFixture<InsuranceApprovalDetail>;
  let http: HttpTestingController;
  const dialogs = { confirm: vi.fn(async () => true) };

  beforeEach(() => {
    dialogs.confirm.mockClear();
    TestBed.configureTestingModule({
      imports: [InsuranceApprovalDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: dialogs },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ requestId: ID })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsuranceApprovalDetail);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector<HTMLElement>(sel);
  const qa = (sel: string) => [...el().querySelectorAll<HTMLElement>(sel)];

  function cargar(body = detalleWire()): void {
    http.expectOne(URL).flush(body);
    fixture.detectChanges();
  }

  /** Pulsa el botón de fila con ese texto en el ítem `n` (0-based). */
  function accion(n: number, texto: string): void {
    const fila = qa('[data-testid="approval-item"]')[n]!;
    const boton = [...fila.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texto),
    );
    boton!.click();
    fixture.detectChanges();
  }

  /** «No aprobar» el ítem `n` con esa cláusula, por el modal. */
  async function noAprobar(n: number, clausula: string): Promise<void> {
    accion(n, 'No aprobar');
    const campo = document.querySelector<HTMLInputElement>('input[data-testid="deny-clause"]')!;
    campo.value = clausula;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('[data-testid="deny-confirm"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const enviar = () => q('[data-testid="approval-send"]') as HTMLButtonElement;
  /** `app-button` deshabilita con `aria-disabled`, no con el atributo nativo. */
  const deshabilitado = () => enviar().getAttribute('aria-disabled') === 'true';

  it('pendiente: no deja enviar hasta decidir todos los ítems', () => {
    cargar();
    expect(qa('[data-testid="approval-item"]')).toHaveLength(2);
    expect(deshabilitado()).toBe(true);
    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain('Faltan 2 de 2');

    accion(0, 'Aprobar');
    expect(deshabilitado()).toBe(true);
    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain('Faltan 1 de 2');
  });

  it('«Aprobar los que faltan» completa sin pisar lo ya marcado como no aprobado', async () => {
    cargar();
    await noAprobar(1, 'Cláusula 9.2');
    (q('[data-testid="approve-remaining"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain('Aprobación parcial');

    enviar().click();
    await fixture.whenStable();
    const post = http.expectOne(`${URL}/determinations`);
    expect(post.request.body).toEqual({
      items: [
        { priorAuthorizationItemId: 'i-1', decision: 'APPROVED' },
        { priorAuthorizationItemId: 'i-2', decision: 'DENIED', policyClauseReference: 'Cláusula 9.2' },
      ],
    });
    post.flush({ id: 'd-1' });
    // Se relee del servidor: lo registrado no lo dice el borrador.
    http.expectOne(URL).flush(detalleWire({ status: 'DETERMINED', decision: 'PARTIAL' }));
  });

  it('todo aprobado: manda aprobación completa', async () => {
    cargar();
    (q('[data-testid="approve-remaining"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain('Aprobación completa');
    enviar().click();
    await fixture.whenStable();
    const post = http.expectOne(`${URL}/determinations`);
    expect(post.request.body.items.every((i: { decision: string }) => i.decision === 'APPROVED')).toBe(true);
    post.flush({ id: 'd-1' });
    http.expectOne(URL).flush(detalleWire({ status: 'DETERMINED', decision: 'APPROVED' }));
  });

  it('«No aprobar» pide la cláusula y la manda con el ítem', async () => {
    cargar();
    accion(0, 'Aprobar');
    accion(1, 'No aprobar');

    // El modal no confirma sin cláusula.
    const confirmar = document.querySelector<HTMLButtonElement>('[data-testid="deny-confirm"]')!;
    confirmar.click();
    fixture.detectChanges();
    expect(document.querySelector('[data-testid="deny-confirm"]')).not.toBeNull();

    const clausula = document.querySelector<HTMLInputElement>('[data-testid="deny-clause"] input, input[data-testid="deny-clause"]')!;
    clausula.value = 'Cláusula 9.2 — suplementos excluidos';
    clausula.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirmar.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain(
      'Aprobación parcial: 1 aprobado y 1 no aprobado',
    );
    expect(el().textContent).toContain('Cláusula 9.2 — suplementos excluidos');

    enviar().click();
    await fixture.whenStable();
    expect(dialogs.confirm).toHaveBeenCalledOnce();
    const post = http.expectOne(`${URL}/determinations`);
    expect(post.request.body).toEqual({
      items: [
        { priorAuthorizationItemId: 'i-1', decision: 'APPROVED' },
        {
          priorAuthorizationItemId: 'i-2',
          decision: 'DENIED',
          policyClauseReference: 'Cláusula 9.2 — suplementos excluidos',
        },
      ],
    });
    post.flush({ id: 'd-1' });
    http.expectOne(URL).flush(detalleWire({ status: 'DETERMINED', decision: 'PARTIAL' }));
  });

  it('422 (ya la respondió alguien): no deja reintentar, relee y muestra lo registrado', async () => {
    cargar();
    (q('[data-testid="approve-remaining"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    enviar().click();
    await fixture.whenStable();
    http.expectOne(`${URL}/determinations`).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La solicitud no admite determinación en su estado actual',
        timestamp: '2026-09-26T12:00:00.000Z',
        path: URL,
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    http.expectOne(URL).flush(detalleWire({ status: 'DETERMINED', decision: 'DENIED' }));
    fixture.detectChanges();
    expect(q('[data-testid="approval-send"]')).toBeNull();
    expect(q('[data-testid="approval-status"]')?.textContent).toContain('No aprobada');
  });

  it('un error reintentable (500) conserva el borrador y dice por qué', async () => {
    cargar();
    (q('[data-testid="approve-remaining"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    enviar().click();
    await fixture.whenStable();
    http.expectOne(`${URL}/determinations`).flush(
      { code: 'INTERNAL', message: 'Falló el servidor', timestamp: '', path: URL },
      { status: 500, statusText: 'Internal Server Error' },
    );
    fixture.detectChanges();
    expect(q('[data-testid="approval-send-error"]')?.textContent).toContain('Falló el servidor');
    expect(q('[data-testid="approval-outcome"]')?.textContent).toContain('Aprobación completa');
    expect(deshabilitado()).toBe(false);
  });

  it('respondida: muestra la decisión y la cláusula de cada ítem, sin acciones', () => {
    cargar(
      detalleWire({
        status: 'DETERMINED',
        decision: 'PARTIAL',
        decidedAt: '2026-09-21T12:00:00.000Z',
        items: [
          item(1, {
            decision: {
              decision: 'APPROVED',
              approvedQuantity: '1',
              approvedAmount: '84.00',
              policyClauseReference: null,
              denialRationale: null,
              decidedAt: '2026-09-21T12:00:00.000Z',
            },
          }),
          item(2, {
            decision: {
              decision: 'DENIED',
              approvedQuantity: null,
              approvedAmount: null,
              policyClauseReference: 'Cláusula 9.2',
              denialRationale: 'Sin indicación terapéutica',
              decidedAt: '2026-09-21T12:00:00.000Z',
            },
          }),
        ],
      }),
    );
    expect(q('[data-testid="approval-status"]')?.textContent).toContain('Aprobación parcial');
    const decisiones = qa('[data-testid="approval-item-decision"]').map((c) => c.textContent?.trim());
    expect(decisiones).toEqual(['Aprobado', 'No aprobado']);
    const motivos = qa('[data-testid="approval-item-reason"]').map((c) => c.textContent);
    expect(motivos[1]).toContain('Cláusula 9.2');
    expect(motivos[1]).toContain('Sin indicación terapéutica');
    expect(q('[data-testid="approval-send"]')).toBeNull();
    expect(qa('app-row-actions')).toHaveLength(0);
  });

  it('403 (ajena o inexistente): S6 sin datos y con salida a la bandeja', () => {
    http.expectOne(URL).flush(
      { code: 'FORBIDDEN', message: 'No hay acceso a esa solicitud de seguro', timestamp: '', path: URL },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(q('[data-testid="approval-header"]')).toBeNull();
    expect(el().textContent).toContain('No encontramos lo que buscás');
    expect(el().textContent).not.toContain('No tenés acceso');
    const salida = [...el().querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
      a.textContent?.includes('Volver a la bandeja'),
    );
    expect(salida?.getAttribute('href')).toBe('/administration/insurance-approvals');
  });
});
