import { OVERRIDE_MIN_LENGTH, RULE_LABEL } from '../../../core/data-access/adt/bed-compatibility';
import type { CompatibilityViolation, PlacementOverride } from '../../../core/data-access/adt/adt.types';
import type { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';

/** Las violaciones de un 409/422 de ADT (`details.violations`). */
export function violationsOf(details: Readonly<Record<string, unknown>>): CompatibilityViolation[] {
  const v = details['violations'];
  return Array.isArray(v) ? (v as CompatibilityViolation[]) : [];
}

/**
 * «Forzar con justificación» (F3.4): `confirmWithReason` con mínimo de 20
 * caracteres y el aviso de que queda un incidente de calidad. Sólo se ofrece
 * con violaciones **forzables**; las bloqueantes no tienen salida.
 */
export async function askOverride(
  dialogs: DialogService,
  violations: readonly CompatibilityViolation[],
): Promise<PlacementOverride | null> {
  const forzables = violations.filter((v) => v.severity === 'OVERRIDABLE');
  if (forzables.length === 0 || forzables.length !== violations.length) return null;
  const reglas = forzables.map((v) => RULE_LABEL[v.rule]).join(', ');
  const justificacion = await dialogs.confirmWithReason(
    {
      title: 'Forzar la compatibilidad',
      message: `Se va a ubicar al paciente aunque no cumple: ${reglas}. Queda registrado un incidente de calidad que revisa supervisión.`,
      confirmLabel: 'Forzar con justificación',
      destructive: true,
    },
    { label: 'Justificación clínica', hint: `Al menos ${OVERRIDE_MIN_LENGTH} caracteres.`, minLength: OVERRIDE_MIN_LENGTH, maxLength: 600 },
  );
  return justificacion === null ? null : { justification: justificacion, ruleCodes: forzables.map((v) => v.rule) };
}
