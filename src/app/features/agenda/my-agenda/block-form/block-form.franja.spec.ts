import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockForm } from './block-form';
import { atajoActivo, duracionDeFranja, errorDeHora, resumenDeBloqueo } from './block-form.franja';
import type { BloqueoPedido } from './block-form.types';

/**
 * Time picker, presets and live summary of the block form (2026-11-06).
 * The times stopped being free `HH:MM` text and became `type="time"`; what is
 * pinned here is that the form still emits the same instants and says, before
 * confirming, what it is about to close.
 */
describe('block-form.franja', () => {
  it('measures the daily range and rejects an inverted one', () => {
    expect(duracionDeFranja('08:00', '12:00')).toBe('4 h');
    expect(duracionDeFranja('14:00', '18:30')).toBe('4 h 30 min');
    expect(duracionDeFranja('12:00', '12:45')).toBe('45 min');
    expect(duracionDeFranja('18:00', '14:00')).toBeNull();
    expect(duracionDeFranja('', '14:00')).toBeNull();
  });

  it('flags an inverted end time right away, a missing one only after submit', () => {
    expect(errorDeHora('13:00', '14:00', false)).toContain('posterior');
    expect(errorDeHora('', '14:00', false)).toBeNull();
    expect(errorDeHora('', '14:00', true)).toContain('Elija una hora');
    expect(errorDeHora('18:00', '14:00', false)).toBeNull();
  });

  it('marks the preset that matches the current range', () => {
    expect(atajoActivo('14:00', '18:00')).toBe('Tarde');
    expect(atajoActivo('14:00', '18:05')).toBeNull();
  });

  it('summarises days and the part of each day', () => {
    const r = resumenDeBloqueo(
      new Date(2026, 10, 10),
      new Date(2026, 10, 24),
      { desde: '14:00', hasta: '18:30' },
      'en-US',
    );
    expect(r?.cuanto).toBe(
      '15 días, los dos extremos incluidos · de 14:00 a 18:30 (4 h 30 min) en cada uno',
    );

    const unDia = resumenDeBloqueo(new Date(2026, 10, 10), new Date(2026, 10, 10), null, 'en-US');
    expect(unDia?.cuanto).toBe('1 día · el día entero');
    expect(
      resumenDeBloqueo(new Date(2026, 10, 10), new Date(2026, 10, 9), null, 'en-US'),
    ).toBeNull();
  });
});

/** The component's protected surface, typed (no `any` in specs). */
interface Testable {
  readonly desde: { set(v: Date | null): void };
  readonly hasta: { set(v: Date | null): void; (): Date | null };
  readonly porFranja: { set(v: boolean): void };
  readonly horaDesde: { set(v: string): void; (): string };
  readonly horaHasta: { set(v: string): void; (): string };
  elegirDesde(v: Date | null): void;
  aplicarAtajo(a: { rotulo: string; desde: string; hasta: string }): void;
  enviar(): void;
}

describe('BlockForm · time picker', () => {
  let fixture: ComponentFixture<BlockForm>;
  const api = (): Testable => fixture.componentInstance as unknown as Testable;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BlockForm] }).compileComponents();
    fixture = TestBed.createComponent(BlockForm);
    fixture.detectChanges();
  });

  it('renders both times as a 5-minute time picker', () => {
    api().porFranja.set(true);
    fixture.detectChanges();

    const campos = fixture.nativeElement.querySelectorAll(
      'input[type="time"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(campos).toHaveLength(2);
    expect(campos[0].getAttribute('step')).toBe('300');
    expect(campos[0].value).toBe('14:00');
    expect(campos[1].value).toBe('18:00');
  });

  it('gives both date pickers a visible label', () => {
    const rotulos = Array.from(
      fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLElement>,
    ).map((l) => l.textContent?.trim() ?? '');
    expect(rotulos.some((r) => r.startsWith('Primer día'))).toBe(true);
    expect(rotulos.some((r) => r.startsWith('Último día'))).toBe(true);
  });

  it('a preset fills both times', () => {
    api().aplicarAtajo({ rotulo: 'Mañana', desde: '08:00', hasta: '12:00' });
    expect(api().horaDesde()).toBe('08:00');
    expect(api().horaHasta()).toBe('12:00');
  });

  it('picking the first day fills the last one when empty or earlier', () => {
    api().elegirDesde(new Date(2026, 10, 10));
    expect(api().hasta()?.getDate()).toBe(10);

    api().hasta.set(new Date(2026, 10, 20));
    api().elegirDesde(new Date(2026, 10, 12));
    expect(api().hasta()?.getDate()).toBe(20);

    api().elegirDesde(new Date(2026, 10, 25));
    expect(api().hasta()?.getDate()).toBe(25);
  });

  it('emits the same instants as before for a time range', () => {
    api().desde.set(new Date(2026, 10, 10));
    api().hasta.set(new Date(2026, 10, 12));
    api().porFranja.set(true);
    api().horaDesde.set('09:00');
    api().horaHasta.set('12:00');

    let emitido: BloqueoPedido | null = null;
    fixture.componentInstance.bloquear.subscribe((p: BloqueoPedido) => (emitido = p));
    api().enviar();

    expect(emitido!.franjaHoraria).toBe(true);
    expect(emitido!.desde.getHours()).toBe(9);
    expect(emitido!.hasta.getHours()).toBe(12);
    expect(emitido!.hasta.getDate()).toBe(12);
  });

  it('whole days still end at the midnight after the last day', () => {
    api().desde.set(new Date(2026, 10, 10));
    api().hasta.set(new Date(2026, 10, 12));

    let emitido: BloqueoPedido | null = null;
    fixture.componentInstance.bloquear.subscribe((p: BloqueoPedido) => (emitido = p));
    api().enviar();

    expect(emitido!.franjaHoraria).toBe(false);
    expect(emitido!.hasta.getDate()).toBe(13);
    expect(emitido!.hasta.getHours()).toBe(0);
  });
});
