import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { BedBoardCell, BedCompatibility } from '../../../core/data-access/adt/adt.types';
import { estadoDeCama, motivoDeNoAsignable, textoDeCama } from './adt.view';
import { BedPicker } from './bed-picker/bed-picker';
import { BedStatus } from './bed-status/bed-status';
import { CompatPanel } from './compat-panel/compat-panel';

// El primer componente de un archivo compila su plantilla y su hoja de estilos: con la máquina cargada pasa de 5 s.
vi.setConfig({ testTimeout: 20_000 });

function celda(code: string, extra: Partial<BedBoardCell> = {}): BedBoardCell {
  return {
    id: `id-${code}`,
    code,
    name: `Cama ${code}`,
    path: [{ id: 'h', code: 'HAB', name: 'Habitación 301', form: 'LOC_FORM_ROOM' }],
    form: { code: 'LOC_FORM_BED', display: 'Cama' },
    function: { code: 'SPACE_FN_BED_STANDARD', display: 'Cama estándar' },
    lifecycle: { code: 'SPACE_ACTIVE', display: 'Activo' },
    availability: { code: 'SPACE_OP_AVAILABLE', reasonCode: null, reasonText: null, expectedUntil: null, since: null },
    hygiene: { code: 'HYG_INSPECTED', since: null, terminalRequired: false },
    isolation: { code: 'ISO_NONE', since: null },
    occupancy: { code: 'OCC_FREE', since: null },
    v2Code: 'U',
    assignable: true,
    openCleaningOrderId: null,
    lastEventAt: null,
    opsVersion: 1,
    ...extra,
  };
}

describe('presentación de internación', () => {
  it('cada resumen v2 tiene texto, tono y glifo propios', () => {
    const codigos = ['U', 'O', 'R', 'H', 'K', 'I', 'C'];
    const glifos = new Set(codigos.map((c) => estadoDeCama(c).glyph));
    expect(glifos.size).toBe(7);
    expect(estadoDeCama('H').label).toContain('limpieza');
    expect(estadoDeCama('Z').tone).toBe('secondary');
  });

  it('dice por qué una cama no se ofrece', () => {
    expect(motivoDeNoAsignable(celda('a'))).toBe('');
    expect(motivoDeNoAsignable(celda('b', { assignable: false, occupancy: { code: 'OCC_OCCUPIED', since: null } }))).toBe('Ocupada');
    expect(motivoDeNoAsignable(celda('c', { assignable: false, hygiene: { code: 'HYG_DIRTY', since: null, terminalRequired: false } }))).toBe('Pendiente de limpieza');
    expect(motivoDeNoAsignable(celda('d', { assignable: false, hygiene: { code: 'HYG_CONTAMINATED', since: null, terminalRequired: true } }))).toContain('terminal');
    expect(
      motivoDeNoAsignable(celda('e', { assignable: false, availability: { code: 'SPACE_OP_MAINTENANCE', reasonCode: 'X', reasonText: 'Mantenimiento de gases', expectedUntil: null, since: null } })),
    ).toBe('Mantenimiento de gases');
  });

  it('el texto de cama distingue la pendiente', () => {
    expect(textoDeCama(null)).toBe('Pendiente de cama');
    expect(textoDeCama({ id: '1', code: '301-A', name: 'x', path: [{ id: 'h', code: 'H', name: 'Habitación 301', form: 'R' }] })).toBe('Cama 301-A · Habitación 301');
  });
});

describe('BedStatus', () => {
  it('muestra texto y glifo, no sólo color', () => {
    const f = TestBed.createComponent(BedStatus);
    f.componentRef.setInput('v2Code', 'K');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Contaminada');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('[data-pattern="contaminated"]')).not.toBeNull();
  });
});

describe('BedPicker', () => {
  let f: ComponentFixture<BedPicker>;
  const libre = celda('301-A');
  const sucia = celda('301-B', { assignable: false, v2Code: 'H', hygiene: { code: 'HYG_DIRTY', since: null, terminalRequired: false } });
  const ocupada = celda('302-A', { assignable: false, v2Code: 'O', occupancy: { code: 'OCC_OCCUPIED', since: null, encounterId: 'e1', patient: { initials: 'JM', sexCode: 'SEX_MALE', ageYears: 67 } } });

  function montar(cells: BedBoardCell[], mode: 'assignable' | 'occupied' = 'assignable'): HTMLElement {
    f = TestBed.createComponent(BedPicker);
    f.componentRef.setInput('cells', cells);
    f.componentRef.setInput('mode', mode);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('ofrece sólo las asignables y avisa cuántas quedan afuera', () => {
    const el = montar([libre, sucia, ocupada]);
    expect(el.querySelector('[data-testid="cama-301-A"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="cama-301-B"]')).toBeNull();
    expect(el.querySelector('[data-testid="selector-de-camas-todas"]')?.textContent).toContain('2 no asignables');
  });

  it('«ver también las no asignables» las muestra apagadas, con el motivo y sin permitir elegirlas', () => {
    const el = montar([libre, sucia]);
    const elegidas: BedBoardCell[] = [];
    f.componentInstance.picked.subscribe((c) => elegidas.push(c));
    (el.querySelector('[data-testid="selector-de-camas-todas"]') as HTMLButtonElement).click();
    f.detectChanges();
    const apagada = el.querySelector('[data-testid="cama-301-B"]') as HTMLButtonElement;
    expect(apagada.getAttribute('aria-disabled')).toBe('true');
    expect(apagada.textContent).toContain('Pendiente de limpieza');
    apagada.click();
    expect(elegidas).toHaveLength(0);
    (el.querySelector('[data-testid="cama-301-A"]') as HTMLButtonElement).click();
    expect(elegidas.map((c) => c.code)).toEqual(['301-A']);
  });

  it('sin camas asignables es S3 con la próxima acción de ver los motivos', () => {
    const el = montar([sucia]);
    expect(el.querySelector('[data-testid="selector-de-camas-vacio"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="selector-de-camas-ver-motivos"]')).not.toBeNull();
  });

  it('para intercambiar ofrece sólo camas con una persona adentro', () => {
    const el = montar([libre, ocupada], 'occupied');
    expect(el.querySelector('[data-testid="cama-302-A"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="cama-301-A"]')).toBeNull();
    expect(el.textContent).toContain('JM');
  });

  it('el filtro de texto busca por código y por ubicación', () => {
    const el = montar([libre, celda('305-A')]);
    f.componentInstance['texto'].set('305');
    f.detectChanges();
    expect(el.querySelector('[data-testid="cama-305-A"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="cama-301-A"]')).toBeNull();
  });
});

describe('CompatPanel', () => {
  let f: ComponentFixture<CompatPanel>;

  function montar(result: BedCompatibility | null, extra: { canOverride?: boolean; forced?: boolean; unavailable?: boolean } = {}): HTMLElement {
    f = TestBed.createComponent(CompatPanel);
    f.componentRef.setInput('result', result);
    f.componentRef.setInput('canOverride', extra.canOverride ?? false);
    f.componentRef.setInput('forced', extra.forced ?? false);
    f.componentRef.setInput('previewUnavailable', extra.unavailable ?? false);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  const bloqueante = { rule: 'HYGIENE' as const, severity: 'BLOCKING' as const, detail: 'La cama está sucia.' };
  const forzable = { rule: 'SEX' as const, severity: 'OVERRIDABLE' as const, detail: 'Habitación de mujeres.' };

  it('un bloqueante no ofrece forzar ni siquiera a quien puede', () => {
    const el = montar({ assignable: false, violations: [bloqueante, forzable] }, { canOverride: true });
    expect(el.querySelector('[data-testid="compatibilidad-bloqueante"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="compatibilidad-forzar"]')).toBeNull();
    expect(el.textContent).toContain('no se pueden forzar');
  });

  it('un forzable ofrece «Forzar con justificación» sólo a la supervisión', () => {
    expect(montar({ assignable: false, violations: [forzable] }, { canOverride: true }).querySelector('[data-testid="compatibilidad-forzar"]')).not.toBeNull();
    const sin = montar({ assignable: false, violations: [forzable] }, { canOverride: false });
    expect(sin.querySelector('[data-testid="compatibilidad-forzar"]')).toBeNull();
    expect(sin.querySelector('[data-testid="compatibilidad-sin-permiso"]')?.textContent).toContain('supervisión');
  });

  it('forzado dice que quedará un incidente y permite quitarlo', () => {
    const el = montar({ assignable: false, violations: [forzable] }, { canOverride: true, forced: true });
    expect(el.querySelector('[data-testid="compatibilidad-forzada"]')?.textContent).toContain('incidente');
    expect(el.querySelector('[data-testid="compatibilidad-forzar"]')).toBeNull();
  });

  it('compatible, sin vista previa y consultando tienen su propio aviso', () => {
    expect(montar({ assignable: true, violations: [] }).querySelector('[data-testid="compatibilidad-ok"]')).not.toBeNull();
    expect(montar(null, { unavailable: true }).querySelector('[data-testid="compatibilidad-al-confirmar"]')).not.toBeNull();
  });
});
