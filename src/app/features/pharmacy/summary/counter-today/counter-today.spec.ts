import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  EstadoDePedido,
  PedidoFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { CounterToday } from './counter-today';

/** Only `estado` matters to the counter; the rest of the order is irrelevant here. */
function orders(...states: EstadoDePedido[]): readonly PedidoFarmacia[] {
  return states.map((estado, i) => ({ id: `o-${i}`, estado }) as unknown as PedidoFarmacia);
}

function mount(response: Observable<readonly PedidoFarmacia[]>): HTMLElement {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PharmacyOrdersClient, useValue: { pedidosDeFarmacia: () => response } },
    ],
  });
  const fixture = TestBed.createComponent(CounterToday);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

describe('CounterToday', () => {
  it('counts open orders per inbox queue and leaves closed ones out', () => {
    const root = mount(
      of(orders('ENVIADO', 'ENVIADO', 'EN_REVISION', 'CONFIRMADO', 'ACEPTADO', 'LISTO_PARA_RETIRO', 'RETIRADO')),
    );
    expect(text(root, 'counter-today-NUEVOS')).toBe('2');
    expect(text(root, 'counter-today-EN_REVISION')).toBe('1');
    expect(text(root, 'counter-today-ESPERANDO_PACIENTE')).toBe('0');
    expect(text(root, 'counter-today-EN_PREPARACION')).toBe('2');
    expect(text(root, 'counter-today-LISTOS')).toBe('1');
    expect(root.querySelector('[data-testid="counter-today-CERRADOS"]')).toBeNull();
    expect(text(root, 'counter-today-lead')).toContain('Llegaron 2 solicitudes nuevas');
  });

  it('says so when there is nothing open, and still links to the inbox', () => {
    const root = mount(of(orders('RETIRADO', 'CANCELADO')));
    expect(text(root, 'counter-today-lead')).toContain('Sin solicitudes abiertas');
    expect(root.querySelector('[data-testid="counter-today-go"]')?.getAttribute('href')).toBe(
      '/administration/pharmacy-orders',
    );
  });

  it('shows the error state instead of zeros when the API fails', () => {
    const root = mount(throwError(() => new Error('network')));
    expect(root.querySelector('[data-testid="counter-today-NUEVOS"]')).toBeNull();
    expect(root.querySelector('[data-testid="counter-today-lead"]')).toBeNull();
  });
});
