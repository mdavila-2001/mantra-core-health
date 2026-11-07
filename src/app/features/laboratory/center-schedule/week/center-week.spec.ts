import { describe, expect, it } from 'vitest';

import { blockToWeek, slotsOfDay, toPublishedRules, weekToBlock } from './center-week';

const BLOCK = {
  windows: [
    { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
    { dayOfWeek: 2, startTime: '08:00', endTime: '12:00', slotMinutes: 20, gapMinutes: 10 },
  ],
  slotMinutes: 30,
};

describe('center-week', () => {
  it('reads a block as seven rows with each day its own length and rest', () => {
    const week = blockToWeek(BLOCK);
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toMatchObject({
      activo: true,
      desde: '08:00',
      hasta: '12:00',
      duracion: 30,
      respiro: 0,
    });
    expect(week.days[1]).toMatchObject({ activo: true, duracion: 20, respiro: 10 });
    expect(week.days[2]?.activo).toBe(false);
    expect(week.lunch).toBeNull();
  });

  it('goes back to the same block', () => {
    expect(weekToBlock(blockToWeek(BLOCK), 30)).toEqual(BLOCK);
  });

  it('a lunch splits every active day in two windows, and reads back as the lunch', () => {
    const week = { ...blockToWeek(BLOCK), lunch: { from: '10:00', to: '10:30' } };
    const block = weekToBlock(week, 30);
    expect(block.windows.filter((w) => w.dayOfWeek === 1)).toEqual([
      { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '10:30', endTime: '12:00' },
    ]);
    expect(blockToWeek(block).lunch).toEqual({ from: '10:00', to: '10:30' });
    expect(blockToWeek(block).days[0]).toMatchObject({ desde: '08:00', hasta: '12:00' });
  });

  it('counts whole appointments with their rest, as the API does', () => {
    const week = blockToWeek(BLOCK);
    expect(slotsOfDay(week.days[0]!, null)).toBe(8);
    // 08:00–12:00, 20 + 10: starts 08:00 … 11:30 → 8.
    expect(slotsOfDay(week.days[1]!, null)).toBe(8);
    expect(slotsOfDay(week.days[0]!, { from: '10:00', to: '10:30' })).toBe(7);
  });

  it('draws Sunday as 0 for the grid, with each window its length', () => {
    const rules = toPublishedRules({
      windows: [{ dayOfWeek: 7, startTime: '09:00', endTime: '11:00' }],
      slotMinutes: 15,
    });
    expect(rules).toEqual([
      { dayOfWeek: 0, startTime: '09:00', endTime: '11:00', slotMinutes: 15 },
    ]);
  });
});
