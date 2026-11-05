import { describe, expect, it } from 'vitest';

import { deniedTenantMessage, deniedTenantsOfBody, isTenantDenialReason, tenantDenialHint, tenantDenialText, TENANT_DENIAL_REASONS } from './tenant-denial';

describe('tenant-denial', () => {
  it('cada uno de los cinco motivos tiene su texto y su indicación, y el aviso completo nombra la organización', () => {
    expect(TENANT_DENIAL_REASONS).toHaveLength(5);
    for (const motivo of TENANT_DENIAL_REASONS) {
      expect(tenantDenialText(motivo)).not.toMatch(/[A-Z_]{6,}/);
      expect(tenantDenialHint(motivo).length).toBeGreaterThan(10);
      expect(deniedTenantMessage('Hospital Piloto', motivo)).toMatch(/^La organización Hospital Piloto no le permite entrar ahora: /);
    }
  });

  it('un motivo desconocido no muestra el código crudo', () => {
    expect(isTenantDenialReason('OTRO_MOTIVO')).toBe(false);
    expect(tenantDenialText('OTRO_MOTIVO')).not.toContain('OTRO_MOTIVO');
  });

  it('lee la lista del login y descarta lo que no tiene forma', () => {
    expect(deniedTenantsOfBody([{ tenantId: 't-1', reason: 'OUTSIDE_ALLOWED_HOURS' }, { tenantId: '', reason: 'x' }, 'x', null, { tenantId: 't-2' }])).toEqual([
      { tenantId: 't-1', reason: 'OUTSIDE_ALLOWED_HOURS' },
    ]);
    expect(deniedTenantsOfBody(undefined)).toEqual([]);
  });
});
