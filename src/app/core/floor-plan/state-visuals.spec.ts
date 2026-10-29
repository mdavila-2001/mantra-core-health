import type { SpaceState } from '../data-access/floor-plan/floor-plan.types';
import {
  AVAILABILITY_VISUALS,
  HYGIENE_VISUALS,
  ISOLATION_VISUALS,
  LIFECYCLE_VISUALS,
  NO_STATE_VISUAL,
  OCCUPANCY_VISUALS,
  V2_VISUALS,
  ageLabel,
  ariaLabelFor,
  categoryVisual,
  isStale,
  legendCounts,
  legendValues,
  rollupSentence,
  stateVisual,
  type StateVisual,
} from './state-visuals';

const cell = (over: Partial<{ occ: 'OCC_FREE' | 'OCC_RESERVED' | 'OCC_OCCUPIED'; av: string; hy: string; iso: string; v2: SpaceState['v2Code'] }> = {}): SpaceState => ({
  lifecycle: { code: 'SPACE_ACTIVE' },
  availability: { code: over.av ?? 'SPACE_OP_AVAILABLE', since: '2026-10-29T10:00:00Z' },
  occupancy: { code: over.occ ?? 'OCC_FREE', since: '2026-10-29T10:00:00Z' },
  hygiene: { code: over.hy ?? 'HYG_INSPECTED', since: '2026-10-29T10:00:00Z', terminalRequired: false },
  isolation: { code: over.iso ?? 'ISO_NONE', since: '2026-10-29T10:00:00Z' },
  v2Code: over.v2 ?? 'U',
  assignable: true,
  lastEventAt: '2026-10-29T10:00:00Z',
  opsVersion: 1,
});

describe('visuales de estado (CONTRATO-PLANO §5.4)', () => {
  const axes: [string, readonly StateVisual[]][] = [
    ['ciclo de vida', LIFECYCLE_VISUALS],
    ['disponibilidad', AVAILABILITY_VISUALS],
    ['ocupación', OCCUPANCY_VISUALS],
    ['higiene', HYGIENE_VISUALS],
    ['aislamiento', ISOLATION_VISUALS],
    ['estado v2', V2_VISUALS],
  ];

  it.each(axes)('%s: cada valor tiene texto y una clave única', (_name, list) => {
    expect(new Set(list.map((x) => x.key)).size).toBe(list.length);
    for (const item of list) expect(item.label.length).toBeGreaterThan(2);
  });

  /** Pares que comparten forma a propósito: se distinguen por texto (o por la letra) y son la misma familia de estado. */
  const SAME_FAMILY = new Set(['hygiene:HYG_CLEAN|hygiene:HYG_INSPECTED', 'availability:SPACE_OP_BLOCKED_ADMIN|availability:SPACE_OP_BLOCKED_CLINICAL']);

  it.each(axes)('%s: ningún par de valores se distingue SOLO por color (cambia patrón, glifo, borde o letra)', (_name, list) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const sameShape = a.pattern === b.pattern && a.glyph === b.glyph && a.border === b.border && !!a.strong === !!b.strong;
        if (!sameShape) continue;
        const distinctMark = a.mark !== undefined && b.mark !== undefined && a.mark !== b.mark;
        const family = SAME_FAMILY.has([a.key, b.key].sort().join('|'));
        expect(distinctMark || family).toBe(true);
        expect(a.label).not.toBe(b.label);
      }
    }
  });

  it('verde y rojo nunca son la única señal: los de tono éxito o error con otro valor del eje cambian de patrón o glifo', () => {
    for (const [, list] of axes) {
      const loud = list.filter((x) => x.tone === 'success' || x.tone === 'error');
      for (const item of loud) {
        const others = list.filter((x) => x !== item);
        const differsByShape = others.every((o) => o.pattern !== item.pattern || o.glyph !== item.glyph || o.border !== item.border);
        const onlyEquivalent = others.every((o) => o.tone === item.tone || o.pattern !== item.pattern || o.glyph !== item.glyph || o.border !== item.border);
        expect(differsByShape || onlyEquivalent).toBe(true);
      }
    }
  });

  it('el contrato fija glifos concretos: persona, reloj, candado, llave, círculo tachado, escoba, gota, peligro biológico, «I»', () => {
    const glyphs = new Set([...AVAILABILITY_VISUALS, ...OCCUPANCY_VISUALS, ...HYGIENE_VISUALS, ...ISOLATION_VISUALS].map((x) => x.glyph));
    for (const g of ['person', 'clock', 'lock', 'wrench', 'slash', 'broom', 'drop', 'biohazard', 'isolation']) expect(glyphs.has(g as never)).toBe(true);
  });

  it('el aislamiento es un borde discontinuo grueso con la letra del tipo', () => {
    const airborne = ISOLATION_VISUALS.find((x) => x.key.endsWith('AIRBORNE'))!;
    expect(airborne.border).toBe('dashed-thick');
    expect(airborne.mark).toBe('A');
    expect(airborne.label).toBe('Aislamiento aéreo');
  });

  it('stateVisual resuelve por eje; sin estado o con un código desconocido da «Sin estado»', () => {
    expect(stateVisual('occupancy', cell({ occ: 'OCC_OCCUPIED' })).label).toBe('Ocupada');
    expect(stateVisual('hygiene', cell({ hy: 'HYG_CONTAMINATED' })).glyph).toBe('biohazard');
    expect(stateVisual('v2', cell({ v2: 'K' })).label).toContain('(K)');
    expect(stateVisual('occupancy', undefined)).toBe(NO_STATE_VISUAL);
    expect(stateVisual('hygiene', cell({ hy: 'HYG_RARO' }))).toBe(NO_STATE_VISUAL);
    expect(stateVisual('none', cell())).toBe(NO_STATE_VISUAL);
  });

  it('la leyenda cuenta por valor y deja afuera lo que el filtro excluye', () => {
    const states = { a: cell({ occ: 'OCC_OCCUPIED' }), b: cell({ occ: 'OCC_OCCUPIED' }), c: cell({ occ: 'OCC_FREE' }) };
    const counts = legendCounts('occupancy', states);
    expect(counts.get('occupancy:OCC_OCCUPIED')).toBe(2);
    expect(counts.get('occupancy:OCC_FREE')).toBe(1);
    expect(legendCounts('occupancy', states, (id) => id !== 'a').get('occupancy:OCC_OCCUPIED')).toBe(1);
    expect(legendValues('occupancy')).toBe(OCCUPANCY_VISUALS);
    expect(legendValues('none')).toEqual([]);
  });

  it('las unidades reparten los tonos del sistema y alternan patrón al agotarlos', () => {
    const visuals = Array.from({ length: 14 }, (_, i) => categoryVisual('unit', `U${i}`, `Unidad ${i}`, i));
    const combos = new Set(visuals.map((x) => `${x.tone}/${x.pattern}`));
    expect(combos.size).toBe(14);
    expect(visuals[0]!.mark).toBe('U0');
  });

  it('antigüedad del dato (S7): redacta y marca desactualizado pasados 120 s', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    expect(ageLabel('2026-10-29T11:59:58Z', now)).toBe('Dato actualizado ahora');
    expect(ageLabel('2026-10-29T11:59:30Z', now)).toBe('Dato de hace 30 s');
    expect(ageLabel('2026-10-29T11:58:00Z', now)).toBe('Dato de hace 2 min');
    expect(ageLabel('2026-10-29T09:00:00Z', now)).toBe('Dato de hace 3 h');
    expect(isStale('2026-10-29T11:58:30Z', now)).toBe(false);
    expect(isStale('2026-10-29T11:57:59Z', now)).toBe(true);
  });

  it('la frase de camas de un contenedor', () => {
    expect(rollupSentence({ beds: 12, censable: 12, occupied: 9, reserved: 0, assignable: 2, blocked: 0, maintenance: 0, dirty: 0, cleaning: 0, isolation: 0, contaminated: 0 })).toBe('12 camas · 9 ocupadas · 2 asignables');
    expect(rollupSentence({ beds: 1, censable: 1, occupied: 1, reserved: 0, assignable: 0, blocked: 0, maintenance: 0, dirty: 0, cleaning: 0, isolation: 0, contaminated: 0 })).toBe('1 cama · 1 ocupada · 0 asignables');
    expect(rollupSentence(undefined)).toBeNull();
  });

  it('el aria-label es una frase completa y un espacio fuera de alcance no filtra nada', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    const label = ariaLabelFor({ name: 'Habitación 101', functionDisplay: 'Internación', inScope: true }, cell({ occ: 'OCC_OCCUPIED', hy: 'HYG_CLEAN' }), '2026-10-29T11:58:00Z', now);
    expect(label).toBe('Habitación 101, internación, ocupada, higiene limpia, sin aislamiento, dato de hace 2 min');
    expect(ariaLabelFor({ name: 'SECRETO', inScope: false }, cell(), undefined, now)).toBe('Espacio fuera de su alcance');
    const blocked = ariaLabelFor({ name: 'Cama 2', inScope: true }, cell({ av: 'SPACE_OP_BLOCKED_CLINICAL' }), undefined, now);
    expect(blocked).toContain('bloqueada · clínica');
  });
});
