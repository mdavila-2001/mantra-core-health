import type {
  ReviewDecisionKind,
  ReviewEvidence,
  ReviewItem,
} from '../../../core/data-access/access-governance/access-reviews.types';

/* ============================================================================
    Reglas de la revisión de un acceso que la pantalla aplica ANTES de pedir (CONTRATO-GOBIERNO §6.2).

    Son ayuda para no mandar lo que se sabe rechazado; la autoridad es la API, que repite cada una (422
    `REVIEW_COMMENT_REQUIRED`, `REVIEW_ADJUST_CANNOT_BROADEN`, `REVIEW_BULK_NOT_ALLOWED`).
   ========================================================================== */

/** Largo mínimo del comentario cuando es obligatorio (el servidor pide 10). */
export const MIN_COMMENT = 10;

type Usage = NonNullable<ReviewEvidence['usage90d']>[number];

/** Permisos que no se usaron en los últimos 90 días (sin ningún uso, permitido o negado). Sin evidencia no se puede decir. */
export function unusedAtoms(item: ReviewItem): readonly string[] {
  const evidence = item.evidence;
  if (evidence?.atoms === undefined) return [];
  const usos = evidence.usage90d ?? [];
  return evidence.atoms
    .filter((a) => {
      const uso = usos.find((u) => u.atom === a.code);
      return uso === undefined || uso.permit + uso.deny === 0;
    })
    .map((a) => a.code);
}

/**
 * ¿Hace falta comentario? Siempre al quitar y al ajustar; al mantener, si algo es de riesgo ALTO o CRÍTICO o si algún
 * permiso no se usó en los últimos 90 días.
 */
export function commentRequired(item: ReviewItem, decision: ReviewDecisionKind): boolean {
  if (decision !== 'CERTIFY') return true;
  if (item.maxSensitivity === 'HIGH' || item.maxSensitivity === 'CRITICAL') return true;
  return unusedAtoms(item).length > 0;
}

export function commentProblem(comment: string, required: boolean): string | null {
  return required && comment.trim().length < MIN_COMMENT
    ? `Escriba al menos ${MIN_COMMENT} caracteres.`
    : null;
}

/** «Sin uso» o la fecha del último uso. */
export function lastUsedText(usage: Usage): string {
  if (usage.lastUsedAt === null || usage.permit + usage.deny === 0) return 'Sin uso';
  const fecha = new Date(usage.lastUsedAt);
  return Number.isNaN(fecha.getTime())
    ? 'Sin uso'
    : fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface AdjustmentForm {
  /** Los permisos que se CONSERVAN. */
  readonly atoms: readonly string[];
  /** Nueva fecha de fin (`AAAA-MM-DD`); `null` si no se acorta. */
  readonly validTo: string | null;
}

/** El vencimiento más lejano que hoy tiene la concesión (un ajuste solo puede acortarlo). */
function currentValidTo(item: ReviewItem): number | null {
  const fechas = (item.evidence?.grants ?? [])
    .map((g) => g.validTo)
    .filter((v): v is string => v !== null);
  if (fechas.length === 0) return null;
  return Math.max(...fechas.map((f) => new Date(f).getTime()));
}

/** Por qué un ajuste no se puede mandar. Un ajuste solo reduce: quitar permisos o acortar la vigencia. */
export function adjustProblems(
  item: ReviewItem,
  form: AdjustmentForm,
  now: Date = new Date(),
): readonly string[] {
  const problemas: string[] = [];
  const actuales = item.evidence?.atoms?.map((a) => a.code) ?? [];
  const quita = form.atoms.length < actuales.length;
  const acorta = form.validTo !== null && form.validTo !== '';
  if (form.atoms.length === 0)
    problemas.push('Debe quedar al menos un permiso; si no, use «Quitar».');
  if (acorta) {
    const fin = new Date(`${form.validTo}T23:59:59`).getTime();
    if (Number.isNaN(fin) || fin <= now.getTime())
      problemas.push('La nueva fecha debe ser futura.');
    else {
      const actual = currentValidTo(item);
      if (actual !== null && fin >= actual)
        problemas.push(
          'La nueva fecha debe ser anterior al vencimiento actual: un ajuste solo reduce.',
        );
    }
  }
  if (!quita && !acorta)
    problemas.push(
      'Quite algún permiso o acorte la vigencia: un ajuste no puede dejar todo igual.',
    );
  return problemas;
}
