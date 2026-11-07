import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AHORA_DEMO, ARISTAS_DEMO, NODOS_DEMO } from '../red-clinica.demo';
import type { NodoDeRed } from '../red-clinica.types';
import { RedClinicaPanel } from './red-clinica-panel';

/** 23:30 on 4 Nov 2026 in La Paz (-04:00) is already 5 Nov in UTC. */
const NOCHE_EN_LA_PAZ = new Date('2026-11-05T03:30:00.000Z');

@Component({
  imports: [RedClinicaPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-red-clinica-panel [nodo]="nodo()" [nodos]="nodos" [aristas]="aristas" [ahora]="ahora" presentacion="lateral" />`,
})
class Anfitrion {
  readonly nodos = NODOS_DEMO;
  readonly aristas = ARISTAS_DEMO;
  readonly ahora = AHORA_DEMO;
  readonly nodo = signal<NodoDeRed | null>(null);
}

describe('RedClinicaPanel · las fechas en el día clínico de La Paz, fuera de la red', () => {
  const previa = process.env['TZ'];
  beforeAll(() => {
    process.env['TZ'] = 'UTC';
  });
  afterAll(() => {
    process.env['TZ'] = previa;
  });

  it('con el navegador en UTC, un registro de las 23:30 del 4 de noviembre en La Paz dice 4 de noviembre', async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    const fixture = TestBed.createComponent(Anfitrion);
    const e1 = NODOS_DEMO.find((n) => n.id === 'e1')!;
    const estudio = e1.detalle;
    if (estudio?.tipo !== 'estudio' || estudio.resultado === null) throw new Error('e1 is the demo study with a result');
    // The study section is a child component: it must print in the same zone.
    const resultado = { ...estudio.resultado, liberadoEn: NOCHE_EN_LA_PAZ };
    fixture.componentInstance.nodo.set({ ...e1, cuando: NOCHE_EN_LA_PAZ, detalle: { ...estudio, resultado } });
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const cuando = el.querySelector('.panel__hechos time')!.textContent!.trim();
    expect(cuando).toMatch(/^4 de \S+ de 2026, 23:30$/);
    const liberado = el.querySelector('[data-testid="red-panel-liberado"] time')!.textContent!.trim();
    expect(liberado).toMatch(/^4 de \S+ de 2026$/);
  });
});
