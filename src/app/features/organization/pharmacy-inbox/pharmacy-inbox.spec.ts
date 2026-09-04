import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { pharmacyOrderDtoFixture } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { PharmacyOrderDto } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.dto';
import { AlarmaDePedidos } from './alarma-de-pedidos';
import { PharmacyInbox } from './pharmacy-inbox';

describe('PharmacyInbox with the tenant API list', () => {
  let http: HttpTestingController;
  let alarm: {
    sonidoActivo: ReturnType<typeof signal<boolean>>;
    alternarSonido: ReturnType<typeof vi.fn>;
    notificar: ReturnType<typeof vi.fn>;
    descartar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    alarm = {
      sonidoActivo: signal(true),
      alternarSonido: vi.fn(),
      notificar: vi.fn(),
      descartar: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez' } },
      ],
    });
    TestBed.overrideComponent(PharmacyInbox, {
      set: { providers: [{ provide: AlarmaDePedidos, useValue: alarm }] },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function mount(items: readonly PharmacyOrderDto[]): ComponentFixture<PharmacyInbox> {
    const fixture = TestBed.createComponent(PharmacyInbox);
    fixture.detectChanges();
    const request = http.expectOne('/pharmacy/orders');
    expect(request.request.method).toBe('GET');
    request.flush({ items, count: items.length });
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<PharmacyInbox>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads the honest empty state without a demo preset gate', () => {
    const fixture = mount([]);
    expect(text(fixture)).toContain('Todavía no llegó ningún pedido');
    expect(text(fixture)).toContain('Sonido de alarma');
    fixture.destroy();
  });

  it('groups real API states and does not expose pickupCode to staff', () => {
    const submitted = pharmacyOrderDtoFixture({ pickupCode: 'SECRET' });
    const ready = pharmacyOrderDtoFixture({
      id: '00000000-0000-4000-8000-000000000009',
      status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
      pickupCode: 'ABC234',
    });
    const fixture = mount([submitted, ready]);
    const root = fixture.nativeElement as HTMLElement;
    expect([...root.querySelectorAll('.bandeja__cola')].map((node) => node.getAttribute('aria-label')))
      .toEqual(['Nuevos', 'En revisión', 'Esperando al paciente', 'Listos para retiro']);
    expect(text(fixture)).toContain('Ana Paciente');
    expect(text(fixture)).toContain('Amoxicilina');
    expect(text(fixture)).not.toContain('SECRET');
    expect(text(fixture)).not.toContain('ABC234');
    fixture.destroy();
  });

  it('treats the first load as baseline and alarms on a later poll', () => {
    vi.useFakeTimers();
    const initial = pharmacyOrderDtoFixture();
    const fixture = mount([initial]);
    expect(alarm.notificar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20_000);
    const added = pharmacyOrderDtoFixture({ id: '00000000-0000-4000-8000-000000000009' });
    http.expectOne('/pharmacy/orders').flush({ items: [initial, added], count: 2 });
    fixture.detectChanges();

    expect(alarm.notificar).toHaveBeenCalledWith(1);
    expect(text(fixture)).toContain('Llegó un pedido nuevo');
    fixture.destroy();
  });
});
