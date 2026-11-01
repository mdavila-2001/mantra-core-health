import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RequestThread } from '../my-verifications.model';
import { RequestInbox } from './request-inbox';

/**
 * La bandeja de solicitudes de verificación (a instituciones y aseguradoras),
 * como un chat: una conversación por solicitud y el hilo abierto con lo que se
 * pidió y lo que respondieron. Sin elección abre la primera. Retirar y volver a
 * pedir sólo se ofrecen cuando el hilo lo permite, y no mientras se trabaja.
 */

function hilo(id: string, partial: Partial<RequestThread> = {}): RequestThread {
  return {
    id,
    kind: 'institution',
    counterpart: `Hospital ${id}`,
    state: 'pending',
    stateLabel: 'Esperando respuesta',
    lastAt: new Date('2026-10-30T12:00:00Z'),
    preview: `Pidió confirmar su cargo en ${id}`,
    messages: [
      { speaker: 'me', text: 'Trabajé ahí de 2020 a 2024.', at: new Date('2026-10-29T10:00:00Z'), ticks: 'sent' },
      { speaker: 'them', text: 'Confirmado.', at: null, seal: 'approved' },
    ],
    canWithdraw: true,
    canRequestAgain: false,
    ...partial,
  } as RequestThread;
}

describe('RequestInbox', () => {
  let fixture: ComponentFixture<RequestInbox>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  function pintar(threads: readonly RequestThread[], busy = false): void {
    fixture = TestBed.createComponent(RequestInbox);
    fixture.componentRef.setInput('threads', threads);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('sin elección abre la primera conversación y la marca como actual', () => {
    pintar([hilo('a'), hilo('b', { kind: 'insurer', counterpart: 'Seguros Andinos' })]);
    expect(q('verif-hilo-a')?.getAttribute('aria-current')).toBe('true');
    expect(q('verif-hilo-b')?.hasAttribute('aria-current')).toBe(false);
    expect(q('verif-hilo-abierto')?.getAttribute('aria-label')).toBe('Conversación con Hospital a');
    expect(q('verif-hilo-b')?.textContent).toContain('Aseguradora');
  });

  it('tocar otra conversación la abre y actualiza el modelo', () => {
    pintar([hilo('a'), hilo('b')]);
    q('verif-hilo-b')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.openId()).toBe('b');
    expect(q('verif-hilo-abierto')?.textContent).toContain('Hospital b');
  });

  it('cada mensaje dice quién habla al lector, y el sello de la respuesta', () => {
    pintar([hilo('a')]);
    const mios = q('verif-mensaje-me')!;
    expect(mios.querySelector('.sr-only')?.textContent).toBe('Usted: ');
    expect(mios.textContent).toContain('Enviada');
    const suyos = q('verif-mensaje-them')!;
    expect(suyos.querySelector('.sr-only')?.textContent).toBe('Hospital a: ');
    expect(suyos.querySelector('app-status-seal')).not.toBeNull();
  });

  it('retirar emite el hilo; volver a pedir sólo aparece si se puede', () => {
    pintar([hilo('a')]);
    const retirados: RequestThread[] = [];
    fixture.componentInstance.withdraw.subscribe((h) => retirados.push(h));
    q('verif-retirar')!.click();
    expect(retirados.map((h) => h.id)).toEqual(['a']);
    expect(q('verif-volver-a-pedir')).toBeNull();

    pintar([hilo('a', { canWithdraw: false, canRequestAgain: true })]);
    expect(q('verif-retirar')).toBeNull();
    expect(q('verif-volver-a-pedir')).not.toBeNull();
  });

  it('mientras trabaja, las acciones se apagan', () => {
    pintar([hilo('a', { canRequestAgain: true })], true);
    expect(q('verif-retirar')?.getAttribute('aria-disabled')).toBe('true');
    expect(q('verif-volver-a-pedir')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('una institución ofrece ir a la trayectoria; una aseguradora no', () => {
    pintar([hilo('a')]);
    expect(root().querySelector('a[href="/my-account"]')).not.toBeNull();
    pintar([hilo('a', { kind: 'insurer' })]);
    expect(root().querySelector('a[href="/my-account"]')).toBeNull();
  });
});
