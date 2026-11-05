import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { actionOptions } from '../explain-text';
import { elegir, escribir, pulsar } from '../simulator.fixtures';
import { ExplainQuestion, isoOf, partsOf, type QuestionValue } from './explain-question';

describe('isoOf / partsOf', () => {
  it('convierte fecha y hora locales en ISO y de vuelta; sin una de las dos no hay instante', () => {
    const iso = isoOf('2026-11-03', '10:30')!;
    expect(new Date(iso).getHours()).toBe(10);
    expect(partsOf(iso)).toEqual({ date: '2026-11-03', time: '10:30' });
    expect(isoOf('2026-11-03', '')).toBeUndefined();
    expect(isoOf('', '10:30')).toBeUndefined();
    expect(partsOf(undefined)).toEqual({ date: '', time: '' });
  });
});

describe('ExplainQuestion', () => {
  let fixture: ComponentFixture<ExplainQuestion>;
  let preguntas: QuestionValue[];
  let intentos: number;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    preguntas = [];
    intentos = 0;
    fixture = TestBed.createComponent(ExplainQuestion);
    fixture.componentRef.setInput('actions', actionOptions(null, true));
    fixture.componentRef.setInput('showPatient', true);
    fixture.componentRef.setInput('prefix', 'q');
    fixture.componentInstance.asked.subscribe((q) => preguntas.push(q));
    fixture.componentInstance.attempted.subscribe(() => (intentos += 1));
    await settle();
  });

  it('solo manda lo que se eligió y avisa que se intentó aunque falte la acción', async () => {
    await pulsar(host(), 'q-enviar', settle);
    expect(preguntas).toEqual([]);
    expect(intentos).toBe(1);
    expect(host().textContent).toContain('Elija qué quiso hacer.');
    await elegir(host(), 'q-accion', 'Cancelar citas', settle);
    await pulsar(host(), 'q-enviar', settle);
    expect(preguntas).toEqual([{ action: 'agenda.appointment.cancel' }]);
  });

  it('una fecha sin hora no sale: pide las dos', async () => {
    await elegir(host(), 'q-accion', 'Cancelar citas', settle);
    await escribir(host(), 'q-fecha', '2026-11-03', settle);
    await pulsar(host(), 'q-enviar', settle);
    expect(preguntas).toEqual([]);
    expect(host().textContent).toContain('Indique la fecha y también la hora.');
    await escribir(host(), 'q-hora', '10:30', settle);
    await pulsar(host(), 'q-enviar', settle);
    expect(new Date(preguntas[0]!.at!).getMinutes()).toBe(30);
  });

  it('avisa cuando se toca un campo y se rellena con los valores iniciales', async () => {
    let tocados = 0;
    fixture.componentInstance.edited.subscribe(() => (tocados += 1));
    await elegir(host(), 'q-accion', 'Crear citas', settle);
    expect(tocados).toBeGreaterThan(0);
    fixture.componentRef.setInput('initial', {
      action: 'agenda.appointment.cancel',
      patientProfileId: '5f1e8a0c-2b1d-4c3e-9f10-aabbccddeeff',
    });
    await settle();
    await pulsar(host(), 'q-enviar', settle);
    expect(preguntas[0]).toEqual({
      action: 'agenda.appointment.cancel',
      patientProfileId: '5f1e8a0c-2b1d-4c3e-9f10-aabbccddeeff',
    });
  });
});
