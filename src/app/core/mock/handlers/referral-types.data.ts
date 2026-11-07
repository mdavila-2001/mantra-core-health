/* The referral types the simulated API accepts (`referrals.handlers.ts`, `referral-issue.handlers.ts`). */

export const REFERRAL_TYPES = [
  'TREATMENT',
  'CONSULTATION',
  'DIAGNOSTIC_STUDY',
  'PROCEDURE',
  'SECOND_OPINION',
  'THERAPY',
  'HOSPITALIZATION',
  'OTHER',
] as const;
