import { describe, expect, it } from 'vitest';

import {
  SYNC_SKIP_REASONS,
  type SyncSkippedLine,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { SYNC_SKIP_TEXT, syncSkipMessage } from './sync-skip-message';

/** Cada motivo de una línea no aplicada se dice en castellano, con lo que toca hacer. */
const LINE: SyncSkippedLine = {
  siteId: 's-1',
  siteCode: 'CEN',
  externalCode: 'ERP-0001',
  productId: 'p-a',
  quantity: 12,
  reason: 'PRODUCT_NOT_PUBLISHED',
};

describe('syncSkipMessage', () => {
  it('tiene un texto para cada motivo de la API', () => {
    for (const reason of SYNC_SKIP_REASONS) {
      expect(SYNC_SKIP_TEXT[reason]).toMatch(/\S/);
    }
  });

  it('«No lo tengo» manual dice que se cambia desde la sede', () => {
    expect(syncSkipMessage({ ...LINE, reason: 'SITE_MARKED_NOT_AVAILABLE' })).toContain('se cambia desde la sede');
  });

  it('un borrador pide publicarlo', () => {
    expect(syncSkipMessage(LINE)).toContain('publíquelo');
  });

  it('con unidades distintas muestra la del vínculo y la del sistema', () => {
    expect(
      syncSkipMessage({ ...LINE, reason: 'UNIT_MISMATCH', mappingUnitCode: 'BOX', externalUnitCode: 'TAB' }),
    ).toContain('Unidad del vínculo BOX / del sistema TAB.');
  });

  it('si el sistema no informa la unidad, lo dice en lugar de dejar un hueco', () => {
    expect(
      syncSkipMessage({ ...LINE, reason: 'UNIT_NOT_REPORTED', mappingUnitCode: 'BOX', externalUnitCode: null }),
    ).toContain('Unidad del vínculo BOX / del sistema sin informar.');
  });
});
