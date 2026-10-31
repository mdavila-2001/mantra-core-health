import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AgendaTimeline } from './agenda-timeline';
import type { AgendaColumn } from './agenda-grouping';
import type { AgendaEvent } from './agenda-model';
import { HP, agenda, item } from './agenda.fixtures';
import { mergeAgendas } from './agenda-model';

const local = (dia: number, hora: number, minuto = 0): string => new Date(2026, 10, dia, hora, minuto).toISOString();

const DATA = mergeAgendas([
  {
    org: HP,
    agenda: agenda([
      item('a', { start: local(3, 9), end: local(3, 9, 30), status: 'BOOKED' }),
      // Se solapa con la anterior: cae en un segundo carril.
      item('b', { start: local(3, 9, 15), end: local(3, 9, 45), status: 'BOOKED' }),
    ]),
  },
]);

const GRUPOS: readonly AgendaColumn<AgendaEvent>[] = [{ key: 'd-1', label: 'Dr. Pérez', items: DATA.events }];

@Component({
  imports: [AgendaTimeline],
  template: `<app-agenda-timeline
    [groups]="grupos"
    [days]="dias"
    [window]="ventana"
    [now]="ahora"
    [doctors]="doctores"
    [touch]="tactil()"
    rowKind="Doctor"
    ariaLabel="Línea de tiempo"
  />`,
})
class Host {
  readonly grupos = GRUPOS;
  readonly dias = [new Date(2026, 10, 3)];
  readonly ventana = { startMin: 8 * 60, endMin: 18 * 60 };
  readonly ahora = new Date(2026, 10, 2, 8);
  readonly doctores = DATA.doctors;
  readonly tactil = signal(false);
}

describe('AgendaTimeline: el alto de las barras', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  function pintar(tactil: boolean): { readonly raiz: HTMLElement; readonly barras: HTMLElement[]; readonly pista: HTMLElement } {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.tactil.set(tactil);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    return {
      raiz,
      barras: Array.from(raiz.querySelectorAll<HTMLElement>('.linea__pista button')),
      pista: raiz.querySelector<HTMLElement>('.linea__pista')!,
    };
  }

  it('con puntero fino las barras miden 34 px, como siempre', () => {
    const { barras, pista } = pintar(false);
    expect(barras.map((b) => b.style.height)).toEqual(['34px', '34px']);
    expect(barras.map((b) => b.style.top)).toEqual(['4px', '41px']);
    expect(pista.style.blockSize).toBe('79px');
  });

  it('en pantalla táctil miden 44 px, y los carriles y la fila crecen con ellas', () => {
    const { barras, pista } = pintar(true);
    expect(barras.map((b) => b.style.height)).toEqual(['44px', '44px']);
    expect(barras.map((b) => b.style.top)).toEqual(['4px', '51px']);
    expect(pista.style.blockSize).toBe('99px');
  });
});
