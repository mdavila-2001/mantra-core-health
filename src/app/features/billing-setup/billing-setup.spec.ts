import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { AccountingClient } from '../../core/data-access/accounting/accounting.client';
import { AccountingPractices } from '../../core/data-access/accounting/accounting-practices';
import type { Practice } from '../../core/data-access/accounting/accounting.types';
import { BillingSimulatedClient } from '../../core/data-access/billing-simulated/billing-simulated.client';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { BillingSetup } from './billing-setup';

const PRACTICE = { id: 'pr-1', code: 'P1', name: 'Consultorio propio' } as Practice;

describe('BillingSetup', () => {
  let fixture: ComponentFixture<BillingSetup>;

  function mount(practices: readonly Practice[]): HTMLElement {
    TestBed.configureTestingModule({
      imports: [BillingSetup],
      providers: [
        provideRouter([]),
        { provide: AccountingPractices, useValue: { list: () => of(practices) } },
        { provide: AccountingClient, useValue: { fiscalYear: () => NEVER } },
        { provide: ServicesCatalogClient, useValue: { search: () => NEVER, update: () => NEVER } },
        { provide: BillingSimulatedClient, useValue: { status: () => NEVER } },
      ],
    });
    fixture = TestBed.createComponent(BillingSetup);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con práctica: una sola tarjeta con las tres pestañas', () => {
    const host = mount([PRACTICE]);
    expect(host.querySelectorAll('app-card')).toHaveLength(1);
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent!.trim());
    expect(tabs).toEqual(['Ejercicio fiscal', 'Precio de la consulta', 'Emisor de facturas']);
    expect(host.querySelector('app-fiscal-year-block')).not.toBeNull();
  });

  it('con una sola práctica no pregunta cuál', () => {
    const host = mount([PRACTICE]);
    expect(host.querySelector('[data-testid="billing-setup-practice"]')).toBeNull();
  });

  it('con dos prácticas ofrece elegir', () => {
    const host = mount([PRACTICE, { ...PRACTICE, id: 'pr-2', name: 'Clínica' }]);
    expect(host.querySelector('[data-testid="billing-setup-practice"]')).not.toBeNull();
  });

  it('sin práctica activa: el aviso de agregar un lugar de atención, sin tarjeta', () => {
    const host = mount([]);
    expect(host.querySelector('app-card')).toBeNull();
    expect(host.textContent).toContain('Todavía no tiene un lugar de atención activo');
  });
});
