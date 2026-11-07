import { describe, expect, it } from 'vitest';

import type { BranchListItem } from '../../../core/data-access/directory/directory.types';
import { registeredSiteOf } from './registered-site';

function branch(partial: Partial<BranchListItem>): BranchListItem {
  return {
    id: 'b',
    code: 'X',
    name: 'Sede',
    statusConceptId: 'st',
    description: 'Av. Busch 500',
    latitude: -17.78,
    longitude: -63.18,
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('registeredSiteOf', () => {
  it('prefers the head office over the other sites', () => {
    const site = registeredSiteOf('Clínica Norte', [
      branch({ name: 'Sucursal', category: 'branch' }),
      branch({ name: 'Casa central', category: 'head_office', description: 'Calle Los Pinos 1' }),
    ]);

    expect(site).toEqual({
      practiceName: 'Clínica Norte',
      siteName: 'Casa central',
      addressText: 'Calle Los Pinos 1',
      latitude: -17.78,
      longitude: -63.18,
    });
  });

  it('falls back to the first site that has a point', () => {
    const site = registeredSiteOf('Clínica Norte', [branch({ name: 'Sin punto', latitude: undefined, longitude: undefined }), branch({ name: 'Con punto' })]);

    expect(site?.siteName).toBe('Con punto');
  });

  it('is null when anything the practice needs is missing: no point, no address, no names', () => {
    expect(registeredSiteOf('Clínica Norte', [])).toBeNull();
    expect(registeredSiteOf('Clínica Norte', [branch({ latitude: undefined, longitude: undefined })])).toBeNull();
    expect(registeredSiteOf('Clínica Norte', [branch({ description: '  ' })])).toBeNull();
    expect(registeredSiteOf(' ', [branch({})])).toBeNull();
  });
});
