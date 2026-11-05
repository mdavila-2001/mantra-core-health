import type { PractitionerCredential } from '../../../core/data-access/profiles/profiles.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { optionalCredentialsNote, splitCredentials } from './roadmap-credentials';

const concept = (id: string, code: string) =>
  [id, { conceptId: id, code, display: code, codeSystemVersionId: 'v1' }] as const;

const labels: ConceptLabels = new Map([
  concept('t-degree', 'CREDENTIAL_TYPE_DEGREE'),
  concept('t-diploma', 'CREDENTIAL_TYPE_DIPLOMA'),
  concept('t-doctorate', 'CREDENTIAL_TYPE_DOCTORATE'),
  concept('t-specialty', 'CREDENTIAL_TYPE_SPECIALTY'),
  concept('s-verified', 'CRED_VERIFIED'),
  concept('s-pending', 'CRED_PENDING'),
]);

const NOW = new Date('2026-11-05');

function credential(type: string, state: string, expiryDate?: Date): PractitionerCredential {
  return {
    id: `${type}-${state}`,
    credentialTypeConceptId: type,
    number: 'N-1',
    stateConceptId: state,
    ...(expiryDate === undefined ? {} : { expiryDate }),
  };
}

describe('splitCredentials', () => {
  it('cuenta para el paso sólo los títulos universitarios; los demás quedan como opcionales', () => {
    const split = splitCredentials(
      [
        credential('t-degree', 's-verified'),
        credential('t-diploma', 's-pending'),
        credential('t-doctorate', 's-verified'),
        credential('t-specialty', 's-pending'),
      ],
      labels,
      NOW,
    );
    expect(split.required).toEqual(['approved']);
    expect(split.optional).toBe(3);
  });

  it('un título universitario vencido cuenta como vencido aunque esté verificado', () => {
    const split = splitCredentials(
      [credential('t-degree', 's-verified', new Date('2026-01-01'))],
      labels,
      NOW,
    );
    expect(split.required).toEqual(['expired']);
  });

  it('un título de tipo que el catálogo no resolvió no se descarta ni se da por bueno', () => {
    const split = splitCredentials([credential('t-unresolved', 's-verified')], labels, NOW);
    expect(split.required).toEqual(['unknown']);
    expect(split.optional).toBe(0);
  });
});

describe('optionalCredentialsNote', () => {
  it('nombra los títulos opcionales en singular o plural, y nada si no hay', () => {
    expect(optionalCredentialsNote(0)).toBe('');
    expect(optionalCredentialsNote(1)).toBe(' · 1 título más, opcional');
    expect(optionalCredentialsNote(2)).toBe(' · 2 títulos más, opcionales');
  });
});
