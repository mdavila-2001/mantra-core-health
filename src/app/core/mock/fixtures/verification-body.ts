import { isoDia } from '../mock-store';
import type { SimulatedShowcase } from './community';
import { professionalById } from './people';
import type { ProfesionalSimulado } from './people.types';

/**
 * Profesionales de la maqueta con el trámite de verificación EN CURSO
 * (`IN_REVIEW`): están registrados, sin verificar todavía, y alguien los está
 * revisando. Es lo que distingue «en proceso» de «nadie lo miró» en la insignia.
 * Se identifican por el slug de la semilla (`professional('sinespecialidad', …)`).
 */
const IN_REVIEW_SLUGS: ReadonlySet<string> = new Set(['ramiro-cespedes']);

/**
 * El objeto `verification` como lo serializa la API (aditivo, junto a
 * `verified`). Sólo `verified: true` es VERIFIED; el resto es IN_REVIEW si hay
 * trámite en curso o UNVERIFIED. Las fechas sólo existen para el verificado.
 */
export function verificationBodyOf(
  p: Pick<ProfesionalSimulado, 'verified' | 'slug'>,
): { status: string; verifiedAt: string | null; validUntil: string | null } {
  if (p.verified) {
    return { status: 'VERIFIED', verifiedAt: isoDia(-180), validUntil: isoDia(365) };
  }
  return {
    status: IN_REVIEW_SLUGS.has(p.slug) ? 'IN_REVIEW' : 'UNVERIFIED',
    verifiedAt: null,
    validUntil: null,
  };
}

/** `verification` sólo para los profesionales: una clínica no es «un profesional verificado». */
export function showcaseVerification(v: SimulatedShowcase): {
  verification?: ReturnType<typeof verificationBodyOf>;
} {
  const profesional = v.kind === 'PRACTITIONER' ? professionalById(v.targetId) : undefined;
  return profesional === undefined ? {} : { verification: verificationBodyOf(profesional) };
}
