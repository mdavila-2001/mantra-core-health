import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DiagnosticUnitsClient } from '../../../../../core/data-access/diagnostic-units/diagnostic-units.client';
import { OrganizationLogoClient } from '../../../../../core/data-access/directory/organization-logo.client';
import { OrderReferralClient } from '../../../../../core/data-access/diagnostics/order-referral.client';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { OrderReferralDialog } from './order-referral-dialog';

const CENTERS = {
  items: [
    { id: 'u1', code: 'LABCEN', name: 'Laboratorio Central', tenantId: 't-lab', type: { code: 'LABORATORY', display: 'Laboratorio' }, cities: ['Santa Cruz'], rating: 4.8 },
    { id: 'u2', code: 'IMG-SUR', name: 'Centro de Imagen Sur', tenantId: 't-img', type: { code: 'IMAGING', display: 'Imagenología' }, cities: [], rating: null },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

interface Internal {
  chosen: { set: (v: string | null) => void };
  send: () => void;
  error: () => string | null;
  sending: () => boolean;
  centers: () => { status: string };
}

describe('OrderReferralDialog (el médico deriva una orden)', () => {
  let search: ReturnType<typeof vi.fn>;
  let referOrder: ReturnType<typeof vi.fn>;
  const toasts = { success: vi.fn(), error: vi.fn() };
  const referred = vi.fn();

  function create() {
    toasts.success.mockReset();
    referred.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: DiagnosticUnitsClient, useValue: { search } },
        { provide: OrderReferralClient, useValue: { referOrder } },
        { provide: ToastService, useValue: toasts },
        { provide: OrganizationLogoClient, useValue: { getUrl: () => of(null) } },
      ],
    });
    const fixture = TestBed.createComponent(OrderReferralDialog);
    fixture.componentRef.setInput('orderId', 'o-1');
    fixture.componentRef.setInput('studyLabel', 'Hemograma');
    fixture.componentInstance.referred.subscribe(referred);
    fixture.detectChanges();
    return fixture;
  }
  const internal = (f: { componentInstance: unknown }) => f.componentInstance as Internal;

  beforeEach(() => {
    search = vi.fn(() => of(CENTERS));
    referOrder = vi.fn(() => of({ orderId: 'o-1', status: 'PENDING', performerName: 'Laboratorio Central' }));
  });

  it('lista los centros y dice que el paciente tiene que aceptar', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(search).toHaveBeenCalledWith({ limit: 20 });
    expect(el.textContent).toContain('Laboratorio Central');
    expect(el.textContent).toContain('Centro de Imagen Sur');
    expect(el.textContent).toContain('El paciente tiene que aceptar');
  });

  it('buscar por nombre pide ese texto, suelta lo elegido y avisa si no hay coincidencias', () => {
    const fixture = create();
    internal(fixture).chosen.set('t-lab');
    search.mockReturnValue(of({ items: [], total: 0, limit: 20, offset: 0 }));

    (fixture.componentInstance as unknown as { searchCenters: (q: string) => void }).searchCenters('  zzz ');
    fixture.detectChanges();

    expect(search).toHaveBeenLastCalledWith({ limit: 20, q: 'zzz' });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="derivar-vacio"]')).not.toBeNull();
    internal(fixture).send();
    expect(referOrder).not.toHaveBeenCalled();
  });

  it('cada centro es una tarjeta con su identidad, y elegirla habilita «Derivar»', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const tarjetas = el.querySelectorAll('label.centro');
    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0]?.querySelector('app-organization-identity')?.textContent).toContain('Laboratorio Central');

    const radio = tarjetas[1]!.querySelector<HTMLInputElement>('input[type="radio"]')!;
    radio.click();
    fixture.detectChanges();

    expect(internal(fixture).chosen).toBeDefined();
    expect(tarjetas[1]?.classList).toContain('centro--elegido');
    expect(el.querySelector('[data-testid="derivar-enviar"]')?.getAttribute('aria-disabled')).toBe('false');
  });

  it('«Derivar» sin elegir un centro no hace nada', () => {
    const fixture = create();
    internal(fixture).send();
    expect(referOrder).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="derivar-enviar"]')
        ?.getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('deriva la orden al centro elegido, avisa que queda pendiente y se lo dice al padre', () => {
    const fixture = create();
    internal(fixture).chosen.set('t-lab');
    internal(fixture).send();

    expect(referOrder).toHaveBeenCalledExactlyOnceWith('o-1', 't-lab');
    expect(toasts.success).toHaveBeenCalledWith(
      'Derivada a Laboratorio Central. Queda pendiente de que el paciente la acepte.',
    );
    expect(referred).toHaveBeenCalledTimes(1);
  });

  it('mientras se envía no se manda otra vez (doble envío)', () => {
    const pendiente = new Subject<{ orderId: string; status: string; performerName: string }>();
    referOrder.mockReturnValue(pendiente);
    const fixture = create();
    internal(fixture).chosen.set('t-lab');
    internal(fixture).send();
    internal(fixture).send();

    expect(referOrder).toHaveBeenCalledTimes(1);
    expect(internal(fixture).sending()).toBe(true);
  });

  it('si la API rechaza (409), dice por qué y conserva el centro elegido', () => {
    referOrder.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { statusCode: 409, code: 'CONFLICT', message: 'La orden ya está derivada y espera la aceptación del paciente.' },
          }),
      ),
    );
    const fixture = create();
    internal(fixture).chosen.set('t-lab');
    internal(fixture).send();

    expect(internal(fixture).error()).toBe('La orden ya está derivada y espera la aceptación del paciente.');
    expect(internal(fixture).sending()).toBe(false);
    expect(referred).not.toHaveBeenCalled();
  });

  it('si no se pueden traer los centros, lo dice y deja reintentar', () => {
    search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="derivar-sin-centros"]')).not.toBeNull();
    expect(internal(fixture).centers().status).not.toBe('ready');
  });
});
