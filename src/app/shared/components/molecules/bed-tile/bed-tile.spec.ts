import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { BedBoardCell, V2Code } from '../../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { lookOfHygiene, lookOfV2 } from './bed-status';
import { BedTile } from './bed-tile';

const AT = '2026-10-29T12:00:00Z';

function cell(patch: Partial<BedBoardCell> = {}): BedBoardCell {
  return {
    id: 'c1',
    code: '302-A',
    name: 'Cama 302-A',
    path: [],
    form: { code: 'LOC_FORM_BED', display: 'Cama' },
    function: { code: 'SPACE_FN_BED_STANDARD', display: 'Cama estándar' },
    lifecycle: { code: 'SPACE_ACTIVE', display: 'Activo' },
    availability: { code: 'SPACE_OP_AVAILABLE', reasonCode: null, reasonText: null, expectedUntil: null, since: AT },
    hygiene: { code: 'HYG_INSPECTED', since: AT, terminalRequired: false },
    isolation: { code: 'ISO_NONE', since: AT },
    occupancy: { code: 'OCC_FREE', since: AT },
    v2Code: 'U',
    assignable: true,
    openCleaningOrderId: null,
    lastEventAt: '2026-10-29T11:56:00Z',
    opsVersion: 1,
    ...patch,
  };
}

describe('BedTile (recuadro de una cama)', () => {
  function mount(c: BedBoardCell, extra: { hygieneOnly?: boolean; selected?: boolean } = {}): ComponentFixture<BedTile> {
    const fixture = TestBed.createComponent(BedTile);
    fixture.componentRef.setInput('cell', c);
    fixture.componentRef.setInput('now', new Date(AT));
    if (extra.hygieneOnly !== undefined) fixture.componentRef.setInput('hygieneOnly', extra.hygieneOnly);
    if (extra.selected !== undefined) fixture.componentRef.setInput('selected', extra.selected);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const boton = (f: ComponentFixture<unknown>): HTMLButtonElement => el(f).querySelector('button.tile')!;

  it('es un botón con su código, el estado en texto y la antigüedad del último cambio', () => {
    const f = mount(cell());
    expect(boton(f).tagName).toBe('BUTTON');
    expect(el(f).textContent).toContain('302-A');
    expect(el(f).textContent).toContain('Disponible');
    expect(el(f).textContent).toContain('hace 4 min');
  });

  it('el aria-label lo dice todo: el estado, el resumen y la antigüedad', () => {
    const f = mount(cell());
    expect(boton(f).getAttribute('aria-label')).toBe('Cama 302-A. Disponible. Lista para asignar. último cambio hace 4 min');
  });

  describe('cada estado se distingue sin color: texto + glifo + patrón', () => {
    const casos: [V2Code, Partial<BedBoardCell>, string, string, string][] = [
      ['U', {}, 'Disponible', 'check', 'solid'],
      ['O', { v2Code: 'O', occupancy: { code: 'OCC_OCCUPIED', since: AT, patient: { initials: 'M.R.', sexCode: 'F', ageYears: 54 } } }, 'Ocupada', 'person', 'solid'],
      ['R', { v2Code: 'R', occupancy: { code: 'OCC_RESERVED', since: AT } }, 'Reservada', 'clock', 'dashed'],
      ['H', { v2Code: 'H', hygiene: { code: 'HYG_DIRTY', since: AT, terminalRequired: false } }, 'Por limpiar', 'droplet', 'dots'],
      ['K', { v2Code: 'K', hygiene: { code: 'HYG_CONTAMINATED', since: AT, terminalRequired: true } }, 'Contaminada', 'hazard', 'cross'],
      ['I', { v2Code: 'I', isolation: { code: 'ISO_DROPLET', since: AT } }, 'Aislada', 'shield', 'double'],
      ['C', { v2Code: 'C', availability: { code: 'SPACE_OP_MAINTENANCE', reasonCode: 'BLOCK_RSN_EQUIPMENT_FAILURE', reasonText: null, expectedUntil: '2026-10-30T22:00:00Z', since: AT } }, 'No disponible', 'ban', 'hatch'],
    ];
    it.each(casos)('%s', (code, patch, texto, glifo, patron) => {
      const f = mount(cell(patch));
      expect(boton(f).getAttribute('data-v2')).toBe(code);
      expect(el(f).textContent).toContain(texto);
      expect(el(f).classList.contains(`pat--${patron}`)).toBe(true);
      expect(lookOfV2(code).glyph).toBe(glifo);
      expect(el(f).querySelector('svg.glyph')).not.toBeNull();
    });

    it('los siete estados tienen un patrón distinto de los que comparten tono', () => {
      const parejas = (['U', 'O', 'R', 'H', 'K', 'I', 'C'] as V2Code[]).map((c) => `${lookOfV2(c).tone}/${lookOfV2(c).pattern}/${lookOfV2(c).glyph}`);
      expect(new Set(parejas).size).toBe(7);
      const glifos = (['U', 'O', 'R', 'H', 'K', 'I', 'C'] as V2Code[]).map((c) => lookOfV2(c).glyph);
      expect(new Set(glifos).size).toBe(7);
    });
  });

  it('un mantenimiento dice el motivo y «hasta cuándo»', () => {
    const f = mount(
      cell({
        v2Code: 'C',
        availability: { code: 'SPACE_OP_MAINTENANCE', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', reasonText: null, expectedUntil: '2026-10-30T22:00:00Z', since: AT },
      }),
    );
    expect(el(f).textContent).toContain('Mantenimiento preventivo');
    expect(el(f).textContent).not.toContain('Mantenimiento · Mantenimiento');
    expect(el(f).textContent).toContain('hasta 30/10 18:00');
  });

  it('un aislamiento que el estado principal no dice (cama contaminada) se marca con un icono', () => {
    const f = mount(cell({ v2Code: 'K', hygiene: { code: 'HYG_CONTAMINATED', since: AT, terminalRequired: true }, isolation: { code: 'ISO_CONTACT', since: AT } }));
    expect(el(f).querySelector('.tile__flag')).not.toBeNull();
    expect(boton(f).getAttribute('aria-label')).toContain('Aislamiento de contacto');
  });

  it('la vista de Limpieza muestra solo higiene: ni paciente, ni aislamiento, ni motivo de bloqueo', () => {
    const f = mount(
      cell({
        v2Code: 'I',
        hygiene: { code: 'HYG_DIRTY', since: AT, terminalRequired: false },
        isolation: { code: 'ISO_AIRBORNE', organism: 'Tuberculosis', since: AT },
        occupancy: { code: 'OCC_OCCUPIED', since: AT, patient: { initials: 'T.V.', sexCode: 'M', ageYears: 38 } },
      }),
      { hygieneOnly: true },
    );
    const texto = el(f).textContent!;
    expect(texto).toContain('Sucia');
    expect(texto).not.toMatch(/T\.V\.|Tuberculosis|Aisla|Ocupada/);
    expect(el(f).querySelector('.tile__flag')).toBeNull();
    expect(lookOfHygiene('HYG_CLEAN', true).label).toBe('Limpia, falta inspección');
  });

  it('al activarlo emite la celda; elegido, queda marcado con aria-pressed', () => {
    const f = mount(cell(), { selected: true });
    const emitidas: BedBoardCell[] = [];
    f.componentInstance.activated.subscribe((c) => emitidas.push(c));
    boton(f).click();
    expect(emitidas).toHaveLength(1);
    expect(emitidas[0]!.id).toBe('c1');
    expect(boton(f).getAttribute('aria-pressed')).toBe('true');
  });
});
