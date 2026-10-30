import type { PractitionerListItem } from '../../../core/data-access/profiles/profiles.types';
import { toResultado } from './practitioner-card';

function fila(parcial: Partial<PractitionerListItem> = {}): PractitionerListItem {
  return {
    profileId: 'p-1',
    practitionerCode: 'MED-1',
    displayName: 'Valeria Rojas Mendoza',
    verificationStatusConceptId: 'c-verificado',
    verified: false,
    acceptsNewPatients: true,
    telehealthAvailable: false,
    specialties: [],
    ...parcial,
  } as PractitionerListItem;
}

describe('toResultado · verificación', () => {
  it('con `verified` y sin `verification` deriva VERIFIED (API actual y mocks viejos)', () => {
    expect(toResultado(fila({ verified: true })).verification?.status).toBe('VERIFIED');
  });

  it('con `verified:false` no hay insignia que pintar', () => {
    expect(toResultado(fila({ verified: false })).verification?.status).toBe('UNVERIFIED');
  });

  it('`verification.status` manda: IN_REVIEW es IN_REVIEW aunque verified sea false', () => {
    const resultado = toResultado(
      fila({ verified: false, verification: { status: 'IN_REVIEW', verifiedAt: null, validUntil: null } }),
    );
    expect(resultado.verification?.status).toBe('IN_REVIEW');
  });

  it('un VERIFIED con la vigencia vencida no se presenta como verificado', () => {
    const resultado = toResultado(
      fila({ verified: true, verification: { status: 'VERIFIED', validUntil: '2020-01-01' } }),
    );
    expect(resultado.verification?.status).toBe('EXPIRED');
  });

  it('la verificación ya no es un sello de texto: la dice la insignia, una sola fuente', () => {
    const resultado = toResultado(fila({ verified: true }));
    expect(resultado.seals?.map((s) => s.label) ?? []).not.toContain('Matrícula verificada');
    expect(resultado.verification?.status).toBe('VERIFIED');
  });
});
