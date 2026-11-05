import { describe, expect, it } from 'vitest';

import { canonicalNationalId, hasNationalIdContent } from './national-id';

describe('canonicalNationalId', () => {
  it('«01.234-567» y «1234567» son el mismo documento', () => {
    expect(canonicalNationalId('01.234-567')).toBe('1234567');
    expect(canonicalNationalId('1234567')).toBe('1234567');
  });

  it('pasa a mayúsculas y quita espacios', () => {
    expect(canonicalNationalId(' 123 45a ')).toBe('12345A');
  });

  it('un documento solo de ceros o signos queda sin contenido', () => {
    expect(canonicalNationalId('000000')).toBe('0');
    expect(hasNationalIdContent('000000')).toBe(false);
    expect(hasNationalIdContent('.-.-')).toBe(false);
    expect(hasNationalIdContent('0012')).toBe(false);
    expect(hasNationalIdContent('0001234')).toBe(true);
  });
});
