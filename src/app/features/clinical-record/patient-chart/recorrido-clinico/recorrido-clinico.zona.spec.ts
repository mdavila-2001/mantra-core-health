import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RecorridoClinico } from './recorrido-clinico';
import { desfaseDeLaZona } from './recorrido-clinico.zona';
import type { RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';

// 23:30 on 4 Nov in La Paz is already 03:30 on 5 Nov in UTC.
const NOCHE = new Date('2025-11-05T03:30:00Z');
const r = (id: string, clase: RegistroDeLaRed['clase'], extra: Partial<RegistroDeLaRed> = {}): RegistroDeLaRed => ({
  id, clase, titulo: id, detalle: '', estado: '', cuando: NOCHE, ...extra,
});

@Component({
  imports: [RecorridoClinico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-recorrido-clinico [registros]="registros" [vinculos]="vinculos" />`,
})
class Anfitrion {
  readonly registros: readonly RegistroDeLaRed[] = [r('c', 'atencion'), r('dx', 'diagnostico', { encuentroId: 'c', certeza: 'confirmado', concepto: 'HTA' })];
  readonly vinculos: readonly VinculoDeLaRed[] = [{ desde: 'c', hasta: 'dx', motivo: 'registrado-en' }];
}

describe('RecorridoClinico · las fechas en el día clínico de La Paz', () => {
  const previa = process.env['TZ'];
  beforeAll(() => {
    process.env['TZ'] = 'UTC';
  });
  afterAll(() => {
    process.env['TZ'] = previa;
  });

  it('Bolivia es -0400 todo el año, y una zona sin desfase es +0000', () => {
    expect(desfaseDeLaZona('America/La_Paz', new Date('2026-01-15T12:00:00Z'))).toBe('-0400');
    expect(desfaseDeLaZona('America/La_Paz', new Date('2026-07-15T12:00:00Z'))).toBe('-0400');
    expect(desfaseDeLaZona('UTC')).toBe('+0000');
  });

  it('con el navegador en UTC, el eje dice el día de La Paz y no el de UTC', () => {
    expect(new Date(NOCHE).getDate()).toBe(5);
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const fechas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.red__eje .red__fecha')).map((p) => p.textContent?.trim());
    expect(fechas.length).toBeGreaterThan(0);
    for (const f of fechas) expect(f).toMatch(/^4\b/);
  });
});
