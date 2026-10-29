import {
  effectiveVerificationStatus,
  isPastValidity,
  NO_VERIFICATION,
  parseVerificationDate,
  showsVerifiedCheck,
  toVerificationStatus,
  verificationFromSeal,
  verificationOf,
  verificationWithSealFallback,
  VERIFICATION_STATUSES,
} from './verification-status';

describe('verification-status', () => {
  describe('toVerificationStatus', () => {
    it('reconoce los cinco estados', () => {
      for (const status of VERIFICATION_STATUSES) {
        expect(toVerificationStatus(status)).toBe(status);
      }
    });

    it('no distingue mayúsculas ni espacios', () => {
      expect(toVerificationStatus(' verified ')).toBe('VERIFIED');
      expect(toVerificationStatus('in_review')).toBe('IN_REVIEW');
    });

    it('un estado desconocido o mal tipado es UNVERIFIED, nunca VERIFIED', () => {
      for (const raro of ['APPROVED', 'Verificado', '', 'VERIFIED!', null, undefined, 1, true, {}]) {
        expect(toVerificationStatus(raro)).toBe('UNVERIFIED');
      }
    });
  });

  describe('parseVerificationDate', () => {
    it('una fecha sin hora no retrocede un día en husos al oeste de Greenwich', () => {
      const date = parseVerificationDate('2026-03-12');
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(2);
      expect(date?.getDate()).toBe(12);
    });

    it('acepta un instante ISO y un Date', () => {
      expect(parseVerificationDate('2026-03-12T10:00:00Z')?.toISOString()).toBe(
        '2026-03-12T10:00:00.000Z',
      );
      const now = new Date();
      expect(parseVerificationDate(now)).toBe(now);
    });

    it('devuelve null para lo que no es una fecha', () => {
      for (const malo of [null, undefined, '', '  ', 'mañana', '2026-02-31', '2026-13-01', 42, new Date('x')]) {
        expect(parseVerificationDate(malo)).toBeNull();
      }
    });
  });

  describe('verificationOf', () => {
    it('prefiere verification.status a verified', () => {
      const info = verificationOf({
        verified: false,
        verification: { status: 'IN_REVIEW', verifiedAt: null, validUntil: '2027-01-31' },
      });
      expect(info.status).toBe('IN_REVIEW');
      expect(info.verifiedAt).toBeNull();
      expect(info.validUntil?.getMonth()).toBe(0);
    });

    it('sin verification, deriva de verified (true → VERIFIED, false → UNVERIFIED)', () => {
      expect(verificationOf({ verified: true }).status).toBe('VERIFIED');
      expect(verificationOf({ verified: false }).status).toBe('UNVERIFIED');
      expect(verificationOf({}).status).toBe('UNVERIFIED');
      expect(verificationOf({ verified: null }).status).toBe('UNVERIFIED');
    });

    it('con verification vacío o sin status, cae a verified', () => {
      expect(verificationOf({ verified: true, verification: {} }).status).toBe('VERIFIED');
      expect(verificationOf({ verified: true, verification: { status: null } }).status).toBe(
        'VERIFIED',
      );
      expect(verificationOf({ verified: true, verification: null }).status).toBe('VERIFIED');
    });

    it('un status desconocido manda sobre verified:true y no pinta check', () => {
      const info = verificationOf({ verified: true, verification: { status: 'REVOKED_X' } });
      expect(info.status).toBe('UNVERIFIED');
      expect(showsVerifiedCheck(info.status)).toBe(false);
    });

    it('verification.status gana aunque verified sea true (SUSPENDED)', () => {
      expect(verificationOf({ verified: true, verification: { status: 'SUSPENDED' } }).status).toBe(
        'SUSPENDED',
      );
    });

    it('fechas inválidas o nulas se vuelven null', () => {
      const info = verificationOf({
        verification: { status: 'VERIFIED', verifiedAt: 'basura', validUntil: null },
      });
      expect(info.verifiedAt).toBeNull();
      expect(info.validUntil).toBeNull();
    });

    it('null y undefined dan el estado vacío', () => {
      expect(verificationOf(null)).toBe(NO_VERIFICATION);
      expect(verificationOf(undefined)).toBe(NO_VERIFICATION);
    });
  });

  describe('showsVerifiedCheck', () => {
    it('sólo VERIFIED pinta el check', () => {
      expect(VERIFICATION_STATUSES.filter(showsVerifiedCheck)).toEqual(['VERIFIED']);
    });
  });

  describe('verificationFromSeal', () => {
    it('traduce el sello del catálogo sin inventar un VERIFIED', () => {
      expect(verificationFromSeal('approved')).toBe('VERIFIED');
      expect(verificationFromSeal('pending')).toBe('IN_REVIEW');
      expect(verificationFromSeal('in-review')).toBe('IN_REVIEW');
      expect(verificationFromSeal('expired')).toBe('EXPIRED');
      for (const nada of ['rejected', 'unknown', '', null, undefined, 'otra-cosa']) {
        expect(verificationFromSeal(nada)).toBe('UNVERIFIED');
      }
    });
  });

  describe('verificationWithSealFallback', () => {
    it('usa verification.status cuando la API lo envía', () => {
      const info = verificationWithSealFallback(
        { verification: { status: 'SUSPENDED', validUntil: '2027-05-01' } },
        'approved',
      );
      expect(info.status).toBe('SUSPENDED');
      expect(info.validUntil?.getFullYear()).toBe(2027);
    });

    it('sin verification, cae al sello del concepto', () => {
      expect(verificationWithSealFallback({}, 'approved').status).toBe('VERIFIED');
      expect(verificationWithSealFallback(undefined, 'pending').status).toBe('IN_REVIEW');
      expect(verificationWithSealFallback(null, 'unknown').status).toBe('UNVERIFIED');
    });

    it('conserva las fechas aunque el estado salga del sello', () => {
      const info = verificationWithSealFallback(
        { verification: { status: null, verifiedAt: '2026-03-12' } },
        'approved',
      );
      expect(info.status).toBe('VERIFIED');
      expect(info.verifiedAt?.getDate()).toBe(12);
    });
  });

  describe('vigencia vencida (defensa en profundidad)', () => {
    // 15:00 UTC = 11:00 en La Paz, el 29 de octubre
    const now = new Date(Date.UTC(2026, 9, 29, 15, 0));

    it('la vigencia vale hasta el fin del día indicado en La Paz, no hasta su medianoche UTC', () => {
      expect(isPastValidity(new Date(2026, 9, 29, 12), now)).toBe(false);
      expect(isPastValidity(new Date(2026, 9, 28, 12), now)).toBe(true);
      expect(isPastValidity(null, now)).toBe(false);
    });

    it('borde: 23:59 en La Paz sigue vigente y 00:00 del día siguiente ya venció', () => {
      const hoy = new Date(2026, 9, 29, 12);
      // 23:59:00 en La Paz = 03:59:00 UTC del día siguiente
      expect(isPastValidity(hoy, new Date(Date.UTC(2026, 9, 30, 3, 59, 0)))).toBe(false);
      // 00:00:00 en La Paz del día siguiente = 04:00:00 UTC
      expect(isPastValidity(hoy, new Date(Date.UTC(2026, 9, 30, 4, 0, 0)))).toBe(true);
    });

    it('un VERIFIED con validUntil vencido se degrada a EXPIRED, aunque la API diga VERIFIED', () => {
      const info = verificationOf(
        { verified: true, verification: { status: 'VERIFIED', validUntil: '2026-10-01' } },
        now,
      );
      expect(info.status).toBe('EXPIRED');
      expect(showsVerifiedCheck(info.status)).toBe(false);
    });

    it('también degrada la forma vieja si trae validUntil', () => {
      expect(
        verificationOf({ verified: true, verification: { validUntil: '2026-01-01' } }, now).status,
      ).toBe('EXPIRED');
    });

    it('nunca promueve: un IN_REVIEW o UNVERIFIED con fechas sigue igual', () => {
      expect(effectiveVerificationStatus('IN_REVIEW', null, now)).toBe('IN_REVIEW');
      expect(effectiveVerificationStatus('UNVERIFIED', new Date(2020, 0, 1), now)).toBe('UNVERIFIED');
      expect(effectiveVerificationStatus('SUSPENDED', new Date(2099, 0, 1), now)).toBe('SUSPENDED');
    });

    it('vigente o sin vigencia declarada sigue VERIFIED', () => {
      expect(
        verificationOf({ verification: { status: 'VERIFIED', validUntil: '2099-12-31' } }, now)
          .status,
      ).toBe('VERIFIED');
      expect(verificationOf({ verification: { status: 'VERIFIED' } }, now).status).toBe('VERIFIED');
    });

    it('el puente por sello también se degrada', () => {
      expect(
        verificationWithSealFallback({ verification: { validUntil: '2026-01-01' } }, 'approved', now)
          .status,
      ).toBe('EXPIRED');
    });
  });
});
