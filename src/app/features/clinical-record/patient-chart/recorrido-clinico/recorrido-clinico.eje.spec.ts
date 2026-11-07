import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RecorridoClinico } from './recorrido-clinico';
import type { RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';

const r = (id: string, clase: RegistroDeLaRed['clase'], cuando: string, extra: Partial<RegistroDeLaRed> = {}): RegistroDeLaRed => ({
  id, clase, titulo: id, detalle: '', estado: '', cuando: new Date(cuando), ...extra,
});

// Three encounters in 2025 and one in 2026, all collapsed: every column is narrow.
@Component({
  imports: [RecorridoClinico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-recorrido-clinico [registros]="registros" [vinculos]="vinculos" />`,
})
class Anfitrion {
  readonly registros: readonly RegistroDeLaRed[] = [
    r('c1', 'atencion', '2025-03-10T16:00:00Z'),
    r('dx', 'diagnostico', '2025-03-10T16:00:00Z', { encuentroId: 'c1', certeza: 'confirmado', concepto: 'HTA' }),
    r('c2', 'atencion', '2025-06-10T16:00:00Z'),
    r('c3', 'atencion', '2025-09-10T16:00:00Z'),
    r('c4', 'atencion', '2026-02-10T16:00:00Z'),
  ];
  readonly vinculos: readonly VinculoDeLaRed[] = [{ desde: 'c1', hasta: 'dx', motivo: 'registrado-en' }];
}

describe('RecorridoClinico · the axis names the year only when it changes', () => {
  it('a narrow column says its year in the first column and when the year changes, and keeps the line otherwise', () => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const columnas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.red__eje .red__columna--angosta'));
    expect(columnas.length).toBe(4);
    const anios = columnas.map((c) => c.querySelector('.red__contexto')?.textContent?.trim() ?? null);
    expect(anios).toEqual(['2025', '', '', '2026']);
    // The empty line is a no-break space, not a missing paragraph.
    expect(columnas[1].querySelector('.red__contexto')?.textContent).toBe(' ');
  });
});
