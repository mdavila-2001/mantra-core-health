import type { ReviewItem } from '../../../core/data-access/access-governance/access-reviews.types';
import {
  adjustProblems,
  commentProblem,
  commentRequired,
  lastUsedText,
  MIN_COMMENT,
  unusedAtoms,
} from './review-rules';

const AHORA = new Date('2026-11-03T12:00:00-04:00');

const item = (extra: Partial<ReviewItem> = {}): ReviewItem => ({
  id: 'i1',
  campaignId: 'c1',
  engagementId: 'e1',
  grantId: 'g1',
  subjectUserId: 'u1',
  reviewerKind: 'ADMIN',
  state: 'PENDING',
  dueAt: '2026-11-10T00:00:00Z',
  escalated: false,
  reminderCount: 0,
  maxSensitivity: 'MEDIUM',
  evidence: {
    atoms: [
      { code: 'agenda.appointment.view', name: 'Ver citas', sensitivity: 'LOW' },
      { code: 'agenda.appointment.cancel', name: 'Cancelar citas', sensitivity: 'MEDIUM' },
    ],
    usage90d: [
      { atom: 'agenda.appointment.view', permit: 40, deny: 0, lastUsedAt: '2026-11-01T10:00:00Z' },
      { atom: 'agenda.appointment.cancel', permit: 0, deny: 0, lastUsedAt: null },
    ],
    grants: [
      {
        grantId: 'g1',
        atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'],
        validTo: '2027-01-31T00:00:00Z',
      },
    ],
  },
  ...extra,
});

describe('review-rules', () => {
  it('el comentario es obligatorio al quitar y al ajustar, y al mantener lo ALTO, lo CRÍTICO o lo que no se usó', () => {
    expect(
      commentRequired(
        item({
          maxSensitivity: 'LOW',
          evidence: { atoms: [], usage90d: [{ atom: 'a', permit: 3, deny: 0, lastUsedAt: null }] },
        }),
        'CERTIFY',
      ),
    ).toBe(false);
    expect(commentRequired(item({ maxSensitivity: 'HIGH' }), 'CERTIFY')).toBe(true);
    expect(commentRequired(item({ maxSensitivity: 'CRITICAL' }), 'CERTIFY')).toBe(true);
    // Hay un permiso sin uso en los últimos 90 días.
    expect(commentRequired(item(), 'CERTIFY')).toBe(true);
    expect(commentRequired(item({ maxSensitivity: 'LOW' }), 'REVOKE')).toBe(true);
    expect(commentRequired(item({ maxSensitivity: 'LOW' }), 'ADJUST')).toBe(true);
  });

  it('reconoce los permisos sin uso y dice cuándo se usó por última vez', () => {
    expect(unusedAtoms(item())).toEqual(['agenda.appointment.cancel']);
    expect(unusedAtoms(item({ evidence: undefined }))).toEqual([]);
    expect(lastUsedText({ atom: 'x', permit: 0, deny: 0, lastUsedAt: null })).toBe('Sin uso');
    expect(
      lastUsedText({ atom: 'x', permit: 2, deny: 0, lastUsedAt: '2026-11-01T10:00:00Z' }),
    ).toMatch(/nov/);
  });

  it('pide al menos 10 caracteres cuando el comentario es obligatorio, y los cuenta sin espacios de los bordes', () => {
    expect(MIN_COMMENT).toBe(10);
    expect(commentProblem('', true)).toBe('Escriba al menos 10 caracteres.');
    expect(commentProblem('   corto   ', true)).toBe('Escriba al menos 10 caracteres.');
    expect(commentProblem('Cobra todos los días', true)).toBeNull();
    expect(commentProblem('', false)).toBeNull();
  });

  it('un ajuste solo reduce: quitar permisos o acortar la vigencia, sin dejar la concesión vacía', () => {
    const base = item();
    expect(
      adjustProblems(
        base,
        { atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'], validTo: null },
        AHORA,
      ),
    ).toEqual(['Quite algún permiso o acorte la vigencia: un ajuste no puede dejar todo igual.']);
    expect(adjustProblems(base, { atoms: [], validTo: null }, AHORA)).toContain(
      'Debe quedar al menos un permiso; si no, use «Quitar».',
    );
    expect(
      adjustProblems(base, { atoms: ['agenda.appointment.view'], validTo: null }, AHORA),
    ).toEqual([]);
    expect(
      adjustProblems(
        base,
        { atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'], validTo: '2026-12-01' },
        AHORA,
      ),
    ).toEqual([]);
    expect(
      adjustProblems(
        base,
        { atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'], validTo: '2027-06-01' },
        AHORA,
      ),
    ).toContain('La nueva fecha debe ser anterior al vencimiento actual: un ajuste solo reduce.');
    expect(
      adjustProblems(base, { atoms: ['agenda.appointment.view'], validTo: '2020-01-01' }, AHORA),
    ).toContain('La nueva fecha debe ser futura.');
  });
});
